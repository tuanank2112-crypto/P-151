import "server-only";
import { cookies } from "next/headers";
export const SESSION_COOKIE = "python_portal_session";
export class BackendError extends Error {
  constructor(public status: number, message: string, public code?: string, public detail?: unknown) { super(message); this.name = "BackendError"; }
}
export async function backendResponse(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith("/api/v1/") || path.includes("..") || path.includes("\\")) throw new BackendError(400, "Đường dẫn API không hợp lệ.", "INVALID_PATH");
  const origin = new URL(process.env.BACKEND_URL ?? "http://backend:8000");
  if (!["http:", "https:"].includes(origin.protocol)) throw new BackendError(503, "Cấu hình kết nối backend không hợp lệ.", "BACKEND_UNAVAILABLE");
  const target = new URL(path, origin.origin);
  if (!target.pathname.startsWith("/api/v1/")) throw new BackendError(400, "Đường dẫn API không hợp lệ.", "INVALID_PATH");
  const headers = new Headers(init.headers);
  headers.delete("Authorization"); headers.delete("X-Actor-Id"); headers.delete("Cookie");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && path !== "/api/v1/auth/login" && path !== "/api/v1/auth/demo-accounts") headers.set("Authorization", `Bearer ${token}`);
  if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try { return await fetch(target, { ...init, headers, cache: "no-store", redirect: "error", signal: init.signal ?? AbortSignal.timeout(15000) }); }
  catch { throw new BackendError(503, "Không thể kết nối backend. Vui lòng thử lại.", "BACKEND_UNAVAILABLE"); }
}
export async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await backendResponse(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: unknown; code?: string } | null;
    const raw = body?.detail;
    const object = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as { code?: string; message?: string } : null;
    const detail = Array.isArray(raw) ? raw.map((v: { loc?: unknown; msg?: string; type?: string }) => ({ loc: v.loc, msg: v.msg, type: v.type })) : object ? { code: object.code, message: object.message } : raw;
    const message = typeof raw === "string" ? raw : typeof object?.message === "string" ? object.message : response.status === 422 ? "Dữ liệu không hợp lệ. Kiểm tra các trường đã nhập." : response.status === 401 ? "Phiên đăng nhập đã hết hạn." : response.status === 403 ? "Bạn không có quyền thực hiện thao tác này." : response.status === 404 ? "Không tìm thấy dữ liệu." : "Backend chưa thể xử lý yêu cầu. Vui lòng thử lại.";
    throw new BackendError(response.status, message, object?.code ?? body?.code, detail);
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; } catch { throw new BackendError(502, "Phản hồi backend không hợp lệ.", "INVALID_RESPONSE"); }
}
