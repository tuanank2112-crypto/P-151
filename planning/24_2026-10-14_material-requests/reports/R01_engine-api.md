Worker · thi công · Claude Sonnet 5.5 · Bước 0 exit=0 · hiểu việc: phạm vi = engine/models/views/router + test p24 + sửa test_stock_alerts chỗ ghim hành vi cũ, CẤM portal/mobile/coordination/migration/seed/brain4agent; xong khi = pytest toàn bộ exit 0 + ruff file đã sửa + 5/5 phép phá đỏ; cấm = bảng phiếu riêng, bật lại duyệt vật tư, lưu "đủ/chưa đủ", ghi Supabase
Handoff: H01_engine-api.md
Base: fc434d6
Head: working tree (chưa commit)

## Lệnh + exit code
- `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` ⇒ exit 0 ("NÃO ĐÃ OK"; cảnh báo BRN-028 today.md 691 dòng, không phải của gói này).
- `PYTHONUTF8=1 LLM_MODE=mock .venv/Scripts/python.exe -m pytest tests -q -p no:cacheprovider --ignore=integration` ⇒ exit 0, `3677 passed, 102 deselected in 190.25s` ⇒ 0 failed, 0 skipped (nền trước gói: 3653 passed; chạy 2 lần cách nhau, cùng kết quả). Trong đó file mới `test_p24_material_requests.py` = 15 passed. Không có file đỏ của hồ sơ 23.
- `ruff check src/maintenance/models.py src/maintenance/views.py src/maintenance/engine.py tests/test_maintenance/test_stock_alerts.py tests/test_maintenance/test_p24_material_requests.py` ⇒ exit 0 (All checks passed).
- `ruff format --check models.py views.py test_stock_alerts.py test_p24_material_requests.py` ⇒ exit 0 (4 files already formatted).
- `ruff check src/api/routers/maintenance.py` ⇒ exit 1, duy nhất `I001` ở dòng 13 (import `reports` đứng trước `engine`, có sẵn ở HEAD, đúng loại lỗi handoff §3 dặn không sửa). Phần import tôi thêm đã đúng thứ tự.
- `ruff format --check` trên `engine.py` và `routers/maintenance.py` ⇒ exit 1 chỉ vì 2 chỗ CÓ SẴN ở HEAD ngoài phạm vi: `engine.py` hàm `get_performance_report` thiếu dòng trống, `routers/maintenance.py` dòng trống thừa cuối file. Phần tôi viết đã đúng định dạng (đã đối chiếu `--diff`).
- `grep -cP '[\x08\x0c\x0b]'` trên 6 file đã sửa/tạo = 0 cả 6.

## git diff --stat (phạm vi; engine.py gồm cả thay đổi chưa commit của hồ sơ 23, giữ nguyên)
```
 src/api/routers/maintenance.py              |  54 +++++-
 src/maintenance/engine.py                   | 290 +++++++++++++++++++++++-----
 src/maintenance/models.py                   |  32 ++-
 src/maintenance/views.py                    |  46 ++++-
 tests/test_maintenance/test_stock_alerts.py |  10 +-
 5 files changed, 372 insertions(+), 60 deletions(-)
```
File mới (untracked): `tests/test_maintenance/test_p24_material_requests.py` (15 test), `planning/24_2026-10-14_material-requests/evidence/M1/mutation.txt`, file report này. SHA: chưa commit (Base fc434d6).

## Phép phá (evidence/M1/mutation.txt, máy sinh bằng script, file khôi phục byte-đúng sau mỗi phép)
Nền 15 passed exit 0 → 5 phép phá đều exit 1 (5/5 đỏ) → khôi phục exit 0, 15 passed.
| Phá | Đỏ |
|---|---|
| bỏ `GuardError("Kho đủ vật tư…")` | R-03, R-11b |
| alert mang mọi ticket đang chờ (không lọc theo phòng) | R-07, R-10, R-11 |
| `material_requests` không lọc theo phòng | R-12, R-11 |
| bỏ `_notify` material.shortage | R-01, R-02 |
| `tickets[].waiting` luôn True | R-05, R-11 |

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| M1 engine + API + test | 🟠 | Claude Sonnet 5.5 (tự làm, không phóng subagent) |

