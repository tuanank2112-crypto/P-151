// Plan 10 TESTING §2: list paging P1-P8 in a real browser, against a LOCAL backend (memory store, mock LLM).
// Usage: node paging.mjs <base-url> <out-dir> <portal-dir> [--no-seed]
// Exit 0 only when every check passes. Never point it at the shared :8000 backend (it creates tickets).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const [base, outDir, portalDir, flag] = process.argv.slice(2);
const require = createRequire(path.join(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
mkdirSync(outDir, { recursive: true });

const API = `${base}/api/v1`;
const SEED = 30;
let failures = 0;
const check = (id, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`);
};

async function apiLogin(username) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'Demo@2026' }) });
  const body = await r.json();
  return body.access_token || body.token;
}

if (flag !== '--no-seed') {
  // No building or area: every report stops at NEED_INFO, so it lands in the BPTN queue and the BQL list too
  const token = await apiLogin('cudan01');
  for (let i = 1; i <= SEED; i += 1) {
    const r = await fetch(`${API}/resident/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ original_description: `Có rác để lâu bốc mùi ở chỗ số ${i}, nhờ dọn giúp`, channel: 'form' }),
    });
    if (r.status !== 201) throw new Error(`seed ${i}: HTTP ${r.status}`);
  }
  console.log(`seeded ${SEED} tickets for cudan01`);
}

const browser = await chromium.launch();

async function block(name, fn) {
  try { await fn(); } catch (e) { check(name, false, `stopped: ${String(e.message).split(/\r?\n/)[0]}`); }
}

async function open(width, user) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page, user);
  return { ctx, page, errors };
}

async function login(page, user, { reload = true } = {}) {
  if (reload) await page.goto(`${base}/ui/`);  // reload=false: the sign-in form the app shows after sign-out, same JS state
  await page.waitForSelector('#login-username');
  await page.fill('#login-username', user);
  await page.fill('#login-password', 'Demo@2026');
  await page.click('button.submit');
  await page.waitForSelector('#list-pane .card');
  await page.waitForLoadState('networkidle');
}

const rows = (page, key) => page.locator(`[data-list=${key}] > li`).count();
const label = (page, key) => page.locator(`[data-pager=${key}] [data-page-label]`).textContent();
const pill = (page) => page.locator('#list-pane .card .pill').first().textContent();

// ---------------------------------------------------------------- resident (1440)
await block('resident-1440', async () => {
  const { ctx, page, errors } = await open(1440, 'cudan01');
  const total = Number((await pill(page)).match(/\d+/)[0]);
  const pages = Math.ceil(total / 20);
  check('P1', (await rows(page, 'resident')) === 20 && (await label(page, 'resident')) === `Trang 1 / ${pages}`
    && await page.locator('[data-page-prev]').isDisabled() && total > 20,
    `20 rows, "Trang 1 / ${pages}", prev disabled, pill ${total}`);
  await page.screenshot({ path: path.join(outDir, 'resident-1440-p1.png'), fullPage: true });

  const calls = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) calls.push(r.url()); });
  await page.click('[data-page-next]');
  const lastRows = total - 20 * (pages - 1);
  check('P2', (await rows(page, 'resident')) === (pages === 2 ? lastRows : 20) && (await label(page, 'resident')) === `Trang 2 / ${pages}`
    && calls.length === 0, `page 2 rows ok, label "Trang 2 / ${pages}", API calls on turn = ${calls.length}`);

  const second = page.locator('[data-list=resident] > li').nth(1);
  const picked = (await second.locator('.idb').textContent()).trim();
  await second.locator('button').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const current = (await page.locator('[data-list=resident] [aria-current=true] .idb').textContent().catch(() => '')).trim();
  check('P3', (await label(page, 'resident')) === `Trang 2 / ${pages}` && current === picked,
    `after selecting ${picked} on page 2 and render(): "${await label(page, 'resident')}", selected ${current}`);
  await page.screenshot({ path: path.join(outDir, 'resident-1440-p2-selected.png'), fullPage: true });

  // P3b: browse back to page 1, then an action re-renders: the list returns to the page of the selected ticket
  await page.click('[data-page-prev]');
  const browsed = await label(page, 'resident');
  await page.fill('#detail-pane textarea[name=content]', 'Mùi rất nặng, nhờ dọn sớm (bổ sung thử, không có vị trí)');
  await page.click('#detail-pane button:has-text("Gửi bổ sung")');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const back = (await page.locator('[data-list=resident] [aria-current=true] .idb').textContent().catch(() => '')).trim();
  check('P3b', browsed === `Trang 1 / ${pages}` && (await label(page, 'resident')) === `Trang 2 / ${pages}` && back === picked,
    `browsed to "${browsed}", after an action: "${await label(page, 'resident')}", selected ${back}`);

  await page.click('.hdr-btn:has-text("Đăng xuất")');
  await login(page, 'cudan01', { reload: false });
  check('P8', (await label(page, 'resident')) === `Trang 1 / ${pages}`, `after sign-out + sign-in: "${await label(page, 'resident')}"`);
  check('P7-1440-resident', errors.length === 0, `pageerror=${errors.length} ${errors.join(' | ')}`);
  await ctx.close();
});

