// Balance pass: the autopilot plays each mission several times with the loadout a
// player would plausibly own by then (damage on). Reports clear rate and damage taken.
import { open, BOT } from './lib.mjs';
const RUNS = +(process.argv[2] || 3);
const ONLY = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const LOAD = { 1: [0, 0], 2: [0, 0], 3: [0, 1], 4: [0, 1], 5: [2, 1], 6: [2, 1], 7: [3, 2], 8: [3, 2], 9: [5, 2], 10: [5, 3], 11: [6, 3], 12: [6, 3], 13: [7, 3], 14: [7, 3], 15: [8, 3] };
const { browser, page, errs } = await open();
await page.evaluate(BOT); await page.evaluate(() => window.__skyStrike.loop.stop());
for (let id = 1; id <= 15; id++) {
  if (ONLY && !ONLY.includes(id)) continue;
  const r = await page.evaluate(({ id, load, RUNS }) => {
    const g = window.__skyStrike, d = g.save.data, A = Object.keys(d.aircraft).length;
    const ids = ['ember', 'streak', 'bruiser', 'wisp', 'hailstorm', 'manta', 'warden', 'bastion', 'ravager', 'zenith'];
    const plane = ids[load[0]], up = load[1];
    let wins = 0, dmg = 0, time = 0, stars = 0;
    for (let k = 0; k < RUNS; k++) {
      d.unlockedLevel = 15; d.fails = {};
      d.aircraft[plane] = { owned: true, up: { engine: up, weapon: up, fireRate: up, armour: up, missile: up } }; d.selected = plane;
      g.state.set('menu'); g.startLevel(id); window.__bot(g, { dodge: true, special: true });
      let sim = 0; while (g.state.is('playing') && sim < 500) { window.__ff(g, 2); sim += 2; }
      const st = g.world.stats;
      if (g.state.is('complete')) { wins++; stars += st.result.stars; }
      dmg += Math.min(1.5, st.damageTaken / st.hpMax); time += st.time;
    }
    return `${String(id).padStart(2)} ${plane}+${up}  clear ${wins}/${RUNS}  avg dmg ${(dmg / RUNS * 100).toFixed(0)}%  avg time ${(time / RUNS).toFixed(0)}s  avg stars ${(wins ? stars / wins : 0).toFixed(1)}`;
  }, { id, load: LOAD[id], RUNS });
  console.log(r);
}
console.log(errs.join('\n') || 'no console errors');
await browser.close();
