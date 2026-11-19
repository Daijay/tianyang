import * as THREE from 'three';
import { PAL } from './config.js';
import { U } from './shared.js';
import { rng, damp, dampAngle, angDiff, clamp, lerp, col } from './util.js';
import { canStand, walkH, PYR } from './world.js';

const M = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.8, flatShading: true, ...o });
const GLOW = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
function mesh(g, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; }

class Wanderer {
  constructor(group, home, radius, speed) {
    this.g = group; this.home = home; this.radius = radius; this.speed = speed;
    this.pos = new THREE.Vector3(home[0], walkH(home[0], home[1]), home[1]); this.gh = this.pos.y;
    this.yaw = Math.random() * 6.28; this.tx = home[0]; this.tz = home[1]; this.wait = Math.random() * 3; this.moving = false; this.cur = 0;
    this.phase = Math.random() * 10;
  }
  step(dt, player, avoidPlayer = false) {
    const dpx = player.pos.x - this.pos.x, dpz = player.pos.z - this.pos.z, dp = Math.hypot(dpx, dpz);
    this.dp = dp; this.toPlayer = Math.atan2(dpx, dpz);
    this.wait -= dt;
    if (!this.moving && this.wait <= 0) {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * 6.28, d = 2 + Math.random() * this.radius;
        const x = this.home[0] + Math.cos(a) * d, z = this.home[1] + Math.sin(a) * d;
        const h = walkH(x, z); if (h > -50 && Math.abs(h - this.gh) < 0.7) { this.tx = x; this.tz = z; this.moving = true; break; }
      }
      this.wait = 2 + Math.random() * 4;
    }
    let target = 0;
    if (this.moving) {
      const dx = this.tx - this.pos.x, dz = this.tz - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4) { this.moving = false; this.wait = 2 + Math.random() * 5; }
      else { this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 3, dt); target = this.speed; }
    }
    if (avoidPlayer && dp < 5 && dp > 0.01) { this.yaw = dampAngle(this.yaw, Math.atan2(-dpx, -dpz), 3, dt); target = this.speed * 2.2; this.moving = true; this.tx = this.pos.x - dpx; this.tz = this.pos.z - dpz; }
    this.cur = damp(this.cur, target, 4, dt);
    if (this.cur > 0.02) {
      const nx = this.pos.x + Math.sin(this.yaw) * this.cur * dt, nz = this.pos.z + Math.cos(this.yaw) * this.cur * dt;
      const h = canStand(nx, nz, this.gh, 0.5, 0.7, 1.0);
      if (h !== null) { this.pos.x = nx; this.pos.z = nz; this.gh = h; } else { this.moving = false; this.wait = 0.5; }
    }
    this.pos.y = damp(this.pos.y, this.gh, 12, dt);
    this.phase += this.cur * dt * 3.2;
    this.g.position.copy(this.pos); this.g.rotation.y = this.yaw;
  }
}

