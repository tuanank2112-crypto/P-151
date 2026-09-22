// lib/reason-messages.ts — bảng ánh xạ `reason_code` → câu hiển thị cho cư dân.
// SAO Y §6.4 của `SPEC-P02-Agent-Pipeline.md` (BB-05, Đ07).
//
// VÌ SAO NẰM Ở FILE `.ts` CHỨ KHÔNG PHẢI TRONG `.tsx`: giống `PublicTurnResult`
// ở `lib/types.ts`, tầng hiển thị chỉ được nhận CÂU ĐÃ DỊCH, không được tự suy
// từ tín hiệu nội bộ. Giữ bảng ở một chỗ để đổi giọng văn không phải sửa JSX.
//
// CẤM thêm phần trăm, thanh tiến độ hay bất kỳ số nội bộ nào vào các câu dưới.

import type { ReasonCode } from "./types.ts";

export const REASON_MESSAGE_VI: Record<ReasonCode, string> = {
  no_eligible_source:
    "Tôi chưa có tài liệu nào đủ căn cứ để trả lời việc này. Tôi đã chuyển yêu cầu sang Ban quản lý.",
  source_conflict:
    "Tôi tìm thấy hai tài liệu đang có hiệu lực nhưng nói khác nhau về việc này. Tôi không tự chọn một bên — đây là hai nguồn để anh/chị đối chiếu, và tôi đã chuyển sang Ban quản lý.",
  source_expired_or_unknown:
    "Thông tin tôi tìm được nằm trong tài liệu đã hết hiệu lực. Tôi không dùng nó để trả lời. Đã chuyển sang Ban quản lý.",
  pii_or_account_specific:
    "Yêu cầu này chạm tới dữ liệu của cư dân hoặc căn hộ khác nên tôi không xử lý được.",
  legal_or_compensation_escalation:
    "Việc này liên quan trách nhiệm / bồi thường, cần Ban quản lý xử lý trực tiếp.",
  unsupported_intent: "Việc này nằm ngoài phạm vi tôi được hỗ trợ.",
  intent_unresolved: "Tôi chưa hiểu rõ anh/chị đang hỏi về việc gì.",
  emergency_or_life_safety:
    "Đây là tình huống khẩn cấp. Hãy gọi ngay bảo vệ toà nhà hoặc 114/115. Tôi không xử lý theo luồng hỏi đáp thông thường.",
  system_error:
    "Hệ thống đang gặp sự cố. Anh/chị thử lại giúp, hoặc tôi chuyển sang Ban quản lý.",
  reviewer_rejected_draft: "Ban quản lý đã xem và chưa đồng ý với câu trả lời này.",
  // ── 5 mã nhóm hành động (Đ48 / SPEC-P05 §7) ─────────────────────────────
  // Rà lại 2026-09-23 (H20 W3): bản cũ viết theo giả định "mọi mã action đều
  // dẫn tới Ban quản lý", sai với P05 — cư dân tự làm tiếp được ở 3/5 mã.
  action_quota_exceeded:
    "Anh/chị đã dùng hết hạn mức đặt chỗ của kỳ này nên tôi không đặt thêm được.",
  // B2 — câu này là CÂU HỎI gửi thẳng cho cư dân, không phải lời từ chối:
  // người xác nhận một lệnh không hoàn tác được là CHỦ chỗ đặt, không phải BQL
  // (SPEC-P05 §5.2, Đ48 mục 5). Bản cũ nói "Cần Ban quản lý xác nhận" — sai vai.
  action_irreversible_requires_confirmation:
    "Thao tác này không hoàn tác được. Anh/chị xác nhận huỷ chứ?",
  // B3 — CẤM hứa đã làm xong một phần: đúng nghĩa là KHÔNG RÕ đã ghi hay chưa.
  action_partial_execution_unknown:
    "Tôi đã gửi yêu cầu nhưng chưa rõ hệ thống ghi nhận chưa. Tôi không gửi lại để tránh đặt trùng — anh/chị xem lại mục chỗ đã đặt sau ít phút giúp.",
  action_authorization_missing:
    "Tôi chưa đọc được điều kiện cho thao tác này nên không thực hiện lệnh ghi nào.",
  action_duplicate_suspected:
    "Yêu cầu này trùng với một yêu cầu đã được ghi nhận trước đó — tôi giữ nguyên chỗ cũ, không tạo thêm.",
};

/** Câu hiển thị an toàn cho một `reason_code` bất kỳ. Không bao giờ trả chuỗi
 *  rỗng — NFR-02 cấm màn hình trắng ở mọi nhánh lỗi. */
export function reasonMessageVi(code: ReasonCode | null): string {
  if (!code) return "";
  return REASON_MESSAGE_VI[code] ?? REASON_MESSAGE_VI.system_error;
}
