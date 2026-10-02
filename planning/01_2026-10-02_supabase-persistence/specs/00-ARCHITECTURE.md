# 00 — Kiến trúc: lưu bền MaintenanceOps trên PostgreSQL (Supabase) + Storage

> **Trạng thái:** CHÍNH THỨC — `architect-fable` chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`
> (WP1 `413aebc` đã được SO ✅ DUYỆT). Thay toàn bộ bản nháp SO. Nguồn yêu cầu: nhật ký quyết định trong
> [`../plan.md`](../plan.md) + 5 quyết định SO trong [`../reports/R01_wp1-memory-repo.md`](../reports/R01_wp1-memory-repo.md) §“SO quyết”.
>
> **Quy ước số dòng:** `file:Lnn` = dòng tại commit `413aebc`. File WP1 không đụng (auth.py, photos.py, main.py,
> config.py, demo.py, test cũ) có số dòng y hệt `f2da6cb`. Kiểm: `git show 413aebc:<file> | sed -n '<n>p'`.
>
> **Thứ tự đọc:** `00-ARCHITECTURE` → `01-CONTRACTS` → `SPEC-P01-REPOSITORY` → `SPEC-P04-SESSIONS` →
> `SPEC-P02-PHOTO-STORAGE` → `SPEC-P03-STARTUP-JOBS` → `OPERATIONS` → `TESTING-ACCEPTANCE`.

## 1. Bối cảnh

### 1.1 Trạng thái ban đầu tại `f2da6cb` (lý do có kế hoạch)

| Trạng thái chỉ trong RAM | Vị trí tại `f2da6cb` | Hậu quả |
|---|---|---|
| `MaintenanceEngine.cases` / `.stock` / `run_number` | `engine.py:L263-266` | restart ⇒ mất ticket, tồn kho về catalog |
| `get_engine()` gọi `engine.reset()` | `routers/maintenance.py:L62-70` | mỗi lần start xoá sạch, nạp 12 fixture |
| `POST /mo/evaluate` → `demo.evaluate()` → `engine.reset()` | `routers/maintenance.py:L196-200`, `demo.py:L101` | **đường reset thứ hai** (bản nháp bỏ sót) |
| Job 5 phút chạy trong mọi process | `main.py:L24-34` | N backend chung DB ⇒ job chạy N lần |
| Ảnh ghi đĩa `MO_UPLOAD_DIR` | `photos.py:L61-78` | mất khi đổi máy/container |
| Phiên đăng nhập `AuthService.sessions`, đồng hồ `time.monotonic` | `auth.py:L78-123` | restart ⇒ mọi người bị đăng xuất |
| Số ticket `len(self.cases) + 1` | `engine.py:L333-336` | hai backend cấp trùng số |

### 1.2 Đã xong — WP1 (`413aebc`, SO duyệt ở `3e7b70b`)

`src/maintenance/store/{__init__,base,memory}.py` + engine dùng `CaseRepository`; `_call` có nhánh `ConcurrencyError`
409 / `StoreUnavailableError` 503; 161 test xanh (155 cũ không sửa + 6 mới trong `tests/test_maintenance/test_store_memory.py`).
**5 quyết định SO** (bắt buộc, đã ghi vào các SPEC — `01-CONTRACTS §3.1/§4.3`, `SPEC-P01 §1/§2/§5`, `TESTING §3`):

| # | Quyết định SO | Ghi ở |
|---|---|---|
| D1 | `EngineError`/`NotFoundError`/`GuardError` + `ConcurrencyError`/`StoreUnavailableError` định nghĩa ở `src/maintenance/store/base.py`; engine import lại (re-export) | `01-CONTRACTS §3` |
| D2 | `version_of(ticket_id)`, `log_rows()`, `notification_rows()` = helper CHỈ CHO TEST, ngoài Protocol; `PostgresRepository` cài y hệt, đọc thẳng bảng | `01-CONTRACTS §4.3`, `TESTING §3` |
| D3 | `notify_sink` lỗi ⇒ `AuditWriteError` + rollback; số ticket theo bộ đếm không tái dùng, ingest số `n` đẩy bộ đếm lên ≥ `n` | `SPEC-P01 §2` |
| D4 | `CasesView.__getitem__` ném `KeyError` (không phải `NotFoundError`) để `.get()`/`in` của Mapping đúng | `SPEC-P01 §1` |
| D5 | `Tx.save` khi chưa `get_for_update` cùng ticket ⇒ `GuardError` | `01-CONTRACTS §4.2`, `SPEC-P01 §5` |

Gate format (SO): chỉ áp cho file trong phạm vi handoff; `src/api/routers/maintenance.py` và `src/maintenance/ai_logger.py`
lệch format **từ base `f2da6cb`**, không thuộc #01 (`TESTING §6 G3`).

### 1.3 Số đo của architect (`.venv`, Python 3.11.9; mọi lệnh ghi kèm)

| Đo cái gì | Lệnh | Kết quả |
|---|---|---|
| Bộ test tại `f2da6cb` | `.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider` | `155 passed in 13.55s` |
| Lint / format tại `f2da6cb` | `python -m ruff check src tests --no-cache` / `python -m ruff format --check src tests --no-cache` | exit 0 / exit 1 (2 file nợ trên) |
| Round-trip `Case` qua JSON (12 fixture sau `evaluate`) | script tạm `Case.model_validate(json.loads(json.dumps(c.model_dump(mode="json")))) == c` | 0 lệch; integrity marker giữ nguyên |
| Kích thước `doc` | như trên | min 3.648 B · trung vị 10.614 B · max 20.710 B · tổng 131.504 B (12 ticket) |
| Sổ cái sau `evaluate` | như trên | 84 audit · 29 status event · 37 notification |
| DDL `0001` (bản cuối `01-CONTRACTS §7.3`) trên `postgres:16.14`, owner **không phải superuser** (CREATEROLE) | Alembic 1.20.0 + SQLAlchemy 2.0.54 + psycopg2 2.9.13 | upgrade → downgrade → upgrade exit 0/0/0; quyền/trigger ở `01-CONTRACTS §7.5` |
| `uvicorn` 0.54.0 khi lifespan raise | app thử raise `RuntimeError` | exit **3**, log `Application startup failed. Exiting.` |
| Nội suy biến lồng trong compose | `docker compose config` (Compose v5.1.1) | `${COMPOSE_DATABASE_URL:-…${POSTGRES_USER:-p151}…}` cho đúng URL mặc định và URL ghi đè |

**Không đo được:** số đo Supabase (Postgres 17.11, TLSv1.3, ~75 ms/truy vấn, mở kết nối ~1,6 s, bucket 5 MB) lấy từ
nhật ký `plan.md` + bản nháp SO. Probe chỉ-đọc của architect tới DB dùng chung **bị hệ thống quyền chặn**
(“Production Reads”) ⇒ đo lại ở `OPERATIONS §5` (người duyệt chạy).

### 1.4 Sự thật môi trường (không chứa bí mật)

`.env` máy owner đang có `MO_STORE=postgres`, `LLM_MODE=openai`,
`DATABASE_URL=postgresql://postgres.<ref>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` (**không** `+psycopg2`,
**không** `sslmode`) ⇒ (a) test BẮT BUỘC ép memory (I-7); (b) code phải nhận `postgresql://` và tự thêm `sslmode=require`.

