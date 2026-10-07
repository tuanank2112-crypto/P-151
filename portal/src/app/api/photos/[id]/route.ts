import { db } from "@/db";
import { getSessionUser } from "@/server/session";
import { photoFor } from "@/server/workflow";

/** Ticket photo, only for the ticket owner, reception, management and the ticket's department (01-CONTRACTS §6) */
export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const user = await getSessionUser();
  const photo = user ? await photoFor(db, user, Number((await ctx.params).id)) : null;
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      // no-store: a shared browser must not replay a photo to the next user after logout
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
