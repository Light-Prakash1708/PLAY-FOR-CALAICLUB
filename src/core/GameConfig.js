// Global tuning constants. Gameplay values that vary per aircraft / enemy /
// level live in src/data instead.
export const CONFIG = {
  VIEW_W: 540,              // logical width of the play view (height follows aspect)
  MIN_ASPECT: 9 / 21,       // tallest supported portrait
  MAX_ASPECT: 9 / 14.5,     // widest supported portrait
  ARENA_RADIUS: 1700,       // soft combat-zone boundary (world units)
  MAX_DT: 0.05,             // clamp for frame spikes / tab switches
  PLAYER_HIT_RADIUS: 11,    // deliberately smaller than the sprite: fair hits
  INVULN_TIME: 1.2,
  BULLET_SPEED: 740,
  BULLET_LIFE: 0.6,
  AIM_ASSIST_CONE: 0.2,     // radians
  PICKUP_MAGNET: 100,
  PICKUP_RADIUS: 30,
  SPECIAL_COOLDOWN: 10,
  SPECIAL_START: 2,
  SPECIAL_MAX: 3,
  MISSILE_COOLDOWN: 1.1,
  BOOST_TIME: 1.6,         // afterburner burst: faster and much tighter turning
  BOOST_COOLDOWN: 5,
  BOOST_SPEED: 1.55,
  BOOST_TURN: 1.45,
  FLARE_COOLDOWN: 3,
  FLARE_START: 4,
  FLARE_MAX: 5,
  FLARE_RANGE: 460,        // enemy missiles this close are decoyed
  THREAT_RANGE: 540,       // missile warning distance
  SHIELD_TIME: 7,
  RAPID_TIME: 7,
  SPREAD_TIME: 7,
  REPLAY_REWARD: 0.35,      // share of the level reward paid on repeat clears
  FAIL_COIN_KEEP: 0.5,      // share of mission coins kept on defeat
  QUALITY: {
    low:    { dpr: 1,   particles: 0.4, clouds: 0.55, trails: 0.5 },
    medium: { dpr: 1.5, particles: 0.7, clouds: 0.8,  trails: 0.75 },
    high:   { dpr: 2,   particles: 1,   clouds: 1,    trails: 1 },
  },
};

// Developer build: everything unlocked, separate save slot. Set by tools/build.mjs
// (dist/sky-strike-dev.html) or by adding ?dev=1 to the URL when running from source.
export const DEV = typeof window !== 'undefined' && (window.SKY_DEV === true || /[?&]dev=1\b/.test(window.location.search));

export const COLORS = {
  red: '#E23B3F', orange: '#F59E1B', ink: '#4A2E22', white: '#FFFFFF',
  enemyShot: '#FF6A3D', playerShot: '#FFF6C9',
};