## 2. Mục tiêu

1. Khi `MO_STORE=postgres`: ticket (`Case`), tồn kho, sổ audit, outbox, `run_number`, **phiên đăng nhập** sống qua restart,
   dùng chung giữa mọi backend của team.
2. Mỗi bước ghi của engine = **một transaction DB**: doc ticket + audit + status event + notification cùng commit/cùng huỷ.
3. Nhiều backend chung một DB vẫn đúng: khoá dòng ticket, số ticket không trùng, job ngầm một leader mỗi lượt.
4. Ảnh lên Supabase Storage khi `MO_PHOTO_STORE=supabase`; đường dẫn API ảnh và quyền xem giữ nguyên.
5. Startup không reset; reset/evaluate (xoá dữ liệu) chỉ chạy khi `MO_STORE=memory` hoặc `MO_ALLOW_RESET=true`.
6. `MO_STORE=memory` (mặc định) giữ hành vi v0.5, trừ đúng các thay đổi ở §6.

## 3. Non-goals (KHÔNG làm trong #01)

| Không làm | Lý do |
|---|---|
| **UI CR-BPTN-03 của Tri (commit `0c3ec16`)** — chỉ sửa `src/web/app.js` (+139/−44), nằm trên `origin/feature/tri`, trạng thái an toàn/khẩn cấp chưa có backend | **NGOÀI phạm vi #01, KHÔNG merge `0c3ec16` trong #01**; người khác lo (nhật ký 11:00). Đo: `git merge-base --is-ancestor 0c3ec16 HEAD` ⇒ chưa có trong HEAD. #01 không sửa `src/web/`. |
| Lưu bộ đếm đăng nhập sai (`AuthService.failures`) vào DB | Giữ RAM từng process — lý do ở `SPEC-P04 §5`. |
| Lưu `ai_logger` vào DB | Công cụ quan sát, cửa sổ 100 dòng trong RAM theo thiết kế. |
| Đưa catalog/accounts YAML vào DB | Dữ liệu tĩnh, chỉ đọc, đã versioned trong git. |
| Tách `Case` thành bảng quan hệ đầy đủ | Engine 2.226 dòng (`git show 413aebc:src/maintenance/engine.py \| wc -l`) thao tác trên `Case` Pydantic. |
| `supabase-py` | Chỉ 3 lời gọi REST Storage; `httpx` đã có trong `requirements.txt`. |
| Dọn ảnh mồ côi tự động | Chỉ phát sinh khi `put` xong mà tx lỗi và `delete` cũng lỗi, hoặc sau reset; ghi Idea Vault. |
| Chuyển dữ liệu cũ local lên Supabase | v0.5 không có dữ liệu bền nào. |
| Bộ phát outbox (push/SMS/Zalo), đánh dấu “đã gửi” | Ngoài CR; outbox chỉ ghi lại. |
| Mở `maintops` qua Data API / RLS | Schema riêng không expose; truy cập chỉ bằng role DB. |
| CI chạy `--pg` (service Postgres trong GitHub Actions) | Không có trong nhật ký; ghi Idea Vault. |
| Định dạng lại `routers/maintenance.py`, `ai_logger.py` | Nợ format có từ `f2da6cb`, không thuộc #01 (SO). |
| Hiệu năng > 1.000 ticket | `list()` đọc toàn bộ `cases`; đủ cho demo. |

