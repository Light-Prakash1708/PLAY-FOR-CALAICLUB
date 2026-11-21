// Settings dialog (also reachable from the pause menu).
import { ic } from '../art/Icons.js';

export class SettingsUI {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    this.el = ui.addModal('settings', `<h3>SETTINGS</h3>
      <div class="set"><label>Music</label><input type="range" min="0" max="100" data-set="music"></div>
      <div class="set"><label>Sound effects</label><input type="range" min="0" max="100" data-set="sfx"></div>
      <div class="set"><label>Controls &amp; keys</label><button class="btn white small" data-act="controls">CUSTOMISE</button></div>
      <div class="set"><label>Control sensitivity</label><input type="range" min="60" max="140" data-set="sensitivity"></div>
      <div class="set"><label>Graphics quality</label><span class="seg js-q"><button data-act="quality" data-q="low">LOW</button><button data-act="quality" data-q="medium">MED</button><button data-act="quality" data-q="high">HIGH</button></span></div>
      <div class="set"><label>Radio voices</label><button class="toggle" data-act="toggle" data-set="voices" aria-label="Radio voices"></button></div>
      <div class="set"><label>Radar map</label><button class="toggle" data-act="toggle" data-set="radar" aria-label="Radar map"></button></div>
      <div class="set js-vibrow"><label>Vibration</label><button class="toggle" data-act="toggle" data-set="vibration" aria-label="Vibration"></button></div>
      <div class="set"><label>Fullscreen</label><button class="btn white small" data-act="fullscreen">${ic('full')}TOGGLE</button></div>
      ${game.dev ? `<div class="set"><label>Invincible (dev)</label><button class="toggle js-god" data-act="dev-god" aria-label="Invincible"></button></div>
      <div class="set"><label>Max all upgrades (dev)</label><button class="btn white small" data-act="dev-max">APPLY</button></div>` : ''}
      <div class="stack"><button class="btn small" data-act="settings-close">DONE</button></div>
      <div style="text-align:center" class="js-resetrow"><button class="link" data-act="reset">Reset all progress</button></div>`);
    const s = () => game.save.data.settings;
    for (const inp of this.el.querySelectorAll('input[type=range]')) {
      inp.addEventListener('input', () => {
        const k = inp.dataset.set;
        s()[k] = +inp.value / 100;
        inp.style.setProperty('--v', this._pct(inp) + '%');
        game.applySettings();
        if (k === 'sfx') game.audio.sfx('coin');
      });
      inp.addEventListener('change', () => game.save.save());
    }
    ui.on('toggle', (el) => {
      const k = el.dataset.set;
      s()[k] = !s()[k];
      el.classList.toggle('on', s()[k]);
      if (k === 'vibration' && s()[k] && navigator.vibrate) { try { navigator.vibrate(40); } catch (_) {} }
      if (k === 'voices' && !s()[k]) game.radio.clear();
      game.applySettings(); game.save.save();
    });
    ui.on('quality', (el) => { s().quality = el.dataset.q; this.sync(); game.applySettings(); game.save.save(); });
    ui.on('fullscreen', () => game.toggleFullscreen());
    ui.on('dev-god', (el) => { game.devGod = !game.devGod; el.classList.toggle('on', game.devGod); ui.toast(game.devGod ? 'Invincibility ON' : 'Invincibility OFF'); });
    ui.on('dev-max', () => { for (const id in game.save.data.aircraft) for (const k in game.save.data.aircraft[id].up) game.save.data.aircraft[id].up[k] = 5; game.save.save(); ui.toast('All aircraft fully upgraded', 'good'); });
    ui.on('settings-close', () => { ui.closeModal('settings'); game.save.save(); });
    ui.on('reset', () => ui.confirm({
      title: 'RESET PROGRESS?', text: 'This permanently deletes your coins, aircraft, upgrades and mission records. Settings are kept.',
      yes: 'RESET', danger: true,
      onYes: () => { game.save.resetProgress(); if (game.dev) game.applyDevUnlocks(); ui.closeModal('settings'); ui.toast('Progress has been reset'); game.enterMenu(); },
    }));
  }
  _pct(inp) { return ((+inp.value - +inp.min) / (+inp.max - +inp.min)) * 100; }
  sync() {
    const s = this.game.save.data.settings;
    for (const inp of this.el.querySelectorAll('input[type=range]')) {
      inp.value = Math.round(s[inp.dataset.set] * 100);
      inp.style.setProperty('--v', this._pct(inp) + '%');
    }
    for (const t of this.el.querySelectorAll('.toggle[data-set]')) t.classList.toggle('on', !!s[t.dataset.set]);
    for (const b of this.el.querySelectorAll('.js-q button')) b.classList.toggle('on', b.dataset.q === s.quality);
  }
  open() {
    this.sync();
    this.el.querySelector('.js-vibrow').style.display = navigator.vibrate ? '' : 'none';
    // progress can only be reset from the main menu, never mid-mission
    this.el.querySelector('.js-resetrow').style.display = this.ui.current === 'menu' ? '' : 'none';
    this.ui.openModal('settings');
  }
}
