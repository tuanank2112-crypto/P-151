# SPEC-P01 — Repository + transaction trong engine

> CHÍNH THỨC — chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`. Số dòng theo `413aebc`.
> **WP1 đã làm xong phần memory** (`413aebc`, SO ✅). SPEC này (a) mô tả hợp đồng code đã có — làm chuẩn để
> `PostgresRepository` khớp; (b) liệt kê đúng những chỗ WP2/WP4 phải sửa trên code WP1 (§9).

Phạm vi file — WP2: `src/maintenance/store/postgres.py` (mới), `src/maintenance/store/base.py` (thêm 2 lớp lỗi),
`src/maintenance/engine.py` (chỉ §2.2, §2.3, §2.6), `src/api/routers/maintenance.py` (chỉ `_call`), `src/main.py` (chỉ
handler lỗi), `src/config.py`, Alembic (`01-CONTRACTS §7`), `tests/conftest.py`, `tests/test_maintenance/conftest.py`
(chỉ thêm), test mới. WP4: `engine.py::seed`, `build_engine` (§2.9, `SPEC-P03`).

## 1. Engine nhận repository (✅WP1)

```python
class MaintenanceEngine:
    def __init__(self, catalog=None, dataset=None, audit_sink=None, notify_sink=None, clock=None, llm=None,
                 llm_label="llm", repo: CaseRepository | None = None):          # engine.py:L296-319
        self.repo: CaseRepository = repo or InMemoryRepository(initial_stock(self.catalog))
        self._set_run(self.repo.run_number())          # run_number + run_id = f"SIM-RUN-{n:03d}"

def initial_stock(catalog: Catalog) -> dict[str, float | None]   # engine.py:L204 — {m.item_code: m.simulated_stock_qty}
```

- `engine.cases` → `@property` trả `CasesView(self.repo)` (`engine.py:L209`), `Mapping[str, Case]` chỉ đọc:
  **D4:** `__getitem__` = `repo.get`, `NotFoundError` ⇒ `raise KeyError(ticket_id)` (để `.get()`, `in` của Mapping đúng);
  `__iter__` = id từ `repo.list()`; `__len__` = `repo.count()`; `values()` = `repo.list()`, `items()` = 1 lần `repo.list()`
  (không N+1). Gán item ⇒ `TypeError` (Mapping không có `__setitem__`).
- `engine.stock` → `@property` trả `StockView(self.repo)` (`engine.py:L234`), `MutableMapping`: `__getitem__` từ
  `repo.stock()` (thiếu ⇒ `KeyError`), `__setitem__` = `repo.set_stock` (chỉ test dùng), `__delitem__` ⇒ `TypeError`.
- `run_id` chỉ đổi khi `reset()`. Nhiều backend: backend khác `reset` ⇒ `run_id` các backend còn lại cũ tới khi restart
  (chấp nhận; `OPERATIONS §6`).
- `audit_sink` / `notify_sink` giữ nguyên chữ ký; gọi BÊN TRONG transaction (§2.2).

## 2. Các đường ghi (BẮT BUỘC đúng thứ tự)

### 2.1 `_mutate_locked` (✅WP1, `engine.py:L1080-1112`)

1. `now = self.clock()`; `role`; `allowed`.
2. `with self.repo.transaction() as tx:` → `case = tx.get_for_update(ticket_id)` (khoá dòng, I-3).
3. Sai quyền / sai phạm vi ⇒ `raise _Denied(case, message)` (thoát `with` ⇒ rollback).
4. Integrity marker lệch ⇒ `EngineError("Raw integrity marker không khớp; dừng xử lý (fail closed)")`.
5. `work = case.model_copy(deep=True)`; `marks`; `op(work, now)`; `self._commit(tx, work, *marks)`; thoát `with` = commit.
6. `except _Denied` (NGOÀI `with`) ⇒ `self._deny(...)` mở transaction riêng (không lồng).

### 2.2 `_commit(tx, work, audit_from, events_from, notes_from)` — `engine.py:L1114-1126` (✅WP1, **WP2 sửa**)

Đích sau WP2 (giữ D3: sink lỗi ⇒ `AuditWriteError` + rollback; `audit_sink` vẫn gọi cả khi danh sách rỗng như v0.5):

```python
        tx.save(work)
        new_rows = [*work.audit[audit_from:], *work.events[events_from:]]
        new_notifications = work.notifications[notes_from:]
        tx.append_log(new_rows)                      # lỗi tầng lưu trữ đi thẳng ra: 409/503/403, KHÔNG thành 500
        self._sink(self.audit_sink, new_rows)
        if new_notifications:
            tx.append_notifications(new_notifications)
            self._sink(self.notify_sink, new_notifications)

    @staticmethod
    def _sink(sink, rows) -> None:                   # chỉ bọc callback ngoài
        try:
            sink(rows)
        except Exception as exc:  # audit/notify failure → nothing is committed (D3)
            raise AuditWriteError("Không ghi được audit; thay đổi bị huỷ", {"error": str(exc)}) from exc
