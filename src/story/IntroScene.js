// Opening cinematic on a tiny spinning planet. Phoenix jets orbit it trailing
// contrails, Crimson jets cut across, three story lines fade in, the camera
// dives toward the surface and the logo slams in. The same planet (without
// the story) spins behind the loading screen.
import { getSprite, drawSprite } from '../art/PlaneArt.js';
import { PLAYER_ART, ENEMY_ART } from '../art/planeSpecs.js';
import { AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { glowSprite } from '../systems/Cinema.js';
import { Globe } from './Globe.js';
import { clamp, TAU } from '../core/utils.js';

export const INTRO_LEN = 8.6;
const ease = (t) => t * t * (3 - 2 * t);

export class IntroScene {
  constructor(game) {
    this.game = game; this.globe = null; this.t = 0; this.idleT = 0;
    this.stars = Array.from({ length: 90 }, (_, i) => ({ x: (i * 0.618) % 1, y: (i * 0.3819 * 7) % 1, s: 0.6 + (i % 3) * 0.5, p: i }));
  }
  _ensure() {
    if (this.globe) return;
    const small = Math.min(window.innerWidth, window.innerHeight) < 500;
    this.globe = new Globe(small ? 220 : 320);
    const sel = this.game.save.data.selected;
    const jet = (kind, id, i, team) => {
      const art = kind === 'p' ? PLAYER_ART[id] : ENEMY_ART[id];
      return { spr: getSprite((kind === 'p' ? 'p_' : 'e_') + id + '_mini', art, 16), team,
        rf: 1.14 + (i % 3) * 0.07, inc: (team ? -0.9 : 0.5) + i * 0.16, ph: i * 0.55 + (team ? 3 : 0), sp: (team ? -0.42 : 0.36) * (1 + i * 0.05), trail: [] };
    };
    this.jets = [
      ...[sel, 'warden', 'wisp', 'streak'].map((id, i) => jet('p', (AIRCRAFT_BY_ID[id] || AIRCRAFT_BY_ID.ember).id, i, 0)),
      ...['fighter', 'interceptor', 'elite'].map((id, i) => jet('e', id, i, 1)),
    ];
  }
  start() { this._ensure(); this.t = 0; this.boomed = false; this.flash = 0; for (const j of this.jets) j.trail.length = 0; }

  /** Loading screen: the planet just spins. */
  idle(dt) { this._ensure(); this.idleT += dt; this._fly(dt, this.idleT, false); }
  update(dt) {
    this.t += dt;
    this._fly(dt, this.t, true);
    if (this.t > 5.9 && !this.boomed) { this.boomed = true; this.flash = 1; this.game.audio.sfx('bossBoom'); this.game.audio.sfx('fight'); }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);
    return this.t >= INTRO_LEN;
  }
  _fly(dt, t, story) {
    for (const j of this.jets) {
      if (story && j.team === 1 && t < 2.4) continue;            // Crimson arrives with the second line
      j.ph += j.sp * dt;
    }
  }
  /** 3D orbit position on a unit sphere scaled by rf, inclined by inc. */
  _pos(j, a) {
    const x = Math.cos(a) * j.rf, z = Math.sin(a) * j.rf;
    const ci = Math.cos(j.inc), si = Math.sin(j.inc);
    return { x, y: -z * si, z: z * ci };
  }

  render(ctx, loading = false) {
    const v = this.game.view, w = v.w, h = v.h, t = loading ? this.idleT : this.t;
    this._ensure();
    // deep sky with stars and a sun
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1230'); sky.addColorStop(0.55, '#24306a'); sky.addColorStop(1, '#e58f74');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    for (const s of this.stars) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + s.p); ctx.beginPath(); ctx.arc(s.x * w, s.y * h * 0.75, s.s, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    const sr = Math.max(w, h) * 0.6;
    ctx.globalAlpha = 0.5; ctx.drawImage(glowSprite('255,200,150'), w * 0.08 - sr / 2, h * 0.12 - sr / 2, sr, sr); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // camera: hold, then dive toward the planet
    const base = Math.min(w, h) * (loading ? 0.3 : 0.32);
    const dive = loading ? 0 : ease(clamp((t - 4.6) / 1.6, 0, 1));
    const R = base * (1 + dive * 1.6), cx = w / 2, cy = h * (loading ? 0.6 : 0.5) + dive * R * 0.55;
    const rot = t * 0.035, crot = t * 0.05;
    // jets behind the planet first, then the planet, then jets in front
    const pts = this.jets.map((j) => {
      const p = this._pos(j, j.ph);
      const p2 = this._pos(j, j.ph + 0.02 * Math.sign(j.sp));
      const sx = cx + p.x * R, sy = cy + p.y * R;
      j.trail.push({ x: p.x, y: p.y, z: p.z });
      if (j.trail.length > 26) j.trail.shift();
      return { j, sx, sy, z: p.z, a: Math.atan2((p2.y - p.y), (p2.x - p.x)), s: 1 + p.z * 0.18 };
    });
    const visible = (p) => loading || p.j.team === 0 || t >= 2.4;
    this._trails(ctx, cx, cy, R, false, visible);
    for (const p of pts) if (p.z < 0 && visible(p)) this._jet(ctx, p, R);
    this.globe.draw(ctx, cx, cy, R, rot, crot);
    this._trails(ctx, cx, cy, R, true, visible);
    for (const p of pts) if (p.z >= 0 && visible(p)) this._jet(ctx, p, R);
    // letterbox + fades
    if (!loading) {
      const lb = t < 6 ? 1 : clamp(1 - (t - 6) / 1.5, 0, 1), bh = lb * h * 0.085;
      ctx.fillStyle = '#05040A'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh);
      if (t < 0.8) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.8})`; ctx.fillRect(0, 0, w, h); }
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.8})`; ctx.fillRect(0, 0, w, h); }
    }
  }
  _trails(ctx, cx, cy, R, front, visible) {
    ctx.lineCap = 'round';
    for (const j of this.jets) {
      if (!visible({ j })) continue;
      const tr = j.trail;
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i];
        if ((b.z >= 0) !== front) continue;
        const k = i / tr.length;
        ctx.strokeStyle = j.team ? `rgba(255,150,140,${0.6 * k})` : `rgba(255,255,255,${0.7 * k})`;
        ctx.lineWidth = Math.max(1, R * 0.012 * k);
        ctx.beginPath(); ctx.moveTo(cx + a.x * R, cy + a.y * R); ctx.lineTo(cx + b.x * R, cy + b.y * R); ctx.stroke();
      }
    }
  }
  _jet(ctx, p, R) {
    const sc = (R / 160) * p.s * 0.9;
    ctx.save(); ctx.translate(p.sx, p.sy); ctx.scale(sc, sc);
    drawSprite(ctx, p.j.spr, 0, 0, p.a, 0, p.z < 0 ? 0.75 : 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowSprite(p.j.team ? '255,120,100' : '255,180,100'), -Math.cos(p.a) * 18 - 10, -Math.sin(p.a) * 18 - 10, 20, 20);
    ctx.restore();
  }
}
