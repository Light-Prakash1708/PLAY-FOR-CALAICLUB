// Aircraft hangar: browse, preview (drag to rotate), compare, unlock, select
// and upgrade.
import { ic } from '../art/Icons.js';
import { coinChip } from './UI.js';
import { AIRCRAFT, AIRCRAFT_BY_ID, STAT_MAX, SPECIAL_INFO } from '../data/aircraft.js';
import { UPGRADES, MAX_UPGRADE } from '../data/upgrades.js';
import { PLAYER_ART } from '../art/planeSpecs.js';
import { drawPreview } from '../art/PlaneArt.js';
import { fmt } from '../core/utils.js';

const STAT_ROWS = [['speed', 'SPEED'], ['turn', 'AGILITY'], ['damage', 'DAMAGE'], ['fireRate', 'FIRE RATE'], ['hp', 'ARMOUR'], ['missileDmg', 'MISSILES']];
const show = (k, v) => (k === 'turn' || k === 'fireRate' ? v.toFixed(1) : String(Math.round(v)));

export class HangarUI {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    this.index = 0; this.tab = 'stats'; this.angle = 0; this.t = 0; this.spin = 0;
    this.el = ui.addScreen('hangar', `
      <div class="head"><button class="ibtn" data-act="to-menu">${ic('back')}</button><h2>HANGAR</h2>${coinChip()}</div>
      <div class="hg-stage">
        <div class="hg-disc"></div>
        <canvas class="js-prev"></canvas>
        <div class="hg-title"><div class="n js-hn"></div><div class="r js-hr"></div></div>
        <button class="ibtn hg-nav l" data-act="hg-prev">${ic('back')}</button>
        <button class="ibtn hg-nav r" data-act="hg-next">${ic('next')}</button>
        <div class="hg-lock js-hl"></div>
      </div>
      <div class="thumbs js-thumbs">${AIRCRAFT.map((a, i) => `<button class="thumb" data-act="hg-pick" data-i="${i}" aria-label="${a.name}"><canvas width="96" height="96"></canvas><span class="tag"></span></button>`).join('')}</div>
      <div class="hg-panel card">
        <div class="tabs"><button data-act="hg-tab" data-tab="stats">STATS</button><button data-act="hg-tab" data-tab="upgrades">UPGRADES</button></div>
        <div class="js-body"></div>
        <div class="hg-action js-action"></div>
      </div>`);
    this.canvas = this.el.querySelector('.js-prev');
    // drag horizontally to rotate the preview
    let dragX = null;
    this.canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; this.spin = 0; try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {} });
    this.canvas.addEventListener('pointermove', (e) => { if (dragX !== null) { const d = (e.clientX - dragX) * 0.012; this.angle += d; this.spin = d * 30; dragX = e.clientX; } });
    const up = () => { dragX = null; };
    this.canvas.addEventListener('pointerup', up); this.canvas.addEventListener('pointercancel', up);

    ui.on('hg-prev', () => this.go(this.index - 1));
    ui.on('hg-next', () => this.go(this.index + 1));
    ui.on('hg-pick', (el) => this.go(+el.dataset.i));
    ui.on('hg-tab', (el) => { this.tab = el.dataset.tab; this.render(); });
    ui.on('hg-select', () => { game.upgrades.select(this.cur.id); game.audio.sfx('powerup'); ui.toast(`${this.cur.name} selected`, 'good'); this.render(); });
    ui.on('hg-buy', () => this.buy());
    ui.on('hg-why', () => { game.audio.sfx('error'); ui.toast(game.upgrades.unlockStatus(this.cur.id).reason, 'bad'); });
    ui.on('hg-up', (el) => this.upgrade(el.dataset.up, el));
  }
  get cur() { return AIRCRAFT[this.index]; }

  open(tab) {
    this.tab = tab;
    this.index = AIRCRAFT.findIndex((a) => a.id === this.game.save.data.selected);
    this.angle = 0;
    this.ui.show('hangar');
    this.drawThumbs();
    this.render();
  }
  go(i) {
    this.index = (i + AIRCRAFT.length) % AIRCRAFT.length;
    this.angle = 0; this.spin = 0;
    this.render();
    const th = this.el.querySelectorAll('.thumb')[this.index];
    if (th && th.scrollIntoView) th.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  drawThumbs() {
    const up = this.game.upgrades, sel = this.game.save.data.selected;
    this.el.querySelectorAll('.thumb').forEach((th, i) => {
      const a = AIRCRAFT[i], owned = up.isOwned(a.id);
      drawPreview(th.querySelector('canvas'), a.id, PLAYER_ART[a.id], { scale: 0.36, locked: !owned });
      const tag = th.querySelector('.tag');
      tag.style.display = owned && a.id !== sel ? 'none' : '';
      tag.className = 'tag' + (a.id === sel ? ' sel' : '');
      tag.innerHTML = a.id === sel ? ic('check') : ic('lock');
    });
  }
  /** Called every frame by the game loop while the hangar is visible. */
  tick(dt) {
    this.t += dt;
    if (Math.abs(this.spin) > 0.01) { this.angle += this.spin * dt; this.spin *= Math.max(0, 1 - 3 * dt); }
    const a = this.cur;
    drawPreview(this.canvas, a.id, PLAYER_ART[a.id], {
      scale: 0.25, angle: this.angle + Math.sin(this.t * 0.7) * 0.1, bank: Math.sin(this.t * 1.1) * 0.35, t: this.t,
      dy: Math.sin(this.t * 1.6) * 4 + 8, locked: !this.game.upgrades.isOwned(a.id),
    });
  }

  render() {
    const g = this.game, up = g.upgrades, a = this.cur, d = g.save.data;
    const owned = up.isOwned(a.id), selected = d.selected === a.id;
    this.el.querySelector('.js-hn').textContent = a.name;
    this.el.querySelector('.js-hr').textContent = a.role;
    this.el.querySelectorAll('.thumb').forEach((th, i) => th.classList.toggle('cur', i === this.index));
    this.el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    const st = up.unlockStatus(a.id);
    this.el.querySelector('.js-hl').innerHTML = owned ? '' : `<span>${ic('lock')}${st.ok ? 'Ready to unlock' : st.reason}</span>`;

    const body = this.el.querySelector('.js-body');
    if (this.tab === 'stats') {
      const s = up.stats(a.id), ref = selected ? null : up.stats(d.selected);
      body.innerHTML = `<div class="hg-desc">${a.desc}</div>` + STAT_ROWS.map(([k, label]) => {
        const pct = Math.min(100, (s[k] / STAT_MAX[k]) * 100);
        const mark = ref ? `<u style="left:${Math.min(100, (ref[k] / STAT_MAX[k]) * 100)}%"></u>` : '';
        const cls = ref ? (s[k] > ref[k] * 1.001 ? 'up' : s[k] < ref[k] * 0.999 ? 'down' : '') : '';
        return `<div class="stat"><span>${label}</span><span class="bar"><i style="width:${pct}%"></i>${mark}</span><span class="val ${cls}">${show(k, s[k])}</span></div>`;
      }).join('') + `<div class="hg-special"><b>${SPECIAL_INFO[a.special].name}:</b> ${SPECIAL_INFO[a.special].desc}${ref ? ' &nbsp;|&nbsp; marker = your current aircraft' : ''}</div>`;
    } else {
      const s = up.stats(a.id);
      body.innerHTML = (owned ? '' : `<div class="hg-desc">Unlock ${a.name} to install upgrades.</div>`) + UPGRADES.map((u) => {
        const info = up.upgradeInfo(a.id, u.id);
        const lvl = owned ? info.level : 0;
        const nxt = up.stats(a.id, { [u.id]: Math.min(MAX_UPGRADE, lvl + 1) });
        const pipsHtml = `<span class="upips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('')}</span>`;
        const delta = info.maxed ? `${show(u.stat, s[u.stat])} (max)` : `${show(u.stat, s[u.stat])} <b>&rarr; ${show(u.stat, nxt[u.stat])}</b>`;
        const btn = info.maxed ? `<button class="btn small white" disabled>MAX</button>`
          : `<button class="btn small orange ${owned && info.affordable ? '' : 'off'}" data-act="hg-up" data-up="${u.id}" data-quiet>${ic('coin')}${fmt(info.cost)}</button>`;
        return `<div class="upg" data-row="${u.id}"><div><div class="t">${u.name}${pipsHtml}<span style="font-family:var(--body);font-size:.55em;color:var(--ink-soft)">LV ${lvl}/${MAX_UPGRADE}</span></div><div class="d">${u.desc}: ${delta}</div></div>${btn}</div>`;
      }).join('');
    }

    const act = this.el.querySelector('.js-action');
    if (owned) {
      act.innerHTML = selected ? `<button class="btn wide white" disabled>${ic('check')}SELECTED</button>` : `<button class="btn wide teal" data-act="hg-select" data-quiet>SELECT AIRCRAFT</button>`;
    } else if (a.unlock.reward) {
      act.innerHTML = `<button class="btn wide off" data-act="hg-why" data-quiet>${ic('lock')}MISSION 10 REWARD</button>`;
    } else if (st.ok) {
      act.innerHTML = `<button class="btn wide orange" data-act="hg-buy">UNLOCK ${ic('coin')}${fmt(a.unlock.price)}</button>`;
    } else {
      act.innerHTML = `<button class="btn wide orange off" data-act="hg-why" data-quiet>${ic('lock')}UNLOCK ${ic('coin')}${fmt(a.unlock.price)}</button>`;
    }
    this.ui.refreshCurrency();
  }

  buy() {
    const a = this.cur, g = this.game, ui = this.ui;
    ui.confirm({
      title: `UNLOCK ${a.name}?`, text: `Spend ${fmt(a.unlock.price)} coins to add this aircraft to your hangar.`, yes: 'UNLOCK',
      onYes: () => {
        const r = g.upgrades.buyAircraft(a.id);
        if (!r.ok) { g.audio.sfx('error'); ui.toast(r.reason, 'bad'); return; }
        g.upgrades.select(a.id);
        g.audio.sfx('buy');
        ui.toast(`${a.name} unlocked and selected!`, 'good');
        this.spin = 9;
        this.drawThumbs(); this.render();
      },
    });
  }
  upgrade(upId, el) {
    const g = this.game, ui = this.ui, a = this.cur;
    const r = g.upgrades.buyUpgrade(a.id, upId);
    if (!r.ok) { g.audio.sfx('error'); ui.toast(r.reason, 'bad'); return; }
    g.audio.sfx('buy');
    const u = UPGRADES.find((x) => x.id === upId);
    ui.toast(`${u.name} upgraded to level ${r.level}`, 'good');
    this.render();
    const row = this.el.querySelector(`[data-row="${upId}"]`);
    if (row) row.classList.add('flash');
  }
}
