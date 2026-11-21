// Pause menu, victory screen and game-over screen.
import { ic, LOGO_PLANE } from '../art/Icons.js';
import { fmt, formatTime } from '../core/utils.js';
import { LEVELS } from '../data/levels.js';
import { AIRCRAFT_BY_ID } from '../data/aircraft.js';

const RATING = ['', 'MISSION PASSED', 'GREAT FLYING', 'PERFECT SORTIE'];

export class ResultUI {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    ui.addScreen('pause', `<div class="panel card"><div class="kicker js-pk"></div><h3 class="res-title" style="color:var(--ink)">PAUSED</h3>
      <p class="js-po" style="text-align:center;font-size:.76em;color:var(--ink-soft);margin:.3em 0 0"></p>
      <div class="stack" style="display:flex;flex-direction:column;gap:.6em;margin-top:.9em">
        <button class="btn" data-act="resume">${ic('play')}RESUME</button>
        <button class="btn white" data-act="restart">${ic('replay')}RESTART LEVEL</button>
        <button class="btn white" data-act="pause-settings">${ic('gear')}SETTINGS</button>
        <button class="btn white" data-act="quit">${ic('home')}MAIN MENU</button>
      </div></div>`, 'overlay');
    ui.addScreen('victory', `<div class="panel card">
      <svg class="win-art" viewBox="-70 -24 140 48"><g class="fly">${LOGO_PLANE}</g></svg>
      <div class="res-title win js-vt">MISSION COMPLETE</div><div class="res-sub js-vs"></div>
      <div class="res-stars js-rstars"><span>${ic('star')}</span><span class="s2">${ic('star')}</span><span>${ic('star')}</span></div>
      <div class="res-rating js-rating"></div>
      <div class="res-rows js-vrows"></div>
      <div class="res-note js-vnote"></div>
      <div class="row" style="display:flex;gap:.6em;margin-top:.8em"><button class="btn white small" data-act="replay" style="flex:1">${ic('replay')}REPLAY</button><button class="btn" data-act="continue" style="flex:1.4">CONTINUE${ic('next')}</button></div>
      <div style="text-align:center"><button class="link" data-act="quit" style="color:var(--ink-soft)">Main menu</button></div></div>`, 'overlay');
    ui.addScreen('gameover', `<div class="panel card">
      <svg class="defeat-art" viewBox="-50 -36 100 72"><g class="fall"><g transform="scale(.8)">${LOGO_PLANE}</g><circle cx="-22" cy="-6" r="6" fill="#7A6257" opacity=".5"/><circle cx="-34" cy="-12" r="8" fill="#7A6257" opacity=".3"/></g></svg>
      <div class="res-title lose">MISSION FAILED</div><div class="res-sub js-gs"></div>
      <div class="res-rows js-grows"></div>
      <div class="res-note js-gnote" style="color:var(--ink-soft);font-weight:700"></div>
      <div class="stack" style="display:flex;flex-direction:column;gap:.6em;margin-top:.8em">
        <button class="btn" data-act="restart">${ic('replay')}RETRY</button>
        <button class="btn white" data-act="quit">${ic('home')}MAIN MENU</button>
      </div></div>`, 'overlay');
    ui.on('resume', () => game.resume());
    ui.on('restart', () => game.restart());
    ui.on('replay', () => game.restart());
    ui.on('pause-settings', () => ui.settings.open());
    ui.on('quit', () => game.enterMenu());
    ui.on('continue', () => game.continueCampaign());
    this.timers = [];
  }
  _clearTimers() { for (const t of this.timers) clearTimeout(t); this.timers.length = 0; }

  showPause(level, world) {
    this.ui.$('.js-pk').textContent = `MISSION ${level.id}: ${level.name}`;
    this.ui.$('.js-po').textContent = `${level.objective.label} - ${world.level.progressText()}`;
    this.ui.overlay('pause');
  }

  showVictory(level, r) {
    const ui = this.ui, last = level.id === LEVELS.length;
    this._clearTimers();
    ui.$('.js-vt').textContent = last ? 'CAMPAIGN COMPLETE' : 'MISSION COMPLETE';
    ui.$('.js-vs').textContent = `Mission ${level.id}: ${level.name}`;
    const stars = ui.$('.js-rstars').children;
    for (const s of stars) s.classList.remove('on');
    ui.$('.js-rating').textContent = '';
    for (let i = 0; i < r.stars; i++) {
      this.timers.push(setTimeout(() => { stars[i].classList.add('on'); this.game.audio.sfx('starPop'); if (i === r.stars - 1) ui.$('.js-rating').textContent = RATING[r.stars]; }, 500 + i * 380));
    }
    const line = (label, val, cls = '') => `<div class="line ${cls}"><span>${label}</span><b>${val}</b></div>`;
    ui.$('.js-vrows').innerHTML =
      line('Final score', fmt(r.score) + (r.newBest ? ' <small style="font-family:var(--body);font-size:.45em;color:var(--red)">NEW BEST</small>' : '')) +
      line('Enemies destroyed', r.kills) +
      line('Time', formatTime(r.time)) +
      line('Stars collected', `${ic('starDisc')}${r.pickupStars}`) +
      line('Coins from combat', `+${fmt(r.missionCoins)}`, 'sub') +
      line(r.firstClear ? 'Mission reward' : 'Replay reward', `+${fmt(r.levelReward)}`, 'sub') +
      (r.flawless ? line('Flawless (no damage)', `+${fmt(r.flawless)}`, 'sub') : '') +
      (r.starBonus ? line('New rating stars', `+${fmt(r.starBonus)}`, 'sub') : '') +
      line('Coins earned', `${ic('coin')}${fmt(r.total)}`, 'total');
    const notes = [];
    if (r.unlocked) notes.push(`New aircraft unlocked: ${AIRCRAFT_BY_ID[r.unlocked].name}!`);
    if (r.firstClear && !last) notes.push(`Mission ${level.id + 1} unlocked`);
    if (r.levelUp) notes.push('Pilot rank up!');
    ui.$('.js-vnote').textContent = notes.join('  -  ');
    ui.$('[data-act="continue"]').firstChild.textContent = last ? 'FINISH' : 'CONTINUE';
    ui.show('victory');
  }

  showGameOver(level, r, progressText) {
    const ui = this.ui;
    this._clearTimers();
    ui.$('.js-gs').textContent = `Mission ${level.id}: ${level.name}`;
    const line = (label, val, cls = '') => `<div class="line ${cls}"><span>${label}</span><b>${val}</b></div>`;
    ui.$('.js-grows').innerHTML = line('Final score', fmt(r.score)) + line('Enemies destroyed', r.kills) + line('Objective', progressText) +
      line('Coins salvaged', `${ic('coin')}${fmt(r.total)}`, 'total');
    ui.$('.js-gnote').textContent = (r.assist ? 'Enemy aggression is reduced for your next attempt. ' : '') + 'Tip: upgrade your aircraft in the hangar, use boost to out-turn missiles and save flares for the warning.';
    ui.show('gameover');
  }
}
