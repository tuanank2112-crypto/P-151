# TESTING-ACCEPTANCE — Hạ tầng test, ma trận T01–T29, bằng chứng đỏ, Exit Gates

> CHÍNH THỨC — chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`. Mọi lệnh chạy từ root repo bằng `.venv` (Python 3.11.9).
> Đánh dấu “(đã chạy thử)” = architect chạy thật trên dữ liệu giả, kết quả ghi ngay đó.

## 1. Cách chạy

| Bộ | Lệnh | Yêu cầu |
|---|---|---|
| Mặc định | `python -m pytest -q` | không cần DB/mạng; test `pg` bị **deselect** (không phải skip) |
| Postgres | `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@localhost:5432/p151_test python -m pytest --pg -q` | docker `db` + DB `p151_test` (`OPERATIONS §3`) |
| Lint | `python -m ruff check src tests` | exit 0 |
| Format | `python -m ruff format --check <file trong phạm vi handoff>` — **trừ** `src/api/routers/maintenance.py`, `src/maintenance/ai_logger.py` | exit 0 (2 file kia lệch từ `f2da6cb`, không thuộc #01 — quyết định SO) |
| Smoke | `python scripts/mo_smoke_persistence.py write` rồi **process mới** `… verify` | `.env` chế độ postgres (§5.1) |

Số gốc: tại `f2da6cb` 155 passed (architect đo); tại `413aebc` 161 passed (report R01, SO đo lại).

## 2. Hạ tầng test (WP2 làm; mọi chi tiết bắt buộc)

### 2.1 `tests/conftest.py` — ép môi trường an toàn (I-7)

Ngay sau dòng `os.environ["LLM_MODE"] = "mock"` (`L4`), TRƯỚC `from src.main import app` (`L12`), thêm:

```python
os.environ["MO_STORE"] = "memory"           # .env máy owner đang MO_STORE=postgres (Supabase) — test không bao giờ đọc nó
os.environ["MO_PHOTO_STORE"] = "local"
os.environ["MO_ALLOW_RESET"] = "false"
```

### 2.2 `tests/conftest.py` — tuỳ chọn `--pg` và chặn DB ngoài (đã chạy thử, pytest 9.1.1)

```python
LOCAL_TEST_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "db"})

def pytest_addoption(parser):
    parser.addoption("--pg", action="store_true", default=False, help="Run PostgreSQL tests (local docker *_test DB only)")

def pytest_configure(config):
    config.addinivalue_line("markers", "pg: needs a real PostgreSQL; runs only with --pg on local docker")
    if not config.getoption("--pg"):
        return
    url = os.environ.get("MO_TEST_DATABASE_URL", "")
    parts = urlsplit(url)
    host, database = (parts.hostname or "").lower(), parts.path.lstrip("/")
    if not url:
        pytest.exit("--pg needs MO_TEST_DATABASE_URL (local docker *_test database)", returncode=4)
    if host not in LOCAL_TEST_HOSTS or not database.endswith("_test"):
        pytest.exit(f"MO_TEST_DATABASE_URL must be local docker and a *_test database (host={host!r}, db={database!r})",
                    returncode=4)

def pytest_collection_modifyitems(config, items):
    if config.getoption("--pg"):
        return
    dropped = [item for item in items if item.get_closest_marker("pg") is not None]
    if dropped:
        config.hook.pytest_deselected(items=dropped)
        items[:] = [item for item in items if item.get_closest_marker("pg") is None]
