// Procedural Web Audio: wind bed, pentatonic pad, wind chimes, water trickle, footsteps. No audio files.
export class AudioSys {
  constructor() { this.ctx = null; this.muted = false; this.started = false; this.lanterns = []; this.waters = []; this.nextChime = 0; this.nextPad = 0; this.padStep = 0; }

  setWorld(lanterns, waters) { this.lanterns = lanterns; this.waters = waters; }

  start() {
    if (this.started) { this.ctx && this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC(); this.started = true;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); this.master.connect(comp); comp.connect(ctx.destination);
    // reverb
    const len = ctx.sampleRate * 3.2; const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; const revG = ctx.createGain(); revG.gain.value = 0.55; this.rev.connect(revG); revG.connect(this.master);
    this.noise = this.makeNoise(ctx);
    // wind bed
    const w = ctx.createBufferSource(); w.buffer = this.noise; w.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.07; w.connect(bp); bp.connect(wg); wg.connect(this.master); w.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.045; lfo.connect(lg); lg.connect(wg.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.045; const lg2 = ctx.createGain(); lg2.gain.value = 260; lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();
    // water trickle bed
    const wt = ctx.createBufferSource(); wt.buffer = this.noise; wt.loop = true; wt.playbackRate.value = 1.3;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.9;
    this.waterG = ctx.createGain(); this.waterG.gain.value = 0; wt.connect(hp); hp.connect(this.waterG); this.waterG.connect(this.master); wt.start();
    const wl = ctx.createOscillator(); wl.frequency.value = 5.3; const wlg = ctx.createGain(); wlg.gain.value = 0.25; wl.connect(wlg); wlg.connect(this.waterG.gain); wl.start();
    this.padOut = ctx.createGain(); this.padOut.gain.value = 0.5; this.padOut.connect(this.master); this.padOut.connect(this.rev);
    this.nextPad = ctx.currentTime + 0.2; this.nextChime = ctx.currentTime + 4;
  }

  makeNoise(ctx) { const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.2 + w * 0.15; } return b; }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1); }

  tone(freq, t, dur, vol, type = 'sine', dest, bell = false) {
    const ctx = this.ctx; const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (bell ? 0.005 : dur * 0.4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.1);
  }

  update(dt, px, pz) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    // nearest lantern & water
    let ld = 1e9; for (const l of this.lanterns) { const d = Math.hypot(l[0] - px, l[2] - pz); if (d < ld) ld = d; }
    let wd = 1e9; for (const w of this.waters) { const dx = Math.max(Math.abs(px - w.cx) - (w.hx ?? w.r), 0), dz = Math.max(Math.abs(pz - w.cz) - (w.hz ?? w.r), 0); const d = Math.hypot(dx, dz); if (d < wd) wd = d; }
    this.waterG.gain.setTargetAtTime(Math.max(0, 1 - wd / 18) * 0.08, t, 0.3);
    // pad: pentatonic chords drifting
    if (t > this.nextPad) {
      const pent = [0, 2, 4, 7, 9]; const root = 146.83; // D3 pentatonic
      const chords = [[0, 2, 4], [1, 3, 5], [0, 3, 4], [2, 4, 6]];
      const ch = chords[this.padStep++ % chords.length];
      for (const n of ch) { const oct = Math.floor(n / 5); const f = root * Math.pow(2, (pent[n % 5] + 12 * oct) / 12); const dur = 9; this.tone(f, t, dur, 0.035, 'triangle', this.padOut); this.tone(f * 1.003, t, dur, 0.02, 'sine', this.padOut); }
      this.nextPad = t + 7.5;
    }
    // chimes near lanterns
    if (t > this.nextChime) {
      const near = Math.max(0, 1 - ld / 24);
      if (near > 0.05) {
        const pent = [0, 2, 4, 7, 9, 12, 14, 16]; const n = pent[Math.floor(Math.random() * pent.length)];
        const f = 587.33 * Math.pow(2, n / 12);
        const vol = 0.05 + near * 0.12; this.tone(f, t, 3.2, vol, 'sine', this.padOut, true); this.tone(f * 2.76, t, 1.4, vol * 0.25, 'sine', this.padOut, true); this.tone(f * 5.4, t, 0.6, vol * 0.1, 'sine', this.padOut, true);
      }
      this.nextChime = t + 1.2 + Math.random() * (near > 0.3 ? 2.2 : 6);
    }
  }

  step(type, run) {
    if (!this.ctx || this.muted) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.9 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    if (type === 'sand') { f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 300; f.Q.value = 0.7; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.025); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); }
    else { f.type = 'bandpass'; f.frequency.value = 2300 + Math.random() * 600; f.Q.value = 1.6; g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      const o = ctx.createOscillator(); o.frequency.value = 180; const og = ctx.createGain(); og.gain.setValueAtTime(0.08, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.06); o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.08); }
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 2, 0.25);
  }
}
