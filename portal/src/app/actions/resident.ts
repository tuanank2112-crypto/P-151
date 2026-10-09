"use server";

import { MIN_DESCRIPTION, PLACE_DEFS, PLACE_ORDER, placeLocation, type Place } from "@/lib/constants";
import { fail } from "@/lib/result";
import { act, id, num, str } from "@/server/act";
import { api } from "@/server/backend";
import { BackendError } from "@/server/backend-error";
import type { BResidentView } from "@/server/data/types";
import { filesOf, photoForm } from "@/server/uploads";

/** `POST /resident/tickets` then (with photos) `POST .../photos` (01 §7). The location rides on a trailing "Vị trí:" line. */
export async function submitTicketAction(fd: FormData) {
  return act(async (user) => {
    const description = str(fd.get("description"));
    if (description.length < MIN_DESCRIPTION) {
      throw new BackendError(422, "INVALID_INPUT", `Vui lòng mô tả vấn đề (ít nhất ${MIN_DESCRIPTION} ký tự).`);
    }
    const placeRaw = str(fd.get("place"));
    const place = (PLACE_ORDER as string[]).includes(placeRaw) ? (placeRaw as Place) : "floor";
    const detail = str(fd.get("placeDetail"));
    const home = { tower: user.tower, floor: user.floor, apartment: user.apartment };
    const where = user.tower ? placeLocation(place, detail, home) : [PLACE_DEFS[place].title, detail].filter(Boolean).join(" · ");
    const files = filesOf(fd, "photos");
    const form = files.length ? photoForm(files) : null; // fail before creating the ticket when the files are unusable
    const created = await api<BResidentView>("/resident/tickets", {
      json: { original_description: `${description}\nVị trí: ${where}` },
    });
    let photoError: string | null = null;
    if (form) {
      try {
        await api(`/resident/tickets/${created.ticket_id}/photos`, { form });
      } catch (e) {
        photoError = e instanceof BackendError ? e.message : "Không gửi được ảnh, thử đính kèm lại sau.";
      }
    }
    return { id: created.ticket_id, code: created.ticket_id, photoError };
  });
}

export async function addExtraAction(ticketId: string, text: string) {
  const tid = id(ticketId);
  const content = str(text);
  if (!tid || !content) return fail("INVALID_INPUT", "Vui lòng nhập nội dung bổ sung.");
  return act(async () => {
    await api(`/resident/tickets/${tid}/additions`, { json: { content } });
    return null;
  });
}

export async function rateTicketAction(ticketId: string, stars: number) {
  const tid = id(ticketId);
  const score = num(stars);
  if (!tid || !Number.isInteger(score) || score < 1 || score > 5) return fail("INVALID_INPUT", "Vui lòng chọn từ 1 đến 5 sao.");
  return act(async () => {
    await api(`/resident/tickets/${tid}/rating`, { json: { score } });
    return null;
  });
}
