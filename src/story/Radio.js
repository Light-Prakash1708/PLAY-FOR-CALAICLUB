// Radio chatter: a comms panel (portrait, name, typed subtitle) plus a voice.
// Recorded voice files (ElevenLabs) are used when present in VOICE_FILES;
// otherwise the browser's built-in speech voices read the line, with a radio
// click before and after. Subtitles always show.
import { CAST, LINES } from './script.js';
import { VOICE_FILES } from './voices.js';
import { pilotSVG } from './PilotFigure.js';

const PRIO = { low: 0, normal: 1, high: 2 };

export class Radio {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'radio';
    this.el.innerHTML = '<div class="rd-fig"></div><div class="rd-bubble"><div class="rd-name"><b></b><em></em></div><div class="rd-text"></div></div>';
    root.appendChild(this.el);
    this.fig = this.el.querySelector('.rd-fig'); this.figWho = null; this.saluted = new Set();
    this.nameEl = this.el.querySelector('.rd-name b'); this.roleEl = this.el.querySelector('.rd-name em'); this.textEl = this.el.querySelector('.rd-text');
    this.cur = null; this.queue = []; this.gap = 0; this.recent = {};
    this.voices = [];
    if (window.speechSynthesis) {
      const load = () => { this.voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); };
      load();
      try { window.speechSynthesis.addEventListener('voiceschanged', load); } catch (_) {}
    }
  }
  get enabled() { return this.game.save.data.settings.voices !== false; }

  /** Queue a line. prio: 'low' chatter is dropped if the radio is busy. */
  say(id, prio = 'normal') {
    const def = LINES[id];
    if (!def) return;
    const now = performance.now() / 1000;
    if (prio === 'low' && (this.cur || this.gap > 0 || now - (this.lastAt || 0) < 7 || (this.recent[id] && now - this.recent[id] < 15))) return;
    this.lastAt = now;
    this.recent[id] = now;
    const idx = Array.isArray(def) ? Math.floor(Math.random() * def.length) : -1;
    const line = idx >= 0 ? def[idx] : def;
    const item = { id, key: idx >= 0 ? `${id}#${idx}` : id, who: line.who, text: line.text.replace(/\{name\}/g, this._name()), p: PRIO[prio] };
    if (this.cur && item.p > this.cur.p) { this._stopVoice(); this.cur = null; this.queue.unshift(item); }
    else { this.queue.push(item); this.queue.sort((a, b) => b.p - a.p); if (this.queue.length > 3) this.queue.length = 3; }
  }
  _name() { return (this.game.save.data.battle && this.game.save.data.battle.name) || 'Ember'; }

  clear() { this.queue.length = 0; this._stopVoice(); this.cur = null; this.el.classList.remove('on'); }

  update(dt) {
    if (this.gap > 0) this.gap -= dt;
    if (this.cur) {
      const c = this.cur;
      c.t += dt;
      // typewriter subtitle
      const n = Math.min(c.text.length, Math.floor(c.t * 38));
      if (n !== c.shown) { c.shown = n; this.textEl.textContent = c.text.slice(0, n); }
      this.el.classList.toggle('talk', n < c.text.length || !!c.speaking);
      if (c.t >= c.dur && (!c.speaking || c.t > c.dur + 4)) {
        this.el.classList.remove('on');
        this.game.audio.sfx('radioOff');
        this.cur = null; this.gap = 2;
      }
      return;
    }
    if (this.gap <= 0 && this.queue.length) this._play(this.queue.shift());
  }

  _play(item) {
    const who = CAST[item.who];
    this.cur = item; item.t = 0; item.shown = -1;
    item.dur = Math.max(2.4, item.text.length * 0.062 + 1);
    this.el.style.setProperty('--c', who.color);
    if (this.figWho !== item.who) { this.fig.innerHTML = pilotSVG(item.who); this.figWho = item.who; }
    // a salute the first time each pilot comes on the radio (and for every mission-start call)
    const salute = !this.saluted.has(item.who) || (item.p >= 2 && item.who !== 'vex');
    this.saluted.add(item.who);
    this.fig.classList.remove('salute'); void this.fig.offsetWidth;
    if (salute) this.fig.classList.add('salute');
    this.nameEl.textContent = who.name; this.roleEl.textContent = who.role;
    this.el.classList.toggle('enemy', item.who === 'vex');
    this.textEl.textContent = '';
    this.el.classList.remove('on'); void this.el.offsetWidth; this.el.classList.add('on');
    this.game.audio.sfx('radioOn');
    if (!this.enabled) return;
    const file = VOICE_FILES[item.key] || VOICE_FILES[item.id];
    if (file) {
      try {
        const a = this.audioEl = new Audio(file);
        a.volume = Math.min(1, (this.game.save.data.settings.sfx || 0.8) * 1.1);
        item.speaking = true;
        a.onended = () => { item.speaking = false; };
        a.onloadedmetadata = () => { if (isFinite(a.duration)) item.dur = Math.max(item.dur * 0.6, a.duration + 0.4); };
        a.play().catch(() => { item.speaking = false; });
        return;
      } catch (_) { /* fall through to speech */ }
    }
    this._speak(item, who.voice);
  }
  _speak(item, v) {
    const ss = window.speechSynthesis;
    if (!ss || !window.SpeechSynthesisUtterance) return;
    try {
      ss.cancel();
      const u = new SpeechSynthesisUtterance(item.text);
      const pool = this.voices;
      const female = pool.find((x) => /female|samantha|victoria|zira|karen|moira|tessa|fiona|serena|google uk english female/i.test(x.name));
      const male = pool.find((x) => /male|daniel|alex|fred|david|google uk english male|arthur|rishi/i.test(x.name) && !/female/i.test(x.name));
      u.voice = (v.gender === 'female' ? female : male) || pool[0] || null;
      u.pitch = v.pitch; u.rate = v.rate;
      u.volume = Math.min(1, (this.game.save.data.settings.sfx || 0.8) * 1.1);
      item.speaking = true;
      u.onend = u.onerror = () => { item.speaking = false; };
      ss.speak(u);
    } catch (_) { item.speaking = false; }
  }
  _stopVoice() {
    try { if (this.audioEl) { this.audioEl.pause(); this.audioEl = null; } } catch (_) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
  }
  /** Pause menu: freeze speech. */
  setPaused(p) {
    try { if (window.speechSynthesis) p ? window.speechSynthesis.pause() : window.speechSynthesis.resume(); } catch (_) {}
    try { if (this.audioEl) p ? this.audioEl.pause() : this.audioEl.play().catch(() => {}); } catch (_) {}
  }
}
