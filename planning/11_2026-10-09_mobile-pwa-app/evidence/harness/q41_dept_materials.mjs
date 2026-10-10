// OBSOLETE since plan 16 (v1.10.0): expects POST material-plan + materials/{code}; the app now sends ONE POST material-usage.
// Not an acceptance gate any more — use planning/16_2026-10-10_material-guards/evidence/harness/material_usage.mjs.
// Q41: department picks the materials used in ONE block. Usage: node q41.mjs <base> <portal-dir>
import { createRequire } from 'node:module';
import path from 'node:path';

const [base, portalDir] = process.argv.slice(2);
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
async function ok(user, method, p, body) {
  const r = await fetch(API + p, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token(user)}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${method} ${p} → ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}
async function routedTicket(text, user) {
  const id = (await ok('cudan01', 'POST', '/resident/tickets', { original_description: text, channel: 'form' })).ticket_id;
  const c = await ok('bql01', 'GET', `/mo/tickets/${id}`);
  if (c.ticket.status !== 'ROUTED') throw new Error(`${id} ${c.ticket.status}/${c.ticket.blocker && c.ticket.blocker.code}`);
  await ok(user, 'POST', `/mo/tickets/${id}/accept`);
  return id;
}
const lines = async (user, id) => (await ok(user, 'GET', `/mo/tickets/${id}`)).material_lines
  .map((l) => `${l.item_code}:${l.planned_qty}/${l.issued_qty}/${l.used_qty}`).join(',');

const tec = await routedTicket(`Đèn hành lang tầng 3 tòa S1 không sáng. (${RUN}-t)`, 'kythuat01');
const tecOut = await routedTicket(`Đèn hành lang tầng 5 tòa S2 không sáng. (${RUN}-o)`, 'kythuat01');
const clnNone = await routedTicket(`Hành lang tầng 4 tòa S1 nhiều rác, cần vệ sinh. (${RUN}-n)`, 'vesinh01');
const clnKeep = await routedTicket(`Sảnh thang máy tầng 6 tòa S2 bẩn, cần lau dọn. (${RUN}-k)`, 'vesinh01');
console.log(`setup tec=${tec} ${await lines('kythuat01', tec)} clnNone=${clnNone} ${await lines('vesinh01', clnNone)} clnKeep=${clnKeep} ${await lines('vesinh01', clnKeep)}`);

const browser = await chromium.launch();
async function open(user, id) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(new URL(r.url()).pathname); });
  page.on('pageerror', (e) => check(`${user}-pageerror`, false, e.message));
  await page.goto(`${base}/app/`);
  await page.fill('#login-username', user);
  await page.fill('#login-password', 'Demo@2026');
  await page.click('#login-submit');
  await page.waitForSelector('[data-updated]');
  await page.goto(`${base}/app/#/d/${id}`);
  await page.waitForSelector('#dept-materials');
  return { ctx, page, posts };
}
const optionsOf = (page) => page.$$eval('#dept-material-rows select option', (os) => [...new Set(os.map((o) => o.value).filter(Boolean))].sort());

