// Team Battle simulation: two teams of four (humans + bots), a shrinking zone,
// supply crates, kill credit, respawns, sudden death and a cinematic camera.
// Rebuilt from scratch on every start(), so a rematch is always clean.
import { clamp, rand, TAU, angDiff, pick } from '../core/utils.js';
import { ProjectileSystem } from '../combat/Projectile.js';
import { MissileSystem } from '../combat/Missile.js';
import { FlareSystem } from '../combat/Flare.js';
import { pickupSprite } from '../combat/Pickup.js';
import { drawSprite } from '../art/PlaneArt.js';
import { VFXManager } from '../systems/VFXManager.js';
import { AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { ENEMIES } from '../data/enemies.js';
import { Fighter } from './Fighter.js';
import { BotBrain } from './BotBrain.js';
import { Zone } from './Zone.js';
import { BattleInput } from './BattleInput.js';
import { CockpitView } from './CockpitView.js';
import { screenGrade } from '../systems/Cinema.js';
import { drawAirbase, drawCloudPunch, takeoffCurves } from '../systems/Takeoff.js';
import { NetSync } from '../net/NetSync.js';
import { BATTLE, MODES, SIZES, MAPS, DIFFICULTY, BOT_NAMES, BLUE_BOT_ART, RED_BOT_ART, RED_BOT_STATS, TEAMS } from './battleData.js';

const MULTI = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'MULTI KILL', 'RAMPAGE'];
const STREAK = { 3: 'KILLING SPREE', 5: 'UNSTOPPABLE', 7: 'ACE OF THE SKIES' };

