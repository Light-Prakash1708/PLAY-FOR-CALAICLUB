// The ten playable aircraft (fictional designs). Stats are base values before upgrades.
// special: 'spread' (timed spread shot) | 'salvo' (multi-missile) | 'bomb' (shockwave)
// unlock: { price, level?: campaign level that must be completed, stars?: total rating stars }
export const AIRCRAFT = [
  { id: 'ember', name: 'EMBER', role: 'Starter', size: 26,
    desc: 'A simple, tough delta-wing interceptor. Forgiving handling makes it the perfect first ride.',
    stats: { speed: 215, turn: 3.0, damage: 10, fireRate: 6, hp: 100, missileDmg: 60, missiles: 4 },
    guns: 1, special: 'spread', unlock: { price: 0 } },
  { id: 'streak', name: 'STREAK', role: 'High speed', size: 29,
    desc: 'Built to outrun everything in the sky. Enormous engines, light armour, blistering pace.',
    stats: { speed: 275, turn: 3.1, damage: 10, fireRate: 6.5, hp: 90, missileDmg: 60, missiles: 4 },
    guns: 1, special: 'spread', unlock: { price: 300, level: 1 } },
  { id: 'bruiser', name: 'BRUISER', role: 'Heavy guns', size: 27,
    desc: 'A low-level strike jet with heavy cannons. Slow to turn, but every round hits hard.',
    stats: { speed: 215, turn: 2.75, damage: 16, fireRate: 5, hp: 115, missileDmg: 70, missiles: 4 },
    guns: 2, special: 'bomb', unlock: { price: 600, level: 2 } },
  { id: 'wisp', name: 'WISP', role: 'Manoeuvrable', size: 26,
    desc: 'A light tailless delta with a turning circle no enemy can match.',
    stats: { speed: 250, turn: 4.3, damage: 11, fireRate: 7, hp: 100, missileDmg: 70, missiles: 5 },
    guns: 1, special: 'spread', unlock: { price: 900, level: 3 } },
  { id: 'hailstorm', name: 'HAILSTORM', role: 'Rapid fire', size: 28,
    desc: 'A swept-wing fighter with a rotary cannon that never seems to stop.',
    stats: { speed: 245, turn: 3.3, damage: 9, fireRate: 11, hp: 105, missileDmg: 70, missiles: 5 },
    guns: 2, special: 'salvo', unlock: { price: 1400, level: 4 } },
  { id: 'manta', name: 'MANTA', role: 'Missile boat', size: 27,
    desc: 'Carries a double rack of homing missiles and fires them in pairs.',
    stats: { speed: 240, turn: 3.2, damage: 12, fireRate: 7, hp: 115, missileDmg: 115, missiles: 8 },
    guns: 2, special: 'salvo', dualMissile: true, unlock: { price: 1900, level: 5 } },
  { id: 'warden', name: 'WARDEN', role: 'All-rounder', size: 28,
    desc: 'A twin-engine air-superiority fighter with no weak points.',
    stats: { speed: 258, turn: 3.6, damage: 13, fireRate: 8, hp: 130, missileDmg: 90, missiles: 6 },
    guns: 2, special: 'spread', unlock: { price: 2500, level: 6, stars: 12 } },
  { id: 'bastion', name: 'BASTION', role: 'Durable', size: 31,
    desc: 'A heavy two-seat multirole fighter. Thick armour and room for plenty of ordnance.',
    stats: { speed: 225, turn: 2.9, damage: 14, fireRate: 7.5, hp: 210, missileDmg: 90, missiles: 6 },
    guns: 2, special: 'bomb', unlock: { price: 3200, level: 7 } },
  { id: 'ravager', name: 'RAVAGER', role: 'High damage', size: 28,
    desc: 'A canard-delta with a hard-hitting cannon. Enemies rarely need a second pass.',
    stats: { speed: 255, turn: 3.4, damage: 21, fireRate: 6, hp: 135, missileDmg: 130, missiles: 6 },
    guns: 2, special: 'bomb', unlock: { price: 4000, level: 8, stars: 20 } },
  { id: 'zenith', name: 'ZENITH', role: 'Ultimate', size: 31,
    desc: 'The ultimate air-superiority fighter. Awarded only to pilots who win the Final Showdown.',
    stats: { speed: 288, turn: 4.0, damage: 17, fireRate: 9, hp: 180, missileDmg: 140, missiles: 8 },
    guns: 3, special: 'salvo', dualMissile: true, unlock: { price: 0, level: 10, reward: true } },
];
export const AIRCRAFT_BY_ID = Object.fromEntries(AIRCRAFT.map((a, i) => [a.id, Object.assign(a, { tier: i })]));

export const SPECIAL_INFO = {
  spread: { name: 'SPREAD SHOT', desc: 'Five-way cannon fire for a few seconds.' },
  salvo: { name: 'MISSILE SALVO', desc: 'Launches six homing missiles at once.' },
  bomb: { name: 'SHOCK BOMB', desc: 'A blast wave that wipes out nearby threats.' },
};

// Stat ranges used to draw comparison bars in the hangar.
export const STAT_MAX = { speed: 340, turn: 5, damage: 30, fireRate: 15, hp: 320, missileDmg: 240 };
