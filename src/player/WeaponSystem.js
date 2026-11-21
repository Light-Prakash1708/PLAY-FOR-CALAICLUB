// Player weapons: machine gun, homing missiles and the aircraft's special.
// Cooldowns and ammunition are tracked here; nothing is unlimited.
import { CONFIG } from '../core/GameConfig.js';
import { angDiff, clamp, rand } from '../core/utils.js';

export class WeaponSystem {
  constructor(player) { this.p = player; }

  reset() {
    const s = this.p.stats;
    this.fireCd = 0; this.gunSide = 1;
    this.missiles = this.maxMissiles = s.missiles;
    this.missileCd = 0;
    this.special = CONFIG.SPECIAL_START;
    this.specialCd = 0;
    this.flares = CONFIG.FLARE_START; this.flareCd = 0; this.flaresUsed = 0;
    this.shotsFired = 0; this.missilesFired = 0; this.specialsUsed = 0;
  }

  update(dt, input, world) {
    const p = this.p;
    if (!p.alive || world.ending) return;
    this.fireCd -= dt;
    if (this.missileCd > 0) this.missileCd -= dt;
    if (this.specialCd > 0) this.specialCd -= dt;
    if (this.flareCd > 0) this.flareCd -= dt;
    // manual cannon: fires only while the trigger is held
    if (input.fire && this.fireCd <= 0) {
      const rate = p.stats.fireRate * (p.rapid > 0 ? 1.7 : 1);
      this.fireCd = 1 / rate;
      this._shoot(world);
    }
    if (input.consumeMissile()) this.launchMissile(world);
    if (input.consumeSpecial()) this.useSpecial(world);
    if (input.consumeFlare()) this.useFlares(world);
    if (input.consumeBoost()) p.boost(world);
  }

