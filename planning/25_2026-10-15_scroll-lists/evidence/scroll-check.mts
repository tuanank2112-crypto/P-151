/**
 * Plan 25 check: with ~60 tickets, every long list scrolls inside its own box and the page itself stays short, on a
 * desktop and on a phone width. Exit 1 when any check fails.
 * Run from portal/:  npx tsx ../planning/25_2026-10-15_scroll-lists/evidence/scroll-check.mts --base=http://localhost:3012
 * Backend = memory store on :8012 (never Supabase), tickets created beforehand by the QA route.
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire("D:/P151/portal/package.json");
const { chromium } = require("@playwright/test") as typeof import("@playwright/test");
type Page = import("@playwright/test").Page;

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const BASE = arg("base", "http://localhost:3012");
const OUT = path.resolve(arg("out", "D:/P151/planning/25_2026-10-15_scroll-lists/evidence"));
const BREAK = arg("break", "0") === "1"; // negative control: switch the scroll boxes off in the page, every check must fail
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
};

async function login(page: Page, user: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const f = document.querySelector("form");
    return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
  }, undefined, { timeout: 120000 });
  await page.fill("#user", user);
  await page.fill("#pass", "123456");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/** Page height and the biggest scroll box: [pageHeight, viewportHeight, boxes[{client, scroll}]] */
const measure = (page: Page) =>
  page.evaluate(`(() => {
    const boxes = [...document.querySelectorAll(".scroll-list")].map((el) => ({ client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY }));
    return { page: document.scrollingElement.scrollHeight, view: window.innerHeight, boxes };
  })()`) as Promise<{ page: number; view: number; boxes: { client: number; scroll: number; overflow: string }[] }>;

async function screen(page: Page, user: string, label: string, open?: (p: Page) => Promise<void>) {
  await login(page, user);
  if (open) await open(page);
  if (BREAK) await page.addStyleTag({ content: ".scroll-list{max-height:none!important;overflow:visible!important}" });
  await page.waitForTimeout(600);
  const m = await measure(page);
  const scrolling = m.boxes.filter((b) => b.scroll > b.client + 4);
  const width = (await page.evaluate("window.innerWidth")) as number;
  const tag = width >= 768 ? "desktop" : "phone";
  await page.screenshot({ path: path.join(OUT, `${tag}-${label}.png`), fullPage: true });
  check(`${tag} ${label}: at least one list scrolls inside its box`, scrolling.length > 0, JSON.stringify(m.boxes));
  check(`${tag} ${label}: no box taller than 760px`, m.boxes.every((b) => b.client <= 762), JSON.stringify(m.boxes.map((b) => b.client)));
  check(`${tag} ${label}: page stays short (≤ 2.6 × viewport)`, m.page <= m.view * 2.6, `page=${m.page} view=${m.view}`);
  return m;
}

const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await (await browser.newContext({ viewport })).newPage();
    await screen(page, "kythuat", "technical-board");
    await screen(page, "vesinh", "cleaning-board");
    await screen(page, "tiepnhan", "reception-done", async (p) => {
      await p.getByRole("button", { name: /Đã phân loại/ }).first().click();
    });
    await screen(page, "quanly", "bql-list", async (p) => {
      await p.getByRole("button", { name: /Danh sách ticket/ }).first().click();
      await p.getByRole("button", { name: /Đang xử lý \d+/ }).first().click();  // the biggest status group
    });
    await page.context().close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`SUMMARY ${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
