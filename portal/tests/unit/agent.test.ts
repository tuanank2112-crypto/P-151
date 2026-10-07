import { describe, expect, it } from "vitest";
import { SEED_KEYWORDS } from "@/db/seed";
import { classify, hasWord, locationFromText, techSkill } from "@/lib/agent";

const home = { tower: "S2.05", floor: "12" };

describe("classify", () => {
  it("picks the department with most keyword hits and the design formula", () => {
    const r = classify("Thùng rác tầng 12 đầy tràn, bốc mùi hôi chưa được thu gom", SEED_KEYWORDS, home);
    expect(r.dept).toBe("ve_sinh");
    expect(r.keywords).toEqual(["rác", "mùi", "hôi", "thu gom"]);
    // min(97, round(48 + 38·4/4 + 5·3)) = 97
    expect(r.confidence).toBe(97);
    expect(r.urgent).toBe(true); // "tràn"
  });

  it("computes confidence relative to all hits", () => {
    // ve_sinh: vệ sinh (1) · ky_thuat: thấm (1) ⇒ tie ⇒ first in order; 48 + 19 + 5 = 72
    const r = classify("Nước từ trần nhà vệ sinh nhỏ giọt, nghi căn trên bị thấm", SEED_KEYWORDS, home);
    expect(r).toMatchObject({ dept: "ve_sinh", confidence: 72, keywords: ["vệ sinh"] });
  });

  it("returns no department and 0% when nothing matches", () => {
    const r = classify("Cây xanh khu vườn nội khu bị đổ sau mưa", SEED_KEYWORDS, home);
    expect(r).toMatchObject({ dept: null, confidence: 0, keywords: [], urgent: false });
  });

  it("matches whole words only (ồn ≠ đồng, ống ≠ chống)", () => {
    expect(classify("lịch dùng phòng sinh hoạt cộng đồng", SEED_KEYWORDS, home).dept).toBeNull();
    expect(hasWord("keo chống thấm", "ống")).toBe(false);
    expect(hasWord("vỡ ống nước", "ống")).toBe(true);
    expect(hasWord("căn bên cạnh gây ồn", "ồn")).toBe(true);
  });

  it("detects urgency words", () => {
    expect(classify("Thang máy kẹt, có người bên trong", SEED_KEYWORDS, home).urgent).toBe(true);
    expect(classify("Đèn hành lang không sáng", SEED_KEYWORDS, home).urgent).toBe(false);
  });
});

describe("locationFromText", () => {
  it("prefers a floor or tower that differs from home", () => {
    expect(locationFromText("đèn hỏng ở tầng 15 cạnh thang máy", home)).toBe("Tòa S2.05 · Tầng 15");
    expect(locationFromText("rác ở tòa S1.03 tầng 5", home)).toBe("Tòa S1.03 · Tầng 5");
    expect(locationFromText("Tòa s1.01", home)).toBe("Tòa S1.01");
  });
  it("ignores the resident's own floor and the lobby floor", () => {
    expect(locationFromText("đèn tầng 12 hỏng", home)).toBeNull();
    expect(locationFromText("sảnh tầng 1 bẩn", home)).toBeNull();
    expect(locationFromText("không nhắc vị trí", home)).toBeNull();
  });
});

describe("techSkill", () => {
  it("suggests a specialty, breaking ties toward electrical", () => {
    expect(techSkill("Thang máy số 2 bị kẹt")).toBe("Thang máy");
    expect(techSkill("Vòi nước bồn rửa bị rò rỉ")).toBe("Cấp thoát nước");
    expect(techSkill("Sảnh thang máy có đèn hỏng")).toBe("Điện");
    expect(techSkill("Cây đổ")).toBeNull();
  });
});
