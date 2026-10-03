# 01 — Contracts: cấu hình, lỗi, repository, phiên, ảnh, schema `maintops`

> CHÍNH THỨC — chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`. Số dòng theo `413aebc` (quy ước ở đầu `00-ARCHITECTURE`).
> Ký hiệu cột “Gói”: ✅WP1 = đã có trong `413aebc` (mô tả code thật); WPn = gói phải làm.

## 1. Cấu hình — `src/config.py::Settings` (WP2)

Thêm đúng các field sau (import `SecretStr` từ `pydantic`); tên biến môi trường = tên field viết hoa (pydantic-settings).

```python
    # MaintenanceOps persistence (plan 01)
    mo_store: Literal["memory", "postgres"] = "memory"
    mo_seed_on_empty: bool = True
    mo_allow_reset: bool = False
    mo_photo_store: Literal["local", "supabase"] = "local"
    supabase_url: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_storage_bucket: str = "maintenance-photos"
```

| Biến | Ý nghĩa | Đọc ở đâu |
|---|---|---|
| `MO_STORE` | `memory` = hành vi v0.5; `postgres` = `DATABASE_URL` | `build_engine`, `build_session_store`, cổng reset |
| `DATABASE_URL` (đã có, `config.py:L40`) | Bắt buộc hợp lệ khi `MO_STORE=postgres` (§2) | `sql_engine`, Alembic `env.py` |
| `MO_SEED_ON_EMPTY` | Startup: store không có ticket ⇒ nạp 12 fixture. Không bao giờ xoá | `get_engine` |
| `MO_ALLOW_RESET` | `POST /mo/reset`, `POST /mo/evaluate` chạy khi `MO_STORE=memory` HOẶC biến này `true` | router |
| `MO_PHOTO_STORE` | `local` = `MO_UPLOAD_DIR`; `supabase` = Storage | `src/api/photos.py::photo_store` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Bắt buộc khi `MO_PHOTO_STORE=supabase`. Key: CẤM log / đưa vào lỗi / trả API | `SupabasePhotoStore` |
| `MO_TEST_DATABASE_URL` | KHÔNG phải field Settings; chỉ `tests/conftest.py` đọc từ `os.environ` | `pytest --pg` |

Giá trị `Literal` sai (vd `MO_STORE=postgresql`) ⇒ `ValidationError` ngay khi `get_settings()` ⇒ app không import được.

## 2. `DATABASE_URL` và engine SQLAlchemy — `src/maintenance/store/postgres.py` (WP2)

```python
SCHEMA = "maintops"
SUPABASE_HOST_SUFFIXES = (".supabase.com", ".supabase.co")