```

Lý do sửa: code `413aebc` bọc cả `tx.append_*` trong `except Exception` ⇒ trên Postgres mất kết nối giữa tx thành
`AuditWriteError` 500 thay vì `StoreUnavailableError` 503 (`01-CONTRACTS §8`). Memory không đổi (append không bao giờ raise).

### 2.3 `_deny(case, actor_id, role, action, field_name, new_value, reason, now, *, message=None)` — `engine.py:L1138` (✅WP1, WP2 sửa nhỏ)

Một tx riêng: `fresh = tx.get_for_update(case.ticket.ticket_id)` → `event = self._make_audit(fresh, ACTION_DENIED, …)` →
`denied = fresh.model_copy(deep=True)`; `denied.audit.append(event)` → `tx.save(denied)` → `tx.append_log([event])` →
`audit_sink([event])` (lỗi ⇒ `AuditWriteError("Không ghi được audit cho lần từ chối")`) → commit → `raise ActionDeniedError`
(detail `unchanged_status = fresh.ticket.status`). **WP2:** đưa `tx.append_log([event])` ra ngoài `try` như §2.2.

### 2.4 `_ingest` (✅WP1, `engine.py:L418-449`)

Dựng `work` (không tác dụng phụ) → `with self.repo.transaction() as tx: tx.insert(work); self._commit(tx, work, 0, 0, 0)`.
Trùng ID ⇒ `GuardError(f"Ticket {id} đã được ingest")` từ `tx.insert`. `insert` trước sổ: FK `audit_log.ticket_id → cases`.

### 2.5 Số ticket — `receive` (✅WP1, `engine.py:L380-416`) — D3

`number = self.repo.next_ticket_number()` trong `engine.lock`; ID `f"SIM-TKT-{number:04d}"`. Bộ đếm **không tái dùng**: số đã
cấp mà ingest rollback vẫn mất (test `test_next_ticket_number_never_hands_out_a_number_twice`: 0001, [0002 hỏng], 0003).
`ingest` thủ công ID `SIM-TKT-<n>` đẩy bộ đếm lên ≥ n (memory `_take_number`, Postgres `setval greatest`).

### 2.6 `_transition` — `engine.py:L999-1042` (✅WP1 không đổi; **WP2 thêm kiểm dưới khoá**, I-3)

Kiểm ngoài khoá (`self.get`) giữ nguyên. `op` đích sau WP2:

```python
        def op(work: Case, now: datetime) -> None:
            fresh = work.ticket.status                      # bản đã khoá
            fresh_rule = TRANSITIONS.get((fresh, to))
            if (fresh_rule is None or fresh_rule.pipeline_only or role not in fresh_rule.actors
                    or expected_from not in (None, fresh)):
                raise InvalidTransitionError(f"Không chuyển được {fresh} → {to}",
                                             {"from": fresh, "to": to, "actor_role": role})
            self._human_transition(work, to, actor_id, role, now, note=note, eta=eta, cancel_reason=cancel_reason)
