// Procedural landscapes seen from high altitude: mountains, desert, snowfields
// and a battlefield. Each is painted once into a seamless tile that the
// background scrolls slowly beneath the clouds.
import { TAU } from '../core/utils.js';

export const TILE = 640;
const SS = 1.5;                       // tile is painted at 1.5x for crispness

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Runs a painter nine times so anything crossing an edge reappears on the far side. */
function wrap(g, fn) {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { g.save(); g.translate(dx * TILE, dy * TILE); fn(); g.restore(); }
}
function blotches(g, r, n, cols, rad = [50, 130], alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = r() * TILE, y = r() * TILE, R = rad[0] + r() * (rad[1] - rad[0]), c = cols[Math.floor(r() * cols.length)];
    wrap(g, () => { const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, rgb(c, alpha)); gr.addColorStop(1, rgb(c, 0)); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); });
  }
}

function peaks(g, r, n, pal) {
  const list = [];
  for (let i = 0; i < n; i++) list.push({ x: r() * TILE, y: r() * TILE, R: 55 + r() * 70, k: 7 + Math.floor(r() * 3), a0: r() * TAU, seed: r() });
  list.sort((a, b) => a.y - b.y);
  for (const p of list) {
    const rr = rng(Math.floor(p.seed * 1e6) + 7), pts = [];
    for (let j = 0; j < p.k; j++) { const a = p.a0 + (j / p.k) * TAU, d = p.R * (0.6 + rr() * 0.5); pts.push([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.9, a]); }
    wrap(g, () => {
      // cast shadow toward the lower right
      g.fillStyle = 'rgba(20,30,40,0.22)';
      g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x + 16, y + 20) : g.moveTo(x + 16, y + 20))); g.closePath(); g.fill();
      for (const [scale, lo, hi] of [[1, pal.rockDark, pal.rockLight], [pal.cap, pal.snowDark, pal.snowLight]]) {
        for (let j = 0; j < p.k; j++) {
          const a = pts[j], b = pts[(j + 1) % p.k];
          const face = (a[2] + b[2] + (j === p.k - 1 ? TAU : 0)) / 2;                 // facet normal direction
          const lit = 0.5 + 0.5 * Math.cos(face - (-2.35));                          // light from the upper left
          g.fillStyle = g.strokeStyle = rgb(mix(lo, hi, lit)); g.lineWidth = 0.6;
          g.beginPath(); g.moveTo(p.x, p.y);
          g.lineTo(p.x + (a[0] - p.x) * scale, p.y + (a[1] - p.y) * scale); g.lineTo(p.x + (b[0] - p.x) * scale, p.y + (b[1] - p.y) * scale);
          g.closePath(); g.fill(); g.stroke();
        }
      }
    });
  }
}
function river(g, r, col, edge, w) {
  const y0 = r() * TILE, A = 40 + r() * 50, ph = r() * TAU, B = 14 + r() * 12;
  const path = () => { g.beginPath(); for (let x = -TILE; x <= TILE * 2; x += 12) { const y = y0 + A * Math.sin((x / TILE) * TAU + ph) + B * Math.sin((x / TILE) * TAU * 3 + ph * 2); x === -TILE ? g.moveTo(x, y) : g.lineTo(x, y); } };
  wrap(g, () => { g.lineCap = 'round'; g.lineJoin = 'round'; path(); g.strokeStyle = edge; g.lineWidth = w + 4; g.stroke(); path(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); });
}
function dots(g, r, n, cols, size, clump = 26) {
  for (let i = 0; i < n; i++) {
    const cx = r() * TILE, cy = r() * TILE, m = 5 + Math.floor(r() * 9);
    for (let j = 0; j < m; j++) {
      const x = cx + (r() - 0.5) * clump * 2, y = cy + (r() - 0.5) * clump * 2, s = size[0] + r() * (size[1] - size[0]);
      wrap(g, () => { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + 1.5, y + 2, s, 0, TAU); g.fill(); g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); });
    }
  }
}


