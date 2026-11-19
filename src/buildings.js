import * as THREE from 'three';
import { PAL } from './config.js';
import { col, lerp, smoothstep, rng, clamp } from './util.js';
import { C, GLOW_WARM, GLOW_SOFT, fret, curl, sunDisc, glyphBand, ringStud, studRow, lanternHead, lanternPost } from './motifs.js';
import { PYR, addCircle, addBox, addHoleRect, addHoleCircle, raised, L } from './world.js';

const { GOLD, GOLD_D, VERM, VERM_D, TURQ, JADE, STONE, STONE_S, INK } = C;
const TURQ_D = col(PAL.turquoiseDeep), JADE_D = col(PAL.jadeDeep);

// ---------------------------------------------------------------------------------------------
// Chinese hip roof with concave curve and upturned corners (also reused by pavilions, gates)
// ---------------------------------------------------------------------------------------------
export function hipRoof(b, deco, { x, y, z, R, ft, rise, lift = 1.3, edgeLift = 0.3, thick = 0.3, glaze = TURQ, glazeB = TURQ_D, lanterns = true, ornament = true }) {
  const J = 9, M = 8, N = 4 * M;
  const T = [], B = [], Ccol = [];
  const ringPt = (j, i) => {
    const s = j / J; const h = lerp(R, ft, s);
    const side = Math.floor(i / M), t = (i % M) / M;
    let px, pz;
    if (side === 0) { px = -h + 2 * h * t; pz = h; } else if (side === 1) { px = h; pz = h - 2 * h * t; } else if (side === 2) { px = h - 2 * h * t; pz = -h; } else { px = -h; pz = -h + 2 * h * t; }
    const cf = Math.abs(px * pz) / (h * h + 1e-6);
    const flare = 1 + 0.075 * Math.pow(cf, 1.2) * Math.pow(1 - s, 1.4);
    const py = rise * Math.pow(s, 1.7) + Math.pow(1 - s, 2.6) * (edgeLift + lift * Math.pow(cf, 1.8));
    return { x: px * flare, y: py, z: pz * flare, cf };
  };
  for (let j = 0; j <= J; j++) { T.push([]); B.push([]); Ccol.push([]); for (let i = 0; i < N; i++) { const p = ringPt(j, i); T[j].push(p); B[j].push({ x: p.x, y: p.y - thick * (1 - 0.35 * j / J), z: p.z }); } }
  const pos = [], colr = [];
  const push = (p, c) => { pos.push(p.x, p.y, p.z); colr.push(c.r, c.g, c.b); };
  const tri = (a, bb, c, ca, cb, cc, want) => {
    const ux = bb.x - a.x, uy = bb.y - a.y, uz = bb.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = (a.x + bb.x + c.x) / 3, cy = (a.y + bb.y + c.y) / 3, cz = (a.z + bb.z + c.z) / 3;
    if (!want(nx, ny, nz, cx, cy, cz)) { push(a, ca); push(c, cc); push(bb, cb); } else { push(a, ca); push(bb, cb); push(c, cc); }
  };
  const up = (nx, ny) => ny > 0, down = (nx, ny) => ny < 0, out = (nx, ny, nz, cx, cy, cz) => nx * cx + nz * cz > 0;
  const tileCol = (j, i) => {
    const p = T[j][i]; const stripe = (i % 2 === 0) ? 1 : 0.9; const rowv = (j % 2 === 0) ? 1 : 0.94;
    const c = glaze.clone().lerp(glazeB, 1 - stripe).multiplyScalar(rowv);
    if (j === 0) c.lerp(GOLD, 0.0);
    return c;
  };
  for (let j = 0; j < J; j++) for (let i = 0; i < N; i++) {
    const i2 = (i + 1) % N;
    const a = T[j][i], bq = T[j][i2], c = T[j + 1][i2], d = T[j + 1][i];
    const ca = tileCol(j, i), cb = tileCol(j, i2), cc = tileCol(j + 1, i2), cd = tileCol(j + 1, i);
    tri(a, bq, c, ca, cb, cc, up); tri(a, c, d, ca, cc, cd, up);
    const A = B[j][i], Bq = B[j][i2], Cc = B[j + 1][i2], D = B[j + 1][i];
    const u = col(PAL.vermilionDeep).multiplyScalar(0.8);
    tri(A, Bq, Cc, u, u, u, down); tri(A, Cc, D, u, u, u, down);
  }
  // fascia at the eave edge
  const fasc = GOLD.clone().multiplyScalar(0.92);
  for (let i = 0; i < N; i++) { const i2 = (i + 1) % N; const a = T[0][i], bq = T[0][i2], c = B[0][i2], d = B[0][i]; tri(a, bq, c, fasc, fasc, fasc, out); tri(a, c, d, fasc, fasc, fasc, out); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  b.add(g, { pos: [x, y, z], bucket: 'main' });
  // gold edge + hip ridges
  for (let i = 0; i < N; i++) { const a = T[0][i], c = T[0][(i + 1) % N]; b.limb([x + a.x, y + a.y + 0.04, z + a.z], [x + c.x, y + c.y + 0.04, z + c.z], 0.1, 0.1, 4, { color: GOLD, bucket: 'gold' }); }
  for (let k = 0; k < 4; k++) {
    const i = k * M;
    for (let j = 0; j < J; j++) { const a = T[j][i], c = T[j + 1][i]; b.limb([x + a.x, y + a.y + 0.08, z + a.z], [x + c.x, y + c.y + 0.08, z + c.z], 0.11, 0.1, 4, { color: GOLD, bucket: 'gold' }); }
  }
  const tips = [];
  for (let k = 0; k < 4; k++) {
    const p = T[0][k * M]; tips.push([x + p.x, y + p.y, z + p.z]);
    if (ornament) {
      const ang = Math.atan2(p.x, p.z);
      curl(b, { pos: [x + p.x * 1.02, y + p.y + 0.34, z + p.z * 1.02], rotY: ang + Math.PI / 2, rotZ: 0, scale: 1.15, color: GOLD, mirror: k % 2 === 0, turns: 1.3 });
      b.sphere(0.13, { pos: [x + p.x, y + p.y + 0.05, z + p.z], color: GOLD, bucket: 'gold' }, 6, 4);
    }
    if (lanterns && deco) deco.hang.push({ x: x + p.x * 0.97, y: y + p.y - 0.45, z: z + p.z * 0.97, s: 0.8 });
  }
  return { tips, deckY: y + rise };
}

// ---------------------------------------------------------------------------------------------
// Stairs (ascending toward -z in local frame, placed in world with axis-aligned orientation)
// ---------------------------------------------------------------------------------------------
export function stairs(b, deco, o) {
  const { x, zBottom, zTop, y0, y1, w, N, wallH = 1.3, balW = 0.95, sink = 3, colors = [STONE, col(PAL.stone).lerp(col(PAL.sand), 0.22)], bal = true, cap = true } = o;
  const run = (zBottom - zTop) / N;
  for (let k = 1; k <= N; k++) {
    const top = y0 + (y1 - y0) * k / N; const zc = zBottom - (k - 0.5) * run; const bot = y0 - sink;
    b.box(w, top - bot, run * 1.0, { pos: [x, (top + bot) / 2, zc], bevel: 0.05, color: colors[k % 2], color2: undefined });
    b.box(w * 0.98, 0.05, 0.1, { pos: [x, top - 0.02, zc + run / 2 - 0.04], bevel: 0, color: GOLD, bucket: 'gold' });
    if (bal) for (const sd of [-1, 1]) {
      const bx = x + sd * (w / 2 + balW / 2);
      b.box(balW, top + wallH - bot, run * 1.0, { pos: [bx, (top + wallH + bot) / 2, zc], bevel: 0.05, color: STONE_S });
      if (cap) b.box(balW + 0.14, 0.1, run * 1.02, { pos: [bx, top + wallH + 0.04, zc], bevel: 0.02, color: GOLD, bucket: 'gold' });
      if (k % 4 === 2) ringStud(b, { pos: [x + sd * (w / 2 - 0.03), top + wallH * 0.5, zc], rotY: -sd * Math.PI / 2, r: 0.2 });
    }
  }
}

// Feathered-serpent head for stair balustrades
export function serpentHead(b, { x, y, z, rotY = 0, flip = 1, s = 1 }) {
  const P = (lx, ly, lz) => { const c = Math.cos(rotY), sn = Math.sin(rotY); return [x + lx * c + lz * sn, y + ly, z - lx * sn + lz * c]; };
  b.box(0.9 * s, 0.8 * s, 1.5 * s, { pos: P(0, 0.4 * s, 0), rotY, color: JADE, bevel: 0.1 });
  b.box(0.8 * s, 0.35 * s, 0.9 * s, { pos: P(0, 0.12 * s, 0.9 * s), rotY, color: JADE_D, bevel: 0.05 });
  b.box(0.95 * s, 0.14 * s, 0.9 * s, { pos: P(0, 0.62 * s, 0.7 * s), rotY, color: GOLD, bucket: 'gold', bevel: 0.03 });
  for (const sd of [-1, 1]) {
    b.cone(0.09 * s, 0.4 * s, 4, { pos: P(sd * 0.28 * s, 0.0, 1.3 * s), rot: [Math.PI, rotY, 0], color: STONE });
    b.sphere(0.14 * s, { pos: P(sd * 0.42 * s, 0.62 * s, 0.28 * s), color: GLOW_WARM, bucket: 'glow' }, 6, 4);
  }
  for (let i = 0; i < 5; i++) { // feather crest
    b.cone(0.1 * s, 1.0 * s - i * 0.08, 4, { pos: P(0, 1.05 * s - i * 0.04, -0.55 * s + i * 0.28 * s), rot: [-0.35, rotY, 0], color: [TURQ, JADE, GOLD, TURQ, JADE][i], bucket: i === 2 ? 'gold' : 'main' });
  }
}

// ---------------------------------------------------------------------------------------------
// Pyramid
// ---------------------------------------------------------------------------------------------
export function pyramid(b, deco) {
  const { x: px, z: pz } = PYR;
  const S = PYR.stairs;
  for (let i = 0; i < PYR.tiers; i++) {
    const H = PYR.halves[i], top = PYR.tierH * (i + 1);
    const tierCol = i % 2 === 0 ? STONE : col(PAL.stone).lerp(col(PAL.sand), 0.16);
    const stone = (cx0, cx1, cz0, cz1) => b.box(cx1 - cx0, top, cz1 - cz0, { pos: [(cx0 + cx1) / 2, top / 2, (cz0 + cz1) / 2], bevel: 0.1, color: STONE_S.clone().lerp(tierCol, 0.4), color2: tierCol, groundDark: i === 0 ? 0.2 : 0.0 });
    // three boxes: left of lane, right of lane, and the lane's rear part (lane itself is the staircase)
    stone(px - H, px - S.hw, pz - H, pz + H);
    stone(px + S.hw, px + H, pz - H, pz + H);
    const zEnd = Math.min(pz + H, S.zTop);
    if (zEnd > pz - H) stone(px - S.hw, px + S.hw, pz - H, zEnd);
    // trims (gold edge, vermilion band with frets) on all four faces of this tier
    const yb = top - 0.62;
    const faces = [
      { nx: 0, nz: 1, len: H, cx: 0, cz: H }, { nx: 0, nz: -1, len: H, cx: 0, cz: -H },
      { nx: 1, nz: 0, len: H, cx: H, cz: 0 }, { nx: -1, nz: 0, len: H, cx: -H, cz: 0 },
    ];
    for (const f of faces) {
      const rotY = Math.atan2(f.nx, f.nz);
      const tx = f.nz !== 0 ? 1 : 0, tz = f.nx !== 0 ? 1 : 0; // tangent axis
      const skipLane = f.nz === 1;
      // gold cap strip along the top edge
      for (const [c0, c1] of (skipLane ? [[-H, -S.hw], [S.hw, H]] : [[-H, H]])) {
        const lenC = c1 - c0, midC = (c0 + c1) / 2;
        b.box(f.nz !== 0 ? lenC : 0.22, 0.14, f.nx !== 0 ? lenC : 0.22, { pos: [px + f.cx + tx * midC + f.nx * 0.01, top - 0.02, pz + f.cz + tz * midC + f.nz * 0.01], bevel: 0.02, color: GOLD, bucket: 'gold' });
      }
      // vermilion band
      const bandLen = 2 * H;
      const segs = skipLane ? [[-H, -S.hw], [S.hw, H]] : [[-H, H]];
      for (const [a0, a1] of segs) {
        const len = a1 - a0, mid = (a0 + a1) / 2;
        b.box(f.nz !== 0 ? len : 0.16, 0.5, f.nx !== 0 ? len : 0.16, { pos: [px + f.cx + tx * mid + f.nx * 0.07, yb, pz + f.cz + tz * mid + f.nz * 0.07], bevel: 0.02, color: VERM_D, color2: VERM });
        // frets along band
        const step = 1.15;
        for (let u = a0 + step / 2; u < a1 - 0.2; u += step) {
          const p = [px + f.cx + tx * u + f.nx * 0.17, yb, pz + f.cz + tz * u + f.nz * 0.17];
          fret(b, { pos: p, rotY, u: 0.085, depth: 0.06, color: GOLD });
        }
        // niches with lantern glow
        const ny = PYR.tierH * i + 0.62;
        if (top - 0.9 > ny + 0.4) {
          for (let u = a0 + 1.6; u < a1 - 1.0; u += 3.2) {
            const p = [px + f.cx + tx * u + f.nx * 0.09, ny + 0.45, pz + f.cz + tz * u + f.nz * 0.09];
            b.box(1.0, 0.95, 0.1, { pos: p, rotY, bevel: 0.03, color: STONE_S });
            const q = [px + f.cx + tx * u + f.nx * 0.16, ny + 0.45, pz + f.cz + tz * u + f.nz * 0.16];
            b.box(0.72, 0.7, 0.06, { pos: q, rotY, bevel: 0.0, color: VERM_D });
            const gp = [px + f.cx + tx * u + f.nx * 0.21, ny + 0.45, pz + f.cz + tz * u + f.nz * 0.21];
            b.cyl(0.24, 0.24, 0.05, 12, { pos: gp, rot: [Math.PI / 2, rotY, 0], color: GLOW_WARM, bucket: 'glow' });
            if (deco) deco.halos.push({ x: gp[0] + f.nx * 0.1, y: gp[1], z: gp[2] + f.nz * 0.1, s: 2.2, a: 0.26 });
          }
        }
      }
    }
    // gold ring studs on terrace edge (reference-style ornament)
    const yS = top - 0.28;
    for (const f of [{ a: [px - H, pz + H + 0.1], c: [px + H, pz + H + 0.1], r: 0 }, { a: [px - H, pz - H - 0.1], c: [px + H, pz - H - 0.1], r: Math.PI }, { a: [px + H + 0.1, pz - H], c: [px + H + 0.1, pz + H], r: Math.PI / 2 }, { a: [px - H - 0.1, pz - H], c: [px - H - 0.1, pz + H], r: -Math.PI / 2 }]) {
      if (i >= 1) {
        if (f.r === 0) { studRow(b, { from: f.a, to: [px - S.hw - 1.4, f.c[1]], y: yS, spacing: 1.15, rotY: f.r, r: 0.14 }); studRow(b, { from: [px + S.hw + 1.4, f.a[1]], to: f.c, y: yS, spacing: 1.15, rotY: f.r, r: 0.14 }); }
        else studRow(b, { from: f.a, to: f.c, y: yS, spacing: 1.15, rotY: f.r, r: 0.14 });
      }
    }
  }
  // stairs
  const top = PYR.top;
  stairs(b, deco, { x: S.x, zBottom: S.zBottom, zTop: S.zTop, y0: 0, y1: top, w: S.hw * 2, N: S.N, wallH: 1.5, balW: 1.05, sink: 0.5 });
  // serpent heads at the base of the stairs
  for (const sd of [-1, 1]) serpentHead(b, { x: S.x + sd * (S.hw + 0.55), y: 0, z: S.zBottom + 1.4, rotY: 0, s: 1.35 });
  // sun medallions flanking stairs on tier 1 face
  for (const sd of [-1, 1]) {
    sunDisc(b, { pos: [S.x + sd * 12, 1.1, S.zBottom + 0.2], rotY: 0, r: 0.9, rays: 12 });
  }
  // lantern posts at top of stairs
  for (const sd of [-1, 1]) lanternPost(b, deco, { x: S.x + sd * (S.hw + 0.55), z: S.zTop + 1.0, y: top, h: 2.0 });
}

// ---------------------------------------------------------------------------------------------
// Pagoda atop the pyramid
// ---------------------------------------------------------------------------------------------
export function pagoda(b, deco) {
  const cx = PYR.x, cz = PYR.z; let Y = PYR.top;
  // platform parapet is built by the level; here: pagoda plinth
  b.box(14.4, 0.45, 14.4, { pos: [cx, Y + 0.22, cz], bevel: 0.08, color: STONE });
  b.box(13.6, 0.2, 13.6, { pos: [cx, Y + 0.55, cz], bevel: 0.05, color: STONE_S });
  studRow(b, { from: [cx - 6.9, cz + 7.25], to: [cx + 6.9, cz + 7.25], y: Y + 0.3, spacing: 1.0, rotY: 0, r: 0.13 });
  Y += 0.65;
  const BH = [5.0, 4.5, 4.0, 3.5, 3.0], HH = [3.7, 3.3, 3.1, 2.9, 2.7], RISE = [1.9, 1.8, 1.7, 1.6, 2.2];
  const tipsAll = [];
  for (let t = 0; t < 5; t++) {
    const bh = BH[t], hh = HH[t], R = bh + 2.8, rise = RISE[t];
    const ft = t < 4 ? BH[t + 1] + 0.6 : 0.4;
    // inner wall core
    const core = bh - 0.6;
    b.box(2 * core, hh, 2 * core, { pos: [cx, Y + hh / 2, cz], bevel: 0.05, color: col(PAL.stone).lerp(col(PAL.cream), 0.4), color2: STONE });
    b.box(2 * bh + 0.5, 0.28, 2 * bh + 0.5, { pos: [cx, Y + 0.14, cz], bevel: 0.05, color: STONE_S });
    // columns
    const colPos = [];
    const n = 3;
    for (let sdx = 0; sdx < 4; sdx++) for (let k = 0; k < n; k++) {
      const u = -bh + (2 * bh) * (k / n); let px, pz;
      if (sdx === 0) { px = u; pz = bh; } else if (sdx === 1) { px = bh; pz = -u; } else if (sdx === 2) { px = -u; pz = -bh; } else { px = -bh; pz = u; }
      colPos.push([px, pz]);
    }
    for (const [px, pz] of colPos) {
      b.cyl(0.2, 0.22, hh - 0.35, 8, { pos: [cx + px, Y + 0.28, cz + pz], base: true, color: VERM, color2: VERM_D });
      b.box(0.62, 0.14, 0.62, { pos: [cx + px, Y + hh - 0.05, cz + pz], bevel: 0.02, color: GOLD, bucket: 'gold' });
      // dougong bracket stack
      b.box(0.9, 0.16, 0.9, { pos: [cx + px, Y + hh + 0.07, cz + pz], bevel: 0.02, color: TURQ });
      b.box(1.35, 0.16, 0.6, { pos: [cx + px, Y + hh + 0.22, cz + pz], bevel: 0.02, color: TURQ_D });
      b.box(0.6, 0.16, 1.35, { pos: [cx + px, Y + hh + 0.22, cz + pz], bevel: 0.02, color: TURQ_D });
    }
    // lintel + frets + windows on each face
    for (let f = 0; f < 4; f++) {
      const rotY = f * Math.PI / 2;
      const nx = Math.sin(rotY), nz = Math.cos(rotY), tx = Math.cos(rotY), tz = -Math.sin(rotY);
      const P = (u, y, d) => [cx + tx * u + nx * d, y, cz + tz * u + nz * d];
      b.box(2 * bh, 0.34, 0.34, { pos: P(0, Y + hh - 0.17, bh), rotY, bevel: 0.03, color: VERM });
      for (let u = -bh + 0.8; u < bh - 0.4; u += 1.1) fret(b, { pos: P(u, Y + hh - 0.17, bh + 0.19), rotY, u: 0.058, depth: 0.04, color: GOLD });
      // windows between columns
      for (let k = 0; k < n; k++) {
        const u = -bh + (2 * bh) * ((k + 0.5) / n);
        const isDoor = (t === 0 && f === 0 && k === 1);
        if (isDoor) {
          b.box(2.0, 2.5, 0.18, { pos: P(u, Y + 1.4, core + 0.05), rotY, bevel: 0.02, color: VERM_D });
          b.box(1.7, 0.5, 0.2, { pos: P(u, Y + 2.7, core + 0.06), rotY, bevel: 0, color: GLOW_SOFT, bucket: 'glow' });
          for (let r = 0; r < 3; r++) for (let q = -1; q <= 1; q += 2) ringStud(b, { pos: P(u + q * 0.45, Y + 0.7 + r * 0.7, core + 0.17), rotY, r: 0.1 });
        } else {
          b.box(1.5, 1.45, 0.1, { pos: P(u, Y + hh * 0.52, core + 0.04), rotY, bevel: 0.02, color: GLOW_SOFT, bucket: 'glow' });
          for (const q of [-0.5, 0, 0.5]) b.box(0.05, 1.5, 0.06, { pos: P(u + q, Y + hh * 0.52, core + 0.1), rotY, bevel: 0, color: GOLD, bucket: 'gold' });
          b.box(1.62, 0.07, 0.07, { pos: P(u, Y + hh * 0.52, core + 0.1), rotY, bevel: 0, color: GOLD, bucket: 'gold' });
          b.box(1.62, 0.07, 0.07, { pos: P(u, Y + hh * 0.52 - 0.4, core + 0.1), rotY, bevel: 0, color: GOLD, bucket: 'gold' });
        }
      }
      // lantern hanging at mid of each face under eave
      deco.hang.push({ x: cx + nx * (bh + 0.7), y: Y + hh - 0.1, z: cz + nz * (bh + 0.7), s: 0.55 });
    }
    // roof
    const roof = hipRoof(b, deco, { x: cx, y: Y + hh + 0.3, z: cz, R, ft, rise, lift: 1.25 + t * 0.03, glaze: t % 2 === 0 ? TURQ : col(PAL.jade).lerp(TURQ, 0.35), glazeB: t % 2 === 0 ? TURQ_D : JADE_D });
    tipsAll.push(...roof.tips);
    const deckY = Y + hh + 0.3 + rise;
    if (t < 4) {
      // deck, gallery railing
      b.box(2 * ft, 0.2, 2 * ft, { pos: [cx, deckY - 0.04, cz], bevel: 0.03, color: STONE });
      const rh = ft - 0.15;
      for (let sdx = 0; sdx < 4; sdx++) {
        const rotY = sdx * Math.PI / 2; const nx = Math.sin(rotY), nz = Math.cos(rotY), tx = Math.cos(rotY), tz = -Math.sin(rotY);
        for (let u = -rh; u <= rh; u += (2 * rh) / 8) b.cyl(0.06, 0.07, 0.7, 5, { pos: [cx + tx * u + nx * rh, deckY + 0.06, cz + tz * u + nz * rh], base: true, color: VERM });
        b.box(2 * rh, 0.08, 0.1, { pos: [cx + nx * rh, deckY + 0.8, cz + nz * rh], rotY, bevel: 0.01, color: GOLD, bucket: 'gold' });
        b.box(2 * rh, 0.06, 0.08, { pos: [cx + nx * rh, deckY + 0.45, cz + nz * rh], rotY, bevel: 0.01, color: VERM_D });
      }
      Y = deckY + 0.06;
    } else {
      // apex + finial mast
      const ay = deckY;
      b.box(0.8, 0.25, 0.8, { pos: [cx, ay + 0.1, cz], bevel: 0.04, color: GOLD, bucket: 'gold' });
      b.cone(0.5, 0.5, 8, { pos: [cx, ay + 0.52, cz], rot: [Math.PI, 0, 0], color: GOLD, bucket: 'gold' });
      b.cyl(0.07, 0.1, 3.0, 6, { pos: [cx, ay + 0.6, cz], base: true, color: GOLD, bucket: 'gold' });
      for (let i = 0; i < 6; i++) b.cyl(0.6 - i * 0.07, 0.6 - i * 0.07, 0.07, 14, { pos: [cx, ay + 0.9 + i * 0.36, cz], color: GOLD, bucket: 'gold' });
      b.sphere(0.34, { pos: [cx, ay + 3.7, cz], color: GOLD, bucket: 'gold' }, 8, 6);
      const rotA = -0.56;
      sunDisc(b, { pos: [cx, ay + 5.4, cz], rotY: rotA, r: 1.7, rays: 16 });
      sunDisc(b, { pos: [cx, ay + 5.4, cz], rotY: rotA + Math.PI / 2, r: 1.7, rays: 16 });
      b.cone(0.18, 0.7, 6, { pos: [cx, ay + 7.5, cz], color: VERM, bucket: 'main' });
      b.sphere(0.16, { pos: [cx, ay + 7.95, cz], color: GLOW_WARM, bucket: 'glow' }, 6, 4);
      deco.halos.push({ x: cx, y: ay + 5.4, z: cz, s: 9, a: 0.55 });
      deco.pagodaTop = ay + 8;
    }
    Y = t < 4 ? Y : Y;
  }
  addBox(cx, cz, BH[0] + 0.35, BH[0] + 0.35);
  deco.pagodaTips = tipsAll;
}

// ---------------------------------------------------------------------------------------------
// Torii gate: vermilion pillars with Mayan glyph bands, Chinese brackets, sun disc on the top beam
// ---------------------------------------------------------------------------------------------
export function torii(b, deco, { x, z, y = 0, rotY = 0, span = 12, height = 10, r = 0.62, flags = true, name }) {
  const ca = Math.cos(rotY), sa = Math.sin(rotY);
  const W = (lx, ly, lz) => [x + lx * ca + lz * sa, y + ly, z - lx * sa + lz * ca];
  const half = span / 2;
  for (const sd of [-1, 1]) {
    const px = sd * half;
    // stepped plinth
    b.box(r * 2 + 1.1, 0.4, r * 2 + 1.1, { pos: W(px, 0, 0), base: true, rotY, color: STONE_S, bevel: 0.06, groundDark: 0.2 });
    b.box(r * 2 + 0.6, 0.35, r * 2 + 0.6, { pos: W(px, 0.4, 0), base: true, rotY, color: STONE, bevel: 0.05 });
    b.cyl(r * 0.96, r * 1.08, height - 0.75, 10, { pos: W(px, 0.75, 0), base: true, rotY, color: VERM_D, color2: VERM });
    // glyph bands (world-space cylinder wrap)
    const wp = W(px, 0, 0);
    glyphBand(b, { x: wp[0], y: y + 1.5, z: wp[2], r: r * 1.06, n: 11 });
    glyphBand(b, { x: wp[0], y: y + 2.35, z: wp[2], r: r * 1.04, n: 11, alt: [TURQ, GOLD, JADE] });
    glyphBand(b, { x: wp[0], y: y + height * 0.72, z: wp[2], r: r * 1.0, n: 11 });
    // gold collar
    b.torus(r * 1.02, 0.06, { pos: W(px, height * 0.55, 0), rot: [Math.PI / 2, 0, 0], color: GOLD, bucket: 'gold' }, 4, 14);
    // capital with brackets (dougong)
    b.box(r * 2.5, 0.18, r * 2.5, { pos: W(px, height - 0.1, 0), rotY, bevel: 0.03, color: GOLD, bucket: 'gold' });
    for (let k = 0; k < 3; k++) {
      b.box(r * 3.4 + k * 0.8, 0.17, r * 1.5, { pos: W(px, height + 0.1 + k * 0.17, 0), rotY, bevel: 0.02, color: k % 2 ? TURQ : TURQ_D });
    }
    addCircle(wp[0], wp[2], r * 1.15);
  }
  // nuki (lower tie beam) with gold end caps
  b.box(span + 1.8, 0.5, 0.52, { pos: W(0, height * 0.8, 0), rotY, bevel: 0.05, color: VERM });
  for (const sd of [-1, 1]) b.box(0.12, 0.62, 0.6, { pos: W(sd * (span / 2 + 0.9), height * 0.8, 0), rotY, bevel: 0.02, color: GOLD, bucket: 'gold' });
  for (let u = -half + 1; u < half; u += 1.7) fret(b, { pos: W(u, height * 0.8, 0.28), rotY, u: 0.075, depth: 0.05 });
  for (let u = -half + 1; u < half; u += 1.7) fret(b, { pos: W(u, height * 0.8, -0.28), rotY: rotY + Math.PI, u: 0.075, depth: 0.05 });
  // top: shimaki (under) + kasagi (curved upper beam made of tilted segments)
  const topY = height + 0.58;
  b.box(span + 2.6, 0.42, 0.9, { pos: W(0, topY, 0), rotY, bevel: 0.05, color: VERM_D });
  const segs = 7; const total = span + 5.6;
  for (let i = 0; i < segs; i++) {
    const u = (i - (segs - 1) / 2) * (total / segs); const t = Math.abs(u) / (total / 2);
    const lift = Math.pow(t, 3) * 1.25; const tilt = Math.pow(t, 2) * 0.55 * Math.sign(u);
    const p = W(u, topY + 0.45 + lift, 0);
    b.box(total / segs * 1.12, 0.42, 1.4 + (1 - t) * 0.15, { pos: p, rot: [0, rotY, tilt], bevel: 0.05, color: INK, color2: col(PAL.ink).lerp(col(PAL.vermilionDeep), 0.4) });
    b.box(total / segs * 1.12, 0.07, 1.5, { pos: W(u, topY + 0.69 + lift, 0), rot: [0, rotY, tilt], bevel: 0.0, color: GOLD, bucket: 'gold' });
  }
  // turquoise end caps
  for (const sd of [-1, 1]) {
    const p = W(sd * total / 2, topY + 0.45 + 1.25, 0);
    b.box(0.2, 0.5, 1.5, { pos: p, rotY, bevel: 0.02, color: TURQ });
    curl(b, { pos: W(sd * (total / 2 + 0.1), topY + 1.9, 0.0), rotY: rotY + (sd > 0 ? 0 : Math.PI), rotZ: 0, scale: 1.3, color: GOLD });
  }
  // sun disc mounted on the top beam, with stone/vermilion mount
  b.box(0.9, 0.9, 0.5, { pos: W(0, topY + 1.2, 0), rotY, bevel: 0.05, color: VERM });
  sunDisc(b, { pos: W(0, topY + 2.9, 0), rotY, r: 1.9, rays: 20 });
  if (deco) deco.halos.push({ x: W(0, 0, 0)[0], y: topY + 2.9 + y, z: W(0, 0, 0)[2], s: 11, a: 0.6 });
  // banners + hanging lanterns
  if (deco) {
    if (flags) for (const sd of [-1, 1]) deco.flags.push({ x: W(sd * (half - 1.3), 0, 0.0)[0], y: y + height * 0.78 - 0.1, z: W(sd * (half - 1.3), 0, 0)[2], rotY, w: 1.5, h: 4.6, c: sd > 0 ? 0 : 1 });
    for (const u of [-half * 0.4, half * 0.4]) { const p = W(u, height * 0.8 - 0.25, 0); deco.hang.push({ x: p[0], y: p[1], z: p[2], s: 1.0 }); }
    for (const sd of [-1, 1]) { const p = W(sd * (half + 1.9), topY + 0.25, 0.0); deco.hang.push({ x: p[0], y: p[1], z: p[2], s: 0.8 }); }
  }
}

// ---------------------------------------------------------------------------------------------
// Pavilion: stone platform, 8 vermilion columns, turquoise hip roof, gold sun finial
// ---------------------------------------------------------------------------------------------
export function pavilion(b, deco, { x, z, size = 5.0 }) {
  const h1 = size + 0.6, h2 = size;
  b.box(2 * h1, 0.4, 2 * h1, { pos: [x, 0.2, z], bevel: 0.06, color: STONE_S, groundDark: 0.15 });
  b.box(2 * h2, 0.4, 2 * h2, { pos: [x, 0.6, z], bevel: 0.06, color: STONE });
  studRow(b, { from: [x - h1, z + h1 + 0.04], to: [x + h1, z + h1 + 0.04], y: 0.22, spacing: 1.0, rotY: 0, r: 0.12 });
  for (let k = 0; k < 4; k++) { // stairs on four sides
    const rotY = k * Math.PI / 2; const nx = Math.sin(rotY), nz = Math.cos(rotY), tx = Math.cos(rotY), tz = -Math.sin(rotY);
    b.box(3.2, 0.2, 0.7, { pos: [x + nx * (h1 + 0.35), 0.1, z + nz * (h1 + 0.35)], rotY, bevel: 0.03, color: STONE });
  }
  const colR = size - 1.0;
  const pts = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  for (const [a, c] of pts) {
    const px = x + a * colR, pz = z + c * colR;
    b.cyl(0.24, 0.27, 3.5, 8, { pos: [px, 0.8, pz], base: true, color: VERM, color2: VERM_D });
    b.box(0.7, 0.14, 0.7, { pos: [px, 0.82, pz], bevel: 0.02, color: GOLD, bucket: 'gold' });
    b.box(0.75, 0.2, 0.75, { pos: [px, 4.25, pz], bevel: 0.02, color: GOLD, bucket: 'gold' });
    b.box(1.5, 0.16, 0.6, { pos: [px, 4.43, pz], bevel: 0.02, color: TURQ_D });
    b.box(0.6, 0.16, 1.5, { pos: [px, 4.43, pz], bevel: 0.02, color: TURQ });
    addCircle(px, pz, 0.42);
  }
  // beams
  for (let k = 0; k < 4; k++) {
    const rotY = k * Math.PI / 2; const nx = Math.sin(rotY), nz = Math.cos(rotY);
    b.box(2 * colR + 0.6, 0.4, 0.4, { pos: [x + nx * colR, 4.2, z + nz * colR], rotY, bevel: 0.03, color: VERM });
    for (let u = -colR + 0.9; u < colR - 0.4; u += 1.3) fret(b, { pos: [x + nx * colR + Math.cos(rotY) * u, 4.2, z + nz * colR - Math.sin(rotY) * u + 0.0 + nz * 0.22], rotY, u: 0.07, depth: 0.04 });
  }
  const roof = hipRoof(b, deco, { x, y: 4.65, z, R: size + 2.2, ft: 0.45, rise: 2.6, lift: 1.1, glaze: TURQ, glazeB: TURQ_D });
  const top = 4.65 + 2.6;
  b.sphere(0.3, { pos: [x, top + 0.2, z], color: GOLD, bucket: 'gold' }, 8, 6);
  sunDisc(b, { pos: [x, top + 1.7, z], rotY: 0.6, r: 0.95, rays: 12 });
  sunDisc(b, { pos: [x, top + 1.7, z], rotY: 0.6 + Math.PI / 2, r: 0.95, rays: 12 });
  // central stele pedestal with a lantern
  b.cyl(0.55, 0.7, 0.5, 8, { pos: [x, 0.8, z], base: true, color: STONE_S });
  lanternHead(b, deco, { pos: [x, 2.0, z], r: 0.5, rotY: 0 });
  b.cyl(0.12, 0.2, 0.9, 6, { pos: [x, 1.3, z], base: true, color: STONE });
  // walkable platform
  raised.push((px, pz) => { const dx = Math.abs(px - x), dz = Math.abs(pz - z); if (dx < h2 && dz < h2) return 0.8; if (dx < h1 && dz < h1) return 0.4; return 0; });
  deco.chimeSpots.push([x, 4.0, z]);
}

// ---------------------------------------------------------------------------------------------
// Walls with friezes
// ---------------------------------------------------------------------------------------------
export function wall(b, deco, { x0, z0, x1, z1, y = 0, h = 1.1, t = 0.7, frieze = true, collide = true, cap = true, color = STONE }) {
  const L2 = Math.hypot(x1 - x0, z1 - z0); const ang = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2; // local x along wall
  const rotY = -Math.atan2(z1 - z0, x1 - x0);
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  b.box(L2, h, t, { pos: [mx, y + h / 2, mz], rotY, bevel: 0.05, color: STONE_S, color2: color, groundDark: 0.2 });
  if (cap) b.box(L2 + 0.04, 0.12, t + 0.2, { pos: [mx, y + h + 0.03, mz], rotY, bevel: 0.02, color: GOLD, bucket: 'gold' });
  if (frieze) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const n = Math.floor(L2 / 1.7);
    for (let i = 0; i < n; i++) {
      const u = -L2 / 2 + (i + 0.5) * (L2 / n);
      for (const sd of [-1, 1]) {
        const p = [mx + u * c + sd * (t / 2 + 0.02) * s, y + h * 0.5, mz - u * s + sd * (t / 2 + 0.02) * c];
        const ry = rotY + (sd > 0 ? 0 : Math.PI);
        if (i % 2 === 0) fret(b, { pos: p, rotY: ry, u: 0.085, depth: 0.05 });
        else curl(b, { pos: p, rotY: ry + 0, scale: 0.55, mirror: (i % 4 === 1), turns: 1.1 });
      }
    }
  }
  if (collide) addBox(mx, mz, L2 / 2, t / 2 + 0.05, rotY);
}