// ----------------------------------------------------------------------------------------------
function makeQilin() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const ivory = M(0xfff0dc), jade = M(PAL.jade), turq = M(PAL.turquoise), gold = M(PAL.gold, { metalness: 0.6, roughness: 0.4 });
  body.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 1.05), ivory, 0, 0.78, 0));
  body.add(mesh(new THREE.BoxGeometry(0.46, 0.18, 0.95), M(0xf2c999), 0, 0.58, 0));
  const neck = mesh(new THREE.BoxGeometry(0.26, 0.55, 0.28), ivory, 0, 1.15, 0.5); neck.rotation.x = 0.45; body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.42, 0.68); body.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.3, 0.28, 0.4), ivory, 0, 0, 0.1));
  head.add(mesh(new THREE.BoxGeometry(0.2, 0.17, 0.2), M(0xf6d7b4), 0, -0.07, 0.33));
  head.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), M(0x2a1830), 0.1, 0.05, 0.28)); head.children[head.children.length - 1].castShadow = false;
  head.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), M(0x2a1830), -0.1, 0.05, 0.28));
  for (const sd of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), ivory, sd * 0.14, 0.2, -0.02); ear.rotation.z = -sd * 0.5; head.add(ear);
    const horn = mesh(new THREE.ConeGeometry(0.045, 0.5, 5), gold, sd * 0.07, 0.38, 0.0); horn.rotation.x = -0.5; horn.rotation.z = -sd * 0.2; head.add(horn);
    const horn2 = mesh(new THREE.ConeGeometry(0.03, 0.22, 5), gold, sd * 0.07, 0.62, -0.18); horn2.rotation.x = -1.0; head.add(horn2);
  }
  const mark = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), GLOW(3.2, 2.0, 0.8)); mark.position.set(0, 0.12, 0.31); head.add(mark);
  // mane flames
  for (let i = 0; i < 6; i++) { const c = mesh(new THREE.ConeGeometry(0.09, 0.32, 4), i % 2 ? turq : jade, 0, 1.34 - i * 0.08 + 0.12, 0.34 - i * 0.14 + 0.35); c.rotation.x = -0.9 - i * 0.12; body.add(c); }
  // tail
  const tail = new THREE.Group(); tail.position.set(0, 0.95, -0.52); body.add(tail);
  for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry(0.09, 0.45, 4), i === 1 ? gold : jade, (i - 1) * 0.08, -0.1, -0.1); c.rotation.x = 2.2 + i * 0.1; c.rotation.z = (i - 1) * 0.5; tail.add(c); }
  // legs
  const legs = [];
  for (const [x, z] of [[-0.18, 0.38], [0.18, 0.38], [-0.18, -0.38], [0.18, -0.38]]) {
    const lg = new THREE.Group(); lg.position.set(x, 0.55, z); lg.add(mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), ivory, 0, -0.27, 0)); lg.add(mesh(new THREE.BoxGeometry(0.14, 0.07, 0.16), gold, 0, -0.55, 0.01)); body.add(lg); legs.push(lg);
  }
  g.userData = { body, head, tail, legs };
  g.scale.setScalar(1.25);
  return g;
}

function makeTurtle() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const stone = M(0xd8c7ad), dark = M(0xb09c84), gold = M(PAL.gold, { metalness: 0.6, roughness: 0.4 }), moss = M(0x6aa05a);
  const shell = mesh(new THREE.SphereGeometry(0.85, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 0.35, 0); shell.scale.set(1, 0.7, 1.2); body.add(shell);
  body.add(mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.3, 9), dark, 0, 0.18, 0)).scale.set(1, 1, 1.2);
  for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 - i * 0.22, 0.03, 4, 12), gold.clone()); r.rotation.x = Math.PI / 2; r.position.y = 0.55 + i * 0.12 + 0.12; r.scale.set(1, 1.2, 1); body.add(r); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const b = mesh(new THREE.BoxGeometry(0.16, 0.14, 0.05), i % 2 ? M(PAL.turquoise) : gold, Math.cos(a) * 0.72, 0.5, Math.sin(a) * 0.9); b.rotation.y = -a + Math.PI / 2; b.rotation.x = -0.4; body.add(b); }
  body.add(mesh(new THREE.SphereGeometry(0.28, 6, 4), moss, -0.25, 0.72, -0.2)).scale.set(1, 0.4, 1);
  const head = new THREE.Group(); head.position.set(0, 0.3, 1.05); body.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.26, 0.22, 0.38), stone, 0, 0.0, 0.1));
  for (const sd of [-1, 1]) head.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), M(0x2a1830), sd * 0.1, 0.06, 0.28));
  const legs = [];
  for (const [x, z] of [[-0.55, 0.6], [0.55, 0.6], [-0.55, -0.6], [0.55, -0.6]]) { const l = new THREE.Group(); l.position.set(x, 0.25, z); l.add(mesh(new THREE.BoxGeometry(0.25, 0.3, 0.3), dark, 0, -0.1, 0)); body.add(l); legs.push(l); }
  g.userData = { body, head, legs }; g.scale.setScalar(1.0);
  return g;
}

