import * as THREE from 'three';
import { WORLD, PAL } from './config.js';
import { U } from './shared.js';
import { terrainY, plateauDist, ROUTE, L, PLAZA, PYR } from './world.js';
import { clamp, lerp, rng, fbm, vnoise, smoothstep, col } from './util.js';

const G = WORLD.groundTex;

const hex = (h, a = 1) => { const c = new THREE.Color(h).convertLinearToSRGB ? null : null; const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255; return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`; };

// ---------------------------------------------------------------------------------------------
// Ground texture painted in world units
// ---------------------------------------------------------------------------------------------
function paintGround(size) {
  const W = size, H = Math.round(size * (G.z1 - G.z0) / (G.x1 - G.x0));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const s = W / (G.x1 - G.x0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(s, 0, 0, s, -G.x0 * s, -G.z0 * s);
  const R = rng(77);
  const P = WORLD.plateau;

  // plateau base: warm sand with soft blotches
  rr(ctx, P.x0, P.z0, P.x1 - P.x0, P.z1 - P.z0, P.r); ctx.fillStyle = hex(PAL.sand); ctx.fill();
  ctx.save(); rr(ctx, P.x0, P.z0, P.x1 - P.x0, P.z1 - P.z0, P.r); ctx.clip();
  for (let i = 0; i < 700; i++) {
    const x = R.range(P.x0, P.x1), z = R.range(P.z0, P.z1), r = R.range(2, 9);
    const g = ctx.createRadialGradient(x, z, 0, x, z, r);
    const c = R() < 0.5 ? [233, 190, 134] : [246, 214, 160];
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.55)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, z - r, r * 2, r * 2);
  }
  // sand ripples
  ctx.lineWidth = 0.05;
  for (let i = 0; i < 900; i++) {
    const x = R.range(P.x0, P.x1), z = R.range(P.z0, P.z1), len = R.range(2, 7);
    ctx.strokeStyle = R() < 0.5 ? 'rgba(200,150,100,.28)' : 'rgba(255,236,196,.35)';
    ctx.beginPath(); ctx.moveTo(x, z);
    ctx.quadraticCurveTo(x + len * 0.5, z + R.range(-0.6, 0.6), x + len, z + R.range(-0.5, 0.5)); ctx.stroke();
  }

  // grass meadows along the route (soft jade blobs)
  const meadow = (x, z, r, a = 0.9) => {
    const g = ctx.createRadialGradient(x, z, r * 0.2, x, z, r);
    g.addColorStop(0, `rgba(118,170,98,${a})`); g.addColorStop(0.6, `rgba(138,184,100,${a * 0.7})`); g.addColorStop(1, 'rgba(150,190,100,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, z - r, r * 2, r * 2);
  };
  for (let i = 0; i < ROUTE.length; i += 2) {
    const p = ROUTE[i];
    for (const side of [-1, 1]) meadow(p[0] + side * R.range(6.5, 10), p[1] + R.range(-3, 3), R.range(5, 9), 0.85);
  }
  for (const [x, z, r] of [[-63, 30, 17], [63, -14, 15], [-30, 38, 12], [40, 21, 12], [0, -96, 16], [-40, -90, 14], [40, -90, 14], [-70, -50, 14], [70, -50, 14], [-72, 50, 14], [74, 40, 14], [0, 100 - 20, 9], [-14, 70, 9], [14, 70, 9]]) meadow(x, z, r, 0.92);
  for (let i = 0; i < 40; i++) meadow(R.range(P.x0 + 6, P.x1 - 6), R.range(P.z0 + 6, P.z1 - 6), R.range(5, 10), 0.5);
  // grass flecks
  for (let i = 0; i < 9000; i++) {
    const x = R.range(P.x0, P.x1), z = R.range(P.z0, P.z1);
    ctx.fillStyle = R() < 0.5 ? 'rgba(70,130,80,.12)' : 'rgba(180,215,120,.14)';
    ctx.fillRect(x, z, 0.12, 0.3);
  }
  ctx.restore();

  // ---- stone surfaces
  const stone = '#efe2cb', stoneEdge = '#b98a3c', seam = 'rgba(112,92,96,.35)';

  // plaza base
  const pz = PLAZA;
  roundRectFill(ctx, pz.x0 - 1.1, pz.z0 - 1.1, pz.x1 - pz.x0 + 2.2, pz.z1 - pz.z0 + 2.2, 1.4, stoneEdge);
  roundRectFill(ctx, pz.x0 - 0.7, pz.z0 - 0.7, pz.x1 - pz.x0 + 1.4, pz.z1 - pz.z0 + 1.4, 1.0, '#d8c3a0');
  roundRectFill(ctx, pz.x0, pz.z0, pz.x1 - pz.x0, pz.z1 - pz.z0, 0.6, stone);
  tileGrid(ctx, pz.x0, pz.z0, pz.x1, pz.z1, 2.2, seam);

  // main route ribbon
  const strokeRoute = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ROUTE.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); };
  strokeRoute(7.9, hex(PAL.goldDeep)); strokeRoute(7.4, hex(PAL.gold)); strokeRoute(6.9, '#d9c4a2'); strokeRoute(6.5, '#f3e8d2');
  // flagstone rows
  ctx.lineCap = 'butt';
  for (let i = 1; i < ROUTE.length - 1; i += 1) {
    const a = ROUTE[i - 1], b = ROUTE[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l; const p = ROUTE[i];
    if (i % 2) continue;
    ctx.strokeStyle = seam; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(p[0] + nx * 3.1, p[1] + nz * 3.1); ctx.lineTo(p[0] - nx * 3.1, p[1] - nz * 3.1); ctx.stroke();
    // staggered middle seam
    const off = (i % 4 === 0) ? 0.9 : -0.9;
    ctx.beginPath(); ctx.moveTo(p[0] + nx * off, p[1] + nz * off); ctx.lineTo(p[0] + nx * off + dx / l * 1.1, p[1] + nz * off + dz / l * 1.1); ctx.stroke();
  }
  // gold sun-ring studs along both edges (echoes the ornate trim in the reference)
  const ringStud = (x, z, r) => {
    ctx.strokeStyle = hex(PAL.goldDeep); ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(x, z, r, 0, 6.283); ctx.stroke();
    ctx.fillStyle = hex(PAL.gold); ctx.beginPath(); ctx.arc(x, z, r * 0.55, 0, 6.283); ctx.fill();
  };
  for (let i = 2; i < ROUTE.length - 2; i += 2) {
    const a = ROUTE[i - 1], b = ROUTE[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l; const p = ROUTE[i];
    for (const sd of [-1, 1]) ringStud(p[0] + nx * 3.15 * sd, p[1] + nz * 3.15 * sd, 0.25);
  }

  // plaza ring trim studs
  for (let t = pz.x0; t <= pz.x1; t += 1.2) { ringStud(t, pz.z0 + 0.35, 0.22); ringStud(t, pz.z1 - 0.35, 0.22); }
  for (let t = pz.z0; t <= pz.z1; t += 1.2) { ringStud(pz.x0 + 0.35, t, 0.22); ringStud(pz.x1 - 0.35, t, 0.22); }

  // sun mosaic centered on the pool
  sunMosaic(ctx, L.pool.x, L.pool.z + 0.0, 27, 1);
  // fret band inside plaza border
  fretBand(ctx, pz.x0 + 1.0, pz.z0 + 1.0, pz.x1 - 1.0, pz.z1 - 1.0, 0.9);

  // apron around pool (stone ring) so water reads as a raised basin
  roundRectFill(ctx, L.pool.x - L.pool.hx - 1.6, L.pool.z - L.pool.hz - 1.6, (L.pool.hx + 1.6) * 2, (L.pool.hz + 1.6) * 2, 0.8, '#fbf2de');

  // gates: sun medallions
  sunMosaic(ctx, L.gate1.x, L.gate1.z - 1, 6.5, 0.9);
  sunMosaic(ctx, L.gate2.x, L.gate2.z, 6.0, 0.9);
  sunMosaic(ctx, 0, L.arrival.zTop - 1.5, 5.5, 0.9);

  // pond aprons
  for (const p of [L.pondW, L.pondE]) {
    disc(ctx, p.x, p.z, p.r + 2.8, hex(PAL.goldDeep)); disc(ctx, p.x, p.z, p.r + 2.5, '#d9c4a2'); disc(ctx, p.x, p.z, p.r + 2.1, '#f3e8d2');
    for (let a = 0; a < 6.283; a += 0.22) ringStud(p.x + Math.cos(a) * (p.r + 2.3), p.z + Math.sin(a) * (p.r + 2.3), 0.2);
  }
  // pavilion floors
  for (const pv of [L.pavA, L.pavB]) {
    roundRectFill(ctx, pv.x - 8, pv.z - 8, 16, 16, 0.6, hex(PAL.goldDeep));
    roundRectFill(ctx, pv.x - 7.7, pv.z - 7.7, 15.4, 15.4, 0.5, '#efe2cb');
    tileGrid(ctx, pv.x - 7.7, pv.z - 7.7, pv.x + 7.7, pv.z + 7.7, 1.8, seam);
    sunMosaic(ctx, pv.x, pv.z, 5.5, 0.8);
  }
  // pyramid forecourt + rear terrace
  sunMosaic(ctx, 0, PYR.z + PYR.halves[0] + 0.0, 0.01, 0);
  // plateau edge band (stone walkway under the parapet)
  ctx.strokeStyle = '#d9c4a2'; ctx.lineWidth = 2.0; rr(ctx, P.x0 + 1.4, P.z0 + 1.4, P.x1 - P.x0 - 2.8, P.z1 - P.z0 - 2.8, P.r - 1.4); ctx.stroke();
  ctx.strokeStyle = hex(PAL.gold); ctx.lineWidth = 0.14; rr(ctx, P.x0 + 2.35, P.z0 + 2.35, P.x1 - P.x0 - 4.7, P.z1 - P.z0 - 4.7, P.r - 2.3); ctx.stroke();

  // rear garden sun mosaic + side courts
  sunMosaic(ctx, 0, -100, 6, 0.9);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function roundRectFill(ctx, x, y, w, h, r, c) { rr(ctx, x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); }
function disc(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
function tileGrid(ctx, x0, z0, x1, z1, step, c) {
  ctx.strokeStyle = c; ctx.lineWidth = 0.06; ctx.beginPath();
  for (let x = x0; x <= x1; x += step) { ctx.moveTo(x, z0); ctx.lineTo(x, z1); }
  for (let z = z0; z <= z1; z += step) { ctx.moveTo(x0, z); ctx.lineTo(x1, z); }
  ctx.stroke();
}
function sunMosaic(ctx, cx, cz, R, a) {
  if (R < 0.1) return;
  ctx.save(); ctx.translate(cx, cz);
  disc(ctx, 0, 0, R, hex(PAL.goldDeep)); disc(ctx, 0, 0, R * 0.985, '#f6ead2');
  // rays
  const n = 16; const r0 = R * 0.52, r1 = R * 0.93;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283; const w = 6.283 / n * 0.42;
    const long = i % 2 === 0;
    ctx.fillStyle = long ? hex(PAL.vermilion) : hex(PAL.turquoise);
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang - w) * r0, Math.sin(ang - w) * r0);
    ctx.lineTo(Math.cos(ang) * (long ? r1 : r1 * 0.82), Math.sin(ang) * (long ? r1 : r1 * 0.82));
    ctx.lineTo(Math.cos(ang + w) * r0, Math.sin(ang + w) * r0);
    ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < n; i++) { // gold ray cores
    const ang = ((i + 0.5) / n) * 6.283; const w = 6.283 / n * 0.18;
    ctx.fillStyle = hex(PAL.gold);
    ctx.beginPath(); ctx.moveTo(Math.cos(ang - w) * r0, Math.sin(ang - w) * r0);
    ctx.lineTo(Math.cos(ang) * r1 * 0.7, Math.sin(ang) * r1 * 0.7); ctx.lineTo(Math.cos(ang + w) * r0, Math.sin(ang + w) * r0); ctx.closePath(); ctx.fill();
  }
  disc(ctx, 0, 0, R * 0.5, hex(PAL.gold)); disc(ctx, 0, 0, R * 0.44, hex(PAL.goldPale)); disc(ctx, 0, 0, R * 0.3, hex(PAL.gold));
  ctx.strokeStyle = hex(PAL.vermilion); ctx.lineWidth = R * 0.035; ctx.beginPath(); ctx.arc(0, 0, R * 0.38, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = hex(PAL.turquoiseDeep); ctx.lineWidth = R * 0.03; ctx.beginPath(); ctx.arc(0, 0, R * 0.98 - R * 0.05, 0, 6.283); ctx.stroke();
  ctx.restore();
}
function fretBand(ctx, x0, z0, x1, z1, u) {
  // Mayan step-fret (greca) running around a rectangle
  ctx.strokeStyle = hex(PAL.turquoiseDeep); ctx.lineWidth = 0.13; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  const run = (ax, az, bx, bz) => {
    const L2 = Math.hypot(bx - ax, bz - az); const dx = (bx - ax) / L2, dz = (bz - az) / L2; const nx = -dz, nz = dx;
    ctx.beginPath(); ctx.moveTo(ax, az);
    for (let t = 0; t < L2 - u * 3; t += u * 3) {
      const p = (k, h) => [ax + dx * (t + k * u) + nx * h * u, az + dz * (t + k * u) + nz * h * u];
      let q;
      q = p(0, 0); ctx.lineTo(q[0], q[1]); q = p(0, 1); ctx.lineTo(q[0], q[1]); q = p(2, 1); ctx.lineTo(q[0], q[1]); q = p(2, 0.4); ctx.lineTo(q[0], q[1]);
      q = p(1, 0.4); ctx.lineTo(q[0], q[1]); q = p(1, 0.7); ctx.lineTo(q[0], q[1]); q = p(3, 0.7); ctx.lineTo(q[0], q[1]); q = p(3, 0); ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
  };
  run(x0, z0, x1, z0); run(x0, z1 - u, x1, z1 - u);
  run(x0, z0, x0, z1); run(x1 - u, z0, x1 - u, z1);
}

// ---------------------------------------------------------------------------------------------
// Terrain mesh
// ---------------------------------------------------------------------------------------------
export function buildTerrain(q) {
  const SIZE = 920, seg = q.terrainSeg;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const n = pos.count;
  const colors = new Float32Array(n * 3);
  const sand = col(PAL.sand), sandDeep = col(0xdcae7c), ochre = col(0xd1935a), red = col(0xb8704e), cream = col(0xf6dcae);
  const tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainY(x, z); pos.setY(i, y);
    const d = plateauDist(x, z);
    if (d <= 0.2) { tmp.setRGB(1, 1, 1); }
    else if (d < 14 && y > -13) {
      // cliff strata
      const band = Math.sin(y * 1.9 + fbm(x * 0.2, z * 0.2, 2) * 3.0) * 0.5 + 0.5;
      tmp.copy(ochre).lerp(sandDeep, band * 0.8).lerp(red, smoothstep(0.65, 1, fbm(x * 0.11, z * 0.11, 2)) * 0.5);
      tmp.lerp(sand, smoothstep(8, 14, d)); // fade into dunes
    } else {
      const n1 = fbm(x * 0.02, z * 0.02, 3);
      tmp.copy(sand).multiplyScalar(1.12).lerp(sandDeep, n1 * 0.55).lerp(cream, smoothstep(0.55, 0.75, fbm(x * 0.05 + 9, z * 0.05, 2)) * 0.5);
    }
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const tex = paintGround(q.groundTex);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGround = { value: tex };
    sh.uniforms.uGMin = { value: new THREE.Vector2(G.x0, G.z0) };
    sh.uniforms.uGSize = { value: new THREE.Vector2(G.x1 - G.x0, G.z1 - G.z0) };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGround; uniform vec2 uGMin; uniform vec2 uGSize;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 gUv = (vFogWorld.xz - uGMin) / uGSize;
          float inside = step(0.0, gUv.x) * step(gUv.x, 1.0) * step(0.0, gUv.y) * step(gUv.y, 1.0);
          vec3 gt = texture2D(uGround, gUv).rgb;
          diffuseColor.rgb *= mix(vec3(1.0), gt, inside);
        }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.castShadow = true; mesh.frustumCulled = false;
  mesh.position.y = 0;
  return { mesh, tex };
}
