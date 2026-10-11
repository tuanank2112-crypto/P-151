/** Pure mapping between the backend (CR-BPTN-03 API) and the portal (01-CONTRACTS §3, §5, §6). No I/O. */
import type { Dept, Role } from "./constants";
import type { AgentCorrection, AgentPerf, MgmtTicket } from "./dto";

export type BStatus =
  | "RECEIVED"
  | "NEED_INFO"
  | "VERIFYING"
  | "ROUTED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "READY_FOR_REVIEW"
  | "CLOSED"
  | "CANCELLED"
  | "MERGED";

export type StageInfo = { stage: number; needInfo: boolean; paused: boolean; cancelled: boolean };

const STAGE_OF: Record<BStatus, number> = {
  RECEIVED: 1,
  NEED_INFO: 1,
  VERIFYING: 2,
  ROUTED: 3,
  IN_PROGRESS: 4,
  ON_HOLD: 4,
  READY_FOR_REVIEW: 5,
  CLOSED: 6,
  CANCELLED: 1,
  MERGED: 1,
};

/** status -> stepper stage + side flags (01 §3) */
export function mapStatus(status: BStatus): StageInfo {
  return {
    stage: STAGE_OF[status] ?? 1,
    needInfo: status === "NEED_INFO",
    paused: status === "ON_HOLD",
    cancelled: status === "CANCELLED" || status === "MERGED",
  };
}

/** Last stage a cancelled/merged ticket reached, read from its status events (default 1) */
export function lastKnownStage(toStatuses: string[]): number {
  let stage = 1;
  for (const s of toStatuses) {
    if (s === "CANCELLED" || s === "MERGED") continue;
    stage = Math.max(stage, STAGE_OF[s as BStatus] ?? 1);
  }
  return stage;
}

/** Only a safety emergency is "Khẩn cấp"; HIGH priority alone is an ordinary ticket (user decision 2026-10-11) */
export function isUrgent(t: { risk_level?: string | null; priority?: string | null }): boolean {
  return t.risk_level === "EMERGENCY";
}

/** "Việc của BQL": an OUT_OF_SCOPE blocker that was escalated (SPEC-P01 §2) */
export function isBqlWork(blocker: { code: string; escalated: boolean } | null | undefined): boolean {
  return !!blocker && blocker.code === "OUT_OF_SCOPE" && blocker.escalated;
}

export function deptKey(departmentId: string | null | undefined, bqlWork = false): Dept | null {
  if (departmentId === "DEPT_CLEANING") return "ve_sinh";
  if (departmentId === "DEPT_TECHNICAL") return "ky_thuat";
  return bqlWork ? "bql" : null;
}

/** Residents only see the department a ticket was handed to (the backend already guarantees it) */
export function residentDeptName(name: string | null | undefined): string | null {
  return name ? name : null;
}

const LOCATION_RE = /^Vị trí:\s*(.*)$/;

/** Resident text -> { text without the trailing "Vị trí:" line, location } (01 §6.1) */
export function parseDescription(raw: string): { description: string; location: string } {
  const lines = raw.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const last = (lines[lines.length - 1] ?? "").trim();
  const m = LOCATION_RE.exec(last);
  if (m) return { description: lines.slice(0, -1).join("\n").trim(), location: m[1].trim() || "—" };
  return { description: raw.trim(), location: "—" };
}

export function titleOf(description: string): string {
  return (description.split("\n")[0] ?? "").trim().slice(0, 80);
}

export const BLOCKER_LABELS = {
  MISSING_INFO: "Thiếu thông tin",
  DUPLICATE: "Nghi trùng",
  CATEGORY_UNCLEAR: "Chưa rõ loại việc",
  OUT_OF_SCOPE: "Ngoài phạm vi VS/KT",
  PENDING_REVIEW: "Chờ Tiếp nhận xác nhận",
  ASSET_UNCLEAR: "Chưa rõ tài sản",
  WAITING_MATERIAL: "Chờ vật tư",
  OUT_OF_HOURS: "Ngoài giờ làm việc",
  NOT_ACCEPTED: "Phòng ban chưa nhận việc",
  WRONG_DEPT: "Sai phòng ban",
  BLOCKED_ONSITE: "Vướng tại hiện trường",
  REWORK: "Làm lại",
  SAFETY_REVIEW_REQUIRED: "Cần xác minh an toàn",
  EMERGENCY_PENDING_BQL: "Khẩn cấp — chờ BQL",
  WRONG_DEPT_AFTER_START: "Báo sai phòng sau khi nhận",
  WAITING_EMERGENCY: "Chờ xử lý khẩn cấp liền kề",
} as const;

export type ReasonCode = keyof typeof BLOCKER_LABELS;
export const REASON_CODES = Object.keys(BLOCKER_LABELS) as ReasonCode[];

export function blockerLabel(code: string | null | undefined): string {
  if (!code) return "";
  return (BLOCKER_LABELS as Record<string, string>)[code] ?? code;
}

