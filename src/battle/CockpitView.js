// First-person cockpit view for Team Battle. The simulation stays 2D; this
// renders it in perspective: a Mode-7 style ground plane under a sky
// gradient, other jets drawn as 3D-looking silhouettes at their projected
// position, tracers, missiles, explosions, the storm wall, then a canopy
// frame, instruments and a gunsight on top.
import { clamp, angDiff, TAU } from '../core/utils.js';
import { pickupSprite } from '../combat/Pickup.js';
import { glowSprite } from '../systems/Cinema.js';
import { BATTLE, TEAMS } from './battleData.js';

const GROUND_K = 0.3;        // world units -> ground-tile units (the ground is far below, so it moves slower than the jets)
const TILE_SS = 1.5;         // terrain tiles are painted at 1.5x

export class CockpitView {
  constructor() { this.m = typeof DOMMatrix !== 'undefined' ? new DOMMatrix() : null; this.pattern = null; this.patSrc = null; }

  render(ctx, world, w, h, f) {
    const bg = world.bg, th = bg.theme, F = Math.max(w * 0.62, h * 0.48);
    const hy = h * 0.42, roll = -f.bank * 0.22 + (f.wobble > 0 ? Math.sin(f.t * 60) * 0.03 * f.wobble : 0);
    const q = world.quality.particles;
    ctx.save();
    const bob = Math.sin(world.time * 1.3) * 2 + Math.sin(world.time * 3.1) * 0.8;   // light turbulence
    ctx.translate(w / 2 + world.vfx.sx, hy + world.vfx.sy + bob); ctx.rotate(roll); ctx.translate(-w / 2, -hy);
    const ext = Math.hypot(w, h);                       // draw past the edges so the roll never shows a gap
    // sky
    const sky = ctx.createLinearGradient(0, hy - h * 0.6, 0, hy);
    sky.addColorStop(0, th.top); sky.addColorStop(1, th.bottom);
    ctx.fillStyle = sky; ctx.fillRect(-ext, hy - ext, w + ext * 2, ext);
    this._ground(ctx, world, f, w, h, hy, F, ext, q);
    // haze along the horizon
    const fog = ctx.createLinearGradient(0, hy - 24, 0, hy + h * 0.18);
    fog.addColorStop(0, th.bottom); fog.addColorStop(0.25, th.bottom); fog.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = th.dark ? 0.55 : 0.8; ctx.fillStyle = fog; ctx.fillRect(-ext, hy - 24, w + ext * 2, h * 0.18 + 24); ctx.globalAlpha = 1;
    this._world(ctx, world, f, w, h, hy, F);
    ctx.restore();
    this._cockpit(ctx, world, f, w, h, hy, F, roll);
  }

  _ground(ctx, world, f, w, h, hy, F, ext, q) {
    const tile = world.bg.ground;
    if (!tile || !this.m) { ctx.fillStyle = '#3a6a8a'; ctx.fillRect(-ext, hy, w + ext * 2, ext); return; }
    if (this.patSrc !== tile) { this.pattern = ctx.createPattern(tile, 'repeat'); this.patSrc = tile; }
    const pat = this.pattern, m = this.m;
    const ca = Math.cos(f.a), sa = Math.sin(f.a);
    const fx = ca, fy = sa, rx = -sa, ry = ca;                // forward / right in ground space
    const cx = f.x * GROUND_K, cy = f.y * GROUND_K;
    const step = q >= 0.7 ? 2 : 3, bottom = hy + ext;
    const GROUND_H = Math.max(120, (h - hy) / 2.4);          // keeps texture magnification ~2.4x at the bottom on any screen
    ctx.fillStyle = pat;
    for (let y = hy + 1; y < bottom; y += step) {
      const dy = y - hy + step * 0.5;
      const d = (GROUND_H * F) / dy;                          // ground distance seen on this row
      const s = F / d, kk = (dy * dy) / (GROUND_H * F);
      const Cx = cx + fx * d, Cy = cy + fy * d;               // ground point at screen centre of the row
      m.a = (s * rx) / TILE_SS; m.c = (s * ry) / TILE_SS;
      m.b = (kk * fx) / TILE_SS; m.d = (kk * fy) / TILE_SS;
      m.e = w / 2 - s * (rx * Cx + ry * Cy);
      m.f = y + step * 0.5 - kk * (fx * Cx + fy * Cy);
      pat.setTransform(m);
      ctx.fillRect(-ext, y, w + ext * 2, step + 0.6);
    }
    if (world.bg.theme.tint) { ctx.fillStyle = world.bg.theme.tint; ctx.fillRect(-ext, hy, w + ext * 2, ext); }
  }

