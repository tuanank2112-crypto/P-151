# Master Data Architecture & Flow

Tài liệu thiết kế về cấu trúc dữ liệu, cơ chế lưu trữ bền vững (Persistence Layer) và luồng luân chuyển dữ liệu đa tầng.
Chi tiết hợp đồng: `planning/01_2026-10-02_supabase-persistence/specs/01-CONTRACTS.md`.

## 1. Các Tầng Lưu Trữ (Data Persistence Stores)
- **Ticket/sổ/tồn kho** qua `CaseRepository` (`src/maintenance/store/`), chọn bằng `MO_STORE`:
  `memory` (mặc định, RAM như v0.5, test/demo offline) hoặc `postgres` (`DATABASE_URL`: Supabase Session pooler 5432 dùng chung,
  hoặc docker `db`). Không cache `Case` ở chế độ postgres.
- **Ảnh** qua `PhotoStore`, chọn bằng `MO_PHOTO_STORE`: `local` (`MO_UPLOAD_DIR`) hoặc `supabase` (bucket private
  `maintenance-photos`, REST bằng `httpx`, backend proxy bytes — không signed URL).
- **Tĩnh** (catalog, accounts, fixture) vẫn là YAML trong `seed/maintenance_v1/`. Phiên đăng nhập còn trong RAM (WP4b sẽ lưu `maintops.sessions`).

## 2. Schema & Data Flow
- Schema `maintops` (Alembic `0001_maintops_initial`, chỉ owner chạy, không chạy lúc startup): `cases` (doc JSONB + cột lọc,
  `version`), `audit_log` + `notifications` (append-only, trigger chặn UPDATE/DELETE), `stock`, `meta` (`run_number`),
  sequence `ticket_number_seq`, `sessions`; role `maintops_dev` cho thành viên (không DDL/TRUNCATE).
- Mỗi bước ghi của engine = một transaction: `get_for_update` (`FOR UPDATE`) → op trên bản sao → `save` (kiểm `version`) +
  sổ + outbox cùng commit. Lỗi DB ⇒ `ConcurrencyError` 409 / `StoreUnavailableError` 503 / `StorePermissionError` 403.
- Startup: `check_photo_store` → `build_engine` (kiểm kết nối + revision, sai ⇒ exit 3) → `seed_if_empty` (advisory lock một
  leader). Job 5 phút xin `pg_try_advisory_xact_lock(151001)` — một backend chạy mỗi lượt.

## Trường MVP preparation — 2026-10-03
- D-01 là target contract trong plan02 `specs/01-CONTRACTS.md`: persisted structured snapshot + event/version identifiers; payload LLM chỉ delta + snapshot, raw/audit vẫn append-only.
- Chưa thêm cột/schema hoặc nối vào engine/storage. `seed/maintenance_cr03/` là target/gold data riêng, startup vẫn `maintenance_v1`.
