// Keyboard, gamepad and touch joystick unified into one poll().
export function createInput(canvas) {
  const keys = new Set();
  const st = { x: 0, y: 0, mag: 0, run: false, sitEdge: false, any: false, touch: false };
  let first = null; let sitQueued = false;
  const stick = document.getElementById('stick'); const knob = stick.querySelector('i');
  const sitBtn = document.getElementById('sit');
  let touchId = null, ox = 0, oy = 0, tx = 0, ty = 0;
  const R = 56;

  const fire = () => { if (first) { const f = first; first = null; f(); } };
  addEventListener('keydown', (e) => {
    if (e.repeat) return; keys.add(e.code); st.any = true;
    if (e.code === 'Space') { sitQueued = true; e.preventDefault(); }
    fire();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const isUi = (t) => t.closest && t.closest('#hud, #panel, #ghost, #sit');
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      st.touch = true; document.body.classList.add('touch');
      fire();
      if (isUi(e.target)) return;
      if (touchId === null && e.clientX < innerWidth * 0.62) {
        touchId = e.pointerId; ox = tx = e.clientX; oy = ty = e.clientY;
        stick.style.display = 'block'; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; knob.style.transform = 'translate(0,0)';
      }
    } else if (!isUi(e.target)) fire();
  });
  addEventListener('pointermove', (e) => { if (e.pointerId === touchId) { tx = e.clientX; ty = e.clientY; const dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy); const k = d > R ? R / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; } });
  const end = (e) => { if (e.pointerId === touchId) { touchId = null; stick.style.display = 'none'; } };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  sitBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); sitQueued = true; st.any = true; fire(); });

  let padA = false;
  return {
    state: st,
    onFirst(cb) { first = cb; },
    poll() {
      let x = 0, y = 0, run = false;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      let mag = Math.hypot(x, y); if (mag > 0) { x /= mag; y /= mag; mag = 1; }
      // gamepad
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p) continue;
        let gx = p.axes[0] || 0, gy = -(p.axes[1] || 0); const gm = Math.hypot(gx, gy);
        if (gm > 0.18) { const m = Math.min(1, (gm - 0.18) / 0.8); x = gx / gm; y = gy / gm; mag = m; run = run || m > 0.88; st.any = true; fire(); }
        const a = p.buttons[0] && p.buttons[0].pressed; if (a && !padA) { sitQueued = true; st.any = true; fire(); } padA = !!a;
        if (p.buttons[1] && p.buttons[1].pressed || p.buttons[7] && p.buttons[7].pressed) run = true;
        break;
      }
      // touch
      if (touchId !== null) {
        const dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy);
        if (d > 6) { const m = Math.min(1, (d - 6) / (R - 6)); x = dx / d; y = -dy / d; mag = m; run = m > 0.9; }
      }
      st.x = x; st.y = y; st.mag = mag; st.run = run;
      st.sitEdge = sitQueued; sitQueued = false;
      return st;
    },
  };
}
