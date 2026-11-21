// Take-off from a military airbase. The base is drawn on the ground; as the
// jets climb it shrinks toward the screen centre (altitude parallax) and
// fades, then the camera punches through a cloud layer into the battle sky.
import { drawRunway } from './Cinema.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

/** Base layout in runway-local coords (x along the runway, lift-off end at x = 0). Built once. */
const LAYOUT = (() => {
  const r = rng(4242), trees = [], hangars = [], tanks = [], parked = [];
  for (let i = 0; i < 4; i++) hangars.push({ x: -880 + i * 190, y: -260, w: 150, h: 110 });
  for (let i = 0; i < 3; i++) tanks.push({ x: -120 + i * 70, y: 300, r: 26 });
  for (let i = 0; i < 6; i++) parked.push({ x: -900 + i * 120, y: -150 });
  for (let i = 0; i < 160; i++) {
    const x = -1900 + r() * 3200, y = (r() < 0.5 ? -1 : 1) * (380 + r() * 900);
    trees.push({ x, y, s: 8 + r() * 12 });
  }
  return { trees, hangars, tanks, parked };
})();

/**
 * Draws the airbase. Call inside the world transform (after the camera has
 * been applied). k = ground scale (1 on the runway, smaller as you climb),
 * pivot = the camera centre in world space.
 */
export function drawAirbase(ctx, base, alpha, k, pivot, time, jetSprite, theme) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  // altitude: scale the ground about the camera centre
  ctx.translate(pivot.x, pivot.y); ctx.scale(k, k); ctx.translate(-pivot.x, -pivot.y);
  ctx.translate(base.x, base.y); ctx.rotate(base.a);
  const dark = theme && theme.dark;
  // fields and apron
  ctx.fillStyle = dark ? '#2c3a2a' : '#6f9a58'; ctx.fillRect(-4200, -3200, 8400, 6400);
  ctx.fillStyle = dark ? '#33452f' : '#7ead64';
  for (let i = -6; i <= 6; i++) ctx.fillRect(-4200, i * 480 + 120, 8400, 180);
  ctx.fillStyle = dark ? '#3e4148' : '#a7a9a6'; ctx.fillRect(-1050, -360, 1120, 240);               // apron
  ctx.fillRect(-1050, -140, 1120, 30); ctx.fillRect(-60, -150, 40, 170);                              // taxiway links
  // perimeter fence
  ctx.strokeStyle = dark ? 'rgba(200,200,200,0.25)' : 'rgba(60,60,60,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
  ctx.strokeRect(-1300, -460, 1700, 920); ctx.setLineDash([]);
  // trees
  for (const t of LAYOUT.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(t.x + 4, t.y + 6, t.s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark ? '#24361f' : '#3f6e34'; ctx.beginPath(); ctx.arc(t.x, t.y, t.s, 0, Math.PI * 2); ctx.fill();
  }
  // hangars with curved roofs
  for (const h of LAYOUT.hangars) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(h.x + 10, h.y + 14, h.w, h.h);
    const g = ctx.createLinearGradient(h.x, h.y, h.x, h.y + h.h);
    g.addColorStop(0, '#8d949c'); g.addColorStop(0.5, '#c9ced4'); g.addColorStop(1, '#7c838b');
    ctx.fillStyle = g; ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.strokeStyle = 'rgba(40,44,50,0.4)'; ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(h.x + (h.w * i) / 6, h.y); ctx.lineTo(h.x + (h.w * i) / 6, h.y + h.h); ctx.stroke(); }
    ctx.fillStyle = '#E23B3F'; ctx.fillRect(h.x + h.w * 0.42, h.y + h.h - 12, h.w * 0.16, 12);
  }
  // control tower
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(-1000 + 14, 200 + 18, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8d4cc'; ctx.beginPath(); ctx.arc(-1000, 200, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5fb6d8'; ctx.beginPath(); ctx.arc(-1000, 200, 32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = (Math.sin(time * 6) > 0) ? '#FF4B4B' : '#6b1a1a'; ctx.beginPath(); ctx.arc(-1000, 200, 7, 0, Math.PI * 2); ctx.fill();
  // fuel tanks
  for (const t of LAYOUT.tanks) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(t.x + 8, t.y + 10, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e6e0'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b9b6ae'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.6, 0, Math.PI * 2); ctx.stroke();
  }
  // helipad
  ctx.fillStyle = '#4a4e56'; ctx.beginPath(); ctx.arc(-560, 260, 60, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#F2C230'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-560, 260, 48, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 56px "Bebas Neue", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', -560, 262);
  // parked jets on the apron
  if (jetSprite) for (const p of LAYOUT.parked) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 2);
    ctx.drawImage(jetSprite.c, -jetSprite.half * 1.05, -jetSprite.half * 1.05, jetSprite.half * 2.1, jetSprite.half * 2.1);
    ctx.restore();
  }
  // base name painted on the apron
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 54px "Bebas Neue", Impact, sans-serif';
  ctx.fillText('PHOENIX AIR BASE', -520, -330 + 40);
  ctx.restore();
  // the runway itself (in the same scaled ground frame)
  ctx.save();
  ctx.translate(pivot.x, pivot.y); ctx.scale(k, k); ctx.translate(-pivot.x, -pivot.y);
  drawRunway(ctx, base.x, base.y, base.a, 1100, base.wid, alpha, time, base.lanes);
  ctx.restore();
}

/** Screen-space: white cloud puffs rushing past while climbing through the cloud layer. t: 0..1 across the punch. */
export function drawCloudPunch(ctx, w, h, t, sprites) {
  if (t <= 0 || t >= 1 || !sprites || !sprites.length) return;
  const a = Math.sin(t * Math.PI);                    // fades in, peaks, fades out
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${(a * 0.55).toFixed(3)})`; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + 0.4, d = (0.15 + t * 0.9) * Math.max(w, h) * (0.5 + (i % 3) * 0.2);
    const spr = sprites[i % sprites.length], s = (1.2 + t * 4) * (0.8 + (i % 4) * 0.15);
    ctx.globalAlpha = a * 0.9;
    ctx.drawImage(spr, w / 2 + Math.cos(ang) * d - (spr.width * s) / 2, h / 2 + Math.sin(ang) * d - (spr.height * s) / 2, spr.width * s, spr.height * s);
  }
  ctx.restore();
}

export const takeoffCurves = { smooth };
