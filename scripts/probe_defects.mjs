#!/usr/bin/env node
// scripts/probe_defects.mjs — K-M6 / G05 / P02-M2: bốn khuyết tật cài sẵn
// (P00) phải kích hoạt đúng reason_code + gate QUA PIPELINE THẬT (SPEC-P02,
// TESTING-ACCEPTANCE §5.3). Đây là số đo quan trọng nhất của cả kế hoạch —
// nó chứng minh P00 và P02 cùng đúng, tại đúng chỗ khó nhất.
//
// BACKEND=mock mặc định (Đ24) — số reason_code/gate CHUYỂN ĐƯỢC sang
// Postgres (quyết định bằng metadata, không bằng xếp hạng); `score_lexical`
// bên dưới thì KHÔNG (chỉ ảnh hưởng thứ tự truy hồi cục bộ).
//
// Đ26 — CHẠY THEO LÔ. Gói P02a dừng ở 2/4 vì hạn mức cạn giữa chừng và bản
// cũ không giữ lại được kết quả hai khuyết tật đã xác nhận. Nay mỗi khuyết
// tật có kết luận được ghi checkpoint ngay, và 429 KHÔNG còn bị in ra thành
// `MISMATCH` (đó là lỗi tầng 1, không phải sai lệch nghiệp vụ — §5.E).
//
//   node scripts/probe_defects.mjs --only=DEF-01      # đo đúng một khuyết tật
//   node scripts/probe_defects.mjs --limit=2          # hai cái một lô
//   node scripts/probe_defects.mjs --resume           # làm nốt cái còn thiếu
//   node scripts/probe_defects.mjs --fresh            # đo lại tất cả từ đầu
//
// Mặc định CHẠY TUẦN TỰ (song song 1): bốn ca này quý, không đáng đánh đổi
// lấy 429 để nhanh hơn vài giây. Đổi bằng PROBE_CONCURRENCY nếu thật cần.
//
// Mã thoát: 0 = cả 4 khớp · 1 = có MISMATCH thật · 3 = chưa đủ 4 kết luận
// (bị hạn mức chặn) — xem `_batch.mjs`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTurn } from "../lib/pipeline/index.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs";
import {
  Checkpoint,
  argFlag,
  loadLocalEnv,
  printBackendBanner,
  requireEnv,
  runBatch,
  sliceCases,
} from "./_batch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONCURRENCY = Math.max(1, Number(process.env.PROBE_CONCURRENCY ?? 1));

// Tự nạp `.env.local` rồi chặn nếu thiếu key — TRƯỚC khi chạm checkpoint.
// Không còn cần `--env-file=.env.local` ở dòng lệnh.
loadLocalEnv();
requireEnv(["GEMINI_API_KEY"]);

const BACKEND = printBackendBanner();
if (BACKEND === "postgres") requireEnv(["DATABASE_URL"]);

// Checkpoint TÁCH THEO BACKEND. Bắt buộc, không phải tiện tay: số chạy trên mock
// và số chạy trên Postgres KHÔNG tương đương (Đ24) — dùng chung một sổ thì
// `--resume` sẽ lấy kết quả mock rồi báo là đã đo xong trên Postgres, tức trộn
// hai phép đo khác bản chất thành một con số không ai kiểm được nữa.
const CKPT_FILE = path.join(ROOT, "evals", "runs", `defects.${BACKEND}.jsonl`);

const defectSpec = JSON.parse(
  fs.readFileSync(path.join(ROOT, "evals", "golden", "expected_defects.json"), "utf8")
);
const allDefects = defectSpec.defects;

if (argFlag("--fresh") && fs.existsSync(CKPT_FILE)) {
  fs.rmSync(CKPT_FILE);
  console.log("--fresh: đã xoá checkpoint cũ");
}
const ckpt = new Checkpoint(CKPT_FILE);
const resume = argFlag("--resume");

const pool = resume ? allDefects.filter((d) => !ckpt.has(d.id)) : allDefects;
const picked = sliceCases(pool, (d) => d.id).map((d) => ({ ...d, __case_id: d.id }));

if (picked.length > 0) {
  console.log(`chạy ${picked.length} khuyết tật (đã có kết luận ${ckpt.done.size}/${allDefects.length})`);
}

let convCounter = ckpt.done.size;

/** Đo một khuyết tật. Lỗi upstream được ném lên cho `runBatch` phân lập —
 *  CẤM biến 429 thành MISMATCH như bản cũ. */
async function probe(def) {
  convCounter++;
  // Đ37 — nhãn dạng chữ băm thành uuid tất định (không `randomUUID()`) trước
  // khi chạm lệnh ghi đầu tiên của `runTurn()` (BB-11).
  const result = await runTurn({
    conversation_id: conversationIdFromLabel(`probe-defects-${def.id}-${convCounter}`),
    question_vi: def.trigger_question_vi,
    principal: DEMO_RESIDENT_PRINCIPAL,
  });
  const okReason = result.reason_code === def.expected_reason_code;
  const okGate = result.gate_triggered === def.expected_gate;
  const ok = okReason && okGate;

  if (ok) {
    console.log(`${def.id} OK ${result.reason_code} ${result.gate_triggered}`);
  } else {
    console.log(
      `${def.id} MISMATCH got=(${result.decision},${result.reason_code},${result.gate_triggered}) ` +
        `expected=(escalate,${def.expected_reason_code},${def.expected_gate})`
    );
  }

  return {
    ok,
    rec: {
      case_id: def.id,
      ok,
      decision: result.decision,
      reason_code: result.reason_code ?? null,
      gate: result.gate_triggered ?? null,
      expected_reason_code: def.expected_reason_code,
      expected_gate: def.expected_gate,
      at: new Date().toISOString(),
    },
  };
}

const { blocked, stoppedEarly } = await runBatch(picked, CONCURRENCY, probe, ckpt);

// In lại TOÀN BỘ kết luận đang có, kể cả từ các lượt chạy trước — đây mới là
// số đo K-M6, không phải riêng lô vừa chạy.
const byId = new Map(ckpt.records().map((r) => [r.case_id, r]));
console.log("");
for (const def of allDefects) {
  const r = byId.get(def.id);
  if (!r) {
    console.log(`${def.id} CHƯA ĐO`);
  } else if (r.ok) {
    console.log(`${def.id} OK ${r.reason_code} ${r.gate}`);
  } else if (r.error_class) {
    // Ca chết bằng exception, không phải chạy xong rồi lệch kết quả. In lớp lỗi
    // thay vì ba chữ `undefined` — bản trước in `got=(undefined,undefined,
    // undefined)`, không nói được gì về căn nguyên.
    console.log(`${def.id} LỖI ${r.error_class}: ${r.error_message ?? ""}`);
  } else {
    console.log(`${def.id} MISMATCH got=(${r.decision},${r.reason_code},${r.gate})`);
  }
}

const concluded = allDefects.filter((d) => byId.has(d.id));
const passed = concluded.filter((d) => byId.get(d.id).ok).length;
const mismatches = concluded.length - passed;

console.log(
  `\nK-M6: ${passed}/${allDefects.length} khuyết tật khớp · ${mismatches} mismatch · ` +
    `${allDefects.length - concluded.length} chưa đo · blocked ${blocked} · ` +
    `checkpoint=${path.relative(ROOT, CKPT_FILE)}`
);

if (stoppedEarly || concluded.length < allDefects.length) {
  console.log(
    "CHƯA KẾT LUẬN ĐƯỢC — còn khuyết tật chưa đo xong. Chạy tiếp: --resume"
  );
  process.exit(3);
}
process.exit(mismatches > 0 ? 1 : 0);
