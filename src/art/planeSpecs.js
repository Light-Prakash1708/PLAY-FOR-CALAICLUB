// Vector blueprints for every aircraft. Authoring space: nose points up (-y),
// the airframe is roughly 100 units long, +x is the right wing. Each spec lists
// half-outlines (mirrored by the renderer). PlaneArt.js rasterises them once
// into shaded sprites.
//
// fus   : right-hand fuselage outline, nose to tail
// wing / stab / canard / glove : right-hand lifting surfaces
// fins  : 'twin' polygon (mirrored) or [y0, y1] for a single centre fin
// noz   : [x, y, halfWidth] per nozzle        nac : [x0, x1, y0, y1] engine bays
// msl   : [x, y, length] underwing missiles   rail: [x, y, length] wingtip rails
// canopy: [y0, y1, halfWidth, seats]
const FLANKER_FUS = [[0, -50], [1.6, -44], [3, -37], [4.2, -30], [4.8, -24], [6.2, -18], [9, -10], [12, -5], [12.5, 22], [11.5, 40], [10.5, 44], [3.5, 44], [3, 36], [1.6, 38], [1.2, 52], [0, 53]];
const PAL = {
  blue:   { body: '#9fb4c4', wing: '#93a9bb', camo: ['#5f86a6', '#3f6688', '#c9d6df', '#6f93b0'], edge: '#2c3e4e', radome: '#eef1f3', fin: '#6f8ea8', mark: '#F59E1B' },
  grey:   { body: '#c2c9cf', wing: '#b6bec5', camo: ['#9aa5ae', '#d9dee2', '#8894a0'], edge: '#3a444d', radome: '#4d5760', fin: '#9aa5ae', mark: '#F59E1B' },
  silver: { body: '#d4d9dd', wing: '#c6ccd1', camo: ['#b3bac0', '#e6eaed', '#a4acb3'], edge: '#454d55', radome: '#5d7a5a', fin: '#aab2b9', mark: '#F59E1B' },
  green:  { body: '#a9b0a6', wing: '#9da59b', camo: ['#6f7f6b', '#55664f', '#c4c9bf', '#7f8d7a'], edge: '#30382f', radome: '#5b6660', fin: '#7d8a78', mark: '#F59E1B' },
  desert: { body: '#cdbf9c', wing: '#c2b38e', camo: ['#8f8a5c', '#a5794f', '#ded3b4', '#6f7550'], edge: '#4a4230', radome: '#3d3a30', fin: '#a39672', mark: '#F59E1B' },
  navy:   { body: '#8696a8', wing: '#7b8b9d', camo: ['#55677c', '#a3b0be', '#465468'], edge: '#232c37', radome: '#39424d', fin: '#5f7085', mark: '#F59E1B' },
  shark:  { body: '#6f7d8c', wing: '#667382', camo: ['#4b5866', '#8c99a7', '#3d4855', '#5b6876'], edge: '#1c232b', radome: '#2b333c', fin: '#4b5866', mark: '#5CC8FF' },
  // enemy schemes
  olive:  { body: '#69735f', wing: '#5f6a56', camo: ['#454f3d', '#7d8870', '#39422f', '#586350'], edge: '#20261b', radome: '#2f352b', fin: '#454f3d', mark: '#c9c9c0' },
  slate:  { body: '#8a9198', wing: '#7f868d', camo: ['#666d75', '#a5abb1', '#5a6068'], edge: '#262a2f', radome: '#3a3f45', fin: '#666d75', mark: '#d8442f' },
  steel:  { body: '#7c8792', wing: '#727d88', camo: ['#56616c', '#96a0aa', '#48525c'], edge: '#20262c', radome: '#33393f', fin: '#56616c', mark: '#d8442f' },
  storm:  { body: '#5f6873', wing: '#57606b', camo: ['#414952', '#757e89', '#363d45'], edge: '#171b20', radome: '#23282e', fin: '#414952', mark: '#d8442f' },
  sand:   { body: '#9a8f72', wing: '#8f8467', camo: ['#6b6248', '#b3a98c', '#5a5540'], edge: '#2c281c', radome: '#35322a', fin: '#6b6248', mark: '#d8442f' },
  black:  { body: '#3e434b', wing: '#383d45', camo: ['#2a2e35', '#525862', '#22262c'], edge: '#0e1013', radome: '#191c20', fin: '#2a2e35', mark: '#ff4d4d' },
  ace:    { body: '#33363d', wing: '#2d3037', camo: ['#7a1f24', '#1f2227', '#484c55'], edge: '#0c0d10', radome: '#7a1f24', fin: '#7a1f24', mark: '#ffd24a' },
};

