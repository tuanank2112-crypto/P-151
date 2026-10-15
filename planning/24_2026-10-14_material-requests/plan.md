# 24 — Phiếu vật tư tự sinh và thông báo khi kho cập nhật

## Metadata
- Trạng thái: ✅ XONG LOCAL 2026-10-15 (gate server ⬜) — trước đó 🟠 ĐANG THI CÔNG (người dùng duyệt đề xuất 2026-10-14: "ok đó").
- Người yêu cầu: Như Ý ("project thiếu phần tạo ticket vật tư và thông báo kho được cập nhật").
- Nhánh: `feature/nhuy-reasoning-agent`, sau hồ sơ 23. Phiên bản đích: **1.17.0** (MINOR — API cộng thêm, không migration).
- Không ghi Supabase chung, không deploy. Push/PR chỉ khi người dùng bảo.

## Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Hiện trạng đo được, mục tiêu, bất biến, vùng cấm |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | Hàm engine, endpoint, model, lỗi |
| [specs/SPEC-P01-REQUESTS.md](specs/SPEC-P01-REQUESTS.md) | Phiếu vật tư: tự sinh, phòng ban báo thiếu, báo kho, tự đóng |
| [specs/SPEC-P02-RESTOCK-NOTICE.md](specs/SPEC-P02-RESTOCK-NOTICE.md) | Thông báo phòng ban khi kho nhập |
| [specs/SPEC-P03-UI.md](specs/SPEC-P03-UI.md) | Portal + app điện thoại |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Triển khai, rollback |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | Ma trận test, phép phá, Exit Gates |

## Nhật ký quyết định
- 2026-10-14 M01 (người dùng duyệt đề xuất agent):
  1. Phiếu vật tư tự sinh: mỗi ticket thiếu vật tư ⇒ một phiếu (các mã thiếu là dòng của phiếu); tự đóng khi kho nhập đủ; phòng ban đang làm mà thiếu cũng tạo được; kho có hàng chờ "Phiếu cần nhập" trên portal và app. KHÔNG có bước duyệt.
  2. Kho nhập ⇒ báo phòng ban của mọi ticket đang chờ mã đó (cả Vệ sinh), rõ đủ/chưa đủ; chuông trên portal và app. Cư dân chỉ thấy dòng trạng thái.
- 2026-10-14 M02 (agent): phiếu là **khung nhìn dẫn xuất** từ ticket `ON_HOLD / WAITING_MATERIAL` (mã `PVT-<ticket_id>`), không thêm bảng. Lý do: trạng thái phiếu luôn khớp ticket (không có hai nguồn sự thật), không migration, tự đóng chính là ticket rời blocker. Lịch sử phiếu = audit của ticket.
- 2026-10-14 M03 (agent): thông báo kho nhập dùng lại bảng `stock_alerts` (plan 20 của Châm Anh), nới điều kiện; "đủ/chưa đủ" tính lúc đọc từ trạng thái ticket hiện tại, không lưu ⇒ không migration.

### Quyết định bị thay thế
- Plan 19 D01 Q4 "Kho bỏ Phiếu yêu cầu cấp phát" ⇒ có lại DẠNG CHỈ XEM + nhập kho, không duyệt (M01.1).
- Plan 20 (chamanh) SPEC-P01 §1 "chỉ Phòng Kỹ thuật, chỉ khi tồn trước ≤ 0" ⇒ mọi phòng ban có ticket chờ mã đó, hoặc phòng dùng mã đó khi tồn trước ≤ 0 (M01.2). `StockAlert.qty_before ≤ 0` bỏ ràng buộc.
- Plan 15/16 "không yêu cầu/duyệt vật tư" ⇒ GIỮ: không duyệt; `_material_approval_required()` vẫn False.

## Work Packages
| WP | Việc | Tầng |
|---|---|---|
| M1 | Engine + API P01, P02 + test | 🟠 |
| M2 | Portal + app điện thoại P03 + test | 🟠 |
| M3 | Thẩm định cô lập | 🔴 |

## Checklist thực thi
- [x] M1 engine/API + test (R01: 3677 passed; SO đo lại p23+p24+stock_alerts 59 passed, phạm vi đúng)
- [x] M2 portal + mobile (R02: vitest 159, Playwright 15/15; SO đo lại typecheck 0, vitest 159)
- [x] Cổng: pytest 3684 passed/0 fail; ruff 0; portal typecheck 0, vitest 159; node --check mobile 0
- [x] M3 thẩm định (planning/23_…/reports/R02 ✅ hồ sơ 24; F-E sửa)
- [x] Đồng bộ não + docs/portal.md + docs/mobile.md + version 1.17.0
