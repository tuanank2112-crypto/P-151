// WP4 adversarial UI probes (plan 16 SPEC-P02 §U1-§U3): try to make web/app send 0 or 2+ POSTs, prefill the Agent
// plan, lose typed input after an error, or claim "saved" without a 200. Real Chromium on the private memory server.
// Usage: node ui_probe.mjs <base-memory-server> <portal-dir> <output-dir>   (exit 1 when any probe is BROKEN)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const [base, portalDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(path.resolve(portalDir, 'package.json'));
const { chromium } = require('@playwright/test');
const API = `${base}/api/v1`;
const RUN = `wp4-${Date.now().toString(36).slice(-5)}`;
const LAMP = 'SIM-MAT-LAMP-01';
const LAMP2 = 'SIM-MAT-LAMP-02';
const CLEAN = 'SIM-MAT-CLEAN-01';
let broken = 0;
const rec = (id, held, detail) => { if (!held) broken += 1; console.log(`${held ? 'HELD  ' : 'BROKEN'} ${id} :: ${detail}`); };

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
  const data = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}
async function started(text, user) {
  const id = (await call('cudan01', 'POST', '/resident/tickets', { original_description: `${text} (${RUN})`, channel: 'form' })).ticket_id;
  await call(user, 'POST', `/mo/tickets/${id}/accept`);
  return id;
}
const caseOf = (id) => call('bql01', 'GET', `/mo/tickets/${id}`);
const linesOf = async (id) => (await caseOf(id)).material_lines.map((l) => `${l.item_code}:${l.planned_qty}/${l.issued_qty}/${l.used_qty}`).join(',');
const stockOf = async (code) => (await call('kho01', 'GET', '/mo/warehouse/stock')).find((r) => r.item_code === code).qty;
async function restock(code, atLeast) {
  const have = await stockOf(code);
  if (have != null && have < atLeast) await call('kho01', 'POST', `/mo/warehouse/stock/${code}`, { qty: atLeast - have });
}

const SURF = {
  app: {
    viewport: { width: 390, height: 844 }, rows: '#dept-material-rows', save: '#dept-material-save', none: '#dept-no-material',
    box: '#dept-materials', saved: '#dept-materials .pill:has-text("Đã lưu")',
    async open(page, user, id) {
      await page.goto(`${base}/app/`);
      await page.fill('#login-username', user);
      await page.fill('#login-password', 'Demo@2026');
      await page.click('#login-submit');
      await page.waitForSelector('[data-updated]');
      await page.goto(`${base}/app/#/d/${id}`);
      await page.waitForSelector('#dept-materials');
    },
  },
  web: {
    viewport: { width: 1440, height: 1000 }, rows: '#web-material-rows', save: '#web-material-save', none: '#web-no-material',
    box: '#web-materials', saved: '#web-materials span:has-text("Đã lưu")',
    async open(page, user, id) {
      const t = await token(user);
      await page.addInitScript((v) => sessionStorage.setItem('mo-token', v), t);
      await page.goto(`${base}/ui/`);
      await page.waitForSelector('#app-view:not(.hidden)');
      const said = (await caseOf(id)).ticket.raw.original_description;
      await page.evaluate((ticket) => select(ticket), id);
      await page.waitForFunction((text) => {
        const pane = document.querySelector('#detail-pane');
        return pane && pane.textContent.includes(text) && pane.querySelector('#web-materials');
      }, said, { timeout: 15000 });
    },
  },
};

const browser = await chromium.launch();
async function session(kind, user, id, { stripCatalog = false } = {}) {
  const s = SURF[kind];
  const ctx = await browser.newContext({ viewport: s.viewport });
  const page = await ctx.newPage();
  const posts = [];
  const errors = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/tickets\/[^/]+\/(material|materials)/.test(r.url())) posts.push({ path: new URL(r.url()).pathname.replace(/^.*\/tickets\/[^/]+/, ''), body: r.postData() });
  });
  page.on('pageerror', (e) => errors.push(e.message));
  if (stripCatalog) {
    await page.route('**/api/v1/mo/catalog', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      delete json.material_codes_by_department;
      await route.fulfill({ response: res, json });
    });
  }
  await s.open(page, user, id);
  return { s, ctx, page, posts, errors };
}
const rowValues = (page, s) => page.$$eval(`${s.rows} > div`, (rs) => rs.map((r) => `${r.querySelector('select').value}:${r.querySelector('input').value}`));
async function setRow(page, s, code, qty) {
  const row = (await page.$$(`${s.rows} > div`))[0];
  await (await row.$('select')).selectOption(code);
  await (await row.$('input')).fill(String(qty));
}
const savedShown = async (page, s) => (await page.$(s.saved)) !== null;
const settle = (page, ms = 1500) => page.waitForTimeout(ms);

