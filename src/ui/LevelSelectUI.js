// Campaign map: ten mission cards plus the mission-briefing dialog.
import { ic } from '../art/Icons.js';
import { starChip, coinChip } from './UI.js';
import { LINES, CAST } from '../story/script.js';
import { LEVELS } from '../data/levels.js';
import { AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { fmt, formatTime } from '../core/utils.js';

const stars3 = (n) => `<span class="stars3">${[1, 2, 3].map((i) => ic('star', i <= n ? 'on' : '')).join('')}</span>`;
const pips = (n) => `<span class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

export class LevelSelectUI {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    this.el = ui.addScreen('levels', `
      <div class="head"><button class="ibtn" data-act="to-menu">${ic('back')}</button><h2>CAMPAIGN</h2>${starChip()}${coinChip()}</div>
      <div class="scroll js-levels"></div>`);
    ui.addModal('brief', `<div class="kicker js-bk"></div><h3 class="js-bn"></h3><div class="brief-act js-bact"></div><p class="js-bd"></p>
      <div class="brief-quote js-bq"></div>
      <div class="brief-box">
        <div class="line"><span>Objective</span><b class="js-bo" style="font-size:1.15em"></b></div>
        <div class="line"><span>Difficulty</span><span class="js-bdiff"></span></div>
        <div class="line"><span>Reward</span><b class="js-br"></b></div>
        <div class="line"><span>3-star target</span><b class="js-bp" style="font-size:1.1em"></b></div>
        <div class="line"><span>Aircraft</span><b class="js-ba"></b></div>
      </div>
      <div class="row"><button class="btn white small" data-act="brief-close">BACK</button><button class="btn" data-act="brief-go">${ic('play')}START</button></div>`);
    ui.on('to-menu', () => {
      if (ui.returnTo === 'bsetup') { ui.returnTo = null; ui.battle.openSetup(); }     // hangar opened from battle setup
      else game.enterMenu();
    });
    ui.on('level', (el) => this.openBrief(+el.dataset.id));
    ui.on('brief-close', () => ui.closeModal('brief'));
    ui.on('brief-go', () => { ui.closeModal('brief'); game.startLevel(this.pending); });
  }
  refresh() {
    const d = this.game.save.data;
    this.ui.$('.js-levels').innerHTML = LEVELS.map((l) => {
      const rec = d.levels[l.id] || { stars: 0, best: 0, done: false };
      const locked = l.id > d.unlockedLevel;
      return `<button class="lv card ${locked ? 'locked' : ''} ${rec.done ? 'done' : ''}" data-act="level" data-id="${l.id}">
        <span class="num">${locked ? ic('lock') : l.id}</span>
        <span class="info"><span class="name">${l.name}${rec.done ? ic('check', 'ok') : ''}</span>
          <span class="brief">${locked ? `Complete Mission ${l.id - 1} to unlock.` : l.brief}</span>
          <span class="meta">${pips(l.difficulty)}<span class="rew">${ic('coin')}${fmt(l.reward)}</span></span></span>
        <span class="side">${stars3(rec.stars)}<span class="best">${rec.best ? 'BEST ' + fmt(rec.best) : rec.done ? '' : locked ? 'LOCKED' : 'NEW'}</span></span>
      </button>`;
    }).join('');
  }
  openBrief(id) {
    const d = this.game.save.data, ui = this.ui;
    if (id > d.unlockedLevel) { this.game.audio.sfx('error'); ui.toast(`Complete Mission ${id - 1} to unlock`, 'bad'); return; }
    const l = LEVELS[id - 1], rec = d.levels[id];
    this.pending = id;
    ui.$('.js-bk').textContent = `MISSION ${l.id} OF ${LEVELS.length}`;
    ui.$('.js-bn').textContent = l.name;
    ui.$('.js-bd').textContent = l.brief;
    // the story beat for this mission, as a radio quote
    ui.$('.js-bact').textContent = id <= 4 ? 'OPERATION FIREBREAK · ACT I: THE ROOKIE' : id <= 10 ? 'OPERATION FIREBREAK · ACT II: COUNTER-ATTACK' : 'OPERATION FIREBREAK · ACT III: THE WARLORD';
    const q = LINES[`m${id}.start`];
    ui.$('.js-bq').innerHTML = q ? `<b style="color:${CAST[q.who].color}">${CAST[q.who].name}</b>“${q.text.replace(/\{name\}/g, d.battle.name || 'Ember')}”` : '';
    ui.$('.js-bo').textContent = l.objective.label;
    ui.$('.js-bdiff').innerHTML = pips(l.difficulty);
    const replay = rec && rec.done;
    ui.$('.js-br').innerHTML = `${ic('coin')}${fmt(replay ? Math.round(l.reward * 0.35) : l.reward)}${replay ? ' <small style="font-family:var(--body);font-size:.5em;opacity:.7">replay</small>' : ''}`;
    ui.$('.js-bp').textContent = `70% health, under ${formatTime(l.par)}`;
    ui.$('.js-ba').textContent = AIRCRAFT_BY_ID[d.selected].name;
    ui.openModal('brief');
  }
}
