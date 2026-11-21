// Five upgrade tracks, five levels each. `apply` mutates a copy of base stats.
export const MAX_UPGRADE = 5;
export const UPGRADES = [
  { id: 'engine', name: 'ENGINE', stat: 'speed', desc: 'Top speed and agility',
    apply: (s, l) => { s.speed *= 1 + 0.05 * l; s.turn *= 1 + 0.03 * l; } },
  { id: 'weapon', name: 'WEAPON', stat: 'damage', desc: 'Cannon damage',
    apply: (s, l) => { s.damage *= 1 + 0.08 * l; } },
  { id: 'fireRate', name: 'FIRE RATE', stat: 'fireRate', desc: 'Shots per second',
    apply: (s, l) => { s.fireRate *= 1 + 0.06 * l; } },
  { id: 'armour', name: 'ARMOUR', stat: 'hp', desc: 'Maximum health',
    apply: (s, l) => { s.hp *= 1 + 0.12 * l; } },
  { id: 'missile', name: 'MISSILE', stat: 'missileDmg', desc: 'Missile damage and capacity',
    apply: (s, l) => { s.missileDmg *= 1 + 0.15 * l; s.missiles += Math.floor(l / 2); } },
];
const BASE_COST = [60, 110, 180, 270, 380];
/** Cost of buying level `next` (1-based) for an aircraft of the given tier (0-9). */
export function upgradeCost(tier, next) {
  return Math.round(BASE_COST[next - 1] * (1 + tier * 0.22) / 10) * 10;
}
