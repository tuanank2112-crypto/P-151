import type { Building } from "./building";
import { matchesDoneSearch } from "./reception-done";

export type HistoryBuilding = Building | "other";
export type HistoryStatus = "review" | "closed";

export const HISTORY_BUILDINGS: { key: HistoryBuilding; label: string }[] = [
  { key: "S1", label: "S1" },
  { key: "S2", label: "S2" },
  { key: "other", label: "Chưa rõ" },
];

export const HISTORY_STATUSES: { key: HistoryStatus; label: string }[] = [
  { key: "review", label: "Chờ nghiệm thu" },
  { key: "closed", label: "Hoàn tất" },
];

export type HistoryRow = { stage: number; code: string; title: string; content: string; location: string };

export const historyStatus = (t: Pick<HistoryRow, "stage">): HistoryStatus => (t.stage >= 6 ? "closed" : "review");

/**
 * Plan 19 (D10): the department history is one list; chips only narrow it. An empty selection means "all", so no
 * ticket (including one with no readable building) is ever hidden by default.
 */
export function filterHistory<T extends HistoryRow>(
  rows: T[],
  f: { buildings: HistoryBuilding[]; statuses: HistoryStatus[]; query: string },
  buildingOf: (t: T) => HistoryBuilding,
): T[] {
  return rows.filter(
    (t) =>
      (f.buildings.length === 0 || f.buildings.includes(buildingOf(t))) &&
      (f.statuses.length === 0 || f.statuses.includes(historyStatus(t))) &&
      matchesDoneSearch(t, f.query),
  );
}

/** Add the key to the selection, or remove it when it is already there */
export const toggle = <K>(list: K[], key: K): K[] => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