  /** Projects a world point (+ altitude) into the view. Returns null when behind. */
  _proj(f, x, y, alt, w, hy, F) {
    const dx = x - f.x, dy = y - f.y, ca = Math.cos(f.a), sa = Math.sin(f.a);
    const fwd = dx * ca + dy * sa, right = -dx * sa + dy * ca;
    if (fwd < 18) return null;
    const s = F / fwd;
    return { x: w / 2 + right * s, y: hy - alt * s, s, fwd, right };
  }

  _world(ctx, world, f, w, h, hy, F) {
    const items = [];
    const z = world.zone;
    // storm wall: a curtain along the zone edge
    const N = 72;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, x = z.cx + Math.cos(a) * z.r, y = z.cy + Math.sin(a) * z.r;
      const p = this._proj(f, x, y, 0, w, hy, F);
      // skip segments right on top of the camera: they would fill the screen with a flat slab
      if (p && prev && p.fwd > 90 && prev.fwd > 90 && Math.abs(p.x - prev.x) < w * 1.5) items.push({ k: 'wall', fwd: (p.fwd + prev.fwd) / 2, a: prev, b: p });
      prev = p;
    }
    // clouds (billboards on a fixed grid around the player)
    const spr = world.bg.sprites;
    if (spr.length) {
      const G = 700, gx = Math.floor(f.x / G), gy = Math.floor(f.y / G);
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
        const hsh = Math.abs(((gx + i) * 73856093) ^ ((gy + j) * 19349663)) % 997;
        if (hsh % 2) continue;
        const x = (gx + i) * G + (hsh % 400), y = (gy + j) * G + ((hsh * 7) % 400), alt = hsh % 4 === 0 ? 70 + (hsh % 60) : -(110 + (hsh % 70));   // mostly a cumulus deck below you
        const p = this._proj(f, x, y, alt, w, hy, F);
        if (p && p.fwd < 2600) items.push({ k: 'cloud', fwd: p.fwd, p, img: spr[hsh % spr.length], sz: 2.4 + (hsh % 3) });
      }
    }
    for (const o of world.fighters) {
      if (!o.alive || o === f) continue;
      const alt = Math.sin(o.uid * 1.7) * 26 + Math.sin(world.time * 0.9 + o.uid) * 8;
      const p = this._proj(f, o.x, o.y, alt, w, hy, F);
      if (p) items.push({ k: 'jet', fwd: p.fwd, p, o });
    }
    for (const c of world.crates) { const p = this._proj(f, c.x, c.y, -10, w, hy, F); if (p) items.push({ k: 'crate', fwd: p.fwd, p, c }); }
    for (const m of world.missiles.pool.active) { if (!m.alive) continue; const p = this._proj(f, m.x, m.y, 0, w, hy, F); if (p) items.push({ k: 'missile', fwd: p.fwd, p, m }); }
    for (const g of world.glows) { const p = this._proj(f, g.x, g.y, 0, w, hy, F); if (p) items.push({ k: 'glow', fwd: p.fwd, p, g }); }
    items.sort((a, b) => b.fwd - a.fwd);
    for (const it of items) {
      const p = it.p;
      switch (it.k) {
        case 'wall': {
          const ha = Math.min(h, 260 * it.a.s), hb = Math.min(h, 260 * it.b.s);
          ctx.fillStyle = `rgba(${world.map.zone},${(0.22 * clamp((it.fwd - 90) / 200, 0, 1)).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(it.a.x, hy - ha); ctx.lineTo(it.b.x, hy - hb); ctx.lineTo(it.b.x, hy + hb * 0.6); ctx.lineTo(it.a.x, hy + ha * 0.6); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(it.a.x, hy - ha); ctx.lineTo(it.b.x, hy - hb); ctx.stroke();
          break;
        }
        case 'cloud': {
          const sw = it.img.width * p.s * it.sz * 0.35, sh = it.img.height * p.s * it.sz * 0.35;
          ctx.globalAlpha = clamp(1 - p.fwd / 2600, 0, 0.85) * (p.fwd < 160 ? p.fwd / 160 : 1);
          ctx.drawImage(it.img, p.x - sw / 2, p.y - sh / 2, sw, sh);
          ctx.globalAlpha = 1;
          break;
        }
        case 'jet': this._jet(ctx, world, f, it.o, p); break;
        case 'crate': { const s = 40 * p.s; ctx.drawImage(pickupSprite(it.c.kind === 'ammo' ? 'missile' : 'health'), p.x - s / 2, p.y - s / 2, s, s); break; }
        case 'missile': {
          const s = Math.max(2, 7 * p.s);
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite('255,180,90'), p.x - s * 3, p.y - s * 3, s * 6, s * 6);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.6, 0, TAU); ctx.fill();
          break;
        }
        case 'glow': {
          const g = it.g, k = g.life / g.max, r = g.r * p.s * 1.4;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
          ctx.drawImage(glowSprite(g.rgb), p.x - r, p.y - r, r * 2, r * 2);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          break;
        }
      }
    }
    // tracers
    ctx.lineCap = 'round';
    for (const b of world.bullets.pool.active) {
      if (!b.alive) continue;
      const p1 = this._proj(f, b.x, b.y, 0, w, hy, F), p2 = this._proj(f, b.x - b.vx * 0.03, b.y - b.vy * 0.03, 0, w, hy, F);
      if (!p1 || !p2) continue;
      ctx.strokeStyle = TEAMS[b.team].tracer[1]; ctx.lineWidth = Math.max(1.5, 3 * p1.s);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
  }

  /** A jet seen in perspective: wings, fuselage, fin, engine glow or canopy depending on which way it faces. */
  _jet(ctx, world, f, o, p) {
    const s = p.s, span = o.size * 1.25 * s, rel = angDiff(f.a, o.a);
    const away = Math.cos(rel), side = Math.sin(rel);
    const roll = -o.bank * 0.6 * Math.sign(away || 1), col = TEAMS[o.team];
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(roll);
    const flash = o.hitT > 0;
    // wings
    ctx.fillStyle = flash ? '#FFFFFF' : o.art.colors.wing || '#8a8f98';
    ctx.beginPath(); ctx.moveTo(-span, span * 0.06); ctx.lineTo(0, -span * 0.12); ctx.lineTo(span, span * 0.06); ctx.lineTo(0, span * 0.16); ctx.closePath(); ctx.fill();
    // team-coloured wingtips
    ctx.fillStyle = col.main;
    ctx.fillRect(-span, span * 0.02, span * 0.18, span * 0.08); ctx.fillRect(span * 0.82, span * 0.02, span * 0.18, span * 0.08);
    // fuselage, foreshortened by how side-on it is
    const len = Math.max(span * 0.22, Math.abs(side) * span * 0.9);
    ctx.fillStyle = flash ? '#FFFFFF' : o.art.colors.body || '#b5bac3';
    ctx.beginPath(); ctx.ellipse(side * span * 0.12, 0, len, span * 0.14, 0, 0, TAU); ctx.fill();
    // tail fin
    ctx.fillStyle = flash ? '#FFFFFF' : o.art.colors.accent || col.main;
    ctx.beginPath(); ctx.moveTo(-side * span * 0.35 - span * 0.05, 0); ctx.lineTo(-side * span * 0.35, -span * 0.42); ctx.lineTo(-side * span * 0.35 + span * 0.08, 0); ctx.closePath(); ctx.fill();
    if (away > 0) {   // flying away: engine glow
      const g = span * (o.boosting ? 0.5 : 0.3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite('255,160,70'), -g, -g, g * 2, g * 2);
      ctx.globalCompositeOperation = 'source-over';
    } else {          // coming at you: canopy glint
      ctx.fillStyle = '#9FE3FF'; ctx.beginPath(); ctx.ellipse(side * span * 0.2, -span * 0.06, span * 0.1, span * 0.06, 0, 0, TAU); ctx.fill();
    }
    if (o.shieldT > 0) { ctx.strokeStyle = 'rgba(190,240,255,0.8)'; ctx.lineWidth = Math.max(1.5, 3 * s); ctx.beginPath(); ctx.arc(0, 0, span * 1.15, 0, TAU); ctx.stroke(); }
    ctx.restore();
    // smoke from damaged jets
    if (o.hp < o.maxHp * 0.5) { ctx.fillStyle = 'rgba(60,55,55,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y + span * 0.1, span * 0.5, 0, TAU); ctx.fill(); }
    // marker + tag (always, the view is busy and they are small)
    if (p.fwd < 1400) {
      const ty = p.y - span * 0.7 - 6;
      ctx.strokeStyle = col.main; ctx.lineWidth = 2;
      const b = Math.max(8, span * 0.9);
      if (o.team !== f.team) ctx.strokeRect(p.x - b, p.y - b * 0.6, b * 2, b * 1.2);
      ctx.font = '12px "Bebas Neue", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = col.light; ctx.fillText(`${o.tag} ${Math.round(p.fwd / 10)}m`, p.x, Math.min(ty, p.y - b * 0.6 - 2));
    }
  }

  _cockpit(ctx, world, f, w, h, hy, F, roll) {
    const G = '#7CFF9E', Gd = 'rgba(124,255,158,0.55)';
    const dt = Math.max(1e-3, world.time - (this.lastT || world.time - 0.016));
    const turn = Math.abs(angDiff(this.lastA === undefined ? f.a : this.lastA, f.a)) / dt;
    this.lastA = f.a; this.lastT = world.time;
    this.g = (this.g || 1) + ((1 + turn * 2.4 + (f.boosting ? 0.6 : 0)) - (this.g || 1)) * Math.min(1, dt * 4);
    const cx = w / 2, hw = Math.max(60, Math.min(w * 0.36, 230, w / 2 - 72)), top = hy - Math.min(h * 0.3, 200), bot = hy + Math.min(h * 0.22, 150);
    const fs = Math.max(11, Math.min(15, w / 60));
    ctx.save();
    ctx.lineWidth = 1.6; ctx.strokeStyle = G; ctx.fillStyle = G;
    ctx.font = `${fs}px "Bebas Neue", Impact, sans-serif`; ctx.textBaseline = 'middle';
    if (world.quality.particles >= 0.7) { ctx.shadowColor = 'rgba(124,255,158,0.8)'; ctx.shadowBlur = 5; }
    // --- pitch ladder (rolls with the jet) ---
    ctx.save(); ctx.translate(cx, hy); ctx.rotate(roll);
    ctx.beginPath(); ctx.moveTo(-hw * 1.1, 0); ctx.lineTo(-hw * 0.25, 0); ctx.moveTo(hw * 0.25, 0); ctx.lineTo(hw * 1.1, 0); ctx.stroke();
    for (const deg of [-10, -5, 5, 10, 15]) {
      const y = -deg * (h * 0.012), x0 = hw * 0.22, x1 = hw * 0.62;
      ctx.setLineDash(deg < 0 ? [6, 5] : []);
      ctx.beginPath(); ctx.moveTo(-x1, y); ctx.lineTo(-x0, y); ctx.lineTo(-x0, y + (deg < 0 ? -6 : 6)); ctx.moveTo(x1, y); ctx.lineTo(x0, y); ctx.lineTo(x0, y + (deg < 0 ? -6 : 6)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'right'; ctx.fillText(Math.abs(deg), -x1 - 4, y); ctx.textAlign = 'left'; ctx.fillText(Math.abs(deg), x1 + 4, y);
    }
    ctx.restore();
    // --- flight path marker + gun cross ---
    ctx.beginPath(); ctx.arc(cx, hy, 7, 0, TAU); ctx.moveTo(cx - 20, hy); ctx.lineTo(cx - 7, hy); ctx.moveTo(cx + 7, hy); ctx.lineTo(cx + 20, hy); ctx.moveTo(cx, hy - 7); ctx.lineTo(cx, hy - 15); ctx.stroke();
    ctx.strokeStyle = f.overheat ? '#FF6A3D' : G;
    ctx.beginPath(); ctx.moveTo(cx - 8, hy + 34); ctx.lineTo(cx + 8, hy + 34); ctx.moveTo(cx, hy + 26); ctx.lineTo(cx, hy + 42); ctx.stroke();
    ctx.strokeStyle = G;
    // --- heading tape ---
    const hdg = ((f.a * 180 / Math.PI + 90) % 360 + 360) % 360, ty = top;
    ctx.textAlign = 'center';
    ctx.beginPath();
    for (let d = Math.floor((hdg - 30) / 5) * 5; d <= hdg + 30; d += 5) {
      const x = cx + (d - hdg) * (hw / 30);
      ctx.moveTo(x, ty); ctx.lineTo(x, ty + (d % 10 === 0 ? 9 : 5));
      if (d % 10 === 0) ctx.fillText(String(((d % 360) + 360) % 360 / 10 | 0).padStart(2, '0'), x, ty + 19);
    }
    ctx.stroke();
    ctx.strokeRect(cx - 22, ty - 20, 44, 16); ctx.fillText(String(Math.round(hdg)).padStart(3, '0'), cx, ty - 12);
    // --- airspeed (left) and altitude (right) boxes ---
    const kts = Math.round(f.speed * 1.9), alt = Math.round((16000 + Math.sin(world.time * 0.23 + f.uid) * 420 + (f.boosting ? 300 : 0)) / 10) * 10;
    const bx = cx - hw - 58, ax = cx + hw + 4;
    ctx.strokeRect(bx, hy - 11, 54, 22); ctx.strokeRect(ax, hy - 11, 62, 22);
    ctx.textAlign = 'center'; ctx.fillText(kts, bx + 27, hy + 1); ctx.fillText(alt.toLocaleString('en-US'), ax + 31, hy + 1);
    ctx.font = `${fs * 0.8}px "Bebas Neue", Impact, sans-serif`;
    ctx.fillText('KTS', bx + 27, hy + 21); ctx.fillText('FT', ax + 31, hy + 21);
    ctx.beginPath();
    for (let i = -4; i <= 4; i++) { const y = hy + i * 18 + ((kts % 20) / 20) * 18; if (Math.abs(y - hy) > 14) { ctx.moveTo(bx + 54, y); ctx.lineTo(bx + 46, y); } const y2 = hy + i * 18 + ((alt % 100) / 100) * 18; if (Math.abs(y2 - hy) > 14) { ctx.moveTo(ax, y2); ctx.lineTo(ax + 8, y2); } }
    ctx.stroke();
    // --- status text ---
    ctx.font = `${fs}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'left';
    const lx = cx - hw - 58, ly = bot + 4;
    ctx.fillText(`G ${this.g.toFixed(1)}`, lx, top + 4); ctx.fillText(`M ${(f.speed / 330).toFixed(2)}`, lx, top + 20);
    ctx.fillText(f.overheat ? 'GUN  HOT' : `GUN  ${f.ammo}`, lx, ly); ctx.fillText(`AIM-9  ${f.missiles}`, lx, ly + 16); ctx.fillText(`FLR  ${f.flares}`, lx, ly + 32);
    ctx.textAlign = 'right';
    const rx = cx + hw + 66;
    ctx.fillText(f.shieldT > 0 ? 'SHLD  ON' : f.shieldCd > 0 ? `SHLD  ${Math.ceil(f.shieldCd)}` : 'SHLD  RDY', rx, ly);
    ctx.fillText(world.zone.inside(f.x, f.y) ? 'ZONE  IN' : 'ZONE  OUT', rx, ly + 16);
    ctx.fillText(f.boosting ? 'AB' : 'MIL', rx, ly + 32);
    // --- target designator ---
    let best = null, be = BATTLE.MISSILE_CONE;
    for (const o of world.fighters) {
      if (!o.alive || o.team === f.team) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d > BATTLE.MISSILE_RANGE * 1.3) continue;
      const e = Math.abs(angDiff(f.a, Math.atan2(o.y - f.y, o.x - f.x)));
      if (e < be) { be = e; best = o; }
    }
    if (best) {
      const alt2 = Math.sin(best.uid * 1.7) * 26 + Math.sin(world.time * 0.9 + best.uid) * 8;
      const p = this._proj(f, best.x, best.y, alt2, w, hy, F);
      if (p) {
        const dx = p.x - cx, dy = p.y - hy, c = Math.cos(roll), sn = Math.sin(roll);
        const sx = cx + dx * c - dy * sn, sy = hy + dx * sn + dy * c;
        const inRange = Math.hypot(best.x - f.x, best.y - f.y) < BATTLE.MISSILE_RANGE;
        const locked = inRange && f.missiles > 0 && f.missileCd <= 0;
        ctx.strokeStyle = locked ? '#FFD24A' : G; ctx.fillStyle = ctx.strokeStyle;
        const r = 16 + (locked ? Math.sin(world.time * 14) * 2 : 0);
        ctx.beginPath(); ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r, sy); ctx.closePath(); ctx.stroke();
        if (locked) { ctx.beginPath(); ctx.arc(sx, sy, r + 8, 0, TAU); ctx.stroke(); }
        ctx.textAlign = 'center';
        const nm = (Math.hypot(best.x - f.x, best.y - f.y) / 1852 * 8).toFixed(1);
        ctx.fillText(locked ? `SHOOT  ${nm} NM` : `${best.tag}  ${nm} NM`, sx, sy + r + 14);
      }
    }
    ctx.restore();
    // threats outside the view: edge chevrons
    for (const o of world.fighters) {
      if (!o.alive || o.team === f.team) continue;
      const rel = angDiff(f.a, Math.atan2(o.y - f.y, o.x - f.x)), d = Math.hypot(o.x - f.x, o.y - f.y);
      if (Math.abs(rel) < 0.6 || d > 1300) continue;
      const left = rel < 0, x = left ? 18 : w - 18, y = hy + clamp(Math.abs(rel) - 1.5, -1, 1.5) * 60;
      ctx.fillStyle = '#FF4B4B';
      ctx.beginPath(); ctx.moveTo(x + (left ? -10 : 10), y); ctx.lineTo(x + (left ? 6 : -6), y - 9); ctx.lineTo(x + (left ? 6 : -6), y + 9); ctx.closePath(); ctx.fill();
    }
    // G-force grey-out in hard turns
    if (this.g > 4.2) {
      const k = clamp((this.g - 4.2) / 3, 0, 0.7);
      const gg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, `rgba(0,0,0,${k})`);
      ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);
    }
    // bubble canopy: thin bow frames and glass reflections (no centre post, like a modern fighter)
    ctx.strokeStyle = 'rgba(18,20,26,0.95)'; ctx.lineCap = 'butt';
    ctx.lineWidth = Math.max(8, w * 0.016);
    ctx.beginPath(); ctx.moveTo(-10, h * 0.5); ctx.quadraticCurveTo(w * 0.5, -h * 0.5, w + 10, h * 0.5); ctx.stroke();
    ctx.lineWidth = Math.max(5, w * 0.008);
    ctx.beginPath(); ctx.moveTo(w * 0.03, h); ctx.quadraticCurveTo(w * 0.06, h * 0.55, w * 0.16, h * 0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.97, h); ctx.quadraticCurveTo(w * 0.94, h * 0.55, w * 0.84, h * 0.32); ctx.stroke();
    const gl = ctx.createLinearGradient(0, 0, w, h * 0.7);
    gl.addColorStop(0, 'rgba(255,255,255,0.07)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(0.7, 'rgba(255,255,255,0.03)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    // HUD combiner glass
    ctx.fillStyle = 'rgba(160,255,190,0.035)'; ctx.fillRect(cx - hw - 70, top - 28, (hw + 70) * 2, bot - top + 90);
    // instrument panel with two MFDs
    const dh = Math.min(h * 0.14, 120), dy = h - dh;
    const dg = ctx.createLinearGradient(0, dy, 0, h);
    dg.addColorStop(0, '#1b1f27'); dg.addColorStop(1, '#0b0d12');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, dy + dh * 0.3); ctx.quadraticCurveTo(w / 2, dy - dh * 0.35, w, dy + dh * 0.3); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    const ms = Math.min(dh * 0.78, w * 0.16), my = dy + dh * 0.2;
    this._mfdRadar(ctx, world, f, cx - ms - 14, my, ms);
    this._mfdStores(ctx, f, cx + 14, my, ms, fs);
  }

  _mfdRadar(ctx, world, f, x, y, s) {
    ctx.fillStyle = '#05140c'; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#2a3a30'; ctx.lineWidth = 2; ctx.strokeRect(x, y, s, s);
    const ox = x + s / 2, oy = y + s - 6, R = s - 12, range = 1600;
    ctx.strokeStyle = 'rgba(124,255,158,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ox, oy, R, Math.PI * 1.25, Math.PI * 1.75); ctx.arc(ox, oy, R / 2, Math.PI * 1.75, Math.PI * 1.25, true); ctx.closePath(); ctx.stroke();
    for (const o of world.fighters) {
      if (!o.alive || o === f) continue;
      const rel = angDiff(f.a, Math.atan2(o.y - f.y, o.x - f.x)), d = Math.hypot(o.x - f.x, o.y - f.y);
      if (Math.abs(rel) > Math.PI / 4 || d > range) continue;
      const rr = (d / range) * R, px = ox + Math.sin(rel) * rr, py = oy - Math.cos(rel) * rr;
      ctx.fillStyle = o.team === f.team ? '#7FB3FF' : '#FF6B6B';
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    }
    ctx.fillStyle = 'rgba(124,255,158,0.8)'; ctx.font = '9px "Bebas Neue", Impact, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('RDR  ' + (range / 10) + 'm', x + 4, y + 9);
  }
  _mfdStores(ctx, f, x, y, s, fs) {
    ctx.fillStyle = '#05140c'; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#2a3a30'; ctx.lineWidth = 2; ctx.strokeRect(x, y, s, s);
    ctx.fillStyle = 'rgba(124,255,158,0.85)'; ctx.font = `${Math.max(9, s / 9)}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'left';
    const L = [`HULL  ${Math.round((f.hp / f.maxHp) * 100)}%`, `GUN  ${f.ammo}`, `HEAT  ${Math.round(f.heat * 100)}%`, `AIM-9  ${f.missiles}/${f.maxMissiles}`, `CHAFF  ${f.flares}`];
    L.forEach((t, i) => { ctx.fillStyle = i === 0 && f.hp < f.maxHp * 0.3 ? '#FF6B6B' : 'rgba(124,255,158,0.85)'; ctx.fillText(t, x + 5, y + 11 + i * (s / 5.6)); });
  }
}
