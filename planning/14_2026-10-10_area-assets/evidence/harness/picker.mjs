// Plan 14 G4: the BPTN asset picker (phone app and web) lists the four area assets by name, nothing per floor.
// node picker.mjs <base> <portalDir> <outDir>   (memory-store server; portal/ only lends @playwright/test)
import { createRequire } from 'node:module';
import path from 'node:path';

const [base, portalDir, outDir] = process.argv.slice(2);
const require = createRequire(path.resolve(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
const API = `${base}/api/v1`;
const EXPECTED = ['Đèn hành lang', 'Đèn sảnh thang máy', 'Đèn cầu thang bộ', 'Đèn phòng rác'];

async function login(user) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Demo@2026' }) });
  return (await r.json()).access_token;
}
const resident = await login('cudan01');
const created = await fetch(`${API}/resident/tickets`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resident}` },
  body: JSON.stringify({ original_description: 'Đèn hầm B1 tòa S1 không sáng', channel: 'form' }),
});
const { ticket_id: id } = await created.json();
const bptn = await login('bptn01');
const view = await (await fetch(`${API}/mo/tickets/${id}`, { headers: { Authorization: `Bearer ${bptn}` } })).json();
console.log(`ticket ${id}: ${view.ticket.status} / ${view.ticket.blocker && view.ticket.blocker.code}`);

const browser = await chromium.launch();
let failures = 0;
const check = (label, options) => {
  const ok = JSON.stringify(options) === JSON.stringify(EXPECTED);
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(options)}`);
};

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.goto(`${base}/app/`);
await phone.fill('#login-username', 'bptn01');
await phone.fill('#login-password', 'Demo@2026');
await phone.click('button[type="submit"]');
await phone.waitForSelector('.stats .stat');
await phone.goto(`${base}/app/#/p/${id}`);
await phone.waitForSelector('#bptn-asset select');
check('phone #bptn-asset', await phone.$$eval('#bptn-asset select option', (os) => os.filter((o) => o.value).map((o) => o.textContent)));
await phone.locator('#bptn-asset').screenshot({ path: path.join(outDir, 'phone-asset-picker.png') });

const web = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await web.addInitScript((t) => sessionStorage.setItem('mo-token', t), bptn);
await web.goto(`${base}/ui/`);
await web.waitForSelector('#app-view:not(.hidden)');
await web.evaluate((ticket) => select(ticket), id);
const webSelect = web.locator('#detail-pane form select[name="asset_id"]');
await webSelect.waitFor({ timeout: 15000 });
check('web select[name=asset_id]', await webSelect.evaluate((s) => [...s.options].filter((o) => o.value).map((o) => o.textContent)));
await web.locator('#detail-pane form', { has: web.locator('select[name="asset_id"]') }).screenshot({ path: path.join(outDir, 'web-asset-picker.png') });

await browser.close();
console.log(failures ? `FAILURES=${failures}` : 'ALL PASS');
process.exit(failures ? 1 : 0);
