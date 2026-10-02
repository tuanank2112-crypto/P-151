# SPEC-P04 — Phiên đăng nhập lưu `maintops.sessions`

> CHÍNH THỨC — chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`. Nguồn: nhật ký `plan.md` dòng 11:00 “Phiên đăng nhập lưu
> `maintops.sessions` (token băm SHA-256, không lưu token thô), dùng chung giữa các backend; `MO_STORE=memory` ⇒ phiên trong
> RAM như cũ” (thay quyết định cũ “phiên trong RAM”). Gói thi công: SO xếp (đề xuất WP “P04” 🟠, sau WP2 vì cần `sql_engine`).

Phạm vi file: `src/maintenance/store/sessions.py` (mới), `src/api/auth.py` (chỉ `AuthService`, `get_auth`), test mới
`tests/test_maintenance/test_sessions.py`. DDL bảng nằm trong migration `0001` (`01-CONTRACTS §7.3`) — không revision riêng.

## 1. Hiện trạng đo được (`src/api/auth.py`, giống nhau ở `f2da6cb` và `413aebc`)

| Thứ | Vị trí | Giá trị |
|---|---|---|
| Hằng | `L29-33` | `SESSION_TTL_SECONDS = 8*3600`, `MAX_FAILED_LOGINS = 5`, `LOCKOUT_SECONDS = 300`, `MAX_TRACKED_FAILURES = 10_000`, `PBKDF2_ITERATIONS = 200_000` |
| `AuthService` (dataclass) | `L78-123` | `accounts`, `clock = time.monotonic`, `sessions: dict[token, (username, expires_at)]`, `failures: dict[(username, client), (count, locked_until)]` |
| `login(username, password, client="") -> (token, Account)` | `L89-110` | khoá theo (username, IP) 429; sai 401; đúng: dọn phiên hết hạn (`L106-107`), `token = secrets.token_urlsafe(32)` |
| `account_for(token) -> Account \| None` | `L112-120` | hết hạn ⇒ xoá, `None` |
| `logout(token)` | `L122-123` | xoá |
| `get_auth()` | `L129-133` | singleton, **không khoá** (hai request đầu song song có thể tạo hai service) |
| Route | `L202-225` | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` (204) |
| Test | `tests/test_maintenance/test_auth.py` | 13 test (đo: `13 passed`); dựng `AuthService({...})` chỉ với `accounts`; không đụng `.sessions` |

## 2. Hợp đồng `AuthService` sau P04

```python
@dataclass
class AuthService:
    accounts: dict[str, Account]
    clock: Callable[[], float] = time.time                          # ĐỔI từ time.monotonic (V6)
    store: SessionStore = field(default_factory=InMemorySessionStore)
    failures: dict[tuple[str, str], tuple[int, float]] = field(default_factory=dict)   # GIỮ trong RAM (§5)

    def login(self, username: str, password: str, client: str = "") -> tuple[str, Account]   # chữ ký giữ nguyên
    def account_for(self, token: str) -> Account | None
    def logout(self, token: str) -> None
```

- Field `sessions` **bỏ** (chuyển vào `InMemorySessionStore`). Thứ tự field giữ `accounts` đứng đầu ⇒ `AuthService(accounts)`
  của test cũ vẫn chạy.
- `login`: phần khoá/đếm sai **giữ nguyên từng dòng** `L90-105`; thay `L106-109` bằng
  `token = secrets.token_urlsafe(32)` → `self.store.create(token_hash(token), account.username, now + SESSION_TTL_SECONDS, now)`.
- `account_for(token)`: `username = self.store.lookup(token_hash(token), self.clock())` → `self.accounts.get(username) if username else None`.
- `logout(token)`: `self.store.delete(token_hash(token))`.
- `LoginResponse`, `Me`, route, header `Authorization: Bearer`, `expires_in = SESSION_TTL_SECONDS`: **không đổi**.

## 3. Store (`src/maintenance/store/sessions.py`)

