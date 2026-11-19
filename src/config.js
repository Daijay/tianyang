import * as THREE from 'three';

// Sun: low golden hour, to the north (behind the pyramid when approaching), slightly east.
export const SUN_DIR = new THREE.Vector3(0.52, 0.255, -0.82).normalize();

// Palette (sRGB hex). Colors are converted to linear by THREE.Color.
export const PAL = {
  gold: 0xf2b43a,
  goldDeep: 0xc98a22,
  goldPale: 0xffd98a,
  vermilion: 0xd23f2a,
  vermilionDeep: 0x9c2a22,
  jade: 0x3fae8a,
  jadeDeep: 0x1f6f63,
  turquoise: 0x2fb7c1,
  turquoiseDeep: 0x16808f,
  sand: 0xe9c593,
  sandDeep: 0xd49a62,
  stone: 0xf3e9d8,
  stoneShade: 0xdccdb6,
  stoneDark: 0xb8a58e,
  blossom: 0xffb6cc,
  blossomLight: 0xffe3ec,
  blossomDeep: 0xe86f9a,
  wood: 0x6b3a2c,
  ink: 0x3a2236,
  cream: 0xfff1d6,
};

export const WORLD = {
  plateau: { x0: -96, x1: 96, z0: -108, z1: 94, r: 10 },
  spawn: { x: 0, z: 119, y: -9 },
  pyramid: { x: 0, z: -56, tiers: 5, halves: [28, 24, 20, 16, 12], tierH: 2.0 },
  groundTex: { x0: -100, x1: 100, z0: -112, z1: 98 },
};

export const QUALITY = {
  low: {
    name: 'low', dpr: 1.0, shadowMap: 1024, shadowSpan: 56, msaa: 0, fxaa: true, bloom: true, bloomScale: 0.25,
    godrays: false, petals: 1400, motes: 260, grass: 2600, wisps: 40, birds: 6, koi: 8, terrainSeg: 150,
    groundTex: 1024, canopyDetail: 0, clouds: false, fancyWater: false, shafts: true, grain: false, heat: false,
  },
  medium: {
    name: 'medium', dpr: 1.25, shadowMap: 2048, shadowSpan: 84, msaa: 2, fxaa: false, bloom: true, bloomScale: 0.4,
    godrays: true, petals: 4500, motes: 900, grass: 7000, wisps: 120, birds: 10, koi: 16, terrainSeg: 230,
    groundTex: 2048, canopyDetail: 1, clouds: true, fancyWater: true, shafts: true, grain: true, heat: true,
  },
  high: {
    name: 'high', dpr: 2.0, shadowMap: 4096, shadowSpan: 110, msaa: 4, fxaa: false, bloom: true, bloomScale: 0.5,
    godrays: true, petals: 9000, motes: 1800, grass: 14000, wisps: 220, birds: 14, koi: 24, terrainSeg: 320,
    groundTex: 3072, canopyDetail: 1, clouds: true, fancyWater: true, shafts: true, grain: true, heat: true,
  },
};

// GLSL helper shared by sky + fog so far geometry melts into the exact horizon color.
export const HAZE_GLSL = /* glsl */ `
const vec3 SUNDIR = vec3(${SUN_DIR.x.toFixed(5)}, ${SUN_DIR.y.toFixed(5)}, ${SUN_DIR.z.toFixed(5)});
vec3 hazeColor(vec3 d) {
  float s = max(dot(d, SUNDIR), 0.0);
  vec2 hs = normalize(SUNDIR.xz);
  vec2 hd = normalize(d.xz + vec2(1e-4));
  float away = 0.5 - 0.5 * dot(hd, hs);
  vec3 base = mix(vec3(0.97, 0.60, 0.40), vec3(0.62, 0.40, 0.58), away * 0.7);
  base = mix(base, vec3(1.0, 0.66, 0.26), pow(s, 4.0) * 0.55);
  return base;
}
`;
