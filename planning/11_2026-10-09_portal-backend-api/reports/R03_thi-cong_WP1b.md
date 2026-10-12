Vai: worker (vai-thi-cong) · thi công · họ/model: Claude Sonnet 5.5 · Bước 0 exit 0 (NÃO ĐÃ OK; chỉ cảnh báo BRN-028 today.md 501 dòng, không do WP1b) · hiểu việc: phạm vi = backend SPEC-P04 §1–§5 (Agent tự chuyển BQL, duyệt cấp vật tư, phân công, thẻ+bình luận đánh giá, trường Agent), không chạm `portal/**`, không thêm trường/enum vào doc ticket, không commit; xong khi = green/pytest/ruff EXIT=0, đột biến m4/m5/m6 làm đỏ, pg chạy hoặc NOT_RUN.
Handoff: handoffs/H03_thi-cong_WP1b.md
Base: 4be628475540536b26a04a51f291e70edc8406b2
Head: ef4a4d92f94341fde543313ef2015ca7b77693fb; working tree chưa commit

## Lệnh / exit
| Lệnh | Exit | Kết quả |
|---|---|---|
| `pytest tests/test_maintenance/test_portal_backend_ext2.py` (trước khi sửa) | 1 | 40 failed, 11 passed — evidence/WP1b/red-before.txt |
| cùng lệnh `-v` sau thi công | 0 | 51 passed, 5 pg deselected — green.txt |
| `pytest -q -p no:cacheprovider -rs` | 0 | 3771 passed, 0 failed, 0 skipped (95 pg deselected); 3720 + 51 mới — pytest.txt |
| `ruff check src tests` | 0 | All checks passed — ruff.txt |
| `ruff format --check` (22 file tôi sửa/tạo) | 0 | sạch (`src/main.py` lệch có sẵn, không sửa) — ruff.txt |
| `pytest --pg` (ext, ext2, p1_store, store_postgres, persistence_api/guards, cr03_store) trên docker postgres:16-alpine `localhost:55434/p151_test`, container đã xoá | 0 | 163 passed — pytest-pg.txt (gồm 5 test pg mới: hợp đồng store, engine phân công+đánh giá, cờ tắt, check() revision, migration 0004 up/down) |
| `grep -cP '[\x08\x0c\x0b]'` mọi file sửa/tạo | — | 0 |
| Đột biến (khôi phục engine.py, sha256 `b9557be7…2afc` khớp trước/sau) | 1 mỗi cái | m4 (`_cleared` bỏ điều kiện resolved_at): 4 test đỏ; m5 (`_stop_out_of_scope` luôn chuyển BQL kể cả luật/fallback): 5 đỏ; m6 (cho phân công khác phòng): 2 đỏ — mutation-m{4,5,6}.txt |

Test: tổng 3771 / pass 3771 / fail 0 / skip 0. Lưu ý: `test_safety.py::test_assess_is_linear_on_a_24kb_text` (ngưỡng thời gian 1.0 s) đỏ khi máy tải nặng (đo 1.07–1.87 s lúc docker + uvicorn + worker khác chạy), xanh ở lần chạy sạch; không liên quan code WP1b (không đụng safety.py).

