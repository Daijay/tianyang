import * as THREE from 'three';
import { SUN_DIR } from './config.js';
import { U } from './shared.js';
import { rng } from './util.js';

const SUN_GLSL = `const vec3 SUNV = vec3(${SUN_DIR.x.toFixed(5)}, ${SUN_DIR.y.toFixed(5)}, ${SUN_DIR.z.toFixed(5)});`;

export function createPetals(q) {
  const MAX = 9000;
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
  const R = rng(21); const seed = new Float32Array(MAX * 4);
  for (let i = 0; i < MAX; i++) seed.set([R(), R(), R(), R()], i * 4);
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = Math.min(MAX, q.petals);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: false,
    uniforms: { uTime: U.time, uCenter: { value: new THREE.Vector3() }, uWind: U.wind, uBox: { value: new THREE.Vector3(70, 24, 70) } },
    vertexShader: `${SUN_GLSL}
      uniform float uTime; uniform vec3 uCenter; uniform vec2 uWind; uniform vec3 uBox;
      attribute vec4 aSeed; varying vec2 vUv; varying vec3 vCol; varying float vFade;
      void main(){
        vUv = uv; float t = uTime;
        vec3 org = uCenter - uBox * 0.5; org.y = uCenter.y - 4.0;
        vec3 p = aSeed.xyz * uBox;
        float sp = 0.8 + aSeed.w * 0.9;
        p += vec3(uWind.x * 2.6, -0.5 - aSeed.w * 0.45, uWind.y * 2.6) * t * sp;
        p.x += sin(t * 0.9 + aSeed.x * 40.0) * 1.1 + sin(t * 2.1 + aSeed.z * 30.0) * 0.25;
        p.z += cos(t * 0.8 + aSeed.y * 40.0) * 1.1;
        p.y += sin(t * 1.7 + aSeed.w * 30.0) * 0.35;
        p = mod(p - org, uBox) + org;
        vec3 rel = (p - org) / uBox;
        vFade = smoothstep(0.0, 0.1, rel.x) * smoothstep(1.0, 0.9, rel.x) * smoothstep(0.0, 0.1, rel.z) * smoothstep(1.0, 0.9, rel.z) * smoothstep(0.0, 0.08, rel.y) * smoothstep(1.0, 0.85, rel.y);
        float a = t * (1.5 + aSeed.w * 2.5) + aSeed.x * 20.0, b = t * (1.1 + aSeed.z * 2.0) + aSeed.y * 20.0;
        vec3 l = vec3(position.xy * (0.10 + aSeed.w * 0.07), 0.0);
        l = vec3(l.x * cos(a) - l.y * sin(a), l.x * sin(a) + l.y * cos(a), 0.0);
        l = vec3(l.x, l.y * cos(b), l.y * sin(b));
        vec3 n = normalize(vec3(0.0, -sin(b), cos(b)));
        float lit = 0.75 + 0.5 * abs(dot(n, SUNV));
        vec3 c1 = vec3(1.0, 0.62, 0.76), c2 = vec3(1.0, 0.88, 0.92);
        vCol = mix(c1, c2, fract(aSeed.x * 7.0 + aSeed.z * 3.0)) * lit;
        vec4 mv = viewMatrix * vec4(p + l, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vCol; varying float vFade;
      void main(){ vec2 c = (vUv - 0.5) * vec2(1.0, 1.25); float d = length(c * vec2(1.0, 0.8)); if (d > 0.5 || vFade < 0.5) discard; gl_FragColor = vec4(vCol, 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
  m.userData.setCount = (n) => { g.instanceCount = Math.min(MAX, n); };
  return m;
}

export function createMotes(q) {
  const MAX = 1800; const R = rng(33);
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3), sd = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) { pos.set([R(), R(), R()], i * 3); sd[i] = R(); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sd, 1));
  g.setDrawRange(0, Math.min(MAX, q.motes));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.time, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(46, 16, 46) }, uPx: { value: 1 } },
    vertexShader: `${SUN_GLSL}
      uniform float uTime; uniform vec3 uCenter; uniform vec3 uBox; uniform float uPx; attribute float aS; varying float vA;
      void main(){
        vec3 org = uCenter - uBox * 0.5; org.y = uCenter.y - 1.5;
        vec3 p = position * uBox + vec3(sin(uTime * 0.3 + aS * 30.0) * 0.8, sin(uTime * 0.5 + aS * 20.0) * 0.5, cos(uTime * 0.27 + aS * 25.0) * 0.8) + vec3(0.25, 0.02, 0.1) * uTime;
        p = mod(p - org, uBox) + org;
        vec3 side = normalize(cross(SUNV, vec3(0.0, 1.0, 0.0)));
        float w = dot(p, side) * 0.22 + sin(dot(p, SUNV) * 0.08) * 1.2;
        float shaft = smoothstep(0.2, 0.9, sin(w * 1.7) * 0.5 + 0.5 + sin(w * 0.6) * 0.25);
        vec3 rel = (p - org) / uBox;
        float edge = smoothstep(0.0, 0.12, rel.x) * smoothstep(1.0, 0.88, rel.x) * smoothstep(0.0, 0.12, rel.z) * smoothstep(1.0, 0.88, rel.z) * smoothstep(0.0, 0.1, rel.y) * smoothstep(1.0, 0.9, rel.y);
        float tw = 0.6 + 0.4 * sin(uTime * (1.0 + aS * 3.0) + aS * 50.0);
        vA = (0.12 + 0.88 * shaft) * edge * tw;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (1.2 + aS * 2.2) * (24.0 / max(-mv.z, 1.0));
      }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float k = pow(clamp(1.0 - d, 0.0, 1.0), 1.6); gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * k * vA * 1.15, 1.0); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false;
  p.userData.setCount = (n) => g.setDrawRange(0, Math.min(MAX, n));
  return p;
}

