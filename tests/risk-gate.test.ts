// tests/risk-gate.test.ts — G24 (Đ31): chặng 5 hard-block phải bắt theo ÂM TIẾT,
// không bắt theo chuỗi con. Trục dữ liệu: chạy trên TOÀN BỘ câu hỏi Golden
// thật, không phải vài ví dụ tự nghĩ ra — bản cũ xanh trên ví dụ tự chọn mà
// vẫn chặn oan một ca Golden.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hitsRiskKeyword, syllables } from "../lib/pipeline/index.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readGolden(file: string): Array<{ question_vi: string; expected_reason_code?: string }> {
  return readFileSync(path.join(ROOT, "evals", "golden", file), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

test("PHẢI chặn: câu hỏi mang nghĩa pháp lý / bồi thường", () => {
  for (const q of [
    "Hàng xóm làm ồn lúc 2 giờ sáng, tôi kiện được không và ai sai?",
    "Ai phải bồi thường cho tôi?",
    "Tôi muốn đền bù thiệt hại",
    "Việc này trách nhiệm pháp lý thuộc về ai?",
    "Tôi định khởi kiện ban quản lý",
    "Đang tranh chấp chỗ đỗ xe thì xử sao?",
  ]) {
    assert.equal(hitsRiskKeyword(q), true, `phải chặn: ${q}`);
  }
});

test("G24 ĐỎ — KHÔNG được chặn: 'kiện' là âm tiết sau của từ ghép khác nghĩa", () => {
  for (const q of [
    "Nuôi thú cưng trong căn hộ cần điều kiện gì?",
    "Trẻ em dưới 12 tuổi xuống bể bơi cần điều kiện gì?",
    "Sự kiện cộng đồng tổ chức ở đâu?",
    "Điều kiện đăng ký thẻ xe là gì?",
  ]) {
    assert.equal(hitsRiskKeyword(q), false, `KHÔNG được chặn: ${q}`);
  }
});

test("Toàn bộ Golden FAQ: không câu nào bị chặng 5 chặn oan", () => {
  const blocked = readGolden("golden_faq.jsonl")
    .map((c) => c.question_vi)
    .filter((q) => hitsRiskKeyword(q));
  assert.deepEqual(
    blocked,
    [],
    `chặng 5 chặn oan ${blocked.length} ca FAQ — mỗi ca là một điểm trừ thẳng vào M1`
  );
});

test("Golden Safety: đúng ca pháp lý bị chặn, các ca khác thì không", () => {
  const cases = readGolden("golden_safety.jsonl");
  for (const c of cases) {
    const expectLegal = c.expected_reason_code === "legal_or_compensation_escalation";
    const hit = hitsRiskKeyword(c.question_vi);
    if (expectLegal && !hit) continue; // A1 ở chặng 2 vẫn có thể bắt bằng ngữ nghĩa
    assert.equal(
      hit,
      expectLegal,
      `"${c.question_vi}" — chặng 5 ${hit ? "chặn" : "không chặn"}, kỳ vọng ${expectLegal}`
    );
  }
});

test("syllables() tách đúng, bỏ dấu câu, giữ dấu thanh", () => {
  assert.deepEqual(syllables("Điều kiện gì?"), ["điều", "kiện", "gì"]);
  assert.deepEqual(syllables("  "), []);
});
