"use server";

// app/login/actions.ts — Server Action đăng nhập. Đọc `users` qua
// `lib/adapters/db.ts` (BB-07), không mở connection trực tiếp ở đây.
// CẤM chạy hành động này trong gói P01a — cần DATABASE_URL. Chỉ viết mã.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSql } from "../../lib/adapters/db";
import { verifyPassword } from "../../lib/auth/password";
import { createSessionCookie, SESSION_COOKIE_NAME } from "../../lib/auth/session";
import type { UserRole } from "../../lib/types";

interface UserRow {
  id: string;
  password_hash: string;
  role: UserRole;
  resident_id: string | null;
  owned_property_ids: string[];
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=1");
  }

  const sql = getSql();
  const rows = (await sql(
    "select id, password_hash, role, resident_id, owned_property_ids from users where email = $1",
    [email]
  )) as UserRow[];
  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect("/login?error=1");
    return;
  }

  const cookieValue = createSessionCookie({
    user_id: user.id,
    role: user.role,
    resident_id: user.resident_id,
    owned_property_ids: user.owned_property_ids,
    // P01a chưa cần property_type cho việc đăng nhập; P02 bồi khi dựng
    // eligibility gate E-6 (01-CONTRACTS.md §5).
    property_type: [],
  });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(user.role === "resident" ? "/chat" : "/documents");
}
