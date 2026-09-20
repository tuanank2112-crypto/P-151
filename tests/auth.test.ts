import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/auth/password.ts";
import { createSessionCookie, verifySessionCookie } from "../lib/auth/session.ts";

test("hashPassword rồi verifyPassword: mật khẩu đúng ⇒ true", async () => {
  const hash = await hashPassword("mat-khau-demo-123");
  const ok = await verifyPassword("mat-khau-demo-123", hash);
  assert.equal(ok, true);
});

test("verifyPassword: mật khẩu sai ⇒ false", async () => {
  const hash = await hashPassword("mat-khau-demo-123");
  const ok = await verifyPassword("mat-khau-sai", hash);
  assert.equal(ok, false);
});

test("cookie phiên hợp lệ: ký rồi xác minh trả đúng payload", () => {
  process.env.SESSION_SECRET = "test-secret-du-32-byte-cho-hmac-sha256!!";
  const payload = {
    user_id: "u1",
    role: "resident" as const,
    resident_id: "R-0001",
    owned_property_ids: ["S1.120817"],
    property_type: ["apartment" as const],
  };
  const cookie = createSessionCookie(payload);
  const verified = verifySessionCookie(cookie);
  assert.deepEqual(verified, payload);
});

test("cookie phiên bị sửa 1 byte ⇒ verify trả về null (false)", () => {
  process.env.SESSION_SECRET = "test-secret-du-32-byte-cho-hmac-sha256!!";
  const payload = {
    user_id: "u1",
    role: "bql" as const,
    resident_id: null,
    owned_property_ids: [],
    property_type: [],
  };
  const cookie = createSessionCookie(payload);
  const lastChar = cookie.slice(-1);
  const tamperedChar = lastChar === "a" ? "b" : "a";
  const tampered = cookie.slice(0, -1) + tamperedChar;
  const verified = verifySessionCookie(tampered);
  assert.equal(verified, null);
});

test("verifySessionCookie: thiếu cookie ⇒ null, không ném lỗi dù thiếu SESSION_SECRET", () => {
  delete process.env.SESSION_SECRET;
  const verified = verifySessionCookie(null);
  assert.equal(verified, null);
});
