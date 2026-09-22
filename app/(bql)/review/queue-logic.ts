// app/(bql)/review/queue-logic.ts — H16 W3: logic sắp xếp/khoá thuần, tách
// khỏi `ReviewQueueList.tsx` để test được không cần render React
// (SPEC-P03 §3.5: "pending trước, mới nhất trước"; §3.3: ba trạng thái cuối
// đều là cuối, khoá nút khi `state !== 'pending'`).

import type { ReviewQueueRow } from "../../../lib/adapters/bql-store.ts";
import type { ReviewState } from "../../../lib/types.ts";

/** `true` khi dòng KHÔNG còn ở `pending` ⇒ 3 nút Duyệt/Sửa/Từ chối phải khoá
 *  (SPEC-P03 §3.3 — ba trạng thái cuối đều là cuối, không có đường quay lại). */
export function isReviewRowLocked(state: ReviewState): boolean {
  return state !== "pending";
}

/**
 * Sắp xếp lại danh sách hàng đợi: `pending` trước (còn việc phải làm), mới
 * nhất trước trong mỗi nhóm (SPEC-P03 §3.5). Trả mảng MỚI, không sửa mảng
 * đầu vào — component giữ nguyên state do server trả về.
 */
export function sortReviewQueueRows(rows: readonly ReviewQueueRow[]): ReviewQueueRow[] {
  return [...rows].sort((a, b) => {
    const pendingDiff = Number(a.state !== "pending") - Number(b.state !== "pending");
    if (pendingDiff !== 0) return pendingDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