def connect_args_for(url: str) -> dict[str, Any]: ...      # kiểm URL, trả connect_args cho psycopg2
@functools.lru_cache(maxsize=4)
def sql_engine(url: str) -> sqlalchemy.Engine: ...           # 1 engine (1 pool) / URL / process
```

`connect_args_for` — xét theo thứ tự, gặp dòng nào dừng ở dòng đó:

| Điều kiện | Kết quả |
|---|---|
| `sqlalchemy.engine.make_url(url)` lỗi | `raise RuntimeError("DATABASE_URL không phân tích được (MO_STORE=postgres)") from None` — `from None` BẮT BUỘC: lỗi gốc chứa nguyên URL kèm mật khẩu |
| `drivername` ∉ {`postgresql`, `postgresql+psycopg2`} | `RuntimeError("DATABASE_URL phải bắt đầu bằng postgresql:// hoặc postgresql+psycopg2:// khi MO_STORE=postgres")` |
| host kết thúc bằng một hậu tố Supabase **và** `port == 6543` | `RuntimeError("DATABASE_URL trỏ Transaction pooler (6543) — bị cấm; dùng Session pooler cổng 5432")` |
| host Supabase, URL có `sslmode` ∉ {`require`, `verify-ca`, `verify-full`} | `RuntimeError("DATABASE_URL tới Supabase phải dùng sslmode=require")` |
| host Supabase, URL không có `sslmode` | trả `{"connect_timeout": 10, "sslmode": "require"}` |
| còn lại (docker local…) | trả `{"connect_timeout": 10}` |

`sql_engine(url)` = `create_engine(url, pool_size=2, max_overflow=3, pool_timeout=30, pool_pre_ping=True,
pool_recycle=300, connect_args=connect_args_for(url))`. Tối đa 5 kết nối/process: `engine.lock` cho ≤ 1 tx ghi, +1 lease,
còn lại cho đọc song song. **CẤM** message nào chứa `str(url)`; cần in thì `make_url(url).render_as_string(hide_password=True)`.

## 3. Lỗi

### 3.1 `src/maintenance/store/base.py` (D1 — ✅WP1 trừ 2 lớp WP2)

| Lớp | Cha | `code` | Gói |
|---|---|---|---|
| `EngineError(message: str, detail: dict \| None = None)` — `.message`, `.detail` | `Exception` | `ENGINE_ERROR` | ✅WP1 `base.py:L16-22` |
| `NotFoundError` | `EngineError` | `NOT_FOUND` | ✅WP1 `L25-26` |
| `GuardError` | `EngineError` | `GUARD_FAILED` | ✅WP1 `L29-32` |
| `ConcurrencyError` | `EngineError` | `CONCURRENT_UPDATE` | ✅WP1 `L35-38` |
| `StoreUnavailableError` | `EngineError` | `STORE_UNAVAILABLE` | ✅WP1 `L41-44` |
| `StorePermissionError` | `EngineError` | `STORE_PERMISSION_DENIED` | WP2 thêm |
| `UnstorableTextError` | `GuardError` | `UNSTORABLE_TEXT` | WP2 thêm |

`src/maintenance/engine.py` import lại `EngineError`, `GuardError`, `NotFoundError` từ `store.base` (`engine.py:L81-87`) nên
`from src.maintenance.engine import GuardError` vẫn chạy; `ConcurrencyError`/`StoreUnavailableError`/2 lớp mới được router và
test import từ `src.maintenance.store.base`. Ở lại `engine.py`: `InvalidTransitionError(GuardError)` (`L177`),
`ActionDeniedError(EngineError)` (`L181`), `AuditWriteError(EngineError)` (`L187`), `_Denied` (`L195`, tín hiệu nội bộ).

### 3.2 Lỗi ảnh — `src/maintenance/store/photos.py` (WP3)

```python
class PhotoNotFoundError(Exception): ...
class PhotoStoreError(Exception):
    def __init__(self, status: int | None, ref: str, reason: str) -> None
    # str(exc) == f"Photo store failed (status={status}) for {ref}: {reason}" ; reason ≤ 200 ký tự, KHÔNG chứa key
```

### 3.3 Dịch lỗi DB — `postgres.py::_translate(exc: sqlalchemy.exc.DBAPIError) -> Exception` (WP2)

Xét `pgcode = getattr(exc.orig, "pgcode", None)` **trước** lớp lỗi (đo psycopg2 2.9.13: `40001`, `40P01`, `55P03` đều là
`OperationalError`, nên xét lớp trước sẽ nhầm thành “mất kết nối”):

| Điều kiện | Trả | Message (không SQL, không URL) |
|---|---|---|
| `pgcode` ∈ {`40001`, `40P01`, `55P03`} | `ConcurrencyError` | `Xung đột ghi đồng thời; tải lại rồi thử lại` |
| `pgcode == "42501"` | `StorePermissionError` | `User DB không có quyền cho thao tác này (cần owner)` |
| `pgcode` ∈ {`22P05`, `22021`} | `UnstorableTextError` | `Nội dung chứa ký tự không lưu được (NUL \u0000)` |
| `isinstance(exc, (OperationalError, InterfaceError))` hoặc `exc.connection_invalidated` | `StoreUnavailableError` | `Không kết nối được cơ sở dữ liệu; thử lại sau` |
| còn lại (CHECK sai, cú pháp — là bug) | trả nguyên `exc` | — (FastAPI trả 500, log server có traceback) |

Mọi method `PostgresRepository`/`_PgTx`/`PostgresSessionStore` chạy câu SQL trong `with _db_errors():`:

```python
@contextmanager
def _db_errors() -> Iterator[None]:
    try:
        yield
    except DBAPIError as exc:
        translated = _translate(exc)
        if translated is exc:
            raise                      # bug thật: giữ nguyên lỗi gốc
        raise translated from exc
```

## 4. Repository

### 4.1 Protocol — `src/maintenance/store/base.py:L47-90` (✅WP1, KHÔNG đổi)

```python
from __future__ import annotations   # BẮT BUỘC ở mọi file định nghĩa method tên `list` (đo: thiếu ⇒ TypeError lúc import)

