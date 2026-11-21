// Functional QA in real (headless) Chrome using real keyboard / pointer / touch events.
import { open, BOT } from './lib.mjs';
const results = [];
const check = (id, name, ok, info = '') => { results.push({ id, name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  T${id} ${name}${info ? '  [' + info + ']' : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const on = (page, id) => page.evaluate((id) => document.querySelector('#s-' + id).classList.contains('on'), id);
const allErrs = [];

// ---------- desktop session ----------
{
  const { browser, page, errs } = await open({ stayOnLoading: true });
  await page.evaluate(BOT);
  await page.click('[data-act=start]', { force: true }); await page.waitForTimeout(500);
  check(1, 'main menu loads', await on(page, 'menu') && await G(page, () => window.__skyStrike.state.current === 'menu'));

  // T2 navigation
  let nav = true;
  const step = async (sel, expectScreen, modal) => { await page.click(sel); await page.waitForTimeout(250); const ok = modal ? await page.evaluate((m) => document.querySelector('#m-' + m).classList.contains('on'), modal) : await on(page, expectScreen); if (!ok) { nav = false; console.log('   nav failed at', sel); } };
  await step('[data-act=campaign]', 'levels'); await step('#s-levels [data-act=to-menu]', 'menu');
  await step('[data-act=hangar]', 'hangar'); await step('[data-act=hg-next]', 'hangar'); await step('[data-act=hg-prev]', 'hangar'); await step('[data-act=hg-tab][data-tab=upgrades]', 'hangar'); await step('#s-hangar [data-act=to-menu]', 'menu');
  await step('[data-act=upgrades]', 'hangar'); nav = nav && await page.evaluate(() => document.querySelector('.tabs [data-tab=upgrades]').classList.contains('on')); await step('#s-hangar [data-act=to-menu]', 'menu');
  await step('[data-act=daily]', null, 'daily');
  const c0 = await G(page, () => window.__skyStrike.save.data.coins);
  await page.click('[data-act=claim]'); await page.waitForTimeout(200);
  const c1 = await G(page, () => window.__skyStrike.save.data.coins);
  await page.click('[data-act=claim]', { force: true }).catch(() => {}); await page.waitForTimeout(100);
  const c2 = await G(page, () => window.__skyStrike.save.data.coins);
  await page.click('[data-act=daily-close]');
  await step('[data-act=settings]', null, 'settings'); await page.click('[data-act=quality][data-q=medium]'); await page.click('[data-act=fullscreen]'); await page.waitForTimeout(300);
  if (await page.evaluate(() => !!document.fullscreenElement)) { await page.click('[data-act=fullscreen]'); await page.waitForTimeout(300); }
  await page.click('[data-act=settings-close]'); await page.waitForTimeout(200);
  const st = await G(page, () => window.__skyStrike.save.data.settings);
  await step('[data-act=campaign]', 'levels'); await step('[data-act=level][data-id="1"]', null, 'brief'); await page.click('[data-act=brief-close]');
  await page.click('[data-act=level][data-id="5"]'); await page.waitForTimeout(200);
  const lockedStays = !(await page.evaluate(() => document.querySelector('#m-brief').classList.contains('on')));
  check(2, 'all navigation buttons work', nav && c1 === c0 + 50 && c2 === c1 && st.quality === 'medium' && lockedStays, `daily ${c0}->${c1}->${c2}, quality=${st.quality}, locked level blocked=${lockedStays}`);

  // start level 1 through the UI
  await page.click('[data-act=level][data-id="1"]'); await page.waitForTimeout(200); await page.click('[data-act=brief-go]'); await page.waitForTimeout(600);
  const playing = await G(page, () => window.__skyStrike.state.current);
  // T3 keyboard movement
  const p0 = await G(page, () => { const p = window.__skyStrike.world.player; return { x: p.x, y: p.y, a: p.a }; });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await page.keyboard.up('KeyD');
  const p1 = await G(page, () => { const p = window.__skyStrike.world.player; return { x: p.x, y: p.y, a: p.a }; });
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(900); await page.keyboard.up('ArrowDown');
  const p2 = await G(page, () => { const p = window.__skyStrike.world.player; return { x: p.x, y: p.y, a: p.a }; });
  const kb = playing === 'playing' && Math.abs(p1.a) < 0.2 && p1.x > p0.x + 50 && Math.abs(p2.a - Math.PI / 2) < 0.2 && p2.y > p1.y + 50;
  check(3, 'keyboard movement (WASD + arrows)', kb, `heading ${p0.a.toFixed(2)} -> ${p1.a.toFixed(2)} -> ${p2.a.toFixed(2)}`);

  // T4 primary weapon: manual trigger only - nothing fires until SPACE is held
  const idle0 = await G(page, () => window.__skyStrike.world.weapons.shotsFired);
  const s0 = await G(page, () => window.__skyStrike.world.weapons.shotsFired);
  await page.keyboard.down('Space'); await page.waitForTimeout(1000);
  const mid = await G(page, () => ({ shots: window.__skyStrike.world.weapons.shotsFired, bullets: window.__skyStrike.world.bullets.pool.active.filter((b) => b.team === 0).length }));
  await page.keyboard.up('Space'); await page.waitForTimeout(900);
  const after = await G(page, () => ({ shots: window.__skyStrike.world.weapons.shotsFired, bullets: window.__skyStrike.world.bullets.pool.active.filter((b) => b.team === 0).length }));
  await page.waitForTimeout(300);
  const stopped = await G(page, () => window.__skyStrike.world.weapons.shotsFired);
  check(4, 'primary weapon fires while held and stops on release', mid.shots - s0 >= 4 && mid.shots - s0 <= 8 && mid.bullets > 0 && stopped === after.shots && after.bullets === 0, `${mid.shots - s0} shots in 1s at 6/s, ${mid.bullets} bullets in flight, pool empty after release=${after.bullets === 0}`);

  // T5 missiles: place a bomber ahead, press K, expect a hit
  await G(page, () => { const g = window.__skyStrike, w = g.world, p = w.player; w.enemies.reset(); w.level.spawnT = 99; const e = w.enemies.spawn('bomber', p.x + Math.cos(p.a) * 320, p.y + Math.sin(p.a) * 320, p.a); window.__t5 = e; });
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1800);
  const m = await G(page, () => { const g = window.__skyStrike, w = g.world; return { fired: w.weapons.missilesFired, left: w.weapons.missiles, hp: window.__t5.hp, max: window.__t5.maxHp, cd: w.weapons.missileCd }; });
  await page.keyboard.press('KeyK'); await page.keyboard.press('KeyK'); await page.waitForTimeout(100);
  const m2 = await G(page, () => window.__skyStrike.world.weapons.missilesFired);
  check(5, 'missiles launch, home and hit', m.fired === 1 && m.left === 3 && m.hp === m.max - 60, `ammo 4->${m.left}, bomber hp ${m.max}->${m.hp}, double-press limited by cooldown=${m2 === 2}`);

  // flares: an incoming missile is decoyed and the count drops
  const fl = await G(page, () => {
    const g = window.__skyStrike, w = g.world, p = w.player; w.enemies.reset(); w.missiles.reset(); g.loop.stop();
    const m = w.missiles.launch(1, p.x + 250, p.y, Math.PI, 20, null);
    for (let i = 0; i < 20; i++) g.update(1 / 60);
    const threat = w.missiles.threats, warn = document.querySelector('.js-warn').classList.contains('on'), f0 = w.weapons.flares;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    g.update(1 / 60);
    const decoyed = !!m.decoy, f1 = w.weapons.flares, hp0 = p.hp;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); g.update(1 / 60);
    const cdBlocks = w.weapons.flares === f1;
    for (let i = 0; i < 420; i++) g.update(1 / 60);
    const r = { threat, warn, f0, f1, decoyed, cdBlocks, unharmed: p.hp === hp0, gone: !m.alive, threatsAfter: w.missiles.threats };
    g.loop.start(); return r;
  });
  check('5b', 'flares decoy incoming missiles (warning shown, limited stock, cooldown)', fl.threat === 1 && fl.warn && fl.f1 === fl.f0 - 1 && fl.decoyed && fl.cdBlocks && fl.unharmed && fl.threatsAfter === 0, JSON.stringify(fl));

  // T7 collisions and health
  const col = await G(page, () => {
    const g = window.__skyStrike, w = g.world, p = w.player; w.enemies.reset(); w.bullets.reset(); w.missiles.reset(); p.invuln = 0; p.shield = 0;
    const hp0 = p.hp;
    w.bullets.fire(p.x, p.y, 0, 10, 9, 1, 2, 5); w.bullets.fire(p.x + 2, p.y, 0, 10, 9, 1, 2, 5);     // two bullets in the same frame
    g.loop.stop(); g.update(1 / 60);
    const hp1 = p.hp, inv = p.invuln > 0, left = w.bullets.pool.active.length;
    for (let i = 0; i < 30; i++) { w.bullets.fire(p.x, p.y, 0, 10, 9, 1, 2, 5); g.update(1 / 60); }    // hits during invulnerability
    const hp2 = p.hp;
    p.invuln = 0; const e = w.enemies.spawn('fighter', p.x, p.y, 0); e.t = 0; const ehp = e.hp; g.update(1 / 60); const hp3 = p.hp; const ehp2 = e.alive ? e.hp : 0;
    w.pickups.reset();                                                                                      // a random repair drop would heal the player
    for (let i = 0; i < 20; i++) g.update(1 / 60); const hp4 = p.hp;                                        // still overlapping: no repeat damage
    w.enemies.reset(); p.invuln = 0; p.shield = 5; w.bullets.fire(p.x, p.y, 0, 10, 9, 1, 2, 5); g.update(1 / 60); const hp5 = p.hp; p.shield = 0;
    p.invuln = 0; const far = w.bullets.fire(p.x + 60, p.y, 0, 0, 9, 1, 2, 5); g.update(1 / 60); const miss = p.hp === hp5 && far.alive;
    p.hp = p.maxHp; w.bullets.reset(); g.loop.start();
    return { hp0, hp1, inv, left, hp2, hp3, ehp, ehp2, hp4, hp5, miss };
  });
  check(7, 'collision and health (single damage per hit, invulnerability, shield, fair hitbox)', col.hp1 === col.hp0 - 9 && col.inv && col.hp2 === col.hp1 && col.hp3 === col.hp1 - 14 && col.ehp2 < col.ehp && col.hp4 === col.hp3 && col.hp5 === col.hp4 && col.miss, JSON.stringify(col));

  // boost: SHIFT gives a short burst of speed and turn rate, then recharges
  const bo = await G(page, () => {
    const g = window.__skyStrike, w = g.world, p = w.player; g.loop.stop(); w.enemies.reset(); w.level.spawnT = 99; p.boostCd = 0; p.boostT = 0;
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' })); for (let i = 0; i < 40; i++) g.update(1 / 60);
    const fast = p.speed, on = p.boostT > 0;
    for (let i = 0; i < 120; i++) g.update(1 / 60); const after = p.speed, cd = p.boostCd;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' })); g.update(1 / 60); const blocked = p.boostT <= 0;
    g.loop.start(); return { fast: Math.round(fast), after: Math.round(after), on, cd: +cd.toFixed(1), blocked, top: p.stats.speed };
  });
  check('3c', 'boost: burst of speed, then cooldown', bo.on && bo.fast > bo.top * 1.4 && bo.after < bo.top * 1.05 && bo.cd > 1 && bo.blocked, JSON.stringify(bo));

  // T14 pause / resume / restart
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const pz = await G(page, () => ({ s: window.__skyStrike.state.current, t: window.__skyStrike.world.stats.time, x: window.__skyStrike.world.player.x }));
  await page.waitForTimeout(1000);
  const pz2 = await G(page, () => ({ t: window.__skyStrike.world.stats.time, x: window.__skyStrike.world.player.x }));
  const pauseShown = await on(page, 'pause');
  await page.click('[data-act=pause-settings]'); await page.waitForTimeout(200); await page.click('[data-act=settings-close]'); await page.waitForTimeout(200);
  await page.click('[data-act=resume]'); await page.waitForTimeout(700);
  const rs = await G(page, () => ({ s: window.__skyStrike.state.current, t: window.__skyStrike.world.stats.time }));
  await page.click('[data-act=pause]'); await page.waitForTimeout(200);
  await G(page, () => { window.__skyStrike.world.stats.score = 777; });
  await page.click('[data-act=restart]'); await page.waitForTimeout(500);
  const rst = await G(page, () => { const w = window.__skyStrike.world; return { s: window.__skyStrike.state.current, t: w.stats.time, score: w.stats.score, en: w.enemies.list.length, bul: w.bullets.pool.active.length, hp: w.player.hp, miss: w.weapons.missiles, pauseOn: document.querySelector('#s-pause').classList.contains('on') }; });
  check(14, 'pause, resume and restart', pz.s === 'paused' && pauseShown && pz2.t === pz.t && pz2.x === pz.x && rs.s === 'playing' && rs.t > pz.t + 0.4 && rst.s === 'playing' && rst.t < 1 && rst.score === 0 && rst.en === 0 && rst.hp === 100 && rst.miss === 4 && !rst.pauseOn, `frozen ${pz.t.toFixed(2)}=${pz2.t.toFixed(2)}, resumed to ${rs.t.toFixed(2)}, restart t=${rst.t.toFixed(2)} score=${rst.score}`);

  // visibility change -> auto pause
  const vis = await G(page, () => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); const s = window.__skyStrike.state.current; Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); return s; });
  await page.click('[data-act=resume]'); await page.waitForTimeout(200);

  // T6 enemy spawn + behaviour (level 2, real time)
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); await page.click('[data-act=quit]'); await page.waitForTimeout(300);
  await G(page, () => { const g = window.__skyStrike; g.save.data.unlockedLevel = 10; g.startLevel(2); g.world.player.damage = () => false; g.world.autofire = false; { const p = g.world.player; g.world.enemies.spawn('fighter', p.x + Math.cos(p.a) * 620, p.y + Math.sin(p.a) * 620, p.a + Math.PI); }
    window.__eb = 0; const f = g.world.bullets.fire.bind(g.world.bullets); g.world.bullets.fire = (...a) => { if (a[5] === 1) window.__eb++; return f(...a); }; });
  let sawEnemy = false, moved = false, shots = 0, minSpawn = 1e9, last = null;
  for (let i = 0; i < 48; i++) {
    await page.waitForTimeout(250);
    const s = await G(page, () => { const w = window.__skyStrike.world, p = w.player; return { en: w.enemies.list.map((e) => ({ uid: e.uid, x: e.x, y: e.y, t: e.t, d: Math.hypot(e.x - p.x, e.y - p.y) })), eb: window.__eb }; });
    if (s.en.length) sawEnemy = true;
    for (const e of s.en) { if (e.t < 0.3) minSpawn = Math.min(minSpawn, e.d); const prev = last && last.find((o) => o.uid === e.uid); if (prev && Math.hypot(prev.x - e.x, prev.y - e.y) > 10) moved = true; }
    shots = Math.max(shots, s.eb); last = s.en;
  }
  check(6, 'enemies spawn off-screen, move and shoot', sawEnemy && moved && shots > 0 && minSpawn > 400, `nearest spawn distance ${Math.round(minSpawn)}px, enemy bullets seen ${shots}`);

  // T19 loops / background gameplay
  await G(page, () => { const g = window.__skyStrike; delete g.world.bullets.fire; });
  const f0 = await G(page, () => { const g = window.__skyStrike; g.loop.start(); g.loop.start(); g.loop.start(); return g.loop.frames; });
  await page.waitForTimeout(2000);
  const f1 = await G(page, () => window.__skyStrike.loop.frames);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); await page.click('[data-act=quit]'); await page.waitForTimeout(300);
  const bg0 = await G(page, () => ({ t: window.__skyStrike.world.stats.time, run: window.__skyStrike.world.running, s: window.__skyStrike.state.current, inputOn: window.__skyStrike.input.enabled, track: window.__skyStrike.audio.track }));
  await page.waitForTimeout(800);
  const bg1 = await G(page, () => window.__skyStrike.world.stats.time);
  const fps = (f1 - f0) / 2;
  check(19, 'single game loop, no gameplay behind menus, auto-pause on tab switch', fps > 20 && fps < 75 && !bg0.run && bg0.t === bg1 && bg0.s === 'menu' && !bg0.inputOn && vis === 'paused', `${fps.toFixed(0)} frames/s after 3 extra start() calls, world.running=${bg0.run}, hidden tab -> ${vis}, music after quit=${bg0.track}`);

  // T16 + T12 victory / rewards / duplicate protection
  const rw = await G(page, () => {
    const g = window.__skyStrike, d = g.save.data; g.loop.stop();
    const run = (id, god) => { const before = d.coins; g.state.set('menu'); g.startLevel(id); window.__bot(g, { god }); g.world.player.damage = god ? () => false : Object.getPrototypeOf(g.world.player).damage; let n = 0; while (g.state.is('playing') && n++ < 400) window.__ff(g, 1); return { before, after: d.coins, res: g.world.stats.result, state: g.state.current, screen: g.ui.current }; };
    const a = run(1, true);
    const dupBefore = d.coins; g.onMissionEnd(true); g.world.finish(true); g.rewards.settle({ id: 1, reward: 100, par: 75 }, g.world.stats, true); const dupAfter = d.coins;
    const rec = { ...d.levels[1] }, unlocked = d.unlockedLevel;
    const b = run(1, true);                    // replay
    g.state.set('menu'); g.startLevel(3); g.world.player.damage = Object.getPrototypeOf(g.world.player).damage; window.__ff(g, 2); g.world.stats.coins = 40; g.world.player.invuln = 0; g.world.player.damage(9999, g.world); let n = 0; while (g.state.is('playing') && n++ < 30) window.__ff(g, 1);
    const c = { state: g.state.current, screen: g.ui.current, res: g.world.stats.result, hp: g.world.player.hp };
    g.loop.start();
    return { a, dupBefore, dupAfter, rec, unlocked, b, c };
  });
  const A = rw.a.res, B = rw.b.res;
  check(16, 'victory and game-over screens', rw.a.state === 'complete' && rw.a.screen === 'victory' && rw.c.state === 'gameover' && rw.c.screen === 'gameover' && rw.c.res.won === false, `win->${rw.a.screen}, death->${rw.c.screen}`);
  check(12, 'coins and stars awarded correctly, no duplicate rewards', A.levelReward === 100 && A.firstClear && rw.a.after - rw.a.before === A.total && A.total === A.missionCoins + A.levelReward + A.flawless + A.starBonus && rw.rec.stars === A.stars && rw.dupAfter === rw.dupBefore && B.levelReward === 35 && !B.firstClear && B.starBonus === 0 && rw.c.res.total === 20,
    `first clear +${A.total} (reward ${A.levelReward}, combat ${A.missionCoins}, flawless ${A.flawless}, stars ${A.starBonus}), ${A.stars} stars; repeat triggers paid ${rw.dupAfter - rw.dupBefore}; replay reward ${B.levelReward}; defeat keeps ${rw.c.res.total}/40`);
  await page.waitForTimeout(300);
  await page.click('#s-gameover [data-act=restart]'); await page.waitForTimeout(400);
  const retry = await G(page, () => window.__skyStrike.state.current);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); await page.click('[data-act=quit]'); await page.waitForTimeout(300);

  // T10 aircraft unlocking
  const un = await G(page, () => {
    const g = window.__skyStrike, d = g.save.data, U = g.upgrades, out = [];
    d.levels = {}; d.coins = 0; d.aircraft = { ember: d.aircraft.ember }; d.selected = 'ember';
    const ids = ['streak', 'bruiser', 'wisp', 'hailstorm', 'manta', 'warden', 'bastion', 'ravager'];
    let ok = true;
    const blockedNoLevel = U.buyAircraft('streak').ok === false;
    for (let i = 0; i < ids.length; i++) {
      const lv = i + 1; d.levels[lv] = { stars: 3, best: 1, done: true };
      d.coins = 0; if (U.buyAircraft(ids[i]).ok) ok = false;           // cannot buy without coins
      d.coins = 99999; const before = d.coins; const r = U.buyAircraft(ids[i]);
      if (!r.ok || !U.isOwned(ids[i]) || before - d.coins <= 0) { ok = false; out.push(ids[i] + ':' + r.reason); }
      if (U.buyAircraft(ids[i]).ok) ok = false;                        // cannot buy twice
    }
    const domBlocked = !U.buyAircraft('zenith').ok && !U.isOwned('zenith');
    return { ok, blockedNoLevel, domBlocked, owned: U.ownedCount(), out };
  });
  // the tenth aircraft is granted by really finishing mission 10
  const dom = await G(page, () => { const g = window.__skyStrike, d = g.save.data; g.loop.stop(); d.unlockedLevel = 10; g.state.set('menu'); g.startLevel(10); window.__bot(g, { god: true }); let n = 0; while (g.state.is('playing') && n++ < 600) window.__ff(g, 1); g.loop.start(); return { state: g.state.current, owned: g.upgrades.isOwned('zenith'), count: g.upgrades.ownedCount(), unlocked: g.world.stats.result && g.world.stats.result.unlocked, sel: g.upgrades.select('zenith') }; });
  check(10, 'all ten aircraft can be unlocked', un.ok && un.blockedNoLevel && un.domBlocked && un.owned === 9 && dom.owned && dom.count === 10 && dom.unlocked === 'zenith' && dom.sel, `9 bought with coins (requirements enforced), ZENITH granted by Mission 10 (${dom.state}), owned ${dom.count}/10`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/claude/qa/s-campaign-complete.png' });
  await page.click('#s-victory [data-act=continue]'); await page.waitForTimeout(400);

  // T11 upgrades through the UI
  await G(page, () => { const g = window.__skyStrike; g.save.data.coins = 500; g.upgrades.select('ember'); g.enterMenu(); });
  await page.waitForTimeout(300); await page.click('[data-act=upgrades]'); await page.waitForTimeout(400);
  const u0 = await G(page, () => { const g = window.__skyStrike; return { s: g.upgrades.stats('ember'), coins: g.save.data.coins }; });
  for (const id of ['engine', 'weapon', 'fireRate', 'armour', 'missile']) { await page.click(`[data-act=hg-up][data-up=${id}]`); await page.waitForTimeout(120); }
  const u1 = await G(page, () => { const g = window.__skyStrike; return { s: g.upgrades.stats('ember'), coins: g.save.data.coins, lv: g.save.data.aircraft.ember.up, shown: document.querySelector('#s-hangar .js-coins').textContent }; });
  await G(page, () => { window.__skyStrike.save.data.coins = 5; });
  await page.click('[data-act=hg-up][data-up=engine]'); await page.waitForTimeout(150);
  const u2 = await G(page, () => ({ lv: window.__skyStrike.save.data.aircraft.ember.up.engine, coins: window.__skyStrike.save.data.coins }));
  const inGame = await G(page, () => { const g = window.__skyStrike; g.startLevel(1); const p = g.world.player; const r = { hp: p.maxHp, speed: p.stats.speed, dmg: p.stats.damage }; g.pause(); g.enterMenu(); return r; });
  check(11, 'upgrades work and update statistics', u1.s.speed > u0.s.speed && u1.s.damage > u0.s.damage && u1.s.fireRate > u0.s.fireRate && u1.s.hp > u0.s.hp && u1.s.missileDmg > u0.s.missileDmg && u1.coins === 500 - 300 && u1.shown === '200' && u2.lv === 1 && u2.coins === 5 && inGame.hp === 112 && Math.abs(inGame.speed - 225.75) < 0.01,
    `5 upgrades cost ${u0.coins - u1.coins}; speed ${u0.s.speed}->${u1.s.speed.toFixed(1)}, dmg ${u0.s.damage}->${u1.s.damage.toFixed(1)}, hp ${u0.s.hp}->${u1.s.hp}; unaffordable purchase refused; in-mission max hp ${inGame.hp}`);

  // T13 persistence across a browser refresh
  const before = await G(page, () => { const g = window.__skyStrike; g.save.data.coins = 1234; g.upgrades.select('streak'); g.save.data.settings.music = 0.3; g.save.save(); return JSON.stringify(g.save.data); });
  await page.reload(); await page.waitForSelector('#s-loading.ready'); await page.click('[data-act=start]', { force: true }); await page.waitForTimeout(400);
  const afterReload = await G(page, () => JSON.stringify(window.__skyStrike.save.data));
  const shownCoins = await page.evaluate(() => document.querySelector('#s-menu .js-coins').textContent);
  // corrupted + hostile saves
  const corrupt = [];
  for (const bad of ['{not json', '[]', '{"v":1,"coins":"lots","unlockedLevel":99,"selected":"ufo","aircraft":{"ravager":{"owned":true,"up":{"engine":77}}},"settings":{"quality":"ultra","music":9}}']) {
    await page.evaluate((b) => localStorage.setItem('skystrike.save', b), bad);
    await page.reload(); await page.waitForSelector('#s-loading.ready'); await page.click('[data-act=start]', { force: true }); await page.waitForTimeout(300);
    corrupt.push(await G(page, () => { const d = window.__skyStrike.save.data; return d.coins === 0 && d.unlockedLevel >= 1 && d.unlockedLevel <= 15 && d.selected === 'ember' && d.aircraft.ember.owned && d.settings.music <= 1 && ['low', 'medium', 'high'].includes(d.settings.quality) && (!d.aircraft.ravager || d.aircraft.ravager.up.engine <= 5) && window.__skyStrike.state.current === 'menu'; }));
  }
  check(13, 'progress saves across refresh; corrupted saves handled', before === afterReload && shownCoins === '1,234' && corrupt.every(Boolean), `identical after reload=${before === afterReload}, corrupted cases recovered=${corrupt.join('/')}`);

  // reset progress with confirmation
  await G(page, () => { const g = window.__skyStrike; g.save.data.coins = 900; g.save.save(); g.enterMenu(); });
  await page.click('[data-act=settings]'); await page.waitForTimeout(200); await page.click('[data-act=reset]'); await page.waitForTimeout(200);
  await page.click('[data-act=confirm-no]'); await page.waitForTimeout(150);
  const keep = await G(page, () => window.__skyStrike.save.data.coins);
  await page.click('[data-act=reset]'); await page.waitForTimeout(200); await page.click('[data-act=confirm-yes]'); await page.waitForTimeout(300);
  const wiped = await G(page, () => ({ c: window.__skyStrike.save.data.coins, stored: JSON.parse(localStorage.getItem('skystrike.save')).coins }));
  check('13b', 'reset progress asks for confirmation', keep === 900 && wiped.c === 0 && wiped.stored === 0, `cancel keeps ${keep}, confirm -> ${wiped.c}`);

  // chapter two: terrain mission, survive objective, assist after a failure
  await page.evaluate(BOT);
  const ch2 = await G(page, () => {
    const g = window.__skyStrike, d = g.save.data; g.loop.stop(); d.unlockedLevel = 15; d.fails = {};
    g.state.set('menu'); g.startLevel(13); window.__bot(g, { god: true });
    const theme = g.background.themeName, ground = !!g.background.ground;
    let n = 0; while (g.state.is('playing') && n++ < 200) window.__ff(g, 1);
    const surv = { state: g.state.current, t: Math.round(g.world.stats.time) };
    g.state.set('menu'); g.startLevel(12); g.world.player.damage = Object.getPrototypeOf(g.world.player).damage; window.__ff(g, 1); g.world.player.invuln = 0; g.world.player.damage(9999, g.world); n = 0; while (g.state.is('playing') && n++ < 30) window.__ff(g, 1);
    const fails1 = d.fails[12]; g.state.set('menu'); g.startLevel(12); const eased = g.world.level.fireMul; g.pause(); g.enterMenu(); g.loop.start();
    return { theme, ground, surv, fails1, eased };
  });
  check('8b', 'chapter two: terrain mission loads, survive objective ends on time, assist eases retries', ch2.ground && ch2.theme === 'battlefield' && ch2.surv.state === 'complete' && ch2.surv.t >= 119 && ch2.surv.t <= 123 && ch2.fails1 === 1 && ch2.eased < 1.15 * 0.91, JSON.stringify(ch2));

  // T15 audio
  const au = await G(page, async () => {
    const g = window.__skyStrike, a = g.audio; let tones = 0, noises = 0;
    const t0 = a._tone.bind(a), n0 = a._noise.bind(a); a._tone = (...x) => { tones++; return t0(...x); }; a._noise = (...x) => { noises++; return n0(...x); };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { ctx: a.ctx && a.ctx.state, menuTrack: a.track };
    await wait(700); out.menuNotes = tones + noises;
    g.save.data.unlockedLevel = 10; g.startLevel(1); out.gameTrack = a.track; await wait(600);
    const names = ['shoot', 'missile', 'enemyShoot', 'explodeS', 'explodeL', 'hurt', 'shield', 'coin', 'star', 'click', 'swoosh', 'levelStart', 'victory', 'warning', 'bossBoom', 'powerup', 'heal', 'hit', 'missileHit', 'bomb', 'phase', 'flare', 'lock', 'boost'];
    out.sfxOk = 0; for (const n of names) { if (n === 'victory') { a.jingle('victory'); a.playMusic('game'); out.sfxOk++; continue; } const b = tones + noises; a.last = {}; a.sfx(n); if (tones + noises > b) out.sfxOk++; }
    out.sfxTotal = names.length;
    let b = tones + noises; for (let i = 0; i < 20; i++) a.sfx('shoot'); out.throttled = tones + noises - b;      // 20 calls in one tick -> 1 sound
    g.pause(); await wait(400); b = tones + noises; await wait(900); out.pausedNotes = tones + noises - b; out.loopGainPaused = a.loopGain.gain.value;
    g.resume(); await wait(700); out.resumedNotes = tones + noises - b;
    g.onBossWarning({ name: 'X' }); out.bossTrack = a.track;
    g.pause(); g.enterMenu(); out.afterQuit = a.track; out.paused = a.paused;
    a.setMusicVolume(0); out.musicBus0 = a.musicVol; a.setSfxVolume(0); b = tones + noises; a.last = {}; a.sfx('coin'); out.mutedSfx = tones + noises - b; a.setMusicVolume(0.6); a.setSfxVolume(0.8);
    return out;
  });
  check(15, 'music and sound effects (Web Audio graph verified; not audible in headless)', au.ctx === 'running' && au.menuTrack === 'menu' && au.menuNotes > 0 && au.gameTrack === 'game' && au.sfxOk === au.sfxTotal && au.throttled <= 2 && au.pausedNotes === 0 && au.resumedNotes > 0 && au.bossTrack === 'boss' && au.afterQuit === 'menu' && au.mutedSfx === 0,
    `ctx=${au.ctx}, tracks menu/game/boss ok, ${au.sfxOk}/${au.sfxTotal} effects synthesise, 20 rapid shots -> ${au.throttled} voices, notes while paused=${au.pausedNotes}, after resume=${au.resumedNotes}`);

  allErrs.push(...errs);
  await browser.close();
}

