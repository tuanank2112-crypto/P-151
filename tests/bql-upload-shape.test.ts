// tests/bql-upload-shape.test.ts — item 3 (handoff nối tiếp H07): "chỉ nhận
// đúng hình dạng dữ liệu của knowledge/: thiếu trường bắt buộc thì từ chối
// tử tế, không ghi nửa vời vào DB". Canh THUẦN `validateUploadDocumentShape`
// (không chạm DB) — đúng hình dạng `knowledge/manifest.json` +
// `knowledge/sections/*.json` (SPEC-P03 §2.2).

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUploadDocumentShape } from "../lib/adapters/bql-store.ts";

const VALID_SECTION = {
  section_id: "TEST-SEC-01",
  ordinal: 1,
  heading_vi: "Tiêu đề mục thử",
  body_vi:
    "Đây là nội dung mục thử dùng cho test hình dạng dữ liệu, đủ dài để qua ràng buộc từ 60 tới 900 ký tự theo đúng bảng lỗi của SPEC-P03 mục 4.",
  intents: ["I-03"],
  facility_ids: [],
  conflict_group: null,
};

const VALID_DOC = {
  document_id: "TEST-DOC-01",
  title_vi: "Tài liệu thử",
  doc_kind: "rules",
  version: "1.0",
  scope_property: ["apartment"],
  effective_from: "2026-01-01",
  effective_to: null,
  sections: [VALID_SECTION],
};

test("validateUploadDocumentShape: đúng hình dạng knowledge/ ⇒ ok:true", () => {
  const result = validateUploadDocumentShape(VALID_DOC);
  assert.equal(result.ok, true);
});

test("validateUploadDocumentShape: thiếu document_id ⇒ ok:false, code=MissingField", () => {
  const { document_id, ...rest } = VALID_DOC;
  const result = validateUploadDocumentShape(rest);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MissingField");
});

test("validateUploadDocumentShape: doc_kind lạ (ngoài 4 giá trị) ⇒ ok:false", () => {
  const result = validateUploadDocumentShape({ ...VALID_DOC, doc_kind: "khong-hop-le" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MissingField");
});

test("validateUploadDocumentShape: scope_property chứa giá trị lạ ⇒ ok:false", () => {
  const result = validateUploadDocumentShape({ ...VALID_DOC, scope_property: ["moon-base"] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MissingField");
});

test("validateUploadDocumentShape: effective_from sai định dạng ⇒ ok:false", () => {
  const result = validateUploadDocumentShape({ ...VALID_DOC, effective_from: "01/01/2026" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MissingField");
});

test("validateUploadDocumentShape: sections rỗng ⇒ ok:false", () => {
  const result = validateUploadDocumentShape({ ...VALID_DOC, sections: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MissingField");
});

test("validateUploadDocumentShape: body_vi ngắn hơn 60 ký tự ⇒ ok:false, code=BodyLength", () => {
  const result = validateUploadDocumentShape({
    ...VALID_DOC,
    sections: [{ ...VALID_SECTION, body_vi: "Quá ngắn." }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BodyLength");
});

test("validateUploadDocumentShape: body_vi dài hơn 900 ký tự ⇒ ok:false, code=BodyLength", () => {
  const result = validateUploadDocumentShape({
    ...VALID_DOC,
    sections: [{ ...VALID_SECTION, body_vi: "a".repeat(901) }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BodyLength");
});

test("validateUploadDocumentShape: section_id trùng trong cùng lượt gửi ⇒ ok:false, code=DuplicateSectionId", () => {
  const result = validateUploadDocumentShape({
    ...VALID_DOC,
    sections: [VALID_SECTION, { ...VALID_SECTION, ordinal: 2 }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "DuplicateSectionId");
});

test("validateUploadDocumentShape: ordinal không phải số nguyên ⇒ ok:false", () => {
  const result = validateUploadDocumentShape({
    ...VALID_DOC,
    sections: [{ ...VALID_SECTION, ordinal: "1" }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MissingField");
});

test("validateUploadDocumentShape: input gốc không phải object ⇒ ok:false", () => {
  const result = validateUploadDocumentShape("khong-phai-object");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MissingField");
});
