# Sky Strike: handoff notes (continue in any account)

Hackathon: Calcutta AI Club Vibe Coders Hackathon Ed. 3, theme "Play". Team Catalyst Minds.

## Run it
- **Play right now:** open `dist/sky-strike.html` (a single file that runs by double-click), or `index.html` through a local server.
- **Dev server:** `npm install`, then `npm start` (python http.server on :8080), then open http://localhost:8080/index.html
- **Build:** `npm run build` produces `dist/sky-strike.html` (single file) and `dist/app/` (installable PWA).
- **Online play needs the game hosted on https** (Netlify, Vercel or GitHub Pages: upload `dist/app/` or `dist/sky-strike.html`) so that room links work. Room codes work from any copy.

## What's in v8 (latest)
- **Live online multiplayer, no sign-in.** In setup, PLAY WITH A FRIEND lets one player CREATE A ROOM, which gives a 6-letter code plus link, COPY CODE / COPY LINK / SHARE (WhatsApp on desktop). The friend types the code or opens the link (`#room=CODE`).
  - **Modes:** CO-OP (both of you vs bots) or VERSUS (your team vs theirs, with bots filling the squads).
  - **How the sync works:**
    - The host is authoritative for bots, damage, kills, zone, crates, score and clock.
    - The guest flies its own jet locally for instant controls.
    - Snapshots run at 20 Hz, guest input at 30 Hz, and events are sent for kills, respawns, crates, the zone, sudden death and the end of the round.
  - **Connection:** WebRTC through the free PeerJS broker (0.peerjs.com) with Google and Cloudflare STUN. There is no TURN server, so very strict networks (some college and office Wi-Fi) may fail; mobile data usually works.
  - **Rematch and setup:** rematches work from either side, and the host's CHANGE button brings the guest back to setup.
  - **Leaving:** if the friend leaves, a bot takes their jet (on the host); if the host leaves, the guest returns to setup.
  - **Pause:** pausing an online match doesn't freeze it, and a host whose tab is in the background keeps the match ticking.
- **Copy buttons fixed:** they now use a fallback that works on http://, file:// and in in-app browsers.
- **From v7:**
  - Take-off from Phoenix Air Base, ending with a cloud punch.
  - Optional target-lock brackets and combat zoom (Settings > Controls).
  - Cleaner gun SFX.

## Key files
- `src/net/Net.js`: PeerJS wrapper (rooms, codes, links, heartbeat).
- `src/net/NetSync.js`: battle sync (snapshots, remote commands, corrections, events).
- `src/ui/OnlineUI.js`: the Play with a Friend modal and setup-screen bar.
- `src/ui/copy.js`: robust clipboard helper.
- `src/vendor/peerjs.mjs`: bundled PeerJS 1.5.5. Regenerate it with `npx esbuild node_modules/peerjs/dist/bundler.mjs --bundle --format=esm --minify --target=es2019 --outfile=src/vendor/peerjs.mjs`.
- `src/battle/BattleWorld.js`: Team Battle sim (online branches are marked `sync` / `guest`).
- `src/systems/Takeoff.js`: airbase and cloud punch.
- `src/story/*`: radio, pilots, globe intro. `src/battle/CockpitView.js`: cockpit view.

## Tests (Playwright, headless Chrome)
- Serve the folder first: `python3 -m http.server 8765`.
- `node tools/qa/battle.mjs`: 17 Team Battle checks.
- `node tools/qa/suite.mjs`: 22 general checks.
- `node tools/qa/online.mjs`: 15 two-browser online checks. It needs a local PeerServer first: `npm i peer express` and then `node tools/qa/peer-server.cjs` (port 9000). The game picks that server up through `?peer=127.0.0.1:9000`.
- The tests import Playwright from `/opt/npm-tools/node_modules/playwright`, so change that path to your own install.
- Last results: battle 17/17, online 15/15, suite 22/22 (as of v7).

## Open items / ideas
- ElevenLabs voice lines: put mp3s in `voices/` and run `node tools/voices.mjs` to inline them (`src/story/voices.js`). Until then, the browser's speech is used.
- A TURN server (for example Metered or Twilio) would make online play work on strict networks. Add it to `iceServers` in `Net.js`.
- The demo video must show a first-time player from outside the team, with the round under 3 minutes.
