import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('portal/package.json'));
const { chromium, expect } = require('@playwright/test');
const WEB = 'http://127.0.0.1:3018', API = 'http://127.0.0.1:8018/api/v1';
let browser, count = 0; const tokens = {}, errors = [];
const pass = name => { count++; console.log('PASS ' + name); };
async function read(user, id) {
  if (!tokens[user]) { const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Demo@2026' }) }); tokens[user] = (await r.json()).access_token; }
  const r = await fetch(API + '/mo/tickets/' + id, { headers: { Authorization: 'Bearer ' + tokens[user] } }); assert.equal(r.status, 200); return r.json();
}
async function open(user, role, id) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } }); page.on('pageerror', e => errors.push(e.message));
  await page.goto(WEB + '/login'); await page.getByText('Tài khoản demo backend', { exact: false }).waitFor();
  await page.locator('#user').fill(user); await page.locator('#pass').fill('Demo@2026'); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(WEB + '/' + role);
  await page.getByLabel('Tìm ticket').fill(id); await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).click(); await page.getByRole('dialog').waitFor(); return page;
}
try {
  // Fixed loopback memory fixture only, never shared or persisted data.
  const qa = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'qa01', password: 'Demo@2026' }) });
  const qaToken = (await qa.json()).access_token; assert.equal((await fetch(API + '/mo/reset', { method: 'POST', headers: { Authorization: 'Bearer ' + qaToken, 'Content-Type': 'application/json' }, body: '{}' })).status, 200);
  browser = await chromium.launch();
  const id = 'SIM-TKT-TEC-006', tech = await open('kythuat01', 'technical', id);
  await tech.getByRole('button', { name: 'Nhận việc', exact: true }).click(); await tech.getByText('Vướng tại hiện trường', { exact: true }).click();
  await tech.getByLabel('Lý do', { exact: true }).fill('Chờ mở cửa khu vực để thi công'); await tech.getByLabel('Dự kiến tiếp tục').fill('2026-10-11T10:00');
  await tech.getByRole('button', { name: 'Tạm hoãn', exact: true }).click(); await tech.getByRole('button', { name: 'Tiếp tục xử lý', exact: true }).waitFor();
  assert.equal((await read('kythuat01', id)).ticket.status, 'ON_HOLD'); pass('department block persists in Python');
  await tech.getByRole('button', { name: 'Tiếp tục xử lý', exact: true }).click(); await tech.getByRole('button', { name: 'Báo hoàn thành', exact: true }).waitFor(); assert.equal((await read('kythuat01', id)).ticket.status, 'IN_PROGRESS'); pass('department resumes Python work');
  const reception = await open('bptn01', 'reception', 'SIM-TKT-TEC-002');
  await reception.getByLabel('Xác định tài sản tại hiện trường', { exact: true }).check(); await reception.getByLabel('Ghi chú thẩm định').fill('Xác định tài sản trong lúc kiểm tra tại hiện trường');
  await reception.getByRole('button', { name: 'Lưu thẩm định', exact: true }).click(); await reception.getByRole('status').filter({ hasText: 'Đã thẩm định' }).waitFor();
  assert.notEqual((await read('bptn01', 'SIM-TKT-TEC-002')).ticket.blocker?.code, 'ASSET_UNCLEAR'); pass('BPTN resolves actual blocker instead of forced department confirmation');
  const bql = await open('bql01', 'management', 'SIM-TKT-TEC-005'); await expect(bql.getByRole('button', { name: 'Đã xử lý khẩn cấp', exact: true })).toBeDisabled(); pass('emergency close requires note as Python contract requires');
  await bql.getByLabel('Ghi chú Đã xử lý khẩn cấp', { exact: true }).fill('Đã liên hệ lực lượng cứu hộ và xử lý an toàn'); await bql.getByRole('button', { name: 'Đã xử lý khẩn cấp', exact: true }).click(); await bql.getByRole('status').filter({ hasText: 'Đã ghi nhận xử lý khẩn cấp' }).waitFor();
  assert.equal((await read('bql01', 'SIM-TKT-TEC-005')).ticket.status, 'CLOSED'); pass('BQL emergency close persists in Python');
  assert.equal(errors.length, 0, errors.join(';')); pass('extra action flows zero browser JS errors');
  console.log(`RESULT ${count} passed, 0 failed, 0 skipped`);
} catch (e) { console.error(e); console.log(`RESULT ${count} passed, 1 failed, 0 skipped`); process.exitCode = 1; }
finally { if (browser) await browser.close(); }