```python
def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()   # 64 ký tự hex thường

class SessionStore(Protocol):
    def create(self, token_hash: str, username: str, expires_at: float, now: float) -> None: ...
    def lookup(self, token_hash: str, now: float) -> str | None: ...
    def delete(self, token_hash: str) -> None: ...

def build_session_store(settings: Settings) -> SessionStore:
    return PostgresSessionStore(settings.database_url) if settings.mo_store == "postgres" else InMemorySessionStore()
```

| Method | `InMemorySessionStore()` | `PostgresSessionStore(url)` — `sql_engine(url)`, mọi câu trong `_db_errors()` |
|---|---|---|
| `create` | dưới `threading.Lock`: bỏ mọi phiên có `expires_at <= now` (giữ hành vi `auth.py:L106-107`), rồi `dict[token_hash] = (username, expires_at)` | 1 tx: `delete from maintops.sessions where expires_at <= to_timestamp(:now)`; `insert into maintops.sessions (token_hash, username, expires_at) values (:h, :u, to_timestamp(:exp))` |
| `lookup` | không có ⇒ `None`; `expires_at <= now` ⇒ xoá, `None`; còn hạn ⇒ `username` | `select username, expires_at > to_timestamp(:now) as live from maintops.sessions where token_hash = :h`; không dòng ⇒ `None`; `live` sai ⇒ `delete … where token_hash = :h`, `None`; đúng ⇒ `username` |
| `delete` | `pop`, không lỗi khi thiếu | `delete from maintops.sessions where token_hash = :h` (idempotent) |

Ngưỡng hết hạn: còn hạn **iff** `expires_at > now` (giống `auth.py:L117` `expires_at <= self.clock()` ⇒ hết hạn).
`to_timestamp(double precision)` đã chạy thật trên docker (`to_timestamp(2000000000.5)`, `01-CONTRACTS §7.5`).

## 4. `get_auth()` (`src/api/auth.py`)

```python
_service: AuthService | None = None
_service_lock = threading.Lock()

def get_auth() -> AuthService:
    global _service
    if _service is None:
        with _service_lock:                         # hai request đầu không được tạo hai service / hai store
            if _service is None:
                _service = AuthService({a.username: a for a in load_accounts().accounts},
                                       store=build_session_store(get_settings()))
    return _service
```

`PostgresSessionStore` dùng chung pool với `PostgresRepository` qua `sql_engine(url)` (cùng URL ⇒ cùng engine, `lru_cache`).
Không kiểm schema riêng: `build_engine` → `repo.check()` đã kiểm revision chứa bảng `sessions` (startup trước request đầu).

## 5. Quyết định: bộ đếm đăng nhập sai (`failures`) GIỮ trong RAM từng process

| Cân nhắc | Kết luận |
|---|---|
| Dữ liệu sống ngắn (khoá 300 s); mất khi restart chỉ làm “mở khoá sớm”, không lộ gì | Lưu bền không đem lại an toàn đáng kể |
| Lưu DB ⇒ mỗi lần đăng nhập sai là một lần GHI vào DB dùng chung; endpoint login công khai ⇒ spam sai mật khẩu thành máy phình bảng + chiếm kết nối của cả team | Rủi ro vận hành lớn hơn lợi ích |
| N backend ⇒ mỗi backend đếm riêng ⇒ trần thực tế ≤ 5×N lần thử / 300 s cho mỗi (username, IP) | Chấp nhận cho prototype dùng tài khoản test (`accounts.yaml` `synthetic: true`) |
| Cách lật | Bảng `maintops.login_failures(username, client, count, locked_until)` + revision `0002` + test, ~1 giờ — ghi Idea Vault |

## 6. Luật

- **BẮT BUỘC** server không lưu token thô ở đâu cả (RAM lẫn DB): chỉ `token_hash(token)` đi vào store (I-8). DB có thêm CHECK
  `token_hash ~ '^[0-9a-f]{64}$'` (đo: chuỗi thô bị 23514).
