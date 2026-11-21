// Pooled particle system plus screen effects (shake, flash) and floating text.
import { ObjectPool } from './ObjectPool.js';
import { TAU, rand } from '../core/utils.js';

const FIRE = 0, SMOKE = 1, SPARK = 2, DEBRIS = 3, RING = 4, BIT = 5;
const FIRE_RAMP = ['#FFFFFF', '#FFF3B0', '#FFD25A', '#FF9A3D', '#F0612D', '#B5402A', '#6B3A33'];

export class VFXManager {
  constructor() {
    this.particles = new ObjectPool(() => ({ type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, grow: 0, color: '#fff', rot: 0, vr: 0, drag: 0, g: 0 }), 520);
    this.texts = new ObjectPool(() => ({ x: 0, y: 0, life: 0, max: 1, str: '', color: '#fff', size: 18 }), 28);
    this.density = 1;          // set from graphics quality
    this.shakeAmp = 0;
    this.flashA = 0; this.flashColor = '255,255,255';
    this.sx = 0; this.sy = 0;
  }
  reset() { this.particles.clear(); this.texts.clear(); this.shakeAmp = 0; this.flashA = 0; this.sx = this.sy = 0; }

  _p(type, x, y, vx, vy, life, size, color) {
    const p = this.particles.obtain();
    if (!p) return null;
    p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.size = size;
    p.color = color; p.grow = 0; p.rot = 0; p.vr = 0; p.drag = 0; p.g = 0;
    return p;
  }
  _n(n) { return Math.max(1, Math.round(n * this.density)); }

  smoke(x, y, size = 6, life = 0.6, alpha = '255,255,255') {
    const p = this._p(SMOKE, x + rand(-2, 2), y + rand(-2, 2), rand(-8, 8), rand(-8, 8), life, size, alpha);
    if (p) p.grow = size * 1.6;
  }
  spark(x, y, a, n = 4, color = '#FFF3B0') {
    for (let i = this._n(n); i > 0; i--) {
      const d = a + rand(-0.7, 0.7), s = rand(120, 320);
      const p = this._p(SPARK, x, y, Math.cos(d) * s, Math.sin(d) * s, rand(0.12, 0.28), rand(1.5, 2.5), color);
      if (p) p.drag = 3;
    }
  }
  muzzle(x, y, a) {
    const p = this._p(FIRE, x, y, Math.cos(a) * 60, Math.sin(a) * 60, 0.07, 7, null);
    if (p) p.grow = -40;
  }
  ring(x, y, r0, r1, life = 0.4, color = '255,255,255', width = 4) {
    const p = this._p(RING, x, y, 0, 0, life, r0, color);
    if (p) { p.grow = (r1 - r0) / life; p.rot = width; }
  }
  debris(x, y, n, colors) {
    for (let i = this._n(n); i > 0; i--) {
      const d = rand(TAU), s = rand(60, 260);
      const p = this._p(DEBRIS, x, y, Math.cos(d) * s, Math.sin(d) * s, rand(0.6, 1.2), rand(3, 7), colors[(Math.random() * colors.length) | 0]);
      if (p) { p.rot = rand(TAU); p.vr = rand(-12, 12); p.drag = 1.6; }
    }
  }
  burst(x, y, n, speed, size, life) {
    for (let i = this._n(n); i > 0; i--) {
      const d = rand(TAU), s = rand(speed * 0.2, speed);
      const p = this._p(FIRE, x + rand(-4, 4), y + rand(-4, 4), Math.cos(d) * s, Math.sin(d) * s, rand(life * 0.5, life), rand(size * 0.5, size), null);
      if (p) { p.drag = 2.4; p.grow = -size * 0.6; }
    }
  }
  explosionSmall(x, y, colors) {
    this.burst(x, y, 9, 150, 13, 0.45);
    for (let i = this._n(3); i > 0; i--) this.smoke(x + rand(-8, 8), y + rand(-8, 8), rand(8, 13), rand(0.5, 0.8));
    this.ring(x, y, 6, 46, 0.3);
    if (colors) this.debris(x, y, 4, colors);
    this.shake(3);
  }
  explosionLarge(x, y, colors) {
    this.burst(x, y, 20, 240, 20, 0.7);
    for (let i = this._n(7); i > 0; i--) this.smoke(x + rand(-18, 18), y + rand(-18, 18), rand(12, 20), rand(0.7, 1.2));
    this.ring(x, y, 10, 95, 0.42, '255,255,255', 6);
    this.ring(x, y, 4, 60, 0.3, '255,210,120', 3);
    if (colors) this.debris(x, y, 10, colors);
    this.shake(9);
  }
  collect(x, y, color) {
    for (let i = this._n(8); i > 0; i--) {
      const d = rand(TAU), s = rand(60, 190);
      const p = this._p(BIT, x, y, Math.cos(d) * s, Math.sin(d) * s, rand(0.3, 0.55), rand(3, 5), color);
      if (p) { p.drag = 3; p.rot = rand(TAU); p.vr = rand(-10, 10); }
    }
    this.ring(x, y, 8, 34, 0.25, '255,255,255', 3);
  }
  confetti(x, y, n) {
    const cols = ['#E23B3F', '#F59E1B', '#FFFFFF', '#3D7BE8', '#2FA866', '#F7D21E'];
    for (let i = this._n(n); i > 0; i--) {
      const d = rand(TAU), s = rand(80, 420);
      const p = this._p(DEBRIS, x, y, Math.cos(d) * s, Math.sin(d) * s, rand(1.2, 2.4), rand(4, 8), cols[(Math.random() * cols.length) | 0]);
      if (p) { p.rot = rand(TAU); p.vr = rand(-14, 14); p.drag = 1.2; p.g = 90; }
    }
  }
  text(x, y, str, color = '#FFFFFF', size = 18) {
    const t = this.texts.obtain();
    if (!t) return;
    t.x = x; t.y = y; t.str = str; t.color = color; t.size = size; t.life = t.max = 0.9;
  }
  shake(amp) { if (amp > this.shakeAmp) this.shakeAmp = Math.min(22, amp); }
  flash(color, a) { this.flashColor = color; this.flashA = Math.max(this.flashA, a); }

