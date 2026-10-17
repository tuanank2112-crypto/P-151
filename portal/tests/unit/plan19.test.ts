import { describe, expect, it } from "vitest";
import { buildingOf } from "@/lib/building";
import { bqlBox, decideRank, deptLoad, headline, listGroup, LIST_GROUPS } from "@/lib/bql-view";
import { byUrgency, restockTone, stockLevel } from "@/lib/stock";
import { filterHistory, toggle } from "@/lib/history-filter";

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
    expect(bqlBox(row({ stage: 6, blockerCode: "EMERGENCY_PENDING_BQL" }))).toBe("done");
    expect(bqlBox(row({ stage: 6, bqlWork: true }))).toBe("done");
    expect(bqlBox(row({ stage: 6, blockerCode: "WRONG_DEPT_AFTER_START" }))).toBe("done");
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

describe("headline (A3)", () => {
  it("title, then raw text, then the first content line; a blank report says it waits for the resident", () => {
    expect(headline({ title: "Đèn hỏng", text: "x", content: "" })).toBe("Đèn hỏng");
    expect(headline({ title: "  ", text: "Rác hành lang", content: "" })).toBe("Rác hành lang");
    expect(headline({ title: "", text: "", content: "Dòng một\nDòng hai" })).toBe("Dòng một");
    expect(headline({ title: "", text: "   ", content: "" })).toBe("Chưa có nội dung, chờ cư dân bổ sung");
  });
});

describe("filterHistory (D10)", () => {
  const r = (code: string, stage: number, location: string) => ({ code, stage, title: "Đèn hỏng", content: "", location });
  const rows = [r("A1", 6, "Tòa S1"), r("A2", 5, "Tòa S2"), r("A3", 6, "Tòa S2"), r("A4", 6, "Sảnh")];
  const bOf = (t: { location: string }) => (t.location.includes("S1") ? "S1" : t.location.includes("S2") ? "S2" : "other") as "S1" | "S2" | "other";
  const codes = (f: Partial<Parameters<typeof filterHistory>[1]>) =>
    filterHistory(rows, { buildings: [], statuses: [], query: "", ...f }, bOf).map((t) => t.code);
  it("no chip selected shows every ticket, including one with no readable building", () => {
    expect(codes({})).toEqual(["A1", "A2", "A3", "A4"]);
  });
  it("one building chip narrows to that building; two chips add up", () => {
    expect(codes({ buildings: ["S1"] })).toEqual(["A1"]);
    expect(codes({ buildings: ["S2"] })).toEqual(["A2", "A3"]);
    expect(codes({ buildings: ["S1", "S2"] })).toEqual(["A1", "A2", "A3"]);
  });
  it("building, status and search combine with AND", () => {
    expect(codes({ buildings: ["S2"], statuses: ["closed"] })).toEqual(["A3"]);
    expect(codes({ statuses: ["review"] })).toEqual(["A2"]);
    expect(codes({ buildings: ["S2"], query: "a2" })).toEqual(["A2"]);
  });
  it("toggle adds then removes", () => {
    expect(toggle(["S1"], "S2")).toEqual(["S1", "S2"]);
    expect(toggle(["S1", "S2"], "S1")).toEqual(["S2"]);
  });
});

describe("warehouse D11", () => {
  it("restockTone follows the worst item: red out, amber low, green none", () => {
    expect(restockTone(["ok", "unknown"])).toBe("ok");
    expect(restockTone([])).toBe("ok");
    expect(restockTone(["ok", "low"])).toBe("low");
    expect(restockTone(["low", "out", "ok"])).toBe("out");
  });
  it("byUrgency puts out of stock first, then low, then the rest, emptiest first, without mutating", () => {
    const items = [
      { c: "ok", stock: 50, min: 5 },
      { c: "low-b", stock: 4, min: 5 },
      { c: "out", stock: 0, min: 5 },
      { c: "low-a", stock: 2, min: 5 },
      { c: "unk", stock: null, min: null },
    ];
    expect(byUrgency(items).map((i) => i.c)).toEqual(["out", "low-a", "low-b", "unk", "ok"]);
    expect(items[0].c).toBe("ok");
  });
});
