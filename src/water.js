import * as THREE from 'three';
import { HAZE_GLSL } from './config.js';
import { U } from './shared.js';

const VERT = /* glsl */ `
attribute float aEdge;
varying float vEdge; varying vec3 vW;
void main(){ vEdge = aEdge; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime; uniform float uFancy; uniform float uDensity;
varying float vEdge; varying vec3 vW;
${HAZE_GLSL}
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float ripple(vec2 p, float t){ return vn(p*1.3 + vec2(t*0.25, t*0.18)) + vn(p*2.9 - vec2(t*0.3, -t*0.22))*0.5 + vn(p*6.5 + t*0.5)*0.25; }
void main(){
  vec2 p = vW.xz;
  float e = 0.12;
  float h0 = ripple(p, uTime), hx = ripple(p + vec2(e,0.), uTime), hz = ripple(p + vec2(0.,e), uTime);
  vec3 n = normalize(vec3((h0 - hx) * 0.55, 1.0, (h0 - hz) * 0.55));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 R = reflect(-V, n);
  R.y = abs(R.y);
  vec3 sky = hazeColor(vec3(R.x, 0.15, R.z));
  float top = smoothstep(0.0, 0.8, R.y);
  sky = mix(sky, vec3(0.42, 0.38, 0.78), top * 0.7);
  sky += vec3(1.0,0.6,0.25) * pow(max(dot(R, SUNDIR),0.0), 6.0) * 0.5;
  vec3 deep = vec3(0.04, 0.42, 0.50);
  vec3 shallow = vec3(0.20, 0.72, 0.70);
  vec3 body = mix(deep, shallow, smoothstep(2.6, 0.0, vEdge) * 0.6 + 0.2);
  vec3 col = mix(body, sky, 0.25 + 0.7 * fres);
  // sun glints
  float spec = pow(max(dot(R, SUNDIR), 0.0), 220.0);
  float spark = step(0.74, vn(p * 9.0 + uTime * vec2(0.6, 0.4))) * pow(max(dot(R, SUNDIR), 0.0), 60.0);
  col += vec3(5.0, 3.6, 1.8) * (spec * 1.6 + spark * 1.6) * uFancy;
  // foam at edges
  float foam = smoothstep(0.55, 0.0, vEdge) * (0.55 + 0.45 * vn(p * 5.0 + uTime * 0.6));
  foam = smoothstep(0.35, 0.8, foam);
  col = mix(col, vec3(1.0, 0.96, 0.9), foam * 0.7);
  float alpha = clamp(0.62 + fres * 0.38 + foam * 0.3, 0.0, 0.97);
  // fog
  vec3 fv = vW - cameraPosition; float fd = length(fv);
  float dens = uDensity * (0.45 + 1.05 * exp(-max(vW.y + 6.0, 0.0) * 0.028));
  float ff = clamp(1.0 - exp(-dens * dens * fd * fd), 0.0, 0.96);
  col = mix(col, hazeColor(fv / fd), ff);
  gl_FragColor = vec4(col, alpha);
}`;

export function makeWaterMaterial(q) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { uTime: U.time, uFancy: { value: q.fancyWater ? 1 : 0.4 }, uDensity: { value: 0.0034 } },
  });
}

/** rect: {cx,cz,hx,hz,y} or circle: {cx,cz,r,y} */
export function waterGeometry(w) {
  let g;
  if (w.r) {
    g = new THREE.CircleGeometry(w.r, 40, 0, Math.PI * 2); g.rotateX(-Math.PI / 2);
    // rings: use RingGeometry for interior vertices for edge attribute
    const rings = []; const segs = 40;
    g = new THREE.BufferGeometry();
    const pos = [], edge = [], idx = [];
    const R = 6;
    pos.push(0, 0, 0); edge.push(w.r);
    for (let ri = 1; ri <= R; ri++) for (let i = 0; i < segs; i++) { const a = i / segs * 6.2832, rr = w.r * ri / R; pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); edge.push(w.r - rr); }
    for (let i = 0; i < segs; i++) idx.push(0, 1 + (i + 1) % segs, 1 + i);
    for (let ri = 1; ri < R; ri++) for (let i = 0; i < segs; i++) { const a = 1 + (ri - 1) * segs + i, b2 = 1 + (ri - 1) * segs + (i + 1) % segs, c = 1 + ri * segs + i, d = 1 + ri * segs + (i + 1) % segs; idx.push(a, b2, d, a, d, c); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1)); g.setIndex(idx);
  } else {
    const sx = Math.max(4, Math.round(w.hx * 2 / 1.5)), sz = Math.max(4, Math.round(w.hz * 2 / 1.5));
    g = new THREE.PlaneGeometry(w.hx * 2, w.hz * 2, sx, sz); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; const edge = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) edge[i] = Math.min(w.hx - Math.abs(p.getX(i)), w.hz - Math.abs(p.getZ(i)));
    g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
  }
  g.translate(w.cx, w.y, w.cz);
  return g;
}

