// record_demo.mjs — quay video thao tác demo local theo presentation/demo_script.md.
// Chạy: node record_demo.mjs  (server dev đang chạy ở http://localhost:3100)
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const REPO = "D:/build phase";
const OUT_DIR = path.resolve("./video");
mkdirSync(OUT_DIR, { recursive: true });

// Đọc mật khẩu demo từ .env.local (không in ra log).
const env = Object.fromEntries(
  readFileSync(path.join(REPO, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const RES_PW = env.SEED_RESIDENT_PASSWORD;
const BQL_PW = env.SEED_BQL_PASSWORD;
if (!RES_PW || !BQL_PW) throw new Error("Thiếu SEED_*_PASSWORD trong .env.local");

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function caption(page, text, sub = "") {
  await page.evaluate(
    ([t, s]) => {
      let el = document.getElementById("__demo_caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "__demo_caption";
        Object.assign(el.style, {
          position: "fixed", left: "0", right: "0", top: "0", zIndex: "99999", pointerEvents: "none",
          background: "rgba(17,24,39,0.92)", color: "#f9fafb", padding: "14px 22px",
          font: "600 20px/1.35 system-ui, Segoe UI, sans-serif", letterSpacing: "0.2px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
        });
        document.body.appendChild(el);
      }
      el.innerHTML = `<div>${t}</div>` + (s ? `<div style="font-weight:400;font-size:15px;opacity:.85;margin-top:4px">${s}</div>` : "");
    },
    [text, sub]
  );
}

async function login(page, email, pw, expectPath) {
  await page.goto(`${BASE}/login`);
  await caption(page, `Đăng nhập: ${email}`, "Hai vai trò · hai giao diện khác nhau (R2)");
  await page.fill("#email", email);
  await page.fill('input[name="password"]', pw);
  await sleep(800);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**${expectPath}`, { timeout: 30_000 });
  await sleep(1200);
}

async function logout(page) {
  await caption(page, "Đăng xuất");
  await sleep(700);
  await page.click('form[action="/api/auth/logout"] button');
  await page.waitForURL("**/login", { timeout: 30_000 });
  await sleep(800);
}

async function ask(page, question, cap, sub, { expandSteps = false, maxMs = 150_000 } = {}) {
  await caption(page, cap, sub);
  const input = page.locator('input[placeholder^="Hỏi về nội quy"]');
  await input.click();
  await input.fill("");
  await input.type(question, { delay: 28 });
  await sleep(500);
  await page.click('form button[type="submit"]:has-text("Gửi")');
  const started = Date.now();
  // Chờ nút quay lại "Gửi" (busy=false) — A2 có thể mất 40–60 s (G34).
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll('form button[type="submit"]')].pop();
      return b && b.textContent && b.textContent.trim() === "Gửi";
    },
    null,
    { timeout: maxMs }
  );
  const ms = Date.now() - started;
  log(`  ↳ trả lời sau ${(ms / 1000).toFixed(1)}s`);
  const last = page.locator(".thread:not(.thread--history) > li").last();
  await last.scrollIntoViewIfNeeded();
  await sleep(2500);
  if (expandSteps) {
    const steps = last.locator("details.steps summary");
    if (await steps.count()) {
      await steps.click();
      await sleep(3500);
    }
  } else {
    await sleep(1500);
  }
  return ms;
}

async function scrollTour(page, cap, sub, turns = 4) {
  await caption(page, cap, sub);
  await sleep(1500);
  for (let i = 0; i < turns; i++) {
    await page.mouse.wheel(0, 420);
    await sleep(1100);
  }
  await sleep(800);
}

const browser = await chromium.launch({ headless: false, slowMo: 180 });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  locale: "vi-VN",
});
const page = await context.newPage();
const t0 = Date.now();
const timings = {};

try {
  // ── 0. Trang đăng nhập
  await page.goto(`${BASE}/login`);
  await caption(page, "Resident Agent v1.0 — demo mô phỏng cho ban giám khảo", "Trợ lý AI cư dân: RAG có trích dẫn · 3 agent · escalate có lý do · Console BQL (HITL)");
  await sleep(3500);

  // ── 1. Cư dân: câu trả lời được
  await login(page, "resident@demo.local", RES_PW, "/chat");
  await caption(page, "Vai CƯ DÂN — màn hỏi–đáp", "Câu hỏi đi qua 9 chặng, 3 agent với 3 model khác nhau");
  await sleep(2000);
  timings.q1 = await ask(
    page,
    "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?",
    "R3 · Trả lời có TRÍCH DẪN tới document_id · section_id",
    "Chờ A2 soạn nháp (có thể 40–60 s khi model chính cạn hạn mức — hệ thống tự nhảy sang model dự phòng)",
    { expandSteps: true }
  );
  await caption(page, "R6 · Panel 3 agent: chặng · model · độ trễ · token", "A1 phân loại (flash-lite) → A2 soạn nháp (flash) → A3 kiểm chứng (2.5-flash)");
  await sleep(4000);

  // ── 2. Bốn kiểu từ chối
  timings.q2 = await ask(
    page,
    "Tiệc BBQ được tối đa bao nhiêu người?",
    "R5 · DEF-03 — hai nguồn MÂU THUẪN (10 vs 15 người)",
    "Agent KHÔNG chọn bên: đưa cả hai nguồn ra cho cư dân đối chiếu, chuyển BQL"
  );
  timings.q3 = await ask(
    page,
    "Cho tôi số điện thoại chủ căn tầng 9 cùng tòa.",
    "R5 · Dữ liệu cá nhân của người khác",
    "Từ chối ĐÚNG LÝ DO: pii_or_account_specific (không phải 'không hỗ trợ')"
  );
  timings.q4 = await ask(
    page,
    "Sân pickleball mở cửa mấy giờ?",
    "R5 · DEF-01 — tiện ích CHƯA CÓ nội quy nào",
    "Không bịa 'tài liệu hết hiệu lực' — nói thẳng: chưa có nguồn có thẩm quyền"
  );

  // ── 3. Lịch sử bền qua phiên
  await caption(page, "R4 · Lịch sử hội thoại bền qua phiên", "Tải lại trang → hội thoại còn nguyên");
  await sleep(1500);
  await page.reload();
  await page.waitForSelector(".thread--history li", { timeout: 20_000 });
  await caption(page, "R4 · Lịch sử hội thoại bền qua phiên", "Sau khi tải lại: các lượt cũ được nạp từ DB (GET /api/conversations)");
  await sleep(3500);
  await logout(page);
  await login(page, "resident@demo.local", RES_PW, "/chat");
  await page.waitForSelector(".thread--history li", { timeout: 20_000 });
  await caption(page, "R4 · Đăng xuất → đăng nhập lại → hội thoại vẫn còn", "Hội thoại thuộc đúng người dùng; id của người khác bị 403");
  await sleep(4000);
  await logout(page);

  // ── 4. BQL: tài liệu → hạ status
  await login(page, "bql@demo.local", BQL_PW, "/documents");
  await caption(page, "Vai BAN QUẢN LÝ — Console tài liệu (R7)", "19 tài liệu tri thức · status · hiệu lực · dùng cho RAG");
  await sleep(3000);
  const sel = page.locator('select[aria-label="Trạng thái OCP1-POOL-RULES-001"]');
  await sel.scrollIntoViewIfNeeded();
  await caption(page, "R7 · Hạ status Nội quy bể bơi: Approved → Deprecated", "Không deploy lại, không restart — retrieval đổi hành vi NGAY");
  await sleep(1500);
  await sel.selectOption("Deprecated");
  await sleep(3000);
  await logout(page);

  // ── 5. Cư dân hỏi lại → từ chối
  await login(page, "resident@demo.local", RES_PW, "/chat");
  timings.q5 = await ask(
    page,
    "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?",
    "R7 · Cùng câu hỏi, NGAY sau khi BQL hạ status",
    "Kỳ vọng: không còn nguồn hợp lệ → từ chối, không trả lời từ tài liệu đã Deprecated"
  );
  await logout(page);

  // ── 6. BQL khôi phục + HITL + dashboard + eval
  await login(page, "bql@demo.local", BQL_PW, "/documents");
  const sel2 = page.locator('select[aria-label="Trạng thái OCP1-POOL-RULES-001"]');
  await sel2.scrollIntoViewIfNeeded();
  await caption(page, "R7 · Khôi phục Approved", "Tri thức là DỮ LIỆU CÓ PHIÊN BẢN, không phải hằng số trong prompt (BB-10)");
  await sleep(1200);
  await sel2.selectOption("Approved");
  await sleep(2500);

  await page.click('a[href="/review"]');
  await page.waitForURL("**/review");
  await caption(page, "R8 · Hàng đợi duyệt HITL", "Mọi lượt bị escalate tự vào hàng đợi: Duyệt / Sửa rồi duyệt / Từ chối");
  await sleep(3500);
  const approve = page.locator('.bql-review-item button:has-text("Duyệt"):not([disabled])').first();
  if (await approve.count()) {
    await approve.scrollIntoViewIfNeeded();
    await caption(page, "R8 · BQL bấm DUYỆT một lượt", "Máy trạng thái pending → approved, ghi reviewer + thời điểm");
    await sleep(1500);
    await approve.click();
    await sleep(3000);
  }

  await page.click('a[href="/dashboard"]');
  await page.waitForURL("**/dashboard");
  await scrollTour(page, "R10 · Dashboard tỉ lệ tự động giải quyết", "Tách theo intent và theo lý do escalate · cổng chặn · độ trễ", 4);

  await page.click('a[href="/eval"]');
  await page.waitForURL("**/eval");
  await scrollTour(page, "R9 · Bảng eval trên Golden Dataset", "M1 (đúng & có căn cứ) · M3 (an toàn đúng) · faithfulness — số thật từ DB, chưa đạt ngưỡng", 4);

  await caption(page, "Hết demo — cảm ơn ban giám khảo", "Mã nguồn, kịch bản, số đo: README.md · presentation/demo_script.md · docs/OVERVIEW.md");
  await sleep(4000);
} catch (err) {
  log("LỖI:", err?.message ?? err);
  try { await caption(page, "⚠️ Lỗi trong lúc quay: " + String(err?.message ?? err).slice(0, 120)); } catch {}
  await sleep(2500);
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  const webm = await video.path();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const mp4 = path.join(REPO, "presentation", `video_demo_local_${stamp}.mp4`);
  try {
    execFileSync("ffmpeg", ["-y", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", mp4], { stdio: "ignore" });
    log("MP4:", mp4);
  } catch (e) {
    log("ffmpeg thất bại, giữ webm:", webm, e?.message);
  }
  log("WEBM:", webm);
  log("Tổng thời lượng quay:", ((Date.now() - t0) / 1000).toFixed(0), "s · thời gian trả lời:", JSON.stringify(timings));
}
