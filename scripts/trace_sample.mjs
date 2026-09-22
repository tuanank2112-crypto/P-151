#!/usr/bin/env node
// scripts/trace_sample.mjs — chạy một câu hỏi qua pipeline thật và in đúng
// 3 khối agent (SPEC-P02 §5.3, §8; P02-M9 / G08). Dùng `--q "<câu hỏi>"`.
//
// GIỚI HẠN GÓI P02a (mock): chưa có bảng `answer_turns` (Đ24), nên KHÔNG
// nhận `<answer_turn_id>` để tra cứu ngược — chạy TRỰC TIẾP một câu hỏi mới,
// đọc `result.steps` ngay từ `runTurn()`.

import { runTurn } from "../lib/pipeline/index.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs";

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

process.env.DATA_BACKEND = process.env.DATA_BACKEND ?? "mock";

const question = argValue("--q", "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?");

console.log(
  process.env.DATA_BACKEND === "postgres"
    ? `BACKEND=postgres — số NGHIỆM THU (chạy trên Postgres thật, Đ24)`
    : `BACKEND=${process.env.DATA_BACKEND} — số định hướng, KHÔNG phải số nghiệm thu (Đ24)`
);
console.log(`question: ${question}`);

// Đ37 — "trace-sample" không phải uuid hợp lệ; `runTurn()` nay ghi
// `answer_turns` ở mọi lượt (BB-11) nên bắt buộc băm nhãn thành uuid tất định.
const result = await runTurn({
  conversation_id: conversationIdFromLabel("trace-sample"),
  question_vi: question,
  principal: DEMO_RESIDENT_PRINCIPAL,
});

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

process.exitCode = 0;
