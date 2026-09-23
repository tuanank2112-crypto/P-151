#!/usr/bin/env node
// scripts/trace_sample.mjs — chạy một câu hỏi qua pipeline thật và in đúng
// 3 khối agent (SPEC-P02 §5.3, §8; P02-M9 / G08). Dùng `--q "<câu hỏi>"`.
//
// Hai chế độ:
//   --q "<câu hỏi>"  chạy câu MỚI qua pipeline (cần model), đọc result.steps.
//   --id <answer_turn_id>  tra NGƯỢC một lượt đã có: đọc answer_turns.pipeline_steps
//        + 4 tín hiệu (Đ50, H25) bằng SQL — KHÔNG gọi model. Lượt ghi trước Đ50
//        có pipeline_steps = [] ⇒ in rõ và exit 1 (G46). Không tìm thấy ⇒ exit 1.
// Mã thoát: 0 đủ 3 khối có model+ms · 1 thiếu · 2 sai tham số.

import { makeSql } from "./_pg.mjs";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs";

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

process.env.DATA_BACKEND = process.env.DATA_BACKEND ?? "mock";

const turnId = argValue("--id", null);
let result;
if (turnId) {
  if (!process.env.DATABASE_URL) { console.error("--id cần DATABASE_URL (node --env-file=.env.local …)"); process.exit(2); }
  if (!/^[0-9a-f-]{36}$/i.test(turnId)) { console.error(`--id không phải uuid: ${turnId}`); process.exit(2); }
  const sql = makeSql(process.env.DATABASE_URL);
  const rows = await sql(
    `SELECT question_vi, decision, reason_code, gate_triggered, citations, pipeline_steps,
            s1_retrieval_top1, s2_eligible_ratio, s3_faithfulness, s4_conflict, created_at
       FROM answer_turns WHERE id = $1`, [turnId]);
  const r = rows[0];
  if (!r) { console.log(`answer_turn ${turnId}: KHÔNG TỒN TẠI`); process.exit(1); }
  console.log(`BACKEND=postgres (tra ngược theo id, không gọi model) · created_at=${new Date(r.created_at).toISOString()}`);
  console.log(`question: ${r.question_vi}`);
  console.log(`signals: s1=${r.s1_retrieval_top1} s2=${r.s2_eligible_ratio} s3=${r.s3_faithfulness} s4=${r.s4_conflict}`);
  const steps = typeof r.pipeline_steps === "string" ? JSON.parse(r.pipeline_steps) : r.pipeline_steps;
  const cites = typeof r.citations === "string" ? JSON.parse(r.citations) : r.citations;
  result = { steps: steps ?? [], decision: r.decision, reason_code: r.reason_code, gate_triggered: r.gate_triggered, citations: cites ?? [] };
  if (result.steps.length === 0) console.log("pipeline_steps = [] — lượt ghi TRƯỚC Đ50/H25 (G46), không có log chặng.");
} else {
const { runTurn } = await import("../lib/pipeline/index.ts");
const question = argValue("--q", "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?");

console.log(
  process.env.DATA_BACKEND === "postgres"
    ? `BACKEND=postgres — số NGHIỆM THU (chạy trên Postgres thật, Đ24)`
    : `BACKEND=${process.env.DATA_BACKEND} — số định hướng, KHÔNG phải số nghiệm thu (Đ24)`
);
console.log(`question: ${question}`);

// Đ37 — "trace-sample" không phải uuid hợp lệ; `runTurn()` nay ghi
// `answer_turns` ở mọi lượt (BB-11) nên bắt buộc băm nhãn thành uuid tất định.
result = await runTurn({
  conversation_id: conversationIdFromLabel("trace-sample"),
  question_vi: question,
  principal: DEMO_RESIDENT_PRINCIPAL,
});
}

function printBlock(label, step) {
  console.log(`--- ${label} ---`);
  if (!step) {
    console.log("  (không chạy tới chặng này)");
    return;
  }
  console.log(`  step=${step.step} ok=${step.ok} model=${step.model ?? "—"} ms=${step.ms}`);
  console.log(
    `  input_tokens=${step.input_tokens ?? "—"} output_tokens=${step.output_tokens ?? "—"}`
  );
  if (step.note) console.log(`  note=${step.note}`);
}

const byStep = Object.fromEntries(result.steps.map((s) => [s.step, s]));
printBlock("A1 classifier (chặng safety+intent)", byStep.safety);
printBlock("A2 retriever (chặng draft)", byStep.draft);
printBlock("A3 verifier (chặng verify)", byStep.verify);

console.log("--- kết quả ---");
console.log(`decision=${result.decision} reason_code=${result.reason_code ?? "—"}`);
console.log(`gate_triggered=${result.gate_triggered ?? "—"}`);
console.log(`citations=${JSON.stringify(result.citations.map((c) => c.section_id))}`);
console.log(`steps=${result.steps.map((s) => s.step).join(" > ")}`);

const blocks = [byStep.safety, byStep.draft, byStep.verify];
const full = blocks.every((b) => b && b.model && typeof b.ms === "number");
console.log(full ? "G08: 3/3 khối có model+ms" : `G08: ${blocks.filter((b) => b && b.model).length}/3 khối có model`);
process.exitCode = full ? 0 : 1;
