import "server-only";
import { BPTN_REASON_CODES, agentPerformance, isBqlWork } from "@/lib/backend-map";
import type { ReceptionData } from "@/lib/dto";
import type { SessionUser } from "../session";
import { buildAllItem, buildInboxItem, perfRow } from "./build";
import { brief, listTickets, readCases } from "./shared";
import type { BSummary } from "./types";

const OPEN_FOR_BPTN = new Set(["RECEIVED", "NEED_INFO", "VERIFYING"]);

/** A ticket BPTN may need to act on: stage <= 2 with a BPTN-owned blocker, and not already handed to BQL */
export function needsReception(s: BSummary): boolean {
  if (!OPEN_FOR_BPTN.has(s.status)) return false;
  if (isBqlWork(s.reason_code ? { code: s.reason_code, escalated: s.escalated } : null)) return false;
  return s.reason_code === null || BPTN_REASON_CODES.includes(s.reason_code);
}

const RECEPTION_INBOX_LIMIT = 200;

export async function receptionData(user: SessionUser): Promise<ReceptionData> {
  const list = await listTickets();
  const now = new Date();
  const byId = new Map(list.map((s) => [s.ticket_id, s]));
  // the inbox is built from details: never cut it at the generic detail cap (WP7 P10) — every BPTN ticket must show
  const cases = await readCases(list.filter(needsReception).map((s) => s.ticket_id), RECEPTION_INBOX_LIMIT);
  const inbox = cases
    .filter((c) => !c.ticket.blocker || c.ticket.blocker.owner_role === "BPTN")
    .map((c) => buildInboxItem(c, byId, now));
  return {
    user: brief(user),
    inbox,
    all: list.map((s) => buildAllItem(s, now)),
    perf: agentPerformance(list.map(perfRow)),
  };
}
