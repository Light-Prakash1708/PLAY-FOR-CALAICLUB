import { CONFIG } from './GameConfig.js';

/**
 * Single requestAnimationFrame loop with delta time. start() is idempotent so
 * a second loop can never be created by accident.
 */
export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.rafId = 0;
    this.last = 0;
    this.frames = 0;        // exposed for QA (duplicate-loop detection)
    this.fps = 60;
    this._tick = this._tick.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this._tick);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
  /** Call after the tab becomes visible again so the next dt is not huge. */
  resetClock() { this.last = performance.now(); }
  _tick(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt <= 0) return;
    if (dt > CONFIG.MAX_DT) dt = CONFIG.MAX_DT;
    this.frames++;
    this.fps += (1 / dt - this.fps) * 0.05;
    this.update(dt);
    this.render();
  }
}
