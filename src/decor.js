import * as THREE from 'three';
import { PAL } from './config.js';
import { U } from './shared.js';
import { col, rng, lerp } from './util.js';
import { C, hangingLanternGeometry } from './motifs.js';
import { addCircle, isFree, terrainY } from './world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function newDeco() {
  return { halos: [], hang: [], flags: [], canopy: [], bush: [], grass: [], carpets: [], chimeSpots: [], lanternPts: [], circles: [], waters: [], koi: [], pagodaTop: 40 };
}

// ---------------------------------------------------------------------------------------------
// Cherry tree: curved trunk (static, merged by Builder) + blossom blobs (instanced, wind swayed)
// ---------------------------------------------------------------------------------------------
export function cherryTree(b, deco, { x, z, s = 1, lean = [0, 0], seed = 1, y = 0, collide = true }) {
  const R = rng(seed * 7919 + 13);
  const bark = col(0x5a3345), barkL = col(0x7a4a55);
  const H = (5.2 + R() * 1.6) * s;
  const lx = lean[0] * s, lz = lean[1] * s;
  // trunk: 4 segments curving toward lean
  let p = [x, y, z]; let r0 = 0.42 * s;
  const trunk = [p];
  for (let i = 1; i <= 4; i++) { const t = i / 4; p = [x + lx * t * t * 1.0 + Math.sin(t * 3 + seed) * 0.25 * s, y + H * 0.72 * t, z + lz * t * t + Math.cos(t * 2.6 + seed) * 0.25 * s]; trunk.push(p); }
  for (let i = 0; i < 4; i++) b.limb(trunk[i], trunk[i + 1], r0 * (1 - i * 0.18), r0 * (1 - (i + 1) * 0.18), 6, { color: bark, color2: barkL, groundDark: i === 0 ? 0.25 : 0 });
  // roots flare
  b.cone(r0 * 1.7, 0.7 * s, 6, { pos: [x, y + 0.3 * s, z], color: bark });
  const top = trunk[4];
  const nb = 3 + Math.floor(R() * 2);
  const pal = [col(0xffc4d6), col(0xffdbe6), col(0xffb3c8)];
  const base = R() < 0.18 ? col(PAL.blossomLight) : pal[Math.floor(R() * 2)];
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + R() * 1.2; const len = (2.2 + R() * 1.8) * s; const up = (0.6 + R() * 1.4) * s;
    const from = trunk[2 + (i % 2)];
    const to = [from[0] + Math.cos(a) * len + lx * 0.3, from[1] + up, from[2] + Math.sin(a) * len + lz * 0.3];
    b.limb(from, to, r0 * 0.38, r0 * 0.16, 5, { color: bark });
    // blobs at branch tip
    const nbl = 3 + Math.floor(R() * 2);
    for (let k = 0; k < nbl; k++) {
      const rad = (0.95 + R() * 0.8) * s;
      deco.canopy.push({ x: to[0] + (R() - 0.5) * 1.6 * s, y: to[1] + (R() - 0.3) * 1.0 * s + 0.6 * s, z: to[2] + (R() - 0.5) * 1.6 * s, sx: rad * 1.25, sy: rad * 0.82, sz: rad * 1.25, c: base.clone().lerp(col(PAL.blossomDeep), R() * 0.12) });
    }
  }
  // crown blobs
  for (let k = 0; k < 4; k++) { const rad = (1.2 + R() * 0.8) * s; deco.canopy.push({ x: top[0] + (R() - 0.5) * 2.4 * s, y: top[1] + (0.7 + R() * 0.8) * s, z: top[2] + (R() - 0.5) * 2 * s, sx: rad * 1.2, sy: rad * 0.8, sz: rad * 1.2, c: base.clone().lerp(col(PAL.blossomLight), R() * 0.3) }); }
  // petal carpet
  for (let k = 0; k < 5; k++) { const a = R() * 6.283, d = R() * 3.2 * s; deco.carpets.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, s: (0.7 + R() * 1.4) * s, c: R() < 0.5 ? col(0xffc9d9) : col(0xffe8ef) }); }
  if (collide) addCircle(x, z, 0.55 * s);
}

export function bushAt(deco, x, z, s, seed) {
  const R = rng(seed);
  const greens = [col(0x66a85a), col(0x4f9a63), col(0x8cb85a), col(0x3fa585)];
  const g = greens[Math.floor(R() * greens.length)];
  deco.bush.push({ x, y: 0.5 * s, z, sx: s * (1 + R() * 0.3), sy: s * (0.9 + R() * 0.3), sz: s * (1 + R() * 0.3), c: g });
}

