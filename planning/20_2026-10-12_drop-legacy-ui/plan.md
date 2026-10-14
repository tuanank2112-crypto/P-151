# 20 — Bỏ UI cũ, chạy UI mới trên PostgreSQL

## Metadata
- Trạng thái: XONG LOCAL 2026-10-12 (G1–G4 ✅; chờ người dùng thử tay G5 + gật commit).
- Nhánh: `feature/chamanh`. Base: `489abe9` (v1.13.0). Đích: **1.14.0** (MINOR — API `/api/v1` không đổi; chỉ bỏ trang nguyên mẫu `/ui` và mã chết).
- Môi trường DB: **chỉ Postgres local** (`docker compose up -d db`, database `p151`). KHÔNG chạm Supabase chung.

## Nhật ký quyết định
- 2026-10-12 D01 (người dùng): DB = Postgres local qua Docker (không phải Supabase).
- 2026-10-12 D02 (người dùng): xoá `src/web/` (trang `/ui`) và database riêng cũ của portal (Drizzle); bỏ nút "Mở bản web" trong app điện thoại; sửa đường backend chuyển về `/ui` khi portal tắt. Người dùng xác nhận xoá.
- 2026-10-12 D03 (agent): `src/mobile/` GIỮ (app điện thoại đang dùng). Bỏ cùng `portal/src/lib/agent.ts` + test (bộ phân loại từ khoá chỉ phục vụ seed DB cũ) và `portal/scripts/e2e-flow.mts` (cần `db:seed` + tài khoản DB cũ).
- 2026-10-12 D04 (agent): portal không chạy ⇒ mọi đường (cả `/`) trả 503; không có `PORTAL_URL` ⇒ `/` chuyển tới `/app/`. Lý do: `/app/` là giao diện duy nhất backend còn tự phục vụ.
- 2026-10-12 D05 (agent): MINOR không phải MAJOR — `/ui` là nguyên mẫu, không phải contract; người dùng có thể đổi thành 2.0.0.

### Quyết định bị thay thế
- `/` dự phòng về `/ui/` (plan 17/18) → thay bởi D04.
- Portal Docker `CMD` chạy `db:migrate && db:seed` → bỏ, portal chỉ `next start` (dữ liệu nằm ở backend Python).

## Work Packages
| WP | Nội dung | SPEC | Tầng |
|---|---|---|---|
| WP1 | Backend: bỏ mount `/ui`, đường dự phòng; sửa test | SPEC-P01 §1 | 🟠 |
| WP2 | App điện thoại: bỏ nút web, tăng phiên bản cache | SPEC-P01 §2 | 🟢 |
| WP3 | Portal: xoá Drizzle/DB cũ, deps, script, Dockerfile, rewrite `/ui` | SPEC-P01 §3 | 🟢 |
| WP4 | Chạy backend + portal trên Postgres local, `pytest --pg`, ảnh chụp | OPERATIONS, TESTING | 🟠 |

## Checklist thực thi
- [x] WP1
- [x] WP2
- [x] WP3
- [x] WP4 + gate G1–G4 ✅ local
- [x] Đồng bộ não + 1.14.0

- [ ] Người dùng thử tay (G5)

## Router SPEC
00-ARCHITECTURE.md → 01-CONTRACTS.md → SPEC-P01-drop-legacy.md → OPERATIONS.md → TESTING-ACCEPTANCE.md
