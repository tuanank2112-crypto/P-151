// scripts/_batch.mjs — hạ tầng CHẠY THEO LÔ + CHECKPOINT cho mọi script đo
// phải gọi model thật (`eval_golden.mjs`, `probe_defects.mjs`). Đ26.
//
// VÌ SAO TỒN TẠI. Hạn mức Gemini free đã đo (Đ19): 15 lời gọi song song thì
// qua, 40 thì 39 dính 429. Một lượt Golden là 198 lời gọi. Bản trước của hai
// script đo có ba khuyết tật khiến hạn mức biến thành số sai chứ không phải
// lỗi nhìn thấy được:
//
//   1. `catch {}` nuốt lỗi. Một ca dính 429 bị đếm y hệt một ca model trả SAI
//      ⇒ chạy lúc cạn hạn mức ra `M1 = 5/40` và người đọc tưởng chất lượng
//      kém. Đây là số GIẢ, nguy hiểm hơn là không có số.
//   2. Không có checkpoint. Cạn hạn mức ở ca 180/198 là mất sạch, chạy lại
//      phải đốt lại từ ca 1 — đúng vòng lặp đã làm gói P02a dừng ở 2/4.
//   3. Không chạy được lô nhỏ. Không có cách nói "làm 10 ca thôi rồi nghỉ".
//
// LUẬT BẤT BIẾN CỦA MODULE NÀY:
//   · Lỗi TẦNG 1 (hạn mức/quá tải/xác thực — §5.E Luật tầng 1) KHÔNG BAO GIỜ
//     được tính là ca trượt, và KHÔNG được ghi checkpoint (để lượt sau chạy
//     lại đúng ca đó). Nó được đếm riêng vào `blocked`.
//   · Chỉ ca đã có KẾT LUẬN THẬT (pass hoặc fail vì nội dung) mới vào
//     checkpoint.
//   · Cạn hạn mức liên tiếp `QUOTA_STREAK_STOP` lần ⇒ DỪNG NGAY, giữ nguyên
//     checkpoint, thoát mã 3. Chạy tiếp là tiêu tốn hạn mức vô ích.
//
// MÃ THOÁT THỐNG NHẤT (mọi script dùng module này):
//   0 = lô chạy xong, mọi ca có kết luận, không ca nào trượt
//   1 = có ca TRƯỢT THẬT (lỗi nội dung/logic) — số đọc được
//   2 = sai tham số / thiếu biến môi trường
//   3 = CHƯA KẾT LUẬN ĐƯỢC: dừng sớm vì hạn mức, hoặc còn ca `blocked`.
//       KHÔNG phải thất bại của sản phẩm — chạy lại với `--resume`.

import fs from "node:fs";
import path from "node:path";

/** Dừng sau ngần này lần dính hạn mức LIÊN TIẾP. */
export const QUOTA_STREAK_STOP = Number(process.env.QUOTA_STREAK_STOP ?? 3);

/** Tên lớp lỗi tầng nhà cung cấp, khai ở `lib/adapters/model.ts`. So bằng
 *  `name` thay vì `instanceof` để module này không phải nạp tầng TS. */
const TIER1_ERRORS = new Set([
  "UpstreamRateLimited", // 429 — hết hạn mức
  "UpstreamOverloaded", // 503 — model quá tải
  "UpstreamAuthError", // 401/403 — key sai, người phải xử
  "UpstreamModelError", // 5xx khác — adapter đã retry hết mà vẫn thoát ra
]);

/** Mã lỗi socket/DNS của Node — đứt cáp, không phải sai lệch nghiệp vụ. */
const TIER1_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

