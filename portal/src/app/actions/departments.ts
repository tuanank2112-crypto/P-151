"use server";

import { failingLabels } from "@/lib/backend-map";
import { fail } from "@/lib/result";
import { act, id, num, str } from "@/server/act";
import { api } from "@/server/backend";
import { BackendError } from "@/server/backend-error";
import type { BCase } from "@/server/data/types";
import { filesOf, photoForm } from "@/server/uploads";

const path = (tid: string, tail: string) => `/mo/tickets/${tid}/${tail}`;
const post = async (url: string, json?: unknown) => {
  await api(url, json === undefined ? { method: "POST" } : { json });
  return null;
};

export async function acceptAction(ticketId: string) {
  const tid = id(ticketId);
  if (!tid) return fail("INVALID_INPUT");
  return act(() => post(path(tid, "accept")));
}

/** ROUTED, wrong department: back to reception */
export async function returnAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const reason = str(note);
  if (!tid || !reason) return fail("INVALID_INPUT", "Vui lòng nhập lý do.");
  return act(() => post(path(tid, "return"), { note: reason }));
}

/** IN_PROGRESS, wrong department (T16): BQL decides */
export async function reportWrongDeptAction(ticketId: string, note: string) {
  const tid = id(ticketId);
  const reason = str(note);
  if (!tid || !reason) return fail("INVALID_INPUT", "Vui lòng nhập lý do.");
  return act(() => post(path(tid, "wrong-department"), { note: reason }));
}

/** Assign a team / technician (SPEC-P04 §3). On a ROUTED ticket this also accepts it (ROUTED -> IN_PROGRESS). */
export async function assignStaffAction(ticketId: string, staffId: string) {
  const tid = id(ticketId);
  const sid = id(staffId);
  if (!tid || !sid) return fail("INVALID_INPUT", "Vui lòng chọn nhân viên.");
  return act(() => post(path(tid, "assign"), { staff_id: sid }));
}

export type MaterialLineInput = { itemCode?: string; newItemName?: string; unit?: string; qty: number };

/** New names become catalog items first (`POST /mo/warehouse/items`), then one `material-plan` call (01 §7) */
export async function requestMaterialsAction(ticketId: string, lines: MaterialLineInput[], note?: string) {
  const tid = id(ticketId);
  if (!tid || !Array.isArray(lines) || lines.length === 0) return fail("INVALID_INPUT", "Chọn ít nhất một vật tư.");
  return act(async () => {
    const plan: { item_code: string; planned_qty: number }[] = [];
    for (const l of lines) {
      const qty = num(l?.qty);
      if (!(qty > 0)) throw new BackendError(422, "INVALID_INPUT", "Số lượng vật tư phải lớn hơn 0.");
      let code = id(l.itemCode);
      if (!code) {
        const name = str(l.newItemName);
        if (!name) throw new BackendError(422, "INVALID_INPUT", "Thiếu tên vật tư.");
        const created = await api<{ item_code: string }>("/mo/warehouse/items", { json: { item_name: name, unit: str(l.unit) || "cái" } });
        code = created.item_code;
      }
      const same = plan.find((p) => p.item_code === code);
      if (same) same.planned_qty += qty;
      else plan.push({ item_code: code, planned_qty: qty });
    }
    await api(path(tid, "material-plan"), { json: { lines: plan, note: str(note) || "Yêu cầu vật tư theo kiểm tra tại hiện trường" } });
    return null;
  });
}

type UsedInput = { itemCode: string; issued: number; used: number; reason?: string };

/**
 * Photos, checklist, materials, note, then `complete` (01 §7). FormData fields: `note`, `photos` (files),
 * `checklist` (repeated template_item_id), `used` (repeated JSON {itemCode, issued, used, reason?}).
 * `complete` that leaves the ticket IN_PROGRESS is reported as INVALID_INPUT with the translated failing items.
 */
export async function finishTicketAction(ticketId: string, fd: FormData) {
  const tid = id(ticketId);
  if (!tid || !(fd instanceof FormData)) return fail("INVALID_INPUT");
  return act(async () => {
    const files = filesOf(fd, "photos");
    const form = files.length ? photoForm(files) : null;
    const checklist = fd.getAll("checklist").map(str).filter(Boolean);
    const used: UsedInput[] = [];
    for (const raw of fd.getAll("used")) {
      try {
        const u = JSON.parse(String(raw)) as UsedInput;
        if (id(u.itemCode) && num(u.issued) >= 0 && num(u.used) >= 0) used.push(u);
      } catch {
        throw new BackendError(422, "INVALID_INPUT", "Dữ liệu vật tư đã dùng không hợp lệ.");
      }
    }
    if (form) await api(path(tid, "photos"), { form });
    for (const item of checklist) {
      await api(`${path(tid, "checklist")}/${encodeURIComponent(item)}`, { json: { status: "COMPLETED" } });
    }
    for (const u of used) {
      await api(`${path(tid, "materials")}/${encodeURIComponent(u.itemCode)}`, {
        json: { issued_qty: u.issued, used_qty: u.used, variance_reason: str(u.reason) || null },
      });
    }
    const note = str(fd.get("note"));
    if (note) {
      await api(path(tid, "evidence"), { json: { requirement_id: null, evidence_type: "RESULT_NOTE", content_or_metadata: note } });
    }
    const done = await api<BCase>(path(tid, "complete"), { method: "POST" });
    if (done.ticket.status === "IN_PROGRESS") {
      const failing = done.draft?.readiness_evaluation?.failing_items ?? [];
      const why = failing.length ? failingLabels(failing).join("; ") : "Chưa đủ điều kiện hoàn thành";
      throw new BackendError(422, "INVALID_INPUT", `Chưa thể hoàn thành: ${why}.`, { failing_items: failing });
    }
    return null;
  });
}
