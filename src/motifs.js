import * as THREE from 'three';
import { PAL } from './config.js';
import { col } from './util.js';

const GOLD = col(PAL.gold), GOLD_D = col(PAL.goldDeep), VERM = col(PAL.vermilion), VERM_D = col(PAL.vermilionDeep);
const TURQ = col(PAL.turquoise), JADE = col(PAL.jade), STONE = col(PAL.stone), STONE_S = col(PAL.stoneShade);
export const C = { GOLD, GOLD_D, VERM, VERM_D, TURQ, JADE, STONE, STONE_S, INK: col(PAL.ink), WOOD: col(PAL.wood), CREAM: col(PAL.cream) };

export const glowCol = (r, g, b) => new THREE.Color(r, g, b);
export const GLOW_WARM = glowCol(3.4, 2.1, 0.85);
export const GLOW_SOFT = glowCol(2.1, 1.3, 0.6);

// Mayan step-fret (xicalcoliuhqui) built from a handful of boxes. Local frame: x along wall, y up. Faces +z.
const FRET = [[0, 0, 1, 5], [1, 4, 4, 1], [4, 1, 1, 3], [2, 1, 3, 1], [2, 2, 1, 1]];
export function fret(b, { pos, rotY = 0, u = 0.12, depth = 0.1, color = GOLD, bucket = 'gold' }) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  for (const [gx, gy, gw, gh] of FRET) {
    const lx = (gx + gw / 2 - 2.5) * u, ly = (gy + gh / 2 - 2.5) * u;
    b.box(gw * u * 0.98, gh * u * 0.98, depth, { bevel: 0, pos: [pos[0] + lx * c, pos[1] + ly, pos[2] - lx * s], rotY, color, bucket });
  }
}

// Cloud-scroll / dragon curl: spiral tube + head bead
const curlCache = new Map();
function curlGeo(turns, r0, tube) {
  const k = `${turns}|${r0}|${tube}`; let g = curlCache.get(k); if (g) return g;
  const pts = []; const N = 18;
  for (let i = 0; i <= N; i++) { const t = i / N; const a = t * turns * Math.PI * 2; const r = r0 * (1 - 0.82 * t); pts.push(new THREE.Vector3(Math.cos(a) * r - r0 * 0.4 * (1 - t), Math.sin(a) * r, 0)); }
  g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, tube, 4, false); g.deleteAttribute('uv');
  curlCache.set(k, g); return g;
}
export function curl(b, { pos, rotY = 0, rotZ = 0, scale = 1, color = GOLD, mirror = false, turns = 1.25, bucket = 'gold' }) {
  const g = curlGeo(turns, 0.32, 0.055);
  b.add(g, { pos, rot: [0, rotY, rotZ], scale: [mirror ? -scale : scale, scale, scale], color, bucket });
  b.sphere(0.085 * scale, { pos: pos, rot: [0, rotY, rotZ], color, bucket, scale: 1 }, 5, 4);
}

// Sun disc: gold ring, glowing core, alternating rays, vermilion boss. Faces +/-z (disc plane = XY).
export function sunDisc(b, { pos, rotY = 0, r = 1.2, rays = 16, glow = GLOW_WARM, thick = 0.16 }) {
  const rot = [Math.PI / 2, rotY, 0];
  const c = Math.cos(rotY), s = Math.sin(rotY);
  // build in local frame then rotate: plane XY, normal Z. use cylinder axis (y) rotated to z via rot x
  b.cyl(r * 0.86, r * 0.86, thick * 0.7, 20, { pos, rot, color: glow, bucket: 'glow' });
  b.torus(r * 0.93, r * 0.075, { pos, rot: [0, rotY, 0], color: GOLD }, 5, 22);
  b.cyl(r * 0.2, r * 0.2, thick * 1.5, 10, { pos, rot, color: VERM_D, bucket: 'gold' });
  b.cyl(r * 0.12, r * 0.12, thick * 1.8, 8, { pos, rot, color: C.GOLD, bucket: 'gold' });
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2; const long = i % 2 === 0;
    const rl = r * (long ? 0.42 : 0.28);
    const dr = r * 0.93 + rl * 0.5 + r * 0.04;
    const lx = Math.cos(a) * dr, ly = Math.sin(a) * dr;
    // ray = flattened cone pointing outward
    b.add(new THREE.ConeGeometry(r * 0.075, rl, 4), { pos: [pos[0] + lx * c, pos[1] + ly, pos[2] - lx * s], rot: [0, rotY, a - Math.PI / 2], scale: [1, 1, 0.55], color: long ? GOLD : C.GOLD_D, bucket: 'gold' });
  }
}

// Mayan-style glyph band wrapped around a vertical cylinder
export function glyphBand(b, { x, y, z, r, n = 10, h = 0.32, alt = [GOLD, TURQ, JADE] }) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const px = x + Math.cos(a) * (r + 0.02), pz = z + Math.sin(a) * (r + 0.02);
    const cc = alt[i % alt.length];
    b.box(0.3, h, 0.1, { bevel: 0, pos: [px, y, pz], rotY: -a + Math.PI / 2, color: cc, bucket: cc === GOLD ? 'gold' : 'main' });
    b.box(0.16, h * 0.45, 0.13, { bevel: 0, pos: [x + Math.cos(a) * (r + 0.04), y + h * 0.32, z + Math.sin(a) * (r + 0.04)], rotY: -a + Math.PI / 2, color: VERM_D, bucket: 'main' });
  }
}

