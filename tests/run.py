import asyncio, json, sys
from playwright.async_api import async_playwright
import os
URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(__file__), 'shots'); os.makedirs(OUT, exist_ok=True)
BOT = r"""
(n) => {
  const P = window.__PNR, G = P.G, k = P.keys;
  const laneX = i => 95 + 102.5*(i+.5);
  const drive = (t, L, R, U, D, Hn) => {
    let tx = 300;
    if (t.pass && t.pass.zone) tx = laneX(t.pass.zone.side===0?0:3);
    else if (!t.pass) { let best=null,bd=1e9; for (const w of G.waiting){ const d=t.y-w.y; if(d>-30&&d<bd){bd=d;best=w;} } if(best) tx=laneX(best.side===0?0:3); }
    // dodge
    for (const o of G.objs) { if (o.flat) continue; if (o.y < t.y && t.y-o.y < 160 && Math.abs(o.x - t.x) < 45) { tx = t.x + (t.x<300? 110 : -110); break; } }
    k[L] = tx < t.x - 12; k[R] = tx > t.x + 12; k[U]=false; k[D]=false;
    k[Hn] = G.objs.some(o=>o.kind==='zip' && Math.hypot(o.x-t.x,o.y-t.y)<110);
  };
  for (let i=0;i<n;i++){
    if (G.state!=='play') break;
    drive(G.taxis[0],'KeyA','KeyD','KeyW','KeyS','Space');
    if (G.taxis[1]) { drive(G.taxis[1],'ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter');
      // P2 sometimes rams P1
      const a=G.taxis[0], b=G.taxis[1]; if (a.pass && Math.abs(a.y-b.y)<70 && Math.random()<.5){ k.ArrowLeft = a.x<b.x; k.ArrowRight = a.x>b.x; } }
    P.step(1, 1/60);
  }
  return {state:G.state, t:G.t};
}
"""
async def main():
    errors=[]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':900})
        pg.on('console', lambda m: errors.append('console.'+m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errors.append('pageerror: '+str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(800)
        await pg.screenshot(path=OUT+'/01_menu.png')
        await pg.click('[data-a=play1]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'/02_intro.png')
        log=[]
        for night in range(5):
            await pg.click('[data-a=go]'); await pg.wait_for_timeout(200)
            # real-time a bit with keyboard to exercise listeners
            await pg.keyboard.down('ArrowLeft'); await pg.wait_for_timeout(400); await pg.keyboard.up('ArrowLeft')
            await pg.keyboard.press('Space')
            r = await pg.evaluate(BOT, 60*40)
            if night in (0,2,4): await pg.screenshot(path=OUT+f'/03_play_n{night}.png')
            r = await pg.evaluate(BOT, 60*80)
            await pg.wait_for_timeout(200)
            st = await pg.evaluate("()=>({s:__PNR.G.state, w:__PNR.G.taxis[0].wallet, strikes:__PNR.G.strikes, res:__PNR.G.lastResult, hp:__PNR.G.taxis[0].hp, del:__PNR.G.taxis[0].deliveries})")
            log.append(st)
            if st['s']=='dawn':
                if night==0: await pg.screenshot(path=OUT+'/04_dawn.png')
                for sel in ['[data-a=repair]','[data-a=buy][data-k=engine]']:
                    el = await pg.query_selector(sel+':not([disabled])')
                    if el: await el.click(); await pg.wait_for_timeout(100)
                await pg.click('[data-a=nextNight]'); await pg.wait_for_timeout(200)
            else:
                break
        await pg.screenshot(path=OUT+'/05_end.png')
        print('STORY LOG'); [print(json.dumps(x)) for x in log]
        # challenge link
        await pg.fill('#cname','Sona'); await pg.click('[data-a=challenge]'); await pg.wait_for_timeout(200)
        print('cmsg:', await pg.inner_text('#cmsg'))
        await pg.click('[data-a=menu]')
        # journal + how
        await pg.click('[data-a=journal]'); await pg.wait_for_timeout(200); await pg.screenshot(path=OUT+'/06_journal.png'); await pg.click('[data-a=menu]')
        await pg.click('[data-a=how]'); await pg.click('[data-a=menu]')
        # 2P
        await pg.click('[data-a=play2]');
        for rnd in range(3):
            st = await pg.evaluate("()=>__PNR.G.state")
            if st!='intro': break
            await pg.click('[data-a=go]')
            await pg.evaluate(BOT, 60*30)
            if rnd==0: await pg.screenshot(path=OUT+'/07_2p.png')
            await pg.evaluate(BOT, 60*35)
            await pg.wait_for_timeout(150)
            print('2P', await pg.evaluate("()=>({s:__PNR.G.state,wins:__PNR.G.wins,res:__PNR.G.lastResult, d:[__PNR.G.taxis[0].deliveries,__PNR.G.taxis[1].deliveries]})"))
            await pg.screenshot(path=OUT+f'/08_round{rnd}.png')
            nb = await pg.query_selector('[data-a=nextRound]')
            if nb: await nb.click()
            else: break
        # pause flow
        await pg.click('[data-a=menu]') if await pg.query_selector('[data-a=menu]') else None
        await pg.click('[data-a=play1]'); await pg.click('[data-a=go]'); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        print('paused state', await pg.evaluate("()=>__PNR.G.state"))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(100)
        print('resumed state', await pg.evaluate("()=>__PNR.G.state"))
        # mobile
        m = await b.new_page(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        m.on('pageerror', lambda e: errors.append('m pageerror: '+str(e)))
        m.on('console', lambda x: errors.append('m console.'+x.type+': '+x.text) if x.type in ('error','warning') else None)
        await m.goto(URL+'?beat=1500&from=Sona'); await m.wait_for_timeout(500)
        await m.screenshot(path=OUT+'/09_mobile_menu.png')
        await m.tap('[data-a=play1]'); await m.tap('[data-a=go]')
        await m.touchscreen.tap(60, 790)
        await m.evaluate(BOT, 60*20); await m.wait_for_timeout(200)
        await m.screenshot(path=OUT+'/10_mobile_play.png')
        await b.close()
    print('ERRORS:', len(errors)); [print(e) for e in errors]
asyncio.run(main())
