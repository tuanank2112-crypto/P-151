import { describe, expect, it } from "vitest";
import { placeLocation, ticketCode } from "@/lib/constants";
import { fmtDateTime, fmtRelative, initials } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";
import { sniffImage } from "@/lib/photos";
import { ageHours, hoursLeft, isLate, isOpen } from "@/lib/sla";
import { hashPassword, verifyPassword } from "@/server/password";

const H = 3_600_000;
const now = new Date("2026-10-07T03:00:00Z"); // 10:00 in Asia/Ho_Chi_Minh

describe("sla", () => {
  it("uses 4h for urgent and 48h for normal tickets", () => {
    const t = (urgent: boolean, ageH: number, stage = 2) => ({ urgent, stage, cancelled: false, createdAt: new Date(now.getTime() - ageH * H) });
    expect(isLate(t(true, 5), now)).toBe(true);
    expect(isLate(t(true, 3), now)).toBe(false);
    expect(isLate(t(false, 47), now)).toBe(false);
    expect(isLate(t(false, 49), now)).toBe(true);
    expect(isLate(t(false, 49, 5), now)).toBe(false); // department reported done
    expect(hoursLeft(t(true, 5), now)).toBe(-1);
    expect(hoursLeft(t(false, 15.5), now)).toBe(33);
    expect(ageHours(new Date(now.getTime() - 2.9 * H), now)).toBe(2);
    expect(isOpen({ cancelled: true, stage: 2 })).toBe(false);
  });
});

describe("format", () => {
  it("formats in Vietnam time", () => {
    expect(fmtDateTime(new Date("2026-10-05T07:45:00Z"))).toBe("14:45 05/10/2026");
    expect(fmtRelative(new Date("2026-10-07T02:12:00Z"), now)).toBe("09:12 hôm nay");
    expect(fmtRelative(new Date("2026-10-06T12:20:00Z"), now)).toBe("Hôm qua 19:20");
    expect(fmtRelative(new Date("2026-10-03T03:15:00Z"), now)).toBe("03/10 10:15");
    expect(initials("Nguyễn Minh Anh")).toBe("MA");
    expect(ticketCode(41)).toBe("PA-0041");
  });
  it("builds the location like the design", () => {
    const home = { tower: "S2.05", floor: "12", apartment: "1208" };
    expect(placeLocation("floor", "Trong căn hộ", home)).toBe("Tòa S2.05 · Tầng 12 · Trong căn hộ 1208");
    expect(placeLocation("lobby", "", home)).toBe("Tòa S2.05 · Sảnh cư dân tầng 1");
    expect(placeLocation("common", "Hồ bơi", home)).toBe("Khu vực chung · Hồ bơi");
  });
});

describe("permissions", () => {
  it("is the matrix of Management.dc.html minus keyword editing (removed 2026-10-07)", () => {
    const roles = ["resident", "reception", "management", "cleaning", "technical"];
    const matrix = PERMISSIONS.map((p) => roles.map((r) => ((p.roles as readonly string[]).includes(r) ? 1 : 0)));
    expect(matrix).toEqual([
      [1, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 0, 0],
      [0, 0, 1, 1, 1],
      [0, 0, 0, 1, 1],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 0, 0],
      [0, 0, 1, 0, 0],
    ]);
    expect(can("resident", "submit_ticket")).toBe(true);
    expect(can("reception", "submit_ticket")).toBe(false);
  });
});

describe("photos", () => {
  it("trusts magic bytes, not the extension", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("<svg></svg>"))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});

describe("password", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("123456");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("123456", h)).toBe(true);
    expect(await verifyPassword("1234567", h)).toBe(false);
    expect(await verifyPassword("123456", null)).toBe(false);
    expect(await verifyPassword("123456", "!")).toBe(false);
  });
});