// distinct places per run: the Agent must not see this run's (or an earlier run's) tickets as duplicates
const pool = Array.from({ length: 38 }, (_, i) => i + 2).sort(() => Math.random() - 0.5);
const FLOOR = { web: [pool[0], pool[1]], app: [pool[2], pool[3]] };
for (const kind of ['web', 'app']) {
  const [fa, fb] = FLOOR[kind];
  await restock(LAMP, 8);
  const tid = await started(`Đèn sảnh thang máy tầng ${fa} tòa S2 không sáng`, 'kythuat01');
  const agent = await linesOf(tid);
  const { s, ctx, page, posts, errors } = await session(kind, 'kythuat01', tid);

  // U1 the Agent planned LAMP-01 x1: the form must not show it
  const first = await rowValues(page, s);
  const boxText = await page.textContent(s.box);
  const words = ['Đề xuất', 'đề xuất', 'định mức', 'Định mức', 'lý do', 'Lý do'].filter((w) => boxText.includes(w));
  rec(`${kind} U1 no Agent prefill`, agent.startsWith(LAMP) && first.length === 1 && first[0] === ':1' && !words.length && !(await savedShown(page, s)),
    `agent_lines=${agent} form_rows=${JSON.stringify(first)} forbidden_words=${JSON.stringify(words)}`);

  // U8 technical with no row: blocked before any POST
  await page.click(`${s.rows} > div button:has-text("Bỏ")`);
  await page.click(s.save);
  await settle(page);
  rec(`${kind} U8 technical empty blocked client-side`, posts.length === 0, `posts=${posts.length}`);
  await page.click(`${s.box} button:has-text("+ Thêm vật tư")`);

  // U11 0.5 typed: blocked before POST
  await setRow(page, s, LAMP, '0.5');
  await page.click(s.save);
  await settle(page);
  rec(`${kind} U11 qty 0.5 blocked client-side`, posts.length === 0, `posts=${posts.length} rows=${JSON.stringify(await rowValues(page, s))}`);

  // U12 DOM tamper: a foreign option injected into the select -> server must refuse (409) and nothing moves
  const stock0 = await stockOf(LAMP);
  await page.$eval(`${s.rows} > div select`, (sel, code) => { const o = document.createElement('option'); o.value = code; o.textContent = code; sel.append(o); sel.value = code; sel.dispatchEvent(new Event('change', { bubbles: true })); }, CLEAN);
  await page.fill(`${s.rows} > div input`, '1');
  await page.click(s.save);
  await settle(page, 2500);
  rec(`${kind} U12 tampered foreign option refused by server`, posts.length === 1 && (await linesOf(tid)) === agent && (await stockOf(LAMP)) === stock0 && !(await savedShown(page, s)),
    `posts=${posts.length} body=${posts[0] && posts[0].body} lines=${await linesOf(tid)}`);

  // U3 409 shortage keeps the typed rows, no "saved"; then the 30 s refresh must not wipe them either
  await setRow(page, s, LAMP2, 1);
  await page.click(s.save);
  await settle(page, 2500);
  const afterErr = await rowValues(page, s);
  rec(`${kind} U3 shortage 409 keeps input`, posts.length === 2 && afterErr[0] === `${LAMP2}:1` && !(await savedShown(page, s)) && (await linesOf(tid)) === agent,
    `posts=${posts.length} rows=${JSON.stringify(afterErr)} lines=${await linesOf(tid)}`);
  await page.click(`${s.box} b, ${s.box} h3`); // the user reads the message: focus leaves the fields
  await page.waitForTimeout(32000);
  const later = await rowValues(page, s).catch(() => ['<form gone>']);
  rec(`${kind} U3b input still kept 32 s after the error`, later[0] === `${LAMP2}:1`, `rows_after_32s=${JSON.stringify(later)}`);
  await page.screenshot({ path: path.join(outDir, `${kind}-after-error-32s.png`), fullPage: true });

  // U5 the request dies on the network: no "saved", no automatic retry, input kept
  await page.route('**/material-usage', (route) => route.abort('failed'));
  await setRow(page, s, LAMP, 4);
  const stockBefore = await stockOf(LAMP);
  await page.click(s.save);
  await settle(page, 5000);
  const kept = await rowValues(page, s);
  rec(`${kind} U5 network failure: no saved, no retry`, posts.length === 3 && !(await savedShown(page, s)) && kept[0] === `${LAMP}:4` && (await stockOf(LAMP)) === stockBefore,
    `posts=${posts.length} rows=${JSON.stringify(kept)} stock=${await stockOf(LAMP)}`);
  await page.unroute('**/material-usage');

  // U4 slow server + double click + more clicks + Enter while the first request is still in flight (no Playwright
  // actionability wait: a real user hammering the button): exactly one POST, saved only after the 200
  await page.route('**/material-usage', async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.continue(); });
  await page.dblclick(s.save);
  await page.$eval(s.save, (b) => { b.click(); b.click(); });
  await page.focus(`${s.rows} > div input`).catch(() => {});
  await page.keyboard.press('Enter');
  const inflight = posts.length - 3;
  const savedEarly = await savedShown(page, s);
  await settle(page, 5000);
  await page.unroute('**/material-usage');
  const usage = posts.slice(3);
  console.log(`       ${kind} U4 posts while the first was in flight=${inflight}`);
  rec(`${kind} U4 dblclick+click+Enter during slow save = 1 POST`, usage.length === 1 && usage[0].path === '/material-usage' && usage[0].body === `{"lines":[{"item_code":"${LAMP}","used_qty":4}]}`
    && !savedEarly && (await savedShown(page, s)) && (await stockOf(LAMP)) === stockBefore - 4 && (await linesOf(tid)) === `${LAMP}:4/4/4`,
    `posts_after=${usage.length} bodies=${JSON.stringify(usage.map((p) => p.body))} saved_before_200=${savedEarly} stock=${stockBefore}->${await stockOf(LAMP)} lines=${await linesOf(tid)}`);

  // U10 the saved selection comes back from the server and saving it again does not move stock
  const back = await rowValues(page, s);
  const s1 = await stockOf(LAMP);
  const n10 = posts.length;
  await page.click(s.save);
  await settle(page, 2500);
  rec(`${kind} U10 reopen shows saved rows; re-save = 1 POST, stock same`, back[0] === `${LAMP}:4` && posts.length === n10 + 1 && (await stockOf(LAMP)) === s1,
    `rows=${JSON.stringify(back)} posts=${posts.length} stock=${s1}->${await stockOf(LAMP)}`);

  // U6 offline: nothing is sent
  const n6 = posts.length;
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.$eval(s.save, (b) => b.click());
  await settle(page);
  rec(`${kind} U6 offline: 0 POST`, posts.length === n6, `posts_added=${posts.length - n6}`);
  await ctx.setOffline(false);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  rec(`${kind} U13 no JS error, no horizontal overflow`, errors.length === 0 && overflow <= 0, `pageerrors=${JSON.stringify(errors)} overflow_px=${overflow}`);
  await page.screenshot({ path: path.join(outDir, `${kind}-saved.png`), fullPage: true });
  await ctx.close();

  // U9 cleaning "no material": one POST with lines []
  const cid = await started(`Sảnh thang máy tầng ${fa} tòa S1 có rác, cần dọn`, 'vesinh01');
  const c = await session(kind, 'vesinh01', cid);
  await c.page.check(c.s.none);
  await c.page.click(c.s.save);
  await settle(c.page, 2500);
  const cc = await caseOf(cid);
  rec(`${kind} U9 cleaning none = 1 POST lines []`, c.posts.length === 1 && c.posts[0].body === '{"lines":[]}' && cc.draft.material_requirement_mode === 'N_A' && (await savedShown(c.page, c.s)),
    `posts=${JSON.stringify(c.posts)} mode=${cc.draft.material_requirement_mode}`);
  await c.ctx.close();

  // U7 an older server without the per-department list: save disabled, nothing sent
  const tid2 = await started(`Đèn cầu thang bộ tầng ${fb} tòa S2 không sáng`, 'kythuat01');
  const o = await session(kind, 'kythuat01', tid2, { stripCatalog: true });
  const disabled = await o.page.$eval(o.s.save, (b) => b.disabled);
  await o.page.click(o.s.save, { force: true, timeout: 3000 }).catch(() => {});
  await settle(o.page);
  const opts = await o.page.$$eval(`${o.s.rows} select option`, (os) => os.map((x) => x.value).filter(Boolean));
  rec(`${kind} U7 no mapping from server: save disabled, 0 POST, no options`, disabled && o.posts.length === 0 && opts.length === 0,
    `disabled=${disabled} posts=${o.posts.length} options=${JSON.stringify(opts)}`);
  await o.ctx.close();
}
await browser.close();
console.log(`SUMMARY run=${RUN} broken=${broken}`);
process.exit(broken ? 1 : 0);