class Tx(Protocol):
    def get_for_update(self, ticket_id: str) -> Case: ...
    def insert(self, case: Case) -> None: ...
    def save(self, case: Case) -> None: ...
    def append_log(self, rows: Sequence[AuditEvent | StatusEvent]) -> None: ...
    def append_notifications(self, rows: Sequence[Notification]) -> None: ...
    def add_stock(self, item_code: str, qty: float) -> float: ...

class CaseRepository(Protocol):
    def transaction(self) -> AbstractContextManager[Tx]: ...
    def get(self, ticket_id: str) -> Case: ...
    def list(self) -> list[Case]: ...
    def count(self) -> int: ...
    def next_ticket_number(self) -> int: ...
    def stock_of(self, item_code: str) -> float | None: ...
    def stock(self) -> dict[str, float | None]: ...
    def set_stock(self, item_code: str, qty: float | None) -> None: ...
    def run_number(self) -> int: ...
    def wipe(self, stock: dict[str, float | None]) -> int: ...
    def job_lease(self) -> AbstractContextManager[bool]: ...
    def seed_lease(self) -> AbstractContextManager[bool]: ...
    def check(self) -> None: ...
```

Bản cài: `InMemoryRepository(stock: dict[str, float | None] | None = None)` (`store/memory.py`, ✅WP1);
`PostgresRepository(url: str)` (`store/postgres.py`, WP2) — dùng `sql_engine(url)`, KHÔNG tự `create_engine`.

### 4.2 Ngữ nghĩa từng method (memory = code `413aebc`; postgres = phải làm y hệt)

| Method | Memory (✅WP1) | Postgres (WP2) — SQL chính xác | Lỗi |
|---|---|---|---|
| `transaction()` | copy-on-write; khối `with` raise ⇒ bỏ hết; lồng nhau được (T05 dùng) | đặt cờ thread-local; `with _db_errors(), sql_engine.begin() as conn: yield _PgTx(conn)` | PG lồng trên cùng thread ⇒ `RuntimeError("PostgresRepository: transaction lồng nhau trên cùng thread")`; commit lỗi ⇒ §3.3 |
| `Tx.get_for_update(id)` | trả object đã commit (tham chiếu), nhớ version | `select version, doc from maintops.cases where ticket_id = :id for update` → `Case.model_validate(doc)`, nhớ version | không có ⇒ `NotFoundError(f"Không có ticket {id}")` |
| `Tx.insert(case)` | trùng ⇒ lỗi; ID khớp `^SIM-TKT-(\d+)$` ⇒ bộ đếm = max(bộ đếm, n) **ngay** (không rollback) | `insert into maintops.cases (ticket_id, status, department_id, resident_id, created_at, doc) values (…)` (cột: §4.4); ID số ⇒ `select setval('maintops.ticket_number_seq', greatest(:n, (select last_value from maintops.ticket_number_seq)), true)` | trùng (23505 và `exc.orig.diag.constraint_name == "cases_pkey"`) ⇒ `GuardError(f"Ticket {id} đã được ingest")` |
| `Tx.save(case)` | đã insert trong tx ⇒ ghi đè bản chờ, version vẫn 1; đã `get_for_update` ⇒ version phải khớp | đã insert trong tx: `case is` object đã insert ⇒ **không gửi SQL**, khác object ⇒ `update maintops.cases set doc=:doc, status=:status, department_id=:department_id where ticket_id=:id`; đã `get_for_update`: `update maintops.cases set doc=:doc, status=:status, department_id=:department_id, version=version+1, updated_at=now() where ticket_id=:id and version=:v` | **D5:** chưa `get_for_update`/`insert` cùng ticket trong tx ⇒ `GuardError(f"Ticket {id} phải được get_for_update trước khi save")`; PG rowcount ≠ 1 ⇒ `ConcurrencyError(f"Ticket {id} vừa bị thay đổi bởi thao tác khác; tải lại rồi thử lại", {"ticket_id": id})` |
| `Tx.append_log(rows)` | dồn vào bản chờ | rỗng ⇒ không gửi câu nào; ngược lại **1** câu Core `insert(audit_log_table)` nhiều dòng (đo: 7 dòng = 1 lần execute) | — |
| `Tx.append_notifications(rows)` | như trên | như trên với `notifications_table` | — |
| `Tx.add_stock(code, qty)` | `(hiện có or 0) + qty` | `insert into maintops.stock (item_code, qty) values (:c, :q) on conflict (item_code) do update set qty = coalesce(maintops.stock.qty, 0) + excluded.qty returning qty` | — |
| `get(id)` | object đã commit (tham chiếu) | `select doc from maintops.cases where ticket_id = :id` | `NotFoundError` |
| `list()` | sắp theo `ticket_id` (`memory.py:L137-139`) | `select doc from maintops.cases order by ticket_id collate "C"` (= thứ tự `sorted()` của Python) | — |
| `count()` | `len` | `select count(*) from maintops.cases` | — |
| `next_ticket_number()` | `+1` | `select nextval('maintops.ticket_number_seq')` | không bao giờ trả lại số đã cấp, kể cả khi ingest rollback |
| `stock_of(code)` | `dict.get` | `select qty from maintops.stock where item_code = :c`; không dòng/NULL ⇒ `None` | — |
| `stock()` | bản sao dict | `select item_code, qty from maintops.stock order by item_code` | — |
| `set_stock(code, qty)` | gán | `insert … values (:c, :q) on conflict (item_code) do update set qty = excluded.qty` | — |
| `run_number()` | biến | `select value from maintops.meta where key = 'run_number'` | — |
| `wipe(stock)` | xoá hết, bộ đếm = 0, `run_number + 1` | 1 tx: `truncate maintops.audit_log, maintops.notifications, maintops.cases restart identity`; `delete from maintops.stock`; insert stock (1 câu); `select setval('maintops.ticket_number_seq', 1, false)`; `update maintops.meta set value = value + 1 where key = 'run_number' returning value`. **Không** đụng `maintops.sessions` | user `maintops_dev` ⇒ 42501 ⇒ `StorePermissionError` |
| `job_lease()` / `seed_lease()` | luôn `True` | kết nối riêng (KHÔNG phải kết nối của tx), `begin()`, `select pg_try_advisory_xact_lock(:key)` (§7.4), `yield bool`, cuối cùng `rollback()` (nhả khoá); `rollback` lỗi ⇒ `conn.invalidate()` + log WARNING | lấy khoá lỗi ⇒ §3.3 |
| `check()` | no-op | `select 1`; `select version_num from maintops.alembic_version` phải == `HEAD_REVISION` | xem dưới |

Đọc ngoài tx (`get`, `list`, `count`, `stock_of`, `stock`, `run_number`) trên Postgres dùng **kết nối riêng từ pool**, kể cả
khi thread đang mở tx ⇒ luôn thấy dữ liệu đã commit, giống memory. Postgres `check()`:

| Tình huống | `RuntimeError` message (BẮT BUỘC chứa) |
|---|---|
| `OperationalError`/`InterfaceError` | `MO_STORE=postgres: không kết nối được DATABASE_URL (host=<host>)` + tên lớp lỗi gốc |
| `pgcode` `42P01` (chưa có schema/bảng) hoặc `42501` | `… chạy: python -m alembic -c src/maintenance/store/alembic.ini upgrade head` |
| `version_num != HEAD_REVISION` | `schema maintops ở revision <x>, code cần 0001_maintops_initial; chạy: python -m alembic -c src/maintenance/store/alembic.ini upgrade head` |

### 4.3 Helper CHỈ CHO TEST — ngoài Protocol (D2)

Code sản phẩm **CẤM** gọi. Memory (✅WP1 `memory.py:L154-168`); Postgres cài **y hệt chữ ký**, đọc thẳng bảng (WP2):

| Helper | Memory | Postgres |
|---|---|---|
| `version_of(ticket_id: str) -> int` | `_versions[id]`; không có ⇒ `NotFoundError` | `select version from maintops.cases where ticket_id = :id`; không có ⇒ `NotFoundError(f"Không có ticket {id}")` |
| `log_rows() -> list[AuditEvent \| StatusEvent]` | mọi dòng đã commit, theo thứ tự commit | `select kind, payload from maintops.audit_log order by seq` → `AuditEvent.model_validate(payload)` nếu `kind='audit'`, `StatusEvent.model_validate(payload)` nếu `kind='status'` |
| `notification_rows() -> list[Notification]` | như trên | `select payload from maintops.notifications order by seq` → `Notification.model_validate` |

Hệ quả: `payload` của hai bảng sổ BẮT BUỘC là toàn bộ `row.model_dump(mode="json")` (§4.4) để dựng lại bằng nhau.

### 4.4 Ánh xạ dữ liệu (WP2)

`doc = case.model_dump(mode="json")`. Cột `cases`: `ticket_id = doc["ticket"]["ticket_id"]`, `status = doc["ticket"]["status"]`,
`department_id = doc["ticket"]["department_id"]`, `resident_id = doc["ticket"]["resident_id"]`, `created_at =` thời điểm
có múi giờ parse từ `case.ticket.raw.created_at` (cùng logic `engine.py::_created_at`, tự viết lại trong `postgres.py` —
CẤM import `engine.py` vì vòng import), không parse được ⇒ `NULL`; `doc = doc`. CHECK `cases_doc_matches` (§7.3) chặn lệch.
`doc` là nguồn đọc lại duy nhất (`Case.model_validate(doc)`); cột khác chỉ để lọc.

| Dòng sổ | `kind` | `event_id` | `occurred_at` | `run_id` | `payload` |
|---|---|---|---|---|---|
| `AuditEvent` | `audit` | `.event_id` | `.timestamp` | `.run_id` | `.model_dump(mode="json")` |
| `StatusEvent` | `status` | `.id` | `.created_at` | `NULL` | `.model_dump(mode="json")` |
| `Notification` → bảng `notifications` | — | `notification_id = .notification_id` | `created_at = .created_at` | — | `.model_dump(mode="json")`; `type = .type`, `audience = str(.audience)` (`BlockerOwner` là `StrEnum` ⇒ giá trị; đo: `'RESIDENT'`) |

INSERT nhiều dòng dùng 2 `sqlalchemy.Table` Core (`MetaData(schema="maintops")`) khai đúng cột §7.3 của `audit_log`,
`notifications`; các câu khác dùng `text()` có bind param (`:name`) — CẤM ghép chuỗi giá trị vào SQL.

## 5. Phiên đăng nhập — `src/maintenance/store/sessions.py` (WP gói P04)

```python
def token_hash(token: str) -> str: ...        # hashlib.sha256(token.encode("utf-8")).hexdigest()  (64 hex)

