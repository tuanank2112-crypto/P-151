/** Pure mapping between the backend (CR-BPTN-03 API) and the portal (01-CONTRACTS §3, §5, §6). No I/O. */
import type { Dept, Role } from "./constants";

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

export function isUrgent(t: { risk_level?: string | null; priority?: string | null }): boolean {
  return t.risk_level === "EMERGENCY" || t.priority === "HIGH";
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