- **BẮT BUỘC** đồng hồ phiên là epoch (`time.time`) cho cả hai store; so sánh hạn dùng `now` truyền vào (test tiêm được).
- **BẮT BUỘC** `MO_STORE=memory` ⇒ `InMemorySessionStore` — 13 test `test_auth.py` xanh không sửa.
- **CẤM** log token, hash token, header `Authorization`.
- **CẤM** `wipe`/reset xoá `maintops.sessions` (reset dữ liệu demo không đăng xuất người đang dùng).

## 7. Vùng cấm

| Không làm | Lý do |
|---|---|
| Salt / pepper / HMAC / bcrypt cho token | Token 256-bit ngẫu nhiên: SHA-256 không đảo ngược được; băm chậm ở mọi request = khuếch đại DoS, không thêm an toàn. |
| Gia hạn trượt (sliding expiry) mỗi request | Mỗi request thành 1 lần GHI DB; không có trong yêu cầu. Hạn cố định 8 h từ lúc đăng nhập như v0.5. |
| Dùng `now()` của DB thay đồng hồ app | Test không tiêm được thời gian; lệch đồng hồ vài giây giữa máy là vô nghĩa với hạn 8 h. |
| Lưu `failures` vào DB | §5. |
| Revision Alembic riêng cho `sessions` | Bảng nằm trong `0001` (chưa chạy lên Supabase) — một revision, một lần owner chạy. |

## 8. Phân loại lỗi

| Tình huống | Hành vi | HTTP |
|---|---|---|
| DB đứt khi `login` / `me` / mọi request có Bearer (`get_actor`) | `StoreUnavailableError` từ store ⇒ handler app | 503 `STORE_UNAVAILABLE` |
| Token lạ / đã đăng xuất / hết hạn | `account_for` ⇒ `None` | 401 như cũ |
| Hai backend: A đăng nhập, B đọc | B thấy phiên (cùng bảng) | 200 |
| A đăng xuất | B nhận 401 ở request kế tiếp | 401 |
| Restart backend (postgres) | phiên còn nguyên | 200 |
| Restart backend (memory) | mất phiên như v0.5 | 401 |
| Trùng `token_hash` (xác suất ~2⁻²⁵⁶) | `insert` 23505 ⇒ lỗi không dịch ⇒ 500 | 500 |

## 9. Nghiệm thu

| ID | Đo | Chạy trên | Đạt khi |
|---|---|---|---|
| T19 | Restart không bị đăng xuất; DB không có token thô | pg | `AuthService` A (store pg) `login("bql01")` ⇒ token; dispose + `sql_engine.cache_clear()` (giả restart); `AuthService` B mới: `account_for(token).username == "bql01"`; `select token_hash, username from maintops.sessions` == `[(token_hash(token), "bql01")]`; không cột nào chứa `token`; qua API (`get_auth` override = B) `GET /api/v1/auth/me` ⇒ 200 |
| T20 | Dùng chung + đăng xuất mọi nơi | pg | A login; B `account_for` OK; B `logout(token)`; A `account_for` ⇒ `None`; bảng 0 dòng |
| T21 | Hết hạn giống nhau | mem + pg | clock tiêm `t0 = 1_000_000.0`: login tại `t0`; `account_for` tại `t0 + TTL - 1` OK; tại `t0 + TTL` ⇒ `None`; pg: dòng bị xoá (count 0) |
| T22 | Store đứt ⇒ 503 | mặc định | store giả `lookup`/`create` raise `StoreUnavailableError`; `GET /api/v1/mo/tickets` có Bearer ⇒ 503 `{"detail":{"code":"STORE_UNAVAILABLE",…}}`; `POST /auth/login` ⇒ 503 |
| — | Hồi quy | mặc định | 13 test `test_auth.py` xanh, file không sửa |

Bằng chứng đỏ: R5 (`TESTING §4`) — cho `build_session_store` trả `InMemorySessionStore` cả khi `postgres` ⇒ T19 đỏ.
