# Kế hoạch 01 — Lưu bền MaintenanceOps trên Supabase (Postgres + Storage)

| Metadata | Giá trị |
|---|---|
| Mã kế hoạch | `01_2026-10-02_supabase-persistence` |
| Trạng thái | 🟠 ĐANG THỰC THI — WP1 ✅; WP2–WP4 xong local (R02, chờ duyệt); còn WP4b, WP5, WP6 |
| Phiên bản đích | `0.6.0` (MINOR — thêm tầng lưu bền, tương thích ngược: `MO_STORE=memory` giữ hành vi cũ) |
| Nhánh | `feature/chamanh` (base `f2da6cb`, đã merge `origin/develop`) |
| Người yêu cầu | anhlethicham-source |
| Khởi tạo | 2026-10-02 |
| Hoàn tất | — |

## Bảng SPEC

| File | Nội dung |
|---|---|
| [specs/00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md) | Bối cảnh đo được, mục tiêu, non-goals, bất biến I-1…I-7, vùng cấm |
| [specs/01-CONTRACTS.md](specs/01-CONTRACTS.md) | Biến cấu hình, interface `CaseRepository`/`Tx`/`PhotoStore`, DDL `maintops`, bảng lỗi → HTTP |
| [specs/SPEC-P01-REPOSITORY.md](specs/SPEC-P01-REPOSITORY.md) | Engine dùng repository, thứ tự transaction từng đường ghi |
| [specs/SPEC-P02-PHOTO-STORAGE.md](specs/SPEC-P02-PHOTO-STORAGE.md) | Local / Supabase Storage, retry, proxy bytes |
| [specs/SPEC-P03-STARTUP-JOBS.md](specs/SPEC-P03-STARTUP-JOBS.md) | Bỏ reset khi start, seed khi rỗng, khoá reset, job một leader |
| [specs/OPERATIONS.md](specs/OPERATIONS.md) | Runbook lần đầu, chế độ chạy, rollback |
| [specs/SPEC-P04-SESSIONS.md](specs/SPEC-P04-SESSIONS.md) | Phiên đăng nhập lưu DB (token băm), hết hạn, đăng xuất |
| [specs/TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md) | T01–T29, bằng chứng đỏ, Exit Gates local / supabase |

## Nhật ký quyết định

| Thời điểm | Quyết định | Lý do |
|---|---|---|
| 2026-10-02 | Đổi baseline "in-memory, resettable" sang lưu bền, giữ `memory` làm chế độ mặc định | Người dùng chốt; mặc định memory để test/demo offline không đổi |
| 2026-10-02 | Supabase: Session pooler 5432, region ap-southeast-1, bucket private `maintenance-photos` | Đo: Direct chỉ IPv6; pooler OK TLSv1.3, ~75 ms/truy vấn |
| 2026-10-02 | `Case` lưu JSONB + cột lọc; audit/outbox bảng append-only riêng | Không viết lại engine 2.100 dòng; audit cần bất biến |
| 2026-10-02 | Khoá dòng `FOR UPDATE` + cột `version`; số ticket bằng sequence | Nhiều backend của team cùng ghi một DB |
| 2026-10-02 | Job ngầm dùng advisory lock (một leader) | Mỗi backend đều chạy job 5 phút |
| 2026-10-02 | Phiên đăng nhập vẫn trong RAM (restart ⇒ đăng nhập lại) | Agent tự quyết theo L.2; đổi được sau — Idea Vault |
| 2026-10-02 | Storage gọi REST bằng `httpx`, backend proxy bytes, không signed URL | Giữ kiểm quyền theo ticket; không thêm SDK |
| 2026-10-02 | Schema riêng `maintops` + role `maintops_dev`, user cá nhân không có DDL | Schema `public` bị Data API mở; thu hồi theo người |
| 2026-10-02 | Test Postgres chỉ trên docker local (`--pg`), cấm host Supabase | Test TRUNCATE sẽ xoá dữ liệu team |
| 2026-10-02 11:00 | **Người dùng DUYỆT**: lưu bền DB trên Supabase (đổi baseline A-01); migration tạo `maintops` + `maintops_dev` trên project dùng chung, owner `postgres` chạy; reset khoá mặc định | Chủ tịch trả lời "Lưu database bền trên Supabase nhé" |
| 2026-10-02 11:00 | Phiên đăng nhập lưu `maintops.sessions` (token băm SHA-256, không lưu token thô), dùng chung giữa các backend; `MO_STORE=memory` ⇒ phiên trong RAM như cũ | SO quyết: restart không đăng xuất. Lật: bỏ bảng + T19, ~30 phút |
| 2026-10-02 11:00 | NGOÀI phạm vi #01: UI CR-BPTN-03 của Tri (`0c3ec16`, trạng thái an toàn/khẩn cấp chưa có backend) — người khác lo; #01 KHÔNG merge `0c3ec16` | Chủ tịch: "phần 2 để đó sẽ có người khác lo" |
| 2026-10-02 11:00 | SPEC nháp do SO viết tay bị coi là nháp; `specs/` chính thức do `architect-fable` viết cô lập từ nhật ký này | Đúng skill `vai-dieu-phoi` (specs do architect) |