  /** Small aim assist: nudges the shot toward the best target inside a narrow cone. */
  _aim(world) {
    const p = this.p;
    let best = null, bestErr = CONFIG.AIM_ASSIST_CONE;
    for (const e of world.enemies.list) {
      if (!e.alive || e.dying || e.cloaked) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > 480) continue;
      const tt = d / CONFIG.BULLET_SPEED;                      // lead the target
      const lx = dx + Math.cos(e.a) * e.vel * tt, ly = dy + Math.sin(e.a) * e.vel * tt;
      const err = angDiff(p.a, Math.atan2(ly, lx));
      if (Math.abs(err) < Math.abs(bestErr)) { bestErr = err; best = e; }
    }
    return best ? p.a + bestErr * 0.85 : p.a;
  }

  _shoot(world) {
    const p = this.p, s = p.stats, a = this._aim(world);
    const cos = Math.cos(p.a), sin = Math.sin(p.a), fwd = p.def.size * 0.9;
    const fire = (side, ang, dmg) => {
      const x = p.x + cos * fwd - sin * side, y = p.y + sin * fwd + cos * side;
      world.bullets.fire(x, y, ang + rand(-0.012, 0.012), CONFIG.BULLET_SPEED + p.speed * 0.3, dmg, 0, CONFIG.BULLET_LIFE, 3.5);
      world.vfx.muzzle(x, y, ang);
    };
    // `damage` is the total per trigger pull; multi-gun aircraft split it across barrels
    const guns = p.def.guns, per = s.damage / guns;
    if (guns === 1) { fire(6 * this.gunSide, a, per); this.gunSide = -this.gunSide; }
    else {
      fire(9, a, per); fire(-9, a, per);
      if (guns === 3) fire(0, a, per);
    }
    if (p.spreadT > 0) for (const off of [-0.34, -0.17, 0.17, 0.34]) fire(0, a + off, s.damage * 0.5);
    this.shotsFired++;
    world.audio.sfx('shoot');
  }

  pickTarget(world, exclude) {
    const p = this.p;
    let best = null, bestScore = 1e9;
    for (const e of world.enemies.list) {
      if (!e.alive || e.dying || e.cloaked || (exclude && exclude.includes(e))) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > 720) continue;
      const score = d + Math.abs(angDiff(p.a, Math.atan2(dy, dx))) * 240 - (e.def.boss ? 150 : 0);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  launchMissile(world) {
    const p = this.p;
    if (this.missileCd > 0) return false;
    if (this.missiles <= 0) { world.audio.sfx('empty'); world.hint('Out of missiles - grab a refill', 1.4); return false; }
    this.missiles--;
    this.missileCd = CONFIG.MISSILE_COOLDOWN;
    const t1 = this.pickTarget(world);
    if (p.def.dualMissile) {     // paired launch: two smaller warheads
      this._launch(world, 1, t1, 0.25, 0.6);
      this._launch(world, -1, this.pickTarget(world, t1 ? [t1] : null) || t1, -0.25, 0.6);
    } else this._launch(world, 1, t1, 0.25, 1);
    this.missilesFired++;
    world.audio.sfx('missile');
    return true;
  }
  _launch(world, side, target, angOff, dmgMul) {
    const p = this.p, s = Math.sin(p.a), c = Math.cos(p.a), off = p.def.size * 0.7 * side;
    const x = p.x - s * off, y = p.y + c * off;
    world.missiles.launch(0, x, y, p.a + angOff, p.stats.missileDmg * dmgMul, target);
    world.vfx.burst(x, y, 4, 60, 6, 0.25);
    for (let i = 0; i < 3; i++) world.vfx.smoke(x - c * 8 * i, y - s * 8 * i, 5, 0.5);
  }

  useSpecial(world) {
    const p = this.p;
    if (this.specialCd > 0) return false;
    if (this.special <= 0) { world.audio.sfx('empty'); world.hint('No special charges left', 1.4); return false; }
    this.special--;
    this.specialCd = CONFIG.SPECIAL_COOLDOWN;
    this.specialsUsed++;
    const kind = p.def.special;
    if (kind === 'spread') {
      p.spreadT = CONFIG.SPREAD_TIME;
      world.vfx.ring(p.x, p.y, 10, 70, 0.35, '255,230,150', 5);
      world.vfx.text(p.x, p.y - 38, 'SPREAD SHOT', '#FFE38A', 22);
      world.audio.sfx('special');
    } else if (kind === 'salvo') {
      const used = [];
      for (let i = 0; i < 6; i++) {
        let t = this.pickTarget(world, used);
        if (t) used.push(t); else t = used[i % (used.length || 1)] || null;
        this._launch(world, i % 2 ? 1 : -1, t, (i - 2.5) * 0.3, 0.5);
      }
      world.vfx.text(p.x, p.y - 38, 'MISSILE SALVO', '#FFE38A', 22);
      world.audio.sfx('missile'); world.audio.sfx('special');
    } else {
      world.bomb(p.x, p.y, 150 + p.stats.damage * 2);
      world.vfx.text(p.x, p.y - 38, 'SHOCK BOMB', '#FFE38A', 22);
    }
    return true;
  }
  addMissiles(n) { this.missiles = clamp(this.missiles + n, 0, this.maxMissiles); }
  /** Flares: every enemy missile in range loses the aircraft and chases a decoy instead. */
  useFlares(world) {
    if (this.flareCd > 0) return false;
    if (this.flares <= 0) { world.audio.sfx('empty'); world.hint('Out of flares - out-turn the missile', 1.4); return false; }
    this.flares--; this.flareCd = CONFIG.FLARE_COOLDOWN; this.flaresUsed++;
    const p = this.p, decoys = world.flares.deploy(p);
    let n = 0;
    if (decoys.length) {
      const R2 = CONFIG.FLARE_RANGE ** 2;
      for (const m of world.missiles.pool.active) {
        if (m.team !== 1 || m.decoy) continue;
        if ((m.x - p.x) ** 2 + (m.y - p.y) ** 2 < R2) { m.decoy = decoys[n % decoys.length]; n++; }
      }
    }
    if (n) { world.vfx.text(p.x, p.y - 40, n > 1 ? `${n} MISSILES DECOYED` : 'MISSILE DECOYED', '#FFE38A', 20); world.addScore(50 * n); }
    world.audio.sfx('flare');
    return true;
  }
  addFlares(n) { this.flares = clamp(this.flares + n, 0, CONFIG.FLARE_MAX); }
  addSpecial(n) { this.special = clamp(this.special + n, 0, CONFIG.SPECIAL_MAX); }
}
