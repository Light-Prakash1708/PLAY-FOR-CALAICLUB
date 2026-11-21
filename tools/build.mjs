// Bundles the modular source into one self-contained HTML file
// (dist/sky-strike.html) that runs by double-click, with fonts inlined.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const res = await build({ entryPoints: ['main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2019' });
let css = readFileSync('style.css', 'utf8');
css = css.replace(/url\("(assets\/fonts\/[^"]+)"\)/g, (_, p) => `url("data:font/woff2;base64,${readFileSync(p).toString('base64')}")`);
let html = readFileSync('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);
html = html.replace('<script type="module" src="main.js"></script>', () => `<script>${res.outputFiles[0].text.replace(/<\/script/g, '<\\/script')}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/sky-strike.html', html);
// developer build: same game with everything unlocked and a separate save slot
writeFileSync('dist/sky-strike-dev.html', html.replace('<title>SKY STRIKE</title>', '<title>SKY STRIKE (Dev)</title>\n<script>window.SKY_DEV = true;</script>'));
console.log('dist/sky-strike.html', (html.length / 1024).toFixed(0) + ' KB');

// dist/app: the same game as an installable web app (manifest + offline cache + icons).
// Upload this folder to any HTTPS host, or point Capacitor at it to build an APK.
mkdirSync('dist/app/assets/icons', { recursive: true });
const pwa = html
  .replace('<title>SKY STRIKE</title>', '<title>SKY STRIKE</title>\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="assets/icons/icon-192.png">')
  .replace('</body>', `<script>if ('serviceWorker' in navigator && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(function () {}); }</script>\n</body>`);
writeFileSync('dist/app/index.html', pwa);
for (const f of ['manifest.webmanifest', 'sw.js', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-maskable-512.png']) copyFileSync(f, 'dist/app/' + f);
console.log('dist/app/ (installable web app)');
