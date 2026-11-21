// Remappable keyboard controls, shared by the campaign and Team Battle.
// Each action has up to two keys. Stored in save.settings.keys.

export const ACTIONS = [
  { id: 'up', label: 'Steer up' },
  { id: 'down', label: 'Steer down' },
  { id: 'left', label: 'Steer left' },
  { id: 'right', label: 'Steer right' },
  { id: 'fire', label: 'Fire cannon' },
  { id: 'missile', label: 'Launch missile' },
  { id: 'shield', label: 'Energy shield' },
  { id: 'boost', label: 'Boost' },
  { id: 'flare', label: 'Flares' },
  { id: 'special', label: 'Special attack (campaign)' },
  { id: 'view', label: 'Cockpit / top-down view' },
];

export const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  fire: ['Space', 'KeyJ'], missile: ['KeyK', 'KeyE'], shield: ['KeyR', 'KeyH'], boost: ['ShiftLeft', 'ShiftRight'],
  flare: ['KeyF', 'KeyQ'], special: ['KeyL', ''], view: ['KeyV', 'KeyC'],
};

export const FIRE_MODES = {
  auto: { name: 'AUTO', desc: 'Guns fire by themselves when an enemy is lined up. Hold fire to shoot anywhere.' },
  hold: { name: 'HOLD', desc: 'Guns fire only while you hold the fire key or button.' },
  toggle: { name: 'TOGGLE', desc: 'Tap fire once to start shooting, tap again to stop.' },
};

const RESERVED = new Set(['Escape', 'KeyP', 'Tab', 'MetaLeft', 'MetaRight', 'F5', 'F11', 'F12']);
export const isReserved = (code) => RESERVED.has(code);

/** Copy of the defaults (so edits never touch the constant). */
export const defaultKeys = () => Object.fromEntries(Object.entries(DEFAULT_KEYS).map(([k, v]) => [k, [...v]]));

/** Untrusted saved bindings -> a clean, complete set. */
export function validateKeys(raw) {
  const out = defaultKeys();
  if (!raw || typeof raw !== 'object') return out;
  const ok = (c) => typeof c === 'string' && c.length < 24 && /^[A-Za-z0-9]*$/.test(c) && !RESERVED.has(c);
  for (const a of ACTIONS) {
    const v = raw[a.id];
    if (Array.isArray(v)) out[a.id] = [ok(v[0]) ? v[0] : '', ok(v[1]) ? v[1] : ''];
  }
  return out;
}

/** Assigns `code` to action slot, removing it from wherever else it was bound. */
export function bindKey(keys, action, slot, code) {
  for (const a in keys) for (let i = 0; i < 2; i++) if (keys[a][i] === code) keys[a][i] = '';
  keys[action][slot] = code;
}

/** code -> action lookup. */
export function keyMap(keys) {
  const m = {};
  for (const a in keys) for (const c of keys[a]) if (c) m[c] = a;
  return m;
}

const NAMES = { Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'ENTER', Backspace: 'BKSP', CapsLock: 'CAPS', Slash: '/', Period: '.', Comma: ',',
  Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`' };
export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}
/** Short label for the first key of an action, e.g. "R". */
export const primaryName = (keys, action) => keyName(keys[action][0] || keys[action][1]);