const FAILING_LABELS: Record<string, string> = {
  checklist_complete: "Chưa xong checklist",
  photo_present: "Thiếu ảnh sau xử lý",
  materials_entered: "Chưa nhập vật tư đã dùng",
  variance_explained: "Vật tư dùng khác định mức, cần ghi lý do",
  no_open_blocker: "Ticket đang bị chặn",
  department_accepted: "Chưa nhận việc",
};

/** Readiness `failing_items` are ids (checklist item, "execution_photo", material line, "blocker:CODE"): say each in
 * Vietnamese with the names from the same case. Unknown ids fall back to the old flag labels, then to the id. */
export function readinessMessages(
  failing: string[],
  checklist: { template_item_id: string; label_snapshot: string }[],
  lines: { material_line_id?: string; item_name: string; issued_qty: number | null; used_qty: number | null }[],
): string[] {
  return failing.map((f) => {
    if (f === "execution_photo") return "Thiếu ảnh sau xử lý";
    if (f.startsWith("blocker:")) {
      const code = f.slice("blocker:".length);
      return `Ticket đang bị chặn: ${(BLOCKER_LABELS as Record<string, string>)[code] ?? code}`;
    }
    const item = checklist.find((c) => c.template_item_id === f);
    if (item) return `Chưa xong checklist: ${item.label_snapshot}`;
    const line = lines.find((l) => l.material_line_id === f);
    if (line) {
      return line.issued_qty === null || line.used_qty === null
        ? `Chưa nhập số vật tư đã dùng: ${line.item_name}`
        : `${line.item_name} dùng khác định mức, cần ghi lý do`;
    }
    return FAILING_LABELS[f] ?? f;
  });
}

export function failingLabels(items: string[]): string[] {
  return items.map((i) => FAILING_LABELS[i] ?? i);
}

/** Reason codes whose blocker BPTN owns (the list endpoint has no owner field) */
export const BPTN_REASON_CODES: readonly string[] = [
  "MISSING_INFO",
  "DUPLICATE",
  "CATEGORY_UNCLEAR",
  "OUT_OF_SCOPE",
  "PENDING_REVIEW",
  "ASSET_UNCLEAR",
  "WRONG_DEPT",
  "SAFETY_REVIEW_REQUIRED",
];

/** Backend `Me` / login payloads (src/api/auth.py) */
export type BMe = {
  username: string;
  display_name: string;
  actor_id: string;
  role: string;
  department_id: string | null;
  profile?: { tower: string; floor: string; apartment: string } | null;
};
export type BLoginResponse = { access_token: string; token_type: string; expires_in: number; user: BMe };

