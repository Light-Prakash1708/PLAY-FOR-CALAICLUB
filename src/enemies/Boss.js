// Boss brain: multi-phase attack scripts read from data (enemies.js `phases`).
import { clamp, rand, TAU } from '../core/utils.js';

const HALF_PI = Math.PI / 2;

export function bossInit(e) {
  e.phase = 0; e.invuln = 0; e.spiral = null; e.turret = 0;
  e.atkT = e.def.phases[0].attacks.map((a, i) => 1.5 + i * 0.8);
}

function turretPos(e, out) {
  const tr = e.art.turrets;
  const t = tr[e.turret++ % tr.length];
  const c = Math.cos(e.a), s = Math.sin(e.a), sz = e.def.size;
  out.x = e.x + (c * t[0] - s * t[1]) * sz; out.y = e.y + (s * t[0] + c * t[1]) * sz;
  return out;
}
const tmp = { x: 0, y: 0 };

function attack(e, a, world) {
  const p = world.player;
  switch (a.kind) {
    case 'spread': {
      const o = turretPos(e, tmp);
      const base = Math.atan2(p.y - o.y, p.x - o.x);
      for (let i = 0; i < a.count; i++) world.bullets.fire(o.x, o.y, base + (i - (a.count - 1) / 2) * a.arc, a.speed, a.dmg, 1, 3.2, 5.5);
      world.vfx.ring(o.x, o.y, 4, 22, 0.2, '255,140,90', 3);
      world.audio.sfx('enemyShoot');
      break;
    }
    case 'ring': {
      const off = rand(TAU);
      for (let i = 0; i < a.count; i++) world.bullets.fire(e.x, e.y, off + (i / a.count) * TAU, a.speed, a.dmg, 1, 3.4, 5.5);
      world.vfx.ring(e.x, e.y, e.r * 0.5, e.r * 1.6, 0.3, '255,140,90', 5);
      world.audio.sfx('phase');
      break;
    }
    case 'spiral':
      e.spiral = { a, t: a.duration, acc: 0, ang: rand(TAU) };
      break;
    case 'missile':
      for (let i = 0; i < a.count; i++) {
        const o = turretPos(e, tmp);
        world.missiles.launch(1, o.x, o.y, e.a + (i - (a.count - 1) / 2) * 0.9 + rand(-0.2, 0.2), a.dmg, null);
      }
      world.audio.sfx('missile');
      break;
    case 'summon':
      if (world.enemies.count() < 3) world.level.spawnEscorts(a.type, a.count);   // never floods the sky
      break;
  }
}

export function bossThink(e, dt, world) {
  const def = e.def, p = world.player;
  let ph = def.phases[e.phase];
  // ---- phase transitions ----
  if (e.phase < def.phases.length - 1 && e.hp / e.maxHp <= ph.until) {
    e.phase++;
    ph = def.phases[e.phase];
    e.invuln = 1.5;
    e.spiral = null;
    e.atkT = ph.attacks.map((a, i) => 1.2 + i * 0.7);
    world.vfx.ring(e.x, e.y, e.r, 320, 0.6, '255,90,70', 10);
    world.vfx.ring(e.x, e.y, e.r * 0.5, 200, 0.45, '255,255,255', 6);
    world.vfx.flash('255,120,90', 0.35);
    world.vfx.shake(14);
    world.bullets.clearEnemy(e.x, e.y, 9999);
    world.audio.sfx('phase');
    world.onBossPhase(e);
  }
  if (e.invuln > 0) e.invuln -= dt;
  e.speedMul = ph.speed;
  // ---- attacks ----
  if (p.alive && !world.ending && e.invuln <= 0 && e.t > 2 && e.dist < 600) {
    const mul = world.level.fireMul;
    for (let i = 0; i < ph.attacks.length; i++) {
      e.atkT[i] -= dt * mul;
      if (e.atkT[i] <= 0) { e.atkT[i] = ph.attacks[i].cd * rand(0.9, 1.1); attack(e, ph.attacks[i], world); }
    }
    const sp = e.spiral;
    if (sp) {
      sp.t -= dt; sp.acc += dt;
      while (sp.acc >= sp.a.rate) {
        sp.acc -= sp.a.rate;
        sp.ang += sp.a.spin * sp.a.rate;
        for (let k = 0; k < sp.a.arms; k++) world.bullets.fire(e.x, e.y, sp.ang + (k / sp.a.arms) * TAU, sp.a.speed, sp.a.dmg, 1, 3.4, 5);
        world.audio.sfx('enemyShoot');
      }
      if (sp.t <= 0) e.spiral = null;
    }
  }
  // ---- movement: slow menacing orbit around the player ----
  const R = def.orbit;
  const k = clamp((e.dist - R) / 240, -0.5, 1);
  return e.toP + e.side * HALF_PI * (1 - k);
}
