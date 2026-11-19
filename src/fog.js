import * as THREE from 'three';
import { HAZE_GLSL } from './config.js';

// Replace three's fog chunks with a world-space height fog that is tinted by the sun and
// matches the sky's horizon color (so distant silhouettes layer into the haze).
export function installFog() {
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  {
    vec4 fogWp = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      fogWp = instanceMatrix * fogWp;
    #endif
    fogWp = modelMatrix * fogWp;
    vFogWorld = fogWp.xyz;
  }
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  ${HAZE_GLSL}
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  {
    vec3 fv = vFogWorld - cameraPosition;
    float fd = length( fv );
    vec3 fdir = fv / max( fd, 0.001 );
    float hFall = exp( - max( vFogWorld.y + 6.0, 0.0 ) * 0.028 );
    float dens = fogDensity * ( 0.45 + 1.05 * hFall );
    float ff = clamp( 1.0 - exp( - dens * dens * fd * fd ), 0.0, 0.96 );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, hazeColor( fdir ), ff );
  }
#endif`;
}
