"use server";

import { fail } from "@/lib/result";
import { act, id, str } from "@/server/act";
import { api } from "@/server/backend";

const path = (tid: string, tail: string) => `/mo/tickets/${tid}/${tail}`;
const post = async (url: string, json: unknown) => {
  await api(url, { json });
  return null;
};

/** ve_sinh / ky_thuat => `bptn-resolve {category}`; bql => `to-bql` (01 §7, SPEC-P01 §2) */
export async function routeTicketAction(ticketId: string, dept: string, note?: string) {
  const tid = id(ticketId);
  if (!tid || !["ve_sinh", "ky_thuat", "bql"].includes(dept)) return fail("INVALID_INPUT");
  const text = str(note);
  return act(() =>
    dept === "bql"
      ? post(path(tid, "to-bql"), { note: text || "Tiếp nhận chuyển Ban quản lý xử lý" })
      : post(path(tid, "bptn-resolve"), {
          category: dept === "ve_sinh" ? "VE_SINH" : "KY_THUAT",
          note: text || "Tiếp nhận phân loại",
        }),
  );
}

/**
 * Blocker MISSING_INFO: reception called the resident and fills in what is missing (`bptn-resolve` location/info,
 * reason required). With a department the category is locked too; without one the Agent classifies again. The backend
 * refuses while a field is still missing ("Vẫn thiếu: …"), so a ticket is never routed without its location.
 */
export async function fillMissingInfoAction(
  ticketId: string,
  input: { location?: string; info?: string; dept?: string; note?: string },
) {
  const tid = id(ticketId);
  const location = str(input.location);
  const info = str(input.info);
  const note = str(input.note);
  if (!tid || (!location && !info) || !note) return fail("INVALID_INPUT");
  if (input.dept && !["ve_sinh", "ky_thuat"].includes(input.dept)) return fail("INVALID_INPUT");
  const category = input.dept === "ve_sinh" ? "VE_SINH" : input.dept === "ky_thuat" ? "KY_THUAT" : undefined;
  return act(() =>
    post(path(tid, "bptn-resolve"), {
      ...(location ? { location } : {}),
      ...(info ? { info } : {}),
      ...(category ? { category } : {}),
      note,
    }),
  );
}

/** Blocker ASSET_UNCLEAR: the asset is identified on site */
export async function resolveAssetAction(ticketId: string, assetOnsite: boolean) {
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  return act(() => post(path(tid, "bptn-resolve"), { asset_onsite: assetOnsite === true, note: "Xác định tài sản tại hiện trường" }));
}

/** Blocker PENDING_REVIEW */
export async function confirmReviewAction(ticketId: string) {
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  return act(() => post(path(tid, "bptn-resolve"), { note: "Tiếp nhận xác nhận phân loại" }));
}

/** Blocker DUPLICATE: merge = true joins the tickets, false = not a duplicate */
export async function duplicateAction(ticketId: string, merge: boolean) {
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  return act(() =>
    post(path(tid, "bptn-resolve"), { merge: merge === true, note: merge === true ? "Tiếp nhận xác nhận trùng" : "Tiếp nhận xác nhận không trùng" }),
  );
}

/** Tier-2 safety blocker */
export async function safetyAction(ticketId: string, decision: string, note?: string) {
  const tid = id(ticketId);
  if (!tid || !["CONFIRM_SAFE", "REQUEST_INFO", "ESCALATE"].includes(decision)) return fail("INVALID_INPUT");
  return act(() => post(path(tid, "safety"), { decision, note: str(note) || undefined }));
}

/** Reception and management; the backend requires a reason */
export async function setPriorityAction(ticketId: string, priority: string, note: string) {
  const tid = id(ticketId);
  const reason = str(note);
  if (!tid || !["HIGH", "MEDIUM", "LOW"].includes(priority)) return fail("INVALID_INPUT");
  if (!reason) return fail("INVALID_INPUT", "Vui lòng nhập lý do đổi mức ưu tiên.");
  return act(() => post(path(tid, "priority"), { priority, note: reason }));
}
