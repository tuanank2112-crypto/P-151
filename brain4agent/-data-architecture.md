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
- **Hai pool kết nối (plan 12, v1.8.0):** đọc ngoài transaction qua `sql_read_engine` (AUTOCOMMIT, không pre-ping, thử lại 1 lần khi rớt kết nối); transaction/khoá dòng/lease qua `sql_engine`. ≤5 kết nối/tiến trình. Ảnh đã xem được giữ trong RAM (LRU 32 MB, tên uuid bất biến).
- **Client:** portal Next.js (qua 8000) và app điện thoại `/app/` (PWA); `/ui/` đã bỏ ở hồ sơ 20 — cùng gọi `/api/v1` của MỘT backend ⇒ cùng store, không có bản sao dữ liệu phía client.
  App: token ở `localStorage['mo-app-token']`; service worker chỉ cache vỏ app, KHÔNG cache `/api/`; đồng bộ bằng tải lại 30 s khi app hiện + khi quay lại/có mạng (chưa realtime).
  `portal/` (Next.js, plan18) gọi cùng API Python qua BFF, không DB runtime riêng.

- `.ai-log/session.jsonl` là log dùng công cụ AI của thành viên, không phải dữ liệu ứng dụng.

- **Từ vựng là DỮ LIỆU (2026-10-02):** `seed/maintenance_v1/lexicon.yaml` (`safety` + `priority`) nạp bởi `catalog.load_lexicon()` với validator V-01…V-12; `catalog.yaml` `sla_config` có `safety_review`, `missing_info.safety_context`, `priority`. Cả hai nạp lúc khởi tạo engine (`lru_cache`; sửa YAML phải khởi động lại process). Dữ liệu test an toàn ở `tests/test_maintenance/data/` (bộ dừng, ca nhãn).

## 2. Schema & Data Flow (theo `docs/CR-BPTN-03.md`)
- Schema `maintops` (Alembic `0001_maintops_initial`, chỉ owner chạy, không chạy lúc startup): `cases` (doc JSONB + cột lọc,
  `version`), `audit_log` + `notifications` (append-only, trigger chặn UPDATE/DELETE), `stock`, `meta` (`run_number`),
  sequence `ticket_number_seq`, `sessions`; role `maintops_dev` cho thành viên (không DDL/TRUNCATE).
- Mỗi bước ghi của engine = một transaction: `get_for_update` (`FOR UPDATE`) → op trên bản sao → `save` (kiểm `version`) +
  sổ + outbox cùng commit. Lỗi DB ⇒ `ConcurrencyError` 409 / `StoreUnavailableError` 503 / `StorePermissionError` 403.
- Startup: `check_photo_store` → `build_engine` (kiểm kết nối + revision, sai ⇒ exit 3) → `seed_if_empty` (advisory lock một
  leader). Job 5 phút xin `pg_try_advisory_xact_lock(151001)` — một backend chạy mỗi lượt.
