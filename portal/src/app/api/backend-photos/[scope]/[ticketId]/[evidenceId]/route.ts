import { backendResponse, BackendError } from "@/server/backend-client";
import { getSessionUser } from "@/server/session";

/** Python verifies ownership even for conditional requests; no public photo cache. */
export async function GET(req: Request, ctx: { params: Promise<{ scope: string; ticketId: string; evidenceId: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return new Response("Unauthenticated", { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const { scope, ticketId, evidenceId } = await ctx.params;
    if (!["resident", "internal"].includes(scope)) return new Response("Not found", { status: 404 });
    if (scope === "internal" && user.role === "resident") return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
    const headers = new Headers();
    for (const name of ["If-None-Match", "If-Modified-Since"]) {
      const value = req.headers.get(name);
      if (value) headers.set(name, value);
    }
    const response = await backendResponse(`/api/v1/${scope === "resident" ? "resident" : "mo"}/tickets/${encodeURIComponent(ticketId)}/photos/${encodeURIComponent(evidenceId)}`, { headers });
    const outgoing = new Headers({ "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" });
    for (const name of ["Content-Type", "ETag", "Last-Modified"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    if (!response.ok && response.status !== 304) {
      outgoing.set("Cache-Control", "private, no-store");
      return new Response("Photo unavailable", { status: response.status, headers: outgoing });
    }
    return new Response(response.status === 304 ? null : response.body, { status: response.status, headers: outgoing });
  } catch (error) {
    return new Response("Photo unavailable", { status: error instanceof BackendError ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
