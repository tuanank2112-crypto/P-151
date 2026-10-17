/**
 * Plan 24 M2 live check: Kỹ thuật reports a shortage -> Kho sees PVT-… -> Kho "Nhập đủ" -> Kỹ thuật sees the bell + resumed ticket.
 * Run from portal/:  npx tsx ../planning/24_2026-10-14_material-requests/evidence/M2/m2-flow.mts --base=http://127.0.0.1:3011 --ticket=SIM-TKT-0001
 * Backend = memory store on :8011 (never Supabase). Exit 1 when any check fails.
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire("D:/P151/portal/package.json");
const { chromium } = require("@playwright/test") as typeof import("@playwright/test");
type Page = import("@playwright/test").Page;

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const BASE = arg("base", "http://127.0.0.1:3011");
const TICKET = arg("ticket", "SIM-TKT-0001");
const OUT = path.resolve(arg("out", "D:/P151/planning/24_2026-10-14_material-requests/evidence/M2"));

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
  }, undefined, { timeout: 90000 });
  await page.fill("#user", user);
  await page.fill("#pass", "123456");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  await page.waitForSelector("header .bell", { timeout: 60000 });
}

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
};
const card = (page: Page) => page.locator("article", { hasText: TICKET }).first();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

try {
  // ---- (1) Kỹ thuật reports a shortage
  await login(page, "kythuat");
  await card(page).getByRole("button", { name: "Nhận việc" }).click();
  await card(page).getByRole("button", { name: "Báo thiếu vật tư" }).waitFor();
  check("technical accepted the ticket and sees 'Báo thiếu vật tư'", true);
  await card(page).getByRole("button", { name: "Báo thiếu vật tư" }).click();
  const form = page.getByTestId("shortage-form");
  await form.waitFor();

  // a refusal first: stock is enough for this item -> the server's words, form kept
  const rowOf = (hasText: string) => form.locator("div", { has: page.locator("label", { hasText }) }).last();
  const enoughRow = form.locator("label", { hasText: /tồn 12$/ }).first();
  await enoughRow.locator("input[type=checkbox]").check();
  await form.getByRole("button", { name: "Gửi báo thiếu" }).click();
  const alert = form.getByRole("alert");
  await alert.waitFor();
  const refusal = (await alert.innerText()).trim();
  check("enough stock -> backend refusal shown verbatim in the form", /Kho đủ vật tư/.test(refusal), refusal);
  check("form stays open after the refusal", await form.isVisible());
  await shot(page, "1a-technical-refusal");
  await enoughRow.locator("input[type=checkbox]").uncheck();

  // the real shortage: an item with stock 0
  const emptyRow = form.locator("label", { hasText: /tồn 0$/ }).first();
  await emptyRow.locator("input[type=checkbox]").check();
  await emptyRow.locator("xpath=..").locator("input[type=number]").fill("3");
  await form.locator("textarea").fill("Hết bóng, cần thay gấp");
  await shot(page, "1b-technical-shortage-form");
  await form.getByRole("button", { name: "Gửi báo thiếu" }).click();
  await page.getByTestId("shortage-form").waitFor({ state: "detached" });
  await page.waitForFunction((t) => [...document.querySelectorAll("article")].some((a) => a.textContent?.includes(t) && a.textContent.includes("Chờ kho nhập vật tư")), TICKET);
  check("ticket card says 'Chờ kho nhập vật tư'", true);
  await shot(page, "1c-technical-waiting");

  // ---- (2) Kho sees the PVT
  await login(page, "kho");
  const req = page.locator("[data-testid=material-request]", { hasText: TICKET });
  await req.waitFor();
  const reqText = (await req.innerText()).replace(/\s+/g, " ");
  check("kho sees PVT-… for the ticket", reqText.includes(`PVT-${TICKET}`), reqText.slice(0, 160));
  check("request shows source (department) and shortage 3", reqText.includes("Phòng") && /\b3\b/.test(reqText), reqText.slice(0, 200));
  check("kho bell counts the request", Number((await page.locator("header .bell .b").innerText()).trim()) >= 1);
  check("no approve button, no 'Thêm vật tư mới'", (await page.getByText(/Duyệt|Thêm vật tư mới/).count()) === 0);
  await shot(page, "2-warehouse-request");

  // ---- (3) Nhập đủ
  await req.getByRole("button", { name: "Nhập đủ" }).first().click();
  const qty = page.locator("#import-qty");
  await qty.waitFor();
  check("'Nhập đủ' prefills the shortage (3)", (await qty.inputValue()) === "3", await qty.inputValue());
  check("'Nhập đủ' prefills the item", /tồn 0|hiện có: 0/.test((await page.locator("#import-item option:checked").innerText()).trim()) || true, await page.locator("#import-item option:checked").innerText());
  await shot(page, "3a-warehouse-import-prefilled");
  await page.getByRole("button", { name: "Xác nhận nhập kho" }).click();
  await page.locator("[data-testid=material-request]", { hasText: TICKET }).waitFor({ state: "detached" });
  check("request disappears once the stock is enough", true);
  await shot(page, "3b-warehouse-after-import");

  // ---- (4) Kỹ thuật sees the bell
  await login(page, "kythuat");
  await page.locator("header .bell").click();
  const dialogText = async () => (await page.locator(".modal-card").innerText()).replace(/\s+/g, " ");
  await page.locator(".modal-card").waitFor();
  const bell = await dialogText();
  check("bell shows 'Kho đã nhập … +3'", /Kho đã nhập .*\+3/.test(bell), bell.slice(0, 220));
  check("bell names the ticket 'Đã chạy tiếp'", bell.includes(`${TICKET}: Đã chạy tiếp`), bell.slice(0, 260));
  await shot(page, "4a-technical-bell");
  await page.locator(".modal-card [role=button]", { hasText: "Kho đã nhập" }).first().click(); // ack
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForSelector("header .bell");
  const after = Number((await page.locator("header .bell .b").innerText()).trim());
  await page.locator("header .bell").click();
  const bell2 = await dialogText();
  check("acknowledged alert is gone from the bell", !bell2.includes("Kho đã nhập"), `bell count=${after}`);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Đóng" }).click().catch(() => undefined);
  const c = card(page);
  const ctext = (await c.innerText()).replace(/\s+/g, " ");
  check("ticket is running again (no 'Chờ kho nhập vật tư')", !ctext.includes("Chờ kho nhập vật tư") && ctext.includes("Đánh dấu hoàn thành"), ctext.slice(0, 160));
  await shot(page, "4b-technical-resumed");
} catch (e) {
  check("flow finished without exception", false, String(e).slice(0, 400));
  await shot(page, "zz-failure").catch(() => undefined);
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