```

Kết quả đã chạy thử nguyên văn khối trên + §2.1 (thư mục tạm, cùng bố cục `tests/conftest.py`, 1 test thường + 1 fixture
tham số `["memory", pytest.param("postgres", marks=pytest.mark.pg)]`): không `--pg` ⇒ `2 passed, 1 deselected`, exit 0;
`--pg` thiếu URL ⇒ exit 4; host `aws-0-ap-southeast-1.pooler.supabase.invalid` + `postgres_test` ⇒ exit 4; `localhost` + DB
`p151` ⇒ exit 4; `localhost` + `p151_test` ⇒ `3 passed`, exit 0; chạy từ root không tham số / `tests/` / một file đều nạp `--pg`.

### 2.3 `tests/test_maintenance/conftest.py` — fixture Postgres (CHỈ THÊM, không sửa fixture cũ)

```python
@pytest.fixture(scope="session")
def pg_url() -> str:
    url = os.environ["MO_TEST_DATABASE_URL"]            # pytest_configure đã kiểm
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["database_url"] = url                # đã chạy thử: command.upgrade/downgrade đọc được, không cần env
    command.upgrade(cfg, "head")
    return url

PG_CLEAN = [
    "truncate maintops.audit_log, maintops.notifications, maintops.cases, maintops.sessions restart identity",
    "delete from maintops.stock",
    "update maintops.meta set value = 0 where key = 'run_number'",
    "select setval('maintops.ticket_number_seq', 1, false)",
]

@pytest.fixture
def pg_repo(pg_url) -> PostgresRepository:              # mọi test pg bắt đầu từ kho rỗng, bảng stock rỗng
    with sql_engine(pg_url).begin() as conn:
        for statement in PG_CLEAN:
            conn.execute(text(statement))
    return PostgresRepository(pg_url)

def restart_pg(url: str) -> None:                       # giả restart process: bỏ pool, lần sau tạo engine mới
    sql_engine(url).dispose()
    sql_engine.cache_clear()
