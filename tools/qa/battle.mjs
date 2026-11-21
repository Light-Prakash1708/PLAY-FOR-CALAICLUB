// Team Battle checks. Run with the game served on port 8765:  node tools/qa/battle.mjs
import { open } from './lib.mjs';
const results = [];
const check = (name, ok, note = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  [' + note + ']' : ''}`); };
const allErrs = [];
const SHOTS = '/home/claude/qa/';

{ // laptop, keyboard
  const { browser, page, errs } = await open({ viewport: { width: 1366, height: 768 } });
  await page.click('[data-act=battle]', { force: true }); await page.waitForTimeout(300);
  const setup = await page.evaluate(() => ({ cur: window.__skyStrike.ui.current, maps: document.querySelectorAll('.bs-map').length, modes: document.querySelectorAll('.bs-mode').length }));
  check('B1 setup: one controller, 6 battlegrounds, no 2-player modes', setup.cur === 'bsetup' && setup.maps === 6 && setup.modes === 0, JSON.stringify(setup));
  await page.screenshot({ path: SHOTS + 'v5-setup-laptop.png' });
  // remap fire to X and shield to G through the Controls dialog
  await page.click('#s-bsetup [data-act=controls]', { force: true }); await page.waitForTimeout(200);
  await page.click('.ct-key[data-a=fire][data-slot="0"]'); await page.keyboard.press('KeyX'); await page.waitForTimeout(100);
  await page.click('.ct-key[data-a=shield][data-slot="0"]'); await page.keyboard.press('KeyG'); await page.waitForTimeout(100);
  await page.click('.ct-key[data-a=missile][data-slot="0"]'); await page.keyboard.press('KeyG'); await page.waitForTimeout(100);  // G moves to missile, shield loses it
  await page.click('.js-fm button[data-id=hold]'); await page.waitForTimeout(100);
  await page.screenshot({ path: SHOTS + 'v5-controls.png' });
  const keys = await page.evaluate(() => { const s = window.__skyStrike.save.data.settings; return { fire: s.keys.fire, shield: s.keys.shield, missile: s.keys.missile, mode: s.fireMode }; });
  check('B2 controls dialog remaps keys (no duplicates) and sets fire mode', keys.fire[0] === 'KeyX' && keys.missile[0] === 'KeyG' && keys.shield[0] === '' && keys.mode === 'hold', JSON.stringify(keys));
  await page.click('[data-act=controls-close]', { force: true }); await page.waitForTimeout(150);
  await page.click('[data-act=bfight]', { force: true }); await page.waitForTimeout(500);
  const intro = await page.evaluate(() => { const w = window.__skyStrike.battle; return { phase: w.phase, n: w.fighters.length, humans: w.humans.length }; });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: SHOTS + 'v5-play-laptop.png' });
  check('B3 3v3 by default, single human, countdown then play', intro.phase === 'intro' && intro.n === 6 && intro.humans === 1 && await page.evaluate(() => window.__skyStrike.battle.phase) === 'play', JSON.stringify(intro));
  await page.keyboard.down('KeyS'); await page.waitForTimeout(700); await page.keyboard.up('KeyS');
  const heading = await page.evaluate(() => +window.__skyStrike.battle.humans[0].a.toFixed(2));
  await page.evaluate(() => { const me = window.__skyStrike.battle.humans[0]; me.ammo0 = me.ammo; me.heat = 0; me.overheat = false; });
  await page.keyboard.down('KeyX'); await page.waitForTimeout(500); await page.keyboard.up('KeyX');
  const fired = await page.evaluate(() => { const me = window.__skyStrike.battle.humans[0]; return me.ammo0 - me.ammo; });
  await page.evaluate(() => { const me = window.__skyStrike.battle.humans[0]; me.ammo0 = me.ammo; });
  await page.keyboard.down('Space'); await page.waitForTimeout(400); await page.keyboard.up('Space');
  const oldKey = await page.evaluate(() => { const me = window.__skyStrike.battle.humans[0]; return me.ammo0 - me.ammo; });
  check('B4 remapped keys work in battle (X fires, old SPACE no longer does)', Math.abs(heading - 1.57) < 0.05 && fired >= 2 && oldKey === 0, JSON.stringify({ heading, fired, oldKey }));
  const lim = await page.evaluate(() => {
    const g = window.__skyStrike, w = g.battle, me = w.humans[0]; g.loop.stop();
    for (const f of w.fighters) if (f !== me) { f.alive = false; f.respawnT = 99; }
    me.invuln = 0; me.heat = 0; me.overheat = false; me.ammo = me.maxAmmo;
    const cmd = { steer: false, angle: me.a, throttle: 1, fire: true };
    const a0 = me.ammo; for (let i = 0; i < 300 && !me.overheat; i++) me.update(1 / 60, cmd, w);
    const shots = a0 - me.ammo, over = me.overheat;
    const a1 = me.ammo; for (let i = 0; i < 30; i++) me.update(1 / 60, cmd, w); const blocked = me.ammo === a1;
    let m = 0; cmd.fire = false; for (let i = 0; i < 20; i++) { me.missileCd = 0; if (me.fireMissile(w)) m++; }
    g.loop.start(); return { shots, over, blocked, missiles: m, max: me.maxMissiles };
  });
  check('B5 gun overheats, missiles limited', lim.over && lim.shots >= 12 && lim.shots <= 18 && lim.blocked && lim.missiles === lim.max, JSON.stringify(lim));
  const sh = await page.evaluate(() => {
    const g = window.__skyStrike, w = g.battle, me = w.humans[0], foe = w.fighters.find((f) => f.team === 1); g.loop.stop();
    foe.spawn(me.x + 60, me.y, 0); me.invuln = 0; me.hp = me.maxHp;
    const up = me.raiseShield(w), hp0 = me.hp;
    me.damage(30, foe, w, me.x + 5, me.y, 'missile'); const blocked = me.hp === hp0;
    const again = me.raiseShield(w);
    for (let i = 0; i < 60 * 4; i++) me.update(1 / 60, { steer: false, angle: me.a, throttle: 1 }, w);
    const off = me.shieldT <= 0; me.damage(10, foe, w, me.x, me.y, 'bullet');
    g.loop.start(); return { up, blocked, againBlocked: !again, off, hurtAfter: me.hp < hp0, cd: Math.round(me.shieldCd) };
  });
  check('B6 shield blocks hits for a few seconds, then recharges', sh.up && sh.blocked && sh.againBlocked && sh.off && sh.hurtAfter && sh.cd > 5, JSON.stringify(sh));
  const dmg = await page.evaluate(() => {
    const g = window.__skyStrike, w = g.battle, me = w.humans[0], foe = w.fighters.find((f) => f.team === 1); g.loop.stop();
    foe.spawn(me.x + 40, me.y, 0); foe.invuln = 0; me.invuln = 0; me.shieldT = 0; me.hp = me.maxHp;
    const hp0 = me.hp; me.damage(10, foe, w, me.x + 5, me.y, 'bullet');
    const r = { hit: me.hp < hp0, flash: me.hitT > 0, wobble: me.wobble > 0, dir: w.dmgDirs.length > 0, credit: me.lastHitBy === foe };
    const s0 = w.score[1]; me.damage(999, foe, w, me.x, me.y, 'missile');
    r.dead = !me.alive; r.scored = w.score[1] === s0 + 1; r.feed = w.feed.length > 0;
    for (let i = 0; i < 60 * 5; i++) g.update(1 / 60);
    r.back = me.alive; g.loop.start(); return r;
  });
  check('B7 damage feedback, kill credit, kill feed, respawn', Object.values(dmg).every(Boolean), JSON.stringify(dmg));
  const zone = await page.evaluate(() => {
    const g = window.__skyStrike, w = g.battle, me = w.humans[0]; g.loop.stop();
    const r0 = w.zone.r; for (let i = 0; i < 60 * 40; i++) w.zone.update(1 / 60);
    me.invuln = 0; me.shieldT = 0; me.hp = me.maxHp; me.x = w.zone.cx + w.zone.r + 300; me.y = w.zone.cy;
    const hp0 = me.hp; w.zoneTick = 0; g.update(1 / 60);
    const r = { shrank: w.zone.r < r0, burns: me.hp < hp0 }; g.loop.start(); return r;
  });
  check('B8 zone shrinks and burns aircraft outside it', zone.shrank && zone.burns, JSON.stringify(zone));
  const end = await page.evaluate(() => {
    const g = window.__skyStrike, w = g.battle, d = g.save.data, c0 = d.coins; g.loop.stop();
    w.score = [19, 3]; const foe = w.fighters.find((f) => f.team === 1);
    foe.spawn(0, 0, 0); foe.invuln = 0;
    foe.damage(9999, w.humans[0], w, foe.x, foe.y, 'bullet');
    for (let i = 0; i < 60 * 6 && g.state.current === 'playing'; i++) g.update(1 / 60);
    g.loop.start(); return { state: g.state.current, title: w.result && w.result.title, coins: d.coins - c0 };
  });
  await page.waitForTimeout(400);
  check('B9 first to the kill target wins, results and coins', end.state === 'complete' && end.title === 'VICTORY' && end.coins > 0 && await page.evaluate(() => document.getElementById('s-bresult').classList.contains('on')), JSON.stringify(end));
  // cockpit view: V switches, the frame renders, left/right turns the nose
  await page.click('#s-bresult [data-act=brestart]', { force: true }); await page.waitForTimeout(5700);
  await page.keyboard.press('KeyV'); await page.waitForTimeout(300);
  const a0 = await page.evaluate(() => window.__skyStrike.battle.humans[0].a);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
  const ck = await page.evaluate((a0) => { const w = window.__skyStrike.battle, me = w.humans[0]; return { v3d: w.view3d, turned: me.alive ? Math.abs(me.a - a0) > 0.5 : true, label: document.querySelector('.js-vlabel').textContent }; }, a0);
  await page.screenshot({ path: SHOTS + 'v6-cockpit.png' });
  await page.keyboard.press('KeyV'); await page.waitForTimeout(200);
  const back = await page.evaluate(() => window.__skyStrike.battle.view3d);
  check('B16 cockpit view toggles with V and steers relative to the nose', ck.v3d && ck.turned && ck.label === 'MAP' && back === false, JSON.stringify({ ...ck, back }));
  await page.evaluate(() => { const g = window.__skyStrike, w = g.battle; g.loop.stop(); w.score = [13, 0]; const foe = w.fighters.find((f) => f.team === 1); foe.spawn(0, 0, 0); foe.invuln = 0; foe.damage(9999, w.humans[0], w, 0, 0, 'bullet'); for (let i = 0; i < 60 * 6 && g.state.current === 'playing'; i++) g.update(1 / 60); g.loop.start(); });
  await page.waitForTimeout(400);
  await page.click('#s-bresult [data-act=bchallenge]', { force: true }); await page.waitForTimeout(200);
  const link = await page.evaluate(() => document.querySelector('.js-ivl').value);
  check('B10 challenge link generated from the result', /#join=[A-Za-z0-9_-]+$/.test(link), link.slice(-40));
  await page.click('[data-act=invite-close]', { force: true });
  await page.click('#s-bresult [data-act=brestart]', { force: true }); await page.waitForTimeout(300);
  const again = await page.evaluate(() => { const g = window.__skyStrike; return { state: g.state.current, score: g.battle.score, phase: g.battle.phase }; });
  check('B11 play again starts a clean round', again.state === 'playing' && again.score[0] === 0 && again.phase === 'intro', JSON.stringify(again));
  const tie = await page.evaluate(() => {
    const g = window.__skyStrike, w = g.battle; g.loop.stop();
    w.phase = 'play'; w.score = [5, 5]; w.roundT = 0.01; g.update(1 / 60);
    const r = { sudden: w.sudden, target: w.mode.killTarget };
    for (let i = 0; i < 60 * 25 && g.state.current === 'playing'; i++) { w.score = [5, 5]; g.update(1 / 60); }
    r.title = w.result && w.result.title; g.loop.start(); return r;
  });
  check('B12 tie goes to sudden death, then draw', tie.sudden && tie.target === 6 && tie.title === 'DRAW', JSON.stringify(tie));
  // a friend opens the challenge link
  const friend = await page.context().newPage();
  friend.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await friend.goto(link.replace(/^.*?#/, 'http://localhost:8765/index.html#'));
  await friend.waitForSelector('#s-loading.ready', { timeout: 20000 });
  await friend.click('[data-act=start]', { force: true }); await friend.waitForTimeout(600);
  await friend.screenshot({ path: SHOTS + 'v5-invite.png' });
  const inv = await friend.evaluate(() => ({ cur: window.__skyStrike.ui.current, chal: document.querySelector('.js-chal').textContent, hash: location.hash }));
  check('B13 opening the link lands in setup with the challenge', inv.cur === 'bsetup' && /Beat it/.test(inv.chal) && inv.hash === '', JSON.stringify(inv));
  allErrs.push(...errs); await browser.close();
}

{ // phone, real touch events through CDP
  const { browser, page, errs } = await open({ viewport: { width: 390, height: 844 }, touch: true, dpr: 2, stayOnLoading: true });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id || 0 })) });
  const tap = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await touch('touchStart', [[b.x + b.width / 2, b.y + b.height / 2]]); await touch('touchEnd', []); await page.waitForTimeout(450); };
  await tap('[data-act=start]'); await tap('[data-act=battle]');
  await page.screenshot({ path: SHOTS + 'v5-setup-phone.png' });
  await tap('[data-act=bfight]');
  await page.waitForTimeout(1500);
  await touch('touchStart', [[90, 680]]);                                   // finger down during the countdown
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[91, 680 + i * 6]]); await page.waitForTimeout(25); }
  await page.waitForTimeout(4600);
  const a1 = await page.evaluate(() => +window.__skyStrike.battle.humans[0].a.toFixed(2));
  const sb = await page.locator('.js-bshield').boundingBox();
  await touch('touchStart', [[91, 740, 0], [sb.x + sb.width / 2, sb.y + sb.height / 2, 1]]); await page.waitForTimeout(100);
  await touch('touchEnd', [[91, 740, 0]]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [[91, 740 - i * 12, 0]]); await page.waitForTimeout(25); }
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => { const me = window.__skyStrike.battle.humans[0]; return { a: +me.a.toFixed(2), shield: me.shieldT > 0 || me.shieldCd > 10 }; });
  await page.screenshot({ path: SHOTS + 'v5-play-phone.png' });
  await touch('touchEnd', []);
  check('B14 phone: stick works even if pressed during countdown; shield button with a second finger', Math.abs(a1 - 1.57) < 0.25 && Math.abs(r.a + 1.57) < 0.25 && r.shield, JSON.stringify({ a1, ...r }));
  allErrs.push(...errs); await browser.close();
}