/** Backend role (+ department) -> portal role (01 §2); null = account without a screen (QA_INTERNAL) */
export function roleFromMe(role: string, departmentId: string | null | undefined): Role | null {
  switch (role) {
    case "RESIDENT":
      return "resident";
    case "BPTN":
      return "reception";
    case "BQL":
      return "management";
    case "WAREHOUSE":
      return "warehouse";
    case "DEPARTMENT":
      return departmentId === "DEPT_CLEANING" ? "cleaning" : departmentId === "DEPT_TECHNICAL" ? "technical" : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Title / content / location (SPEC-P03 §2)
// ---------------------------------------------------------------------------

/**
 * `original_description` = title line, content lines, then "Vị trí: <where>" -> its three parts. A legacy report has
 * no separate title: its first line is the title (<= 80 chars) and the content keeps the full text only when the
 * title cut it.
 */
/** Legacy one-line report: the title stops at the first sentence/clause end within `max` chars, else at the last
 * word boundary (with "…"); the content is only what follows, so title and content never repeat each other. */
export function splitLongLine(text: string, max: number): { head: string; rest: string } {
  if (text.length <= max) return { head: text, rest: "" };
  const window = text.slice(0, max + 1);
  const stop = Math.max(...[". ", "! ", "? ", "; ", ", "].map((m) => window.lastIndexOf(m)));
  if (stop >= 20) return { head: text.slice(0, stop + 1).trim(), rest: text.slice(stop + 1).trim() };
  const space = window.lastIndexOf(" ");
  const cut = space >= 20 ? space : max;
  return { head: `${text.slice(0, cut).trim()}…`, rest: `…${text.slice(cut).trim()}` };
}

export function splitReport(raw: string): { title: string; content: string; location: string } {
  const { description, location } = parseDescription(raw);
  const lines = description.split("\n");
  if (lines.length === 1) {
    const { head, rest } = splitLongLine(description.trim(), 80);
    return { title: head, content: rest, location };
  }
  return { title: (lines[0] ?? "").trim(), content: lines.slice(1).join("\n").trim(), location };
}

// ---------------------------------------------------------------------------
// Agent (SPEC-P04 §5)
// ---------------------------------------------------------------------------

/** Department the (real) Agent proposed: "bql" when it judged the ticket out of scope; null without an Agent decision */
export function agentDept(
  source: string | null | undefined,
  department: string | null | undefined,
  scope: string | null | undefined,
): Dept | null {
  if (source !== "AGENT") return null;
  if (scope === "OUT_OF_SCOPE") return "bql";
  return deptKey(department);
}

export type AgentCheck = { agentSource: string | null; agentDept: Dept | null; dept: Dept | null };

/** Agent right/wrong once the ticket has a final department (or went to BQL); null when it cannot be judged */
export function agentVerdict(t: AgentCheck): "correct" | "wrong" | null {
  if (t.agentSource !== "AGENT" || !t.agentDept || !t.dept) return null;
  return t.agentDept === t.dept ? "correct" : "wrong";
}

export type PerfRow = AgentCheck & { id: string; code: string; needInfo: boolean };

export function agentPerformance(rows: PerfRow[]): AgentPerf {
  let correct = 0;
  const corrections: AgentCorrection[] = [];
  for (const r of rows) {
    const v = agentVerdict(r);
    if (v === "correct") correct++;
    else if (v === "wrong" && r.agentDept && r.dept) {
      corrections.push({ id: r.id, code: r.code, agentDept: r.agentDept, finalDept: r.dept });
    }
  }
  const wrong = corrections.length;
  const judged = correct + wrong;
  return {
    transferred: rows.filter((r) => r.dept !== null).length,
    correct,
    wrong,
    correctPct: judged === 0 ? null : Math.round((correct / judged) * 100),
    waitingResident: rows.filter((r) => r.needInfo).length,
    corrections,
  };
}

/** Who sent a ticket to the BQL: the latest `escalation` notification's `payload.by`, else the Agent hint */
export function escalationSource(
  notifications: { type: string; payload?: Record<string, unknown> }[] | null | undefined,
  agentHint: boolean,
): "Agent chuyển" | "Tiếp nhận chuyển" {
  const list = notifications ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i];
    if (n.type !== "escalation") continue;
    const by = n.payload?.by;
    if (by === "AGENT") return "Agent chuyển";
    if (typeof by === "string") return "Tiếp nhận chuyển";
  }
  return agentHint ? "Agent chuyển" : "Tiếp nhận chuyển";
}

// ---------------------------------------------------------------------------
// Management filters and statistics (SPEC-P03 §5.1, §5.2, §5.5). Pure: the number on a tile is the number of rows.
// ---------------------------------------------------------------------------

export type OverviewKind = "total" | "waiting" | "processing" | "emergency" | "late";
export type OverviewRow = Pick<MgmtTicket, "stage" | "cancelled" | "merged" | "riskLevel" | "late" | "bqlWork">;

export function overviewFilter(kind: OverviewKind): (t: OverviewRow) => boolean {
  switch (kind) {
    case "total":
      return (t) => !t.merged;
    case "waiting":
      return (t) => t.stage <= 2 && !t.cancelled && !t.bqlWork;
    case "processing":
      return (t) => t.stage >= 3 && t.stage <= 4 && !t.cancelled;
    case "emergency":
      return (t) => t.riskLevel === "EMERGENCY" && t.stage < 6 && !t.cancelled;
    case "late":
      return (t) => t.late && !t.cancelled;
  }
}

export function overviewCount(rows: OverviewRow[], kind: OverviewKind): number {
  return rows.filter(overviewFilter(kind)).length;
}

/** Click on a department row: its tickets not finished yet (stage < 5, not cancelled); `showAll` keeps finished ones */
export function deptLoadFilter(dept: Dept, showAll: boolean): (t: Pick<MgmtTicket, "dept" | "stage" | "cancelled">) => boolean {
  return (t) => t.dept === dept && (showAll || (t.stage < 5 && !t.cancelled));
}

/** Hours between two ISO times, 1 decimal; null when a side is missing or the order is wrong */
export function hoursBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round((ms / 3_600_000) * 10) / 10;
}

const avg = (xs: number[]): number | null => (xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10);

export type DeptPerf = { processing: number; late: number; closed: number; avgStars: number | null; avgHours: number | null };

/** "Hiệu suất phòng ban" of one department (SPEC-P03 §5.5) */
export function deptPerformance(rows: MgmtTicket[], dept: Dept): DeptPerf {
  const mine = rows.filter((t) => t.dept === dept && !t.cancelled);
  const closed = mine.filter((t) => t.stage === 6);
  return {
    processing: mine.filter((t) => t.stage >= 3 && t.stage <= 4).length,
    late: mine.filter((t) => t.late).length,
    closed: closed.length,
    avgStars: avg(closed.flatMap((t) => (t.ratingStars === null ? [] : [t.ratingStars]))),
    avgHours: avg(closed.flatMap((t) => (t.doneHours === null ? [] : [t.doneHours]))),
  };
}
