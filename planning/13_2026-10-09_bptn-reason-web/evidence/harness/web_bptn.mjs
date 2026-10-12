// Plan 13: web BPTN form must refuse a blank reason before calling the API (engine answers 409 GUARD_FAILED).
// Usage: node web_bptn.mjs <base-url> <portal-dir>
// Exit 0 only when every check passes. LOCAL memory backend only (it changes tickets) — never the shared :8000.
import { createRequire } from 'node:module';
import path from 'node:path';

const [base, portalDir] = process.argv.slice(2);
const require = createRequire(path.resolve(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');

const API = `${base}/api/v1`;
const RUN = Date.now().toString(36).slice(-4);
let failures = 0;
const check = (id, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tokens = {};
async function token(user) {
  if (!tokens[user]) {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Demo@2026' }) });
    tokens[user] = (await r.json()).access_token;
  }
  return tokens[user];
}
async function call(user, method, p, body) {
  const r = await fetch(API + p, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token(user)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
const report = async (user, text) => (await call(user, 'POST', '/resident/tickets', { original_description: text, channel: 'form' })).data.ticket_id;
const codeOf = async (id) => {
  const t = (await call('bptn01', 'GET', `/mo/tickets/${id}`)).data.ticket;
  return t.blocker ? t.blocker.code : null;
};
async function waitCode(id, wanted, tries = 40) {
  let code = await codeOf(id);
  for (let i = 0; i < tries && code !== wanted; i += 1) { await sleep(250); code = await codeOf(id); }
  return code;
}
async function waitNot(id, code, tries = 40) {
  let now = await codeOf(id);
  for (let i = 0; i < tries && now === code; i += 1) { await sleep(250); now = await codeOf(id); }
  return now;
}

// ---------------------------------------------------------------- setup (API)
const missing = await report('cudan02', `Có rác để lâu bốc mùi ở chỗ số ${RUN}-w, nhờ dọn giúp`);
const safety = await report('cudan02', `Hành lang tầng 3 tòa S1 hình như có mùi khét (${RUN}-s)`);
check('SETUP-missing', (await waitCode(missing, 'MISSING_INFO')) === 'MISSING_INFO', `${missing} blocker MISSING_INFO`);
check('SETUP-safety', (await waitCode(safety, 'SAFETY_REVIEW_REQUIRED')) === 'SAFETY_REVIEW_REQUIRED', `${safety} blocker SAFETY_REVIEW_REQUIRED`);
// the web hides seed tickets (isSeedTicket), so ASSET_UNCLEAR comes from a real report like fixture SIM-TKT-TEC-002
const asset = await report('cudan02', `Đèn cầu thang bộ tầng 9 tòa S1 bị hỏng, không sáng (${RUN}-t)`);
check('SETUP-asset', (await waitCode(asset, 'ASSET_UNCLEAR')) === 'ASSET_UNCLEAR', `${asset} blocker ASSET_UNCLEAR`);

// ---------------------------------------------------------------- browser
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let posts = [];
page.on('request', (req) => {
  if (req.method() === 'POST' && /\/(bptn-resolve|safety)$/.test(req.url())) posts.push(req.url());
});
const bptnToken = await token('bptn01');
await page.addInitScript((t) => sessionStorage.setItem('mo-token', t), bptnToken);
await page.goto(`${base}/ui/`);
await page.waitForSelector('#app-view:not(.hidden)');

const formWith = (label) => page.locator('#detail-pane form', { has: page.locator('button', { hasText: label }) });
const open = async (id, label) => {  // select the ticket, then wait for its BPTN form
  await page.evaluate((ticket) => select(ticket), id);
  await formWith(label).first().waitFor({ timeout: 15000 });
  await sleep(300);
};
const toastSays = async (text) => {
  try { await page.waitForFunction((t) => document.querySelector('#toasts')?.textContent.includes(t), text, { timeout: 3000 }); return true; } catch { return false; }
};
const clearToasts = () => page.evaluate(() => { document.querySelector('#toasts').innerHTML = ''; });

// W1/W2 MISSING_INFO: a location without a reason never reaches the API; with a reason it goes through
await open(missing, 'Lưu và xử lý tiếp');
let form = formWith('Lưu và xử lý tiếp');
await form.locator('input[name="location"]').fill('Tòa S1 / Tầng 4 / Hành lang');
posts = [];
await form.locator('button[type="submit"]').click();
const w1Toast = await toastSays('Nhập lý do');
await sleep(500);
check('W1', w1Toast && posts.length === 0 && (await codeOf(missing)) === 'MISSING_INFO', `blank reason: toast=${w1Toast} POST=${posts.length} blocker=${await codeOf(missing)}`);
await clearToasts();
await form.locator('textarea[name="note"]').fill('Đã gọi cư dân xác nhận vị trí');
posts = [];
await form.locator('button[type="submit"]').click();
const w2Code = await waitNot(missing, 'MISSING_INFO');
check('W2', posts.length === 1 && w2Code !== 'MISSING_INFO', `with reason: POST=${posts.length} blocker=${w2Code}`);

// W3/W4/W5 SAFETY_REVIEW_REQUIRED confirm safe: empty (native required) and spaces-only are refused locally
await open(safety, 'Xác nhận an toàn');
form = formWith('Xác nhận an toàn');
posts = [];
await form.locator('button[type="submit"]').click();
await sleep(700);
const w3Invalid = await form.locator('textarea[name="note"]').evaluate((n) => !n.validity.valid);
check('W3', w3Invalid && posts.length === 0 && (await codeOf(safety)) === 'SAFETY_REVIEW_REQUIRED', `empty: invalid=${w3Invalid} POST=${posts.length}`);
await form.locator('textarea[name="note"]').fill('   ');
posts = [];
await form.locator('button[type="submit"]').click();
const w4Toast = await toastSays('Nhập lý do');
await sleep(500);
check('W4', w4Toast && posts.length === 0 && (await codeOf(safety)) === 'SAFETY_REVIEW_REQUIRED', `spaces only: toast=${w4Toast} POST=${posts.length}`);
await clearToasts();
await form.locator('textarea[name="note"]').fill('Đã kiểm tra tại chỗ, không có mùi khét');
posts = [];
await form.locator('button[type="submit"]').click();
const w5Code = await waitNot(safety, 'SAFETY_REVIEW_REQUIRED');
check('W5', posts.length === 1 && w5Code !== 'SAFETY_REVIEW_REQUIRED', `with reason: POST=${posts.length} blocker=${w5Code}`);

// W6 ASSET_UNCLEAR: "xác định tại hiện trường" needs a reason too
if (asset) {
  await open(asset, 'Lưu và xử lý tiếp');
  form = formWith('Lưu và xử lý tiếp');
  await form.locator('input[name="onsite"]').check();
  posts = [];
  await form.locator('button[type="submit"]').click();
  const w6Toast = await toastSays('Nhập lý do');
  await sleep(500);
  check('W6', w6Toast && posts.length === 0 && (await codeOf(asset)) === 'ASSET_UNCLEAR', `onsite without reason: toast=${w6Toast} POST=${posts.length}`);
}

check('JS', errors.length === 0, `page errors=${JSON.stringify(errors)}`);
await browser.close();
console.log(failures === 0 ? 'RESULT: ALL PASS' : `RESULT: ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
