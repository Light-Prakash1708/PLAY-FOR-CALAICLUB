// Two browsers play an online battle through a local PeerServer (node tools/qa/peer-server.cjs).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const URL = 'http://localhost:8765/index.html?peer=127.0.0.1:9000';
const results = []; const check = (name, ok, info) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${info !== undefined ? JSON.stringify(info) : ''}`); };
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
async function player(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(URL); await page.waitForSelector('#s-loading.ready', { timeout: 20000 });
  await page.click('[data-act=start]', { force: true }); await page.waitForTimeout(200);
  await page.evaluate(() => window.__skyStrike.finishIntro()); await page.waitForTimeout(300);
  await page.click('[data-act=battle]', { force: true }); await page.waitForTimeout(300);
  return { ctx, page, errs };
}
const H = await player({ width: 1280, height: 720 }), G = await player({ width: 390, height: 844 });
await H.page.fill('#s-bsetup .js-name', 'PRAKASH').catch(() => {});
await G.page.evaluate(() => { window.__skyStrike.save.data.battle.name = 'RAHUL'; });

// host opens a room
await H.page.click('[data-act=binvite]', { force: true }); await H.page.waitForTimeout(200);
await H.page.click('[data-act=onhost]', { force: true });
await H.page.waitForFunction(() => window.__skyStrike.net.status === 'waiting', null, { timeout: 15000 });
const code = await H.page.evaluate(() => window.__skyStrike.net.code);
const shown = await H.page.textContent('.js-oncodebig');
check('O1 host gets a 6-letter room code and link', code.length === 6 && shown === code, { code, link: await H.page.inputValue('.js-onlink') });

// copy button works (falls back when the Clipboard API is blocked)
await H.page.click('[data-act=oncopycode]', { force: true }); await H.page.waitForTimeout(150);
check('O2 copy code button reports success', (await H.page.textContent('.js-occ')) === 'COPIED!', await H.page.textContent('.js-occ'));

// guest joins by typing the code
await G.page.click('[data-act=binvite]', { force: true }); await G.page.waitForTimeout(200);
await G.page.fill('.js-oncode', code.toLowerCase()); await G.page.click('[data-act=onjoin]', { force: true });
await Promise.all([H.page, G.page].map((p) => p.waitForFunction(() => { const n = window.__skyStrike.net; return n.connected && n.friend; }, null, { timeout: 20000 })));
const names = [await H.page.evaluate(() => window.__skyStrike.net.friend.name), await G.page.evaluate(() => window.__skyStrike.net.friend.name)];
check('O3 both sides connected and know each other', names[0] === 'RAHUL' && names[1] === 'PRAKASH', names);

// host picks versus + a map; guest sees it
await H.page.click('[data-act=onmode][data-id=versus]', { force: true });
await H.page.click('[data-act=online-close]', { force: true });
await H.page.click('[data-act=bmap][data-id=ocean]', { force: true }); await H.page.waitForTimeout(500);
const gl = await G.page.evaluate(() => ({ mode: window.__skyStrike.ui.battle.online.mode, map: window.__skyStrike.ui.battle.online.hostCfg.map }));
check('O4 guest sees the host\'s lobby choices', gl.mode === 'versus' && gl.map === 'ocean', gl);

// guest can't start; host starts for both
await G.page.click('[data-act=online-close]', { force: true });
await H.page.click('[data-act=bfight]', { force: true });
await G.page.waitForFunction(() => window.__skyStrike.battle.running && window.__skyStrike.battle.sync, null, { timeout: 5000 });
const st = await Promise.all([H, G].map((p) => p.page.evaluate(() => { const w = window.__skyStrike.battle; return { n: w.fighters.length, map: w.map.id, me: w.fighters.indexOf(w.humans[0]), teams: w.fighters.slice(0, 2).map((f) => f.team), tags: w.fighters.slice(0, 2).map((f) => f.tag) }; })));
check('O5 battle starts on both with the same roster', st[0].n === st[1].n && st[0].map === 'ocean' && st[1].map === 'ocean' && st[0].me === 0 && st[1].me === 1 && st[0].teams.join() === '0,1' && st[1].teams.join() === '0,1', st);

await H.page.waitForTimeout(5600);
// guest steers: its jet turns on the host too
await G.page.keyboard.down('KeyD'); await G.page.waitForTimeout(900); await G.page.keyboard.up('KeyD'); await G.page.waitForTimeout(300);
const ga = await G.page.evaluate(() => { const f = window.__skyStrike.battle.fighters[1]; return { x: f.x, y: f.y, a: f.a }; });
const ha = await H.page.evaluate(() => { const f = window.__skyStrike.battle.fighters[1]; return { x: f.x, y: f.y, a: f.a }; });
const dd = Math.hypot(ga.x - ha.x, ga.y - ha.y);
check('O6 guest jet position mirrors on the host', dd < 90, { dist: Math.round(dd) });

// bots on the guest follow the host
await G.page.waitForTimeout(800);
const pos = await Promise.all([H, G].map((p) => p.page.evaluate(() => window.__skyStrike.battle.fighters.slice(2).map((f) => [f.x, f.y]))));
const worst = Math.max(...pos[0].map((p, i) => Math.hypot(p[0] - pos[1][i][0], p[1] - pos[1][i][1])));
check('O7 bot positions agree on both screens', worst < 140, { worst: Math.round(worst) });

// guest fires: bullets appear on the host owned by the guest jet
await G.page.keyboard.down('Space'); await G.page.waitForTimeout(500);
const owned = await H.page.evaluate(() => window.__skyStrike.battle.bullets.pool.active.filter((b) => b.alive && b.owner === window.__skyStrike.battle.fighters[1]).length);
await G.page.keyboard.up('Space');
check('O8 guest gunfire is simulated on the host', owned > 0, { owned });

// a kill on the host shows up on the guest (feed + score)
await H.page.evaluate(() => { const w = window.__skyStrike.battle; const v = w.fighters.find((f, i) => i > 1 && f.alive && f.team === 1); w.killFighter(v, w.fighters[0], 'bullet'); });
await G.page.waitForTimeout(400);
const ks = await Promise.all([H, G].map((p) => p.page.evaluate(() => { const w = window.__skyStrike.battle; return { sc: w.score.join('-'), feed: w.feed.length, k0: w.fighters[0].kills }; })));
check('O9 kills, score and feed sync to the guest', ks[0].sc === ks[1].sc && ks[1].feed > 0 && ks[1].k0 === 1, ks);

// zone / clock come from the host
const zc = await Promise.all([H, G].map((p) => p.page.evaluate(() => { const w = window.__skyStrike.battle; return [Math.round(w.zone.r), Math.round(w.roundT)]; })));
check('O10 zone and clock match', Math.abs(zc[0][0] - zc[1][0]) < 20 && Math.abs(zc[0][1] - zc[1][1]) <= 1, zc);

// online pause doesn't freeze the match
await G.page.click('[data-act=bpause]', { force: true }); await G.page.waitForTimeout(400);
const pz = await G.page.evaluate(() => ({ state: window.__skyStrike.state.current, t: window.__skyStrike.battle.time }));
await G.page.waitForTimeout(500);
const pz2 = await G.page.evaluate(() => window.__skyStrike.battle.time);
await G.page.click('#s-bpause [data-act=resume]', { force: true });
check('O11 pause menu in an online match keeps the battle running', pz2 > pz.t, { state: pz.state });

// end of round reaches the guest; guest asks for a rematch and the host starts it
await H.page.evaluate(() => window.__skyStrike.battle._end(0));
await Promise.all([H, G].map((p) => p.page.waitForSelector('#s-bresult.on', { timeout: 8000 })));
const rr = await Promise.all([H, G].map((p) => p.page.textContent('#s-bresult .js-rt')));
check('O12 both see the result (VICTORY for host team, DEFEAT for guest team)', rr[0] === 'VICTORY' && rr[1] === 'DEFEAT', rr);
await G.page.click('#s-bresult [data-act=brestart]', { force: true });
await H.page.waitForFunction(() => window.__skyStrike.battle.running && window.__skyStrike.battle.phase === 'intro', null, { timeout: 5000 });
await G.page.waitForFunction(() => window.__skyStrike.battle.running && window.__skyStrike.battle.phase === 'intro', null, { timeout: 5000 });
check('O13 rematch request from the guest starts a new round for both', true);

// guest leaves: host keeps playing with a bot in that jet
await H.page.waitForTimeout(5800);
await G.ctx.close();
await H.page.waitForFunction(() => !window.__skyStrike.net.connected, null, { timeout: 15000 });
await H.page.waitForTimeout(300);
const lf = await H.page.evaluate(() => { const w = window.__skyStrike.battle; return { left: w.sync.left, bot: !!w.fighters[1].brain, running: w.running }; });
check('O14 friend leaving hands their jet to a bot', lf.left && lf.bot && lf.running, lf);
await H.page.waitForTimeout(1500);
check('O15 no errors on either side', H.errs.length === 0 && G.errs.length === 0, [...H.errs, ...G.errs].slice(0, 4));
console.log(`\n${results.filter(Boolean).length}/${results.length} online checks passed`);
await browser.close();