## 4. Bất biến kiến trúc (BẮT BUỘC)

- **I-1 Repository là nguồn chân lý.** Engine không giữ `Case` giữa hai lời gọi; mọi đọc/ghi qua `CaseRepository`
  (`01-CONTRACTS §4`). `engine.cases` / `engine.stock` chỉ là view (`SPEC-P01 §1`).
- **I-2 Đơn vị transaction.** Mỗi lần chạy `_mutate_locked`, `_ingest`, `_deny`, `wipe`, khối `add_stock` = đúng **một**
  `repo.transaction()`. Thao tác ghép (`receive` = ingest + run_agent; `receive_stock` = nhập kho + resume từng ticket;
  `reset`/`seed` = wipe + 2 tx mỗi fixture) là **chuỗi** transaction độc lập, giống v0.5.
- **I-3 Khoá dòng trước khi sửa, quyết lại dưới khoá.** Ticket bị sửa được đọc bằng `get_for_update`
  (`SELECT … FOR UPDATE`); `save` kiểm `version`. Quyết định dựa trên lần đọc không khoá (vd `_transition` kiểm
  `expected_from`) phải được kiểm lại trên bản đã khoá trong `op` (`SPEC-P01 §2.6`).
- **I-4 Sổ append-only.** `maintops.audit_log`, `maintops.notifications`: trigger chặn UPDATE/DELETE; chỉ `wipe`
  (TRUNCATE, owner) xoá.
- **I-5 Không fallback im lặng.** `MO_STORE=postgres` mà URL sai / không nối được / schema lệch revision ⇒ startup FAIL
  (uvicorn exit 3). `MO_PHOTO_STORE=supabase` thiếu URL/key ⇒ startup FAIL. Không tự rơi về memory/local.
- **I-6 Bất biến engine cũ giữ nguyên:** đổi status chỉ qua `_apply_transition`; ghi qua deep copy → op → commit, fail
  closed; `engine.lock` bao mọi đường ghi trong một process.
- **I-7 Test không bao giờ chạm DB dùng chung.** Bộ mặc định ép `MO_STORE=memory`, `MO_PHOTO_STORE=local`,
  `MO_ALLOW_RESET=false` bằng `os.environ` trước khi import app; `--pg` chỉ chạy khi host ∈ {localhost, 127.0.0.1, ::1, db}
  **và** tên DB kết thúc `_test`, sai ⇒ `pytest.exit(returncode=4)` trước mọi kết nối.