class SessionStore(Protocol):
    def create(self, token_hash: str, username: str, expires_at: float, now: float) -> None: ...
    def lookup(self, token_hash: str, now: float) -> str | None: ...
    def delete(self, token_hash: str) -> None: ...

class InMemorySessionStore: ...               # __init__(self) -> None
class PostgresSessionStore: ...               # __init__(self, url: str) -> None ; dùng sql_engine(url)
def build_session_store(settings: Settings) -> SessionStore: ...
```

Thời gian là epoch giây (`float`, từ `AuthService.clock`, mặc định `time.time`). Ngữ nghĩa và SQL: `SPEC-P04 §3`.
Lỗi DB ⇒ §3.3 (qua handler app ⇒ 503/403). Store **không bao giờ** nhận token thô.

## 6. Ảnh

### 6.1 `src/maintenance/store/photos.py` (WP3)

```python
class PhotoStore(Protocol):
    def put(self, ref: str, data: bytes, media_type: str) -> None: ...   # ref = "<32 hex>.<jpg|png|webp>"
    def get(self, ref: str) -> bytes: ...                                # không có ⇒ PhotoNotFoundError
    def delete(self, ref: str) -> None: ...                              # idempotent

class LocalPhotoStore:
    def __init__(self, directory: Path) -> None