export class BattleWorld {
  static INTRO = 5.0;
  constructor(game) {
    this.game = game;
    this.realAudio = game.audio;
    this.bg = game.background;
    this.view = game.view;
    this.vfx = new VFXManager();
    this.bullets = new ProjectileSystem();
    this.bullets.teamColors = TEAMS.map((t) => t.tracer);
    this.missiles = new MissileSystem();
    this.flares = new FlareSystem();
    this.zone = new Zone();
    this.input = new BattleInput(game.input);
    this.cockpit = new CockpitView();
    this.view3d = false;
    this.cams = [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }];
    this.cam = this.cams[0];
    this.fighters = []; this.humans = [];
    this.crates = []; this.glows = []; this.marks = []; this.dmgDirs = []; this.feed = [];
    this.streaks = Array.from({ length: 22 }, () => ({ x: rand(), y: rand(), l: rand(0.4, 1) }));
    this.running = false; this.over = false;
    this.quality = { particles: 1, trails: 1, clouds: 1 };
    this.feedId = 0;
    // spatial audio: distant aircraft are quieter
    this.audio = { sfx: (name, src) => this._sfx(name, src) };
  }

  // ---- setup -------------------------------------------------------------------
  start(cfg, settings) {
    this.cfg = cfg;
    const size = SIZES[cfg.size] ? +cfg.size : 3;
    this.mode = { ...MODES.team, size, killTarget: SIZES[size].killTarget };
    this.map = MAPS[cfg.map] || MAPS.desert;
    this.diff = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
    this.vfx.reset(); this.bullets.reset(); this.missiles.reset(); this.flares.reset();
    this.quality = settings.quality;
    this.vfx.density = this.quality.particles;
    this.vibration = settings.vibration;
    this.input.fireMode = settings.fireMode || 'auto';
    this.autoFlares = settings.autoFlares !== false;
    this.lockFx = settings.lockFx !== false;
    this.armor = { easy: 0.65, normal: 0.8, hard: 0.95 }[cfg.difficulty] || 0.8;
    this.input.reset();
    this.zone.reset();
    this.crates.length = 0; this.glows.length = 0; this.marks.length = 0; this.dmgDirs.length = 0; this.feed.length = 0;
    this.score = [0, 0];
    this.time = 0; this.roundT = BATTLE.ROUND_TIME; this.sudden = false; this.suddenT = 0;
    this.phase = 'intro'; this.introT = BattleWorld.INTRO; this.tlk = 0; this.tlkTgt = null; this.tlkSaid = false; this.lockZ = 0; this.lastCount = 4;
    this.over = false; this.endT = 0; this.result = null; this.winner = -1;
    this.slowT = 0; this.timeScale = 1; this.hitStop = 0;
    this.crateT = 6; this.zoneTick = 0.5;
    this.hurtA = 0; this.lb = 1; this.zPunch = 0;
    this.alarmT = 0; this.beatT = 0; this.lockT = 0; this.flybyT = 0; this.tauntT = 0; this._final30 = false;
    this.bg.setTheme(this.map.theme);
    this.sync = cfg.net ? new NetSync(this, cfg.net.net, cfg.net) : null;
    this._buildTeams(cfg);
    this.introZoom = 0.8;
    this.view3d = cfg.view === 'cockpit';
    // take-off: the player's squadron rolls down a runway and lifts off on "FIGHT!"
    const team = this.humans[0].team, mates = this.fighters.filter((o) => o.team === team);
    let rx = 0, ry = 0; for (const o of mates) { rx += o.x; ry += o.y; o.sx0 = o.x; o.sy0 = o.y; o.lift = 0; }
    const ha = this.humans[0].a;
    this.runway = { x: rx / mates.length - Math.cos(ha) * 60, y: ry / mates.length - Math.sin(ha) * 60, a: ha, wid: mates.length * 95 + 60, lanes: mates.length, alpha: 1, alt: 0 };
    this.punch = 0;
    this.liftSaid = false; this.rollSaid = false; this.punchSaid = false;
    this.realAudio.sfx('takeoff');     // dramatic push-in on your jet before the fight
    this.touch = this.game.input.usedTouch || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    this.split = this.humans.length > 1;
    this.humans.forEach((h, i) => { const c = this.cams[i]; c.x = h.x; c.y = h.y; c.z = 1; h.hurtA = 0; });
    this.running = true;
  }

  _buildTeams(cfg) {
    const g = this.game, sel = g.save.data.selected, net = cfg.net;
    const humans = net ? (net.mode === 'versus' ? [0, 1] : [0, 0]) : this.mode.humans, versus = !!net && net.mode === 'versus';
    this.fighters = []; this.humans = [];
    const used = [0, 0];
    if (net) {
      // online: fighters[0] is the host's jet, fighters[1] the guest's; both sides build the same list
      net.roster.forEach((r, i) => {
        const team = humans[i], a = AIRCRAFT_BY_ID[r.id] || AIRCRAFT_BY_ID.ember;
        const stats = { ...a.stats, ...(r.stats || {}) }; stats.speed *= BATTLE.PACE;
        const mine = i === this.sync.localIdx;
        const f = new Fighter({ team, name: mine ? 'YOU' : r.name, tag: mine ? 'YOU' : r.name, human: mine, remote: !mine, pi: mine ? 0 : 1,
          artKind: 'p', artId: a.id, size: a.size, stats, guns: a.guns, skill: 1, turnMul: 1.12 });
        f.tagged = !mine;
        this.fighters.push(f); if (mine) this.humans.push(f);
        used[team]++;
      });
    } else humans.forEach((team, pi) => {
      const id = pi === 0 ? sel : (versus ? 'ravager' : 'wisp');
      const a = AIRCRAFT_BY_ID[id] || AIRCRAFT_BY_ID.ember;
      // versus is fair: both players fly un-upgraded aircraft
      const stats = pi === 0 && !versus ? { ...g.upgrades.stats(a.id) } : { ...a.stats };
      stats.speed *= BATTLE.PACE;
      const f = new Fighter({ team, name: humans.length > 1 ? `PLAYER ${pi + 1}` : 'YOU', tag: humans.length > 1 ? `P${pi + 1}` : 'YOU',
        human: true, pi, artKind: 'p', artId: a.id, size: a.size, stats, guns: a.guns, skill: 1, turnMul: 1.12 });
      this.fighters.push(f); this.humans.push(f);
      used[team]++;
    });
    for (let team = 0; team < 2; team++) {
      const names = [...BOT_NAMES[team]];
      // bots that fight beside humans are steady; the opposition uses the chosen difficulty
      const hostile = versus || team !== humans[0];
      const d = hostile ? this.diff : { skill: 0.6, turn: 0.9, hp: 1, react: 0.35, fire: 0.85 };
      // versus: the friend's side flies the friendly jet models too
      const style = versus ? 0 : team;
      for (let i = used[team]; i < this.mode.size; i++) {
        let f;
        if (style === 0) {
          const id = BLUE_BOT_ART[i % BLUE_BOT_ART.length], a = AIRCRAFT_BY_ID[id];
          const stats = { ...a.stats, hp: a.stats.hp * d.hp, missiles: 3, speed: a.stats.speed * BATTLE.PACE, fireRate: a.stats.fireRate * (d.fire || 1) };
          f = new Fighter({ team, name: names[i], tag: names[i], human: false, artKind: 'p', artId: id, size: a.size, stats, guns: a.guns, skill: d.skill, turnMul: d.turn });
        } else {
          const id = RED_BOT_ART[i % RED_BOT_ART.length];
          const stats = { ...RED_BOT_STATS[id] }; stats.hp *= d.hp; stats.speed *= BATTLE.PACE; stats.fireRate *= d.fire || 1;
          f = new Fighter({ team, name: names[i], tag: names[i], human: false, artKind: 'e', artId: id, size: ENEMIES[id].size + 4, stats, guns: id === 'armored' ? 2 : 1, skill: d.skill, turnMul: d.turn });
        }
        f.brain = new BotBrain(f, d.skill, d.react);
        this.fighters.push(f);
      }
    }
    const slot = [0, 0];
    for (const f of this.fighters) { const p = this._spawnPoint(f.team, slot[f.team]++); f.spawn(p.x, p.y, p.a); f.invuln = 1.2; }
  }

  _spawnPoint(team, i) {
    const z = this.zone, dir = team === 0 ? Math.PI : 0;
    const d = z.r * 0.6, px = -Math.sin(dir), py = Math.cos(dir), off = (i - 1.5) * 95 + rand(-15, 15);
    const x = z.cx + Math.cos(dir) * d + px * off, y = z.cy + Math.sin(dir) * d + py * off;
    return { x, y, a: Math.atan2(z.cy - y, z.cx - x) };
  }
  stop() {
    this.running = false;
    this.realAudio.setMissileLoop(false); this.realAudio.setEngine(0); this.realAudio.setStorm(0);
  }

  // ---- helpers used by fighters ---------------------------------------------------
  _sfx(name, src) {
    if (!src || src.human) { this.realAudio.sfx(name); return; }
    const d = this._camDist(src.x, src.y);
    const vol = clamp(1 - (d - 220) / 800, 0, 1) * (name === 'enemyShoot' ? 0.75 : 1);
    if (vol > 0.05) this.realAudio.sfx(name, vol);
  }
  vibrate(p) { if (this.vibration && navigator.vibrate) { try { navigator.vibrate(p); } catch (_) {} } }
  humanHint(f, text) {
    if (!f.human) return;
    if (this._hintTxt === text && this.time - this._hintAt < 2.5) return;
    this._hintTxt = text; this._hintAt = this.time;
    this.game.battleHud.hint(text, 1.8, f.pi);
  }
  toggleView() {
    this.view3d = !this.view3d;
    this.game.battleHud.hint(this.view3d ? 'COCKPIT VIEW - left / right to turn, up to speed up' : 'TOP-DOWN VIEW', 1.6);
    this.realAudio.sfx('swoosh');
  }
  say(id, prio) { if (this.game.radio) this.game.radio.say(id, prio); }
  glow(x, y, r, life, rgb) {
    if (this.glows.length > 90) return;
    this.glows.push({ x, y, r, life, max: life, rgb });
  }
  /** How many bots (other than `except`) are currently hunting `o`. */
  huntedBy(o, except) {
    let n = 0;
    for (const f of this.fighters) if (f !== except && f.brain && f.alive && f.brain.target === o) n++;
    return n;
  }
  enemiesOf(f) { return this.fighters.filter((o) => o.alive && o.team !== f.team); }

  /** Gun aim: humans get a small assist with target lead; bots aim by skill. */
  aimAngle(f) {
    let best = null, bestErr = BATTLE.AIM_CONE;
    for (const e of this.fighters) {
      if (!e.alive || e.team === f.team) continue;
      const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy);
      if (d > 480) continue;
      const tt = d / BATTLE.BULLET_SPEED;
      const err = angDiff(f.a, Math.atan2(dy + Math.sin(e.a) * e.speed * tt, dx + Math.cos(e.a) * e.speed * tt));
      if (Math.abs(err) < Math.abs(bestErr)) { bestErr = err; best = e; }
    }
    if (!best) return f.a;
    return f.a + bestErr * (f.human || f.remote ? 0.85 : 0.4 + 0.5 * f.skill);
  }
  /** Best target inside the seeker cone, used at launch. */
  missileTarget(f, keep = null) {
    let best = null, bs = 1e9;
    for (const e of this.fighters) {
      if (!e.alive || e.team === f.team) continue;
      const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy);
      if (d > BATTLE.MISSILE_RANGE) continue;
      const err = Math.abs(angDiff(f.a, Math.atan2(dy, dx)));
      if (err > BATTLE.MISSILE_CONE) continue;
      const s = d + err * 300 - (e === keep ? 220 : 0);   // stick to the current lock
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  /** A missile with no target looks for one ahead of it. */
  seekerTarget(m) {
    let best = null, bd = 420 * 420;
    for (const e of this.fighters) {
      if (!e.alive || e.team === m.team) continue;
      const dx = e.x - m.x, dy = e.y - m.y, d = dx * dx + dy * dy;
      if (d < bd && Math.abs(angDiff(m.a, Math.atan2(dy, dx))) < 1.1) { bd = d; best = e; }
    }
    return best;
  }
  launchMissile(owner, x, y, a, dmg, target) {
    this.missiles.launchBattle(owner, x, y, a, dmg, target);
    if (target && target.human) { this.realAudio.sfx('lock'); this.say('b.lock', 'low'); }
  }
  nearestCrate(x, y, range) {
    let best = null, bd = range * range;
    for (const c of this.crates) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  }

  // ---- combat events ----------------------------------------------------------------
  onHit(f, src, amount, kind, hx, hy) {
    if (f.human) {
      const big = kind === 'missile';
      if (kind === 'zone') { f.hurtA = Math.max(f.hurtA || 0, 0.22); return; }
      this.vfx.shake(big ? 13 : 4.5);
      f.hurtA = Math.min(1, (f.hurtA || 0) + (big ? 0.55 : 0.16));
      if (big) this.vfx.flash('255,80,60', 0.28);
      if (src) this.dmgDirs.push({ pi: f.pi, a: Math.atan2(src.y - f.y, src.x - f.x), t: 1.1 });
      if (this.dmgDirs.length > 8) this.dmgDirs.shift();
      this.realAudio.sfx('hurt');
      this.vibrate(big ? 80 : 25);
    }
    if (src && src.human && src !== f && kind !== 'zone') {
      this.realAudio.sfx('hitTick');
      this.marks.push({ x: hx, y: hy, t: 0.18, big: kind === 'missile' });
    }
  }

  killFighter(f, src, kind, fromNet = false) {
    if (this.sync && !this.sync.host && !fromNet) return;      // online guest: only the host decides kills
    if (this.sync && this.sync.host) this.sync.sendKill(f, src && src !== f && src.team !== f.team ? src : (f.lastHitBy && f.lastHitT < BATTLE.ASSIST_WINDOW && f.lastHitBy.team !== f.team ? f.lastHitBy : null), kind);
    f.alive = false; f.deaths++; f.streak = 0;
    f.respawnT = f.human || f.remote ? BATTLE.RESPAWN_HUMAN : BATTLE.RESPAWN_BOT;
    const v = this.vfx;
    v.explosionLarge(f.x, f.y, f.debris);
    v.explosionSmall(f.x + rand(-12, 12), f.y + rand(-12, 12));
    v.debris(f.x, f.y, 12, f.debris);
    v.ring(f.x, f.y, 10, 120, 0.5, '255,230,190', 6);
    this.glow(f.x, f.y, 170, 0.6, '255,150,70');
    for (let i = 0; i < 6; i++) v.smoke(f.x + rand(-20, 20), f.y + rand(-20, 20), 12, 1.4, '50,40,40');
    const near = this._camDist(f.x, f.y) < 600;
    if (near) v.shake(f.human ? 16 : 9);
    this._sfx('crash', f);
    for (const m of this.missiles.pool.active) if (m.target === f) m.target = null;

    // credit: the shooter, or whoever hit it last before the zone finished the job
    let killer = src && src !== f && src.team !== f.team ? src : null;
    if (!killer && f.lastHitBy && f.lastHitT < BATTLE.ASSIST_WINDOW && f.lastHitBy.team !== f.team) killer = f.lastHitBy;
    const assist = f.assistBy && f.assistBy !== killer && killer && f.assistBy.team === killer.team && f.lastHitT < BATTLE.ASSIST_WINDOW * 2 ? f.assistBy : null;
    const scoringTeam = killer ? killer.team : 1 - f.team;
    if (!this.over) this.score[scoringTeam]++;
    if (assist) assist.assists++;
    this.feed.push({ id: ++this.feedId, t: 4, killer: killer ? killer.tag : null, kt: killer ? killer.team : -1, victim: f.tag, vt: f.team, how: killer ? kind : 'zone', human: (killer && killer.human) || f.human });
    if (this.feed.length > 3) this.feed.shift();

    const focusTeam = this.humans[0].team;
    if (killer) {
      killer.kills++; killer.streak++; killer.best = Math.max(killer.best, killer.streak);
      if (killer.human) this._humanKill(killer, f);
      else if (!f.human) {
        this.realAudio.sfx(killer.team === focusTeam ? 'allyScore' : 'enemyScore');
        if (killer.team === focusTeam && Math.random() < 0.35) this.say('b.wingkill', 'low');
      }
    } else if (!f.human) this.realAudio.sfx(scoringTeam === focusTeam ? 'allyScore' : 'enemyScore');
    if (f.human) {
      this.slowT = Math.max(this.slowT, 0.7);
      f.killedBy = killer;
      this.game.battleHud.down(f, killer ? `SHOT DOWN BY ${killer.tag}` : 'LOST TO THE ZONE');
      this.say('b.down', 'normal');
      this.vibrate([80, 40, 140]);
    }
  }

  _humanKill(k, victim) {
    const now = this.time;
    k.multi = now - (k.lastKillAt || -99) < 4 ? (k.multi || 1) + 1 : 1;
    k.lastKillAt = now;
    this.hitStop = 0.06;
    this.slowT = Math.max(this.slowT, 0.35);
    this.zPunch = 0.07;
    this.realAudio.sfx('killConfirm');
    this.vfx.text(victim.x, victim.y - 34, '+1 KILL', '#FFE38A', 26);
    this.vfx.ring(victim.x, victim.y, 12, 190, 0.5, '255,240,200', 8);
    this.realAudio.sfx('shockwave');
    const label = MULTI[Math.min(k.multi, 5)] || STREAK[k.streak];
    if (label) { this.realAudio.sfx('multiKill'); this.game.battleHud.callout(label, k.pi); this.say('b.multi', 'normal'); }
    else { this.game.battleHud.callout(`${victim.tag} DOWN`, k.pi, true); this.say('b.kill', 'low'); }
    this.vibrate(40);
  }

  // ---- frame update -----------------------------------------------------------------
  update(realDt) {
    if (!this.running) return;
    if (this.hitStop > 0) { this.hitStop -= realDt; realDt *= 0.05; }
    if (this.slowT > 0) { this.slowT -= realDt; this.timeScale += ((this.over ? 0.25 : 0.4) - this.timeScale) * Math.min(1, realDt * 12); }
    else this.timeScale += (1 - this.timeScale) * Math.min(1, realDt * 4);
    const dt = realDt * this.timeScale;
    this.time += dt;
    const hud = this.game.battleHud;

    if (this.phase === 'intro') {
      this.introT -= realDt;
      const n = Math.ceil(this.introT - 0.6);
      if (n !== this.lastCount && n >= 1 && n <= 3) { this.lastCount = n; hud.countdown(String(n)); this.realAudio.sfx('countdown'); }
      if (this.introT <= 0.6 && this.lastCount !== 0) { this.lastCount = 0; hud.countdown('FIGHT!'); this.realAudio.sfx('fight'); this.input.setEnabled(true); this.say('b.start', 'high'); this.tauntT = 9; }
      if (this.introT <= 0) {
        this.phase = 'play'; hud.showControls(true);
        for (const f of this.fighters) { f.lift = 1; f.boostT = 0; f.sx0 = undefined; }
      }
      // take-off from the airbase: taxi roll (0-2.4s), rotate and climb (2.4-4.2s),
      // punch through the cloud deck (3.4-4.4s), then the war sky.
      const e = BattleWorld.INTRO - this.introT, sm = takeoffCurves.smooth;
      const p = clamp(e / (BattleWorld.INTRO - 0.3), 0, 1), roll = (1 - p * p) * 640;
      const alt = sm(2.4, 4.2, e);
      this.runway.alt = alt; this.runway.alpha = 1 - sm(0.5, 0.95, alt);
      this.punch = e > 3.4 && e < 4.4 ? (e - 3.4) : 0;
      for (const f of this.fighters) {
        f.t += realDt;
        if (f.sx0 === undefined) { f.trail.add(f.x, f.y); continue; }
        f.x = f.sx0 - Math.cos(f.a) * roll; f.y = f.sy0 - Math.sin(f.a) * roll;
        f.lift = alt; f.outside = false;
        f.boostT = e > 1.0 ? 0.1 : 0;                   // afterburner lights once the brakes come off
        f.speed = f.stats.speed * (0.25 + p * 1.05);
        if (e > 0.8) f.trail.add(f.x - Math.cos(f.a) * f.size * 0.8, f.y - Math.sin(f.a) * f.size * 0.8);
      }
      if (e > 0.9 && !this.rollSaid) { this.rollSaid = true; this.realAudio.sfx('boost'); this.vibrate(15); }
      if (e > 2.4 && !this.liftSaid) { this.liftSaid = true; this.realAudio.sfx('gearUp'); this.vibrate(30); }
      if (e > 3.5 && !this.punchSaid) { this.punchSaid = true; this.realAudio.sfx('flyby'); }
      this.vfx.update(realDt); this.bg.update(realDt);
      this._camera(realDt);
      return;
    }

    const guest = this.sync && !this.sync.host;
    if (guest && !this.over) {
      if (!this.sudden && this.roundT <= 30 && !this._final30) { this._final30 = true; hud.banner('FINAL 30 SECONDS', 'The zone is closing', 2, true); this.realAudio.playMusic('boss'); this.say('b.final', 'high'); }
      if (this.tauntT > 0 && (this.tauntT -= dt) <= 0) this.say('b.taunt', 'low');
    }
    if (!this.over && !guest) {
      if (this.sudden) {
        this.suddenT -= dt;
        if (this.suddenT <= 0) this._end(-1);
      } else {
        this.roundT -= dt;
        if (this.roundT <= 30 && !this._final30) { this._final30 = true; hud.banner('FINAL 30 SECONDS', 'The zone is closing', 2, true); this.realAudio.playMusic('boss'); this.say('b.final', 'high'); }
        if (this.tauntT > 0 && (this.tauntT -= dt) <= 0) this.say('b.taunt', 'low');
        if (this.roundT <= 0) {
          this.roundT = 0;
          if (this.score[0] === this.score[1]) this._suddenDeath();
          else this._end(this.score[0] > this.score[1] ? 0 : 1);
        }
      }
      this.zone.update(dt);
      for (const ev of this.zone.events) { this._zoneEvent(ev); if (this.sync) this.sync.sendZone(ev); }
      this.zone.events.length = 0;
      const t = this.mode.killTarget;
      if (this.score[0] >= t) this._end(0); else if (this.score[1] >= t) this._end(1);
    }

    // pilots
    const nh = this.humans.length, sy = this.sync;
    for (let fi = 0; fi < this.fighters.length; fi++) {
      const f = this.fighters[fi];
      if (!f.alive) {
        if (this.over || guest) continue;                  // online guest: respawns come from the host
        f.respawnT -= dt;
        if (f.respawnT <= 0) this._respawn(f);
        continue;
      }
      let cmd;
      if (f.human) {
        cmd = this.over ? { steer: false, angle: f.a, throttle: 0.6 } : this.input.read();
        if (cmd.view) this.toggleView();
        if (this.view3d && !this.over) {
          // cockpit: left/right turn the nose, forward/back is throttle
          cmd.steer = Math.abs(cmd.mx) > 0.08;
          cmd.angle = f.a + cmd.mx * 1.4;
          cmd.throttle = cmd.my < -0.35 ? 1 : cmd.my > 0.35 ? 0.2 : 0.65;
        }
        if (!cmd.manualFire && this.input.fireMode === 'auto' && !this.over) cmd.fire = this._autoFire(f);
        // flares pop by themselves when a missile is about to hit (unless switched off in Controls)
        if (this.autoFlares && f.flares > 0 && f.flareCd <= 0 && f.shieldT <= 0 && this._incoming(f, BATTLE.FLARE_AUTO_RANGE)) cmd.flare = true;
        if (guest) sy.noteCmd(cmd);
      } else if (sy && (f.remote || (guest && !sy.left))) {
        cmd = this.over ? { steer: false, angle: f.a, throttle: 0.6 } : sy.remoteCmd(f, fi, dt);
        f.update(dt, cmd, this);
        if (!this.over) sy.correct(f, fi, dt);
        continue;
      } else cmd = this.over ? { steer: false, angle: f.a, throttle: 0.6 } : f.brain.think(dt, this);
      f.lastThrottle = cmd.throttle;
      f.update(dt, cmd, this);
    }

    // labels only where they matter: damaged jets, jets near you, and anyone hunting you
    const me = this.humans[0];
    for (const f of this.fighters) {
      if (f.human || !f.alive) continue;
      const near = me.alive && (f.x - me.x) ** 2 + (f.y - me.y) ** 2 < 330 * 330;
      f.tagged = f.remote || near || f.lastHitT < 3 || (f.brain && f.brain.target === me && f.team !== me.team);
    }

    // zone damage, twice a second
    this.zoneTick -= dt;
    if (this.zoneTick <= 0) {
      this.zoneTick = 0.5;
      for (const f of this.fighters) {
        if (!f.alive) continue;
        f.outside = !this.zone.inside(f.x, f.y);
        if (f.outside && !this.over && !guest) {
          f.damage(this.zone.dps * 0.5, null, this, f.x, f.y, 'zone');
          this.vfx.spark(f.x, f.y, rand(TAU), 2, '#FF9AD0');
        }
      }
    }

    this.bullets.update(dt);
    this.missiles.updateBattle(dt, this);
    this.flares.update(dt, this);
    this._collisions();
    this._crates(dt);
    this.vfx.update(dt);
    this.bg.update(dt);
    for (let i = this.glows.length - 1; i >= 0; i--) { const g = this.glows[i]; g.life -= dt; if (g.life <= 0) this.glows.splice(i, 1); }
    for (let i = this.marks.length - 1; i >= 0; i--) { this.marks[i].t -= realDt; if (this.marks[i].t <= 0) this.marks.splice(i, 1); }
    for (let i = this.dmgDirs.length - 1; i >= 0; i--) { this.dmgDirs[i].t -= realDt; if (this.dmgDirs[i].t <= 0) this.dmgDirs.splice(i, 1); }
    for (let i = this.feed.length - 1; i >= 0; i--) { this.feed[i].t -= realDt; if (this.feed[i].t <= 0) this.feed.splice(i, 1); }
    for (const h of this.humans) if (h.hurtA > 0) h.hurtA = Math.max(0, h.hurtA - realDt * 1.4);
    
    if (this.zPunch > 0) this.zPunch = Math.max(0, this.zPunch - realDt * 0.4);
    this._audio(realDt);
    this._updateLock(realDt);
    this._camera(realDt);
    if (this.sync) this.sync.tick(realDt);

    if (this.over) {
      this.endT += realDt;
      if (this.endT > 3.4 && !this.reported) { this.reported = true; this.game.onBattleEnd(this.result); }
    }
  }

  _incoming(f, range) {
    for (const m of this.missiles.pool.active) {
      if (m.alive && m.team !== f.team && m.target === f && !m.decoy && (m.x - f.x) ** 2 + (m.y - f.y) ** 2 < range * range) return true;
    }
    return false;
  }
  /** Auto-fire assist: only fires when an enemy is lined up, so limited ammo is not wasted. */
  _autoFire(f) {
    if (f.overheat || f.ammo <= 0 || f.heat > 0.9) return false;
    for (const e of this.fighters) {
      if (!e.alive || e.team === f.team || e.invuln > 0 || e.shieldT > 0) continue;
      const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy);
      if (d > BATTLE.AUTO_FIRE_RANGE) continue;
      const tt = d / BATTLE.BULLET_SPEED;
      const err = Math.abs(angDiff(f.a, Math.atan2(dy + Math.sin(e.a) * e.speed * tt, dx + Math.cos(e.a) * e.speed * tt)));
      if (err < BATTLE.AUTO_FIRE_CONE + (this.touch ? 0.06 : 0) + e.r / Math.max(60, d)) return true;
    }
    return false;
  }

  _respawn(f) {
    const team = this.fighters.filter((o) => o.team === f.team);
    const p = this._spawnPoint(f.team, team.indexOf(f));
    // keep spawns inside the current zone
    const dx = p.x - this.zone.cx, dy = p.y - this.zone.cy, d = Math.hypot(dx, dy), max = this.zone.r * 0.75;
    if (d > max) { p.x = this.zone.cx + dx / d * max; p.y = this.zone.cy + dy / d * max; }
    this._respawnAt(f, p.x, p.y, p.a);
    if (this.sync && this.sync.host) { if (f.remote) this.sync.rin = null; this.sync.sendRespawn(f); }
  }
  _respawnAt(f, x, y, a) {
    f.spawn(x, y, a);
    this.vfx.ring(f.x, f.y, 10, 90, 0.5, TEAMS[f.team].rgb, 5);
    this.glow(f.x, f.y, 80, 0.5, TEAMS[f.team].rgb);
    if (f.human) { this.realAudio.sfx('respawn'); f.killedBy = null; this.game.battleHud.up(f); }
  }

  _suddenDeath(fromNet = false) {
    this.sudden = true; this.suddenT = BATTLE.SUDDEN_DEATH;
    if (!fromNet) this.zone.collapse(BATTLE.SUDDEN_DEATH - 4);
    this.game.battleHud.banner('SUDDEN DEATH', 'Next kill wins', 2.4, true);
    this.realAudio.sfx('warning');
    // the next point decides it
    if (!fromNet) this.mode = { ...this.mode, killTarget: Math.max(this.score[0], this.score[1]) + 1 };
    if (this.sync && this.sync.host) this.sync.sendSudden(this.mode.killTarget);
  }

  _end(winner, fromNet = false) {
    if (this.over) return;
    if (this.sync && !this.sync.host && !fromNet) return;
    if (this.sync && this.sync.host) this.sync.sendEnd(winner);
    this.over = true; this.winner = winner; this.endT = 0; this.reported = false;
    this.slowT = 2.2;
    this.input.setEnabled(false);
    this.game.battleHud.showControls(false);
    const focus = this.humans[0].team, versus = false;
    const title = winner < 0 ? 'DRAW' : versus ? `${TEAMS[winner].name} TEAM WINS` : winner === focus ? 'VICTORY' : 'DEFEAT';
    this.game.battleHud.banner(title, `${TEAMS[0].name} ${this.score[0]}  -  ${this.score[1]} ${TEAMS[1].name}`, 3.2, winner >= 0 && winner !== focus && !versus);
    this.realAudio.sfx(winner === focus || versus ? 'win' : 'enemyScore');
    this.game.radio.clear(); this.say(winner === focus ? 'b.win' : 'b.lose', 'high');
    this.bullets.pool.clear();
    for (const m of this.missiles.pool.active) this.missiles.fizzle(m, this);
    this.result = { winner, score: [...this.score], title, mode: 'team', online: this.sync ? { mode: this.sync.mode, friend: (this.fighters[this.sync.remoteIdx] || {}).name, host: this.sync.host } : null, size: this.mode.size, map: this.map.name, mapId: this.map.id, difficulty: this.cfg.difficulty, challenge: this.cfg.challenge || null, time: BATTLE.ROUND_TIME - this.roundT + (this.sudden ? BATTLE.SUDDEN_DEATH - this.suddenT : 0),
      board: this.fighters.map((f) => ({ name: f.name, tag: f.tag, team: f.team, human: f.human, pi: f.pi, kills: f.kills, deaths: f.deaths, assists: f.assists, dmg: Math.round(f.dmgDealt), best: f.best })) };
  }

  // ---- collisions ------------------------------------------------------------------
  _collisions() {
    const bl = this.bullets.pool.active, ms = this.missiles.pool.active, fs = this.fighters;
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i];
      if (!b.alive) continue;
      for (let j = 0; j < fs.length; j++) {
        const f = fs[j];
        if (!f.alive || f.team === b.team) continue;
        const dx = f.x - b.x, dy = f.y - b.y, rr = f.r + b.r + 2;
        if (dx * dx + dy * dy < rr * rr) { b.alive = false; f.damage(b.dmg, b.owner, this, b.x, b.y, 'bullet'); break; }
        // near miss past the player: whiz
        if (f.human && !b.whiz && dx * dx + dy * dy < 55 * 55) { b.whiz = true; this.realAudio.sfx('whiz'); }
      }
      if (!b.alive) continue;
      for (let j = 0; j < ms.length; j++) {          // shoot down incoming missiles
        const m = ms[j];
        if (!m.alive || m.team === b.team) continue;
        const dx = m.x - b.x, dy = m.y - b.y, rr = m.r + b.r + 4;
        if (dx * dx + dy * dy < rr * rr) { b.alive = false; this.missiles.explode(m, this); if (b.owner && b.owner.human) this.vfx.text(m.x, m.y - 16, 'MISSILE KILLED', '#FFFFFF', 18); break; }
      }
    }
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (!m.alive) continue;
      for (let j = 0; j < fs.length; j++) {
        const f = fs[j];
        if (!f.alive || f.team === m.team) continue;
        const dx = f.x - m.x, dy = f.y - m.y, rr = f.r + m.r + 3;
        if (dx * dx + dy * dy < rr * rr) { this.missiles.explode(m, this); f.damage(m.dmg, m.owner, this, m.x, m.y, 'missile'); break; }
      }
    }
  }

  // ---- supply crates ---------------------------------------------------------------
  _crates(dt) {
    if (this.sync && !this.sync.host) return;              // online guest: crates come from the host
    if (!this.over) {
      this.crateT -= dt;
      if (this.crateT <= 0 && this.crates.length < BATTLE.CRATE_MAX) {
        this.crateT = BATTLE.CRATE_EVERY;
        const a = rand(TAU), d = rand(0.1, 0.7) * this.zone.r;
        const kind = Math.random() < 0.6 ? 'ammo' : 'repair';
        this.crates.push({ x: this.zone.cx + Math.cos(a) * d, y: this.zone.cy + Math.sin(a) * d, kind, t: 0, life: 26 });
        this.realAudio.sfx('crateDrop');
      }
    }
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.t += dt; c.life -= dt;
      if (c.life <= 0 || !this.zone.inside(c.x, c.y, -40)) { this.crates.splice(i, 1); continue; }
      if (c.t < 0.7) continue;                         // still parachuting in
      for (const f of this.fighters) {
        if (!f.alive || (f.x - c.x) ** 2 + (f.y - c.y) ** 2 > (f.r + 26) ** 2) continue;
        if (this.sync) this.sync.sendCrate(f, c);
        this._crateFx(f, c.x, c.y, c.kind);
        this.crates.splice(i, 1);
        break;
      }
    }
  }

  _crateFx(f, x, y, kind) {
    if (!f) return;
    if (kind === 'ammo') f.refill(BATTLE.CRATE_AMMO, 2); else f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.4);
    this.vfx.collect(x, y, kind === 'ammo' ? '#FFFFFF' : '#E23B3F');
    this.glow(x, y, 60, 0.35, kind === 'ammo' ? '255,240,180' : '255,120,120');
    if (f.human) {
      this.vfx.text(x, y - 26, kind === 'ammo' ? 'AMMO + MISSILES' : 'REPAIRED', kind === 'ammo' ? '#FFE38A' : '#FF9A9A', 20);
      this.realAudio.sfx(kind === 'ammo' ? 'crate' : 'heal');
    }
    if (this.sync && !this.sync.host) for (let i = this.crates.length - 1; i >= 0; i--) { const c = this.crates[i]; if ((c.x - x) ** 2 + (c.y - y) ** 2 < 4) this.crates.splice(i, 1); }
  }
  _zoneEvent(ev) {
    const hud = this.game.battleHud;
    if (ev === 'shrinking') { hud.banner('ZONE SHRINKING', 'Stay inside the circle', 1.8, true); this.realAudio.sfx('zoneShrink'); this.say('b.zone', 'normal'); }
    if (ev === 'final') hud.banner('FINAL ZONE', 'No more room to run', 1.8, true);
  }
  /** Online: the friend left. Host hands their jet to a bot; a guest can't go on without the host. */
  netLost() {
    if (!this.sync || this.sync.left) return;
    this.sync.left = true;
    const hud = this.game.battleHud;
    if (this.sync.host) {
      const f = this.fighters[this.sync.remoteIdx];
      f.remote = false; f.brain = new BotBrain(f, 0.6, 0.35);
      hud.banner('FRIEND DISCONNECTED', 'A bot took over their jet', 2.4, true);
    } else if (!this.over) {
      hud.banner('HOST LEFT', 'The match has ended', 2.4, true);
      this.over = true; this.endT = 0; this.reported = true;
      this.input.setEnabled(false);
      setTimeout(() => { if (this.running) this.game.ui.battle.openSetup(); }, 2600);
    }
  }

  // ---- audio ------------------------------------------------------------------------
  _audio(dt) {
    const a = this.realAudio, f = this.humans.find((h) => h.alive);
    if (!f || this.over) { if (!this._quiet) { this._quiet = true; a.setEngine(0); a.setStorm(0); a.setMissileLoop(false); } return; }
    this._quiet = false;
    const out = this.zone.distOut(f.x, f.y);
    this.engT = (this.engT || 0) - dt;
    if (this.engT <= 0) {                               // audio-param automation ten times a second is plenty
      this.engT = 0.1;
      a.setEngine(clamp(f.speed / (f.stats.speed * 1.55), 0.1, 1), f.boosting);
      a.setStorm(out > 0 ? 0.6 + Math.min(0.4, out / 400) : Math.max(0, 1 + out / 140) * 0.5);
      a.setMissileLoop(this.missiles.pool.active.some((m) => m.alive && m.owner && m.owner.human));
    }
    if (out > 0) { this.alarmT -= dt; if (this.alarmT <= 0) { this.alarmT = 0.9; a.sfx('zoneAlarm'); this.say('b.outside', 'low'); } } else this.alarmT = 0;
    if (f.hp < f.maxHp * 0.28) { this.beatT -= dt; if (this.beatT <= 0) { this.beatT = 0.85; a.sfx('heartbeat'); this.say('b.lowhp', 'low'); } }
    if (this.missiles.threats > 0) { this.lockT -= dt; if (this.lockT <= 0) { this.lockT = 0.4; a.sfx('lock'); } }
    // fly-by whoosh when an enemy screams past
    this.flybyT -= dt;
    if (this.flybyT <= 0) {
      for (const e of this.fighters) {
        if (!e.alive || e === f) continue;
        if ((e.x - f.x) ** 2 + (e.y - f.y) ** 2 < 85 * 85) { a.sfx('flyby'); this.flybyT = 1.2; break; }
      }
    }
  }

  // ---- camera ----------------------------------------------------------------------
  /** What camera `pi` should look at: its pilot, or (while dead) whoever shot it down. */
  _focusOf(h) {
    if (h.alive) return h;
    if (h.killedBy && h.killedBy.alive) return h.killedBy;            // kill-cam
    return this.fighters.find((o) => o.alive && o.team === h.team) || h;
  }
  /** Missile lock-on: brackets close in over ~0.8s, then LOCKED (tone + optional combat zoom). */
  _updateLock(dt) {
    const me = this.humans[0];
    const t = this.lockFx && !this.over && me.alive && me.missiles > 0 ? this.missileTarget(me, this.tlkTgt) : null;
    if (t !== this.tlkTgt) { this.tlkTgt = t; this.tlk = 0; this.tlkSaid = false; }
    if (t) {
      this.tlk = Math.min(1, this.tlk + dt / 0.8);
      if (this.tlk >= 1 && !this.tlkSaid) { this.tlkSaid = true; this.realAudio.sfx('lockOn'); this.vibrate(12); }
    }
    const near = t && Math.hypot(t.x - me.x, t.y - me.y) < 470;
    const want = !this.view3d && t && this.tlk >= 1 && near ? 1 : 0;
    this.lockZ += (want - this.lockZ) * Math.min(1, dt * (want ? 2.5 : 1.8));
  }
  _renderLock(ctx, cam) {
    const t = this.tlkTgt;
    if (!t || !t.alive || this.tlk <= 0) return;
    const k = this.tlk, locked = k >= 1, s = 1 / cam.z;
    const R = (t.r || 16) * (2.4 - 1.15 * takeoffCurves.smooth(0, 1, k)), L = R * 0.42;
    const col = locked ? '255,72,72' : '255,196,64';
    const spin = locked ? 0 : (1 - k) * 1.6 + this.time * 2.2;
    ctx.save();
    ctx.translate(t.x, t.y); ctx.rotate(spin);
    ctx.lineWidth = 2.4 * s; ctx.strokeStyle = `rgba(${col},${0.55 + 0.45 * k})`;
    ctx.shadowColor = `rgba(${col},0.8)`; ctx.shadowBlur = 8;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(R - L, -R); ctx.lineTo(R, -R); ctx.lineTo(R, -R + L); ctx.stroke();
    }
    if (locked) {
      const pulse = 1 + 0.12 * Math.sin(this.time * 14);
      ctx.rotate(Math.PI / 4); ctx.lineWidth = 2 * s;
      const d = R * 0.55 * pulse; ctx.strokeRect(-d, -d, d * 2, d * 2);
      ctx.rotate(-Math.PI / 4 - spin);
      ctx.shadowBlur = 0; ctx.fillStyle = `rgba(${col},0.95)`;
      ctx.font = `bold ${Math.round(13 * s)}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('LOCKED', 0, R + 16 * s);
    } else {
      ctx.rotate(-spin); ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(${col},0.85)`; ctx.fillRect(-R, R + 8 * s, R * 2 * k, 3 * s);   // lock progress bar
    }
    ctx.restore();
  }
  _camera(dt) {
    const k = Math.min(1, dt * 4.5);
    if (this.phase === 'intro') this.introZoom += (1 - this.introZoom) * Math.min(1, dt * 0.35);
    else this.introZoom += (1 - this.introZoom) * Math.min(1, dt * 3);
    const n = this.split ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const cam = this.cams[i], p = this._focusOf(this.humans[i]);
      let tx = p.x + Math.cos(p.a) * 50, ty = p.y + Math.sin(p.a) * 50;
      const lz = i === 0 && this.lockZ > 0.01 && this.tlkTgt ? this.lockZ : 0;
      if (lz) { tx += ((this.tlkTgt.x + p.x) / 2 - tx) * lz * 0.5; ty += ((this.tlkTgt.y + p.y) / 2 - ty) * lz * 0.5; }
      let z = (this.split ? 0.86 : 1) - (p.boosting ? 0.09 : 0) - clamp((p.speed - p.stats.speed) / p.stats.speed, 0, 0.5) * 0.08;
      z = z * this.introZoom * (1 + 0.12 * lz) + this.zPunch;
      if (this.over) z *= 1 + Math.min(0.15, this.endT * 0.05);
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      cam.z += (z - cam.z) * Math.min(1, dt * 3);
    }
    const lbT = this.phase === 'intro' || this.over ? 1 : (!this.split && !this.humans[0].alive) ? 0.45 : this.slowT > 0 ? 0.3 : 0;
    this.lb += (lbT - this.lb) * Math.min(1, dt * 4);
  }
  _camDist(x, y) {
    let d = 1e9;
    for (let i = 0; i < (this.split ? 2 : 1); i++) { const c = this.cams[i]; d = Math.min(d, Math.hypot(x - c.x, y - c.y) * c.z); }
    return d;
  }

  // ---- rendering ---------------------------------------------------------------------
  render(ctx) {
    const v = this.view;
    if (this.view3d) {
      const me = this.humans[0], f = this._focusOf(me);
      this.cockpit.render(ctx, this, v.w, v.h, f);
      let hurt = me.hurtA || 0;
      if (me.alive && me.hp < me.maxHp * 0.28) hurt = Math.max(hurt, 0.25 + 0.15 * Math.sin(this.time * 6));
      if (me.alive && me.outside) hurt = Math.max(hurt, 0.3);
      screenGrade(ctx, v.w, v.h, { hq: false, hurt, lb: this.lb });
      this.vfx.renderScreen(ctx, v.w, v.h);
      return;
    }
    if (!this.split) this._renderView(ctx, this.cams[0], v.w, v.h, 0);
    else {
      // split screen: side by side on wide screens, stacked on tall ones
      const side = v.w >= v.h;
      for (let i = 0; i < 2; i++) {
        const x = side ? (i * v.w) / 2 : 0, y = side ? 0 : (i * v.h) / 2, w = side ? v.w / 2 : v.w, h = side ? v.h : v.h / 2;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.translate(x, y);
        this._renderView(ctx, this.cams[i], w, h, i);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(8,6,16,0.9)';
      if (side) ctx.fillRect(v.w / 2 - 2, 0, 4, v.h); else ctx.fillRect(0, v.h / 2 - 2, v.w, 4);
    }
    if (this.punch > 0) drawCloudPunch(ctx, v.w, v.h, this.punch, this.bg.sprites);
    // letterbox bars
    if (this.lb > 0.01) {
      const bh = this.lb * v.h * 0.085;
      ctx.fillStyle = '#05040A';
      ctx.fillRect(0, 0, v.w, bh); ctx.fillRect(0, v.h - bh, v.w, bh);
    }
    this.vfx.renderScreen(ctx, v.w, v.h);
  }

  _renderView(ctx, cam, w, h, pi) {
    const z = cam.z, q = this.quality.trails;
    this.bg.render(ctx, cam, w, h);
    ctx.save();
    ctx.translate(w / 2 + this.vfx.sx, h / 2 + this.vfx.sy);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);
    this._zone(ctx, cam, w, h);
    if (this.runway && this.runway.alpha > 0.01 && this.phase === 'intro') {
      const k = 1 / (1 + this.runway.alt * 5);
      drawAirbase(ctx, this.runway, this.runway.alpha, k, cam, this.time, this.humans[0].sprite, this.bg.theme);
    }
    this._renderCrates(ctx);
    this.flares.render(ctx, this.time);
    this.missiles.render(ctx, this.time);
    const hw = w / 2 / z + 120, hh = h / 2 / z + 120, me = this.humans[pi];
    // soft shadows on the ground far below sell the height (and look great on terrain)
    if (this.quality.particles >= 0.5) {
      for (const f of this.fighters) {
        if (!f.alive || Math.abs(f.x - cam.x) > hw || Math.abs(f.y - cam.y) > hh) continue;
        const lk = f.lift === undefined ? 1 : f.lift, so = 4 + 22 * lk;            // on the runway the shadow sits right under the jet
        drawSprite(ctx, this._shadow(f.sprite), f.x + so, f.y + so * 1.45, f.a, f.bank, 0.22 + (1 - lk) * 0.15);
      }
    }
    for (const f of this.fighters) {
      if (!f.alive || Math.abs(f.x - cam.x) > hw || Math.abs(f.y - cam.y) > hh) continue;
      f.render(ctx, q, this.time, f === me);
    }
    this.bullets.render(ctx);
    if (pi === 0) this._renderLock(ctx, cam);
    this.vfx.render(ctx);
    this._glows(ctx);
    this._marks(ctx);
    ctx.restore();
    this.bg.renderFront(ctx, cam, w, h);
    this._wisps(ctx, cam, w, h);
    this._indicators(ctx, cam, w, h, pi);
    this._screenFx(ctx, cam, w, h, pi);
  }

  _zone(ctx, cam, vw, vh) {
    const z = this.zone, s = 1 / cam.z;
    const W = vw * s, H = vh * s, col = this.map.zone;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    // the storm outside the circle
    ctx.beginPath();
    ctx.rect(cam.x - W, cam.y - H, W * 2, H * 2);
    ctx.arc(z.cx, z.cy, z.r, 0, TAU, true);
    ctx.fillStyle = `rgba(${col},${0.2 + 0.05 * pulse})`;
    ctx.fill();
    // the wall itself: a wide soft band and a bright core
    ctx.strokeStyle = `rgba(${col},0.22)`; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.arc(z.cx, z.cy, z.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.3 * pulse})`; ctx.lineWidth = 3.5;
    ctx.setLineDash([30, 14]); ctx.lineDashOffset = -this.time * 60;
    ctx.beginPath(); ctx.arc(z.cx, z.cy, z.r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    if (z.next && z.state !== 'final') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      ctx.beginPath(); ctx.arc(z.next.cx, z.next.cy, z.next.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    // the map edge
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, BATTLE.MAP_R, 0, TAU); ctx.stroke();
  }

  _renderCrates(ctx) {
    for (const c of this.crates) {
      if (c.life < 4 && Math.sin(c.life * 16) > 0.3) continue;
      const drop = Math.max(0, 1 - c.t / 0.7), sc = 1 + drop * 1.6;
      ctx.save();
      ctx.translate(c.x, c.y + Math.sin(c.t * 3) * 3);
      // drop shadow grows in as it lands
      ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - drop)})`;
      ctx.beginPath(); ctx.ellipse(6, 10, 22, 9, 0, 0, TAU); ctx.fill();
      ctx.scale(sc, sc);
      ctx.globalAlpha = 1 - drop * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(c.t * 4) * 2, 0, TAU); ctx.fill();
      const spr = pickupSprite(c.kind === 'ammo' ? 'missile' : 'health');
      ctx.drawImage(spr, -20, -20, 40, 40);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  /** Black silhouette of a sprite, for ground shadows (cached per sprite). */
  _shadow(spr) {
    if (spr.shadow) return spr.shadow;
    const c = document.createElement('canvas'); c.width = spr.c.width; c.height = spr.c.height;
    const g = c.getContext('2d');
    g.filter = 'blur(2px)';
    g.drawImage(spr.w, 0, 0);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0a0812'; g.fillRect(0, 0, c.width, c.height);
    spr.shadow = { c, w: c, half: spr.half };
    return spr.shadow;
  }
  /** Big, faint cloud wisps sliding past *above* the dogfight: foreground depth. */
  _wisps(ctx, cam, w, h) {
    if (this.quality.particles < 0.7 || !this.bg.sprites.length || this.bg.theme.dark) return;
    const T = 2600, par = 1.6;
    ctx.globalAlpha = (this.bg.theme.clouds || 1) < 0.3 ? 0.12 : 0.2;
    for (let i = 0; i < 3; i++) {
      const spr = this.bg.sprites[i], s = 2.6 + i * 0.5;
      const sw = spr.width * s, sh = spr.height * s;
      let x = ((i * 977 + this.time * 18 - cam.x * par) % T + T) % T - sw;
      let y = ((i * 1543 - cam.y * par) % T + T) % T - sh;
      if (x > w || y > h) continue;
      ctx.drawImage(spr, x, y, sw, sh);
    }
    ctx.globalAlpha = 1;
  }
  _glowSprite(rgb) {
    this._gs = this._gs || {};
    if (this._gs[rgb]) return this._gs[rgb];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(0.35, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (this._gs[rgb] = c);
  }
  /** Additive light blooms: explosions, muzzle hits, boosts. Sells the cinematic look. */
  _glows(ctx) {
    if (!this.glows.length || this.quality.particles < 0.5) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const k = g.life / g.max, r = g.r * (1.2 - 0.4 * k);
      ctx.globalAlpha = k;
      ctx.drawImage(this._glowSprite(g.rgb), g.x - r, g.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  _marks(ctx) {
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5;
    for (const m of this.marks) {
      const s = (m.big ? 14 : 8) * (0.7 + m.t * 2);
      ctx.globalAlpha = Math.min(1, m.t * 8);
      ctx.beginPath();
      ctx.moveTo(m.x - s, m.y - s); ctx.lineTo(m.x - s * 0.4, m.y - s * 0.4);
      ctx.moveTo(m.x + s, m.y - s); ctx.lineTo(m.x + s * 0.4, m.y - s * 0.4);
      ctx.moveTo(m.x - s, m.y + s); ctx.lineTo(m.x - s * 0.4, m.y + s * 0.4);
      ctx.moveTo(m.x + s, m.y + s); ctx.lineTo(m.x + s * 0.4, m.y + s * 0.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Edge arrows: enemies (red), teammates (blue) and supply crates (gold). */
  _indicators(ctx, cam, vw, vh, pi) {
    if (this.phase === 'intro' || this.over) return;
    const z = cam.z, hw = vw / 2, hh = vh / 2, inset = 20;
    const top = hh * 0.22, bottom = vh - 24;
    const draw = (wx, wy, color, size, dot) => {
      const dx = (wx - cam.x) * z, dy = (wy - cam.y) * z;
      if (Math.abs(dx) < hw - 10 && Math.abs(dy) < hh - 10) return;
      const sc = Math.min((hw - inset) / Math.abs(dx || 1e-6), (hh - inset) / Math.abs(dy || 1e-6));
      const sx = hw + dx * sc, sy = clamp(hh + dy * sc, top, bottom);
      ctx.save(); ctx.translate(sx, sy);
      if (dot) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, size + 2, 0, TAU); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, size, 0, TAU); ctx.fill();
      } else {
        ctx.rotate(Math.atan2(dy, dx));
        ctx.fillStyle = color; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.7, -size * 0.75); ctx.lineTo(-size * 0.3, 0); ctx.lineTo(-size * 0.7, size * 0.75); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    };
    const focusTeam = this.humans[pi].team;
    const foes = this.fighters.filter((f) => f.alive && f.team !== focusTeam).map((f) => [f, (f.x - cam.x) ** 2 + (f.y - cam.y) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, 4);
    for (const [f, d2] of foes) if (d2 < 1100 * 1100) draw(f.x, f.y, TEAMS[f.team].main, 9);
    for (const f of this.fighters) {
      if (!f.alive || f === this.humans[pi] || f.team !== focusTeam) continue;
      if ((f.x - cam.x) ** 2 + (f.y - cam.y) ** 2 < 1400 * 1400) draw(f.x, f.y, TEAMS[f.team].main, 5, true);
    }
    for (const m of this.missiles.pool.active) if (m.threat && m.target === this.humans[pi]) draw(m.x, m.y, '#FFFFFF', 7);
    for (const c of this.crates) if ((c.x - cam.x) ** 2 + (c.y - cam.y) ** 2 < 900 * 900) draw(c.x, c.y, c.kind === 'ammo' ? '#F7D21E' : '#E23B3F', 5, true);
    // arrow back to the safe zone when outside it
    for (const h of [this.humans[pi]]) {
      if (!h.alive || this.zone.inside(h.x, h.y)) continue;
      const a = Math.atan2(this.zone.cy - h.y, this.zone.cx - h.x);
      const sx = hw + (h.x - cam.x) * z + Math.cos(a) * 70, sy = hh + (h.y - cam.y) * z + Math.sin(a) * 70;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -12); ctx.lineTo(-2, 0); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }

  _screenFx(ctx, cam, w, h, pi) {
    const hq = this.quality.particles >= 0.7, me = this.humans[pi], f = me && me.alive ? me : null;
    // speed lines while boosting
    if (f && f.boosting) {
      const a = f.a, ca = Math.cos(a), sa = Math.sin(a), sp = (f.speed / f.stats.speed) * 900;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const s of this.streaks) {
        s.x -= ca * sp * 0.016 / w; s.y -= sa * sp * 0.016 / h;
        if (s.x < 0) s.x += 1; if (s.x > 1) s.x -= 1; if (s.y < 0) s.y += 1; if (s.y > 1) s.y -= 1;
        const x = s.x * w, y = s.y * h, L = 40 * s.l;
        ctx.moveTo(x, y); ctx.lineTo(x + ca * L, y + sa * L);
      }
      ctx.stroke();
    }
    // colour grade + sun bloom (medium/high quality)
    if (hq) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(${this.map.grade},${this.map.gradeA})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const sx = this.map.sun[0] * w, sy = this.map.sun[1] * h, r = Math.max(w, h) * 0.5;
      ctx.globalAlpha = 0.28;
      ctx.drawImage(this._glowSprite('255,230,180'), sx - r, sy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // vignette (gradients cached per viewport size)
    const key = w + 'x' + h;
    if (this._vigKey !== key) {
      this._vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58);
      this._vig.addColorStop(0, 'rgba(0,0,0,0)'); this._vig.addColorStop(1, 'rgba(10,6,20,0.5)');
      this._hurt = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      this._hurt.addColorStop(0, 'rgba(200,0,0,0)'); this._hurt.addColorStop(1, 'rgba(200,0,0,0.85)');
      this._vigKey = key;
    }
    ctx.fillStyle = this._vig; ctx.fillRect(0, 0, w, h);
    // damage: red edges, stronger when badly hurt or burning in the zone
    let hurt = me ? me.hurtA || 0 : 0;
    if (f && f.hp < f.maxHp * 0.28) hurt = Math.max(hurt, 0.25 + 0.15 * Math.sin(this.time * 6));
    if (f && f.outside) hurt = Math.max(hurt, 0.3 + 0.12 * Math.sin(this.time * 8));
    if (hurt > 0.01) { ctx.globalAlpha = Math.min(1, hurt); ctx.fillStyle = this._hurt; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    // direction of incoming fire
    for (const d of this.dmgDirs) {
      if (d.pi !== pi || !f) continue;
      const cx = w / 2 + (f.x - cam.x) * cam.z, cy = h / 2 + (f.y - cam.y) * cam.z, R = 70;
      ctx.strokeStyle = `rgba(255,50,40,${Math.min(1, d.t).toFixed(3)})`; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, R, d.a - 0.35, d.a + 0.35); ctx.stroke();
    }
    // spectating: dim the world a little
    if (me && !me.alive && !this.over) { ctx.fillStyle = 'rgba(20,10,30,0.28)'; ctx.fillRect(0, 0, w, h); }
  }

  /** Radar in the HUD: zone, next zone, aircraft and crates. */
  drawMinimap(ctx, S) {
    const z = this.zone, R = BATTLE.MAP_R * 0.85, k = (S / 2 - 3) / R, c = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, S / 2 - 1, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(12,16,28,0.62)'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = `rgba(${this.map.zone},0.35)`;
    ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.arc(c + z.cx * k, c + z.cy * k, z.r * k, 0, TAU, true); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo((S * i) / 4, 0); ctx.lineTo((S * i) / 4, S); ctx.moveTo(0, (S * i) / 4); ctx.lineTo(S, (S * i) / 4); ctx.stroke(); }
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(c + z.cx * k, c + z.cy * k, z.r * k, 0, TAU); ctx.stroke();
    if (z.next && z.state !== 'final') {
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(c + z.next.cx * k, c + z.next.cy * k, z.next.r * k, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const cr of this.crates) { ctx.fillStyle = cr.kind === 'ammo' ? '#F7D21E' : '#FF6B6B'; ctx.fillRect(c + cr.x * k - 2, c + cr.y * k - 2, 4, 4); }
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const x = c + f.x * k, y = c + f.y * k;
      ctx.fillStyle = TEAMS[f.team].main;
      if (f.human) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(f.a);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill(); }
    }
    // camera view box(es)
    const v = this.view, n = this.split ? 2 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const cam = this.cams[i], cz = cam.z, vw = (this.split && v.w >= v.h ? v.w / 2 : v.w) / cz, vh = (this.split && v.w < v.h ? v.h / 2 : v.h) / cz;
      ctx.strokeRect(c + (cam.x - vw / 2) * k, c + (cam.y - vh / 2) * k, vw * k, vh * k);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c, c, S / 2 - 1, 0, TAU); ctx.stroke();
  }
}
