/** Serializable shapes passed from Server Components to the dashboards (strings are preformatted on the server) */
import type { KeywordRules } from "./agent";
import type { Dept, Place } from "./constants";

export type PhotoRef = { id: number; name: string };

export type RatingDto = { stars: number; tags: string[]; comment: string };

export type ResidentTicket = {
  id: number;
  code: string;
  title: string;
  location: string;
  sentAt: string;
  stage: number;
  paused: boolean;
  pauseText: string;
  cancelled: boolean;
  mergedInto: string | null;
  needInfo: boolean;
  dept: Dept | null;
  staffName: string | null;
  urgent: boolean;
  rating: RatingDto | null;
  extras: string[];
  history: { label: string; note: string; time: string }[];
  photos: PhotoRef[];
};

export type ResidentData = {
  user: { name: string; avatar: string; tower: string; floor: string; apartment: string };
  tickets: ResidentTicket[];
  notices: { id: number; date: string; title: string; body: string }[];
  rules: KeywordRules;
  places: Place[];
};

export type ReceptionInboxItem = {
  id: number;
  code: string;
  text: string;
  location: string;
  resident: string;
  createdAt: string;
  urgent: boolean;
  aiDept: Dept | null;
  conf: number;
  keywords: string[];
  extras: string[];
  photos: PhotoRef[];
  duplicates: DuplicateCandidate[];
};

/** Older ticket the Agent thinks is the same problem, shown side by side for reception to approve */
export type DuplicateCandidate = {
  id: number;
  code: string;
  text: string;
  location: string;
  resident: string;
  createdAt: string;
  status: string;
  score: number;
  reasons: string[];
};

export type ReceptionData = {
  user: { name: string; avatar: string };
  inbox: ReceptionInboxItem[];
  routed: { id: number; code: string; text: string; aiDept: Dept | null; dept: Dept | null; needInfo: boolean }[];
};

export type DeptTicket = {
  id: number;
  code: string;
  text: string;
  location: string;
  createdAt: string;
  urgent: boolean;
  stage: number;
  paused: boolean;
  keywords: string[];
  conf: number;
  staffId: number | null;
  staffName: string | null;
  rating: RatingDto | null;
  skill: string | null;
  hoursLeft: number;
  materialRequested: boolean;
  extras: string[];
  photos: PhotoRef[];
};

export type DeptData = {
  user: { name: string; avatar: string };
  tickets: DeptTicket[];
  staff: { id: number; name: string; skill: string | null; area: string | null; capacity: number | null }[];
  materials: { id: number; item: string; ticketCode: string; staffName: string | null; received: boolean }[];
};

export type MgmtTicket = {
  id: number;
  code: string;
  text: string;
  location: string;
  createdAt: string;
  dept: Dept | null;
  aiDept: Dept | null;
  conf: number;
  stage: number;
  cancelled: boolean;
  urgent: boolean;
  late: boolean;
  ageH: number;
  stars: number | null;
  doneHours: number | null;
};

export type ManagementData = {
  user: { name: string; avatar: string };
  tickets: MgmtTicket[];
};
