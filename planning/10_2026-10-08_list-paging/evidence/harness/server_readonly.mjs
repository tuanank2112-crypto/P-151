// Plan 10 G3/G4 on the SHARED backend (:8000): READ-ONLY — sign in, look at the list, turn one page. No form is sent.
// Usage: node server_readonly.mjs <base-url> <out-dir> <portal-dir>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const [base, outDir, portalDir] = process.argv.slice(2);
const require = createRequire(path.join(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
mkdirSync(outDir, { recursive: true });
let failures = 0;
const check = (id, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); };
const browser = await chromium.launch();
for (const [user, key] of [['cudan01', 'resident'], ['bptn01', 'bptn'], ['kythuat01', 'department'], ['bql01', 'bql']]) {
  for (const width of [1440, 390]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const writes = [];
    page.on('request', (r) => { if (r.method() !== 'GET' && !r.url().endsWith('/auth/login')) writes.push(`${r.method()} ${r.url()}`); });
    await page.goto(`${base}/ui/`);
    await page.fill('#login-username', user);
    await page.fill('#login-password', 'Demo@2026');
    await page.click('button.submit');
    await page.waitForSelector('#list-pane .card .pill');
    await page.waitForLoadState('networkidle');
    const total = Number((await page.locator('#list-pane .card .pill').first().textContent()).match(/\d+/)[0]);
    const shown = await page.locator(`[data-list=${key}] > li`).count();
    const pagers = await page.locator(`[data-pager=${key}]`).count();
    let turned = 'n/a';
    if (pagers) {
      await page.click('[data-page-next]');
      turned = await page.locator(`[data-pager=${key}] [data-page-label]`).textContent();
      await page.click('[data-page-prev]');
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    check(`${user}@${width}`, shown === Math.min(total, 20) && (pagers === 1) === (total > 20) && !overflow && errors.length === 0 && writes.length === 0,
      `total=${total} shown=${shown} pager=${pagers} next→"${turned}" overflow=${overflow} pageerror=${errors.length} writes=${writes.length}`);
    if (pagers) await page.locator(`[data-pager=${key}]`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(outDir, `server-${key}-${width}.png`) });
    await page.context().close();
  }
}
await browser.close();
console.log(failures ? `RESULT: ${failures} FAILED` : 'RESULT: ALL PASS');
process.exit(failures ? 1 : 0);
