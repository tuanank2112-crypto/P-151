# SPEC-P01 — Ca khẩn cấp nghi trùng

## 1. Đánh dấu — `_mark_emergency_duplicate(work, now) -> str | None`
Gọi NGAY sau khi `work` nhận blocker `EMERGENCY_PENDING_BQL`, ở đủ 3 chỗ: bước 2b (`_step_2b_assess_safety` nhánh EMERGENCY), E01 (`safety_escalate`), T07 (`NEED_INFO → VERIFYING`).
1. `location = self.effective_location(work)`; `None` ⇒ trả `None` (không đoán).
2. Ứng viên = `_open_emergencies_at(location, exclude={work id} ∪ work.not_duplicate_of)` lọc chỉ ca **tạo trước** `work` (so `(created_at, ticket_id)`). Chọn ca cũ nhất **không có con trỏ** (là gốc); không có ca nào như vậy ⇒ ca cũ nhất (R02 F-A: sau khi BQL gộp gốc vào ca mới hơn, ca cũ nhất còn mở có thể là ca nghi trùng ⇒ trỏ vào nó tạo chuỗi, nút gộp bị chặn). KHÔNG đi theo con trỏ của ứng viên (R01 F2: con trỏ có thể dẫn tới ticket không còn khẩn cấp); mọi ứng viên đều là khẩn cấp mở nên ca cũ nhất là gốc.
3. Không có ⇒ `None`. Có `root_id` ⇒
   - `blocker.related_ticket_id = root_id` (model_copy, `_set_ticket`);
   - audit `LINK_TICKETS` trên `work`, `field_name="blocker.related_ticket_id"`, `None → root_id`, actor AGENT, lý do `"Nghi trùng khẩn cấp {root_id} cùng vị trí"`;
   - `_count_duplicate(root, +1, work id, AGENT, why="Phản ánh khẩn cấp nghi trùng")`;
   - payload `emergency.created` của `work` thêm `"suspected_duplicate_of": root_id`.
BẮT BUỘC: không đổi status/owner của `work` hay `root` (I-1).

## 2. Trả số đếm
`_release_duplicate_count(work, previous_blocker, now)` mở rộng cho `EMERGENCY_PENDING_BQL`. Gọi ở:
| Sự kiện của ca nghi trùng | Gọi |
|---|---|
| Hủy (`_after_cancel`) | có sẵn |
| BQL hạ mức (T05) | thêm, trước `_run_pipeline` |
| BQL đóng (T10) | thêm |
| BQL gộp vào ca KHÁC gốc | trong `bql_merge` |
BQL gộp vào đúng gốc ⇒ KHÔNG trả, `counted=False` (đã đếm lúc đánh dấu).

`_recount_duplicates` (T09 mở lại) đếm thêm ca `VERIFYING/EMERGENCY_PENDING_BQL` có `related_ticket_id == id`.

## 3. Ca gốc rời trạng thái khẩn cấp mở — `_repoint_suspects(root, now)`
Gọi khi ca gốc bị hạ mức (T05), đóng (T10), hủy, hoặc BQL gộp nó vào ca khác (R01 F2/F7). Với các ca `VERIFYING/EMERGENCY_PENDING_BQL` đang trỏ nó, theo `(created_at, id)` tăng dần:
- gốc mới = ca mà gốc cũ vừa gộp vào (nếu gộp), ngược lại = ca nghi trùng cũ nhất;
- mỗi ca: −1 trên gốc cũ (nếu còn mở); ca là gốc mới (hoặc gốc mới nằm trong `not_duplicate_of` của nó) ⇒ xoá con trỏ; còn lại ⇒ trỏ gốc mới, +1 trên gốc mới; audit `LINK_TICKETS` mỗi lần đổi.

| Ca | Hành vi |
|---|---|
| Gốc hạ mức trước | ca nghi trùng cũ nhất thành gốc; ca khẩn cấp mới sau đó trỏ nó; gốc cũ (giờ là ticket thường) đếm 0 từ phía khẩn cấp |
| Gốc đóng/hủy | như trên |
| BQL gộp gốc vào chính ca nghi trùng của nó | ca đó hết con trỏ (không vòng); các ca khác trỏ nó |
| Ba ca cùng chỗ | ca 2, 3 trỏ ca 1; gốc đếm 2 |
| Ca gộp rồi hoàn tác (T09) | chạy lại từ 2 ⇒ 2b đánh dấu lại; gốc trong `not_duplicate_of` ⇒ không trỏ lại |
| Thiếu vị trí | không nghi trùng |
| Ca Bậc 2 tạo TRƯỚC được nâng (E01) sau một ca khẩn cấp mới hơn | không ca nào nghi trùng (chỉ so ca tạo trước) — khe hở đã biết (R01 F10), chấp nhận |
`_recount_duplicates` (T09) đếm cả ca khẩn cấp nghi trùng; với `_repoint_suspects`, ticket MERGED không còn ca nào trỏ nó nên nhánh này hiện không tới được — giữ cho định nghĩa nhất quán.

## 4. Vùng cấm
- Không dùng `_related_ticket_ids` (cửa sổ 48 giờ, mọi ticket) để chọn gốc — trùng phải là ca khẩn cấp đang mở.
- Không ghi `related_ticket_id` lên ca gốc.