```

Fixture `repo` trong `test_store_memory.py` (file WP1, được sửa): `params=["memory", pytest.param("postgres", marks=pytest.mark.pg)]`,
nhánh postgres lấy `request.getfixturevalue("pg_repo")` (lười ⇒ không `--pg` thì không chạm `pg_url`). T05 memory dùng
transaction lồng nhau ⇒ chuyển sang fixture riêng `memory_repo` (`params=["memory"]`); bản Postgres là T05-pg.

## 3. Ma trận test

Helper chỉ cho test (D2): `version_of(id)`, `log_rows()`, `notification_rows()` — có trên CẢ HAI repo (`01-CONTRACTS §4.3`).
“mem+pg” = cùng hàm test, tham số hoá. File: `S` = `test_store_memory.py` (✅WP1), `P` = `test_store_postgres.py`,
`A` = `test_persistence_api.py`, `G` = `test_persistence_guards.py`, `F` = `test_photo_store.py`, `N` = `test_sessions.py`
(tất cả trong `tests/test_maintenance/`).

| ID | Đo cái gì | Chạy | File | Đạt khi |
|---|---|---|---|---|
| T01 | Round-trip `Case` | mem+pg | S | sau `reset()`: 12 ticket; `repo.get(id) == case`; `Case.model_validate(case.model_dump(mode="json")) == case`; `list()` theo `sorted(ticket_id)` |
| T02 | `audit_sink` raise ⇒ không đổi gì | mem+pg | S | `AuditWriteError`; `(version_of, doc json, len(log_rows), len(notification_rows))` y nguyên |
| T03 | `op` raise `GuardError` (kể cả sau khi đã sửa `work`) ⇒ không đổi gì | mem+pg | S | như T02; `assignee_id` vẫn `None` |
| T04 | Hai “process” cùng sửa một ticket | pg | P | 2 engine / 2 `PostgresRepository` / 2 thread cùng `add_resident_info` vào 1 ticket `NEED_INFO`: cả hai addition có mặt, `version_of` tăng đúng 2 (đã chạy thử bản SQL: B chờ 0,79 s, đọc version 2, final 3) |
| T05 | Save lỗi thời ⇒ `ConcurrencyError` | mem | S | (✅WP1, tx lồng) |
| T05-pg | như trên | pg | P | trong tx sau `get_for_update`: `tx.conn.execute(text("update maintops.cases set version = version + 1 where ticket_id = :id"), {"id": tid})` rồi `tx.save(stale)` ⇒ `ConcurrencyError`; sau tx `version_of` không đổi |
| T06 | Số ticket không trùng | pg | P | 2 engine × 10 `receive` song song (2 thread) ⇒ 20 ID khác nhau, đều khớp `^SIM-TKT-\d{4}$` |
| T07 | Restart giữ dữ liệu | pg | P | engine A: `reset()`, `receive`, `add_resident_photo(ref 32hex.png)`, `receive_stock(WAREHOUSE, "SIM-MAT-LAMP-02", 5)`, `attempt(... EDIT_RAW ...)` ⇒ `ActionDeniedError`; `restart_pg`; engine B (repo mới): `{id: doc json}`, `stock()`, `run_id`, `log_rows()`, `notification_rows()` y hệt A; audit cuối của ticket = `ACTION_DENIED` |
| T08 | Startup không reset | pg | P | `SPEC-P03 §11` |
| T09 | Seed chỉ khi rỗng + bù tồn kho | mem+pg | S | `SPEC-P03 §11` |
| T10 | Cổng reset/evaluate | mặc định | A | `SPEC-P03 §11` |
| T11 | Job một leader | pg | P | `SPEC-P03 §11` |
| T12 / T12b | Sai revision ⇒ không start / `HEAD_REVISION` = head Alembic | pg / mặc định | P / G | `SPEC-P03 §11` |
| T13 | Sổ append-only | pg | P | owner `update maintops.audit_log …` và `delete from maintops.notifications` ⇒ `sqlalchemy.exc.InternalError`, `orig.pgcode == "P0001"` (đã chạy thử) |
| T14 | Chặn test vào DB ngoài | mặc định | G | `subprocess.run([sys.executable, "-m", "pytest", "--pg", "-q", "-p", "no:cacheprovider", "tests/test_api/test_routes.py"], env={**os.environ, "MO_TEST_DATABASE_URL": <URL>})` với URL (a) `postgresql+psycopg2://u:p@aws-0-ap-southeast-1.pooler.supabase.invalid:5432/postgres_test`, (b) `…@localhost:5432/p151` ⇒ `returncode == 4` và stdout+stderr chứa `MO_TEST_DATABASE_URL` |
| T14b | Môi trường test bị ép | mặc định | G | `get_settings().mo_store == "memory"`, `.mo_photo_store == "local"`, `.mo_allow_reset is False` (dù `.env` máy chạy có `MO_STORE=postgres`) |
| T15 | `SupabasePhotoStore` | mặc định | F | `SPEC-P02 §10` (a)–(h) |
| T16 | Upload + tx lỗi ⇒ xoá ảnh | mặc định | F | `SPEC-P02 §10` |
| T17 | API ảnh không đổi | mặc định | F | `SPEC-P02 §10` |
| T18 | Hồi quy | mặc định | — | 155 test cũ + 6 test WP1 xanh; G8 rỗng |
| T19–T22 | Phiên đăng nhập | xem `SPEC-P04 §9` | N | `SPEC-P04 §9` |
| T23 | Sổ cái khớp doc | mem+pg | S | kịch bản: `reset()`, `receive`, từ chối 1 lệnh, `receive_stock`, `run_jobs(now + 2 ngày)`; với MỌI ticket: số `log_rows()` loại `AuditEvent` của ticket = `len(doc.audit)`, loại `StatusEvent` = `len(doc.events)`, `notification_rows()` = `len(doc.notifications)`; pg thêm: `LEDGER_SQL` (§5.2) trả 0 dòng |
| T24 | Ngân sách câu SQL (chặn N+1) | pg | P | đếm `before_cursor_execute` có chuỗi `maintops.`: `GET /api/v1/mo/tickets` (12 ticket, header `X-Actor-Id` QA) = **1**; `engine.accept(...)` ≤ **6** (ngân sách thiết kế, CHƯA đo — đếm theo `01-CONTRACTS §4.2`: đọc ngoài khoá 1 + `for update` 1 + `update` 1 + insert sổ 1 + insert outbox 1 = 5) |
| T25 | Lỗi tầng lưu trữ ⇒ HTTP đúng | mặc định | A | repo giả (lớp con `InMemoryRepository`): `Tx.append_log` raise `StoreUnavailableError` ⇒ `POST …/accept` 503 `STORE_UNAVAILABLE` (không phải 500); `list()` raise ⇒ `GET /mo/tickets` 503 (handler app); `wipe` raise `StorePermissionError` ⇒ `POST /mo/reset` 403 `STORE_PERMISSION_DENIED` |
| T26 | `ConcurrencyError` ⇒ 409 | mặc định | A | monkeypatch `engine.accept` raise ⇒ 409, `detail.code == "CONCURRENT_UPDATE"` |
| T27 | Kiểm `DATABASE_URL` | mặc định | G | `connect_args_for`: `postgres://u:secretpw@h/db` ⇒ `RuntimeError` chứa `DATABASE_URL`, không chứa `secretpw`; chuỗi không parse được ⇒ `RuntimeError` với `__cause__ is None`; host `*.pooler.supabase.com` cổng 6543 ⇒ chứa `6543`; `?sslmode=disable` ⇒ chứa `sslmode=require`; Supabase không `sslmode` ⇒ `{"connect_timeout": 10, "sslmode": "require"}`; `localhost` ⇒ `{"connect_timeout": 10}` |
| T28 | Ký tự NUL | pg | P | `receive("abc\x00def", …)` ⇒ `UnstorableTextError` (API: 409 `UNSTORABLE_TEXT`); `count()` không đổi |
| T29 | Chuyển trạng thái kiểm lại dưới khoá | mặc định (mem) | A | ticket đã `accept` rồi `block_onsite` (`ON_HOLD`); monkeypatch `engine.get` trả bản chụp cũ trạng thái `ROUTED`; `engine.accept(tid, CLN)` ⇒ `InvalidTransitionError`; trạng thái vẫn `ON_HOLD` |

