/** Plan 24 (SPEC-P02/P03): a department gets an alert when the warehouse restocks a material its tickets waited for */
export type StockAlertTicket = {
  ticketId: string;
  /** Still waiting for material (false = the backend already let it continue) */
  waiting: boolean;
};

export type StockAlertDto = {
  id: string;
  itemName: string;
  unit: string;
  qtyAdded: number;
  qtyAfter: number;
  createdAt: string;
  read: boolean;
  tickets: StockAlertTicket[];
};

export type BStockAlert = {
  alert_id: string;
  item_name: string;
  unit: string | null;
  qty_added: number;
  qty_after: number;
  created_at: string;
  tickets?: { ticket_id: string; waiting: boolean }[];
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
    tickets: (row.tickets ?? []).map((t) => ({ ticketId: t.ticket_id, waiting: t.waiting })),
  };
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** "Kho đã nhập Bóng đèn tuýp +20 Cái", plus per ticket "Đã chạy tiếp" or "Vẫn thiếu" */
export function formatAlert(a: StockAlertDto): { title: string; body: string } {
  const unit = a.unit ? ` ${a.unit}` : "";
  const tickets = a.tickets.map((t) => `${t.ticketId}: ${t.waiting ? "Vẫn thiếu" : "Đã chạy tiếp"}`).join("; ");
  return {
    title: `Kho đã nhập ${a.itemName} +${num(a.qtyAdded)}${unit}`,
    body: `Tồn hiện có ${num(a.qtyAfter)}${unit}. ` + (tickets ? `Ticket: ${tickets}. ` : "") + "Bấm để xác nhận đã xem.",
  };
}

/** Bell entry of an unread alert (`id` carries ALERT_PREFIX so the screen can tell it from a ticket entry) */
export const alertNotice = (a: StockAlertDto) => ({ id: `${ALERT_PREFIX}${a.id}`, tag: "Thông báo kho", time: a.createdAt, ...formatAlert(a) });
