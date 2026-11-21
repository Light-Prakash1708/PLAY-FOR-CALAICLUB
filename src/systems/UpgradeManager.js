// Aircraft ownership, unlock rules, upgrade purchases and derived stats.
import { AIRCRAFT, AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { UPGRADES, MAX_UPGRADE, upgradeCost } from '../data/upgrades.js';

export class UpgradeManager {
  constructor(save) { this.save = save; }
  get data() { return this.save.data; }

  totalStars() {
    let n = 0;
    for (const id in this.data.levels) n += this.data.levels[id].stars || 0;
    return n;
  }
  isOwned(id) { return !!(this.data.aircraft[id] && this.data.aircraft[id].owned); }
  levelOf(id, upId) { return this.isOwned(id) ? this.data.aircraft[id].up[upId] || 0 : 0; }

  /** Final stats for an aircraft; `override` lets the UI preview "+1 level". */
  stats(id, override) {
    const a = AIRCRAFT_BY_ID[id];
    const s = { ...a.stats };
    for (const u of UPGRADES) {
      const l = override && override[u.id] !== undefined ? override[u.id] : this.levelOf(id, u.id);
      if (l > 0) u.apply(s, l);
    }
    s.missiles = Math.round(s.missiles);
    s.hp = Math.round(s.hp);
    return s;
  }

  /** { ok, reason } - whether the aircraft can be bought right now. */
  unlockStatus(id) {
    const a = AIRCRAFT_BY_ID[id], u = a.unlock, d = this.data;
    if (this.isOwned(id)) return { ok: false, owned: true, reason: 'Owned' };
    if (u.level && !(d.levels[u.level] && d.levels[u.level].done)) {
      return { ok: false, reason: u.reward ? `Awarded for completing Mission ${u.level}` : `Complete Mission ${u.level} first` };
    }
    if (u.stars && this.totalStars() < u.stars) return { ok: false, reason: `Requires ${u.stars} stars (you have ${this.totalStars()})` };
    if (d.coins < u.price) return { ok: false, reason: `Need ${u.price - d.coins} more coins`, short: true };
    return { ok: true };
  }
  buyAircraft(id) {
    const st = this.unlockStatus(id);
    if (!st.ok) return st;
    this.data.coins -= AIRCRAFT_BY_ID[id].unlock.price;
    this.grant(id);
    return { ok: true };
  }
  grant(id) {
    if (this.isOwned(id)) return false;
    this.data.aircraft[id] = { owned: true, up: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) };
    this.save.save();
    return true;
  }
  select(id) {
    if (!this.isOwned(id)) return false;
    this.data.selected = id;
    this.save.save();
    return true;
  }
  upgradeInfo(id, upId) {
    const level = this.levelOf(id, upId);
    const maxed = level >= MAX_UPGRADE;
    const cost = maxed ? 0 : upgradeCost(AIRCRAFT_BY_ID[id].tier, level + 1);
    return { level, maxed, cost, affordable: !maxed && this.data.coins >= cost };
  }
  buyUpgrade(id, upId) {
    if (!this.isOwned(id)) return { ok: false, reason: 'Unlock this aircraft first' };
    const info = this.upgradeInfo(id, upId);
    if (info.maxed) return { ok: false, reason: 'Already at maximum level' };
    if (!info.affordable) return { ok: false, reason: `Need ${info.cost - this.data.coins} more coins` };
    this.data.coins -= info.cost;
    this.data.aircraft[id].up[upId] = info.level + 1;
    this.save.save();
    return { ok: true, level: info.level + 1 };
  }
  ownedCount() { return AIRCRAFT.filter((a) => this.isOwned(a.id)).length; }
}
