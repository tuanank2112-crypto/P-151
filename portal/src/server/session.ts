import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { roleFromMe, type BLoginResponse } from "@/lib/backend-map";
import { ROLE_HOME, type Role } from "@/lib/constants";
import { signSession, verifySession, type SessionUser } from "./session-token";

export const SESSION_COOKIE = "portal_session";
export type { SessionUser };

let devSecret: string | null = null;

/** SESSION_SECRET is mandatory in production; in dev a random one per process is used (cookies die on restart) */
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET chưa cấu hình");
  if (!devSecret) {
    devSecret = randomBytes(32).toString("base64url");
    console.warn("[portal] SESSION_SECRET chưa đặt: dùng khóa ngẫu nhiên cho phiên dev");
  }
  return devSecret;
}

const secureCookie = () =>
  process.env.SESSION_COOKIE_SECURE ? process.env.SESSION_COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";

/** Builds the session user from a login response; null when the account has no screen (QA_INTERNAL) */
export function userFromLogin(login: BLoginResponse): SessionUser | null {
  const role = roleFromMe(login.user.role, login.user.department_id);
  if (!role) return null;
  const p = login.user.profile;
  return {
    username: login.user.username,
    name: login.user.display_name,
    role,
    actorId: login.user.actor_id,
    departmentId: login.user.department_id,
    tower: p?.tower ?? "",
    floor: p?.floor ?? "",
    apartment: p?.apartment ?? "",
  };
}

export async function createSession(login: BLoginResponse): Promise<SessionUser | null> {
  const user = userFromLogin(login);
  if (!user) return null;
  const maxAge = login.expires_in > 0 ? login.expires_in : 8 * 3600;
  const value = signSession({ t: login.access_token, u: user, exp: Date.now() + maxAge * 1000 }, secret());
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge,
  });
  return user;
}

async function readPayload() {
  await connection(); // request time only: the expiry check reads the clock (Next 16 refuses Date.now() in a prerender)
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifySession(raw, secret());
}

/** Signature + expiry only: the backend answers 401 itself when its token is dead (then `api()` clears the cookie) */
export async function getSessionUser(): Promise<SessionUser | null> {
  return (await readPayload())?.u ?? null;
}

export async function getToken(): Promise<string | null> {
  return (await readPayload())?.t ?? null;
}

/** Pages: no session => /login; wrong role => that user's own dashboard */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** Cookies can only be written in Server Actions / Route Handlers; during a render this is a no-op */
export async function clearSessionCookie(): Promise<void> {
  try {
    (await cookies()).delete(SESSION_COOKIE);
  } catch {
    /* rendering a Server Component: the next action/redirect clears it */
  }
}

export async function destroySession(): Promise<void> {
  const token = await getToken();
  const base = process.env.BACKEND_URL;
  if (token && base) {
    try {
      await fetch(`${base.replace(/\/+$/, "")}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* network error: the backend token expires by itself */
    }
  }
  await clearSessionCookie();
}
