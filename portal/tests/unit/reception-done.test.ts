import { describe, expect, it } from "vitest";
import { DONE_SEGMENTS, doneSegment, matchesDoneSearch } from "@/lib/reception-done";

describe("doneSegment: where a ticket that left the inbox is now", () => {
  it("a cancelled or merged ticket is cancelled whatever its stage", () => {
    expect(doneSegment({ stage: 4, dept: "ky_thuat", cancelled: true })).toBe("cancelled");
  });
  it("stage 6 is closed, stage 5 is waiting for acceptance", () => {
    expect(doneSegment({ stage: 6, dept: "ve_sinh", cancelled: false })).toBe("closed");
    expect(doneSegment({ stage: 5, dept: "ve_sinh", cancelled: false })).toBe("review");
  });
  it("no department at stage 1-2 is BQL's (emergency/escalated), not 'unrouted'", () => {
    expect(doneSegment({ stage: 2, dept: null, cancelled: false })).toBe("bql");
    expect(doneSegment({ stage: 2, dept: "bql", cancelled: false })).toBe("bql");
  });
  it("routed or being worked on is at the department", () => {
    expect(doneSegment({ stage: 3, dept: "ky_thuat", cancelled: false })).toBe("dept");
    expect(doneSegment({ stage: 4, dept: "ve_sinh", cancelled: false })).toBe("dept");
  });
  it("every segment has a label and none repeats", () => {
    expect(new Set(DONE_SEGMENTS.map((s) => s.key)).size).toBe(DONE_SEGMENTS.length);
  });
});

describe("matchesDoneSearch", () => {
  const t = { code: "SIM-TKT-0007", title: "Đèn hành lang tầng 3", content: "", location: "Tòa S1 · Tầng 3" };
  it("ignores case and accents", () => {
    expect(matchesDoneSearch(t, "den hanh lang")).toBe(true);
    expect(matchesDoneSearch(t, "TOA s1")).toBe(true);
    expect(matchesDoneSearch(t, "0007")).toBe(true);
  });
  it("an empty query matches everything and a miss matches nothing", () => {
    expect(matchesDoneSearch(t, "   ")).toBe(true);
    expect(matchesDoneSearch(t, "thang may")).toBe(false);
  });
});
