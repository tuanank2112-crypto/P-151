# 07 — Đổi giao diện UI tĩnh `src/web/` theo design của `portal/` (2026-10-07)

| Trường | Giá trị |
|---|---|
| Trạng thái | 🟡 LOCAL ✅ (2026-10-07 15:26:00 +07) — chờ gate server (dựng lại container `backend`) + commit |
| Loại | MINOR (nâng cấp giao diện, giữ nguyên API/logic) — đủ bộ SPEC |
| Yêu cầu | Người dùng, 2026-10-07: "Chuyển Ui theo design của foder portal sang UI của P151" |
| Nguồn thiết kế | `portal/src/app/globals.css` (token + class chép từ 6 file `.dc.html`), `portal/src/components/shell.tsx`, `portal/src/app/login/*` |
| Nhánh | `dev` (làm việc tại chỗ, chưa commit) |
| Phạm vi | CHỈ `src/web/` + hồ sơ này + đồng bộ não + version. KHÔNG chạm `portal/` (trừ trường `version`), `src/maintenance/`, `src/api/`, `tests/` |

## §1. Nhật ký quyết định
| # | Mốc | Quyết định | Lý do |
|---|---|---|---|
| Q01 | 2026-10-07 | "UI của P151" = UI tĩnh `src/web/` của backend FastAPI (`:8000/ui`); "design của portal" = token màu, font, class và khung trang của `portal/` | Hai UI duy nhất trong repo; portal đã là bản dựng từ thiết kế |
| Q02 | 2026-10-07 | Đổi lớp giao diện (reskin), KHÔNG dựng lại màn theo bố cục portal | Hai app khác mô hình dữ liệu (CR-03 vs stage 1..6) và vai trò (BPTN/Kho/BQL vs Ban tiếp nhận/Quản lý); dựng lại = viết lại 2230 dòng logic |
| Q03 | 2026-10-07 | Ba lớp: (1) remap bảng màu `slate`/`indigo`/`stone` + font + bo góc trong `tailwind.config` (Play CDN); (2) file mới `src/web/theme.css` chép class thiết kế; (3) viết lại khung (header, đăng nhập) + helper (`BTN`, `INPUT`, `card`, `badge`, `chip`, `callout`, `toast`, list item) | 418 chuỗi class rải rác: remap palette đổi tất cả ở MỘT chỗ, không sửa từng dòng |
| Q04 | 2026-10-07 | Bỏ chế độ tối (không nạp `js/dark_mode.js`, xoá class `dark` còn lưu) | Thiết kế portal không có dark mode; header gradient không có bản tối. File giữ lại, không xoá |
| Q05 | 2026-10-07 | KHÔNG thêm chuông thông báo / tile menu của portal | Backend không có dữ liệu thông báo và app cũ không có tab; thêm nút không chức năng = giả |
| Q06 | 2026-10-07 | Nhận tự quyết theo AGENTS L.2; người dùng ra lệnh trực tiếp ⇒ thực thi ngay sau khi dựng SPEC | Thay đổi chỉ là giao diện, không đổi contract/API |
| Q07 | 2026-10-07 | Selector ô nhập viết `html body .field` | Plugin `forms` của Tailwind CDN chèn SAU `theme.css`, `[type='text']` (0,1,1) đè `.field` (0,1,0) |
| Q08 | 2026-10-07 | Tiêu đề item danh sách nội bộ `line-clamp-2` thay `truncate` | Đo 390px: pill trạng thái rộng hơn cắt tiêu đề còn "Bóng đèn hàn…" |
| Q09 | 2026-10-07 | Đo G3/G4 trên backend LOCAL `:8001` (`MO_STORE=memory`, `LLM_MODE=mock`), KHÔNG trên container `:8000` | Container `backend` dùng Supabase chung — thao tác thử không được ghi vào DB nhóm |

### Quyết định bị thay thế
- Màn đăng nhập gradient cam theo mockup (phiên 2026-10-07 sáng, `today.md` "Màn đăng nhập theo mockup") → thay bởi bản xanh của portal (`Main.dc.html`) theo yêu cầu này. Giữ: tên khu đô thị, nút Hiện/Ẩn, không còn khối tài khoản demo.
- Dark mode (`js/dark_mode.js`, `feature/tri`) → tắt theo Q04.

## §2. Work Packages
| WP | Việc | Tầng | SPEC |
|---|---|---|---|
| WP1 | Token + `theme.css` + config Tailwind + font | 🟠 | 01-CONTRACTS §1–2 |
| WP2 | Khung: header gradient, màn đăng nhập | 🟠 | SPEC-P01 §1–2 |
| WP3 | Helper UI + trạng thái | 🟠 | SPEC-P01 §3, 01-CONTRACTS §3 |
| WP4 | Chụp màn đối chiếu + test | 🟠 | TESTING-ACCEPTANCE |
| WP5 | Đồng bộ não + version 1.3.0 | 🟢 | AGENTS §5.B |

## §3. Checklist thực thi
- [x] WP1 token, `theme.css`, config Tailwind, font Be Vietnam Pro
- [x] WP2 header gradient + đăng nhập theo `Main.dc.html` của portal
- [x] WP3 helper + bảng màu trạng thái
- [x] WP4 G1–G4 local (TESTING-ACCEPTANCE §2)
- [x] WP5 đồng bộ não + version

## §4. Bảng trỏ SPEC
| File | Nội dung |
|---|---|
| [`specs/00-ARCHITECTURE.md`](specs/00-ARCHITECTURE.md) | Mục tiêu, non-goals, bất biến, vùng cấm |
| [`specs/01-CONTRACTS.md`](specs/01-CONTRACTS.md) | Token, DOM id bất biến, bảng màu trạng thái |
| [`specs/SPEC-P01-RESKIN.md`](specs/SPEC-P01-RESKIN.md) | Đặc tả header, đăng nhập, helper |
| [`specs/OPERATIONS.md`](specs/OPERATIONS.md) | Chạy, cache, rollback |
| [`specs/TESTING-ACCEPTANCE.md`](specs/TESTING-ACCEPTANCE.md) | Test, chụp màn, Exit Gates |
