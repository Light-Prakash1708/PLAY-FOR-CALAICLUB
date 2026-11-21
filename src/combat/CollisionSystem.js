// Circle-vs-circle collision between bullets, missiles, aircraft and the player.
// Projectiles are removed on their first hit and the player's invulnerability
// window guarantees a single collision never applies damage twice.
import { CONFIG } from '../core/GameConfig.js';

export function runCollisions(world) {
  const p = world.player, en = world.enemies.list;
  const bl = world.bullets.pool.active, ms = world.missiles.pool.active;
  const pr = p.shield > 0 ? p.def.size * 1.5 : CONFIG.PLAYER_HIT_RADIUS;
  const playerHittable = p.alive && !world.ending;

  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (!b.alive) continue;
    if (b.team === 0) {
      for (let j = 0; j < en.length; j++) {
        const e = en[j];
        if (!e.alive || e.dying) continue;
        const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r + 3;
        if (dx * dx + dy * dy < rr * rr) {
          b.alive = false;
          world.damageEnemy(e, b.dmg, b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI);
          break;
        }
      }
      if (!b.alive) continue;
      for (let j = 0; j < ms.length; j++) {           // shoot down incoming missiles
        const m = ms[j];
        if (!m.alive || m.team !== 1) continue;
        const dx = m.x - b.x, dy = m.y - b.y, rr = m.r + b.r + 5;
        if (dx * dx + dy * dy < rr * rr) { b.alive = false; world.missiles.explode(m, world); world.addScore(25); break; }
      }
    } else if (playerHittable) {
      const dx = p.x - b.x, dy = p.y - b.y, rr = pr + b.r;
      if (dx * dx + dy * dy < rr * rr) { b.alive = false; p.damage(b.dmg, world); }
    }
  }

  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    if (!m.alive) continue;
    if (m.team === 0) {
      for (let j = 0; j < en.length; j++) {
        const e = en[j];
        if (!e.alive || e.dying) continue;
        const dx = e.x - m.x, dy = e.y - m.y, rr = e.r + m.r + 2;
        if (dx * dx + dy * dy < rr * rr) {
          world.missiles.explode(m, world);
          world.damageEnemy(e, e.def.boss ? m.dmg * 0.5 : m.dmg, m.x, m.y, m.a + Math.PI);   // boss hulls shrug off half
          break;
        }
      }
    } else {
      if (playerHittable) {
        const dx = p.x - m.x, dy = p.y - m.y, rr = pr + m.r + 2;
        if (dx * dx + dy * dy < rr * rr) { world.missiles.explode(m, world); p.damage(m.dmg, world); continue; }
      }
      for (let j = i + 1; j < ms.length; j++) {       // enemy missiles can be baited into each other
        const o = ms[j];
        if (!o.alive || o.team !== 1) continue;
        const dx = o.x - m.x, dy = o.y - m.y;
        if (dx * dx + dy * dy < 196 && m.trail.len > 12 && o.trail.len > 12) {
          world.missiles.explode(m, world); world.missiles.explode(o, world);
          world.addScore(100); world.vfx.text(m.x, m.y - 16, 'NICE! +100', '#FFFFFF', 20);
          break;
        }
      }
    }
  }

  if (playerHittable && p.invuln <= 0) {
    for (let j = 0; j < en.length; j++) {
      const e = en[j];
      if (!e.alive || e.dying) continue;
      const dx = e.x - p.x, dy = e.y - p.y, rr = e.r * 0.55 + pr;      // generous: only a real overlap counts as a collision
      if (dx * dx + dy * dy < rr * rr) {
        if (p.damage(e.def.contact, world)) world.damageEnemy(e, e.def.boss ? 40 : 60, (e.x + p.x) / 2, (e.y + p.y) / 2, 0);
        break;
      }
    }
  }
}
