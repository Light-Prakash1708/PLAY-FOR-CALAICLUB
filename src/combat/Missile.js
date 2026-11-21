// Homing missiles for both sides, trailing soft smoke. Enemy missiles turn
// slowly so a good pilot can out-fly them, and flares pull them off target.
import { ObjectPool } from '../systems/ObjectPool.js';
import { Trail } from './Trail.js';
import { turnToward, rand } from '../core/utils.js';

export class MissileSystem {
  constructor() {
    this.pool = new ObjectPool(() => ({ x: 0, y: 0, a: 0, speed: 0, max: 0, turn: 0, life: 0, dmg: 0, team: 0, r: 6,
      target: null, targetUid: 0, smokeT: 0, retargetT: 0, trail: new Trail(44, 9) }), 40);
    this.playerAirborne = 0; this.threats = 0;
  }
  reset() { this.pool.clear(); this.playerAirborne = 0; this.threats = 0; }

  launch(team, x, y, a, dmg, target) {
    const m = this.pool.obtain();
    if (!m) return null;
    m.team = team; m.x = x; m.y = y; m.a = a; m.dmg = dmg;
    m.target = target || null; m.targetUid = target ? target.uid : 0;
    m.smokeT = 0; m.retargetT = 0; m.decoy = null; m.threat = false; m.owner = null;
    m.trail.reset();
    if (team === 0) { m.speed = 260; m.max = 620; m.turn = 5.2; m.life = 3.2; }
    else { m.speed = 150; m.max = rand(232, 250); m.turn = 1.75; m.life = 6.5; }
    return m;
  }

