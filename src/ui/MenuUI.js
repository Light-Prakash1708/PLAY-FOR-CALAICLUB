// Loading screen, main menu and the daily-reward dialog.
import { ic, LOGO_PLANE } from '../art/Icons.js';
import { coinChip, starChip } from './UI.js';
import { LEVELS } from '../data/levels.js';
import { DAILY_REWARDS } from '../systems/RewardManager.js';

const LOGO = `<div class="logo">
  <svg class="logo-art" viewBox="0 0 240 104"><path class="path" d="M8 84C46 104 74 30 112 44s46 62 30 26S150 14 192 30"/><g transform="translate(192 30) rotate(-14) scale(.82)">${LOGO_PLANE}</g></svg>
  <span class="l1">SKY</span><span class="l2">STRIKE</span></div>`;

const TIPS = [
  'Enemy missiles turn slowly. Fly a tight circle and they will miss.',
  'Two enemy missiles that collide destroy each other.',
  'Flares pull every nearby missile off your tail. Save them for when the warning sounds.',
  'Your cannon auto-aims slightly - line up roughly and hold the trigger.',
  'Finish with high health and under par time to earn three stars.',
  'A shield blocks every hit until it runs out.',
  'Resupply crates refill missiles, flares and one special charge.',
  'Stealth jets cannot be locked by missiles while cloaked.',
  'Team Battle: stay inside the shrinking zone - outside it your jet burns.',
  'Press R (or the blue button) for a 3.5 second energy shield.',
  'Change every key and the fire mode in Settings > Controls.',
  'Your cannon overheats. Short bursts keep it firing.',
  'Supply crates refill ammo and missiles. Grab them between fights.',
];

export class MenuUI {
  constructor(ui) {
    this.ui = ui; const game = this.game = ui.game;
    this.loading = ui.addScreen('loading', `${LOGO}
      <div class="load-bar"><div class="load-fill"></div><div class="load-plane"><svg viewBox="-24 -24 68 48">${LOGO_PLANE}</svg></div></div>
      <div class="load-pct display">0%</div>
      <div class="load-sound">${ic('sound')} BEST WITH SOUND ON</div>
      <button class="btn" data-act="start">TAP TO BEGIN</button>
      <div class="load-tip"></div>`);
    this.menu = ui.addScreen('menu', `
      <div class="menu-top">
        <div class="profile"><div class="lvl js-plvl">1</div><div><div class="rank js-rank">Cadet</div><div class="xp"><i class="js-xp"></i></div></div></div>
        <div class="menu-cur">${starChip()}${coinChip()}</div>
      </div>
      <div class="menu-logo">${LOGO}</div>
      <div class="menu-main">
        <button class="btn play battle-go" data-act="battle">${ic('burst')} TEAM BATTLE<small class="js-bsub">3 v 3 dogfight · play online with a friend · 2½ min</small></button>
        <button class="btn play teal camp-go" data-act="campaign">CAMPAIGN<small class="js-next"></small></button>
        <div class="tiles">
          <button class="tile" data-act="hangar"><span class="tic">${ic('plane')}</span><span><b>HANGAR</b><span class="js-fleet">1/10 aircraft</span></span></button>
          <button class="tile" data-act="upgrades"><span class="tic">${ic('upgrade')}</span><span><b>UPGRADES</b><span>Boost your aircraft</span></span></button>
          <button class="tile js-daily" data-act="daily"><i class="dot"></i><span class="tic">${ic('gift')}</span><span><b>DAILY REWARD</b><span class="js-dailytxt">Claim now</span></span></button>
          <button class="tile" data-act="settings"><span class="tic">${ic('gear')}</span><span><b>SETTINGS</b><span>Audio, controls, graphics</span></span></button>
        </div>
      </div>
      <div class="menu-foot">SKY STRIKE v8.1${game.dev ? ' - DEVELOPER BUILD (everything unlocked)' : ''}</div>`);
    ui.addModal('daily', `<div class="kicker">COME BACK EVERY DAY</div><h3>DAILY REWARD</h3>
      <div class="days js-days"></div>
      <div class="stack"><button class="btn orange js-claim" data-act="claim" data-quiet>CLAIM</button><button class="btn white small" data-act="daily-close">CLOSE</button></div>`);

    ui.addScreen('intro', `<div class="it-line l1">THE CORAL COAST.</div>
      <div class="it-line l2">THE CRIMSON WING HAS TAKEN THE SKIES.</div>
      <div class="it-line l3">ONE SQUADRON IS LEFT.</div>
      <div class="it-logo">${LOGO}<div class="it-op">OPERATION FIREBREAK</div></div>
      <button class="it-skip" data-act="intro-skip">SKIP ${ic('next')}</button>`);
    ui.on('start', () => { game.audio.init(); game.playIntro(); });
    ui.on('intro-skip', () => game.finishIntro());
    ui.on('campaign', () => { ui.levels.refresh(); ui.show('levels'); });
    ui.on('battle', () => ui.battle.openSetup());
    ui.on('hangar', () => ui.hangar.open('stats'));
    ui.on('upgrades', () => ui.hangar.open('upgrades'));
    ui.on('settings', () => ui.settings.open());
    ui.on('daily', () => { this.renderDaily(); ui.openModal('daily'); });
    ui.on('daily-close', () => ui.closeModal('daily'));
    ui.on('claim', () => {
      const amt = game.rewards.claimDaily();
      if (amt) { game.audio.sfx('buy'); ui.toast(`+${amt} coins collected`, 'good'); }
      this.renderDaily(); this.refresh(); ui.refreshCurrency();
    });
    this.tipI = Math.floor(Math.random() * TIPS.length);
    this._tip();
    this.tipTimer = setInterval(() => this._tip(), 2600);
  }
  _tip() { this.loading.querySelector('.load-tip').textContent = 'TIP: ' + TIPS[this.tipI++ % TIPS.length]; }