const flanker = (pal, o = {}) => ({
  pal, seed: o.seed || 3, fus: FLANKER_FUS,
  wing: o.wing || [[12, -5], [34.5, 19], [35.5, 20], [35.5, 27], [34, 27.5], [12.5, 23]],
  stab: [[11.5, 30], [24, 43], [24, 47.5], [11, 43.5]],
  canard: o.canards ? [[5.5, -16], [15, -9.5], [15, -7.5], [6.5, -7]] : null,
  fins: 'twin', fin: [[9.8, 24], [12.3, 24.5], [14.2, 40], [11, 41]],
  nac: [[3.6, 11.4, 2, 44]], noz: [[7.2, 43.5, 3.6]],
  canopy: [-37, o.seats === 2 ? -13 : -20, 2.9, o.seats || 1],
  msl: [[19, -4, 13], [27, 4.5, 13]], rail: [35.5, 14, 16], panels: [-30, 2, 20],
});

export const PLAYER_ART = {
  // tailed delta with a nose intake cone
  ember: { pal: PAL.silver, seed: 4,
    fus: [[0, -50], [1.2, -46.5], [3.4, -45], [4, -34], [4.5, -20], [4.8, 20], [4, 36], [3.6, 41], [0, 41]],
    wing: [[4.5, -12], [25, 17], [25, 20.5], [4.8, 20]], stab: [[4.4, 27], [14, 37], [14, 40.5], [4, 38]],
    fins: [10, 39], nac: [[-4, 4, -6, 40]], noz: [[0, 40.5, 3.5]], canopy: [-38, -24, 2.4, 1],
    msl: [[12, 2, 11], [18, 10, 10]], panels: [-34, -4, 22], cone: true },
  // big boxy interceptor, huge intakes and nozzles
  streak: { pal: PAL.grey, seed: 7,
    fus: [[0, -52], [1.6, -45], [3, -37], [4, -29], [4.6, -23], [10.5, -21], [12, -17], [12.5, 22], [11.5, 40], [10.8, 45], [2.2, 45], [1.6, 38], [0, 40]],
    wing: [[12, -11], [33, 13], [33, 21.5], [12.5, 18]], stab: [[11.5, 28], [25, 40], [25, 45], [11, 42.5]],
    fins: 'twin', fin: [[9.5, 20], [12.4, 20.5], [14.6, 39], [11, 40]],
    nac: [[2.4, 11.4, -18, 45]], noz: [[6.6, 44.5, 4.3]], canopy: [-39, -25, 2.6, 1],
    msl: [[18, -6, 15], [26, 2, 15]], panels: [-29, 0, 22] },
  // small shoulder wing, twin engines tucked under the tail
  bruiser: { pal: PAL.desert, seed: 9,
    fus: [[0, -50], [1.5, -43], [3, -34], [4, -26], [6.2, -22], [6.6, 18], [6, 33], [5.2, 40], [0.6, 40], [0, 38]],
    wing: [[6.3, -9], [25, 9], [25, 14.5], [6.6, 8]], stab: [[5.8, 26], [16, 36], [16, 40], [5.2, 37.5]],
    fins: [8, 37], nac: [[-5.6, 5.6, 4, 40]], noz: [[2.9, 39.5, 2.5]], canopy: [-37, -21, 2.6, 1],
    msl: [[13, -6, 11], [19, 0, 11]], panels: [-26, -2, 20] },
  // tailless compound delta
  wisp: { pal: PAL.grey, seed: 5,
    fus: [[0, -46], [1.4, -40], [2.6, -33], [3.5, -25], [4, -17], [5.4, -13], [5.8, 0], [5.8, 30], [4.4, 37], [0, 37]],
    wing: [[5, -15], [8, -9], [11, 2], [28, 25], [28, 29.5], [5.8, 30]],
    fins: [8, 35], nac: [[-5.2, 5.2, -4, 36]], noz: [[0, 36.5, 3.8]], canopy: [-34, -20, 2.6, 1],
    msl: [[14, 5, 11], [21, 14.5, 11]], rail: [28.3, 19, 15], panels: [-17, 6, 22], lead: 4 },
  // swing wing (drawn swept), side intakes, single engine
  hailstorm: { pal: PAL.green, seed: 12,
    fus: [[0, -50], [1.5, -43], [2.8, -35], [3.8, -27], [4.2, -21], [7, -18], [7.4, -6], [7.2, 22], [5.6, 35], [4.6, 41], [0, 41]],
    glove: [[7, -15], [12.5, -7], [12.5, 2], [7.3, 3]],
    wing: [[11, -6], [30, 21], [27.5, 26], [8.5, 5]], stab: [[6.2, 27], [18, 38], [18, 42], [5.2, 39]],
    fins: [8, 39], nac: [[-5.6, 5.6, -4, 40]], noz: [[0, 40.5, 3.9]], canopy: [-37, -22, 2.6, 1],
    msl: [[10, -9, 11]], panels: [-27, -2, 20] },
  // pure delta, no tail
  manta: { pal: PAL.navy, seed: 14,
    fus: [[0, -50], [1.5, -43], [2.8, -35], [3.8, -27], [4.2, -19], [6, -15], [6.2, 0], [6.2, 29], [4.6, 37], [0, 37]],
    wing: [[5.8, -9], [29, 25.5], [29, 30], [6.2, 30]],
    fins: [6, 35], nac: [[-5.4, 5.4, -4, 36]], noz: [[0, 36.5, 3.8]], canopy: [-37, -22, 2.6, 1],
    msl: [[13, 4, 11], [20, 13, 11]], panels: [-19, 6, 22] },
  // twin engines, twin fins, LERX
  warden: Object.assign(flanker(PAL.green, { seed: 6, wing: [[12, -5], [31.5, 16], [32.5, 17], [32.5, 24], [31, 24.5], [12.5, 21]] }), { rail: [32.5, 11, 16], msl: [[18, -5, 13], [25, 3, 13]] }),
  // canards, two seats
  bastion: flanker(PAL.blue, { canards: true, seats: 2, seed: 3 }),
  // delta with close-coupled canards, twin nozzles
  ravager: { pal: PAL.grey, seed: 16,
    fus: [[0, -50], [1.5, -43], [2.8, -35], [3.8, -27], [4.4, -19], [7, -15], [7.2, 0], [7, 28], [5.6, 36], [0.8, 36], [0, 34]],
    wing: [[6.8, -7], [29, 22], [29, 27.5], [7, 28]], canard: [[4.4, -22], [14, -15.5], [14, -13.5], [5, -13]],
    fins: [6, 34], nac: [[-6, 6, 2, 36]], noz: [[3, 35.5, 2.8]], canopy: [-38, -23, 2.6, 1],
    msl: [[13, 2, 11], [20, 10, 11]], rail: [29.3, 17, 15], panels: [-19, 6, 22] },
  // blended stealth planform, twin canted fins
  zenith: { pal: PAL.shark, seed: 18,
    fus: [[0, -52], [2, -44], [4, -36], [7, -27], [14, -13], [14, 22], [12, 42], [4.2, 42], [3.2, 35], [1.4, 37], [1, 50], [0, 51]],
    wing: [[14, -13], [36, 15], [36, 21], [30, 26], [14, 24]], stab: [[12, 30], [25, 40], [22.5, 46], [11, 43]],
    fins: 'twin', fin: [[10, 23], [12.6, 23.5], [16, 38], [12.4, 39.5]],
    nac: [[4, 12, 0, 42]], noz: [[7.6, 41.5, 3.6]], canopy: [-39, -23, 2.8, 1],
    msl: [], panels: [-27, 2, 20] },
};

