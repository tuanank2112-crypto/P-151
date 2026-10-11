import "server-only";
import { isBqlWork } from "@/lib/backend-map";
import type { ManagementData } from "@/lib/dto";
import { api } from "../backend";
import type { SessionUser } from "../session";
import { buildMgmtTicket } from "./build";
import { brief, listTickets, readCases } from "./shared";
import type { BBqlRow } from "./types";

/** `BqlTicketRow` has no description, so the text comes from `/mo/tickets` and is joined by ticket_id (01 §5.4) */
export async function managementData(user: SessionUser): Promise<ManagementData> {
  const [rows, list] = await Promise.all([api<BBqlRow[]>("/bql/tickets"), listTickets()]);
  const now = new Date();
  const byId = new Map(list.map((s) => [s.ticket_id, s]));
  // BQL work is read in full (a few tickets) to learn who escalated it: Agent or reception (notification payload `by`)
  const bqlIds = rows.filter((r) => isBqlWork(r.blocker)).map((r) => r.ticket_id);
  const details = new Map((await readCases(bqlIds)).map((c) => [c.ticket.ticket_id, c]));
  return {
    user: brief(user),
    tickets: rows.map((r) => buildMgmtTicket(r, byId.get(r.ticket_id), now, details.get(r.ticket_id))),
  };
}
