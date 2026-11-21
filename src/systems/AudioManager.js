// All audio is synthesised with the Web Audio API - no external samples, so
// there is nothing to license or download. The context is created on the
// first user gesture to respect browser autoplay rules.
import { clamp } from '../core/utils.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---- music data ----------------------------------------------------------
// Each track loops 4 bars of 16 steps. Patterns index chord tones (-1 = rest).
const _ = -1;
const TRACKS = {
  menu: {
    bpm: 92, vol: 0.9,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],
    bass: [0, _, _, _, _, _, 0, _, _, _, _, _, 0, _, _, _],
    arp: [0, _, 1, _, 2, _, 3, _, 2, _, 1, _, 2, _, 3, _], arpWave: 'triangle', arpVol: 0.1,
    hat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    pad: true,
    lead: [[12, _, _, _, _, _, 7, _, _, _, _, _, 4, _, _, _], [7, _, _, _, _, _, _, _, 4, _, 7, _, _, _, _, _],
      [11, _, _, _, _, _, 7, _, _, _, _, _, 4, _, _, _], [7, _, _, _, 5, _, _, _, 2, _, _, _, _, _, _, _]],
    leadVol: 0.07,
  },
  game: {
    bpm: 132, vol: 0.85,
    chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]],
    bass: [0, _, 0, _, 0, _, 0, 0, _, 0, 0, _, 0, _, 0, _],
    arp: [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 1, 2], arpWave: 'square', arpVol: 0.035,
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    lead: [[12, _, _, 12, _, _, 7, _, 12, _, _, 15, _, 14, 12, _], [12, _, _, 7, _, _, 4, _, 7, _, _, _, _, _, _, _],
      [12, _, _, 12, _, _, 7, _, 12, _, _, 16, _, 14, 12, _], [14, _, _, 12, _, _, 7, _, 9, _, 7, _, 4, _, _, _]],
    leadVol: 0.06,
  },
  boss: {
    bpm: 152, vol: 0.9,
    chords: [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57]],
    bass: [0, 0, _, 0, 0, _, 0, 0, 0, 0, _, 0, 0, _, 0, 0],
    arp: [0, 3, 2, 3, 1, 3, 2, 3, 0, 3, 2, 3, 1, 3, 2, 3], arpWave: 'sawtooth', arpVol: 0.03,
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    lead: [[12, _, 12, _, 15, _, 12, _, 17, _, 15, _, 12, _, _, _], [12, _, 12, _, 16, _, 12, _, 19, _, 16, _, 12, _, _, _],
      [12, _, 12, _, 15, _, 12, _, 19, _, 15, _, 12, _, 10, _], [12, _, 16, _, 19, _, 16, _, 12, _, 11, _, 12, _, _, _]],
    leadVol: 0.055,
  },
  battle: {
    bpm: 140, vol: 0.85,
    chords: [[52, 55, 59, 64], [48, 52, 55, 60], [50, 53, 57, 62], [47, 50, 54, 59]],
    bass: [0, _, 0, 0, _, 0, 0, _, 0, _, 0, 0, _, 0, 0, 0],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 2, 3, 2], arpWave: 'sawtooth', arpVol: 0.026,
    hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    lead: [[12, _, _, 14, _, _, 15, _, 19, _, _, 17, _, 15, 14, _], [12, _, _, 10, _, _, 12, _, 15, _, _, _, _, _, _, _],
      [14, _, _, 15, _, _, 17, _, 21, _, _, 19, _, 17, 15, _], [19, _, _, 17, _, _, 15, _, 14, _, 12, _, 11, _, _, _]],
    leadVol: 0.05,
  },
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.track = null;        // currently requested track name
    this.wanted = null;       // track requested before the context existed
    this.step = 0;
    this.nextTime = 0;
    this.timer = 0;
    this.paused = false;
    this.last = {};           // per-sound throttle timestamps
    this.trackGain = null;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.5; this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
      // shared white-noise buffer
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      // looping missile-flight hiss, silent until a missile is airborne
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.2;
      this.loopGain = ctx.createGain(); this.loopGain.gain.value = 0;
      src.connect(bp); bp.connect(this.loopGain); this.loopGain.connect(this.sfxBus); src.start();
      // engine drone (pitch follows airspeed) and the zone-storm rumble, both silent until used
      this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 70;
      this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 35.5;
      this.engLp = ctx.createBiquadFilter(); this.engLp.type = 'lowpass'; this.engLp.frequency.value = 420; this.engLp.Q.value = 2;
      const engNoise = ctx.createBufferSource(); engNoise.buffer = this.noise; engNoise.loop = true;
      this.engBp = ctx.createBiquadFilter(); this.engBp.type = 'bandpass'; this.engBp.frequency.value = 900; this.engBp.Q.value = 0.8;
      this.engNoiseGain = ctx.createGain(); this.engNoiseGain.gain.value = 0.5;
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engOsc.connect(this.engLp); this.engOsc2.connect(this.engLp); this.engLp.connect(this.engGain);
      engNoise.connect(this.engBp); this.engBp.connect(this.engNoiseGain); this.engNoiseGain.connect(this.engGain);
      this.engGain.connect(this.sfxBus);
      this.engOsc.start(); this.engOsc2.start(); engNoise.start();
      const storm = ctx.createBufferSource(); storm.buffer = this.noise; storm.loop = true; storm.playbackRate.value = 0.5;
      const stormLp = ctx.createBiquadFilter(); stormLp.type = 'lowpass'; stormLp.frequency.value = 260;
      this.stormGain = ctx.createGain(); this.stormGain.gain.value = 0;
      storm.connect(stormLp); stormLp.connect(this.stormGain); this.stormGain.connect(this.sfxBus); storm.start();
      this.timer = setInterval(() => this._schedule(), 50);
      if (this.wanted) { const w = this.wanted; this.wanted = null; this.playMusic(w); }
    } catch (e) { this.ctx = null; }
  }

  setMusicVolume(v) { this.musicVol = clamp(v, 0, 1); if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicVol * 0.5, this.ctx.currentTime, 0.05); }
  setSfxVolume(v) { this.sfxVol = clamp(v, 0, 1); if (this.ctx) this.sfxBus.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.05); }

  /** Tab hidden / shown. */
  setSuspended(s) {
    if (!this.ctx) return;
    if (s) this.ctx.suspend().catch(() => {});
    else { this.ctx.resume().catch(() => {}); this.nextTime = 0; }
  }

  // ---- music --------------------------------------------------------------
  playMusic(name) {
    if (!this.ctx) { this.wanted = name; return; }
    if (this.track === name) return;
    this.stopMusic(0.5);
    this.track = name;
    if (!name || !TRACKS[name]) return;
    const g = this.trackGain = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(TRACKS[name].vol, this.ctx.currentTime + 0.6);
    g.connect(this.musicBus);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
  }
  stopMusic(fade = 0.4) {
    this.wanted = null;
    if (!this.ctx || !this.trackGain) { this.track = null; return; }
    const g = this.trackGain, t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { try { g.disconnect(); } catch (_) {} }, fade * 1000 + 400);
    this.trackGain = null; this.track = null;
  }
  /** Pauses the sequencer and silences gameplay loops (pause menu). */
  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.trackGain) {
      this.trackGain.gain.cancelScheduledValues(t);
      this.trackGain.gain.setTargetAtTime(p ? 0 : TRACKS[this.track].vol, t, 0.08);
    }
    if (p) {
      this.loopGain.gain.setTargetAtTime(0, t, 0.03);
      if (this.engGain) { this.engGain.gain.setTargetAtTime(0, t, 0.03); this.stormGain.gain.setTargetAtTime(0, t, 0.03); }
    } else this.nextTime = t + 0.1;
  }
  setMissileLoop(on) {
    if (!this.ctx || this._loopOn === on) return;
    this._loopOn = on;
    this.loopGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.08);
  }

  /** level 0 silences the engine; otherwise 0..1 airspeed, boost adds roar. */
  setEngine(level, boost = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = level > 0 && !this.paused;
    this.engGain.gain.setTargetAtTime(on ? (boost ? 0.075 : 0.045) : 0, t, 0.12);
    if (!on) return;
    this.engOsc.frequency.setTargetAtTime(62 + level * 46 + (boost ? 30 : 0), t, 0.15);
    this.engOsc2.frequency.setTargetAtTime(31 + level * 23 + (boost ? 15 : 0), t, 0.15);
    this.engLp.frequency.setTargetAtTime(300 + level * 380 + (boost ? 700 : 0), t, 0.15);
    this.engBp.frequency.setTargetAtTime(700 + level * 900 + (boost ? 1400 : 0), t, 0.15);
  }
  /** 0..1 rumble of the zone storm wall. */
  setStorm(v) {
    if (!this.ctx) return;
    this.stormGain.gain.setTargetAtTime(this.paused ? 0 : clamp(v, 0, 1) * 0.35, this.ctx.currentTime, 0.2);
  }

  _schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.track || this.paused || ctx.state !== 'running') return;
    const tr = TRACKS[this.track], dest = this.trackGain;
    const stepDur = 60 / tr.bpm / 4;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.22) {
      const t = this.nextTime, s = this.step % 16, bar = Math.floor(this.step / 16) % tr.chords.length;
      const chord = tr.chords[bar];
      if (tr.bass[s] !== _) this._tone('sawtooth', midi(chord[0] - 12), t, stepDur * 1.6, 0.16, dest, 420);
      if (tr.arp[s] !== _) this._tone(tr.arpWave, midi(chord[tr.arp[s]] + 12), t, stepDur * 1.2, tr.arpVol, dest, 2600);
      const ld = tr.lead[bar][s];
      if (ld !== _) this._tone('triangle', midi(chord[0] + 12 + ld), t, stepDur * 2.6, tr.leadVol, dest, 3200);
      if (tr.pad && s === 0) for (const n of chord) this._pad(midi(n), t, stepDur * 16, 0.035, dest);
      if (tr.kick[s]) this._kick(t, dest);
      if (tr.snare && tr.snare[s]) this._noise(t, 0.13, 0.12, dest, 'highpass', 1800);
      if (tr.hat[s]) this._noise(t, 0.035, 0.045, dest, 'highpass', 7000);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  /** One-shot jingles routed through the music bus. */
  jingle(name) {
    if (!this.ctx) return;
    this.stopMusic(0.3);
    const t0 = this.ctx.currentTime + 0.25, d = this.musicBus;
    if (name === 'victory') {
      const seq = [[72, 0], [76, 0.14], [79, 0.28], [84, 0.42], [79, 0.62], [84, 0.76], [88, 0.9]];
      for (const [n, t] of seq) { this._tone('triangle', midi(n), t0 + t, 0.3, 0.2, d, 4000); this._tone('square', midi(n - 12), t0 + t, 0.25, 0.05, d, 2000); }
      for (const n of [60, 64, 67, 72]) this._pad(midi(n), t0 + 0.9, 1.8, 0.07, d);
    } else if (name === 'defeat') {
      const seq = [[67, 0], [63, 0.3], [60, 0.6], [55, 0.9], [51, 1.25]];
      for (const [n, t] of seq) this._tone('triangle', midi(n), t0 + t, 0.5, 0.18, d, 1500);
      for (const n of [48, 51, 55]) this._pad(midi(n), t0 + 1.25, 1.8, 0.06, d);
    }
  }

  // ---- synth voices ---------------------------------------------------------
  _tone(type, freq, t, dur, vol, dest, cutoff, freqEnd) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (cutoff) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
  }
  _pad(freq, t, dur, vol, dest) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    for (const det of [-5, 5]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  _kick(t, dest, vol = 0.32) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.18);
  }
  _noise(t, dur, vol, dest, ftype = 'lowpass', f0 = 1000, f1) {
    const ctx = this.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = this.noise;
    f.type = ftype; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // ---- sound effects --------------------------------------------------------
  /** Plays a named effect. `min` throttles rapid repeats of the same sound. */
  sfx(name, vol = 1) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.sfxVol <= 0 || vol < 0.04) return;
    const def = SFX[name];
    if (!def) return;
    const now = ctx.currentTime;
    if (this.last[name] !== undefined && now - this.last[name] < def.min) return;
    this.last[name] = now;
    let dest = this.sfxBus;
    if (vol < 0.98) {                    // distant sounds: a throwaway gain stage
      dest = ctx.createGain(); dest.gain.value = vol; dest.connect(this.sfxBus);
      setTimeout(() => { try { dest.disconnect(); } catch (_) {} }, 2500);
    }
    def.play(this, now + 0.005, dest);
  }
}

