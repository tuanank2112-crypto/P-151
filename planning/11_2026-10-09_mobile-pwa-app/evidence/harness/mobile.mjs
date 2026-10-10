// Plan 11 TESTING §2 + SPEC-P05 §7: phone app M1–M17 in a real browser (390×844), against a LOCAL backend (memory store, mock LLM).
// Usage: node mobile.mjs <base-url> <out-dir> <portal-dir>
// Exit 0 only when every check passes. Never point it at the shared :8000 backend (it creates and closes tickets).
// Run between 06:00 and 22:00: setup tickets use the real clock and departments only work in their hours.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [base, outDir, portalDir] = process.argv.slice(2);
const require = createRequire(path.resolve(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
mkdirSync(outDir, { recursive: true });
const tmpDir = path.join(outDir, '..', 'harness-tmp');
mkdirSync(tmpDir, { recursive: true });

const API = `${base}/api/v1`;
const APP = `${base}/app/`;
const RUN = Date.now().toString(36).slice(-4);
let failures = 0;
const check = (id, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- API helpers (setup only)

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
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}
async function ok(user, method, p, body) {
  const r = await call(user, method, p, body);
  if (r.status >= 300) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
}
let smallJpeg = null; // set once the browser is up
async function uploadPhoto(user, p) {
  const form = new FormData();
  form.append('files', new Blob([smallJpeg], { type: 'image/jpeg' }), 'after.jpg');
  const r = await fetch(API + p, { method: 'POST', headers: { Authorization: `Bearer ${await token(user)}` }, body: form });
  if (r.status >= 300) throw new Error(`photo ${p} → ${r.status} ${await r.text()}`);
}
async function report(user, text) {
  return (await ok(user, 'POST', '/resident/tickets', { original_description: text, channel: 'form' })).ticket_id;
}
const DEPT_USER = { DEPT_CLEANING: 'vesinh01', DEPT_TECHNICAL: 'kythuat01' };
async function deptOf(id) {
  const c = await ok('bql01', 'GET', `/mo/tickets/${id}`);
  return DEPT_USER[c.ticket.department_id];
}
/** Department work through the API, as tests/test_maintenance/helpers.py to_ready() does in the engine. */
async function driveToReview(id) {
  const dept = await deptOf(id);
  if (!dept) throw new Error(`${id}: not routed to a department`);
  await ok(dept, 'POST', `/mo/tickets/${id}/accept`);
  const c = await ok(dept, 'GET', `/mo/tickets/${id}`);
  for (const item of c.checklist_items) await ok(dept, 'POST', `/mo/tickets/${id}/checklist/${item.template_item_id}`, { status: 'COMPLETED' });
  for (const line of c.material_lines) await ok(dept, 'POST', `/mo/tickets/${id}/materials/${line.item_code}`, { issued_qty: line.planned_qty, used_qty: line.planned_qty });
  for (const req of c.draft.evidence_requirements) {
    if (req.allowed_evidence_types.includes('PROCESSING_NOTE')) {
      await ok(dept, 'POST', `/mo/tickets/${id}/evidence`, { requirement_id: req.requirement_id, evidence_type: 'PROCESSING_NOTE', content_or_metadata: 'Đã xử lý (mô phỏng)' });
    }
  }
  await uploadPhoto(dept, `/mo/tickets/${id}/photos`);
  const done = await ok(dept, 'POST', `/mo/tickets/${id}/complete`);
  if (done.ticket.status !== 'READY_FOR_REVIEW') throw new Error(`${id}: complete → ${done.ticket.status} ${JSON.stringify(done.draft && done.draft.readiness_evaluation)}`);
}
const statusOf = async (id) => (await ok('bql01', 'GET', `/mo/tickets/${id}`)).ticket;

// ---------------------------------------------------------------- browser helpers

const browser = await chromium.launch();
{
  const p = await browser.newPage();
  const make = async (w, h, q) => Buffer.from(await p.evaluate(async ([w2, h2, q2]) => {
    const c = document.createElement('canvas'); c.width = w2; c.height = h2;
    const g = c.getContext('2d');
    for (let i = 0; i < 400; i += 1) { g.fillStyle = `hsl(${(i * 37) % 360},70%,${30 + (i % 50)}%)`; g.fillRect(Math.random() * w2, Math.random() * h2, w2 / 6, h2 / 6); }
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q2));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, [w, h, q]), 'base64');
  smallJpeg = await make(64, 48, 0.8);
  writeFileSync(path.join(tmpDir, 'big-1.jpg'), await make(4000, 3000, 0.97));
  writeFileSync(path.join(tmpDir, 'big-2.jpg'), await make(3000, 4000, 0.97));
  await p.close();
}

async function open(user) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const requests = [];
  const errors = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), at: Date.now() }));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector('#login-username');
  await page.fill('#login-username', user);
  await page.fill('#login-password', 'Demo@2026');
  await page.click('#login-submit');
  await page.waitForFunction(() => location.hash !== '#/login');
  return { ctx, page, requests, errors };
}
// Every screenshot also checks the screen never prints a JS placeholder ("null", "undefined", "NaN", "[object …]")
async function shot(page, name) {
  const leaked = await page.evaluate(() => (document.body.innerText.match(/\bnull\b|\bundefined\b|\bNaN\b|\[object \w+\]/g) || []));
  check(`TEXT ${name}`, leaked.length === 0, `placeholder text on screen=${JSON.stringify(leaked)}`);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}
