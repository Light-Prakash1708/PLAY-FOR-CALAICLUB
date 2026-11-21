# CONTINUE.md: handoff for the next builder (human or Claude)

> **Paste this to a new Claude session:**
> "I'm continuing the hackathon game in this repo (Pujo Night Rush, single-file `index.html`). Read `CONTINUE.md` and `README.md` first. Keep it one self-contained file, no libraries, no sign-in. After every change, test that there are zero console errors (see the Test section), then commit and push."

## Status (as of the first build)
**Working, tested in headless Chrome with zero console errors:**
- Menu, How to play, Story Cards journal (15 passengers), paint selector unlocked by XP rank
- Story mode: 5 nights, rent at dawn, 3 strikes, garage (repair / engine / bumper / horn), dents carry over, Dashami boss (ZipCab KING, ram him 3× from the side)
- Showdown 2P: same screen, ram to steal fares, honk to shove, best of 3 rounds
- Traffic: cars, private buses (with conductor lines), trams on the tram lane, rickshaws, cows, potholes, Pujo crowds, ZipCabs that overtake and steal waiting passengers
- Passenger types: normal, granny (hates bumps), rush, Howrah (×2 fare, long ride), fragile (idol/cake ×2.5, lost on any crash)
- Procedural Web Audio: dhak loop that speeds up toward dawn, horn "pyaan-pyaan", tram bell, moo, coins
- Touch controls, pause (Esc/P/⏸), auto-pause on tab switch, challenge links (`?beat=&from=`)

## Responsive view (v2.1)
`W` = 600 is the **world** width (the road is always centred). `VW` × `H` is the **visible** size, recomputed in `resize()`: wider on landscape screens (up to 1500), taller on portrait phones (up to 1350). `OX = (VW - W) / 2` is the world's x offset. World drawing happens inside `ctx.translate(OX, 0)`; the HUD, captions, touch buttons and kite header use screen coordinates (`VW`). On wide screens (`OX >= 140`) `drawMinimap` draws the big map and `drawRoutePanel` draws the right-hand panel. `CAM.x` follows the taxi for dynamic perspective.

## v2 systems (added after the first build)
- **2.5D rendering:** `P(x,y,z)` projects a height z toward camera `CAM`. `slab()` stacks rounded rects (vehicles/props), `ball()` stacks circles (domes, trees, heads), `quad()` draws a building face. Tune lean with `KX`/`KY`.
- **Landmarks:** `LM` (name, style, fact, map coords). Each night has a `route` of 4 ids, spawned at `ROUTE_T` seconds as `G.sets` and drawn by `drawSetBase` / `drawSetOverhead` (Howrah Bridge truss). `G.caption` shows the fact card. `S.map` stores discoveries.
- **Hearts:** stored in halves (`MAX_HALF` = 6). `loseHeart(t, msg, halves)`, `towed()`. Mishti pickups heal.
- **Police:** `offense()` raises `t.wanted` (max 3) and spawns units in `G.police`. `updatePolice()` handles the chase and escape; `caught()` = fine.
- **Missions:** `MISSIONS[night]` checked against `G.st` counters; the reward is paid at dawn before rent.
- **Kite mini-game:** `KITE`, `startKite`, `updateKite`, `drawKite`, `finishKite`.
- **Voice:** `LINES` (bn + romanised) and `TTS.say(key)`. Recorded mp3s placed in `VOICE_FILES` with the same keys override TTS.
- **Cinematic:** `G.cine` (intro bars + zoom), `cinematicHit()` (slow-mo + zoom), `drawLights()` (additive light pass after the night tint).

## Code map (`index.html`, one IIFE)
Search for these section banners (`// ----- name`):
| Section | What's inside |
|---|---|
| `constants` | Logical size 600×900, road/lane geometry. `TRAM_LANE`, `EDGE_LANE` (curb lanes where pickups/drops happen) |
| `content` | **`NIGHTS`** (rent, scroll speed, spawn intervals per obstacle), `SHOWDOWN`, `NIGHT_LEN`, **`CHARS`** (passengers + story text), `TYPE` (fare multipliers, ride times), `PAINTS`, `RANKS`, `UPGRADES` |
| `save` | LocalStorage key `pujoNightRush_v1`, `CHALLENGE` URL parsing |
| `audio` | `audioInit`, `tone`, `noise`, `SFX.*`, `scheduleDhak`. **`VOICE_FILES`** = optional recorded voice lines |
| `input` | Keyboard maps `P1KEYS`/`P2KEYS`, touch buttons `touchButtons()`, `readInput(taxi)` |
| `game state` | Object `G`, `makeTaxi`, `startStory`, `startShowdown`, `beginPlay` |
| `spawning` | `spawn(kind)`, `runSpawners` |
| `passengers & fares` | `board`, `deliver`, `spawnZone`, `loseFare`, `hurt`, `breakdown`, `horn` |
| `update` | `updateTaxi`, `updateObjs` (lane queueing), `updateZip`, `updateWaiting`, `updateZones`, **`collisions`** (incl. RAM-TO-STEAL), `updateBoss` |
| `night / round end` | `endNight` (rent/strike), `endRound`, `endGame` |
| `drawing` | Storybook-flat procedural art: `drawBackground`, `drawCarShape`, `drawTaxi`, `drawObj`, `drawWaiting`, `drawZone`, `drawBoss`, `drawHUD`, `drawTouch` |
| `screens` | DOM overlays: `showMenu`, `showIntro`, `showDawn`, `showRound`, `showEnd`, `pause`. Buttons use `data-a="action"` mapped in **`ACTIONS`**. `data-primary` = triggered by Enter |
| `boot` | `window.__PNR` test hook (`step(n, dt)` advances the sim) |

## Tuning knobs (balance)
- Too hard? Lower `rent` in `NIGHTS`, raise `pass` frequency (smaller number = more passengers), or reduce `dmg` in `spawn()`.
- Fares: `base = (55 + ride*7) * TYPE.mult` in `board()`. Tips are in `deliver()`.
- Ram steal threshold: `Math.max(pa, pb) > 150` in `collisions()`.
- Boss: spawns at `G.t > 16` in `updateBoss`. Ram needed: `190 - 35*bumper`.

## Test (must stay at zero errors)
```bash
pip install playwright && python -m playwright install chromium   # once
python tests/run.py      # plays 5 story nights + a 2P showdown + mobile, prints ERRORS: 0
```
If `tests/` isn't in the repo, open the game, open DevTools Console, play a night in each mode, and make sure the console stays clean.

## Ideas for the next 1–2 hours (in priority order)
1. **Record real voice lines** (10 min, biggest impact): browser TTS works, but your team's voices will be funnier. Record mp3s for any keys in `LINES` (e.g. `audio/jaben.mp3`, `audio/police.mp3`, `audio/conductor.mp3`, `audio/bhokatta.mp3`) and list them in `VOICE_FILES`.
2. Playtest with a stranger and tune `NIGHTS` rents to their first-try result. They should just barely survive Panchami.
3. Sabotage pickups for Showdown (banana peel, fake barricade). Spawn them as a new `kind` in `spawn()`, then handle it in `collisions()`.
4. Traffic sergeant: chases you if you go through a crowd too fast and fines you.
5. Undercut tug-of-war when both taxis reach the same passenger.
6. Howrah Bridge skyline on Dashami (draw it in `drawBackground` when `G.night === 4`).

## Rules from the problem statement (don't break these)
1. No sign-up. A new player is in within a minute.
2. A new player understands it in 30 seconds with no one explaining.
3. One round is under 3 minutes.
Video proof: film a stranger's first try.
