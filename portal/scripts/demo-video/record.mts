/**
 * Demo video of the new portal: one ticket from resident to rating, every role, with a visible cursor,
 * on-screen captions and Vietnamese narration (offline Windows voice, see tts.ps1).
 * Script (scenes, actions, lines): docs/demo/demo-script.md; spoken text: narration.json.
 *
 * Usage (backend memory store on --base, fresh data, LLM mock):
 *   npx tsx scripts/demo-video/record.mts --dry                     # walk the flow, log buttons, no video
 *   npx tsx scripts/demo-video/record.mts --audio=<dir> --out=<dir>  # record + mux narration -> demo.mp4
 *   npx tsx scripts/demo-video/record.mts --audio=<dir> --out=<dir> --remux  # mux again from <out>/raw, no recording
 * <dir> of --audio holds <id>.wav + durations.json written by tts.ps1.
 */
import { chromium, type Locator, type Page } from "playwright";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = arg("base", "http://127.0.0.1:8003");
const DRY = process.argv.includes("--dry");
const AUDIO = path.resolve(arg("audio", "demo-audio"));
const OUT = path.resolve(arg("out", "../docs/demo"));
const W = 1440;
const H = 900;

type Line = { id: string; scene: string; speaker: string; text: string };
const LINES: Line[] = JSON.parse(readFileSync(new URL("./narration.json", import.meta.url), "utf8"));
const byId = new Map(LINES.map((l) => [l.id, l]));
const DUR: Record<string, number> = !DRY && existsSync(path.join(AUDIO, "durations.json")) ? JSON.parse(readFileSync(path.join(AUDIO, "durations.json"), "utf8")) : {};
if (!DRY) for (const l of LINES) if (!(l.id in DUR)) throw new Error(`no audio for ${l.id} in ${AUDIO}`);

const TITLE = "Đèn hành lang tầng 12 chập chờn rồi tắt hẳn";
const CONTENT =
  "Từ tối qua đèn hành lang tầng 12, đoạn gần thang máy, chập chờn rồi tắt hẳn. Buổi tối đi lại rất tối, nhờ ban quản lý kiểm tra giúp.";

// ---------- page decorations: cursor, caption bar, scene chip (survive navigation via sessionStorage) ----------
// Plain JS string, not a TS function: tsx/esbuild inject `__name(...)` into serialised functions and the
// browser has no such helper, which silently killed the overlay in the first take.
const DECOR_JS = String.raw`(() => {
  const get = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* about:blank title cards */ } };
  const css = "#demo-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-4px,-2px)}"
    + "#demo-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}"
    + ".demo-ripple{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid #F97316;z-index:2147483646;pointer-events:none;animation:demoR .6s ease-out forwards}"
    + "@keyframes demoR{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}"
    + "#demo-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1100px;width:calc(100% - 120px);z-index:2147483645;pointer-events:none;"
    + "background:rgba(15,23,42,.88);color:#fff;border-radius:16px;padding:14px 22px;font:500 21px/1.45 system-ui,'Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}"
    + "#demo-cap b{display:block;font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:#FDBA74;margin-bottom:2px}"
    + "#demo-cap:empty{display:none}"
    + "#demo-scene{position:fixed;right:24px;top:20px;z-index:2147483645;pointer-events:none;background:#F97316;color:#fff;border-radius:999px;padding:8px 18px;font:700 16px system-ui,'Segoe UI',sans-serif;box-shadow:0 6px 18px rgba(249,115,22,.35)}"
    + "#demo-scene:empty{display:none}";
  // caption/scene live in window vars too, so title cards (no sessionStorage) keep them when re-created
  const sync = () => {
    const cap = document.getElementById("demo-cap");
    const sc = document.getElementById("demo-scene");
    const c = window.__demoCap ?? get("demoCap") ?? "";
    const s = window.__demoScene ?? get("demoScene") ?? "";
    if (cap && cap.innerHTML !== c) cap.innerHTML = c;
    if (sc && sc.textContent !== s) sc.textContent = s;
  };
  const ensure = () => {
    if (!document.body) return;
    if (document.getElementById("demo-cursor")) return sync();
    const st = document.createElement("style");
    st.textContent = css;
    (document.head || document.body).appendChild(st);
    const cur = document.createElement("div");
    cur.id = "demo-cursor";
    cur.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const cap = document.createElement("div");
    cap.id = "demo-cap";
    document.body.appendChild(cap);
    const sc = document.createElement("div");
    sc.id = "demo-scene";
    document.body.appendChild(sc);
    const pos = JSON.parse(get("demoPos") || "[720,450]");
    cur.style.left = pos[0] + "px";
    cur.style.top = pos[1] + "px";
    sync();
  };
  addEventListener("DOMContentLoaded", ensure);
  setInterval(ensure, 200);
  addEventListener("mousemove", (e) => {
    const c = document.getElementById("demo-cursor");
    if (c) { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }
    put("demoPos", JSON.stringify([e.clientX, e.clientY]));
  }, true);
  addEventListener("mousedown", (e) => {
    const r = document.createElement("div");
    r.className = "demo-ripple";
    r.style.left = e.clientX + "px";
    r.style.top = e.clientY + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }, true);
})();`;