// name -> { min: minimum seconds between plays, play(audio, time, dest) }
const SFX = {
  shoot: { min: 0.055, play: (a, t, d) => { const f = 820 + Math.random() * 180; a._tone('square', f, t, 0.07, 0.05, d, 2400, 280); a._noise(t, 0.045, 0.06, d, 'highpass', 2600); } },
  enemyShoot: { min: 0.09, play: (a, t, d) => a._tone('sawtooth', 460, t, 0.12, 0.06, d, 1500, 160) },
  missile: { min: 0.1, play: (a, t, d) => { a._noise(t, 0.4, 0.22, d, 'bandpass', 500, 2400); a._tone('sawtooth', 180, t, 0.3, 0.1, d, 900, 80); } },
  hit: { min: 0.045, play: (a, t, d) => { a._noise(t, 0.035, 0.1, d, 'highpass', 2500); a._tone('square', 320, t, 0.04, 0.04, d, 1800, 180); } },
  explodeS: { min: 0.06, play: (a, t, d) => { a._noise(t, 0.32, 0.38, d, 'lowpass', 1400, 140); a._tone('sine', 140, t, 0.25, 0.3, d, 0, 40); } },
  explodeL: { min: 0.1, play: (a, t, d) => { a._noise(t, 0.75, 0.55, d, 'lowpass', 1000, 70); a._tone('sine', 100, t, 0.6, 0.45, d, 0, 28); a._noise(t + 0.05, 0.3, 0.2, d, 'bandpass', 2400, 400); } },
  bossBoom: { min: 0.3, play: (a, t, d) => { a._noise(t, 1.6, 0.7, d, 'lowpass', 900, 45); a._tone('sine', 80, t, 1.4, 0.6, d, 0, 22); a._tone('sawtooth', 60, t, 1.0, 0.2, d, 300, 30); } },
  hurt: { min: 0.15, play: (a, t, d) => { a._tone('sawtooth', 240, t, 0.28, 0.25, d, 1200, 60); a._noise(t, 0.18, 0.3, d, 'lowpass', 1800, 300); } },
  shield: { min: 0.1, play: (a, t, d) => { a._tone('sine', 520, t, 0.3, 0.2, d, 0, 1040); a._tone('sine', 780, t + 0.08, 0.3, 0.14, d, 0, 1560); } },
  shieldHit: { min: 0.1, play: (a, t, d) => a._tone('triangle', 1200, t, 0.18, 0.18, d, 0, 500) },
  coin: { min: 0.05, play: (a, t, d) => { a._tone('square', 988, t, 0.07, 0.07, d, 5000); a._tone('square', 1319, t + 0.06, 0.16, 0.07, d, 5000); } },
  star: { min: 0.05, play: (a, t, d) => { [784, 988, 1175, 1568].forEach((f, i) => a._tone('triangle', f, t + i * 0.05, 0.18, 0.13, d)); } },
  powerup: { min: 0.1, play: (a, t, d) => { a._tone('triangle', 440, t, 0.25, 0.16, d, 0, 880); a._tone('triangle', 660, t + 0.1, 0.25, 0.14, d, 0, 1320); } },
  heal: { min: 0.1, play: (a, t, d) => { [523, 659, 784].forEach((f, i) => a._tone('sine', f, t + i * 0.07, 0.22, 0.18, d)); } },
  click: { min: 0.03, play: (a, t, d) => { a._tone('sine', 720, t, 0.05, 0.14, d, 0, 520); } },
  swoosh: { min: 0.1, play: (a, t, d) => a._noise(t, 0.24, 0.1, d, 'bandpass', 400, 2800) },
  levelStart: { min: 0.5, play: (a, t, d) => { [392, 523, 659, 784].forEach((f, i) => a._tone('triangle', f, t + i * 0.11, 0.28, 0.16, d)); a._noise(t, 0.5, 0.08, d, 'bandpass', 300, 3000); } },
  warning: { min: 1, play: (a, t, d) => { for (let i = 0; i < 4; i++) { a._tone('square', 520, t + i * 0.5, 0.22, 0.12, d, 2000); a._tone('square', 390, t + i * 0.5 + 0.24, 0.22, 0.12, d, 2000); } } },
  phase: { min: 0.5, play: (a, t, d) => { a._tone('sawtooth', 70, t, 0.9, 0.3, d, 800, 320); a._noise(t, 0.8, 0.25, d, 'bandpass', 200, 2600); } },
  bomb: { min: 0.3, play: (a, t, d) => { a._tone('sine', 300, t, 0.9, 0.5, d, 0, 30); a._noise(t, 1.0, 0.5, d, 'lowpass', 2400, 80); } },
  special: { min: 0.3, play: (a, t, d) => { a._tone('sawtooth', 220, t, 0.35, 0.14, d, 2400, 880); a._tone('square', 440, t + 0.05, 0.3, 0.06, d, 3000, 1320); } },
  buy: { min: 0.1, play: (a, t, d) => { [659, 784, 988, 1319].forEach((f, i) => a._tone('triangle', f, t + i * 0.06, 0.22, 0.15, d)); } },
  error: { min: 0.15, play: (a, t, d) => { a._tone('square', 170, t, 0.1, 0.1, d, 900); a._tone('square', 140, t + 0.12, 0.14, 0.1, d, 900); } },
  starPop: { min: 0.05, play: (a, t, d) => { a._tone('triangle', 880, t, 0.3, 0.2, d, 0, 1760); a._noise(t, 0.08, 0.06, d, 'highpass', 5000); } },
  flare: { min: 0.2, play: (a, t, d) => { a._noise(t, 0.5, 0.2, d, 'bandpass', 3200, 600); a._tone('triangle', 1400, t, 0.3, 0.1, d, 0, 500); a._tone('triangle', 1000, t + 0.08, 0.3, 0.08, d, 0, 380); } },
  boost: { min: 0.3, play: (a, t, d) => { a._noise(t, 0.7, 0.3, d, 'bandpass', 300, 2600); a._tone('sawtooth', 90, t, 0.6, 0.16, d, 900, 260); } },
  lock: { min: 0.3, play: (a, t, d) => { a._tone('square', 1250, t, 0.07, 0.07, d, 4000); a._tone('square', 1250, t + 0.12, 0.07, 0.07, d, 4000); } },
  empty: { min: 0.2, play: (a, t, d) => a._tone('square', 200, t, 0.06, 0.07, d, 800) },
  // ---- Team Battle ----
  countdown: { min: 0.3, play: (a, t, d) => { a._tone('square', 660, t, 0.16, 0.14, d, 3000); a._tone('sine', 660, t, 0.3, 0.12, d); } },
  fight: { min: 0.5, play: (a, t, d) => { [523, 659, 784, 1047].forEach((f, i) => a._tone('sawtooth', f, t + i * 0.03, 0.6, 0.08, d, 3200)); a._noise(t, 0.6, 0.18, d, 'bandpass', 600, 3800); a._kick(t, d, 0.5); } },
  overheat: { min: 0.4, play: (a, t, d) => { a._noise(t, 0.7, 0.22, d, 'highpass', 2500, 6000); a._tone('square', 300, t, 0.12, 0.08, d, 1200); a._tone('square', 220, t + 0.13, 0.16, 0.08, d, 1200); } },
  gunReady: { min: 0.3, play: (a, t, d) => { a._tone('square', 880, t, 0.05, 0.06, d, 4000); a._tone('square', 1320, t + 0.06, 0.06, 0.06, d, 4000); a._noise(t, 0.05, 0.08, d, 'highpass', 4000); } },
  lowAmmo: { min: 0.8, play: (a, t, d) => { for (let i = 0; i < 3; i++) a._tone('triangle', 1500, t + i * 0.09, 0.05, 0.08, d); } },
  zoneAlarm: { min: 0.5, play: (a, t, d) => { a._tone('sawtooth', 440, t, 0.18, 0.1, d, 1800, 330); a._tone('sawtooth', 440, t + 0.22, 0.18, 0.1, d, 1800, 330); } },
  zoneShrink: { min: 1, play: (a, t, d) => { a._tone('sawtooth', 55, t, 1.6, 0.3, d, 500, 40); a._noise(t, 1.5, 0.3, d, 'lowpass', 700, 90); for (let i = 0; i < 3; i++) a._tone('square', 740 - i * 120, t + i * 0.25, 0.2, 0.07, d, 2500); } },
  killConfirm: { min: 0.1, play: (a, t, d) => { a._tone('triangle', 1175, t, 0.12, 0.2, d); a._tone('triangle', 1568, t + 0.08, 0.28, 0.2, d); a._noise(t, 0.06, 0.1, d, 'highpass', 5000); } },
  multiKill: { min: 0.3, play: (a, t, d) => { [784, 988, 1175, 1568, 1976].forEach((f, i) => a._tone('square', f, t + i * 0.06, 0.18, 0.07, d, 5000)); } },
  allyScore: { min: 0.2, play: (a, t, d) => { a._tone('sine', 880, t, 0.15, 0.1, d); a._tone('sine', 1320, t + 0.07, 0.2, 0.08, d); } },
  enemyScore: { min: 0.2, play: (a, t, d) => { a._tone('triangle', 330, t, 0.22, 0.12, d); a._tone('triangle', 247, t + 0.12, 0.3, 0.12, d); } },
  respawn: { min: 0.3, play: (a, t, d) => { a._noise(t, 0.6, 0.2, d, 'bandpass', 300, 3200); a._tone('sine', 300, t, 0.5, 0.14, d, 0, 900); } },
  hitTick: { min: 0.05, play: (a, t, d) => { a._tone('square', 2200, t, 0.03, 0.05, d, 6000); a._noise(t, 0.02, 0.05, d, 'highpass', 6000); } },
  flyby: { min: 0.6, play: (a, t, d) => { a._noise(t, 0.55, 0.28, d, 'bandpass', 3200, 500); a._tone('sawtooth', 220, t, 0.5, 0.05, d, 1200, 90); } },
  heartbeat: { min: 0.5, play: (a, t, d) => { a._tone('sine', 62, t, 0.12, 0.4, d, 0, 40); a._tone('sine', 58, t + 0.18, 0.14, 0.32, d, 0, 38); } },
  crate: { min: 0.15, play: (a, t, d) => { [523, 784, 1047].forEach((f, i) => a._tone('square', f, t + i * 0.05, 0.12, 0.08, d, 4000)); a._noise(t, 0.12, 0.1, d, 'highpass', 3000); } },
  crateDrop: { min: 0.5, play: (a, t, d) => { a._noise(t, 0.5, 0.12, d, 'bandpass', 900, 300); a._tone('triangle', 660, t, 0.2, 0.06, d); } },
  lockOn: { min: 0.25, play: (a, t, d) => a._tone('square', 1760, t, 0.09, 0.06, d, 6000) },
  crash: { min: 0.15, play: (a, t, d) => { a._noise(t, 1.1, 0.6, d, 'lowpass', 1600, 60); a._tone('sine', 90, t, 0.9, 0.5, d, 0, 24); a._noise(t + 0.15, 0.6, 0.2, d, 'bandpass', 3000, 300); } },
  whiz: { min: 0.12, play: (a, t, d) => { a._noise(t, 0.16, 0.12, d, 'bandpass', 4200, 1400); a._tone('sine', 1900, t, 0.12, 0.03, d, 0, 900); } },
  takeoff: { min: 1, play: (a, t, d) => { a._noise(t, 2.6, 0.32, d, 'bandpass', 180, 1600); a._tone('sawtooth', 55, t, 2.6, 0.16, d, 500, 130); a._tone('sawtooth', 82, t + 0.4, 2.2, 0.08, d, 900, 220); } },
  gearUp: { min: 0.5, play: (a, t, d) => { a._tone('square', 140, t, 0.08, 0.12, d, 900); a._noise(t + 0.06, 0.12, 0.14, d, 'lowpass', 900); a._tone('square', 110, t + 0.22, 0.1, 0.1, d, 700); } },
  casing: { min: 0.09, play: (a, t, d) => { a._tone('triangle', 2600 + Math.random() * 900, t + 0.12, 0.05, 0.025, d); } },
  shockwave: { min: 0.2, play: (a, t, d) => { a._noise(t, 0.5, 0.25, d, 'lowpass', 600, 80); a._tone('sine', 70, t, 0.45, 0.3, d, 0, 30); } },
  radioOn: { min: 0.2, play: (a, t, d) => { a._noise(t, 0.09, 0.07, d, 'bandpass', 2400, 1800); a._tone('square', 1800, t + 0.02, 0.04, 0.035, d, 5000); } },
  radioOff: { min: 0.2, play: (a, t, d) => { a._noise(t, 0.12, 0.06, d, 'bandpass', 1600, 900); } },
  shieldUp: { min: 0.3, play: (a, t, d) => { a._tone('sine', 300, t, 0.5, 0.2, d, 0, 900); a._tone('triangle', 600, t + 0.05, 0.45, 0.12, d, 0, 1800); a._noise(t, 0.4, 0.12, d, 'bandpass', 1200, 4000); } },
  shieldDown: { min: 0.3, play: (a, t, d) => { a._tone('sine', 700, t, 0.35, 0.14, d, 0, 180); a._noise(t, 0.25, 0.08, d, 'bandpass', 2000, 400); } },
  win: { min: 1, play: (a, t, d) => { [523, 659, 784, 1047, 1319].forEach((f, i) => a._tone('triangle', f, t + i * 0.09, 0.4, 0.14, d)); } },
  missileHit: { min: 0.06, play: (a, t, d) => { a._noise(t, 0.4, 0.42, d, 'lowpass', 1800, 120); a._tone('sine', 160, t, 0.3, 0.3, d, 0, 36); } },
};
