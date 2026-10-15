"use server";

import { fail } from "@/lib/result";
import { act, id, str } from "@/server/act";
import { api } from "@/server/backend";

const path = (tid: string, tail: string) => `/bql/tickets/${tid}/${tail}`;
const post = async (url: string, json: unknown) => {
  await api(url, { json });
  return null;
};

/** READY_FOR_REVIEW => CLOSED */
export async function approveInspectionAction(ticketId: string) {
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  return act(() => post(path(tid, "close"), { note: "Ban quản lý nghiệm thu đạt" }));
}

/** READY_FOR_REVIEW => IN_PROGRESS (rework); the backend requires a reason */
export async function rejectInspectionAction(ticketId: string, reason: string) {
  const tid = id(ticketId);
  const note = str(reason);
  if (!tid || !note) return fail("INVALID_INPUT", "Vui lòng nhập lý do trả làm lại.");
  return act(() => post(path(tid, "rework"), { note }));
}

/** WRONG_DEPT_AFTER_START: keep the department or send the ticket back to reception */
export async function bqlDecideWrongDeptAction(ticketId: string, decision: string, note?: string) {
  const tid = id(ticketId);
  if (!tid || !["KEEP", "TO_BPTN"].includes(decision)) return fail("INVALID_INPUT");
  return act(() =>
    post(path(tid, "wrong-department"), { decision, note: str(note) || (decision === "KEEP" ? "Giữ nguyên phòng ban" : "Chuyển về Tiếp nhận") }),
  );
}

/** "Việc của BQL" handled (SPEC-P01 §2) */
export async function finishBqlTicketAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const text = str(note);
  if (!tid || !text) return fail("INVALID_INPUT", "Vui lòng nhập ghi chú xử lý.");
  return act(() => post(path(tid, "handled"), { note: text }));
}

/** "Việc của BQL" sent back to reception (SPEC-P01 §2) */
export async function returnBqlTicketAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const text = str(note);
  if (!tid || !text) return fail("INVALID_INPUT", "Vui lòng nhập lý do chuyển lại.");
  return act(() => post(path(tid, "return-to-bptn"), { note: text }));
}

export async function emergencyCloseAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const text = str(note);
  if (!tid || !text) return fail("INVALID_INPUT", "Vui lòng nhập ghi chú.");
  return act(() => post(path(tid, "emergency/close"), { note: text }));
}

export async function emergencyDowngradeAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const text = str(note);
  if (!tid || !text) return fail("INVALID_INPUT", "Vui lòng nhập lý do hạ mức.");
  return act(() => post(path(tid, "emergency/downgrade"), { note: text }));
}

/** Plan 23: merge an emergency waiting for BQL into the open emergency it duplicates */
export async function emergencyMergeAction(ticketId: string, into: string, note: string) {
  const tid = id(ticketId);
  const root = id(into);
  const text = str(note);
  if (!tid || !root || !text) return fail("INVALID_INPUT", "Vui lòng nhập lý do gộp.");
  return act(() => post(path(tid, "emergency/merge"), { into: root, note: text }));
}

export async function cancelTicketAction(ticketId: string, reason: string) {
  const tid = id(ticketId);
  const text = str(reason);
  if (!tid || !text) return fail("INVALID_INPUT", "Vui lòng nhập lý do hủy.");
  return act(() => post(path(tid, "cancel"), { cancel_reason: text }));
}

export async function getPerformanceReportAction() {
  return act(async () => api<import("@/lib/dto").PerformanceReportData>("/bql/reports/performance"));
}

