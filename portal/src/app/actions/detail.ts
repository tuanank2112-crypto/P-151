"use server";

import { fail, ok } from "@/lib/result";
import { BackendError, BackendUnavailable } from "@/server/backend-error";
import { id } from "@/server/act";
import { buildDetail } from "@/server/data/build";
import { listTickets, readCase, readCatalog } from "@/server/data/shared";
import { getSessionUser } from "@/server/session";

/** Read-only detail for the ticket modal (staff roles; the backend scopes what each role may open) */
export async function ticketDetailAction(ticketId: string) {
  const user = await getSessionUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (user.role === "resident") return fail("FORBIDDEN");
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  try {
    // the list row carries staff, stars, tags and comment (SPEC-P04 §3, §4); the case itself carries the Agent decision
    const [c, catalog, list] = await Promise.all([readCase(tid), readCatalog(), listTickets()]);
    return ok(buildDetail(c, catalog.status_labels, catalog.departments, new Date(), list.find((s) => s.ticket_id === tid)));
  } catch (e) {
    if (e instanceof BackendError) return fail(e.code, e.message);
    if (e instanceof BackendUnavailable) return fail("CONFLICT", "Không kết nối được máy chủ");
    throw e;
  }
}
