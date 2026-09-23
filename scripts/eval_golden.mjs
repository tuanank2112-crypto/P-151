#!/usr/bin/env node
// scripts/eval_golden.mjs — chạy Golden Dataset qua pipeline thật
// (TESTING-ACCEPTANCE §5.1, P02-M3/M4).
//
// Đ24 — VÙNG CẤM: số M1/M3 chạy trên `DATA_BACKEND=mock` KHÔNG PHẢI số
// nghiệm thu (score_lexical/S1 không chuyển được sang Postgres). Script BẮT
// BUỘC in dòng cảnh báo `BACKEND=mock` TRƯỚC khi in bất kỳ số M nào. CẤM
// dùng output của script này để tick Exit Gate G11.
//
// Đ26 — CHẠY THEO LÔ. Một lượt đầy đủ là 198 lời gọi model, vượt xa hạn mức
// free một phiên (Đ19). Cách dùng đúng là cắt thành nhiều lô nhỏ, mỗi lô nối
// tiếp lô trước qua checkpoint:
//
//   node scripts/eval_golden.mjs --set=safety --limit=8
//   node scripts/eval_golden.mjs --set=safety --limit=8 --resume
//   node scripts/eval_golden.mjs --set=safety --resume          # nốt phần còn lại
//   node scripts/eval_golden.mjs --set=faq --limit=10 --resume  # rồi lặp lại
//   node scripts/eval_golden.mjs --set=safety --only=S-03,S-07  # chạy đúng vài ca
//
// Cờ: --set=faq|safety|all · --limit=N · --offset=N · --only=id,id · --resume
//     --fresh (xoá checkpoint của set rồi chạy lại từ đầu)
// Biến: GOLDEN_CONCURRENCY (mặc định 4, khoảng hợp lệ 3–5, Đ19/OP-C5)
//       QUOTA_STREAK_STOP (mặc định 3)
//
// Mã thoát: 0 xong sạch · 1 có ca trượt thật · 2 sai tham số · 3 chưa kết
// luận được (dừng vì hạn mức, hoặc còn ca bị chặn) — xem `_batch.mjs`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { runTurn } from "../lib/pipeline/index.ts";
import { conversationIdFromLabel, getDataStore, getSql } from "../lib/adapters/db.ts";
import { rejectAnswer } from "../lib/adapters/bql-store.ts";
import { judgeFaqCase, judgeSafetyCase } from "../lib/eval/score.ts";
import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs";
import {
  Checkpoint,
  argFlag,
  argValue,
  isExpectedInjectedError,
  loadLocalEnv,
  printBackendBanner,
  requireEnv,
  runBatch,
  sliceCases,
} from "./_batch.mjs";
import { checkGoldenConcurrency } from "./check_env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const GDIR = path.join(ROOT, "evals", "golden");
const RUNS_DIR = path.join(ROOT, "evals", "runs");

// P04-C9/OP-C5: khoảng 3–5 là CHẶN CỨNG, không phải lời khuyên. Ngoài khoảng
// ⇒ exit 1 kèm lý do NGAY LẬP TỨC, TRƯỚC khi chạm DB hay gọi model — KHÔNG
// tự kẹp về biên (bản cũ dùng `Math.min(5, Math.max(1, …))`, trái P04-C9).
const goldenConcurrencyCheck = checkGoldenConcurrency(process.env.GOLDEN_CONCURRENCY ?? 4);
if (!goldenConcurrencyCheck.ok) {
  console.error(goldenConcurrencyCheck.reason);
  process.exit(1);
}
const CONCURRENCY = goldenConcurrencyCheck.value;

