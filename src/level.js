import * as THREE from 'three';
import { PAL, WORLD } from './config.js';
import { Builder, col, rng, samplePolyline, smoothstep, fbm } from './util.js';
import { C, sunDisc, lanternPost, lanternHead, ringStud, studRow, fret, curl, GLOW_WARM } from './motifs.js';
import {
  hipRoof, stairs, pyramid, pagoda, torii, pavilion, wall, planter, poolRim, pondRim, parapetSeg, serpentHead,
} from './buildings.js';
import { newDeco, cherryTree, bushAt, scatterGrass } from './decor.js';
import {
  L, PYR, ROUTE, PLAZA, inPlaza, inPlateau, pathDist, isFree, addCircle, addBox, addHoleRect, reserve, terrainY, plateauDist, raised,
} from './world.js';

const { GOLD, VERM, VERM_D, TURQ, JADE, STONE, STONE_S } = C;

export function buildLevel(q) {
  const b = new Builder(44);
  const deco = newDeco();
  const R = rng(1234);
  const waters = [];

  // ---------------------------------------------------------------- arrival stairs + gate
  const A = L.arrival;
  stairs(b, deco, { x: A.x, zBottom: A.zBottom, zTop: A.zTop, y0: A.y0, y1: A.y1, w: A.w, N: A.N, wallH: 1.4, balW: 1.1, sink: 4 });
  for (const sd of [-1, 1]) {
    serpentHead(b, { x: sd * (A.w / 2 + 0.55), y: A.y0, z: A.zBottom + 1.6, rotY: 0, s: 1.3 });
    lanternPost(b, deco, { x: sd * (A.w / 2 + 0.55), z: A.zTop + 0.2, y: 0, h: 2.2 });
    lanternPost(b, deco, { x: sd * 7.2, z: A.zBottom + 3, y: A.y0, h: 2.2 });
  }
  torii(b, deco, { x: L.gate1.x, z: L.gate1.z, span: 11.5, height: 10.5, r: 0.7 });
  torii(b, deco, { x: L.gate2.x, z: L.gate2.z, span: 9.5, height: 8.2, r: 0.55 });

  // ---------------------------------------------------------------- plateau parapet
  {
    const P = WORLD.plateau, ins = 1.8, r = P.r - ins;
    const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, hx = (P.x1 - P.x0) / 2 - ins, hz = (P.z1 - P.z0) / 2 - ins;
    const pts = [];
    const corner = (ccx, ccz, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * Math.PI / 2; pts.push([ccx + Math.cos(a) * r, ccz + Math.sin(a) * r]); } };
    corner(cx + hx - r, cz + hz - r, 0); corner(cx - hx + r, cz + hz - r, Math.PI / 2); corner(cx - hx + r, cz - hz + r, Math.PI); corner(cx + hx - r, cz - hz + r, Math.PI * 1.5);
    pts.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const L2 = Math.hypot(x1 - x0, z1 - z0); const n = Math.max(1, Math.round(L2 / 7));
      for (let k = 0; k < n; k++) {
        const ax = x0 + (x1 - x0) * k / n, az = z0 + (z1 - z0) * k / n, bx = x0 + (x1 - x0) * (k + 1) / n, bz = z0 + (z1 - z0) * (k + 1) / n;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        if (mz > P.z1 - 6 && Math.abs(mx) < 9) continue;
        parapetSeg(b, deco, ax, az, bx, bz);
        if ((i + k) % 3 === 0) lanternPost(b, deco, { x: ax, z: az, y: 0, h: 1.9 });
      }
    }
  }

  // ---------------------------------------------------------------- canal + bridge
  {
    const cz = L.canal.z, hw = L.canal.hw, X = 58;
    waters.push({ cx: 0, cz, hx: X, hz: hw, y: 0.32 });
    deco.koi.push({ cx: 0, cz, rx: 50, rz: 1.8 });
    b.box(2 * X, 0.05, 2 * hw + 0.4, { pos: [0, 0.035, cz], bevel: 0, color: col(PAL.turquoiseDeep), color2: col(PAL.turquoise) });
    for (const sd of [-1, 1]) wall(b, deco, { x0: -X, z0: cz + sd * (hw + 0.35), x1: X, z1: cz + sd * (hw + 0.35), h: 0.58, t: 0.7, collide: false, frieze: true });
    for (const sd of [-1, 1]) {
      b.box(1.6, 0.9, 2 * hw + 1.8, { pos: [sd * (X + 0.6), 0.45, cz], bevel: 0.05, color: STONE });
      lanternPost(b, deco, { x: sd * (X + 0.6), z: cz + hw + 1.9, y: 0, h: 2.2 });
      lanternPost(b, deco, { x: sd * (X + 0.6), z: cz - hw - 1.9, y: 0, h: 2.2 });
      // dragon-curl spout block
      curl(b, { pos: [sd * (X - 0.2), 1.5, cz], rotY: sd > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 2.2, color: GOLD });
    }
    addHoleRect(0, cz, X + 1.4, hw + 0.75);
    // bridge
    const bx = L.bridge.x, bz = L.bridge.z, hwB = L.bridge.hw;
    b.box(2 * hwB, 0.5, 8.34, { pos: [bx, 0.95, bz], bevel: 0.06, color: STONE, color2: STONE });
    b.box(2 * hwB + 0.3, 0.14, 8.5, { pos: [bx, 1.2, bz], bevel: 0.03, color: STONE_S });
    for (const sd of [-1, 1]) {
      for (let k = 1; k <= 3; k++) {
        const zc = bz + sd * (5.5 - 0.6667 * (k - 0.5));
        b.box(2 * hwB, 0.4 * k, 0.6667, { pos: [bx, 0.2 * k, zc], bevel: 0.04, color: k % 2 ? STONE : STONE_S });
        b.box(2 * hwB * 0.98, 0.05, 0.1, { pos: [bx, 0.4 * k - 0.02, zc + sd * -0.3], bevel: 0, color: GOLD, bucket: 'gold' });
      }
      // rails
    }
    for (const sx of [-1, 1]) {
      const x = bx + sx * (hwB - 0.25);
      b.box(0.5, 0.95, 8.34, { pos: [x, 1.2 + 0.475, bz], bevel: 0.05, color: STONE });
      b.box(0.68, 0.12, 8.5, { pos: [x, 1.2 + 1.0, bz], bevel: 0.02, color: GOLD, bucket: 'gold' });
      for (let k = 0; k < 4; k++) fret(b, { pos: [x + sx * 0.27, 1.2 + 0.5, bz - 3.0 + k * 2.0], rotY: sx * Math.PI / 2, u: 0.1, depth: 0.05 });
      sunDisc(b, { pos: [x + sx * 0.3, 1.2 + 0.5, bz], rotY: sx * Math.PI / 2, r: 0.38, rays: 8 });
      addBox(x, bz, 0.3, 4.2);
      for (const sz of [-1, 1]) lanternPost(b, deco, { x: x, z: bz + sz * 4.2, y: 1.2, h: 1.6 });
    }
    deco.chimeSpots.push([0, 2, cz]);
  }

  // ---------------------------------------------------------------- ponds
  const pond = (p) => {
    pondRim(b, deco, { x: p.x, z: p.z, r: p.r });
    waters.push({ cx: p.x, cz: p.z, r: p.r, y: 0.3 });
    deco.koi.push({ cx: p.x, cz: p.z, rx: p.r * 0.72, rz: p.r * 0.72 });
    b.cyl(p.r, p.r, 0.05, 28, { pos: [p.x, 0.035, p.z], color: col(PAL.turquoiseDeep), color2: col(PAL.turquoise) });
    // stepping island with sun stele
    b.cyl(1.7, 2.1, 0.7, 10, { pos: [p.x + p.r * 0.25, 0, p.z - p.r * 0.2], base: true, color: STONE, color2: STONE_S });
    sunDisc(b, { pos: [p.x + p.r * 0.25, 2.2, p.z - p.r * 0.2], rotY: 0.5, r: 1.0, rays: 12 });
    b.cyl(0.14, 0.18, 1.4, 6, { pos: [p.x + p.r * 0.25, 0.7, p.z - p.r * 0.2], base: true, color: VERM });
    // lily pads + lotus
    for (let i = 0; i < 14; i++) {
      const a = R() * 6.28, d = R() * (p.r - 1.2); const px = p.x + Math.cos(a) * d, pz = p.z + Math.sin(a) * d;
      if (Math.hypot(px - (p.x + p.r * 0.25), pz - (p.z - p.r * 0.2)) < 2.6) continue;
      b.cyl(0.5 + R() * 0.3, 0.5, 0.03, 7, { pos: [px, 0.36, pz], color: col(0x4fa86a), color2: col(0x8cc870) });
      if (i % 3 === 0) b.cone(0.18, 0.3, 6, { pos: [px, 0.52, pz], color: col(PAL.blossom) });
    }
  };
  pond(L.pondW); pond(L.pondE);
  for (const p of [L.pondW, L.pondE]) for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + 0.4; lanternPost(b, deco, { x: p.x + Math.cos(a) * (p.r + 2.6), z: p.z + Math.sin(a) * (p.r + 2.6), y: 0, h: 2.0 }); }

  // ---------------------------------------------------------------- pool plaza
  {
    const p = L.pool;
    poolRim(b, deco, { x: p.x, z: p.z, hx: p.hx, hz: p.hz });
    waters.push({ cx: p.x, cz: p.z, hx: p.hx, hz: p.hz, y: 0.4 });
    deco.koi.push({ cx: p.x, cz: p.z, rx: 6.5, rz: 8.5 });
    b.box(2 * p.hx, 0.05, 2 * p.hz, { pos: [p.x, 0.035, p.z], bevel: 0, color: col(PAL.turquoiseDeep), color2: col(PAL.turquoise) });
    // central sun plinth
    b.cyl(2.6, 3.0, 0.5, 12, { pos: [p.x, 0, p.z], base: true, color: STONE_S });
    b.cyl(2.0, 2.3, 0.5, 12, { pos: [p.x, 0.5, p.z], base: true, color: STONE });
    b.torus(2.05, 0.07, { pos: [p.x, 1.0, p.z], rot: [Math.PI / 2, 0, 0], color: GOLD, bucket: 'gold' }, 4, 20);
    b.cyl(0.3, 0.4, 2.1, 8, { pos: [p.x, 1.0, p.z], base: true, color: VERM, color2: VERM_D });
    sunDisc(b, { pos: [p.x, 4.4, p.z], rotY: Math.PI / 2 - 0.9, r: 1.7, rays: 20 });
    sunDisc(b, { pos: [p.x, 4.4, p.z], rotY: -0.9, r: 1.7, rays: 20 });
    deco.halos.push({ x: p.x, y: 4.4, z: p.z, s: 8, a: 0.5 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) lanternPost(b, deco, { x: p.x + sx * (p.hx + 2.6), z: p.z + sz * (p.hz + 2.6), y: 0, h: 2.4 });
    // plaza edge lanterns + planters + banner poles
    for (let t = -24; t <= 24; t += 12) { lanternPost(b, deco, { x: t, z: PLAZA.z1 - 1.5, y: 0, h: 2.2 }); lanternPost(b, deco, { x: t, z: PLAZA.z0 + 1.5, y: 0, h: 2.2, rotY: 0 }); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = sx * 25.5, pz = sz * 24 + 0.0;
      planter(b, deco, { x: px, z: pz, r: 1.9 });
      cherryTree(b, deco, { x: px, z: pz, y: 0.55, s: 1.15, lean: [-sx * 0.8, -sz * 0.6], seed: 40 + sx * 3 + sz, collide: false });
      // banner pole
      const bx = sx * 22, bz = sz * 15.5;
      b.cyl(0.11, 0.15, 9.5, 6, { pos: [bx, 0, bz], base: true, color: col(PAL.wood), color2: VERM_D });
      b.sphere(0.28, { pos: [bx, 9.7, bz], color: GOLD, bucket: 'gold' }, 7, 5);
      sunDisc(b, { pos: [bx, 10.7, bz], rotY: 0.4, r: 0.65, rays: 10 });
      deco.flags.push({ x: bx, y: 9.2, z: bz, rotY: 0.0, w: 1.4, h: 4.4, c: 0 });
      deco.flags.push({ x: bx, y: 9.2, z: bz + 0.05, rotY: Math.PI / 2, w: 1.2, h: 3.6, c: 1 });
      addCircle(bx, bz, 0.3);
    }
  }

  // ---------------------------------------------------------------- pavilions
  pavilion(b, deco, { x: L.pavA.x, z: L.pavA.z, size: L.pavA.h });
  pavilion(b, deco, { x: L.pavB.x, z: L.pavB.z, size: L.pavB.h });

  // ---------------------------------------------------------------- pyramid + pagoda
  pyramid(b, deco);
  pagoda(b, deco);
  {
    const cx = PYR.x, cz = PYR.z, y = PYR.top, H = 11.7;
    const S = PYR.stairs;
    const w = (x0, z0, x1, z1) => wall(b, deco, { x0, z0, x1, z1, y, h: 0.95, t: 0.6, collide: false });
    w(-H, cz + H, -S.hw - 1.1, cz + H); w(S.hw + 1.1, cz + H, H, cz + H);
    w(-H, cz - H, H, cz - H); w(H, cz - H, H, cz + H); w(-H, cz - H, -H, cz + H);
    // terrace lanterns + blossom planters on the tiers
    for (let t = 0; t < 4; t++) {
      const hh = PYR.halves[t], top = PYR.tierH * (t + 1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lanternPost(b, deco, { x: cx + sx * (hh - 1.4), z: cz + sz * (hh - 1.4), y: top, h: 1.9 });
      if (t === 1 || t === 3) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const px = cx + sx * (hh - 2.0), pz = cz + sz * (hh - 2.0);
        cherryTree(b, deco, { x: px, z: pz, y: top, s: 0.95, lean: [-sx * 0.7, -sz * 0.7], seed: 70 + t * 5 + sx + sz * 2, collide: false });
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = cx + sx * 9.7, pz = cz + sz * 9.7;
      cherryTree(b, deco, { x: px, z: pz, y: y, s: 1.05, lean: [-sx * 0.9, -sz * 0.9], seed: 90 + sx + sz * 2, collide: true });
      lanternPost(b, deco, { x: cx + sx * 6.4, z: cz + sz * 10.6, y, h: 2.0 });
    }
    // reveal marker: gold sun mosaic on the platform
    const rv = L.reveal;
    b.cyl(2.6, 2.6, 0.06, 24, { pos: [rv.x, y, rv.z], base: true, color: col(PAL.goldDeep), bucket: 'gold' });
    b.cyl(2.35, 2.35, 0.08, 24, { pos: [rv.x, y, rv.z], base: true, color: col(0xf6ead2) });
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; b.cone(0.3, 1.5, 3, { pos: [rv.x + Math.cos(a) * 1.4, y + 0.1, rv.z + Math.sin(a) * 1.4], rot: [Math.PI / 2, -a + Math.PI / 2 + Math.PI, 0], color: i % 2 ? TURQ : VERM }); }
    b.cyl(0.9, 0.9, 0.1, 16, { pos: [rv.x, y, rv.z], base: true, color: GLOW_WARM, bucket: 'glow' });
  }

  // ---------------------------------------------------------------- rear garden
  cherryTree(b, deco, { x: 0, z: -98, s: 2.2, lean: [0.5, 0.5], seed: 5 });
  b.cyl(5, 5.5, 0.35, 20, { pos: [0, 0, -98], base: true, color: STONE_S });
  for (const sx of [-1, 1]) { lanternPost(b, deco, { x: sx * 9, z: -92, h: 2.3 }); lanternPost(b, deco, { x: sx * 18, z: -96, h: 2.3 }); }
  for (const sx of [-1, 1]) cherryTree(b, deco, { x: sx * 34, z: -92, s: 1.3, lean: [-sx * 1.2, 0.5], seed: 8 + sx });

  // ---------------------------------------------------------------- vegetation
  const nearAny = (x, z, minD) => {
    if (!inPlateau(x, z) || plateauDist(x, z) > -5) return false;
    if (pathDist(x, z).d < minD) return false;
    if (x > PLAZA.x0 - 2 && x < PLAZA.x1 + 2 && z > PLAZA.z0 - 2 && z < PLAZA.z1 + 2) return false;
    if (Math.max(Math.abs(x - PYR.x), Math.abs(z - PYR.z)) < PYR.halves[0] + 4) return false;
    if (Math.abs(z - L.canal.z) < 7 && Math.abs(x) < 62) return false;
    for (const p of [L.pondW, L.pondE]) if (Math.hypot(x - p.x, z - p.z) < p.r + 4) return false;
    for (const p of [L.pavA, L.pavB]) if (Math.abs(x - p.x) < 9 && Math.abs(z - p.z) < 9) return false;
    if (z > L.arrival.zTop - 1 && Math.abs(x) < 11) return false;
    return isFree(x, z, 1.2);
  };
  // trees framing the route
  const samples = samplePolyline(ROUTE, 6.4);
  let ti = 0;
  for (const s of samples) {
    if (s.z > 93 || s.z < -30) continue;
    for (const side of [-1, 1]) {
      const off = (ti % 3 === 0 ? 5.9 : 8.2 + R() * 2.2) * side; ti++;
      const px = s.x - s.dz * off, pz = s.z + s.dx * off;
      if (!nearAny(px, pz, 4.6)) continue;
      const sc = 0.95 + R() * 0.55;
      cherryTree(b, deco, { x: px, z: pz, s: sc, lean: [(s.x - px) * 0.18, (s.z - pz) * 0.18], seed: Math.floor(R() * 1000) });
    }
  }
  // groves around the ponds, pavilions, gardens and rear
  const groveCenters = [[-63, 30, 22], [63, -14, 20], [-30, 38, 16], [40, 21, 16], [-70, -50, 22], [70, -50, 22], [-72, 56, 18], [76, 46, 18], [-40, -92, 18], [30, -92, 14], [-84, 10, 14], [84, 20, 14], [0, 100 - 18, 8]];
  for (const [gx, gz, gr] of groveCenters) {
    const n = Math.floor(gr * 0.5);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 8; tries++) {
        const a = R() * 6.283, d = 6 + R() * gr; const px = gx + Math.cos(a) * d, pz = gz + Math.sin(a) * d;
        if (!nearAny(px, pz, 4.0)) continue;
        cherryTree(b, deco, { x: px, z: pz, s: 0.9 + R() * 0.8, lean: [Math.cos(a + 3) * 0.7, Math.sin(a + 3) * 0.7], seed: Math.floor(R() * 5000) }); break;
      }
    }
  }
  // round bushes (like the reference)
  for (let i = 0; i < 500; i++) {
    const x = R.range(-92, 92), z = R.range(-104, 90);
    const pd = pathDist(x, z).d;
    if (pd < 4.6 || pd > 18 && R() < 0.8) continue;
    if (!nearAny(x, z, 4.4)) continue;
    bushAt(deco, x, z, 0.5 + R() * 0.8, i + 3);
    if (R() < 0.3) addCircle(x, z, 0.5);
  }
  for (let t = 0; t < samples.length; t += 1) {
    const s = samples[t]; if (s.z > 93 || t % 2) continue;
    for (const side of [-1, 1]) { const off = side * (4.4 + R() * 0.6); const px = s.x - s.dz * off, pz = s.z + s.dx * off; if (nearAny(px, pz, 4.1)) bushAt(deco, px, pz, 0.45 + R() * 0.35, 900 + t); }
  }
  // grass tufts
  scatterGrass(deco, 14000, (x, z) => {
    if (!inPlateau(x, z) || plateauDist(x, z) > -3) return false;
    const pd = pathDist(x, z).d; if (pd < 4.5) return false;
    if (x > PLAZA.x0 - 1 && x < PLAZA.x1 + 1 && z > PLAZA.z0 - 1 && z < PLAZA.z1 + 1) return false;
    if (Math.max(Math.abs(x - PYR.x), Math.abs(z - PYR.z)) < PYR.halves[0] + 0.5) return false;
    if (Math.abs(z - L.canal.z) < 6 && Math.abs(x) < 62) return false;
    for (const p of [L.pondW, L.pondE]) if (Math.hypot(x - p.x, z - p.z) < p.r + 3.2) return false;
    for (const p of [L.pavA, L.pavB]) if (Math.abs(x - p.x) < 8.2 && Math.abs(z - p.z) < 8.2) return false;
    if (z > L.arrival.zTop - 1 && Math.abs(x) < 7) return false;
    return fbm(x * 0.05, z * 0.05, 2) > 0.38 || pd < 11;
  });

  // ---------------------------------------------------------------- distant ghost ruins + mesas
  const far = new Builder(120);
  {
    const Rf = rng(99);
    const ruin = (x, z, s, kind) => {
      const y = terrainY(x, z) - 1;
      const sc = col(0xe9d2b8);
      for (let i = 0; i < 4; i++) { const h = (13 - i * 3) * s; far.box(h * 2.0, 4.2 * s, h * 2.0, { pos: [x, y + 4.2 * s * (i + 0.5), z], bevel: 0.2, color: sc, color2: col(0xf6e6cf) }); }
      if (kind) { // pagoda
        let yy = y + 16.8 * s; for (let t = 0; t < 4; t++) { far.box((4.2 - t * 0.7) * s, 3 * s, (4.2 - t * 0.7) * s, { pos: [x, yy + 1.5 * s, z], bevel: 0.1, color: col(0xefe0c8) }); hipRoof(far, null, { x, y: yy + 3 * s, z, R: (7 - t * 1.1) * s, ft: (3.1 - t * 0.6) * s, rise: 1.8 * s, lift: 1.1 * s, thick: 0.3 * s, glaze: col(0x7cc8c4), glazeB: col(0x4fa6a6), lanterns: false, ornament: false }); yy += 4.4 * s; }
        far.cyl(0.2 * s, 0.3 * s, 6 * s, 5, { pos: [x, yy + 3 * s, z], color: col(0xf2b43a), bucket: 'gold' });
      } else { far.box(9 * s, 2.5 * s, 9 * s, { pos: [x, y + 17.5 * s, z], bevel: 0.1, color: col(0xefe0c8) }); }
    };
    ruin(-230, -330, 3.2, 1); ruin(270, -300, 2.6, 0); ruin(-380, -120, 3.0, 1); ruin(360, 30, 3.4, 0); ruin(-300, 190, 3.0, 0); ruin(130, -420, 3.8, 1); ruin(-80, -450, 2.4, 0);
    for (let i = 0; i < 22; i++) {
      const a = Rf() * 6.283, d = 240 + Rf() * 230; const x = Math.cos(a) * d, z = Math.sin(a) * d - 60; const h = 18 + Rf() * 50, r = 22 + Rf() * 40;
      const y = terrainY(x, z) - 4; const sc = col(0xd89a68).lerp(col(0xefc79c), Rf());
      far.cyl(r * 0.8, r, h, 7, { pos: [x, y, z], base: true, color: col(0xb9694a), color2: sc });
      far.cyl(r * 0.84, r * 0.8, 3, 7, { pos: [x, y + h, z], base: true, color: col(0xf2cfa4) });
    }
  }

  deco.circles.forEach(([x, z, r]) => addCircle(x, z, r));

  // light shaft anchors
  const shafts = [];
  const Rs = rng(404);
  for (const s of samplePolyline(ROUTE, 11)) if (s.z < 112 && Rs() < 0.8) shafts.push([s.x + (Rs() - 0.5) * 8, s.z + (Rs() - 0.5) * 6, 14 + Rs() * 14, 3 + Rs() * 4, 0, 0.10 + Rs() * 0.10]);
  shafts.push([-1, L.gate1.z, 30, 7, 0, 0.18], [3, L.gate1.z + 2, 26, 6, 0, 0.15], [0, L.gate2.z, 24, 6, 0, 0.16], [-2, L.pool.z - 8, 28, 8, 0, 0.12], [-9, -20, 28, 8, 0, 0.12], [8, -14, 24, 6, 0, 0.12]);
  for (let i = 0; i < 6; i++) shafts.push([R.range(-60, 60), R.range(-30, 40), 20 + R() * 12, 4 + R() * 4, 0, 0.10]);

  return { farBuilder: far, builder: b, deco, waters, shafts };
}