class SupabasePhotoStore:
    def __init__(self, url: str, key: SecretStr, bucket: str, *, client: httpx.Client | None = None,
                 sleep: Callable[[float], None] = time.sleep) -> None
def build_photo_store(settings: Settings) -> PhotoStore: ...
```

### 6.2 `src/api/photos.py` sau WP3 (biên HTTP của ảnh)

| Hàm | Trạng thái | Hợp đồng |
|---|---|---|
| `MAX_BYTES`, `MAX_FILES_PER_REQUEST`, `_SIGNATURES`, `_MEDIA_TYPES`, `_REF`, `upload_dir()`, `_sniff()`, `read_photos()` | giữ nguyên (`photos.py:L16-58`) | — |
| `new_ref(extension: str) -> str` | mới | `f"{uuid.uuid4().hex}.{extension}"` |
| `photo_store() -> PhotoStore` | mới | `supabase` ⇒ instance cache (1/process); `local` ⇒ `LocalPhotoStore(upload_dir())` **tạo mỗi lần gọi** (test cũ monkeypatch `photos.upload_dir`, `test_api.py:L37`) |
| `check_photo_store() -> None` | mới | gọi `photo_store()` một lần; thiếu cấu hình ⇒ `RuntimeError` (I-5); không gọi mạng |
| `save(data: bytes, extension: str) -> str` | đổi ruột, giữ chữ ký | `ref = new_ref(extension)`; `photo_store().put(ref, data, _MEDIA_TYPES[extension])`; `PhotoStoreError` ⇒ `HTTPException(502, {"code": "PHOTO_STORE_FAILED", "message": "Không lưu được ảnh, thử lại sau"})` |
| `discard(ref: str) -> None` | đổi ruột | `_REF` không khớp ⇒ bỏ qua; `photo_store().delete(ref)`; `PhotoStoreError` ⇒ log WARNING `"photo discard failed ref=%s"` rồi **không raise** |
| `load(ref: str) -> tuple[bytes, str]` | mới, **thay `locate`** (xoá `locate`) | `_REF` không khớp hoặc `PhotoNotFoundError` ⇒ `HTTPException(404, "Không tìm thấy ảnh")`; `PhotoStoreError` ⇒ `HTTPException(502, {"code": "PHOTO_STORE_FAILED", "message": "Không tải được ảnh, thử lại sau"})`; trả `(bytes, _MEDIA_TYPES[ext])` |

## 7. Migration Alembic `0001_maintops_initial` (WP2)

### 7.1 Bố cục file

```text
src/maintenance/store/alembic.ini
src/maintenance/store/migrations/env.py
src/maintenance/store/migrations/script.py.mako
src/maintenance/store/migrations/versions/0001_maintops_initial.py
```

Lệnh (từ root repo): `python -m alembic -c src/maintenance/store/alembic.ini upgrade head`.
`postgres.py`: `HEAD_REVISION = "0001_maintops_initial"`; `ALEMBIC_INI = Path(__file__).with_name("alembic.ini")`.

### 7.2 `alembic.ini` và `env.py`

`alembic.ini` mục `[alembic]` chỉ cần `script_location = %(here)s/migrations` (+ các mục logging chuẩn của Alembic).
**CẤM** ghi `sqlalchemy.url` vào ini. `env.py` BẮT BUỘC:

1. Thêm root repo vào `sys.path`: `REPO_ROOT = Path(__file__).resolve().parents[4]` (env.py → migrations → store →
   maintenance → src → root), để `import src.config` chạy được từ mọi thư mục.
2. `url = config.attributes.get("database_url") or get_settings().database_url` — test truyền URL qua
   `Config.attributes` (đo: chạy được, không qua biến môi trường).
3. In `alembic -> host=<host> db=<db> user=<user>` (KHÔNG mật khẩu) trước khi chạy — chống chạy nhầm lên DB chung.
4. `create_engine(url, connect_args=connect_args_for(url))`; trên một kết nối: `create schema if not exists maintops` +
   `commit()` (bảng `alembic_version` nằm trong schema này nên schema phải có trước), rồi
   `context.configure(connection=..., version_table_schema="maintops", transaction_per_migration=True)` →
   `with context.begin_transaction(): context.run_migrations()`; cuối cùng `engine.dispose()`.
5. Chế độ offline ⇒ `RuntimeError("maintops migrations chỉ chạy online")`.

### 7.3 Câu lệnh — `0001_maintops_initial.py` (đã chạy thật, §7.5)

`upgrade()` chạy lần lượt `op.execute(stmt)` cho từng phần tử `UPGRADE`; `downgrade()` cho từng phần tử `DOWNGRADE`.
File migration **CẤM** import code app; **CẤM** ký tự `%` trong SQL (đi qua `text()`/psycopg2).

```python
UPGRADE = [
    """create table maintops.cases (
        ticket_id     text primary key check (ticket_id ~ '^SIM-TKT-[A-Z0-9-]+$'),
        version       integer not null default 1 check (version >= 1),
        status        text not null,
        department_id text,
        resident_id   text not null,
        created_at    timestamptz,
        updated_at    timestamptz not null default now(),
        doc           jsonb not null,
        constraint cases_doc_matches check (
            doc->'ticket'->>'ticket_id' = ticket_id
            and doc->'ticket'->>'status' = status
            and doc->'ticket'->>'resident_id' = resident_id
            and (doc->'ticket'->>'department_id') is not distinct from department_id)
    )""",
    "create index cases_status_idx on maintops.cases (status)",
    "create index cases_resident_idx on maintops.cases (resident_id)",
    """create table maintops.audit_log (
        seq         bigint generated always as identity primary key,
        kind        text not null check (kind in ('audit', 'status')),
        event_id    text not null unique,
        ticket_id   text not null references maintops.cases (ticket_id),
        occurred_at timestamptz not null,
        run_id      text,
        payload     jsonb not null,
        recorded_at timestamptz not null default now()
    )""",
    "create index audit_log_ticket_idx on maintops.audit_log (ticket_id, seq)",
    """create table maintops.notifications (
        seq             bigint generated always as identity primary key,
        notification_id text not null unique,
        ticket_id       text not null references maintops.cases (ticket_id),
        type            text not null,
        audience        text not null,
        payload         jsonb not null,
        created_at      timestamptz not null
    )""",
    "create index notifications_ticket_idx on maintops.notifications (ticket_id, seq)",
    """create function maintops.forbid_change() returns trigger language plpgsql as
       $$ begin raise exception using message = tg_table_schema || '.' || tg_table_name || ' is append-only'; end $$""",
    """create trigger audit_log_append_only before update or delete on maintops.audit_log
       for each row execute function maintops.forbid_change()""",
    """create trigger notifications_append_only before update or delete on maintops.notifications
       for each row execute function maintops.forbid_change()""",
    "create table maintops.stock (item_code text primary key, qty double precision check (qty is null or qty >= 0))",
    "create table maintops.meta (key text primary key, value bigint not null)",
    "insert into maintops.meta (key, value) values ('run_number', 0)",
    "create sequence maintops.ticket_number_seq minvalue 1 start with 1",
    """create table maintops.sessions (
        token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
        username   text not null check (username ~ '^[a-z0-9_.-]{3,32}$'),
        created_at timestamptz not null default now(),
        expires_at timestamptz not null
    )""",
    "create index sessions_expires_idx on maintops.sessions (expires_at)",
    """do $$ begin
         if not exists (select from pg_roles where rolname = 'maintops_dev') then
           create role maintops_dev nologin;
         end if;
       end $$""",
    "grant usage on schema maintops to maintops_dev",
    "grant select on maintops.alembic_version to maintops_dev",
    "grant select, insert, update on maintops.cases to maintops_dev",
    "grant select, insert on maintops.audit_log, maintops.notifications to maintops_dev",
    "grant select, insert, update on maintops.stock to maintops_dev",
    "grant select on maintops.meta to maintops_dev",
    "grant select, insert, delete on maintops.sessions to maintops_dev",
    "grant usage, select, update on sequence maintops.ticket_number_seq to maintops_dev",
]

