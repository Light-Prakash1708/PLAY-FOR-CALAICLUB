// Shaded vector aircraft renderer with a sprite cache. A blueprint from
// planeSpecs.js is painted once per size (camouflage, lighting, panel lines,
// canopy, nozzles, stores) and then drawn with drawImage during play.
import { TAU } from '../core/utils.js';

const cache = new Map();

function rng(seed) { let a = seed * 2654435761 >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function addPoly(p, pts, sx = 1) {
  p.moveTo(pts[0][0] * sx, pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0] * sx, pts[i][1]);
  p.closePath();
}
function both(pts) { const p = new Path2D(); addPoly(p, pts, 1); addPoly(p, pts, -1); return p; }
function hullPath(fus) {
  const p = new Path2D();
  p.moveTo(fus[0][0], fus[0][1]);
  for (let i = 1; i < fus.length; i++) p.lineTo(fus[i][0], fus[i][1]);
  for (let i = fus.length - 1; i >= 0; i--) p.lineTo(-fus[i][0], fus[i][1]);
  p.closePath();
  return p;
}

function missile(g, x, y, l) {
  g.fillStyle = '#eef1f3'; g.strokeStyle = '#59626b'; g.lineWidth = 0.25;
  g.beginPath(); g.rect(x - 0.9, y, 1.8, l); g.fill(); g.stroke();
  g.fillStyle = '#3b4148';
  g.beginPath(); g.moveTo(x - 0.9, y + 1.2); g.lineTo(x, y - 2); g.lineTo(x + 0.9, y + 1.2); g.fill();
  g.fillStyle = '#aab2b9';
  g.beginPath(); g.moveTo(x - 0.9, y + l - 3); g.lineTo(x - 2.5, y + l); g.lineTo(x - 0.9, y + l);
  g.moveTo(x + 0.9, y + l - 3); g.lineTo(x + 2.5, y + l); g.lineTo(x + 0.9, y + l); g.fill();
}

function nozzle(g, x, y, w) {
  const l = 6, gr = g.createLinearGradient(x - w, 0, x + w, 0);
  gr.addColorStop(0, '#2b2e33'); gr.addColorStop(0.35, '#8d949c'); gr.addColorStop(0.6, '#4b5057'); gr.addColorStop(1, '#1b1d20');
  g.fillStyle = gr; g.strokeStyle = '#16181b'; g.lineWidth = 0.4;
  g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + w, y); g.lineTo(x + w * 0.82, y + l); g.lineTo(x - w * 0.82, y + l); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.3;
  for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x + w * k, y); g.lineTo(x + w * k * 0.82, y + l); g.stroke(); }
  g.fillStyle = '#0c0c0e'; g.beginPath(); g.ellipse(x, y + l, w * 0.8, w * 0.28, 0, 0, TAU); g.fill();
}

function canopy(g, y0, y1, w, seats) {
  const m = (y0 + y1) / 2;
  const gr = g.createLinearGradient(-w, y0, w, y1);
  gr.addColorStop(0, '#7fb4d6'); gr.addColorStop(0.45, '#1f3346'); gr.addColorStop(1, '#0d1822');
  g.fillStyle = gr; g.strokeStyle = '#20262c'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(0, y0);
  g.bezierCurveTo(w, y0 + 2, w * 1.15, m, w * 0.9, y1 - 4); g.quadraticCurveTo(w * 0.4, y1, 0, y1);
  g.quadraticCurveTo(-w * 0.4, y1, -w * 0.9, y1 - 4); g.bezierCurveTo(-w * 1.15, m, -w, y0 + 2, 0, y0);
  g.fill(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-w * 0.45, y0 + 3); g.quadraticCurveTo(-w * 0.75, m, -w * 0.5, y1 - 5); g.stroke();
  if (seats === 2) { g.strokeStyle = '#20262c'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-w, y0 + (y1 - y0) * 0.42); g.lineTo(w, y0 + (y1 - y0) * 0.42); g.stroke(); }
}