  update(dt) {
    const ps = this.particles.active;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.size += p.grow * dt;
      if (p.size < 0.3) p.size = 0.3;
      if (p.type === DEBRIS || p.type === BIT) p.rot += p.vr * dt;
    }
    this.particles.sweep();
    const ts = this.texts.active;
    for (let i = 0; i < ts.length; i++) { const t = ts[i]; t.life -= dt; t.y -= 34 * dt; if (t.life <= 0) t.alive = false; }
    this.texts.sweep();
    if (this.shakeAmp > 0) {
      this.sx = rand(-1, 1) * this.shakeAmp; this.sy = rand(-1, 1) * this.shakeAmp;
      this.shakeAmp -= (18 + this.shakeAmp * 3) * dt;
      if (this.shakeAmp <= 0) { this.shakeAmp = 0; this.sx = this.sy = 0; }
    }
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 2.2);
  }

  /** World-space particles. Call inside the camera transform. */
  render(ctx) {
    const ps = this.particles.active;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], k = p.life / p.max;
      switch (p.type) {
        case FIRE:
          ctx.fillStyle = FIRE_RAMP[Math.min(6, ((1 - k) * 7) | 0)];
          ctx.globalAlpha = k < 0.3 ? k / 0.3 : 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
          break;
        case SMOKE:
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(${p.color},${(k * 0.5).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
          break;
        case SPARK:
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
          break;
        case RING:
          ctx.globalAlpha = 1;
          ctx.strokeStyle = `rgba(${p.color},${(k * 0.9).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.5, p.rot * k);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke();
          break;
        default: { // DEBRIS / BIT
          ctx.globalAlpha = Math.min(1, k * 2.5);
          ctx.fillStyle = p.color;
          const c = Math.cos(p.rot), s = Math.sin(p.rot), h = p.size, w = p.type === BIT ? p.size : p.size * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x + c * h, p.y + s * h); ctx.lineTo(p.x - s * w, p.y + c * w);
          ctx.lineTo(p.x - c * h, p.y - s * h); ctx.lineTo(p.x + s * w, p.y - c * w);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    const ts = this.texts.active;
    if (ts.length) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i], k = t.life / t.max;
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.font = `${t.size}px "Bebas Neue", Impact, sans-serif`;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,35,25,0.55)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  }
  /** Screen-space overlay. Call with identity camera. */
  renderScreen(ctx, w, h) {
    if (this.flashA > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${Math.min(0.85, this.flashA).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
