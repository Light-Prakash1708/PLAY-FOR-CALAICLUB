// The ten campaign missions. Nothing here is hard-coded in the engine:
// LevelManager reads these configs to drive spawning, objectives and bosses.
//
// stream  : continuous spawner. interval/maxAlive are [start, end] and are
//           interpolated by objective progress. events are weighted.
// waves   : scripted groups; the next wave starts when the previous is destroyed.
// event   : { type, n, form?: 'v' | 'line', w?: weight }
// objective.type: kills | kinds | formations | waves | boss | survive (seconds)
// fireMul : enemy attack-frequency multiplier for the mission.
// missiles: enemy missile-launch rate multiplier (0 = guns only). Default 1.
export const LEVELS = [
  { id: 1, name: 'FIRST FLIGHT', difficulty: 1, theme: 'day', reward: 100, par: 90, fireMul: 0.8, missiles: 0, tutorial: true,
    brief: 'Learn the controls and clear the sky of enemy scouts.',
    objective: { type: 'kills', count: 10, label: 'Destroy 10 enemies' },
    stream: { interval: [2.6, 1.8], maxAlive: [2, 3], events: [{ type: 'scout', n: 1, w: 3 }, { type: 'scout', n: 2, w: 1 }] } },

  { id: 2, name: 'SKY PATROL', difficulty: 1, theme: 'morning', reward: 150, par: 100, fireMul: 0.85, missiles: 0.6,
    brief: 'Enemy raiders are patrolling the area with guns and missiles. Use your flares.',
    objective: { type: 'kills', count: 15, label: 'Destroy 15 enemies' },
    stream: { interval: [2.6, 1.9], maxAlive: [3, 4], events: [{ type: 'fighter', n: 1, w: 3 }, { type: 'scout', n: 2, w: 2 }, { type: 'fighter', n: 2, w: 1 }] } },

  { id: 3, name: 'AIR RAID', difficulty: 2, theme: 'noon', reward: 200, par: 135, fireMul: 0.8, missiles: 0.4,
    brief: 'Heavy bombers are inbound with escort formations. Break them up.',
    objective: { type: 'kills', count: 20, label: 'Destroy 20 enemies' },
    stream: { interval: [3.4, 2.6], maxAlive: [4, 6], events: [
      { type: 'bomber', n: 1, w: 3 }, { type: 'scout', n: 4, form: 'v', w: 2 },
      { type: 'fighter', n: 3, form: 'v', w: 2 }, { type: 'scout', n: 5, form: 'line', w: 1 }] } },

  { id: 4, name: 'SPEED HUNTERS', difficulty: 2, theme: 'altitude', reward: 250, par: 140, fireMul: 0.85, missiles: 0.5,
    brief: 'Interceptors strike fast and vanish. Keep turning and pick them off.',
    objective: { type: 'kills', count: 25, label: 'Destroy 25 enemies' },
    stream: { interval: [2.6, 1.8], maxAlive: [3, 5], events: [
      { type: 'interceptor', n: 2, w: 3 }, { type: 'interceptor', n: 1, w: 2 },
      { type: 'scout', n: 3, form: 'line', w: 2 }, { type: 'fighter', n: 1, w: 1 }] } },

  { id: 5, name: 'MISSILE STORM', difficulty: 3, theme: 'storm', reward: 300, par: 210, fireMul: 0.85, missiles: 0.7,
    brief: 'Missile carriers darken the sky. Out-turn their missiles, then bring down the Storm Carrier.',
    objective: { type: 'boss', label: 'Destroy the Storm Carrier' },
    stream: { interval: [3.2, 2.6], maxAlive: [3, 5], events: [
      { type: 'carrier', n: 1, w: 3 }, { type: 'fighter', n: 2, w: 2 }, { type: 'scout', n: 3, form: 'v', w: 1 }] },
    boss: { type: 'stormCarrier', afterKills: 10,
      stream: { interval: [7, 7], maxAlive: [2, 2], events: [{ type: 'scout', n: 1 }, { type: 'fighter', n: 1 }] } } },

  { id: 6, name: 'FORMATION ATTACK', difficulty: 3, theme: 'golden', reward: 350, par: 170, fireMul: 1.05, missiles: 0.8,
    brief: 'Three full squadrons are attacking in tight formation. Destroy them all.',
    objective: { type: 'formations', count: 3, label: 'Destroy 3 formations' },
    waves: [
      { events: [{ type: 'squadron', n: 5, form: 'v' }, { type: 'scout', n: 2 }] },
      { events: [{ type: 'squadron', n: 6, form: 'line' }, { type: 'fighter', n: 2 }] },
      { events: [{ type: 'squadron', n: 7, form: 'v' }, { type: 'interceptor', n: 2 }] }] },

  { id: 7, name: 'ELITE SQUADRON', difficulty: 4, theme: 'sunset', reward: 400, par: 200, fireMul: 0.85, missiles: 0.6,
    brief: 'Armoured jets and elite pilots hold this airspace. Sustained fire and missiles are essential.',
    objective: { type: 'kinds', kinds: ['armored', 'elite'], count: 8, label: 'Destroy 8 armoured or elite jets' },
    stream: { interval: [3.6, 2.8], maxAlive: [2, 4], events: [
      { type: 'armored', n: 1, w: 3 }, { type: 'elite', n: 1, w: 2 }, { type: 'armored', n: 2, w: 1 }, { type: 'fighter', n: 2, w: 1 }] } },

  { id: 8, name: 'STEALTH STRIKE', difficulty: 4, theme: 'night', reward: 450, par: 180, fireMul: 0.95, missiles: 0.7,
    brief: 'Stealth jets fade in and out of the night sky. Strike while they are visible.',
    objective: { type: 'kinds', kinds: ['stealth'], count: 12, label: 'Destroy 12 stealth jets' },
    stream: { interval: [2.8, 2.0], maxAlive: [4, 6], events: [
      { type: 'stealth', n: 1, w: 3 }, { type: 'stealth', n: 2, w: 2 }, { type: 'interceptor', n: 2, w: 1 }, { type: 'elite', n: 1, w: 0.6 }] } },

  { id: 9, name: 'LAST DEFENCE', difficulty: 5, theme: 'dusk', reward: 600, par: 280, fireMul: 0.9, missiles: 0.7,
    brief: 'Everything the enemy has left, in five waves. The elite squadron comes last.',
    objective: { type: 'waves', label: 'Survive 5 attack waves' },
    waves: [
      { events: [{ type: 'scout', n: 5, form: 'v' }, { type: 'fighter', n: 3, form: 'v' }, { type: 'fighter', n: 2 }] },
      { events: [{ type: 'bomber', n: 2 }, { type: 'interceptor', n: 3 }, { type: 'scout', n: 3, form: 'line' }] },
      { events: [{ type: 'carrier', n: 2 }, { type: 'armored', n: 2 }, { type: 'fighter', n: 2 }] },
      { events: [{ type: 'squadron', n: 6, form: 'v' }, { type: 'stealth', n: 3 }] },
      { name: 'ELITE SQUADRON', events: [{ type: 'elite', n: 4, form: 'v' }, { type: 'armored', n: 2 }, { type: 'interceptor', n: 2 }] }] },

  { id: 10, name: 'FINAL SHOWDOWN', difficulty: 5, theme: 'inferno', reward: 1000, par: 320, fireMul: 0.85, missiles: 0.7,
    brief: 'The Dreadnought commands the enemy fleet. Destroy it and end the war.',
    objective: { type: 'boss', label: 'Destroy the Dreadnought' },
    waves: [{ events: [{ type: 'fighter', n: 3, form: 'v' }, { type: 'interceptor', n: 2 }] }],
    boss: { type: 'dreadnought', afterWaves: true }, unlocks: 'zenith', finale: true },

  // ---- Chapter two: the ground war ----
  { id: 11, name: 'MOUNTAIN PASS', difficulty: 4, theme: 'mountain', reward: 700, par: 200, fireMul: 1.25,
    brief: 'Enemy jets are slipping through the high passes. Hunt them down among the peaks.',
    objective: { type: 'kills', count: 28, label: 'Destroy 28 enemies' },
    stream: { interval: [2.4, 1.7], maxAlive: [5, 8], events: [
      { type: 'interceptor', n: 2, w: 3 }, { type: 'fighter', n: 3, form: 'v', w: 2 }, { type: 'stealth', n: 1, w: 1 }, { type: 'scout', n: 4, form: 'line', w: 2 }] } },

  { id: 12, name: 'DESERT HEAT', difficulty: 4, theme: 'desert', reward: 800, par: 220, fireMul: 1.15,
    brief: 'Strike bombers are crossing the dunes under heavy escort. Stop them before they reach the base.',
    objective: { type: 'kinds', kinds: ['bomber', 'armored'], count: 12, label: 'Destroy 12 bombers or armoured jets' },
    stream: { interval: [2.8, 2.0], maxAlive: [5, 7], events: [
      { type: 'bomber', n: 1, w: 3 }, { type: 'armored', n: 1, w: 2 }, { type: 'bomber', n: 2, w: 1 }, { type: 'fighter', n: 2, w: 2 }, { type: 'carrier', n: 1, w: 1 }] } },

  { id: 13, name: 'BATTLEFIELD', difficulty: 5, theme: 'battlefield', reward: 900, par: 999, fireMul: 1.0,
    brief: 'The front line is burning below. Keep the enemy off our ground forces until relief arrives.',
    objective: { type: 'survive', count: 120, label: 'Hold the line for 2:00' },
    stream: { interval: [2.6, 1.7], maxAlive: [4, 7], events: [
      { type: 'fighter', n: 2, w: 3 }, { type: 'scout', n: 4, form: 'v', w: 2 }, { type: 'interceptor', n: 2, w: 2 },
      { type: 'armored', n: 1, w: 1 }, { type: 'carrier', n: 1, w: 1 }, { type: 'elite', n: 1, w: 0.6 }] } },

  { id: 14, name: 'FROZEN PEAKS', difficulty: 5, theme: 'snow', reward: 1000, par: 230, fireMul: 1.2,
    brief: 'Four elite formations are regrouping over the glacier. Break every one of them.',
    objective: { type: 'formations', count: 4, label: 'Destroy 4 formations' },
    waves: [
      { events: [{ type: 'squadron', n: 6, form: 'v' }, { type: 'interceptor', n: 2 }] },
      { events: [{ type: 'fighter', n: 5, form: 'line' }, { type: 'stealth', n: 2 }] },
      { events: [{ type: 'squadron', n: 7, form: 'v' }, { type: 'armored', n: 2 }] },
      { events: [{ type: 'elite', n: 4, form: 'v' }, { type: 'carrier', n: 1 }] }] },

  { id: 15, name: 'IRON STORM', difficulty: 5, theme: 'warzone', reward: 1500, par: 340, fireMul: 0.85, missiles: 0.8,
    brief: 'The Warlord leads the last assault over the burning front. Bring down the flagship.',
    objective: { type: 'boss', label: 'Destroy the Warlord' },
    waves: [{ events: [{ type: 'squadron', n: 5, form: 'v' }, { type: 'armored', n: 2 }] }],
    boss: { type: 'warlord', afterWaves: true }, finale: true },
];
export const LEVEL_COUNT = LEVELS.length;

