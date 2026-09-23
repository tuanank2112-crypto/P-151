// tests/eligibility-d56.test.ts — Đ56 (01-CONTRACTS §5, dòng E-5 và E-6).
//
// Hai thay đổi hợp đồng, canh cả chiều "được mở" lẫn chiều "không được nới":
//   W1 — E-6 theo loại BĐS câu hỏi NÊU THẲNG (từ điển tất định, không LLM).
//        Câu không nêu loại nào ⇒ vẫn lọc theo `principal.property_type`.
//   W2 — E-5: mọi thành viên nhóm mâu thuẫn vẫn bị LOẠI (`conflict`), nhưng
//        chỉ BÁO (`conflict_groups` ≠ ∅ ⇒ G1) khi chunk hạng cao nhất của tập
//        đã qua E-1..E-4/E-6 thuộc nhóm đó.
//
// Chạy trên kho MOCK (`knowledge/` thật), không gọi model. Import dạng
// namespace để khi hàm chưa tồn tại (mã cũ) test ĐỎ ở assert, không vỡ link.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as eligMod from "../lib/pipeline/eligibility.ts";
import type { Principal, RetrievedChunk } from "../lib/types.ts";

process.env.DATA_BACKEND = "mock";

const APARTMENT_RESIDENT: Principal = {
  user_id: "u-d56",
  role: "resident",
  resident_id: "R-0001",
  owned_property_ids: ["S1.120817"],
  property_type: ["apartment"],
};
const NOW = new Date("2026-09-23T00:00:00.000Z");

// Hàm có thể chưa tồn tại trên mã cũ — gọi qua namespace.
const mentioned = (q: string): unknown =>
  (eligMod as unknown as { mentionedPropertyTypes?: (q: string) => string[] }).mentionedPropertyTypes?.(q);

// Chữ ký mới nhận thêm `queryVi` (tham số thứ 4, tuỳ chọn).
const applyElig = eligMod.applyEligibility as unknown as (
  r: RetrievedChunk[],
  p: Principal,
  n: Date,
  q?: string
) => Promise<eligMod.EligibilityResult>;

function chunk(section_id: string, document_id: string, score: number): RetrievedChunk {
  return { chunk_id: `${section_id}#0`, section_id, document_id, content_vi: section_id, score };
}

// ── W1 — mentionedPropertyTypes ─────────────────────────────────────────────

test("Đ56 W1 — 'Hàng rào mặt tiền biệt thự…' ⇒ ['villa']", () => {
  assert.deepEqual(mentioned("Hàng rào mặt tiền biệt thự được cao tối đa bao nhiêu?"), ["villa"]);
});

test("Đ56 W1 — 'Khu Thương mại dịch vụ…' ⇒ ['commercial']", () => {
  assert.deepEqual(mentioned("Khu Thương mại dịch vụ hoạt động đến mấy giờ?"), ["commercial"]);
});

test("Đ56 W1 — 'Nuôi thú cưng trong căn hộ…' ⇒ ['apartment']", () => {
  assert.deepEqual(mentioned("Nuôi thú cưng trong căn hộ có được không?"), ["apartment"]);
});

test("Đ56 W1 — 'Nuôi thú cưng cần điều kiện gì?' (không nêu loại) ⇒ []", () => {
  assert.deepEqual(mentioned("Nuôi thú cưng cần điều kiện gì?"), []);
});

test("Đ56 W1 — so khớp không dấu, không phân biệt hoa thường; shophouse/ki-ốt/kiot/chung cư", () => {
  assert.deepEqual(mentioned("HANG RAO BIET THU cao bao nhieu"), ["villa"]);
  assert.deepEqual(mentioned("Shophouse được mở cửa mấy giờ?"), ["commercial"]);
  assert.deepEqual(mentioned("Ki-ốt tầng 1 thuê thế nào?"), ["commercial"]);
  assert.deepEqual(mentioned("kiot có được bán đồ ăn không"), ["commercial"]);
  assert.deepEqual(mentioned("Chung cư có cho nuôi chó không?"), ["apartment"]);
});

// ── W1 — applyEligibility dùng loại câu hỏi nêu thẳng ──────────────────────

test("Đ56 W1 — principal apartment + chunk scope {villa} + câu có 'biệt thự' ⇒ eligible", async () => {
  const r = await applyElig(
    [chunk("VIL-FENCE-02", "OCP1-VILLA-HOUSING-RULES-001", 0.9)],
    APARTMENT_RESIDENT,
    NOW,
    "Hàng rào mặt tiền biệt thự được cao tối đa bao nhiêu?"
  );
  assert.deepEqual(r.eligible.map((c) => c.section_id), ["VIL-FENCE-02"]);
  assert.equal(r.rejection_histogram.scope_mismatch, 0);
});

test("Đ56 W1 — cùng chunk {villa}, câu KHÔNG nêu loại ⇒ vẫn scope_mismatch (theo principal)", async () => {
  const r = await applyElig(
    [chunk("VIL-FENCE-02", "OCP1-VILLA-HOUSING-RULES-001", 0.9)],
    APARTMENT_RESIDENT,
    NOW,
    "Hàng rào mặt tiền được cao tối đa bao nhiêu?"
  );
  assert.equal(r.eligible.length, 0);
  assert.deepEqual(r.rejected.map((x) => x.reason), ["scope_mismatch"]);
});

// ── W2 — E-5 chỉ báo khi nguồn hạng cao nhất bị tranh chấp ─────────────────

