import { describe, expect, it } from "vitest";
import { buildingOf } from "@/lib/building";
import { bqlBox, decideRank, deptLoad, listGroup, LIST_GROUPS } from "@/lib/bql-view";
import { stockLevel } from "@/lib/stock";

describe("buildingOf (01 §2)", () => {
  it("reads S1/S2, a sub-building counts as its building, case does not matter", () => {
    expect(buildingOf("Tòa S1 · Tầng 3")).toBe("S1");
    expect(buildingOf("Tòa S2.05 · Trong thang máy")).toBe("S2");
    expect(buildingOf("toa s1.12 tang 4")).toBe("S1");
  });
  it("takes the first text that names a building, else null", () => {
    expect(buildingOf("", "Hành lang tầng 3 tòa S2")).toBe("S2");
    expect(buildingOf("Tòa S2", "tòa S1")).toBe("S2");
    expect(buildingOf("Sảnh chính", undefined, null)).toBeNull();
    expect(buildingOf("S12 không phải tòa")).toBeNull();
  });
});

const row = (o: Partial<Parameters<typeof listGroup>[0]> = {}) => ({
  cancelled: false, merged: false, stage: 2, blockerCode: null as string | null, bqlWork: false, ...o,
});

describe("bqlBox and listGroup (01 §3)", () => {
  it("emergency, wrong department and out-of-scope work need the BQL", () => {
    expect(bqlBox(row({ blockerCode: "EMERGENCY_PENDING_BQL" }))).toBe("decide");
    expect(bqlBox(row({ stage: 2, blockerCode: "WRONG_DEPT_AFTER_START" }))).toBe("decide");
    expect(bqlBox(row({ bqlWork: true }))).toBe("decide");
    expect(listGroup(row({ blockerCode: "EMERGENCY_PENDING_BQL" }))).toBe("bql");
  });
  it("stage 5 is review, stage 6 is done, cancelled is in no BQL box", () => {
    expect(bqlBox(row({ stage: 5 }))).toBe("review");
    expect(bqlBox(row({ stage: 6 }))).toBe("done");
    expect(bqlBox(row({ stage: 6, cancelled: true }))).toBeNull();
    expect(bqlBox(row({ stage: 3 }))).toBeNull();
  });
  it("listGroup is a partition: every sample row lands in exactly one known group", () => {
    const samples = [
      row(), row({ blockerCode: "EMERGENCY_PENDING_BQL" }), row({ stage: 3 }), row({ stage: 4 }), row({ stage: 5 }),
      row({ stage: 6 }), row({ cancelled: true, stage: 4 }), row({ merged: true, stage: 1 }),
    ];
    const keys = LIST_GROUPS.map((g) => g.key);
    const groups = samples.map(listGroup);
    expect(groups.every((g) => keys.includes(g))).toBe(true);
    expect(groups).toEqual(["waiting", "bql", "processing", "processing", "review", "closed", "cancelled", "cancelled"]);
  });
  it("emergencies come first inside 'Cần BQL quyết'", () => {
    expect(decideRank({ blockerCode: "EMERGENCY_PENDING_BQL" })).toBeLessThan(decideRank({ blockerCode: "WRONG_DEPT_AFTER_START" }));
    expect(decideRank({ blockerCode: "WRONG_DEPT_AFTER_START" })).toBeLessThan(decideRank({ blockerCode: "OUT_OF_SCOPE" }));
  });
});

describe("deptLoad", () => {
  it("counts waiting-to-accept, in-progress and late of one department, not cancelled or finished", () => {
    const rows = [
      { dept: "ky_thuat" as const, cancelled: false, stage: 3, late: false },
      { dept: "ky_thuat" as const, cancelled: false, stage: 4, late: true },
      { dept: "ky_thuat" as const, cancelled: true, stage: 4, late: true },
      { dept: "ky_thuat" as const, cancelled: false, stage: 5, late: false },
      { dept: "ve_sinh" as const, cancelled: false, stage: 3, late: false },
    ];
    expect(deptLoad(rows, "ky_thuat")).toEqual({ waitingAccept: 1, inProgress: 1, late: 1, open: 2 });
  });
});

describe("stockLevel (01 §5)", () => {
  it("unknown, out, low, ok", () => {
    expect(stockLevel(null, 5)).toBe("unknown");
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(4, 5)).toBe("low");
    expect(stockLevel(5, 5)).toBe("low");
    expect(stockLevel(6, 5)).toBe("ok");
  });
  it("without a threshold there is no 'low'", () => {
    expect(stockLevel(1, null)).toBe("ok");
    expect(stockLevel(0, null)).toBe("out");
  });
});
