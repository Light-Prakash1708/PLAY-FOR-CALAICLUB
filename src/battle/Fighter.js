// One aircraft in a Team Battle: human or bot, either team. Flight model,
// limited weapons (ammo, gun heat, missiles, flares), damage states and drawing.
import { clamp, angDiff, turnToward, TAU, rand } from '../core/utils.js';
import { getSprite, drawSprite, drawEngines } from '../art/PlaneArt.js';
import { PLAYER_ART, ENEMY_ART } from '../art/planeSpecs.js';
import { Trail } from '../combat/Trail.js';
import { BATTLE, TEAMS } from './battleData.js';

let UID = 1000;

export class Fighter {
  /** o: { team, name, human, pi, artKind: 'p'|'e', artId, size, stats, guns, skill, turnMul } */
  constructor(o) {
    Object.assign(this, o);
    this.uid = UID++;
    this.art = o.artKind === 'p' ? PLAYER_ART[o.artId] : ENEMY_ART[o.artId];
    this.sprite = getSprite((o.artKind === 'p' ? 'p_' : 'e_') + o.artId, this.art, o.size);
    this.r = Math.max(13, o.size * 0.57);
    this.trail = new Trail(26, 9);
    this.color = TEAMS[o.team];
    this.kills = 0; this.deaths = 0; this.assists = 0; this.dmgDealt = 0; this.streak = 0; this.best = 0;
    this.alive = false; this.respawnT = 0;
    this.brain = null;
    this.debris = [this.art.colors.body, this.art.colors.wing, this.art.colors.accent];
  }

  spawn(x, y, a) {
    const s = this.stats;
    this.x = x; this.y = y; this.a = a;
    this.speed = s.speed * 0.8;
    this.bank = 0; this.t = 0;
    this.hp = this.maxHp = Math.round(s.hp);
    this.invuln = BATTLE.SPAWN_SHIELD;
    this.ammo = this.maxAmmo = BATTLE.AMMO;
    this.heat = 0; this.overheat = false; this.coolDelay = 0;
    this.fireCd = 0; this.gunSide = 1; this.firing = false;
    this.missiles = this.maxMissiles = s.missiles;
    this.missileCd = 0.8;
    this.flares = BATTLE.FLARES; this.flareCd = 0;
    this.boostT = 0; this.boostCd = 0;
    this.shieldT = 0; this.shieldCd = 0;
    this.hitT = 0; this.wobble = 0; this.smokeT = 0; this.fireT = 0;
    this.lastHitBy = null; this.lastHitT = 99; this.assistBy = null;
    this.outside = false; this.zoneT = 0;
    this.lockT = 0; this.lockTarget = null;
    this.alive = true;
    this.trail.reset();
  }

  get boosting() { return this.boostT > 0; }

