import type { MgmtTicket } from "./dto";

/** 01-CONTRACTS §3: the blockers only the BQL can clear */
export const BQL_DECIDE_BLOCKERS = ["EMERGENCY_PENDING_BQL", "WRONG_DEPT_AFTER_START"] as const;

type Row = Pick<MgmtTicket, "cancelled" | "merged" | "stage" | "blockerCode" | "bqlWork">;

export type BqlBox = "decide" | "review" | "done";

/** "Việc của BQL": each ticket in at most one box, the one that needs the BQL first */
export function bqlBox(t: Row): BqlBox | null {
  if (t.cancelled) return null;
  if ((BQL_DECIDE_BLOCKERS as readonly string[]).includes(t.blockerCode ?? "") || (t.bqlWork && t.stage <= 2)) return "decide";
  if (t.stage === 5) return "review";
  if (t.stage === 6) return "done";
  return null;
}

export const BQL_BOXES: { key: BqlBox; label: string }[] = [
  { key: "decide", label: "Cần BQL quyết" },
  { key: "review", label: "Chờ nghiệm thu" },
  { key: "done", label: "Hoàn tất" },
];

/** Order inside "Cần BQL quyết": emergencies, then wrong department, then out of scope */
export function decideRank(t: Pick<MgmtTicket, "blockerCode">): number {
  if (t.blockerCode === "EMERGENCY_PENDING_BQL") return 0;
  if (t.blockerCode === "WRONG_DEPT_AFTER_START") return 1;
  return 2;
}

export type ListGroup = "waiting" | "bql" | "processing" | "review" | "closed" | "cancelled";

/** "Danh sách ticket": a partition, no "Tất cả" (01-CONTRACTS §3) */
export function listGroup(t: Row): ListGroup {
  if (t.cancelled || t.merged) return "cancelled";
  if (t.stage >= 6) return "closed";
  if (t.stage === 5) return "review";
  if (t.stage >= 3) return "processing";
  if (bqlBox(t) === "decide") return "bql";
  return "waiting";
}

export const LIST_GROUPS: { key: ListGroup; label: string }[] = [
  { key: "waiting", label: "Chờ phân loại" },
  { key: "bql", label: "Cần BQL quyết" },
  { key: "processing", label: "Đang xử lý" },
  { key: "review", label: "Chờ nghiệm thu" },
  { key: "closed", label: "Hoàn tất" },
  { key: "cancelled", label: "Hủy / gộp" },
];

/** Department cell of a ticket nobody holds yet (A2: replaces the bare "--") */
export const NO_DEPT = "Chưa giao phòng";

/** One readable line for a ticket: title, else raw text, else the first content line; a blank report says so (A3) */
export function headline(t: Pick<MgmtTicket, "title" | "text" | "content">): string {
  return t.title.trim() || t.text.trim() || (t.content.split("\n")[0] ?? "").trim() || "Chưa có nội dung, chờ cư dân bổ sung";
}

export type DeptLoad ={ waitingAccept: number; inProgress: number; late: number; open: number };

export function deptLoad(rows: Pick<MgmtTicket, "dept" | "cancelled" | "stage" | "late">[], dept: "ve_sinh" | "ky_thuat"): DeptLoad {
  const mine = rows.filter((t) => t.dept === dept && !t.cancelled && (t.stage === 3 || t.stage === 4));
  const waitingAccept = mine.filter((t) => t.stage === 3).length;
  const inProgress = mine.length - waitingAccept;
  return { waitingAccept, inProgress, late: mine.filter((t) => t.late).length, open: mine.length };
}
