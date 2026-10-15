# SPEC-P02 — Tách hai việc sau khi gỡ an toàn

## 1. Điều kiện tách (thay P05 §3 đk 4)
`_try_split`: điều kiện 4 = `work.ticket.risk_level == RiskLevel.NONE`. Bỏ vế `safety_cleared_at is None`. Các điều kiện 1, 2, 3, 5 giữ nguyên.

## 2. Ticket con thừa hưởng gỡ an toàn
Trong `_split_mixed_report`, sau bước 5 của P05 §3.1 và TRƯỚC `_run_pipeline(child, 2, now)`: nếu gốc có `safety_cleared_at` ⇒ `_set_ticket(child, safety_cleared_by=…, safety_cleared_at=…, safety_clear_reason=…)` chép nguyên từ gốc.
Hệ quả: 2b của con chỉ đọc bổ sung sau mốc gỡ (`_safety_scope_text`); bổ sung chép từ gốc giữ `submitted_at` gốc ⇒ phần đã được người gỡ không bật lại.

Ticket tiếp theo (`follow_up_of`, P07) được tách ⇒ con chép `follow_up_of` của gốc, để không chờ chính ca nguồn (R01 F3).

## 3. Bất biến kiểm
- Con KHÔNG được ở `EMERGENCY_PENDING_BQL`/`SAFETY_REVIEW_REQUIRED` vì nội dung đã gỡ.
- Cư dân bổ sung SAU mốc gỡ có dấu hiệu nguy hiểm ⇒ 2b vẫn bắt (của ticket nhận bổ sung).

## 4. Vùng cấm
- Không cho tách khi `risk_level != NONE` (ca còn khẩn cấp/Bậc 2 vẫn chờ người).
- Không đặt `risk_level` của con khác NONE bằng tay.
