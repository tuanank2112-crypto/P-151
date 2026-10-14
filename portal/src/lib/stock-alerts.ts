/** Plan 20 (SPEC-P02): Technical gets an alert when the warehouse restocks a material that had run out */
export type StockAlertDto = {
  id: string;
  itemName: string;
  unit: string;
  qtyAdded: number;
  qtyAfter: number;
  createdAt: string;
  read: boolean;
  /** Tickets that were waiting for this item (the backend re-runs them) */
  ticketIds: string[];
};

export type BStockAlert = {
  alert_id: string;
  item_name: string;
  unit: string | null;
  qty_added: number;
  qty_after: number;
  created_at: string;
  ticket_ids?: string[];
  acknowledged_at: string | null;
};

export const ALERT_PREFIX = "sal-";

export const unreadCount = (alerts: StockAlertDto[]): number => alerts.filter((a) => !a.read).length;

/** Backend row -> DTO; `fmt` formats the ISO time (injected so the function stays pure and testable) */
export function toStockAlert(row: BStockAlert, fmt: (iso: string) => string): StockAlertDto {
  return {
    id: row.alert_id,
    itemName: row.item_name,
    unit: row.unit ?? "",
    qtyAdded: row.qty_added,
    qtyAfter: row.qty_after,
    createdAt: fmt(row.created_at),
    read: row.acknowledged_at !== null,
    ticketIds: row.ticket_ids ?? [],
  };
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** "Kho đã nhập lại Bóng đèn tuýp (+20 Cái, tồn 20)", plus the tickets that continue */
export function formatAlert(a: StockAlertDto): { title: string; body: string } {
  const unit = a.unit ? ` ${a.unit}` : "";
  return {
    title: `Kho đã nhập lại ${a.itemName}`,
    body:
      `+${num(a.qtyAdded)}${unit}, tồn ${num(a.qtyAfter)}${unit}. ` +
      (a.ticketIds.length > 0 ? `Tiếp tục xử lý ticket: ${a.ticketIds.join(", ")}. ` : "") +
      "Bấm để xác nhận đã biết.",
  };
}
