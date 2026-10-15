/**
 * Plan 26 production check: every portal role logs in twice and stays on its screen (no bounce back to /login) and
 * no backend call answers 401. Read only: it opens screens, never clicks an action. Exit 1 when any check fails.
 * Run from portal/:  npx tsx ../planning/26_2026-10-15_signed-login-tokens/evidence/prod-login-check.mts
 */
import { createRequire } from "node:module";

const require = createRequire("D:/P151/portal/package.json");
const { chromium } = require("@playwright/test") as typeof import("@playwright/test");

const BASE = "https://p151-portal.vercel.app";
const USERS = ["quanly", "tiepnhan", "kythuat", "vesinh", "kho", "cudan"];
let failed = 0;
const browser = await chromium.launch();
for (const user of USERS) {
  for (const round of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const bad: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 401 || r.status() >= 500) bad.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill("#user", user);
    await page.fill("#pass", "123456");
    const t = Date.now();
    await page.click("button[type=submit]");
    let ok = true;
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
      await page.waitForFunction(() => document.body.innerText.length > 150, undefined, { timeout: 60000 });
      await page.waitForTimeout(4000); // the bounce happened ~1 s after the content: wait past it
    } catch {
      ok = false;
    }
    const path = new URL(page.url()).pathname;
    ok = ok && !path.startsWith("/login") && bad.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${user} #${round}  ${path}  ${Date.now() - t} ms  ${bad.join(", ")}`);
    await context.close();
  }
}
await browser.close();
console.log(`SUMMARY ${USERS.length * 2 - failed}/${USERS.length * 2} PASS`);
process.exit(failed ? 1 : 0);