function makeFox() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const orange = M(0xf08a3a), white = M(0xfff4e6), dark = M(0x3a2236);
  body.add(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.72), orange, 0, 0.42, 0));
  body.add(mesh(new THREE.BoxGeometry(0.22, 0.16, 0.42), white, 0, 0.3, 0.05));
  const head = new THREE.Group(); head.position.set(0, 0.62, 0.42); body.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), orange, 0, 0, 0.04));
  head.add(mesh(new THREE.ConeGeometry(0.1, 0.24, 4), white, 0, -0.03, 0.26)).rotation.x = Math.PI / 2;
  head.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), dark, 0, 0.0, 0.38));
  for (const sd of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.075, 0.24, 4), orange, sd * 0.1, 0.2, 0); ear.rotation.z = -sd * 0.2; head.add(ear); head.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), dark, sd * 0.08, 0.04, 0.17)); }
  // three tails
  const tails = new THREE.Group(); tails.position.set(0, 0.46, -0.38); body.add(tails);
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Group(); t.rotation.set(-0.9 + i * 0.05, (i - 1) * 0.55, 0);
    t.add(mesh(new THREE.ConeGeometry(0.13, 0.7, 5), orange, 0, 0.32, 0)); const tip = mesh(new THREE.ConeGeometry(0.075, 0.22, 5), white, 0, 0.72, 0); t.add(tip); tails.add(t);
  }
  const legs = [];
  for (const [x, z] of [[-0.1, 0.24], [0.1, 0.24], [-0.1, -0.24], [0.1, -0.24]]) { const l = new THREE.Group(); l.position.set(x, 0.3, z); l.add(mesh(new THREE.BoxGeometry(0.07, 0.3, 0.07), dark, 0, -0.15, 0)); body.add(l); legs.push(l); }
  // spirit flame
  const flame = new THREE.Group(); flame.position.set(0, 1.25, 0.2); g.add(flame);
  const fm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), GLOW(0.6, 2.8, 3.0)); fm.scale.set(1, 1.3, 1); flame.add(fm);
  const ft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), GLOW(0.5, 2.2, 2.6)); ft.position.y = 0.2; flame.add(ft);
  g.userData = { body, head, legs, tails, flame }; g.scale.setScalar(1.2);
  return g;
}

export class Creatures {
  constructor(scene) {
    this.scene = scene; this.list = [];
    const mk = (maker, home, radius, speed, kind) => { const g = maker(); scene.add(g); const w = new Wanderer(g, home, radius, speed); w.kind = kind; w.ud = g.userData; this.list.push(w); };
    mk(makeQilin, [-44, 14], 9, 1.0, 'qilin');
    mk(makeQilin, [18, 70], 8, 0.9, 'qilin');
    mk(makeTurtle, [17, 17], 5, 0.22, 'turtle');
    mk(makeTurtle, [-60, -40], 6, 0.2, 'turtle');
    mk(makeFox, [24, -22], 10, 1.4, 'fox');
    mk(makeFox, [-24, 52], 8, 1.3, 'fox');
    this.kite = this.makeKite(scene);
    this.glow = [];
  }

