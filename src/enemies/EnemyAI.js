// Movement patterns and shooting behaviour, selected by data (def.pattern /
// def.weapon). Every pattern returns the heading the aircraft wants to fly.
import { angDiff, turnToward, clamp, rand, TAU } from '../core/utils.js';
import { bossThink } from './Boss.js';

const HALF_PI = Math.PI / 2;

function orbit(e, R) {
  const k = clamp((e.dist - R) / 220, -0.6, 1);
  return e.toP + e.side * HALF_PI * (1 - k);
}
/** Fly straight through after a close pass instead of circling on top of the player. */
function passThrough(e, dt, near, tMin, tMax) {
  if (e.passT > 0) { e.passT -= dt; return true; }
  if (e.dist < near) { e.passT = rand(tMin, tMax); return true; }
  return false;
}

export const PATTERNS = {
  // Scout: weaving approach
  zigzag(e, dt) {
    if (passThrough(e, dt, 70, 0.5, 0.9)) return e.a;
    return e.toP + Math.sin(e.t * 3.2 + e.seed) * 0.85 * Math.min(1, e.dist / 220);
  },
  // Fighter / Armoured: pursuit with lead
  chase(e, dt, world) {
    if (passThrough(e, dt, 78, 0.7, 1.2)) return e.a;
    const p = world.player, lead = Math.min(0.6, e.dist / 500);
    return Math.atan2(p.y + Math.sin(p.a) * p.speed * lead - e.y, p.x + Math.cos(p.a) * p.speed * lead - e.x);
  },
  // Bomber: long straight runs past the player, then a wide turn back
  straight(e, dt, world) {
    const p = world.player;
    if (e.mode === 'run') {
      if (e.dist > 600 && Math.abs(angDiff(e.a, e.toP)) > 1.6) { e.mode = 'turn'; e.offX = rand(-120, 120); e.offY = rand(-120, 120); }
      return e.a;
    }
    const tgt = Math.atan2(p.y + e.offY - e.y, p.x + e.offX - e.x);
    if (Math.abs(angDiff(e.a, tgt)) < 0.12) e.mode = 'run';
    return tgt;
  },
  // Missile carrier: circles at stand-off range
  circle(e) { return orbit(e, e.def.orbit || 260); },
  // Interceptor / squadron leader: fast slashing passes on alternating sides
  sweep(e, dt) {
    if (e.mode === 'extend') {
      e.timer -= dt;
      e.speedMul = 1.1;
      if (e.timer <= 0) { e.mode = 'attack'; e.side = -e.side; }
      return e.a;
    }
    if (e.dist < 85) { e.mode = 'extend'; e.timer = rand(1.0, 1.6); return e.a; }
    return e.toP + (e.dist > 260 ? e.side * 0.35 : 0);
  },
  // Stealth: hops between random waypoints around the player (bounded randomness)
  erratic(e, dt, world) {
    e.timer -= dt;
    const dx = e.wpx - e.x, dy = e.wpy - e.y;
    if (e.timer <= 0 || dx * dx + dy * dy < 1600) {
      const p = world.player, a = rand(TAU), r = rand(110, 280);
      e.wpx = p.x + Math.cos(a) * r; e.wpy = p.y + Math.sin(a) * r;
      e.timer = rand(1.1, 2.0);
    }
    return Math.atan2(e.wpy - e.y, e.wpx - e.x);
  },
  // Elite: alternates pursuit and orbit, and breaks hard when the player lines up a shot
  elite(e, dt, world) {
    const p = world.player;
    e.timer -= dt;
    if (e.timer <= 0) {
      e.mode = e.mode === 'chase' ? 'orbit' : 'chase';
      e.timer = e.mode === 'chase' ? rand(3, 4.5) : rand(2.5, 3.5);
      e.side = -e.side;
    }
    if (e.jinkCd > 0) e.jinkCd -= dt;
    if (e.jink > 0) { e.jink -= dt; e.speedMul = 1.2; return e.a + e.jinkDir * 1.4; }
    if (e.jinkCd <= 0 && e.dist < 330 && Math.abs(angDiff(p.a, e.toP + Math.PI)) < 0.22) {
      e.jink = 0.45; e.jinkCd = 1.7; e.jinkDir = Math.random() < 0.5 ? 1 : -1;
    }
    if (e.mode === 'chase') return passThrough(e, dt, 80, 0.6, 1.0) ? e.a : e.toP;
    return orbit(e, 215);
  },
  boss(e, dt, world) { return bossThink(e, dt, world); },
};

function onScreen(e, world, margin) {
  const v = world.view, c = world.cam;
  return Math.abs(e.x - c.x) < v.w / 2 + margin && Math.abs(e.y - c.y) < v.h / 2 + margin;
}

function shoot(e, world, w, angle, lateral = 0) {
  const c = Math.cos(e.a), s = Math.sin(e.a), f = e.def.size * 0.8;
  world.bullets.fire(e.x + c * f - s * lateral, e.y + s * f + c * lateral, angle, w.speed, w.dmg, 1, 2.6, 5);
}