| 2026-10-02 12:40 | `specs/` CHÍNH THỨC (architect, chốt 12:25:56). SO đo: `grep -c sessions 01-CONTRACTS` = 7, T01–T29 đủ, diff chỉ `planning/` | Cổng đo trước phán |
| 2026-10-02 12:40 | Q1: số đo Supabase đã có (đo theo yêu cầu người dùng sáng 02/10): PG 17.11, Session pooler, TLSv1.3, ~75 ms/truy vấn, mở kết nối ~1,6 s, bucket private 5 MB. Thông số timeout/pool (M-SB1) đo ở WP5 | Không chặn WP2–WP4 |
| 2026-10-02 12:40 | Q2: đã đo `apikey` + `Bearer sb_secret_…` ⇒ `GET /storage/v1/bucket` 200; chưa đo `apikey` một mình. Giữ `SPEC-P02 §4`; M-SB2 ở WP5 quyết | Lật: sửa `_headers` + T15c |
| 2026-10-02 12:40 | Q3: trigger append-only cho CẢ `audit_log` và `notifications` | Outbox cũng là lịch sử |
| 2026-10-02 12:40 | Q5: chấp nhận V2 (seed mang `SIM-RUN-000`), V4 (`/mo/evaluate` qua cổng reset vì nó gọi `reset()`), V5 (Response bytes; UI tải `fetch→blob`), V6 (`time.time` cho phiên) | Đều do đổi sang lưu bền, không đổi nghiệp vụ |
| 2026-10-02 12:40 | Q6: seed lần đầu trên Supabase chạy với `LLM_MODE=mock` (runbook OPERATIONS §2 bước 6), không thêm code | Fixture tất định, không tốn LLM |
| 2026-10-02 12:40 | Q8: version dự án lấy từ `src/main.py` (`0.5.0-candidate`) ⇒ `0.6.0`; WP6 đồng bộ `state.json.current_version` (`1.0.0` đang sai) | Một nguồn version |
| 2026-10-02 12:40 | Q4/Q9: thêm WP4b (SPEC-P04 sessions); C1–C4 sửa code WP1 thuộc WP2, C5 thuộc WP4 | Architect phát hiện khi đối chiếu code |
| 2026-10-02 | Người dùng giao “làm cho xong repository PostgreSQL + ảnh Storage + bỏ reset khi startup + kiểm transaction/restart” ⇒ SO tự thi công WP2+WP3+WP4 trong một phiên, một report `R02` (không tách H03/H04); WP4b/WP5/WP6 để sau | Phạm vi người dùng nêu; WP4b không được yêu cầu |
| 2026-10-02 | T27 siết thêm `__suppress_context__ is True` (tiêu chí `__cause__ is None` của SPEC vẫn xanh khi bỏ `from None`) | R12 phải đỏ — câu hỏi mở cho architect (R02) |
| 2026-10-02 | Restart kiểm bằng 3 process uvicorn thật trên docker `p151_test` (`evidence/wp4/live-restart.txt`), ngoài T07/T08 trong pytest | “kiểm restart” của người dùng = process thật, không chỉ giả lập pool |
| 2026-10-02 | Owner chạy `alembic upgrade head` trên Supabase (bằng `.venv`; Python conda không có alembic). SO đo chỉ-đọc: `alembic_version=0001_maintops_initial`, đủ 7 bảng + sequence + 2 trigger + role `maintops_dev`, 0 dòng dữ liệu, `PostgresRepository.check()` OK, client→pooler TLSv1.3 (`evidence/wp5/g5-supabase.txt`) | G5 cột supabase phần migration |
| 2026-10-02 | `pg_stat_ssl.ssl = f` qua Supavisor là chặng pooler→Postgres nội bộ, KHÔNG phải chặng client; M-SB1 phải đo `ssl_in_use` phía client — câu hỏi mở cho architect sửa ngưỡng `OPERATIONS §5` | Tránh dừng nhầm theo ngưỡng “ssl khác t” |
| 2026-10-02 | **Người dùng chốt:** container backend trỏ Supabase, không trỏ DB local nữa ⇒ `docker-compose.yml` bỏ override `DATABASE_URL` và `depends_on: db`; backend dùng nguyên `DATABASE_URL` của `.env`. Service `db` giữ lại chỉ cho `pytest --pg`/debug | Docker exit 3 lặp vì DB local chưa có `maintops`; người dùng: “cho nó trỏ vào Supabase, không có trỏ vào local nữa”. Architect cần sửa `SPEC-P03 §7`, `OPERATIONS §3` |
| 2026-10-02 | Seed Supabase lần đầu từ host với `LLM_MODE=mock` (Q6): 12 ticket, `SIM-RUN-000`; container khởi động sau đó thấy `count=12` nên không seed lại | Fixture tất định |