// campaign: story radio, radar and the boss zone
{
  const { browser, page, errs } = await open({ viewport: { width: 1366, height: 768 } });
  const r = await page.evaluate(() => {
    const g = window.__skyStrike; g.save.data.unlockedLevel = 15; g.startLevel(5); g.loop.stop();
    for (let i = 0; i < 30; i++) g.update(1 / 60);
    const said = g.radio.cur && g.radio.cur.id;
    const radar = getComputedStyle(document.querySelector('.js-radar')).display !== 'none';
    const w = g.world, lm = w.level; lm.kills = 999;
    for (let i = 0; i < 60 * 8 && !w.zoneOn; i++) { w.player.invuln = 9; g.update(1 / 60); }
    for (let i = 0; i < 60 * 6; i++) { w.player.invuln = 9; g.update(1 / 60); }
    g.loop.start();
    return { said, radar, zoneOn: w.zoneOn, arenaR: Math.round(w.arenaR), boss: !!w.boss };
  });
  check('B17 campaign: story radio line, radar map, closing zone in boss fights', r.said === 'm5.start' && r.radar && r.zoneOn && r.boss && r.arenaR < 1700, JSON.stringify(r));
  allErrs.push(...errs); await browser.close();
}

check('B15 no console errors', allErrs.length === 0, allErrs.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} battle checks passed`);
