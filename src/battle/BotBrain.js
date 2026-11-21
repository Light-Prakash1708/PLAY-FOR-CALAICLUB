// AI pilot for Team Battle bots (both teams). Picks a target, pursues with
// lead, breaks off before collisions, dodges missiles, respects the zone,
// manages gun heat and only fires missiles after holding a lock.
import { angDiff, rand, clamp, TAU } from '../core/utils.js';
import { BATTLE } from './battleData.js';

export class BotBrain {
  constructor(f, skill, react) {
    this.f = f; this.skill = skill; this.react = react;
    this.target = null; this.retargetT = 0;
    this.breakT = 0; this.breakDir = 1;
    this.lockT = 0; this.seed = rand(TAU);
    this.wanderA = rand(TAU); this.wanderT = 0;
    this.cmd = { steer: true, angle: 0, throttle: 1, fire: false, missile: false, boost: false, flare: false };
  }

  _pickTarget(world) {
    const f = this.f;
    let best = null, bestScore = 1e9;
    for (const o of world.fighters) {
      if (!o.alive || o.team === f.team) continue;
      const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy);
      let s = d + Math.abs(angDiff(f.a, Math.atan2(dy, dx))) * 160;
      if (o.lastHitBy === f) s -= 120;                         // finish what you started
      if (f.lastHitBy === o && f.lastHitT < 3) s -= 220;      // fight back against your attacker
      if (o.invuln > 0 || o.shieldT > 0) s += 300;
      // spread out: don't all dog-pile the same jet (the player especially)
      s += world.huntedBy(o, f) * 150 + (o.human ? 40 : 0);
      if (!world.zone.inside(o.x, o.y)) s += 150;              // let the zone do the work
      if (s < bestScore) { bestScore = s; best = o; }
    }
    return best;
  }

  think(dt, world) {
    const f = this.f, c = this.cmd, zone = world.zone;
    c.fire = false; c.missile = false; c.boost = false; c.flare = false; c.shield = false; c.throttle = 1;
    this.retargetT -= dt;
    if (this.retargetT <= 0 || !this.target || !this.target.alive) {
      this.retargetT = rand(0.8, 1.5) + this.react;
      this.target = this._pickTarget(world);
    }
    const t = this.target;
    let want = f.a;

    // 1. incoming missile: break perpendicular and burn
    let threat = null, td = 300 * 300;
    for (const m of world.missiles.pool.active) {
      if (!m.alive || m.team === f.team || m.target !== f || m.decoy) continue;
      const d = (m.x - f.x) ** 2 + (m.y - f.y) ** 2;
      if (d < td) { td = d; threat = m; }
    }
    // 2. zone: get back inside, with margin, before anything else
    const out = zone.distOut(f.x, f.y);
    const zoneAng = Math.atan2(zone.cy - f.y, zone.cx - f.x);
    if (threat && Math.random() < 0.6 + this.skill * 0.4) {
      const ma = Math.atan2(threat.y - f.y, threat.x - f.x);
      want = ma + Math.PI / 2 * (angDiff(ma, f.a) > 0 ? 1 : -1);
      if (Math.sqrt(td) < 220) c.boost = true;
      if (Math.sqrt(td) < BATTLE.FLARE_AUTO_RANGE) c.flare = true;
      if (Math.sqrt(td) < 140 && f.flares <= 0 && Math.random() < this.skill) c.shield = true;
    } else if (out > -60) {
      want = zoneAng;
      if (out > 120) c.boost = true;
    } else if (t) {
      const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
      const tt = d / BATTLE.BULLET_SPEED;
      const lx = t.x + Math.cos(t.a) * t.speed * tt * this.skill, ly = t.y + Math.sin(t.a) * t.speed * tt * this.skill;
      const aim = Math.atan2(ly - f.y, lx - f.x);
      if (this.breakT > 0) {
        this.breakT -= dt;
        want = f.a + this.breakDir * 1.1;
      } else {
        if (d < 95 + t.r) { this.breakT = rand(0.6, 1.0); this.breakDir = Math.random() < 0.5 ? 1 : -1; }
        want = aim + Math.sin(world.time * 1.6 + this.seed) * 0.22 * (1 - this.skill * 0.6);
        // ease off when sitting on someone's tail, so we stay behind them
        const behind = Math.abs(angDiff(t.a, Math.atan2(f.y - t.y, f.x - t.x))) > 2.3;
        if (behind && d < 260) c.throttle = 0.45;
        if (d > 700) c.boost = Math.random() < 0.01;
      }
      // guns: fire inside a cone, respecting heat (good pilots never overheat)
      const err = Math.abs(angDiff(f.a, aim));
      const cone = 0.12 + (1 - this.skill) * 0.12;
      const heatCap = 0.6 + this.skill * 0.35;
      if (d < BATTLE.AUTO_FIRE_RANGE && err < cone && t.invuln <= 0 && t.shieldT <= 0 && f.heat < heatCap) c.fire = true;
      // missiles: hold a lock for a moment first
      if (d < BATTLE.MISSILE_RANGE && d > 160 && err < BATTLE.MISSILE_CONE && t.invuln <= 0 && t.shieldT <= 0) this.lockT += dt; else this.lockT = Math.max(0, this.lockT - dt * 2);
      if (this.lockT > 1.1 - this.skill * 0.5 && f.missileCd <= 0 && Math.random() < 0.04 + this.skill * 0.05) { c.missile = true; this.lockT = 0; }
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = rand(2, 4); this.wanderA = rand(TAU); }
      const wx = zone.cx + Math.cos(this.wanderA) * zone.r * 0.4, wy = zone.cy + Math.sin(this.wanderA) * zone.r * 0.4;
      want = Math.atan2(wy - f.y, wx - f.x);
    }
    // under heavy fire and hurting: pop the shield (better pilots do it sooner)
    if (f.lastHitT < 0.3 && f.hp < f.maxHp * (0.3 + this.skill * 0.25) && Math.random() < 0.05 + this.skill * 0.1) c.shield = true;
    // supply crates: detour when low on something and one is close
    if (!threat && out < -60 && (f.ammo < 50 || f.missiles === 0 || f.hp < f.maxHp * 0.4)) {
      const cr = world.nearestCrate(f.x, f.y, 420);
      if (cr && (!t || Math.hypot(t.x - f.x, t.y - f.y) > 300)) want = Math.atan2(cr.y - f.y, cr.x - f.x);
    }
    c.angle = want;
    c.throttle = clamp(c.throttle, 0, 1);
    return c;
  }
}
