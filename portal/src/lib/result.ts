export type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "CONFLICT";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export function fail(code: ErrorCode, message?: string): { ok: false; code: ErrorCode; message: string } {
  return { ok: false, code, message: message ?? DEFAULT_MESSAGE[code] };
}

export const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Phiên đăng nhập đã hết, vui lòng đăng nhập lại.",
  FORBIDDEN: "Tài khoản của bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy phản ánh.",
  INVALID_INPUT: "Dữ liệu chưa hợp lệ.",
  CONFLICT: "Ticket vừa được cập nhật, đã tải lại.",
};