- **CR-03 P0 trên nền lưu trữ (hồ sơ 02, 2026-10-02):** 5 method an toàn/khẩn cấp, `set_priority`, `rate` một lần đều ghi qua `_mutate` = một transaction của `CaseRepository` (đọc lại đúng qua engine mới cùng repo: `tests/test_maintenance/test_cr03_store.py`). Từ chối (`ACTION_DENIED`) phát sinh TRONG `op` được hoãn: transaction của `op` rollback, rồi audit từ chối ghi trong transaction riêng (không lồng).
- **Trạng thái (10, CR-03 §3.1):** `RECEIVED`, `VERIFYING`, `NEED_INFO`, `ON_HOLD`, `ROUTED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `MERGED`, `CLOSED`, `CANCELLED`. Một ticket chỉ có MỘT blocker mở (`ReasonCode` + `BlockerOwner`, §3.2).
- **Chuyển trạng thái:** chỉ các dòng T01–T23 (§4.1) hợp lệ; ngoài bảng → `INVALID_TRANSITION` (409); sai vai trò → `ACTION_DENIED` (403) + audit. Sự kiện đổi chủ blocker không đổi status: E01–E03 (§4.2).
- **Pipeline Agent (§5.1):** 1 toàn vẹn → 2 dữ liệu tối thiểu → **2b tầng an toàn (mọi ticket)** → 3 phân loại + phòng ban + priority → 4 trùng (D-09) → 5 review → 6 asset → 7 vật tư/kho → 8 `can_route` rồi `ROUTED` → 10 `report_complete` (6 điều kiện, ≥1 ảnh). Chạy lại sau gỡ blocker theo bảng §5.2.
- **Đã cài ở P0 (v1.1.0):** `risk_level`, `risk_signals[]` (kết quả 2b gần nhất), `safety_cleared_by/at/reason`, `safety_context`, `related_ticket_ids[]`, `priority`, `priority_source`, `priority_rule_id`, `priority_reason`, `closure_kind`; `assignee_id` kiểu `None`; bỏ `reopen_until`. Còn lại ở dòng dưới là P1.
- **Ticket mới trường (§12.1):** `priority*`, `risk_level`, `risk_signals[]`, `safety_cleared_*`, `duplicate_count`, `merged_children[]`, `related_ticket_ids[]`, `duplicate_rejected_of[]`, `follow_up_of`, `closure_kind`, `wrong_department_return_count`. `assignee_id` luôn `null`.
- Nội dung gốc và ảnh gốc của cư dân bất biến; bổ sung chỉ append. Cư dân chỉ thấy view allow-list (`views.py`), không thấy `risk_*`, `reason_code`, ghi chú nội bộ.

## Trường MVP preparation — 2026-10-03
- D-01 là target contract trong plan02 `specs/01-CONTRACTS.md`: persisted structured snapshot + event/version identifiers; payload LLM chỉ delta + snapshot, raw/audit vẫn append-only.
- Chưa thêm cột/schema hoặc nối vào engine/storage. `seed/maintenance_cr03/` là target/gold data riêng, startup vẫn `maintenance_v1`.

## Cổng web `portal/` — plan18 thay workflow độc lập
- Browser → Server Action/API BFF → Python `/api/v1` với Bearer từ cookie HttpOnly → CaseRepository/engine Python → projection UI. Ticket/evidence/actor ID string, không mapping số.
- Python là nguồn duy nhất; auth `/auth/me` mỗi request/action. Cư dân chỉ ResidentTicketView; staff projection bỏ resident_id/audit/actor/prompt trước gửi client. Material fullreplacement atomic/delta theo plan16, Next không ghi DB.
- Photo BFF kiểm phiên + Python ownership trước304, cache private/no-cache; resident internal scope403. Portal startup không DATABASE_URL/migrate/seed. Không chuyển ticket/account DB cũ.

### Lưu trữ portal legacy (plan06/17), chỉ rollback/test, không runtime mới
## Cổng phản ánh cư dân `portal/` — từ hồ sơ 11 (2026-10-09) KHÔNG còn kho riêng
- Luồng chạy: trình duyệt → portal (Next.js server) → backend `/api/v1` (Bearer) → `maintops.*` (memory hoặc Supabase). Phiên = cookie httpOnly ký HMAC chứa token backend (8 giờ, RAM backend). Ảnh qua proxy `/api/photos/{ticket}/{evidence}`.
- Bảng MỚI ở schema `maintops` (chỉ CREATE TABLE, code cũ không đọc): `material_items` (Alembic `0003`, vật tư ngoài danh mục), `assignments` + `rating_details` (`0004`, phân công + thẻ/bình luận đánh giá). Doc ticket JSONB KHÔNG thêm trường/enum. Supabase cần chạy 0003/0004 trước khi bật `MO_CUSTOM_MATERIALS`/`MO_PORTAL_EXTRAS`.
- Plan 20 (`0005_stock_alerts`): bảng `maintops.stock_alerts` append-only (chỉ `acknowledged_by/at` được set, một lần), ghi cùng transaction với `stock`; `StockAlert` KHÔNG vào doc ticket và KHÔNG qua `notifications` (bảng đó buộc `ticket_id`). Cờ `MO_STOCK_ALERTS`; chạy 0005 trước khi bật.

### Lịch sử: kho riêng của hồ sơ 06 (2026-10-07; MÃ ĐÃ XOÁ ở hồ sơ 20, database `portal` local còn nhưng không ai đọc)
- PostgreSQL DB `portal` (dev) / `portal_test` (test) trong container `p151-db-1` — KHÔNG phải schema `maintops`, không Supabase. Biến `DATABASE_URL` / `TEST_DATABASE_URL` ở `portal/.env.local` (riêng, không dùng `.env` gốc).
- 10 bảng (Drizzle `portal/src/db/schema.ts`, migration SQL `portal/drizzle/`): `users`, `sessions` (SHA-256 token), `staff`, `tickets` (stage 1..6 + cờ `need_info/paused/cancelled`, `merged_into/merged_from`, `extras[]`, snapshot Agent `ai_*`), `photos` (bytea, đã kiểm magic bytes), `history`, `ratings` (1/ticket), `keywords` (dept, word), `materials`, `notices`.
- Flow legacy (đã thay): Server Action → `act()` đọc lại session → `workflow.ts` (transaction: kiểm quyền → `FOR UPDATE` → phạm vi/stage → `UPDATE … WHERE stage=<cũ>` → 1 dòng `history`) → `refresh()`. Flow đọc: page (trong `<Suspense>`) → `requireUser(role)` → `queries.ts` trả DTO đã định dạng theo vai.
- Seed `npm run db:seed` chỉ khi `users` rỗng; `--reset` TRUNCATE (cấm ở production). Thời gian seed tương đối theo lúc chạy.


Develop04491ad imports P1 case fields, multi-ticket coordination, agent_decision and execution_snapshots; doc-shape marker revision0002_p1_doc_shape is required by the new Postgres repository. Migration was NOT run on shared Supabase in this integration. Portal legacy DB remains preserved for rollback; plan18 runtime uses Python. Coordinate old-backend stop and owner migration before starting new code on shared DB; see reasoning-agent OPERATIONS §5.