const LIGHT = (pal, seed) => ({ pal, seed,
  fus: [[0, -46], [1.4, -40], [2.6, -33], [3.4, -26], [3.8, -20], [6.2, -17], [6.6, -8], [7, -2], [7, 22], [5.5, 34], [4.4, 40], [0, 40]],
  wing: [[6.4, -13], [8.5, -6], [26, 13], [26, 20.5], [7, 18]], stab: [[6, 27], [17, 37], [17, 41], [5, 38.5]],
  fins: [8, 38], nac: [[-5.5, 5.5, -4, 39.5]], noz: [[0, 39.5, 3.8]], canopy: [-33, -19, 2.6, 1],
  msl: [[15, 2, 11], [21, 8, 11]], rail: [26.4, 7, 15], panels: [-20, 4, 20], lead: 2 });
const CANARD = (pal, seed) => ({ pal, seed,
  fus: [[0, -48], [1.4, -42], [2.6, -35], [3.5, -27], [4, -18], [5.6, -12], [6, 0], [6, 30], [4.6, 38], [0, 38]],
  wing: [[6, -4], [28, 24], [28, 29.5], [6, 29]], canard: [[4, -20], [14, -13.5], [14, -11.5], [4.6, -11]],
  fins: [8, 36], nac: [[-5.4, 5.4, -4, 37.5]], noz: [[0, 37.5, 3.8]], canopy: [-36, -22, 2.6, 1],
  msl: [[13, 2, 11], [19, 9.5, 11]], panels: [-18, 6, 22] });

