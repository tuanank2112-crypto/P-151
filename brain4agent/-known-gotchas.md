# Known Gotchas & Bugs

Tổng hợp các lỗi khó, các lưu ý dị biệt hoặc cách workaround đặc thù của dự án này để AI không dẫm lại vết xe đổ.

## Đồng thời (concurrency) — từ Châm Anh, 2026-09-30
- Endpoint `def` của FastAPI chạy trong **thread pool**, job retry/leo thang chạy song song. Mọi thao tác ghi của
  `MaintenanceEngine` phải đi qua `engine.lock` (RLock) — `_mutate`, `transition`, `receive`, `ingest`, `reset`,
  `receive_stock`, `run_jobs` đã giữ lock sẵn. Thêm entry point ghi mới (vd hành động an toàn CR-03) thì cũng phải giữ lock.
- `engine.at(moment)` đổi đồng hồ **theo thread** (`threading.local`). Đừng gán lại `engine.clock`; `clock()` là method.
- Duyệt `engine.cases` từ router/view thì lấy snapshot `list(engine.cases.values())`.
- Job định kỳ trong `src/main.py` phải chạy qua `asyncio.to_thread` (có thể gọi LLM, không được chặn event loop).

## Bảo mật / quyền
- `simulated_received_at` chỉ dùng cho demo: cư dân bị từ chối (422) khi `APP_ENV=production`.
- `X-Actor-Id` chỉ nhận khi `MO_ALLOW_ACTOR_HEADER=true` (test/script) — không bao giờ bật ở production.
- `/api/v1/chat` (boilerplate LangGraph) không có auth; lỗi chỉ ghi log, không trả ra client.
- Khóa đăng nhập tính theo (username, `request.client.host`). Sau reverse proxy mọi client chung một IP ⇒ lại thành khóa theo username.

## Môi trường & Config
- **pytest exit 4 trên Python hệ thống (3.13):** thiếu `pytest_asyncio`, `langgraph`, ... ⇒ lỗi môi trường, không phải lỗi code. Chạy test bằng venv Python 3.11 + `pip install -r requirements.txt`, đặt `LLM_MODE=mock` (Châm Anh đo `1e2f42b`: 142 pass, ruff check + format sạch).
- Chạy script ngoài pytest cần `PYTHONPATH=.` (import `src.*`).
- `LLM_MODE=openai` ⇒ `reset()` gọi LLM 12 lần (một lần mỗi fixture); engine được khởi tạo sẵn trong lifespan.
- LLM thật của MaintenanceOps là `proposer.openai_client`; `src/services/llm.py` chỉ phục vụ boilerplate.
- `scripts/` là log hook chạy bằng Python bất kỳ trên máy thành viên: đừng dùng cú pháp/API chỉ có từ 3.11 (vd `datetime.UTC`).

## Spec & Tài liệu
- **CR-BPTN-01/02 đã xoá (2026-10-01) nhưng còn bị nhắc** trong comment code (`engine.py`, `enums.py`, `models.py`, ...), seed, test và docs `01`–`05`. Đừng tìm file; xem lịch sử: `git show a305fc0:docs/CR-BPTN-02.md`. Spec hiện hành chỉ là `docs/CR-BPTN-03.md`.
- **Thứ tự pipeline (CR-03 D-09, chốt 2026-10-01 theo code `1e2f42b` của Châm Anh):** 2 dữ liệu → 2b an toàn → **3 phân loại + phòng ban + priority → 4 kiểm tra trùng** → 5 review → 6 asset → 7 vật tư → 8 giao. ĐỪNG đảo lại thành "trùng trước phân loại" (bản CR-03 gốc ghi vậy, đã sửa). Code `1e2f42b` CHƯA có bước 2b — phải chèn trước `_step_3_classify_and_propose_department`. Ticket Bậc 1 không có category ⇒ bước 4 chỉ liên kết theo vị trí + cửa sổ.
- **Code `a305fc0` KHÔNG có luật an toàn** (CR-02 đã bỏ; CLN-004 chất lạ và TEC-005 tia lửa đi như ticket thường). CR-03 khôi phục; có thể tham khảo `rules.py`/`proposer.py`/`services/safety.py` ở commit `4c2d07f` (cần xác minh còn chạy được).

