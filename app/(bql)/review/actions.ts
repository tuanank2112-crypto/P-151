"use server";
// app/(bql)/review/actions.ts — Server Actions hàng đợi HITL (R8, SPEC-P03
// §3.2). Mỗi action TỰ kiểm vai `bql` (E5 AuthzError) — cùng lý do đã ghi ở
// app/(bql)/documents/actions.ts.

import { revalidatePath } from "next/cache";
import { getSessionPayload } from "../../../lib/auth/guard.ts";
import {
  checkBqlAuthz,
  approveAnswer as storeApproveAnswer,
  editAndApprove as storeEditAndApprove,
  rejectAnswer as storeRejectAnswer,
  type ReviewError,
} from "../../../lib/adapters/bql-store.ts";

type ReviewResult = { ok: true } | { ok: false; error: ReviewError };

function authzErrorResult(): ReviewResult {
  return {
    ok: false,
    error: { code: "AuthzError", message_vi: "Chỉ Ban quản lý được thao tác này." },
  };
}

export async function approveAnswer(input: { review_id: string }): Promise<ReviewResult> {
  const session = await getSessionPayload();
  if (!checkBqlAuthz(session).ok || !session) return authzErrorResult();
  const result = await storeApproveAnswer({
    review_id: input.review_id,
    reviewer_id: session.user_id,
  });
  if (result.ok) revalidatePath("/review");
  return result;
}

export async function editAndApprove(input: {
  review_id: string;
  edited_draft_vi: string;
}): Promise<ReviewResult> {
  const session = await getSessionPayload();
  if (!checkBqlAuthz(session).ok || !session) return authzErrorResult();
  const result = await storeEditAndApprove({
    review_id: input.review_id,
    reviewer_id: session.user_id,
    edited_draft_vi: input.edited_draft_vi,
  });
  if (result.ok) revalidatePath("/review");
  return result;
}

export async function rejectAnswer(input: {
  review_id: string;
  reject_reason_vi: string;
}): Promise<ReviewResult> {
  const session = await getSessionPayload();
  if (!checkBqlAuthz(session).ok || !session) return authzErrorResult();
  const result = await storeRejectAnswer({
    review_id: input.review_id,
    reviewer_id: session.user_id,
    reject_reason_vi: input.reject_reason_vi,
  });
  if (result.ok) revalidatePath("/review");
  return result;
}
