// Plan 11: render the PWA icons (PNG) from one inline SVG with Playwright (portal/ dev dependency). Run once from repo root:
//   node planning/11_2026-10-09_mobile-pwa-app/evidence/harness/make_icons.mjs portal src/mobile/icons
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const [portalDir, outDir] = process.argv.slice(2);
const require = createRequire(path.resolve(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
mkdirSync(outDir, { recursive: true });

// Building + wrench on the brand blue. `pad` shrinks the glyph for the maskable safe zone (inner 80%).
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(${256 - 256 * pad} ${256 - 256 * pad}) scale(${pad})" fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
    <path d="M120 400V170l110-60v290"/>
    <path d="M230 400V200l130 50v150"/>
    <path d="M90 400h332"/>
    <path d="M160 200v0M160 250v0M160 300v0M190 220v0M190 270v0M190 320v0" stroke-width="22"/>
    <path d="M300 280h0M300 330h0" stroke-width="22"/>
    <circle cx="372" cy="150" r="46" fill="#fff" stroke="none"/>
    <path d="M372 126v48M348 150h48" stroke="#1d4ed8" stroke-width="18"/>
  </g>
</svg>`;

const jobs = [
  ['icon-192.png', 192, 0.86],
  ['icon-512.png', 512, 0.86],
  ['icon-maskable-512.png', 512, 0.66],
  ['apple-touch-icon-180.png', 180, 0.8],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(outDir, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`wrote ${name} ${size}x${size}`);
}
await browser.close();