## 4. Bằng chứng đỏ (mỗi bộ đo MỚI phải từng đỏ — AGENTS §5.K.5)

Mỗi mục: phá code đúng như cột 2, chạy test, lưu output máy vào `planning/01_2026-10-02_supabase-persistence/evidence/<wp>/red-<test>.txt`
(ghi: file bị phá, diff, lệnh, exit code ≠ 0, output pytest), trả code về (ghi sha256 trước = sau). CẤM sửa tay file evidence.

| R | Phá | Test phải đỏ | Gói |
|---|---|---|---|
| R1 | Bỏ `for update` VÀ `and version = :v` trong `_PgTx` | T04 hoặc T05-pg | WP2 |
| R2 | Đặt lại `engine.reset()` trong `get_engine` | T08 | WP4 |
| R3 | Bỏ khối bù tồn kho trong `seed()` | T09[postgres] | WP4 |
| R4 | `PostgresRepository.job_lease` luôn `yield True` | T11 | WP2 |
| R5 | `build_session_store` luôn trả `InMemorySessionStore()` | T19 | P04 |
| R6 | Bỏ `_require_reset_allowed()` khỏi `run_evaluation` | T10 | WP4 |
| R7 | Bỏ khối kiểm host/DB trong `pytest_configure` | T14 (subprocess đi tới host `.invalid` — không bao giờ tới server thật) | WP2 |
| R8 | Bọc lại `tx.append_log` trong `except Exception` của `_commit` | T25 | WP2 |
| R9 | Bỏ kiểm lại trong `_transition.op` | T29 | WP2 |
| R10 | Bỏ `tx.append_notifications(...)` trong `_commit` | T23 | WP2 |
| R11 | Bỏ retry trong `SupabasePhotoStore` | T15(d) | WP3 |
| R12 | Bỏ `from None` trong `connect_args_for` | T27 | WP2 |

