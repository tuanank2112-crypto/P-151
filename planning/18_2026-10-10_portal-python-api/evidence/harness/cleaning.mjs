import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('portal/package.json'));
const { chromium, expect } = require('@playwright/test');
const WEB = 'http://127.0.0.1:3018', API = 'http://127.0.0.1:8018/api/v1';
let count = 0, browser;
const pass = name => { count++; console.log('PASS ' + name); };
try {
  // Isolated loopback memory fixture only, never shared or persisted data.
  const qaLogin = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'qa01', password: 'Demo@2026' }) });
  const qaToken = (await qaLogin.json()).access_token;
  assert.equal((await fetch(API + '/mo/reset', { method: 'POST', headers: { Authorization: 'Bearer ' + qaToken, 'Content-Type': 'application/json' }, body: '{}' })).status, 200);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(WEB + '/login'); await page.getByText('Tài khoản demo backend', { exact: false }).waitFor();
  await page.locator('#user').fill('vesinh01'); await page.locator('#pass').fill('Demo@2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(WEB + '/cleaning');
  await page.getByLabel('Tìm ticket').fill('SIM-TKT-CLN-001'); await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
  await page.getByRole('button', { name: 'Nhận việc', exact: true }).click();
  const save = page.getByRole('button', { name: 'Lưu vật tư', exact: true }); await expect(save).toBeEnabled();
  await expect(page.getByLabel('Không sử dụng vật tư', { exact: true })).toBeChecked(); pass('blank cleaning usage remains unsaved until confirmed');
  let posts = 0; page.on('request', r => { if (r.method() === 'POST' && r.headers()['next-action']) posts++; });
  await save.click(); await page.getByRole('status').filter({ hasText: 'Đã lưu vật tư thực tế' }).waitFor();
  assert.equal(posts, 1); await expect(save).toBeDisabled(); pass('cleaning empty usage saves with one click and one request');
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'vesinh01', password: 'Demo@2026' }) });
  const { access_token } = await login.json();
  const response = await fetch(API + '/mo/tickets/SIM-TKT-CLN-001', { headers: { Authorization: 'Bearer ' + access_token } });
  assert.equal(response.status, 200); const c = await response.json(); assert.deepEqual(c.material_lines, []); assert.equal(c.draft.material_requirement_mode, 'N_A'); pass('Python stores explicit N_A and clears unused proposals');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).click(); await expect(save).toBeDisabled(); pass('reopened cleaning ticket reflects server acknowledgement');
  console.log(`RESULT ${count} passed, 0 failed, 0 skipped`);
} catch (e) { console.error(e); console.log(`RESULT ${count} passed, 1 failed, 0 skipped`); process.exitCode = 1; }
finally { if (browser) await browser.close(); }