/** Paints a blueprint. Caller's transform puts the nose along +x with unit = half length. */
export function drawPlane(g, s) {
  const pal = s.pal;
  g.save();
  g.rotate(Math.PI / 2);
  g.scale(1 / 50, 1 / 50);         // authoring space: nose up, ~100 units long
  g.lineJoin = 'round'; g.lineCap = 'butt';

  for (const [x, y, l] of s.msl || []) { missile(g, x, y, l); missile(g, -x, y, l); }

  const surfaces = [s.stab, s.wing, s.glove, s.canard].filter(Boolean);
  const hull = hullPath(s.fus);
  const all = new Path2D();
  for (const pts of surfaces) { addPoly(all, pts, 1); addPoly(all, pts, -1); }
  all.addPath(hull);

  g.fillStyle = pal.wing;
  for (const pts of surfaces) g.fill(both(pts));
  g.fillStyle = pal.body; g.fill(hull);

  // camouflage and lighting, clipped to the airframe
  g.save();
  g.clip(all);
  const r = rng(s.seed || 1), n = s.camoN || 11;
  for (let i = 0; i < n; i++) {
    const cx = -40 + r() * 80, cy = -52 + r() * 106, rad = 7 + r() * 8, k = 6 + Math.floor(r() * 3), a0 = r() * TAU;
    g.fillStyle = g.strokeStyle = pal.camo[i % pal.camo.length]; g.lineWidth = 3;
    g.beginPath();
    for (let j = 0; j < k; j++) {
      const a = a0 + j * TAU / k, rx = rad * (0.55 + r() * 0.7), ry = rad * (0.55 + r() * 0.7) * 1.3;
      const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
      if (j) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fill(); g.stroke();
  }
  let gr = g.createLinearGradient(-45, 0, 45, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.46, 'rgba(255,255,255,0.04)');
  gr.addColorStop(0.54, 'rgba(0,0,0,0.04)'); gr.addColorStop(1, 'rgba(0,0,0,0.34)');
  g.fillStyle = gr; g.fillRect(-50, -62, 100, 126);
  gr = g.createLinearGradient(0, -55, 0, 55);
  gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)');
  g.fillStyle = gr; g.fillRect(-50, -62, 100, 126);
  // engine bays read as cylinders
  for (const [x0, x1, y0, y1] of s.nac || []) {
    for (const sx of x0 < 0 ? [1] : [1, -1]) {
      const a = x0 * sx, b = x1 * sx, cg = g.createLinearGradient(Math.min(a, b), 0, Math.max(a, b), 0);
      cg.addColorStop(0, 'rgba(0,0,0,0.3)'); cg.addColorStop(0.3, 'rgba(255,255,255,0.22)'); cg.addColorStop(0.62, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(0,0,0,0.36)');
      g.fillStyle = cg; g.fillRect(Math.min(a, b), y0, Math.abs(b - a), y1 - y0);
    }
  }
  g.restore();

  g.strokeStyle = pal.edge; g.globalAlpha = 0.8; g.lineWidth = 0.55; g.stroke(all); g.globalAlpha = 1;

  // leading-edge highlights and panel lines
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.7;
  for (const pts of surfaces) {
    const k = pts === s.wing ? (s.lead || 1) : 1;
    for (const sx of [1, -1]) { g.beginPath(); g.moveTo(pts[0][0] * sx, pts[0][1]); for (let i = 1; i <= k; i++) g.lineTo(pts[i][0] * sx, pts[i][1]); g.stroke(); }
  }
  g.strokeStyle = pal.edge; g.globalAlpha = 0.45; g.lineWidth = 0.35;
  const w = s.wing, tip = w.reduce((a, b) => (b[0] > a[0] ? b : a));
  for (const sx of [1, -1]) { g.beginPath(); g.moveTo((w[0][0] + 2) * sx, tip[1] - 9); g.lineTo((tip[0] - 1.5) * sx, tip[1] + 4); g.stroke(); }
  for (const y of s.panels || []) { g.beginPath(); g.moveTo(-4, y); g.lineTo(4, y); g.stroke(); }
  g.globalAlpha = 1;

  // radome (first three outline points) or a nose shock cone
  const f = s.fus;
  g.fillStyle = pal.radome; g.strokeStyle = pal.edge; g.lineWidth = 0.4;
  g.beginPath(); g.moveTo(f[0][0], f[0][1]); g.lineTo(f[1][0], f[1][1]); g.lineTo(f[2][0], f[2][1]); g.lineTo(-f[2][0], f[2][1]); g.lineTo(-f[1][0], f[1][1]); g.closePath(); g.fill(); g.stroke();
  if (s.cone) { g.fillStyle = '#20262c'; g.fillRect(-f[2][0], f[2][1] - 0.6, f[2][0] * 2, 1.4); }
  // dorsal spine highlight
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath(); g.moveTo(-2.2, s.canopy[1] + 1); g.quadraticCurveTo(0, s.canopy[1] - 1, 2.2, s.canopy[1] + 1); g.lineTo(1.5, 24); g.lineTo(-1.5, 24); g.fill();

  // fins
  if (s.fins === 'twin') {
    g.fillStyle = pal.fin; g.strokeStyle = pal.edge; g.lineWidth = 0.4;
    const fp = both(s.fin); g.fill(fp); g.stroke(fp);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.5;
    for (const sx of [1, -1]) { g.beginPath(); g.moveTo(s.fin[0][0] * sx, s.fin[0][1]); g.lineTo(s.fin[3][0] * sx, s.fin[3][1]); g.stroke(); }
    g.strokeStyle = pal.mark; g.lineWidth = 1.1;
    for (const sx of [1, -1]) { g.beginPath(); g.moveTo((s.fin[1][0] + 0.1) * sx, s.fin[1][1] + 2); g.lineTo((s.fin[1][0] + 1.2) * sx, s.fin[1][1] + 11); g.stroke(); }
  } else {
    const [y0, y1] = s.fins;
    g.fillStyle = pal.fin; g.strokeStyle = pal.edge; g.lineWidth = 0.35;
    g.beginPath(); g.moveTo(-1, y0); g.lineTo(1, y0); g.lineTo(1.3, y1); g.lineTo(-1.3, y1); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-1, y0); g.lineTo(-1.3, y1); g.stroke();
    g.fillStyle = pal.mark; g.fillRect(-1.2, y1 - 11, 2.4, 2.2);
  }

  for (const [x, y, nw] of s.noz) { nozzle(g, x, y, nw); if (x !== 0) nozzle(g, -x, y, nw); }
  canopy(g, s.canopy[0], s.canopy[1], s.canopy[2], s.canopy[3]);
  if (s.rail) {
    const [x, y, l] = s.rail;
    g.fillStyle = '#dfe4e8'; g.strokeStyle = pal.edge; g.lineWidth = 0.25;
    for (const sx of [1, -1]) { g.beginPath(); g.rect(x * sx - 0.65, y, 1.3, l); g.fill(); g.stroke(); }
  }
  if (s.turrets) {
    for (const [tx, ty] of s.turrets) {      // turrets are given in sprite space (nose +x)
      const x = ty * 50, y = -tx * 50;
      g.fillStyle = '#15151B'; g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill();
      g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(x, y, 1.5, 0, TAU); g.fill();
    }
  }
  g.restore();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Returns { c, w, half } - colour sprite, white hit-flash sprite, half extent in px. */
/** On-screen size multiplier for every aircraft (hitboxes are scaled to match). */
export const PLANE_SCALE = 1.15;

export function getSprite(id, spec, size0) {
  const key = id + '@' + size0;
  let spr = cache.get(key);
  if (spr) return spr;
  const size = size0 * PLANE_SCALE;
  const SS = size < 40 ? 3 : 2;                       // small jets get extra supersampling so detail survives
  const half = Math.ceil(size * (spec.extent || 1.22));
  const dim = half * 2 * SS;
  const c = makeCanvas(dim, dim);
  const g = c.getContext('2d');
  g.translate(dim / 2, dim / 2);
  g.scale(size * SS, size * SS);
  drawPlane(g, spec);
  const w = makeCanvas(dim, dim);
  const gw = w.getContext('2d');
  gw.drawImage(c, 0, 0);
  gw.globalCompositeOperation = 'source-in';
  gw.fillStyle = '#fff';
  gw.fillRect(0, 0, dim, dim);
  // thin dark outline + soft rim so jets read clearly over busy terrain
  const o = makeCanvas(dim, dim), go = o.getContext('2d'), t = 1.3 * SS;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; go.drawImage(w, Math.cos(a) * t, Math.sin(a) * t); }
  go.globalCompositeOperation = 'source-in'; go.fillStyle = 'rgba(22,16,28,0.75)'; go.fillRect(0, 0, dim, dim);
  go.globalCompositeOperation = 'source-over'; go.drawImage(c, 0, 0);
  go.globalCompositeOperation = 'source-atop';
  const sheen = go.createLinearGradient(0, 0, dim, dim);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
  go.fillStyle = sheen; go.fillRect(0, 0, dim, dim);
  spr = { c: o, w, half };
  cache.set(key, spr);
  return spr;
}

