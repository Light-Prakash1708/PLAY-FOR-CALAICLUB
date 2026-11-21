// Pooled bullets for both sides. team 0 = player, 1 = enemy.
import { ObjectPool } from '../systems/ObjectPool.js';
import { TAU } from '../core/utils.js';
import { COLORS } from '../core/GameConfig.js';

export class ProjectileSystem {
  constructor() {
    this.pool = new ObjectPool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, r: 3, team: 0 }), 260);
  }
  reset() { this.pool.clear(); }
  fire(x, y, angle, speed, dmg, team, life, r) {
    const b = this.pool.obtain();
    if (!b) return null;
    b.x = x; b.y = y; b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
    b.dmg = dmg; b.team = team; b.life = life; b.r = r;
    b.tr = 0; b.owner = null; b.whiz = false;   // tr: tracer (Team Battle), owner: who fired it, whiz: near-miss sound played
    return b;
  }
  update(dt) {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const b = a[i];
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; continue; }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    this.pool.sweep();
  }
  /** Removes enemy bullets inside a radius (bomb / mission end). Returns count. */
  clearEnemy(x, y, radius) {
    let n = 0;
    const r2 = radius * radius;
    for (const b of this.pool.active) {
      if (b.team === 1 && (b.x - x) ** 2 + (b.y - y) ** 2 < r2) { b.alive = false; n++; }
    }
    return n;
  }
  render(ctx) {
    const a = this.pool.active;
    if (!a.length) return;
    ctx.lineCap = 'round';
    // player tracers: two batched strokes
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? 'rgba(255,190,70,0.55)' : COLORS.playerShot;
      ctx.lineWidth = pass === 0 ? 6 : 2.6;
      ctx.beginPath();
      for (let i = 0; i < a.length; i++) {
        const b = a[i];
        if (b.team !== 0 || b.tr) continue;
        const k = pass === 0 ? 0.034 : 0.022;
        ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * k, b.y - b.vy * k);
      }
      ctx.stroke();
    }
    // Team Battle tracers, coloured per team, with an additive bloom pass
    if (this.teamColors) {
      ctx.globalCompositeOperation = 'lighter';
      for (let team = 0; team < 2; team++) {
        ctx.strokeStyle = team ? 'rgba(255,80,50,0.22)' : 'rgba(120,190,255,0.22)'; ctx.lineWidth = 11;
        ctx.beginPath();
        for (let i = 0; i < a.length; i++) { const b = a[i]; if (b.tr && b.team === team) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.04, b.y - b.vy * 0.04); } }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let team = 0; team < 2; team++) {
        const col = this.teamColors[team];
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = col[pass]; ctx.lineWidth = pass === 0 ? 6 : 2.6;
          ctx.beginPath();
          const k = pass === 0 ? 0.034 : 0.022;
          for (let i = 0; i < a.length; i++) { const b = a[i]; if (b.tr && b.team === team) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * k, b.y - b.vy * k); } }
          ctx.stroke();
        }
      }
    }
    // enemy shots: trail + glowing orb
    ctx.strokeStyle = 'rgba(255,106,61,0.45)'; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < a.length; i++) { const b = a[i]; if (b.team === 1 && !b.tr) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.06, b.y - b.vy * 0.06); } }
    ctx.stroke();
    ctx.fillStyle = '#E8432E';
    ctx.beginPath();
    for (let i = 0; i < a.length; i++) { const b = a[i]; if (b.team === 1 && !b.tr) { ctx.moveTo(b.x + b.r + 1.5, b.y); ctx.arc(b.x, b.y, b.r + 1.5, 0, TAU); } }
    ctx.fill();
    ctx.fillStyle = '#FFE9C2';
    ctx.beginPath();
    for (let i = 0; i < a.length; i++) { const b = a[i]; if (b.team === 1 && !b.tr) { ctx.moveTo(b.x + b.r * 0.55, b.y); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); } }
    ctx.fill();
  }
}