## Test cũ đã sửa + lý do (M01.2, plan 20 SPEC-P01 §1 bị thay)
`tests/test_maintenance/test_stock_alerts.py`:
- `test_a07`: bỏ `CLN` khỏi vòng "phải bị từ chối" (phòng ban nào cũng đọc alert phòng mình); thêm khẳng định `list_stock_alerts(CLN) == []`. Đổi tên hàm cho đúng.
- `test_api_denials_and_unknown_alert`: ca 403 đổi actor từ `CLN` sang `BPTN`.
- `test_a01`: siết `alert_id` bắt đầu `SIM-SAL-MAT-LAMP-02-TEC-` (id có hậu tố phòng, SPEC-P02 §1).
Các test A01-A09 còn lại giữ nguyên và xanh (hành vi plan 20 "tồn trước ≤ 0 ⇒ alert phòng dùng mã" vẫn giữ, R-09).

## Quyết định thực thi nhỏ (không lệch hợp đồng, người duyệt đổi được)
1. `MaterialRequestLine`/`MaterialRequestView` đặt trong `models.py` (CONTRACTS ghi `views.py`) vì `views.py` import engine, engine trả về model này, đặt ở views sẽ vòng import. `views.py` re-export hai tên đó. `StockAlertView`/`stock_alert_views` (trường `tickets`) đặt ở `views.py`.
2. `report_material_shortage` gọi `_apply_transition` trực tiếp trong `_mutate` (Action `UPDATE_MATERIAL`, quyền phòng ban), không sửa nhánh `(IN_PROGRESS, ON_HOLD)` của `_human_transition`: nhánh đó là đường `transition()` chung (BLOCKED_ONSITE cần eta), để nguyên đúng như SPEC dặn "BLOCKED_ONSITE KHÔNG đổi hành vi". Không thêm Action mới nên `enums.py` không đụng.
3. Mã lỗi guard thực tế là `GUARD_FAILED` (engine có sẵn), bảng 01 §4 ghi "GUARD"; HTTP 409 đúng, test dùng `GUARD_FAILED`. `INVALID_TRANSITION` 409 đúng như bảng.
4. Ack alert phòng khác ⇒ tra alert qua `repo.stock_alerts` của 2 phòng (store/ ngoài phạm vi, không có hàm get theo id); không thấy alert ⇒ để store tự ném 404 như cũ.
5. Phép phá số 2 làm bằng cách cho alert mang toàn bộ `waiting` (tương đương "gửi mọi phòng") để R-07 đỏ chắc chắn, vì hiện không mã vật tư nào dùng chung hai phòng.
6. R-07 dùng `monkeypatch.setitem(catalog.playbook_materials, TEC, (…, BAG))` để hai phòng cùng chờ `SIM-MAT-BAG-01`; catalog thật không có mã dùng chung. Tồn đặt 5 (>0) nên alert chỉ có thể do ticket đang chờ.

## Việc KHÔNG làm + lý do
- Không đụng `portal/`, `src/mobile/`, `coordination/`, migration, seed, `brain4agent/`, docs (handoff chỉ giao M1; đồng bộ não/docs/version 1.17.0 nằm ở checklist cuối của plan.md).
- Không chạy `--pg` (Postgres): `StockAlert` bỏ ràng buộc `qty_before ≤ 0`/`qty_after > 0` ở model, cột DB vốn không có ràng buộc đó (migration 0005) nên không cần migration; chưa đo trên Postgres thật.
- Không cập nhật `plan.md` checklist (ngoài phạm vi ghi của handoff).
- Chưa kiểm hành vi job nhắc/leo thang cho ticket phòng ban đã nhận ở `WAITING_MATERIAL` (ngoài ma trận R-01..R-12).

## Câu hỏi cần người
- Không có (không phát sinh lệch SPEC cần dừng).

## Tiếp theo
🖐 Cần tay người: duyệt R01, quyết định có chạy `--pg` trước khi giao M2 không.
🤖 Agent làm được ngay: M2 (portal + app điện thoại, H02), thẩm định M3, đồng bộ não/docs khi plan chốt.
⭐ Nên làm trước: M2 portal/mobile, vì API đã sẵn và khoá hợp đồng `tickets[].waiting`, `/warehouse/requests`.
⏸ Chưa làm: docs/brain/version, `--pg`, UI.
