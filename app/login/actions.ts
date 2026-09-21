"use server";

// app/login/actions.ts — Server Action đăng nhập. Đọc `users` qua
// `getDataStore()` (`lib/adapters/db.ts`, BB-07) nên chạy được ở CẢ HAI
// backend: `mock` (hai tài khoản demo, mật khẩu từ biến môi trường) và
// `postgres`. Không mở connection trực tiếp ở đây.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDataStore } from "../../lib/adapters/db";
import { verifyPassword } from "../../lib/auth/password";
import { createSessionCookie, SESSION_COOKIE_NAME } from "../../lib/auth/session";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=1");
  }

  const store = await getDataStore();
  const user = await store.findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect("/login?error=1");
    return;
  }

  const cookieValue = createSessionCookie({
    user_id: user.id,
    role: user.role,
    resident_id: user.resident_id,
    owned_property_ids: user.owned_property_ids,
    // Đ29 — BẮT BUỘC có thật. Đo 2026-09-21: 19/19 tài liệu có
    // `scope_property` khác rỗng, nên để rỗng ở đây là loại sạch mọi tài
    // liệu ở E-6 (01-CONTRACTS §5) và cư dân không bao giờ nhận được câu
    // trả lời nào.
    property_type: user.property_type,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(user.role === "resident" ? "/chat" : "/documents");
}
