# SPEC-P03 — Giữ ticket thường cùng chỗ, cùng loại việc với khẩn cấp

## 1. Quy tắc `_hold_for_emergency(work, now)` (đầu bước 8)
1. Liên kết hai chiều với mọi ca khẩn cấp mở cùng vị trí — như cũ.
2. Không có ca nào ⇒ `False`.
3. Cờ `hold_near_open_emergency` bật ⇒ giữ (như cũ).
4. Cờ tắt ⇒ giữ nếu **có ít nhất một** ca khẩn cấp mở cùng vị trí mà `kinds = _merged_kinds(ca)` KHÁC `None` và chứa `self._category(work)`. `None` (chưa ai đọc) ⇒ không giữ (E05).
5. Giữ = `_stop(ON_HOLD, WAITING_EMERGENCY, resume_step=8, note="Chờ BQL xử lý khẩn cấp {id} cùng vị trí")` với `id` = ca khẩn cấp gây giữ (cũ nhất).
6. Thả: `_release_waiting_for` như cũ (T05, T10, hủy, `bql_merge`). Khi còn ca khẩn cấp khác cùng chỗ: chỉ giữ tiếp nếu ca đó cũng thoả bước 4 — ngược lại chạy tiếp từ bước 8.

## 2. `_emergency_kinds(emergency) -> frozenset[ServiceCategory] | None`
1. `locked_fields.category` hoặc `split_category` (người/tách đã ghim) ⇒ `{đó}`.
2. `agent_decision` có `decision` ⇒ tập loại các job hợp lệ; rỗng ⇒ `None`. Ca khẩn cấp do luật bắt có record này sau khi Agent đọc (SPEC-P04).
3. Còn lại ⇒ `None` (chưa ai đọc).
**CẤM** suy loại từ chữ bằng luật/từ khoá (Q30, R01 F1, E05) và CẤM gọi `_classification` trên ca khẩn cấp.

Loại của một ca khẩn cấp dùng để giữ = hợp loại của nó và mọi ca BQL đã gộp vào nó (`_merged_kinds`); phần chưa đọc không thêm gì; không phần nào được đọc ⇒ `None` (R01 F4). Ticket chuyển sang chờ ca khẩn cấp khác ⇒ ghi chú blocker ghi mã ca đang giữ (R01 F8).

## 3. Bảng hành vi
| Khẩn cấp mở cùng chỗ | Ticket thường | Kết quả |
|---|---|---|
| luật bắt, Agent CHƯA đọc (hoặc không có Agent / mô hình lỗi) | bất kỳ | giao bình thường, có liên kết |
| luật bắt, Agent đọc ra job KY_THUAT | đèn | GIỮ |
| luật bắt, Agent đọc ra job KY_THUAT | rác | giao bình thường, có liên kết |
| Agent đọc ra không có job (vd "mùi khét") | bất kỳ | giao bình thường, có liên kết |
| Agent tự nâng khẩn cấp, job VE_SINH | rác | GIỮ |
| không có | — | như cũ |
