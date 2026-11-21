// Entry point: builds the game and hands control to the loading screen.
import { Game } from './src/core/Game.js';

function boot() {
  const game = new Game(document.getElementById('game'), document.getElementById('ui'));
  window.__skyStrike = game;      // handy for debugging and automated QA
  game.boot();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