DOWNGRADE = [
    "drop table if exists maintops.sessions, maintops.notifications, maintops.audit_log,"
    " maintops.cases, maintops.stock, maintops.meta",
    "drop sequence if exists maintops.ticket_number_seq",
    "drop function if exists maintops.forbid_change()",
]
```

`downgrade` giữ lại schema `maintops` (chứa `alembic_version`) và role `maintops_dev`. **CẤM** `drop schema maintops cascade`
trong `downgrade()`: đo — Alembic sau đó chạy `DELETE FROM maintops.alembic_version` trên bảng đã mất ⇒ exit 1, rollback cả lần.

### 7.4 Số ticket, khoá advisory

- Số ticket: `next_ticket_number()` = `nextval`; `Tx.insert` ID khớp `^SIM-TKT-(\d+)$` ⇒ `setval(greatest(n, last_value), true)`.
  Đo trên docker: setval 7 ⇒ nextval 8; setval greatest(3) khi đang 8 ⇒ nextval 9; sau `wipe` (`setval(…, 1, false)`) ⇒ nextval 1.
  Fixture có ID chữ (`SIM-TKT-CLN-001`…) không đụng sequence.
- Khoá (transaction-scoped, nhả khi tx của kết nối lease kết thúc): `KEY_JOBS = 151001`, `KEY_SEED = 151002`.
  Đo: A giữ ⇒ B `false`; A commit ⇒ B `true`; kết nối của A bị `invalidate()` ⇒ B `true`.

### 7.5 Kết quả chạy thật (architect, docker `postgres:16.14`, owner `sbowner` không phải superuser, có CREATEROLE)

| Kiểm | Kết quả đo |
|---|---|
| `upgrade head` → `downgrade base` → `upgrade head` | exit 0 / 0 / 0; sau downgrade chỉ còn `alembic_version` (0 dòng) |
| Owner tạo user thành viên `create role bob login password '…' in role maintops_dev` | OK |
| `bob`: đọc `alembic_version`, insert/update `cases` (đúng version ⇒ rowcount 1), insert sổ, upsert `stock`, `nextval`, insert/delete `sessions` | OK |
| `bob`: `create table maintops.x` / `truncate` / `update meta` / `delete from stock` / `update audit_log` | 42501 cả 5 |
| Owner `update notifications` / `delete from audit_log` | P0001 `maintops.notifications is append-only` / `maintops.audit_log is append-only` |
| Owner `truncate maintops.cases` một mình | 0A000 (FK) ⇒ `wipe` phải truncate 3 bảng một câu |
| ID sai `TKT-1`; doc lệch cột; `token_hash` không phải 64 hex | 23514 cả 3 |
| Trùng PK `cases`; trùng `audit_log.event_id` | 23505 |
| Chuỗi có `\u0000` trong `jsonb` | 22P05 |
| `order by ticket_id collate "C"` | `SIM-TKT-0001,SIM-TKT-CLN-001` (= `sorted()` Python) |

## 8. Ánh xạ lỗi → HTTP (đích sau WP2–WP4)

| Lỗi | Chuyển ở đâu | HTTP · body | Hành vi BẮT BUỘC của caller |
|---|---|---|---|
| `ActionDeniedError` | `_call` | 403 · `{"message", **detail}` | Không thử lại; audit ACTION_DENIED đã ghi |
| `NotFoundError` | `_call` | 404 · chuỗi | — |
| `GuardError` (gồm `InvalidTransitionError`, `UnstorableTextError`) | `_call` | 409 · `{"code","message",…detail}` | Sửa dữ liệu nhập; không có gì được ghi |
| `ConcurrencyError` | `_call` (✅WP1 `routers/maintenance.py:L91-92`) | 409 · `{"code":"CONCURRENT_UPDATE","message"}` | Tải lại ticket rồi làm lại |
| `StoreUnavailableError` | `_call` (✅WP1 `L93-94`) + handler app (WP2) | 503 · `{"code":"STORE_UNAVAILABLE","message"}` | KHÔNG tự retry; báo “thử lại sau”; kết quả commit có thể không chắc ⇒ tải lại trước khi bấm lại |
| `StorePermissionError` | `_call` (WP2, đặt trước `except EngineError`) + handler app (WP2) | 403 · `{"code":"STORE_PERMISSION_DENIED","message"}` | Thao tác cần owner (reset) — dùng owner hoặc tắt `MO_ALLOW_RESET` |
| `AuditWriteError` | `_call` | 500 · `{"code":"AUDIT_WRITE_FAILED","message"}` | Không có gì được ghi |
| `EngineError` khác | `_call` | 500 · `{"code","message"}` | — |
| `PhotoNotFoundError` / ref sai | `photos.load` | 404 · `"Không tìm thấy ảnh"` | — |
| `PhotoStoreError` | `photos.save` / `photos.load` | 502 · `{"code":"PHOTO_STORE_FAILED","message"}` | Upload: không có evidence nào được ghi, gửi lại; đọc: thử lại |
| Cổng reset đóng | router (`SPEC-P03 §5`) | 403 · `{"code":"RESET_DISABLED","message"}` | — |
| `RuntimeError` lúc startup | lifespan | uvicorn exit 3 | Đọc message, sửa `.env` / chạy migration |
| `DBAPIError` không dịch được | không bắt | 500 mặc định FastAPI | Bug — báo người, kèm log server |

Handler app (WP2, `src/main.py`): `app.add_exception_handler(StoreUnavailableError, h)` và `(StorePermissionError, h)` với
`h` trả `JSONResponse(status_code=503 hoặc 403, content={"detail": {"code": exc.code, "message": exc.message}})` — cùng
hình dạng `HTTPException(detail=dict)`, UI hiện `detail.message` (`src/web/app.js:L250`). Bao các đường không đi qua `_call`:
`GET /mo/tickets`, `/bql/tickets`, `/resident/tickets` (đọc `engine.cases`), `/mo/reset`, `/mo/evaluate`, mọi chỗ `get_actor`.

## 9. Luật hợp đồng

- **BẮT BUỘC** Protocol §4.1 giữ nguyên chữ ký (✅WP1); thêm method mới vào Protocol phải qua architect.
- **BẮT BUỘC** memory và postgres cho cùng kết quả trên bộ test hợp đồng (`TESTING §3`, T01–T03, T09, T23 tham số hoá).
- **CẤM** code sản phẩm gọi helper §4.3; **CẤM** ghép giá trị vào chuỗi SQL; **CẤM** `except Exception: pass` quanh tx.
- **CẤM** đổi định dạng `ref` ảnh hay regex `_REF` (`photos.py:L25`): ảnh local cũ vẫn đọc được.
