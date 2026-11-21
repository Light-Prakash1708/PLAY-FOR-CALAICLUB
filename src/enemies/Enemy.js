// A pooled enemy aircraft. Behaviour lives in EnemyAI.js / Boss.js; this class
// only stores state and knows how to draw itself.
import { getSprite, drawSprite, drawEngines } from '../art/PlaneArt.js';
import { ENEMY_ART } from '../art/planeSpecs.js';
import { Trail } from '../combat/Trail.js';
import { rand, TAU } from '../core/utils.js';

export class Enemy {
  constructor() { this.alive = false; this.trail = new Trail(16, 10); }

  reset(def, x, y, a, uid) {
    this.def = def; this.uid = uid;
    this.art = ENEMY_ART[def.id];
    this.sprite = getSprite('e_' + def.id, this.art, def.size);
    this.debris = [this.art.colors.body, this.art.colors.wing, this.art.colors.accent];
    this.x = x; this.y = y; this.a = a;
    this.vel = def.speed; this.speedMul = 1;
    this.hp = this.maxHp = def.hp; this.r = def.r;
    this.pattern = def.pattern;
    this.t = 0; this.bank = 0; this.flash = 0;
    this.fireT = rand(0.8, 1.6) * (def.weapon ? def.weapon.cd : 1) * 0.6;
    this.missT = def.missile ? def.missile.cd * rand(0.5, 1) : 0;
    this.burstN = 0; this.burstT = 0;
    this.seed = rand(TAU); this.side = Math.random() < 0.5 ? 1 : -1;
    this.mode = def.pattern === 'straight' ? 'turn' : 'attack';
    this.timer = 0; this.passT = 0;
    this.offX = rand(-110, 110); this.offY = rand(-110, 110);
    this.wpx = x; this.wpy = y;
    this.jink = 0; this.jinkCd = 0; this.jinkDir = 1;
    this.alpha = 1; this.cloaked = false; this.cloakT = rand(0, 2);
    this.leader = null; this.leaderUid = 0; this.slotX = 0; this.slotY = 0; this.slot = 0;
    this.volley = 0; this.seenVolley = 0; this.volleyDelay = -1;
    this.formId = 0; this.wave = -1;
    this.dying = false; this.dist = 9999; this.toP = 0;
    // boss state
    this.phase = 0; this.invuln = 0; this.atkT = null; this.spiral = null; this.turret = 0;
    this.trail.reset();
  }

  render(ctx, time, q) {
    const d = this.def;
    if (this.alpha > 0.5 && q > 0.45) this.trail.drawRibbon(ctx, this.x, this.y, d.boss ? 16 : 6, '255,255,255', d.boss ? 0.22 : 0.26);
    if (this.alpha > 0.5) drawEngines(ctx, this.art, d.size, this.x, this.y, this.a, time + this.seed, 1, this.bank);
    drawSprite(ctx, this.sprite, this.x, this.y, this.a, this.bank, this.alpha, this.flash > 0);
    if (d.boss) {
      if (this.invuln > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(time * 30)})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.5, 0, TAU); ctx.stroke();
      }
    } else if (d.hpBar && this.hp < this.maxHp && this.alpha > 0.5) {
      const w = d.size * 1.6, x = this.x - w / 2, y = this.y - d.size * 1.25 - 8;
      ctx.fillStyle = 'rgba(40,25,20,0.45)'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
      ctx.fillStyle = '#F2C230'; ctx.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), 4);
    }
  }
}