export const ENEMY_ART = {
  scout: LIGHT(PAL.olive, 5),
  squadron: LIGHT(PAL.navy, 9),
  fighter: CANARD(PAL.slate, 8),
  elite: CANARD(PAL.ace, 11),
  // twin-engine strike bomber
  bomber: { pal: PAL.steel, seed: 13, extent: 1.3,
    fus: [[0, -52], [1.6, -45], [3.2, -36], [4.4, -28], [7, -24], [7.6, 20], [7, 36], [6, 44], [0.6, 44], [0, 42]],
    wing: [[7.2, -10], [31, 12], [31, 18.5], [7.6, 10]], stab: [[6.8, 29], [19, 40], [19, 44.5], [6, 42]],
    fins: [8, 41], nac: [[-6.6, 6.6, 0, 44]], noz: [[3.3, 43.5, 2.9]], canopy: [-39, -20, 2.8, 2],
    msl: [[14, -8, 14], [21, -2, 14], [27, 4, 12]], panels: [-28, 0, 22] },
  // high-speed delta interceptor
  interceptor: { pal: PAL.sand, seed: 15,
    fus: [[0, -52], [1.3, -46], [2.6, -38], [3.4, -28], [5.6, -24], [5.8, 22], [5.2, 38], [4.6, 43], [0.6, 43], [0, 41]],
    wing: [[5.6, -8], [24, 20], [24, 23.5], [5.8, 23]], stab: [[5.4, 30], [14, 39], [14, 42.5], [5, 40.5]],
    fins: [10, 41], nac: [[-5, 5, 4, 43]], noz: [[2.6, 42.5, 2.4]], canopy: [-40, -27, 2.3, 1],
    msl: [[11, 2, 11]], panels: [-28, 0, 24] },
  carrier: Object.assign(flanker(PAL.steel, { seats: 2, seed: 17 }), { msl: [[15, -8, 13], [19, -4, 13], [23, 0, 13], [27, 4.5, 13]] }),   // missile carrier
  armored: flanker(PAL.storm, { seed: 19 }),                                                                                            // armoured heavy fighter
  // stealth canard delta
  stealth: { pal: PAL.black, seed: 21,
    fus: [[0, -54], [2, -46], [4, -38], [6.4, -30], [12, -14], [12.5, 24], [11, 42], [4, 42], [3, 36], [0, 38]],
    wing: [[12, -6], [33, 22], [33, 27], [12.5, 28]], canard: [[6.6, -28], [18, -19], [18, -16], [9, -17]],
    fins: 'twin', fin: [[9.5, 26], [12, 26.5], [16.5, 40], [12.6, 41.5]],
    nac: [[3.6, 11.4, 4, 42]], noz: [[7, 41.5, 3.4]], canopy: [-41, -26, 2.7, 1],
    msl: [], panels: [-30, 0, 22] },
  // heavy bomber (first boss)
  stormCarrier: { pal: PAL.steel, seed: 23, extent: 1.3,
    fus: [[0, -52], [2.2, -46], [3.6, -38], [4, -20], [4, 30], [2.6, 46], [0.8, 54], [0, 54]],
    glove: [[4, -16], [9.5, -15], [9.5, 12], [4, 12]],
    wing: [[9, -14], [44, 14], [44, 21], [28, 16], [9, 10]], stab: [[3.4, 36], [17, 47], [17, 51.5], [2.6, 48]],
    fins: [28, 50], nac: [[4.4, 9.4, -15, 13]], noz: [[6.9, 12, 2.4]], canopy: [-45, -37, 2.6, 1],
    msl: [[17, -4, 14], [24, 2, 14], [31, 8, 14], [38, 13, 12]], panels: [-36, -10, 10, 28],
    turrets: [[0.25, 0.5], [0.25, -0.5], [-0.6, 0]] },
};
// final boss: an oversized black-and-red stealth jet
// chapter-two boss: a heavy twin-tail flagship
ENEMY_ART.warlord = Object.assign(flanker(PAL.ace, { canards: true, seats: 2, seed: 27 }), { turrets: [[0.2, 0.45], [0.2, -0.45], [-0.5, 0.3], [-0.5, -0.3], [0.6, 0]] });
ENEMY_ART.dreadnought = Object.assign({}, ENEMY_ART.stealth, { pal: PAL.ace, seed: 25, msl: [[18, 6, 13], [24, 13, 13]],
  turrets: [[0.3, 0.3], [0.3, -0.3], [-0.3, 0.5], [-0.3, -0.5], [0.7, 0]] });

// derived fields used by the game: exhaust points (sprite space: nose along +x, unit = 50 authoring units), debris colours
for (const set of [PLAYER_ART, ENEMY_ART]) {
  for (const id in set) {
    const s = set[id];
    s.exhaust = [];
    for (const [x, y] of s.noz) {
      s.exhaust.push([-(y + 5) / 50, x / 50]);
      if (x !== 0) s.exhaust.push([-(y + 5) / 50, -x / 50]);
    }
    s.colors = { body: s.pal.body, wing: s.pal.wing, accent: s.pal.camo[0], canopy: '#1f3346' };
    s.extent = s.extent || 1.22;
  }
}