```

Lý do: hai backend — A đọc `ROUTED` gọi `accept`, B đã accept rồi `block_onsite` (`ON_HOLD`); không kiểm lại thì `op` của A
rơi vào nhánh `(ON_HOLD, IN_PROGRESS)` của `_human_transition` = **resume_work** thay vì accept. Một process: `fresh == current`
⇒ không đổi hành vi (161 test giữ nguyên).

### 2.7 `receive_stock` (✅WP1, `engine.py:L914-932`)

Ngoài lock: kiểm vai WAREHOUSE (`ActionDeniedError`, không audit — như v0.5), vật tư có trong catalog, `qty > 0`.
Trong `engine.lock`: tx 1 = `tx.add_stock(item, qty)`; sau commit `waiting` từ `repo.list()`; `self.resume(id)` từng ticket
(mỗi cái một tx, idempotent). Nhập kho không ghi audit (như v0.5).

### 2.8 `run_jobs` (✅WP1, `engine.py:L940-960`)

`with self.lock, self.repo.job_lease() as leader, self.at(moment):` — `leader` False ⇒ `return []`; còn lại duyệt
`repo.list()`, `_due` trước khi `_mutate`, `EngineError` một ticket ⇒ log + bỏ qua ticket đó. Postgres: `StoreUnavailableError`
là `EngineError` nên mỗi ticket lỗi log một dòng (chấp nhận; DB đứt hẳn thì `repo.list()` đầu vòng đã raise).

### 2.9 `reset` / `seed` (✅WP1 `engine.py:L355-373`; **WP4 sửa `seed`**)

- `reset(with_fixtures=True)`: `with self.lock` → `self._set_run(self.repo.wipe(initial_stock(self.catalog)))` → `seed()` nếu cần.
- `seed()` đích sau WP4 — bù tồn kho trước khi nạp fixture (DB mới có bảng `stock` rỗng ⇒ thiếu bước này thì mọi dòng vật tư
  thành `UNKNOWN`, `SIM-TKT-TEC-003` không còn `WAITING_MATERIAL`):

```python
    def seed(self) -> None:
        with self.lock:
            present = self.repo.stock()
            for item_code, qty in initial_stock(self.catalog).items():
                if item_code not in present:
                    self.repo.set_stock(item_code, qty)   # không bao giờ ghi đè số đã có
            for fixture in self.dataset.tickets: ...      # vòng ingest + run_agent hiện có, không đổi
```

### 2.10 Đọc trong pipeline (✅WP1)

`_find_duplicate_ticket_id` (`L1734`) duyệt `self.repo.list()`; `_line_stock` (`L1871`) và `_material_line` (`L2013`) đọc
`self.repo.stock_of(code)`. Đọc không khoá (ticket khác không bị bước này sửa) — như v0.5.

## 3. `InMemoryRepository` (✅WP1, `store/memory.py`)

Hợp đồng ở `01-CONTRACTS §4.2` cột Memory. Điểm phải giữ: trả object đã lưu theo tham chiếu (I-10); copy-on-write;
`_apply` kiểm lại version + trùng insert lúc commit (`memory.py:L111-127`); version insert = 1, save = +1; lồng tx được.

## 4. `PostgresRepository(url: str)` (WP2, `store/postgres.py`)

- Thuộc tính: `self._engine = sql_engine(url)`; `self._url_host = make_url(url).host`; `self._local = threading.local()` (cờ
  `in_tx`). KHÔNG giữ cache `Case`.
- `_PgTx(conn)`: giữ `conn`, `versions: dict[str, int]` (từ `get_for_update`), `inserted: dict[str, Case]`. Method đúng
  `01-CONTRACTS §4.2` cột Postgres. `conn` là thuộc tính công khai cho test trắng hộp T05-pg.
- Mọi câu SQL trong `_db_errors()` (`01-CONTRACTS §3.3`). Đọc ngoài tx: `with self._engine.connect() as conn` (kết nối riêng).
- 3 helper test (D2) theo `01-CONTRACTS §4.3`.
- `check()` theo `01-CONTRACTS §4.2` (bảng `check()`); gọi từ `build_engine` trước khi tạo engine.

## 5. Phân loại lỗi

| Tình huống | Kết quả trong store | Lỗi ra | HTTP |
|---|---|---|---|
| `op` raise `GuardError` | không đổi (rollback) | `GuardError` | 409 |
| `audit_sink` hoặc `notify_sink` raise (D3) | không đổi | `AuditWriteError` | 500 |
| **D5:** `Tx.save` khi chưa `get_for_update`/`insert` cùng ticket trong tx | không đổi | `GuardError("Ticket … phải được get_for_update trước khi save")` | 409 (lỗi lập trình — không xảy ra qua engine) |
| Hai process sửa cùng ticket | tuần tự (FOR UPDATE), cả hai thành công | — | 200 |
| `save` khớp 0 dòng / version lệch lúc commit (memory) | không đổi | `ConcurrencyError` | 409 |
| Deadlock / serialization (40P01, 40001, 55P03) | Postgres tự rollback | `ConcurrencyError` | 409 |
| Mất kết nối giữa tx / lúc commit | Postgres rollback (commit có thể không chắc) | `StoreUnavailableError` | 503 |
| User `maintops_dev` gọi `wipe` (TRUNCATE) | không đổi | `StorePermissionError` | 403 |
| Văn bản có `\u0000` (Postgres) | không đổi | `UnstorableTextError` | 409 |
| Bị từ chối quyền | chỉ thêm 1 audit ACTION_DENIED | `ActionDeniedError` | 403 |
| Lồng `transaction()` cùng thread (Postgres) | không mở tx thứ hai | `RuntimeError` | 500 (bug) |
| Ingest trùng ID | không đổi | `GuardError("Ticket … đã được ingest")` | 409 |

## 6. Luật

- **BẮT BUỘC** `engine.lock` quanh mọi đường ghi (trong process) VÀ khoá dòng DB (giữa process); lấy theo thứ tự I-9.
- **BẮT BUỘC** 155 test cũ xanh với memory mà **không sửa file test cũ nào** (G8).
- **BẮT BUỘC** memory + postgres chạy chung các test hợp đồng tham số hoá (`TESTING §3`).
- **CẤM** gọi LLM ngoài `op` (giữ vị trí `_classification`); tx mở vài giây khi LLM chạy — chấp nhận.
- **CẤM** đọc `Case` từ cache engine; **CẤM** `except Exception: pass` quanh tx; **CẤM** bọc `tx.*` trong `except Exception`.
- **CẤM** engine đọc lại qua repo thứ chính nó vừa ghi trong cùng tx (memory và postgres đều chỉ trả dữ liệu đã commit).

## 7. Vùng cấm

| Không làm | Lý do |
|---|---|
| Đổi tên `CaseRepository.list` thành tên khác | Đã có ở WP1 + test; bẫy che `list` được chặn bằng `from __future__ import annotations` (`01-CONTRACTS §4.1`). |
| Đổi `_Denied` thành `_DeniedError` | Đã có `# noqa: N818` có lý do ở `engine.py:L195`; đổi tên chỉ gây diff. |
| Dùng `repo.get(...)` sau `_mutate` trong `run_jobs` để thay bằng giá trị trả về | Code WP1 đúng; tối ưu 1 câu SELECT không đáng diff. |
| Retry tự động `ConcurrencyError` trong engine | `op` có thể gọi LLM; để người dùng bấm lại. |
| Đọc dùng chung kết nối tx (thread-local) để bớt round-trip | Làm memory và postgres thấy dữ liệu khác nhau trong tx. |

