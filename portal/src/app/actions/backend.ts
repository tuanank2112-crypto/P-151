"use server";

import { BackendError, backendFetch } from "@/server/backend-client";
import { getSessionUser } from "@/server/session";
import { presentationResponse } from "@/lib/case-view";
import { ticketActionRequest, type BackendActionResult, type TicketAction } from "@/lib/backend-actions";

function failure(error: unknown): BackendActionResult {
  if (error instanceof BackendError) return { ok: false, status: error.status, code: error.code ?? String(error.status), message: error.message };
  if (error instanceof Error && ["FORBIDDEN", "INVALID_INPUT"].includes(error.message)) return { ok: false, status: error.message === "FORBIDDEN" ? 403 : 422, code: error.message, message: error.message === "FORBIDDEN" ? "Bạn không có quyền thực hiện thao tác này." : "Dữ liệu chưa hợp lệ." };
  return { ok: false, status: 503, code: "SERVER_UNAVAILABLE", message: "Không kết nối được backend. Tải lại để kiểm tra kết quả trước khi thử lại." };
}

async function execute(fn: (role: string) => Promise<unknown>): Promise<BackendActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại." };
    return { ok: true, data: presentationResponse(await fn(user.role)) };
  } catch (error) { return failure(error); }
}

export async function getTicketDetail(id: string): Promise<BackendActionResult> {
  return execute((role) => backendFetch(`/api/v1/${role === "resident" ? "resident" : "mo"}/tickets/${encodeURIComponent(id)}`));
}

export async function runTicketAction(id: string, action: TicketAction, payload: Record<string, unknown> = {}): Promise<BackendActionResult> {
  const result = await execute(async (role) => {
    const request = ticketActionRequest(role, id, action, payload);
    return backendFetch(request.path, { method: "POST", ...(request.body ? { body: JSON.stringify(request.body), headers: { "Content-Type": "application/json" } } : {}) });
  });
  if (result.ok && action === "complete") {
    const data = result.data as { ticket?: { status?: string }; draft?: { readiness_evaluation?: { failing_items?: unknown[] } } };
    if (data.ticket?.status !== "READY_FOR_REVIEW") return { ok: false, status: 409, code: "READINESS_FAILED", message: `Chưa đủ điều kiện báo hoàn thành: ${data.draft?.readiness_evaluation?.failing_items?.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join("; ") || "Kiểm tra checklist, vật tư và bằng chứng."}`, data: result.data };
  }
  return result;
}

export async function createResidentTicket(description: string): Promise<BackendActionResult> {
  return execute((role) => {
    if (role !== "resident") throw new Error("FORBIDDEN");
    return backendFetch("/api/v1/resident/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ original_description: description, channel: "form" }) });
  });
}

export async function uploadTicketPhotos(id: string, fd: FormData): Promise<BackendActionResult> {
  return execute((role) => {
    if (!["resident", "technical", "cleaning"].includes(role)) throw new Error("FORBIDDEN");
    const files = new FormData();
    for (const file of fd.getAll("files")) if (file instanceof File && file.size) files.append("files", file);
    return backendFetch(`/api/v1/${role === "resident" ? "resident" : "mo"}/tickets/${encodeURIComponent(id)}/photos`, { method: "POST", body: files });
  });
}

export async function receiveStock(code: string, qty: number): Promise<BackendActionResult> {
  return execute((role) => {
    if (role !== "warehouse") throw new Error("FORBIDDEN");
    return backendFetch(`/api/v1/mo/warehouse/stock/${encodeURIComponent(code)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qty }) });
  });
}