- **I-8 Không bí mật ở dạng thô.** Token phiên chỉ lưu SHA-256 (DB có CHECK `^[0-9a-f]{64}$`); key Supabase là `SecretStr`;
  mật khẩu trong `DATABASE_URL` không bao giờ vào message lỗi/log.
- **I-9 Thứ tự khoá:** `engine.lock` trước, khoá DB (dòng / lease) sau. Lease là try-lock không chờ ⇒ không deadlock.
- **I-10 Aliasing:** `InMemoryRepository` trả **chính object đã lưu** (như v0.5, `memory.py:L131-135`); `PostgresRepository`
  trả object mới mỗi lần đọc. Code sản phẩm không dựa vào cả hai.

## 5. Vùng cấm (đã cân nhắc, quyết định KHÔNG làm — đừng “sửa cho tốt hơn”)

| CẤM | Lý do |
|---|---|
| Cache `Case` trong RAM ở chế độ postgres | Nhiều backend chung DB ⇒ cache lệch ngay. |
| Chạy migration lúc startup | Hai người start cùng lúc ⇒ hai migration đua; user cá nhân không có DDL. |
| Transaction pooler (cổng 6543) | Code chặn bằng `RuntimeError` (`01-CONTRACTS §2`). |
| Advisory lock **cấp session** (`pg_try_advisory_lock`) | Đo trên docker: khoá quên nhả ở kết nối nằm trong pool chặn mọi kết nối khác (`[False]`). Dùng `pg_try_advisory_xact_lock`. |
| Tự retry lệnh ghi khi DB lỗi giữa chừng | `op` có thể đã gọi LLM (tốn tiền, kết quả khác); trả 503 để người bấm lại. |
| `lock_timeout` / `statement_timeout` ngắn | Tx có thể giữ khoá trong lúc gọi LLM tới ~2×30 s (`proposer.py:L133-140`: `timeout=30, max_retries=1`). |
| Signed URL / public URL Supabase cho trình duyệt | Mất kiểm quyền theo ticket; backend proxy bytes. |
| Key Supabase ra frontend, log, message lỗi; token phiên thô ở bất kỳ đâu phía server | I-8. |
| `InMemoryRepository` trả bản sao | `test_audit_failure_fails_closed` đo `is` (`test_engine.py:L384`); `test_12_…` gán thẳng `assignee_id` (`test_api.py:L66`). |
| Lồng `transaction()` trên cùng thread với Postgres | Lần `get_for_update` thứ hai cùng dòng tự chờ chính mình mãi ⇒ `RuntimeError` ngay (`01-CONTRACTS §4.2`). Memory cho phép (T05 memory dùng). |
| Sửa 11 file test cũ để “cho xanh” | Gate G8: `git diff --numstat f2da6cb -- <file test cũ>` phải rỗng. |
| UPDATE bảng outbox để đánh dấu “đã gửi” | I-4; muốn thì revision Alembic mới + bảng riêng. |
| Reset/evaluate trên DB chung khi `MO_ALLOW_RESET=false` | Xoá dữ liệu cả team. |
| Trộn `CR-BPTN-03` / `0c3ec16` vào nhánh #01 | Nhật ký 11:00. |

## 6. Thay đổi nhìn thấy được ở chế độ memory

| # | Trước (v0.5) | Sau (#01) | Trạng thái |
|---|---|---|---|
| V1 | Ticket nhận đầu tiên sau reset `SIM-TKT-0013` | `SIM-TKT-0001` (bộ đếm không tái dùng) | SO chấp nhận (D3) |
| V2 | Startup gọi `reset()` ⇒ audit fixture mang `SIM-RUN-001` | Startup gọi `seed()` ⇒ `SIM-RUN-000` | chờ SO (Q5) |
| V3 | `notify_sink` lỗi sau khi đã lưu | rollback + `AuditWriteError` | SO chấp nhận (D3) |
| V4 | `POST /mo/evaluate` luôn reset | qua cổng `RESET_DISABLED` | chờ SO (Q5) |
| V5 | Ảnh trả `FileResponse` (ETag, Last-Modified, Range) | `Response` bytes + `Cache-Control` như cũ; UI tải bằng `fetch → blob` (`src/web/app.js:L360-370`) | chờ SO (Q5) |
| V6 | Đồng hồ phiên `time.monotonic` | `time.time` (monotonic vô nghĩa qua restart/khác máy) | chờ SO (Q5) |
| V7 | `engine.cases.values()` theo thứ tự ingest | sắp theo `ticket_id` (`memory.py:L137-139`); Postgres `ORDER BY ticket_id COLLATE "C"` | đã có ở WP1 |

