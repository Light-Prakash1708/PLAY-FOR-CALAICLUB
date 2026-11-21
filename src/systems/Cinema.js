// Shared "cinematic" helpers: light blooms, ground shadows, foreground cloud
// wisps, colour grade, vignette and letterbox bars.

const glowCache = {};
export function glowSprite(rgb) {
  if (glowCache[rgb]) return glowCache[rgb];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(0.35, `rgba(${rgb},0.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (glowCache[rgb] = c);
}

/** Black, slightly blurred silhouette of a plane sprite for its ground shadow. */
export function shadowSprite(spr) {
  if (spr.shadow) return spr.shadow;
  const c = document.createElement('canvas'); c.width = spr.c.width; c.height = spr.c.height;
  const g = c.getContext('2d');
  g.filter = 'blur(2px)'; g.drawImage(spr.w, 0, 0); g.filter = 'none';
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0a0812'; g.fillRect(0, 0, c.width, c.height);
  return (spr.shadow = { c, w: c, half: spr.half });
}

/** Additive blooms. list: [{ x, y, r, life, max, rgb }] in world space. */
export function drawGlows(ctx, list) {
  if (!list.length) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const g of list) {
    const k = g.life / g.max, r = g.r * (1.2 - 0.4 * k);
    ctx.globalAlpha = k;
    ctx.drawImage(glowSprite(g.rgb), g.x - r, g.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
export function stepGlows(list, dt) { for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; if (list[i].life <= 0) list.splice(i, 1); } }

/** Big faint clouds sliding past above the action (screen space). */
export function drawWisps(ctx, bg, cam, w, h, time) {
  if (!bg.sprites.length || bg.theme.dark) return;
  const T = 2600, par = 1.6;
  ctx.globalAlpha = (bg.theme.clouds || 1) < 0.3 ? 0.12 : 0.2;
  for (let i = 0; i < 3; i++) {
    const spr = bg.sprites[i], s = 2.6 + i * 0.5, sw = spr.width * s, sh = spr.height * s;
    const x = ((i * 977 + time * 18 - cam.x * par) % T + T) % T - sw;
    const y = ((i * 1543 - cam.y * par) % T + T) % T - sh;
    if (x > w || y > h) continue;
    ctx.drawImage(spr, x, y, sw, sh);
  }
  ctx.globalAlpha = 1;
}

const vig = {};
/** Colour grade (soft-light), sun bloom, vignette, optional red damage edges and letterbox. */
export function screenGrade(ctx, w, h, o) {
  if (o.hq && o.grade) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(${o.grade},${o.gradeA || 0.14})`; ctx.fillRect(0, 0, w, h);
    if (o.sun) {
      ctx.globalCompositeOperation = 'lighter';
      const r = Math.max(w, h) * 0.5; ctx.globalAlpha = 0.24;
      ctx.drawImage(glowSprite('255,230,180'), o.sun[0] * w - r, o.sun[1] * h - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const key = w + 'x' + h;
  if (vig.key !== key) {
    vig.v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58);
    vig.v.addColorStop(0, 'rgba(0,0,0,0)'); vig.v.addColorStop(1, 'rgba(10,6,20,0.45)');
    vig.r = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    vig.r.addColorStop(0, 'rgba(200,0,0,0)'); vig.r.addColorStop(1, 'rgba(200,0,0,0.8)');
    vig.key = key;
  }
  ctx.fillStyle = vig.v; ctx.fillRect(0, 0, w, h);
  if (o.hurt > 0.01) { ctx.globalAlpha = Math.min(1, o.hurt); ctx.fillStyle = vig.r; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  if (o.lb > 0.01) {
    const bh = o.lb * h * 0.085;
    ctx.fillStyle = '#05040A'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh);
  }
}

/** Grade colour + sun position picked from a sky theme name. */
export const THEME_GRADE = {
  day: ['120,190,255', 0.1, [0.15, 0.06]], morning: ['255,190,140', 0.14, [0.1, 0.1]], noon: ['140,200,255', 0.1, [0.5, 0.0]],
  altitude: ['120,170,255', 0.12, [0.8, 0.05]], storm: ['90,120,150', 0.18, null], golden: ['255,170,90', 0.18, [0.15, 0.08]],
  sunset: ['255,120,80', 0.2, [0.85, 0.12]], night: ['70,90,200', 0.2, null], dusk: ['200,90,200', 0.18, [0.2, 0.1]],
  inferno: ['255,90,40', 0.22, [0.5, 0.0]], mountain: ['255,210,160', 0.1, [0.8, 0.08]], desert: ['255,170,90', 0.16, [0.12, 0.08]],
  battlefield: ['200,180,120', 0.14, [0.2, 0.05]], snow: ['120,170,255', 0.14, [0.85, 0.06]], warzone: ['255,110,60', 0.2, [0.2, 0.05]],
};

/** A runway / airstrip seen from above, for take-offs. Centre (x, y) at the lift-off end, pointing along a. */
export function drawRunway(ctx, x, y, a, len, wid, alpha, time, lanes = 1) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y); ctx.rotate(a);
  const x0 = -len, x1 = len * 0.18, hw = wid / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0 + 10, -hw + 14, x1 - x0, wid);           // soft shadow
  ctx.fillStyle = '#3a3e46'; ctx.fillRect(x0, -hw, x1 - x0, wid);                               // asphalt
  ctx.fillStyle = '#4a4f58'; ctx.fillRect(x0, -hw, x1 - x0, 6); ctx.fillRect(x0, hw - 6, x1 - x0, 6);
  ctx.fillStyle = '#F2F2F2';
  for (let i = 0; i < 8; i++) ctx.fillRect(x0 + 18, -hw + 12 + i * ((wid - 24) / 8), 46, (wid - 24) / 8 - 6);   // threshold piano keys
  ctx.save(); ctx.translate(x0 + 120, 0); ctx.rotate(Math.PI / 2);
  ctx.font = `bold ${Math.min(60, wid * 0.32)}px "Bebas Neue", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('27', 0, 0); ctx.restore();
  // centre lines (one per lane)
  for (let l = 0; l < lanes; l++) {
    const ly = -hw + (wid / lanes) * (l + 0.5);
    for (let d = x0 + 190; d < x1 - 20; d += 70) ctx.fillRect(d, ly - 2, 38, 4);
  }
  // edge lights chasing toward lift-off
  for (let d = x0; d < x1; d += 46) {
    const on = Math.sin(time * 9 - d * 0.02) > 0.2;
    ctx.fillStyle = on ? '#FFD27A' : 'rgba(255,210,122,0.35)';
    ctx.beginPath(); ctx.arc(d, -hw - 5, 3.2, 0, Math.PI * 2); ctx.arc(d, hw + 5, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#5BE07A';
  ctx.beginPath(); for (let i = -2; i <= 2; i++) ctx.arc(x1 - 6, i * (wid / 5), 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