/** Koi: instanced fish swimming in loops inside each water body */
export function buildKoi(deco, q) {
  const count = q.koi; if (!deco.koi.length) return null;
  const body = new THREE.ConeGeometry(0.16, 0.8, 6); body.rotateX(Math.PI / 2); body.translate(0, 0, 0.0); // tip toward +z
  const tail = new THREE.ConeGeometry(0.15, 0.36, 4); tail.rotateX(-Math.PI / 2); tail.scale(0.25, 1, 1); tail.translate(0, 0, -0.52);
  const geos = [body, tail].map((g) => { const gg = g.toNonIndexed(); gg.deleteAttribute('uv'); return gg; });
  const merged = new THREE.BufferGeometry();
  const pos = [], tailMask = [];
  geos.forEach((g, gi) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); tailMask.push(gi); } });
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); merged.setAttribute('aTail', new THREE.Float32BufferAttribute(tailMask, 1));
  merged.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time },
    vertexShader: `uniform float uTime; attribute float aTail; attribute vec4 aKoi; attribute vec3 aCol; attribute vec4 aZone; varying vec3 vC; varying float vZ;
      void main(){ float t = uTime * aKoi.w + aKoi.z; vec3 p = position;
        p.x += sin(uTime * 7.0 * aKoi.w + p.z * 6.0) * 0.07 * (0.3 + aTail * 1.2) * smoothstep(0.4, -0.5, p.z);
        float a = t; vec2 c = aZone.xy; vec2 r = aZone.zw;
        vec2 pos2 = c + vec2(cos(a), sin(a * 1.0 + sin(a * 0.7))) * r * (0.55 + 0.4 * sin(aKoi.x * 6.0));
        vec2 vel = vec2(-sin(a), cos(a + cos(a * 0.7) * 0.7 * 0.7)) * r;
        float yaw = atan(vel.x, vel.y);
        mat2 R = mat2(cos(yaw), -sin(yaw), sin(yaw), cos(yaw));
        vec2 xz = R * p.xz * aKoi.y;
        vec3 w = vec3(pos2.x + xz.x, aKoi.x * 0.0 + 0.12 + p.y * aKoi.y, pos2.y + xz.y);
        vC = aCol; vZ = aTail;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: `varying vec3 vC; varying float vZ; void main(){ gl_FragColor = vec4(vC * (0.9 + 0.1 * vZ), 1.0); }`,
  });
  const g = new THREE.InstancedBufferGeometry(); g.index = merged.index; g.attributes = merged.attributes;
  const n = count; const aKoi = new Float32Array(n * 4), aCol = new Float32Array(n * 3), aZone = new Float32Array(n * 4);
  const cols = [[1.0, 0.45, 0.12], [1.0, 0.92, 0.82], [1.0, 0.7, 0.2], [0.95, 0.3, 0.2], [1, 1, 1]];
  for (let i = 0; i < n; i++) {
    const z = deco.koi[i % deco.koi.length]; const c = cols[i % cols.length];
    aKoi.set([Math.random(), 0.8 + Math.random() * 0.6, Math.random() * 6.28, 0.18 + Math.random() * 0.14], i * 4);
    aCol.set(c, i * 3); aZone.set([z.cx, z.cz, z.rx, z.rz], i * 4);
  }
  g.setAttribute('aKoi', new THREE.InstancedBufferAttribute(aKoi, 4)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 3)); g.setAttribute('aZone', new THREE.InstancedBufferAttribute(aZone, 4));
  g.instanceCount = n;
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 1;
  m.userData.setCount = (k) => { g.instanceCount = Math.min(n, k); };
  return m;
}