## 8. Nghiệm thu (lệnh + số kỳ vọng)

| Lệnh | Kỳ vọng |
|---|---|
| `python -m pytest -q tests/test_maintenance/test_store_memory.py` | memory: xanh; không `--pg` thì tham số postgres hiện `deselected` |
| `MO_TEST_DATABASE_URL=…/p151_test python -m pytest --pg -q tests/test_maintenance/test_store_memory.py tests/test_maintenance/test_store_postgres.py` | 0 failed, 0 skipped, 0 deselected |
| `git diff --numstat f2da6cb -- <11 file test cũ>` (`TESTING §6 G8`) | rỗng |
| `grep -n "except Exception" src/maintenance/engine.py` sau WP2 | đúng 2 dòng (tại `413aebc` cũng 2: `L1125`, `L1176`): một trong `_sink`, một trong nhánh sink của `_deny`; không dòng nào bọc `tx.*` |

## 9. Việc WP2/WP4 phải sửa trên code WP1 (không thuộc 5 quyết định SO — SO duyệt, `00 §8 Q9`)

| # | Gói | Chỗ | Sửa | Test bắt |
|---|---|---|---|---|
| C1 | WP2 | `engine.py::_commit` `L1114-1126`, `_deny` nhánh sink | Theo §2.2/§2.3: `tx.append_*` ra ngoài `try` | T25 (`StoreUnavailableError` từ append ⇒ 503) |
| C2 | WP2 | `engine.py::_transition.op` | Kiểm lại dưới khoá §2.6 | T29 |
| C3 | WP2 | `store/base.py` | Thêm `StorePermissionError(EngineError)`, `UnstorableTextError(GuardError)` | T25, T28 |
| C4 | WP2 | `routers/maintenance.py::_call` | `except StorePermissionError` ⇒ 403, đặt trước `except AuditWriteError` | T25 |
| C5 | WP4 | `engine.py::seed` | Bù tồn kho §2.9 | T09 (pg) |
