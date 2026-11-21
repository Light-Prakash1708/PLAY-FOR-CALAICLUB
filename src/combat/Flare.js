// Decoy flares: bright, short-lived heat sources that pull enemy missiles away.
import { ObjectPool } from '../systems/ObjectPool.js';
import { TAU, rand } from '../core/utils.js';

export class FlareSystem {
  constructor() {
    this.pool = new ObjectPool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, smokeT: 0 }), 16);
  }
  reset() { this.pool.clear(); }
  /** Ejects a fan of flares behind the aircraft and returns them. */
  deploy(p, n = 5) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = this.pool.obtain();
      if (!f) break;
      const a = p.a + Math.PI + (i - (n - 1) / 2) * 0.42 + rand(-0.08, 0.08), sp = rand(150, 230);
      f.x = p.x; f.y = p.y;
      f.vx = Math.cos(a) * sp + Math.cos(p.a) * p.speed * 0.35; f.vy = Math.sin(a) * sp + Math.sin(p.a) * p.speed * 0.35;
      f.life = f.max = rand(2.2, 2.8); f.smokeT = 0;
      out.push(f);
    }
    return out;
  }
  update(dt, world) {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const f = a[i];
      f.life -= dt;
      if (f.life <= 0) { f.alive = false; continue; }
      const k = Math.max(0, 1 - 1.6 * dt);
      f.vx *= k; f.vy *= k;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.smokeT -= dt;
      if (f.smokeT <= 0) { f.smokeT = 0.05; world.vfx.smoke(f.x, f.y, 3, 0.5); }
    }
    this.pool.sweep();
  }
  render(ctx, t) {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const f = a[i], k = Math.min(1, f.life / 0.5), fl = 0.8 + 0.2 * Math.sin(t * 50 + i * 3);
      ctx.fillStyle = `rgba(255,190,90,${0.28 * k})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 15 * fl, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,225,150,${0.7 * k})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 7 * fl, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${k})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 3.2, 0, TAU); ctx.fill();
    }
  }
}
