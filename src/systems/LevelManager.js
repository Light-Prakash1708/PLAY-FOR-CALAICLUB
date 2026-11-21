// Runs one mission from its data config: spawn stream, scripted waves,
// boss trigger, objective tracking and the Level 1 tutorial.
import { lerp, rand, weightedPick, TAU, clamp } from '../core/utils.js';
import { ENEMIES } from '../data/enemies.js';

export class LevelManager {
  constructor(world, def) {
    this.world = world; this.def = def;
    const ease = world.assist || 0;       // 0-3 failed attempts in a row
    this.fireMul = (def.fireMul || 1) * (1 - 0.1 * ease);
    this.missileMul = (def.missiles === undefined ? 1 : def.missiles) * (1 - 0.15 * ease);
    this.kills = 0; this.kindKills = 0; this.formationsDone = 0;
    this.stream = def.stream || null;
    this.spawnT = def.tutorial ? 3.5 : 1.6;
    this.waves = def.waves || null;
    this.waveIndex = -1; this.waveAlive = 0; this.waveGap = 1.8; this.wavesCleared = 0;
    this.formations = new Map();
    this.bossState = 'none';          // none | warning | active | dead
    this.warnT = 0;
    this.done = false;
    this.tut = def.tutorial ? { step: 0, t: 0 } : null;
  }

