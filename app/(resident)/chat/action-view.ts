// app/(resident)/chat/action-view.ts — W1 (handoff H21, Đ48, SPEC-P05-Action-Layer.md
// §9): ánh xạ THUẦN từ `ActionResult` (lib/types.ts) sang view-model cho card kết quả
// hành động trong `/chat`. Hàm không JSX — test trực tiếp không cần render React
// (`tests/p05-ui-action-card.test.ts`).
//
// BẮT BUỘC (BB-05, VC-07): tham số là `PublicTurnResult` (đã cắt `confidence`/
// `gate_triggered` ở lib/types.ts) — KHÔNG nhận `TurnResult` thẳng, để chặn rò ở
// tầng kiểu, đúng cách `app/(resident)/chat/page.tsx::ChatResponseBody` đã làm.
//
// CẤM (handoff H21 phạm vi, luật §4): không hiện chữ nội bộ (fixture, mã SPEC…) cho
// cư dân; không lộ `confidence`/`gate_triggered`.

import type { ActionBookingView, PublicTurnResult } from "../../../lib/types";

export interface ActionDoneView {
  kind: "done";
  facility_name_vi: string;
  slot_start_vi: string | null;
  slot_end_vi: string | null;
  receipt_code: string;
  can_undo: boolean;
}

export interface ActionBlockedReasonView {
  message_vi: string;
  remediation_vi: string;
}

export interface ActionBlockedView {
  kind: "blocked";
  reasons: ActionBlockedReasonView[];
  next_intake_open_at_vi: string | null;
}

export interface ActionNeedsConfirmationView {
  kind: "needs_confirmation";
  question_vi: string;
}

export interface ActionListedView {
  kind: "listed";
  bookings: ActionBookingView[];
}

export interface ActionUnknownView {
  kind: "unknown";
  message_vi: string;
}

export type ActionView =
  | ActionDoneView
  | ActionBlockedView
  | ActionNeedsConfirmationView
  | ActionListedView
  | ActionUnknownView;

/** Giờ Việt Nam đọc được cho cư dân, dạng "HH:mm dd/MM/yyyy". `null` khi thiếu
 *  hoặc ISO không parse được — gọi nơi dùng phải tự hiện "—" thay vì để trống. */
export function formatViDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
  return fmt.format(date);
}

/** B3 (SPEC-P05 §7): `WriteTimeout` — đã gửi, không rõ kết quả. CẤM gợi ý gửi lại. */
const UNKNOWN_MESSAGE_VI =
  "Yêu cầu đã được gửi nhưng chưa rõ kết quả. Anh/chị KHÔNG gửi lại — xem trang Biên nhận để kiểm tra thực trạng.";

/** `null` khi lượt này không có kết quả hành động để hiện (câu hỏi–đáp tri thức
 *  thường — hiện qua nhánh `answer_vi`/`citations` sẵn có của `TurnView`). */
export function toActionView(result: PublicTurnResult): ActionView | null {
  const ar = result.action_result;
  if (!ar) return null;

  switch (ar.status) {
    case "done":
      return {
        kind: "done",
        facility_name_vi: ar.facility_name_vi ?? "",
        slot_start_vi: formatViDateTime(ar.slot_start),
        slot_end_vi: formatViDateTime(ar.slot_end),
        receipt_code: ar.receipt_code ?? "",
        can_undo: ar.undo_capability_id != null,
      };
    case "blocked":
      return {
        kind: "blocked",
        reasons: ar.blocking_reasons.map((r) => ({
          message_vi: r.human_message_vi,
          remediation_vi: r.remediation_hint_vi,
        })),
        next_intake_open_at_vi: formatViDateTime(ar.next_intake_open_at),
      };
    case "needs_confirmation":
      return {
        kind: "needs_confirmation",
        question_vi:
          result.clarify_question_vi ?? "Anh/chị xác nhận thực hiện thao tác này chứ?",
      };
    case "listed":
      return { kind: "listed", bookings: ar.bookings };
    case "unknown":
      return { kind: "unknown", message_vi: UNKNOWN_MESSAGE_VI };
    default:
      return null;
  }
}
