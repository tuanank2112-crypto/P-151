/**
 * Real-browser check of the cleaning + technical screens (plan 11 WP4, SPEC-P03 §4).
 * Usage: npx tsx scripts/ui-check-WP4.mts [cleaning|technical] [--base=http://localhost:3000] [--out=dir]
 * Needs the backend (memory) on :8000 proxying to the portal. Mutates backend demo tickets.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const BASE = arg("base", "http://localhost:3000");
const OUT = arg("out", "../planning/11_2026-10-09_portal-backend-api/evidence/WP4");
mkdirSync(OUT, { recursive: true });
const log: string[] = [];
const results: { name: string; ok: boolean }[] = [];
const say = (s: string) => {
  console.log(s);
  log.push(s);
};
async function check(name: string, fn: () => Promise<string | void>) {
  try {
    const note = (await fn()) ?? "";
    results.push({ name, ok: true });
    say(`PASS ${name} ${note}`);
  } catch (e) {
    results.push({ name, ok: false });
    say(`FAIL ${name}: ${String(e).split("\n")[0]}`);
  }
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const mem: Record<string, string> = {};

async function login(page: Page, user: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill("#user", user);
  await page.fill("#pass", "123456");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 });
  await page.waitForSelector("nav .tile", { timeout: 120000 });
}
async function shot(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > width) throw new Error(`horizontal overflow ${sw} > ${width} on ${name}`);
}
async function both(page: Page, name: string) {
  for (const w of [1440, 390]) await shot(page, name, w);
  await page.setViewportSize({ width: 1440, height: 900 });
}
const tab = (page: Page, label: string) => page.locator("nav .tile", { hasText: label }).first().click();
const routedCard = (page: Page) => page.locator("article.card", { hasText: "Đã chuyển phòng ban" }).first();

async function assignOrAccept(page: Page, shotName?: string) {
  const card = routedCard(page);
  const code = (await card.locator("button[aria-label^='Xem chi tiết']").innerText()).trim();
  const viaAssign = (await card.getByRole("button", { name: "Phân công", exact: true }).count()) > 0;
  if (viaAssign) {
    await card.getByRole("button", { name: "Phân công", exact: true }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("radio").first().click();
    if (shotName) await both(page, shotName);
    await dlg.getByRole("button", { name: "Phân công", exact: true }).click();
  } else {
    await card.getByRole("button", { name: "Nhận việc" }).click();
  }
  return { code, viaAssign };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "vi-VN" });
const page = await ctx.newPage();
const pick = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const want = (k: string) => pick.length === 0 || pick.includes(k);

try {
  if (want("cleaning")) {
    await login(page, "vesinh");
    await check("cleaning: queue renders cards, no horizontal overflow", async () => {
      await page.waitForSelector("article.card");
      const n = await page.locator("article.card").count();
      await both(page, "cleaning-queue");
      return `cards=${n}`;
    });
    await check("cleaning: code opens TicketDetailModal, Esc closes", async () => {
      await page.locator("article.card button[aria-label^='Xem chi tiết']").first().click();
      await page.waitForSelector("[role=dialog]");
      await both(page, "cleaning-detail");
      await page.keyboard.press("Escape");
      await page.waitForSelector("[role=dialog]", { state: "detached" });
    });
    await check("cleaning: ROUTED has assign-or-accept + 'Không phải việc phòng mình' (note required)", async () => {
      const card = routedCard(page);
      const a = await card.getByRole("button", { name: /^(Phân công|Nhận việc)$/ }).count();
      const r = await card.getByRole("button", { name: "Không phải việc phòng mình" }).count();
      if (!a || !r) throw new Error(`assign=${a} return=${r}`);
      await card.getByRole("button", { name: "Không phải việc phòng mình" }).click();
      const dlg = page.getByRole("dialog");
      if (!(await dlg.getByRole("button", { name: "Trả về Tiếp nhận" }).isDisabled())) throw new Error("submit enabled with empty note");
      await both(page, "cleaning-return-modal");
      await dlg.getByRole("button", { name: "Hủy" }).click();
    });
    await check("cleaning: assign/accept first ROUTED ticket -> IN_PROGRESS", async () => {
      const { code, viaAssign } = await assignOrAccept(page, "cleaning-assign-modal");
      await page.locator("article.card", { hasText: code }).getByRole("button", { name: "Đánh dấu hoàn thành" }).waitFor({ timeout: 15000 });
      mem.cleaning = code;
      return `code=${code} viaAssign=${viaAssign}`;
    });
    await check("cleaning: IN_PROGRESS buttons (hoàn thành, báo sai phòng ban)", async () => {
      const card = page.locator("article.card", { hasText: mem.cleaning });
      for (const n of ["Đánh dấu hoàn thành", "Báo sai phòng ban"]) {
        if (!(await card.getByRole("button", { name: n }).count())) throw new Error(`missing ${n}`);
      }
      await card.getByRole("button", { name: "Báo sai phòng ban" }).click();
      const dlg = page.getByRole("dialog");
      if (!(await dlg.getByRole("button", { name: "Gửi báo cáo BQL" }).isDisabled())) throw new Error("submit enabled with empty note");
      await dlg.getByRole("button", { name: "Hủy" }).click();
      await both(page, "cleaning-queue-inprogress");
    });
    await check("cleaning: finish refuses without photo (inline error), then succeeds with photo", async () => {
      const card = page.locator("article.card", { hasText: mem.cleaning });
      await card.getByRole("button", { name: "Đánh dấu hoàn thành" }).click();
      const dlg = page.getByRole("dialog");
      for (const cb of await dlg.locator("input[type=checkbox]:not([disabled])").all()) await cb.check();
      // material lines off the norm ask for a reason (backend VAL-MAT-CMP-001): fill every required one
      for (const r of await dlg.locator('input[placeholder^="Bắt buộc"]').all()) await r.fill("Theo thực tế hiện trường");
      await dlg.getByRole("button", { name: "Gửi nghiệm thu" }).click();
      const msg = await dlg.getByRole("alert").innerText();
      if (!/ảnh/i.test(msg)) throw new Error(`no photo error: ${msg}`);
      await dlg.locator("input[type=file]").setInputFiles({ name: "after.png", mimeType: "image/png", buffer: PNG });
      await both(page, "cleaning-finish-modal");
      await dlg.getByRole("button", { name: "Gửi nghiệm thu" }).click();
      await page.getByRole("dialog").waitFor({ state: "detached", timeout: 20000 }).catch(async () => {
        throw new Error(`modal still open: ${await dlg.getByRole("alert").innerText().catch(() => "")}`);
      });
      await page.locator("section", { hasText: "Hoàn thành" }).locator("article", { hasText: mem.cleaning }).waitFor({ timeout: 15000 });
    });
    await check("cleaning: history tab renders", async () => {
      await tab(page, "Lịch sử");
      await page.waitForTimeout(500);
      await both(page, "cleaning-history");
    });
  }

  if (want("technical")) {
    await login(page, "kythuat");
    await check("technical: queue renders, no horizontal overflow, no warehouse tab", async () => {
      await page.waitForSelector("article.card");
      const tabs = await page.locator("nav .tile").allInnerTexts();
      if (tabs.some((t) => /kho/i.test(t))) throw new Error(`warehouse tab present: ${tabs.join("|")}`);
      await both(page, "technical-queue");
      return `tabs=${tabs.map((t) => t.replace(/\s+/g, " ")).join("|")}`;
    });
    await check("technical: assign/accept first ROUTED ticket -> IN_PROGRESS", async () => {
      const { code, viaAssign } = await assignOrAccept(page);
      await page.locator("article.card", { hasText: code }).getByRole("button", { name: "Yêu cầu vật tư" }).waitFor({ timeout: 15000 });
      mem.tech = code;
      return `code=${code} viaAssign=${viaAssign}`;
    });
    await check("technical: request-materials modal (multi-line, +/-, custom line, required note)", async () => {
      const card = page.locator("article.card", { hasText: mem.tech });
      await card.getByRole("button", { name: "Yêu cầu vật tư" }).click();
      const dlg = page.getByRole("dialog");
      await dlg.getByRole("button", { name: "+ Thêm dòng" }).click();
      await dlg.getByRole("button", { name: "Tăng số lượng" }).first().click();
      const custom = await dlg.getByRole("button", { name: "+ Vật tư khác (ngoài danh sách)" }).count();
      if (custom) {
        await dlg.getByRole("button", { name: "+ Vật tư khác (ngoài danh sách)" }).click();
        await dlg.getByPlaceholder("Tên vật tư ngoài danh sách").fill("Ống nối thử WP4");
      }
      await dlg.getByRole("button", { name: "Gửi yêu cầu" }).click();
      const msg = await dlg.getByRole("alert").innerText();
      if (!/Ghi chú/.test(msg)) throw new Error(`no note error: ${msg}`);
      await dlg.getByLabel(/Ghi chú/).fill("Thay thế linh kiện hỏng tại hiện trường");
      await both(page, "technical-request-modal");
      await dlg.getByRole("button", { name: "Gửi yêu cầu" }).click();
      await page.getByRole("dialog").waitFor({ state: "detached", timeout: 20000 }).catch(async () => {
        throw new Error(`modal still open: ${await dlg.getByRole("alert").innerText().catch(() => "")}`);
      });
      await page.locator("article.card", { hasText: mem.tech }).getByText(/Chờ cấp trên duyệt vật tư|Chờ kho nhập hàng/).waitFor({ timeout: 15000 });
      return `customLine=${custom > 0}`;
    });
    await check("technical: material tab lists request + status", async () => {
      await tab(page, "Yêu cầu vật tư");
      await page.waitForSelector("article.card");
      await both(page, "technical-materials");
    });
    await check("technical: queue shows waiting-material card", async () => {
      await tab(page, "Hàng việc");
      await page.waitForSelector("article.card");
      await both(page, "technical-queue-after-request");
    });
    await check("technical: after approval, finish needs every 'Đã dùng <tên> — số lượng' ticked", async () => {
      const API = "http://127.0.0.1:8000/api/v1";
      const tok = async (u: string) =>
        ((await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: "123456" }) })).json()) as { access_token: string }).access_token;
      const kho = await tok("kho");
      const H = { "content-type": "application/json", Authorization: `Bearer ${kho}` };
      let r = await fetch(`${API}/mo/tickets/${mem.tech}/materials/approve`, { method: "POST", headers: H, body: "{}" });
      if (r.status === 409) {
        const stock = (await (await fetch(`${API}/mo/warehouse/stock`, { headers: H })).json()) as { item_code: string }[];
        for (const it of stock) await fetch(`${API}/mo/warehouse/stock/${it.item_code}`, { method: "POST", headers: H, body: JSON.stringify({ qty: 50 }) });
        r = await fetch(`${API}/mo/tickets/${mem.tech}/materials/approve`, { method: "POST", headers: H, body: "{}" });
      }
      if (!r.ok) throw new Error(`approve status ${r.status}: ${(await r.text()).slice(0, 200)}`);
      await tab(page, "Hàng việc");
      await page.reload();
      await page.waitForSelector("nav .tile");
      const card = page.locator("article.card", { hasText: mem.tech });
      await card.getByRole("button", { name: "Đánh dấu hoàn thành" }).click();
      const dlg = page.getByRole("dialog");
      const used = dlg.getByText(/^Đã dùng /);
      const n = await used.count();
      if (n === 0) throw new Error("no material tick rows");
      for (const cb of await dlg.locator("fieldset").first().locator("input[type=checkbox]:not([disabled])").all()) await cb.check();
      await dlg.locator("input[type=file]").setInputFiles({ name: "after.png", mimeType: "image/png", buffer: PNG });
      await dlg.getByRole("button", { name: "Gửi nghiệm thu" }).click();
      const msg = await dlg.getByRole("alert").innerText();
      if (!/vật tư/i.test(msg)) throw new Error(`no material-tick error: ${msg}`);
      await both(page, "technical-finish-modal");
      for (const cb of await dlg.locator("fieldset").nth(1).locator("input[type=checkbox]").all()) await cb.check();
      for (const f of await dlg.locator("fieldset").nth(1).locator("input[type=text], input:not([type])").all()) await f.fill("Dùng nhiều hơn định mức do hư hỏng nặng");
      await dlg.getByRole("button", { name: "Gửi nghiệm thu" }).click();
      await page.getByRole("dialog").waitFor({ state: "detached", timeout: 20000 }).catch(async () => {
        throw new Error(`modal still open: ${await dlg.getByRole("alert").innerText().catch(() => "")}`);
      });
      return `materialRows=${n}`;
    });
    await check("technical: history tab renders", async () => {
      await tab(page, "Lịch sử");
      await page.waitForTimeout(400);
      await both(page, "technical-history");
    });
  }
} finally {
  await browser.close();
  const ok = results.every((r) => r.ok);
  writeFileSync(path.join(OUT, `ui-check-${pick.join("-") || "all"}.txt`), `${log.join("\n")}\nEXIT=${ok ? 0 : 1}\n`);
  process.exitCode = ok ? 0 : 1;
}
