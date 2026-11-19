import * as THREE from 'three';
import { WORLD } from './config.js';
import { clamp, lerp, smoothstep, fbm, vnoise, catmull } from './util.js';

// -------------------------------------------------------------------------------------------
// Layout
// -------------------------------------------------------------------------------------------
export const L = {
  spawn: { x: 0, z: 119, y: -9 },
  arrival: { x: 0, zBottom: 112, zTop: 94, y0: -9, y1: 0, w: 10, N: 18 },
  gate1: { x: 0, z: 85 },
  canal: { z: 76, hw: 3, x0: -46, x1: 46 },
  bridge: { x: 0, z: 76, hw: 4.5, deckY: 1.2 },
  gate2: { x: 0, z: 60 },
  pondW: { x: -63, z: 30, r: 8.5 },
  pondE: { x: 63, z: -14, r: 7 },
  pool: { x: 0, z: 1, hx: 9, hz: 11 },
  pavA: { x: -30, z: 38, h: 5 },
  pavB: { x: 40, z: 21, h: 5 },
  pyr: { x: WORLD.pyramid.x, z: WORLD.pyramid.z },
  reveal: { x: 0, z: -48, y: 10 },
};

export const PYR = WORLD.pyramid;
PYR.top = PYR.tierH * PYR.tiers; // 10
PYR.stairs = { x: 0, hw: 4, zBottom: PYR.z + PYR.halves[0], zTop: PYR.z + PYR.halves[4], N: 25, rise: PYR.top / 25 };

// Main route (control points x,z). The player can walk anywhere; this is the visual guide.
export const ROUTE_CTRL = [
  [0, 112], [0, 94], [0, 72], [0, 62], [-10, 55], [-26, 51], [-40, 46], [-47, 36], [-43, 25], [-32, 15],
  [-14, 20], [10, 21], [29, 13], [41, 3], [48, -8], [44, -19], [28, -24], [12, -25], [0, -27],
];
export const ROUTE = catmull(ROUTE_CTRL, 14);

// -------------------------------------------------------------------------------------------
// Terrain
// -------------------------------------------------------------------------------------------
const P = WORLD.plateau;
const pcx = (P.x0 + P.x1) / 2, pcz = (P.z0 + P.z1) / 2, phx = (P.x1 - P.x0) / 2, phz = (P.z1 - P.z0) / 2;

export function plateauDist(x, z) {
  const qx = Math.abs(x - pcx) - (phx - P.r), qz = Math.abs(z - pcz) - (phz - P.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - P.r;
}

function duneH(x, z, d) {
  const n1 = fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 3);
  const r1 = 1 - Math.abs(vnoise(x * 0.018 + n1 * 2.5, z * 0.026 - n1 * 1.5) * 2 - 1);
  const ridge = r1 * r1;
  let h = -11.5 + n1 * 5.5 + ridge * 6.5 * (0.45 + 0.55 * vnoise(x * 0.006, z * 0.006));
  h += Math.max(0, d - 40) * 0.052; // far dunes rise to frame the horizon
  h += Math.max(0, d - 200) * 0.10;
  return h;
}

export function terrainY(x, z) {
  const d = plateauDist(x, z);
  if (d <= 0) return 0;
  const tt = 1 - Math.pow(1 - clamp(d / 7, 0, 1), 2.4);
  let dune = duneH(x, z, d);
  // flat arrival pad
  const sp = Math.hypot((x - L.spawn.x) * 0.8, z - L.spawn.z - 4);
  dune = lerp(L.spawn.y, dune, smoothstep(10, 30, sp));
  return lerp(0, dune, tt);
}

// -------------------------------------------------------------------------------------------
// Walkability
// -------------------------------------------------------------------------------------------
export const holes = [];     // water + planters etc. {type:'rect'|'circle'}
export const overrides = []; // fn(x,z) -> height | null (first non-null wins)
export const raised = [];    // fn(x,z) -> height (max wins)
export const circles = [];   // {x,z,r}
export const obbs = [];      // {x,z,hx,hz,c,s}
export const reserved = [];  // {x,z,r} free-space reservations for vegetation placement

export function addHoleRect(cx, cz, hx, hz) { holes.push({ t: 0, cx, cz, hx, hz }); }
export function addHoleCircle(cx, cz, r) { holes.push({ t: 1, cx, cz, r }); }
export function addCircle(x, z, r) { circles.push({ x, z, r }); reserved.push({ x, z, r: r + 0.6 }); }
export function addBox(cx, cz, hx, hz, rot = 0) { obbs.push({ x: cx, z: cz, hx, hz, c: Math.cos(rot), s: -Math.sin(rot) }); reserved.push({ x: cx, z: cz, r: Math.hypot(hx, hz) + 0.8 }); }
export function reserve(x, z, r) { reserved.push({ x, z, r }); }

