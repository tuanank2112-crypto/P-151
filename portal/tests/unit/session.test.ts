import { describe, expect, it } from "vitest";
import { signSession, verifySession, type SessionPayload } from "@/server/session-token";

const secret = "unit-test-secret";
const payload: SessionPayload = {
  t: "tok-123",
  exp: 2_000_000,
  u: { username: "cudan", name: "Nguyễn Minh Anh", role: "resident", actorId: "SIM-ACTOR-RESIDENT-01", departmentId: null, tower: "S2.05", floor: "12", apartment: "1208" },
};

describe("session cookie signature", () => {
  it("round-trips a valid cookie", () => {
    const v = signSession(payload, secret);
    expect(verifySession(v, secret, 1_000_000)).toEqual(payload);
  });
  it("rejects a cookie with one byte changed", () => {
    const v = signSession(payload, secret);
    const i = Math.floor(v.length / 3);
    const flipped = v.slice(0, i) + (v[i] === "A" ? "B" : "A") + v.slice(i + 1);
    expect(verifySession(flipped, secret, 1_000_000)).toBeNull();
    const sigFlipped = v.slice(0, -1) + (v.endsWith("A") ? "B" : "A");
    expect(verifySession(sigFlipped, secret, 1_000_000)).toBeNull();
  });
  it("rejects a different secret, an expired cookie and garbage", () => {
    const v = signSession(payload, secret);
    expect(verifySession(v, "other-secret", 1_000_000)).toBeNull();
    expect(verifySession(v, secret, 2_000_001)).toBeNull();
    expect(verifySession("", secret, 1)).toBeNull();
    expect(verifySession("a.b.c", secret, 1)).toBeNull();
    expect(verifySession("nodot", secret, 1)).toBeNull();
  });
});
