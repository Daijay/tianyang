import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const dampAngle = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));

export function rng(seed = 1) {
  let s = seed >>> 0;
  const f = () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (a, b) => a + (b - a) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
  return f;
}

// 2D value noise + fbm (deterministic, no deps)
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }

const _c = new THREE.Color();
export const col = (hex, mul = 1) => { _c.set(hex); return new THREE.Color(_c.r * mul, _c.g * mul, _c.b * mul); };
export const mixCol = (a, b, t) => new THREE.Color().copy(col(a)).lerp(col(b), t);

// ---------------------------------------------------------------------------------------------
// Builder: collects primitives into merged, vertex-colored geometries bucketed by material + chunk.
// ---------------------------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

const baseCache = new Map();
function cached(key, fn) { let g = baseCache.get(key); if (!g) { g = fn(); g.deleteAttribute('uv'); baseCache.set(key, g); } return g; }

export class Builder {
  constructor(chunk = 40) { this.chunk = chunk; this.buckets = new Map(); this.count = 0; }

  /** geo: BufferGeometry (any). opts: color (hex/Color), color2 (top color for gradient), bucket, pos, rot[x,y,z], rotY, scale, matrix, flat */
  add(geo, o = {}) {
    const bucket = o.bucket || 'main';
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (o.matrix) _m.copy(o.matrix);
    else {
      const r = o.rot || [0, o.rotY || 0, 0];
      _e.set(r[0], r[1], r[2], 'YXZ'); _q.setFromEuler(_e);
      const sc = o.scale; if (sc == null) _s.set(1, 1, 1); else if (typeof sc === 'number') _s.set(sc, sc, sc); else _s.set(sc[0], sc[1], sc[2]);
      const p = o.pos || [0, 0, 0]; _p.set(p[0], p[1], p[2]);
      _m.compose(_p, _q, _s);
    }
    g.applyMatrix4(_m);
    g.computeVertexNormals();
    if (o.smooth) { /* keep (non-indexed normals are flat); smoothness not supported here */ }
    // vertex colors
    g.computeBoundingBox();
    const bb = g.boundingBox; const pos = g.attributes.position; const n = pos.count;
    const c1 = o.color instanceof THREE.Color ? o.color : col(o.color ?? 0xffffff);
    const c2 = o.color2 != null ? (o.color2 instanceof THREE.Color ? o.color2 : col(o.color2)) : null;
    const hasColor = !!g.attributes.color;
    const colors = hasColor ? null : new Float32Array(n * 3);
    const h = Math.max(1e-4, bb.max.y - bb.min.y);
    const gd = o.groundDark ?? 0; // darken near y=0 for grounding
    for (let i = 0; !hasColor && i < n; i++) {
      let r = c1.r, gg = c1.g, b = c1.b;
      if (c2) { const t = (pos.getY(i) - bb.min.y) / h; r = lerp(c1.r, c2.r, t); gg = lerp(c1.g, c2.g, t); b = lerp(c1.b, c2.b, t); }
      if (gd) { const f = 1 - gd * (1 - smoothstep(0, 1.1, pos.getY(i))); r *= f; gg *= f; b *= f; }
      if (o.jitter) { const j = 1 + (hash2(Math.floor(pos.getX(i) * 7), Math.floor(pos.getZ(i) * 7) + Math.floor(pos.getY(i) * 7) * 31) - 0.5) * o.jitter; r *= j; gg *= j; b *= j; }
      colors[i * 3] = r; colors[i * 3 + 1] = gg; colors[i * 3 + 2] = b;
    }
    if (!hasColor) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const cx = Math.floor(((bb.min.x + bb.max.x) / 2) / this.chunk), cz = Math.floor(((bb.min.z + bb.max.z) / 2) / this.chunk);
    const key = bucket + '|' + cx + '|' + cz;
    let list = this.buckets.get(key); if (!list) { list = []; this.buckets.set(key, list); }
    list.push(g); this.count++;
    return this;
  }

  box(w, h, d, o = {}) {
    const r = o.bevel ?? Math.min(0.07, Math.min(w, h, d) * 0.3);
    const key = `b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${r.toFixed(3)}`;
    const g = cached(key, () => (r > 0.001 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d)));
    // box centered at pos, 'base' option sits it on y
    if (o.base && o.pos) o = { ...o, pos: [o.pos[0], o.pos[1] + h / 2, o.pos[2]] };
    return this.add(g, o);
  }
  cyl(rt, rb, h, seg, o = {}) {
    const g = cached(`c${rt.toFixed(3)},${rb.toFixed(3)},${h.toFixed(3)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1));
    if (o.base && o.pos) o = { ...o, pos: [o.pos[0], o.pos[1] + h / 2, o.pos[2]] };
    return this.add(g, o);
  }
  sphere(r, o = {}, w = 7, h = 5) { return this.add(cached(`s${r.toFixed(3)},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)), o); }
  ico(r, o = {}, detail = 0) { return this.add(cached(`i${r.toFixed(3)},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), o); }
  torus(r, t, o = {}, rs = 6, ts = 14) { return this.add(cached(`t${r.toFixed(3)},${t.toFixed(3)},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts)), o); }
  cone(r, h, seg, o = {}) { return this.add(cached(`n${r.toFixed(3)},${h.toFixed(3)},${seg}`, () => new THREE.ConeGeometry(r, h, seg, 1)), o); }

  /** Tapered limb between two points */
  limb(a, b, r0, r1, seg, o = {}) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const g = cached(`l${r0.toFixed(3)},${r1.toFixed(3)},${len.toFixed(3)},${seg}`, () => new THREE.CylinderGeometry(r1, r0, len, seg, 1));
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return this.add(g, { ...o, matrix: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)) });
  }

  /** Build merged meshes. mats: {main, gold, glow}. returns THREE.Group */
  toGroup(mats, { cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.buckets) {
      const bucket = key.split('|')[0];
      const geo = mergeGeometries(list, false);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[bucket] || mats.main);
      mesh.castShadow = cast && bucket !== 'glow';
      mesh.receiveShadow = receive && bucket !== 'glow';
      mesh.matrixAutoUpdate = false;
      mesh.userData.bucket = bucket;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.buckets.clear();
    return group;
  }
}

export function bevelBoxGeo(w, h, d, r = 0.06) {
  const g = new RoundedBoxGeometry(w, h, d, 1, r); return g;
}

/** points along a polyline at even spacing -> [{x,z,dx,dz,t}] */
export function samplePolyline(pts, spacing) {
  const out = []; let carry = 0, tot = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-6) continue;
    const dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    let d = carry;
    while (d <= L) { out.push({ x: x0 + dx * d, z: z0 + dz * d, dx, dz, t: tot + d }); d += spacing; }
    carry = d - L; tot += L;
  }
  return out;
}

export function catmull(points, perSeg = 12) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function isTouchDevice() {
  return (typeof window !== 'undefined') && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
}
