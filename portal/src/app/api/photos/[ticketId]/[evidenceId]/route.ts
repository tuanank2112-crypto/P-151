import { apiRaw } from "@/server/backend";
import { getSessionUser, getToken } from "@/server/session";

const ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Ticket photo proxy (SPEC-P02 §5, I-05): the browser never sees the backend token. Residents read their own photos
 * through `/resident/...`, staff through `/mo/...`; the backend decides who may see what.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[ticketId]/[evidenceId]">) {
  const { ticketId, evidenceId } = await ctx.params;
  const user = await getSessionUser();
  const token = await getToken();
  if (!user || !token || !ID.test(ticketId) || !ID.test(evidenceId)) return new Response(null, { status: 404 });
  const base = user.role === "resident" ? "/resident/tickets" : "/mo/tickets";
  let res: Response;
  try {
    res = await apiRaw(`${base}/${encodeURIComponent(ticketId)}/photos/${encodeURIComponent(evidenceId)}`, token);
  } catch {
    return new Response(null, { status: 404 });
  }
  if (!res.ok) return new Response(null, { status: 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      // no-store: a shared browser must not replay a photo to the next user after logout
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
