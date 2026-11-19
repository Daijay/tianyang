import * as THREE from 'three';
import { U } from './shared.js';

const FADE_FRAG_PARS = /* glsl */ `
uniform vec3 uFadeCam; uniform vec3 uFadePlayer; uniform float uFadeR; uniform float uFadeOn;
`;
const FADE_FRAG = /* glsl */ `
#ifdef USE_FOG
{
  vec3 ab = uFadePlayer - uFadeCam;
  float t = clamp( dot( vFogWorld - uFadeCam, ab ) / dot( ab, ab ), 0.0, 1.0 );
  vec3 cp = uFadeCam + ab * t;
  float d = length( vFogWorld - cp );
  float rad = uFadeR * ( 0.55 + 1.5 * t );
  float k = smoothstep( rad * 0.35, rad, d );
  float between = step( t, 0.965 ) * step( 0.03, t );
  float vis = mix( 1.0, k, between * uFadeOn );
  float ign = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
  if ( vis < ign ) discard;
}
#endif
`;

const SWAY_PARS = /* glsl */ `uniform float uTime; uniform vec2 uWind;`;

/** patch(material, {fade, sway}) sway: 'canopy' | 'grass' */
export function patch(mat, { fade = false, sway = null } = {}) {
  mat.onBeforeCompile = (shader) => {
    if (fade) {
      shader.uniforms.uFadeCam = U.cam; shader.uniforms.uFadePlayer = U.player;
      shader.uniforms.uFadeR = U.fadeR; shader.uniforms.uFadeOn = U.fadeOn;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FADE_FRAG_PARS)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FADE_FRAG);
    }
    if (sway) {
      shader.uniforms.uTime = U.time; shader.uniforms.uWind = U.wind;
      let code;
      if (sway === 'canopy') {
        code = /* glsl */ `
        vec3 transformed = vec3( position );
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float ph = ip.x * 0.17 + ip.z * 0.13;
          float g = sin( uTime * 0.9 + ph ) * 0.6 + sin( uTime * 2.1 + ph * 1.7 ) * 0.25;
          transformed += vec3( uWind.x * g * 0.10, 0.0, uWind.y * g * 0.10 );
          transformed += vec3( sin( uTime * 1.4 + ph + position.y * 2.2 ), sin( uTime * 1.9 + ph * 1.3 + position.x ) * 0.4, cos( uTime * 1.2 + ph + position.x * 2.0 ) ) * 0.045;
        }`;
      } else {
        code = /* glsl */ `
        vec3 transformed = vec3( position );
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float h = max( position.y, 0.0 );
          float ph = ip.x * 0.31 + ip.z * 0.27;
          float g = sin( uTime * 1.7 + ph ) * 0.55 + sin( uTime * 3.1 + ph * 1.9 ) * 0.2 + 0.3;
          transformed.x += uWind.x * g * h * 0.55;
          transformed.z += uWind.y * g * h * 0.55;
        }`;
      }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + SWAY_PARS)
        .replace('#include <begin_vertex>', code);
    }
  };
  mat.customProgramCacheKey = () => `${fade ? 'F' : ''}${sway || ''}`;
  return mat;
}

export function createMaterials() {
  const main = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.0, flatShading: true }), { fade: true });
  const gold = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.7, flatShading: true, envMapIntensity: 1.4 }), { fade: true });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const canopy = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, emissive: new THREE.Color(0xff6f9f), emissiveIntensity: 0.11 }), { fade: true, sway: 'canopy' });
  const bush = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), { fade: true, sway: 'canopy' });
  const grass = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }), { sway: 'grass' });
  return { main, gold, glow, canopy, bush, grass };
}