test("Đ56 W2 — [BOOK, CAP-01, AMEN-07]: nhóm đi ngang ⇒ conflict_groups=[], thành viên nhóm bị loại 'conflict', BOOK eligible", async () => {
  const r = await applyElig(
    [
      chunk("BBQ-BOOK-02", "OCP1-BBQ-GARDEN-RULES-001", 0.9),
      chunk("BBQ-CAP-01", "OCP1-BBQ-GARDEN-RULES-001", 0.8),
      chunk("BLD-AMEN-07", "OCP1-BUILDING-RULES-001", 0.7),
    ],
    APARTMENT_RESIDENT,
    NOW,
    "Vườn Nướng BBQ mỗi hộ được đặt tối đa mấy lượt một tuần?"
  );
  assert.deepEqual(r.conflict_groups, []);
  assert.deepEqual(r.eligible.map((c) => c.section_id), ["BBQ-BOOK-02"]);
  const conflictRejected = r.rejected.filter((x) => x.reason === "conflict").map((x) => x.chunk.section_id).sort();
  assert.deepEqual(conflictRejected, ["BBQ-CAP-01", "BLD-AMEN-07"]);
  assert.equal(r.rejection_histogram.conflict, 2);
  assert.equal(r.top_rejected_reason, null);
});

test("Đ56 W2 — [CAP-01, BOOK, AMEN-07]: nguồn hạng 1 bị tranh chấp ⇒ conflict_groups=['CG-BBQ-CAPACITY']", async () => {
  const r = await applyElig(
    [
      chunk("BBQ-CAP-01", "OCP1-BBQ-GARDEN-RULES-001", 0.9),
      chunk("BBQ-BOOK-02", "OCP1-BBQ-GARDEN-RULES-001", 0.8),
      chunk("BLD-AMEN-07", "OCP1-BUILDING-RULES-001", 0.7),
    ],
    APARTMENT_RESIDENT,
    NOW,
    "Vườn BBQ cho tối đa bao nhiêu người một lượt?"
  );
  assert.deepEqual(r.conflict_groups, ["CG-BBQ-CAPACITY"]);
  const conflictRejected = r.rejected.filter((x) => x.reason === "conflict").map((x) => x.chunk.section_id).sort();
  assert.deepEqual(conflictRejected, ["BBQ-CAP-01", "BLD-AMEN-07"]);
  assert.equal(r.top_rejected_reason, "conflict");
});

test("Đ56 W2 — hạng 1 bị loại ở E-6 thì 'cao nhất' tính trên tập ĐÃ QUA E-1..E-4/E-6", async () => {
  // Principal villa: BLD (scope {apartment}) rớt E-6 ⇒ nhóm chỉ còn 1 section
  // ⇒ không mâu thuẫn. Thêm VIL (bị loại E-6 với principal apartment) ở hạng 1:
  // tập qua lượt đầu bắt đầu bằng CAP-01 ⇒ vẫn phải báo nhóm.
  const r = await applyElig(
    [
      chunk("VIL-FENCE-02", "OCP1-VILLA-HOUSING-RULES-001", 0.95),
      chunk("BBQ-CAP-01", "OCP1-BBQ-GARDEN-RULES-001", 0.9),
      chunk("BBQ-BOOK-02", "OCP1-BBQ-GARDEN-RULES-001", 0.8),
      chunk("BLD-AMEN-07", "OCP1-BUILDING-RULES-001", 0.7),
    ],
    APARTMENT_RESIDENT,
    NOW,
    "Vườn BBQ cho tối đa bao nhiêu người một lượt?"
  );
  assert.deepEqual(r.conflict_groups, ["CG-BBQ-CAPACITY"]);
  assert.equal(r.top_rejected_reason, "scope_mismatch");
});

// Đ56b (SO, rủi ro R31): "hạng cao nhất" tính theo ĐIỂM. Thành viên nhóm mâu
// thuẫn ĐỒNG ĐIỂM với chunk đứng đầu — dù không đứng đầu — vẫn làm báo G1,
// vì SQL không có khoá phụ và thứ tự chunk đồng điểm có thể đổi sau seed.
test("Đ56b — [BOOK 0.375, AMEN-07 0.375, CAP-01 0.2]: nhóm mâu thuẫn đồng điểm hạng 1 ⇒ vẫn báo G1", async () => {
  const r = await applyElig(
    [
      chunk("BBQ-BOOK-02", "OCP1-BBQ-GARDEN-RULES-001", 0.375),
      chunk("BLD-AMEN-07", "OCP1-BUILDING-RULES-001", 0.375),
      chunk("BBQ-CAP-01", "OCP1-BBQ-GARDEN-RULES-001", 0.2),
    ],
    APARTMENT_RESIDENT,
    NOW,
    "Vườn BBQ cho tối đa bao nhiêu người một lượt?"
  );
  assert.deepEqual(r.conflict_groups, ["CG-BBQ-CAPACITY"]);
});

test("Đ56b — [BOOK 0.5, AMEN-07 0.375, CAP-01 0.2]: nhóm mâu thuẫn THẤP điểm hơn hạng 1 ⇒ không báo", async () => {
  const r = await applyElig(
    [
      chunk("BBQ-BOOK-02", "OCP1-BBQ-GARDEN-RULES-001", 0.5),
      chunk("BLD-AMEN-07", "OCP1-BUILDING-RULES-001", 0.375),
      chunk("BBQ-CAP-01", "OCP1-BBQ-GARDEN-RULES-001", 0.2),
    ],
    APARTMENT_RESIDENT,
    NOW,
    "Vườn Nướng BBQ mỗi hộ được đặt tối đa mấy lượt một tuần?"
  );
  assert.deepEqual(r.conflict_groups, []);
});
