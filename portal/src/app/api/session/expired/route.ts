import { clearSessionCookie } from "@/server/session";

/** The backend rejected the token: drop the signed cookie, then show the login page */
export async function GET(req: Request) {
  await clearSessionCookie();
  return new Response(null, { status: 303, headers: { Location: new URL("/login", req.url).toString(), "Cache-Control": "no-store" } });
}
