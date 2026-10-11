"use server";

import {
  BAD_TAGS,
  GOOD_TAGS,
  MAX_CONTENT,
  MAX_RATING_COMMENT,
  MAX_TITLE,
  MIN_DESCRIPTION,
  MIN_TITLE,
  PLACE_DEFS,
  PLACE_ORDER,
  placeLocation,
  type Place,
} from "@/lib/constants";
import { fail } from "@/lib/result";
import { act, id, num, str } from "@/server/act";
import { api } from "@/server/backend";
import { BackendError } from "@/server/backend-error";
import type { BResidentView } from "@/server/data/types";
import { filesOf, photoForm } from "@/server/uploads";

/**
 * `POST /resident/tickets` then (with photos) `POST .../photos` (01 §7). FormData: `title` (5-120), `description` (the
 * content, 10-2000), `place`, `placeDetail`, `photos`. The backend text is "<title>\n<content>\nVị trí: <where>".
 */
export async function submitTicketAction(fd: FormData) {
  return act(async (user) => {
    // a title is one line: line breaks would shift the title/content split on the way back
    const title = str(fd.get("title")).replace(/\s*\n\s*/g, " ");
    if (title.length < MIN_TITLE || title.length > MAX_TITLE) {
      throw new BackendError(422, "INVALID_INPUT", `Tiêu đề cần từ ${MIN_TITLE} đến ${MAX_TITLE} ký tự.`);
    }
    const description = str(fd.get("description"));
    if (description.length < MIN_DESCRIPTION || description.length > MAX_CONTENT) {
      throw new BackendError(422, "INVALID_INPUT", `Nội dung góp ý cần từ ${MIN_DESCRIPTION} đến ${MAX_CONTENT} ký tự.`);
    }
    const placeRaw = str(fd.get("place"));
    const place = (PLACE_ORDER as string[]).includes(placeRaw) ? (placeRaw as Place) : "floor";
    const detail = str(fd.get("placeDetail"));
    const home = { tower: user.tower, floor: user.floor, apartment: user.apartment };
    const where = user.tower ? placeLocation(place, detail, home) : [PLACE_DEFS[place].title, detail].filter(Boolean).join(" · ");
    const files = filesOf(fd, "photos");
    const form = files.length ? photoForm(files) : null; // fail before creating the ticket when the files are unusable
    const created = await api<BResidentView>("/resident/tickets", {
      json: { original_description: `${title}\n${description}\nVị trí: ${where}` },
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

export type RatingInput = { stars: number; tags?: string[]; comment?: string };

/** Stars 1-5, tags from GOOD_TAGS (>= 4 stars) or BAD_TAGS (<= 3), comment <= 500 (SPEC-P04 §4); the backend checks again */
export async function rateTicketAction(ticketId: string, input: RatingInput) {
  const tid = id(ticketId);
  const score = num(input?.stars);
  if (!tid || !Number.isInteger(score) || score < 1 || score > 5) return fail("INVALID_INPUT", "Vui lòng chọn từ 1 đến 5 sao.");
  const allowed: readonly string[] = score >= 4 ? GOOD_TAGS : BAD_TAGS;
  const tags = Array.isArray(input?.tags) ? input.tags.map(str).filter(Boolean) : [];
  if (tags.some((t) => !allowed.includes(t))) return fail("INVALID_INPUT", "Thẻ đánh giá không khớp với số sao.");
  const comment = str(input?.comment);
  if (comment.length > MAX_RATING_COMMENT) return fail("INVALID_INPUT", `Bình luận tối đa ${MAX_RATING_COMMENT} ký tự.`);
  return act(async () => {
    await api(`/resident/tickets/${tid}/rating`, { json: { score, tags: [...new Set(tags)], comment } });
    return null;
  });
}
