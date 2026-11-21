// Online play with a friend: no accounts, no game server.
// Two browsers connect directly over WebRTC. PeerJS's free public broker only
// introduces them, using a 6-letter room code. After that the match data flows
// straight between the two devices.
//
// For testing on a LAN, ?peer=host:port points at a self-hosted PeerServer.

const PREFIX = 'skystrike-v7-';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';          // no 0/O, 1/I/L mix-ups
export const CODE_LEN = 6;

export function makeCode() {
  const a = new Uint32Array(CODE_LEN);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a, (n) => ALPHA[n % ALPHA.length]).join('');
}
export function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN); }
export function roomLink(code) { return `${location.href.split('#')[0]}#room=${code}`; }
/** Room code from the URL (#room=ABC123), cleared so a refresh doesn't rejoin. */
export function readRoomLink() {
  const m = /[#&]room=([A-Za-z0-9]{4,8})/.exec(location.hash || '');
  if (!m) return null;
  try { history.replaceState(null, '', location.href.split('#')[0]); } catch (_) {}
  return cleanCode(m[1]);
}

let libP = null;
const loadLib = () => (libP = libP || import('../vendor/peerjs.mjs').then((m) => m.Peer || m.default));

export class Net {
  constructor() {
    this.peer = null; this.conn = null;
    this.role = null;            // 'host' | 'guest'
    this.code = '';
    this.status = 'idle';        // idle | opening | waiting | joining | connected | error
    this.error = '';
    this.handlers = {};
    this.friend = null;          // { name } once the hello arrives
    this.rtt = 0;
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  _emit(ev, ...a) { const h = this.handlers[ev]; if (h) h(...a); }
  get connected() { return !!(this.conn && this.conn.open); }
  get isHost() { return this.role === 'host'; }
  get isGuest() { return this.role === 'guest'; }
  get active() { return this.role !== null; }

  _opts() {
    const o = {
      debug: 0,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] },
    };
    const m = /[?&]peer=([\w.-]+):(\d+)/.exec(location.search);
    if (m) Object.assign(o, { host: m[1], port: +m[2], path: '/', secure: false, config: { iceServers: [] } });
    return o;
  }
  _set(status, error = '') { this.status = status; this.error = error; this._emit('status', status, error); }

  /** Opens a room and waits for one friend. Retries with a new code if the code is taken. */
  async host(tries = 3) {
    this.close(true);
    this.role = 'host'; this._set('opening');
    let Peer;
    try { Peer = await loadLib(); } catch (e) { this._fail('Could not load the online module'); return; }
    const code = makeCode();
    const peer = this.peer = new Peer(PREFIX + code, this._opts());
    peer.on('open', () => { if (this.peer !== peer) return; this.code = code; this._set('waiting'); this._emit('room', code); });
    peer.on('connection', (c) => {
      if (this.connected) {           // room is full: tell the third player politely
        c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 400); });
        return;
      }
      this._attach(c);
    });
    peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) { try { peer.reconnect(); } catch (_) {} } });
    peer.on('error', (e) => {
      if (this.peer !== peer) return;
      if (e.type === 'unavailable-id' && tries > 1) { this.host(tries - 1); return; }
      if (this.connected && e.type !== 'network' && e.type !== 'server-error' && e.type !== 'socket-error') return;
      if (this.connected) return;      // broker hiccup after we're already linked: the match carries on
      this._fail(this._why(e));
    });
  }

  /** Joins a friend's room by code. */
  async join(code) {
    code = cleanCode(code);
    this.close(true);
    if (code.length !== CODE_LEN) { this.role = 'guest'; this._fail(`Room codes have ${CODE_LEN} letters`); return; }
    this.role = 'guest'; this.code = code; this._set('joining');
    let Peer;
    try { Peer = await loadLib(); } catch (e) { this._fail('Could not load the online module'); return; }
    const peer = this.peer = new Peer(undefined, this._opts());
    const timer = setTimeout(() => { if (this.peer === peer && !this.connected) this._fail('No answer from that room. Check the code, and that your friend still has the room open.'); }, 20000);
    peer.on('open', () => {
      if (this.peer !== peer) return;
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      this._attach(c, timer);
    });
    peer.on('error', (e) => { if (this.peer !== peer || this.connected) return; clearTimeout(timer); this._fail(this._why(e)); });
  }

  _attach(c, timer) {
    this.conn = c;
    c.on('open', () => {
      if (this.conn !== c) return;
      if (timer) clearTimeout(timer);
      this._set('connected');
      this.lastRx = performance.now();
      this._pingT = setInterval(() => { if (performance.now() - this.lastRx > 7000) { gone(); try { c.close(); } catch (_) {} return; } this.send({ t: 'ping', at: performance.now() }); }, 1000);
      this._emit('connected');
    });
    c.on('data', (d) => {
      if (this.conn !== c || !d || typeof d !== 'object') return;
      this.lastRx = performance.now();
      if (d.t === 'bye') { gone(); return; }
      if (d.t === 'ping') { this.send({ t: 'pong', at: d.at }); return; }
      if (d.t === 'pong') { this.rtt = performance.now() - d.at; return; }
      if (d.t === 'full') { this._fail('That room already has two pilots.'); return; }
      this._emit('data', d);
    });
    const gone = () => {
      if (this.conn !== c) return;
      const was = this.status === 'connected';
      this.conn = null; clearInterval(this._pingT);
      this.friend = null;
      if (was) { this._emit('closed'); this._set(this.role === 'host' ? 'waiting' : 'error', this.role === 'host' ? '' : 'Lost the connection to the host.'); }
    };
    c.on('close', gone);
    c.on('error', gone);
    if (c.peerConnection) c.peerConnection.addEventListener('iceconnectionstatechange', () => { const s = c.peerConnection.iceConnectionState; if (s === 'failed' || s === 'closed') gone(); });
  }

  _why(e) {
    switch (e && e.type) {
      case 'peer-unavailable': return 'No room with that code. Ask your friend for the code shown on their screen.';
      case 'network': case 'socket-error': case 'socket-closed': case 'server-error': return 'Could not reach the matchmaking service. Check the internet connection and try again.';
      case 'browser-incompatible': return 'This browser cannot play online. Try Chrome, Edge, Safari or Firefox.';
      case 'webrtc': return 'The two devices could not link up (strict network). Try another Wi-Fi or mobile data.';
      default: return 'Something went wrong while connecting. Try again.';
    }
  }
  _fail(msg) { this._set('error', msg); try { this.peer && this.peer.destroy(); } catch (_) {} this.peer = null; }

  send(o) { if (this.connected) { try { this.conn.send(o); } catch (_) {} } }

  /** Leaves the room. `quiet` skips the status event (used when restarting). */
  close(quiet = false) {
    clearInterval(this._pingT);
    if (this.conn) { try { this.conn.send({ t: 'bye' }); } catch (_) {} try { this.conn.close(); } catch (_) {} }
    this.conn = null;
    if (this.peer) { try { this.peer.destroy(); } catch (_) {} }
    this.peer = null; this.friend = null; this.code = '';
    if (!quiet) { this.role = null; this._set('idle'); }
  }
}
