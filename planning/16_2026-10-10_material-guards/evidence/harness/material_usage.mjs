// Plan 16 SPEC-P02 §U5: web + phone app share ONE material form; one click = exactly one POST material-usage.
// Usage: node material_usage.mjs <base-memory-server> <portal-dir> <output-dir>
// Run only against a server with MO_STORE=memory (it writes tickets and stock). Prints PASS/FAIL lines, exits 1 on FAIL.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const [base, portalDir, outDir] = process.argv.slice(2);
if (!base || !portalDir || !outDir) { console.error('usage: node material_usage.mjs <base> <portal-dir> <output-dir>'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(path.resolve(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
const API = `${base}/api/v1`;
const RUN = Date.now().toString(36).slice(-4);
const LAMP = 'SIM-MAT-LAMP-01';
const LAMP2 = 'SIM-MAT-LAMP-02';
const CLEAN = 'SIM-MAT-CLEAN-01';
let failures = 0;
const check = (id, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); };

// ---------------------------------------------------------------- API helpers (setup and server-side oracle)
const tokens = {};
async function token(user) {
  if (!tokens[user]) {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Demo@2026' }) });
    tokens[user] = (await r.json()).access_token;
  }
  return tokens[user];
}
async function call(user, method, p, body) {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token(user)}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}
async function started(text, user) {
  const id = (await call('cudan01', 'POST', '/resident/tickets', { original_description: `${text} (${RUN})`, channel: 'form' })).ticket_id;
  const c = await call('bql01', 'GET', `/mo/tickets/${id}`);
  if (c.ticket.status !== 'ROUTED') throw new Error(`${id} ${c.ticket.status}/${c.ticket.blocker && c.ticket.blocker.code}`);
  await call(user, 'POST', `/mo/tickets/${id}/accept`);
  return id;
}
const caseOf = (user, id) => call(user, 'GET', `/mo/tickets/${id}`);
const linesOf = async (user, id) => (await caseOf(user, id)).material_lines.map((l) => `${l.item_code}:${l.planned_qty}/${l.issued_qty}/${l.used_qty}`).join(',');
const stockOf = async (code) => (await call('kho01', 'GET', '/mo/warehouse/stock')).find((r) => r.item_code === code).qty;
async function restock(code, atLeast) {
  const have = await stockOf(code);
  if (have != null && have < atLeast) await call('kho01', 'POST', `/mo/warehouse/stock/${code}`, { qty: atLeast - have });
}

// ---------------------------------------------------------------- browser surfaces
const browser = await chromium.launch();
const SURFACES = {
  app: {
    viewport: { width: 390, height: 844 },
    rows: '#dept-material-rows', save: '#dept-material-save', none: '#dept-no-material', box: '#dept-materials',
    savedPill: '#dept-materials .pill:has-text("Đã lưu")', toast: '#toast',
    async open(page, user, id) {
      await page.goto(`${base}/app/`);
      await page.fill('#login-username', user);
      await page.fill('#login-password', 'Demo@2026');
      await page.click('#login-submit');
      await page.waitForSelector('[data-updated]');
      await page.goto(`${base}/app/#/d/${id}`);
      await page.waitForSelector('#dept-materials');
    },
  },
  web: {
    viewport: { width: 1440, height: 1000 },
    rows: '#web-material-rows', save: '#web-material-save', none: '#web-no-material', box: '#web-materials',
    savedPill: '#web-materials span:has-text("Đã lưu")', toast: '#toasts',
    async open(page, user, id) {
      const t = await token(user);
      await page.addInitScript((value) => sessionStorage.setItem('mo-token', value), t);
      await page.goto(`${base}/ui/`);
      await page.waitForSelector('#app-view:not(.hidden)');
      const said = (await caseOf(user, id)).ticket.raw.original_description; // unique: it carries RUN
      await page.evaluate((ticket) => select(ticket), id);
      // the first ticket of the queue renders first: wait until the detail pane shows THIS ticket's form
      await page.waitForFunction((text) => {
        const pane = document.querySelector('#detail-pane');
        return pane && pane.textContent.includes(text) && pane.querySelector('#web-materials');
      }, said, { timeout: 15000 });
    },
  },
};

async function session(kind, user, id) {
  const s = SURFACES[kind];
  const ctx = await browser.newContext({ viewport: s.viewport });
  const page = await ctx.newPage();
  const posts = [];
  const errors = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /\/material/.test(r.url())) posts.push(new URL(r.url()).pathname.replace(/^.*\/tickets\/[^/]+/, '')); });
  page.on('pageerror', (e) => errors.push(e.message));
  await s.open(page, user, id);
  return { s, ctx, page, posts, errors };
}
const toastHas = async (page, sel, text) => !!(await page.waitForSelector(`${sel}:has-text("${text}")`, { timeout: 8000 }).catch(() => null));
const rowValues = (page, s) => page.$$eval(`${s.rows} > div`, (rs) => rs.map((r) => `${r.querySelector('select').value}:${r.querySelector('input').value}`));
async function fillRows(page, s, wanted) { // wanted: [[code, qty], ...] — reuse the rows on screen, add the rest
  for (let i = (await page.$$(`${s.rows} > div`)).length; i < wanted.length; i += 1) await page.click(`${s.box} button:has-text("+ Thêm vật tư")`);
  const rows = await page.$$(`${s.rows} > div`);
  for (let i = 0; i < wanted.length; i += 1) {
    await (await rows[i].$('select')).selectOption(wanted[i][0]);
    await (await rows[i].$('input')).fill(String(wanted[i][1]));
  }
}
async function clickSave(page, s, posts) {
  const before = posts.length;
  const response = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/material-usage'), { timeout: 10000 }).catch(() => null);
  await page.click(s.save);
  const r = await response;
  await page.waitForTimeout(400);
  return { status: r ? r.status() : null, sent: posts.slice(before) };
}
async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

