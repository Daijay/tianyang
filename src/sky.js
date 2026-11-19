import * as THREE from 'three';
import { HAZE_GLSL, SUN_DIR } from './config.js';
import { U } from './shared.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999;
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uClouds;
${HAZE_GLSL}
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(11.3,7.1); a*=.5; } return s; }

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 hz = hazeColor(vec3(d.x, 0.0, d.z));
  vec3 mid = mix(vec3(0.74, 0.46, 0.60), vec3(0.58, 0.40, 0.66), 0.5);
  vec3 zen = vec3(0.13, 0.17, 0.52);
  float t = clamp(y, 0.0, 1.0);
  vec3 col = mix(hz, mid, smoothstep(0.0, 0.30, t));
  col = mix(col, zen, smoothstep(0.22, 0.95, t));
  if (y < 0.0) col = hz * (1.0 + y * 0.35);

  float s = max(dot(d, SUNDIR), 0.0);
  col += vec3(1.0, 0.52, 0.20) * pow(s, 5.0) * 0.30;
  col += vec3(1.0, 0.72, 0.38) * pow(s, 22.0) * 0.5;
  col += vec3(1.0, 0.88, 0.62) * pow(s, 150.0) * 0.9;

  // stylized slow clouds on a high plane
  if (uClouds > 0.5 && y > 0.015) {
    vec2 uv = d.xz / (y + 0.12) * 0.55 + vec2(uTime * 0.006, uTime * 0.002);
    float n = fbm(uv * 1.2);
    float n2 = fbm(uv * 1.2 + SUNDIR.xz * 0.10);
    float cloud = smoothstep(0.52, 0.64, n);
    cloud *= smoothstep(0.015, 0.22, y);
    float rim = clamp((n - n2) * 9.0 + 0.5, 0.0, 1.0);
    vec3 lit = mix(vec3(0.78, 0.52, 0.66), vec3(1.0, 0.86, 0.66), rim);
    lit += vec3(1.0, 0.7, 0.4) * pow(s, 8.0) * 0.5;
    col = mix(col, lit, cloud * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(renderer, scene, quality) {
  const geo = new THREE.SphereGeometry(800, 32, 20);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { uTime: U.time, uClouds: { value: quality.clouds ? 1 : 0 } },
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false; dome.renderOrder = -10;
  scene.add(dome);

  // sun disc: a real mesh so the god-rays pass can use it as a light source
  const R = 700; const ang = 0.052;
  const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(7.0, 4.6, 2.2), fog: false, toneMapped: false, depthWrite: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(Math.tan(ang) * R, 40), sunMat);
  sun.frustumCulled = false; sun.renderOrder = -9;
  scene.add(sun);

  // environment map from a clean (cloudless) copy of the sky
  const envScene = new THREE.Scene();
  const envMat = mat.clone(); envMat.uniforms = { uTime: { value: 0 }, uClouds: { value: 0 } };
  const envDome = new THREE.Mesh(geo, envMat); envScene.add(envDome);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(envScene, 0, 0.1, 1000);
  pm.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = 0.32;

  const tmp = new THREE.Vector3();
  return {
    dome, sun, setClouds(on) { mat.uniforms.uClouds.value = on ? 1 : 0; },
    update(camera) {
      dome.position.copy(camera.position);
      sun.position.copy(camera.position).addScaledVector(SUN_DIR, R);
      sun.quaternion.copy(camera.quaternion);
      tmp.copy(camera.position);
    },
  };
}
