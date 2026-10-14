# 20 — Thông báo Phòng Kỹ thuật khi kho nhập lại vật tư đã hết

## Metadata

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ local 2026-10-14 (server ⬜: áp 0005 + bật `MO_STOCK_ALERTS` cần người dùng) |
| Ngày tạo | 2026-10-13, Asia/Saigon |
| Loại / phiên bản đích | MINOR `1.14.1 → 1.15.0` (SPEC viết khi còn 1.13.0; 1.14.x đã dùng bởi hồ sơ 20_drop-legacy-ui): module `stock_alerts` + bảng `maintops.stock_alerts` (migration 0005) + 2 endpoint |
| Nhánh / base | `feature/chamanh`, HEAD `c003f20` |
| Yêu cầu | Người dùng, 2026-10-13: "Tạo thêm module để có thể có thông báo cho bên phòng kỹ thuật khi kho nhập thêm hàng mà kỹ thuật cần dùng sau một thời gian hết hàng" |
| Điều kiện đóng | Gate local ✅ (pytest, ruff, `--pg` trong docker); server ⬜ cho tới khi áp migration 0005 lên Supabase |

## Nhật ký quyết định

| ID | Thời điểm | Quyết định / lý do |
|---|---|---|
| D01 | 2026-10-13 | Đo hiện trạng: `Notification` buộc `ticket_id` + `audience: BlockerOwner` ⇒ KHÔNG chứa được thông báo cấp phòng ban. `receive_stock` chỉ chạy lại ticket `WAITING_MATERIAL`, không báo ai. Chọn bảng mới `stock_alerts`, KHÔNG nới `Notification` (tránh đổi hình doc ticket mà Render cũ đọc chung) |
| D02 | 2026-10-13 | "Hết hàng" = tồn TRƯỚC khi nhập đã xác định và `≤ 0`. Tồn `null` (không theo dõi) ⇒ không báo. `qty_before = qty_after − qty_added` từ giá trị `add_stock` trả về, trong CÙNG transaction ⇒ không race |
| D03 | 2026-10-13 | "Kỹ thuật cần dùng" = `item_code ∈ allowed_material_codes(catalog, DEPT_TECHNICAL)` (cùng nguồn guard plan 16) — không dựng danh sách thứ hai |
| D04 | 2026-10-13 | "Sau một thời gian hết hàng": KHÔNG đặt ngưỡng thời gian tối thiểu. Mọi lần nhập lại từ 0 đều báo; thời lượng hết hàng chưa đo được vì kho không ghi mốc về 0 ⇒ Idea Vault |
| D05 | 2026-10-13 | Ghi cảnh báo trong CÙNG transaction với `add_stock` (nguyên tử). Kênh ngoài (push/SMS/Zalo) ngoài phạm vi như `Notification` hiện có |
| D07 | 2026-10-14 | Người dùng lặp lại yêu cầu ("Tạo kênh gửi thông báo cho phòng kỹ thuật khi vật tư … được nhập hàng vào kho sau khi hết hàng 1 thời gian") ⇒ coi là duyệt SPEC với mặc định Q01–Q03; thi công |
| D08 | 2026-10-14 | Lệch SPEC có chủ đích: (a) bảng thêm `item_name`, `unit` (portal cần tên vật tư mà không tra catalog); (b) KHÔNG thêm `Action.READ_STOCK_ALERTS`/`ACK_STOCK_ALERT` vào `PERMISSIONS` (test ghim đúng 23 mục) — kiểm vai trong engine như `stock_levels`; (c) engine ghi alert khi `stock_alerts` VÀ `repo.supports_stock_alerts` (engine dựng thẳng với repo Postgres cờ tắt từng ném GuardError) |
| D06 | 2026-10-13 | Cờ `MO_STOCK_ALERTS` (tắt trên DB chưa áp 0005, theo mẫu `MO_PORTAL_EXTRAS`). Tắt ⇒ `receive_stock` chạy y hệt hiện tại |

### Quyết định bị thay thế

Không có.

## Câu hỏi chờ người dùng (mặc định đã chọn, đổi được trước khi thi công)

| Q | Câu hỏi | Mặc định SPEC |
|---|---|---|
| Q01 | "Hết" chỉ là tồn = 0, hay cả "dưới ngưỡng `min_qty`"? | Chỉ tồn ≤ 0. Mức "sắp hết" đã có cảnh báo ở màn Kho |
| Q02 | Cần giới hạn "hết ít nhất N giờ" mới báo? | Không (D04) |
| Q03 | Giao diện đợt này? | Backend + màn Kỹ thuật `portal/`. `src/web/`, `src/mobile/` → Idea Vault |

## Work Packages

| WP | Việc | Tầng | SPEC |
|---|---|---|---|
| WP1 | Model `StockAlert`, Tx/Repository (memory + postgres), migration 0005 | 🔴 | 01-CONTRACTS |
| WP2 | `engine.receive_stock` ghi cảnh báo; `list_stock_alerts`; `acknowledge_stock_alert` | 🟠 | SPEC-P01 |
| WP3 | Router 2 endpoint + `portal/` màn Kỹ thuật (chuông + danh sách) | 🟠 | 01-CONTRACTS §5, SPEC-P02 |
| WP4 | Test + phép phá + docs/brain | 🟠 / 🟢 | TESTING-ACCEPTANCE |

## Checklist thực thi

- [x] Người dùng duyệt SPEC (D07)
- [x] WP1 · [x] WP2 · [x] WP3 · [x] WP4
- [x] Gate local: pytest 3894 + `--pg` 102 = 3996 passed, `ruff check`/`format --check` sạch, portal `typecheck && lint && test` (144) ✅; 3 phép phá đỏ rồi xanh
- [x] Đồng bộ não (6 điểm; `project-intro` không đổi vì không thêm thư mục/ngôn ngữ), bump 1.15.0 (`portal/package.json`, `state.json`)
- [ ] Server: áp `alembic upgrade head` (0005) lên Supabase rồi `MO_STOCK_ALERTS=true` — cần người dùng gật (Luật L.3)

## Bảng trỏ SPEC

| File | Nội dung |
|---|---|
| `specs/00-ARCHITECTURE.md` | Mục tiêu, non-goals, bất biến, vùng cấm |
| `specs/01-CONTRACTS.md` | Model, DDL, chữ ký Tx/Repository/engine/API |
| `specs/SPEC-P01-RESTOCK-ALERT.md` | Luật kích hoạt, ack, phân quyền, bảng lỗi |
| `specs/SPEC-P02-PORTAL-BELL.md` | Màn Kỹ thuật `portal/` |
| `specs/OPERATIONS.md` | Thứ tự deploy, cờ, rollback |
| `specs/TESTING-ACCEPTANCE.md` | Ma trận test, phép phá, Exit Gates |
