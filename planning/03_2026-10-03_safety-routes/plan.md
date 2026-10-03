# 03 — Route API bọc 5 method safety/khẩn cấp của engine

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ ĐÃ HOÀN THÀNH — 2026-10-03 12:15:47 +0700 · route `24a99ac` · PR vào develop |
| Loại | PATCH (≤ 1 ngày, route mỏng bọc method có sẵn) — AGENTS §3.2.5: chỉ `plan.md` |
| Yêu cầu | Trường (2026-10-03): `planning/02_2026-10-03_truong-mvp-prep/deliverables/handoff-noy-safety-routes.md` — owner Như Ý |
| Nhánh | `feature/nhuy-safety-routes` từ `origin/develop` `512131a` (+ cherry-pick ghi chú não `264077a`) |
| Đích | PR vào `develop`; gửi Trường SHA + báo cáo pytest/ruff |

## §2. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do | Lật · chi phí |
|---|---|---|---|---|
| Q01 | 2026-10-03 12:10 | **Tên route khớp đúng đường dẫn UI đang gọi trên `develop`** (`src/web/app.js`, PR #8 của Trí): `POST /api/v1/mo/tickets/{id}/safety` body `{decision: CONFIRM_SAFE \| REQUEST_INFO \| ESCALATE, note}` ⇒ `engine.safety_confirm_safe` / `safety_request_info` / `safety_escalate`; `POST /api/v1/bql/tickets/{id}/emergency/close` `{note}` ⇒ `engine.emergency_close`; `POST /api/v1/bql/tickets/{id}/emergency/downgrade` `{note}` ⇒ `engine.emergency_downgrade`. Trường để owner chốt tên; chọn theo UI để không phải sửa UI và khớp contract router của Châm Anh. | Một đường dẫn duy nhất cho mỗi việc | Đổi tên ⇒ sửa UI · rẻ |
| Q02 | 2026-10-03 12:10 | Route **chỉ bọc**: không thêm logic an toàn, không kiểm vai ở router (engine đã kiểm và trả 403/409/422 có audit). Ánh xạ lỗi dùng đúng hàm/kiểu xử lý lỗi sẵn có của router. `decision` sai giá trị ⇒ 422 (validation của body). `closure_kind` nếu client gửi ⇒ bỏ qua (engine tự đặt `EMERGENCY_HANDLED`). | Handoff Trường §4 | — |
| Q03 | 2026-10-03 12:10 | Không làm: `set_priority` route, CREATE_FOLLOW_UP/gộp/hủy khẩn cấp (sau MVP — handoff §2); không sửa `src/web/` (góp ý bỏ `.catch` dự phòng gửi Trí riêng). | Phạm vi | — |

### Quyết định bị thay thế
- (chưa có)

## §3. Work Packages
| WP | Việc | Tầng | Vai |
|---|---|---|---|
| WP1 | Route + body model + test API + docs | 🟠 | worker-sonnet |
| WP2 | SO đo lại + phán; push; PR vào `develop`; báo Trường SHA + pytest/ruff | 🔴 | SO |

## §4. Checklist
- [x] WP1 report R01
- [x] WP2 SO đo + phán ✅
- [ ] Push + PR + báo Trường
- [x] Đồng bộ não
