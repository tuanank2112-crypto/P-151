"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ROLE_HOME } from "@/lib/constants";
import { verifyPassword } from "@/server/password";
import { createSession, destroySession } from "@/server/session";

export type LoginState = { error: string; username: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Vui lòng nhập tên đăng nhập và mật khẩu.", username };
  const [u] = await db.select().from(users).where(eq(users.username, username));
  // Same message and the same scrypt cost whether the account exists or not (deviation D1)
  const valid = await verifyPassword(password, u && u.passwordHash !== "!" ? u.passwordHash : null);
  if (!u || !valid) return { error: "Tên đăng nhập hoặc mật khẩu không đúng.", username };
  await createSession(u.id);
  redirect(ROLE_HOME[u.role]);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
