# SPEC-P03 — Startup không reset, seed khi rỗng, cổng reset/evaluate, job một leader

> CHÍNH THỨC — chốt 2026-10-02 12:25:56 +07:00, HEAD `3e7b70b`. Gói WP4. Số dòng theo `413aebc`.

Phạm vi file: `src/maintenance/engine.py` (`build_engine`, `seed_if_empty` mới, `seed` — `SPEC-P01 §2.9`),
`src/api/routers/maintenance.py` (`get_engine`, `reset`, `run_evaluation`, `_require_reset_allowed` mới), `src/main.py`
(`lifespan`), `docker-compose.yml` (1 dòng), `.env.example` (khối biến, `OPERATIONS §4`), test mới.

## 1. `build_engine(settings: Settings | None = None) -> MaintenanceEngine` (`engine.py:L2215`, hiện không tham số)

```python
def build_engine(settings: Settings | None = None) -> MaintenanceEngine:
    from src.config import get_settings
    from src.maintenance.proposer import openai_client

    settings = settings or get_settings()
    repo = None
    if settings.mo_store == "postgres":
        from src.maintenance.store.postgres import PostgresRepository   # lười: memory không cần psycopg2

        repo = PostgresRepository(settings.database_url)
        repo.check()                                    # I-5: URL / kết nối / revision sai ⇒ RuntimeError
    if settings.llm_mode == "openai" and settings.openai_api_key:
        return MaintenanceEngine(
            repo=repo,
            llm=openai_client(settings.model_name, settings.openai_api_key, settings.openai_base_url),
            llm_label=settings.model_name,
        )
    return MaintenanceEngine(repo=repo)
```

## 2. `seed_if_empty(engine: MaintenanceEngine) -> bool` (mới, module-level trong `engine.py`)

```python
def seed_if_empty(engine: MaintenanceEngine) -> bool:
    """Startup seeding: the fixture goes in only when the store holds no ticket. True if this call seeded."""
    with engine.lock, engine.repo.seed_lease() as leader:      # I-9: engine.lock trước, lease sau
        if not leader or engine.repo.count() > 0:
            return False
        engine.seed()                                          # seed() bù tồn kho trước (SPEC-P01 §2.9)
        return True
```

- Memory: kho luôn rỗng lúc start ⇒ seed 12 fixture (= hành vi cũ, khác V2 `run_id`).
- Postgres: chỉ seed khi `cases` rỗng; start lại ⇒ không đụng dữ liệu. Hai backend start cùng lúc ⇒ một bên có lease và seed,
  bên kia `False` và phục vụ ngay (có thể thấy kho đang được seed dở — chấp nhận).

## 3. `get_engine()` (`routers/maintenance.py:L63-71`)

```python
def get_engine() -> MaintenanceEngine:
    global _engine
    if _engine is None:
        with _engine_lock:  # two first requests must not build two engines
            if _engine is None:
                settings = get_settings()
                engine = build_engine(settings)
                if settings.mo_seed_on_empty:
                    seed_if_empty(engine)
                _engine = engine
    return _engine
```

Dòng `engine.reset()` (`L69`) bị xoá. Test có thể đặt `maintenance._engine = None` để giả một lần start mới (T08).

## 4. `lifespan` (`src/main.py:L37-49`)

Thứ tự BẮT BUỘC trong startup: `await asyncio.to_thread(photos.check_photo_store)` (cấu hình ảnh, I-5) →
`await asyncio.to_thread(maintenance.get_engine)` (check DB + seed) → tạo task job. Dòng `print` startup thêm
`MO_STORE=<…>, MO_PHOTO_STORE=<…>` (không in URL/key). Lỗi bất kỳ ⇒ uvicorn exit 3 (đo `00 §1.3`).
Handler `StoreUnavailableError`/`StorePermissionError` đăng ký ở WP2 (`01-CONTRACTS §8`). `_maintenance_jobs` (`L24-34`) giữ nguyên.

## 5. Cổng reset / evaluate

```python
def _require_reset_allowed() -> None:
    settings = get_settings()
    if settings.mo_store != "memory" and not settings.mo_allow_reset:
        raise HTTPException(status_code=403, detail={
            "code": "RESET_DISABLED", "message": "Reset bị tắt trên DB dùng chung (MO_ALLOW_RESET=false)"})
```

| Endpoint | Thứ tự kiểm | Ghi chú |
|---|---|---|
| `POST /mo/reset` (`L185-189`) | `_require_role(QA_INTERNAL)` → `_require_reset_allowed()` → `{"run_id": engine.reset(), "tickets": len(engine.cases)}` | giữ body trả về |
| `POST /mo/evaluate` (`L201-205`) | `_require_role(QA_INTERNAL)` → `_require_reset_allowed()` → `evaluate(engine)` | **mới chặn** — `demo.evaluate` gọi `engine.reset()` (`demo.py:L101`) |

Cổng chỉ đọc `Settings`, không đọc loại repo ⇒ test được ở bộ mặc định bằng cách monkeypatch `get_settings()`.

## 6. Job ngầm