// Sky palettes: sky gradient, cloud colours (lit / body / shaded), rim light.
// `dark` flips the HUD to light text.
export const THEMES = {
  day:      { top: '#8fcdf0', bottom: '#c9ebfa', cloud: ['#ffffff', '#e2f3fc', '#b5ddf3'], rim: '#fffdf0', dark: false, ground: 'ocean', clouds: 0.7 },
  morning:  { top: '#a5d8ee', bottom: '#fdeed6', cloud: ['#ffffff', '#f6efe6', '#d9cfd6'], rim: '#fff6dc', dark: false, ground: 'city', tint: 'rgba(255,200,150,0.12)', clouds: 0.5 },
  noon:     { top: '#5fb4ec', bottom: '#a9dcf7', cloud: ['#ffffff', '#dcefff', '#a6cdf0'], rim: '#ffffff', dark: false, ground: 'ocean', clouds: 0.6 },
  altitude: { top: '#3f8fd0', bottom: '#8fc6ec', cloud: ['#f4fbff', '#cfe5f7', '#95bde3'], rim: '#ffffff', dark: false },
  storm:    { top: '#6f8797', bottom: '#a8bbc4', cloud: ['#dfe7ea', '#a9b8c0', '#74868f'], rim: '#f2f6f7', dark: false, ground: 'ocean', tint: 'rgba(30,45,60,0.45)', clouds: 0.8 },
  golden:   { top: '#ffb877', bottom: '#ffe9c7', cloud: ['#fffaf0', '#ffe3c4', '#f3ac8e'], rim: '#fff6d8', dark: false, ground: 'desert', tint: 'rgba(255,150,60,0.15)', clouds: 0.5 },
  sunset:   { top: '#f28a6a', bottom: '#fbc79b', cloud: ['#ffe9d6', '#f9b9a0', '#d97f86'], rim: '#fff0d0', dark: false, ground: 'mountain', tint: 'rgba(160,60,40,0.3)', clouds: 0.5 },
  night:    { top: '#18234a', bottom: '#4a5fa0', cloud: ['#c9d6ff', '#7f93cf', '#465a99'], rim: '#e6ecff', dark: true, stars: true, ground: 'city', tint: 'rgba(8,12,45,0.66)', clouds: 0.4 },
  dusk:     { top: '#4b3f85', bottom: '#d07e96', cloud: ['#f3c6d3', '#b683b5', '#6f558f'], rim: '#ffe0e6', dark: true, ground: 'city', tint: 'rgba(60,20,80,0.45)', clouds: 0.5 },
  // terrain missions: `ground` selects a landscape painted below the clouds
  mountain: { top: '#7fb6dd', bottom: '#cfe6f2', cloud: ['#ffffff', '#e6f1f7', '#b9d2e2'], rim: '#ffffff', dark: false, ground: 'mountain', clouds: 0.5 },
  desert:   { top: '#f0c98a', bottom: '#f7e2b8', cloud: ['#fffaf0', '#f6e6cc', '#dcc09a'], rim: '#fff8e6', dark: false, ground: 'desert', clouds: 0.35 },
  battlefield: { top: '#8a9a8c', bottom: '#c2c8b4', cloud: ['#e9ece6', '#b9c0b4', '#868f84'], rim: '#f4f6f0', dark: false, ground: 'battlefield', clouds: 0.45 },
  snow:     { top: '#9cc4e4', bottom: '#e6f1fa', cloud: ['#ffffff', '#eaf3fb', '#c3d9ec'], rim: '#ffffff', dark: false, ground: 'snow', clouds: 0.5 },
  warzone:  { top: '#4a3340', bottom: '#b0604a', cloud: ['#e9b79b', '#a8655c', '#5e3a48'], rim: '#ffd8b8', dark: true, ground: 'battlefield', tint: 'rgba(90,30,20,0.38)', clouds: 0.5 },
  // Team Battle battlegrounds
  ocean:    { top: '#4fa8de', bottom: '#bfe6f7', cloud: ['#ffffff', '#e6f4fc', '#b9dbef'], rim: '#ffffff', dark: false, ground: 'ocean', clouds: 0.6 },
  city:     { top: '#7d93b8', bottom: '#d6dde8', cloud: ['#ffffff', '#e4e8f0', '#b4bdcc'], rim: '#ffffff', dark: false, ground: 'city', clouds: 0.22 },
  lava:     { top: '#24121a', bottom: '#6e2618', cloud: ['#9a7f7a', '#6b524f', '#3e2c2c'], rim: '#ffb48a', dark: true, ground: 'lava', clouds: 0.2 },
  inferno:  { top: '#3a1e33', bottom: '#b24a44', cloud: ['#f0a58c', '#b45a5c', '#6b3350'], rim: '#ffd0b0', dark: true, ground: 'lava', clouds: 0.35 },
};