export function planter(b, deco, { x, z, r = 1.7 }) {
  b.cyl(r, r + 0.18, 0.6, 12, { pos: [x, 0, z], base: true, color: STONE, color2: STONE_S });
  b.torus(r + 0.02, 0.06, { pos: [x, 0.58, z], rot: [Math.PI / 2, 0, 0], color: GOLD, bucket: 'gold' }, 4, 16);
  b.cyl(r - 0.12, r - 0.12, 0.06, 12, { pos: [x, 0.56, z], color: col(0x6b8f50) });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ringStud(b, { pos: [x + Math.cos(a) * (r + 0.1), 0.3, z + Math.sin(a) * (r + 0.1)], rotY: Math.atan2(Math.cos(a), Math.sin(a)), r: 0.14 }); }
  addCircle(x, z, r + 0.15);
}

// raised rim around a water pool: rect or circle
export function poolRim(b, deco, { x, z, hx, hz, w = 0.9, h = 0.65 }) {
  for (const sd of [-1, 1]) {
    b.box(2 * hx + 2 * w, h, w, { pos: [x, h / 2, z + sd * (hz + w / 2)], bevel: 0.05, color: STONE, groundDark: 0.1 });
    b.box(2 * hx + 2 * w + 0.1, 0.12, w + 0.2, { pos: [x, h + 0.03, z + sd * (hz + w / 2)], bevel: 0.02, color: GOLD, bucket: 'gold' });
    b.box(w, h, 2 * hz, { pos: [x + sd * (hx + w / 2), h / 2, z], bevel: 0.05, color: STONE });
    b.box(w + 0.2, 0.12, 2 * hz + 0.1, { pos: [x + sd * (hx + w / 2), h + 0.03, z], bevel: 0.02, color: GOLD, bucket: 'gold' });
  }
  studRow(b, { from: [x - hx, z + hz + w + 0.02], to: [x + hx, z + hz + w + 0.02], y: h * 0.45, spacing: 1.0, rotY: 0, r: 0.14 });
  addHoleRect(x, z, hx + w + 0.15, hz + w + 0.15);
}

export function pondRim(b, deco, { x, z, r, h = 0.6 }) {
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; const px = x + Math.cos(a) * (r + 0.4), pz = z + Math.sin(a) * (r + 0.4);
    const rot = -a + Math.PI / 2;
    const len = 2 * Math.PI * (r + 0.4) / n + 0.08;
    b.box(len, h + (i % 2) * 0.12, 0.85, { pos: [px, (h + (i % 2) * 0.12) / 2, pz], rotY: rot, bevel: 0.06, color: i % 2 ? STONE : STONE_S, groundDark: 0.12 });
    if (i % 2 === 0) b.box(len * 2, 0.1, 0.95, { pos: [x + Math.cos(a + Math.PI / n) * (r + 0.4), h + 0.17, z + Math.sin(a + Math.PI / n) * (r + 0.4)], rotY: -(a + Math.PI / n) + Math.PI / 2, bevel: 0.02, color: GOLD, bucket: 'gold' });
  }
  addHoleCircle(x, z, r + 0.85);
}

// raised plateau edge parapet (decorative; edge is already non-walkable)
export function parapetSeg(b, deco, x0, z0, x1, z1) {
  wall(b, deco, { x0, z0, x1, z1, h: 0.95, t: 0.65, frieze: true, collide: false });
}
