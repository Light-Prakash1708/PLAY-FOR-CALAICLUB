// Shrinking safe zone. Holds, then shrinks toward a randomly placed smaller
// circle that always sits inside the current one. Outside it, aircraft burn.
import { ZONE_PHASES } from './battleData.js';
import { rand, TAU, lerp } from '../core/utils.js';

const ease = (t) => t * t * (3 - 2 * t);

export class Zone {
  reset() {
    const p0 = ZONE_PHASES[0];
    this.cx = 0; this.cy = 0; this.r = p0.r;
    this.phase = 0;
    this.state = 'hold';
    this.t = p0.hold;
    this.from = null;
    this.collapsing = false;
    this.events = [];              // 'shrinking' | 'final' | 'collapse' (read by the world each frame)
    this._pickNext();
  }
  _pickNext() {
    const nxt = ZONE_PHASES[this.phase + 1];
    if (!nxt) { this.next = null; return; }
    const room = (this.r - nxt.r) * 0.65, a = rand(TAU), d = rand(0.25, 1) * room;
    this.next = { cx: this.cx + Math.cos(a) * d, cy: this.cy + Math.sin(a) * d, r: nxt.r };
  }
  get dps() { return ZONE_PHASES[Math.min(this.phase, ZONE_PHASES.length - 1)].dps * (this.collapsing ? 1.6 : 1); }
  get shrinking() { return this.state === 'shrink'; }
  /** Seconds until the zone next starts to move (0 while shrinking, -1 when final). */
  get countdown() { return this.state === 'hold' && this.next ? this.t : this.state === 'shrink' ? 0 : -1; }

  update(dt) {
    this.t -= dt;
    if (this.state === 'hold') {
      if (this.next && this.t <= 0) {
        this.state = 'shrink';
        this.dur = this.t = this.collapsing ? this.collapseDur : ZONE_PHASES[this.phase].shrink;
        this.from = { cx: this.cx, cy: this.cy, r: this.r };
        this.events.push('shrinking');
      }
    } else if (this.state === 'shrink') {
      const k = ease(1 - Math.max(0, this.t) / this.dur);
      this.cx = lerp(this.from.cx, this.next.cx, k);
      this.cy = lerp(this.from.cy, this.next.cy, k);
      this.r = lerp(this.from.r, this.next.r, k);
      if (this.t <= 0) {
        if (!this.collapsing) this.phase = Math.min(this.phase + 1, ZONE_PHASES.length - 1);
        this.state = 'hold';
        this.t = ZONE_PHASES[this.phase].hold;
        if (this.collapsing) { this.next = null; this.state = 'final'; }
        else { this._pickNext(); if (!this.next) { this.state = 'final'; this.events.push('final'); } }
      }
    }
  }
  /** Sudden death: the zone crushes down to a tiny ring over `dur` seconds. */
  collapse(dur) {
    this.collapsing = true;
    this.collapseDur = dur;
    this.next = { cx: this.cx, cy: this.cy, r: 110 };
    this.state = 'hold'; this.t = 0.01;
    this.events.push('collapse');
  }
  inside(x, y, margin = 0) { const dx = x - this.cx, dy = y - this.cy, r = this.r - margin; return dx * dx + dy * dy < r * r; }
  distOut(x, y) { return Math.hypot(x - this.cx, y - this.cy) - this.r; }
}
