import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('portal/package.json'));
const { chromium, expect } = require('@playwright/test');
const base = process.cwd(), WEB = 'http://127.0.0.1:3020', BACK = 'http://127.0.0.1:8020';
const env = { ...process.env, PYTHONUTF8: '1', LLM_MODE: 'mock', MO_STORE: 'memory', MO_PHOTO_STORE: 'local', MO_JOBS_ENABLED: 'false', BACKEND_URL: BACK, SESSION_COOKIE_SECURE: 'false' };
delete env.DATABASE_URL;
let backend, portal, browser; let checks = 0;
const pass = name => { checks++; console.log('PASS ' + name); };
function python() { return spawn(path.resolve('.uv-cache/archive-v0/BXEzUP3XJacXNbwB/Scripts/python.exe'), ['-m', 'uvicorn', 'src.main:app', '--host', '127.0.0.1', '--port', '8020'], { cwd: base, env, stdio: 'ignore', windowsHide: true }); }
function next() { return spawn(process.execPath, [path.resolve('portal/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3020'], { cwd: path.resolve('portal'), env, stdio: 'ignore', windowsHide: true }); }
async function ready(url) { for (let i = 0; i < 50; i++) { try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).status === 200) return; } catch {} await new Promise(r => setTimeout(r, 300)); } throw new Error('server did not start: ' + url); }
async function stop(child) { if (!child || child.exitCode !== null) return; const exit = once(child, 'exit'); child.kill(); await exit; }
try {
  backend = python(); await ready(BACK + '/health'); portal = next(); await ready(WEB + '/login'); pass('isolated Python and production portal start without DATABASE_URL');
  browser = await chromium.launch(); const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(WEB + '/login'); await page.getByText('Tài khoản demo backend', { exact: false }).waitFor(); await page.locator('#user').fill('cudan01'); await page.locator('#pass').fill('Demo@2026'); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL(WEB + '/resident'); await page.getByLabel('Tìm ticket').waitFor(); pass('Python-only account signs in on portal with no portal DB');
  const cookie = (await context.cookies()).find(c => c.name === 'python_portal_session'); assert(cookie?.httpOnly);
  await stop(portal); portal = next(); await ready(WEB + '/login'); await page.goto(WEB + '/resident'); await page.getByLabel('Tìm ticket').waitFor(); assert.equal(page.url(), WEB + '/resident'); pass('portal restart preserves valid Python session');
  await stop(backend); backend = python(); await ready(BACK + '/health'); await page.goto(WEB + '/resident'); await page.waitForURL(WEB + '/login'); await expect(page.getByLabel('Tên đăng nhập')).toBeVisible(); pass('Python restart invalidates session and portal redirects to login');
  assert.equal((await context.request.get(WEB + '/api/backend-photos/resident/SIM-TKT-CLN-001/missing')).status(), 401); pass('photo BFF denies old cookie after Python restart');
  console.log(`RESULT ${checks} passed, 0 failed, 0 skipped`);
} catch (e) { console.error('FAIL', e.message); console.log(`RESULT ${checks} passed, 1 failed, 0 skipped`); process.exitCode = 1; }
finally { if (browser) await browser.close(); await stop(portal); await stop(backend); }