// Thông điệp lỗi mạng của `fetch`/undici. PHẢI hẹp và tường minh.
//
// Đo được 2026-09-20: `DEF-04` trượt với `TypeError: terminated` — undici ném
// đúng thế khi kết nối bị ngắt giữa đường. Bản đầu của module này xếp nó vào
// `logic` nên nó bị ghi checkpoint là MISMATCH, tức một lần đứt mạng bị ghi
// thành "khuyết tật cài sẵn không kích hoạt đúng" — sai hẳn về bản chất.
//
// VÙNG CẤM: KHÔNG được xếp cả họ `TypeError` vào tầng 1. `TypeError` cũng là
// hình dạng của lỗi code thật (`Cannot read properties of undefined`), và gộp
// cả họ lại sẽ biến mọi lỗi lập trình thành "hạ tầng, chạy lại sau" — XANH
// GIẢ đúng kiểu Đ21 đã cắn dự án này một lần. Chỉ khớp theo thông điệp.
const TIER1_MESSAGE_RE =
  /\b(terminated|fetch failed|socket hang up|network(?: socket)? disconnected|connection closed|other side closed|request to .* failed)\b/i;

/**
 * Phân lập căn nguyên (AGENTS.md §5.E). Trả `tier1` khi lỗi là hạ tầng/mạng/
 * hạn mức — thứ KHÔNG được phép làm bẩn số đo chất lượng.
 *
 * Lưu ý phân định: `ContractDriftError` (model trả sai schema) là lỗi CHẤT
 * LƯỢNG của model, KHÔNG phải tầng 1 — nó phải được kết luận và đếm, vì đó
 * chính là thứ Golden đang đo.
 *
 * @returns {{ tier: "tier1" | "logic", kind: string, quota: boolean }}
 */
export function classifyError(err) {
  const name = err?.name ?? "UnknownError";
  if (TIER1_ERRORS.has(name)) {
    return { tier: "tier1", kind: name, quota: name === "UpstreamRateLimited" };
  }
  const code = err?.code ?? err?.cause?.code;
  if (code && TIER1_CODES.has(code)) {
    return { tier: "tier1", kind: `${name}(${code})`, quota: false };
  }
  const msg = String(err?.message ?? "");
  if (TIER1_MESSAGE_RE.test(msg)) {
    return { tier: "tier1", kind: `${name}(mạng: ${msg.slice(0, 60)})`, quota: false };
  }
  return { tier: "logic", kind: name, quota: false };
}

/**
 * Đ40 W2 (`plan.md` §2, 2026-09-22) — `TESTING-ACCEPTANCE.md` §4.4 quy định
 * case Golden `S14` dùng cờ bơm lỗi `forceUpstreamError: "429"` CÓ CHỦ ĐÍCH
 * tại lời gọi A2. Đây là lỗi ĐƯỢC MONG ĐỢI — phải đem kết luận (pass/fail
 * theo `decision`/`reason_code` cuối cùng), KHÔNG được `runBatch` phân lập
 * thành Tầng 1 (Đ26) rồi bỏ qua.
 *
 * Hàm này quyết định CHÍNH XÁC khi nào một lỗi ném ra từ `runTurn()` là lỗi
 * bơm có chủ đích đó, để caller (`scripts/eval_golden.mjs::judgeSafety`)
 * biết khi nào được phép ĐỌC LẠI dòng `answer_turns` vừa ghi thay vì ném lỗi
 * tiếp cho `runBatch`.
 *
 * VÙNG CẤM (đối xứng với vùng cấm của `classifyError` ở trên): CHỈ khớp khi
 * CẢ HAI điều kiện đúng — `caseId` là ca có cờ bơm lỗi (mặc định `S14`) VÀ
 * `err.name` đúng lớp lỗi được bơm (mặc định `UpstreamRateLimited`). Một ca
 * KHÁC dính 429 THẬT ngoài ý muốn, hoặc chính `S14` dính một lớp lỗi KHÁC
 * (vd lỗi logic thật), đều phải trả `false` — để lỗi đó tiếp tục đi tới
 * `runBatch`/`classifyError` như bình thường (429 thật ⇒ Tầng 1 ⇒ `blocked`;
 * lỗi logic ⇒ tính là trượt thật). Nuốt nhầm một trong hai chiều này là biến
 * bộ đo thành XANH GIẢ kiểu Đ21/G12.
 *
 * Hàm THUẦN — không chạm DB/model, test trực tiếp được không cần hạ tầng.
 */
