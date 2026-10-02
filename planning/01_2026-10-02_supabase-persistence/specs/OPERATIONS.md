# OPERATIONS — Deploy, runbook, đo cần người duyệt, rollback

> CHÍNH THỨC — chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`. Lệnh viết cho root repo, Python `.venv` (3.11.9);
> PowerShell: thay `VAR=… cmd` bằng `$env:VAR='…'; cmd`.

## 1. Điều kiện trước

- Code WP2 (Alembic + `PostgresRepository`) đã merge vào nhánh đang chạy; `requirements.txt` đã có `sqlalchemy`, `alembic`,
  `psycopg2-binary`, `httpx` (không thêm phụ thuộc).
- Người chạy bước Supabase là **owner** (role `postgres.<ref>` ở Session pooler) cho bước 3, thành viên cho bước 5–6.

## 2. Lần đầu trên Supabase dùng chung (thứ tự BẮT BUỘC)

| # | Ai | Việc | Kiểm (máy đọc được) |
|---|---|---|---|
| 1 | Owner | `.env`: `DATABASE_URL` = Session pooler **cổng 5432**, user `postgres.<ref>`; dạng `postgresql://` hoặc `postgresql+psycopg2://`; không cần tự thêm `sslmode` (code thêm `require`) | `python scripts/mo_smoke_persistence.py probe-db` exit 0 |
| 2 | Người duyệt | Chạy **M-SB1** (§5) — đọc-chỉ trên DB chung | lưu `evidence/wp5/m-sb1.txt` |
| 3 | Owner | `python -m alembic -c src/maintenance/store/alembic.ini upgrade head` | dòng đầu in `alembic -> host=aws-0-ap-southeast-1.pooler.supabase.com db=postgres user=postgres.<ref>`; exit 0; `probe-db` in `alembic_version=0001_maintops_initial` |
| 4 | Owner (SQL Editor chạy với quyền `postgres`) | Mỗi thành viên: `create role <ten> login password '<chi-chu-va-so>' in role maintops_dev;` rồi xoá snippet khỏi lịch sử | thành viên chạy `probe-db` bằng user `<ten>.<ref>` ⇒ exit 0, `current_user=<ten>` |
| 5 | Từng thành viên | `.env`: `MO_STORE=postgres`, `DATABASE_URL=postgresql+psycopg2://<ten>.<ref>:<pw>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`, `MO_PHOTO_STORE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret key riêng), `SUPABASE_STORAGE_BUCKET=maintenance-photos` | backend start không lỗi (không có dòng `Application startup failed`) |
| 6 | Một người (đề xuất `LLM_MODE=mock` cho lần này — Q6) | Start backend đầu tiên ⇒ seed 12 fixture đúng một lần | `python -c "from src.maintenance.engine import build_engine; print(build_engine().repo.count())"` in `12` |
| 7 | Người duyệt | Chạy **M-SB2** (§5) — đọc-chỉ Storage | lưu `evidence/wp5/m-sb2.txt`; nếu `status_apikey_only != 200` ⇒ báo SO (Q2) trước khi bật `MO_PHOTO_STORE=supabase` |

Migration chỉ ở bước 3, một người. User thành viên không có DDL — cố ý (đo `01-CONTRACTS §7.5`).

## 3. Docker local (test `--pg` và DB riêng)

```bash
docker compose up -d db
docker compose exec db createdb -U p151 p151_test          # một lần; tên PHẢI kết thúc _test (guard I-7)
MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151_test python -m pytest --pg -q
```

Fixture `--pg` tự `upgrade head` lên `p151_test` (qua `Config.attributes["database_url"]`) và dọn bảng giữa các test
(`TESTING §2.3`). **Cảnh báo:** `.env` owner đang `MO_STORE=postgres`; `docker compose up --build backend` dùng `DATABASE_URL`
của compose (DB `db` local, `SPEC-P03 §7`) ⇒ phải migrate DB local trước, nếu không container exit 3 rồi `restart: unless-stopped`
lặp lại:

```bash
DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151 python -m alembic -c src/maintenance/store/alembic.ini upgrade head
```

(biến môi trường trong shell thắng `.env` — `env.py` in host/db/user trước khi chạy để thấy đang trỏ đâu).

## 4. Biến môi trường theo chế độ

| Chế độ | `MO_STORE` | `MO_PHOTO_STORE` | Dùng khi |
|---|---|---|---|
| Offline / test | `memory` | `local` | mặc định, giống v0.5 (trừ `00 §6`) |
| Team dùng chung | `postgres` (Supabase) | `supabase` | demo, nhập liệu thật |
| DB riêng | `postgres` (docker `p151`) | `local` | debug không ảnh hưởng team |

Khối thêm vào `.env.example` (WP4; agent CẤM sửa `.env` thật):

```dotenv
# ---- MaintenanceOps persistence (plan 01) ----
# memory = in RAM like v0.5 (tests, offline demo); postgres = DATABASE_URL (Supabase team DB or local docker)
MO_STORE=memory
# On start, load the 12 fixture tickets only when the store has no ticket (never wipes anything)
MO_SEED_ON_EMPTY=true
# POST /mo/reset and /mo/evaluate wipe data: allowed with MO_STORE=memory; on a shared DB only the owner turns this on, briefly
MO_ALLOW_RESET=false
# local = MO_UPLOAD_DIR; supabase = SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET
MO_PHOTO_STORE=local
# Tests only (pytest --pg): local docker database whose name ends with _test
# MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151_test
```

## 5. Đo cần NGƯỜI DUYỆT (chạm hệ thống dùng chung — AGENTS L.3; architect bị chặn khi tự chạy)

| Mã | Lệnh | In ra (không bao giờ in mật khẩu/key) | Dùng cho |
|---|---|---|---|
| M-SB1 | `python scripts/mo_smoke_persistence.py probe-db` (giao dịch READ ONLY) | `server_version`, `ssl`, `ssl_version`, `idle_in_transaction_session_timeout`, `statement_timeout`, `lock_timeout`, `max_connections`, `current_user`, `rolcreaterole`, `maintops_schema`, `alembic_version`, `connect_ms`, `select1_ms_median` (20 lần) | Q1, Q7; bước 1–4 §2 |
| M-SB2 | `python scripts/mo_smoke_persistence.py probe-storage` (2 lần `GET {SUPABASE_URL}/storage/v1/bucket/{bucket}`) | `status_apikey_only`, `status_apikey_bearer`, `bucket_public`, `file_size_limit`, `allowed_mime_types` | Q2, `SPEC-P02 §4` |

Ngưỡng hành động: `idle_in_transaction_session_timeout` khác `0` và < `120s` ⇒ báo SO trước khi bật team (tx giữ trong lúc gọi LLM);
`ssl` khác `t` ⇒ dừng; `bucket_public` = `true` ⇒ dừng (bucket phải private).

## 6. Vận hành thường ngày

- Đổi schema ⇒ revision Alembic mới + `HEAD_REVISION` mới; owner chạy `upgrade head`; backend chưa pull sẽ từ chối start
  (revision lệch, `RuntimeError` có lệnh) — báo team pull.
- Reset dữ liệu demo trên DB chung: chỉ owner; tạm đặt `MO_ALLOW_RESET=true` trên máy mình; báo team TRƯỚC (xoá ticket,
  audit, outbox của cả team; phiên đăng nhập giữ nguyên); gọi `POST /mo/reset` bằng tài khoản QA; tắt lại; nhắn team **restart
  backend** (mỗi backend giữ `run_id` cũ trong RAM tới khi restart — `SPEC-P01 §1`).
- Supabase free tạm dừng sau ~1 tuần không truy cập (nguồn: bản nháp SO, chưa đo) ⇒ Dashboard → Restore; trong lúc đó API trả
  503 `STORE_UNAVAILABLE`, start mới exit 3.
- Bump phiên bản (WP6): `src/main.py:L56` (`0.5.0-candidate`) và `brain4agent/memory/hot/state.json` `current_version`
  (`1.0.0`) đang lệch nhau — SO chốt trước (Q8).

## 7. Rollback

| Mức | Cách | Mất gì |
|---|---|---|
| Tức thì, không phá | `.env`: `MO_STORE=memory`, `MO_PHOTO_STORE=local`; restart | Không mất gì trên DB; backend về RAM (seed 12 fixture) |
| Code | `git revert` các commit #01 (theo thứ tự ngược) | như trên |
| Xoá bảng (PHÁ HUỶ — hỏi người bằng lời, L.3) | `python -m alembic -c src/maintenance/store/alembic.ini downgrade base` — xoá 6 bảng + sequence + function; GIỮ schema `maintops` (chứa `alembic_version`) và role `maintops_dev` (đo: exit 0) | toàn bộ ticket/audit/outbox/phiên trên DB chung; ảnh trong bucket còn |
| Xoá hẳn (PHÁ HUỶ) | SQL Editor owner, sau khi đã downgrade: `drop role <từng thành viên>;` → `drop schema maintops cascade;` → `drop role maintops_dev;` | thêm quyền thành viên |

**CẤM** dùng `drop schema maintops cascade` thay cho `downgrade base` khi còn muốn dùng Alembic (đo: downgrade kiểu đó exit 1).

## 8. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| Start exit 3, message có `alembic … upgrade head` | Schema thiếu / revision lệch | Owner chạy migration; thành viên pull code |
| Start exit 3, `không kết nối được DATABASE_URL (host=…)` | Sai mật khẩu/host, Supabase tạm dừng, mạng | Kiểm `.env`, Restore project |
| Start exit 3, `Transaction pooler (6543) — bị cấm` | Dán nhầm chuỗi Transaction pooler | Dùng Session pooler 5432 |
| API 503 `STORE_UNAVAILABLE` | DB đứt giữa chừng | Thử lại sau; KHÔNG bấm lặp liên tục (kết quả commit có thể không chắc — tải lại trước) |
| API 403 `STORE_PERMISSION_DENIED` khi reset | User thành viên bật `MO_ALLOW_RESET` | Chỉ owner reset |
| API 403 `RESET_DISABLED` | Đúng thiết kế trên DB chung | Xem §6 |
| API 502 `PHOTO_STORE_FAILED` | Storage lỗi / sai key / sai header | Kiểm key; chạy M-SB2 |