// arrival stairs (ascending toward -z)
overrides.push((x, z) => {
  const a = L.arrival;
  if (Math.abs(x - a.x) > a.w / 2 || z > a.zBottom + 4 || z < a.zTop) return null;
  if (z >= a.zBottom) return a.y0;
  const t = (a.zBottom - z) / (a.zBottom - a.zTop);
  return a.y0 + (a.y1 - a.y0) * Math.ceil(t * a.N) / a.N;
});
// spawn pad
overrides.push((x, z) => (z > L.arrival.zBottom + 3.9 && Math.abs(x) < 24 && z < 140 ? L.arrival.y0 : null));
// canal bridge deck + steps
overrides.push((x, z) => {
  const b = L.bridge; if (Math.abs(x - b.x) > b.hw) return null;
  const dz = Math.abs(z - b.z); if (dz > 5.5) return null;
  const idx = clamp(Math.floor((5.5 - dz) / 0.6667) + 1, 0, 3);
  return 0.4 * idx;
});
// pyramid stairs
overrides.push((x, z) => {
  const s = PYR.stairs; if (Math.abs(x - s.x) > s.hw) return null;
  if (z > s.zBottom || z < s.zTop - 0.0) return null;
  const t = (s.zBottom - z) / (s.zBottom - s.zTop);
  return s.rise * Math.ceil(t * s.N);
});
// pyramid body
raised.push((x, z) => {
  const dx = Math.abs(x - PYR.x), dz = Math.abs(z - PYR.z), m = Math.max(dx, dz);
  let h = 0; for (let i = 0; i < PYR.tiers; i++) if (m <= PYR.halves[i]) h = PYR.tierH * (i + 1);
  return h;
});

export function inPlateau(x, z) { return plateauDist(x, z) < -0.3; }

export function walkH(x, z) {
  for (let i = 0; i < overrides.length; i++) { const v = overrides[i](x, z); if (v !== null) return v; }
  let h = inPlateau(x, z) ? 0 : -99;
  for (let i = 0; i < holes.length; i++) {
    const o = holes[i];
    if (o.t === 0) { if (Math.abs(x - o.cx) < o.hx && Math.abs(z - o.cz) < o.hz) { h = -99; break; } }
    else if ((x - o.cx) ** 2 + (z - o.cz) ** 2 < o.r * o.r) { h = -99; break; }
  }
  if (h > -50) for (let i = 0; i < raised.length; i++) { const v = raised[i](x, z); if (v > h) h = v; }
  return h;
}

export function blockedByCollider(x, z, r) {
  for (let i = 0; i < circles.length; i++) { const c = circles[i]; const dx = x - c.x, dz = z - c.z, rr = c.r + r; if (dx * dx + dz * dz < rr * rr) return true; }
  for (let i = 0; i < obbs.length; i++) {
    const b = obbs[i]; const dx = x - b.x, dz = z - b.z;
    const lx = dx * b.c + dz * b.s, lz = -dx * b.s + dz * b.c;
    if (Math.abs(lx) < b.hx + r && Math.abs(lz) < b.hz + r) return true;
  }
  return false;
}

/** Can a walker standing at height h move to (x,z)? Returns new height or null. */
export function canStand(x, z, curH, r = 0.34, maxUp = 0.75, maxDown = 1.3) {
  const h = walkH(x, z);
  if (h < -50) return null;
  if (h - curH > maxUp || curH - h > maxDown) return null;
  if (blockedByCollider(x, z, r)) return null;
  // probe slightly ahead of the body so we don't clip into walls/steps
  return h;
}

export function isFree(x, z, r = 1) {
  for (let i = 0; i < reserved.length; i++) { const o = reserved[i]; const dx = x - o.x, dz = z - o.z, rr = o.r + r; if (dx * dx + dz * dz < rr * rr) return false; }
  return true;
}

// -------------------------------------------------------------------------------------------
// Path distance + ground classification
// -------------------------------------------------------------------------------------------
const routeN = ROUTE.length;
export function pathDist(x, z) {
  let best = 1e9, bi = 0;
  for (let i = 0; i < routeN; i++) { const p = ROUTE[i]; const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < best) { best = d; bi = i; } }
  return { d: Math.sqrt(best), i: bi };
}

export const PLAZA = { x0: -30, x1: 30, z0: -28, z1: 28 };
export function inPlaza(x, z) { return x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1; }

/** 'stone' | 'sand' | 'grass' | 'wood' */
export function groundType(x, z, y = 0) {
  if (y > 0.3) return 'stone';
  if (inPlaza(x, z)) return 'stone';
  const pd = pathDist(x, z).d;
  if (pd < 3.6) return 'stone';
  if (Math.hypot(x - L.pavA.x, z - L.pavA.z) < 7 || Math.hypot(x - L.pavB.x, z - L.pavB.z) < 7) return 'stone';
  if (z > L.arrival.zTop - 12 && Math.abs(x) < 6) return 'stone';
  return 'sand';
}

export function pathWidthAt(i) { return 3.6; }

// Walk the player toward a location along a ray, used by tests for screenshot placements.
export const tmpV = new THREE.Vector3();