export function isExpectedInjectedError(caseId, err, opts = {}) {
  const targetCaseId = opts.caseId ?? "S14";
  const targetErrorName = opts.errorName ?? "UpstreamRateLimited";
  return caseId === targetCaseId && err?.name === targetErrorName;
}

/** Đọc cờ dạng `--ten=gia-tri`. */
export function argValue(flag, fallback) {
  const found = process.argv.find((a) => a.startsWith(`${flag}=`));
  return found ? found.slice(flag.length + 1) : fallback;
}

/** Đọc cờ dạng `--ten` (có/không). */
export function argFlag(flag) {
  return process.argv.includes(flag);
}

/**
 * Cắt danh sách ca theo `--offset` / `--limit` / `--only`.
 * `--only` nhận danh sách id ngăn cách bởi dấu phẩy, ưu tiên hơn offset/limit.
 * @template T
 * @param {Array<T>} cases
 * @param {(c: T) => string} idOf
 * @returns {Array<T>}
 */
export function sliceCases(cases, idOf) {
  const only = argValue("--only", null);
  if (only) {
    const wanted = new Set(
      only
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    return cases.filter((c) => wanted.has(idOf(c)));
  }
  const offset = Math.max(0, Number(argValue("--offset", 0)));
  const limitRaw = argValue("--limit", null);
  const limit = limitRaw === null ? cases.length : Math.max(0, Number(limitRaw));
  return cases.slice(offset, offset + limit);
}

/**
 * Sổ checkpoint dạng JSONL append-only. Một dòng = một ca ĐÃ CÓ KẾT LUẬN.
 * Append-only là có chủ ý: ghi đè cả file thì một lần crash giữa chừng làm
 * mất toàn bộ lịch sử lô (đúng lớp lỗi G17 đã cắn dự án này hai lần).
 */
export class Checkpoint {
  /** @param {string} file đường dẫn file .jsonl */
  constructor(file) {
    this.file = file;
    this.done = new Map();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          const rec = JSON.parse(t);
          if (rec?.case_id) this.done.set(rec.case_id, rec);
        } catch {
          // Dòng hỏng (ghi dở lúc bị ngắt) — bỏ qua, ca đó sẽ chạy lại.
        }
      }
    }
  }

  has(caseId) {
    return this.done.has(caseId);
  }

  /** Ghi kết luận của một ca. CẤM gọi cho lỗi tầng 1. */
  append(rec) {
    this.done.set(rec.case_id, rec);
    fs.appendFileSync(this.file, `${JSON.stringify(rec)}\n`, "utf8");
  }

  /** Mọi kết luận đã có, kể cả từ các lượt chạy trước. */
  records() {
    return [...this.done.values()];
  }
}

/**
 * Chạy `items` với giới hạn song song, tự dừng khi hạn mức cạn liên tiếp.
 *
 * `worker(item)` phải trả `{ ok: boolean, rec: object }` cho ca có kết luận,
 * hoặc NÉM lỗi. Lỗi tầng 1 được module này bắt và đếm vào `blocked`.
 *
 * @returns {Promise<{ blocked: number, stoppedEarly: boolean, quotaHits: number }>}
 */