## git diff --stat (WP1b; `portal/**` không tính)
src/api/routers/maintenance.py · src/config.py +8 · src/maintenance/catalog.py +36 · engine.py +232/- · errors.py +10 · store/base.py +39 · store/memory.py +32 · store/postgres.py +82 · views.py +58 · tests: test_api.py 7, test_engine.py 9, test_p1_contracts.py 3, test_p1_store.py 8, test_portal_backend_ext.py 6 (14 file đã có, 581+/40-, kèm routers/maintenance.py).
Untracked: seed/maintenance_v1/staff.yaml · src/maintenance/store/migrations/versions/0004_portal_extras.py · tests/test_maintenance/test_portal_backend_ext2.py · evidence/WP1b/* · reports/R03.

## Route / model response mới
- `POST /mo/tickets/{id}/materials/approve {note?}` (WAREHOUSE, BQL) → Case; 409 `STOCK_SHORT` "Kho chưa đủ <tên>: cần X, còn Y — nhập kho trước"; 409 INVALID_TRANSITION nếu không ở ON_HOLD/WAITING_MATERIAL chờ duyệt. Đăng ký TRƯỚC `/materials/{item_code}`.
- `GET /mo/staff` (DEPARTMENT: phòng mình; BQL: tất cả; vai khác 403) → `[{staff_id, department_id, name, skill, area, capacity, open_tickets}]`
- `POST /mo/tickets/{id}/assign {staff_id}` (DEPARTMENT đúng phòng) → Case; ROUTED thì nhận việc luôn; nhân viên khác phòng/không có ⇒ 409 GUARD_FAILED; sai trạng thái 409 INVALID_TRANSITION; cờ tắt 403 FEATURE_DISABLED.
- `POST /resident/tickets/{id}/rating {score 1..5, tags?: string[], comment?: ≤500}`; tag sai/trùng/sai nhóm ⇒ 422; có tags/comment mà cờ tắt ⇒ 403 FEATURE_DISABLED.
- Response: `TicketSummary` + `staff_id, staff_name, rating, rating_tags, rating_comment, agent_source, agent_department, agent_scope`; `BqlTicketRow` + `rating_tags, rating_comment, staff_name, agent_department, agent_scope` (agent_source có sẵn); `ResidentTicketView` + `rating_tags, rating_comment`; `CatalogView.portal_extras_enabled`.
- Engine: `approve_materials`, `assign_staff`, `staff_list`, `check_rating`, `rate(..., tags=, comment=)`, `_stop_out_of_scope`; `errors.StockShortError` (code STOCK_SHORT), `InvalidRatingError`; repo: `Assignment`, `RatingDetail`, `assignments()`, `rating_details()`, `Tx.put_assignment/put_rating_detail`; `load_staff()`; Settings `mo_portal_extras` + `portal_extras_enabled()`; Alembic `0004_portal_extras` (bảng `assignments`, `rating_details`, chỉ CREATE TABLE).

## Quyết định của worker
1. **Đường resume §2:** đo thấy `_resume` cũ đặt ticket về RECEIVED rồi chạy lại pipeline từ bước 6 (sẽ giao lại phòng ban). Chọn: ticket đã có `department_id` + blocker WAITING_MATERIAL đã duyệt ⇒ `ON_HOLD → IN_PROGRESS` thẳng (actor SYSTEM, nên hàng `(ON_HOLD, IN_PROGRESS)` của TRANSITIONS thêm `Role.SYSTEM`; hàng `(IN_PROGRESS, ON_HOLD)` thêm reason WAITING_MATERIAL). Ticket chưa có phòng ban (blocker từ bước 7 pipeline) giữ nguyên đường cũ.
2. **`_cleared(WAITING_MATERIAL)`:** điều kiện `resolved_at` chỉ áp khi `department_id is not None` (yêu cầu của phòng ban). SPEC viết "AND resolved_at" tuyệt đối nhưng áp cho cả blocker pipeline sẽ vi phạm vùng cấm §6 (kiểm tồn tự động bước 6/7 không bắt duyệt).
3. Audit duyệt dùng `Action.APPROVE_MATERIAL` (đã có trong enum, chưa dùng; thêm vào PERMISSIONS WAREHOUSE+BQL). Phân công audit `TRANSITION` field `staff_id` (không dùng SET_ASSIGNEE vì bị từ chối mọi vai theo CR). Không thêm thông báo mới: `Notification.type` là Literal trong doc, thêm giá trị sẽ làm bản Render cũ vỡ.
4. **Cờ `MO_PORTAL_EXTRAS`** (mặc định bật ở memory, tắt ở postgres), mẫu như `MO_CUSTOM_MATERIALS`: DB còn ở 0003 vẫn khởi động được khi cờ tắt; `check()` tổng quát hoá (`_accepted_revisions`). Cờ tắt: phân công 403 FEATURE_DISABLED; đánh giá chỉ sao vẫn chạy, kèm thẻ/bình luận ⇒ 403.
5. `open_tickets` = số ticket được phân công cho nhân viên đó mà chưa ở trạng thái cuối (gồm cả READY_FOR_REVIEW).
6. `agent_department` = `department_id` của job hợp lệ đầu tiên; `agent_scope` = `decision.scope`; Agent chuyển BQL chỉ khi `scope == OUT_OF_SCOPE` (cả nhánh bước 2 thiếu vị trí lẫn bước 3 không job). Phân công/ghi chi tiết đánh giá ghi trong cùng giao dịch ticket (`self._local.tx`), lỗi bảng ⇒ không ghi điểm (có test).
7. `confirm_materials` có ≥1 dòng ⇒ ON_HOLD (cần duyệt); danh sách rỗng giữ IN_PROGRESS. Đang ON_HOLD chờ duyệt thì phòng ban không gửi lại kế hoạch được (`_require_in_progress`).

## Test cũ phải đổi (ngoài file-list, lý do SPEC)
- `test_api.py::test_no_endpoint_assigns_a_person`: cấm mọi path chứa "assign"; SPEC §3 buộc có đúng `/mo/tickets/{id}/assign` ⇒ khẳng định đúng một path, chỉ POST.
- `test_engine.py` (2 test vật tư): confirm ⇒ ON_HOLD, thêm bước `approve_materials` (Q15).
- `test_p1_contracts.py::test_c03`: PERMISSIONS 22 ⇒ 23 (APPROVE_MATERIAL).
- `test_p1_store.py` j03: HEAD 0004, chuỗi PREVIOUS 0004→0003→0002; `test_portal_backend_ext.py` 2 test pg: revision đầu là 0004 (khôi phục `HEAD_REVISION` thay vì cứng 0003).

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP1b toàn bộ | 🟠 | Claude Sonnet 5.5 (không giao con) |

## Việc KHÔNG làm
- Không chạm `portal/**`; không commit/push/stash; không kết nối Supabase, không đọc `.env`; không tắt backend cổng 8000 (backend đó chưa nạp code mới cho tới khi người khởi động lại).
- Không cập nhật plan.md/docs/brain (thuộc WP8). Không sửa `models.py`, `lexicon.yaml`, luật an toàn, prompt Agent.
- Chưa áp migration 0004 lên Supabase (OPERATIONS §3, cần người gật); mặc định postgres cờ tắt nên backend mới chạy được trên DB còn ở 0003.

## Câu hỏi mở (cần người)
1. Chốt Quyết định 2: `resolved_at` chỉ bắt buộc cho yêu cầu của phòng ban (đang làm) hay áp cả blocker pipeline (làm mọi ticket thiếu vật tư kẹt chờ duyệt, trái §6)?
2. Khi bật Supabase: chạy `alembic upgrade head` (0004) rồi đặt `MO_PORTAL_EXTRAS=true` — chờ OPERATIONS §3.
3. Câu hỏi WP1 còn mở: `handled` đang dùng `EMERGENCY_HANDLED` thay NORMAL (Q09).

⏳ Chờ người duyệt.
