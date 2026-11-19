import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, GodRaysEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, FXAAEffect, BlendFunction, Effect, EffectAttribute, KernelSize,
} from 'postprocessing';
import { U } from './shared.js';

// Warm highlights / cool shadows grade + distant heat shimmer. Runs after tone mapping.
const GRADE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uShimmer;
uniform float uWarm;
void mainUv(inout vec2 uv) {
  if (uShimmer > 0.5) {
    float depth = readDepth(uv);
    float vz = -perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
    float w = smoothstep(150.0, 420.0, vz) * step(depth, 0.99995);
    float band = smoothstep(0.0, 0.5, 1.0 - abs(uv.y - 0.5) * 1.6);
    uv.x += sin(uv.y * 260.0 + uTime * 1.6 + uv.x * 40.0) * 0.0011 * w * band;
    uv.y += sin(uv.x * 190.0 - uTime * 1.2) * 0.0006 * w * band;
  }
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // cool blue-violet shadows, warm gold highlights
  vec3 shadowTint = vec3(0.80, 0.86, 1.10);
  vec3 midTint = vec3(1.0);
  vec3 hiTint = vec3(1.09, 1.0, 0.84);
  c *= mix(shadowTint, midTint, smoothstep(0.02, 0.30, l));
  c *= mix(vec3(1.0), hiTint, smoothstep(0.35, 0.85, l) * uWarm);
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l2), c, 1.13);
  // gentle S-curve
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);
  outputColor = vec4(c, inputColor.a);
}`;

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', GRADE_FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([['uTime', new THREE.Uniform(0)], ['uShimmer', new THREE.Uniform(1)], ['uWarm', new THREE.Uniform(1)]]),
    });
  }
  update(renderer, inputBuffer, dt) { this.uniforms.get('uTime').value += dt; }
}

export function createRenderer(canvas, q) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true, preserveDrawingBuffer: new URLSearchParams(location.search).has('noauto') });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 1);
  return renderer;
}

export class Post {
  constructor(renderer, scene, camera, sunMesh, q) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.sunMesh = sunMesh;
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: q.msaa, depthBuffer: true, stencilBuffer: false });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.godrays = new GodRaysEffect(camera, sunMesh, {
      blendFunction: BlendFunction.SCREEN, samples: 48, density: 0.92, decay: 0.93, weight: 0.26, exposure: 0.34,
      clampMax: 0.85, resolutionScale: 0.4, kernelSize: KernelSize.SMALL, blur: true,
    });
    this.godPass = new EffectPass(camera, this.godrays);
    this.composer.addPass(this.godPass);

    this.bloom = new BloomEffect({ intensity: 0.7, luminanceThreshold: 1.0, luminanceSmoothing: 0.35, mipmapBlur: true, radius: 0.72, levels: 7 });
    this.bloomPass = new EffectPass(camera, this.bloom);
    this.composer.addPass(this.bloomPass);

    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.grade = new GradeEffect();
    this.vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    this.noise = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT });
    this.noise.blendMode.opacity.value = 0.12;
    this.finalPass = new EffectPass(camera, this.tone, this.grade, this.vignette, this.noise);
    this.composer.addPass(this.finalPass);

    this.fxaa = new FXAAEffect();
    this.fxaaPass = new EffectPass(camera, this.fxaa);
    this.composer.addPass(this.fxaaPass);
    this.applyQuality(q);
  }

  applyQuality(q) {
    this.godPass.enabled = !!q.godrays;
    this.bloomPass.enabled = !!q.bloom;
    this.bloom.resolution.scale = q.bloomScale ?? 0.5;
    this.fxaaPass.enabled = !!q.fxaa;
    this.noise.blendMode.opacity.value = q.grain ? 0.12 : 0.0;
    this.grade.uniforms.get('uShimmer').value = q.heat ? 1 : 0;
    this.composer.multisampling = q.msaa;
  }

  setSize(w, h) { this.composer.setSize(w, h, false); }
  setGodRayStrength(s) { this.godrays.blendMode.opacity.value = s; }
  render(dt) { this.composer.render(dt); }
}
