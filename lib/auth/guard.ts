// lib/auth/guard.ts — đọc phiên từ cookie HTTP (Next.js `next/headers`).
// Không mở connection, không gọi model — không thuộc phạm vi BB-07.

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookie, type SessionPayload } from "./session";

/** Đọc và xác minh phiên hiện tại từ cookie. `null` khi chưa đăng nhập hoặc
 * cookie không hợp lệ. */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionCookie(raw);
}
