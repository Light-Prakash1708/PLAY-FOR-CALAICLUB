// Sky gradient, three parallax cloud layers and drifting atmospheric specks.
import { THEMES } from '../data/levels.js';
import { TAU } from '../core/utils.js';
import { groundTile, TILE } from './Terrain.js';

// deterministic PRNG so the sky looks the same every run
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

// One soft "3D" cloud: overlapping puffs, each lit from the upper left, over a
// bright rim. Painted once per theme into a sprite.
const PUFFS = [[-84, 30, 26], [-50, 12, 38], [52, 8, 42], [0, -14, 52], [-12, 28, 46], [40, 30, 34]];
function makeCloud(r, theme) {
  const w = 300, h = 210, S = 1.05;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.translate(w / 2 + 14, h / 2 - 4);
  const flip = r() < 0.5 ? -1 : 1;
  const puffs = PUFFS.map(([x, y, rad]) => [x * flip * S + (r() - 0.5) * 10, y * S + (r() - 0.5) * 8, rad * S * (0.9 + r() * 0.2)]);
  g.fillStyle = theme.rim;
  g.shadowColor = theme.rim; g.shadowBlur = 6;
  for (const [x, y, rad] of puffs) { g.beginPath(); g.arc(x, y, rad + 3, 0, TAU); g.fill(); }
  g.shadowBlur = 0;
  for (const [x, y, rad] of puffs) {
    const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.4, rad * 0.05, x, y, rad * 1.05);
    gr.addColorStop(0, theme.cloud[0]); gr.addColorStop(0.55, theme.cloud[1]); gr.addColorStop(1, theme.cloud[2]);
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
  }
  return c;
}

const LAYERS = [
  { par: 0.18, scale: 0.55, alpha: 0.6, count: 7, drift: 4 },
  { par: 0.42, scale: 0.95, alpha: 0.9, count: 5, drift: 8 },
  { par: 0.72, scale: 1.5, alpha: 1, count: 4, drift: 14 },
];
const TILE_W = 1500, TILE_H = 1500;     // wide enough for landscape screens

export class Background {
  constructor() {
    this.theme = null; this.themeName = '';
    this.sprites = [];
    this.clouds = [];
    this.specks = [];
    this.t = 0;
    this.quality = 1;
    const r = rng(77);
    for (const L of LAYERS) {
      const list = [];
      for (let i = 0; i < L.count; i++) list.push({ x: r() * TILE_W, y: (i + r() * 0.8) * (TILE_H / L.count), s: 0.75 + r() * 0.6, k: Math.floor(r() * 5) });
      this.clouds.push(list);
    }
    for (let i = 0; i < 34; i++) this.specks.push({ x: r() * 600, y: r() * 1300, s: 1 + r() * 1.6, tw: r() * TAU });
    this.setTheme('day');
  }
  setTheme(name) {
    if (name === this.themeName) return;
    this.themeName = name;
    this.theme = THEMES[name] || THEMES.day;
    const r = rng(1234);
    this.sprites = [];
    for (let i = 0; i < 5; i++) this.sprites.push(makeCloud(r, this.theme));
    this.ground = this.theme.ground ? groundTile(this.theme.ground, this.theme.tint) : null;
    this.grad = null;
  }
  update(dt) { this.t += dt; }

  render(ctx, cam, vw, vh) {
    if (!this.grad || this.gradH !== vh) {
      this.grad = ctx.createLinearGradient(0, 0, 0, vh);
      this.grad.addColorStop(0, this.theme.top);
      this.grad.addColorStop(1, this.theme.bottom);
      this.gradH = vh;
    }
    if (this.ground) {
      // landscape far below: slow parallax, then a veil of haze for depth
      const par = 0.14;
      let ox = (-cam.x * par) % TILE; if (ox > 0) ox -= TILE;
      let oy = (-cam.y * par) % TILE; if (oy > 0) oy -= TILE;
      for (let x = ox; x < vw; x += TILE) for (let y = oy; y < vh; y += TILE) ctx.drawImage(this.ground, x, y, TILE + 0.5, TILE + 0.5);
      ctx.globalAlpha = 0.2; ctx.fillStyle = this.grad; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.grad;
      ctx.fillRect(0, 0, vw, vh);
    }
    const layers = this.quality < 0.6 ? 2 : 3;
    for (let li = 3 - layers; li < 3; li++) {
      const L = LAYERS[li], list = this.clouds[li];
      ctx.globalAlpha = L.alpha;
      const count = Math.max(1, Math.round(list.length * (this.theme.clouds || 1)));
      for (let i = 0; i < count; i++) {
        const c = list[i], spr = this.sprites[c.k];
        const w = spr.width * L.scale * c.s, h = spr.height * L.scale * c.s;
        let x = (c.x - cam.x * L.par + this.t * L.drift) % TILE_W; if (x < 0) x += TILE_W;
        let y = (c.y - cam.y * L.par) % TILE_H; if (y < 0) y += TILE_H;
        x -= w; y -= h;                       // let clouds slide in from off-screen
        if (x > vw || y > vh) continue;
        ctx.drawImage(spr, x, y, w, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Fast-moving specks above the action: sells the sense of speed. */
  renderFront(ctx, cam, vw, vh) {
    const n = Math.round(this.specks.length * this.quality);
    const stars = this.theme.stars;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < n; i++) {
      const s = this.specks[i];
      const par = stars ? 0.08 : 1.25;
      let x = (s.x / 600 * (vw + 40) - cam.x * par) % (vw + 40); if (x < 0) x += vw + 40;
      let y = (s.y / 1300 * (vh + 40) - cam.y * par) % (vh + 40); if (y < 0) y += vh + 40;
      ctx.globalAlpha = stars ? 0.35 + 0.3 * Math.sin(this.t * 2 + s.tw) : 0.3;
      ctx.beginPath(); ctx.arc(x - 20, y - 20, s.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
