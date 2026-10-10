// Q42: department picks materials with NO Agent suggestion shown or pre-filled. Usage: node q42.mjs <base> <portal-dir>
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
const tecOff = await routedTicket(`Đèn sảnh thang máy tầng 7 tòa S2 không sáng. (${RUN}-o)`, 'kythuat01');
const clnNone = await routedTicket(`Hành lang tầng 4 tòa S1 nhiều rác, cần vệ sinh. (${RUN}-n)`, 'vesinh01');
const clnPick = await routedTicket(`Sảnh thang máy tầng 6 tòa S2 bẩn, cần lau dọn. (${RUN}-k)`, 'vesinh01');
console.log(`setup (Agent plan in engine) tec=${tec} ${await lines('kythuat01', tec)} tecOff=${tecOff} clnNone=${clnNone} ${await lines('vesinh01', clnNone)} clnPick=${clnPick}`);

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
const toastHas = async (page, text) => !!(await page.waitForSelector(`#toast:has-text("${text}")`, { timeout: 8000 }).catch(() => null));

// T1 technical: no suggestion, empty row; empty save refused; LAMP-01 ×1 (= norm) saves without a reason
{
  const { ctx, page, posts } = await open('kythuat01', tec);
  const text = await page.textContent('#dept-materials');
  check('T1-no-agent', !/Agent|đề xuất/i.test(text), `khối vật tư không nhắc Agent/đề xuất: "${text.replace(/\s+/g, ' ').slice(0, 90)}"`);
  const rows = await page.$$eval('#dept-material-rows select', (ss) => ss.map((x) => x.value));
  check('T1-empty', rows.length === 1 && rows[0] === '', `dòng = ${JSON.stringify(rows)} (engine có ${await lines('kythuat01', tec)})`);
  check('T1-options', (await optionsOf(page)).join() === 'SIM-MAT-LAMP-01,SIM-MAT-LAMP-02,SIM-MAT-STARTER-01', (await optionsOf(page)).join());
  check('T1-precheck-red', await page.locator('#dept-precheck .chk:not(.ok):has-text("Đã chọn vật tư sử dụng")').count() === 1, 'chưa chọn ⇒ điều kiện vật tư đỏ');
  await page.click('#dept-material-save');
  check('T1-empty-refused', (await toastHas(page, 'Chọn ít nhất một vật tư')) && !posts.some((p) => p.includes('/material')), `POST: ${posts.filter((p) => p.includes('/material')).join(',') || 'không'}`);
  await page.selectOption('#dept-material-rows select', 'SIM-MAT-LAMP-01');
  await page.fill('#dept-material-rows input.qty', '1');
  await page.click('#dept-material-save');
  await page.waitForSelector('#dept-materials .pill:has-text("Đã lưu")');
  const got = await lines('kythuat01', tec);
  check('T1-saved', got === 'SIM-MAT-LAMP-01:1/1/1' && posts.some((p) => p.endsWith('/material-plan')), `${got}`);
  check('T1-precheck-green', await page.locator('#dept-precheck .chk.ok:has-text("Đã chọn vật tư sử dụng")').count() === 1, 'đã chọn ⇒ xanh');
  check('T1-shows-choice', (await page.inputValue('#dept-material-rows select')) === 'SIM-MAT-LAMP-01', 'tải lại hiện lựa chọn của phòng ban');
  await ctx.close();
}
// T1c off-norm quantity: reason asked after the plan, nothing issued; then saved with the reason
{
  const { ctx, page } = await open('kythuat01', tecOff);
  await page.selectOption('#dept-material-rows select', 'SIM-MAT-LAMP-01');
  await page.fill('#dept-material-rows input.qty', '3');
  await page.click('#dept-material-save');
  const asked = await toastHas(page, 'Khác định mức');
  const mid = await lines('kythuat01', tecOff);
  check('T1c-reason-asked', asked && mid === 'SIM-MAT-LAMP-01:3/null/null', `toast=${asked} lines=${mid}`);
  await page.fill('#dept-material-reason', 'Thay cả 3 bóng hỏng');
  await page.click('#dept-material-save');
  await page.waitForSelector('#dept-materials .pill:has-text("Đã lưu")');
  const c = await ok('kythuat01', 'GET', `/mo/tickets/${tecOff}`);
  const l = c.material_lines[0];
  check('T1c-saved', c.material_lines.length === 1 && l.used_qty === 3 && l.issued_qty === 3 && l.variance_reason === 'Thay cả 3 bóng hỏng', `${l.item_code} ${l.issued_qty}/${l.used_qty} "${l.variance_reason}"`);
  await ctx.close();
}
// T2 cleaning: "Không sử dụng vật tư"
{
  const { ctx, page } = await open('vesinh01', clnNone);
  check('T2-options', (await optionsOf(page)).join() === 'SIM-MAT-BAG-01,SIM-MAT-CLEAN-01', (await optionsOf(page)).join());
  check('T2-empty', (await page.inputValue('#dept-material-rows select')) === '', 'không điền sẵn CLEAN-01 của Agent');
  await page.check('#dept-no-material');
  await page.click('#dept-material-save');
  await page.waitForSelector('#dept-materials .pill:has-text("Đã lưu")');
  const c = await ok('vesinh01', 'GET', `/mo/tickets/${clnNone}`);
  check('T2-saved', c.material_lines.length === 0 && c.draft.material_requirement_mode === 'N_A', `lines=${c.material_lines.length} mode=${c.draft.material_requirement_mode}`);
  check('T2-still-ticked', await page.isChecked('#dept-no-material'), 'tải lại vẫn tick');
  await ctx.close();
}
// T3 cleaning picks bags ×2 (= norm)
{
  const { ctx, page } = await open('vesinh01', clnPick);
  await page.selectOption('#dept-material-rows select', 'SIM-MAT-BAG-01');
  await page.fill('#dept-material-rows input.qty', '2');
  await page.click('#dept-material-save');
  await page.waitForSelector('#dept-materials .pill:has-text("Đã lưu")');
  const got = await lines('vesinh01', clnPick);
  check('T3-saved', got === 'SIM-MAT-BAG-01:2/2/2', got);
  await ctx.close();
}
// T4 the technical ticket completes with the department's choice
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
