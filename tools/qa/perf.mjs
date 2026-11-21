import { open, BOT } from './lib.mjs';
// T20 on the single-file build opened from disk (file://), phone-sized at 2x pixel density
const { browser, page, errs } = await open({ url: 'file:///home/claude/sky-strike/dist/sky-strike.html', viewport: { width: 390, height: 844 }, dpr: 2 });
await page.evaluate(BOT);
const r = await page.evaluate(async () => {
  const g = window.__skyStrike; g.save.data.unlockedLevel = 10; g.startLevel(9); window.__bot(g, { god: true });
  const w = g.world;
  // stress: force a heavy wave plus bullet storms on top of normal play
  for (let i = 0; i < 4; i++) w.level.spawnEvent({ type: 'squadron', n: 7, form: 'v' });
  w.level.spawnEvent({ type: 'elite', n: 4 }); w.level.spawnEvent({ type: 'bomber', n: 3 });
  const times = []; const u = g.update.bind(g), rd = g.render.bind(g); let t0 = 0, maxE = 0, maxB = 0, maxP = 0;
  g.update = (dt) => { t0 = performance.now(); u(dt); if (w.time % 0.5 < 0.02) for (let k = 0; k < 24; k++) w.bullets.fire(w.player.x + 300, w.player.y - 300 + k * 20, Math.PI, 150, 0, 1, 3, 5); };
  g.render = () => { rd(); times.push(performance.now() - t0); maxE = Math.max(maxE, w.enemies.list.length); maxB = Math.max(maxB, w.bullets.pool.active.length); maxP = Math.max(maxP, w.vfx.particles.active.length); };
  const f0 = g.loop.frames, s = performance.now();
  await new Promise((res) => setTimeout(res, 12000));
  const secs = (performance.now() - s) / 1000, frames = g.loop.frames - f0;
  times.sort((a, b) => a - b);
  const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
  return { fps: (frames / secs).toFixed(1), avgMs: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2), p95Ms: times[Math.floor(times.length * 0.95)].toFixed(2), maxMs: times[times.length - 1].toFixed(2), maxE, maxB, maxP, heapMB: heap, state: g.state.current };
});
console.log(JSON.stringify(r)); console.log(errs.join('\n') || 'no console errors');
await browser.close();
