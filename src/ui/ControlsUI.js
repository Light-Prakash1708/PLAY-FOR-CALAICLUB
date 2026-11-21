// Controls dialog: fire mode, auto flares and remappable keyboard keys.
import { ACTIONS, FIRE_MODES, keyName, bindKey, defaultKeys, isReserved } from '../systems/Keybinds.js';

export class ControlsUI {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    this.el = ui.addModal('controls', `<h3>CONTROLS</h3>
      <div class="ct-label">FIRING</div>
      <div class="bs-seg ct-seg js-fm">${Object.entries(FIRE_MODES).map(([id, m]) => `<button data-act="fmode" data-id="${id}">${m.name}</button>`).join('')}</div>
      <p class="ct-desc js-fmd"></p>
      <div class="set"><label>Auto flares when a missile is about to hit</label><button class="toggle js-af" data-act="autoflares" aria-label="Auto flares"></button></div>
      <div class="set"><label>Target-lock animation &amp; combat zoom</label><button class="toggle js-lfx" data-act="lockfx" aria-label="Target lock effects"></button></div>
      <div class="ct-label">KEYBOARD <span>click a box, then press a key</span></div>
      <div class="ct-keys js-keys"></div>
      <p class="ct-desc js-tip">Esc cancels · Backspace clears a key · each key can only do one thing</p>
      <div class="row"><button class="btn white small" data-act="keys-reset">RESET KEYS</button><button class="btn small" data-act="controls-close">DONE</button></div>`);
    const s = () => game.save.data.settings;
    ui.on('controls', () => this.open());
    ui.on('controls-close', () => { this._stop(); ui.closeModal('controls'); game.save.save(); game.applySettings(); });
    ui.on('fmode', (el) => { s().fireMode = el.dataset.id; this.sync(); game.applySettings(); game.save.save(); });
    ui.on('lockfx', () => { s().lockFx = !s().lockFx; this.sync(); game.applySettings(); game.save.save(); });
    ui.on('autoflares', () => { s().autoFlares = !s().autoFlares; this.sync(); game.applySettings(); game.save.save(); });
    ui.on('keys-reset', () => { s().keys = defaultKeys(); this.sync(); game.applySettings(); game.save.save(); ui.toast('Keys reset to defaults', 'good'); });
    ui.on('rebind', (el) => this._listen(el));
  }
  open() { this.sync(); this.ui.openModal('controls'); }
  sync() {
    const s = this.game.save.data.settings;
    for (const b of this.el.querySelectorAll('.js-fm button')) b.classList.toggle('on', b.dataset.id === s.fireMode);
    this.el.querySelector('.js-fmd').textContent = FIRE_MODES[s.fireMode].desc;
    this.el.querySelector('.js-af').classList.toggle('on', s.autoFlares);
    this.el.querySelector('.js-lfx').classList.toggle('on', s.lockFx !== false);
    this.el.querySelector('.js-keys').innerHTML = ACTIONS.map((a) => `<div class="ct-row"><span>${a.label}</span>${[0, 1].map((i) =>
      `<button class="ct-key${s.keys[a.id][i] ? '' : ' none'}" data-act="rebind" data-a="${a.id}" data-slot="${i}">${keyName(s.keys[a.id][i])}</button>`).join('')}</div>`).join('');
  }
  _stop() {
    this.game.input.capture = null;
    if (this._el) { this._el.classList.remove('listen'); this._el = null; }
  }
  _listen(el) {
    this._stop();
    this._el = el;
    el.classList.add('listen'); el.textContent = 'PRESS A KEY';
    const s = this.game.save.data.settings, a = el.dataset.a, slot = +el.dataset.slot;
    this.game.input.capture = (code) => {
      this._el = null;
      if (code === 'Escape') { this.sync(); return; }
      if (code === 'Backspace') s.keys[a][slot] = '';
      else if (isReserved(code)) { this.ui.toast(`${keyName(code)} is reserved (pause / browser)`, 'bad'); this.sync(); return; }
      else bindKey(s.keys, a, slot, code);
      this.game.applySettings(); this.game.save.save();
      this.sync();
      this.game.audio.sfx('click');
    };
  }
}
