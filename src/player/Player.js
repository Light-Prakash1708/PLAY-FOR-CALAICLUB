// The player's aircraft: flight model, health, shield and rendering.
import { CONFIG } from '../core/GameConfig.js';
import { clamp, angDiff, turnToward, TAU } from '../core/utils.js';
import { getSprite, drawSprite, drawEngines } from '../art/PlaneArt.js';
import { PLAYER_ART } from '../art/planeSpecs.js';
import { Trail } from '../combat/Trail.js';

export class Player {
  constructor() { this.trail = new Trail(30, 9); this.alive = false; }

  reset(aircraft, stats, sensitivity) {
    this.def = aircraft;
    this.stats = stats;
    this.art = PLAYER_ART[aircraft.id];
    this.sprite = getSprite('p_' + aircraft.id, this.art, aircraft.size);
    this.sens = sensitivity;
    this.x = 0; this.y = 0; this.a = -Math.PI / 2;
    this.speed = stats.speed * 0.7;
    this.bank = 0;
    this.hp = this.maxHp = Math.round(stats.hp);
    this.invuln = 1.5;          // spawn protection
    this.shield = 0; this.rapid = 0; this.spreadT = 0;
    this.boostT = 0; this.boostCd = 0; this.boosts = 0;
    this.alive = true;
    this.outside = false;
    this.t = 0; this.smokeT = 0;
    this.turned = 0;            // total radians steered (tutorial)
    this.hitT = 0; this.wobble = 0; this.lift = 1;
    this.trail.reset();
  }

