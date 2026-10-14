/**
 * Serializable shapes passed from Server Components to the dashboards (strings are preformatted on the server).
 * Contract: planning/11_2026-10-09_portal-backend-api/specs/01-CONTRACTS.md §5. Ids are the backend `ticket_id`.
 */
import type { Dept, Place } from "./constants";
import type { StockAlertDto } from "./stock-alerts";

export type PhotoRef = { id: string; name: string; url: string };

export type HistoryEntry = { label: string; note: string; time: string };

export type ChecklistRow = { templateItemId: string; label: string; required: boolean; done: boolean };

export type MaterialRow = {
  itemCode: string;
  itemName: string;
  unit: string;
  plannedQty: number;
  normQty: number | null;
  issuedQty: number | null;
  usedQty: number | null;
  stock: number | null;
  shortage: number;
};

export type UserBrief = { name: string; avatar: string };

/** Stars + tags + comment a resident gave (SPEC-P04 §4). Staff see it without the resident's identity. */
export type RatingInfo = { stars: number; tags: string[]; comment: string };

/** Agent decision applied to a ticket (SPEC-P04 §5); built from `Case.agent_decision`, never from keywords. */
export type AgentInfo = {
  /** AGENT | FALLBACK_RULE | SKIPPED_RULE_EMERGENCY (raw backend value) */
  source: string;
  /** "Agent LLM" | "Luật dự phòng" | ... for display */
  sourceLabel: string;
  model: string;
  /** Department the Agent proposed; "bql" when it judged the ticket out of scope; null when it made no proposal */
  proposedDept: Dept | null;
  riskLevel: string;
  /** Present/unclear risk signals with the quote the Agent relied on */
  signals: { id: string; quote: string }[];
  /** `reasoning[].conclusion` */
  steps: string[];
  /** "<field>: <note>" where the Agent disagrees with the fixed rules */
  disagreements: string[];
  /** Short reason for the card; "Agent không quyết được — luật cố định" when the Agent failed */
  reason: string;
  /** true when the Agent did not decide (fallback / skipped) */
  failed: boolean;
};

/** none = no material plan; pending = enough stock, waiting for approval; waiting_stock = short, waiting for goods; approved = issued */
export type MaterialStatus = "none" | "pending" | "waiting_stock" | "approved";

// ---------- 5.1 Resident ----------
export type ResidentTicket = {
  id: string;
  code: string;
  title: string;
  /** Body without the title line ("" for a short legacy one-line report) */
  content: string;
  /** Title + content without the location line (kept for older UI code) */
  description: string;
  location: string;
  sentAt: string;
  stage: number;
  statusLabel: string;
  publicMessage: string;
  needInfo: boolean;
  canRate: boolean;
  /** CLOSED and no longer ratable: the resident already rated (the backend does not return the score) */
  rated: boolean;
  cancelled: boolean;
  mergedInto: string | null;
  deptName: string | null;
  eta: string | null;
  rating: number | null;
  ratingTags: string[];
  ratingComment: string;
  extras: string[];
  history: HistoryEntry[];
  photos: PhotoRef[];
};

export type ResidentData = {
  user: UserBrief & { tower: string; floor: string; apartment: string };
  tickets: ResidentTicket[];
  places: Place[];
};

// ---------- 5.2 Reception ----------
export type DuplicateRef = { id: string; code: string; text: string; statusLabel: string };

export type ReceptionInboxItem = {
  id: string;
  code: string;
  text: string;
  title: string;
  content: string;
  location: string;
  createdAt: string;
  urgent: boolean;
  blockerCode: string;
  blockerLabel: string;
  /** Backend note for the reviewer: internal note, else the public message of the blocker */
  note: string;
  proposedDept: Dept | null;
  riskLevel: string;
  priority: string | null;
  extras: string[];
  photos: PhotoRef[];
  duplicateOf: string | null;
  duplicate?: DuplicateRef;
  /** Real Agent decision (SPEC-P03 §3.1); null when the ticket has none */
  agent: AgentInfo | null;
};

export type ReceptionAllItem = {
  id: string;
  code: string;
  text: string;
  title: string;
  content: string;
  location: string;
  createdAt: string;
  stage: number;
  statusLabel: string;
  dept: Dept | null;
  cancelled: boolean;
  urgent: boolean;
};

/** "Hiệu suất Agent" tab (SPEC-P03 §3.3, SPEC-P04 §5) */
export type AgentCorrection = { id: string; code: string; agentDept: Dept; finalDept: Dept };

export type AgentPerf = {
  /** Tickets that left reception (handed to a department or to the BQL) */
  transferred: number;
  correct: number;
  wrong: number;
  /** correct / (correct + wrong), rounded; null when no ticket was judged */
  correctPct: number | null;
  waitingResident: number;
  corrections: AgentCorrection[];
};

export type ReceptionData = {
  user: UserBrief;
  inbox: ReceptionInboxItem[];
  all: ReceptionAllItem[];
  perf: AgentPerf;
};

