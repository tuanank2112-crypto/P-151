import { describe, expect, it } from "vitest";
import { formatAlert, toStockAlert, unreadCount, type BStockAlert } from "@/lib/stock-alerts";

const row = (o: Partial<BStockAlert> = {}): BStockAlert => ({
  alert_id: "SIM-SAL-MAT-LAMP-02-1",
  item_name: "Bóng đèn tuýp mô phỏng",
  unit: "Cái",
  qty_added: 20,
  qty_after: 20,
  created_at: "2026-10-14T02:00:00Z",
  ticket_ids: ["SIM-TKT-0071"],
  acknowledged_at: null,
  ...o,
});

describe("stock alerts (plan 20 SPEC-P02)", () => {
  it("maps a backend row and keeps unread/read apart", () => {
    const a = toStockAlert(row(), (iso) => `T:${iso}`);
    const b = toStockAlert(row({ alert_id: "x", acknowledged_at: "2026-10-14T03:00:00Z" }), (iso) => iso);
    expect(a).toMatchObject({ id: "SIM-SAL-MAT-LAMP-02-1", read: false, createdAt: "T:2026-10-14T02:00:00Z" });
    expect(b.read).toBe(true);
    expect(unreadCount([a, b])).toBe(1);
    expect(unreadCount([])).toBe(0);
  });
  it("formats the line the SPEC asks for, with a missing unit", () => {
    const f = formatAlert(toStockAlert(row(), String));
    expect(f.title).toBe("Kho đã nhập lại Bóng đèn tuýp mô phỏng");
    expect(f.body).toContain("+20 Cái, tồn 20 Cái");
    expect(f.body).toContain("Tiếp tục xử lý ticket: SIM-TKT-0071");
    const bare = formatAlert(toStockAlert(row({ unit: null, qty_added: 2.5, ticket_ids: undefined }), String)).body;
    expect(bare).toContain("+2.5, tồn 20.");
    expect(bare).not.toContain("Tiếp tục");
  });
});