// gold ring stud (sun-ring ornament like the reference's trim), facing +z by default
export function ringStud(b, { pos, rotY = 0, r = 0.16 }) {
  b.cyl(r, r, 0.06, 8, { pos, rot: [Math.PI / 2, rotY, 0], color: GOLD, bucket: 'gold' });
  b.cyl(r * 0.5, r * 0.5, 0.09, 6, { pos, rot: [Math.PI / 2, rotY, 0], color: VERM_D, bucket: 'main' });
}
export function studRow(b, { from, to, y, spacing = 0.9, rotY = 0, r = 0.16, nOff = 0.0 }) {
  const dx = to[0] - from[0], dz = to[1] - from[1]; const L = Math.hypot(dx, dz); const n = Math.max(1, Math.floor(L / spacing));
  const nx = -dz / L * nOff, nz = dx / L * nOff;
  for (let i = 0; i <= n; i++) { const t = i / n; ringStud(b, { pos: [from[0] + dx * t + nx, y, from[1] + dz * t + nz], rotY, r }); }
}

// ---------------------------------------------------------------------------------------------
// Lanterns
// ---------------------------------------------------------------------------------------------
/** Static sun-disc lantern head (glowing disc in gold ring) facing +/-z (rotY rotates). */
export function lanternHead(b, deco, { pos, rotY = 0, r = 0.42, halo = true, push = true }) {
  const rot = [Math.PI / 2, rotY, 0];
  b.cyl(r, r, r * 0.8, 14, { pos, rot, color: GLOW_WARM, bucket: 'glow' });
  b.torus(r * 1.02, r * 0.1, { pos, rot: [0, rotY, 0], color: GOLD }, 5, 16);
  b.cyl(r * 0.22, r * 0.22, r * 0.95, 6, { pos, rot, color: VERM_D, bucket: 'gold' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = Math.cos(rotY), s = Math.sin(rotY); const lx = Math.cos(a) * r * 1.22, ly = Math.sin(a) * r * 1.22;
    b.add(new THREE.ConeGeometry(r * 0.1, r * 0.34, 4), { pos: [pos[0] + lx * c, pos[1] + ly, pos[2] - lx * s], rot: [0, rotY, a - Math.PI / 2], color: GOLD, bucket: 'gold', scale: [1, 1, 0.6] });
  }
  // little turquoise cap + tassel
  b.cone(r * 0.55, r * 0.5, 6, { pos: [pos[0], pos[1] + r * 1.6, pos[2]], color: C.TURQ });
  b.cyl(0.02, 0.05, r * 0.9, 4, { pos: [pos[0], pos[1] - r * 1.45, pos[2]], color: VERM });
  if (halo && deco) deco.halos.push({ x: pos[0], y: pos[1], z: pos[2], s: r * 6.5, a: 0.5 });
  if (push && deco) deco.lanternPts.push([pos[0], pos[1], pos[2]]);
}

/** Stone post lantern. returns top y */
export function lanternPost(b, deco, { x, z, y = 0, h = 2.6, rotY = 0, addCol = true }) {
  const stone = C.STONE;
  b.box(0.95, 0.35, 0.95, { pos: [x, y, z], base: true, color: C.STONE_S, groundDark: 0.15 });
  b.box(0.7, 0.25, 0.7, { pos: [x, y + 0.35, z], base: true, color: stone });
  b.cyl(0.17, 0.22, h - 0.6, 8, { pos: [x, y + 0.6, z], base: true, color: stone, color2: C.STONE_S });
  // gold sun collar
  b.torus(0.24, 0.045, { pos: [x, y + h - 0.02, z], rot: [Math.PI / 2, 0, 0], color: GOLD, bucket: 'gold' }, 4, 10);
  b.box(0.5, 0.12, 0.5, { pos: [x, y + h + 0.06, z], color: C.VERM_D });
  lanternHead(b, deco, { pos: [x, y + h + 0.55, z], rotY, r: 0.42 });
  if (addCol && deco) deco.circles.push([x, z, 0.5]);
  return y + h + 1;
}

// geometry for instanced, swaying hanging lanterns (anchor at origin, hangs down)
export function hangingLanternGeometry() {
  const parts = [];
  const add = (g, mat, color) => {
    let gg = g.index ? g.toNonIndexed() : g; gg.applyMatrix4(mat);
    const n = gg.attributes.position.count; const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
    gg.setAttribute('color', new THREE.BufferAttribute(arr, 3)); gg.deleteAttribute('uv'); parts.push(gg);
  };
  const T = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz));
  const goldC = col(PAL.gold).multiplyScalar(0.95);
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.035, 0.17, 0.035), T(0, -0.1 - i * 0.16, 0), goldC);
  add(new THREE.CylinderGeometry(0.14, 0.2, 0.12, 6), T(0, -0.72, 0), col(PAL.vermilionDeep));
  add(new THREE.SphereGeometry(0.44, 10, 7), T(0, -1.2, 0, 1, 1.05, 0.62), GLOW_WARM);
  add(new THREE.TorusGeometry(0.46, 0.045, 4, 14), T(0, -1.2, 0, 1, 1.05, 1), goldC);
  add(new THREE.TorusGeometry(0.46, 0.04, 4, 14), T(0, -1.2, 0, 1, 1.05, 1, Math.PI / 2), goldC);
  add(new THREE.ConeGeometry(0.28, 0.24, 6), T(0, -0.78, 0), col(PAL.turquoise));
  add(new THREE.CylinderGeometry(0.03, 0.06, 0.5, 4), T(0, -1.9, 0), col(PAL.vermilion));
  add(new THREE.ConeGeometry(0.1, 0.22, 5), T(0, -2.2, 0, 1, 1, 1, Math.PI), col(PAL.vermilion));
  return parts;
}
