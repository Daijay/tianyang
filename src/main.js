import * as THREE from 'three';
import { QUALITY, SUN_DIR, WORLD } from './config.js';
import { U, state } from './shared.js';
import { installFog } from './fog.js';
import { createMaterials } from './mats.js';
import { createRenderer, Post } from './render.js';
import { createSky } from './sky.js';
import { buildTerrain } from './terrain.js';
import { buildLevel } from './level.js';
import { buildDecor } from './decor.js';
import { makeWaterMaterial, waterGeometry, buildKoi } from './water.js';
import { createPetals, createMotes, createWisps, createShafts } from './particles.js';
import { Creatures, createBirds } from './creatures.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { createInput } from './input.js';
import { AudioSys } from './audio.js';
import { createUI } from './ui.js';
import { L, PYR, walkH } from './world.js';
import { damp, isTouchDevice, clamp } from './util.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const errBox = document.getElementById('err');

function fatal(msg) { errBox.style.display = 'grid'; errBox.textContent = msg; }

async function main() {
  installFog();
  const touch = isTouchDevice();
  state.mobile = touch || Math.min(innerWidth, innerHeight) < 600;
  let qName = params.get('q');
  if (!QUALITY[qName]) {
    if (state.mobile) qName = ((navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 3) ? 'low' : 'medium';
    else qName = 'high';
  }
  state.quality = QUALITY[qName];
  if (params.has('msaa')) state.quality = { ...state.quality, msaa: +params.get('msaa') };
  if (params.has('o')) for (const kv of params.get('o').split(',')) { const [k, v] = kv.split(':'); state.quality = { ...state.quality, [k]: isNaN(+v) ? v === 'true' : +v }; }
  const noAuto = params.has('noauto');

  const renderer = createRenderer(canvas, state.quality);
  if (!renderer.capabilities.isWebGL2) { fatal('TIANYANG needs WebGL2. Please try a newer browser.'); return; }
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xf7a272, 0.0034);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.4, 1800);

  const sky = createSky(renderer, scene, state.quality);

  // ---------------- lights
  const sun = new THREE.DirectionalLight(0xffbe70, 6.2);
  sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.07; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffd9ae, 0x6a6aa8, 0.6); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x7482f0, 0.5); fill.position.set(-0.45, 0.4, 0.9); scene.add(fill);

  const mats = createMaterials();

  // ---------------- world
  const terrain = buildTerrain(state.quality); scene.add(terrain.mesh);
  const lvl = buildLevel(state.quality);
  const levelGroup = lvl.builder.toGroup(mats); scene.add(levelGroup);
  const farGroup = lvl.farBuilder.toGroup(mats, { cast: false, receive: false }); scene.add(farGroup);
  const deco = lvl.deco;
  const decorGroup = buildDecor(deco, mats, state.quality, scene); scene.add(decorGroup);
  const grassMesh = decorGroup.userData.grass; if (grassMesh) grassMesh.count = Math.min(deco.grass.length, state.quality.grass);

  const waterMat = makeWaterMaterial(state.quality);
  for (const w of lvl.waters) { const m = new THREE.Mesh(waterGeometry(w), waterMat); m.renderOrder = 2; m.frustumCulled = false; scene.add(m); }
  const koi = buildKoi(deco, state.quality); if (koi) scene.add(koi);
  const petals = createPetals(state.quality); scene.add(petals);
  const motes = createMotes(state.quality); scene.add(motes);
  const wisps = createWisps(state.quality); scene.add(wisps);
  const shafts = createShafts(lvl.shafts); scene.add(shafts);
  const birds = createBirds(state.quality); scene.add(birds);

  const player = new Player(scene, WORLD.spawn);
  const creatures = new Creatures(scene);
  const rig = new CameraRig(camera);
  rig.baseYaw = 0.5; rig.yaw = 0.5;
  const input = createInput(canvas);
  const audio = new AudioSys();
  audio.setWorld(deco.lanternPts, lvl.waters);
  player.onStep = (type, run) => audio.step(type, run);

  const post = new Post(renderer, scene, camera, sky.sun, state.quality);

  // ---------------- quality + resize
  const mapSize = () => state.quality.shadowMap;
  let shadowSpan = state.quality.shadowSpan;
  function applyShadow() {
    const q = state.quality; shadowSpan = q.shadowSpan;
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    const c = sun.shadow.camera; c.left = -shadowSpan / 2; c.right = shadowSpan / 2; c.top = shadowSpan / 2; c.bottom = -shadowSpan / 2; c.near = 1; c.far = 320; c.updateProjectionMatrix();
  }
  function resize() {
    const dprCap = state.mobile ? Math.min(1.5, state.quality.dpr) : state.quality.dpr;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    post.setSize(innerWidth, innerHeight);
    motes.material.uniforms.uPx.value = dpr;
  }
  function applyQuality(name) {
    state.quality = QUALITY[name]; if (params.has('msaa')) state.quality = { ...state.quality, msaa: +params.get('msaa') }; const q = state.quality;
    applyShadow(); post.applyQuality(q); sky.setClouds(q.clouds);
    petals.userData.setCount(q.petals); motes.userData.setCount(q.motes); wisps.userData.setCount(q.wisps); birds.userData.setCount(q.birds);
    if (koi) koi.userData.setCount(q.koi);
    if (grassMesh) grassMesh.count = Math.min(deco.grass.length, q.grass);
    shafts.visible = q.shafts;
    waterMat.uniforms.uFancy.value = q.fancyWater ? 1 : 0.4;
    resize();
  }
  applyShadow();
  addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  const ui = createUI({
    quality: qName,
    onQuality: (q) => applyQuality(q),
    onMute: (m) => audio.setMuted(m),
    onHide: () => {},
  });

  // ---------------- state
  let started = false; let t = 0; let frozen = false; let manualCam = false;
  const titleEl = document.getElementById('title'), fadeEl = document.getElementById('fade');
  player.teleport(WORLD.spawn.x, WORLD.spawn.z);
  rig.titleT = 0; rig.titleShot(0, rig.pos, rig.look);
  camera.position.copy(rig.pos); camera.lookAt(rig.look);
  ui.ready(touch);

  function begin() {
    if (started) return; started = true;
    audio.start(); titleEl.classList.add('hide');
    rig.startIntro();
    setTimeout(() => ui.showHint(touch ? 'drag to walk  ·  find the golden sun at the summit' : 'WASD / arrows to walk  ·  shift to run  ·  space to rest', 7000), 5000);
  }
  input.onFirst(begin);
  titleEl.addEventListener('click', begin);
  requestAnimationFrame(() => requestAnimationFrame(() => fadeEl.classList.add('out')));

  // ---------------- shadow follow with texel snapping
  const ldir = SUN_DIR.clone(); const lright = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), ldir).normalize(); const lup = new THREE.Vector3().crossVectors(ldir, lright).normalize();
  const tc = new THREE.Vector3();
  function updateSun(focus) {
    const texel = shadowSpan / mapSize();
    const r = focus.dot(lright), u = focus.dot(lup);
    const rs = Math.round(r / texel) * texel, us = Math.round(u / texel) * texel;
    tc.copy(focus).addScaledVector(lright, rs - r).addScaledVector(lup, us - u);
    sun.target.position.copy(tc); sun.position.copy(tc).addScaledVector(SUN_DIR, 150);
    sun.target.updateMatrixWorld();
  }

  // ---------------- main loop
  const frameTimes = []; let slowTimer = 0; let lastT = performance.now();
  const rigFocus = new THREE.Vector3();
  let manualLoop = false; let pending = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (manualLoop) { lastT = now; if (pending > 0) { pending--; tick(1 / 30); } return; }
    tick(Math.max(0, Math.min(0.05, (now - lastT) / 1000))); lastT = now;
  }
  function tick(dt) {
    if (!frozen) { t += dt; U.time.value = t; }
    const inp = input.poll();
    const canPlay = started && rig.mode !== 'intro';
    if (!frozen) {
      player.update(dt, canPlay ? inp : { x: 0, y: 0, mag: 0, run: false, sitEdge: false }, rig.controlYaw, t);
      creatures.update(dt, t, player);
      if (!manualCam) rig.update(dt, t, player, inp);
    }
    // sun + uniforms
    rigFocus.set(player.pos.x, player.pos.y, player.pos.z);
    if (rig.mode === 'title' || rig.revealing) rigFocus.set(camera.position.x * 0.5 + PYR.x * 0.5, 0, camera.position.z * 0.5 + PYR.z * 0.5).lerp(player.pos, 0.0);
    updateSun(rigFocus);
    U.cam.value.copy(camera.position); U.player.value.set(player.pos.x, player.pos.y + 1.2, player.pos.z);
    U.fadeOn.value = (rig.mode === 'title' || rig.revealing) ? 0 : 1;
    const cpos = player.pos;
    petals.material.uniforms.uCenter.value.copy(rig.mode === 'title' || rig.revealing ? camera.position : cpos);
    motes.material.uniforms.uCenter.value.copy(rig.mode === 'title' || rig.revealing ? camera.position : cpos);
    wisps.material.uniforms.uCenter.value.copy(cpos);
    sky.update(camera);
    post.setGodRayStrength(clamp(1.0, 0, 1));
    audio.update(dt, player.pos.x, player.pos.z);
    post.render(dt);

    // adaptive quality (skipped in tests)
    if (started && !noAuto && state.quality.name !== 'low' && !document.hidden) {
      frameTimes.push(dt); if (frameTimes.length > 90) frameTimes.shift();
      slowTimer += dt;
      if (slowTimer > 4 && frameTimes.length >= 60) {
        slowTimer = 0; const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const target = state.mobile ? 1 / 27 : 1 / 45;
        if (avg > target) { const next = state.quality.name === 'high' ? 'medium' : 'low'; ui.setQ(next); applyQuality(next); frameTimes.length = 0; }
      }
    }
  }
  requestAnimationFrame(frame);

  // ---------------- test hooks
  window.__ty = {
    ready: true, params,
    clearOverlays(hideTitle) { fadeEl.style.transition = 'none'; fadeEl.classList.add('out'); if (hideTitle) { titleEl.style.transition = 'none'; titleEl.classList.add('hide'); } },
    step(n = 1) { manualLoop = true; pending = n; },
    idle() { return pending === 0; },
    start() { begin(); rig.mode = 'follow'; rig.introT = 1; },
    freeze(v = true) { frozen = v; },
    time(v) { t = v; U.time.value = v; },
    tp(x, z) { player.teleport(x, z); rig.snapTo(player); },
    follow() { manualCam = false; rig.mode = 'follow'; rig.revealing = false; rig.snapTo(player); },
    cam(px, py, pz, lx, ly, lz, fov = 38) { manualCam = true; camera.fov = fov; camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); camera.updateProjectionMatrix(); },
    reveal() { manualCam = false; rig.mode = 'follow'; rig.revealing = true; rig.revealT = 20; rig.revealShot(20, rig.pos, rig.look); camera.fov = 30; },
    title() { manualCam = false; rig.mode = 'title'; rig.titleT = 30; rig.titleShot(30, rig.pos, rig.look); },
    quality(q) { ui.setQ(q); applyQuality(q); },
    player, rig, camera, renderer, post, scene, state, creatures, sit(v) { player.sitting = v; },
  };
}

main().catch((e) => { console.error(e); fatal('Something went wrong starting TIANYANG: ' + e.message); });