export function createWisps(q) {
  const MAX = 220; const R = rng(55);
  const quad = new THREE.PlaneGeometry(1, 1, 8, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
  const seed = new Float32Array(MAX * 4); for (let i = 0; i < MAX; i++) seed.set([R(), R(), R(), R()], i * 4);
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4)); g.instanceCount = Math.min(MAX, q.wisps);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: U.time, uCenter: { value: new THREE.Vector3() }, uWind: U.wind },
    vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform vec2 uWind; attribute vec4 aSeed; varying vec2 vUv; varying float vA;
      void main(){ vUv = uv; vec3 box = vec3(160.0, 1.0, 160.0); vec3 org = uCenter - box * 0.5;
        vec3 p = aSeed.xyz * box + vec3(uWind.x, 0.0, uWind.y) * uTime * (3.0 + aSeed.w * 3.0);
        p = mod(p - org, box) + org; p.y = 0.15 + aSeed.y * 1.3 + sin(uTime * 0.6 + aSeed.x * 20.0) * 0.12;
        vec3 rel = (p - org) / box; vA = smoothstep(0.0, 0.15, rel.x) * smoothstep(1.0, 0.85, rel.x) * smoothstep(0.0, 0.15, rel.z) * smoothstep(1.0, 0.85, rel.z);
        vec2 dir = normalize(uWind + 1e-4); vec2 sd = vec2(-dir.y, dir.x);
        float L = 5.0 + aSeed.w * 7.0; float W = 0.18 + aSeed.x * 0.2;
        float wob = sin(position.x * 6.0 + uTime * 2.0 + aSeed.z * 20.0) * 0.35;
        vec2 off = dir * position.x * L + sd * (position.y * W + wob);
        gl_Position = projectionMatrix * viewMatrix * vec4(p + vec3(off.x, 0.0, off.y), 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying float vA; void main(){ float a = smoothstep(0.0, 0.5, 0.5 - abs(vUv.x - 0.5)) * smoothstep(0.5, 0.1, abs(vUv.y - 0.5)) * vA * 0.28; gl_FragColor = vec4(1.0, 0.86, 0.62, a); }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 4;
  m.userData.setCount = (n) => { g.instanceCount = Math.min(MAX, n); };
  return m;
}

/** Long additive light shafts along the sun direction. anchors: [x,z,len,width,intensity] */
export function createShafts(anchors) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
  const n = anchors.length; const aA = new Float32Array(n * 4), aB = new Float32Array(n * 4);
  anchors.forEach((a, i) => { aA.set([a[0], a[4] ?? 0, a[1], a[2]], i * 4); aB.set([a[3], a[5] ?? 0.14, Math.random() * 10, 0], i * 4); });
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(aA, 4)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4)); g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: U.time, uStrength: { value: 1 } },
    vertexShader: `${SUN_GLSL}
      uniform float uTime; attribute vec4 aA; attribute vec4 aB; varying vec2 vUv; varying float vI; varying float vSeed;
      void main(){ vUv = uv; vSeed = aB.z;
        vec3 g0 = vec3(aA.x, aA.y, aA.z); float len = aA.w; float wid = aB.x;
        vec3 axis = SUNV; vec3 top = g0 + axis * len;
        vec3 c = (g0 + top) * 0.5;
        vec3 view = normalize(cameraPosition - c);
        vec3 side = normalize(cross(axis, view));
        float facing = abs(dot(normalize(cross(axis, view)), vec3(0.,1.,0.)));
        vI = aB.y;
        vec3 p = c + axis * (position.y * len) + side * (position.x * wid);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uStrength; varying vec2 vUv; varying float vI; varying float vSeed;
      void main(){ float x = abs(vUv.x - 0.5) * 2.0; float y = vUv.y;
        float a = pow(1.0 - x, 2.2) * smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.55, 1.0, y));
        float fl = 0.8 + 0.2 * sin(uTime * 0.5 + vSeed * 6.0 + y * 5.0);
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.36) * a * vI * fl * uStrength, 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 6;
  return m;
}
