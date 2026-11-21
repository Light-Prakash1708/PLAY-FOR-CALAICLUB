// Screen manager: owns the DOM layer above the canvas. Screens are plain
// sections toggled with a class; buttons use data-act for delegated clicks.
import { fmt } from '../core/utils.js';
import { ic } from '../art/Icons.js';
import { LEVEL_COUNT } from '../data/levels.js';

export class UI {
  constructor(game, root) {
    this.game = game; this.root = root;
    this.actions = {};
    this.current = null;
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !root.contains(el) || el.disabled) return;
      game.audio.init();
      const fn = this.actions[el.dataset.act];
      if (fn) { if (!el.hasAttribute('data-quiet')) game.audio.sfx('click'); fn(el, e); }
    });
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast';
    root.appendChild(this.toastEl);
    this.addModal('confirm', '<h3 class="js-ct"></h3><p class="js-cx"></p><div class="row"><button class="btn white small" data-act="confirm-no">CANCEL</button><button class="btn small js-cy" data-act="confirm-yes">OK</button></div>');
    this.on('confirm-no', () => this.closeModal('confirm'));
    this.on('confirm-yes', () => { this.closeModal('confirm'); const fn = this._onYes; this._onYes = null; if (fn) fn(); });
  }
  on(name, fn) { this.actions[name] = fn; }
  $(sel) { return this.root.querySelector(sel); }

  addScreen(id, html, cls = '') {
    const s = document.createElement('section');
    s.id = 's-' + id; s.className = 'screen ' + cls; s.innerHTML = html;
    this.root.insertBefore(s, this.toastEl);
    return s;
  }
  addModal(id, html) {
    const m = document.createElement('div');
    m.id = 'm-' + id; m.className = 'modal';
    m.innerHTML = `<div class="panel card">${html}</div>`;
    this.root.insertBefore(m, this.toastEl);
    return m;
  }
  /** Shows one screen and hides every other screen (modals untouched). */
  show(id) {
    for (const s of this.root.querySelectorAll('.screen.on')) s.classList.remove('on');
    const el = this.$('#s-' + id);
    el.classList.add('on');
    this.current = id;
    this.game.audio.sfx('swoosh');
    this.refreshCurrency();
  }
  overlay(id) { this.$('#s-' + id).classList.add('on'); }
  hide(id) { this.$('#s-' + id).classList.remove('on'); }
  isOn(id) { return this.$('#s-' + id).classList.contains('on'); }
  openModal(id) { this.$('#m-' + id).classList.add('on'); }
  closeModal(id) { this.$('#m-' + id).classList.remove('on'); }
  modalOpen(id) { return this.$('#m-' + id).classList.contains('on'); }
  anyModal() { return !!this.root.querySelector('.modal.on'); }
  /** Esc: closes the front-most dialog through its own close button, so its usual save/cleanup runs. */
  closeTopModal() {
    const open = [...this.root.querySelectorAll('.modal.on')];
    if (!open.length) return;
    const z = (m) => +getComputedStyle(m).zIndex || 0;
    const top = open.reduce((a, m) => (z(m) >= z(a) ? m : a));
    const btn = top.querySelector('[data-act$="-close"], [data-act="confirm-no"]');
    if (btn) btn.click(); else top.classList.remove('on');
  }

  confirm({ title, text, yes = 'OK', danger = false, onYes }) {
    this.$('.js-ct').textContent = title;
    this.$('.js-cx').textContent = text;
    const y = this.$('.js-cy');
    y.textContent = yes;
    y.className = 'btn small js-cy ' + (danger ? '' : 'teal');
    this._onYes = onYes;
    this.openModal('confirm');
  }
  toast(msg, kind = '') {
    const t = this.toastEl;
    t.className = 'toast on ' + kind;
    t.innerHTML = (kind === 'good' ? ic('check') : '') + `<span></span>`;
    t.lastChild.textContent = msg;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('on'), 2200);
  }
  refreshCurrency() {
    const d = this.game.save.data, stars = this.game.upgrades.totalStars();
    for (const el of this.root.querySelectorAll('.js-coins')) el.textContent = fmt(d.coins);
    for (const el of this.root.querySelectorAll('.js-stars')) el.textContent = stars + '/' + LEVEL_COUNT * 3;
  }
}
export const coinChip = () => `<span class="chip">${ic('coin')}<span class="js-coins">0</span></span>`;
export const starChip = () => `<span class="chip">${ic('star', 'star-ic')}<span class="js-stars">0</span></span>`;