function readJsonl(file) {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// Đ36 (`plan.md` §2, 2026-09-22) — CÁCH CHẤM (đủ 7 checkpoint, SAO Y
// `SPEC-P00-Knowledge-Golden.md` §6.5) SỐNG Ở MỘT NƠI DUY NHẤT:
// `lib/eval/score.ts`. File này KHÔNG còn tự định nghĩa `containsAll` /
// `containsNone` / `citesAll` / logic verdict riêng — bản chép cũ ở đây từng
// bỏ sót `detected_intent`, `claims[].verdict` và bỏ dấu tiếng Việt (thẩm
// định đối kháng `R09` bắt được 3/5 ca giả cho verdict sai vì đúng ba khoảng
// trống này). `lib/adapters/metrics-store.ts` import CÙNG hàm chấm này.

/**
 * Đọc lại `detected_intent` vừa được `runTurn()` ghi vào `answer_turns`
 * (Đ36). `TurnResult` (`lib/pipeline/index.ts`) KHÔNG tự mang trường này —
 * nó chỉ tồn tại như biến nội bộ của pipeline, và sửa để lộ ra ngoài nằm
 * NGOÀI phạm vi gói này (`lib/pipeline/**` bị CẤM, xem handoff). Cột DB là
 * nơi DUY NHẤT đọc lại được, và chỉ có ý nghĩa trên `DATA_BACKEND=postgres`
 * (kho mock không có bảng SQL). Đọc lỗi (vd `conversation_id` không phải
 * uuid hợp lệ) KHÔNG được làm sập cả ca — trả `null` và để checkpoint
 * `intent` fail an toàn (không tự cho qua), thay vì ném lỗi lên `runBatch`
 * và bị tính nhầm thành ca trượt hạ tầng.
 */
async function readDetectedIntent(conversationId) {
  if (process.env.DATA_BACKEND !== "postgres") return null;
  try {
    const sql = getSql();
    const rows = await sql(
      `SELECT detected_intent FROM answer_turns
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [conversationId]
    );
    return rows[0]?.detected_intent ?? null;
  } catch {
    return null;
  }
}

/**
 * Đ40 W2 — đọc lại dòng `answer_turns` MỚI NHẤT của một hội thoại. Dùng khi
 * `runTurn()` ném lỗi bơm có chủ đích (§4.4): khối `finally` của
 * `lib/pipeline/index.ts` đã ghi dòng `system_error` TRƯỚC KHI ném lại lỗi
 * (không sửa file đó — chỉ đọc lại kết quả nó đã ghi). `citations`/`claims`
 * là `jsonb`, driver `pg` tự parse thành mảng/obj JS — không cần `JSON.parse`
 * thêm (cùng cách `readDetectedIntent` ở trên đã tin tưởng driver).
 */
async function readLastTurn(conversationId) {
  const sql = getSql();
  const rows = await sql(
    `SELECT decision, reason_code, gate_triggered, citations, claims
     FROM answer_turns WHERE conversation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [conversationId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    decision: row.decision,
    reason_code: row.reason_code ?? null,
    gate_triggered: row.gate_triggered ?? null,
    citations: row.citations ?? [],
    claims: row.claims ?? [],
    // escalate/system_error KHÔNG có assistant_message — không đọc `messages`
    // thêm một round-trip chỉ để xác nhận điều bảng `answer_turns` đã ngụ ý.
    answer_vi: null,
  };
}

function faqWhy(scored) {
  if (scored.pass) return "";
  const fails = [];
  if (scored.checkpoint_intent === false) fails.push("intent");
  if (scored.checkpoint_citation === false) fails.push("citation");
  if (scored.checkpoint_critical_fact === false) fails.push("critical_fact");
  if (scored.checkpoint_no_unsupported === false) fails.push("no_unsupported_claim");
  return fails.length > 0 ? `checkpoint fail: ${fails.join(",")}` : "decision/reason_code sai";
}

function safetyWhy(scored) {
  if (scored.pass) return "";
  const fails = [];
  if (scored.checkpoint_safe_behavior === false) fails.push("safe_behavior");
  if (scored.checkpoint_gate === false) fails.push("gate");
  if (scored.checkpoint_shows_conflict === false) fails.push("shows_conflict");
  return fails.length > 0 ? `checkpoint fail: ${fails.join(",")}` : "must_not_answer vi phạm";
}

/** Chấm một ca FAQ. Trả bản ghi checkpoint — KHÔNG bắt lỗi, lỗi để `runBatch`
 *  phân lập (lỗi hạn mức không được tính là trượt). */
async function judgeFaq(c) {
  // Đ37 — cột `conversation_id` là `uuid`; băm nhãn người đọc được thành uuid
  // TẤT ĐỊNH (không `randomUUID()`) để `--resume` nối lại đúng hội thoại cũ.
  const conversationId = conversationIdFromLabel(`golden-faq-${c.case_id}`);
  const result = await runTurn({
    conversation_id: conversationId,
    question_vi: c.question_vi,
    principal: DEMO_RESIDENT_PRINCIPAL,
    // Đ44 — khai lượt này là Golden, để panel Golden (SPEC-P04 §4.1) và
    // các panel vận hành (lọc is_golden_run=false) không bị nhuộm.
    is_golden_run: true,
    golden_case_id: c.case_id,
  });
  const detected_intent = await readDetectedIntent(conversationId);
  const scored = judgeFaqCase(c, {
    decision: result.decision,
    reason_code: result.reason_code,
    gate_triggered: result.gate_triggered,
    detected_intent,
    citations: result.citations,
    claims: result.claims,
    answer_vi: result.answer_vi,
  });
  return {
    ok: scored.pass,
    rec: {
      case_id: c.case_id,
      kind: c.kind,
      ok: scored.pass,
      decision: result.decision,
      reason_code: result.reason_code ?? null,
      checkpoint_intent: scored.checkpoint_intent,
      checkpoint_citation: scored.checkpoint_citation,
      checkpoint_critical_fact: scored.checkpoint_critical_fact,
      checkpoint_no_unsupported: scored.checkpoint_no_unsupported,
      why: faqWhy(scored),
    },
  };
}

// Đ40 W1 — `S16` mô phỏng sự kiện "BQL bấm Từ chối trong hàng đợi HITL",
// KHÔNG phải một câu hỏi cư dân. `TESTING-ACCEPTANCE.md` §BB-11 (dòng 268)
// đã chốt bằng số: "= 65" = "66 case trừ S16 không gọi runTurn". `question_vi`
// của ca này chỉ là placeholder mô tả (chính Golden ghi vậy trong `note_vi`).
const REVIEW_REJECT_CASE_ID = "S16";

/**
 * Đ40 W1 — lái `S16` qua ĐÚNG đường của nó: `rejectAnswer()` thật của
 * `lib/adapters/bql-store.ts` (SPEC-P03 §3.3, mã A10), KHÔNG viết lại logic
 * của hàm đó, KHÔNG đẩy `question_vi` vào `runTurn()`.
 *
 * `reason_code = reviewer_rejected_draft` chỉ sinh ra khi BQL bấm Từ chối
 * trên một bản nháp ĐÃ CÓ trong hàng đợi duyệt — nên trước khi gọi
 * `rejectAnswer()`, hàm này tự dựng "một lượt nháp" (Đ40): một dòng
 * `answer_turns` (`decision='escalate'`, chưa có `reason_code` cuối cùng) +
 * một dòng `review_queue` (`state='pending'`) tương ứng, dùng ĐÚNG các hàm
 * ghi đã có sẵn của `DataStore` (`createConversation`/`appendMessage`/
 * `insertAnswerTurn` — không tự viết INSERT cho ba bảng đó). Không có hàm
 * `DataStore` nào tạo `review_queue` (đây LÀ khoảng trống đã đo được: không
 * nơi nào trong sản phẩm hiện tại INSERT vào bảng đó — `grep -rn
 * "INSERT INTO review_queue"` rỗng toàn repo; tạo nó ở `runTurn()` nằm NGOÀI
 * phạm vi gói này vì đó là `lib/pipeline/**`, bị CẤM chạm), nên dòng đó được
 * ghi bằng một câu SQL trực tiếp NGAY TRONG file này — vẫn là "dựng lượt
 * nháp", không phải viết lại `rejectAnswer()`.
 *
 * CHỈ chạy được trên `DATA_BACKEND=postgres` — `rejectAnswer()` chỉ có ĐÚNG
 * MỘT cài đặt, dùng thẳng `getSql()` của Postgres (không có nhánh mock).
 * Trên backend khác, hàm này KHÔNG âm thầm bỏ qua ca (Đ40 VÙNG CẤM: "CẤM âm
 * thầm bỏ qua ca để số đẹp lên") — nó trả về một bản ghi `fail` tường minh,
 * nói rõ lý do trong `why`, và người đọc report thấy ngay S16 không đo được
 * trên backend này thay vì đoán.
 *
 * KHÔNG gọi model nào — tốn 0 lời gọi Gemini (khớp hạn mức đã cạn).
 */
async function judgeS16ViaReject(c) {
  if (process.env.DATA_BACKEND !== "postgres") {
    return {
      ok: false,
      rec: {
        case_id: c.case_id,
        ok: false,
        decision: null,
        reason_code: null,
        gate: null,
        checkpoint_safe_behavior: null,
        checkpoint_gate: null,
        checkpoint_shows_conflict: null,
        why:
          `S16 CHƯA ĐO ĐƯỢC trên backend="${process.env.DATA_BACKEND}" — ` +
          `rejectAnswer() (lib/adapters/bql-store.ts) chỉ có cài đặt Postgres. ` +
          `Chạy DATA_BACKEND=postgres để đo ca này (Đ40 W1) — KHÔNG tính ca này vào mẫu số M3 ở backend khác.`,
      },
    };
  }

  const store = await getDataStore();
  const bqlUser = await store.findUserByEmail("bql@demo.local");
  if (!bqlUser) {
    throw new Error(
      "S16: không tìm thấy tài khoản demo bql@demo.local — chạy `npm run db:seed` trước (OPERATIONS.md §4.1)."
    );
  }

  const conversationId = conversationIdFromLabel(`golden-safety-${c.case_id}`);
  const sql = getSql();
  // Upsert idempotent — cùng lý do `createConversationIfMissing` của
  // `appendMessage()` (Đ37): cùng nhãn phải nối lại đúng hội thoại cũ giữa
  // các lượt `--resume`, không đẻ hội thoại mới mỗi lần chạy lại.
  await sql(
    `INSERT INTO conversations (id, user_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [conversationId, DEMO_RESIDENT_PRINCIPAL.user_id]
  );
  const userMsg = await store.appendMessage(conversationId, "user", c.question_vi);
  const draftText =
    "[Fixture đo S16 — Đ40 W1] Bản nháp giả lập đang chờ Ban quản lý duyệt, " +
    "dùng để mô phỏng sự kiện BQL bấm Từ chối trong hàng đợi HITL (SPEC-P03 §3.3).";
  const turn = await store.insertAnswerTurn({
    conversation_id: conversationId,
    user_message_id: userMsg.id,
    assistant_message_id: null,
    question_vi: c.question_vi,
    detected_intent: null,
    lifecycle_state: "escalated",
    decision: "escalate",
    reason_code: null,
    confidence: 0,
    gate_triggered: null,
    citations: [],
    claims: [],
    latency_ms: 0,
    is_golden_run: true,
    golden_case_id: c.case_id,
  });
  const rq = await sql(
    `INSERT INTO review_queue (answer_turn_id, state, original_draft_vi)
     VALUES ($1, 'pending', $2) RETURNING id`,
    [turn.id, draftText]
  );
  const reviewId = rq[0].id;

  const rejectResult = await rejectAnswer({
    review_id: reviewId,
    reviewer_id: bqlUser.id,
    reject_reason_vi:
      "Nội dung nháp chưa đủ căn cứ theo nội quy hiện hành — từ chối (fixture đo ca S16, Đ40 W1).",
  });
  if (!rejectResult.ok) {
    throw new Error(
      `S16: rejectAnswer() thất bại — ${rejectResult.error.code}: ${rejectResult.error.message_vi}`
    );
  }

  const rows = await sql(`SELECT decision, reason_code FROM answer_turns WHERE id = $1`, [
    turn.id,
  ]);
  const row = rows[0];
  const scored = judgeSafetyCase(c, {
    decision: row?.decision ?? null,
    reason_code: row?.reason_code ?? null,
    gate_triggered: null,
    detected_intent: null,
    citations: [],
    claims: [],
    answer_vi: null,
  });
  return {
    ok: scored.pass,
    rec: {
      case_id: c.case_id,
      ok: scored.pass,
      decision: row?.decision ?? null,
      reason_code: row?.reason_code ?? null,
      gate: null,
      checkpoint_safe_behavior: scored.checkpoint_safe_behavior,
      checkpoint_gate: scored.checkpoint_gate,
      checkpoint_shows_conflict: scored.checkpoint_shows_conflict,
      why: `${safetyWhy(scored)} [đường: rejectAnswer() thật (SPEC-P03 §3.3), không qua runTurn — Đ40 W1]`,
    },
  };
}

/** Chấm một ca Safety. */
async function judgeSafety(c) {
  // Đ40 W1 — S16 đi đường riêng, không gọi runTurn().
  if (c.case_id === REVIEW_REJECT_CASE_ID) return judgeS16ViaReject(c);

  // Đ37 — cùng lý do ở judgeFaq() trên.
  const conversationId = conversationIdFromLabel(`golden-safety-${c.case_id}`);
  // Đ40 W2 — TESTING-ACCEPTANCE §4.4: S14 dùng cờ bơm lỗi 429 CÓ CHỦ ĐÍCH tại
  // A2. Chỉ TRUYỀN cờ cho đúng case này; mọi case khác chạy y như cũ.
  const injectUpstreamError = c.case_id === "S14";
  let result;
  try {
    result = await runTurn({
      conversation_id: conversationId,
      question_vi: c.question_vi,
      principal: DEMO_RESIDENT_PRINCIPAL,
      // Đ44 — cùng lý do ở judgeFaq() trên.
      is_golden_run: true,
      golden_case_id: c.case_id,
      ...(injectUpstreamError ? { forceUpstreamError: "429" } : {}),
    });
  } catch (err) {
    // Đ40 W2 — CHỈ đúng case CÓ cờ bơm lỗi VÀ đúng lớp lỗi được bơm mới coi
    // là lỗi ĐƯỢC MONG ĐỢI. Mọi trường hợp khác (kể cả S14 dính lỗi khác
    // lớp) ném lại NGUYÊN VĂN để `runBatch` phân lập Tầng 1 như bình thường
    // (Đ26) — một 429 THẬT ngoài ý muốn ở BẤT KỲ case nào vẫn phải vào cột
    // `blocked`, không bị hàm này nuốt.
    if (!isExpectedInjectedError(c.case_id, err)) throw err;
    // `runTurn()` đã ghi dòng `answer_turns` (system_error) trong khối
    // `finally` của nó TRƯỚC KHI ném lại lỗi (lib/pipeline/index.ts, không
    // sửa file đó) — đọc lại dòng đó thay vì coi cú throw là ca trượt hạ
    // tầng. Đọc thất bại (DB thật sự có vấn đề) ⇒ vẫn ném lại, không bịa.
    const row = await readLastTurn(conversationId);
    if (!row) throw err;
    result = row;
  }
  // Safety không chấm checkpoint `intent` (SPEC-P00 §6.5 chỉ áp cho FAQ
  // answerable) — bỏ qua đọc lại DB cho ca này, đỡ một round-trip vô ích.
  const scored = judgeSafetyCase(c, {
    decision: result.decision,
    reason_code: result.reason_code,
    gate_triggered: result.gate_triggered,
    detected_intent: null,
    citations: result.citations,
    claims: result.claims,
    answer_vi: result.answer_vi,
  });
  return {
    ok: scored.pass,
    rec: {
      case_id: c.case_id,
      ok: scored.pass,
      decision: result.decision,
      reason_code: result.reason_code ?? null,
      gate: result.gate_triggered ?? null,
      checkpoint_safe_behavior: scored.checkpoint_safe_behavior,
      checkpoint_gate: scored.checkpoint_gate,
      checkpoint_shows_conflict: scored.checkpoint_shows_conflict,
      why: injectUpstreamError ? `${safetyWhy(scored)} [cờ bơm lỗi 429 — Đ40 W2]` : safetyWhy(scored),
    },
  };
}

/**
 * Chạy một bộ (faq hoặc safety) theo lô, nối tiếp checkpoint của các lượt trước.
 */
async function runSet(name, file, judge) {
  const allCases = readJsonl(file);
  // Checkpoint TÁCH THEO BACKEND (Đ24) — số mock và số Postgres không tương
  // đương, dùng chung sổ là trộn hai phép đo khác bản chất.
  const ckptFile = path.join(RUNS_DIR, `${name}.${process.env.DATA_BACKEND}.jsonl`);

  if (argFlag("--fresh") && fs.existsSync(ckptFile)) {
    fs.rmSync(ckptFile);
    console.log(`[${name}] --fresh: đã xoá checkpoint cũ`);
  }
  const ckpt = new Checkpoint(ckptFile);
  const resume = argFlag("--resume");

  // Thứ tự: cắt lô TRƯỚC, rồi mới bỏ ca đã xong. Như vậy `--limit=8 --resume`
  // nghĩa là "8 ca CHƯA LÀM tiếp theo", chứ không phải "8 ca đầu danh sách mà
  // đằng nào cũng đã xong" — nếu không thì lô thứ hai sẽ không chạy gì cả.
  const pool = resume ? allCases.filter((c) => !ckpt.has(c.case_id)) : allCases;
  const picked = sliceCases(pool, (c) => c.case_id).map((c) => ({
    ...c,
    __case_id: c.case_id,
  }));

  if (picked.length === 0) {
    console.log(`[${name}] không còn ca nào để chạy (đã xong ${ckpt.done.size}/${allCases.length})`);
  } else {
    console.log(
      `[${name}] chạy ${picked.length} ca (tổng bộ ${allCases.length}, đã có kết luận ${ckpt.done.size}), song song ${CONCURRENCY}`
    );
  }

  const { blocked, stoppedEarly, quotaHits } = await runBatch(
    picked,
    CONCURRENCY,
    judge,
    ckpt
  );

  // Số M chỉ tính trên các ca ĐÃ CÓ KẾT LUẬN, không lẫn ca bị hạn mức chặn.
  const recs = ckpt.records();
  const byId = new Map(allCases.map((c) => [c.case_id, c]));
  const concluded = recs.filter((r) => byId.has(r.case_id));
  const pass = concluded.filter((r) => r.ok).length;
  const answerableTotal = allCases.filter((c) => c.kind === "answerable").length;
  const answerablePass = concluded.filter(
    (r) => r.ok && byId.get(r.case_id)?.kind === "answerable"
  ).length;

  return {
    name,
    total: allCases.length,
    concluded: concluded.length,
    pass,
    fail: concluded.length - pass,
    answerableTotal,
    answerablePass,
    blocked,
    quotaHits,
    stoppedEarly,
    ckptFile: path.relative(ROOT, ckptFile),
  };
}

// ─────────────────────────────────────────────────────────────────────────

const set = argValue("--set", "all");
if (!["faq", "safety", "all"].includes(set)) {
  console.error(`--set không hợp lệ: "${set}". Chỉ nhận faq | safety | all.`);
  process.exit(2);
}

// Tự nạp `.env.local` rồi chặn nếu thiếu key — TRƯỚC khi chạm checkpoint, để
// một lần quên cờ dòng lệnh không ghi 66 ca trượt giả vào sổ.
loadLocalEnv();
requireEnv(["GEMINI_API_KEY"]);

const BACKEND = printBackendBanner();
if (BACKEND === "postgres") requireEnv(["DATABASE_URL"]);
const runId = crypto.randomUUID();

const summaries = [];
if (set === "faq" || set === "all") {
  summaries.push(await runSet("faq", path.join(GDIR, "golden_faq.jsonl"), judgeFaq));
}
if (set === "safety" || set === "all") {
  summaries.push(
    await runSet("safety", path.join(GDIR, "golden_safety.jsonl"), judgeSafety)
  );
}

console.log("");
for (const s of summaries) {
  const cover = `${s.concluded}/${s.total} ca có kết luận`;
  const extra =
    s.name === "faq" ? ` · answerable ${s.answerablePass}/${s.answerableTotal}` : "";
  console.log(
    `${s.name}: pass ${s.pass} · fail ${s.fail} · blocked ${s.blocked} (${cover})${extra} · checkpoint=${s.ckptFile}`
  );
}
console.log(`run_id=${runId}`);

// Đ40 W1 — BẮT BUỘC nói rõ S16 được xử lý thế nào, không được âm thầm co
// mẫu số M3. `M3` = tỉ lệ pass trên bộ safety, LUÔN có mẫu số = tổng số ca
// safety trong Golden (16, K-M2) — S16 nay đi qua đường rejectAnswer() thật
// (SPEC-P03 §3.3) thay vì bị loại khỏi phép đếm.
const safetySummary = summaries.find((s) => s.name === "safety");
if (safetySummary) {
  console.log(
    `\nS16 (Đ40 W1): đi qua rejectAnswer() thật (SPEC-P03 §3.3), KHÔNG gọi runTurn() ` +
      `(TESTING-ACCEPTANCE §BB-11 dòng 268 — "66 case trừ S16 không gọi runTurn"). ` +
      `Mẫu số M3 = ${safetySummary.total} (đủ 16 ca, KHÔNG loại S16 khỏi phép đếm).`
  );
}

const anyStopped = summaries.some((s) => s.stoppedEarly);
const anyBlocked = summaries.some((s) => s.blocked > 0);
const anyIncomplete = summaries.some((s) => s.concluded < s.total);
const anyFail = summaries.some((s) => s.fail > 0);

if (anyStopped || anyBlocked || anyIncomplete) {
  // Chưa đủ căn cứ để nói bộ này đạt hay trượt — KHÔNG trả 0 và cũng KHÔNG
  // trả 1, vì cả hai đều là phát biểu sai về chất lượng sản phẩm (Đ26).
  console.log(
    "\nCHƯA KẾT LUẬN ĐƯỢC — còn ca chưa chạy hoặc bị hạn mức chặn. " +
      "Chạy tiếp: thêm cờ --resume (tuỳ chọn --limit=N để cắt lô nhỏ hơn)."
  );
  process.exit(3);
}
process.exit(anyFail ? 1 : 0);
