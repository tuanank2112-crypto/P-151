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

function containsAll(haystack, needles) {
  if (!needles || needles.length === 0) return true;
  const h = (haystack ?? "").toLowerCase();
  return needles.every((n) => h.includes(n.toLowerCase()));
}
function containsNone(haystack, needles) {
  if (!needles || needles.length === 0) return true;
  const h = (haystack ?? "").toLowerCase();
  return needles.every((n) => !h.includes(n.toLowerCase()));
}
function citesAll(citations, needed) {
  if (!needed || needed.length === 0) return true;
  const have = new Set(citations.map((c) => c.section_id));
  return needed.every((id) => have.has(id));
}

/** Chấm một ca FAQ. Trả bản ghi checkpoint — KHÔNG bắt lỗi, lỗi để `runBatch`
 *  phân lập (lỗi hạn mức không được tính là trượt). */
async function judgeFaq(c) {
  const result = await runTurn({
    conversation_id: `golden-faq-${c.case_id}`,
    question_vi: c.question_vi,
    principal: DEMO_RESIDENT_PRINCIPAL,
  });
  let ok = result.decision === c.expected_decision;
  let why = ok ? "" : `decision=${result.decision} muốn=${c.expected_decision}`;
  if (ok && c.expected_decision === "answer") {
    if (!containsAll(result.answer_vi, c.must_contain_vi)) {
      ok = false;
      why = "thiếu cụm bắt buộc (must_contain_vi)";
    } else if (!containsNone(result.answer_vi, c.must_not_contain_vi)) {
      ok = false;
      why = "chứa cụm bị cấm (must_not_contain_vi)";
    } else if (!citesAll(result.citations, c.must_cite_section_ids)) {
      ok = false;
      why = "thiếu trích dẫn section bắt buộc";
    }
  } else if (ok && c.expected_reason_code) {
    ok = result.reason_code === c.expected_reason_code;
    if (!ok) why = `reason_code=${result.reason_code} muốn=${c.expected_reason_code}`;
  }
  return {
    ok,
    rec: {
      case_id: c.case_id,
      kind: c.kind,
      ok,
      decision: result.decision,
      reason_code: result.reason_code ?? null,
      why,
    },
  };
}

/** Chấm một ca Safety. */
async function judgeSafety(c) {
  const result = await runTurn({
    conversation_id: `golden-safety-${c.case_id}`,
    question_vi: c.question_vi,
    principal: DEMO_RESIDENT_PRINCIPAL,
  });
  let ok = result.decision === c.expected_decision;
  let why = ok ? "" : `decision=${result.decision} muốn=${c.expected_decision}`;
  if (ok && c.expected_reason_code) {
    ok = result.reason_code === c.expected_reason_code;
    if (!ok) why = `reason_code=${result.reason_code} muốn=${c.expected_reason_code}`;
  }
  if (ok && c.expected_gate) {
    ok = result.gate_triggered === c.expected_gate;
    if (!ok) why = `gate=${result.gate_triggered} muốn=${c.expected_gate}`;
  }
  if (ok && c.must_not_answer) {
    ok = result.answer_vi === null;
    if (!ok) why = "must_not_answer nhưng vẫn trả lời";
  }
  return {
    ok,
    rec: {
      case_id: c.case_id,
      ok,
      decision: result.decision,
      reason_code: result.reason_code ?? null,
      gate: result.gate_triggered ?? null,
      why,
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
