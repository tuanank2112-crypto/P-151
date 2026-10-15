import { describe, expect, it } from "vitest";
import { ALERT_PREFIX, alertNotice, formatAlert, toStockAlert, unreadCount, type BStockAlert } from "@/lib/stock-alerts";

const row = (o: Partial<BStockAlert> = {}): BStockAlert => ({
  alert_id: "SIM-SAL-MAT-LAMP-02-TEC-1",
  item_name: "Bóng đèn tuýp mô phỏng",
  unit: "Cái",
  qty_added: 20,
  qty_after: 20,
  created_at: "2026-10-14T02:00:00Z",
  tickets: [
    { ticket_id: "SIM-TKT-0071", waiting: false },
    { ticket_id: "SIM-TKT-0072", waiting: true },
  ],
  acknowledged_at: null,
  ...o,
});

describe("stock alerts (plan 24 SPEC-P02/P03)", () => {
  it("maps a backend row and keeps unread/read apart", () => {
    const a = toStockAlert(row(), (iso) => `T:${iso}`);
    const b = toStockAlert(row({ alert_id: "x", acknowledged_at: "2026-10-14T03:00:00Z" }), (iso) => iso);
    expect(a).toMatchObject({ id: "SIM-SAL-MAT-LAMP-02-TEC-1", read: false, createdAt: "T:2026-10-14T02:00:00Z" });
    expect(a.tickets).toEqual([
      { ticketId: "SIM-TKT-0071", waiting: false },
      { ticketId: "SIM-TKT-0072", waiting: true },
    ]);
    expect(b.read).toBe(true);
    expect(unreadCount([a, b])).toBe(1);
    expect(unreadCount([])).toBe(0);
  });
  it("says 'Kho đã nhập <tên> +<số>' and tells each ticket resumed or still short", () => {
    const f = formatAlert(toStockAlert(row(), String));
    expect(f.title).toBe("Kho đã nhập Bóng đèn tuýp mô phỏng +20 Cái");
    expect(f.body).toContain("Tồn hiện có 20 Cái");
    expect(f.body).toContain("SIM-TKT-0071: Đã chạy tiếp");
    expect(f.body).toContain("SIM-TKT-0072: Vẫn thiếu");
  });
  it("handles a missing unit, fractions and an alert naming no ticket", () => {
    const bare = formatAlert(toStockAlert(row({ unit: null, qty_added: 2.5, tickets: undefined }), String));
    expect(bare.title).toBe("Kho đã nhập Bóng đèn tuýp mô phỏng +2.5");
    expect(bare.body).not.toContain("Ticket:");
  });
  it("bell entry carries the alert prefix and the warehouse tag", () => {
    const n = alertNotice(toStockAlert(row(), (iso) => `T:${iso}`));
    expect(n.id).toBe(`${ALERT_PREFIX}SIM-SAL-MAT-LAMP-02-TEC-1`);
    expect(n).toMatchObject({ tag: "Thông báo kho", time: "T:2026-10-14T02:00:00Z" });
  });
});