## Tầng an toàn & tiếng Việt (hồ sơ 01, 2026-10-02)
- **Bỏ dấu làm nhiều từ trùng:** `chay` (cháy/chảy/chạy), `khoi` (khói/khỏi/khối), `lua` (lửa/lựa/lúa/lừa), `ngat` (ngất/ngắt), `ho` (hở/hộ/hồ), `den` (đèn/đến/đen), `no` (nổ/nó), `bong` (bóng/bỏng), `nau` (nấu/nâu). Luật hạ mức/loại match phải xét token CÓ dấu (R7, B-04, hedge) và văn bản KHÔNG dấu phải giữ mức CAO. Đừng đưa `khoi`/`no`/`giat`/`ngat`/`lua`/`mau` trần làm pattern tín hiệu.
- **Cue một chữ cái khớp mã toà/khu** (`k co` ⇒ "Tòa SIM-K có khói" thành NONE): không có cue nào chứa token 1 ký tự (validator chặn). Phủ định chỉ là cue + ≤ 2 đệm sát tín hiệu, trong mệnh đề; KHÔNG lan qua dấu phẩy/"và"/xuống dòng.
- **Sửa từ vựng = chạy bộ dừng** (`test_safety.py`, ngưỡng báo nhầm `b_fp` EM ≤1/UNCLEAR ≤5, `jx_negfp` EM ≤2, `b_fp2` EM ≤3, holdout NONE ≤3/39). Số đo cuối: bộ dừng 1065 ca xanh, holdout NONE 2/39.
- **Công cụ ghi file có thể giải mã `\uXXXX`, `\b`, `\n`** trong chuỗi bạn gửi (đã gặp: `\b` thành ký tự backspace trong regex; ký tự Hangul filler thô lọt vào `safety.py`). Viết mã điểm bằng `ord`/`chr`, regex trong YAML kiểm bằng `grep -cP '[\x08\x0b\x0c]' <file>` (phải 0).
- **YAML 1.1 (PyYAML):** token trần `no`, `yes`, `on`, `off`, `y`, `n` bị đọc thành bool — đặt trong nháy (`"no"`). `lexicon.yaml` sai ⇒ `ValidationError` lúc khởi tạo engine (fail fast, không fallback).
- **`tests/**/data/` bị `.gitignore` chặn (`data/`):** file data test mới phải `git add -f <đường dẫn>`; KHÔNG sửa `.gitignore` (cấu hình chung của nhóm).
- **Hook pre-commit** (`scripts/check_brain_in_commit.sh`): commit có đổi file ngoài `brain4agent/` phải kèm `brain4agent/memory/hot/today.md` (hoặc `state.json`). Chạy trong Git Bash; script Python của `scripts/` chạy bằng Python bất kỳ nên không dùng cú pháp 3.11+.
- **Chỉ ghi nhận mỗi bổ sung <= 5000 ký tự** (`RawTicket.original_description`, `ResidentAddition.content`): quá hạn là `ValidationError` (422), không cắt cụt.
- **Sau `_set_ticket` (priority) biến `ticket` cũ trong op bị thay:** gán lại `ticket = work.ticket` trước khi ghi tiếp (đã sửa ở `bptn_resolve`).
- **Log AI cho BTC không ghi được trên máy Như Ý (2026-10-02):** hook `UserPromptSubmit` và `pre-push` gọi `scripts/_pyrun.sh`, script này thử `python3` trước ⇒ trúng stub Microsoft Store `WindowsApps\python3` ⇒ lỗi im lặng; `.ai-log/` chỉ có `.gitkeep`. Sửa: tắt App execution aliases `python.exe`/`python3.exe` trong Windows Settings, hoặc lấy bản `_pyrun.sh` đã sửa của Trí trên `develop` (`ff2bcdc`, kiểm `check_py` thật). Key `AI_LOG_API_KEY` nằm ở `.env` (bị `.gitignore`), KHÔNG commit. Trang `phoenix.note.transformerlabs.ai/demo-day` cần đăng nhập (`/api/me/*`); máy chưa cài `ego-browser`.
- **ĐÃ SỬA 2026-10-02:** đổi tên `%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe` và `python3.exe` thành `*.disabled` (tương đương tắt App execution aliases) ⇒ `_pyrun.sh` dùng Python313 thật (kiểm: in đúng `Python313\python.exe`, có `dotenv`). Khôi phục: đổi tên lại hoặc bật alias trong Settings. Prompt trước thời điểm này KHÔNG có log (hook chỉ ghi lúc gửi prompt).
- **Merge `develop` (hồ sơ 02, 2026-10-02):** `_deny` gọi trong `op` (vd cổng Q19 của T06/T07 khi BQL gọi `transition` thẳng) KHÔNG được mở transaction lồng (Postgres tự khoá) ⇒ `_deny` ném `_Denied` mang đủ tham số khi `self._local.tx_depth > 0`, `_mutate_locked` ghi từ chối sau rollback. Test store của `develop` dùng `ticket.cancel_reason` làm trường dò (CR-03 ép `assignee_id` chỉ `None`). NEED_INFO an toàn (T06) có `next_retry_at=None`: nhắc mỗi giờ của `bptn` sẽ leo thang sau 3 lần, sớm hơn 12 giờ.
- **`transition(→X)` không `expected_from` sẽ nhận MỌI nguồn có trong bảng (2026-10-03, v1.1.2):** `close` từng đóng được ticket khẩn cấp vì `(VERIFYING, CLOSED)` (T10) chung đích `CLOSED` ⇒ bỏ qua `_safety_precheck`. Method nghiệp vụ có đích dùng chung PHẢI ghim `expected_from`.

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
- **`gh` CLI trên máy Như Ý:** token trong Git Credential Manager (tài khoản `tuanank2112-crypto`) có scope `repo, workflow, gist`, THIẾU `read:org` ⇒ `gh auth login --with-token` và `gh pr edit` (GraphQL) lỗi. Dùng `GH_TOKEN=$(git credential fill ...)` + `gh api` (REST) cho từng lệnh. Agent KHÔNG được merge PR khi CI đỏ (chốt quyền "CI Bypass") ⇒ người bấm merge.
- **CI GitHub Actions fail không do code (2026-10-03):** "job was not started because recent account payments have failed or your spending limit needs to be increased" — mọi run trên `develop` cũng vậy. Kiểm bằng `gh api .../actions/runs/<id>/jobs` (steps rỗng) + annotations.

## curl tiếng Việt trên Git Bash Windows (2026-10-04)
- `curl -d '{"original_description":"...có dấu..."}'` trả 422 `There was an error parsing the body` do mã hoá tham số; truyền qua file `--data-binary @body.json`, PowerShell dùng UTF-8 bytes, hoặc Swagger. Không phải bug API.