  update(dt, cmd, world) {
    if (!this.alive) return;
    this.t += dt;
    const st = this.stats;
    let want = cmd.steer ? cmd.angle : this.a;
    // the battleground has a hard edge: aircraft are herded back toward the middle
    if (this.x * this.x + this.y * this.y > BATTLE.MAP_R * BATTLE.MAP_R) want = Math.atan2(-this.y, -this.x);
    const diff = angDiff(this.a, want);
    if (this.boostT > 0) this.boostT -= dt;
    if (this.boostCd > 0) this.boostCd -= dt;
    const turn = st.turn * (this.turnMul || 1) * (this.boosting ? 1.4 : 1) * (this.hp < this.maxHp * 0.25 ? 0.88 : 1);
    this.a = turnToward(this.a, want, turn * dt);
    this.bank += (clamp(diff * 1.4, -1, 1) - this.bank) * Math.min(1, dt * 9);
    const target = this.boosting ? st.speed * 1.55 : st.speed * (0.66 + 0.34 * clamp(cmd.throttle, 0, 1));
    this.speed += (target - this.speed) * Math.min(1, dt * (this.boosting ? 7 : 2.6));
    this.x += Math.cos(this.a) * this.speed * dt;
    this.y += Math.sin(this.a) * this.speed * dt;
    const tail = this.size * 0.8;
    this.trail.add(this.x - Math.cos(this.a) * tail, this.y - Math.sin(this.a) * tail);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitT > 0) this.hitT -= dt;
    if (this.shieldHitT > 0) this.shieldHitT -= dt;
    if (this.wobble > 0) this.wobble = Math.max(0, this.wobble - dt * 3);
    this.lastHitT += dt;
    if (this.flareCd > 0) this.flareCd -= dt;
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0 && this.human) world.audio.sfx('shieldDown', this); }
    if (this.shieldCd > 0) this.shieldCd -= dt;
    if (this.missileCd > 0) this.missileCd -= dt;
    this._gun(dt, cmd, world);
    if (cmd.missile) this.fireMissile(world);
    if (cmd.boost) this.boost(world);
    if (cmd.flare) this.popFlares(world);
    if (cmd.shield) this.raiseShield(world);
    this._damageFx(dt, world);
  }

  // ---- weapons -------------------------------------------------------------
  _gun(dt, cmd, world) {
    this.fireCd -= dt;
    this.firing = false;
    const want = cmd.fire && this.t > 0.35;
    if (this.overheat && this.heat <= BATTLE.HEAT_RESUME) { this.overheat = false; if (this.human) world.audio.sfx('gunReady'); }
    if (want && !this.overheat && this.ammo > 0) {
      this.firing = true;
      this.coolDelay = BATTLE.HEAT_COOL_DELAY;
      if (this.fireCd <= 0) {
        this.fireCd = 1 / this.stats.fireRate;
        this._shoot(world);
      }
    } else {
      if (want && this.human && this.fireCd <= 0) {
        // trigger held but the gun can't fire: tell the pilot why, at a sane rate
        this.fireCd = 0.35;
        world.audio.sfx('empty');
        if (this.ammo <= 0) world.humanHint(this, 'OUT OF AMMO - grab a supply crate');
      }
      if (this.coolDelay > 0) this.coolDelay -= dt;
      else this.heat = Math.max(0, this.heat - BATTLE.HEAT_COOL * dt * (this.overheat ? 0.75 : 1));
    }
  }

  _shoot(world) {
    this.invuln = 0;                      // opening fire ends spawn protection
    const aim = world.aimAngle(this);
    const cos = Math.cos(this.a), sin = Math.sin(this.a), fwd = this.size * 0.9;
    const spread = this.human || this.remote ? 0.012 : 0.012 + (1 - (this.skill || 0.6)) * 0.07;
    const dmg = this.stats.damage * BATTLE.DAMAGE_MUL * (this.human || this.remote ? 1.15 : 1) / (this.guns || 1);
    const one = (side) => {
      const x = this.x + cos * fwd - sin * side, y = this.y + sin * fwd + cos * side;
      const b = world.bullets.fire(x, y, aim + rand(-spread, spread), BATTLE.BULLET_SPEED + this.speed * 0.3, dmg, this.team, BATTLE.BULLET_LIFE, 3.5);
      if (b) { b.owner = this; b.tr = 1; }
      world.vfx.muzzle(x, y, aim);
      world.glow(x + Math.cos(aim) * 6, y + Math.sin(aim) * 6, 22, 0.07, this.team ? '255,120,80' : '255,220,130');   // muzzle flash
      if (this.human && Math.random() < 0.5) world.vfx.debris(x - cos * 6, y - sin * 6, 1, ['#E8C060', '#C9A040']);  // spent casings
    };
    if ((this.guns || 1) === 1) { one(6 * this.gunSide); this.gunSide = -this.gunSide; }
    else { one(9); one(-9); if (this.guns === 3) one(0); }
    this.ammo--;
    this.heat = Math.min(1, this.heat + BATTLE.HEAT_PER_SHOT);
    if (this.heat >= 1) {
      this.overheat = true;
      world.vfx.smoke(this.x + cos * fwd, this.y + sin * fwd, 7, 0.7, '230,230,230');
      if (this.human) { world.audio.sfx('overheat'); world.humanHint(this, 'GUN OVERHEATED - ease off the trigger'); }
    }
    if (this.ammo === 30 && this.human) world.audio.sfx('lowAmmo');
    world.audio.sfx(this.human ? 'shoot' : 'enemyShoot', this);
    if (this.human && Math.random() < 0.3) world.audio.sfx('casing', this);
  }

  fireMissile(world) {
    if (this.missileCd > 0 || this.t < 0.35) return false;
    if (this.missiles <= 0) {
      if (this.human) { world.audio.sfx('empty'); world.humanHint(this, 'NO MISSILES LEFT - supply crates carry more'); this.missileCd = 0.5; }
      return false;
    }
    const tgt = world.missileTarget(this, this.human ? world.tlkTgt : null);
    this.missiles--; this.mShots = (this.mShots | 0) + 1;
    this.missileCd = BATTLE.MISSILE_CD;
    const s = Math.sin(this.a), c = Math.cos(this.a), side = this.missiles % 2 ? 1 : -1, off = this.size * 0.7 * side;
    const x = this.x - s * off, y = this.y + c * off;
    this.invuln = 0;
    world.launchMissile(this, x, y, this.a + 0.18 * side, this.stats.missileDmg * BATTLE.MISSILE_DMG_MUL, tgt);
    world.vfx.burst(x, y, 4, 60, 6, 0.25);
    for (let i = 0; i < 3; i++) world.vfx.smoke(x - c * 8 * i, y - s * 8 * i, 5, 0.5);
    world.audio.sfx('missile', this);
    return true;
  }

  boost(world) {
    if (this.boostCd > 0) return false;
    this.boostT = BATTLE.BOOST_TIME; this.boostCd = BATTLE.BOOST_CD;
    world.vfx.ring(this.x, this.y, 8, 60, 0.32, '255,210,140', 4);
    world.glow(this.x - Math.cos(this.a) * this.size, this.y - Math.sin(this.a) * this.size, 70, 0.35, '255,170,90');
    world.audio.sfx('boost', this);
    return true;
  }

  /** Energy shield: a few seconds of immunity to bullets and missiles (not the zone). */
  raiseShield(world) {
    if (this.shieldCd > 0 || this.shieldT > 0) {
      if (this.human && this.shieldCd > 0) { world.audio.sfx('empty'); world.humanHint(this, `SHIELD RECHARGING - ${Math.ceil(this.shieldCd)}s`); }
      return false;
    }
    this.shieldT = BATTLE.SHIELD_TIME; this.shieldCd = BATTLE.SHIELD_CD + BATTLE.SHIELD_TIME;
    world.vfx.ring(this.x, this.y, this.size, this.size * 3, 0.4, '140,220,255', 5);
    world.glow(this.x, this.y, 90, 0.4, '120,200,255');
    world.audio.sfx('shieldUp', this);
    return true;
  }

  popFlares(world) {
    if (this.flareCd > 0 || this.flares <= 0) return 0;
    this.flares--; this.flareCd = BATTLE.FLARE_CD; this.fShots = (this.fShots | 0) + 1;
    const decoys = world.flares.deploy(this, 4);
    let n = 0;
    if (decoys.length) {
      for (const m of world.missiles.pool.active) {
        if (!m.alive || m.team === this.team || m.decoy) continue;
        if ((m.x - this.x) ** 2 + (m.y - this.y) ** 2 < 440 * 440) { m.decoy = decoys[n % decoys.length]; n++; }
      }
    }
    for (const f of decoys) world.glow(f.x, f.y, 40, 0.5, '255,220,150');
    if (n && this.human) world.vfx.text(this.x, this.y - 40, n > 1 ? `${n} MISSILES DECOYED` : 'MISSILE DECOYED', '#FFE38A', 20);
    world.audio.sfx('flare', this);
    return n;
  }

  refill(ammo, missiles) {
    this.ammo = Math.min(this.maxAmmo, this.ammo + ammo);
    this.missiles = Math.min(this.maxMissiles, this.missiles + missiles);
    this.flares = Math.min(BATTLE.FLARES, this.flares + 1);
    this.heat = 0; this.overheat = false;
  }

  // ---- damage ---------------------------------------------------------------
  /** Returns true if the hit landed. `src` is the attacking Fighter or null (zone). */
  damage(amount, src, world, hx, hy, kind = 'bullet') {
    if (!this.alive || world.over) return false;
    if (this.invuln > 0 && kind !== 'zone') {
      world.vfx.ring(this.x, this.y, this.r + 6, this.r + 18, 0.2, '200,230,255', 3);
      return false;
    }
    if (this.shieldT > 0 && kind !== 'zone') {
      // the hit splashes off the bubble
      const a = Math.atan2(hy - this.y, hx - this.x), R = this.size * 1.6;
      world.vfx.spark(this.x + Math.cos(a) * R, this.y + Math.sin(a) * R, a, kind === 'missile' ? 10 : 3, '#BFEFFF');
      this.shieldHitT = 0.15; this.shieldHitA = a;
      world.audio.sfx('shieldHit', this);
      if (src && src.human && src !== this) world.vfx.text(this.x, this.y - this.size * 2, 'SHIELDED', '#BFEFFF', 16);
      return false;
    }
    if ((this.human || this.remote) && kind !== 'zone') amount *= world.armor;     // the player's jet is a little tougher than the bots'
    this.hp -= amount;
    this.hitT = 0.09;
    if (kind !== 'zone') {
      this.wobble = Math.min(1, this.wobble + (kind === 'missile' ? 1 : 0.35));
      if (src && src !== this) {
        if (this.lastHitBy && this.lastHitBy !== src && this.lastHitT < BATTLE.ASSIST_WINDOW) this.assistBy = this.lastHitBy;
        this.lastHitBy = src; this.lastHitT = 0;
        src.dmgDealt += amount;
      }
      const ang = Math.atan2(this.y - hy, this.x - hx);
      world.vfx.spark(hx, hy, ang, kind === 'missile' ? 10 : 5, src && src.team === 1 ? '#FFB09A' : '#FFF0B8');
      if (Math.random() < (kind === 'missile' ? 1 : 0.35)) world.vfx.debris(hx, hy, kind === 'missile' ? 6 : 1, this.debris);
      if (kind === 'missile') {
        world.vfx.explosionSmall(hx, hy, this.debris);
        world.glow(hx, hy, 90, 0.4, '255,160,80');
      } else world.glow(hx, hy, 22, 0.14, src && src.team === 1 ? '255,110,80' : '255,230,150');
    }
    world.onHit(this, src, amount, kind, hx, hy);
    if (this.hp <= 0) { this.hp = 0; world.killFighter(this, src, kind); }
    return true;
  }

  /** Visible damage states: grey smoke below half health, fire and black smoke below a quarter. */
  _damageFx(dt, world) {
    const k = this.hp / this.maxHp;
    if (k >= 0.55) return;
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      const bx = this.x - Math.cos(this.a) * this.size * 0.5, by = this.y - Math.sin(this.a) * this.size * 0.5;
      if (k < 0.28) {
        this.smokeT = 0.035;
        world.vfx.smoke(bx, by, 6, 0.9, '40,34,34');
        world.vfx.burst(bx, by, 1, 30, 5, 0.22);
        if (Math.random() < 0.25) world.glow(bx, by, 22, 0.15, '255,140,60');
      } else {
        this.smokeT = 0.08;
        world.vfx.smoke(bx, by, 5, 0.7, '95,90,90');
      }
    }
  }

  // ---- drawing --------------------------------------------------------------
  _renderShield(ctx) {
    const fade = this.shieldT < 1 ? 0.45 + 0.55 * Math.abs(Math.sin(this.t * 18)) : 1;   // flickers before it drops
    const R = this.size * 1.6 + Math.sin(this.t * 7) * 1.5;
    const g = ctx.createRadialGradient(this.x, this.y, R * 0.55, this.x, this.y, R);
    g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.8, `rgba(120,200,255,${0.18 * fade})`); g.addColorStop(1, `rgba(200,240,255,${0.55 * fade})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
    // rotating hex segments
    ctx.strokeStyle = `rgba(220,248,255,${0.8 * fade})`; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = this.t * 1.6 + (i * TAU) / 6;
      ctx.beginPath(); ctx.arc(this.x, this.y, R, a, a + 0.6); ctx.stroke();
    }
    if (this.shieldHitT > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${this.shieldHitT / 0.15})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(this.x, this.y, R, this.shieldHitA - 0.5, this.shieldHitA + 0.5); ctx.stroke();
    }
  }

  render(ctx, q, time, isFocus) {
    if (!this.alive) return;
    const lk = this.lift === undefined ? 1 : this.lift;
    if (lk < 1) { ctx.save(); ctx.translate(this.x, this.y); const sc = 0.8 + 0.2 * lk; ctx.scale(sc, sc); ctx.translate(-this.x, -this.y); this._render(ctx, q, time, isFocus); ctx.restore(); return; }
    this._render(ctx, q, time, isFocus);
  }
  _render(ctx, q, time, isFocus) {
    const tail = this.size * 0.8, tx = this.x - Math.cos(this.a) * tail, ty = this.y - Math.sin(this.a) * tail;
    this.trail.drawRibbon(ctx, tx, ty, (this.human ? 6 : 4) * q + 3, this.boosting ? '255,226,190' : '255,255,255', this.human ? 0.34 : 0.24, q > 0.6 ? 8 : 4);
    // team marker: a full ring for the player, a small chevron arc for everyone else (less clutter)
    const pilot = this.human || this.remote;
    ctx.strokeStyle = `rgba(${this.color.rgb},${pilot ? 0.85 : 0.6})`;
    ctx.lineWidth = pilot ? 3 : 2.5;
    ctx.beginPath();
    if (pilot) ctx.arc(this.x, this.y, this.size * 1.12, 0, TAU);
    else ctx.arc(this.x, this.y, this.size * 1.05, this.a + Math.PI - 0.7, this.a + Math.PI + 0.7);
    ctx.stroke();
    const blink = this.invuln > 0 && Math.sin(this.t * 30) > 0.3;
    const power = (0.7 + 0.6 * (this.speed / this.stats.speed)) * (this.boosting ? 1.6 : 1);
    const wob = this.wobble > 0 ? Math.sin(this.t * 60) * 0.18 * this.wobble : 0;
    drawEngines(ctx, this.art, this.size, this.x, this.y, this.a + wob, this.t, power, this.bank);
    drawSprite(ctx, this.sprite, this.x, this.y, this.a + wob, this.bank, blink ? 0.45 : 1, this.hitT > 0);
    if (this.hitT > 0) {                                   // red damage tint over the white flash
      ctx.fillStyle = `rgba(255,60,40,${(this.hitT / 0.09 * 0.35).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.9, 0, TAU); ctx.fill();
    }
    if (this.shieldT > 0) this._renderShield(ctx);
    if (this.invuln > 0) {
      ctx.strokeStyle = `rgba(${this.color.rgb},${0.35 + 0.3 * Math.sin(this.t * 10)})`; ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -this.t * 40;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 1.5, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    // name tag + health bar: bots only show them while damaged or close to the player
    const y0 = this.y - this.size * 1.35 - 6;
    if (!this.human && !this.tagged) return;
    if (!this.human || !isFocus) {
      const w = this.size * 1.6;
      ctx.fillStyle = 'rgba(20,14,12,0.45)'; ctx.fillRect(this.x - w / 2 - 1, y0 - 1, w + 2, 5);
      ctx.fillStyle = this.color.main; ctx.fillRect(this.x - w / 2, y0, w * (this.hp / this.maxHp), 3);
    }
    ctx.font = `${this.human || this.remote ? 15 : 12}px "Bebas Neue", Impact, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,14,12,0.6)';
    ctx.strokeText(this.tag, this.x, y0 - 2);
    ctx.fillStyle = this.human ? '#FFFFFF' : this.color.light;
    ctx.fillText(this.tag, this.x, y0 - 2);
  }
}
