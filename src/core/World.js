// The gameplay simulation for one mission. Owns every in-flight object and is
// rebuilt from scratch state on each start(), so restarts are always clean.
import { CONFIG } from './GameConfig.js';
import { rand, TAU, clamp } from './utils.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { WeaponSystem } from '../player/WeaponSystem.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { ProjectileSystem } from '../combat/Projectile.js';
import { MissileSystem } from '../combat/Missile.js';
import { PickupSystem, PICKUP_COLORS } from '../combat/Pickup.js';
import { FlareSystem } from '../combat/Flare.js';
import { runCollisions } from '../combat/CollisionSystem.js';
import { explode, BossDeath } from '../combat/Explosion.js';
import { VFXManager } from '../systems/VFXManager.js';
import { LevelManager } from '../systems/LevelManager.js';
import { drawSprite } from '../art/PlaneArt.js';
import { shadowSprite, drawGlows, stepGlows, drawWisps, screenGrade, THEME_GRADE } from '../systems/Cinema.js';
import { drawAirbase, drawCloudPunch, takeoffCurves } from '../systems/Takeoff.js';

export class World {
  constructor(game) {
    this.game = game;
    this.audio = game.audio;
    this.bg = game.background;
    this.view = game.view;
    this.vfx = new VFXManager();
    this.player = new Player();
    this.controller = new PlayerController(game.input);
    this.weapons = new WeaponSystem(this.player);
    this.enemies = new EnemyManager();
    this.bullets = new ProjectileSystem();
    this.missiles = new MissileSystem();
    this.pickups = new PickupSystem();
    this.flares = new FlareSystem();
    this.cam = { x: 0, y: 0 };
    this.level = null;
    this.ending = null;
    this.running = false;
    this.glows = [];
  }

  start(levelDef, aircraft, stats, settings) {
    this.vfx.reset(); this.enemies.reset(); this.bullets.reset(); this.missiles.reset(); this.pickups.reset(); this.flares.reset();
    this.quality = CONFIG.QUALITY[settings.quality];
    this.vfx.density = this.quality.particles;
    this.threatT = 0;
    this.vibration = settings.vibration;
    this.touch = this.game.input.usedTouch || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    this.player.reset(aircraft, stats, settings.sensitivity);
    this.controller.autopilot = null;
    this.weapons.reset();
    this.assist = settings.assist || 0;
    this.level = new LevelManager(this, levelDef);
    this.stats = { score: 0, coins: 0, kills: 0, stars: 0, damageTaken: 0, time: 0, hpLeft: 0, hpMax: this.player.maxHp, settled: false, result: null };
    this.ending = null;
    this.bossDeath = null;
    this.boss = null; this.hadBoss = false;
    this.slowT = 0; this.timeScale = 1;
    this.time = 0;
    this.starT = 4;
    this.cam.x = 0; this.cam.y = -60;
    this.outsideT = 0;
    // presentation: push-in camera + letterbox at the start, a closing zone for boss fights
    this.z = 1.45; this.lb = 1; this.introT = 2.2;
    this.arenaR = CONFIG.ARENA_RADIUS; this.arenaTarget = this.arenaR; this.zoneOn = false;
    this.midSaid = false; this.lowSaid = false; this.hurtA = 0;
    this.glows.length = 0;
    // take-off: start on a runway below the arena centre and climb away
    const pl = this.player;
    pl.y = 420; pl.speed = pl.stats.speed * 0.25; pl.lift = 0; pl.boostT = 1.4;
    this.runway = { x: 0, y: 160, a: -Math.PI / 2, alpha: 1, alt: 0, wid: 150, lanes: 1 }; this.punch = 0; this.tkoT = 0; this.gearSaid = false; this.punchSaid = false;
    this.cam.x = 0; this.cam.y = 360;
    this.running = true;
    this.bg.setTheme(levelDef.theme);
  }
  stop() { this.running = false; this.audio.setMissileLoop(false); }

  // ---- helpers used by entities ---------------------------------------------
  addScore(n) { this.stats.score += n; }
  glow(x, y, r, life, rgb) { if (this.glows.length < 80) this.glows.push({ x, y, r, life, max: life, rgb }); }
  say(id, prio) { if (this.game.radio) this.game.radio.say(id, prio); }
  /** Boss fights: the arena closes in so the duel can't turn into an endless chase. */
  startBossZone() {
    this.zoneOn = true; this.arenaTarget = 950;
    this.say('camp.zone', 'low');
  }
  hint(text, dur) { this.game.hud.hint(text, dur); }
  vibrate(p) { if (this.vibration && navigator.vibrate) { try { navigator.vibrate(p); } catch (_) {} } }

