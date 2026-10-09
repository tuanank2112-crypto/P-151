/**
 * Gate G6 (TESTING-ACCEPTANCE §3): the whole ticket flow through the real UI.
 * Usage: npm run e2e -- [--base=http://localhost:3000]
 * Needs a running app on a FRESHLY seeded database (`npm run db:seed -- --reset`): it adds one ticket and expects it to own photo id 1.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";
const OUT = "../planning/06_2026-10-07_resident-portal-next/evidence/e2e";
mkdirSync(OUT, { recursive: true });
// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const TEXT = `Rác ở hành lang chưa được thu gom, có mùi hôi (e2e ${Date.now()})`;

const step = (msg: string) => console.log(`✔ ${msg}`);
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function login(page: Page, user: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill("#user", user);
  await page.fill("#pass", "123456");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForSelector("nav .tile");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  // Guards
  await page.goto(`${BASE}/resident`);
  await page.waitForURL(/\/login$/);
  step("no session ⇒ /login");
  await page.fill("#user", "cudan");
  await page.fill("#pass", "sai-mat-khau");
  await page.click("button[type=submit]");
  await page.getByRole("alert").filter({ hasText: "Tên đăng nhập hoặc mật khẩu không đúng." }).waitFor();
  step("wrong password ⇒ generic error");

  // 1. Resident submits with a photo
  await login(page, "cudan");
  assert.equal(new URL(page.url()).pathname, "/resident");
  await page.goto(`${BASE}/management`);
  await page.waitForURL(/\/resident$/);
  step("resident opening /management ⇒ back to /resident");
  await page.waitForSelector("#draft");
  await page.fill("#draft", TEXT);
  await page.getByText("Agent nhận diện:").waitFor();
  await page.locator("input[type=file]").setInputFiles({ name: "hien-truong.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Gửi phản ánh" }).last().click();
  const done = page.getByRole("status").filter({ hasText: "Đã gửi PA-" });
  await done.waitFor();
  const code = (await done.textContent())!.match(/PA-\d{4}/)![0];
  assert.match(await done.textContent() ?? "", /Phòng vệ sinh/);
  await shot(page, "1-resident-submitted");
  step(`resident submitted ${code} with a photo, Agent ⇒ Phòng vệ sinh`);

  // 2. Reception routes it
  await login(page, "tiepnhan");
  const cardOf = (c: string) => page.locator("article").filter({ has: page.getByText(c, { exact: true }) });
  const card = cardOf(code);
  await card.getByRole("button", { name: "Phòng vệ sinh (gợi ý)" }).click();
  await card.waitFor({ state: "detached" });
  await page.locator("nav .tile", { hasText: "Đã phân loại" }).click();
  await page.locator("tr").filter({ has: page.getByText(code, { exact: true }) }).getByText("Agent đúng").waitFor();
  await shot(page, "2-reception-routed");
  step("reception routed it (Agent đúng)");

  // Photo is private: technical cannot load it
  await login(page, "kythuat");
  const photoStatus = await page.evaluate(async () => (await fetch("/api/photos/1")).status);
  assert.equal(photoStatus, 404);
  step("technical cannot fetch a cleaning ticket photo (404)");

  // 3. Cleaning assigns and finishes
  await login(page, "vesinh");
  const job = page.locator("article").filter({ has: page.getByText(code, { exact: true }) });
  await job.getByRole("button", { name: "Tổ B" }).click();
  await job.getByText("Phụ trách: Tổ B").waitFor();
  await job.getByRole("button", { name: "Đánh dấu hoàn thành" }).click();
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Hoàn thành" }) }).getByText(code, { exact: true }).waitFor();
  await shot(page, "3-cleaning-done");
  step("cleaning assigned Tổ B and reported done");

  // 4. Resident accepts and rates 2 stars
  await login(page, "cudan");
  await page.locator("nav .tile", { hasText: "Phản ánh của tôi" }).click();
  await page.locator("button.titem", { hasText: code }).click();
  await page.getByRole("button", { name: "Xác nhận đã xử lý xong" }).click();
  await page.getByText("Đánh giá kết quả xử lý").waitFor();
  await page.getByRole("radio", { name: /^2 sao/ }).click();
  await page.getByRole("button", { name: "Chậm trễ" }).click();
  await page.fill("#rcomment", "Hai ngày mới có người dọn.");
  await page.getByRole("button", { name: "Gửi đánh giá" }).click();
  await page.getByText("ĐÁNH GIÁ CỦA BẠN").waitFor();
  await shot(page, "4-resident-rated");
  step("resident accepted and rated 2 stars");

  // 5. Management sees the low rating
  await login(page, "quanly");
  await page.locator("div.border-t").filter({ has: page.getByText(code, { exact: true }) }).getByText("Cư dân đánh giá 2 sao").waitFor();
  await shot(page, "5-management-attention");
  step("management sees it under Cần chú ý");

  // 6. Logout
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL(/\/login$/);
  step("logout ⇒ /login");
  console.log("E2E PASS");
} finally {
  await browser.close();
}
