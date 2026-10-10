import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/constants";
import { backendFetch, BackendError, SESSION_COOKIE } from "./backend-client";
import { portalUser, type PythonMe, type PortalRole } from "./backend-dto";
export { SESSION_COOKIE } from "./backend-client";
export type { SessionUser } from "./backend-dto";
export async function createSession(token: string, expiresIn: number): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.SESSION_COOKIE_SECURE ? process.env.SESSION_COOKIE_SECURE === "true" : process.env.NODE_ENV === "production", path: "/", maxAge: expiresIn });
}
export async function getSessionUser() {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return null;
  try { return portalUser(await backendFetch<PythonMe>("/api/v1/auth/me")); }
  catch (error) { if (error instanceof BackendError && error.status === 401) return null; throw error; }
}
export async function requireUser(roles?: PortalRole[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
export async function destroySession(): Promise<void> {
  try { await backendFetch<void>("/api/v1/auth/logout", { method: "POST" }); }
  finally { (await cookies()).delete(SESSION_COOKIE); }
}