// ---------------------------------------------------------------- cudan02: few tickets, no pager
await block('cudan02', async () => {
  const { ctx, page } = await open(1440, 'cudan02');
  const total = Number((await pill(page).catch(() => '0')).match(/\d+/)?.[0] || 0);
  check('P4', (await page.locator('nav.pager').count()) === 0 && total <= 20, `cudan02 has ${total} tickets, pager count = ${await page.locator('nav.pager').count()}`);
  await ctx.close();
});

// ---------------------------------------------------------------- BPTN + BQL
await block('bptn-1440', async () => {
  const { ctx, page, errors } = await open(1440, 'bptn01');
  const queue = Number((await page.locator('#list-pane span:has-text("Hàng chờ BPTN") + span').textContent()).trim());
  check('P5-bptn', (await rows(page, 'bptn')) === 20 && queue > 20 && (await page.locator('[data-pager=bptn]').count()) === 1,
    `20 rows, stat "Hàng chờ BPTN" = ${queue}, pager present`);
  await page.screenshot({ path: path.join(outDir, 'bptn-1440.png'), fullPage: true });
  check('P7-1440-bptn', errors.length === 0, `pageerror=${errors.length}`);
  await ctx.close();
});
await block('bql-1440', async () => {
  const { ctx, page, errors } = await open(1440, 'bql01');
  const all = Number((await page.locator('#list-pane span:has-text("Tổng hồ sơ") + span').textContent()).trim());
  check('P5-bql', (await rows(page, 'bql')) === 20 && all > 20, `20 rows, stat "Tổng hồ sơ" = ${all}`);
  await page.click('[data-page-next]');
  const before = await label(page, 'bql');
  await page.selectOption('#list-pane select[name=status]', 'NEED_INFO');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const needInfo = Number((await page.locator('#list-pane span:has-text("Tổng hồ sơ") + span').textContent()).trim());
  const after = await label(page, 'bql').catch(() => '(no pager)');
  check('P6', before.startsWith('Trang 2') && needInfo > 20 && after.startsWith('Trang 1 /'),
    `on "${before}", filter NEED_INFO (${needInfo} rows) -> "${after}"`);
  await page.screenshot({ path: path.join(outDir, 'bql-1440.png'), fullPage: true });
  check('P7-1440-bql', errors.length === 0, `pageerror=${errors.length}`);
  await ctx.close();
});

// ---------------------------------------------------------------- 390 px
for (const [user, key] of [['cudan01', 'resident'], ['bptn01', 'bptn'], ['bql01', 'bql']]) await block(`390-${key}`, async () => {
  const { ctx, page, errors } = await open(390, user);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const pagerOverflow = await page.locator(`[data-pager=${key}]`).evaluate((n) => n.scrollWidth > n.clientWidth);
  check(`P7-390-${key}`, !overflow && !pagerOverflow && errors.length === 0 && (await rows(page, key)) === 20,
    `overflow page=${overflow} pager=${pagerOverflow}, pageerror=${errors.length}`);
  await page.locator(`[data-pager=${key}]`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, `${key}-390.png`) });
  await ctx.close();
});

await browser.close();
console.log(failures ? `RESULT: ${failures} FAILED` : 'RESULT: ALL PASS');
process.exit(failures ? 1 : 0);
