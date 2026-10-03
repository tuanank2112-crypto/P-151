# SPEC-P03 — Phòng ban, bỏ reopen, rating

Nguồn: CR-03 §9.2–§9.5, §4.3, §11.

## 1. T15 trả sai phòng ban (trước khi làm) — đếm

`wrong_department_return_count += 1`; khi `>= wrong_dept_return.escalate_at_count` ⇒ blocker `WRONG_DEPT` đặt
`escalated=true` + thông báo `escalation` cho BQL (không đổi trạng thái).

## 2. T16 / T17 / E02 (sau khi đã làm)

| Hàm | Từ → đến | Hiệu lực |
|---|---|---|
| `report_wrong_department` (DEPARTMENT đang giữ, ghi chú*) | `IN_PROGRESS → VERIFYING` | blocker `WRONG_DEPT_AFTER_START` chủ BQL; GIỮ `department_id`, checklist, vật tư, evidence; thông báo `escalation` cho BQL |
| `bql_wrong_department(KEEP)` (BQL, ghi chú*) | `VERIFYING → IN_PROGRESS` (T17) | blocker xoá; phòng ban làm tiếp |
| `bql_wrong_department(TO_BPTN)` (BQL, ghi chú*) | E02, `VERIFYING` giữ nguyên | blocker → `WRONG_DEPT` chủ BPTN `resume_step=6`; `department_id=None`, `dispatched_at=None`, `accepted_at=None`; GIỮ checklist, vật tư đã nhập, ghi chú, ảnh |

Khi BPTN gỡ `WRONG_DEPT` sau E02 và pipeline chạy lại bước 7: dòng vật tư mới **mang theo** `issued_qty`, `used_qty`,
`variance_reason` của dòng cũ cùng `item_code`. Bước 8 chỉ dựng lại checklist khi đổi playbook (đã có).

**CẤM:** dùng chung nút với T22 (rework); phòng ban tự trả lại sau `IN_PROGRESS` bằng T15.

## 3. T18 / T19 vật tư sau khi nhận việc

- `material_short` (DEPARTMENT, ghi chú*): `IN_PROGRESS → ON_HOLD/WAITING_MATERIAL`, chủ WAREHOUSE.
- `receive_stock` ⇒ `resume`: nếu blocker `WAITING_MATERIAL` và `accepted_at` có (đã từng `IN_PROGRESS`) ⇒
  T19 SYSTEM `ON_HOLD → IN_PROGRESS`; ngược lại như cũ (T12, chạy lại từ bước 6).

## 4. Bỏ reopen (CR-03 §4.3)

Xoá: dòng `CLOSED→READY_FOR_REVIEW`, `engine.reopen`, `Ticket.reopen_until`, `sla_config.reopen_window_days`,
endpoint `/resident/tickets/{id}/reopen`, hành động `REPORT_NOT_DONE`, nút UI "Báo chưa xong".

## 5. Rating (CR-03 §11)

- Chỉ khi `CLOSED`, hoặc `MERGED` mà ticket gốc `CLOSED`.
- Đã có `rating` ⇒ `GuardError` 409 (không ghi đè).
- Không đổi trạng thái/priority/phòng ban.
- Ticket `CLOSED` với `EMERGENCY_HANDLED`: lời công khai chung từ `i18n/vi.yaml`, không chi tiết rủi ro.