export function drawSprite(ctx, spr, x, y, a, bank = 0, alpha = 1, flash = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (bank) ctx.scale(1, 1 - 0.3 * Math.abs(bank));
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(flash ? spr.w : spr.c, -spr.half, -spr.half, spr.half * 2, spr.half * 2);
  ctx.restore();
}

/** Live afterburner plumes, drawn under the sprite. */
export function drawEngines(ctx, spec, size0, x, y, a, t, power = 1, bank = 0) {
  const size = size0 * PLANE_SCALE;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (bank) ctx.scale(1, 1 - 0.3 * Math.abs(bank));
  ctx.scale(size, size);
  const ex = spec.exhaust;
  for (let i = 0; i < ex.length; i++) {
    const fl = (0.4 + 0.12 * Math.sin(t * 40 + i * 2.1)) * power, px = ex[i][0] + 0.1, py = ex[i][1], hw = 0.055;
    ctx.fillStyle = 'rgba(255,170,70,0.28)';
    ctx.beginPath(); ctx.ellipse(px - fl * 0.5, py, fl * 0.75, hw * 2.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,160,50,0.92)';
    ctx.beginPath(); ctx.moveTo(px, py - hw); ctx.quadraticCurveTo(px - fl * 0.5, py - hw * 1.1, px - fl, py); ctx.quadraticCurveTo(px - fl * 0.5, py + hw * 1.1, px, py + hw); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,225,0.95)';
    ctx.beginPath(); ctx.moveTo(px, py - hw * 0.45); ctx.quadraticCurveTo(px - fl * 0.3, py - hw * 0.5, px - fl * 0.55, py); ctx.quadraticCurveTo(px - fl * 0.3, py + hw * 0.5, px, py + hw * 0.45); ctx.fill();
  }
  ctx.restore();
}

/** Renders an aircraft into a UI canvas (hangar preview, cards). Nose up by default. */
export function drawPreview(canvas, id, spec, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cw, ch);
  const size = (opts.scale || 0.34) * Math.min(cw, ch);
  const a = -Math.PI / 2 + (opts.angle || 0);
  const t = opts.t || 0;
  const x = cw / 2, y = ch / 2 + (opts.dy || 0);
  drawEngines(g, spec, size, x, y, a, t, 1, opts.bank || 0);
  g.save();
  g.translate(x, y); g.rotate(a);
  if (opts.bank) g.scale(1, 1 - 0.3 * Math.abs(opts.bank));
  g.scale(size, size);
  drawPlane(g, spec);
  g.restore();
  if (opts.locked) {
    // silhouette treatment for locked aircraft
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(40,60,70,0.72)';
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'source-over';
  }
}
