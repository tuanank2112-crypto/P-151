# SPEC-P01 — Phiếu vật tư

## 1. Tự sinh ở bước 7
Khi `_step_7_check_material_stock` dừng `ON_HOLD / WAITING_MATERIAL` (đường hiện có): thêm `_notify(work, "material.shortage", BlockerOwner.WAREHOUSE, now, {"request_id": f"PVT-{id}", "item_codes": [mã INSUFFICIENT], "source": "AGENT"})`. Không đổi gì khác của bước 7.

## 2. Phòng ban báo thiếu — `report_material_shortage`
Thứ tự BẮT BUỘC, trong một `_mutate`:
1. Quyền: vai DEPARTMENT và `actor.department_id == ticket.department_id`; sai ⇒ 403 (audit từ chối như các method phòng ban khác).
2. Ticket `IN_PROGRESS`; khác ⇒ `InvalidTransitionError`.
3. `lines` không rỗng, mã có trong catalog, thuộc phòng (`check_selection`), `planned_qty > 0`; sai ⇒ `GuardError`.
4. Gộp vào kế hoạch: với mỗi mã trong `lines`, `planned_qty` của dòng = max(planned cũ, issued cũ + planned mới) — số **cần thêm** cộng vào cái đã xuất; mã chưa có ⇒ thêm dòng (`_material_line`). Mã không nêu GIỮ NGUYÊN. Ghi audit `UPDATE_MATERIAL` như `confirm_materials`.
5. `_refresh_line_stock(work)`. Không dòng nào **trong các mã được báo** `INSUFFICIENT` ⇒ `GuardError("Kho đủ vật tư, không cần báo thiếu")` — toàn bộ giao dịch hủy (I-3).
6. Chuyển `IN_PROGRESS → ON_HOLD` blocker `WAITING_MATERIAL` (chủ `WAREHOUSE`, `internal_note = note`, lịch nhắc/leo thang như bước 7), actor = nhân viên. Mở rộng nhánh `(S.IN_PROGRESS, S.ON_HOLD)` của `_transition` theo lý do; nhánh `BLOCKED_ONSITE` KHÔNG đổi hành vi.
7. `_notify("material.shortage", WAREHOUSE, …, source="DEPARTMENT")`.

Gỡ: đường hiện có — `receive_stock` ⇒ `resume` ⇒ `_cleared` (không dòng `INSUFFICIENT`) ⇒ có `department_id` ⇒ `IN_PROGRESS` (đổi ghi chú thành "Kho đã nhập đủ vật tư"). Phòng ban KHÔNG tự gỡ (`resume_work` chỉ cho `BLOCKED_ONSITE`, giữ nguyên).

## 3. Danh sách phiếu — `material_requests(actor_id)`
- Duyệt `repo.list()`: ticket `ON_HOLD`, blocker `WAITING_MATERIAL`, `resolved_at is None`.
- `lines` = dòng có `material_stock_status == INSUFFICIENT` sau khi tính tồn hiện tại (đọc, KHÔNG ghi). Không dòng nào ⇒ bỏ phiếu đó (tồn đã đủ, chờ job/nhập kế tiếp gỡ).
- `source`/`reported_by`: từ audit `TRANSITION` gần nhất vào `ON_HOLD` với `WAITING_MATERIAL` — actor AGENT/SYSTEM ⇒ `AGENT`, nhân viên ⇒ `DEPARTMENT`.
- Phòng ban chỉ thấy phiếu `department_id` của mình; kho và BQL thấy hết. Vai khác ⇒ 403.
- Sắp `since` tăng dần.

## 4. Vùng cấm
- Không cho báo thiếu ở `ROUTED`/`ACCEPTED` chưa làm — chưa có hiện trường; bước 7 đã lo phần dự kiến.
- Không trừ/giữ chỗ tồn khi báo thiếu — xuất kho vẫn ở `save_material_usage`.
