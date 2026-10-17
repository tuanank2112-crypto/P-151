/** Plan 24 (SPEC-P03): material requests (PVT) the warehouse sees and the shortage report a department sends */
import type { DeptTicket } from "./dto";

export type BMaterialRequestLine = {
  item_code: string;
  item_name: string;
  unit: string | null;
  needed_qty: number;
  stock_qty: number | null;
  shortage_qty: number;
};

/** `GET /mo/warehouse/requests` row (backend `MaterialRequestView`) */
export type BMaterialRequest = {
  request_id: string;
  ticket_id: string;
  department_id: string | null;
  location: string | null;
  source: "AGENT" | "DEPARTMENT";
  reported_by: string;
  since: string;
  note: string | null;
  lines: BMaterialRequestLine[];
  status: "OPEN";
};

export type MaterialRequestLineDto = {
  itemCode: string;
  itemName: string;
  unit: string;
  needed: number;
  /** null = the item is not tracked */
  stock: number | null;
  shortage: number;
};

export type MaterialRequestDto = {
  requestId: string;
  ticketId: string;
  departmentName: string;
  location: string;
  /** "Agent" or the department that reported it */
  sourceLabel: string;
  since: string;
  note: string;
  lines: MaterialRequestLineDto[];
};

const NO_LOCATION = "—";

/** Backend row -> DTO. `fmtSince` formats the ISO time (injected so the function stays pure and testable). */
export function toMaterialRequest(row: BMaterialRequest, departments: Record<string, string>, fmtSince: (iso: string) => string): MaterialRequestDto {
  const dept = row.department_id ? (departments[row.department_id] ?? "") : "";
  return {
    requestId: row.request_id,
    ticketId: row.ticket_id,
    departmentName: dept,
    location: row.location?.trim() || NO_LOCATION,
    sourceLabel: row.source === "AGENT" ? "Agent" : dept || "Phòng ban",
    since: fmtSince(row.since),
    note: row.note?.trim() ?? "",
    lines: row.lines.map((l) => ({
      itemCode: l.item_code,
      itemName: l.item_name,
      unit: l.unit ?? "",
      needed: l.needed_qty,
      stock: l.stock_qty,
      shortage: l.shortage_qty,
    })),
  };
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/** "Thiếu 3 Cái Bóng đèn" style summary used in the warehouse bell */
export function requestSummary(r: MaterialRequestDto): string {
  return r.lines.map((l) => `${l.itemName} thiếu ${num(l.shortage)}${l.unit ? ` ${l.unit}` : ""}`).join("; ");
}

export type ShortageInput = { picked: Record<string, string>; note: string };
export type ShortagePayload = { ok: true; lines: { itemCode: string; qty: number }[]; note: string } | { ok: false; message: string };

/**
 * Form -> payload of `POST material-shortage` (CONTRACTS §3): at least one item, each a whole number >= 1.
 * `picked` maps item code -> typed quantity; a code is chosen while it is a key.
 */
export function buildShortagePayload(input: ShortageInput): ShortagePayload {
  const lines = Object.entries(input.picked).map(([itemCode, raw]) => ({ itemCode, qty: Number(raw) }));
  if (lines.length === 0) return { ok: false, message: "Chọn ít nhất một vật tư còn thiếu." };
  if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1)) return { ok: false, message: "Số lượng cần thêm phải là số nguyên từ 1 trở lên." };
  return { ok: true, lines, note: input.note.trim() };
}

/** Status text of a department ticket: a ticket waiting for the warehouse says so (SPEC-P03 §1) */
export function deptStatusLabel(t: Pick<DeptTicket, "blockerCode" | "statusLabel">): string {
  return t.blockerCode === "WAITING_MATERIAL" ? "Chờ kho nhập vật tư" : t.statusLabel;
}