Đã có từ WP1 (`evidence/wp1/`): T01, T02, T03, T05, `test_engine_cases_is_read_only`, `test_next_ticket_number_never_hands_out_a_number_twice`.

## 5. Script đo

### 5.1 `scripts/mo_smoke_persistence.py` (WP5) — hợp đồng

Lệnh con: `probe-db`, `probe-storage` (đọc-chỉ, `OPERATIONS §5`), `write`, `verify`. `MO_STORE` khác `postgres` ⇒ exit 2 với
`MO_STORE phải là postgres`. Không bao giờ in URL có mật khẩu hay key. Mỗi kiểm in một dòng `check=<tên> result=PASS|FAIL detail=<…>`;
dòng cuối `smoke=PASS|FAIL`; exit 0 iff PASS.

- `write`: `engine = build_engine()`; `seed_if_empty(engine)`; `tid = engine.receive("SMOKE-<uuid8> Hành lang tầng 3 tòa SIM-A nhiều rác",
  resident_id="SIM-ACTOR-RESIDENT-01").ticket.ticket_id`; ảnh `data = b"\x89PNG\r\n\x1a\n" + os.urandom(32)`,
  `ref = photos.save(data, "png")`, `engine.add_resident_photo(tid, "SIM-ACTOR-RESIDENT-01", ref)`; từ chối
  `engine.attempt(tid, "SIM-ACTOR-BQL-01", Action.EDIT_RAW, field_name="original_description", new_value="x", reason="smoke")`
  phải raise `ActionDeniedError`; phiên `AuthService(accounts, store=build_session_store(settings)).login("bql01",
  load_accounts().shared_test_password)`; ghi `data/smoke/last_write.json` (`data/` đã gitignore) = `{ticket_id, evidence_id,
  photo_ref, photo_sha256, audit_len, token}`.
- `verify` (process mới): đọc file; `build_engine()`; kiểm `ticket_present`, `evidence_ref_equal`, `photo_sha256_equal`
  (`photos.load`), `audit_has_denial` (audit cuối `ACTION_DENIED`, `len ≥ audit_len`), `ledger_consistent` (`LEDGER_SQL` 0 dòng),
  `session_valid_after_restart` (`AuthService` mới, `account_for(token).username == "bql01"`), `secrets_in_log=0` (log của chính
  lần chạy không chứa mật khẩu trong `DATABASE_URL` lẫn `SUPABASE_SERVICE_ROLE_KEY`); dọn: `logout(token)`,
  `engine.cancel(tid, "SIM-ACTOR-BQL-01", cancel_reason="smoke test")`, xoá file trạng thái.

### 5.2 `LEDGER_SQL` (đã chạy thử: 3 ticket giả, chỉ ticket thiếu 1 dòng audit bị trả về)

```sql
select c.ticket_id
from maintops.cases c
left join (select ticket_id,
                  count(*) filter (where kind = 'audit')  as audit_rows,
                  count(*) filter (where kind = 'status') as status_rows
           from maintops.audit_log group by ticket_id) l using (ticket_id)
left join (select ticket_id, count(*) as notification_rows
           from maintops.notifications group by ticket_id) n using (ticket_id)
where coalesce(l.audit_rows, 0)        <> jsonb_array_length(c.doc->'audit')
   or coalesce(l.status_rows, 0)       <> jsonb_array_length(c.doc->'events')
   or coalesce(n.notification_rows, 0) <> jsonb_array_length(c.doc->'notifications')
order by c.ticket_id
```

### 5.3 Battery quyền thành viên G7 (đã chạy thử với user `bob in role maintops_dev` do owner không-superuser tạo)