  update(dt, t, player) {
    for (const w of this.list) {
      w.step(dt, player, w.kind === 'fox' && false);
      const ud = w.ud; const near = w.dp < 9;
      // glance at player
      let look = 0; if (near) look = clamp(angDiff(w.yaw, w.toPlayer), -1.0, 1.0);
      if (ud.head) { ud.head.rotation.y = damp(ud.head.rotation.y, look, 5, dt); if (w.kind === 'turtle') ud.head.position.z = damp(ud.head.position.z, near ? 1.3 : 1.0, 2, dt); else ud.head.rotation.x = damp(ud.head.rotation.x, near ? -0.12 : 0.05 * Math.sin(t * 0.8), 3, dt); }
      const sw = Math.sin(w.phase * 3.0) * clamp(w.cur / 1.0, 0, 1) * (w.kind === 'turtle' ? 0.35 : 0.7);
      if (ud.legs) { ud.legs[0].rotation.x = sw; ud.legs[3].rotation.x = sw; ud.legs[1].rotation.x = -sw; ud.legs[2].rotation.x = -sw; }
      if (ud.body) ud.body.position.y = Math.abs(Math.sin(w.phase * 3.0)) * 0.05 * clamp(w.cur, 0, 1);
      if (ud.tail) ud.tail.rotation.z = Math.sin(t * 2.0 + w.phase) * 0.25;
      if (ud.tails) ud.tails.children.forEach((c, i) => { c.rotation.z = Math.sin(t * 2.2 + i * 1.3) * 0.18; });
      if (ud.flame) { ud.flame.position.y = 1.25 + Math.sin(t * 2.4 + w.home[0]) * 0.08; ud.flame.rotation.y = t; ud.flame.scale.setScalar(1 + Math.sin(t * 5 + w.home[1]) * 0.08); }
    }
    this.kite.update(t);
  }

  // ---- feathered serpent kite floating in the sky around the pyramid
  makeKite(scene) {
    const N = 30;
    const segGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const bodyMat = M(0xffffff, { roughness: 0.6 });
    const body = new THREE.InstancedMesh(segGeo, bodyMat, N); body.castShadow = true; body.frustumCulled = false;
    const fGeo = new THREE.ConeGeometry(0.22, 1.6, 4); fGeo.translate(0, 0.8, 0);
    const fmat = new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true });
    const feathers = new THREE.InstancedMesh(fGeo, fmat, N * 2); feathers.frustumCulled = false; feathers.castShadow = true;
    const cs = [col(PAL.jade), col(PAL.turquoise), col(PAL.gold), col(PAL.vermilion)];
    for (let i = 0; i < N; i++) { body.setColorAt(i, i === 0 ? col(PAL.gold) : cs[i % 2 === 0 ? 0 : 1].clone().lerp(col(PAL.cream), 0.15)); for (let k = 0; k < 2; k++) feathers.setColorAt(i * 2 + k, cs[(i + k) % 4]); }
    scene.add(body, feathers);
    const head = new THREE.Group();
    head.add(mesh(new THREE.BoxGeometry(1.1, 0.9, 1.6), M(PAL.jade), 0, 0, 0));
    head.add(mesh(new THREE.BoxGeometry(0.8, 0.3, 0.9), M(PAL.gold, { metalness: 0.5 }), 0, -0.1, 1.1));
    for (const sd of [-1, 1]) { head.add(mesh(new THREE.SphereGeometry(0.14, 6, 4), GLOW(3.4, 2.2, 0.8), sd * 0.5, 0.25, 0.5)); const horn = mesh(new THREE.ConeGeometry(0.12, 1.2, 5), M(PAL.gold, { metalness: 0.5 }), sd * 0.35, 0.7, -0.4); horn.rotation.x = -0.9; head.add(horn); }
    for (let i = 0; i < 5; i++) { const c = mesh(new THREE.ConeGeometry(0.16, 1.5 - i * 0.12, 4), [col(PAL.turquoise), col(PAL.jade), col(PAL.gold)].map((c2) => M(c2))[i % 3], 0, 0.8, -0.2 - i * 0.28); c.rotation.x = -0.9; head.add(c); }
    scene.add(head);
    const path = (u) => {
      // looping path around the pyramid, high up
      const a = u * 0.11; const R = 78 + Math.sin(u * 0.05) * 14;
      return new THREE.Vector3(PYR.x + Math.cos(a) * R * 1.15, 46 + Math.sin(u * 0.19) * 9 + Math.sin(u * 0.43) * 2.0, PYR.z + Math.sin(a) * R * 0.85);
    };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), e = new THREE.Euler();
    return {
      update(t) {
        const u0 = t * 1.0 + 20;
        for (let i = 0; i < N; i++) {
          const u = u0 - i * 0.62; const P = path(u); const Pn = path(u + 0.1);
          fwd.copy(Pn).sub(P).normalize();
          q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
          const wob = Math.sin(t * 2.2 - i * 0.5) * 0.9 * Math.min(1, i / 6); p.copy(P); p.x += wob * fwd.z; p.z -= wob * fwd.x; p.y += Math.cos(t * 1.6 - i * 0.45) * 0.5;
          const sc = i === 0 ? 0.01 : lerp(1.15, 0.45, i / N);
          s.setScalar(sc); m.compose(p, q, s); body.setMatrixAt(i, m);
          for (let k = 0; k < 2; k++) {
            const sd = k ? 1 : -1; const fl = Math.sin(t * 3 - i * 0.6) * 0.35;
            tmp.copy(p); e.set(0, 0, 0); const qf = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sd * (1.25 + fl)));
            const qq = q.clone().multiply(qf); s.set(sc * 0.9, sc * 1.0 * (1.2 - i / N * 0.6), sc * 0.9); m.compose(tmp, qq, s); feathers.setMatrixAt(i * 2 + k, m);
          }
          if (i === 0) { head.position.copy(p); head.quaternion.copy(q); }
        }
        body.instanceMatrix.needsUpdate = true; feathers.instanceMatrix.needsUpdate = true;
      },
    };
  }
}

