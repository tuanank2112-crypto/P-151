// tests/eligibility-top.test.ts — Đ28, trục DỮ LIỆU THẬT (khác hình dạng với
// tests/confidence.test.ts vốn là hàm thuần): chạy truy hồi + eligibility trên
// `knowledge/` thật qua kho mock, không gọi model.
//
// Canh đúng một thứ: `top_rejected_reason` có phản ánh đúng chunk XẾP HẠNG 1
// hay không. Đây là tín hiệu mà cổng G3 dựa vào để tách
// `source_expired_or_unknown` khỏi `no_eligible_source` (vá DEF-04).

import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve, TOP_K } from "../lib/pipeline/retrieval.ts";
import { applyEligibility } from "../lib/pipeline/eligibility.ts";
import type { Principal } from "../lib/types.ts";

const RESIDENT: Principal = {
  user_id: "u-test",
  role: "resident",
  resident_id: "r-test",
  owned_property_ids: ["P-A1201"],
  property_type: ["apartment"],
};
const NOW = new Date("2026-09-21T00:00:00.000Z");

/** Các dạng chuẩn hoá mà A1 thực tế sinh ra cho câu hỏi DEF-04. Ca này cố ý
 *  KHÔNG chỉ dùng câu hỏi gốc: bản gốc truy hồi ra đúng 2 chunk hết hiệu lực
 *  (rơi vào G2), còn bản đã chuẩn hoá kéo thêm chunk hợp lệ (rơi vào G3) —
 *  chính chỗ lệch đã làm DEF-04 báo sai mã. */
const DEF04_QUERIES = [
  "Bể bơi mở cửa từ mấy giờ đến mấy giờ?",
  "giờ mở cửa bể bơi",
  "bể bơi giờ mở cửa",
  "thời gian mở cửa bể bơi",
  "giờ hoạt động bể bơi",
  "bể bơi mở cửa mấy giờ",
];

for (const q of DEF04_QUERIES) {
  test(`DEF-04 — chunk hạng 1 bị loại vì hết hiệu lực: "${q}"`, async () => {
    const retrieved = await retrieve(q, TOP_K);
    assert.ok(retrieved.length > 0, "truy hồi rỗng — kho mock không nạp được knowledge/");
    const elig = await applyEligibility(retrieved, RESIDENT, NOW);
    assert.equal(
      elig.top_rejected_reason,
      "expired_or_unknown",
      `top1=${retrieved[0]?.section_id} — nguồn khớp nhất phải là tài liệu đã hết hiệu lực`
    );
    assert.equal(retrieved[0]?.document_id, "OCP1-POOL-RULES-2024");
  });
}

const DEF02_QUERIES = [
  "Làm lại thẻ xe máy bị mất thì mất bao nhiêu tiền?",
  "phí cấp lại thẻ xe máy",
  "thẻ xe máy mất phí bao nhiêu",
];

for (const q of DEF02_QUERIES) {
  test(`DEF-02 đối chứng — chunk hạng 1 hợp lệ, không được báo hết hiệu lực: "${q}"`, async () => {
    const retrieved = await retrieve(q, TOP_K);
    assert.ok(retrieved.length > 0);
    const elig = await applyEligibility(retrieved, RESIDENT, NOW);
    assert.equal(
      elig.top_rejected_reason,
      null,
      `top1=${retrieved[0]?.section_id} — vá DEF-04 KHÔNG được làm DEF-02 đổi mã`
    );
  });
}

test("tập truy hồi rỗng ⇒ top_rejected_reason = null, không ném", async () => {
  const elig = await applyEligibility([], RESIDENT, NOW);
  assert.equal(elig.top_rejected_reason, null);
  assert.equal(elig.eligible.length, 0);
});
