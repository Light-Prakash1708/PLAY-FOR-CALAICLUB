// A tiny 3D planet rendered on a 2D canvas: an equirectangular world texture
// (ocean, islands, ice caps) and a cloud layer are sphere-mapped per pixel,
// lit by a sun, wrapped in an atmosphere glow, and rotated every frame.
// Per-pixel longitude/latitude are precomputed once, so a frame is just a
// table lookup (fast enough for phones).

function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

/** Smooth value noise on a wrapping grid. */
function makeNoise(seed, gw, gh) {
  const r = rng(seed), g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const X0 = ((xi % gw) + gw) % gw, X1 = (X0 + 1) % gw, Y0 = Math.min(gh - 1, Math.max(0, yi)), Y1 = Math.min(gh - 1, Y0 + 1);
    const a = g[Y0 * gw + X0], b = g[Y0 * gw + X1], c = g[Y1 * gw + X0], d = g[Y1 * gw + X1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

const TW = 512, TH = 256;
let TEX = null, CLOUD = null;
function buildTextures() {
  if (TEX) return;
  TEX = new Uint8ClampedArray(TW * TH * 3); CLOUD = new Uint8ClampedArray(TW * TH);
  const n1 = makeNoise(7, 16, 9), n2 = makeNoise(11, 32, 17), n3 = makeNoise(23, 64, 33), c1 = makeNoise(41, 24, 13), c2 = makeNoise(59, 48, 25);
  for (let y = 0; y < TH; y++) {
    const lat = (y / TH - 0.5) * Math.PI, polar = Math.abs(lat) / (Math.PI / 2);
    for (let x = 0; x < TW; x++) {
      const u = x / TW, v = y / TH;
      let h = n1(u * 16, v * 8) * 0.62 + n2(u * 32, v * 16) * 0.28 + n3(u * 64, v * 32) * 0.1;   // terrain height
      h -= polar * 0.08;
      const i = (y * TW + x) * 3;
      let R, G, B;
      if (polar > 0.82 + n3(u * 64, v * 32) * 0.08) { R = 236; G = 244; B = 250; }                   // ice caps
      else if (h < 0.5) { const d = (0.5 - h) * 2.2; R = 30 - d * 14; G = 120 - d * 40; B = 190 - d * 40; if (h > 0.47) { R = 80; G = 200; B = 214; } }  // ocean + shallows
      else if (h < 0.515) { R = 236; G = 216; B = 160; }                                              // beach
      else if (h < 0.64) { const k = (h - 0.515) * 6; R = 96 - k * 30; G = 166 - k * 30; B = 84 - k * 20; }   // forest
      else if (h < 0.72) { R = 140; G = 128; B = 104; }                                               // hills
      else { R = 232; G = 236; B = 240; }                                                             // snowy peaks
      TEX[i] = R; TEX[i + 1] = G; TEX[i + 2] = B;
      const c = c1(u * 24, v * 12) * 0.7 + c2(u * 48, v * 24) * 0.3;
      CLOUD[y * TW + x] = Math.max(0, Math.min(255, (c - 0.55) * 900));
    }
  }
}

export class Globe {
  /** res: pixel size of the rendered sphere (the canvas is scaled up when drawn). */
  constructor(res = 220) {
    buildTextures();
    this.res = res;
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = res;
    this.g = this.cv.getContext('2d');
    this.img = this.g.createImageData(res, res);
    const n = res * res;
    this.u0 = new Float32Array(n); this.vrow = new Int32Array(n); this.lit = new Float32Array(n); this.mask = new Uint8Array(n); this.edge = new Float32Array(n);
    const tilt = 0.38, ct = Math.cos(tilt), st = Math.sin(tilt);
    const L = [-0.55, -0.45, 0.7], ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;   // sun from the upper left, in front
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = (i + 0.5) / res * 2 - 1, y = (j + 0.5) / res * 2 - 1, r2 = x * x + y * y, k = j * res + i;
      if (r2 >= 1) continue;
      const z = Math.sqrt(1 - r2);
      // tilt the planet's axis toward the viewer
      const y2 = y * ct - z * st, z2 = y * st + z * ct;
      this.u0[k] = (Math.atan2(x, z2) / (Math.PI * 2) + 1) % 1;
      this.vrow[k] = Math.min(TH - 1, Math.max(0, Math.floor((Math.asin(Math.max(-1, Math.min(1, y2))) / Math.PI + 0.5) * TH)));
      const d = x * L[0] + y * L[1] + z * L[2];
      this.lit[k] = 0.16 + 0.84 * Math.max(0, d) ** 0.85;
      this.edge[k] = 1 - z;                                            // 0 centre .. 1 rim, for haze
      this.mask[k] = 1;
    }
  }
  /** rot: planet spin (0..1 = one turn); crot: cloud layer offset. */
  paint(rot, crot) {
    const { res, u0, vrow, lit, mask, edge } = this, d = this.img.data;
    for (let k = 0, n = res * res; k < n; k++) {
      const o = k * 4;
      if (!mask[k]) { d[o + 3] = 0; continue; }
      let u = u0[k] + rot; u -= Math.floor(u);
      let uc = u0[k] + crot; uc -= Math.floor(uc);
      const row = vrow[k] * TW, ti = (row + ((u * TW) | 0)) * 3, ci = row + ((uc * TW) | 0);
      const c = CLOUD[ci] / 255, l = lit[k], e = edge[k] * edge[k];
      let R = TEX[ti] * (1 - c) + 255 * c, G = TEX[ti + 1] * (1 - c) + 255 * c, B = TEX[ti + 2] * (1 - c) + 255 * c;
      // atmospheric haze toward the rim, then sunlight
      R = (R * (1 - e * 0.55) + 120 * e * 0.55) * l; G = (G * (1 - e * 0.55) + 190 * e * 0.55) * l; B = (B * (1 - e * 0.55) + 255 * e * 0.55) * l;
      d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255;
    }
    this.g.putImageData(this.img, 0, 0);
    return this.cv;
  }
  /** Draws the planet centred at (cx, cy) with radius R, plus atmosphere glow. */
  draw(ctx, cx, cy, R, rot, crot) {
    const img = this.paint(rot, crot);
    const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
    glow.addColorStop(0, 'rgba(140,200,255,0.55)'); glow.addColorStop(0.4, 'rgba(110,170,255,0.18)'); glow.addColorStop(1, 'rgba(90,140,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, cx - R, cy - R, R * 2, R * 2);
    // thin bright rim on the sunlit side
    ctx.strokeStyle = 'rgba(200,235,255,0.45)'; ctx.lineWidth = Math.max(1.5, R * 0.012);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.995, Math.PI * 0.85, Math.PI * 1.75); ctx.stroke();
  }
}
