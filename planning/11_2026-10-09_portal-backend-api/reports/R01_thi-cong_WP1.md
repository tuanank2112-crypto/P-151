Vai: worker (vai-thi-cong) · thi công · họ/model: Claude Sonnet 5.5 · Bước 0 exit 0 (NÃO ĐÃ OK; chỉ cảnh báo BRN-028 today.md 499 dòng, không do WP1) · hiểu việc: phạm vi = backend SPEC-P01 §1–§4 + §3b + `rating` ở 2 view, không chạm `portal/**`, không thêm trường/enum vào doc ticket, không commit; xong khi = 3 file evidence EXIT=0 + 3 đột biến làm đỏ.
Handoff: handoffs/H01_thi-cong_WP1.md
Base: da20de9626fec59fd8732b404204f8b91c6f9118
Head: da20de9626fec59fd8732b404204f8b91c6f9118; working tree chưa commit

## Lệnh / exit
| Lệnh | Exit | Kết quả |
|---|---|---|
| `pytest tests/test_maintenance/test_portal_backend_ext.py` (trước khi sửa) | 1 | 52 failed, 1 passed — evidence/WP1/red-before.txt |
| cùng lệnh sau khi thi công | 0 | 56 passed (5 pg deselected) — green.txt |
| `pytest -q -p no:cacheprovider -rs` | 0 | 3720 passed, 0 failed, 0 skipped (90 pg deselected); trước WP1 = 3664 + 56 mới — pytest.txt |
| `ruff check src tests` | 0 | All checks passed — ruff.txt |
| `ruff format --check src tests` | 1 | chỉ `src/main.py` (có sẵn từ develop, không sửa); các file WP1 sạch (exit 0) |
| `pytest --pg` (ext, p1_store, store_postgres, persistence_*, cr03_store) trên postgres:16 docker tạm `localhost:55434/p151_test`, đã xoá container | 0 | 107 passed — pytest-pg.txt (kèm 5 test pg mới: hợp đồng store, engine chờ vật tư, cờ tắt không đụng bảng, check() nhận 0002 khi cờ tắt, migration 0003 up/down) |
| `grep -cP '[\x08\x0c\x0b]'` mọi file sửa | — | 0 |
| Đột biến (khôi phục engine.py, sha256 khớp) | 1 mỗi cái | m1 (to-bql bỏ kiểm escalated): 2 test đỏ; m2 (handled bỏ đòi OUT_OF_SCOPE): 1 đỏ; m3 (trùng tên ra mã mới): 3 đỏ — mutation-m{1,2,3}.txt (chạy trước bổ sung §3b/rating; không đụng phần đó) |

Test: tổng 3720 / pass 3720 / fail 0 / skip 0.