let page: Page;
let t0 = 0;
const timeline: { id: string; at: number }[] = [];
const log = (s: string) => console.log(s);

async function setOverlay(scene: string, html: string) {
  await page.evaluate(
    ([s, h]) => {
      (window as unknown as Record<string, string>).__demoScene = s;
      (window as unknown as Record<string, string>).__demoCap = h;
      try {
        sessionStorage.setItem("demoScene", s);
        sessionStorage.setItem("demoCap", h);
      } catch {
        /* title cards (about:blank) */
      }
      const sc = document.getElementById("demo-scene");
      const cap = document.getElementById("demo-cap");
      if (sc) sc.textContent = s;
      if (cap) cap.innerHTML = h;
    },
    [scene, html],
  );
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** One narration beat: show caption, run the actions, then hold until the line has been spoken */
async function beat(id: string, actions?: () => Promise<void>) {
  const l = byId.get(id);
  if (!l) throw new Error(`unknown line ${id}`);
  const start = Date.now();
  const who = l.speaker === "Thuyết minh" ? "" : `<b>${esc(l.speaker)}</b>`;
  await setOverlay(l.scene, `${who}${esc(l.text)}`);
  timeline.push({ id, at: (start - t0) / 1000 });
  log(`[${((start - t0) / 1000).toFixed(1)}s] ${id}`);
  if (actions) await actions();
  const need = DRY ? 0 : (DUR[id] + 0.45) * 1000;
  const left = need - (Date.now() - start);
  if (left > 0) await page.waitForTimeout(left);
}

const pause = (ms: number) => (DRY ? Promise.resolve() : page.waitForTimeout(ms));

async function point(loc: Locator) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error("element not visible");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: DRY ? 1 : 22 });
  await pause(220);
}
async function tap(loc: Locator) {
  await point(loc);
  await loc.click();
  await pause(450);
}
async function typeIn(loc: Locator, text: string) {
  await tap(loc);
  await loc.fill("");
  await loc.pressSequentially(text, { delay: DRY ? 0 : 28 });
}
async function scrollBy(dy: number) {
  const steps = Math.max(1, Math.round(Math.abs(dy) / 60));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, Math.sign(dy) * 60);
    await pause(25);
  }
  await pause(300);
}
const toTop = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
const tile = (label: string) => page.locator("nav .tile", { hasText: label }).first();

async function login(user: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.waitForFunction(() => {
    const f = document.querySelector("form");
    return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
  }, undefined, { timeout: 60000 });
  await typeIn(page.locator("#user"), user);
  await typeIn(page.locator("#pass"), "123456");
  await tap(page.getByRole("button", { name: "Đăng nhập", exact: true }));
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  await page.waitForSelector("nav .tile", { timeout: 60000 });
  await pause(500);
}

async function card(html: string) {
  await page.setContent(
    `<html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#9CC8FF,#3B82F6);font-family:system-ui,'Segoe UI',sans-serif;color:#0F1E3C">
     <div style="background:#fff;border-radius:28px;padding:56px 72px;max-width:980px;box-shadow:0 20px 60px rgba(15,30,60,.25);text-align:center">${html}</div></body></html>`,
  );
}

/** Synthetic site photo (drawn, clearly labelled as simulated) */
async function makePhoto(): Promise<Buffer> {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 640 } });
  await p.setContent(`<html><body style="margin:0"><svg width="960" height="640" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2937"/><stop offset="1" stop-color="#0b1220"/></linearGradient></defs>
    <rect width="960" height="640" fill="url(#g)"/>
    <polygon points="0,0 960,0 700,200 260,200" fill="#273449"/><polygon points="0,640 960,640 700,420 260,420" fill="#3a3f4b"/>
    <polygon points="0,0 260,200 260,420 0,640" fill="#222c3b"/><polygon points="960,0 700,200 700,420 960,640" fill="#222c3b"/>
    <rect x="260" y="200" width="440" height="220" fill="#111827"/>
    <rect x="420" y="60" width="120" height="18" rx="6" fill="#6b7280"/><rect x="430" y="64" width="100" height="10" rx="4" fill="#9ca3af" opacity=".35"/>
    <rect x="300" y="250" width="90" height="170" fill="#374151"/><rect x="570" y="250" width="90" height="170" fill="#374151"/>
    <text x="24" y="612" fill="#cbd5e1" font-family="Segoe UI" font-size="22">Ảnh mô phỏng · hành lang tầng 12 · đèn tắt</text></svg></body></html>`);
  const buf = await p.screenshot();
  await b.close();
  return buf;
}

