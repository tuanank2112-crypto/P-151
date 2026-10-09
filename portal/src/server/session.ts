import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users, type Role } from "@/db/schema";
import { ROLE_HOME } from "@/lib/constants";

export const SESSION_COOKIE = "portal_session";
const TTL_MS = 7 * 24 * 3_600_000;

export type SessionUser = {
  id: number;
  username: string;
  name: string;
  role: Role;
  tower: string | null;
  floor: string | null;
  apartment: string | null;
};

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({ id: digest(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production; SESSION_COOKIE_SECURE=false allows plain HTTP (e.g. docker on a LAN IP)
    secure: process.env.SESSION_COOKIE_SECURE ? process.env.SESSION_COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = digest(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      tower: users.tower,
      floor: users.floor,
      apartment: users.apartment,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return { id: row.id, username: row.username, name: row.name, role: row.role, tower: row.tower, floor: row.floor, apartment: row.apartment };
}

/** Pages: no session ⇒ /login; wrong role ⇒ that user's own dashboard */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, digest(token)));
  store.delete(SESSION_COOKIE);
}
