import * as THREE from 'three';
import { SUN_DIR } from './config.js';
import { L, PYR } from './world.js';
import { damp, dampAngle, clamp, lerp, smoothstep } from './util.js';

const SUN_H = new THREE.Vector2(SUN_DIR.x, SUN_DIR.z).normalize();
const SUN_T = SUN_DIR.y / Math.hypot(SUN_DIR.x, SUN_DIR.z);

// Camera rig: follow (three-quarter diorama), orbit (resting), reveal (pull back to frame pyramid vs sun), title, intro fly-in.
export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'title';
    this.baseYaw = 0.5; this.yaw = 0.5; this.pitch = 0.8; this.dist = 37; this.fov = 38;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.controlYaw = 0.5;
    this.revealT = 0; this.revealHold = 0; this.introT = 0; this.orbit = 0; this.titleT = 0;
    this.aspect = 1; this.zoom = 1;
    this.fromPos = new THREE.Vector3(); this.fromLook = new THREE.Vector3(); this.fromFov = 40;
    this.revealing = false;
    this._tp = new THREE.Vector3(); this._tl = new THREE.Vector3();
  }

  titleShot(t, outPos, outLook) {
    const tgt = new THREE.Vector3(PYR.x, PYR.top + 24, PYR.z);
    const D = 128 + Math.sin(t * 0.07) * 6;
    outPos.set(tgt.x - SUN_H.x * D + Math.sin(t * 0.09) * 9, tgt.y - D * SUN_T + 30 + Math.sin(t * 0.11) * 1.4, tgt.z - SUN_H.y * D);
    outLook.copy(tgt); outLook.y += 1;
  }
  revealShot(t, outPos, outLook) {
    const tgt = new THREE.Vector3(PYR.x, PYR.top + 20, PYR.z);
    const D = 112 + Math.sin(t * 0.12) * 3;
    outPos.set(tgt.x - SUN_H.x * D + Math.sin(t * 0.1) * 7, tgt.y - D * SUN_T + 14 + Math.sin(t * 0.13) * 1.0, tgt.z - SUN_H.y * D);
    outLook.copy(tgt); outLook.y += 0.0;
  }
  followShot(player, outPos, outLook) {
    const d = this.dist * this.zoom * (this.aspect < 1 ? 1 + (1 - this.aspect) * 0.85 : 1);
    outLook.set(player.pos.x, player.pos.y + 1.1, player.pos.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    outPos.set(outLook.x + Math.sin(this.yaw) * cp * d, outLook.y + sp * d, outLook.z + Math.cos(this.yaw) * cp * d);
  }

  setMode(m) { this.mode = m; }
  startIntro() { this.fromPos.copy(this.pos); this.fromLook.copy(this.look); this.fromFov = this.cam.fov; this.introT = 0; this.mode = 'intro'; }

  update(dt, t, player, inp, freeze) {
    this.titleT += dt;
    const cam = this.cam;
    this.aspect = cam.aspect;
    let fovT = 38;
    if (this.mode === 'title') {
      this.titleShot(this.titleT, this._tp, this._tl); this.pos.lerp(this._tp, 1 - Math.exp(-3 * dt)); this.look.lerp(this._tl, 1 - Math.exp(-3 * dt)); fovT = 34;
      if (this.pos.lengthSq() < 1) { this.pos.copy(this._tp); this.look.copy(this._tl); }
      cam.fov = damp(cam.fov, fovT, 3, dt);
    } else if (this.mode === 'intro') {
      this.introT += dt / 6.5; const e = smoothstep(0, 1, this.introT); const e2 = e * e * (3 - 2 * e);
      this.followShot(player, this._tp, this._tl);
      this.pos.lerpVectors(this.fromPos, this._tp, e2); this.look.lerpVectors(this.fromLook, this._tl, e2);
      // arc up a little during the flight
      this.pos.y += Math.sin(e2 * Math.PI) * 18;
      cam.fov = lerp(this.fromFov, 38, e2);
      if (this.introT >= 1) this.mode = 'follow';
    } else {
      // follow / orbit / reveal
      const dRev = Math.hypot(player.pos.x - L.reveal.x, player.pos.z - L.reveal.z);
      const onTop = player.pos.y > PYR.top - 0.8;
      if (!this.revealing && onTop && dRev < 4.2) { this.revealHold += dt; if (this.revealHold > 0.8) { this.revealing = true; this.revealT = 0; } }
      else if (!this.revealing) this.revealHold = 0;
      if (this.revealing && (dRev > 11 || !onTop)) this.revealing = false;
      const sitting = player.sitting;
      let k = 4.2;
      if (this.revealing) {
        this.revealT += dt;
        this.revealShot(this.revealT, this._tp, this._tl); k = 0.9; fovT = 30;
        this.pos.lerp(this._tp, 1 - Math.exp(-k * dt)); this.look.lerp(this._tl, 1 - Math.exp(-k * dt));
        cam.fov = damp(cam.fov, fovT, 1.2, dt);
      } else {
        // idle zoom + resting orbit
        const idle = player.idleT;
        const zoomTarget = sitting ? 0.52 : (idle > 3 ? 0.74 : 1);
        this.zoom = damp(this.zoom, zoomTarget, sitting ? 1.2 : 0.8, dt);
        this.pitch = damp(this.pitch, sitting ? 0.42 : 0.8, 1.0, dt);
        if (sitting) this.orbit += dt * 0.16; else this.orbit = damp(this.orbit, 0, 0.0, dt);
        this.yaw = this.baseYaw + this.orbit;
        this.followShot(player, this._tp, this._tl);
        // slight look-ahead on movement
        const la = 0.0;
        this.pos.lerp(this._tp, 1 - Math.exp(-k * dt)); this.look.lerp(this._tl, 1 - Math.exp(-k * 1.3 * dt));
        cam.fov = damp(cam.fov, 38, 1.5, dt);
        if (!sitting && this.orbit > 0) this.orbit = damp(this.orbit, 0, 1.5, dt);
      }
    }
    // control yaw only follows the base camera (so movement doesn't flip during reveal)
    this.controlYaw = this.baseYaw + (this.mode === 'follow' && !this.revealing ? this.orbit : 0);
    cam.position.copy(this.pos); cam.lookAt(this.look); cam.updateProjectionMatrix();
  }

  snapTo(player) { this.followShot(player, this.pos, this.look); this.cam.position.copy(this.pos); this.cam.lookAt(this.look); }
}
