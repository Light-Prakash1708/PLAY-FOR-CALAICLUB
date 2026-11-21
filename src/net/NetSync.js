// Keeps two copies of a Team Battle in step.
//
// The HOST runs the real match: bots, damage, kills, zone, crates, score and clock.
// The GUEST flies its own jet locally, so its controls feel instant, and sends its
// position and trigger presses. Everything else on the guest copy follows the
// host's snapshots (20 a second) and events such as kills, respawns, refills and
// the final whistle. Bullets and missiles are re-created on each side from the
// shots, so tracers look right on both screens. Only the host's hits count.
import { clamp, angDiff } from '../core/utils.js';

const SNAP_EVERY = 0.05;     // host -> guest snapshots
const INPUT_EVERY = 0.033;   // guest -> host pilot state
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

export class NetSync {
  constructor(world, net, opts) {
    this.w = world; this.net = net;
    this.host = net.isHost;
    this.mode = opts.mode;                 // 'coop' | 'versus'
    this.remoteIdx = this.host ? 1 : 0;    // fighters[0] = host pilot, fighters[1] = guest pilot
    this.localIdx = this.host ? 0 : 1;
    this.sendT = 0;
    this.last = null; this.lastAt = 0;     // guest: latest snapshot
    this.rin = null; this.rinAt = 0;       // host: latest guest input
    this.used = { m: 0, s: 0, l: 0, b: 0 }; // one-shot counters already applied
    this.cnt = { m: 0, s: 0, l: 0, b: 0 };  // guest: one-shot counters pressed
    this.fl = [];                          // guest: per-fighter missile/flare counters seen
    this.left = false;
  }
  get remote() { return this.w.fighters[this.remoteIdx]; }
  get local() { return this.w.fighters[this.localIdx]; }

  // ---------------------------------------------------------------- incoming
  onData(d) {
    const w = this.w;
    switch (d.t) {
      case 'in': if (this.host) { this.rin = d; this.rinAt = performance.now(); } break;
      case 's': if (!this.host) { this.last = d; this.lastAt = performance.now(); this._applyShared(d); } break;
      case 'k': if (!this.host) { const v = w.fighters[d.v], k = d.k >= 0 ? w.fighters[d.k] : null; if (v && v.alive) w.killFighter(v, k, d.how, true); } break;
      case 'r': if (!this.host) { const f = w.fighters[d.i]; if (f) w._respawnAt(f, d.x, d.y, d.a); } break;
      case 'c': if (!this.host) w._crateFx(w.fighters[d.i], d.x, d.y, d.kind); break;
      case 'z': if (!this.host) w._zoneEvent(d.ev); break;
      case 'sd': if (!this.host) { w.mode = { ...w.mode, killTarget: d.kt }; w._suddenDeath(true); } break;
      case 'end':
        if (!this.host) {
          d.b.forEach((s, i) => { const f = w.fighters[i]; if (f) { f.kills = s[0]; f.deaths = s[1]; f.assists = s[2]; } });
          w.score = d.sc; w._end(d.w, true);
        }
        break;
    }
  }

  // ---------------------------------------------------------------- per frame
  /** Command for a fighter driven by the network (host: the guest's jet; guest: everyone else). */
  remoteCmd(f, i, dt) {
    const w = this.w;
    if (this.host) {
      const d = this.rin;
      if (!d) return { steer: false, angle: f.a, throttle: 0.6 };
      const cmd = { steer: true, angle: d.a, throttle: d.th, fire: !!d.f };
      for (const k of ['m', 's', 'l', 'b']) if (d[k] > this.used[k]) { this.used[k] = d[k]; cmd[{ m: 'missile', s: 'shield', l: 'flare', b: 'boost' }[k]] = true; }
      return cmd;
    }
    const s = this.last && this.last.f[i];
    if (!s) return { steer: false, angle: f.a, throttle: 0.6 };
    const seen = this.fl[i] || (this.fl[i] = { m: s[9], l: s[10] });
    const cmd = { steer: true, angle: s[2], throttle: 0.7, fire: !!(s[7] & 1) };
    if (s[9] > seen.m) { seen.m = s[9]; cmd.missile = true; }
    if (s[10] > seen.l) { seen.l = s[10]; cmd.flare = true; }
    if ((s[7] & 2) && !f.boosting) cmd.boost = true;
    if ((s[7] & 4) && f.shieldT <= 0) cmd.shield = true;
    return cmd;
  }

