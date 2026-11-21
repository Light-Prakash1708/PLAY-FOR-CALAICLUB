// Top-level orchestrator: owns every system, the state machine and the
// single game loop. UI modules call into this class; it never reaches into
// their DOM.
import { CONFIG, DEV } from './GameConfig.js';
import { State, GameState } from './GameState.js';
import { GameLoop } from './GameLoop.js';
import { World } from './World.js';
import { Ambient } from './Ambient.js';
import { clamp } from './utils.js';
import { SaveManager } from '../systems/SaveManager.js';
import { UpgradeManager } from '../systems/UpgradeManager.js';
import { RewardManager } from '../systems/RewardManager.js';
import { AudioManager } from '../systems/AudioManager.js';
import { InputManager } from '../systems/InputManager.js';
import { Background } from '../systems/Background.js';
import { UI } from '../ui/UI.js';
import { MenuUI } from '../ui/MenuUI.js';
import { LevelSelectUI } from '../ui/LevelSelectUI.js';
import { HangarUI } from '../ui/HangarUI.js';
import { SettingsUI } from '../ui/SettingsUI.js';
import { HUD } from '../ui/HUD.js';
import { ResultUI } from '../ui/ResultUI.js';
import { LEVELS } from '../data/levels.js';
import { LINES } from '../story/script.js';
import { AIRCRAFT, AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { ENEMIES } from '../data/enemies.js';
import { PLAYER_ART, ENEMY_ART } from '../art/planeSpecs.js';
import { getSprite } from '../art/PlaneArt.js';
import { pickupSprite } from '../combat/Pickup.js';
import { BattleWorld } from '../battle/BattleWorld.js';
import { readInvite } from '../battle/Invite.js';
import { readRoomLink } from '../net/Net.js';
import { ControlsUI } from '../ui/ControlsUI.js';
import { Radio } from '../story/Radio.js';
import { IntroScene, INTRO_LEN } from '../story/IntroScene.js';
import { RED_BOT_ART } from '../battle/battleData.js';
import { BattleUI } from '../ui/BattleUI.js';

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.app = canvas.parentElement;
    this.view = { w: CONFIG.VIEW_W, h: 960 };
    this.scale = 1;
    this.state = new GameState();
    this.save = new SaveManager();
    this.upgrades = new UpgradeManager(this.save);
    this.rewards = new RewardManager(this.save, this.upgrades);
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.background = new Background();
    this.world = new World(this);
    this.battle = new BattleWorld(this);
    this.mode = 'campaign';                 // 'campaign' | 'battle'
    this.ambient = new Ambient(this);
    this.levelId = 1;
    this.dev = DEV; this.devGod = false;
    if (DEV) this.applyDevUnlocks();

    const ui = this.ui = new UI(this, uiRoot);
    ui.menu = new MenuUI(ui);
    ui.levels = new LevelSelectUI(ui);
    ui.hangar = new HangarUI(ui);
    ui.settings = new SettingsUI(ui);
    this.hud = ui.hud = new HUD(ui);
    ui.result = new ResultUI(ui);
    this.battleHud = ui.battle = new BattleUI(ui);
    ui.controls = new ControlsUI(ui);
    this.radio = new Radio(this, uiRoot);
    this.intro = new IntroScene(this);
    this.introOn = false;
    this.roomCode = readRoomLink();         // opened from a friend's live room link (#room=CODE)?
    this.invite = readInvite();             // opened from a friend's invite / challenge link?

    this.loop = new GameLoop((dt) => this.update(dt), () => this.render());
    this._bindWindow();
    this.applySettings();
    this.resize();
  }

  /** Developer build only: all missions open, every aircraft owned, plenty of coins. */
  applyDevUnlocks() {
    const d = this.save.data;
    d.unlockedLevel = LEVELS.length;
    d.coins = Math.max(d.coins, 999999);
    for (const a of AIRCRAFT) this.upgrades.grant(a.id);
    this.save.save();
  }

  // ---- boot / loading ---------------------------------------------------------
  async boot() {
    const menu = this.ui.menu;
    this.ui.show('loading');
    this.loop.start();
    const steps = [];
    // real work: fonts, then pre-rasterise every sprite so nothing hitches mid-game
    steps.push(async () => { if (document.fonts && document.fonts.load) { try { await Promise.all([document.fonts.load('20px "Bebas Neue"'), document.fonts.load('700 16px "Nunito"'), document.fonts.load('900 16px "Nunito"')]); } catch (_) {} } });
    for (const a of AIRCRAFT) steps.push(() => getSprite('p_' + a.id, PLAYER_ART[a.id], a.size));
    for (const id in ENEMIES) steps.push(() => getSprite('e_' + id, ENEMY_ART[id], ENEMIES[id].size));
    // Team Battle flies the red jets a little larger: paint those now so the first battle never hitches
    for (const id of RED_BOT_ART) steps.push(() => getSprite('e_' + id, ENEMY_ART[id], ENEMIES[id].size + 4));
    steps.push(() => ['coin', 'star', 'health', 'missile', 'shield', 'rapid'].forEach(pickupSprite));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < steps.length; i++) {
      try { await steps[i](); } catch (e) { console.warn('load step failed', e); }
      menu.setProgress((i + 1) / steps.length);
      await wait(45);
    }
    await wait(250);
    menu.ready();
  }

  /** Opening cinematic after "tap to begin" (skipped for invite links and after the first view this session). */
  playIntro() {
    // automated tests (webdriver) skip it unless the URL asks for ?intro
    const auto = navigator.webdriver && !/[?&]intro\b/.test(location.search);
    if (this.invite || this.roomCode || this.introSeen || auto) { this.enterMenu(); return; }
    this.introSeen = true;
    this.introOn = true;
    this.intro.start();
    this.ui.menu.stopTips();
    this.ui.show('intro');
    this.audio.playMusic('battle');
    this.audio.sfx('boost');
    this._introSaid = false;
  }
  finishIntro() {
    if (!this.introOn) return;
    this.introOn = false;
    this.enterMenu();
  }

  enterMenu() {
    this.introOn = false;
    if (this.net && this.net.active) this.net.close();          // leaving to the main menu leaves the room
    this.world.stop(); this.battle.stop(); this.mode = 'campaign';
    this.battle.input.setEnabled(false);
    this.input.enabled = false; this.input.reset();
    for (const m of ['settings', 'brief', 'daily', 'confirm']) this.ui.closeModal(m);
    this.state.set(State.MENU);
    this.background.setTheme('day');
    this.audio.setEngine(0); this.audio.setStorm(0);
    this.radio.clear();
    this.ambient.setHero(this.save.data.selected);
    this.audio.setPaused(false);
    this.audio.playMusic('menu');
    this.ui.menu.stopTips();
    this.ui.menu.refresh();
    this.ui.show('menu');
    if (this.invite) { const inv = this.invite; this.invite = null; this.ui.battle.openSetup(inv); }
    if (this.roomCode) { const c = this.roomCode; this.roomCode = null; this.ui.battle.openSetup(); this.ui.battle.online.open(); this.ui.battle.online.join(c); }
  }

  // ---- mission flow -------------------------------------------------------------
  startLevel(id) {
    const level = LEVELS[id - 1];
    if (!level || id > this.save.data.unlockedLevel) return false;
    this.levelId = id;
    const d = this.save.data, aircraft = AIRCRAFT_BY_ID[d.selected];
    this.world.start(level, aircraft, this.upgrades.stats(aircraft.id), { ...d.settings, assist: d.fails[id] || 0 });
    this.input.reset(); this.input.enabled = true;
    this.state.set(State.PLAYING);
    this.ui.show('hud');
    this.hud.reset(level, this.world);
    this.hud.banner(`MISSION ${level.id}`, level.name, 2.2);
    this.radio.clear();
    this.radio.say(`m${level.id}.start`, 'high');
    this.audio.setPaused(false);
    this.audio.playMusic('game');
    this.audio.sfx('levelStart'); this.audio.sfx('takeoff');
    this.loop.resetClock();
    return true;
  }
  restart() {
    this.ui.closeModal('settings');
    if (this.mode === 'battle') this.startBattle(this.battleHud.cfg);
    else this.startLevel(this.levelId);
  }
  continueCampaign() {
    const next = this.levelId + 1;
    if (next <= LEVELS.length && next <= this.save.data.unlockedLevel) {
      this.state.set(State.MENU);
      this.background.setTheme('day');
      this.audio.playMusic('menu');
      this.ui.levels.refresh();
      this.ui.show('levels');
      this.ui.levels.openBrief(next);
    } else this.enterMenu();
  }

  // ---- Team Battle flow -----------------------------------------------------------
  enterBattleSetup() {
    this.world.stop(); this.battle.stop(); this.mode = 'campaign';
    this.input.enabled = false; this.input.reset();
    for (const m of ['settings', 'brief', 'daily', 'confirm']) this.ui.closeModal(m);
    this.state.set(State.MENU);
    this.background.setTheme('day');
    this.audio.setPaused(false);
    this.audio.setEngine(0); this.audio.setStorm(0);
    this.radio.clear();
    this.audio.playMusic('menu');
  }
  startBattle(cfg) {
    this.radio.clear();
    this.onlinePause = false; this.ui.hide('bpause');
    const s = this.save.data.settings;
    this.ui.closeModal('settings');
    this.world.stop();
    this.mode = 'battle';
    this.battle.start(cfg, { quality: CONFIG.QUALITY[s.quality], vibration: s.vibration, fireMode: s.fireMode, autoFlares: s.autoFlares, lockFx: s.lockFx });
    this.input.reset(); this.input.enabled = true;
    this.battle.input.setEnabled(false);          // unlocked on "FIGHT!"
    this.state.set(State.PLAYING);
    this.ui.show('battle');
    this.battleHud.reset(this.battle);
    this.battleHud.banner(this.battle.mode.name, this.battle.map.name, 2.4);
    this.audio.setPaused(false);
    this.audio.playMusic('battle');
    this.audio.sfx('levelStart');
    this.loop.resetClock();
    return true;
  }
  /** Fired once by BattleWorld after the end-of-round outro. */
  onBattleEnd(result) {
    if (!this.state.is(State.PLAYING) || this.mode !== 'battle') return;
    this.input.enabled = false; this.input.reset();
    this.battle.input.setEnabled(false);
    this.state.set(State.COMPLETE);
    this.audio.setEngine(0); this.audio.setStorm(0); this.audio.setMissileLoop(false);
    const reward = this.rewardBattle(result);
    const me = result.board.find((b) => b.human && b.pi === 0);
    this.audio.jingle(result.winner >= 0 && (result.mode === 'versus' || result.winner === me.team) ? 'victory' : 'defeat');
    this.ui.hide('battle');
    this.battleHud.showResult(result, reward);
  }
  rewardBattle(r) {
    const d = this.save.data, me = r.board.find((b) => b.human && b.pi === 0);
    if (!me) return null;
    const won = r.winner >= 0 && r.winner === me.team, draw = r.winner < 0;
    const coins = me.kills * 20 + me.assists * 8 + (won ? 120 : draw ? 50 : 30);
    d.coins = Math.min(9999999, d.coins + coins);
    d.stats.kills += me.kills;
    d.stats.xp += me.kills * 25 + (won ? 80 : 20);
    d.battle.played++;
    if (won) d.battle.wins++;
    const best = me.kills > d.battle.best;
    if (best) d.battle.best = me.kills;
    this.save.save();
    return { coins, best: best && me.kills > 0 };
  }

  pause() {
    if (this.mode === 'battle') {
      if (!this.state.is(State.PLAYING) || this.battle.over) return;
      if (this.battle.sync && this.net.connected) {
        // online matches can't freeze: open the menu, keep flying
        if (this.onlinePause) return;
        this.onlinePause = true;
        this.battle.input.setEnabled(false); this.battle.input.reset();
        this.battleHud.showPause(this.battle);
        this.ui.$('.js-bpo').textContent = 'Online match: the battle keeps going while this menu is open.';
        return;
      }
      this.state.set(State.PAUSED);
      this.input.enabled = false; this.input.reset();
      this.battle.input.setEnabled(false); this.battle.input.reset();
      this.audio.setPaused(true); this.radio.setPaused(true);
      this.battleHud.showPause(this.battle);
      return;
    }
    if (!this.state.is(State.PLAYING) || this.world.ending) return;
    this.state.set(State.PAUSED);
    this.input.enabled = false; this.input.reset();
    this.audio.setPaused(true); this.radio.setPaused(true);
    this.ui.result.showPause(LEVELS[this.levelId - 1], this.world);
  }
  resume() {
    if (this.onlinePause) {
      this.onlinePause = false;
      this.ui.closeModal('settings'); this.ui.hide('bpause');
      this.battle.input.reset(); this.battle.input.setEnabled(this.battle.phase === 'play' && !this.battle.over);
      return;
    }
    if (!this.state.is(State.PAUSED)) return;
    this.ui.closeModal('settings');
    this.ui.hide('pause'); this.ui.hide('bpause');
    this.radio.setPaused(false);
    this.state.set(State.PLAYING);
    this.input.reset(); this.input.enabled = true;
    if (this.mode === 'battle') { this.battle.input.reset(); this.battle.input.setEnabled(this.battle.phase === 'play' && !this.battle.over); }
    this.audio.setPaused(false);
    this.loop.resetClock();
  }

  // ---- callbacks from the world -------------------------------------------------
  onBossWarning(def) {
    const id = `m${this.levelId}.boss`;
    this.radio.say(id in LINES ? id : 'boss.warn', 'high');
    this.hud.banner('WARNING', `${def.name} APPROACHING`, 2.8, true);
    this.audio.sfx('warning');
    this.audio.playMusic('boss');
  }
  onBossSpawn(boss) { this.world.boss = boss; this.hud.showBoss(boss); this.world.startBossZone(); }
  onBossDying() { this.hud.hideBoss(); this.audio.stopMusic(1.2); }
  onMissionEnding(win) {
    this.hud.hideControls();
    if (!win) this.audio.stopMusic(0.8);
  }
  /** Fired exactly once per mission by World when the outro has finished. */
  onMissionEnd(win) {
    if (!this.state.is(State.PLAYING)) return;
    const level = LEVELS[this.levelId - 1], world = this.world;
    const progress = world.level.progressText();
    world.stop();
    this.input.enabled = false; this.input.reset();
    const result = this.rewards.settle(level, world.stats, win);
    this.state.set(win ? State.COMPLETE : State.GAMEOVER);
    this.audio.jingle(win ? 'victory' : 'defeat');
    if (win) { this.radio.clear(); this.radio.say(`m${level.id}.win`, 'high'); }
    if (win) this.ui.result.showVictory(level, result);
    else this.ui.result.showGameOver(level, result, progress);
  }

  // ---- loop -----------------------------------------------------------------------
  /** Lag guard: if gameplay runs below ~42 fps for 3 s, drop one graphics level (and say so once). */
  _perfGuard(dt) {
    if (!this.state.is(State.PLAYING)) { this._slowT = 0; return; }
    this._ema = (this._ema || 1 / 60) * 0.94 + dt * 0.06;
    if (this._cool > 0) { this._cool -= dt; return; }
    this._slowT = this._ema > 1 / 42 ? (this._slowT || 0) + dt : 0;
    if (this._slowT > 3) {
      const s = this.save.data.settings, next = { high: 'medium', medium: 'low' }[s.quality];
      this._slowT = 0; this._cool = 8;
      if (!next) return;
      s.quality = next; this.save.save(); this.applySettings();
      this.ui.toast(`Graphics set to ${next.toUpperCase()} for smoother play`);
    }
  }
  update(dt) {
    this._perfGuard(dt);
    if (!this.state.is(State.PAUSED)) this.radio.update(dt);
    if (this.input.consumePause()) {
      if (this.state.is(State.PLAYING)) this.pause();
      else if (this.state.is(State.PAUSED) && !this.ui.anyModal()) this.resume();
    }
    switch (this.state.current) {
      case State.PLAYING:
        if (this.mode === 'battle') {
          this.battle.update(dt);
          if (this.state.is(State.PLAYING)) this.battleHud.update(this.battle, dt);
          break;
        }
        this.world.update(dt);
        if (this.state.is(State.PLAYING)) this.hud.update(this.world, dt);
        break;
      case State.PAUSED: break;                      // simulation fully frozen
      case State.COMPLETE: case State.GAMEOVER:
        if (this.mode === 'battle') { this.battle.update(dt); break; }   // aircraft fly on behind the scoreboard
        this.world.vfx.update(dt);                   // let leftover particles settle; no gameplay runs
        this.background.update(dt);
        break;
      default:
        if (this.introOn) {
          if (this.intro.t > 0.8 && !this._introSaid) { this._introSaid = true; this.radio.say('intro', 'high'); }
          if (this.intro.update(dt)) this.finishIntro();
          break;
        }
        if (this.state.is(State.LOADING)) { this.intro.idle(dt); break; }
        this.ambient.update(dt);
        if (this.ui.current === 'hangar') this.ui.hangar.tick(dt);
    }
  }
  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const s = this.state.current;
    if (this.introOn) this.intro.render(ctx);
    else if (s === State.LOADING) this.intro.render(ctx, true);
    else if (s === State.MENU) this.ambient.render(ctx);
    else if (this.mode === 'battle') this.battle.render(ctx);
    else this.world.render(ctx);
  }

  // ---- settings / window ---------------------------------------------------------------
  applySettings() {
    const s = this.save.data.settings;
    this.audio.setMusicVolume(s.music);
    this.audio.setSfxVolume(s.sfx);
    this.input.sensitivity = s.sensitivity;
    this.input.setKeys(s.keys);
    this.battle.input.fireMode = s.fireMode; this.battle.autoFlares = s.autoFlares; this.battle.lockFx = s.lockFx !== false;
    if (this.battleHud && this.battle.running) this.battleHud.reset(this.battle);
    const q = CONFIG.QUALITY[s.quality];
    this.background.quality = q.clouds;
    if (this.world.running || this.world.player.alive) {
      this.world.quality = q; this.world.vfx.density = q.particles;
      this.world.vibration = s.vibration; this.world.player.sens = s.sensitivity;
    }
    if (this.battle.running) { this.battle.quality = q; this.battle.vfx.density = q.particles; this.battle.vibration = s.vibration; }
    if (this.quality !== s.quality) { this.quality = s.quality; this.resize(); }
  }

  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    if (!ww || !wh) return;
    // Landscape windows (laptops, phones on their side) use the whole screen;
    // portrait windows keep the original phone-shaped play area.
    const land = ww > wh * 1.05;
    let w, h;
    if (land) { h = wh; w = Math.min(ww, Math.round(wh * 2.4)); }
    else {
      const aspect = clamp(ww / wh, CONFIG.MIN_ASPECT, CONFIG.MAX_ASPECT);
      if (ww / wh > CONFIG.MAX_ASPECT) { h = wh; w = Math.round(h * (wh < 500 ? aspect : 9 / 16)); if (w > ww) w = ww; }
      else if (ww / wh < CONFIG.MIN_ASPECT) { w = ww; h = Math.round(w / CONFIG.MIN_ASPECT); }
      else { w = ww; h = wh; }
    }
    this.landscape = land;
    this.app.classList.toggle('land', land);
    this.app.classList.toggle('short', land && h < 560);
    this.app.style.width = w + 'px'; this.app.style.height = h + 'px';
    const fs = land ? Math.min(w / 27, h / (h < 560 ? 27 : 38)) : w / 27;
    this.app.style.fontSize = fs.toFixed(2) + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.QUALITY[this.save.data.settings.quality].dpr);
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    if (land) {
      // keep a similar amount of sky visible vertically, show more to the sides
      this.view.h = h < 560 ? 600 : 700;
      this.view.w = this.view.h * (w / h);
      this.scale = ch / this.view.h;
    } else {
      this.scale = cw / CONFIG.VIEW_W;
      this.view.w = CONFIG.VIEW_W;
      this.view.h = CONFIG.VIEW_W * (h / w);
    }
    this.background.grad = null;
    if (!this.loop.running || this.state.is(State.PAUSED)) this.render();
  }

  toggleFullscreen() {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) throw new Error('unsupported');
        const p = req.call(el);
        if (p && p.catch) p.catch(() => this.ui.toast('Fullscreen is not available here', 'bad'));
      }
    } catch (e) { this.ui.toast('Fullscreen is not available here', 'bad'); }
  }

  _bindWindow() {
    window.addEventListener('resize', () => this.resize());
    // an invite link pasted into a tab where the game is already open
    window.addEventListener('hashchange', () => {
      const room = readRoomLink();
      if (room) {
        if (this.state.is(State.MENU) && this.ui.current !== 'loading') { this.ui.battle.openSetup(); this.ui.battle.online.open(); this.ui.battle.online.join(room); }
        else this.roomCode = room;
        return;
      }
      const inv = readInvite();
      if (!inv) return;
      if (this.state.is(State.MENU) && this.ui.current !== 'loading') this.ui.battle.openSetup(inv);
      else this.invite = inv;
    });
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('fullscreenchange', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause(); this.audio.setSuspended(true);
        // an online host keeps the match running in a background tab (browsers stop drawing frames there)
        if (this.net && this.net.connected && this.mode === 'battle' && !this._bgTick) {
          let last = performance.now();
          this._bgTick = setInterval(() => { const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now; if (this.state.is(State.PLAYING) || this.state.is(State.COMPLETE)) this.update(dt); }, 50);
        }
      } else {
        clearInterval(this._bgTick); this._bgTick = null;
        this.audio.setSuspended(false); this.loop.resetClock();
      }
    });
    // first gesture unlocks audio (autoplay policy)
    const unlock = () => this.audio.init();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    // stop the page from scrolling / zooming / opening menus during play
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.scroll, .thumbs, .panel, input')) e.preventDefault(); }, { passive: false });
  }
}