## git diff --stat (WP1; `portal/**` là của WP2, không tính)
seed/maintenance_v1/accounts.yaml +28 · src/api/auth.py +13 · src/api/routers/maintenance.py +71 · src/config.py +8 · src/maintenance/engine.py ~+215 · store/__init__.py +2 · store/base.py +22 · store/memory.py +12 · store/postgres.py +54 · views.py +4 · tests/test_auth.py 12 · tests/test_p1_store.py 8 (12 file, 431+/18-).
Untracked của WP1: src/maintenance/store/migrations/versions/0003_material_items.py · tests/test_maintenance/test_portal_backend_ext.py · evidence/WP1/* · reports/R01.

## Route / model mới
- `POST /mo/tickets/{id}/to-bql {note}` (BPTN) · `POST /bql/tickets/{id}/handled {note}` · `POST /bql/tickets/{id}/return-to-bptn {note}` (BQL)
- `POST /mo/tickets/{id}/wrong-department {note}` (phòng ban) · `POST /bql/tickets/{id}/wrong-department {decision: KEEP|TO_BPTN, note}`
- `POST /mo/warehouse/items {item_name, unit}` → 201 `StockRow{item_code,item_name,unit,qty}`; cờ tắt → 403 `FEATURE_DISABLED`; vai WAREHOUSE/BQL/DEPARTMENT
- `POST /mo/warehouse/stock/{code}` nay cho WAREHOUSE và BQL (PERMISSIONS[RECEIVE_STOCK])
- `CatalogView`: `custom_materials_enabled`, materials thêm khoá `unit`, gộp vật tư thêm; `Me.profile`, `Account.profile`; `ResidentTicketView.rating`, `BqlTicketRow.rating` (chỉ response)
- Engine: `send_to_bql`, `bql_handle_out_of_scope`, `bql_return_to_bptn`, `create_material_item`, `material()`, `all_materials()`; repo: `MaterialItem`, `material_items()`, `add_material_item()`; Settings `mo_custom_materials` + `custom_materials_enabled()`; Alembic `0003_material_items`.

## Quyết định của worker
1. **`handled` đóng bằng `closure_kind=EMERGENCY_HANDLED`, KHÔNG phải NORMAL như SPEC.** Lý do: `Ticket._status_rules` (models.py) cấm CLOSED không có `department_id` trừ khi EMERGENCY_HANDLED; ticket OUT_OF_SCOPE chưa từng có phòng ban. NORMAL cần nới validator trong models.py (ngoài phạm vi) và bản backend cũ trên Render đọc chung Supabase sẽ không đọc nổi doc đó (đúng loại sự cố `merged_children`). Đổi về NORMAL = 1 dòng (`BQL_HANDLED_CLOSURE` trong engine.py) + 1 dòng test (`HANDLED_CLOSURE`) sau khi quyết nới validator. Cần người/điều phối chốt.
2. Audit dùng `Action.TRANSITION` (không có ESCALATE; thêm enum bị cấm). Trường audit `blocker.escalated` / `closure_kind`.
3. `to-bql` đặt `escalated=true` và `next_retry_at=None` (giống job leo thang) để job không nhắc BPTN nữa.
4. Body `note` của route mới dùng `NoteBody` (note rỗng/thiếu ⇒ engine `GuardError` ⇒ 409 GUARD_FAILED như bảng SPEC §5), không dùng min_length (sẽ ra 422).
5. `HEAD_REVISION` = `0003_material_items`; `check()` vẫn nhận DB ở `0002` khi cờ vật tư tắt (mặc định tắt trên postgres) và báo lỗi khi cờ bật mà thiếu bảng ⇒ chạy backend mới trên Supabase chưa migrate không vỡ. Repo postgres cờ tắt không bao giờ truy vấn bảng.
6. Tên vật tư so sánh NFC + casefold + strip (SPEC: casefold+strip); từ chối ký tự điều khiển/NUL. Tên trùng danh mục yaml trả mã yaml (`created_by="catalog"`).
7. `reset` xoá luôn vật tư thêm (kèm tồn) ở memory; postgres chỉ khi cờ bật.
8. `receive_stock` bởi vai sai: vẫn 403 như cũ nhưng KHÔNG có audit ACTION_DENIED (không có ticket để ghi audit; hành vi sẵn có). Yêu cầu "kythuat01 ⇒ 403 + audit" chỉ đạt phần 403.

## Test cũ phải đổi (ngoài file-list, lý do)
- `tests/test_maintenance/test_auth.py::test_every_account_maps_to_a_catalog_actor`: khẳng định "một tài khoản/actor" và "mọi mật khẩu Demo@2026" mâu thuẫn trực tiếp SPEC §1 (6 tài khoản mới dùng chung actor, mật khẩu 123456) ⇒ tách legacy/portal.
- `tests/test_maintenance/test_p1_store.py` j03 (HEAD == marker 0002) và j04 (pg): head nay là 0003, 0002 vẫn được nhận.
- Không có test cũ nào khẳng định BQL bị 403 khi nhập kho (grep sạch); `test_api.py:217` (BPTN nhập kho ⇒ 403) vẫn đúng.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP1 toàn bộ | 🟠 | Claude Sonnet 5.5 (không giao con) |

## Việc KHÔNG làm
- Không sửa models.py / nới validator (xem Quyết định 1). Không chạm `portal/**`, không commit/push, không kết nối Supabase, không đọc `.env`.
- Không cập nhật `plan.md`/docs/brain (ngoài file-list; thuộc WP8). `CatalogView` nằm ở router, không ở views.py như plan.md §3 ghi.
- `src/main.py` giữ lệch định dạng có sẵn.

## Câu hỏi mở (cần người)
1. Chốt Quyết định 1: giữ EMERGENCY_HANDLED, hay cho phép nới `Ticket._status_rules` (cần xác nhận bản Render cũ chịu được) để dùng NORMAL?
2. Có muốn audit ACTION_DENIED cho nhập kho sai vai (cần quy ước ghi audit không gắn ticket)?

⏳ Chờ người duyệt.
