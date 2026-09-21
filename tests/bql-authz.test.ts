// tests/bql-authz.test.ts — W4 (handoff H07): phân quyền gói BQL (E5
// AuthzError, 00-ARCHITECTURE.md §8). Canh hàm THUẦN `checkBqlAuthz` dùng
// chung ở mọi Server Action của app/(bql)/documents/actions.ts và
// app/(bql)/review/actions.ts.
//
// Bằng chứng ĐỎ bắt buộc (luật §3 handoff): đã chạy lại bộ test này sau khi
// tạm thời gỡ lớp chặn (`checkBqlAuthz` trả `{ ok: true }` vô điều kiện) và
// dán output đỏ vào evidence/p03/w4-authz-red.txt trước khi phục hồi mã gốc.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBqlAuthz } from "../lib/adapters/bql-store.ts";

test("checkBqlAuthz: không có phiên ⇒ chặn, http_status=401", () => {
  const verdict = checkBqlAuthz(null);
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.http_status, 401);
});

test("checkBqlAuthz: vai resident ⇒ chặn, http_status=403", () => {
  const verdict = checkBqlAuthz({
    user_id: "u-resident",
    role: "resident",
    resident_id: "R-0001",
    owned_property_ids: ["S1.120817"],
    property_type: ["apartment"],
  });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.http_status, 403);
});

test("checkBqlAuthz: vai bql ⇒ cho qua", () => {
  const verdict = checkBqlAuthz({
    user_id: "u-bql",
    role: "bql",
    resident_id: null,
    owned_property_ids: [],
    property_type: [],
  });
  assert.equal(verdict.ok, true);
});