// ================================ the story ================================
async function story(photo: Buffer) {
  let code = "";

  // ---- 0. Opening ----
  await card(`<div style="font-size:18px;color:#3B82F6;font-weight:700;letter-spacing:.08em">DEMO · DỮ LIỆU MÔ PHỎNG</div>
    <h1 style="font-size:46px;margin:14px 0 10px">Cổng phản ánh cư dân</h1>
    <div style="font-size:24px;color:#475569">Khu đô thị Ocean Park · MaintenanceOps Agent</div>
    <div style="margin-top:28px;font-size:19px;color:#64748B">Cư dân gửi phản ánh → Agent phân tích → Tiếp nhận → Phòng ban xử lý → Kho cấp vật tư → BQL nghiệm thu → Cư dân đánh giá</div>`);
  await setOverlay("Giới thiệu", "");
  await beat("intro-1");
  await beat("intro-2");

  // ---- 1. Resident submits ----
  await page.goto(`${BASE}/login`);
  await beat("res-1", async () => {
    await login("cudan");
  });
  await beat("res-2", async () => {
    await typeIn(page.locator("#title"), TITLE);
  });
  await beat("res-3", async () => {
    await typeIn(page.locator("#draft"), CONTENT);
  });
  await beat("res-4", async () => {
    await tap(page.locator("button.place", { hasText: "Tầng của tôi" }));
    await tap(page.locator("button.chip", { hasText: "Hành lang" }).first());
  });
  await beat("res-5", async () => {
    await page.locator("input[type=file]").first().setInputFiles({ name: "hanh-lang-tang-12.png", mimeType: "image/png", buffer: photo });
    await pause(600);
    await point(page.locator("img").last());
  });
  await beat("res-6", async () => {
    await tap(page.locator("aside button.primary"));
    await page.waitForSelector("[role=status]:has-text('Đã gửi')", { timeout: 60000 });
    const banner = (await page.locator("[role=status]").first().textContent()) ?? "";
    code = banner.match(/[A-Z]+(?:-[A-Z]+)*-\d+/)?.[0] ?? "";
    log(`  ticket code = ${code}`);
    await point(page.locator("[role=status]").first());
  });
  await beat("res-7", async () => {
    await tap(tile("Phản ánh của tôi"));
    await tap(page.locator(".titem", { hasText: TITLE }).first());
    await pause(500);
    await scrollBy(420);
  });
  await toTop();

  // ---- 2. Reception ----
  await beat("rec-1", async () => {
    await login("tiepnhan");
  });
  const recCard = () => page.locator("article.card", { hasText: TITLE }).first();
  await beat("rec-2", async () => {
    await point(recCard());
    log(`  reception card: ${(await recCard().innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
  });
  await beat("rec-3", async () => {
    await tap(recCard().locator("button[aria-label^='Xem chi tiết'], button", { hasText: /^[A-Z]+-/ }).first());
    await page.waitForSelector("[role=dialog]", { timeout: 15000 });
    await pause(600);
    await scrollDialog(500);
  });
  await page.keyboard.press("Escape");
  await pause(400);
  // walk the blocker buttons the backend offers until the ticket is routed
  let routed = false;
  for (let step = 0; step < 6 && !routed; step++) {
    if ((await page.locator("article.card", { hasText: TITLE }).count()) === 0) break;
    const btns = (await recCard().locator("button.btn").allTextContents()).map((x) => x.trim());
    const pill = (await recCard().locator(".pill.wait").first().textContent().catch(() => "")) ?? "";
    log(`  reception step ${step}: [${pill}] ${btns.join(" | ")}`);
    const pick = ["Phòng kỹ thuật", "Kiểm tra tại chỗ", "Xác nhận phân loại của Agent", "Không trùng"].find((x) => btns.includes(x));
    if (!pick) break;
    const id = pick === "Phòng kỹ thuật" ? "rec-5" : "rec-4";
    await beat(id, async () => {
      await tap(recCard().locator("button.btn", { hasText: pick }).first());
      await page.waitForTimeout(2500); // the card re-renders after the backend answers (also in --dry)
    });
    routed = pick === "Phòng kỹ thuật";
    if (!routed && (await page.locator("article.card", { hasText: TITLE }).count()) === 0) routed = true;
  }
  log(`  routed = ${routed}`);
  await beat("rec-6", async () => {
    await tap(tile("Đã phân loại"));
    await page.waitForSelector("table");
    await point(page.locator("tbody tr", { hasText: TITLE }).first());
  });

  // ---- 3. Technical accepts and requests materials ----
  const techCard = () => page.locator("article.card", { hasText: code }).first();
  await beat("tec-1", async () => {
    await login("kythuat");
    await point(techCard());
  });
  await beat("tec-2", async () => {
    await tap(techCard().getByRole("button", { name: "Nhận việc" }));
    await techCard().getByRole("button", { name: "Yêu cầu vật tư" }).waitFor({ timeout: 20000 });
    await point(techCard());
  });
  await beat("tec-3", async () => {
    await tap(techCard().getByRole("button", { name: "Yêu cầu vật tư" }));
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    log(`  request modal: ${(await dlg.innerText()).replace(/\s+/g, " ").slice(0, 400)}`);
    const sel = dlg.locator("select").first();
    await point(sel);
    const led = await sel.locator("option", { hasText: "Bóng đèn LED" }).first().getAttribute("value");
    await sel.selectOption(led ?? "");
    await pause(700);
  });
  await beat("tec-4", async () => {
    const dlg = page.getByRole("dialog");
    await typeIn(dlg.getByLabel(/Ghi chú/), "Thay bóng đèn LED hành lang tầng 12, bóng cũ đã cháy");
    await tap(dlg.getByRole("button", { name: "Gửi yêu cầu" }));
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 20000 });
    await techCard().getByText(/Chờ cấp trên duyệt vật tư|Chờ kho nhập hàng/).waitFor({ timeout: 20000 });
    await point(techCard());
  });

  // ---- 4. Warehouse approves ----
  const req = () => page.getByTestId("material-request").filter({ hasText: code }).first();
  await beat("kho-1", async () => {
    await login("kho");
    await pause(600);
    await tap(tile("Yêu cầu cấp phát"));
    await point(req());
    log(`  warehouse request: ${(await req().innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
  });
  if ((await req().getByRole("button", { name: /Nhập đủ/ }).count()) > 0) {
    await beat("kho-2", async () => {
      await tap(req().getByRole("button", { name: /Nhập đủ/ }).first());
      await pause(1500);
    });
  }
  await beat("kho-3", async () => {
    await tap(req().getByRole("button", { name: "Duyệt cấp" }));
    await pause(1800);
  });

  // ---- 5. Technical finishes ----
  await beat("tec-5", async () => {
    await login("kythuat");
    await point(techCard());
    await tap(techCard().getByRole("button", { name: "Đánh dấu hoàn thành" }));
    await page.getByRole("dialog").waitFor();
    log(`  finish modal: ${(await page.getByRole("dialog").innerText()).replace(/\s+/g, " ").slice(0, 500)}`);
  });
  await beat("tec-6", async () => {
    const dlg = page.getByRole("dialog");
    for (const cb of await dlg.locator("input[type=checkbox]:not([disabled])").all()) {
      await tap(cb);
      if (!(await cb.isChecked())) await cb.check();
    }
    for (const f of await dlg.locator('input[placeholder^="Bắt buộc"]').all()) await typeIn(f, "Theo thực tế hiện trường");
  });
  await beat("tec-7", async () => {
    const dlg = page.getByRole("dialog");
    await dlg.locator("input[type=file]").setInputFiles({ name: "sau-xu-ly.png", mimeType: "image/png", buffer: photo });
    await pause(600);
    await tap(dlg.getByRole("button", { name: "Gửi nghiệm thu" }));
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 30000 }).catch(async () => {
      throw new Error(`finish modal still open: ${await page.getByRole("dialog").getByRole("alert").innerText().catch(() => "")}`);
    });
    await pause(800);
  });

  // ---- 6. Management inspects ----
  const insp = () => page.locator("[data-testid=bql-inspection] article", { hasText: code }).first();
  await beat("bql-1", async () => {
    await login("quanly");
    await pause(800);
  });
  await beat("bql-2", async () => {
    await tap(tile("Việc của BQL"));
    await pause(1200);
    await point(insp());
  });
  await beat("bql-3", async () => {
    await tap(insp().locator("input[type=checkbox]").nth(0));
    await tap(insp().locator("input[type=checkbox]").nth(1));
    await tap(insp().getByRole("button", { name: /Nghiệm thu đạt/ }));
    await pause(2000);
  });

  // ---- 7. Resident rates ----
  await beat("res-8", async () => {
    await login("cudan");
    await tap(tile("Phản ánh của tôi"));
    await tap(page.locator(".titem", { hasText: TITLE }).first());
    await pause(500);
  });
  await beat("res-9", async () => {
    await tap(page.locator("[role=radio]").nth(4));
    await tap(page.locator("button.chip", { hasText: "Xử lý nhanh" }).first());
    await typeIn(page.locator("#rcomment"), "Kỹ thuật đến nhanh, hành lang sáng lại rồi. Cảm ơn ban quản lý!");
  });
  await beat("res-10", async () => {
    await tap(page.getByRole("button", { name: "Gửi đánh giá" }));
    await pause(1500);
    await scrollBy(300);
  });

  // ---- 8. Management overview ----
  await beat("bql-4", async () => {
    await login("quanly");
    await pause(800);
  });
  await beat("bql-5", async () => {
    await tap(tile("Hiệu suất phòng ban"));
    await pause(1000);
  });

  // ---- 9. Closing ----
  await card(`<h1 style="font-size:42px;margin:0 0 14px">Cảm ơn đã theo dõi</h1>
    <div style="font-size:22px;color:#475569">Một phản ánh, sáu vai trò, một nơi theo dõi</div>
    <div style="margin-top:24px;font-size:17px;color:#64748B">Dữ liệu mô phỏng (SIM-) · không phải dữ liệu vận hành thật</div>`);
  await setOverlay("Kết thúc", "");
  await beat("outro-1");
  await pause(1200);
  return code;
}

async function scrollDialog(dy: number) {
  const dlg = page.getByRole("dialog");
  const b = await dlg.boundingBox();
  if (!b) return;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: DRY ? 1 : 15 });
  await scrollBy(dy);
}