  // ---- objective ----------------------------------------------------------
  isComplete() {
    const o = this.def.objective;
    switch (o.type) {
      case 'kills': return this.kills >= o.count;
      case 'kinds': return this.kindKills >= o.count;
      case 'formations': return this.formationsDone >= o.count;
      case 'waves': return this.wavesCleared >= this.waves.length;
      case 'boss': return this.bossState === 'dead';
      case 'survive': return this.world.stats.time >= o.count;
    }
    return false;
  }
  progress() {
    const o = this.def.objective, b = this.def.boss;
    switch (o.type) {
      case 'kills': return clamp(this.kills / o.count, 0, 1);
      case 'kinds': return clamp(this.kindKills / o.count, 0, 1);
      case 'formations': return clamp(this.formationsDone / o.count, 0, 1);
      case 'waves': return clamp(this.wavesCleared / this.waves.length, 0, 1);
      case 'boss': return this.bossState === 'none' && b.afterKills ? clamp(this.kills / b.afterKills, 0, 1) : 1;
      case 'survive': return clamp(this.world.stats.time / o.count, 0, 1);
    }
    return 0;
  }
  progressText() {
    const o = this.def.objective, b = this.def.boss;
    switch (o.type) {
      case 'kills': return `${Math.min(this.kills, o.count)}/${o.count}`;
      case 'kinds': return `${Math.min(this.kindKills, o.count)}/${o.count}`;
      case 'formations': return `${this.formationsDone}/${o.count}`;
      case 'waves': return `WAVE ${Math.min(this.waveIndex + 1, this.waves.length) || 1}/${this.waves.length}`;
      case 'survive': { const left = Math.max(0, Math.ceil(o.count - this.world.stats.time)); return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} LEFT`; }
      case 'boss':
        if (this.bossState === 'none') return b.afterKills ? `ESCORTS ${Math.min(this.kills, b.afterKills)}/${b.afterKills}` : 'ESCORTS';
        return 'BOSS';
    }
    return '';
  }

  // ---- spawning -----------------------------------------------------------
  /** A point just outside the view so nothing ever appears on top of the player. */
  spawnPoint(angle) {
    const w = this.world, p = w.player;
    const a = angle === undefined ? rand(TAU) : angle;
    const d = Math.hypot(w.view.w, w.view.h) / 2 + 70 + rand(0, 90);
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, a: a + Math.PI };
  }
  spawnEvent(ev, wave = -1, countsAsFormation = false) {
    const em = this.world.enemies;
    const base = rand(TAU);
    let spawned = 0;
    if (ev.form && ev.n > 1) {
      const s = this.spawnPoint(base);
      const members = em.spawnFormation(ev.type, ev.n, ev.form, s.x, s.y, s.a);
      if (members.length) {
        this.formations.set(members[0].formId, { alive: members.length, counts: countsAsFormation });
        for (const m of members) m.wave = wave;
        spawned = members.length;
      }
    } else {
      for (let i = 0; i < ev.n; i++) {
        const s = this.spawnPoint(base + (i - (ev.n - 1) / 2) * 0.32);
        const e = em.spawn(ev.type, s.x, s.y, s.a);
        if (e) { e.wave = wave; spawned++; }
      }
    }
    return spawned;
  }
  spawnEscorts(type, n) { this.spawnEvent({ type, n }); }

  update(dt) {
    if (this.done) return;
    const w = this.world;
    if (this.tut) this._tutorial(dt);
    if (this.def.objective.type === 'survive') { this._check(); if (this.done) return; }

    if (this.stream && this.bossState !== 'warning') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const s = this.stream, pr = this.progress();
        const maxAlive = Math.round(lerp(s.maxAlive[0], s.maxAlive[1], pr));
        if (w.enemies.count() < maxAlive) this.spawnEvent(weightedPick(s.events));
        this.spawnT = lerp(s.interval[0], s.interval[1], pr) * rand(0.85, 1.15);
      }
    }

    if (this.waves && this.waveAlive <= 0 && this.waveIndex < this.waves.length - 1) {
      this.waveGap -= dt;
      if (this.waveGap <= 0) this._startWave();
    }

    const b = this.def.boss;
    if (b && this.bossState === 'none') {
      const ready = (b.afterKills && this.kills >= b.afterKills) || (b.afterWaves && this.wavesCleared >= this.waves.length) || (!b.afterKills && !b.afterWaves);
      if (ready) {
        this.bossState = 'warning'; this.warnT = 3;
        w.game.onBossWarning(ENEMIES[b.type]);
      }
    } else if (this.bossState === 'warning') {
      this.warnT -= dt;
      if (this.warnT <= 0) {
        const s = this.spawnPoint(w.player.a + rand(-0.5, 0.5));    // arrives from ahead so it is seen coming
        const boss = w.enemies.spawn(b.type, s.x, s.y, s.a);
        if (boss) { this.bossState = 'active'; this.stream = b.stream || null; this.spawnT = 6; w.game.onBossSpawn(boss); }
      }
    }
  }
  _startWave() {
    this.waveIndex++;
    const wave = this.waves[this.waveIndex];
    let n = 0;
    const formationObjective = this.def.objective.type === 'formations';
    for (const ev of wave.events) n += this.spawnEvent(ev, this.waveIndex, formationObjective && !!ev.form);
    this.waveAlive = n;
    if (this.waves.length > 1) {
      const label = this.def.objective.type === 'formations' ? `FORMATION ${this.waveIndex + 1}/${this.waves.length}` : (wave.name || `WAVE ${this.waveIndex + 1}/${this.waves.length}`);
      this.world.game.hud.banner(label, 'INCOMING', 1.8);
      this.world.audio.sfx('swoosh');
    }
    if (n === 0) this._waveCleared();
  }
  _waveCleared() {
    this.wavesCleared++;
    this.waveAlive = 0;
    this.waveGap = 2.4;
    if (this.wavesCleared < this.waves.length) this.world.supplyDrop(this.wavesCleared % 2 ? 'health' : 'missile');
    if (this.def.objective.type === 'waves' && this.wavesCleared < this.waves.length) this.world.game.hud.banner('WAVE CLEARED', '', 1.4);
  }

  onKill(e) {
    if (this.done) return;
    const o = this.def.objective;
    if (!e.def.boss) {
      this.kills++;
      // regular supply drops keep long fights winnable: repairs when hurt, otherwise ammunition
      if (this.kills % 7 === 0) { const p = this.world.player; this.world.supplyDrop(p.hp < p.maxHp * 0.65 ? 'health' : 'missile'); }
      if (o.kinds && o.kinds.includes(e.def.id)) this.kindKills++;
    }
    if (e.formId) {
      const f = this.formations.get(e.formId);
      if (f && --f.alive <= 0) {
        this.formations.delete(e.formId);
        if (f.counts) {
          this.formationsDone++;
          this.world.vfx.text(e.x, e.y - 30, 'FORMATION DESTROYED', '#FFFFFF', 24);
          this.world.addScore(500);
        }
      }
    }
    if (e.wave >= 0 && e.wave === this.waveIndex && --this.waveAlive <= 0) this._waveCleared();
    this._check();
  }
  onBossDead() {
    this.bossState = 'dead';
    this._check();
  }
  _check() {
    if (!this.done && this.isComplete()) { this.done = true; this.world.finish(true); }
  }

  // ---- tutorial -----------------------------------------------------------
  _tutorial(dt) {
    const t = this.tut, w = this.world, touch = w.touch;
    t.t += dt;
    const next = () => { t.step++; t.t = 0; };
    switch (t.step) {
      case 0: if (t.t > 1) { w.hint(touch ? 'Drag the stick to steer your aircraft' : 'Steer with WASD or the arrow keys', 6); t.turn0 = w.player.turned; next(); } break;
      case 1: if (w.player.turned - t.turn0 > 2.5 || t.t > 7) { w.hint(touch ? 'Hold CANNON to shoot - line the enemy up in front of you' : 'Hold SPACE to fire your cannon', 6); next(); } break;
      case 2: if (this.kills >= 3) { w.hint(touch ? 'Tap MISSILE to launch a homing missile' : 'Press K to launch a homing missile', 6); t.m0 = w.weapons.missilesFired; next(); } break;
      case 3: if (this.kills >= 6 && (w.weapons.missilesFired > t.m0 || t.t > 8)) { w.hint(touch ? 'SPECIAL unleashes your aircraft\'s special attack' : 'Press L for your aircraft\'s special attack', 6); next(); } break;
      case 4: if (t.t > 7) { w.hint('Collect stars, coins and power-ups', 4); next(); } break;
      default: this.tut = null;
    }
  }
}
