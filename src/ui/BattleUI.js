// Team Battle screens: setup (pilot, battleground, skill, invite link), the
// in-battle HUD, pause and the results scoreboard (with friend challenges).
import { ic } from '../art/Icons.js';
import { fmt, formatTime } from '../core/utils.js';
import { MAPS, DIFFICULTY, BATTLE, TEAMS, MODES, SIZES } from '../battle/battleData.js';
import { AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { primaryName, FIRE_MODES } from '../systems/Keybinds.js';
import { makeInvite } from '../battle/Invite.js';
import { OnlineUI } from './OnlineUI.js';
import { copyText } from './copy.js';

export class BattleUI {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    // ---------- setup ----------
    this.setup = ui.addScreen('bsetup', `
      <div class="head"><button class="ibtn" data-act="menu-back" aria-label="Back">${ic('back')}</button><h2>TEAM BATTLE</h2></div>
      <div class="scroll bs-body">
        <div class="bs-challenge card js-chal"></div>
        <div class="bs-online js-onbar" style="display:none"></div>
        <div class="bs-pilot card">
          <label class="bs-name"><span>PILOT</span><input class="js-name" maxlength="12" placeholder="Your call sign" autocomplete="off" spellcheck="false"></label>
          <div class="bs-plane js-plane"></div>
        </div>
        <div class="bs-label">BATTLEGROUND</div>
        <div class="bs-lockmsg">Your friend is hosting: they pick the battleground, squad size and skill.</div>
        <div class="bs-maps">${Object.values(MAPS).map((m) => `<button class="bs-map m-${m.id}" data-act="bmap" data-id="${m.id}"><b>${m.name}</b><span>${m.sub}</span></button>`).join('')}</div>
        <div class="bs-label">SQUAD SIZE</div>
        <div class="bs-seg bs-size js-size">${Object.entries(SIZES).map(([id, z]) => `<button data-act="bsize" data-id="${id}">${z.name}<small>${z.sub}</small></button>`).join('')}</div>
        <div class="bs-label">ENEMY SKILL</div>
        <div class="bs-seg js-diff">${Object.entries(DIFFICULTY).map(([id, d]) => `<button data-act="bdiff" data-id="${id}">${d.name}</button>`).join('')}</div>
        <div class="bs-label">VIEW</div>
        <div class="bs-seg bs-size js-view"><button data-act="bview" data-id="top">TOP-DOWN<small>See the whole fight</small></button><button data-act="bview" data-id="cockpit">COCKPIT<small>First-person, press V to switch</small></button></div>
        <div class="bs-rules card">
          <div><b>${formatTime(BATTLE.ROUND_TIME)}</b><span>round</span></div>
          <div><b class="js-kt">14</b><span>kills to win</span></div>
          <div><b class="js-sq">3v3</b><span class="js-sqs">you + 2 wingmen</span></div>
        </div>
        <div class="bs-help js-help"></div>
      </div>
      <div class="bs-foot">
        <div class="bs-row">
          <button class="btn white small" data-act="controls">${ic('gear')}CONTROLS</button>
          <button class="btn teal small" data-act="binvite">${ic('plane')}PLAY WITH A FRIEND</button>
        </div>
        <button class="btn play bs-go" data-act="bfight">FIGHT!<small class="js-gosub"></small></button>
      </div>`);
    ui.on('menu-back', () => { this.challenge = null; game.enterMenu(); });
    ui.on('bmap', (el) => { this.cfg.map = el.dataset.id; this._saveCfg(); this.refreshSetup(); });
    ui.on('bdiff', (el) => { this.cfg.difficulty = el.dataset.id; this._saveCfg(); this.refreshSetup(); });
    ui.on('bsize', (el) => { this.cfg.size = +el.dataset.id; this._saveCfg(); this.refreshSetup(); });
    ui.on('bview', (el) => { this.cfg.view = el.dataset.id; this._saveCfg(); this.refreshSetup(); });
    ui.on('bfight', () => {
      this._saveCfg();
      const net = this.online.net;
      if (net.connected && net.isHost) this.online.start();
      else if (net.connected) ui.toast('The host starts the battle. Hang tight!');
      else game.startBattle(this._cfg());
    });
    ui.on('binvite', () => this.online.open());
    ui.on('bhangar', () => { ui.returnTo = 'bsetup'; ui.hangar.open('stats'); });
    const name = this.setup.querySelector('.js-name');
    name.addEventListener('input', () => {
      const v = name.value.toUpperCase().replace(/[^A-Z0-9 _.-]/g, '').slice(0, 12);
      if (v !== name.value) name.value = v;
      game.save.data.battle.name = v.trim(); game.save.save();
    });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });

    // ---------- HUD ----------
    const el = this.hud = ui.addScreen('battle', `
      <div class="bt-top">
        <div class="bt-score">
          <div class="tm blue"><b class="js-s0">0</b><span>BLUE</span></div>
          <div class="bt-mid"><div class="bt-time js-time">2:30</div><div class="bt-goal js-goal"></div></div>
          <div class="tm red"><span>RED</span><b class="js-s1">0</b></div>
        </div>
        <div class="bt-bars"><i class="b0 js-bar0"></i><i class="b1 js-bar1"></i></div>
        <div class="bt-zone js-zone"></div>
      </div>
      <button class="hud-pause bt-pause" data-act="bpause" aria-label="Pause">${ic('pause')}</button>
      <button class="bt-viewbtn" data-act="bview3d" aria-label="Switch view"><b class="js-vlabel">3D</b></button>
      <canvas class="bt-map js-map" width="160" height="160"></canvas>
      <div class="bt-feed js-feed"></div>
      <div class="bt-panel js-panel">
        <div class="bp-name js-pn">YOU</div>
        <div class="bp-row">${ic('heart')}<div class="bp-bar hp"><i class="js-hp"></i></div></div>
        <div class="bp-row gun">${ic('crosshair')}<div class="bp-bar heat"><i class="js-heat"></i></div><b class="js-ammo">180</b></div>
        <div class="bp-row">${ic('missile')}<span class="pips js-mp"></span>${ic('flare')}<span class="pips fl js-fp"></span></div>
        <div class="bp-row r-sh">${ic('shield')}<div class="bp-bar sh"><i class="js-sh"></i></div></div>
        <div class="bp-row r-bst">${ic('boost')}<div class="bp-bar bst"><i class="js-bst"></i></div></div>
      </div>
      <div class="banner js-bbanner"><div class="b1"></div><div class="b2"></div></div>
      <div class="bt-count js-count"></div>
      <div class="bt-call js-call"></div>
      <div class="hint js-bhint"><span></span></div>
      <div class="bt-down js-down"><b></b><span></span></div>
      <div class="warn js-bwarn">MISSILE LOCK</div>
      <div class="bt-help js-ihelp"></div>
      <div class="bt-keys js-keys"></div>
      <div class="bt-ctl js-ctl">
        <div class="joy-zone js-bzone"><div class="joy js-bjoy"><div class="knob js-bknob"></div></div><span class="joy-tip">DRAG TO STEER</span></div>
        <div class="bt-acts">
          <button class="act fire js-bfire" aria-label="Fire">${ic('crosshair')}<span class="mode js-fmode">AUTO</span></button>
          <button class="act missile js-bmissile" aria-label="Missile">${ic('missile')}<span class="cnt">4</span></button>
          <button class="act shieldb js-bshield" aria-label="Shield">${ic('shield')}</button>
          <button class="act boost js-bboost" aria-label="Boost">${ic('boost')}</button>
          <button class="act flare js-bflare" aria-label="Flares">${ic('flare')}<span class="cnt">3</span></button>
        </div>
      </div>`);
    const q = (s) => el.querySelector(s);
    this.n = { s0: q('.js-s0'), s1: q('.js-s1'), time: q('.js-time'), goal: q('.js-goal'), bar0: q('.js-bar0'), bar1: q('.js-bar1'), zone: q('.js-zone'),
      map: q('.js-map'), feed: q('.js-feed'), banner: q('.js-bbanner'), count: q('.js-count'), hint: q('.js-bhint'), warn: q('.js-bwarn'), help: q('.js-ihelp'),
      call: q('.js-call'), down: q('.js-down'), ctl: q('.js-ctl'), keys: q('.js-keys'), fmode: q('.js-fmode') };
    this.p = { name: q('.js-pn'), hp: q('.js-hp'), heat: q('.js-heat'), ammo: q('.js-ammo'), mp: q('.js-mp'), fp: q('.js-fp'), bst: q('.js-bst'), sh: q('.js-sh'),
      fire: q('.js-bfire'), missile: q('.js-bmissile'), boost: q('.js-bboost'), flare: q('.js-bflare'), shield: q('.js-bshield') };
    this.mapCtx = this.n.map.getContext('2d');
    game.battle.input.bindTouch({ zone: q('.js-bzone'), base: q('.js-bjoy'), knob: q('.js-bknob'),
      fire: this.p.fire, missile: this.p.missile, boost: this.p.boost, flare: this.p.flare, shield: this.p.shield });
    ui.on('bpause', () => game.pause());
    ui.on('bview3d', () => { if (game.battle.running && !game.battle.over) game.battle.toggleView(); });

    // ---------- pause ----------
    ui.addScreen('bpause', `<div class="panel card"><div class="kicker js-bpk">TEAM BATTLE</div><h3 class="res-title" style="color:var(--ink)">PAUSED</h3>
      <p class="js-bpo" style="text-align:center;font-size:.76em;color:var(--ink-soft);margin:.3em 0 0"></p>
      <div class="stack" style="display:flex;flex-direction:column;gap:.6em;margin-top:.9em">
        <button class="btn" data-act="resume">${ic('play')}RESUME</button>
        <button class="btn white" data-act="brestart">${ic('replay')}RESTART BATTLE</button>
        <button class="btn white" data-act="controls">${ic('gear')}CONTROLS</button>
        <button class="btn white" data-act="pause-settings">${ic('sound')}SETTINGS</button>
        <button class="btn white" data-act="quit">${ic('home')}MAIN MENU</button>
      </div></div>`, 'overlay');
    ui.on('brestart', () => { if (this.online.net.connected) this.online.again(); else game.startBattle(this._cfg()); });

    // ---------- results ----------
    ui.addScreen('bresult', `<div class="panel card bres">
      <div class="kicker js-rk"></div>
      <div class="res-title js-rt">VICTORY</div>
      <div class="bres-score"><span class="blue js-r0">0</span><i>-</i><span class="red js-r1">0</span></div>
      <div class="bres-vs js-rvs"></div>
      <div class="bres-board js-board"></div>
      <div class="res-note js-rnote"></div>
      <div class="row" style="display:flex;gap:.6em;margin-top:.8em">
        <button class="btn white small" data-act="bsetup" style="flex:1">${ic('gear')}CHANGE</button>
        <button class="btn" data-act="brestart" style="flex:1.6">${ic('replay')}PLAY AGAIN</button>
      </div>
      <button class="btn teal small wide" data-act="bchallenge" style="margin-top:.6em">${ic('plane')}CHALLENGE A FRIEND</button>
      <div style="text-align:center"><button class="link" data-act="quit" style="color:var(--ink-soft)">Main menu</button></div></div>`, 'overlay');
    ui.on('bsetup', () => { this.online.toSetup(); this.openSetup(); });
    ui.on('bchallenge', () => this.share(this.lastResult));

    // ---------- share link ----------
    ui.addModal('invite', `<h3 class="js-ivt">INVITE A FRIEND</h3><p class="js-ivx"></p>
      <input class="iv-link js-ivl" readonly>
      <p class="iv-note js-ivn"></p>
      <div class="row"><button class="btn white small" data-act="invite-close">CLOSE</button><button class="btn small teal js-ivc" data-act="invite-copy">COPY LINK</button></div>`);
    ui.on('invite-close', () => ui.closeModal('invite'));
    ui.on('invite-copy', () => this._copy());

    const d = game.save.data.battle;
    this.cfg = { map: 'desert', difficulty: 'normal', size: 3, view: 'top', ...(d && d.cfg) };
    this.challenge = null;
    this.c = {};
    this.hintT = 0; this.mapT = 0;
    this.online = new OnlineUI(game, ui, this);
  }

  _cfg() { return { mode: 'team', map: this.cfg.map, difficulty: this.cfg.difficulty, size: this.cfg.size, view: this.cfg.view, challenge: this.challenge }; }
  _saveCfg() { const d = this.game.save.data; d.battle.cfg = { map: this.cfg.map, difficulty: this.cfg.difficulty, size: this.cfg.size, view: this.cfg.view }; this.game.save.save(); }
  pilotName() { return this.game.save.data.battle.name || 'A PILOT'; }

  // ---- setup ----------------------------------------------------------------------
  /** Opens setup; `challenge` (from an invite link) presets the battleground and shows the target. */
  openSetup(challenge) {
    if (challenge) {
      this.challenge = challenge;
      if (MAPS[challenge.m]) this.cfg.map = challenge.m;
      if (DIFFICULTY[challenge.d]) this.cfg.difficulty = challenge.d;
      if (SIZES[challenge.z]) this.cfg.size = challenge.z;
    }
    this.game.enterBattleSetup();
    this.refreshSetup();
    this.ui.show('bsetup');
  }
  refreshSetup() {
    if (this.online) { this.online.pushLobby(); this.online.refreshBar(); }
    const s = this.setup, g = this.game, touch = this._touch();
    // a guest in a friend's room sees (and fights on) the host's choices
    const on = this.online, hostCfg = on && on.net.isGuest && on.net.connected ? on.hostCfg : null;
    const cfg = hostCfg ? { ...this.cfg, map: MAPS[hostCfg.map] ? hostCfg.map : 'desert', size: SIZES[hostCfg.size] ? +hostCfg.size : 3, difficulty: DIFFICULTY[hostCfg.difficulty] ? hostCfg.difficulty : 'normal' } : this.cfg;
    s.classList.toggle('bs-locked', !!hostCfg);
    for (const b of s.querySelectorAll('.bs-map')) b.classList.toggle('on', b.dataset.id === cfg.map);
    for (const b of s.querySelectorAll('.js-diff button')) b.classList.toggle('on', b.dataset.id === cfg.difficulty);
    for (const b of s.querySelectorAll('.js-size button')) b.classList.toggle('on', +b.dataset.id === +cfg.size);
    for (const b of s.querySelectorAll('.js-view button')) b.classList.toggle('on', b.dataset.id === cfg.view);
    s.querySelector('.js-kt').textContent = SIZES[cfg.size].killTarget;
    s.querySelector('.js-sq').textContent = `${cfg.size}v${cfg.size}`;
    s.querySelector('.js-sqs').textContent = `you + ${cfg.size - 1} wingm${cfg.size === 2 ? 'an' : 'en'}`;
    s.querySelector('.js-name').value = g.save.data.battle.name || '';
    const keys = g.save.data.settings.keys, fm = FIRE_MODES[g.save.data.settings.fireMode];
    s.querySelector('.js-help').innerHTML = touch
      ? `<b>Drag on the left</b> to steer. Fire mode: <b>${fm.name}</b>. Shield blocks every hit for ${BATTLE.SHIELD_TIME} s.`
      : `<b>${primaryName(keys, 'up')}${primaryName(keys, 'left')}${primaryName(keys, 'down')}${primaryName(keys, 'right')}</b> steer · <b>${primaryName(keys, 'fire')}</b> fire (${fm.name.toLowerCase()}) · <b>${primaryName(keys, 'missile')}</b> missile · <b>${primaryName(keys, 'shield')}</b> shield · <b>${primaryName(keys, 'boost')}</b> boost · <b>${primaryName(keys, 'flare')}</b> flares`;
    const a = AIRCRAFT_BY_ID[g.save.data.selected];
    s.querySelector('.js-plane').innerHTML = `Flying <b>${a.name}</b> <button class="link" data-act="bhangar">change</button>`;
    s.querySelector('.js-gosub').textContent = `${cfg.size}v${cfg.size} · ${MAPS[cfg.map].name} · ${DIFFICULTY[cfg.difficulty].name}`;
    const ch = s.querySelector('.js-chal'), c = this.challenge;
    ch.style.display = c ? '' : 'none';
    if (c) {
      ch.innerHTML = c.k >= 0
        ? `<div class="kicker">CHALLENGE</div><b>${esc(c.n)}</b> shot down <b>${c.k}</b> on <b>${(MAPS[c.m] || MAPS.desert).name}</b> (${(DIFFICULTY[c.d] || DIFFICULTY.normal).name}). Beat it!`
        : `<div class="kicker">INVITE</div><b>${esc(c.n)}</b> wants you on <b>${(MAPS[c.m] || MAPS.desert).name}</b> (${(DIFFICULTY[c.d] || DIFFICULTY.normal).name}). Same battle, then compare scores.`;
    }
  }
  _touch() { return this.game.input.usedTouch || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }

  // ---- invite / challenge link ------------------------------------------------------
  share(result) {
    const me = result && result.board.find((b) => b.human);
    const inv = makeInvite({ n: this.pilotName(), m: result ? result.mapId : this.cfg.map, d: result ? result.difficulty : this.cfg.difficulty, k: me ? me.kills : -1, w: result && result.winner === 0 ? 1 : 0, z: result ? result.size : this.cfg.size });
    const $ = (s) => this.ui.$(s);
    $('.js-ivt').textContent = result ? 'CHALLENGE A FRIEND' : 'INVITE A FRIEND';
    $('.js-ivx').textContent = result
      ? `Your friend gets the same battleground and skill level, and has to beat your ${me.kills} kill${me.kills === 1 ? '' : 's'}.`
      : 'Your friend opens the link and lands in the same battle setup. Each of you flies one jet; compare scores after the round.';
    $('.js-ivl').value = inv.url;
    $('.js-ivn').textContent = inv.local ? 'This copy of the game is opened from a file, so the link only works on this device. Put the game online (Netlify / Vercel / GitHub Pages) and the same button gives a link anyone can open.' : '';
    this._invite = inv;
    this.ui.openModal('invite');
    if (navigator.share && !inv.local) navigator.share({ title: 'Sky Strike', text: inv.text, url: inv.url }).catch(() => {});
  }
  _copy() {
    const inp = this.ui.$('.js-ivl'), btn = this.ui.$('.js-ivc');
    copyText(this._invite.text + ' ' + inp.value).then((ok) => {
      if (!ok) { inp.focus(); inp.select(); }
      btn.textContent = ok ? 'COPIED!' : 'SELECT + COPY';
      setTimeout(() => { btn.textContent = 'COPY LINK'; }, 1600);
    });
  }

  // ---- HUD ------------------------------------------------------------------------
  reset(world) {
    const n = this.n, s = this.game.save.data.settings;
    this.c = {};
    this.world = world;
    this.hud.classList.toggle('touch', !!world.touch);
    this.hud.classList.toggle('intro', world.phase === 'intro');
    this.hud.classList.toggle('over', !!world.over);
    n.goal.textContent = `FIRST TO ${world.mode.killTarget}`;
    n.feed.innerHTML = '';
    n.banner.className = 'banner js-bbanner';
    n.hint.classList.remove('on'); this.hintT = 0;
    n.count.className = 'bt-count js-count';
    n.down.classList.remove('on');
    n.call.className = 'bt-call js-call';
    n.ctl.style.display = world.touch ? '' : 'none';
    n.keys.style.display = world.touch ? 'none' : '';
    this.p.name.textContent = this.game.save.data.battle.name || 'YOU';
    n.fmode.textContent = FIRE_MODES[s.fireMode].name;
    this.p.fire.classList.toggle('automode', s.fireMode === 'auto');
    const k = s.keys;
    n.keys.innerHTML = ['fire', 'missile', 'shield', 'boost', 'flare', 'view'].map((a) => `<span><kbd>${primaryName(k, a)}</kbd>${{ fire: 'FIRE', missile: 'MISSILE', shield: 'SHIELD', boost: 'BOOST', flare: 'FLARES', view: 'COCKPIT' }[a]}</span>`).join('');
    n.help.innerHTML = world.touch
      ? 'DRAG ON THE LEFT TO STEER<br>' + (s.fireMode === 'auto' ? 'Guns fire when an enemy is lined up' : 'Hold FIRE to shoot') + ' · stay inside the zone'
      : `${primaryName(k, 'up')} ${primaryName(k, 'left')} ${primaryName(k, 'down')} ${primaryName(k, 'right')} to steer · ${primaryName(k, 'shield')} shield · ${primaryName(k, 'missile')} missile<br>Stay inside the shrinking zone`;
    this.mapSize = 0;
    this.update(world, 0);
  }
  showControls(on) {
    this.hud.classList.toggle('intro', false);
    this.hud.classList.toggle('over', !on);
  }
  _set(key, val, fn) { if (this.c[key] !== val) { this.c[key] = val; fn(val); } }

  update(w, dt) {
    const n = this.n, p = this.p, h = w.humans[0];
    this._set('s0', w.score[0], (v) => { n.s0.textContent = v; n.bar0.style.width = Math.min(100, (v / w.mode.killTarget) * 100) + '%'; this._bump(n.s0); });
    this._set('s1', w.score[1], (v) => { n.s1.textContent = v; n.bar1.style.width = Math.min(100, (v / w.mode.killTarget) * 100) + '%'; this._bump(n.s1); });
    this._set('goal', w.sudden ? -1 : w.mode.killTarget, (v) => { n.goal.textContent = v < 0 ? 'NEXT KILL WINS' : `FIRST TO ${v}`; });
    const tLeft = w.sudden ? w.suddenT : w.roundT;
    this._set('t', Math.ceil(tLeft), (v) => { n.time.textContent = formatTime(Math.max(0, v)); n.time.classList.toggle('low', v <= 30); });
    // zone status
    const z = w.zone;
    let zt, zc = '';
    if (h.alive && w.phase !== 'intro' && !z.inside(h.x, h.y)) { zt = `OUTSIDE ZONE! -${Math.round(z.dps)} HP/s`; zc = 'bad'; }
    else if (z.shrinking) { zt = 'ZONE CLOSING IN'; zc = 'warn'; }
    else if (z.countdown > 0) { zt = `ZONE SHRINKS IN ${formatTime(Math.ceil(z.countdown))}`; if (z.countdown > 10) zc = 'quiet'; }
    else { zt = 'FINAL ZONE'; zc = 'quiet'; }
    this._set('z', zt + zc, () => { n.zone.textContent = zt; n.zone.className = 'bt-zone js-zone ' + zc; });
    // keyboard hint bar fades once you've had time to learn it
    this._set('keysFade', w.phase === 'play' && w.time > 14 ? 1 : 0, (v) => n.keys.classList.toggle('faded', !!v));
    // pilot panel and buttons
    this._set('hp', Math.ceil((h.alive ? h.hp / h.maxHp : 0) * 50), (v) => { p.hp.style.width = v * 2 + '%'; p.hp.parentNode.className = 'bp-bar hp' + (v <= 12 ? ' low' : v <= 25 ? ' mid' : ''); });
    this._set('ht', Math.round(h.heat * 20) + (h.overheat ? 100 : 0), () => { p.heat.style.width = h.heat * 100 + '%'; p.heat.parentNode.classList.toggle('over', h.overheat); });
    this._set('am', h.ammo, (v) => { p.ammo.textContent = v; p.ammo.classList.toggle('low', v <= 30); });
    this._set('mp', h.missiles + '/' + h.maxMissiles, () => { p.mp.innerHTML = '<i class="on"></i>'.repeat(h.missiles) + '<i></i>'.repeat(Math.max(0, h.maxMissiles - h.missiles)); p.missile.querySelector('.cnt').textContent = h.missiles; p.missile.classList.toggle('empty', h.missiles <= 0); });
    this._set('fp', h.flares, (v) => { p.fp.innerHTML = '<i class="on"></i>'.repeat(v) + '<i></i>'.repeat(Math.max(0, BATTLE.FLARES - v)); p.flare.querySelector('.cnt').textContent = v; p.flare.classList.toggle('empty', v <= 0); });
    this._set('bs', Math.round((1 - Math.max(0, h.boostCd) / BATTLE.BOOST_CD) * 20), (v) => { p.bst.style.width = v * 5 + '%'; p.boost.classList.toggle('cool', v < 20); p.boost.style.setProperty('--p', v / 20); });
    const shK = h.shieldT > 0 ? 100 + Math.round((h.shieldT / BATTLE.SHIELD_TIME) * 20) : Math.round((1 - Math.max(0, h.shieldCd) / (BATTLE.SHIELD_CD + BATTLE.SHIELD_TIME)) * 20);
    this._set('sh', shK, (v) => {
      const on = v >= 100, frac = on ? (v - 100) / 20 : v / 20;
      p.sh.style.width = frac * 100 + '%'; p.sh.parentNode.classList.toggle('on', on);
      p.shield.classList.toggle('active', on); p.shield.classList.toggle('cool', !on && v < 20); p.shield.style.setProperty('--p', on ? 1 : frac);
    });
    this._set('mc', Math.round((1 - Math.max(0, h.missileCd) / BATTLE.MISSILE_CD) * 20), (v) => { p.missile.classList.toggle('cool', v < 20); p.missile.style.setProperty('--p', v / 20); });
    this._set('fire', h.overheat ? 2 : h.firing ? 1 : 0, (v) => { p.fire.classList.toggle('hot', v === 2); p.fire.classList.toggle('firing', v === 1); });
    this._set('tog', w.input.toggled ? 1 : 0, (v) => p.fire.classList.toggle('latched', !!v));
    this._set('v3d', w.view3d ? 1 : 0, (v) => { this.hud.querySelector('.js-vlabel').textContent = v ? 'MAP' : '3D'; this.hud.classList.toggle('cockpit', !!v); });
    if (!h.alive && !w.over) this._set('rs', Math.ceil(h.respawnT), (v) => { n.down.lastElementChild.textContent = `RESPAWN IN ${Math.max(1, v)}`; });
    this._set('th', w.missiles.threats > 0 && !w.over ? 1 : 0, (v) => { n.warn.classList.toggle('on', !!v); p.flare.classList.toggle('alert', !!v); p.shield.classList.toggle('alert', !!v && h.flares <= 0); });
    // kill feed
    const top = w.feed.length ? w.feed[w.feed.length - 1].id : 0;
    if (w.feed.length !== this.c.feedLen || top !== this.c.feedTop) {
      this.c.feedLen = w.feed.length; this.c.feedTop = top;
      n.feed.innerHTML = w.feed.map((e) => {
        const kn = e.killer ? `<b style="color:${TEAMS[e.kt].main}">${esc(e.killer)}</b>` : '';
        const how = e.how === 'missile' ? ic('missile') : e.how === 'zone' ? '<em>ZONE</em>' : ic('crosshair');
        return `<div class="${e.human ? 'me' : ''}">${kn}${how}<b style="color:${TEAMS[e.vt].main}">${esc(e.victim)}</b></div>`;
      }).join('');
    }
    // radar
    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 0.066;
      const css = this.n.map.clientWidth || 140, dpr = Math.min(2, window.devicePixelRatio || 1), S = Math.round(css * dpr);
      if (S !== this.mapSize) { this.mapSize = S; this.n.map.width = this.n.map.height = S; }
      w.drawMinimap(this.mapCtx, S);
    }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) n.hint.classList.remove('on'); }
  }
  _bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  banner(title, sub = '', dur = 2, danger = false) {
    const b = this.n.banner;
    b.className = 'banner js-bbanner';
    void b.offsetWidth;
    b.children[0].textContent = title;
    b.children[1].textContent = sub; b.children[1].style.display = sub ? '' : 'none';
    b.className = 'banner js-bbanner on' + (danger ? ' danger' : '');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { b.classList.add('out'); this._bt = setTimeout(() => { b.className = 'banner js-bbanner'; }, 320); }, dur * 1000);
  }
  countdown(txt) {
    const c = this.n.count;
    c.className = 'bt-count js-count';
    void c.offsetWidth;
    c.textContent = txt;
    c.className = 'bt-count js-count on' + (txt.length > 2 ? ' go' : '');
    clearTimeout(this._ct);
    this._ct = setTimeout(() => { c.className = 'bt-count js-count'; }, txt.length > 2 ? 1150 : 950);
  }
  callout(text, pi = 0, small = false) {
    const c = this.n.call;
    c.className = 'bt-call js-call';
    void c.offsetWidth;
    c.textContent = text;
    c.className = 'bt-call js-call on' + (small ? ' small' : '');
    clearTimeout(this._clt);
    this._clt = setTimeout(() => { c.className = 'bt-call js-call'; }, 1550);
  }
  hint(text, dur = 2) {
    const h = this.n.hint;
    h.firstElementChild.textContent = text;
    h.classList.add('on');
    this.hintT = dur;
  }
  down(f, text) {
    this.n.down.firstElementChild.textContent = text;
    this.n.down.classList.add('on');
    this.c.rs = -1;
  }
  up() { this.n.down.classList.remove('on'); }

  // ---- pause / results -----------------------------------------------------------
  showPause(world) {
    this.ui.$('.js-bpk').textContent = `${world.mode.name} · ${world.map.name}`;
    this.ui.$('.js-bpo').textContent = `${TEAMS[0].name} ${world.score[0]} - ${world.score[1]} ${TEAMS[1].name} · ${formatTime(Math.ceil(world.roundT))} left`;
    this.ui.overlay('bpause');
  }
  showResult(r, reward) {
    const $ = (s) => this.ui.$(s);
    this.lastResult = r;
    const me = r.board.find((b) => b.human);
    $('.js-rk').textContent = `${r.map} · ${(DIFFICULTY[r.difficulty] || DIFFICULTY.normal).name} · ${formatTime(Math.round(r.time))}`;
    const t = $('.js-rt');
    t.textContent = r.title;
    t.className = 'res-title js-rt ' + (r.winner < 0 ? '' : r.winner === me.team ? 'win' : 'lose');
    $('.js-r0').textContent = r.score[0]; $('.js-r1').textContent = r.score[1];
    const c = r.challenge, vs = $('.js-rvs');
    if (c && c.k >= 0) {
      const beat = me.kills > c.k, tie = me.kills === c.k;
      vs.innerHTML = `<b>${beat ? 'CHALLENGE WON!' : tie ? 'CHALLENGE TIED' : 'CHALLENGE LOST'}</b> You ${me.kills} vs ${esc(c.n)} ${c.k}`;
      vs.className = 'bres-vs js-rvs on ' + (beat ? 'good' : tie ? '' : 'bad');
    } else if (r.online) {
      const fr = esc(r.online.friend || 'your friend');
      vs.innerHTML = r.online.mode === 'versus' ? `<b>ONLINE VERSUS</b> vs ${fr}` : `<b>ONLINE CO-OP</b> with ${fr}`;
      vs.className = 'bres-vs js-rvs on';
    } else vs.className = 'bres-vs js-rvs';
    const on = r.online && this.online.net.connected;
    this.ui.$('[data-act=bchallenge]').style.display = on ? 'none' : '';
    this.ui.root.querySelector('#s-bresult [data-act=brestart]').lastChild.textContent = on && !r.online.host ? 'ASK FOR REMATCH' : 'PLAY AGAIN';
    const mvp = [...r.board].sort((a, b) => (b.kills * 3 + b.assists - b.deaths) - (a.kills * 3 + a.assists - a.deaths))[0];
    const row = (b) => `<tr class="t${b.team}${b.human ? ' me' : ''}"><td>${b === mvp ? '<em>MVP</em> ' : ''}${esc(b.human ? this.game.save.data.battle.name || 'YOU' : b.name)}</td><td>${b.kills}</td><td>${b.assists}</td><td>${b.deaths}</td></tr>`;
    $('.js-board').innerHTML = `<table><thead><tr><th>PILOT</th><th>K</th><th>A</th><th>D</th></tr></thead><tbody>${
      [0, 1].map((team) => r.board.filter((b) => b.team === team).sort((a, b) => b.kills - a.kills).map(row).join('')).join('<tr class="gap"><td colspan="4"></td></tr>')}</tbody></table>`;
    $('.js-rnote').innerHTML = reward ? `${ic('coin')} +${fmt(reward.coins)} coins earned${reward.best ? ' · NEW BEST!' : ''}` : '';
    this.ui.overlay('bresult');
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