// ================================ run ================================
if (process.argv.includes("--remux")) {
  timeline.push(...JSON.parse(readFileSync(path.join(OUT, "raw", "timeline.json"), "utf8")));
  mux(path.join(OUT, "raw", "demo-raw.webm"));
  process.exit(0);
}
const photo = await makePhoto();
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  locale: "vi-VN",
  ...(DRY ? {} : { recordVideo: { dir: path.join(OUT, "raw"), size: { width: W, height: H } } }),
});
await ctx.addInitScript({ content: DECOR_JS });
page = await ctx.newPage();
t0 = Date.now();
let ok = false;
try {
  const code = await story(photo);
  log(`DONE ticket=${code}`);
  ok = true;
} finally {
  const video = page.video();
  await ctx.close();
  await browser.close();
  if (!DRY && video) {
    const raw = await video.path();
    const webm = path.join(OUT, "raw", "demo-raw.webm");
    renameSync(raw, webm);
    writeFileSync(path.join(OUT, "raw", "timeline.json"), JSON.stringify(timeline, null, 1));
    if (ok) mux(webm);
  }
}

function srtTime(s: number) {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

function mux(webm: string) {
  const srt = timeline
    .map((t, i) => {
      const l = byId.get(t.id)!;
      const who = l.speaker === "Thuyết minh" ? "" : `${l.speaker}: `;
      return `${i + 1}\n${srtTime(t.at)} --> ${srtTime(t.at + DUR[t.id])}\n${who}${l.text}\n`;
    })
    .join("\n");
  writeFileSync(path.join(OUT, "demo.srt"), srt, "utf8");
  const inputs = ["-y", "-i", webm];
  const parts: string[] = [];
  timeline.forEach((t, i) => {
    inputs.push("-i", path.join(AUDIO, `${t.id}.wav`));
    const ms = Math.max(0, Math.round(t.at * 1000));
    parts.push(`[${i + 1}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
  });
  const mix = `${parts.join(";")};${timeline.map((_, i) => `[a${i}]`).join("")}amix=inputs=${timeline.length}:normalize=0,volume=1.1,alimiter=limit=0.7:level=disabled[aout]`;
  const args = [
    ...inputs,
    "-filter_complex",
    mix,
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "25",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    path.join(OUT, "demo.mp4"),
  ];
  const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg exit ${r.status}: ${r.stderr.slice(-800)}`);
  log(`WROTE ${path.join(OUT, "demo.mp4")}`);
}
