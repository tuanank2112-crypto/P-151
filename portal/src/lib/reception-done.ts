import type { ReceptionAllItem } from "./dto";

/** Where a ticket that already left the reception inbox is now (one answer per ticket, in the order a person asks) */
export type DoneSegment = "dept" | "bql" | "review" | "closed" | "cancelled";

export const DONE_SEGMENTS: { key: DoneSegment; label: string }[] = [
  { key: "dept", label: "Đang ở phòng ban" },
  { key: "bql", label: "Ở Ban quản lý" },
  { key: "review", label: "Chờ nghiệm thu" },
  { key: "closed", label: "Hoàn tất" },
  { key: "cancelled", label: "Hủy / gộp" },
];

type Row = Pick<ReceptionAllItem, "stage" | "dept" | "cancelled">;

/**
 * Not in the inbox and still at stage 1-2 with no department means a blocker BPTN does not own, i.e. BQL (an
 * emergency or an escalated out-of-scope report): it is NOT "unrouted".
 */
export function doneSegment(t: Row): DoneSegment {
  if (t.cancelled) return "cancelled";
  if (t.stage >= 6) return "closed";
  if (t.stage === 5) return "review";
  if (t.dept === "bql" || (t.dept === null && t.stage <= 2)) return "bql";
  return "dept";
}

/** Case- and accent-insensitive match on code, title, content and location */
export function matchesDoneSearch(t: Pick<ReceptionAllItem, "code" | "title" | "content" | "location">, query: string): boolean {
  const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
  const q = fold(query.trim());
  return q === "" || fold(`${t.code} ${t.title} ${t.content} ${t.location}`).includes(q);
}
