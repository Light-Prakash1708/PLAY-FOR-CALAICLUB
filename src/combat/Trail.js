// Fixed-size ring buffer of positions used for contrails and missile paths.
export class Trail {
  constructor(n, spacing) {
    this.n = n; this.spacing = spacing;
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.head = 0; this.len = 0; this.count = 0;
  }
  reset() { this.head = 0; this.len = 0; this.count = 0; }
  add(x, y) {
    if (this.len > 0) {
      const li = (this.head + this.n - 1) % this.n;
      const dx = x - this.x[li], dy = y - this.y[li];
      if (dx * dx + dy * dy < this.spacing * this.spacing) return;
    }
    this.x[this.head] = x; this.y[this.head] = y;
    this.head = (this.head + 1) % this.n;
    if (this.len < this.n) this.len++;
    this.count++;
  }
  /** Soft fading ribbon (aircraft contrail), drawn in 4 alpha bands. */
  drawRibbon(ctx, cx, cy, width, rgb, alpha, bands = 4) {
    const L = this.len;
    if (L < 2) return;
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    const per = Math.ceil(L / bands);
    let px = cx, py = cy, i = 0;
    for (let b = 0; b < bands && i < L; b++) {
      const k = 1 - b / bands;
      ctx.strokeStyle = `rgba(${rgb},${(alpha * k).toFixed(3)})`;
      ctx.lineWidth = width * (0.55 + 0.45 * k);
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let j = 0; j < per && i < L; j++, i++) {
        const idx = (this.head + this.n - 1 - i) % this.n;
        px = this.x[idx]; py = this.y[idx];
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  /** White dashed flight path (missiles). Dashes are anchored to world points so they do not crawl. */
  drawDashed(ctx, width, rgb, alpha) {
    const L = this.len;
    if (L < 2) return;
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    const bands = 3, per = Math.ceil(L / bands);
    let i = 0;
    for (let b = 0; b < bands; b++) {
      ctx.strokeStyle = `rgba(${rgb},${(alpha * (1 - b / bands)).toFixed(3)})`;
      ctx.beginPath();
      for (let j = 0; j < per && i < L - 1; j++, i++) {
        const abs = this.count - 1 - i;
        if (abs & 1) continue;
        const a = (this.head + this.n - 1 - i) % this.n, c = (a + this.n - 1) % this.n;
        ctx.moveTo(this.x[a], this.y[a]); ctx.lineTo(this.x[c], this.y[c]);
      }
      ctx.stroke();
    }
  }
}
