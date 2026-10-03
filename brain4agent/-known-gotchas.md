# Known Gotchas & Bugs

Tổng hợp các lỗi khó, các lưu ý dị biệt hoặc cách workaround đặc thù của dự án này để AI không dẫm lại vết xe đổ.

## Đồng thời (concurrency)
- Endpoint `def` của FastAPI chạy trong **thread pool**, job retry/leo thang chạy song song. Mọi thao tác ghi của
  `MaintenanceEngine` phải đi qua `engine.lock` (RLock) — `_mutate`, `transition`, `receive`, `ingest`, `reset`,
  `receive_stock`, `run_jobs` đã giữ lock sẵn. Thêm entry point ghi mới thì cũng phải giữ lock.
- `engine.at(moment)` đổi đồng hồ **theo thread** (`threading.local`). Trước 2026-09-30 nó đổi đồng hồ toàn cục ⇒ thread
  khác thấy giờ giả. Đừng gán lại `engine.clock`; `clock()` là method.
- Duyệt `engine.cases` từ router/view thì lấy snapshot `list(engine.cases.values())` (ticket mới có thể được thêm từ thread khác).
- Job định kỳ trong `src/main.py` phải chạy qua `asyncio.to_thread` (có thể gọi LLM, không được chặn event loop).

## Bảo mật / quyền
- `simulated_received_at` chỉ dùng cho demo: cư dân bị từ chối (422) khi `APP_ENV=production`.
- `X-Actor-Id` chỉ nhận khi `MO_ALLOW_ACTOR_HEADER=true` (test/script) — không bao giờ bật ở production.
- `/api/v1/chat` (boilerplate LangGraph) không có auth — chưa dùng cho MaintenanceOps; lỗi chỉ ghi log, không trả ra client.
- Khóa đăng nhập tính theo (username, `request.client.host`). Sau reverse proxy mọi client chung một IP ⇒ lại thành khóa theo username.

## Môi trường & Config
- Chạy script ngoài pytest cần `PYTHONPATH=.` (import `src.*`).
- `LLM_MODE=openai` ⇒ `reset()` gọi LLM 12 lần (một lần mỗi fixture); engine được khởi tạo sẵn trong lifespan.
- LLM thật của MaintenanceOps là `proposer.openai_client`; `src/services/llm.py` chỉ phục vụ boilerplate.
- `scripts/` là log hook chạy bằng Python bất kỳ trên máy thành viên: đừng dùng cú pháp/API chỉ có từ 3.11 (vd `datetime.UTC`).

## Lưu bền (kế hoạch 01, 2026-10-02)
- `.env` máy owner có `MO_STORE=postgres` (Supabase dùng chung): test PHẢI ép `MO_STORE=memory`, `MO_PHOTO_STORE=local`,
  `MO_ALLOW_RESET=false` trong `tests/conftest.py` trước khi import app. Thiếu khối này, pytest đã từng mở kết nối tới Supabase.
- `pytest --pg` chỉ nhận `MO_TEST_DATABASE_URL` host local + tên DB đuôi `_test` (exit 4 nếu sai) — fixture TRUNCATE bảng.
- Postgres cấm `transaction()` lồng trên cùng thread (tự chờ khoá dòng của chính mình) ⇒ `RuntimeError`; memory thì cho.
- Startup không còn `reset()`: chỉ `seed_if_empty`. `/mo/reset` và `/mo/evaluate` (evaluate gọi reset) bị 403 `RESET_DISABLED`
  khi `MO_STORE=postgres` mà `MO_ALLOW_RESET=false`.
- `src/maintenance/engine.py` dùng xuống dòng CRLF: script sửa bằng chuỗi `
` sẽ không khớp.
- Bỏ `from None` khi raise trong `except` KHÔNG làm `__cause__` khác None (chỉ gắn `__context__`): kiểm `__suppress_context__`.
- Shell `(base)` conda: `python` là miniconda, không có alembic/deps ⇒ dùng `.venv\Scripts\python.exe` hoặc activate `.venv`.
- Qua Supabase pooler, `pg_stat_ssl.ssl` = false (chặng pooler→DB); TLS client kiểm bằng `connection.info.ssl_in_use`.
- Docker backend dùng nguyên `DATABASE_URL` của `.env` (Supabase) từ 2026-10-02; service `db` chỉ cho `pytest --pg`. Schema thiếu ⇒ container exit 3 và restart lặp.

## Evidence và pytest (2026-10-03)
- Pytest mặc định có thể collect `test*.txt` như doctest, kể cả output trong planning/evidence; output PowerShell UTF-16 làm collection lỗi UnicodeDecodeError. Đặt tên evidence không bắt đầu `test` (vd `scope-stat.txt`), không sửa tay nội dung output máy.
- PowerShell pipe sang Python cần `$OutputEncoding` UTF-8 và `PYTHONIOENCODING=utf-8` để giữ tiếng Việt của input/output; tránh gold case bị biến thành dấu hỏi.

## Day03 đo local (2026-10-03)
- Docstring API nhập kho (`maintenance.py:550`) ghi resume bước 7 nhưng code engine dùng bước 6: tin code, không tin docstring.
- Timestamp quyết định BPTN dùng đồng hồ máy, không phải giờ mô phỏng (`engine.at()`): không so sánh với mốc mô phỏng.
- `.env` máy owner có thể trỏ `MO_STORE=postgres`: mọi lần đo local phải ép env `MO_STORE=memory`, mock/local và `MO_JOBS_ENABLED=false`.
- Harness tái hiện Day03: `planning/02_2026-10-03_truong-mvp-prep/evidence/d3-06/harness.py`, chạy với `PYTHONPATH` = repo root.
