// Decorative sky scene shown behind the loading screen and menus:
// a few aircraft looping around with contrails and a dotted missile trail.
import { getSprite, drawSprite, drawEngines } from '../art/PlaneArt.js';
import { PLAYER_ART, ENEMY_ART } from '../art/planeSpecs.js';
import { AIRCRAFT_BY_ID } from '../data/aircraft.js';
import { Trail } from '../combat/Trail.js';
import { turnToward, rand, TAU } from './utils.js';

export class Ambient {
  constructor(game) {
    this.game = game;
    this.cam = { x: 0, y: 0 };
    this.t = 0;
    this.planes = [];
    this.hero = this._make('ember', PLAYER_ART.ember, 22, 150, 2.2);
    this.planes.push(this.hero);
    this.planes.push(this._make('scout', ENEMY_ART.scout, 17, 135, 1.6));
    this.planes.push(this._make('fighter', ENEMY_ART.fighter, 19, 160, 1.4));
    this.chaser = { x: -200, y: 300, a: 0, trail: new Trail(44, 9) };
  }
  _make(id, art, size, speed, turn) {
    return { id, art, size, speed, turn, x: rand(-200, 200), y: rand(-300, 300), a: rand(TAU), wx: 0, wy: 0, timer: 0, bank: 0,
      sprite: getSprite('amb_' + id, art, size), trail: new Trail(30, 9) };
  }
  /** Show the player's selected aircraft as the hero plane. */
  setHero(id) {
    if (this.hero.id === id) return;
    const a = AIRCRAFT_BY_ID[id];
    this.hero.id = id; this.hero.art = PLAYER_ART[id]; this.hero.size = a.size;
    this.hero.sprite = getSprite('p_' + id, PLAYER_ART[id], a.size);
  }
  update(dt) {
    this.t += dt;
    const v = this.game.view;
    this.cam.y -= 26 * dt;                                  // slow drift so clouds parallax
    for (const p of this.planes) {
      p.timer -= dt;
      const dx = p.wx - (p.x - this.cam.x), dy = p.wy - (p.y - this.cam.y);
      if (p.timer <= 0 || dx * dx + dy * dy < 2500) {
        p.wx = rand(-v.w * 0.42, v.w * 0.42); p.wy = rand(-v.h * 0.42, v.h * 0.3); p.timer = rand(2, 4);
      }
      const want = Math.atan2(p.wy + this.cam.y - p.y, p.wx + this.cam.x - p.x);
      const before = p.a;
      p.a = turnToward(p.a, want, p.turn * dt);
      p.bank += ((p.a - before) / dt * 0.4 - p.bank) * Math.min(1, dt * 6);
      p.x += Math.cos(p.a) * p.speed * dt; p.y += Math.sin(p.a) * p.speed * dt - 26 * dt;
      p.trail.add(p.x - Math.cos(p.a) * p.size * 0.8, p.y - Math.sin(p.a) * p.size * 0.8);
    }
    // a harmless missile forever chasing the hero, drawing the signature dotted path
    const c = this.chaser, h = this.hero;
    c.a = turnToward(c.a, Math.atan2(h.y - c.y, h.x - c.x), 1.5 * dt);
    c.x += Math.cos(c.a) * 150 * dt; c.y += Math.sin(c.a) * 150 * dt - 26 * dt;
    c.trail.add(c.x, c.y);
    this.game.background.update(dt);
  }
  render(ctx) {
    const v = this.game.view, bg = this.game.background;
    bg.render(ctx, this.cam, v.w, v.h);
    ctx.save();
    ctx.translate(v.w / 2 - this.cam.x, v.h / 2 - this.cam.y);
    const c = this.chaser;
    c.trail.drawRibbon(ctx, c.x, c.y, 5, '255,255,255', 0.55, 6);
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
    ctx.fillStyle = '#eef1f3'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(4, -2.8); ctx.lineTo(-7, -2.8); ctx.lineTo(-7, 2.8); ctx.lineTo(4, 2.8); ctx.fill();
    ctx.restore();
    for (const p of this.planes) {
      p.trail.drawRibbon(ctx, p.x - Math.cos(p.a) * p.size * 0.8, p.y - Math.sin(p.a) * p.size * 0.8, p === this.hero ? 9 : 6, '255,255,255', 0.34, 8);
      drawEngines(ctx, p.art, p.size, p.x, p.y, p.a, this.t, 1, p.bank);
      drawSprite(ctx, p.sprite, p.x, p.y, p.a, Math.max(-1, Math.min(1, p.bank)));
    }
    ctx.restore();
    bg.renderFront(ctx, this.cam, v.w, v.h);
  }
}
