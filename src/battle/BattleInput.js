// Player command for Team Battle: the player's key bindings plus the
// on-screen stick and buttons. Fire mode (auto / hold / toggle) comes from
// Settings > Controls.
import { clamp } from '../core/utils.js';
import { TouchStick, bindButton } from '../systems/TouchStick.js';

export class BattleInput {
  constructor(input) {
    this.input = input;           // shared InputManager (bound keys, pause, enabled flag)
    this.set = null;
    this.enabled = false;
    this.fireMode = 'auto';
    this.toggled = false;
    this.cmd = { steer: false, angle: 0, throttle: 0.5, fire: false, manualFire: false, missile: false, boost: false, flare: false, shield: false };
  }
  /** els: { zone, base, knob, fire, missile, boost, flare, shield } */
  bindTouch(els) {
    const set = this.set = { fire: false, _missile: false, _boost: false, _flare: false, _shield: false };
    set.stick = new TouchStick(els.zone, els.base, els.knob, () => { this.input.usedTouch = true; });
    bindButton(els.fire, () => {
      if (!this.enabled) return;
      if (this.fireMode === 'toggle') this.toggled = !this.toggled; else set.fire = true;
    }, () => { set.fire = false; });
    for (const k of ['missile', 'boost', 'flare', 'shield']) bindButton(els[k], () => { if (this.enabled) set['_' + k] = true; });
  }
  setEnabled(on) {
    this.enabled = on;
    if (!on && this.set) { this.set.fire = false; this.toggled = false; }
  }
  reset() {
    this.toggled = false;
    if (this.set) { this.set.stick.release(); this.set.fire = false; this.set._missile = this.set._boost = this.set._flare = this.set._shield = false; }
    this.input.reset();
  }

  read() {
    const inp = this.input, held = inp.held, cmd = this.cmd, set = this.set;
    let x = 0, y = 0;
    if (held.has('left')) x -= 1;
    if (held.has('right')) x += 1;
    if (held.has('up')) y -= 1;
    if (held.has('down')) y += 1;
    if (!x && !y && set && set.stick.active) {
      const s = inp.sensitivity || 1;
      x = clamp(set.stick.x * s, -1, 1); y = clamp(set.stick.y * s, -1, 1);
    }
    let m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; m = 1; }
    cmd.mx = x; cmd.my = y;
    if (m < 0.12) { cmd.steer = false; cmd.throttle = 0.5; }
    else { cmd.steer = true; cmd.angle = Math.atan2(y, x); cmd.throttle = Math.max(0.55, m); }
    // fire: keyboard toggle is edge-triggered through the one-shot below
    const keyFire = held.has('fire');
    if (this.fireMode === 'toggle') {
      if (keyFire && !this._kf) this.toggled = !this.toggled;
      this._kf = keyFire;
      cmd.manualFire = this.toggled;
    } else cmd.manualFire = keyFire || !!(set && set.fire);
    cmd.fire = cmd.manualFire;
    cmd.missile = inp.consumeMissile() || !!(set && set._missile);
    cmd.boost = inp.consumeBoost() || !!(set && set._boost);
    cmd.flare = inp.consumeFlare() || !!(set && set._flare);
    cmd.shield = inp.consumeShield() || !!(set && set._shield);
    cmd.view = inp.consumeView();
    if (set) set._missile = set._boost = set._flare = set._shield = false;
    return cmd;
  }
}