const TEXT = { // a different place per surface, or the second report is held as a duplicate of the first
  app: { tec: 'Đèn hành lang tầng 3 tòa S1 không sáng.', cln: 'Hành lang tầng 4 tòa S1 nhiều rác, cần vệ sinh.' },
  web: { tec: 'Đèn sảnh thang máy tầng 7 tòa S2 không sáng.', cln: 'Sảnh thang máy tầng 6 tòa S2 bẩn, cần lau dọn.' },
};
for (const kind of ['app', 'web']) {
  // ---------------- technical: no prefill, empty refused, 4 lamps over a norm of 1, repeat, shortage rollback
  await restock(LAMP, 8);
  const tec = await started(TEXT[kind].tec, 'kythuat01');
  const { s, ctx, page, posts, errors } = await session(kind, 'kythuat01', tec);
  const boxText = (await page.textContent(s.box)).replace(/\s+/g, ' ');
  check(`${kind}-T1-no-agent`, !/Agent|đề xuất|định mức|lý do/i.test(boxText), `khối vật tư: "${boxText.slice(0, 100)}"`);
  check(`${kind}-T1-not-saved`, boxText.includes('Chưa lưu') && !boxText.includes('Đã lưu'), 'Agent plan không được tính là đã lưu');
  const rows0 = await rowValues(page, s);
  check(`${kind}-T1-no-prefill`, rows0.length === 1 && rows0[0] === ':1', `dòng=${JSON.stringify(rows0)}; engine Agent=${await linesOf('kythuat01', tec)}`);
  const options = await page.$$eval(`${s.rows} select option`, (os) => [...new Set(os.map((o) => o.value).filter(Boolean))].sort().join());
  check(`${kind}-T1-options`, options === 'SIM-MAT-LAMP-01,SIM-MAT-LAMP-02,SIM-MAT-STARTER-01', options);

  await page.click(s.save);
  check(`${kind}-T2-empty-blocked`, (await toastHas(page, s.toast, 'Chọn ít nhất một vật tư')) && posts.length === 0, `POST=${posts.length}`);

  const lamp0 = await stockOf(LAMP);
  await fillRows(page, s, [[LAMP, 4]]);
  const first = await clickSave(page, s, posts);
  const got1 = await linesOf('kythuat01', tec);
  check(`${kind}-T3-one-post`, first.status === 200 && first.sent.length === 1 && first.sent[0] === '/material-usage', `status=${first.status} posts=${JSON.stringify(first.sent)}`);
  check(`${kind}-T3-saved`, got1 === `${LAMP}:4/4/4` && (await stockOf(LAMP)) === lamp0 - 4, `${got1}; kho ${lamp0}→${await stockOf(LAMP)}`);
  check(`${kind}-T3-pill`, !!(await page.waitForSelector(s.savedPill, { timeout: 8000 }).catch(() => null)), 'hiện "Đã lưu" sau 200');
  await page.screenshot({ path: path.join(outDir, `${kind}-tec-saved.png`), fullPage: true });

  const again = await clickSave(page, s, posts);
  check(`${kind}-T4-repeat`, again.status === 200 && again.sent.length === 1 && (await stockOf(LAMP)) === lamp0 - 4, `status=${again.status} posts=${again.sent.length} kho=${await stockOf(LAMP)}`);

  const lamp2 = await stockOf(LAMP2);
  const beforeFail = JSON.stringify((await caseOf('kythuat01', tec)).material_lines);
  await fillRows(page, s, [[LAMP, 1], [LAMP2, 1]]);
  const typed = await rowValues(page, s);
  const short = await clickSave(page, s, posts);
  const kept = await rowValues(page, s);
  const after = JSON.stringify((await caseOf('kythuat01', tec)).material_lines);
  check(`${kind}-T5-shortage-409`, short.status === 409 && short.sent.length === 1 && (await toastHas(page, s.toast, 'Kho chỉ còn')), `status=${short.status} posts=${short.sent.length}`);
  check(`${kind}-T5-rollback`, after === beforeFail && (await stockOf(LAMP)) === lamp0 - 4 && (await stockOf(LAMP2)) === lamp2, `lines không đổi=${after === beforeFail}; kho LAMP-01=${await stockOf(LAMP)} LAMP-02=${await stockOf(LAMP2)}`);
  check(`${kind}-T5-input-kept`, JSON.stringify(kept) === JSON.stringify(typed), `trước=${JSON.stringify(typed)} sau=${JSON.stringify(kept)}`);
  await page.screenshot({ path: path.join(outDir, `${kind}-tec-shortage.png`), fullPage: true });
  await page.waitForTimeout(32000); // the app refreshes every 30 s: an unsaved choice must survive it (R04 F3)
  const later = await rowValues(page, s);
  check(`${kind}-T5-kept-after-refresh`, JSON.stringify(later) === JSON.stringify(typed), `sau 32 s=${JSON.stringify(later)}`);
  check(`${kind}-T6-no-overflow`, await noOverflow(page), `scrollWidth<=innerWidth ở ${s.viewport.width}px`);
  check(`${kind}-T6-no-js-error`, errors.length === 0, errors.join(' | ') || '0 lỗi JS');
  await ctx.close();

  // ---------------- cleaning: choose, then "Không sử dụng vật tư" gives the stock back with lines []
  await restock(CLEAN, 6);
  const cln = await started(TEXT[kind].cln, 'vesinh01');
  const c = await session(kind, 'vesinh01', cln);
  const clean0 = await stockOf(CLEAN);
  await fillRows(c.page, c.s, [[CLEAN, 3]]);
  const picked = await clickSave(c.page, c.s, c.posts);
  check(`${kind}-C1-saved`, picked.status === 200 && (await stockOf(CLEAN)) === clean0 - 3, `status=${picked.status} kho ${clean0}→${await stockOf(CLEAN)}`);
  await c.page.check(c.s.none);
  const none = await clickSave(c.page, c.s, c.posts);
  const cc = await caseOf('vesinh01', cln);
  check(`${kind}-C2-none-one-post`, none.status === 200 && none.sent.length === 1 && cc.material_lines.length === 0 && cc.draft.material_requirement_mode === 'N_A', `status=${none.status} posts=${none.sent.length} mode=${cc.draft.material_requirement_mode}`);
  check(`${kind}-C2-stock-back`, (await stockOf(CLEAN)) === clean0, `kho CLEAN-01=${await stockOf(CLEAN)} (đầu ${clean0})`);
  await c.page.screenshot({ path: path.join(outDir, `${kind}-cln-none.png`), fullPage: true });
  check(`${kind}-C3-no-overflow`, await noOverflow(c.page), `${c.s.viewport.width}px`);
  check(`${kind}-C3-no-js-error`, c.errors.length === 0, c.errors.join(' | ') || '0 lỗi JS');
  await c.ctx.close();
}

// ---------------- older server without material_codes_by_department: Lưu stays disabled, 0 POST (R04 F4)
for (const kind of ['app', 'web']) {
  const tid = await started(kind === 'app' ? 'Đèn hành lang tầng 5 tòa S1 không sáng.' : 'Đèn sảnh thang máy tầng 9 tòa S2 không sáng.', 'kythuat01');
  const s = SURFACES[kind];
  const ctx = await browser.newContext({ viewport: s.viewport });
  const page = await ctx.newPage();
  await page.route('**/api/v1/mo/catalog', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    delete body.material_codes_by_department;
    await route.fulfill({ response, json: body });
  });
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /\/material/.test(r.url())) posts.push(r.url()); });
  await s.open(page, 'kythuat01', tid);
  await page.waitForTimeout(1500); // let every render (and applyOnline) run
  const disabled = await page.$eval(s.save, (b) => b.disabled);
  await page.click(s.save, { force: true }).catch(() => {});
  await page.waitForTimeout(500);
  check(`${kind}-T8-old-server-disabled`, disabled && posts.length === 0, `disabled=${disabled} POST=${posts.length}`);
  await ctx.close();
}

await browser.close();
console.log(`RESULT failures=${failures}`);
process.exit(failures ? 1 : 0);
