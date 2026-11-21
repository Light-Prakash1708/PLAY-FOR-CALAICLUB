// QA: plays all ten missions with an autopilot at accelerated time, in real Chrome.
import { open, BOT } from './lib.mjs';
const god = process.argv.includes('--god');
const plane = (process.argv.find((a) => a.startsWith('--plane=')) || '--plane=ember').split('=')[1];
const up = +(process.argv.find((a) => a.startsWith('--up=')) || '--up=0').split('=')[1];
const { browser, page, errs } = await open();
await page.evaluate(BOT);
await page.evaluate(() => window.__skyStrike.loop.stop());
const rows = [];
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
for (let id = 1; id <= 15; id++) {
  if (only && !only.split(',').includes(String(id))) continue;
  const r = await page.evaluate(({ id, god, plane, up }) => {
    const g = window.__skyStrike, d = g.save.data;
    d.unlockedLevel = 15;
    d.aircraft[plane] = { owned: true, up: { engine: up, weapon: up, fireRate: up, armour: up, missile: up } }; d.selected = plane;
    g.state.set('menu');
    const coinsBefore = d.coins;
    g.startLevel(id);
    window.__bot(g, { god, dodge: !god, special: true });
    const seen = new Set(); let maxEn = 0, maxBul = 0, maxPart = 0, t0 = performance.now(), sim = 0, phases = 0;
    while (g.state.is('playing') && sim < 600) {
      window.__ff(g, 2); sim += 2;
      for (const e of g.world.enemies.list) { seen.add(e.def.id); if (e.def.boss) phases = Math.max(phases, e.phase + 1); }
      maxEn = Math.max(maxEn, g.world.enemies.list.length); maxBul = Math.max(maxBul, g.world.bullets.pool.active.length); maxPart = Math.max(maxPart, g.world.vfx.particles.active.length);
    }
    const st = g.world.stats, res = st.result || {};
    return { id, state: g.state.current, time: Math.round(st.time), kills: st.kills, dmg: Math.round(st.damageTaken), hpMax: st.hpMax, stars: res.stars, total: res.total, coinsDelta: d.coins - coinsBefore,
      seen: [...seen].join(','), maxEn, maxBul, maxPart, phases, msPerSimSec: ((performance.now() - t0) / Math.max(1, sim)).toFixed(1), screen: g.ui.current };
  }, { id, god, plane, up });
  rows.push(r);
  console.log(JSON.stringify(r));
}
console.log(errs.length ? errs.join('\n') : 'no console errors');
await browser.close();