// ---------- touch session (mobile emulation) ----------
{
  const { browser, ctx, page, errs } = await open({ touch: true, viewport: { width: 390, height: 844 }, dpr: 2 });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id || 0 })) });
  await page.tap('[data-act=campaign]'); await page.waitForTimeout(300); await page.tap('[data-act=level][data-id="1"]'); await page.waitForTimeout(250); await page.tap('[data-act=brief-go]'); await page.waitForTimeout(700);
  const a0 = await G(page, () => { const g = window.__skyStrike; g.world.autofire = false; g.world.level.spawnT = 99; return g.world.player.a; });
  // drag the virtual stick to the right, while a second finger holds FIRE
  await touch('touchStart', [[90, 700, 1]]); await touch('touchMove', [[150, 700, 1]]);
  const fireBox = await page.evaluate(() => { const r = document.querySelector('.js-fire').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await touch('touchStart', [[150, 700, 1], [fireBox[0], fireBox[1], 2]]);
  await page.waitForTimeout(900);
  const mid = await G(page, () => { const g = window.__skyStrike, i = g.input; return { joy: i.joy.active, mx: i.mx, fire: i.fire, a: g.world.player.a, shots: g.world.weapons.shotsFired, usedTouch: i.usedTouch }; });
  await touch('touchMove', [[90, 760, 1], [fireBox[0], fireBox[1], 2]]); await page.waitForTimeout(900);
  const dn = await G(page, () => window.__skyStrike.world.player.a);
  await touch('touchEnd', []); await page.waitForTimeout(200);
  const rel = await G(page, () => { const i = window.__skyStrike.input; return { joy: i.joy.active, fire: i.fire, mx: i.mx }; });
  const mBefore = await G(page, () => window.__skyStrike.world.weapons.missiles);
  await page.tap('.js-missile'); await page.waitForTimeout(150); await page.tap('.js-special'); await page.waitForTimeout(150);
  const flB = await G(page, () => window.__skyStrike.world.weapons.flares); await page.tap('.js-flare'); await page.waitForTimeout(150); const flA = await G(page, () => window.__skyStrike.world.weapons.flares);
  await page.tap('.js-boost'); await page.waitForTimeout(150); const bst = await G(page, () => { const p = window.__skyStrike.world.player; return { on: p.boostT > 0, cd: p.boostCd > 0, n: p.boosts }; }); await page.tap('.js-boost'); await page.waitForTimeout(100); const bst2 = await G(page, () => window.__skyStrike.world.player.boosts);
  const acts = await G(page, () => { const w = window.__skyStrike.world.weapons; return { m: w.missiles, sp: w.special, spread: window.__skyStrike.world.player.spreadT > 0 }; });
  await page.screenshot({ path: '/home/claude/qa/s-touch.png' });
  await page.tap('[data-act=pause]'); await page.waitForTimeout(250);
  const paused = await G(page, () => window.__skyStrike.state.current);
  const scroll = await page.evaluate(() => ({ sx: window.scrollX, sy: window.scrollY, overflow: document.documentElement.scrollHeight > window.innerHeight + 1, vp: document.querySelector('meta[name=viewport]').content }));
  check('3b', 'touch controls: stick, multi-touch fire, missile, special, pause', mid.joy && mid.mx > 0.9 && mid.fire && Math.abs(mid.a) < 0.25 && mid.shots >= 3 && Math.abs(dn - Math.PI / 2) < 0.3 && !rel.joy && !rel.fire && acts.m === mBefore - 1 && acts.sp === 1 && acts.spread && flA === flB - 1 && bst.on && bst.cd && bst.n === 1 && bst2 === 1 && paused === 'paused' && !scroll.overflow && scroll.sy === 0,
    `stick right: heading ${a0.toFixed(2)}->${mid.a.toFixed(2)}, down->${dn.toFixed(2)}; ${mid.shots} shots with second finger; missile ${mBefore}->${acts.m}; special used; no page scroll`);
  allErrs.push(...errs);
  await browser.close();
}

// ---------- window sizes ----------
{
  const sizes = [[320, 480], [360, 640], [390, 844], [412, 915], [360, 800], [768, 1024], [1024, 768], [1366, 768], [1920, 1080], [844, 390]];
  const { browser, page, errs } = await open({ viewport: { width: 400, height: 800 } });
  let ok = true; const notes = [];
  await G(page, () => { const g = window.__skyStrike; g.startLevel(1); });
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const app = document.getElementById('app').getBoundingClientRect(), c = document.getElementById('game'), g = window.__skyStrike;
      const inside = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return b.left >= app.left - 1 && b.right <= app.right + 1 && b.top >= app.top - 1 && b.bottom <= app.bottom + 1 && b.width > 0; };
      const fire = document.querySelector('.js-fire').getBoundingClientRect();
      return { aw: app.width, ah: app.height, fits: app.left >= -0.5 && app.right <= innerWidth + 0.5 && app.top >= -0.5 && app.bottom <= innerHeight + 0.5, ratio: app.width / app.height,
        canvasMatch: Math.abs(c.width / c.height - app.width / app.height) < 0.01, viewH: g.view.h, ctrl: inside('.js-fire') && inside('.js-missile') && inside('.js-special') && inside('.js-flare') && inside('.js-boost') && inside('.js-joy') && inside('.hud-pause') && inside('.js-time') && inside('.js-score'), fireCss: fire.width, scroll: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight };
    });
    // portrait windows keep the phone-shaped area; landscape windows (laptops, phones on their side) use the full screen
    const land = w > h * 1.05;
    const shape = land ? r.ratio >= 1.05 && r.ratio <= 2.41 && Math.round(r.ah) === h : r.ratio <= 9 / 14.5 + 0.01 && r.ratio >= 9 / 21 - 0.01;
    const good = r.fits && r.canvasMatch && r.ctrl && !r.scroll && shape && r.fireCss >= 44;
    if (!good) { ok = false; }
    notes.push(`${w}x${h}->${Math.round(r.aw)}x${Math.round(r.ah)}${good ? '' : ' FAIL ' + JSON.stringify(r)}`);
    if ([320, 768, 1366, 844].includes(w)) await page.screenshot({ path: `/home/claude/qa/s-size-${w}x${h}.png` });
  }
  check(17, 'works at different window sizes', ok, notes.join(', '));
  allErrs.push(...errs);
  await browser.close();
}
check(18, 'no console errors across all sessions', allErrs.length === 0, allErrs.slice(0, 5).join(' | '));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
