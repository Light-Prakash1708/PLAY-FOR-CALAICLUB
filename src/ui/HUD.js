// In-mission HUD. DOM writes only happen when a displayed value changes.
import { ic } from '../art/Icons.js';
import { CONFIG } from '../core/GameConfig.js';
import { formatTime, fmt } from '../core/utils.js';
import { primaryName } from '../systems/Keybinds.js';

const SPECIAL_ICON = { spread: 'burst', salvo: 'missile', bomb: 'burst' };

export class HUD {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    const el = this.el = ui.addScreen('hud', `
      <div class="hud-top">
        <div><div class="hud-time js-time">0:00</div><div class="hud-hp">${ic('heart')}<div class="hpbar js-hpbar"><i></i></div></div><div class="hud-bst">${ic('boost')}<div class="bstbar js-bstbar"><i></i></div></div></div>
        <button class="hud-pause" data-act="pause" aria-label="Pause">${ic('pause')}</button>
        <div class="hud-right"><div class="hud-score js-score">0</div><div class="hud-coins">${ic('coin')}<span class="js-mcoins">0</span></div></div>
      </div>
      <div class="hud-obj"><span class="js-objl"></span><b class="js-objp"></b></div>
      <div class="boss js-boss"><div class="bn js-bossn"></div><div class="bb"><i class="js-bossb"></i></div></div>
      <div class="banner js-banner"><div class="b1"></div><div class="b2"></div></div>
      <div class="hint js-hint"><span></span></div>
      <div class="chips">
        <span class="pchip js-c-shield">${ic('shield')}<span></span></span>
        <span class="pchip js-c-rapid">${ic('bolt')}<span></span></span>
        <span class="pchip js-c-spread">${ic('burst')}<span></span></span>
      </div>
      <div class="warn js-warn">MISSILE</div>
      <canvas class="bt-map cp-map js-radar" width="140" height="140"></canvas>
      <div class="joy-zone js-zone"><div class="joy js-joy"><div class="knob js-knob"></div></div></div>
      <div class="acts">
        <button class="act special js-special" aria-label="Special attack">${ic('burst')}<span class="cnt">0</span><span class="key">L</span></button>
        <button class="act flare js-flare" aria-label="Flares">${ic('flare')}<span class="cnt">0</span><span class="key">F</span></button>
        <button class="act boost js-boost" aria-label="Boost">${ic('boost')}<span class="key">SHIFT</span></button>
        <button class="act missile js-missile" aria-label="Launch missile">${ic('missile')}<span class="cnt">0</span><span class="key">K</span></button>
        <button class="act fire js-fire" aria-label="Fire cannon">${ic('crosshair')}<span class="key">SPACE</span></button>
      </div>`);
    const q = (s) => el.querySelector(s);
    this.n = { time: q('.js-time'), hpbar: q('.js-hpbar'), hpfill: q('.js-hpbar i'), score: q('.js-score'), coins: q('.js-mcoins'),
      objl: q('.js-objl'), objp: q('.js-objp'), boss: q('.js-boss'), bossn: q('.js-bossn'), bossb: q('.js-bossb'),
      banner: q('.js-banner'), hint: q('.js-hint'), fire: q('.js-fire'), missile: q('.js-missile'), special: q('.js-special'), flare: q('.js-flare'), warn: q('.js-warn'), boost: q('.js-boost'), bst: q('.js-bstbar i'),
      radar: q('.js-radar'), shield: q('.js-c-shield'), rapid: q('.js-c-rapid'), spread: q('.js-c-spread') };
    game.input.bindControls({ zone: q('.js-zone'), base: q('.js-joy'), knob: q('.js-knob'), fire: this.n.fire, missile: this.n.missile, special: this.n.special, flare: this.n.flare, boost: this.n.boost });
    ui.on('pause', () => game.pause());
    this.c = {};
    this.hintT = 0;
  }

  /** Reset for a new mission. */
  reset(level, world) {
    const n = this.n;
    this.c = {};
    this.el.classList.remove('hud-hide');
    this.el.classList.toggle('dark', !!(world.bg.theme.dark || world.bg.theme.ground));   // light text over dark skies and terrain
    n.objl.textContent = level.objective.label;
    n.boss.classList.remove('on');
    n.banner.className = 'banner js-banner';
    n.hint.classList.remove('on'); this.hintT = 0;
    n.special.querySelector('svg').outerHTML = ic(SPECIAL_ICON[world.player.def.special]);
    for (const k of this.el.querySelectorAll('.key')) k.style.display = world.touch ? 'none' : '';
    // key hints follow the player's own bindings
    const keys = this.game.save.data.settings.keys;
    for (const [btn, a] of [[n.special, 'special'], [n.flare, 'flare'], [n.boost, 'boost'], [n.missile, 'missile'], [n.fire, 'fire']]) btn.querySelector('.key').textContent = primaryName(keys, a);
    this.boss = null;
    this.update(world, 0);
  }
  hideControls() { this.el.classList.add('hud-hide'); this.n.hint.classList.remove('on'); }

  _set(key, val, fn) { if (this.c[key] !== val) { this.c[key] = val; fn(val); } }

  update(world, dt) {
    const n = this.n, st = world.stats, p = world.player, w = world.weapons;
    this._set('t', Math.floor(st.time), (v) => { n.time.textContent = formatTime(v); });
    this._set('s', st.score, (v) => { n.score.textContent = fmt(v); });
    this._set('c', st.coins, (v) => { n.coins.textContent = fmt(v); });
    this._set('hp', Math.ceil((p.hp / p.maxHp) * 50), (v) => {
      n.hpfill.style.width = v * 2 + '%';
      n.hpbar.className = 'hpbar js-hpbar' + (v <= 12 ? ' low' : v <= 25 ? ' mid' : '');
    });
    this._set('o', world.level.progressText(), (v) => { n.objp.textContent = v; });
    // missile button: cooldown ring + ammo
    this._set('mp', Math.round((1 - Math.max(0, w.missileCd) / CONFIG.MISSILE_COOLDOWN) * 24), (v) => { n.missile.style.setProperty('--p', v / 24); n.missile.classList.toggle('cool', v < 24); });
    this._set('mc', w.missiles, (v) => { n.missile.querySelector('.cnt').textContent = v; n.missile.classList.toggle('empty', v <= 0); });
    this._set('sp', Math.round((1 - Math.max(0, w.specialCd) / CONFIG.SPECIAL_COOLDOWN) * 30), (v) => { n.special.style.setProperty('--p', v / 30); n.special.classList.toggle('cool', v < 30); });
    this._set('sc', w.special, (v) => { n.special.querySelector('.cnt').textContent = v; n.special.classList.toggle('empty', v <= 0); });
    this._set('bp', Math.round((1 - Math.max(0, p.boostCd) / CONFIG.BOOST_COOLDOWN) * 30), (v) => { n.boost.style.setProperty('--p', v / 30); n.boost.classList.toggle('cool', v < 30); n.bst.style.width = (v / 30) * 100 + '%'; n.bst.parentNode.classList.toggle('full', v >= 30); });
    this._set('fp', Math.round((1 - Math.max(0, w.flareCd) / CONFIG.FLARE_COOLDOWN) * 20), (v) => { n.flare.style.setProperty('--p', v / 20); n.flare.classList.toggle('cool', v < 20); });
    this._set('fc', w.flares, (v) => { n.flare.querySelector('.cnt').textContent = v; n.flare.classList.toggle('empty', v <= 0); });
    this._set('th', world.missiles.threats > 0 && !world.ending ? 1 : 0, (v) => { n.warn.classList.toggle('on', !!v); n.flare.classList.toggle('alert', !!v); });
    this._chip('shield', p.shield); this._chip('rapid', p.rapid); this._chip('spread', p.spreadT);
    if (this.boss) this._set('b', Math.max(0, Math.ceil((this.boss.hp / this.boss.maxHp) * 100)), (v) => { n.bossb.style.width = v + '%'; });
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) n.hint.classList.remove('on'); }
    // radar map
    const on = this.game.save.data.settings.radar !== false;
    this._set('radarOn', on, (v) => { n.radar.style.display = v ? '' : 'none'; });
    if (on && (this.radarT = (this.radarT || 0) - dt) <= 0) {
      this.radarT = 0.066;
      const css = n.radar.clientWidth || 120, S = Math.round(css * Math.min(2, window.devicePixelRatio || 1));
      if (n.radar.width !== S) n.radar.width = n.radar.height = S;
      world.drawRadar(n.radar.getContext('2d'), S);
    }
  }
  _chip(name, t) {
    const v = t > 0 ? Math.ceil(t) : 0;
    this._set('k' + name, v, (x) => { const el = this.n[name]; el.classList.toggle('on', x > 0); el.lastElementChild.textContent = x + 's'; });
  }

  banner(title, sub = '', dur = 2, danger = false) {
    const b = this.n.banner;
    b.className = 'banner js-banner';
    void b.offsetWidth;                    // restart the CSS animation
    b.children[0].textContent = title;
    b.children[1].textContent = sub; b.children[1].style.display = sub ? '' : 'none';
    b.className = 'banner js-banner on' + (danger ? ' danger' : '');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { b.classList.add('out'); this._bt = setTimeout(() => { b.className = 'banner js-banner'; }, 320); }, dur * 1000);
  }
  hint(text, dur = 3) {
    const h = this.n.hint;
    h.firstElementChild.textContent = text;
    h.classList.add('on');
    this.hintT = dur;
  }
  showBoss(boss) {
    this.boss = boss; this.c.b = -1;
    this.n.bossn.textContent = boss.def.name;
    this.n.boss.classList.add('on');
  }
  hideBoss() { this.boss = null; this.n.boss.classList.remove('on'); }
}
