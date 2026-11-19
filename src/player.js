import * as THREE from 'three';
import { PAL } from './config.js';
import { U } from './shared.js';
import { col, damp, dampAngle, clamp, lerp } from './util.js';
import { canStand, walkH, groundType } from './world.js';

const mat = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.85, flatShading: true, ...o });

export class Player {
  constructor(scene, spawn) {
    this.scene = scene;
    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.gh = spawn.y; // true ground height
    this.yaw = Math.PI; // facing -z initially (north)
    this.speed = 0; this.phase = 0; this.sit = 0; this.sitting = false; this.idleT = 0; this.vel = new THREE.Vector3();
    this.onStep = null; this.lastSin = 0; this.walkingOn = 'stone';
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body); scene.add(this.root);
    const cloakGeo = new THREE.CylinderGeometry(0.2, 0.4, 0.95, 9, 1); cloakGeo.translate(0, 0.52, 0);
    this.colorGrad(cloakGeo, col(PAL.vermilion), col(0x7f1f2a));
    const cloak = new THREE.Mesh(cloakGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));
    cloak.position.y = 0.38; this.body.add(cloak);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.2, 9), mat(0xb02f2a)); shoulder.position.y = 1.42; this.body.add(shoulder);
    // head
    this.head = new THREE.Group(); this.head.position.y = 1.52; this.body.add(this.head);
    const face = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), mat(0xf0c9a2)); this.head.add(face);
    // wide straw hat
    const hatG = new THREE.ConeGeometry(0.66, 0.26, 12, 1, true); hatG.translate(0, 0.28, 0);
    const hat = new THREE.Mesh(hatG, mat(0xe6bd68, { side: THREE.DoubleSide })); this.head.add(hat);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.14, 10), mat(0xd9a64f)); crown.position.y = 0.44; this.head.add(crown);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 4, 12), mat(PAL.turquoise)); band.rotation.x = Math.PI / 2; band.position.y = 0.38; this.head.add(band);
    this.hat = hat;
    // brooch (sun) glow
    const brooch = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.2, 0.9), toneMapped: false }));
    brooch.position.set(0, 1.28, 0.27); brooch.rotation.x = -0.18; this.body.add(brooch);
    // belt
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 10), mat(PAL.gold, { metalness: 0.5 })); belt.rotation.x = Math.PI / 2; belt.position.y = 0.88; this.body.add(belt);
    // legs and arms pivot at hip / shoulder
    this.legs = [];
    for (const sd of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sd * 0.13, 0.5, 0);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.16), mat(0x3a2236)); l.position.y = -0.25; g.add(l);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.26), mat(0x6b3a2c)); foot.position.set(0, -0.5, 0.05); g.add(foot);
      this.root.add(g); this.legs.push(g);
    }
    this.arms = [];
    for (const sd of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sd * 0.3, 1.36, 0);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.11), mat(0xa02a28)); a.position.y = -0.2; g.add(a);
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0xf0c9a2)); h.position.y = -0.44; g.add(h);
      this.body.add(g); this.arms.push(g);
    }
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    // scarf ribbon
    this.SN = 16; this.sp = []; for (let i = 0; i < this.SN; i++) this.sp.push(new THREE.Vector3(spawn.x, spawn.y + 1.3, spawn.z));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.SN * 2 * 3), 3));
    const c = new Float32Array(this.SN * 2 * 3); const a = col(PAL.turquoise), b2 = col(PAL.goldPale);
    for (let i = 0; i < this.SN; i++) { const t = i / (this.SN - 1); const cc = a.clone().lerp(b2, t * t); for (let k = 0; k < 2; k++) c.set([cc.r, cc.g, cc.b], (i * 2 + k) * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const idx = []; for (let i = 0; i < this.SN - 1; i++) { const q0 = i * 2; idx.push(q0, q0 + 1, q0 + 2, q0 + 1, q0 + 3, q0 + 2); }
    g.setIndex(idx);
    this.scarf = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7, emissive: new THREE.Color(0x103038), emissiveIntensity: 0.3 }));
    this.scarf.frustumCulled = false; this.scarf.castShadow = true; scene.add(this.scarf);
    this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  colorGrad(geo, top, bot) {
    const p = geo.attributes.position; const n = p.count; const arr = new Float32Array(n * 3);
    geo.computeBoundingBox(); const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y;
    for (let i = 0; i < n; i++) { const t = (p.getY(i) - y0) / (y1 - y0); const c = bot.clone().lerp(top, t); arr.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }

  teleport(x, z) { this.pos.set(x, walkH(x, z), z); this.gh = this.pos.y; for (const p of this.sp) p.set(x, this.pos.y + 1.3, z); }

  update(dt, inp, camYaw, t) {
    // sit toggle
    if (inp.sitEdge) { this.sitting = !this.sitting && this.speed < 0.5; }
    if (inp.mag > 0.2 && this.sitting) this.sitting = false;
    this.sit = damp(this.sit, this.sitting ? 1 : 0, 6, dt);

    let target = 0, run = false;
    if (!this.sitting && this.sit < 0.3) { target = inp.mag * (inp.run ? 5.4 : 2.9); run = inp.run; }
    this.speed = damp(this.speed, target, target > this.speed ? 9 : 12, dt);
    if (this.speed > 0.05 && inp.mag > 0.02) {
      // movement relative to camera yaw: camera looks along -z rotated by yaw
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw); const rx = -fz, rz = fx;
      const dx = fx * inp.y + rx * inp.x, dz = fz * inp.y + rz * inp.x;
      const dl = Math.hypot(dx, dz) || 1;
      const wantYaw = Math.atan2(dx / dl, dz / dl);
      this.yaw = dampAngle(this.yaw, wantYaw, 14, dt);
      this.moveDir = [dx / dl, dz / dl];
    }
    if (this.moveDir && this.speed > 0.02) {
      const total = this.speed * dt; const steps = Math.max(1, Math.ceil(total / 0.12)); const sl = total / steps;
      for (let i = 0; i < steps; i++) {
        const mx = this.moveDir[0] * sl, mz = this.moveDir[1] * sl;
        let h = canStand(this.pos.x + mx, this.pos.z + mz, this.gh);
        if (h !== null) { this.pos.x += mx; this.pos.z += mz; this.gh = h; continue; }
        h = canStand(this.pos.x + mx, this.pos.z, this.gh);
        if (h !== null) { this.pos.x += mx; this.gh = h; continue; }
        h = canStand(this.pos.x, this.pos.z + mz, this.gh);
        if (h !== null) { this.pos.z += mz; this.gh = h; continue; }
        this.speed *= 0.6;
      }
    }
    // smooth vertical
    this.pos.y = Math.abs(this.pos.y - this.gh) < 0.01 ? this.gh : damp(this.pos.y, this.gh, 20, dt);
    this.idleT = (this.speed < 0.1) ? this.idleT + dt : 0;

    // animation
    const sp = this.speed; const k = clamp(sp / 5.4, 0, 1);
    this.phase += sp * dt * (run ? 2.0 : 2.5);
    const sw = Math.sin(this.phase * 2.0);
    const walkAmt = clamp(sp / 2.5, 0, 1);
    const swing = sw * (0.55 + 0.45 * k) * walkAmt;
    const sitK = this.sit;
    this.legs[0].rotation.x = lerp(swing, -1.45, sitK); this.legs[1].rotation.x = lerp(-swing, -1.45, sitK);
    this.legs[0].rotation.z = lerp(0, -0.18, sitK); this.legs[1].rotation.z = lerp(0, 0.18, sitK);
    this.arms[0].rotation.x = lerp(-swing * 0.8, -0.7, sitK); this.arms[1].rotation.x = lerp(swing * 0.8, -0.7, sitK);
    const bob = Math.abs(Math.cos(this.phase * 2.0)) * 0.06 * walkAmt * (1 + k * 0.6);
    const breathe = Math.sin(t * 1.8) * 0.012 * (1 - walkAmt);
    this.body.position.y = bob - 0.36 * sitK + breathe + 0.5 * 0; this.legs.forEach((l) => (l.position.y = 0.5 - 0.31 * sitK + bob * 0.2));
    this.body.rotation.x = 0.07 * k + 0.12 * k * k - 0.05 * sitK;
    this.head.rotation.x = sitK * 0.1; this.head.rotation.z = Math.sin(t * 0.9) * 0.02;
    this.hat.rotation.z = Math.sin(this.phase * 2.0) * 0.03 * walkAmt;
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    // footsteps
    const s = Math.sin(this.phase * 2.0 + 0.2);
    if (walkAmt > 0.3 && Math.sign(s) !== Math.sign(this.lastSin) && this.onStep) this.onStep(groundType(this.pos.x, this.pos.z, this.pos.y), run);
    this.lastSin = s;
    this.updateScarf(dt, t);
  }

  updateScarf(dt, t) {
    this.root.updateMatrixWorld(true);
    const neck = this._v.set(0, 1.36 - 0.36 * this.sit, -0.14).applyMatrix4(this.body.matrixWorld.clone().multiply(new THREE.Matrix4().identity()));
    this.sp[0].copy(neck);
    const seg = 0.12; const back = this._s.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(-1);
    for (let i = 1; i < this.SN; i++) {
      const p = this.sp[i], pr = this.sp[i - 1];
      const f = i / this.SN;
      p.y -= (0.7 + f * 0.8) * dt * (1 - 0.5 * this.sit);
      p.x += (U.wind.value.x * 0.5 + Math.sin(t * 3 + i * 0.7) * 0.25 * f) * dt;
      p.z += (U.wind.value.y * 0.5 + Math.cos(t * 2.6 + i * 0.6) * 0.2 * f) * dt;
      // trail behind facing direction softly
      p.x += back.x * 0.0;
      const d = p.clone().sub(pr); let l = d.length() || 1e-4; d.multiplyScalar(seg / l); p.copy(pr).add(d);
      // keep above ground
      if (p.y < this.pos.y + 0.05) p.y = this.pos.y + 0.05;
    }
    const pos = this.scarf.geometry.attributes.position; const side = new THREE.Vector3(), dir = new THREE.Vector3();
    for (let i = 0; i < this.SN; i++) {
      const a = this.sp[Math.max(0, i - 1)], b = this.sp[Math.min(this.SN - 1, i + 1)];
      dir.copy(b).sub(a).normalize(); side.set(0, 1, 0).cross(dir); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
      const w = lerp(0.075, 0.035, i / this.SN) * (1 + Math.sin(t * 5 + i) * 0.1);
      pos.setXYZ(i * 2, this.sp[i].x + side.x * w, this.sp[i].y + side.y * w, this.sp[i].z + side.z * w);
      pos.setXYZ(i * 2 + 1, this.sp[i].x - side.x * w, this.sp[i].y - side.y * w, this.sp[i].z - side.z * w);
    }
    pos.needsUpdate = true; this.scarf.geometry.computeVertexNormals();
  }
}
