// Headless screenshot + console-error harness. Usage: node tools/shots.mjs [round] [q=medium] [only=name,name]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const round = process.argv[2] || 'r1';
const Q = (process.argv.find((a) => a.startsWith('q=')) || 'q=medium').slice(2);
const only = (process.argv.find((a) => a.startsWith('only=')) || '').slice(5).split(',').filter(Boolean);
const PORT = 5199;
const out = `shots/${round}`; fs.mkdirSync(out, { recursive: true });

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', shell: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('vite timeout')), 30000); server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); res(); } }); });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle'] });
const errors = [];
async function open(w, h, mobile = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`http://localhost:${PORT}/?q=${Q}&noauto=1&msaa=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ty && window.__ty.ready, null, { timeout: 120000 });
  return page;
}

const shots = {
  title: async (p) => { await p.evaluate(() => { __ty.clearOverlays(false); __ty.title(); }); },
  arrival: async (p) => { await p.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.tp(0, 104); }); },
  blossom: async (p) => { await p.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.tp(0, 68); }); },
  pool: async (p) => { await p.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.tp(-14, 19); }); },
  pyramid: async (p) => { await p.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.tp(0, -24); }); },
  top: async (p) => { await p.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.tp(7, -49); }); },
  reveal: async (p) => { await p.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.tp(0, -48); __ty.reveal(); }); },
};

async function blackFrac(p) {
  return p.evaluate(() => { const c = document.getElementById('view'); const t = document.createElement('canvas'); t.width = 64; t.height = 36; const x = t.getContext('2d'); x.drawImage(c, 0, 0, 64, 36); const d = x.getImageData(0, 0, 64, 36).data; let b = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 6) b++; return b / (64 * 36); });
}
async function grab(p, path) {
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => { __ty.step(2); });
    await p.waitForFunction(() => __ty.idle(), null, { timeout: 120000 });
    await p.evaluate(() => __ty.renderer.getContext().finish()); await p.waitForTimeout(1200);
    if ((await blackFrac(p)) < 0.03) break;
    console.log('retry (partial frame)');
  }
  await p.screenshot({ path });
}
let page = await open(1280, 720);
for (const [name, fn] of Object.entries(shots)) {
  if (only.length && !only.includes(name)) continue;
  await fn(page);
  await page.evaluate(() => { __ty.time(12); __ty.step(5); });
  await page.waitForFunction(() => __ty.idle(), null, { timeout: 120000 });
  await page.evaluate(() => __ty.renderer.getContext().finish()); await page.waitForTimeout(800);
  await grab(page, `${out}/${name}.png`);
  console.log('shot', name);
}
if (!only.length || only.includes('mobile')) {
  const mp = await open(390, 844, true);
  await mp.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.tp(0, 104); });
  await mp.evaluate(() => { __ty.step(5); });
  await mp.waitForFunction(() => __ty.idle(), null, { timeout: 120000 }); await mp.waitForTimeout(300);
  await grab(mp, `${out}/mobile.png`);
  console.log('shot mobile');
}
fs.writeFileSync(`${out}/console.txt`, errors.join('\n'));
console.log('console messages:', errors.length); errors.slice(0, 25).forEach((e) => console.log(e));
await browser.close(); server.kill();
process.exit(0);
