// record_action.mjs — quay cảnh "agent thực thi thay cư dân" (P05, Đ48).
// Tự quản lý dev server: chạy ở giờ thật (cửa nhận đăng ký đóng) rồi khởi động lại với SIM_NOW=09:00.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { spawn, execFileSync, execSync } from "node:child_process";
import path from "node:path";

const REPO = "D:/build phase";
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve("./video_action");
mkdirSync(OUT_DIR, { recursive: true });

const env = Object.fromEntries(
  readFileSync(path.join(REPO, ".env.local"), "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const RES_PW = env.SEED_RESIDENT_PASSWORD;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killPort() {
  try {
    const out = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: "utf8" });
    const pids = [...new Set(out.trim().split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
    for (const pid of pids) { try { execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" }); } catch {} }
  } catch {}
}
async function startServer(extraEnv = {}) {
  killPort();
  await sleep(1000);
  rmSync(path.join(REPO, ".next"), { recursive: true, force: true }); // G40
  const child = spawn("cmd.exe", ["/c", `npm run dev -- --port ${PORT}`], {
    cwd: REPO, env: { ...process.env, ...extraEnv }, stdio: "ignore", detached: true, windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${BASE}/login`); if (r.status === 200) return; } catch {}
    await sleep(2000);
  }
  throw new Error("dev server không lên");
}

// G40 (căn nguyên thật, đo 2026-09-23): mở /chat bằng trình duyệt ĐÚNG LÚC Next biên dịch
// route lần đầu ⇒ runtime webpack lệch chunk ⇒ "__webpack_require__.n is not a function".
// Hâm nóng route bằng request phía server (có cookie) TRƯỚC khi trình duyệt vào.
function residentCookie() {
  const out = execFileSync("node", ["--env-file=.env.local", "planning/01_2026-09-20_resident-agent-v1/evidence/h15-chat-ui/make_cookie.mjs"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return out.trim().split(/\r?\n/).pop().trim();
}
async function warmRoutes() {
  const ck = residentCookie();
  for (const p of ["/login", "/chat", "/chat/receipts"]) {
    try { const r = await fetch(BASE + p, { headers: { Cookie: ck }, redirect: "manual" }); log("warm", p, r.status); } catch (e) { log("warm fail", p, e?.message); }
  }
  await sleep(1500);
}

async function caption(page, text, sub = "") {
  await page.evaluate(([t, s]) => {
    let el = document.getElementById("__demo_caption");
    if (!el) {
      el = document.createElement("div"); el.id = "__demo_caption";
      Object.assign(el.style, { position: "fixed", left: "0", right: "0", top: "0", zIndex: "99999", pointerEvents: "none",
        background: "rgba(17,24,39,0.92)", color: "#f9fafb", padding: "14px 22px", font: "600 20px/1.35 system-ui, Segoe UI, sans-serif" });
      document.body.appendChild(el);
    }
    el.innerHTML = `<div>${t}</div>` + (s ? `<div style="font-weight:400;font-size:15px;opacity:.85;margin-top:4px">${s}</div>` : "");
  }, [text, sub]);
}
async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "resident@demo.local");
  await page.fill('input[name="password"]', RES_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/chat", { timeout: 30_000 });
  await page.waitForSelector('input[placeholder^="Hỏi về nội quy"]:not([disabled])', { timeout: 90_000 });
  await sleep(800);
}
async function ask(page, q, cap, sub) {
  await caption(page, cap, sub);
  const input = page.locator('input[placeholder^="Hỏi về nội quy"]');
  await input.click(); await input.fill(""); await input.type(q, { delay: 28 });
  await sleep(400);
  await page.click('form button[type="submit"]:has-text("Gửi")');
  const t = Date.now();
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('form button[type="submit"]')].pop(); return b && b.textContent.trim() === "Gửi"; }, null, { timeout: 150_000 });
  log(`  ↳ ${((Date.now() - t) / 1000).toFixed(1)}s`);
  const last = page.locator(".thread:not(.thread--history) > li").last();
  await last.scrollIntoViewIfNeeded();
  await sleep(3500);
  return last;
}

const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const tomorrow = new Date(Date.parse(today) + 86400e3).toISOString().slice(0, 10);

const browser = await chromium.launch({ headless: false, slowMo: 150 });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } }, locale: "vi-VN" });
const page = await context.newPage();
try {
  await warmRoutes();
  // Server hiện tại chạy giờ thật (ngoài 08:30–17:30 ⇒ cửa nhận đăng ký đóng).
  await login(page);
  await caption(page, "P05 · Agent THỰC THI thay cư dân — ra lệnh bằng chat", "Không màn thao tác từng bước: agent đọc chính sách → kiểm điều kiện → ghi → biên nhận, ở dưới");
  await sleep(3500);
  await ask(page, "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    "Ngoài giờ nhận đăng ký (08:30–17:30) — agent KHÔNG ghi bừa",
    "Đọc chính sách trước khi hành động (BB-03): 1 lời gọi policy, 0 lệnh ghi · nói đúng khi nào gửi lại · KHÔNG suy ra giờ mở cửa (BB-02)");
  await sleep(4000);
  await ask(page, "Tôi đang có chỗ nào đã đặt?", "Hỏi lại trạng thái của chính mình", "amenity.list_my_bookings — chỉ đọc, không ghi");
  await sleep(2500);

  // Chuyển đồng hồ mô phỏng: 09:00 hôm sau (trong cửa nhận đăng ký).
  await caption(page, `Chuyển đồng hồ mô phỏng sang ${tomorrow} 09:00 (SIM_NOW) — khởi động lại máy chủ`, "Cảnh này thay cho việc chờ tới sáng mai");
  await sleep(2500);
  await startServer({ SIM_NOW: `${tomorrow}T09:00:00+07:00` });
  await warmRoutes();
  // Server mới = runtime webpack mới; trình duyệt còn cache chunk cũ ⇒ __webpack_require__.n
  // is not a function (G40 — căn nguyên thật). Xoá cache và tắt cache trước khi tải lại.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await login(page);
  const done = await ask(page, "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.",
    "Trong giờ nhận đăng ký — agent ĐẶT CHỖ và trả BIÊN NHẬN",
    "policy → check_eligibility (ghi dấu precheck) → create_booking (idempotency_key) → receipts, một transaction");
  await sleep(4000);
  const steps = done.locator("details.steps summary");
  if (await steps.count()) { await steps.click(); await sleep(3000); }
  await caption(page, "Chặng 'action' trong panel — không có agent thứ 4, đây là TOOL của pipeline", "Mã biên nhận RC-… hiện trên thẻ · hoàn tác được");
  await sleep(3500);

  await ask(page, "Tôi đang có chỗ nào đã đặt?", "Xác nhận lại: chỗ vừa đặt đã có trong danh sách", "");
  await sleep(2500);

  // Trang biên nhận + hoàn tác
  await page.goto(`${BASE}/chat/receipts`);
  await page.waitForLoadState("networkidle");
  await caption(page, "Trang Biên nhận — sổ ghi mọi hành động của agent thay cư dân", "Nút Hoàn tác chỉ hiện khi hành động còn hoàn tác được và chưa bị hoàn tác");
  await sleep(4000);
  const undo = page.locator('button:has-text("Hoàn tác")').first();
  if (await undo.count()) {
    await undo.scrollIntoViewIfNeeded();
    await caption(page, "Bấm Hoàn tác = xác nhận tường minh cho lệnh không hoàn tác được", "cancel_booking (precheck get_booking_detail) → biên nhận huỷ; biên nhận gốc KHÔNG bị xoá, chỉ ghi undone_by");
    await sleep(1500);
    await undo.click();
    await sleep(4500);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await caption(page, "Sau hoàn tác: hai biên nhận, dấu vết đầy đủ", "Huỷ KHÔNG hoàn tác được (slot có thể bị người khác lấy) — đặt lại là hành động mới");
    await sleep(5000);
  } else {
    await caption(page, "⚠️ Không thấy nút Hoàn tác", "");
    await sleep(3000);
  }
  await caption(page, "Hết cảnh P05 — agent hành động đúng luật, có biên nhận, có hoàn tác", "Số đo: demo_2339.mjs exit 0 · 236 test · G19–G22 local ✅");
  await sleep(4000);
} catch (err) {
  log("LỖI:", err?.message ?? err);
  try { await caption(page, "⚠️ Lỗi: " + String(err?.message ?? err).slice(0, 140)); } catch {}
  await sleep(2500);
} finally {
  const video = page.video();
  await context.close(); await browser.close();
  const webm = await video.path();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const mp4 = path.join(REPO, "presentation", `video_demo_agent_action_${stamp}.mp4`);
  try { execFileSync("ffmpeg", ["-y", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", mp4], { stdio: "ignore" }); log("MP4:", mp4); } catch (e) { log("ffmpeg lỗi", e?.message); }
  // Khôi phục server về giờ thật cho các việc sau
  try { await startServer({}); log("server khôi phục giờ thật"); } catch (e) { log("không khởi động lại được server:", e?.message); }
}