### Quyết định bị thay thế

| Thời điểm | Quyết định cũ | Bị thay bởi |
|---|---|---|
| 2026-10-02 | Phiên đăng nhập giữ trong RAM (restart ⇒ đăng nhập lại) | `maintops.sessions` (dòng 11:00) |
| 2026-10-02 | MinIO làm Storage local (đề xuất ban đầu) | Supabase Storage + `LocalPhotoStore` cho test/offline |
| 2026-10-02 | SPEC-P03 §7: compose mặc định `DATABASE_URL` → `db` local (`COMPOSE_DATABASE_URL` để trỏ nơi khác) | Container dùng `DATABASE_URL` của `.env` (Supabase) — người dùng chốt 2026-10-02 |
| 2026-09-28 | Baseline v0.3 "simulated data, in-memory, resettable" (router docstring) | Lưu bền tuỳ chọn qua `MO_STORE` |

## Work Packages

| WP | Nội dung | SPEC | Tầng |
|---|---|---|---|
| WP1 | `store/base.py` + `InMemoryRepository` + engine dùng repo (memory), 155 test cũ xanh | P01 | 🔴 (đụng bất biến engine) |
| WP2 | Alembic + DDL `0001` (gồm `sessions`) + `PostgresRepository` + C1–C4 + test pg theo TESTING | 01, P01 | 🟠 |
| WP3 | `PhotoStore` local/supabase + router + T15–T17 | P02 | 🟠 |
| WP4 | Startup/seed/reset/evaluate/job lease + C5 + compose + `.env.example` + T08–T11 | P03 | 🟠 |
| WP4b | Phiên đăng nhập lưu DB (`SessionStore` memory/postgres) + T19–T22 | P04 | 🟠 |
| WP5 | Smoke script + gate Supabase | TESTING §4 | 🟠 |
| WP6 | Docs, Ma Trận 6 Điểm + project-intro + data-architecture, bump 0.6.0 | — | 🟢 |

## Checklist thực thi

- [x] Giai đoạn 0: commit WIP (`f1c6ebf`, `eefdc81`, `4ff49d4`), merge `origin/develop` (`f2da6cb`), 155 test xanh
- [x] Đo kết nối Supabase (DB + bucket)
- [x] Dựng bộ SPEC
- [x] Người dùng duyệt hướng (2026-10-02 11:00)
- [x] `architect-fable` chốt `specs/` (thêm sessions), SO đo điểm hợp đồng (12:40)
- [x] WP1 — `413aebc`, R01 ✅ DUYỆT
- [x] WP2 — local ✅ (G1 185+20 deselected, G2 205, G3, G5 local, G8, G9), R02 chờ người duyệt
- [x] WP3 — local ✅ (T15–T17, R11)
- [x] WP4 — local ✅ (T08–T11, R2/R3/R6, restart uvicorn thật PASS)
- [ ] WP4b
- [ ] WP5 — local
- [ ] WP5 — supabase (owner chạy migration ✅ 2026-10-02; còn: ít nhất 1 user cá nhân, M-SB1/M-SB2, smoke)
- [ ] WP6
- [ ] Exit Gates `TESTING-ACCEPTANCE §4` cột supabase ✅
- [ ] Sign-off `✅ ĐÃ HOÀN THÀNH` + thời gian tới giây
