import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('portal/package.json'));
const { chromium, expect } = require('@playwright/test');
const WEB = 'http://127.0.0.1:3018', BACK = 'http://127.0.0.1:8018';
const browser = await chromium.launch(); let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(BACK + '/app/'); await page.locator('#login-username').fill('cudan01'); await page.locator('#login-password').fill('Demo@2026'); await page.locator('#login-submit').click(); await page.waitForURL(/#\/r$/);
  const webItem = page.locator('[data-ticket]').filter({ hasText: 'E2E portal Python' }).first(); await expect(webItem).toBeVisible();
  const webId = await webItem.getAttribute('data-ticket'); assert(/^SIM-TKT-\d+$/.test(webId)); pass('app lists ticket created by web with exact string ID');
  await webItem.click(); await expect(page.locator('#resident-steps')).toBeVisible(); pass('app opens web ticket with Python progress');
  await page.goto(BACK + '/app/#/r/new'); await page.locator('#new-description').fill('Sàn sảnh thang máy bẩn, cần lau dọn E2E app to web'); await page.locator('#loc-floor').fill('6'); await page.getByRole('button', { name: 'Tòa S2', exact: true }).click(); await page.getByRole('button', { name: 'Sảnh thang máy', exact: true }).click(); await page.locator('#submit-ticket').click(); await page.waitForURL(/#\/r\/SIM-TKT-\d+$/);
  const appId = decodeURIComponent(page.url().split('/').at(-1)); pass('app creates real Python ticket');
  const webContext = await browser.newContext(); const web = await webContext.newPage(); web.on('pageerror', e => errors.push(e.message));
  await web.goto(WEB + '/login'); await web.getByText('Tài khoản demo backend', { exact: false }).waitFor(); await web.locator('#user').fill('cudan01'); await web.locator('#pass').fill('Demo@2026'); await web.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await web.waitForURL(WEB + '/resident'); await web.getByLabel('Tìm ticket').fill(appId); await web.getByRole('button', { name: 'Xem chi tiết', exact: true }).click(); await expect(web.getByRole('dialog')).toContainText('E2E app to web'); pass('web lists/opens app ticket same ID and content');
  const cookie = (await webContext.cookies()).find(c => c.name === 'python_portal_session');
  assert.equal((await webContext.request.get(WEB + '/api/photos/1')).status(), 410); pass('old integer photo route retired410');
  await webContext.setOffline(true); await web.getByRole('dialog').getByRole('button', { name: 'Tải ảnh lên' }).waitFor(); await expect(web.getByText('Đang mất kết nối mạng.', { exact: true })).toBeVisible(); pass('browser offline state visible'); await webContext.setOffline(false);
  await webContext.addCookies([{ name: cookie.name, value: 'expired-invalid-token', url: WEB }]); await web.goto(WEB + '/resident'); await web.waitForURL(WEB + '/login'); pass('invalid Python session redirects to login');
  assert.equal((await webContext.request.get(WEB + `/api/backend-photos/resident/${appId}/missing`)).status(), 401); pass('expired photo session401');
  assert.equal(errors.length, 0, errors.join(';')); pass('cross app flows zero browser JS errors');
  console.log(`RESULT ${count} passed, 0 failed, 0 skipped`);
} catch (e) { console.error('FAIL', e.message); console.log('PAGE', page.url(), (await page.locator('body').innerText()).slice(-1600)); console.log(`RESULT ${count} passed, 1 failed, 0 skipped`); process.exitCode = 1; }
finally { await browser.close(); }
