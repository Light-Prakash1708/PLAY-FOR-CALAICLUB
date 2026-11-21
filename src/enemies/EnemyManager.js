// Owns the enemy pool: spawning (singles and formations), updates, queries.
import { ObjectPool } from '../systems/ObjectPool.js';
import { Enemy } from './Enemy.js';
import { updateEnemy } from './EnemyAI.js';
import { bossInit } from './Boss.js';
import { ENEMIES } from '../data/enemies.js';

const FORMATIONS = {
  // slot offsets (behind, sideways) relative to the leader
  v: (i) => { const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; return [-row * 44, side * row * 40]; },
  line: (i) => { const col = Math.ceil(i / 2), side = i % 2 ? 1 : -1; return [-col * 6, side * col * 50]; },
};

export class EnemyManager {
  constructor() {
    this.pool = new ObjectPool(() => new Enemy(), 48);
    this.list = this.pool.active;
    this.uid = 1;
    this.formId = 1;
  }
  reset() { this.pool.clear(); }

  spawn(type, x, y, a) {
    const def = ENEMIES[type];
    const e = this.pool.obtain();
    if (!e) return null;
    e.reset(def, x, y, a, this.uid++);
    if (def.boss) bossInit(e);
    return e;
  }
  /** Spawns a leader plus followers that hold slots. Returns the members. */
  spawnFormation(type, n, shape, x, y, a) {
    const leader = this.spawn(type, x, y, a);
    if (!leader) return [];
    const id = this.formId++;
    const members = [leader];
    leader.formId = id;
    const slot = FORMATIONS[shape] || FORMATIONS.v;
    const c = Math.cos(a), s = Math.sin(a);
    for (let i = 1; i < n; i++) {
      const [sx, sy] = slot(i);
      const f = this.spawn(type, x + c * sx - s * sy, y + s * sx + c * sy, a);
      if (!f) break;
      f.leader = leader; f.leaderUid = leader.uid; f.slotX = sx; f.slotY = sy; f.slot = i; f.formId = id;
      members.push(f);
    }
    return members;
  }

  update(dt, world) {
    const a = this.list;
    for (let i = 0; i < a.length; i++) { const e = a[i]; if (e.alive && !e.dying) updateEnemy(e, dt, world); }
    // light separation so aircraft do not stack on one another
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (!e.alive || e.leader || e.def.boss) continue;
      for (let j = i + 1; j < a.length; j++) {
        const o = a[j];
        if (!o.alive || o.leader || o.def.boss) continue;
        const dx = o.x - e.x, dy = o.y - e.y, min = (e.r + o.r) * 1.1, d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5 * Math.min(1, dt * 6);
          e.x -= (dx / d) * push; e.y -= (dy / d) * push; o.x += (dx / d) * push; o.y += (dy / d) * push;
        }
      }
    }
    this.pool.sweep();
  }

  count(includeBoss = false) {
    let n = 0;
    for (const e of this.list) if (e.alive && !e.dying && (includeBoss || !e.def.boss)) n++;
    return n;
  }
  nearest(x, y, range, skipCloaked) {
    let best = null, bd = range * range;
    for (const e of this.list) {
      if (!e.alive || e.dying || (skipCloaked && e.cloaked)) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  boss() { for (const e of this.list) if (e.alive && e.def.boss) return e; return null; }
}
