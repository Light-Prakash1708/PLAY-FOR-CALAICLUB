// Collectibles: coins, stars and power-ups. Sprites are drawn once and cached.
import { ObjectPool } from '../systems/ObjectPool.js';
import { TAU, rand } from '../core/utils.js';
import { CONFIG } from '../core/GameConfig.js';

function starPath(g, r, r2, n = 5) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r2 : r;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
}
const ICONS = {
  coin(g) {
    g.fillStyle = '#F2A81D'; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
    g.fillStyle = '#FFD24A'; g.beginPath(); g.arc(0, 0, 11.5, 0, TAU); g.fill();
    g.fillStyle = '#F2A81D'; g.fillRect(-2.2, -6.5, 4.4, 13);
  },
  star(g) {
    g.fillStyle = '#0E86B4'; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(Math.cos(i * TAU / 6 + TAU / 12) * 17, Math.sin(i * TAU / 6 + TAU / 12) * 17); g.closePath(); g.fill();
    g.fillStyle = '#35C4F0'; g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(Math.cos(i * TAU / 6 + TAU / 12) * 13.5, Math.sin(i * TAU / 6 + TAU / 12) * 13.5); g.closePath(); g.fill();
    g.fillStyle = '#FFE27A'; starPath(g, 9.5, 4.2); g.fill();
  },
  health(g) {
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
    g.fillStyle = '#E23B3F'; g.fillRect(-3.4, -9.5, 6.8, 19); g.fillRect(-9.5, -3.4, 19, 6.8);
  },
  missile(g) {
    g.fillStyle = '#4A2E22'; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
    g.save(); g.rotate(-Math.PI / 4);
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(11, 0); g.lineTo(5, -3.4); g.lineTo(-8, -3.4); g.lineTo(-8, 3.4); g.lineTo(5, 3.4); g.closePath(); g.fill();
    g.fillStyle = '#E23B3F'; g.beginPath(); g.moveTo(-4, -3.4); g.lineTo(-10, -7.5); g.lineTo(-8, -3.4); g.moveTo(-4, 3.4); g.lineTo(-10, 7.5); g.lineTo(-8, 3.4); g.fill();
    g.restore();
  },
  shield(g) {
    g.fillStyle = '#3D7BE8'; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.moveTo(0, -10); g.lineTo(8.5, -6.5); g.lineTo(8.5, 0.5); g.quadraticCurveTo(8, 7.5, 0, 11); g.quadraticCurveTo(-8, 7.5, -8.5, 0.5); g.lineTo(-8.5, -6.5); g.closePath(); g.fill();
  },
  rapid(g) {
    g.fillStyle = '#F7D21E'; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
    g.fillStyle = '#4A2E22';
    g.beginPath(); g.moveTo(3, -11); g.lineTo(-7, 2); g.lineTo(-1, 2); g.lineTo(-3, 11); g.lineTo(7, -2); g.lineTo(1, -2); g.closePath(); g.fill();
  },
};
export const PICKUP_COLORS = { coin: '#FFD24A', star: '#35C4F0', health: '#E23B3F', missile: '#FFFFFF', shield: '#3D7BE8', rapid: '#F7D21E' };
const sprites = {};
export function pickupSprite(kind) {
  if (sprites[kind]) return sprites[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 80;
  const g = c.getContext('2d');
  g.translate(40, 40); g.scale(2, 2);
  ICONS[kind](g);
  return (sprites[kind] = c);
}

export class PickupSystem {
  constructor() {
    this.pool = new ObjectPool(() => ({ kind: 'coin', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0, value: 0, phase: 0 }), 60);
  }
  reset() { this.pool.clear(); }
  spawn(kind, x, y, value = 0, scatter = 0) {
    const p = this.pool.obtain();
    if (!p) return null;
    const a = rand(TAU);
    p.kind = kind; p.x = x; p.y = y; p.value = value;
    p.vx = Math.cos(a) * scatter; p.vy = Math.sin(a) * scatter;
    p.t = 0; p.life = 14; p.phase = rand(TAU);
    return p;
  }
  count(kind) { let n = 0; for (const p of this.pool.active) if (p.kind === kind) n++; return n; }

  update(dt, world) {
    const pl = world.player, a = this.pool.active;
    const mag2 = CONFIG.PICKUP_MAGNET ** 2, col2 = CONFIG.PICKUP_RADIUS ** 2;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      p.t += dt; p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const k = Math.max(0, 1 - 3 * dt);
      p.vx *= k; p.vy *= k;
      if (pl.alive) {
        const dx = pl.x - p.x, dy = pl.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 < col2) { p.alive = false; world.collect(p); continue; }
        if (d2 < mag2) { const d = Math.sqrt(d2) || 1; const pull = 900 * (1 - d / CONFIG.PICKUP_MAGNET) + 200; p.vx += (dx / d) * pull * dt; p.vy += (dy / d) * pull * dt; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.pool.sweep();
  }
  render(ctx) {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      if (p.life < 3 && Math.sin(p.life * 18) > 0.2) continue;   // blink before expiring
      const bob = Math.sin(p.t * 3 + p.phase) * 3;
      const pop = Math.min(1, p.t * 5);
      const spr = pickupSprite(p.kind);
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      if (p.kind === 'star') { ctx.rotate(Math.sin(p.t * 2 + p.phase) * 0.35); }
      let sx = pop;
      if (p.kind === 'coin') sx *= 0.35 + 0.65 * Math.abs(Math.cos(p.t * 3 + p.phase));   // spinning coin
      ctx.scale(sx, pop);
      // soft halo
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.arc(0, 0, 21 + Math.sin(p.t * 4 + p.phase) * 2, 0, TAU); ctx.fill();
      ctx.drawImage(spr, -20, -20, 40, 40);
      if (p.kind === 'coin') {
        // travelling shine
        const s = ((p.t * 0.9 + p.phase) % 1.6) / 1.6;
        ctx.fillStyle = `rgba(255,255,255,${(0.7 * Math.sin(s * Math.PI)).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(-6 + s * 12, -6 + s * 4, 3, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
}