## 7. Sơ đồ

```text
FastAPI router ─► MaintenanceEngine (engine.lock) ─► CaseRepository ─┬─ InMemoryRepository  (MO_STORE=memory)
   │  _call + exception handler                                        └─ PostgresRepository  (MO_STORE=postgres)
   │                                                                        └─ sql_engine(url) ─► schema maintops
   ├─► src/api/auth.py AuthService ─► SessionStore ─┬─ InMemorySessionStore                        ▲
   │                                                └─ PostgresSessionStore ── sql_engine(url) ─────┘ (chung pool)
   └─► src/api/photos.py (validate, ref) ─► PhotoStore ─┬─ LocalPhotoStore     (MO_PHOTO_STORE=local)
                                                         └─ SupabasePhotoStore  (MO_PHOTO_STORE=supabase, httpx)
```

## 8. Câu hỏi mở (KHÔNG tự đổi quyết định — chờ SO/người)

| # | Câu hỏi | Ảnh hưởng | Đề xuất của architect |
|---|---|---|---|
| Q1 | Số đo Supabase chưa được architect đo (probe bị chặn) | Nếu `idle_in_transaction_session_timeout` < 120 s: tx đang chờ LLM bị cắt ⇒ 503 | Người duyệt chạy `OPERATIONS §5 M-SB1` trước gate supabase. |
| Q2 | Header Storage với key mới `sb_secret_…` chưa đo | `put/get/delete` có thể 401 | Thiết kế: `apikey` luôn có; `Authorization: Bearer` chỉ khi key là JWT (`eyJ…`). Đo `M-SB2`; sai thì sửa 1 hàm `_headers` (`SPEC-P02 §4`). |
| Q3 | Nhật ký: “audit/outbox bảng append-only riêng” | Architect hiểu cả hai bảng append-only (2 trigger) | Nếu SO chỉ muốn audit: bỏ trigger `notifications_append_only`, sửa T13. |
| Q4 | `plan.md` chưa có WP cho `SPEC-P04` (phiên) và bảng SPEC ghi “T01–T18” | Không ai thi công P04 | SO thêm WP (đề xuất 🟠, sau WP2 vì dùng `sql_engine`) và sửa bảng thành T01–T29. Architect không được sửa `plan.md`. |
| Q5 | Plan ghi “`MO_STORE=memory` giữ hành vi cũ”; V2, V4, V5, V6 chưa có SO xác nhận | Nếu từ chối V4: `/mo/evaluate` xoá DB chung | Chấp nhận V2, V4–V6. |
| Q6 | `.env` owner `LLM_MODE=openai`: seed đầu trên DB chung gọi LLM 12 lần, kết quả fixture không tất định | Dữ liệu demo lệch oracle | Seed lần đầu với `LLM_MODE=mock` (`OPERATIONS §2` bước 5) — người quyết. |
| Q7 | Giới hạn client của pooler Supabase chưa đo; mỗi backend tối đa 5 kết nối | Team > 3 backend có thể chạm trần | Đọc Dashboard ở M-SB1. |
| Q8 | Phiên bản: `src/main.py:L56` = `0.5.0-candidate`, `brain4agent/memory/hot/state.json` `current_version` = `1.0.0` | WP6 bump 0.6.0 không nhất quán | SO chốt nguồn version trước WP6. |
| Q9 | Code WP1 cần sửa thêm ở WP2/WP4 (không thuộc 5 quyết định SO): `_commit`/`_deny` để lỗi tầng lưu trữ đi thẳng (503 thay vì 500), `_transition` kiểm lại dưới khoá, `seed()` bù tồn kho | Không sửa ⇒ DB đứt trả 500; hai backend có thể biến “accept” thành “resume_work”; DB mới seed sai tồn kho | Liệt kê ở `SPEC-P01 §9`; SO duyệt. |
