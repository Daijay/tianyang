import { isTouchDevice } from './util.js';

export function createUI({ onQuality, onMute, onHide, quality }) {
  const $ = (id) => document.getElementById(id);
  const panel = $('panel'), hud = $('hud'), ghost = $('ghost'), seg = $('qseg'), hide = $('hideui'), mute = $('mute');
  if (isTouchDevice()) document.body.classList.add('touch');
  const setQ = (q) => { seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.q === q)); };
  setQ(quality);
  seg.addEventListener('click', (e) => { const q = e.target.dataset && e.target.dataset.q; if (q) { setQ(q); onQuality(q); } });
  $('cog').addEventListener('click', () => panel.classList.toggle('open'));
  let muted = false;
  mute.addEventListener('click', () => { muted = !muted; $('wave1').style.display = $('wave2').style.display = muted ? 'none' : ''; mute.style.opacity = muted ? 0.6 : 1; onMute(muted); });
  const setHidden = (h) => { hud.classList.toggle('hidden', h); ghost.classList.toggle('show', h); panel.classList.remove('open'); document.body.classList.toggle('hiddenui', h); hide.classList.toggle('on', h); onHide(h); };
  hide.addEventListener('click', () => setHidden(!hud.classList.contains('hidden')));
  ghost.addEventListener('click', () => setHidden(false));
  const hint = $('hint');
  return {
    setQ,
    toggleMute: () => mute.click(),
    showHint(text, ms = 5000) { hint.textContent = text; hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), ms); },
    ready(touch) { $('sub').textContent = touch ? 'tap to begin' : 'tap or press any key to begin'; },
  };
}