/** Irregular closed blob, used for islands and lava pools. */
function blob(g, x, y, R, rr, n = 11, jit = 0.35) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, d = R * (1 - jit / 2 + rr() * jit);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}
/** A wavy path across the tile, stroked several times (glow, body, core). */
function band(g, r, strokes) {
  const y0 = r() * TILE, A = 40 + r() * 60, ph = r() * TAU, B = 12 + r() * 14;
  const path = () => { g.beginPath(); for (let x = -TILE; x <= TILE * 2; x += 10) { const y = y0 + A * Math.sin((x / TILE) * TAU + ph) + B * Math.sin((x / TILE) * TAU * 3 + ph * 2); x === -TILE ? g.moveTo(x, y) : g.lineTo(x, y); } };
  wrap(g, () => { g.lineCap = 'round'; g.lineJoin = 'round'; for (const [col, w] of strokes) { path(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); } });
}

const PAINTERS = {
  // open sea with islands, reefs and shipping lanes
  ocean(g, r) {
    g.fillStyle = '#2477b0'; g.fillRect(0, 0, TILE, TILE);
    blotches(g, r, 20, [[20, 92, 146], [40, 132, 190], [26, 104, 164], [62, 156, 208]], [70, 170], 0.55);
    for (let i = 0; i < 5; i++) {
      const x = r() * TILE, y = r() * TILE, R = 34 + r() * 56, seed = Math.floor(r() * 1e6);
      wrap(g, () => {
        let k = rng(seed);
        g.fillStyle = 'rgba(110,220,226,0.55)'; blob(g, x, y, R + 26, k); g.fill();          // shallow reef
        k = rng(seed); g.fillStyle = 'rgba(255,255,255,0.5)'; blob(g, x, y, R + 9, k); g.fill(); // surf
        k = rng(seed); g.fillStyle = '#ead8a0'; blob(g, x, y, R + 5, k); g.fill();               // beach
        k = rng(seed); g.fillStyle = '#5f9e4e'; blob(g, x, y, R * 0.8, k); g.fill();             // jungle
        k = rng(seed + 3); g.fillStyle = '#4a8240'; blob(g, x - R * 0.15, y - R * 0.1, R * 0.45, k); g.fill();
      });
      dots(g, rng(seed + 9), 3, ['#3e7036', '#2f5c2a'], [2.5, 4.5], R * 0.35);
    }
    for (let i = 0; i < 160; i++) {                                                  // wave glints
      const x = r() * TILE, y = r() * TILE, L = 5 + r() * 9;
      wrap(g, () => { g.strokeStyle = 'rgba(230,248,255,0.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - L, y); g.quadraticCurveTo(x, y - 3, x + L, y); g.stroke(); });
    }
    for (let i = 0; i < 6; i++) {                                                    // ships and their wakes
      const x = r() * TILE, y = r() * TILE, a = r() * TAU, L = 10 + r() * 10;
      wrap(g, () => {
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-L, 0); g.lineTo(-L - 70, -16); g.lineTo(-L - 70, 16); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-L + 2, -3, L * 2, 8);
        g.fillStyle = '#5b6470'; g.beginPath(); g.moveTo(L + 4, 0); g.lineTo(L - 3, -4); g.lineTo(-L, -4); g.lineTo(-L, 4); g.lineTo(L - 3, 4); g.closePath(); g.fill();
        g.fillStyle = '#c9ced6'; g.fillRect(-L * 0.4, -2.2, L * 0.6, 4.4);
        g.restore();
      });
    }
  },
  // a city grid from above: blocks, rooftops, parks, avenues and a river
  city(g, r) {
    const CELL = 80, ROAD = 14;
    g.fillStyle = '#545b66'; g.fillRect(0, 0, TILE, TILE);
    const roofs = ['#b9bec6', '#a3a9b3', '#c9c2b4', '#9aa6b8', '#7f8a99', '#c4b59c', '#8e97a6'];
    for (let cx = 0; cx < TILE; cx += CELL) for (let cy = 0; cy < TILE; cy += CELL) {
      const x = cx + ROAD / 2, y = cy + ROAD / 2, w = CELL - ROAD, kind = r();
      if (kind < 0.12) {                                                              // park
        g.fillStyle = '#5f9150'; g.fillRect(x, y, w, w);
        g.fillStyle = '#d8cfae'; g.fillRect(x + w / 2 - 2, y, 4, w);
        for (let t = 0; t < 9; t++) { const tx = x + 6 + r() * (w - 12), ty = y + 6 + r() * (w - 12); g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.arc(tx + 2, ty + 2, 5, 0, TAU); g.fill(); g.fillStyle = '#3f7236'; g.beginPath(); g.arc(tx, ty, 5, 0, TAU); g.fill(); }
        continue;
      }
      g.fillStyle = '#7b828d'; g.fillRect(x, y, w, w);                                // pavement
      const split = r() < 0.5, n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const bw = split ? w / n : w, bh = split ? w : w / n;
        const bx = x + (split ? k * bw : 0) + 3, by = y + (split ? 0 : k * bh) + 3, ww = bw - 6, hh = bh - 6, tall = 3 + r() * 9;
        g.fillStyle = 'rgba(10,14,22,0.45)'; g.fillRect(bx + tall, by + tall, ww, hh);   // long shadow = tall building
        g.fillStyle = roofs[Math.floor(r() * roofs.length)]; g.fillRect(bx, by, ww, hh);
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.strokeRect(bx + 0.5, by + 0.5, ww - 1, hh - 1);
        for (let u = 0; u < 3; u++) { g.fillStyle = r() < 0.5 ? '#6c7380' : '#dfe3e8'; g.fillRect(bx + 3 + r() * (ww - 10), by + 3 + r() * (hh - 10), 5, 4); }
        if (r() < 0.12) { g.fillStyle = '#d64545'; g.beginPath(); g.arc(bx + ww / 2, by + hh / 2, Math.min(ww, hh) * 0.22, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', bx + ww / 2, by + hh / 2 + 0.5); }
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.setLineDash([6, 6]);   // lane markings
    for (let c = 0; c <= TILE; c += CELL) { g.beginPath(); g.moveTo(c, 0); g.lineTo(c, TILE); g.moveTo(0, c); g.lineTo(TILE, c); g.stroke(); }
    g.setLineDash([]);
    band(g, r, [['rgba(30,40,50,0.5)', 26], ['#4b88ad', 20], ['rgba(180,220,240,0.35)', 3]]);  // river through town
    for (let i = 0; i < 40; i++) {                                                            // traffic
      const along = Math.floor(r() * 8) * CELL, t = r() * TILE, vert = r() < 0.5, side = r() < 0.5 ? -3.5 : 3.5;
      g.fillStyle = ['#f2c230', '#e23b3f', '#ffffff', '#3d7be8', '#222'][Math.floor(r() * 5)];
      if (vert) g.fillRect(along + side - 1.5, t, 3, 6); else g.fillRect(t, along + side - 1.5, 6, 3);
    }
  },
  // basalt plains split by rivers of lava
  lava(g, r) {
    g.fillStyle = '#2a2224'; g.fillRect(0, 0, TILE, TILE);
    blotches(g, r, 18, [[58, 44, 44], [36, 30, 32], [74, 54, 48], [20, 18, 20]], [50, 140], 0.6);
    for (let i = 0; i < 60; i++) {                                                   // cracks glowing from below
      let x = r() * TILE, y = r() * TILE, a = r() * TAU;
      const pts = [[x, y]];
      for (let k = 0; k < 5; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 12; y += Math.sin(a) * 12; pts.push([x, y]); }
      wrap(g, () => { g.strokeStyle = 'rgba(255,110,30,0.45)'; g.lineWidth = 1.6; g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); });
    }
    band(g, r, [['rgba(255,80,0,0.22)', 30], ['#d9480f', 12], ['#ff9a1f', 7], ['#ffe08a', 2.5]]);
    band(g, r, [['rgba(255,80,0,0.2)', 22], ['#c93f0c', 8], ['#ff9a1f', 4], ['#ffe08a', 1.5]]);
    for (let i = 0; i < 9; i++) {                                                    // lava pools
      const x = r() * TILE, y = r() * TILE, R = 12 + r() * 22, seed = Math.floor(r() * 1e6);
      wrap(g, () => {
        g.fillStyle = 'rgba(20,14,14,0.8)'; blob(g, x, y, R + 6, rng(seed)); g.fill();
        const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, '#ffe7a0'); gr.addColorStop(0.45, '#ff8a1c'); gr.addColorStop(1, '#b8380a');
        g.fillStyle = gr; blob(g, x, y, R, rng(seed)); g.fill();
      });
    }
    dots(g, r, 20, ['#4a3a38', '#5c4842', '#3a2e2e'], [2, 5], 22);                    // boulders
  },
  mountain(g, r) {
    g.fillStyle = '#6a8a58'; g.fillRect(0, 0, TILE, TILE);
    blotches(g, r, 16, [[86, 118, 70], [120, 146, 92], [78, 104, 66], [140, 150, 104]]);
    river(g, r, '#6fb6d6', 'rgba(40,70,60,0.35)', 5);
    dots(g, r, 34, ['#3f6238', '#4c7342', '#365430'], [2.5, 5]);
    peaks(g, r, 9, { rockDark: [70, 74, 82], rockLight: [190, 190, 178], snowDark: [170, 190, 212], snowLight: [255, 255, 255], cap: 0.42 });
  },
  snow(g, r) {
    g.fillStyle = '#dfe9f2'; g.fillRect(0, 0, TILE, TILE);
    blotches(g, r, 16, [[200, 218, 234], [240, 246, 252], [186, 206, 226]]);
    river(g, r, '#b8d8ec', 'rgba(120,150,180,0.4)', 7);
    dots(g, r, 16, ['#3c5a52', '#4a6a60'], [2, 4], 20);
    peaks(g, r, 10, { rockDark: [86, 98, 118], rockLight: [176, 188, 204], snowDark: [188, 206, 228], snowLight: [255, 255, 255], cap: 0.72 });
  },
  desert(g, r) {
    g.fillStyle = '#dcb97a'; g.fillRect(0, 0, TILE, TILE);
    blotches(g, r, 18, [[236, 206, 148], [200, 160, 100], [226, 190, 128], [188, 146, 92]]);
    river(g, r, 'rgba(170,128,78,0.55)', 'rgba(150,108,62,0.25)', 8);          // dry riverbed
    for (let i = 0; i < 46; i++) {                                                 // crescent dunes
      const x = r() * TILE, y = r() * TILE, L = 50 + r() * 90, a = -0.5 + r() * 0.5, bend = 14 + r() * 22;
      wrap(g, () => {
        g.save(); g.translate(x, y); g.rotate(a); g.lineCap = 'round';
        g.strokeStyle = 'rgba(120,82,40,0.3)'; g.lineWidth = 9; g.beginPath(); g.moveTo(-L / 2, 5); g.quadraticCurveTo(0, -bend + 7, L / 2, 5); g.stroke();
        g.strokeStyle = 'rgba(255,238,196,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -bend, L / 2, 0); g.stroke();
        g.restore();
      });
    }
    dots(g, r, 12, ['#8a6a48', '#74583c', '#9c7c56'], [2.5, 6], 22);              // rock outcrops
    dots(g, r, 5, ['#6f8a4a', '#5d7840'], [2, 4], 14);                              // scrub near an oasis
  },
  battlefield(g, r) {
    g.fillStyle = '#6f7350'; g.fillRect(0, 0, TILE, TILE);
    const fields = ['#7d8454', '#5f6a44', '#8a7c52', '#6a5a40', '#778a58', '#94885c'];
    for (let i = 0; i < 22; i++) {                                                 // patchwork farmland
      const x = r() * TILE, y = r() * TILE, w = 70 + r() * 110, h = 50 + r() * 90, a = (r() - 0.5) * 0.5, c = fields[Math.floor(r() * fields.length)], furrow = r() < 0.5;
      wrap(g, () => {
        g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = c; g.fillRect(-w / 2, -h / 2, w, h);
        if (furrow) { g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1.5; g.beginPath(); for (let k = -h / 2 + 5; k < h / 2; k += 7) { g.moveTo(-w / 2, k); g.lineTo(w / 2, k); } g.stroke(); }
        g.strokeStyle = 'rgba(40,44,28,0.35)'; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h);
        g.restore();
      });
    }
    river(g, r, '#b8a57c', 'rgba(60,54,36,0.5)', 7);                              // supply road
    river(g, r, 'rgba(40,36,26,0.75)', 'rgba(120,108,76,0.5)', 3);                // trench line
    blotches(g, r, 14, [[30, 28, 24], [48, 40, 30]], [30, 80], 0.6);              // scorched ground
    for (let i = 0; i < 46; i++) {                                                 // shell craters
      const x = r() * TILE, y = r() * TILE, R = 5 + r() * 12;
      wrap(g, () => {
        g.fillStyle = 'rgba(190,176,134,0.55)'; g.beginPath(); g.arc(x, y, R + 2.5, 0, TAU); g.fill();
        const gr = g.createRadialGradient(x - R * 0.2, y - R * 0.2, 1, x, y, R); gr.addColorStop(0, '#2a261e'); gr.addColorStop(1, '#55492f');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
      });
    }
    for (let i = 0; i < 9; i++) {                                                  // burning wrecks with smoke drifting downwind
      const x = r() * TILE, y = r() * TILE, L = 90 + r() * 110;
      wrap(g, () => {
        const gr = g.createLinearGradient(x, y, x + L, y - L * 0.5); gr.addColorStop(0, 'rgba(30,28,28,0.75)'); gr.addColorStop(1, 'rgba(70,70,70,0)');
        g.strokeStyle = gr; g.lineCap = 'round'; g.lineWidth = 16; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L * 0.5, y - L * 0.1, x + L, y - L * 0.5); g.stroke();
        g.fillStyle = '#2f3a26'; g.fillRect(x - 6, y - 4, 12, 8);
        const f = g.createRadialGradient(x, y, 0, x, y, 12); f.addColorStop(0, 'rgba(255,220,120,0.95)'); f.addColorStop(0.4, 'rgba(255,120,40,0.7)'); f.addColorStop(1, 'rgba(255,80,20,0)');
        g.fillStyle = f; g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill();
      });
    }
    for (let i = 0; i < 12; i++) {                                                 // armour on the move
      const x = r() * TILE, y = r() * TILE, a = r() * TAU;
      wrap(g, () => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-6, -3, 14, 9); g.fillStyle = '#3d4a30'; g.fillRect(-7, -4.5, 14, 9); g.fillStyle = '#566646'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.fillRect(0, -0.8, 9, 1.6); g.restore(); });
    }
  },
};

const cache = new Map();
/** Returns a seamless TILE x TILE landscape canvas (painted once per kind + tint). */
export function groundTile(kind, tint) {
  const key = kind + '|' + (tint || '');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(TILE * SS);
  const g = c.getContext('2d');
  g.scale(SS, SS);
  (PAINTERS[kind] || PAINTERS.desert)(g, rng(kind.length * 977 + 13));
  if (tint) { g.fillStyle = tint; g.fillRect(0, 0, TILE, TILE); }
  cache.set(key, c);
  return c;
}