  setProgress(p) {
    const pct = Math.round(p * 100);
    this.loading.querySelector('.load-fill').style.width = pct + '%';
    this.loading.querySelector('.load-plane').style.left = pct + '%';
    this.loading.querySelector('.load-pct').textContent = pct + '%';
  }
  ready() { this.loading.classList.add('ready'); }
  stopTips() { clearInterval(this.tipTimer); }

  refresh() {
    const g = this.game, d = g.save.data, m = this.menu, pilot = g.rewards.pilot();
    m.querySelector('.js-plvl').textContent = pilot.level;
    m.querySelector('.js-rank').textContent = pilot.rank;
    m.querySelector('.js-xp').style.width = Math.round(pilot.progress * 100) + '%';
    const z = (d.battle && d.battle.cfg && +d.battle.cfg.size) || 3;
    m.querySelector('.js-bsub').textContent = `${z} v ${z} dogfight · play online with a friend · 2½ min`;
    const allDone = d.levels[LEVELS.length] && d.levels[LEVELS.length].done;
    const next = LEVELS[d.unlockedLevel - 1];
    m.querySelector('.js-next').textContent = allDone ? 'Campaign complete - replay any mission' : `Mission ${next.id}: ${next.name}`;
    m.querySelector('.js-fleet').textContent = `${g.upgrades.ownedCount()}/10 aircraft`;
    const ds = g.rewards.dailyStatus();
    m.querySelector('.js-daily').classList.toggle('notify', !ds.claimed);
    m.querySelector('.js-dailytxt').textContent = ds.claimed ? 'Come back tomorrow' : `Claim ${ds.amount} coins`;
  }
  renderDaily() {
    const ds = this.game.rewards.dailyStatus();
    this.ui.$('.js-days').innerHTML = DAILY_REWARDS.map((amt, i) => {
      const got = i < ds.index || (i === ds.index && ds.claimed);
      const today = i === ds.index;
      return `<div class="day ${got ? 'got' : ''} ${today ? 'today' : ''}">DAY ${i + 1}<b>${ic('coin')}${amt}</b>${got ? 'Claimed' : today ? 'Today' : '&nbsp;'}</div>`;
    }).join('');
    const btn = this.ui.$('.js-claim');
    btn.disabled = ds.claimed;
    btn.textContent = ds.claimed ? 'CLAIMED TODAY' : `CLAIM ${ds.amount} COINS`;
  }
}