// ----------------------------------------------------------------------------------------------
export function createBirds(q) {
  const MAX = 14; const R = rng(8);
  const g = new THREE.InstancedBufferGeometry();
  const pos = new Float32Array([0, 0, 0.35, -0.12, 0, -0.25, 0.12, 0, -0.25, 0, 0, 0.1, -0.9, 0, -0.1, -0.1, 0, -0.35, 0, 0, 0.1, 0.1, 0, -0.35, 0.9, 0, -0.1]);
  const wing = new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 1]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aWing', new THREE.BufferAttribute(wing, 1));
  const seed = new Float32Array(MAX * 4); for (let i = 0; i < MAX; i++) seed.set([14 + R() * 24, 26 + R() * 24, R() * 6.28, 0.12 + R() * 0.12], i * 4);
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(seed, 4)); g.instanceCount = Math.min(MAX, q.birds);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { uTime: U.time, uC: { value: new THREE.Vector3(PYR.x, 0, PYR.z) } },
    vertexShader: `uniform float uTime; uniform vec3 uC; attribute float aWing; attribute vec4 aB; varying float vL;
      void main(){ float a = uTime * aB.w + aB.z; float r = aB.x + sin(uTime * 0.2 + aB.z) * 3.0;
        vec3 c = vec3(uC.x + cos(a) * r, aB.y + sin(uTime * 0.31 + aB.z * 2.0) * 3.0, uC.z + sin(a) * r);
        vec3 fwd = normalize(vec3(-sin(a), 0.0, cos(a))); vec3 side = vec3(-fwd.z, 0.0, fwd.x);
        vec3 p = position * 2.4; float fl = sin(uTime * 7.0 + aB.z * 9.0); p.y += fl * 0.45 * abs(p.x) * aWing * 1.0;
        float bank = 0.25; vec3 w = c + side * p.x * 1.0 + fwd * p.z + vec3(0.0, p.y + abs(p.x) * bank * 0.3, 0.0);
        vL = 0.65 + 0.35 * aWing; gl_Position = projectionMatrix * viewMatrix * vec4(w * 1.0, 1.0); }`,
    fragmentShader: `varying float vL; void main(){ gl_FragColor = vec4(mix(vec3(0.36, 0.28, 0.5), vec3(1.0, 0.86, 0.7), vL * 0.7), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.scale.setScalar(2.2);
  m.userData.setCount = (n) => { g.instanceCount = Math.min(MAX, n); };
  return m;
}
