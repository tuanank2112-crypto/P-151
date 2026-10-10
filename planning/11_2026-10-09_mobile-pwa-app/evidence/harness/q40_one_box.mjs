// Q40: every ticket is in ONE box per role. Usage: node q40.mjs <base> <portal-dir> [setup=1]
import { createRequire } from 'node:module';
import path from 'node:path';

const [base, portalDir, doSetup = '1'] = process.argv.slice(2);
const require = createRequire(path.resolve(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
const API = `${base}/api/v1`;
const RUN = Date.now().toString(36).slice(-4);
let failures = 0;
const check = (id, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); };

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
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function ok(user, method, p, body) {
  const r = await call(user, method, p, body);
  if (r.status >= 300) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
}
const report = async (user, text) => (await ok(user, 'POST', '/resident/tickets', { original_description: text, channel: 'form' })).ticket_id;
const DEPT_USER = { DEPT_CLEANING: 'vesinh01', DEPT_TECHNICAL: 'kythuat01' };
const smallJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
async function driveToReview(id) {
  const c0 = await ok('bql01', 'GET', `/mo/tickets/${id}`);
  const dept = DEPT_USER[c0.ticket.department_id];
  await ok(dept, 'POST', `/mo/tickets/${id}/accept`);
  const c = await ok(dept, 'GET', `/mo/tickets/${id}`);
  for (const item of c.checklist_items) await ok(dept, 'POST', `/mo/tickets/${id}/checklist/${item.template_item_id}`, { status: 'COMPLETED' });
  for (const line of c.material_lines) await ok(dept, 'POST', `/mo/tickets/${id}/materials/${line.item_code}`, { issued_qty: line.planned_qty, used_qty: line.planned_qty });
  for (const req of c.draft.evidence_requirements) {
    if (req.allowed_evidence_types.includes('PROCESSING_NOTE')) await ok(dept, 'POST', `/mo/tickets/${id}/evidence`, { requirement_id: req.requirement_id, evidence_type: 'PROCESSING_NOTE', content_or_metadata: 'Đã xử lý' });
  }
  const form = new FormData();
  form.append('files', new Blob([smallJpeg], { type: 'image/jpeg' }), 'after.jpg');
  await fetch(`${API}/mo/tickets/${id}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${await token(dept)}` }, body: form });
  await ok(dept, 'POST', `/mo/tickets/${id}/complete`);
}

if (doSetup === '1') {
  const R = {};
  R.routed = await report('cudan01', `Hành lang tầng 2 tòa S1 nhiều rác, cần vệ sinh. (${RUN}-a)`);
  R.needInfo = await report('cudan01', `Có rác để lâu bốc mùi ở chỗ số ${RUN}, nhờ dọn giúp`);
  R.closed = await report('cudan01', `Sảnh thang máy tầng 5 tòa S2 bẩn, cần lau dọn. (${RUN}-b)`);
  await driveToReview(R.closed);
  await ok('bql01', 'POST', `/bql/tickets/${R.closed}/close`, {});
  R.review = await report('cudan01', `Hành lang tầng 7 tòa S1 nhiều rác, cần vệ sinh. (${RUN}-c)`);
  await driveToReview(R.review);
  R.emergency = await report('cudan01', `Thang máy tòa S1 kẹt người bên trong, cần cứu gấp. (${RUN}-e)`);
  R.safety = await report('cudan01', `Hình như có mùi khét ở hành lang tầng 3 tòa S1. (${RUN}-s)`);
  R.dup1 = await report('cudan02', 'Hành lang tầng 4 tòa S2 nhiều rác, cần vệ sinh.');
  R.dup2 = await report('cudan01', 'Hành lang tầng 4 tòa S2 nhiều rác, cần vệ sinh.');
  R.cancel = await report('cudan01', `Hành lang tầng 8 tòa S1 có rác, cần dọn. (${RUN}-x)`);
  const cx = await call('bql01', 'POST', `/bql/tickets/${R.cancel}/cancel`, { cancel_reason: 'Thử Q40' });
  const all = await ok('bql01', 'GET', '/bql/tickets');
  const by = Object.fromEntries(all.map((r) => [r.ticket_id, `${r.status}/${(r.blocker && r.blocker.code) || '-'}`]));
  console.log('setup', JSON.stringify(Object.fromEntries(Object.entries(R).map(([k, id]) => [k, `${id} ${by[id]}`]))), `cancel→${cx.status}`);
}

