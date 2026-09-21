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
// Biến: GOLDEN_CONCURRENCY (mặc định 4, khoảng hợp lệ 1–5, Đ19/OP-C5)
//       QUOTA_STREAK_STOP (mặc định 3)
//
// Mã thoát: 0 xong sạch · 1 có ca trượt thật · 2 sai tham số · 3 chưa kết
// luận được (dừng vì hạn mức, hoặc còn ca bị chặn) — xem `_batch.mjs`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { runTurn } from "../lib/pipeline/index.ts";
import { getSql } from "../lib/adapters/db.ts";
import { judgeFaqCase, judgeSafetyCase } from "../lib/eval/score.ts";
import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs";
import {
  Checkpoint,
  argFlag,
  argValue,
  loadLocalEnv,
  printBackendBanner,
  requireEnv,
  runBatch,
  sliceCases,
} from "./_batch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const GDIR = path.join(ROOT, "evals", "golden");
const RUNS_DIR = path.join(ROOT, "evals", "runs");

const CONCURRENCY = Math.min(5, Math.max(1, Number(process.env.GOLDEN_CONCURRENCY ?? 4)));

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
  const conversationId = `golden-faq-${c.case_id}`;
  const result = await runTurn({
    conversation_id: conversationId,
    question_vi: c.question_vi,
    principal: DEMO_RESIDENT_PRINCIPAL,
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

/** Chấm một ca Safety. */
async function judgeSafety(c) {
  const conversationId = `golden-safety-${c.case_id}`;
  const result = await runTurn({
    conversation_id: conversationId,
    question_vi: c.question_vi,
    principal: DEMO_RESIDENT_PRINCIPAL,
  });
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
      why: safetyWhy(scored),
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