Chạy bằng user thành viên, mỗi câu một giao dịch, ghi pgcode: `create table maintops.x (id int)`;
`truncate maintops.audit_log, maintops.notifications, maintops.cases restart identity`;
`update maintops.meta set value = value + 1 where key = 'run_number'`; `delete from maintops.stock`;
`update maintops.audit_log set run_id = 'x'` ⇒ **cả 5 là `42501`**. Và đọc được: `select version_num from maintops.alembic_version`
⇒ `0001_maintops_initial`.

## 6. Exit Gates (đánh dấu theo môi trường; kế hoạch chỉ đóng khi cột **supabase** ✅ hết)

| Gate | Lệnh / bằng chứng | Kỳ vọng | local | supabase |
|---|---|---|---|---|
| G1 | `python -m pytest -q` | exit 0; `N passed, M deselected`; N ≥ 161 + số test mặc định mới; 0 failed; 0 skipped; M = số test pg | ⬜ | — |
| G2 | `MO_TEST_DATABASE_URL=…/p151_test python -m pytest --pg -q` | exit 0; 0 failed; 0 skipped; 0 deselected | ⬜ | — |
| G3 | `python -m ruff check src tests`; `python -m ruff format --check <file phạm vi handoff trừ 2 file nợ>` | exit 0 / exit 0 | ⬜ | — |
| G4 | R1–R12 (§4) | mỗi file evidence có exit ≠ 0 | ⬜ | — |
| G5 | local: `upgrade head` → `downgrade base` → `upgrade head` trên `p151_test`; supabase: M-SB1 + owner `upgrade head` | exit 0/0/0; supabase exit 0 và `alembic_version=0001_maintops_initial` | ⬜ | ⬜ |
| G6 | `write` → process mới `verify` | `smoke=PASS` cả hai lệnh exit 0 | ⬜ docker `p151`, ảnh local | ⬜ Supabase, ảnh supabase |
| G7 | §5.3 + app chạy bằng user thành viên với `MO_ALLOW_RESET=true`: `POST /api/v1/mo/reset` (QA) | 5× `42501`; reset ⇒ 403 `STORE_PERMISSION_DENIED` | tuỳ chọn | ⬜ |
| G8 | `git diff --numstat f2da6cb -- tests/test_maintenance/helpers.py tests/test_maintenance/test_acceptance.py tests/test_maintenance/test_ai_logger.py tests/test_maintenance/test_api.py tests/test_maintenance/test_auth.py tests/test_maintenance/test_engine.py tests/test_maintenance/test_fixtures.py tests/test_maintenance/test_migration.py tests/test_maintenance/test_proposer.py tests/test_api/test_routes.py tests/test_agents/test_graph.py` | 0 dòng (đã chạy thử tại `3e7b70b`: 0 dòng; đối chứng `engine.py` ra 1 dòng) | ⬜ | — |
| G9 | `git grep -nE "sb_secret_[A-Za-z0-9]{8,}\|eyJhbGci[A-Za-z0-9_-]{20,}" -- src tests scripts docs planning` + dòng `secrets_in_log=0` của `verify` | git grep **exit 1** (không khớp; đã chạy thử: repo exit 1, file giả có 2 khớp) ; `secrets_in_log=0` | ⬜ | ⬜ |

## 7. Bằng chứng và report

- Output máy lưu `planning/01_2026-10-02_supabase-persistence/evidence/<wp>/*.txt`; report chỉ trỏ đường dẫn, không chép.
- Mỗi handoff `handoffs/H<NN>_*.md` có đúng một report `reports/R<NN>_*.md` (dòng 2–4 `Handoff:`/`Base:`/`Head:`, dòng cuối
  phán quyết). Report thiếu lệnh + exit code nguyên văn, bảng test tổng/pass/fail/skip, `git diff --stat` ⇒ trả lại.
- Lời agent không phải bằng chứng: người duyệt chạy lại G1–G3, G8, G9 trước khi đánh ✅.
