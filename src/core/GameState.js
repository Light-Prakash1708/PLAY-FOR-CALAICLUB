// Finite set of top-level game states plus a tiny observable holder.
export const State = Object.freeze({
  LOADING: 'loading',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  COMPLETE: 'complete',
  GAMEOVER: 'gameover',
});

export class GameState {
  constructor() { this.current = State.LOADING; this.listeners = []; }
  is(s) { return this.current === s; }
  set(s) {
    if (s === this.current) return;
    const prev = this.current;
    this.current = s;
    for (const fn of this.listeners) fn(s, prev);
  }
  onChange(fn) { this.listeners.push(fn); }
}
