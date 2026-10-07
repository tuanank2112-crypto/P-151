import { describe, expect, it } from "vitest";
import { findDuplicates, placeKey, type DupTicket } from "@/lib/duplicates";

const H = 3_600_000;
const now = new Date("2026-10-07T03:00:00Z");
const t = (id: number, p: Partial<DupTicket>): DupTicket => ({
  id,
  dept: "ve_sinh",
  keywords: ["rác", "thu gom"],
  location: "Tòa S2.05 · Tầng 12 · Phòng rác",
  createdAt: now,
  stage: 1,
  cancelled: false,
  ...p,
});

describe("placeKey", () => {
  it("compares tower + floor, lift, or the whole common spot", () => {
    expect(placeKey("Tòa S2.05 · Tầng 12 · Hành lang")).toBe("S2.05|12");
    expect(placeKey("Tòa S2.05 · Tầng 12 (theo mô tả)")).toBe("S2.05|12");
    expect(placeKey("Tòa S2.05 · Trong thang máy · Thang 2")).toBe("S2.05|lift");
    expect(placeKey("Khu vực chung · Hầm xe")).toBe("khu vực chung · hầm xe");
  });
});

describe("findDuplicates", () => {
  const fresh = t(10, { keywords: ["rác", "mùi"] });

  it("proposes an older open ticket with same department, place and a shared keyword", () => {
    const old = t(3, { createdAt: new Date(now.getTime() - 5 * H), stage: 4 });
    const [m] = findDuplicates(fresh, [old]);
    expect(m).toMatchObject({ id: 3 });
    expect(m.score).toBe(77); // 55 + 35·1/3 + 10
    expect(m.reasons).toEqual(["Cùng vị trí: Tòa S2.05 · Tầng 12", "Cùng từ khóa: rác", "Gửi cách nhau 5 giờ"]);
  });

  it("rejects pairs that differ in any required signal", () => {
    const base = { createdAt: new Date(now.getTime() - 2 * H) };
    expect(findDuplicates(fresh, [t(1, { ...base, dept: "ky_thuat" })])).toEqual([]);
    expect(findDuplicates(fresh, [t(1, { ...base, location: "Tòa S2.05 · Tầng 11 · Phòng rác" })])).toEqual([]);
    expect(findDuplicates(fresh, [t(1, { ...base, keywords: ["bẩn"] })])).toEqual([]);
    expect(findDuplicates(fresh, [t(1, { ...base, stage: 5 })])).toEqual([]); // already reported done
    expect(findDuplicates(fresh, [t(1, { ...base, cancelled: true })])).toEqual([]);
    expect(findDuplicates(fresh, [t(1, { createdAt: new Date(now.getTime() + H) })])).toEqual([]); // newer one
    expect(findDuplicates(fresh, [t(1, { createdAt: new Date(now.getTime() - 8 * 24 * H) })])).toEqual([]);
    expect(findDuplicates(fresh, [t(1, base)], [1])).toEqual([]); // reception said "not a duplicate"
    expect(findDuplicates({ ...fresh, dept: null }, [t(1, base)])).toEqual([]);
  });
});
