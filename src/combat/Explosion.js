// Explosion presets: one place that maps a "kind" to VFX + audio + shake.
import { rand } from '../core/utils.js';

export function explode(world, kind, x, y, colors) {
  const { vfx, audio } = world;
  if (kind === 'large') {
    vfx.explosionLarge(x, y, colors);
    audio.sfx('explodeL');
  } else {
    vfx.explosionSmall(x, y, colors);
    audio.sfx('explodeS');
  }
}

/** Multi-stage boss destruction. Driven by real time so slow motion stays smooth. */
export class BossDeath {
  constructor(boss) { this.boss = boss; this.t = 0; this.next = 0; this.done = false; this.duration = 2.6; }
  update(realDt, world) {
    if (this.done) return;
    const b = this.boss;
    this.t += realDt;
    this.next -= realDt;
    if (this.next <= 0 && this.t < this.duration) {
      this.next = 0.13;
      const x = b.x + rand(-b.r, b.r) * 1.2, y = b.y + rand(-b.r, b.r) * 1.2;
      world.vfx.explosionSmall(x, y, b.debris);
      if (Math.random() < 0.5) world.vfx.explosionLarge(x, y);
      world.audio.sfx(Math.random() < 0.5 ? 'explodeS' : 'explodeL');
    }
    if (this.t >= this.duration) {
      this.done = true;
      const v = world.vfx;
      for (let i = 0; i < 5; i++) v.explosionLarge(b.x + rand(-b.r, b.r), b.y + rand(-b.r, b.r), b.debris);
      v.ring(b.x, b.y, 20, 420, 0.9, '255,255,255', 14);
      v.ring(b.x, b.y, 10, 300, 0.7, '255,200,110', 8);
      v.debris(b.x, b.y, 26, b.debris);
      v.flash('255,255,255', 0.85);
      v.shake(22);
      world.audio.sfx('bossBoom');
      world.vibrate([60, 40, 120]);
    }
  }
}