const apiCalls = (requests, since, re = /\/api\/v1\//) => requests.filter((r) => r.at >= since && re.test(r.url));
async function block(name, fn) {
  try { await fn(); } catch (e) { check(name, false, `stopped: ${String(e.message).split(/\r?\n/)[0]}`); }
}

// ---------------------------------------------------------------- setup

const R = { fresh: await report('cudan01', `Hành lang tầng 2 tòa S1 nhiều rác, cần vệ sinh. (${RUN}-a)`) };
// no building or area ⇒ NEED_INFO, the only status where the resident may add information (views.resident_view)
R.needInfo = await report('cudan01', `Có rác để lâu bốc mùi ở chỗ số ${RUN}, nhờ dọn giúp`);
R.rated = await report('cudan01', `Sảnh thang máy tầng 5 tòa S2 bẩn, cần lau dọn. (${RUN}-b)`);
await driveToReview(R.rated);
await ok('bql01', 'POST', `/bql/tickets/${R.rated}/close`, {});
R.review1 = await report('cudan02', `Hành lang tầng 7 tòa S1 nhiều rác, cần vệ sinh. (${RUN}-c)`);
await driveToReview(R.review1);
R.review2 = await report('cudan02', `Hành lang tầng 9 tòa S2 có rác thải, cần dọn. (${RUN}-d)`);
await driveToReview(R.review2);
R.emergency = await report('cudan02', `Thang máy tòa S1 kẹt người bên trong, cần cứu gấp. (${RUN}-e)`);
// SPEC-P05 §7: a routed ticket for the department (M14) and a MISSING_INFO one for BPTN (M15)
R.dept = await report('cudan02', `Hành lang tầng 6 tòa S2 nhiều rác, cần vệ sinh. (${RUN}-f)`);
R.bptn = await report('cudan02', `Có rác để lâu bốc mùi ở chỗ số ${RUN}-p, nhờ dọn giúp`);
const em = await statusOf(R.emergency);
console.log(`setup ${JSON.stringify(R)} emergency=${em.status}/${em.blocker && em.blocker.code}`);

// ---------------------------------------------------------------- resident

const res = await open('cudan01');
const { page } = res;

await block('M1', async () => {
  await page.waitForSelector('#resident-list .titem');
  const h1 = await page.textContent('h1');
  check('M1', page.url().endsWith('#/r') && h1.includes('Phản ánh của tôi'), `hash=${new URL(page.url()).hash} h1="${h1}"`);
  await shot(page, 'm1-resident-list');
});

await block('M2', async () => {
  await page.click('#new-ticket');
  await page.waitForSelector('#new-description');
  const text = `Đèn hành lang tầng 11 tòa S2 bị cháy, tối om. (${RUN}-m2)`;
  await page.fill('#new-description', text);
  await page.setInputFiles('input[type=file]:not([capture])', [path.join(tmpDir, 'big-1.jpg'), path.join(tmpDir, 'big-2.jpg')]);
  await page.waitForFunction(() => document.querySelectorAll('.photos .ph img').length === 2);
  await shot(page, 'm2-new-ticket');
  await page.click('#submit-ticket');
  await page.waitForFunction(() => /^#\/r\/SIM-/.test(location.hash), null, { timeout: 30000 });
  const id = decodeURIComponent(new URL(page.url()).hash.slice(4));
  R.m2 = id;
  const view = await ok('cudan01', 'GET', `/resident/tickets/${id}`);
  const sizes = await page.evaluate(async ([tid, ids]) => {
    const tok = localStorage.getItem('mo-app-token');
    const out = [];
    for (const e of ids) {
      const r = await fetch(`/api/v1/resident/tickets/${tid}/photos/${e}`, { headers: { Authorization: `Bearer ${tok}` } });
      const b = await r.blob();
      const bmp = await createImageBitmap(b);
      out.push({ w: bmp.width, h: bmp.height, bytes: b.size, type: b.type });
    }
    return out;
  }, [id, view.photos]);
  const raw = await ok('bql01', 'GET', `/mo/tickets/${id}`);
  const okSizes = sizes.length === 2 && sizes.every((s) => Math.max(s.w, s.h) <= 1600 && s.bytes < 5 * 1024 * 1024);
  check('M2', raw.ticket.raw.channel === 'app' && okSizes, `id=${id} channel=${raw.ticket.raw.channel} photos=${JSON.stringify(sizes)}`);
  await page.waitForSelector('#public-message');
  await shot(page, 'm2-detail');
});

await block('M3', async () => {
  await page.goto(`${APP}#/r/new`);
  await page.waitForSelector('#new-description');
  const text = `Rác tràn thùng ở sảnh tầng 3 tòa S2, cần dọn. (${RUN}-m3)`;
  await page.fill('#new-description', text);
  await page.evaluate(() => { const b = document.getElementById('submit-ticket'); b.click(); b.click(); b.click(); });
  await page.waitForFunction(() => /^#\/r\/SIM-/.test(location.hash), null, { timeout: 30000 });
  await sleep(1500);
  const rows = await ok('cudan01', 'GET', '/resident/tickets');
  const same = rows.filter((t) => t.description === text).length;
  check('M3', same === 1, `tickets with that text=${same}`);
});

await block('M4', async () => {
  await page.goto(`${APP}#/r/${R.needInfo}`);
  await page.waitForSelector('#addition-text');
  await shot(page, 'm4-need-info');
  const before = (await ok('cudan01', 'GET', `/resident/tickets/${R.needInfo}`)).additions.length;
  const note = `Ở cuối hành lang tầng 4 tòa S1, gần thang bộ (${RUN})`;
  await page.fill('#addition-text', note);
  await page.click('#resident-actions >> button:has-text("Gửi bổ sung")');
  await page.waitForFunction((n) => document.getElementById('resident-detail').textContent.includes(n), note);
  const after = (await ok('cudan01', 'GET', `/resident/tickets/${R.needInfo}`)).additions.length;
  check('M4', after === before + 1, `additions ${before}→${after}, shown without reload`);
});

await block('M5', async () => {
  // with the service worker in control (localhost is a secure context), so a cached /api/ answer would show here
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.goto(`${APP}#/r/${R.fresh}`);
  await page.reload();
  await page.waitForSelector('#public-message');
  const controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
  const label = async () => page.textContent('#resident-detail .pill');
  const before = await label();
  const dept = await deptOf(R.fresh);
  const t0 = Date.now();
  await ok(dept, 'POST', `/mo/tickets/${R.fresh}/accept`);
  let after = before;
  while (Date.now() - t0 < 36000 && after === before) { await sleep(500); after = await label(); }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  check('M5', after !== before && Date.now() - t0 <= 36000, `badge "${before}" → "${after}" after ${secs}s, no reload (sw controls page: ${controlled})`);
  await shot(page, 'm5-synced');
});

await block('M6', async () => {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const t0 = Date.now();
  await sleep(35000);
  const hidden = apiCalls(res.requests, t0).length;
  const t1 = Date.now();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(2000);
  const shown = apiCalls(res.requests, t1).length;
  check('M6', hidden === 0 && shown >= 1, `API calls while hidden 35s=${hidden}, within 2s of visible=${shown}`);
});

await block('M7', async () => {
  // (a) a form screen: offline locks the write button, nothing is sent; online unlocks it
  await page.goto(`${APP}#/r/new`);
  await page.waitForSelector('#submit-ticket');
  await page.fill('#new-description', `Bóng đèn sảnh tầng 6 tòa S1 nhấp nháy (${RUN}-m7)`);
  await res.ctx.setOffline(true);
  const t0 = Date.now();
  await page.waitForSelector('#offline', { state: 'visible' });
  const disabled = await page.$$eval('[data-write]', (bs) => bs.length > 0 && bs.every((b) => b.disabled));
  await page.evaluate(() => document.getElementById('submit-ticket').click());
  await sleep(500);
  await shot(page, 'm7-offline');
  const writes = apiCalls(res.requests, t0).filter((r) => r.method !== 'GET').length;
  await res.ctx.setOffline(false);
  await sleep(500);
  const enabledAgain = await page.$eval('#submit-ticket', (b) => !b.disabled);
  const bannerGone = await page.isHidden('#offline');
  // (b) a list screen: coming back online reloads at once
  await page.goto(`${APP}#/r`);
  await page.waitForSelector('#resident-list .titem');
  await res.ctx.setOffline(true);
  await sleep(1000); // let the list's own first load settle
  const t1 = Date.now(); // before going online: the 'online' event may fire the request inside setOffline()
  await res.ctx.setOffline(false);
  await sleep(2500);
  const reload = apiCalls(res.requests, t1).length;
  check('M7', disabled && writes === 0 && enabledAgain && bannerGone && reload >= 1,
    `write buttons disabled offline=${disabled} writes=${writes} re-enabled=${enabledAgain} banner hidden=${bannerGone} list reload after online=${reload}`);
});

await block('M8', async () => {
  await page.goto(`${APP}#/r/${R.rated}`);
  await page.waitForSelector('#rating');
  await page.click('#rating [data-score="5"]');
  await page.click('#rating >> button:has-text("Gửi đánh giá")');
  await page.waitForSelector('#rating', { state: 'detached' });
  const again = await call('cudan01', 'POST', `/resident/tickets/${R.rated}/rating`, { score: 4 });
  check('M8', again.status === 409, `rating form gone after send, second rating via API → ${again.status}`);
  await shot(page, 'm8-rated');
});

await block('M17', async () => {
  await page.goto(`${APP}#/r`);
  await page.waitForSelector('#resident-list .titem');
  const chipRows = await page.$$eval('#screen .chips', (n) => n.length);
  await page.click('.ov:has-text("Đã xong")');
  await page.waitForSelector('#resident-filter >> text=Đang lọc');
  const shown = await page.$$eval('#resident-list [data-ticket]', (as) => as.map((a) => a.dataset.ticket));
  const rows = await ok('cudan01', 'GET', '/resident/tickets');
  const terminal = new Set(rows.filter((t) => ['CLOSED', 'MERGED', 'CANCELLED'].includes(t.status)).map((t) => t.ticket_id));
  await shot(page, 'm17-resident-done-filter');
  check('M17', chipRows === 0 && shown.length === Math.min(20, terminal.size) && shown.every((id) => terminal.has(id)),
    `chip rows=${chipRows}, "Đã xong" shows ${shown.length}/${terminal.size} terminal tickets, all terminal=${shown.every((id) => terminal.has(id))}`);
});
await block('M13', async () => {
  await page.goto(`${APP}#/r`);
  await page.waitForSelector('#resident-list');
  const tok = await page.evaluate(() => localStorage.getItem('mo-app-token'));
  await fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` } });
  await page.click('button:has-text("Tải lại")');
  await page.waitForFunction(() => location.hash === '#/login');
  const left = await page.evaluate(() => localStorage.getItem('mo-app-token'));
  check('M13', left === null, `server session dropped → hash #/login, token in storage=${left}`);
});
check('JS', res.errors.length === 0, `resident page errors=${JSON.stringify(res.errors)}`);
await res.ctx.close();

// ---------------------------------------------------------------- BQL

const b = await open('bql01');
await block('M9', async () => {
  await b.page.waitForSelector('#bql-list');
  const ids = await b.page.$$eval('#bql-list [data-ticket]', (as) => as.map((a) => a.dataset.ticket));
  const seeds = ids.filter((id) => /-(CLN|TEC)-/i.test(id));
  check('M9', b.page.url().endsWith('#/b') && ids.includes(R.review1) && ids.includes(R.review2) && seeds.length === 0,
    `tab Cần tôi: ${ids.length} rows, has review tickets=${ids.includes(R.review1) && ids.includes(R.review2)}, seed rows=${seeds.length}`);
  await shot(b.page, 'm9-bql-list');
});

await block('M10', async () => {
  await b.page.goto(`${APP}#/b/${R.review1}`);
  await b.page.waitForSelector('#review-actions');
  await shot(b.page, 'm10-bql-review');
  await b.page.click('#review-actions >> button:has-text("Nghiệm thu — đạt")');
  await b.page.waitForFunction(() => !document.getElementById('review-actions'));
  await b.page.goto(`${APP}#/b/${R.review2}`);
  await b.page.waitForSelector('#review-actions');
  const t0 = Date.now();
  await b.page.click('#review-actions >> button:has-text("Trả làm lại")'); // no reason yet: nothing may be sent
  await sleep(500);
  const premature = apiCalls(b.requests, t0, /\/rework/).length;
  await b.page.fill('#rework-note', 'Còn rác ở góc cầu thang');
  await b.page.click('#review-actions >> button:has-text("Trả làm lại")');
  await b.page.click('[data-confirm]');
  await b.page.waitForFunction(() => !document.getElementById('review-actions'));
  const s1 = (await statusOf(R.review1)).status;
  const s2 = (await statusOf(R.review2)).status;
  check('M10', s1 === 'CLOSED' && s2 === 'IN_PROGRESS' && premature === 0, `close → ${s1}, rework → ${s2}, rework sent without reason=${premature}`);
});

await block('M11', async () => {
  await b.page.goto(`${APP}#/b`);
  await b.page.click('#bql-tabs [data-tab="emergency"]');
  const ids = await b.page.$$eval('#bql-list [data-ticket]', (as) => as.map((a) => a.dataset.ticket));
  await shot(b.page, 'm11-bql-emergency');
  await b.page.goto(`${APP}#/b/${R.emergency}`);
  await b.page.waitForSelector('#emergency-actions');
  await b.page.fill('#emergency-note', 'Kiểm tra camera: không có người kẹt');
  await b.page.click('#emergency-actions >> button:has-text("Báo động giả — hạ mức")');
  await b.page.click('[data-confirm]');
  await b.page.waitForFunction(() => !document.getElementById('emergency-actions'));
  const t = await statusOf(R.emergency);
  const code = t.blocker && t.blocker.code;
  check('M11', ids.includes(R.emergency) && code !== 'EMERGENCY_PENDING_BQL', `in tab Khẩn cấp=${ids.includes(R.emergency)}, after downgrade status=${t.status} blocker=${code}`);
});
check('JS', b.errors.length === 0, `BQL page errors=${JSON.stringify(b.errors)}`);
await b.ctx.close();

// ---------------------------------------------------------------- other roles

// ---------------------------------------------------------------- department / BPTN / warehouse (SPEC-P05)

const deptUser = await deptOf(R.dept);
const d = await open(deptUser || 'vesinh01');
await block('M14', async () => {
  const { page: dp } = d;
  await dp.waitForSelector('#staff-list');
  const listed = await dp.$$eval('#staff-list [data-ticket]', (as) => as.map((a) => a.dataset.ticket));
  await dp.goto(`${APP}#/d/${R.dept}`);
  await dp.click('#dept-accept');
  await dp.waitForSelector('#dept-checklist');
  await shot(dp, 'm14-dept-work');
  // each tick reloads the case and redraws the screen: query again every time (a held handle goes stale)
  for (let i = 0; i < 10; i += 1) {
    await dp.waitForLoadState('networkidle');
    const before = await dp.$$eval('#dept-checklist input:checked', (b) => b.length);
    const open = dp.locator('#dept-checklist input:not(:checked)');
    if (!(await open.count())) break;
    await open.first().click();
    await dp.waitForFunction((n) => document.querySelectorAll('#dept-checklist input:checked').length > n, before);
  }
  const lines = await dp.$$eval('#dept-materials .mat-line', (n) => n.map((x) => x.dataset.item));
  for (const item of lines) {
    await dp.click(`#dept-materials .mat-line[data-item="${item}"] >> button:has-text("Lưu vật tư")`);
    await dp.waitForSelector(`#dept-materials .mat-line[data-item="${item}"] >> text=Đã lưu`);
  }
  await dp.setInputFiles('#dept-photos input[type=file]:not([capture])', [path.join(tmpDir, 'big-1.jpg')]);
  await dp.waitForFunction(() => document.querySelectorAll('#dept-photos .photos .ph img').length === 1);
  await dp.click('#dept-photos >> button:has-text("Tải ảnh lên")');
  await dp.waitForFunction(() => document.querySelectorAll('#dept-photos .thumbs img').length >= 1, null, { timeout: 30000 });
  if (await dp.$('#dept-note')) {
    await dp.fill('#dept-note', `Đã dọn xong, sàn sạch (${RUN})`);
    await dp.click('#dept-report >> button:has-text("Lưu ghi chú")');
    await dp.waitForSelector('#toast >> text=Đã lưu ghi chú'); // validation_status only changes when the Agent checks readiness
  }
  await shot(dp, 'm14-dept-ready');
  await dp.click('#dept-complete');
  if (await dp.waitForSelector('[data-confirm]', { timeout: 1500 }).catch(() => null)) await dp.click('[data-confirm]');
  let s = await statusOf(R.dept);
  for (let i = 0; i < 40 && s.status !== 'READY_FOR_REVIEW'; i += 1) { await sleep(500); s = await statusOf(R.dept); }
  const raw = await ok('bql01', 'GET', `/mo/tickets/${R.dept}`);
  const after = raw.evidence.filter((e) => e.source === 'DEPARTMENT_EXECUTION' && e.evidence_type === 'SIMULATED_IMAGE');
  const sizes = [];
  for (const e of after) {
    const r = await fetch(`${API}/mo/tickets/${R.dept}/photos/${e.evidence_id}`, { headers: { Authorization: `Bearer ${await token('bql01')}` } });
    const bytes = Buffer.from(await r.arrayBuffer());
    sizes.push({ bytes: bytes.length, jpeg: bytes[0] === 0xff && bytes[1] === 0xd8 });
  }
  await shot(dp, 'm14-dept-done');
  check('M14', listed.includes(R.dept) && s.status === 'READY_FOR_REVIEW' && after.length === 1 && sizes.every((x) => x.jpeg && x.bytes < 5 * 1024 * 1024),
    `in list=${listed.includes(R.dept)} status=${s.status} department photos=${after.length} ${JSON.stringify(sizes)}`);
});
check('JS', d.errors.length === 0, `department page errors=${JSON.stringify(d.errors)}`);
await d.ctx.close();

const p = await open('bptn01');
await block('M15', async () => {
  const { page: pp } = p;
  await pp.waitForSelector('#staff-list');
  const before = await statusOf(R.bptn);
  await pp.goto(`${APP}#/p/${R.bptn}`);
  await pp.waitForSelector('#bptn-location');
  await shot(pp, 'm15-bptn-missing');
  await pp.fill('#bptn-location', 'Tòa S1 / Tầng 4 / Hành lang');
  await pp.fill('#bptn-missing .bptn-note', 'Đã gọi cư dân xác nhận vị trí');
  await pp.click('#bptn-missing >> button:has-text("Lưu và xử lý tiếp")');
  let t = await statusOf(R.bptn);
  for (let i = 0; i < 40 && t.blocker && t.blocker.code === 'MISSING_INFO'; i += 1) { await sleep(500); t = await statusOf(R.bptn); }
  check('M15', before.blocker && before.blocker.code === 'MISSING_INFO' && !(t.blocker && t.blocker.code === 'MISSING_INFO'),
    `before=${before.status}/${before.blocker && before.blocker.code} after=${t.status}/${t.blocker && t.blocker.code}`);
});
check('JS', p.errors.length === 0, `BPTN page errors=${JSON.stringify(p.errors)}`);
await p.ctx.close();

const k = await open('kho01');
await block('M16', async () => {
  const { page: kp } = k;
  await kp.waitForSelector('#staff-tabs [data-tab="stock"]');
  await kp.click('#staff-tabs [data-tab="stock"]');
  await kp.waitForSelector('#kho-stock li');
  const stock = await ok('kho01', 'GET', '/mo/warehouse/stock');
  const shownRows = await kp.$$eval('#kho-stock li', (n) => n.length);
  const item = stock.find((s) => s.qty != null) || stock[0];
  // Q37: the receipt form lives on the "Nhập vật tư" tile, no longer on "Tồn kho"
  await kp.click('#staff-tabs [data-tab="receive"]');
  await kp.waitForSelector('#kho-receive');
  await kp.selectOption('#kho-item', item.item_code);
  await kp.fill('#kho-qty', '1');
  await kp.click('#kho-receive >> button:has-text("Nhập kho")');
  let now = item.qty;
  for (let i = 0; i < 40 && now === item.qty; i += 1) { await sleep(500); now = (await ok('kho01', 'GET', '/mo/warehouse/stock')).find((s) => s.item_code === item.item_code).qty; }
  await shot(kp, 'm16-kho-stock');
  check('M16', shownRows === stock.length && now === (item.qty ?? 0) + 1, `stock rows ${shownRows}/${stock.length}, ${item.item_code} ${item.qty} → ${now}`);
});
check('JS', k.errors.length === 0, `warehouse page errors=${JSON.stringify(k.errors)}`);
await k.ctx.close();

const w = await open('qa01');
await block('M12', async () => {
  await w.page.waitForSelector('#web-only');
  await sleep(1000);
  const data = w.requests.filter((r) => /\/api\/v1\/(resident|bql|mo)\//.test(r.url)).length;
  check('M12', w.page.url().endsWith('#/web') && data === 0, `hash=${new URL(w.page.url()).hash} data requests=${data}`);
  await shot(w.page, 'm12-web-only');
});
await w.ctx.close();
await browser.close();

console.log(`RESULT: ${failures === 0 ? 'ALL PASS' : `${failures} FAIL`}`);
process.exit(failures ? 1 : 0);
