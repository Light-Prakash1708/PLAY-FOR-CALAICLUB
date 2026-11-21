// Small shared math helpers.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

/** Shortest signed angle from a to b, in [-PI, PI]. */
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}
export function turnToward(a, target, maxStep) {
  return a + clamp(angDiff(a, target), -maxStep, maxStep);
}
export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
/** table: array of objects with a numeric `w` weight (default 1). */
export function weightedPick(table) {
  let total = 0;
  for (const it of table) total += it.w || 1;
  let r = Math.random() * total;
  for (const it of table) { r -= it.w || 1; if (r <= 0) return it; }
  return table[table.length - 1];
}
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
