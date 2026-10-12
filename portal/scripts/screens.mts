/**
 * Screenshots of every tab of every role for the design comparison (TESTING-ACCEPTANCE §1, gate G5).
 * Usage: npm run screenshots -- [role ...] [--base=http://localhost:3000] [--out=dir]
 * Needs a running app with the seeded demo data.
 * Also fails (exit 1) when a page scrolls horizontally (HANDOFF: only tables may scroll sideways).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const BASE = arg("base", "http://localhost:3000");
const OUT = arg("out", "../planning/06_2026-10-07_resident-portal-next/evidence/screens");
const roles = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const ROLES: Record<string, { user: string; path: string }> = {
  resident: { user: "cudan", path: "/resident" },
  reception: { user: "tiepnhan", path: "/reception" },
  management: { user: "quanly", path: "/management" },
  cleaning: { user: "vesinh", path: "/cleaning" },
  technical: { user: "kythuat", path: "/technical" },
};
const WIDTHS = [1440, 390];

async function login(page: Page, user: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill("#user", user);
  await page.fill("#pass", "123456");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

mkdirSync(OUT, { recursive: true });
const overflow: string[] = [];
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "vi-VN" });
    const page = await ctx.newPage();
    if (!roles.length || roles.includes("login")) {
      await page.goto(`${BASE}/login`);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: path.join(OUT, `login-${width}.png`), fullPage: true });
    }
    for (const [role, r] of Object.entries(ROLES)) {
      if (roles.length && !roles.includes(role)) continue;
      await ctx.clearCookies();
      await login(page, r.user);
      await page.waitForSelector("nav .tile");
      const tiles = page.locator("nav .tile");
      const n = await tiles.count();
      for (let i = 0; i < n; i++) {
        await tiles.nth(i).click();
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(OUT, `${role}-${i + 1}-${width}.png`), fullPage: true });
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        if (sw > width) overflow.push(`${role} tab ${i + 1} @${width}: scrollWidth ${sw}`);
      }
      console.log(`${role} @${width}: ${n} tabs`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (overflow.length) {
  console.error(["horizontal overflow:", ...overflow].join("\n"));
  process.exit(1);
}
console.log("no horizontal page overflow");
