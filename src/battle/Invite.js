// Invite / challenge links. Everything lives in the URL hash, so no server is
// needed: the friend's copy of the game reads it and opens the same battle setup.
// Data: { n: pilot name, m: map id, d: difficulty, k: kills to beat (-1 = plain invite), w: won }

const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function makeInvite(data) {
  const clean = { v: 1, n: String(data.n || 'A PILOT').slice(0, 12), m: data.m, d: data.d, k: data.k | 0, w: data.w ? 1 : 0, z: data.z | 0 };
  const base = location.href.split('#')[0];
  const url = `${base}#join=${b64(JSON.stringify(clean))}`;
  const text = clean.k >= 0
    ? `${clean.n} shot down ${clean.k} in Sky Strike. Think you can beat that?`
    : `${clean.n} invited you to a Sky Strike team battle.`;
  return { url, text, local: location.protocol === 'file:' };
}

/** Reads an invite from the current URL (and clears it so a refresh doesn't repeat it). */
export function readInvite() {
  const m = /[#&]join=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return null;
  try {
    const o = JSON.parse(unb64(m[1]));
    if (!o || typeof o !== 'object') return null;
    const inv = { n: String(o.n || 'A PILOT').replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 12) || 'A PILOT', m: String(o.m || ''), d: String(o.d || ''), k: Number.isFinite(o.k) ? Math.max(-1, Math.min(999, o.k | 0)) : -1, w: o.w ? 1 : 0, z: [2, 3, 4].includes(o.z) ? o.z : 0 };
    try { history.replaceState(null, '', location.href.split('#')[0]); } catch (_) {}
    return inv;
  } catch (_) { return null; }
}
