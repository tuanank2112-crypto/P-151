import { describe, expect, it } from "vitest";
import { autoGates, type GateInput } from "@/lib/inspection";

const base: GateInput = {
  dept: "ky_thuat",
  disputed: false,
  urgent: false,
  afterPhotos: [{ id: 1 }],
  materials: [{ item: "Bóng đèn LED", received: true }],
  doneHours: 20,
};
const ok = (t: GateInput) => Object.fromEntries(autoGates(t).map((g) => [g.key, g.ok]));

describe("autoGates", () => {
  it("passes every gate for a clean, on-time ticket with evidence", () => {
    expect(ok(base)).toEqual({ dept: true, photo: true, material: true, sla: true });
  });

  it("fails the photo gate when no after photo was uploaded (no hardcoded tick)", () => {
    expect(ok({ ...base, afterPhotos: [] }).photo).toBe(false);
  });

  it("fails the material gate while any requested item is still waiting for the warehouse", () => {
    const g = autoGates({ ...base, materials: [{ item: "A", received: true }, { item: "B", received: false }] });
    expect(g.find((x) => x.key === "material")).toMatchObject({ ok: false, detail: "Còn 1/2 món chờ kho cấp" });
  });

  it("passes the material gate when nothing was requested", () => {
    expect(ok({ ...base, materials: [] }).material).toBe(true);
  });

  it("fails the dept gate on a dispute or a missing department", () => {
    expect(ok({ ...base, disputed: true }).dept).toBe(false);
    expect(ok({ ...base, dept: null }).dept).toBe(false);
  });

  it("measures SLA on the time the work was reported done (4h urgent / 48h normal)", () => {
    expect(ok({ ...base, urgent: true, doneHours: 5 }).sla).toBe(false);
    expect(ok({ ...base, urgent: true, doneHours: 4 }).sla).toBe(true);
    expect(ok({ ...base, doneHours: null }).sla).toBe(false);
  });
});