export async function runBatch(items, concurrency, worker, checkpoint) {
  let idx = 0;
  let blocked = 0;
  let quotaHits = 0;
  let quotaStreak = 0;
  let stoppedEarly = false;
  const delayMs = Math.max(0, Number(argValue("--delay-ms", process.env.BATCH_DELAY_MS ?? 0)));

  async function lane() {
    while (idx < items.length && !stoppedEarly) {
      const item = items[idx++];
      if (delayMs > 0 && idx > 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      try {
        const { rec } = await worker(item);
        quotaStreak = 0; // một ca đi trọn ⇒ hạn mức còn thở
        checkpoint.append(rec);
      } catch (err) {
        const c = classifyError(err);
        if (c.tier === "tier1") {
          blocked++;
          if (c.quota) {
            quotaHits++;
            quotaStreak++;
            if (quotaStreak >= QUOTA_STREAK_STOP) {
              stoppedEarly = true;
              console.error(
                `\n[DỪNG SỚM] ${quotaStreak} lần dính hạn mức liên tiếp. ` +
                  `Giữ nguyên checkpoint, thoát mã 3. Chạy lại bằng --resume khi hạn mức hồi.`
              );
            }
          }
          // KHÔNG ghi checkpoint — ca này chưa có kết luận, lượt sau phải làm lại.
        } else {
          // Lỗi logic thật: ĐÂY là kết luận, ghi lại để không chạy lại vô ích.
          checkpoint.append({
            case_id: item.__case_id,
            ok: false,
            error_class: c.kind,
            error_message: String(err?.message ?? err).slice(0, 300),
          });
          quotaStreak = 0;
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, lane)
  );
  return { blocked, stoppedEarly, quotaHits };
}

/**
 * In dòng cảnh báo backend BẮT BUỘC trước mọi số M (Đ24).
 *
 * Đ33 — banner cũ dán chữ "số định hướng, KHÔNG phải số nghiệm thu" lên CẢ
 * lượt chạy trên Postgres. Đ24 cấm tick `G11` bằng số MOCK, chứ số chạy trên
 * Postgres thật CHÍNH LÀ số nghiệm thu. Dán nhầm nhãn lên số thật thì không
 * ai dám dùng nó, và cái cấm mất luôn ý nghĩa vì nó cấm tất cả.
 */
export function printBackendBanner() {
  process.env.DATA_BACKEND = process.env.DATA_BACKEND ?? "mock";
  const backend = process.env.DATA_BACKEND;
  console.log(
    backend === "postgres"
      ? `BACKEND=postgres — số NGHIỆM THU (chạy trên Postgres thật, Đ24)`
      : `BACKEND=${backend} — số định hướng, KHÔNG phải số nghiệm thu (Đ24)`
  );
  return backend;
}

/**
 * Nạp `.env.local` nếu có, KHÔNG ghi đè biến đã đặt sẵn ở shell.
 *
 * Vì sao: đo được 2026-09-20 — một lượt chạy `node scripts/probe_defects.mjs`
 * mà quên `--env-file=.env.local` làm ca `DEF-01` bị ghi checkpoint là TRƯỢT với
 * lý do "GEMINI_API_KEY chưa được cấu hình". Người quên một cờ dòng lệnh KHÔNG
 * được biến thành "khuyết tật cài sẵn không kích hoạt đúng". Tự nạp là cách sửa
 * gốc; `requireEnv()` bên dưới là lưới thứ hai.
 *
 * `process.loadEnvFile` có từ Node 20.12 (máy dev: v24.12.0).
 */
export function loadLocalEnv(file = ".env.local") {
  if (!fs.existsSync(file)) return false;
  // `loadEnvFile` GHI ĐÈ biến đã có, nên chụp lại trước rồi trả về sau: biến
  // truyền ở shell (vd `DATA_BACKEND=postgres node ...`) phải thắng file.
  const fromShell = { ...process.env };
  try {
    process.loadEnvFile(file);
  } catch {
    return false; // file hỏng — để `requireEnv()` báo thiếu biến cụ thể
  }
  for (const [k, v] of Object.entries(fromShell)) {
    if (v !== undefined) process.env[k] = v;
  }
  return true;
}

/**
 * Chặn TRƯỚC khi chạy lô: thiếu biến môi trường thì thoát mã 2 ngay, không
 * đốt một ca nào và không ghi một dòng checkpoint nào.
 *
 * VÙNG CẤM: KHÔNG được để lỗi cấu hình đi vào `runBatch`. Ở đó nó bị xếp vào
 * `logic` và ghi thành ca trượt — tức một số đo GIẢ về chất lượng sản phẩm.
 */
export function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `Thiếu biến môi trường: ${missing.join(", ")}.\n` +
        `Đặt trong .env.local (script tự nạp), hoặc truyền qua shell. ` +
        `Xem specs/OPERATIONS.md §3. KHÔNG chạy lô để tránh ghi số đo giả.`
    );
    process.exit(2);
  }
}
