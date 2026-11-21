// Unified keyboard / touch / mouse input. Gameplay code only reads the
// abstract state (move vector, fire flag, one-shot presses). Keyboard keys
// come from the player's bindings (Settings > Controls).
import { clamp } from '../core/utils.js';
import { defaultKeys, keyMap } from './Keybinds.js';
import { TouchStick, bindButton } from './TouchStick.js';

export class InputManager {
  constructor() {
    this.mx = 0; this.my = 0;         // steering vector, magnitude 0..1
    this.fire = false;
    this._missile = false; this._special = false; this._pause = false; this._flare = false; this._boost = false; this._shield = false; this._view = false;
    this.held = new Set();            // bound actions currently held (up/down/left/right/fire...)
    this.codes = new Set();           // raw key codes held during play
    this.sensitivity = 1;
    this.usedTouch = false;
    this.fireHeld = false;
    this.enabled = false;             // true only while a mission is running
    this.capture = null;              // Settings > Controls: next key press goes here instead
    this.setKeys(defaultKeys());
    this._bindKeyboard();
  }
  /** Rebuilds the code -> action table from the player's bindings. */
  setKeys(keys) { this.keys = keys; this.map = keyMap(keys); }
  get joy() { return this.stick ? this.stick : { active: false, x: 0, y: 0 }; }

  consumeMissile() { const v = this._missile; this._missile = false; return v; }
  consumeSpecial() { const v = this._special; this._special = false; return v; }
  consumeBoost() { const v = this._boost; this._boost = false; return v; }
  consumeFlare() { const v = this._flare; this._flare = false; return v; }
  consumeShield() { const v = this._shield; this._shield = false; return v; }
  consumeView() { const v = this._view; this._view = false; return v; }
  consumePause() { const v = this._pause; this._pause = false; return v; }

  reset() {
    this.held.clear(); this.codes.clear();
    this.fireHeld = false; this.fire = false;
    this._missile = this._special = this._pause = this._flare = this._boost = this._shield = this._view = false;
    if (this.stick) this.stick.release();
    this.mx = this.my = 0;
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); e.stopPropagation(); const fn = this.capture; this.capture = null; fn(e.code); return; }
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
        if (e.code === 'Escape' && !e.repeat) { this._pause = true; e.target.blur(); }   // Esc still closes the dialog
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) this._pause = true; e.preventDefault(); return; }
      if (!this.enabled) return;
      this.codes.add(e.code);
      const a = this.map[e.code];
      if (!a) return;
      e.preventDefault();
      this.held.add(a);
      if (e.repeat) return;
      if (a === 'missile') this._missile = true;
      else if (a === 'boost') this._boost = true;
      else if (a === 'special') this._special = true;
      else if (a === 'flare') this._flare = true;
      else if (a === 'shield') this._shield = true;
      else if (a === 'view') this._view = true;
    }, true);
    window.addEventListener('keyup', (e) => {
      this.codes.delete(e.code);
      const a = this.map[e.code];
      if (!a) return;
      // another key bound to the same action may still be down
      if (!this.keys[a].some((c) => c && c !== e.code && this.codes.has(c))) this.held.delete(a);
    });
    window.addEventListener('blur', () => this.reset());
  }

  /** Wires the campaign's on-screen joystick and action buttons. */
  bindControls(el) {
    this.el = el;
    this.stick = new TouchStick(el.zone, el.base, el.knob, () => { this.usedTouch = true; });
    const on = (fn) => () => { if (this.enabled) { this.usedTouch = true; fn(); } };
    bindButton(el.fire, on(() => { this.fireHeld = true; }), () => { this.fireHeld = false; });
    bindButton(el.missile, on(() => { this._missile = true; }));
    bindButton(el.special, on(() => { this._special = true; }));
    bindButton(el.flare, on(() => { this._flare = true; }));
    bindButton(el.boost, on(() => { this._boost = true; }));
  }

  /** Called once per frame before the player update. */
  poll() {
    let x = 0, y = 0;
    const k = this.held;
    if (k.has('left')) x -= 1;
    if (k.has('right')) x += 1;
    if (k.has('up')) y -= 1;
    if (k.has('down')) y += 1;
    if (x || y) { const m = Math.hypot(x, y); x /= m; y /= m; }
    else if (this.stick && this.stick.active && this.enabled) {
      // sensitivity shrinks the travel needed for full deflection
      const s = this.sensitivity;
      x = clamp(this.stick.x * s, -1, 1); y = clamp(this.stick.y * s, -1, 1);
      const m = Math.hypot(x, y);
      if (m < 0.14) { x = 0; y = 0; } else if (m > 1) { x /= m; y /= m; }
    }
    this.mx = x; this.my = y;
    this.fire = this.fireHeld || k.has('fire');
  }
}