`_maintenance_jobs` không đổi; `engine.run_jobs()` tự xin `job_lease()` (✅WP1, `SPEC-P01 §2.8`). Postgres: lease =
`pg_try_advisory_xact_lock(151001)` trên kết nối riêng (`01-CONTRACTS §4.2/§7.4`). Không có lease ⇒ `[]`, không log lỗi.
`POST /mo/jobs/run` của QA lúc backend khác đang giữ lease ⇒ `{"changed": []}` (chấp nhận).

## 7. `docker-compose.yml` (`L33`)

```yaml
      DATABASE_URL: ${COMPOSE_DATABASE_URL:-postgresql+psycopg2://${POSTGRES_USER:-p151}:${POSTGRES_PASSWORD:-p151}@db:5432/${POSTGRES_DB:-p151}}
```

Đo (`docker compose config`, Compose v5.1.1): không đặt biến ⇒ `postgresql+psycopg2://p151:p151@db:5432/p151`; đặt
`COMPOSE_DATABASE_URL=<url>` ⇒ đúng `<url>`; `POSTGRES_USER=alice` ⇒ `…alice:p151@db…`. Container vẫn mặc định dùng `db`;
muốn container trỏ Supabase thì đặt `COMPOSE_DATABASE_URL` có chủ ý. Cảnh báo vận hành: `OPERATIONS §3`.

## 8. Luật

- **CẤM** `engine.reset()` ở bất kỳ đường startup nào; **CẤM** seed khi `count() > 0` (kể cả khác 12).
- **CẤM** chạy Alembic trong startup (vùng cấm `00 §5`).
- **BẮT BUỘC** startup postgres lỗi ⇒ process dừng với message có hướng dẫn, không phục vụ request nào.
- **BẮT BUỘC** `/mo/evaluate` qua cùng cổng với `/mo/reset`.

## 9. Vùng cấm

| Không làm | Lý do |
|---|---|
| Tự `wipe` khi thấy DB “bẩn” lúc start | Xoá dữ liệu team không ai bấm. |
| Seed lại khi số ticket < 12 | Không phân biệt được “thiếu” với “team đã xử lý/huỷ”. |
| Chặn reset bằng kiểm loại repo thay vì `Settings` | Test được ở bộ mặc định; cấu hình là thứ người vận hành thấy. |
| Kiểm `count()` TRƯỚC khi lấy lease | Hai backend cùng thấy 0 ⇒ seed hai lần (24 ticket, trùng ID ⇒ một bên lỗi giữa chừng). |

## 10. Phân loại lỗi

| Tình huống | Hành vi |
|---|---|
| `MO_STORE=postgres`, URL sai / DB không nối được | `RuntimeError` ở `build_engine` ⇒ uvicorn exit 3 |
| Schema thiếu / revision lệch | `RuntimeError` có lệnh `python -m alembic -c src/maintenance/store/alembic.ini upgrade head` |
| Seed lỗi giữa chừng (vd ticket thứ 7) | 6 ticket đã commit giữ nguyên; exception lan ra ⇒ exit 3; start lại không seed (count > 0); QA dùng reset (owner, `MO_ALLOW_RESET=true`) nếu cần |
| `MO_ALLOW_RESET=false` + postgres | `/mo/reset`, `/mo/evaluate` ⇒ 403 `RESET_DISABLED` |
| `MO_ALLOW_RESET=true` nhưng user `maintops_dev` | `wipe` ⇒ 42501 ⇒ 403 `STORE_PERMISSION_DENIED` |
| Hai backend cùng chạy job | chỉ bên giữ lease chạy; bên kia `[]` |

## 11. Nghiệm thu

| ID | Chạy trên | Đạt khi |
|---|---|---|
| T08 | pg | settings monkeypatch (`mo_store="postgres"`, `database_url=<test url>`, `mo_seed_on_empty=True`); `maintenance._engine = None`; `get_engine()` ⇒ `repo.count() == 12`; `receive(...)` ⇒ 13; giả restart (`_engine = None`, dispose + `sql_engine.cache_clear()`); `get_engine()` ⇒ `count() == 13`, ticket vừa tạo còn nguyên |
| T09 | mem + pg | repo rỗng (pg: bảng `stock` cũng rỗng) ⇒ `seed_if_empty` = `True`, `count() == 12`, `repo.stock() == initial_stock(catalog)`, `SIM-TKT-TEC-003` có blocker `WAITING_MATERIAL`; gọi lần 2 ⇒ `False`, vẫn 12 |
| T10 | mặc định | monkeypatch `mo_store="postgres"`, `mo_allow_reset=False`: QA `POST /mo/reset` và `/mo/evaluate` ⇒ 403 `RESET_DISABLED`; BQL ⇒ 403 `ACTION_DENIED` (vai kiểm trước); `mo_allow_reset=True` ⇒ 200 (engine memory override) |
| T11 | pg | engine A giữ `repo_a.job_lease()` (vào context tay) ⇒ `engine_b.run_jobs(far_future)` == `[]`, tổng `version` mọi ticket không đổi; A nhả ⇒ B chạy được |
| T12 | pg | owner `update maintops.alembic_version set version_num = 'x'` ⇒ `build_engine(pg_settings)` raise `RuntimeError` chứa `alembic -c src/maintenance/store/alembic.ini upgrade head`; `finally` trả lại `0001_maintops_initial` |
| T12b | mặc định | `postgres.HEAD_REVISION == ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()` (không cần DB) |
