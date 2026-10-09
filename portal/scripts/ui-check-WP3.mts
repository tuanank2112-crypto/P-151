/**
 * WP3 UI check (resident + reception) against the running backend (:8000 -> portal :3000).
 * Usage: npx tsx scripts/ui-check-WP3.mts [--base=http://127.0.0.1:8000] [--out=dir] [--explore]
 * Prints one line per check (PASS/FAIL) and exits 1 when any FAIL or a page scrolls horizontally.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const arg = (name: string, def: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const BASE = arg("base", "http://127.0.0.1:8000");
const OUT = arg("out", "../planning/11_2026-10-09_portal-backend-api/evidence/WP3");
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` | ${extra}` : ""}`);
};

async function login(page: Page, user: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill("#user", user);
  await page.fill("#pass", "123456");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

const widths = [1440, 390];
async function shot(page: Page, name: string) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${name}-${w}.png`), fullPage: true });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`no horizontal overflow ${name} @${w}`, sw <= w, `scrollWidth=${sw}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

const tab = (page: Page, label: string) => page.locator("nav .tile", { hasText: label }).first();
const toastText = async (page: Page) => (await page.locator(".toast").first().textContent({ timeout: 3000 }).catch(() => "")) ?? "";

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
  const page = await ctx.newPage();
  const stamp = Date.now().toString().slice(-6);
  const TITLE = `Kiem tra WP3 den hanh lang ${stamp}`;
  const CONTENT = `Den hanh lang chap chon khong sang, can xu ly som (${stamp}).`;

  // ================= RESIDENT =================
  await login(page, "cudan");
  await page.waitForSelector("nav .tile");
  check("resident: no 'Thong bao' tab", (await page.locator("nav .tile", { hasText: "Thông báo" }).count()) === 0);
  await shot(page, "resident-compose-empty");

  // validation
  await page.click("aside button.primary");
  check("resident: empty title blocked", (await page.locator("[role=alert]").first().textContent())?.includes("Tiêu đề") === true);
  await page.fill("#title", "abc");
  await page.fill("#draft", CONTENT);
  await page.click("aside button.primary");
  check("resident: title < 5 blocked", (await page.locator("[role=alert]").first().textContent())?.includes("Tiêu đề") === true);
  await page.fill("#title", TITLE);
  await page.fill("#draft", "ngan");
  await page.click("aside button.primary");
  check("resident: content < 10 blocked", (await page.locator("[role=alert]").first().textContent())?.includes("Nội dung") === true);
  check("resident: no urgent button / keyword prediction", (await page.locator("text=Khẩn cấp").count()) === 0);

  await page.fill("#draft", CONTENT);
  await page.locator("button.place").nth(1).click();
  await shot(page, "resident-compose-filled");
  await page.click("aside button.primary");
  await page.waitForSelector("[role=status]:has-text('Đã gửi')", { timeout: 15000 });
  const banner = (await page.locator("[role=status]").first().textContent()) ?? "";
  const newCode = banner.match(/[A-Z]+-[\w-]+/)?.[0] ?? "";
  check("resident: submit shows ticket code", newCode.length > 0, banner.slice(0, 60));
  await shot(page, "resident-submitted");

  // mine
  await tab(page, "Phản ánh của tôi").click();
  await page.waitForSelector(".titem");
  const items = await page.locator(".titem").count();
  check("resident: list has tickets", items > 0, `count=${items}`);
  const newItem = page.locator(".titem", { hasText: TITLE });
  check("resident: new ticket title in list", (await newItem.count()) === 1);
  await newItem.click();
  const detailText = (await page.locator("section.card h2").first().textContent()) ?? "";
  check("resident: detail shows title", detailText.includes(TITLE), detailText);
  check("resident: detail shows content", (await page.locator(`text=${CONTENT}`).count()) >= 1);
  check("resident: detail shows location line", (await page.locator("text=Vị trí").count()) >= 1);
  check("resident: detail shows stepper", (await page.locator("text=Tiến độ xử lý yêu cầu").count()) === 1);
  check("resident: detail shows history", (await page.locator("text=Lịch sử xử lý").count()) === 1);
  check("resident: no confirm/cancel buttons", (await page.locator("button:text-is('Xác nhận hoàn tất'), button:text-is('Chưa đạt'), button:text-is('Hủy')").count()) === 0);
  await shot(page, "resident-mine-new");

  // overview filters
  for (const f of ["Đang xử lý", "Chờ nghiệm thu", "Chờ đánh giá", "Đã xong"]) {
    await page.locator(".ov", { hasText: f }).first().click();
    await page.waitForTimeout(150);
  }
  await page.locator(".ov", { hasText: "Đã xong" }).last().click(); // untoggle
  await shot(page, "resident-mine-list");

  // needInfo ticket -> "Bổ sung"; rate ticket -> stars + tags + comment (when data exists)
  const needInfo = page.locator(".titem", { hasText: "Cần bạn bổ sung" }).first();
  if (await needInfo.count()) {
    await needInfo.click();
    const addBtn = page.locator("button:has-text('Bổ sung')");
    check("resident: needInfo shows 'Bổ sung' button", (await addBtn.count()) >= 1);
    await page.fill("#extra", `Bo sung WP3 ${stamp}`);
    await addBtn.first().click();
    await page.waitForTimeout(1500);
    check("resident: extra appears in list", (await page.locator(`text=Bo sung WP3 ${stamp}`).count()) >= 1);
    await shot(page, "resident-needinfo-extra");
  } else {
    console.log("SKIP resident needInfo flow: no NEED_INFO ticket in data");
  }
  const rate = page.locator(".titem", { hasText: "Cần bạn đánh giá" }).first();
  if (await rate.count()) {
    await rate.click();
    await page.locator("[role=radio]").nth(4).click();
    check("resident: >=4 stars shows GOOD tags", (await page.locator("button.chip:has-text('Xử lý nhanh')").count()) === 1);
    await page.locator("[role=radio]").nth(1).click();
    check("resident: <=3 stars shows BAD tags", (await page.locator("button.chip:has-text('Chậm trễ')").count()) === 1);
    check("resident: GOOD tags hidden at <=3 stars", (await page.locator("button.chip:has-text('Xử lý nhanh')").count()) === 0);
    await page.locator("button.chip:has-text('Chậm trễ')").click();
    await page.fill("#rcomment", `Danh gia WP3 ${stamp}`);
    await shot(page, "resident-rate-form");
    await page.locator("button:has-text('Gửi đánh giá')").click();
    await page.waitForTimeout(1500);
    check("resident: rating saved and shown", (await page.locator(`text=Danh gia WP3 ${stamp}`).count()) >= 1);
    await shot(page, "resident-rated");
  } else {
    console.log("SKIP resident rating flow: no ticket with canRate in data");
  }

  // ================= RECEPTION =================
  await login(page, "tiepnhan");
  await page.waitForSelector("nav .tile");
  const tabs = await page.locator("nav .tile").allTextContents();
  check("reception: exactly 3 tabs (Chờ phân loại / Đã phân loại / Hiệu suất Agent)", tabs.length === 3 && tabs[0].includes("Chờ phân loại") && tabs[1].includes("Đã phân loại") && tabs[2].includes("Hiệu suất Agent"), tabs.join(" | "));
  await shot(page, "reception-inbox");
  const cards = page.locator("article.card");
  const n = await cards.count();
  console.log(`reception inbox cards=${n}`);
  const mine = page.locator("article.card", { hasText: TITLE });
  check("reception: new resident ticket visible with title", (await mine.count()) === 1);
  if (await mine.count()) {
    const card = mine.first();
    check("reception: card shows content", (await card.locator(`text=${CONTENT}`).count()) >= 1);
    check("reception: card shows location", (await card.locator("text=Vị trí:").count()) >= 1);
    check("reception: card shows blocker label", (await card.locator(".pill.wait").count()) >= 1);
    check("reception: card has Agent block", (await card.locator("[aria-label='Quyết định của Agent'], :text('Chưa có quyết định của Agent')").count()) >= 1);
    const txt = (await card.textContent()) ?? "";
    console.log(`  card text: ${txt.slice(0, 260).replace(/\s+/g, " ")}`);
    await card.locator("button", { hasText: /^[A-Z]+-/ }).first().click();
    await page.waitForSelector("[role=dialog], .modal, [aria-modal]", { timeout: 5000 }).catch(() => {});
    await shot(page, "reception-detail-modal");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  // blocker -> button map for every card
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i);
    const label = (await c.locator(".pill.wait").first().textContent()) ?? "";
    const btns = (await c.locator("button.btn").allTextContents()).map((s) => s.trim()).join(" | ");
    console.log(`  card ${i}: [${label}] buttons: ${btns}`);
  }

  // Đã phân loại
  await tab(page, "Đã phân loại").click();
  await page.waitForSelector("table");
  const rows = page.locator("tbody tr");
  check("reception: Đã phân loại has rows", (await rows.count()) > 0, `rows=${await rows.count()}`);
  await shot(page, "reception-done");
  const firstCode = rows.first().locator("button").first();
  await firstCode.click();
  await page.waitForTimeout(1500);
  check("reception: row opens detail modal", (await page.locator("[role=dialog], [aria-modal]").count()) >= 1);
  await shot(page, "reception-done-modal");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  // click anywhere on row (not on a button)
  await rows.first().locator("td").nth(2).click();
  await page.waitForTimeout(1500);
  check("reception: click on row cell opens modal", (await page.locator("[role=dialog], [aria-modal]").count()) >= 1);
  await page.keyboard.press("Escape");

  // Hiệu suất Agent
  await tab(page, "Hiệu suất Agent").click();
  await page.waitForSelector("text=Các lần nhân viên sửa gợi ý của Agent");
  for (const l of ["Ticket đã chuyển", "Agent gợi ý đúng", "Số lần nhân viên sửa", "Chờ cư dân bổ sung"]) {
    check(`reception perf: tile '${l}'`, (await page.locator(`text=${l}`).count()) >= 1);
  }
  // counts sit next to the percentage inside the "Agent gợi ý đúng" tile (user 2026-10-10)
  const rightTile = page.locator(".card", { hasText: "Agent gợi ý đúng" }).first();
  check("reception perf: right/wrong counts beside the %", /✓\s*\d+\s*đúng/.test(await rightTile.innerText()) && /✗\s*\d+\s*sai/.test(await rightTile.innerText()));
  await shot(page, "reception-perf");

  // drive the new ticket through whatever actions the blocker offers (asset check -> route / confirm)
  await tab(page, "Chờ phân loại").click();
  let routed = false;
  for (let step = 0; step < 6 && !routed; step++) {
    const card = page.locator("article.card", { hasText: TITLE });
    if ((await card.count()) === 0) break;
    const label = (await card.first().locator(".pill.wait").first().textContent()) ?? "";
    const btns = (await card.first().locator("button.btn").allTextContents()).map((x) => x.trim());
    console.log(`  step ${step}: [${label}] buttons: ${btns.join(" | ")}`);
    await shot(page, `reception-step${step}`);
    const pick = ["Phòng kỹ thuật", "Phòng vệ sinh", "Kiểm tra tại chỗ", "Xác nhận phân loại của Agent", "Không trùng"].find((x) => btns.includes(x));
    if (!pick) break;
    await card.first().locator("button.btn", { hasText: pick }).first().click();
    await page.waitForTimeout(2500);
    routed = pick.startsWith("Phòng");
  }
  const left = (await page.locator("article.card", { hasText: TITLE }).count()) === 0;
  check("reception: ticket left inbox after the offered actions", left);
  await tab(page, "Đã phân loại").click();
  await page.waitForSelector("table");
  const inDone = await page.locator("tbody tr", { hasText: TITLE }).count();
  check("reception: that ticket now appears in Đã phân loại", inDone === 1, `rows=${inDone} routedByButton=${routed}`);
  await shot(page, "reception-after-route");
  void toastText;
} finally {
  await browser.close();
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