function fireWeapon(e, world, w) {
  const err = angDiff(e.a, e.toP);
  switch (w.kind) {
    case 'aim': {
      if (Math.abs(err) > w.cone && !e.leader) return false;
      const ang = e.a + clamp(err, -w.cone, w.cone);
      if (w.count === 2) { shoot(e, world, w, ang, 7); shoot(e, world, w, ang, -7); } else shoot(e, world, w, ang);
      break;
    }
    case 'burst':
      if (Math.abs(err) > w.cone) return false;
      e.burstN = w.count; e.burstT = 0;
      break;
    case 'spread':
      if (Math.abs(err) > w.cone) return false;
      for (let i = 0; i < w.count; i++) shoot(e, world, w, e.toP + (i - (w.count - 1) / 2) * w.arc);
      break;
    case 'turret':
      for (let i = 0; i < w.count; i++) shoot(e, world, w, e.toP + (i - (w.count - 1) / 2) * w.arc);
      break;
    case 'missile':
      world.missiles.launch(1, e.x, e.y, e.a + e.side * 0.5, w.dmg, null);
      world.audio.sfx('missile');
      return true;
  }
  world.audio.sfx('enemyShoot');
  return true;
}

function updateWeapons(e, dt, world) {
  const def = e.def, w = def.weapon, p = world.player;
  if (!p.alive || world.ending || e.t < 1) return;
  const mul = world.level.fireMul;
  if (e.burstN > 0) {
    e.burstT -= dt;
    if (e.burstT <= 0) { shoot(e, world, w, e.a + clamp(angDiff(e.a, e.toP), -w.cone, w.cone)); world.audio.sfx('enemyShoot'); e.burstN--; e.burstT = w.gap; }
  }
  if (def.missile) {
    e.missT -= dt * mul * world.level.missileMul;
    if (e.missT <= 0 && e.dist < 480 && onScreen(e, world, 80) && !(def.cloak && e.alpha < 0.9)) {
      e.missT = def.missile.cd * rand(0.85, 1.15);
      world.missiles.launch(1, e.x, e.y, e.a, def.missile.dmg, null);
      world.audio.sfx('missile');
    }
  }
  if (!w) return;
  // formation followers fire in volleys led by their leader
  if (e.leader) {
    if (e.leader.volley !== e.seenVolley) { e.seenVolley = e.leader.volley; e.volleyDelay = 0.07 * e.slot; }
    if (e.volleyDelay >= 0) {
      e.volleyDelay -= dt;
      if (e.volleyDelay < 0 && e.dist < w.range * 1.15 && Math.abs(angDiff(e.a, e.toP)) < 0.9 && onScreen(e, world, 20)) {
        shoot(e, world, w, e.toP); world.audio.sfx('enemyShoot');
      }
    }
    return;
  }
  e.fireT -= dt * mul;
  if (e.fireT > 0 || e.dist > w.range) return;
  if (def.cloak && e.alpha < 0.9) return;
  if (!onScreen(e, world, w.kind === 'missile' ? 110 : 30)) return;     // never shoot from far off-screen
  if (fireWeapon(e, world, w)) { e.fireT = w.cd * rand(0.85, 1.15); e.volley++; }
  else e.fireT = 0.15;
}

export function updateEnemy(e, dt, world) {
  const p = world.player, def = e.def;
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  const dx = p.x - e.x, dy = p.y - e.y;
  e.dist = Math.hypot(dx, dy);
  e.toP = Math.atan2(dy, dx);

  if (def.cloak) {
    e.cloakT += dt;
    const target = e.cloakT % 5.2 < 2.4 ? 1 : 0.1;
    e.alpha += (target - e.alpha) * Math.min(1, dt * 4);
    e.cloaked = e.alpha < 0.45;
  }

  // formation followers hold a slot relative to their leader
  if (e.leader) {
    const L = e.leader;
    if (!L.alive || L.uid !== e.leaderUid || L.dying) { e.leader = null; e.pattern = 'chase'; }
    else {
      const c = Math.cos(L.a), s = Math.sin(L.a);
      const sx = L.x + c * e.slotX - s * e.slotY, sy = L.y + s * e.slotX + c * e.slotY;
      const k = 1 - Math.exp(-4.5 * dt);
      e.x += (sx - e.x) * k; e.y += (sy - e.y) * k;
      e.a = turnToward(e.a, L.a, 4 * dt);
      e.bank = L.bank; e.vel = L.vel;
      e.trail.add(e.x, e.y);
      updateWeapons(e, dt, world);
      return;
    }
  }

  e.speedMul = 1;
  let want;
  if (!p.alive) want = e.a;                       // player down: disengage
  else {
    want = PATTERNS[e.pattern](e, dt, world);
    if (e.dist > 950) { want = e.toP; e.speedMul = 1.5; }   // leash: never wander off for good
    // break away before a mid-air collision: enemies fight with weapons, not by ramming
    else if (!def.boss && e.dist < def.r + 50 && Math.abs(angDiff(e.a, e.toP)) < 1.2) want = e.toP + e.side * 2.0;
  }
  const diff = angDiff(e.a, want);
  e.a = turnToward(e.a, want, def.turn * dt);
  e.bank += (clamp(diff * 1.3, -1, 1) - e.bank) * Math.min(1, dt * 7);
  e.vel += (def.speed * e.speedMul - e.vel) * Math.min(1, dt * 2);
  e.x += Math.cos(e.a) * e.vel * dt;
  e.y += Math.sin(e.a) * e.vel * dt;
  e.trail.add(e.x - Math.cos(e.a) * def.size * 0.8, e.y - Math.sin(e.a) * def.size * 0.8);
  if (!def.boss) updateWeapons(e, dt, world);
}