// T1 technical: Agent's LAMP-01 pre-filled, one block, picks STARTER-01 ×2 (stock not tracked)
{
  const { ctx, page, posts } = await open('kythuat01', tec);
  check('T1-one-block', (await page.locator('#dept-materials details').count()) === 0 && (await page.locator('text=Vật tư thực tế khác').count()) === 0, 'không còn khối "Vật tư thực tế khác đề xuất"');
  check('T1-prefill', (await page.inputValue('#dept-material-rows select')) === 'SIM-MAT-LAMP-01', `dòng 1 = ${await page.inputValue('#dept-material-rows select')}`);
  const opts = await optionsOf(page);
  check('T1-options', opts.join() === 'SIM-MAT-LAMP-01,SIM-MAT-LAMP-02,SIM-MAT-STARTER-01', opts.join());
  check('T1-no-none', (await page.locator('#dept-no-material').count()) === 0, 'Kỹ thuật không có "Không sử dụng vật tư"');
  await page.selectOption('#dept-material-rows select', 'SIM-MAT-STARTER-01');
  await page.fill('#dept-material-rows input.qty', '2');
  await page.click('#dept-material-save');
  await page.waitForTimeout(600);
  check('T1-reason-required', !posts.some((p) => p.includes('/material')), `POST khi chưa có lý do: ${posts.filter((p) => p.includes('/material')).join(',') || 'không'}`);
  await page.fill('#dept-material-reason', 'Thực tế là đèn tuýp đôi');
  await page.click('#dept-material-save');
  await page.waitForSelector('#dept-materials .pill:has-text("Đã lưu")');
  const got = await lines('kythuat01', tec);
  check('T1-saved', got === 'SIM-MAT-STARTER-01:2/2/2', got);
  await ctx.close();
}
// T1b out of stock (LAMP-02 stock 0): the engine refuses, the app says why and nothing is issued
{
  const { ctx, page } = await open('kythuat01', tecOut);
  await page.selectOption('#dept-material-rows select', 'SIM-MAT-LAMP-02');
  await page.fill('#dept-material-rows input.qty', '2');
  await page.fill('#dept-material-reason', 'Đèn tuýp');
  await page.click('#dept-material-save');
  await page.waitForSelector('#toast:has-text("Kho chỉ còn")', { timeout: 8000 }).catch(() => null);
  const toast = await page.textContent('#toast');
  const got = await lines('kythuat01', tecOut);
  check('T1b-out-of-stock', /Kho chỉ còn 0/.test(toast || '') && /\/null\/null/.test(got), `toast="${(toast || '').trim()}" lines=${got}`);
  await ctx.close();
}
// T2 cleaning: "Không sử dụng vật tư"
{
  const { ctx, page } = await open('vesinh01', clnNone);
  const opts = await optionsOf(page);
  check('T2-options', opts.join() === 'SIM-MAT-BAG-01,SIM-MAT-CLEAN-01', opts.join());
  await page.check('#dept-no-material');
  check('T2-rows-hidden', await page.locator('#dept-material-rows').isHidden(), 'ẩn dòng vật tư khi không dùng');
  await page.click('#dept-material-save');
  await page.waitForSelector('#dept-materials .pill:has-text("Đã lưu")');
  const c = await ok('vesinh01', 'GET', `/mo/tickets/${clnNone}`);
  check('T2-saved', c.material_lines.length === 0 && c.draft.material_requirement_mode === 'N_A', `lines=${c.material_lines.length} mode=${c.draft.material_requirement_mode}`);
  check('T2-precheck', await page.locator('#dept-precheck .chk.ok:has-text("Đã lưu số lượng vật tư")').count() === 1, 'điều kiện vật tư xanh');
  check('T2-still-ticked', await page.isChecked('#dept-no-material'), 'tải lại vẫn tick');
  await ctx.close();
}
// T3 cleaning keeps the Agent's plan (= norm): no reason, no material-plan
{
  const { ctx, page, posts } = await open('vesinh01', clnKeep);
  await page.click('#dept-material-save');
  await page.waitForSelector('#dept-materials .pill:has-text("Đã lưu")');
  const got = await lines('vesinh01', clnKeep);
  check('T3-saved', /^SIM-MAT-CLEAN-01:2\/2\/2$/.test(got) && !posts.some((p) => p.endsWith('/material-plan')), `${got} plan=${posts.some((p) => p.endsWith('/material-plan'))}`);
  await ctx.close();
}
// T4 readiness of T1 accepts the picked material (engine reconcile)
{
  const c = await ok('kythuat01', 'GET', `/mo/tickets/${tec}`);
  for (const item of c.checklist_items) await ok('kythuat01', 'POST', `/mo/tickets/${tec}/checklist/${item.template_item_id}`, { status: 'COMPLETED' });
  for (const req of c.draft.evidence_requirements) {
    if (req.allowed_evidence_types.includes('PROCESSING_NOTE')) await ok('kythuat01', 'POST', `/mo/tickets/${tec}/evidence`, { requirement_id: req.requirement_id, evidence_type: 'PROCESSING_NOTE', content_or_metadata: 'Đã thay đèn' });
  }
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  const form = new FormData();
  form.append('files', new Blob([jpeg], { type: 'image/jpeg' }), 'after.jpg');
  await fetch(`${API}/mo/tickets/${tec}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${await token('kythuat01')}` }, body: form });
  const done = await ok('kythuat01', 'POST', `/mo/tickets/${tec}/complete`);
  const failing = (done.draft.readiness_evaluation && done.draft.readiness_evaluation.failing_items) || [];
  check('T4-complete', done.ticket.status === 'READY_FOR_REVIEW', `${done.ticket.status} failing=${failing.join(',') || '-'}`);
}

await browser.close();
console.log(failures ? `FAILURES ${failures}` : 'ALL PASS');
process.exit(failures ? 1 : 0);
