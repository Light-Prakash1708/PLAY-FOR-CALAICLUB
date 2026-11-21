// Team Battle tuning. Everything a designer would want to tweak for the
// arena mode lives here: modes, maps, the shrinking-zone schedule, weapon
// limits and bot difficulty.

export const BATTLE = {
  ROUND_TIME: 150,          // seconds; one round is always under 3 minutes
  SUDDEN_DEATH: 20,         // extra seconds if the score is tied at the horn
  MAP_R: 1900,              // hard edge of the battleground (aircraft are herded back)
  RESPAWN_HUMAN: 3.5,
  RESPAWN_BOT: 5.5,
  PACE: 0.84,               // every jet and missile flies at 84% of campaign speed: easier to follow
  SPAWN_SHIELD: 2.2,
  ASSIST_WINDOW: 5,         // seconds an attacker keeps credit for a zone death

  // ---- weapon limits (per life) ----
  BULLET_SPEED: 760,
  BULLET_LIFE: 0.56,
  DAMAGE_MUL: 0.6,          // battle damage relative to the campaign value
  AMMO: 180,                // cannon rounds per life
  HEAT_PER_SHOT: 0.068,     // ~15 rounds of continuous fire overheats the gun
  HEAT_COOL: 0.55,          // heat lost per second once the trigger is released
  HEAT_COOL_DELAY: 0.22,
  HEAT_RESUME: 0.3,         // an overheated gun unlocks below this heat
  MISSILE_CD: 2.4,
  MISSILE_DMG_MUL: 0.75,
  MISSILE_RANGE: 640,
  MISSILE_CONE: 0.55,
  FLARES: 3,
  FLARE_CD: 3.5,
  FLARE_AUTO_RANGE: 210,    // flares pop automatically for a missile this close
  SHIELD_TIME: 3.5,         // energy shield: blocks every bullet and missile for a few seconds
  SHIELD_CD: 15,
  BOOST_TIME: 1.5,
  BOOST_CD: 5,
  AIM_CONE: 0.2,
  AUTO_FIRE_CONE: 0.14,
  AUTO_FIRE_RANGE: 430,

  // ---- supply crates ----
  CRATE_EVERY: 11,
  CRATE_MAX: 3,
  CRATE_AMMO: 90,
};

/** Zone schedule: hold, then shrink to the next radius. dps = damage per second outside. */
export const ZONE_PHASES = [
  { r: 1400, hold: 16, shrink: 12, dps: 4 },
  { r: 1040, hold: 15, shrink: 12, dps: 6 },
  { r: 740,  hold: 14, shrink: 12, dps: 9 },
  { r: 470,  hold: 12, shrink: 12, dps: 13 },
  { r: 300,  hold: 999, shrink: 0, dps: 18 },
];

export const MODES = {
  team: { id: 'team', name: 'TEAM BATTLE', sub: 'You + wingmen vs an enemy squadron', humans: [0], size: 3, killTarget: 14 },
};
/** Squad sizes on offer. Smaller squads are calmer and easier to read. */
export const SIZES = {
  2: { name: '2 v 2', sub: 'Duel with a wingman', killTarget: 10 },
  3: { name: '3 v 3', sub: 'Recommended', killTarget: 14 },
  4: { name: '4 v 4', sub: 'Full chaos', killTarget: 20 },
};

export const MAPS = {
  desert: { id: 'desert', name: 'DESERT STORM', sub: 'Open dunes, nowhere to hide', theme: 'desert', grade: '255,170,90', gradeA: 0.16, sun: [0.12, 0.08], zone: '255,96,60' },
  ocean: { id: 'ocean', name: 'OCEAN STRAIT', sub: 'Islands, reefs and a carrier lane', theme: 'ocean', grade: '90,180,255', gradeA: 0.12, sun: [0.85, 0.07], zone: '255,80,140' },
  city: { id: 'city', name: 'METRO CITY', sub: 'Dogfight over the rooftops', theme: 'city', grade: '255,190,140', gradeA: 0.16, sun: [0.15, 0.06], zone: '200,90,255' },
  peaks: { id: 'peaks', name: 'FROZEN PEAKS', sub: 'Glaciers and razor ridges', theme: 'snow', grade: '120,170,255', gradeA: 0.14, sun: [0.85, 0.06], zone: '190,90,255' },
  lava: { id: 'lava', name: 'VOLCANO', sub: 'Rivers of fire below you', theme: 'lava', grade: '255,90,40', gradeA: 0.22, sun: [0.5, 0.0], zone: '255,200,60' },
  warzone: { id: 'warzone', name: 'WARZONE', sub: 'A battlefield at dusk', theme: 'warzone', grade: '255,110,60', gradeA: 0.2, sun: [0.2, 0.05], zone: '255,70,110' },
};

export const DIFFICULTY = {
  easy: { name: 'EASY', skill: 0.35, turn: 0.8, hp: 0.8, react: 0.7, fire: 0.6 },
  normal: { name: 'NORMAL', skill: 0.55, turn: 0.88, hp: 0.95, react: 0.45, fire: 0.8 },
  hard: { name: 'HARD', skill: 0.82, turn: 1.0, hp: 1.1, react: 0.2, fire: 1 },
};

// Bot rosters. Blue bots fly player designs, red bots fly the enemy designs.
export const BOT_NAMES = [
  ['FALCON', 'HAWK', 'KESTREL', 'OSPREY', 'HARRIER'],
  ['VIPER', 'COBRA', 'RAZOR', 'FANG', 'SPECTRE'],
];
export const BLUE_BOT_ART = ['warden', 'wisp', 'streak', 'hailstorm', 'bastion'];
export const RED_BOT_ART = ['fighter', 'interceptor', 'elite', 'armored', 'stealth'];
export const RED_BOT_STATS = {
  fighter: { speed: 215, turn: 2.9, damage: 10, fireRate: 6, hp: 100, missileDmg: 60, missiles: 3 },
  interceptor: { speed: 250, turn: 2.8, damage: 9, fireRate: 6.5, hp: 90, missileDmg: 60, missiles: 3 },
  elite: { speed: 230, turn: 3.1, damage: 11, fireRate: 6, hp: 105, missileDmg: 60, missiles: 3 },
  armored: { speed: 195, turn: 2.6, damage: 12, fireRate: 5.5, hp: 125, missileDmg: 60, missiles: 3 },
  stealth: { speed: 235, turn: 3.0, damage: 10, fireRate: 6, hp: 95, missileDmg: 60, missiles: 3 },
};

export const TEAMS = [
  { name: 'BLUE', main: '#3D8BFF', rgb: '61,139,255', light: '#CFE1FF', tracer: ['rgba(110,180,255,0.55)', '#EAF4FF'] },
  { name: 'RED', main: '#FF4B4B', rgb: '255,75,75', light: '#FFD0C8', tracer: ['rgba(255,90,60,0.55)', '#FFE2C8'] },
];