  damageEnemy(e, dmg, x, y, ang) {
    if (!e.alive || e.dying) return;
    if (e.def.boss && e.invuln > 0) { this.vfx.spark(x, y, ang, 2, '#FFFFFF'); return; }
    e.hp -= dmg;
    e.flash = 0.07;
    if (e.def.cloak) e.alpha = Math.max(e.alpha, 0.85);
    this.vfx.spark(x, y, ang, 3);
    this.audio.sfx('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e, silent = false) {
    const d = e.def, st = this.stats;
    if (!silent) {
      st.kills++; st.score += d.score; st.coins += d.coins;
      this.vfx.text(e.x, e.y - d.size - 6, `+${d.coins}`, '#FFD24A', d.boss ? 30 : 19);
    }
    if (d.boss) {
      // staged destruction with slow motion; the level completes when it ends
      e.dying = true; e.hp = 0;
      this.bossDeath = new BossDeath(e);
      this.slowT = 2.6;
      this.bullets.clearEnemy(e.x, e.y, 99999);
      for (const m of this.missiles.pool.active) if (m.team === 1) this.missiles.fizzle(m, this);
      this.game.onBossDying(e);
      return;
    }
    e.alive = false;
    explode(this, d.explosion, e.x, e.y, e.debris);
    this.glow(e.x, e.y, d.explosion === 'large' ? 170 : 110, 0.5, '255,150,70');
    if (silent) return;
    this._drop(e);
    this.level.onKill(e);
  }

  _drop(e) {
    const p = this.player, big = e.def.explosion === 'large';
    const r = Math.random();
    const lowHp = p.hp < p.maxHp * 0.5, noMiss = this.weapons.missiles <= 1;
    let c = 0.3;
    if (r < c) this.pickups.spawn('coin', e.x, e.y, 10, 40);
    else if (r < (c += 0.12)) this.pickups.spawn('star', e.x, e.y, 0, 30);
    else if (r < (c += lowHp ? 0.22 : 0.045)) this.pickups.spawn('health', e.x, e.y, 0, 30);
    else if (r < (c += noMiss ? 0.12 : 0.06)) this.pickups.spawn('missile', e.x, e.y, 0, 30);
    else if (r < (c += 0.035)) this.pickups.spawn('shield', e.x, e.y, 0, 30);
    else if (r < (c += 0.04)) this.pickups.spawn('rapid', e.x, e.y, 0, 30);
    if (big) for (let i = 0; i < 2; i++) this.pickups.spawn('coin', e.x, e.y, 10, 110);
  }

  collect(pk) {
    const p = this.player, st = this.stats;
    let label = '', color = '#FFFFFF';
    switch (pk.kind) {
      case 'coin': st.coins += pk.value; st.score += 10; label = `+${pk.value}`; color = '#FFD24A'; this.audio.sfx('coin'); break;
      case 'star': st.stars++; st.score += 100; label = '+100'; color = '#FFB640'; this.audio.sfx('star'); break;
      case 'health': p.heal(0.3); label = 'REPAIR'; color = '#FF8A8A'; this.audio.sfx('heal'); break;
      case 'missile': this.weapons.addMissiles(3); this.weapons.addSpecial(1); this.weapons.addFlares(2); label = 'RESUPPLY'; this.audio.sfx('powerup'); break;
      case 'shield': p.shield = CONFIG.SHIELD_TIME; label = 'SHIELD'; color = '#BFD8FF'; this.audio.sfx('shield'); break;
      case 'rapid': p.rapid = CONFIG.RAPID_TIME; label = 'RAPID FIRE'; color = '#FFE96B'; this.audio.sfx('powerup'); break;
    }
    this.vfx.collect(pk.x, pk.y, PICKUP_COLORS[pk.kind]);
    this.vfx.text(pk.x, pk.y - 24, label, color, 20);
  }

  bomb(x, y, dmg) {
    const v = this.vfx;
    v.ring(x, y, 20, 380, 0.55, '255,240,200', 14);
    v.ring(x, y, 10, 260, 0.4, '255,255,255', 8);
    v.burst(x, y, 24, 420, 16, 0.6);
    v.flash('255,255,255', 0.5); v.shake(16);
    this.audio.sfx('bomb');
    this.vibrate(80);
    this.bullets.clearEnemy(x, y, 420);
    for (const m of this.missiles.pool.active) if (m.team === 1 && (m.x - x) ** 2 + (m.y - y) ** 2 < 420 * 420) this.missiles.explode(m, this);
    const list = this.enemies.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.alive && !e.dying && (e.x - x) ** 2 + (e.y - y) ** 2 < (350 + e.r) ** 2) this.damageEnemy(e, dmg, e.x, e.y, 0);
    }
  }

  onBossPhase(e) {
    this.game.hud.banner(`PHASE ${e.phase + 1}`, e.def.name, 1.6, true);
    // a breather between phases: repairs and ammunition shake loose
    this.pickups.spawn('health', e.x, e.y, 0, 200);
    this.pickups.spawn('missile', e.x, e.y, 0, 200);
  }
  /** Supply drop a short distance ahead of the player (between waves). */
  supplyDrop(kind) {
    const p = this.player;
    this.pickups.spawn(kind, p.x + Math.cos(p.a) * 170, p.y + Math.sin(p.a) * 170, 0, 40);
  }

  onPlayerDeath() {
    const p = this.player;
    this.vfx.explosionLarge(p.x, p.y, [p.art.colors.body, p.art.colors.wing, '#FFFFFF']);
    this.vfx.explosionLarge(p.x + 10, p.y - 8);
    this.vfx.debris(p.x, p.y, 14, [p.art.colors.body, p.art.colors.accent]);
    this.vfx.flash('255,255,255', 0.6);
    this.glow(p.x, p.y, 220, 0.8, '255,140,60');
    this.say('camp.dead', 'high');
    this.audio.sfx('explodeL');
    this.vibrate([80, 40, 160]);
    this.slowT = 0.8;
    this.finish(false);
  }

  /** Single entry point for ending a mission. Further calls are ignored. */
  finish(win) {
    if (this.ending) return;
    const p = this.player, final = win && !!this.level.def.finale;
    this.ending = { win, t: 0, delay: win ? (final ? 6.5 : this.hadBoss ? 3.0 : 2.0) : 2.0, reported: false, chainT: 0.25, fxT: 0, final };
    this.stats.hpLeft = Math.max(0, p.hp);
    if (win) {
      this.stats.score += Math.round((p.hp / p.maxHp) * 300 * this.level.def.difficulty) + Math.round(Math.max(0, this.level.def.par - this.stats.time) * 8);
      this.bullets.clearEnemy(p.x, p.y, 99999);
      for (const m of this.missiles.pool.active) if (m.team === 1) this.missiles.fizzle(m, this);
      if (final) {
        // victory fly-by: the aircraft loops while fireworks go off
        let dir = 1;
        this.controller.autopilot = (pl) => ({ steer: true, angle: pl.a + dir * 1.2, throttle: 1 });
      }
    }
    this.game.input.enabled = false;
    this.game.onMissionEnding(win);
  }

  // ---- frame update -----------------------------------------------------------
  update(realDt) {
    if (!this.running) return;
    if (this.slowT > 0) { this.slowT -= realDt; this.timeScale += (0.3 - this.timeScale) * Math.min(1, realDt * 12); }
    else this.timeScale += (1 - this.timeScale) * Math.min(1, realDt * 4);
    const dt = realDt * this.timeScale;
    const p = this.player, input = this.game.input;
    this.time += dt;
    if (!this.ending) this.stats.time += dt;

    input.poll();
    p.update(dt, this.controller.read(p, dt), this);
    this.weapons.update(dt, input, this);
    this.level.update(dt);
    this.enemies.update(dt, this);
    this.bullets.update(dt);
    this.missiles.update(dt, this);
    this.flares.update(dt, this);
    this.pickups.update(dt, this);
    runCollisions(this);

    if (this.bossDeath) {
      const bd = this.bossDeath;
      bd.update(realDt, this);
      if (bd.done) {
        const b = bd.boss;
        this.bossDeath.finished = true;
        b.alive = false;
        for (let i = 0; i < 10; i++) this.pickups.spawn('coin', b.x, b.y, 10, 260);
        for (let i = 0; i < 3; i++) this.pickups.spawn('star', b.x, b.y, 0, 180);
        this.bossDeath = null; this.hadBoss = true;
        this.level.onBossDead();
      }
    }

    // ambient stars to chase, as in the reference game
    if (!this.ending && p.alive) {
      this.starT -= dt;
      if (this.starT <= 0) {
        this.starT = rand(6, 9);
        if (this.pickups.count('star') < 3) {
          const a = p.a + rand(-1.2, 1.2), d = rand(240, 400);
          this.pickups.spawn('star', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        }
      }
      if (p.outside) { this.outsideT -= dt; if (this.outsideT <= 0) { this.outsideT = 3; this.hint('Leaving the combat zone - turning back', 2); } }
    }

    // missile warning tone, plus a one-time reminder about flares
    if (this.missiles.threats > 0 && p.alive && !this.ending) {
      this.threatT -= realDt;
      if (this.threatT <= 0) { this.threatT = 0.42; this.audio.sfx('lock'); }
      if (!this.game.flareHintShown) { this.game.flareHintShown = true; this.hint(this.touch ? 'Missile incoming! Tap FLARES or turn hard' : 'Missile incoming! Press F for flares or turn hard', 4); }
    }
    this.vfx.update(dt);
    this.bg.update(dt);
    stepGlows(this.glows, dt);
    // story beats over the radio
    if (!this.ending) {
      const id = this.level.def.id;
      if (!this.midSaid && this.level.progress() >= 0.5) { this.midSaid = true; this.say(`m${id}.mid`, 'normal'); }
      if (p.alive && p.hp < p.maxHp * 0.3 && !this.lowSaid) { this.lowSaid = true; this.say('camp.lowhp', 'low'); }
      if (p.hp > p.maxHp * 0.6) this.lowSaid = false;
    }
    // presentation: intro push-in, letterbox, closing boss zone
    if (this.introT > 0) this.introT -= realDt;
    this.z += (1 - this.z) * Math.min(1, realDt * (this.introT > 0 ? 1.3 : 3));
    const lbT = this.introT > 0.3 || this.ending || this.bossDeath ? 1 : this.level.bossState === 'warning' ? 0.6 : 0;
    this.lb += (lbT - this.lb) * Math.min(1, realDt * 4);
    if (this.arenaR > this.arenaTarget) this.arenaR = Math.max(this.arenaTarget, this.arenaR - 32 * dt);
    if (this.hurtA > 0) this.hurtA = Math.max(0, this.hurtA - realDt * 1.4);
    // take-off from the airbase: roll, rotate and climb, then punch through the clouds
    if (this.tkoT < 3.4) {
      this.tkoT += realDt;
      const sm = takeoffCurves.smooth, alt = sm(0.9, 2.6, this.tkoT);
      p.lift = alt; this.runway.alt = alt; this.runway.alpha = 1 - sm(0.5, 0.95, alt);
      this.punch = this.tkoT > 1.9 && this.tkoT < 2.9 ? this.tkoT - 1.9 : 0;
      if (this.tkoT > 0.9 && !this.gearSaid) { this.gearSaid = true; this.audio.sfx('gearUp'); }
      if (this.tkoT > 2.0 && !this.punchSaid) { this.punchSaid = true; this.audio.sfx('flyby'); }
    } else { p.lift = 1; this.runway.alpha = 0; this.punch = 0; }
    // camera leads slightly in the direction of travel
    const lead = 46;
    const tx = p.x + Math.cos(p.a) * lead, ty = p.y + Math.sin(p.a) * lead;
    const k = Math.min(1, realDt * 5);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.audio.setMissileLoop(this.missiles.playerAirborne > 0);

    if (this.ending) this._updateEnding(realDt);
  }

  _updateEnding(dt) {
    const en = this.ending, p = this.player;
    en.t += dt;
    if (en.win) {
      // surviving enemies go down in a chain reaction
      en.chainT -= dt;
      if (en.chainT <= 0) {
        en.chainT = 0.13;
        for (const e of this.enemies.list) if (e.alive && !e.dying && !e.def.boss) { this.killEnemy(e, true); break; }
      }
      if (en.final) {
        en.fxT -= dt;
        if (en.fxT <= 0 && en.t > 0.6) {
          en.fxT = 0.28;
          const x = this.cam.x + rand(-0.4, 0.4) * this.view.w, y = this.cam.y + rand(-0.4, 0.3) * this.view.h;
          this.vfx.confetti(x, y, 22);
          this.vfx.ring(x, y, 6, 70, 0.4, '255,255,255', 4);
          this.audio.sfx(Math.random() < 0.5 ? 'starPop' : 'explodeS');
        }
      }
    }
    if (en.t >= en.delay && !en.reported) {
      en.reported = true;
      this.game.onMissionEnd(en.win);
    }
  }

  // ---- rendering --------------------------------------------------------------
  render(ctx) {
    const v = this.view, cam = this.cam, q = this.quality.trails;
    this.bg.render(ctx, cam, v.w, v.h);
    const z = this.z || 1;
    ctx.save();
    ctx.translate(v.w / 2 + this.vfx.sx, v.h / 2 + this.vfx.sy);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);
    this._arena(ctx);
    if (this.runway.alpha > 0.01) drawAirbase(ctx, this.runway, this.runway.alpha, 1 / (1 + this.runway.alt * 5), cam, this.time, this.player.sprite, this.bg.theme);
    this.pickups.render(ctx);
    const hw = v.w / 2 / z + 140, hh = v.h / 2 / z + 140;
    const list = this.enemies.list;
    // ground shadows sell the height when there is terrain below
    if (this.bg.ground && this.quality.particles >= 0.5) {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.alpha < 0.5 || Math.abs(e.x - cam.x) > hw || Math.abs(e.y - cam.y) > hh) continue;
        drawSprite(ctx, shadowSprite(e.sprite), e.x + 26, e.y + 38, e.a, e.bank, 0.2);
      }
      const pl = this.player;
      const so = 4 + 22 * (pl.lift === undefined ? 1 : pl.lift);
      if (pl.alive) drawSprite(ctx, shadowSprite(pl.sprite), pl.x + so, pl.y + so * 1.45, pl.a, pl.bank, 0.22);
    }
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || Math.abs(e.x - cam.x) > hw + e.r || Math.abs(e.y - cam.y) > hh + e.r) continue;
      e.render(ctx, this.time, q);
    }
    this.flares.render(ctx, this.time);
    this.missiles.render(ctx, this.time);
    this.player.render(ctx, q);
    this.bullets.render(ctx);
    this.vfx.render(ctx);
    if (this.quality.particles >= 0.5) drawGlows(ctx, this.glows);
    ctx.restore();
    this.bg.renderFront(ctx, cam, v.w, v.h);
    if (this.quality.particles >= 0.7) drawWisps(ctx, this.bg, cam, v.w, v.h, this.time);
    if (this.introT <= 0.4) this._indicators(ctx);
    const gr = THEME_GRADE[this.bg.themeName] || [];
    const p = this.player;
    let hurt = this.hurtA;
    if (p.alive && p.hp < p.maxHp * 0.3) hurt = Math.max(hurt, 0.22 + 0.14 * Math.sin(this.time * 6));
    if (p.alive && p.outside && this.zoneOn) hurt = Math.max(hurt, 0.25);
    if (this.punch > 0) drawCloudPunch(ctx, v.w, v.h, this.punch, this.bg.sprites);
    screenGrade(ctx, v.w, v.h, { hq: this.quality.particles >= 0.7, grade: gr[0], gradeA: gr[1], sun: gr[2], hurt, lb: this.lb });
    this.vfx.renderScreen(ctx, v.w, v.h);
  }

  _arena(ctx) {
    const p = this.player, d = Math.hypot(p.x, p.y), R = this.arenaR;
    if (this.zoneOn) {
      // boss arena: the storm outside, a glowing wall, always visible
      const v = this.view, z = this.z || 1, W = v.w / z, H = v.h / z, pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.beginPath(); ctx.rect(this.cam.x - W, this.cam.y - H, W * 2, H * 2); ctx.arc(0, 0, R, 0, TAU, true);
      ctx.fillStyle = `rgba(255,70,120,${0.16 + 0.05 * pulse})`; ctx.fill();
      ctx.strokeStyle = 'rgba(255,70,120,0.25)'; ctx.lineWidth = 24; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.3 * pulse})`; ctx.lineWidth = 3.5; ctx.setLineDash([30, 14]); ctx.lineDashOffset = -this.time * 60;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    if (d < R - 650) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 5;
    ctx.setLineDash([22, 18]);
    const a = Math.atan2(p.y, p.x);
    ctx.beginPath(); ctx.arc(0, 0, R, a - 0.6, a + 0.6); ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Campaign radar for the HUD: arena, enemies, the boss, pickups and missiles. */
  drawRadar(ctx, S) {
    const R = CONFIG.ARENA_RADIUS * 1.05, k = (S / 2 - 3) / R, c = S / 2, p = this.player;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, S / 2 - 1, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(12,16,28,0.6)'; ctx.fillRect(0, 0, S, S);
    if (this.zoneOn) { ctx.fillStyle = 'rgba(255,70,120,0.35)'; ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.arc(c, c, this.arenaR * k, 0, TAU, true); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo((S * i) / 4, 0); ctx.lineTo((S * i) / 4, S); ctx.moveTo(0, (S * i) / 4); ctx.lineTo(S, (S * i) / 4); ctx.stroke(); }
    ctx.strokeStyle = this.zoneOn ? '#FFFFFF' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c, c, this.arenaR * k, 0, TAU); ctx.stroke();
    for (const pk of this.pickups.pool.active) { if (pk.kind === 'coin') continue; ctx.fillStyle = PICKUP_COLORS[pk.kind]; ctx.fillRect(c + pk.x * k - 2, c + pk.y * k - 2, 4, 4); }
    ctx.fillStyle = '#FFFFFF';
    for (const m of this.missiles.pool.active) if (m.team === 1) { ctx.beginPath(); ctx.arc(c + m.x * k, c + m.y * k, 1.5, 0, TAU); ctx.fill(); }
    for (const e of this.enemies.list) {
      if (!e.alive || e.dying || e.cloaked) continue;
      ctx.fillStyle = '#FF4B4B';
      ctx.beginPath(); ctx.arc(c + e.x * k, c + e.y * k, e.def.boss ? 5 : 2.6, 0, TAU); ctx.fill();
      if (e.def.boss) { ctx.strokeStyle = '#FFD24A'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    if (p.alive) {
      ctx.save(); ctx.translate(c + p.x * k, c + p.y * k); ctx.rotate(p.a);
      ctx.fillStyle = '#3D8BFF'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c, c, S / 2 - 1, 0, TAU); ctx.stroke();
  }

  /** Edge-of-screen arrows for threats and useful pickups that are out of view. */
  _indicators(ctx) {
    const v = this.view, cam = this.cam, p = this.player;
    if (!p.alive) return;
    const hw = v.w / 2, hh = v.h / 2, inset = 22;
    const top = 92, bottom = v.h - 30;
    const draw = (wx, wy, color, size, shape) => {
      const dx = wx - cam.x, dy = wy - cam.y;
      if (Math.abs(dx) < hw && Math.abs(dy) < hh) return;
      const a = Math.atan2(dy, dx);
      const sc = Math.min((hw - inset) / Math.abs(dx || 1e-6), (hh - inset) / Math.abs(dy || 1e-6));
      const sx = hw + dx * sc, sy = clamp(hh + dy * sc, top, bottom);
      ctx.save();
      ctx.translate(sx, sy);
      if (shape === 'dot') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, size + 2, 0, TAU); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.fill();
      } else {
        ctx.rotate(a);
        ctx.fillStyle = color; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.7, -size * 0.75); ctx.lineTo(-size * 0.3, 0); ctx.lineTo(-size * 0.7, size * 0.75); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    };
    let n = 0;
    for (const e of this.enemies.list) {
      if (!e.alive || e.dying || e.cloaked) continue;
      if (e.def.boss) draw(e.x, e.y, '#E23B3F', 15);
      else if (n++ < 8) draw(e.x, e.y, '#E23B3F', 8);
    }
    for (const m of this.missiles.pool.active) if (m.team === 1) draw(m.x, m.y, '#FFFFFF', 6);
    for (const k of this.pickups.pool.active) if (k.kind !== 'coin') draw(k.x, k.y, PICKUP_COLORS[k.kind] === '#FFFFFF' ? '#4A2E22' : PICKUP_COLORS[k.kind], 5, 'dot');
  }
}
