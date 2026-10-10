import { getSessionUser } from "@/server/session";

/** Retired integer photo URLs must never read the legacy portal database. */
export async function GET() {
  const user = await getSessionUser();
  return new Response(user ? "Photo URL retired" : "Unauthenticated", { status: user ? 410 : 401, headers: { "Cache-Control": "private, no-store" } });
}