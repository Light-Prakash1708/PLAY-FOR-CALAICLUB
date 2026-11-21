// Mission results, star ratings, coin payouts, pilot XP and daily rewards.
import { CONFIG } from '../core/GameConfig.js';
import { LEVEL_COUNT } from '../data/levels.js';

export const DAILY_REWARDS = [50, 75, 100, 150, 200, 250, 400];
const RANKS = ['Cadet', 'Airman', 'Wingman', 'Flight Leader', 'Captain', 'Squadron Leader', 'Wing Commander', 'Ace', 'Sky Legend'];

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export class RewardManager {
  constructor(save, upgrades) { this.save = save; this.upgrades = upgrades; }
  get data() { return this.save.data; }

  /** 1 star: mission complete. 2: at least 40% health left. 3: 70% health and under par time. */
  rate(level, stats) {
    const hp = stats.hpLeft / stats.hpMax;
    if (hp >= 0.7 && stats.time <= level.par) return 3;
    if (hp >= 0.4) return 2;
    return 1;
  }

  /**
   * Applies a finished mission to the save exactly once. `stats` carries a
   * `settled` flag so a second call (double trigger, replay button spam)
   * can never pay out twice.
   */
  settle(level, stats, won) {
    if (stats.settled) return stats.result;
    stats.settled = true;
    const d = this.data;
    const prev = d.levels[level.id] || { stars: 0, best: 0, done: false };
    const r = { won, score: stats.score, kills: stats.kills, time: stats.time, missionCoins: stats.coins,
      levelReward: 0, flawless: 0, starBonus: 0, stars: 0, firstClear: false, newBest: false, unlocked: null, pickupStars: stats.stars };
    if (won) {
      r.stars = this.rate(level, stats);
      r.firstClear = !prev.done;
      r.levelReward = r.firstClear ? level.reward : Math.round(level.reward * CONFIG.REPLAY_REWARD);
      if (stats.damageTaken === 0) r.flawless = Math.round(level.reward * 0.25);
      // each rating star pays once per level, the first time it is earned
      r.starBonus = Math.max(0, r.stars - prev.stars) * 25;
      r.total = r.missionCoins + r.levelReward + r.flawless + r.starBonus;
      r.newBest = stats.score > prev.best;
      d.levels[level.id] = { stars: Math.max(prev.stars, r.stars), best: Math.max(prev.best, stats.score), done: true };
      if (level.id < LEVEL_COUNT) d.unlockedLevel = Math.max(d.unlockedLevel, level.id + 1);
      if (level.unlocks && this.upgrades.grant(level.unlocks)) r.unlocked = level.unlocks;
      d.stats.missions++;
      delete d.fails[level.id];
    } else {
      d.fails[level.id] = Math.min(3, (d.fails[level.id] || 0) + 1);
      r.assist = d.fails[level.id];
      r.total = Math.round(stats.coins * CONFIG.FAIL_COIN_KEEP);
      if (stats.score > prev.best) { d.levels[level.id] = { ...prev, best: stats.score }; r.newBest = true; }
    }
    d.coins += r.total;
    d.stats.kills += stats.kills;
    d.stats.starsCollected += stats.stars;
    const before = this.pilot().level;
    d.stats.xp += Math.round(stats.score / 10) + (won ? 100 : 20);
    r.levelUp = this.pilot().level > before;
    this.save.save();
    stats.result = r;
    return r;
  }

  pilot() {
    const xp = this.data.stats.xp;
    const level = Math.floor(Math.sqrt(xp / 120)) + 1;
    const cur = 120 * (level - 1) ** 2, next = 120 * level ** 2;
    return { level, rank: RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))], progress: (xp - cur) / (next - cur) };
  }

  dailyStatus() {
    const d = this.data.daily, today = dayKey();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const claimed = d.last === today;
    const streakAlive = d.last === dayKey(y) || claimed;
    const streak = streakAlive ? d.streak : 0;
    const index = claimed ? (streak - 1) % 7 : streak % 7; // day shown as "today"
    return { claimed, streak, index, amount: DAILY_REWARDS[index] };
  }
  claimDaily() {
    const st = this.dailyStatus();
    if (st.claimed) return null;
    this.data.daily = { last: dayKey(), streak: st.streak + 1 };
    this.data.coins += st.amount;
    this.save.save();
    return st.amount;
  }
}
