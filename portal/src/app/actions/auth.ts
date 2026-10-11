"use server";

import { redirect } from "next/navigation";
import type { BLoginResponse } from "@/lib/backend-map";
import { ROLE_HOME } from "@/lib/constants";
import { api } from "@/server/backend";
import { BackendError, BackendUnavailable } from "@/server/backend-error";
import { createSession, destroySession } from "@/server/session";

export type LoginState = { error: string; username: string };

/** `POST /auth/login` => signed cookie holding the backend token (SPEC-P02 §2, §4) */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Vui lòng nhập tên đăng nhập và mật khẩu.", username };
  let res: BLoginResponse;
  try {
    res = await api<BLoginResponse>("/auth/login", { method: "POST", json: { username, password }, token: null });
  } catch (e) {
    if (e instanceof BackendUnavailable) return { error: "Không kết nối được máy chủ, vui lòng thử lại.", username };
    if (e instanceof BackendError) {
      if (e.status === 429) return { error: "Đăng nhập sai quá nhiều lần, thử lại sau 5 phút.", username };
      if (e.status === 401 || e.status === 422) return { error: "Tên đăng nhập hoặc mật khẩu không đúng.", username };
      return { error: e.message, username };
    }
    throw e;
  }
  const user = await createSession(res);
  if (!user) {
    // QA_INTERNAL (or a department we have no screen for): drop the backend session right away
    await api("/auth/logout", { method: "POST", token: res.access_token }).catch(() => null);
    return { error: "Tài khoản này không dùng cổng cư dân.", username };
  }
  redirect(ROLE_HOME[user.role]);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