  /** After the fighter moved itself: pull it onto the authoritative position. */
  correct(f, i, dt) {
    let x, y, a, sp, age;
    if (this.host) {
      const d = this.rin; if (!d) return;
      x = d.x; y = d.y; a = d.a; sp = d.sp; age = (performance.now() - this.rinAt) / 1000;
    } else {
      const s = this.last && this.last.f[i]; if (!s || !s[5]) return;
      x = s[0]; y = s[1]; a = s[2]; sp = s[3]; age = (performance.now() - this.lastAt) / 1000;
    }
    age = Math.min(age, 0.25);
    const tx = x + Math.cos(a) * sp * age, ty = y + Math.sin(a) * sp * age;
    const dx = tx - f.x, dy = ty - f.y;
    if (dx * dx + dy * dy > 260 * 260) { f.x = tx; f.y = ty; f.trail.reset(); }
    else { const k = Math.min(1, dt * 9); f.x += dx * k; f.y += dy * k; }
    f.a += angDiff(f.a, a) * Math.min(1, dt * 10);
    f.speed = sp;
    // the host owns health and kills for everybody
    if (!this.host) { const s = this.last.f[i]; f.hp = s[4]; f.invuln = s[8] ? 1 : 0; }
  }

  /** Guest: things the host owns that aren't per-fighter. */
  _applyShared(d) {
    const w = this.w, z = w.zone;
    z.cx = d.z[0]; z.cy = d.z[1]; z.r = d.z[2]; z.state = d.z[3]; z.t = d.z[4]; z.phase = d.z[5];
    z.next = d.z[6] ? { cx: d.z[6][0], cy: d.z[6][1], r: d.z[6][2] } : null;
    w.score = d.sc; w.roundT = d.rt; w.sudden = !!d.sd; w.suddenT = d.st;
    w.crates = d.cr.map((c) => ({ x: c[0], y: c[1], kind: c[2] ? 'repair' : 'ammo', t: c[3], life: 20 }));
    d.f.forEach((s, i) => { const f = w.fighters[i]; if (f) { f.kills = s[11]; f.deaths = s[12]; f.assists = s[13]; if (i === this.localIdx) f.hp = s[4]; } });
  }

  /** Runs once per frame after the world update. */
  tick(dt) {
    const w = this.w;
    if (!this.net.connected) return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    if (this.host) {
      this.sendT = SNAP_EVERY;
      const z = w.zone;
      this.net.send({
        t: 's',
        f: w.fighters.map((f) => [r1(f.x), r1(f.y), r3(f.a), Math.round(f.speed), Math.round(f.hp), f.alive ? 1 : 0, +(f.shieldT > 0), (f.firing ? 1 : 0) | (f.boosting ? 2 : 0) | (f.shieldT > 0 ? 4 : 0), f.invuln > 0 ? 1 : 0, f.mShots | 0, f.fShots | 0, f.kills, f.deaths, f.assists]),
        z: [r1(z.cx), r1(z.cy), r1(z.r), z.state, r1(z.t), z.phase, z.next ? [r1(z.next.cx), r1(z.next.cy), r1(z.next.r)] : 0],
        sc: w.score, rt: r1(w.roundT), sd: w.sudden ? 1 : 0, st: r1(w.suddenT || 0),
        cr: w.crates.map((c) => [r1(c.x), r1(c.y), c.kind === 'repair' ? 1 : 0, r1(c.t)]),
      });
    } else {
      this.sendT = INPUT_EVERY;
      const f = this.local;
      if (!f.alive || w.phase !== 'play') return;
      const c = this.cnt;
      this.net.send({ t: 'in', x: r1(f.x), y: r1(f.y), a: r3(f.a), sp: Math.round(f.speed), th: f.lastThrottle == null ? 0.7 : f.lastThrottle, f: f.firing ? 1 : 0, m: c.m, s: c.s, l: c.l, b: c.b });
    }
  }
  /** Guest: remember one-shot presses so none get lost between packets. */
  noteCmd(cmd) {
    if (cmd.missile) this.cnt.m++;
    if (cmd.shield) this.cnt.s++;
    if (cmd.flare) this.cnt.l++;
    if (cmd.boost) this.cnt.b++;
  }

  // host-side event broadcasts
  sendKill(v, k, how) { this.net.send({ t: 'k', v: this.w.fighters.indexOf(v), k: k ? this.w.fighters.indexOf(k) : -1, how }); }
  sendRespawn(f) { this.net.send({ t: 'r', i: this.w.fighters.indexOf(f), x: r1(f.x), y: r1(f.y), a: r3(f.a) }); }
  sendCrate(f, c) { this.net.send({ t: 'c', i: this.w.fighters.indexOf(f), x: r1(c.x), y: r1(c.y), kind: c.kind }); }
  sendZone(ev) { this.net.send({ t: 'z', ev }); }
  sendSudden(kt) { this.net.send({ t: 'sd', kt }); }
  sendEnd(winner) { const w = this.w; this.net.send({ t: 'end', w: winner, sc: w.score, b: w.fighters.map((f) => [f.kills, f.deaths, f.assists]) }); }
  inputAge() { return this.host ? (performance.now() - this.rinAt) / 1000 : (performance.now() - this.lastAt) / 1000; }
}

export { clamp };
