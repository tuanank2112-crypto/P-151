/**
 * Serializable shapes passed from Server Components to the dashboards (strings are preformatted on the server).
 * Contract: planning/11_2026-10-09_portal-backend-api/specs/01-CONTRACTS.md §5. Ids are the backend `ticket_id`.
 */
import type { Dept, Place } from "./constants";

export type PhotoRef = { id: string; name: string; url: string };

export type HistoryEntry = { label: string; note: string; time: string };

export type ChecklistRow = { templateItemId: string; label: string; required: boolean; done: boolean };

export type MaterialRow = {
  itemCode: string;
  itemName: string;
  unit: string;
  plannedQty: number;
  issuedQty: number | null;
  usedQty: number | null;
  stock: number | null;
  shortage: number;
};

export type UserBrief = { name: string; avatar: string };

// ---------- 5.1 Resident ----------
export type ResidentTicket = {
  id: string;
  code: string;
  title: string;
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
};

export type ReceptionAllItem = {
  id: string;
  code: string;
  text: string;
  location: string;
  createdAt: string;
  stage: number;
  statusLabel: string;
  dept: Dept | null;
  cancelled: boolean;
  urgent: boolean;
};

export type ReceptionData = {
  user: UserBrief;
  inbox: ReceptionInboxItem[];
  all: ReceptionAllItem[];
};

// ---------- 5.6 Ticket detail (modal) ----------
export type TicketDetail = {
  id: string;
  code: string;
  text: string;
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
};

// ---------- 5.3 Departments ----------
export type Readiness = { checklist: boolean; photo: boolean; materials: boolean; failing: string[] };

export type DeptTicket = {
  id: string;
  code: string;
  text: string;
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
};

export type CatalogItem = { itemCode: string; itemName: string; unit: string; stock: number | null };

export type DeptData = {
  user: UserBrief;
  tickets: DeptTicket[];
  catalog: CatalogItem[];
  /** Backend flag `custom_materials_enabled` (SPEC-P01 §3); the "+" button is hidden when false */
  customMaterials: boolean;
};

// ---------- 5.4 Management ----------
export type MgmtTicket = {
  id: string;
  code: string;
  text: string;
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
  /** The BQL list has no rating field; null until the backend exposes it */
  ratingStars: number | null;
  bqlWork: boolean;
  /** MERGED into another ticket: counted out of the totals */
  merged: boolean;
};

export type ManagementData = {
  user: UserBrief;
  tickets: MgmtTicket[];
};

// ---------- 5.5 Warehouse ----------
export type WarehouseItem = { code: string; name: string; unit: string; stock: number | null; custom: boolean };

export type WarehouseRequest = {
  ticketId: string;
  ticketCode: string;
  ticketText: string;
  departmentName: string;
  lines: { itemCode: string; itemName: string; unit: string; plannedQty: number; stock: number | null; shortage: number }[];
  since: string;
};

export type WarehouseData = {
  user: UserBrief;
  inventory: WarehouseItem[];
  requests: WarehouseRequest[];
  customMaterials: boolean;
};
