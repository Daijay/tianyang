import * as THREE from 'three';

// Shared uniforms (same objects are plugged into many materials).
export const U = {
  time: { value: 0 },
  cam: { value: new THREE.Vector3() },
  player: { value: new THREE.Vector3() },
  fadeR: { value: 3.2 },
  fadeOn: { value: 1 },
  wind: { value: new THREE.Vector2(0.9, 0.35) },
};

export const state = {
  quality: null,       // QUALITY preset object
  mobile: false,
  paused: false,
};
