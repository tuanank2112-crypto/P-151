"use server";
import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/constants";
import { BackendError, backendFetch } from "@/server/backend-client";
import { portalUser, type LoginResponse } from "@/server/backend-dto";
import { createSession, destroySession } from "@/server/session";
export type LoginState = { error: string; username: string };
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Vui lòng nhập tên đăng nhập và mật khẩu.", username };
  let home: string;
  try {
    const result = await backendFetch<LoginResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    const user = portalUser(result.user);
    if (!user) return { error: "Vai trò tài khoản này chưa hỗ trợ trên cổng web. Vui lòng dùng giao diện nội bộ /ui/.", username };
    await createSession(result.access_token, result.expires_in);
    home = ROLE_HOME[user.role];
  } catch (error) { return { error: error instanceof BackendError ? error.message : "Không thể đăng nhập. Vui lòng thử lại.", username }; }
  redirect(home);
}
export async function logout(): Promise<void> {
  try { await destroySession(); } catch { /* Local cookie is removed even when backend is offline. */ }
  redirect("/login");
}