  update(dt, world) {
    const a = this.pool.active, p = world.player;
    let airborne = 0, threats = 0;
    const T2 = 540 * 540;
    for (let i = 0; i < a.length; i++) {
      const m = a[i];
      if (!m.alive) continue;
      m.life -= dt;
      if (m.life <= 0) { this.fizzle(m, world); continue; }
      let tx, ty, has = false;
      if (m.team === 0) {
        airborne++;
        let t = m.target;
        if (t && (!t.alive || t.uid !== m.targetUid || t.dying)) t = m.target = null;
        if (!t) {
          m.retargetT -= dt;
          if (m.retargetT <= 0) { m.retargetT = 0.2; t = m.target = world.enemies.nearest(m.x, m.y, 460, true); if (t) m.targetUid = t.uid; }
        }
        if (t) { tx = t.x; ty = t.y; has = true; }
      } else if (m.decoy) {
        // spoofed by a flare: chase it while it burns, then fly on blind
        if (m.decoy.alive && m.decoy.life > 0) { tx = m.decoy.x; ty = m.decoy.y; has = true; }
        m.threat = false;
      } else if (p.alive && !world.ending) {
        tx = p.x; ty = p.y; has = true;
        m.threat = (tx - m.x) ** 2 + (ty - m.y) ** 2 < T2;
        if (m.threat) threats++;
      }
      if (has) m.a = turnToward(m.a, Math.atan2(ty - m.y, tx - m.x), m.turn * dt);
      m.speed += (m.max - m.speed) * Math.min(1, dt * 2.5);
      m.x += Math.cos(m.a) * m.speed * dt; m.y += Math.sin(m.a) * m.speed * dt;
      m.trail.add(m.x, m.y);
      m.smokeT -= dt;
      if (m.smokeT <= 0) { m.smokeT = m.team === 0 ? 0.035 : 0.06; world.vfx.smoke(m.x - Math.cos(m.a) * 8, m.y - Math.sin(m.a) * 8, 3.5, 0.45); }
    }
    this.pool.sweep();
    this.playerAirborne = airborne; this.threats = threats;
  }
  // ---- Team Battle: both teams fire the same missile, homing on fighters ----
  launchBattle(owner, x, y, a, dmg, target) {
    const m = this.launch(owner.team, x, y, a, dmg, target);
    if (!m) return null;
    m.owner = owner; m.speed = 210; m.max = 440; m.turn = target && target.human ? 2.2 : 2.5; m.life = 4.4;   // dodgeable with a hard turn or a boost
    return m;
  }
  updateBattle(dt, world) {
    const a = this.pool.active;
    let threats = 0;
    for (let i = 0; i < a.length; i++) {
      const m = a[i];
      if (!m.alive) continue;
      m.life -= dt;
      if (m.life <= 0) { this.fizzle(m, world); continue; }
      let t = m.target, tx, ty, has = false;
      m.threat = false;
      if (m.decoy) {
        if (m.decoy.alive && m.decoy.life > 0) { tx = m.decoy.x; ty = m.decoy.y; has = true; }
      } else {
        if (t && (!t.alive || t.uid !== m.targetUid)) t = m.target = null;
        if (!t) {
          m.retargetT -= dt;
          if (m.retargetT <= 0) { m.retargetT = 0.25; t = m.target = world.seekerTarget(m); if (t) m.targetUid = t.uid; }
        }
        if (t) {
          tx = t.x; ty = t.y; has = true;
          if (t.human && (tx - m.x) ** 2 + (ty - m.y) ** 2 < 540 * 540) { m.threat = true; threats++; t.threatT = 0.15; }
        }
      }
      if (has) m.a = turnToward(m.a, Math.atan2(ty - m.y, tx - m.x), m.turn * dt);
      m.speed += (m.max - m.speed) * Math.min(1, dt * 2.5);
      m.x += Math.cos(m.a) * m.speed * dt; m.y += Math.sin(m.a) * m.speed * dt;
      m.trail.add(m.x, m.y);
      m.smokeT -= dt;
      if (m.smokeT <= 0) { m.smokeT = 0.04; world.vfx.smoke(m.x - Math.cos(m.a) * 8, m.y - Math.sin(m.a) * 8, 3.5, 0.5); }
    }
    this.pool.sweep();
    this.threats = threats;
  }
  explode(m, world) {
    if (!m.alive) return;
    m.alive = false;
    world.vfx.explosionSmall(m.x, m.y);
    if (world.glow) world.glow(m.x, m.y, 80, 0.35, '255,170,90');
    world.audio.sfx('missileHit');
  }
  fizzle(m, world) {
    m.alive = false;
    world.vfx.burst(m.x, m.y, 4, 70, 7, 0.3);
    world.vfx.smoke(m.x, m.y, 9, 0.6);
  }
  render(ctx, t) {
    const a = this.pool.active;
    for (let i = 0; i < a.length; i++) {
      const m = a[i];
      m.trail.drawRibbon(ctx, m.x, m.y, m.team === 0 ? 4 : 5, '255,255,255', 0.55, 6);
    }
    for (let i = 0; i < a.length; i++) {
      const m = a[i];
      ctx.save();
      ctx.translate(m.x, m.y); ctx.rotate(m.a);
      const fl = 5 + 3 * Math.sin(t * 50 + i);
      ctx.fillStyle = '#FFB347';
      ctx.beginPath(); ctx.moveTo(-7, -2.2); ctx.lineTo(-7 - fl, 0); ctx.lineTo(-7, 2.2); ctx.fill();
      ctx.fillStyle = m.owner ? (m.team === 0 ? '#E8F1FF' : '#FFE6E0') : m.team === 0 ? '#FFFFFF' : '#1F6F78';
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(4, -2.8); ctx.lineTo(-7, -2.8); ctx.lineTo(-7, 2.8); ctx.lineTo(4, 2.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = m.owner ? (m.team === 0 ? '#3D8BFF' : '#FF4B4B') : m.team === 0 ? '#E23B3F' : '#4A4A55';
      ctx.beginPath(); ctx.moveTo(-3, -2.8); ctx.lineTo(-8, -6); ctx.lineTo(-7, -2.8); ctx.moveTo(-3, 2.8); ctx.lineTo(-8, 6); ctx.lineTo(-7, 2.8); ctx.fill();
      ctx.restore();
      if (m.threat && Math.sin(t * 16) > -0.3) {      // warning bracket on missiles hunting the player
        ctx.strokeStyle = '#E23B3F'; ctx.lineWidth = 2;
        const r = 15, c = 6;
        ctx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(m.x + sx * r, m.y + sy * (r - c)); ctx.lineTo(m.x + sx * r, m.y + sy * r); ctx.lineTo(m.x + sx * (r - c), m.y + sy * r); }
        ctx.stroke();
      }
    }
  }
}
