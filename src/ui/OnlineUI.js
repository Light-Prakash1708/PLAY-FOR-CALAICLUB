// "Play with a friend": live online battles with no sign-up.
// The host creates a room and shares a 6-letter code (or a link). The friend
// types the code, and the two games connect directly. The host picks the
// battleground in the normal setup screen and presses FIGHT for both.
import { ic } from '../art/Icons.js';
import { Net, cleanCode, roomLink, CODE_LEN } from '../net/Net.js';
import { copyText } from './copy.js';
import { MAPS, DIFFICULTY, SIZES } from '../battle/battleData.js';
import { AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { State } from '../core/GameState.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MODE_TXT = { coop: 'CO-OP', versus: 'VERSUS' };
const BATTLE_MSGS = new Set(['in', 's', 'k', 'r', 'c', 'z', 'sd', 'end']);

export class OnlineUI {
  constructor(game, ui, bui) {
    this.game = game; this.ui = ui; this.bui = bui;
    const net = this.net = game.net = new Net();
    this.mode = 'coop';
    this.hostCfg = null;

    ui.addModal('online', `
      <h3>${ic('plane')} PLAY WITH A FRIEND</h3>
      <p class="on-sub">Live over the internet. No sign-up. Share a ${CODE_LEN}-letter room code.</p>
      <div class="on-modes js-onmodes">
        <button data-act="onmode" data-id="coop"><b>CO-OP</b><small>You two vs the enemy squadron</small></button>
        <button data-act="onmode" data-id="versus"><b>VERSUS</b><small>Your team vs your friend's team</small></button>
      </div>
      <div class="on-pane js-onp-idle">
        <button class="btn teal wide" data-act="onhost">${ic('plane')}CREATE A ROOM</button>
        <div class="on-or"><span>or join your friend's room</span></div>
        <div class="on-join">
          <input class="on-code-in js-oncode" maxlength="${CODE_LEN}" placeholder="ROOM CODE" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" aria-label="Room code">
          <button class="btn small" data-act="onjoin">JOIN</button>
        </div>
      </div>
      <div class="on-pane js-onp-room">
        <div class="on-codebox"><small>ROOM CODE</small><b class="js-oncodebig">------</b></div>
        <div class="on-share">
          <button class="btn white small" data-act="oncopycode">${ic('plane')}<span class="js-occ">COPY CODE</span></button>
          <button class="btn white small" data-act="oncopylink"><span class="js-ocl">COPY LINK</span></button>
          <button class="btn teal small js-onsharebtn" data-act="onshare">SHARE</button>
        </div>
        <input class="iv-link js-onlink" readonly aria-label="Room link">
      </div>
      <p class="on-status js-onstat"></p>
      <div class="row on-foot">
        <button class="btn white small" data-act="online-close">CLOSE</button>
        <button class="btn white small js-onleave" data-act="onleave">LEAVE ROOM</button>
        <button class="btn small js-onstart" data-act="onstart">START BATTLE</button>
      </div>`);
    const $ = (s) => ui.$(s);
    this.codeIn = $('.js-oncode');
    this.codeIn.addEventListener('input', () => { const v = cleanCode(this.codeIn.value); if (v !== this.codeIn.value) this.codeIn.value = v; });
    this.codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.join(this.codeIn.value); e.stopPropagation(); });
    $('.js-onlink').addEventListener('focus', (e) => e.target.select());

    ui.on('online-close', () => ui.closeModal('online'));
    ui.on('onmode', (el) => { if (this.net.isGuest) return; this.mode = el.dataset.id; this.pushLobby(); this.refresh(); });
    ui.on('onhost', () => { this.game.audio.init && this.game.audio.init(); net.host(); this.refresh(); });
    ui.on('onjoin', () => this.join(this.codeIn.value));
    ui.on('onleave', () => { net.close(); this.refresh(); });
    ui.on('oncopycode', () => this._copy(net.code, '.js-occ', 'COPY CODE'));
    ui.on('oncopylink', () => this._copy(this._shareText(), '.js-ocl', 'COPY LINK'));
    ui.on('onshare', () => this._share());
    ui.on('onstart', () => this.start());

    net.on('status', () => this.refresh());
    net.on('room', () => this.refresh());
    net.on('connected', () => { this._hello(); this.refresh(); this.game.audio.sfx && this.game.audio.sfx('respawn'); });
    net.on('data', (d) => this.onData(d));
    net.on('closed', () => {
      const name = this._friendName || 'Your friend';
      const b = this.game.battle;
      if (b.running && b.sync) b.netLost();
      else ui.toast(`${name} left the room`, 'bad');
      this.refresh();
    });
  }

  // ---- actions -------------------------------------------------------------------
  open() { this.refresh(); this.ui.openModal('online'); if (!this.net.active) setTimeout(() => this.codeIn.focus({ preventScroll: true }), 50); }
  join(code) {
    const c = cleanCode(code);
    this.codeIn.value = c;
    this.net.join(c);
    this.refresh();
  }
  /** Host: start a battle for both players with the current setup. */
  start() {
    const net = this.net, g = this.game;
    if (!net.isHost) { this.ui.toast('The host starts the battle', ''); return; }
    if (!net.connected || !net.friend) { this.ui.toast('Waiting for your friend to join the room', 'bad'); return; }
    const cfg = { ...this.bui._cfg(), challenge: null };
    const roster = [this._me(), { name: net.friend.name, id: net.friend.ac.id, stats: net.friend.ac.stats }];
    net.send({ t: 'start', cfg, mode: this.mode, roster });
    this.ui.closeModal('online');
    g.startBattle({ ...cfg, net: { net, mode: this.mode, roster } });
  }
  /** Rematch from the result screen. */
  again() {
    if (this.net.isHost) this.start();
    else { this.net.send({ t: 'again' }); this.ui.toast(`Asked ${this._friendName || 'the host'} for a rematch`); }
  }
  /** Host went back to the setup screen: bring the guest along. */
  toSetup() { if (this.net.isHost) this.net.send({ t: 'setup' }); }
  pushLobby() { if (this.net.isHost && this.net.connected) this.net.send({ t: 'lobby', cfg: this.bui._cfg(), mode: this.mode }); }

  onData(d) {
    const g = this.game, b = g.battle, net = this.net;
    if (BATTLE_MSGS.has(d.t)) { if (b.running && b.sync) b.sync.onData(d); return; }
    switch (d.t) {
      case 'hello':
        net.friend = { name: String(d.name || 'PILOT').replace(/[^A-Z0-9 _.-]/gi, '').slice(0, 12).toUpperCase() || 'PILOT', ac: { id: AIRCRAFT_BY_ID[d.ac && d.ac.id] ? d.ac.id : 'ember', stats: this._cleanStats(d.ac && d.ac.stats) } };
        this._friendName = net.friend.name;
        if (net.isGuest) { this.hostCfg = d.cfg; this.mode = d.mode === 'versus' ? 'versus' : 'coop'; this.ui.toast(`Connected to ${net.friend.name}'s room`, 'good'); }
        else this.ui.toast(`${net.friend.name} joined your room`, 'good');
        this.refresh();
        break;
      case 'lobby': if (net.isGuest) { this.hostCfg = d.cfg; this.mode = d.mode === 'versus' ? 'versus' : 'coop'; this.refresh(); } break;
      case 'start':
        if (!net.isGuest) break;
        this.ui.closeModal('online');
        this.mode = d.mode === 'versus' ? 'versus' : 'coop';
        g.startBattle({ ...this._cleanCfg(d.cfg), net: { net, mode: this.mode, roster: d.roster.slice(0, 2).map((r) => ({ name: String(r.name || 'PILOT').slice(0, 12), id: AIRCRAFT_BY_ID[r.id] ? r.id : 'ember', stats: this._cleanStats(r.stats) })) } });
        break;
      case 'again':
        if (net.isHost) {
          if (g.state.is(State.COMPLETE) || (g.state.is(State.MENU) && this.ui.current === 'bsetup')) this.start();
          else this.ui.toast(`${this._friendName} wants a rematch`);
        }
        break;
      case 'setup':
        if (net.isGuest && g.mode === 'battle') { this.bui.openSetup(); this.ui.toast(`${this._friendName} is picking the next battle`); }
        break;
    }
  }

  // ---- view ----------------------------------------------------------------------
  refresh() {
    const $ = (s) => this.ui.$(s), net = this.net, st = net.status;
    const inRoom = net.isHost && (st === 'waiting' || st === 'connected');
    const show = (sel, on) => { $(sel).style.display = on ? '' : 'none'; };
    show('.js-onp-idle', !net.active || st === 'error');
    show('.js-onp-room', inRoom);
    show('.js-onleave', net.active && st !== 'error');
    show('.js-onstart', net.isHost && st === 'connected');
    for (const btn of this.ui.root.querySelectorAll('.js-onmodes button')) {
      btn.classList.toggle('on', btn.dataset.id === this.mode);
      btn.disabled = net.isGuest && st === 'connected';
    }
    if (inRoom) {
      $('.js-oncodebig').textContent = net.code;
      $('.js-onlink').value = roomLink(net.code);
    }
    const name = net.friend && net.friend.name;
    let msg = '', cls = '';
    if (st === 'opening') msg = '<i class="on-spin"></i> Opening a room...';
    else if (st === 'waiting') msg = `<i class="on-spin"></i> Waiting for your friend. They tap <b>PLAY WITH A FRIEND</b> and type <b>${esc(net.code)}</b>, or open the link.`;
    else if (st === 'joining') msg = `<i class="on-spin"></i> Joining room <b>${esc(net.code)}</b>...`;
    else if (st === 'connected' && net.isHost) { msg = name ? `<b>${esc(name)}</b> is in! Pick the battleground on the setup screen, then press <b>START BATTLE</b> or <b>FIGHT!</b>` : '<i class="on-spin"></i> Linking up...'; cls = 'good'; }
    else if (st === 'connected') { msg = `<i class="on-spin"></i> Connected to <b>${esc(name || 'the host')}</b>. Waiting for them to start the battle...`; cls = 'good'; }
    else if (st === 'error') { msg = esc(net.error); cls = 'bad'; }
    const s = $('.js-onstat'); s.innerHTML = msg; s.className = 'on-status js-onstat ' + cls;
    this.refreshBar();
  }
  /** The strip on the setup screen while a friend is linked. */
  refreshBar() {
    const bar = this.bui.setup && this.bui.setup.querySelector('.js-onbar');
    if (!bar) return;
    const net = this.net;
    if (!net.active || net.status === 'error' || net.status === 'idle') { bar.style.display = 'none'; this._goLabel(); return; }
    bar.style.display = '';
    const name = net.friend ? esc(net.friend.name) : '';
    let txt;
    if (net.status !== 'connected') txt = net.isHost ? `Room <b>${esc(net.code)}</b> is open. Waiting for your friend...` : 'Joining...';
    else if (net.isHost) txt = `<b>${MODE_TXT[this.mode]}</b> with <b>${name}</b>. Pick a battleground, then FIGHT!`;
    else {
      const c = this.hostCfg || {};
      txt = `<b>${MODE_TXT[this.mode]}</b> in <b>${name}</b>'s room: ${(MAPS[c.map] || MAPS.desert).name}, ${c.size || 3}v${c.size || 3}, ${(DIFFICULTY[c.difficulty] || DIFFICULTY.normal).name}. Waiting for the host...`;
    }
    bar.innerHTML = `<span class="on-dot ${net.status === 'connected' ? 'live' : ''}"></span><span class="on-bt">${txt}</span><button class="link" data-act="binvite">room</button>`;
    this._goLabel();
  }
  _goLabel() {
    const s = this.bui.setup; if (!s) return;
    const btn = s.querySelector('[data-act=bfight]'), net = this.net;
    if (!btn) return;
    const guestWait = net.isGuest && net.connected;
    btn.classList.toggle('waiting', guestWait);
    btn.firstChild.textContent = guestWait ? 'WAITING FOR HOST' : net.isHost && net.connected ? 'FIGHT TOGETHER!' : 'FIGHT!';
  }

  // ---- helpers -------------------------------------------------------------------
  _me() {
    const g = this.game, id = g.save.data.selected;
    return { name: (g.save.data.battle.name || 'PILOT').toUpperCase().slice(0, 12), id, stats: { ...g.upgrades.stats(id) } };
  }
  _hello() {
    const me = this._me();
    this.net.send({ t: 'hello', name: me.name, ac: { id: me.id, stats: me.stats }, cfg: this.net.isHost ? this.bui._cfg() : null, mode: this.mode });
  }
  _cleanStats(s) {
    const o = {};
    if (!s || typeof s !== 'object') return o;
    for (const k of ['hp', 'speed', 'turn', 'fireRate', 'damage', 'missiles', 'missileDmg']) if (Number.isFinite(s[k])) o[k] = Math.max(0, Math.min(k === 'missiles' ? 8 : 5000, s[k]));
    return o;
  }
  _cleanCfg(c) {
    c = c || {};
    return { mode: 'team', map: MAPS[c.map] ? c.map : 'desert', difficulty: DIFFICULTY[c.difficulty] ? c.difficulty : 'normal', size: SIZES[c.size] ? +c.size : 3, view: this.bui.cfg.view, challenge: null };
  }
  _shareText() { return `Fly with me in Sky Strike! Room code ${this.net.code}  ${roomLink(this.net.code)}`; }
  async _copy(text, sel, label) {
    const el = this.ui.$(sel);
    const ok = await copyText(text);
    if (!ok) { const l = this.ui.$('.js-onlink'); l.focus(); l.select(); }
    el.textContent = ok ? 'COPIED!' : 'SELECT + COPY';
    setTimeout(() => { el.textContent = label; }, 1600);
  }
  async _share() {
    const code = this.net.code;
    if (navigator.share) {
      try { await navigator.share({ title: 'Sky Strike', text: `Fly with me in Sky Strike! Room code ${code}`, url: roomLink(code) }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // no share sheet (most desktops): WhatsApp is how most people will send it
    window.open(`https://wa.me/?text=${encodeURIComponent(this._shareText())}`, '_blank', 'noopener');
  }
}
