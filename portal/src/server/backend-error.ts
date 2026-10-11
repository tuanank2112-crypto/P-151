/** Backend error classes + the pure status/body -> error mapping (01-CONTRACTS §8). No framework imports, so it is unit-testable. */
import type { ErrorCode } from "@/lib/result";

export class BackendError extends Error {
  status: number;
  code: ErrorCode;
  detail: unknown;
  constructor(status: number, code: ErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export class BackendUnavailable extends Error {
  constructor(message = "Không kết nối được máy chủ") {
    super(message);
    this.name = "BackendUnavailable";
  }
}

function detailOf(body: unknown): unknown {
  return body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : undefined;
}

/** The three shapes FastAPI uses for `detail`: a string, an object with `message`, an array of `{msg}` */
export function detailText(body: unknown): string {
  const detail = detailOf(body);
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : ""))
      .filter(Boolean)
      .join("; ");
  }
  if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: unknown }).message);
  return "";
}

export function errorFrom(status: number, body: unknown): BackendError {
  const text = detailText(body);
  const detail = detailOf(body);
  if (status === 401) return new BackendError(401, "UNAUTHENTICATED", text || "Phiên đăng nhập đã hết", detail);
  if (status === 403) return new BackendError(403, "FORBIDDEN", text || "Tài khoản của bạn không có quyền thực hiện thao tác này.", detail);
  if (status === 404) return new BackendError(404, "NOT_FOUND", "Không tìm thấy phản ánh", detail);
  if (status === 409) return new BackendError(409, "CONFLICT", text || "Ticket vừa được cập nhật, đã tải lại.", detail);
  if (status >= 500) return new BackendError(status, "CONFLICT", "Máy chủ gặp lỗi, thử lại sau.");
  return new BackendError(status, "INVALID_INPUT", text || "Dữ liệu chưa hợp lệ.", detail);
}
