import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
export async function open(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 420, height: 800 }, deviceScaleFactor: opts.dpr || 1, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto(opts.url || 'http://localhost:8765/index.html');
  await page.waitForSelector('#s-loading.ready', { timeout: 20000 });
  await page.waitForTimeout(300);
  if (!opts.stayOnLoading) {
    await page.click('[data-act=start]', { force: true }); await page.waitForTimeout(200);
    await page.evaluate(() => window.__skyStrike.finishIntro());      // tests skip the opening cinematic
    await page.waitForTimeout(400);
  }
  return { browser, ctx, page, errs };
}
// Injected into the page: an autopilot that plays the mission, and a fast-forward stepper.
export const BOT = `
window.__bot = function (g, opts) {
  const w = g.world, inp = g.input, TAU = Math.PI * 2;
  const ang = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  let evade = 0, evDir = 1;
  w.controller.autopilot = (p, dt) => {
    if (w.ending) { inp.fireHeld = false; } if (w.ending) return { steer: false, angle: p.a, throttle: 1 };
    // nearest visible enemy
    let best = null, bd = 1e12;
    for (const e of w.enemies.list) { if (!e.alive || e.dying) continue; const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2 + (e.cloaked ? 9e4 : 0); if (d < bd) { bd = d; best = e; } }
    // threats: missiles and bullets on a collision course
    let danger = null, dd = 150 * 150;
    for (const m of w.missiles.pool.active) { if (m.team !== 1) continue; const d = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (d < dd) { dd = d; danger = m; } }
    let bul = null, bdist = 190 * 190;
    for (const b of w.bullets.pool.active) { if (b.team !== 1) continue; const dx = p.x - b.x, dy = p.y - b.y, d = dx * dx + dy * dy; if (d < bdist && dx * b.vx + dy * b.vy > 0) { bdist = d; bul = b; } }
    if (evade > 0) evade -= dt;
    let want = p.a, steer = false, fire = false;
    if (danger && opts.flares !== false && w.weapons.flares > 0 && w.weapons.flareCd <= 0) w.weapons.useFlares(w);
    if (danger) { const a = Math.atan2(danger.y - p.y, danger.x - p.x); want = a + Math.PI / 2 * evDir; steer = true; if (opts.boost !== false) p.boost(w); }
    else if (bul && opts.dodge) { const a = Math.atan2(bul.vy, bul.vx); want = a + Math.PI / 2 * (ang(a, p.a) > 0 ? 1 : -1); steer = true; }
    else if (best) {
      const d = Math.sqrt(bd), tt = d / 740;
      const a = Math.atan2(best.y + Math.sin(best.a) * best.vel * tt - p.y, best.x + Math.cos(best.a) * best.vel * tt - p.x);
      if (d < best.r * 2 + 75 && evade <= 0) { evade = best.def.boss ? 1.4 : 0.8; evDir = Math.random() < 0.5 ? 1 : -1; }
      want = evade > 0 ? a + Math.PI * 0.75 * evDir : a; steer = true;
      fire = Math.abs(ang(p.a, a)) < (best.def.boss ? 0.5 : 0.3) + best.r / (d + 1) && d < 500;
      if (Math.abs(ang(p.a, a)) < 0.5 && d < 520) { if (w.weapons.missiles > 0 && w.weapons.missileCd <= 0 && Math.random() < 0.02) w.weapons.launchMissile(w); }
      if (opts.special && w.weapons.special > 0 && w.weapons.specialCd <= 0 && (w.enemies.count(true) >= 4 || best.def.boss) && d < 300 && Math.random() < 0.02) w.weapons.useSpecial(w);
    }
    if (best) { const d2 = Math.sqrt(bd), aa = Math.atan2(best.y - p.y, best.x - p.x); fire = d2 < 500 && Math.abs(ang(p.a, aa)) < (best.def.boss ? 0.5 : 0.3) + best.r / (d2 + 1); }
    inp.fireHeld = fire;
    return { steer, angle: want, throttle: 1 };
  };
  w.player.damage = opts.god ? () => false : Object.getPrototypeOf(w.player).damage;
};
// Runs the real game update at a fixed 60 Hz step, faster than real time. Renders every 6th step.
window.__ff = function (g, seconds) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) { g.update(1 / 60); if (i % 6 === 0) g.render(); if (!g.state.is('playing')) break; }
  return g.state.current;
};`;
