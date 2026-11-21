// Floating on-screen joystick and hold/tap buttons that work everywhere:
// native touch events on phones (most reliable in mobile browsers and in-app
// web views), pointer events for mouse and pen. A finger that lands before
// play starts (during a countdown) is still tracked, so steering works the
// moment the game unlocks.

const HAS_TOUCH = typeof window !== 'undefined' && 'ontouchstart' in window;

export class TouchStick {
  /** zone: touch area; base: the ring that jumps under the thumb; knob: the moving dot. */
  constructor(zone, base, knob, onUse) {
    this.zone = zone; this.base = base; this.knob = knob; this.onUse = onUse;
    this.active = false; this.id = null; this.x = 0; this.y = 0; this.ox = 0; this.oy = 0;
    if (HAS_TOUCH) {
      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.active) return;
        const t = e.changedTouches[0];
        this._start('t' + t.identifier, t.clientX, t.clientY);
      }, { passive: false });
      zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) if ('t' + t.identifier === this.id) this._move(t.clientX, t.clientY);
      }, { passive: false });
      const end = (e) => { for (const t of e.changedTouches) if ('t' + t.identifier === this.id) this.release(); };
      zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    }
    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && HAS_TOUCH) return;          // handled by touch events
      if (this.active) return;
      e.preventDefault();
      try { zone.setPointerCapture(e.pointerId); } catch (_) {}
      this._start('p' + e.pointerId, e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => { if (this.id === 'p' + e.pointerId) { e.preventDefault(); this._move(e.clientX, e.clientY); } });
    const pend = (e) => { if (this.id === 'p' + e.pointerId) this.release(); };
    zone.addEventListener('pointerup', pend); zone.addEventListener('pointercancel', pend);
  }
  _start(id, cx, cy) {
    const r = this.zone.getBoundingClientRect();
    this.active = true; this.id = id; this.ox = cx; this.oy = cy; this.x = this.y = 0;
    this.radius = Math.max(24, this.base.offsetWidth * 0.5);
    this.base.style.left = (cx - r.left) + 'px'; this.base.style.top = (cy - r.top) + 'px';
    this.base.classList.add('active');
    this.knob.style.transform = '';
    if (this.onUse) this.onUse();
  }
  _move(cx, cy) {
    let dx = cx - this.ox, dy = cy - this.oy;
    const d = Math.hypot(dx, dy), max = this.radius;
    if (d > max) {
      // drag past the rim: the ring follows the thumb, so you never "run out" of stick
      const k = (d - max) / d;
      this.ox += dx * k; this.oy += dy * k;
      const r = this.zone.getBoundingClientRect();
      this.base.style.left = (this.ox - r.left) + 'px'; this.base.style.top = (this.oy - r.top) + 'px';
      dx = cx - this.ox; dy = cy - this.oy;
    }
    this.x = dx / max; this.y = dy / max;
    this.knob.style.transform = `translate(${dx * 0.62}px, ${dy * 0.62}px)`;
  }
  release() {
    this.active = false; this.id = null; this.x = this.y = 0;
    this.knob.style.transform = '';
    this.base.classList.remove('active');
  }
}

/** A button that reports press (down) and release (up), via touch or pointer. */
export function bindButton(btn, down, up) {
  let id = null;
  const press = (key, e) => { e.preventDefault(); e.stopPropagation(); if (id !== null) return; id = key; btn.classList.add('pressed'); down(); };
  const lift = (key) => { if (id !== key) return; id = null; btn.classList.remove('pressed'); if (up) up(); };
  if (HAS_TOUCH) {
    btn.addEventListener('touchstart', (e) => press('t' + e.changedTouches[0].identifier, e), { passive: false });
    const end = (e) => { for (const t of e.changedTouches) lift('t' + t.identifier); };
    btn.addEventListener('touchend', end); btn.addEventListener('touchcancel', end);
  }
  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && HAS_TOUCH) return;
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    press('p' + e.pointerId, e);
  });
  const pl = (e) => lift('p' + e.pointerId);
  btn.addEventListener('pointerup', pl); btn.addEventListener('pointercancel', pl);
}