const browser = await chromium.launch();
async function open(user) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/app/`);
  page.on('pageerror', (e) => check(`${user}-pageerror`, false, e.message));
  await page.waitForSelector('#login-username');
  await page.fill('#login-username', user);
  await page.fill('#login-password', 'Demo@2026');
  await page.click('#login-submit');
  await page.waitForSelector('[data-updated]');
  await page.waitForTimeout(800);
  return { ctx, page };
}
async function idsShown(page, list) {
  for (let i = 0; i < 20; i += 1) {
    const more = page.locator(`${list} button.btn.block:has-text("Xem thêm"):visible`);
    if (!(await more.count())) break;
    await more.first().click();
  }
  return page.$$eval(`${list} [data-ticket]`, (ns) => ns.map((n) => n.dataset.ticket));
}
/** boxes = [[selector, countSelector|null]]; clicks each, reads list ids and shown count, checks disjoint. */
async function role(id, user, list, boxes, expectUnion) {
  const { ctx, page } = await open(user);
  const seen = new Map();
  let total = 0;
  for (const [sel, countSel, name] of boxes) {
    await page.click(sel);
    await page.waitForTimeout(300);
    const ids = await idsShown(page, list);
    const shown = countSel ? Number((await page.textContent(countSel)) || 0) : ids.length;
    check(`${id}-${name}-count`, shown === ids.length, `ô=${shown} danh sách=${ids.length}`);
    for (const t of ids) {
      if (seen.has(t)) check(`${id}-overlap`, false, `${t} ở cả "${seen.get(t)}" và "${name}"`);
      seen.set(t, name);
    }
    total += ids.length;
  }
  check(`${id}-disjoint`, seen.size === total, `${boxes.length} ô, ${total} dòng, ${seen.size} ticket khác nhau`);
  if (expectUnion) {
    const want = await expectUnion();
    const missing = want.filter((t) => !seen.has(t));
    check(`${id}-cover`, missing.length === 0, `ticket phải có ô: ${want.length}, thiếu ${missing.length} ${missing.slice(0, 5).join(',')}`);
  }
  await ctx.close();
}

const real = (r) => !/-(CLN|TEC)-/i.test(r.ticket_id);
const TERMINAL = new Set(['CLOSED', 'MERGED', 'CANCELLED']);

await role('BPTN', 'bptn01', '#staff-list', [
  ['#staff-tabs [data-tab="queue"]', '#staff-tabs [data-count="queue"]', 'Cần xử lý'],
  ['#staff-tabs [data-tab="safety"]', '#staff-tabs [data-count="safety"]', 'An toàn B2'],
  ['#staff-tabs [data-tab="duplicate"]', '#staff-tabs [data-count="duplicate"]', 'Nghi trùng'],
  ['#staff-stats [data-tab="progress"]', '#staff-stats [data-tab="progress"] b', 'Đang xử lý'],
  ['#staff-stats [data-tab="done"]', '#staff-stats [data-tab="done"] b', 'Hoàn thành'],
], async () => (await ok('bptn01', 'GET', '/mo/tickets')).filter((r) => real(r) && (!TERMINAL.has(r.status) || r.status === 'CLOSED')).map((r) => r.ticket_id));

await role('BQL', 'bql01', '#bql-list', ['mine', 'emergency', 'overdue', 'done'].map((k) => [`#bql-tabs [data-tab="${k}"]`, `#bql-tabs [data-tab="${k}"] b`, k]));

for (const dept of ['vesinh01', 'kythuat01']) {
  await role(`DEPT-${dept}`, dept, '#staff-list', ['todo', 'doing', 'review', 'done'].map((k) => [`#staff-tabs [data-tab="${k}"]`, null, k]));
}

for (const res of ['cudan01', 'cudan02']) {
  await role(`RES-${res}`, res, '#resident-list', ['Đang xử lý', 'Chờ nghiệm thu', 'Cần bạn', 'Đã xong'].map((label) => [`.ov:has-text("${label}")`, `.ov:has-text("${label}") b`, label]),
    async () => (await ok(res, 'GET', '/resident/tickets')).map((t) => t.ticket_id));
}

await browser.close();
console.log(failures ? `FAILURES ${failures}` : 'ALL PASS');
process.exit(failures ? 1 : 0);
