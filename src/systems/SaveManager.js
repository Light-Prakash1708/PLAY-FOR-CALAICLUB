// Versioned LocalStorage persistence with validation and safe fallbacks.
import { AIRCRAFT, AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { UPGRADES, MAX_UPGRADE } from '../data/upgrades.js';
import { LEVEL_COUNT } from '../data/levels.js';
import { clamp } from '../core/utils.js';
import { defaultKeys, validateKeys } from './Keybinds.js';
const MAP_IDS = ['desert', 'peaks', 'warzone', 'ocean', 'city', 'lava'];

import { DEV } from '../core/GameConfig.js';

const KEY = DEV ? 'skystrike.dev.save' : 'skystrike.save';   // the dev build never touches real progress
export const SAVE_VERSION = 3;
const STARTER = AIRCRAFT[0].id;
// Aircraft ids used by older save versions, in roster order. Old ids map to the current roster by position.
const OLD_IDS = {
  1: ['falcon', 'viper', 'thunder', 'phantom', 'raptor', 'hornet', 'spectre', 'titan', 'reaper', 'dominator'],
  2: ['mig21', 'mig25', 'jaguar', 'tejas', 'mig23', 'mirage', 'mig29', 'su30', 'rafale', 'su57'],
};

const defaultSettings = () => ({ music: 0.6, sfx: 0.8, vibration: true, quality: 'high', sensitivity: 1, keys: defaultKeys(), fireMode: 'auto', autoFlares: true, lockFx: true, voices: true, radar: true });
const defaultUpgrades = () => Object.fromEntries(UPGRADES.map((u) => [u.id, 0]));

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    coins: 0,
    unlockedLevel: 1,
    levels: {},                       // id -> { stars, best, done }
    fails: {},                        // id -> consecutive failed attempts (drives the assist)
    aircraft: { [STARTER]: { owned: true, up: defaultUpgrades() } },
    selected: STARTER,
    settings: defaultSettings(),
    daily: { last: '', streak: 0 },
    stats: { xp: 0, kills: 0, starsCollected: 0, missions: 0 },
    tutorialDone: false,
    battle: defaultBattle(),
  };
}
const defaultBattle = () => ({ played: 0, wins: 0, best: 0, name: '', cfg: { map: 'desert', difficulty: 'normal', size: 3, view: 'top' } });

const num = (v, d, lo = 0, hi = 1e9) => (typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : d);
const int = (v, d, lo, hi) => Math.floor(num(v, d, lo, hi));

/** Rebuilds a save from untrusted data; anything malformed falls back to defaults. */
export function validateSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  d.coins = int(raw.coins, 0, 0, 9999999);
  d.unlockedLevel = int(raw.unlockedLevel, 1, 1, LEVEL_COUNT);
  if (raw.levels && typeof raw.levels === 'object') {
    for (let id = 1; id <= LEVEL_COUNT; id++) {
      const l = raw.levels[id];
      if (l && typeof l === 'object') d.levels[id] = { stars: int(l.stars, 0, 0, 3), best: int(l.best, 0), done: !!l.done };
    }
  }
  if (raw.fails && typeof raw.fails === 'object') for (let id = 1; id <= LEVEL_COUNT; id++) { const f = int(raw.fails[id], 0, 0, 3); if (f) d.fails[id] = f; }
  // a campaign finished before new missions were added moves on to the next one
  while (d.unlockedLevel < LEVEL_COUNT && d.levels[d.unlockedLevel] && d.levels[d.unlockedLevel].done) d.unlockedLevel++;
  if (raw.aircraft && typeof raw.aircraft === 'object') {
    for (const a of AIRCRAFT) {
      const r = raw.aircraft[a.id];
      if (r && typeof r === 'object' && r.owned) {
        const up = defaultUpgrades();
        if (r.up && typeof r.up === 'object') for (const u of UPGRADES) up[u.id] = int(r.up[u.id], 0, 0, MAX_UPGRADE);
        d.aircraft[a.id] = { owned: true, up };
      }
    }
  }
  d.selected = AIRCRAFT_BY_ID[raw.selected] && d.aircraft[raw.selected] ? raw.selected : STARTER;
  const s = raw.settings || {};
  d.settings = {
    music: num(s.music, 0.6, 0, 1), sfx: num(s.sfx, 0.8, 0, 1),
    vibration: typeof s.vibration === 'boolean' ? s.vibration : true,
    quality: ['low', 'medium', 'high'].includes(s.quality) ? s.quality : 'high',
    sensitivity: num(s.sensitivity, 1, 0.6, 1.4),
    keys: validateKeys(s.keys),
    fireMode: ['auto', 'hold', 'toggle'].includes(s.fireMode) ? s.fireMode : 'auto',
    autoFlares: typeof s.autoFlares === 'boolean' ? s.autoFlares : true,
    lockFx: typeof s.lockFx === 'boolean' ? s.lockFx : true,
    voices: typeof s.voices === 'boolean' ? s.voices : true,
    radar: typeof s.radar === 'boolean' ? s.radar : true,
  };
  const dl = raw.daily || {};
  d.daily = { last: typeof dl.last === 'string' ? dl.last.slice(0, 10) : '', streak: int(dl.streak, 0, 0, 100000) };
  const st = raw.stats || {};
  d.stats = { xp: int(st.xp, 0), kills: int(st.kills, 0), starsCollected: int(st.starsCollected, 0), missions: int(st.missions, 0) };
  d.tutorialDone = !!raw.tutorialDone;
  const b = raw.battle || {}, bc = b.cfg || {};
  d.battle = { played: int(b.played, 0), wins: int(b.wins, 0), best: int(b.best, 0, 0, 999),
    name: typeof b.name === 'string' ? b.name.replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 12) : '',
    cfg: { map: MAP_IDS.includes(bc.map) ? bc.map : 'desert',
      difficulty: ['easy', 'normal', 'hard'].includes(bc.difficulty) ? bc.difficulty : 'normal',
      size: [2, 3, 4].includes(bc.size) ? bc.size : 3, view: bc.view === 'cockpit' ? 'cockpit' : 'top' } };
  return d;
}

/** Hook for future save formats: upgrade older versions step by step. */
function migrate(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const ids = OLD_IDS[raw.v];
  if (ids) {
    const map = (id) => { const i = ids.indexOf(id); return i >= 0 ? AIRCRAFT[i].id : id; };
    if (raw.aircraft && typeof raw.aircraft === 'object') {
      const next = {};
      for (const id in raw.aircraft) next[map(id)] = raw.aircraft[id];
      raw.aircraft = next;
    }
    raw.selected = map(raw.selected);
    raw.v = SAVE_VERSION;
  }
  return raw;
}

export class SaveManager {
  constructor() {
    this.persistent = true;
    this.data = this.load();
  }
  load() {
    try {
      const txt = localStorage.getItem(KEY);
      if (!txt) return defaultSave();
      return validateSave(migrate(JSON.parse(txt)));
    } catch (e) {
      // corrupted JSON or storage unavailable: start clean, keep playing
      return defaultSave();
    }
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      this.persistent = true;
    } catch (e) {
      this.persistent = false;
    }
    return this.persistent;
  }
  /** Wipes progress but keeps the player's settings. */
  resetProgress() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }
}