// ---------------------------------------------------------------------------------------------
// Build instanced meshes from deco lists
// ---------------------------------------------------------------------------------------------
const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), Sc = new THREE.Vector3(), Ps = new THREE.Vector3(), E = new THREE.Euler();

function gradBlob(detail, top, bot) {
  const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed(); g.deleteAttribute('uv');
  const n = g.attributes.position.count; const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i); const t = THREE.MathUtils.clamp(y * 0.5 + 0.5, 0, 1); const c = bot.clone().lerp(top, t); arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.computeVertexNormals(); return g;
}

export function buildDecor(deco, mats, q, scene) {
  const out = new THREE.Group();
  // canopy blobs
  if (deco.canopy.length) {
    const g = gradBlob(Math.max(1, q.canopyDetail), col(0xfff3f7), col(0xf2a0bc));
    const im = new THREE.InstancedMesh(g, mats.canopy, deco.canopy.length);
    deco.canopy.forEach((c, i) => { E.set((i * 0.7) % 3, (i * 1.3) % 6, 0); Qn.setFromEuler(E); Ps.set(c.x, c.y, c.z); Sc.set(c.sx, c.sy, c.sz); M.compose(Ps, Qn, Sc); im.setMatrixAt(i, M); im.setColorAt(i, c.c); });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; out.add(im);
  }
  if (deco.bush.length) {
    const g = gradBlob(0, col(0xc4e08a), col(0x2f7d55));
    const im = new THREE.InstancedMesh(g, mats.bush, deco.bush.length);
    deco.bush.forEach((c, i) => { E.set(0, i * 1.7, 0); Qn.setFromEuler(E); Ps.set(c.x, c.y, c.z); Sc.set(c.sx, c.sy, c.sz); M.compose(Ps, Qn, Sc); im.setMatrixAt(i, M); im.setColorAt(i, c.c); });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; out.add(im);
  }
  // petal carpets
  if (deco.carpets.length) {
    const g = new THREE.CircleGeometry(1, 7); g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const im = new THREE.InstancedMesh(g, mat, deco.carpets.length);
    const R = rng(5);
    deco.carpets.forEach((c, i) => { E.set(0, R() * 6, 0); Qn.setFromEuler(E); Ps.set(c.x, 0.03 + R() * 0.01, c.z); Sc.set(c.s, 1, c.s * (0.6 + R() * 0.4)); M.compose(Ps, Qn, Sc); im.setMatrixAt(i, M); im.setColorAt(i, c.c); });
    im.receiveShadow = true; out.add(im);
  }
  // grass tufts
  if (deco.grass.length) {
    const blade = (ox, oz, ang, hgt) => {
      const g = new THREE.BufferGeometry(); const w = 0.07, c = Math.cos(ang), s = Math.sin(ang);
      const p = [-w, 0, 0, w, 0, 0, 0.0, hgt, 0].map((v, i) => v);
      const pos = []; [[-w, 0], [w, 0], [0, hgt]].forEach(([x, y]) => pos.push(ox + x * c, y, oz - x * s));
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const dk = col(0x3c8a4f), lt = col(0xb5de6a);
      g.setAttribute('color', new THREE.Float32BufferAttribute([dk.r, dk.g, dk.b, dk.r, dk.g, dk.b, lt.r, lt.g, lt.b], 3));
      return g;
    };
    const parts = []; const R = rng(9);
    for (let i = 0; i < 6; i++) parts.push(blade(R.range(-0.18, 0.18), R.range(-0.18, 0.18), R() * 3.14, 0.45 + R() * 0.45));
    const tuft = mergeGeometries(parts); tuft.computeVertexNormals();
    const im = new THREE.InstancedMesh(tuft, mats.grass, deco.grass.length);
    deco.grass.forEach((c, i) => { E.set(0, c.r, 0); Qn.setFromEuler(E); Ps.set(c.x, 0, c.z); Sc.set(c.s, c.s, c.s); M.compose(Ps, Qn, Sc); im.setMatrixAt(i, M); });
    im.receiveShadow = true; im.frustumCulled = false; out.add(im);
    out.userData.grass = im;
  }
  // hanging lanterns (swaying)
  if (deco.hang.length) {
    const g = mergeGeometries(hangingLanternGeometry());
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position );
        {
          vec3 ip = instanceMatrix[3].xyz;
          float ph = ip.x * 0.7 + ip.z * 0.5;
          float a = sin( uTime * 1.25 + ph ) * 0.12 + sin( uTime * 2.3 + ph * 2.0 ) * 0.04;
          float bb = cos( uTime * 1.05 + ph * 1.3 ) * 0.09;
          float ca = cos( a ), sa = sin( a ), cb = cos( bb ), sb = sin( bb );
          transformed.xy = vec2( ca * transformed.x - sa * transformed.y, sa * transformed.x + ca * transformed.y );
          transformed.yz = vec2( cb * transformed.y - sb * transformed.z, sb * transformed.y + cb * transformed.z );
        }`);
    };
    const im = new THREE.InstancedMesh(g, mat, deco.hang.length);
    deco.hang.forEach((h, i) => { Ps.set(h.x, h.y, h.z); Sc.setScalar(h.s); Qn.identity(); M.compose(Ps, Qn, Sc); im.setMatrixAt(i, M); deco.halos.push({ x: h.x, y: h.y - 1.2 * h.s, z: h.z, s: 3.4 * h.s, a: 0.7 }); deco.lanternPts.push([h.x, h.y, h.z]); });
    im.frustumCulled = false; out.add(im);
  }
  // halos (additive billboards)
  if (deco.halos.length) {
    const g = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute vec4 aHalo; varying vec2 vUv; varying float vA;
        void main(){ vUv = uv; vA = aHalo.w;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
          mv.xy += position.xy * aHalo.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 vUv; varying float vA; void main(){ float d = length(vUv - 0.5) * 2.0; float k = pow(clamp(1.0 - d, 0.0, 1.0), 2.4); gl_FragColor = vec4(vec3(1.0, 0.62, 0.26) * k * vA * 1.1, 1.0); }`,
    });
    const im = new THREE.InstancedMesh(g, mat, deco.halos.length);
    const aH = new Float32Array(deco.halos.length * 4);
    deco.halos.forEach((h, i) => { Ps.set(h.x, h.y, h.z); Sc.setScalar(1); Qn.identity(); M.compose(Ps, Qn, Sc); im.setMatrixAt(i, M); aH.set([0, 0, h.s, h.a], i * 4); });
    g.setAttribute('aHalo', new THREE.InstancedBufferAttribute(aH, 4));
    im.frustumCulled = false; im.renderOrder = 5; out.add(im);
  }
  // banners
  if (deco.flags.length) {
    const g = new THREE.PlaneGeometry(1, 1, 3, 10); g.translate(0, -0.5, 0);
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, uniforms: { uTime: U.time },
      vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vN;
        void main(){ vUv = uv; vec3 p = position; float t = 1.0 - uv.y; vec3 ip = instanceMatrix[3].xyz; float ph = ip.x*0.4 + ip.z*0.3;
          p.z += sin(uTime*2.4 + t*4.5 + ph) * 0.18 * t + sin(uTime*4.1 + t*7.0 + ph) * 0.05 * t;
          p.x += sin(uTime*1.7 + t*3.0 + ph) * 0.04 * t;
          vec4 w = modelViewMatrix * instanceMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * vec3(0.,0.,1.));
          gl_Position = projectionMatrix * w; }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vN;
        void main(){ vec3 verm = vec3(0.72, 0.10, 0.06); vec3 gold = vec3(1.0, 0.62, 0.12);
          float border = step(vUv.x, 0.07) + step(0.93, vUv.x) + step(vUv.y, 0.04) + step(0.965, vUv.y);
          vec2 c = vec2((vUv.x - 0.5) * 1.0, (vUv.y - 0.62) * 3.2); float d = length(c);
          float ring = smoothstep(0.30, 0.28, d) - smoothstep(0.20, 0.18, d);
          float core = smoothstep(0.17, 0.15, d);
          vec3 col = verm * (0.7 + 0.3 * vUv.y);
          col = mix(col, gold, clamp(border + ring + core, 0.0, 1.0));
          // swallow-tail cut
          if (vUv.y < 0.1 && abs(vUv.x - 0.5) < (0.1 - vUv.y) * 1.2 ) discard;
          gl_FragColor = vec4(col * 0.95, 1.0); }`,
    });
    const im = new THREE.InstancedMesh(g, mat, deco.flags.length);
    deco.flags.forEach((f, i) => { E.set(0, f.rotY, 0); Qn.setFromEuler(E); Ps.set(f.x, f.y, f.z); Sc.set(f.w, f.h, 1); M.compose(Ps, Qn, Sc); im.setMatrixAt(i, M); });
    im.frustumCulled = false; out.add(im);
  }
  return out;
}

export function scatterGrass(deco, n, filter, seed = 3) {
  const R = rng(seed); let tries = 0;
  while (deco.grass.length < n && tries < n * 20) {
    tries++;
    const x = R.range(-94, 94), z = R.range(-106, 92);
    if (!filter(x, z)) continue;
    deco.grass.push({ x, z, s: 0.8 + R() * 0.9, r: R() * 6.28 });
  }
}
