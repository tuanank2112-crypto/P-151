import type { ReceptionAllItem } from "./dto";

/** Where a ticket that already left the reception inbox is now (one answer per ticket, in the order a person asks) */
export type DoneSegment = "ky_thuat" | "ve_sinh" | "bql" | "unassigned" | "review" | "closed" | "cancelled";

export const DONE_SEGMENTS: { key: DoneSegment; label: string }[] = [
  { key: "ky_thuat", label: "Phòng kỹ thuật" },
  { key: "ve_sinh", label: "Phòng vệ sinh" },
  { key: "bql", label: "Ở Ban quản lý" },
  { key: "unassigned", label: "Chưa giao phòng" },
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
  if (t.dept === null) return "unassigned"; // e.g. on hold before any department: never counted as cleaning
  return t.dept;
}

/** Case- and accent-insensitive match on code, title, content and location */
export function matchesDoneSearch(t: Pick<ReceptionAllItem, "code" | "title" | "content" | "location">, query: string): boolean {
  const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
  const q = fold(query.trim());
  return q === "" || fold(`${t.code} ${t.title} ${t.content} ${t.location}`).includes(q);
}

/** The location parser puts "—" when the report names no place: such a value is not shown */
export const hasLocation = (location: string | null | undefined): boolean => {
  const s = (location ?? "").trim();
  return s !== "" && s !== "—" && s !== "–" && s !== "-";
};
