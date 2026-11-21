// Enemy definitions. All behaviour is data: `pattern` selects an AI routine in
// EnemyAI.js and `weapon` describes how it shoots.
// weapon.kind: aim (forward gun) | burst | spread | turret (any direction) | missile
// Every aircraft also carries homing missiles (`missile`: cooldown and damage).
export const ENEMIES = {
  scout: { name: 'Scout Jet', size: 19, r: 13, hp: 18, speed: 185, turn: 2.3, contact: 10,
    pattern: 'zigzag', weapon: { kind: 'aim', cd: 2.6, range: 300, cone: 0.3, speed: 240, dmg: 6 }, missile: { cd: 16, dmg: 16 }, score: 50, coins: 3, explosion: 'small' },
  fighter: { name: 'Raider', size: 21, r: 15, hp: 40, speed: 180, turn: 2.0, contact: 14,
    pattern: 'chase', weapon: { kind: 'aim', cd: 1.8, range: 330, cone: 0.35, speed: 250, dmg: 8 }, missile: { cd: 12, dmg: 18 },
    score: 100, coins: 5, explosion: 'small' },
  bomber: { name: 'Strike Bomber', size: 34, r: 26, hp: 110, speed: 95, turn: 0.8, contact: 18, hpBar: true,
    pattern: 'straight', weapon: { kind: 'turret', cd: 2.8, range: 340, speed: 205, dmg: 9, count: 2, arc: 0.2 }, missile: { cd: 10, dmg: 20 },
    score: 250, coins: 14, explosion: 'large' },
  interceptor: { name: 'Interceptor', size: 21, r: 14, hp: 32, speed: 300, turn: 2.2, contact: 16,
    pattern: 'sweep', weapon: { kind: 'burst', cd: 3.0, range: 360, cone: 0.3, speed: 295, dmg: 7, count: 3, gap: 0.1 }, missile: { cd: 14, dmg: 18 },
    score: 150, coins: 7, explosion: 'small' },
  carrier: { name: 'Missile Carrier', size: 29, r: 22, hp: 110, speed: 125, turn: 1.2, contact: 20, hpBar: true,
    pattern: 'circle', orbit: 280, weapon: { kind: 'missile', cd: 4.4, range: 540, dmg: 20 },
    score: 300, coins: 16, explosion: 'large' },
  armored: { name: 'Armoured Jet', size: 28, r: 19, hp: 190, speed: 140, turn: 1.5, contact: 18, hpBar: true,
    pattern: 'chase', weapon: { kind: 'aim', cd: 1.6, range: 330, cone: 0.4, speed: 230, dmg: 11, count: 2 }, missile: { cd: 11, dmg: 20 },
    score: 300, coins: 15, explosion: 'large' },
  stealth: { name: 'Ghost Jet', size: 26, r: 16, hp: 60, speed: 215, turn: 2.8, contact: 16, cloak: true,
    pattern: 'erratic', weapon: { kind: 'aim', cd: 1.5, range: 320, cone: 0.6, speed: 265, dmg: 10 }, missile: { cd: 12, dmg: 20 },
    score: 250, coins: 12, explosion: 'small' },
  squadron: { name: 'Squadron Jet', size: 20, r: 14, hp: 36, speed: 205, turn: 1.7, contact: 14,
    pattern: 'sweep', weapon: { kind: 'aim', cd: 2.3, range: 340, cone: 0.45, speed: 250, dmg: 8 }, missile: { cd: 20, dmg: 16 },
    score: 120, coins: 6, explosion: 'small' },
  elite: { name: 'Ace Fighter', size: 24, r: 17, hp: 150, speed: 232, turn: 2.6, contact: 16, hpBar: true,
    pattern: 'elite', weapon: { kind: 'spread', cd: 1.7, range: 340, cone: 0.5, speed: 260, dmg: 8, count: 3, arc: 0.2 },
    missile: { cd: 8, dmg: 18 }, score: 500, coins: 25, explosion: 'large' },

  // Bosses: `phases` are entered as health drops below each `until` fraction.
  stormCarrier: { name: 'STORM CARRIER', boss: true, size: 60, r: 42, hp: 700, speed: 105, turn: 0.75, contact: 20,
    pattern: 'boss', orbit: 250, score: 3000, coins: 120, explosion: 'boss',
    phases: [
      { until: 0.5, speed: 1, attacks: [
        { kind: 'spread', cd: 1.6, count: 3, arc: 0.2, speed: 225, dmg: 9 },
        { kind: 'missile', cd: 4.6, count: 1, dmg: 20 } ] },
      { until: 0, speed: 1.25, attacks: [
        { kind: 'ring', cd: 3.0, count: 12, speed: 175, dmg: 9 },
        { kind: 'spread', cd: 2.0, count: 3, arc: 0.24, speed: 245, dmg: 9 },
        { kind: 'missile', cd: 4.6, count: 1, dmg: 20 } ] },
    ] },
  dreadnought: { name: 'DREADNOUGHT', boss: true, size: 84, r: 58, hp: 2100, speed: 112, turn: 0.7, contact: 22,
    pattern: 'boss', orbit: 270, score: 10000, coins: 300, explosion: 'boss',
    phases: [
      { until: 0.66, speed: 1, attacks: [
        { kind: 'spread', cd: 2.0, count: 3, arc: 0.2, speed: 230, dmg: 8 },
        { kind: 'missile', cd: 4.8, count: 2, dmg: 20 } ] },
      { until: 0.33, speed: 1.15, attacks: [
        { kind: 'spiral', cd: 4.6, duration: 2.4, rate: 0.1, arms: 2, spin: 2.6, speed: 180, dmg: 8 },
        { kind: 'spread', cd: 2.6, count: 3, arc: 0.22, speed: 240, dmg: 8 },
        { kind: 'summon', cd: 11, type: 'fighter', count: 2 } ] },
      { until: 0, speed: 1.35, attacks: [
        { kind: 'ring', cd: 3.4, count: 12, speed: 180, dmg: 8 },
        { kind: 'spiral', cd: 6.2, duration: 2.0, rate: 0.1, arms: 3, spin: -2.2, speed: 185, dmg: 8 },
        { kind: 'missile', cd: 4.6, count: 2, dmg: 20 },
        { kind: 'summon', cd: 13, type: 'interceptor', count: 2 } ] },
    ] },
  warlord: { name: 'WARLORD', boss: true, size: 78, r: 54, hp: 2300, speed: 124, turn: 0.85, contact: 22,
    pattern: 'boss', orbit: 260, score: 15000, coins: 400, explosion: 'boss',
    phases: [
      { until: 0.7, speed: 1, attacks: [
        { kind: 'spread', cd: 1.9, count: 3, arc: 0.18, speed: 235, dmg: 9 },
        { kind: 'missile', cd: 5.0, count: 2, dmg: 20 },
        { kind: 'summon', cd: 12, type: 'squadron', count: 2 } ] },
      { until: 0.38, speed: 1.2, attacks: [
        { kind: 'ring', cd: 3.4, count: 12, speed: 185, dmg: 9 },
        { kind: 'spread', cd: 2.4, count: 5, arc: 0.16, speed: 240, dmg: 9 },
        { kind: 'summon', cd: 12, type: 'fighter', count: 2 } ] },
      { until: 0, speed: 1.4, attacks: [
        { kind: 'spiral', cd: 5.4, duration: 2.2, rate: 0.085, arms: 3, spin: 2.4, speed: 185, dmg: 9 },
        { kind: 'ring', cd: 3.6, count: 14, speed: 180, dmg: 9 },
        { kind: 'missile', cd: 4.4, count: 3, dmg: 20 } ] },
    ] },
};
for (const id in ENEMIES) { ENEMIES[id].id = id; ENEMIES[id].r = Math.round(ENEMIES[id].r * 1.12); }   // jets are drawn 15% larger; hitboxes follow

// Order in which the ten enemy classes are presented (docs / codex).
export const ENEMY_ROSTER = ['scout', 'fighter', 'bomber', 'interceptor', 'carrier', 'armored', 'stealth', 'squadron', 'elite', 'boss'];