// ---------- 5.6 Ticket detail (modal) ----------
export type TicketDetail = {
  id: string;
  code: string;
  text: string;
  title: string;
  content: string;
  location: string;
  createdAt: string;
  stage: number;
  statusLabel: string;
  dept: Dept | null;
  deptName: string | null;
  cancelled: boolean;
  urgent: boolean;
  riskLevel: string;
  priority: string | null;
  blockerCode: string | null;
  blockerLabel: string;
  publicMessage: string;
  extras: string[];
  history: (HistoryEntry & { actorRole: string })[];
  beforePhotos: PhotoRef[];
  afterPhotos: PhotoRef[];
  checklist: ChecklistRow[];
  materials: MaterialRow[];
  materialStatus: MaterialStatus;
  staffName: string | null;
  rating: RatingInfo | null;
  /** Real Agent decision; null => "Chưa có quyết định của Agent" */
  agent: AgentInfo | null;
};

// ---------- 5.3 Departments ----------
export type Readiness = { checklist: boolean; photo: boolean; materials: boolean; failing: string[] };

export type DeptTicket = {
  id: string;
  code: string;
  text: string;
  title: string;
  content: string;
  location: string;
  createdAt: string;
  urgent: boolean;
  stage: number;
  paused: boolean;
  blockerCode: string | null;
  statusLabel: string;
  hoursLeft: number | null;
  extras: string[];
  photos: PhotoRef[];
  checklist: ChecklistRow[];
  materials: MaterialRow[];
  readiness: Readiness;
  materialStatus: MaterialStatus;
  staffId: string | null;
  staffName: string | null;
  /** Stars, tags and comment of the resident, without identity (history tab) */
  rating: RatingInfo | null;
};

export type CatalogItem = { itemCode: string; itemName: string; unit: string; stock: number | null };

export type DeptData = {
  user: UserBrief;
  tickets: DeptTicket[];
  catalog: CatalogItem[];
  /** Backend flag `custom_materials_enabled` (SPEC-P01 §3); the "+" button is hidden when false */
  customMaterials: boolean;
  /** Plan 20: unread restock alerts (technical only; empty for cleaning or when the backend flag is off) */
  stockAlerts: StockAlertDto[];
};

// ---------- 5.4 Management ----------
export type MgmtTicket = {
  id: string;
  code: string;
  text: string;
  title: string;
  content: string;
  location: string;
  createdAt: string;
  stage: number;
  statusLabel: string;
  dept: Dept | null;
  cancelled: boolean;
  urgent: boolean;
  late: boolean;
  escalated: boolean;
  blockerCode: string | null;
  riskLevel: string;
  priority: string | null;
  closureKind: string | null;
  ratingStars: number | null;
  ratingTags: string[];
  ratingComment: string;
  bqlWork: boolean;
  /** "Việc của BQL" origin: "Agent chuyển" | "Tiếp nhận chuyển"; null when not BQL work */
  bqlSource: "Agent chuyển" | "Tiếp nhận chuyển" | null;
  /** Department the Agent proposed (real, no percentage); "bql" for out of scope; null without an Agent decision */
  agentDept: Dept | null;
  agentSource: string | null;
  staffName: string | null;
  /** `closed_at - accepted_at` in hours (1 decimal); null when either is missing */
  doneHours: number | null;
  /** MERGED into another ticket: counted out of the totals */
  merged: boolean;
};

export type MonthReportItem = {
  month: string;
  nhan: number;
  da_xu_ly: number;
  ton_cuoi_thang: number;
};

export type DeptSummaryReport = {
  key: "bql" | "tiep_nhan" | "ve_sinh" | "ky_thuat";
  name: string;
  dot_color: string;
  ton_dau_ky: number;
  nhan: number;
  da_xu_ly: number;
  ton_hien_tai: number;
  thay_doi_ton: number;
  monthly: MonthReportItem[];
};

export type PerformanceReportData = {
  departments: DeptSummaryReport[];
  all_monthly: MonthReportItem[];
};

export type ManagementData = {
  user: UserBrief;
  tickets: MgmtTicket[];
  report?: PerformanceReportData;
};

// ---------- 5.5 Warehouse ----------
export type WarehouseItem = { code: string; name: string; unit: string; stock: number | null; min: number | null; custom: boolean };

export type WarehouseRequest = {
  ticketId: string;
  ticketCode: string;
  ticketText: string;
  departmentName: string;
  lines: { itemCode: string; itemName: string; unit: string; plannedQty: number; stock: number | null; shortage: number; short: boolean }[];
  since: string;
  /** The approving role (warehouse or BQL) already issued it */
  approved: boolean;
  /** At least one line lacks stock: receive goods before approving */
  short: boolean;
};

export type WarehouseData = {
  user: UserBrief;
  inventory: WarehouseItem[];
  /** Plan 19 D11: materials the departments used in the last 7 days (finished tickets), most used first */
  weeklyUsage: { code: string; name: string; unit: string; qty: number; tickets: number }[];
  requests: WarehouseRequest[];
  customMaterials: boolean;
};