  update(dt, cmd, world) {
    if (!this.alive) return;
    this.t += dt;
    const st = this.stats;
    let want = cmd.steer ? cmd.angle : this.a;
    const d = Math.hypot(this.x, this.y);
    this.outside = d > (world.arenaR || CONFIG.ARENA_RADIUS);
    if (this.outside) want = Math.atan2(-this.y, -this.x);      // gently herded back into the combat zone
    const diff = angDiff(this.a, want);
    const before = this.a;
    const boosting = this.boostT > 0;
    if (boosting) this.boostT -= dt;
    if (this.boostCd > 0) this.boostCd -= dt;
    this.a = turnToward(this.a, want, st.turn * this.sens * (boosting ? CONFIG.BOOST_TURN : 1) * dt);
    this.turned += Math.abs(this.a - before);
    this.bank += (clamp(diff * 1.4, -1, 1) - this.bank) * Math.min(1, dt * 9);
    // throttle: acceleration / deceleration toward a target speed
    const target = boosting ? st.speed * CONFIG.BOOST_SPEED : st.speed * (0.66 + 0.34 * clamp(cmd.throttle, 0, 1));
    this.speed += (target - this.speed) * Math.min(1, dt * (boosting ? 7 : 2.6));
    if (boosting && (this.smokeT -= dt) <= 0) { this.smokeT = 0.03; world.vfx.smoke(this.x - Math.cos(this.a) * this.def.size, this.y - Math.sin(this.a) * this.def.size, 5, 0.4, '255,220,170'); }
    this.x += Math.cos(this.a) * this.speed * dt;
    this.y += Math.sin(this.a) * this.speed * dt;
    this.trail.add(this.x - Math.cos(this.a) * this.def.size * 0.8, this.y - Math.sin(this.a) * this.def.size * 0.8);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitT > 0) this.hitT -= dt;
    if (this.wobble > 0) this.wobble = Math.max(0, this.wobble - dt * 3);
    if (this.shield > 0) this.shield -= dt;
    if (this.rapid > 0) this.rapid -= dt;
    if (this.spreadT > 0) this.spreadT -= dt;
    // damage smoke when badly hurt
    if (this.hp < this.maxHp * 0.35) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.07; world.vfx.smoke(this.x, this.y, 5, 0.6, '70,60,60'); }
    }
  }

  /** Returns 'hit', 'shield' or false (ignored). One collision can never hurt twice. */
  damage(amount, world) {
    if (!this.alive || world.ending || world.bossDeath) return false;
    if (this.invuln > 0 || world.game.devGod) return false;
    if (this.shield > 0) {
      this.invuln = 0.35;
      world.vfx.ring(this.x, this.y, 26, 52, 0.25, '120,170,255', 4);
      world.audio.sfx('shieldHit');
      return 'shield';
    }
    this.hp -= amount;
    this.invuln = CONFIG.INVULN_TIME;
    this.hitT = 0.12; this.wobble = Math.min(1, (this.wobble || 0) + (amount >= 20 ? 1 : 0.5));
    world.stats.damageTaken += amount;
    world.hurtA = Math.min(1, (world.hurtA || 0) + (amount >= 20 ? 0.5 : 0.25));
    world.vfx.flash('226,59,63', amount >= 20 ? 0.42 : 0.26);
    world.vfx.shake(amount >= 20 ? 11 : 7);
    world.vfx.spark(this.x, this.y, Math.random() * TAU, 8, '#FFD0A0');
    world.audio.sfx('hurt');
    world.vibrate(amount >= 20 ? 90 : 45);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; world.onPlayerDeath(); }
    return 'hit';
  }
  /** Afterburner burst. Returns false while recharging. */
  boost(world) {
    if (!this.alive || this.boostCd > 0 || world.ending) return false;
    this.boostT = CONFIG.BOOST_TIME; this.boostCd = CONFIG.BOOST_COOLDOWN; this.boosts++;
    world.vfx.ring(this.x, this.y, 8, 54, 0.3, '255,210,140', 4);
    world.audio.sfx('boost');
    return true;
  }
  heal(frac) { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * frac); }

  render(ctx, q) {
    if (!this.alive) return;
    const lk = this.lift === undefined ? 1 : this.lift;
    if (lk < 1) { ctx.save(); ctx.translate(this.x, this.y); const sc = 0.8 + 0.2 * lk; ctx.scale(sc, sc); ctx.translate(-this.x, -this.y); this._render(ctx, q); ctx.restore(); return; }
    this._render(ctx, q);
  }
  _render(ctx, q) {
    this.trail.drawRibbon(ctx, this.x - Math.cos(this.a) * this.def.size * 0.8, this.y - Math.sin(this.a) * this.def.size * 0.8, 6 * q + 4, '255,255,255', 0.34, q > 0.6 ? 10 : 5);
    const blink = this.invuln > 0 && !this.shield && Math.sin(this.t * 38) > 0;
    const power = (0.7 + 0.6 * (this.speed / this.stats.speed)) * (this.boostT > 0 ? 1.5 : 1);
    const wob = this.wobble > 0 ? Math.sin(this.t * 60) * 0.18 * this.wobble : 0;   // knocked about by the hit
    drawEngines(ctx, this.art, this.def.size, this.x, this.y, this.a + wob, this.t, power, this.bank);
    drawSprite(ctx, this.sprite, this.x, this.y, this.a + wob, this.bank, blink && this.hitT <= 0 ? 0.4 : 1, this.hitT > 0);
    if (this.hitT > 0) {
      ctx.fillStyle = `rgba(255,60,40,${(this.hitT / 0.12 * 0.35).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.def.size * 0.9, 0, TAU); ctx.fill();
    }
    if (this.shield > 0) {
      const fade = this.shield < 1.5 ? 0.5 + 0.5 * Math.sin(this.t * 22) : 1;
      const r = this.def.size * 1.55 + Math.sin(this.t * 6) * 1.5;
      ctx.fillStyle = `rgba(110,170,255,${0.16 * fade})`;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(215,235,255,${0.9 * fade})`; ctx.lineWidth = 2.5;
      ctx.setLineDash([14, 9]); ctx.lineDashOffset = -this.t * 40;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
