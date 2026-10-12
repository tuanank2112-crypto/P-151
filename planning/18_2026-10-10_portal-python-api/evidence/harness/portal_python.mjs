import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('portal/package.json'));
const { chromium } = require('@playwright/test');
const WEB = 'http://127.0.0.1:3018', API = 'http://127.0.0.1:8018/api/v1';
const out = path.resolve('planning/18_2026-10-10_portal-python-api/evidence/browser');
const techId = process.env.E2E_TECH_ID || 'SIM-TKT-TEC-001';
let checks = 0;
const pass = (label) => { checks++; console.log(`PASS ${label}`); };
const tokens = {};
async function api(user, route, body, method = body ? 'POST' : 'GET') {
  if (!tokens[user]) {
    const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Demo@2026' }) });
    assert.equal(login.status, 200); tokens[user] = (await login.json()).access_token;
  }
  const res = await fetch(API + route, { method, headers: { Authorization: `Bearer ${tokens[user]}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const browser = await chromium.launch({ headless: true });
const errors = [];
async function login(user, role, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(WEB + '/login'); await page.getByText('Tài khoản demo backend', { exact: false }).waitFor(); await page.getByLabel('Tên đăng nhập').fill(user); await page.getByLabel('Mật khẩu', { exact: true }).fill('Demo@2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(WEB + '/' + role);
  await page.getByRole('button', { name: 'Tải lại danh sách' }).waitFor();
  return { context, page };
}
async function ticket(page, id) {
  await page.getByLabel('Tìm ticket').fill(id);
  await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().click();
  await page.getByRole('dialog').waitFor();
}
try {
  // Fixed loopback memory test server only; never point this reset at shared data.
  assert.equal((await api('qa01', '/mo/reset', {})).status, 200);
  for (const [user, role] of [['cudan01', 'resident'], ['bptn01', 'reception'], ['bql01', 'management'], ['vesinh01', 'cleaning'], ['kythuat01', 'technical'], ['kho01', 'warehouse']]) {
    for (const width of [1440, 390]) {
      const { context, page } = await login(user, role, width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); pass(`${role} ${width} login/layout`);
      const cookies = await context.cookies(); const session = cookies.find((c) => c.name === 'python_portal_session');
      assert(session?.httpOnly && session.sameSite === 'Lax');
      assert(!(await page.content()).includes(session.value)); assert(!(await page.evaluate(() => document.cookie)).includes(session.value)); pass(`${role} ${width} cookie/privacy`);
      await page.screenshot({ path: path.join(out, `${role}-${width}.png`), fullPage: true }); await context.close();
    }
  }
  const resident = await login('cudan01', 'resident');
  await resident.page.getByRole('button', { name: 'Gửi phản ánh', exact: true }).click();
  await resident.page.getByLabel('Nội dung phản ánh').fill('Đèn hành lang không sáng, cần kiểm tra E2E portal Python');
  await resident.page.getByLabel('Vị trí', { exact: true }).fill('tầng 3 tòa S1');
  await resident.page.getByRole('button', { name: 'Gửi phản ánh', exact: true }).last().click();
  const dialog = resident.page.getByRole('dialog'); await dialog.waitFor();
  const createdId = (await dialog.innerText()).match(/SIM-TKT-\d+/)?.[0]; assert(createdId); pass('web creates real string ticket ID');
  const read = await api('cudan01', '/resident/tickets/' + createdId);
  assert.equal(read.status, 200); assert(read.data.description.includes('Vị trí: tầng 3 tòa S1')); pass('Python resident API sees same web ID and location');
  assert.equal((await api('cudan02', '/resident/tickets/' + createdId)).status, 404); pass('other resident cannot read web ticket');
  await dialog.getByLabel('Chọn ảnh').setInputFiles({ name: 'scene.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOioAAAAASUVORK5CYII=', 'base64') });
  await dialog.getByRole('button', { name: 'Tải ảnh lên' }).click(); await dialog.getByRole('status').filter({ hasText: 'Đã tải ảnh' }).waitFor();
  const image = dialog.locator('img').first(); await image.waitFor(); const url = await image.getAttribute('src');
  assert.equal((await resident.context.request.get(WEB + url)).status(), 200); pass('resident photo upload/read through authenticated BFF');
  const photo = (await api('cudan01', '/resident/tickets/' + createdId)).data.photos[0];
  assert.equal((await resident.context.request.get(`${WEB}/api/backend-photos/internal/${createdId}/${photo}`)).status(), 403); pass('resident internal image scope forbidden');
  const etagResponse = await resident.context.request.get(WEB + url); const etag = etagResponse.headers()['etag']; assert(etag);
  assert.equal((await resident.context.request.get(WEB + url, { headers: { 'If-None-Match': etag } })).status(), 304); pass('photo conditional304 after authorization');
  await resident.context.close();
  const tech = await login('kythuat01', 'technical', 390);
  await ticket(tech.page, techId); await tech.page.getByRole('button', { name: 'Nhận việc', exact: true }).click();
  await tech.page.getByRole('button', { name: 'Báo hoàn thành', exact: true }).waitFor(); pass('department accepts routed Python ticket');
  assert.equal(await tech.page.getByLabel('Vật tư 1', { exact: true }).count(), 0); pass('Agent proposals not prefilled');
  await tech.page.getByRole('button', { name: '+ Thêm vật tư' }).click();
  const options = await tech.page.getByLabel('Vật tư 1', { exact: true }).locator('option').evaluateAll((nodes) => nodes.map((n) => n.value).filter(Boolean)); assert(options.length);
  const catalog = (await api('kythuat01', '/mo/catalog')).data; assert(options.every((code) => catalog.material_codes_by_department.DEPT_TECHNICAL.includes(code))); pass('material choices from department server catalog');
  const code = options[0]; await tech.page.getByLabel('Vật tư 1', { exact: true }).selectOption(code); await tech.page.getByLabel('Số lượng đã dùng 1').fill('4');
  const initialStock = (await api('kythuat01', '/mo/warehouse/stock')).data.find((s) => s.item_code === code).qty;
  if (initialStock < 4) { const setup = await api('kho01', '/mo/warehouse/stock/' + code, { qty: 20 }); assert.equal(setup.status, 200); }
  const before = (await api('kythuat01', '/mo/warehouse/stock')).data.find((s) => s.item_code === code).qty;
  let posts = 0; tech.page.on('request', (r) => { if (r.method() === 'POST' && r.headers()['next-action']) posts++; });
  await tech.page.getByRole('button', { name: 'Lưu vật tư', exact: true }).click(); await tech.page.getByRole('status').filter({ hasText: 'Đã lưu vật tư thực tế' }).waitFor(); assert.equal(posts, 1); pass('one material save click sends one request');
  const used = (await api('kythuat01', '/mo/tickets/' + techId)).data; assert.equal(used.material_lines[0].used_qty, 4); assert.equal(used.material_lines[0].issued_qty, 4);
  const after = (await api('kythuat01', '/mo/warehouse/stock')).data.find((s) => s.item_code === code).qty; assert.equal(before - after, 4); pass('usage4 norm-independent actual Python stock delta4');
  const save = tech.page.getByRole('button', { name: 'Lưu vật tư', exact: true }); assert(await save.isDisabled()); pass('saved material button stays disabled');
  await tech.page.getByLabel('Số lượng đã dùng 1').fill('999999'); await save.click(); await tech.page.getByRole('alert').filter({ hasText: /kho|tồn|vật tư/i }).first().waitFor();
  assert.equal(await tech.page.getByLabel('Số lượng đã dùng 1').inputValue(), '999999'); await tech.page.waitForTimeout(31000); assert.equal(await tech.page.getByLabel('Số lượng đã dùng 1').inputValue(), '999999'); pass('shortage rejection preserves draft after31s');
  assert.equal((await api('kythuat01', '/mo/warehouse/stock')).data.find((s) => s.item_code === code).qty, after); pass('shortage leaves stock unchanged');
  await tech.page.getByLabel('Số lượng đã dùng 1').fill('4'); await save.click(); await tech.page.getByRole('status').filter({ hasText: 'Đã lưu vật tư thực tế' }).waitFor();
  assert.equal((await api('kythuat01', '/mo/warehouse/stock')).data.find((s) => s.item_code === code).qty, after); pass('repeat usage does not debit twice');
  await tech.page.getByRole('button', { name: 'Báo hoàn thành', exact: true }).click(); await tech.page.getByRole('alert').filter({ hasText: 'Chưa đủ điều kiện' }).first().waitFor();
  assert.equal((await api('kythuat01', '/mo/tickets/' + techId)).data.ticket.status, 'IN_PROGRESS'); pass('complete200 still IN_PROGRESS reports unmet gates');
  const checkboxes = tech.page.locator('input[type=checkbox]'); for (let i = 0; i < await checkboxes.count(); i++) { await checkboxes.nth(i).click(); await require('@playwright/test').expect(checkboxes.nth(i)).toBeChecked(); }
  await tech.page.getByLabel('Chọn ảnh').setInputFiles({ name: 'done.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOioAAAAASUVORK5CYII=', 'base64') });
  await tech.page.getByRole('button', { name: 'Tải ảnh lên' }).click(); await tech.page.getByRole('status').filter({ hasText: 'Đã tải ảnh xử lý' }).waitFor();
  await tech.page.getByLabel('Ghi chú xử lý', { exact: true }).fill('Đã thay bóng và kiểm tra sáng ổn định.'); await tech.page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click(); await tech.page.getByRole('status').filter({ hasText: 'Đã lưu ghi chú' }).waitFor();
  await tech.page.getByRole('button', { name: 'Báo hoàn thành', exact: true }).click(); await tech.page.getByRole('status').filter({ hasText: 'Đã báo hoàn thành' }).first().waitFor(); pass('checklist/material/photo/note complete to READY_FOR_REVIEW');
  assert.equal(await tech.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); pass('department detail390 no horizontal overflow');
  await tech.page.screenshot({ path: path.join(out, 'technical-detail-390.png'), fullPage: true }); await tech.context.close();
  const management = await login('bql01', 'management'); await ticket(management.page, techId); await management.page.getByRole('button', { name: 'Nghiệm thu hoàn tất', exact: true }).click();
  await management.page.getByRole('status').filter({ hasText: 'Đã nghiệm thu' }).waitFor(); assert.equal((await api('bql01', '/mo/tickets/' + techId)).data.ticket.status, 'CLOSED'); pass('BQL only closes Python ticket'); await management.context.close();
  const reception = await login('bptn01', 'reception'); await ticket(reception.page, 'SIM-TKT-CLN-001'); assert(await reception.page.getByText('Ticket này không chờ BPTN xác nhận chuyển phòng ban.').isVisible()); pass('routed ticket has no reception route confirmation'); await reception.context.close();
  const warehouse = await login('kho01', 'warehouse'); await warehouse.page.getByRole('button', { name: 'Vật tư & tồn kho', exact: true }).click();
  const stockBefore = (await api('kho01', '/mo/warehouse/stock')).data.find((s) => s.item_code === code).qty;
  const form = warehouse.page.locator('form').filter({ has: warehouse.page.getByLabel('Nhập kho ' + catalog.materials.find((m) => m.item_code === code).item_name, { exact: true }) });
  await form.locator('input').fill('2'); await form.getByRole('button', { name: 'Nhập kho', exact: true }).click(); await warehouse.page.getByRole('status').filter({ hasText: 'Đã nhập kho' }).waitFor(); assert.equal((await api('kho01', '/mo/warehouse/stock')).data.find((s) => s.item_code === code).qty, stockBefore + 2); pass('warehouse receives stock through Python'); await warehouse.context.close();
  assert.equal(errors.length, 0, errors.join(';')); pass('all browser flows zero JS pageerrors');
  console.log(`RESULT ${checks} passed, 0 failed, 0 skipped`);
} catch (error) { console.error('FAIL', error.message); for (const context of browser.contexts()) for (const page of context.pages()) { console.log('PAGE', page.url(), (await page.locator('body').innerText()).slice(-2200)); await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); } console.log(`RESULT ${checks} passed, 1 failed, 0 skipped`); process.exitCode = 1; }
finally { await browser.close(); }
