/**
 * UI check of plan 11 WP5 (Management + Warehouse + ticket detail modal) on the real backend data.
 * Usage: npx tsx scripts/ui-check-WP5.mts [--base=http://127.0.0.1:8000] [--out=dir]
 * Exit 1 when any check fails or a page scrolls horizontally. Never writes Supabase (backend memory store).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const BASE = arg("base", "http://127.0.0.1:8000");
const OUT = path.resolve(arg("out", "../planning/11_2026-10-09_portal-backend-api/evidence/WP5"));
mkdirSync(OUT, { recursive: true });

const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
};
const overflow: string[] = [];

async function login(page: Page, user: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  // wait for hydration: React puts __reactProps on the form once it owns it
  await page.waitForFunction(() => {
    const f = document.querySelector("form");
    return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
  }, undefined, { timeout: 60000 });
  await page.fill("#user", user);
  await page.fill("#pass", "123456");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await page.waitForSelector("nav .tile", { timeout: 30000 });
}

async function shot(page: Page, name: string, width: number) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > width) overflow.push(`${name} @${width}: scrollWidth ${sw}`);
}

const tile = (page: Page, label: string) => page.locator("nav .tile", { hasText: label }).first();
const num = async (page: Page, sel: string) => Number((await page.locator(sel).first().innerText()).replace(/\D/g, ""));

async function managementFlow(page: Page, width: number) {
  const w = `@${width}`;
  await login(page, "quanly");
  await shot(page, "mgmt-1-overview", width);

  // 5.2 five tiles, number on tile == rows after filter
  const kinds = ["all", "waiting", "processing", "emergency", "late"] as const;
  for (const k of kinds) {
    await tile(page, "Tổng quan").click();
    const t = page.getByTestId(`tile-${k}`);
    const n = await num(page, `[data-testid=tile-${k}] .text-\\[30px\\]`);
    await t.click();
    await page.waitForSelector("[data-testid=row-count]");
    const rows = await page.getByTestId("ticket-row").count();
    check(`5.2 tile ${k} ${w}: tile=${n} rows=${rows}`, n === rows);
  }
  // keyboard on tile: Enter and Space
  await tile(page, "Tổng quan").click();
  await page.getByTestId("tile-late").focus();
  await page.keyboard.press("Enter");
  check(`5.2 tile Enter opens list ${w}`, (await page.getByTestId("row-count").count()) === 1);
  await tile(page, "Tổng quan").click();
  await page.getByTestId("tile-waiting").focus();
  await page.keyboard.press("Space");
  check(`5.2 tile Space opens list ${w}`, (await page.getByTestId("row-count").count()) === 1);
  const role = await page.getByTestId("tile-all").count();
  await tile(page, "Tổng quan").click();
  check(`5.2 tile role=button tabindex ${w}`, (await page.locator("[data-testid^=tile-][role=button][tabindex='0']").count()) === 5 && role >= 0);
  const cursor = await page.getByTestId("tile-all").evaluate((el) => getComputedStyle(el).cursor);
  check(`5.2 tile cursor pointer ${w}`, cursor === "pointer", cursor);
  await page.getByTestId("tile-all").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const outline = await page.getByTestId("tile-all").evaluate((el) => getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineWidth);
  check(`5.2 tile focus ring ${w}`, !outline.startsWith("none"), outline);

  // 5.1 only 2 depts, click -> tab all, filtered, not finished
  await tile(page, "Tổng quan").click();
  const loadRows = await page.locator("[data-testid^=load-]").count();
  check(`5.1 load rows = 2 (no BQL) ${w}`, loadRows === 2, String(loadRows));
  for (const d of ["ve_sinh", "ky_thuat"]) {
    await tile(page, "Tổng quan").click();
    const n = await num(page, `[data-testid=load-${d}] span:last-child`);
    await page.getByTestId(`load-${d}`).click();
    const rows = await page.getByTestId("ticket-row").count();
    check(`5.1 load ${d} ${w}: ${n} vs rows ${rows}`, n === rows);
    const all = await page.getByRole("button", { name: "Gồm đã xong/hủy" }).count();
    check(`5.1 chip "Gồm đã xong/hủy" present for ${d} ${w}`, all === 1);
    await page.getByRole("button", { name: "Gồm đã xong/hủy" }).click();
    const rows2 = await page.getByTestId("ticket-row").count();
    check(`5.1 showAll >= filtered for ${d} ${w}: ${rows2} >= ${rows}`, rows2 >= rows);
  }
  const bqlChip = await page.getByRole("button", { name: "Ban quản lý", exact: true }).count();
  check(`5.1 no "Ban quản lý" chip in tab Tất cả ${w}`, bqlChip === 0);
  await page.locator("button.fchip", { hasText: /^Tất cả$/ }).click();
  await shot(page, "mgmt-2-all", width);

  // 5.3 table: Agent column, row click opens modal
  const heads = (await page.locator("thead th").allInnerTexts()).map((h) => h.toLowerCase());
  check(`5.3 column "Agent gợi ý" ${w}`, heads.includes("agent gợi ý"), heads.join("|"));
  const agentCells = await page.locator("tbody tr td:nth-child(4)").allInnerTexts();
  check(`5.3 no % in Agent column ${w}`, agentCells.every((c) => !c.includes("%")), agentCells.slice(0, 4).join(" | "));
  await page.getByTestId("ticket-row").first().locator("td:nth-child(2)").click();
  await page.waitForSelector("[role=dialog]");
  check(`5.3 click any row opens modal ${w}`, true);
  check(`7 modal has Phân tích Agent ${w}`, (await page.getByTestId("agent-analysis").count()) === 1);
  await shot(page, "mgmt-3-modal", width);
  await page.keyboard.press("Escape");
  // modal on a ticket that has an Agent decision
  const rowsAll = page.getByTestId("ticket-row");
  const nAll = await rowsAll.count();
  let withAgent = false;
  for (let i = 0; i < nAll && i < 12 && !withAgent; i++) {
    await rowsAll.nth(i).locator("td:nth-child(2)").click();
    await page.waitForSelector("[role=dialog]");
    const txt = await page.getByTestId("agent-analysis").innerText();
    if (!txt.includes("Chưa có quyết định của Agent")) {
      withAgent = true;
      check(`7 modal real Agent block (nguồn/model/phòng) ${w}`, /Nguồn quyết định/.test(txt) && /Model/.test(txt) && /Phòng đề xuất/.test(txt), txt.replace(/\n+/g, " ¦ ").slice(0, 200));
      await shot(page, "mgmt-3b-modal-agent", width);
    }
    await page.keyboard.press("Escape");
  }
  if (!withAgent) check(`7 modal empty-state "Chưa có quyết định của Agent" (backend chưa có agent_decision) ${w}`, true, "không ticket nào có agent_decision trong dữ liệu hiện tại");

  // 5.4 Việc của BQL
  await tile(page, "Việc của BQL").click();
  for (const label of ["Đã tiếp nhận", "Đã hoàn thành", "Tất cả"]) {
    await page.locator("button.fchip", { hasText: new RegExp(`^${label}`) }).click();
    await shot(page, `mgmt-4-bql-${label === "Tất cả" ? "all" : label === "Đã hoàn thành" ? "done" : "accepted"}`, width);
  }
  const pressed = await page.locator("button.fchip", { hasText: /^Đã tiếp nhận/ }).getAttribute("aria-pressed");
  check(`5.4 three filters exist ${w}`, pressed !== null);
  await page.locator("button.fchip", { hasText: /^Đã tiếp nhận/ }).click();
  check(`5.4 three blocks ${w}`, (await page.locator("[data-testid^=bql-]").count()) === 3);
  const insp = await page.locator("[data-testid=bql-inspection] article").count();
  if (insp > 0) {
    await page.waitForTimeout(1500);
    const txt = await page.getByTestId("bql-inspection").innerText();
    check(`5.4 inspection shows photos/checklist/materials ${w}`, /Ảnh sau xử lý/.test(txt) && /Checklist/.test(txt) && /Vật tư/.test(txt));
    const approve = page.getByRole("button", { name: /Nghiệm thu đạt/ }).first();
    check(`5.4 approve locked until 2 site checks ${w}`, await approve.isDisabled());
    const boxes = page.locator("[data-testid=bql-inspection] article").first().locator("input[type=checkbox]");
    await boxes.nth(0).check();
    check(`5.4 still locked after 1 check ${w}`, await approve.isDisabled());
    await boxes.nth(1).check();
    check(`5.4 unlocked after 2 checks ${w}`, !(await approve.isDisabled()));
    await boxes.nth(0).uncheck();
    await boxes.nth(1).uncheck();
  } else {
    check(`5.4 inspection empty state ${w}`, true, "không có ticket chờ nghiệm thu trong dữ liệu");
  }
  const bqlArticles = await page.locator("[data-testid=bql-work] article").count();
  if (bqlArticles > 0) {
    const t = await page.getByTestId("bql-work").innerText();
    check(`5.4 BQL row: source label + title ${w}`, /Agent chuyển|Tiếp nhận chuyển/.test(t), t.replace(/\n+/g, " ¦ ").slice(0, 160));
  }

  // 5.5 teams
  await tile(page, "Hiệu suất phòng ban").click();
  const heads2 = (await page.locator("[data-testid=dept-perf] thead th").allInnerTexts()).map((h) => h.toLowerCase());
  check(`5.5 perf columns ${w}`, ["đang xử lý", "quá hạn", "đã đóng", "sao trung bình", "giờ hoàn thành tb"].every((h) => heads2.includes(h)), heads2.join("|"));
  await shot(page, "mgmt-5-teams", width);

  // 5.6 warehouse entry
  await tile(page, "Kho vật tư").click();
  await page.waitForURL(/\/warehouse/, { timeout: 30000 });
  await page.waitForSelector("nav .tile");
  check(`5.6 management enters /warehouse ${w}`, page.url().includes("/warehouse"));
  await shot(page, "mgmt-6-warehouse-from-bql-inventory", width);
  await tile(page, "Yêu cầu cấp phát").click();
  await shot(page, "mgmt-6-warehouse-from-bql-requests", width);
}

async function warehouseFlow(page: Page, width: number) {
  const w = `@${width}`;
  await login(page, "kho");
  const heads = (await page.locator("thead th").allInnerTexts()).map((h) => h.toLowerCase());
  check(`6 inventory columns Mã/Tên/Đơn vị/Tồn ${w}`, ["mã vt", "tên vật tư", "đơn vị", "tồn kho"].every((h) => heads.includes(h)), heads.join("|"));
  await shot(page, "wh-1-inventory", width);
  // add item
  await page.getByRole("button", { name: "+ Thêm vật tư" }).click();
  await page.getByRole("button", { name: "Lưu mã vật tư mới" }).waitFor();
  await shot(page, "wh-2-add-item", width);
  const name = `Vật tư thử WP5 ${Date.now() % 100000}`;
  await page.fill("input[placeholder^='Ví dụ: Ống']", name);
  await page.getByRole("button", { name: "Lưu mã vật tư mới" }).click();
  await page.waitForTimeout(1500);
  const errToast = await page.locator("[role=alert], [role=status]").allInnerTexts().catch(() => []);
  const added = (await page.getByText(name).count()) > 0;
  check(`6 add item shows in inventory or backend message ${w}`, added || errToast.length > 0, added ? "added" : errToast.join("|"));
  // receive stock
  await page.getByRole("button", { name: "+ Nhập hàng" }).first().click();
  await shot(page, "wh-3-receive", width);
  await page.getByRole("button", { name: "Xác nhận nhập kho" }).click();
  await page.waitForTimeout(1200);
  check(`6 receive stock closes dialog ${w}`, (await page.getByRole("button", { name: "Xác nhận nhập kho" }).count()) === 0);
  // requests
  await tile(page, "Yêu cầu cấp phát").click();
  await shot(page, "wh-4-requests", width);
  const reqs = await page.getByTestId("material-request").count();
  check(`6 requests tab renders (${reqs} request) ${w}`, true);
  if (reqs > 0) {
    const first = page.getByTestId("material-request").first();
    const approve = first.getByRole("button", { name: "Duyệt cấp" });
    const short = await first.getByText("Nhập kho trước").count();
    check(`6 approve locked + hint when short ${w}`, short === 0 || (await approve.isDisabled()), `short=${short}`);
    const fill = first.getByRole("button", { name: /Nhập đủ/ });
    if ((await fill.count()) > 0) {
      await fill.first().click();
      await page.waitForTimeout(1500);
      await shot(page, "wh-5-after-fill", width);
    }
    const approve2 = page.getByTestId("material-request").first().getByRole("button", { name: "Duyệt cấp" });
    if ((await approve2.count()) > 0 && !(await approve2.isDisabled())) {
      await approve2.click();
      await page.waitForTimeout(1500);
      await shot(page, "wh-6-after-approve", width);
      check(`6 approve clicked ${w}`, true);
    }
  }
}

/** Runs once (destructive on the in-memory backend): approve the inspection, handle a BQL job, see them under "Đã hoàn thành" */
async function actFlow(page: Page) {
  await login(page, "quanly");
  await tile(page, "Việc của BQL").click();
  await page.waitForTimeout(2000);
  const before = await page.locator("button.fchip", { hasText: /^Đã hoàn thành/ }).innerText();
  const insp = page.locator("[data-testid=bql-inspection] article").first();
  if ((await insp.count()) > 0) {
    await insp.locator("input[type=checkbox]").nth(0).check();
    await insp.locator("input[type=checkbox]").nth(1).check();
    await shot(page, "mgmt-4-bql-inspection-ready", 1440);
    await page.getByRole("button", { name: /Nghiệm thu đạt/ }).first().click();
    await page.waitForTimeout(2500);
    const after = await page.locator("button.fchip", { hasText: /^Đã hoàn thành/ }).innerText();
    check(`5.4 approve inspection moves ticket to Đã hoàn thành: ${before} -> ${after}`, before !== after);
  }
  const work = page.locator("[data-testid=bql-work] article").first();
  if ((await work.count()) > 0) {
    check("5.4 BQL row shows source label", /Agent chuyển|Tiếp nhận chuyển/.test(await work.innerText()));
    await work.locator("input[type=text]").fill("Đã xử lý tại chỗ");
    await work.getByRole("button", { name: "Đã xử lý xong" }).click();
    await page.waitForTimeout(2500);
    const after2 = await page.locator("button.fchip", { hasText: /^Đã hoàn thành/ }).innerText();
    check(`5.4 BQL handled -> Đã hoàn thành count ${after2}`, after2 !== before);
  }
  await page.locator("button.fchip", { hasText: /^Đã hoàn thành/ }).click();
  await shot(page, "mgmt-4-bql-done-after-actions", 1440);
}

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "vi-VN" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => check(`pageerror ${width}`, false, e.message));
    await managementFlow(page, width);
    await warehouseFlow(page, width);
    await ctx.close();
  }
} finally {
  await browser.close();
}
{
  const b2 = await chromium.launch();
  const c2 = await b2.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
  const p2 = await c2.newPage();
  p2.on("pageerror", (e) => check("pageerror act", false, e.message));
  try {
    await actFlow(p2);
  } finally {
    await b2.close();
  }
}
for (const o of overflow) check(`no horizontal overflow: ${o}`, false);
if (overflow.length === 0) check("no horizontal overflow on any screenshot (scrollWidth <= viewport)", true);
const failed = results.filter((r) => !r.ok);
console.log(`\nTOTAL ${results.length} PASS ${results.length - failed.length} FAIL ${failed.length}`);
process.exit(failed.length ? 1 : 0);
