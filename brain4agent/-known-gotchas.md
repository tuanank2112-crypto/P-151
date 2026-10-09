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
- **Heredoc bash + Python làm hỏng backslash (2026-10-04, plan 04):** script Python viết qua heredoc trong Bash tool có thể biến `\b` thành ký tự backspace trong file đích (regex hỏng âm thầm). Sửa regex/YAML bằng công cụ Edit/Write, rồi kiểm `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- **Ngoài phạm vi vẫn là 403 + audit, không phải 404 (2026-10-04, plan 04 A1):** 8 test đã duyệt khoá hành vi này. Đừng để lỗi lộ trạng thái: `_deny` bỏ `unchanged_status` khi `_scope_error`; `_transition` từ chối người ngoài phạm vi TRƯỚC 409 (409 nêu trạng thái hiện tại).
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
- **Supabase dùng chung + nhánh tụt revision ⇒ :8000 "mất UI" (2026-10-08):** schema `maintops` đã lên `0002_p1_doc_shape`
  (plan 06), nhánh chưa merge `develop` chỉ biết `0001` ⇒ `repo.check()` fail-fast, uvicorn thoát, cổng 8000 trống.
  Sửa = merge `develop` (hoặc `MO_STORE=mock` tạm). CẤM `alembic downgrade` DB chung — gãy các nhánh đã ở 0002.
- **SQLAlchemy 2.1 đổi driver mặc định của `postgresql://` sang `psycopg` (v3) (2026-10-08):** image Docker build mới kéo 2.1.4
  ⇒ `ModuleNotFoundError: psycopg`, `p151-backend-1` restart vòng (exit 3) trong khi `.venv` (2.0.x) vẫn chạy. Ghim
  `sqlalchemy<2.1` trong `requirements.txt`. Ghim chỉ có trên nhánh đã sửa: dựng image từ nhánh cũ (vd `dev` 2026-10-09) vẫn crash ⇒ `git diff <nhánh> -- requirements.txt` trước khi `docker compose build`. Model OpenAI đời mới (vd `gpt-6-luna`) từ chối `max_tokens` và `temperature≠1`.
- `maintops.cases` có CHECK `cases_doc_matches`: `doc.ticket.status`/`department_id` phải khớp cột ⇒ test muốn làm hỏng doc phải đổi trường KHÁC (vd thêm field lạ), không đổi status.
- `PostgresRepository.list()` (plan 09) trả object dùng chung từ cache theo `xmin` ⇒ sửa trực tiếp Case lấy từ `list()`/`engine.cases` làm bẩn cache của mọi request sau; luôn sửa qua `_mutate`/`transaction`.
- UI `src/web/`: mọi màn tự chọn ticket đầu khi `state.selected` rỗng ⇒ "trang đang xem" bị ghi đè bởi trang của ticket đang chọn sau mỗi `render()`; test UI muốn thấy khác biệt phải lật trang SAU khi chọn. Harness Playwright đăng nhập bằng `page.goto` = tải lại trang = xoá mọi state JS — thử luồng đăng xuất/đăng nhập thật phải điền form tại chỗ.
- Qua Supabase pooler, `pg_stat_ssl.ssl` = false (chặng pooler→DB); TLS client kiểm bằng `connection.info.ssl_in_use`.
- **Supabase dùng chung + model `extra="forbid"` ⇒ 500 mọi màn danh sách (2026-10-07):** chỉ cần MỘT doc do bản code khác ghi
  có field lạ là `repo.list()` vỡ `ValidationError` ⇒ `/resident/tickets`, `/mo/tickets`… đều 500 ("Không tải được dữ liệu · Lỗi 500").
  Lần này: 16/53 ticket có `ticket.merged_children` (CR-03 §8; PR #11 đã revert khỏi `main` 04/10 nhưng bản chạy 05/10 vẫn ghi).
  Sửa bằng cách thêm field ĐÚNG SPEC vào model (giữ dữ liệu), KHÔNG xoá field trên DB, KHÔNG nới `extra`. Dò nhanh: validate từng
  `doc` trong `maintops.cases` bằng `Case.model_validate` (chỉ đọc). Server không `--reload` phải khởi động lại mới ăn code.
- Docker backend dùng nguyên `DATABASE_URL` của `.env` (Supabase) từ 2026-10-02; service `db` chỉ cho `pytest --pg`. Schema thiếu ⇒ container exit 3 và restart lặp.

## Evidence và pytest (2026-10-03)
- Pytest mặc định có thể collect `test*.txt` như doctest, kể cả output trong planning/evidence; output PowerShell UTF-16 làm collection lỗi UnicodeDecodeError. Đặt tên evidence không bắt đầu `test` (vd `scope-stat.txt`), không sửa tay nội dung output máy.
- Fixture `engine` (tests/test_maintenance/conftest.py) dùng đồng hồ THẬT: test nào chạy lại pipeline tới bước 8 sẽ đỏ sau 22:00 (OUT_OF_HOURS) dù code đúng. Test cần giờ hành chính phải đặt `engine.clock = Clock(MONDAY_9AM)` hoặc dùng fixture `fresh` (2026-10-05, `test_partial_delivery_…`).
- PowerShell pipe sang Python cần `$OutputEncoding` UTF-8 và `PYTHONIOENCODING=utf-8` để giữ tiếng Việt của input/output; tránh gold case bị biến thành dấu hỏi.

## Day03 đo local (2026-10-03)
- Docstring API nhập kho (`maintenance.py:550`) ghi resume bước 7 nhưng code engine dùng bước 6: tin code, không tin docstring.
- Timestamp quyết định BPTN dùng đồng hồ máy, không phải giờ mô phỏng (`engine.at()`): không so sánh với mốc mô phỏng.
- `.env` máy owner có thể trỏ `MO_STORE=postgres`: mọi lần đo local phải ép env `MO_STORE=memory`, mock/local và `MO_JOBS_ENABLED=false`.
- Harness tái hiện Day03: `planning/02_2026-10-03_truong-mvp-prep/evidence/d3-06/harness.py`, chạy với `PYTHONPATH` = repo root.
- **`gh` CLI trên máy Như Ý:** token trong Git Credential Manager (tài khoản `tuanank2112-crypto`) có scope `repo, workflow, gist`, THIẾU `read:org` ⇒ `gh auth login --with-token` và `gh pr edit` (GraphQL) lỗi. Dùng `GH_TOKEN=$(git credential fill ...)` + `gh api` (REST) cho từng lệnh. Agent KHÔNG được merge PR khi CI đỏ (chốt quyền "CI Bypass") ⇒ người bấm merge.
- **CI GitHub Actions fail không do code (2026-10-03):** "job was not started because recent account payments have failed or your spending limit needs to be increased" — mọi run trên `develop` cũng vậy. Kiểm bằng `gh api .../actions/runs/<id>/jobs` (steps rỗng) + annotations.

## Phạm vi tòa thí điểm Ocean Park S1/S2 (2026-10-05)
- Vị trí cư dân chỉ hợp lệ khi tòa nằm trong `catalog.yaml` `site.buildings`; seed/test đã đổi `SIM-A`→`S1`, `SIM-B`→`S2`. Text test qua engine dùng tòa khác (vd `SIM-A`, `S3`) sẽ rơi NEED_INFO thiếu tòa.
- KHÔNG đổi tòa trong bộ nhãn an toàn (`tests/.../data/safety_*_p0.yaml`, `test_safety_p0.py`) và `test_b01_closed_prefix_twenty_tokens_and_lamp_accent`: `assess()` không xét vị trí, còn "tòa SIM-A" = 3 token, "tòa S1" = 2 token ⇒ ca biên 20/21 token của B-01 lệch.

## UI tĩnh `src/web/` + Tailwind Play CDN (plan 07, 2026-10-07)
- **Plugin `forms` của CDN đè class tự viết:** CDN chèn `<style>` SAU `theme.css`; selector `[type='text']`, `select` (0,1,1) thắng `.field` (0,1,0) ⇒ ô nhập mất nền/viền/bo góc. Viết `html body .field` (0,1,2). Áp cho mọi class tự viết đụng thuộc tính mà plugin `forms` đặt.
- **Đo UI không được làm trên `:8000`:** container `backend` đọc `.env` = Supabase dùng chung; bấm thử ghi thẳng vào DB nhóm. Chạy `MO_STORE=memory MO_PHOTO_STORE=local LLM_MODE=mock DATABASE_URL= python -m uvicorn src.main:app --port 8001` (biến môi trường thắng `.env`). Store memory KHÔNG có ticket cư dân (seed CLN/TEC bị UI lọc) — tạo ticket qua API trước khi chụp.
- **Playwright `text=Nhận việc` khớp chuỗi con, không phân biệt hoa thường** ⇒ trúng ô thống kê "Chờ nhận việc". Dùng `getByRole('button', { name, exact: true })`. Bấm item danh sách gây render lại ⇒ chờ `networkidle` trước khi `fill`, nếu không giá trị bị xoá.
- **`test_assess_is_linear_on_adversarial_24kb_texts` và `test_assess_is_linear_on_a_24kb_text` (ngưỡng 1 giây, đo thật ~0,6 giây) đỏ khi máy bận** (cả ngay sau checkout/merge nhiều file) (uvicorn + Playwright chạy song song); riêng lẻ ~2,6 giây cho 6 văn bản. Đỏ đơn lẻ ⇒ chạy lại khi máy rảnh trước khi kết luận.

## Độ trễ backend (plan 12, 2026-10-09)
- **`rotate_memory.js` (hub) xoay NGƯỢC trên `today.md` của repo này** (2026-10-09): file xếp phiên cũ ở đầu, mới ở cuối; script giữ 3 phiên ĐẦU (2026-09-30/10-01) và chuyển phiên mới nhất, kể cả hôm nay, sang `archive/`. Đã hoàn tác (xoá 5 archive vừa tạo, dựng lại `today.md`). CHƯA chạy lại script cho tới khi hub sửa thứ tự hoặc `today.md` đổi sang mới-trước; `BRN-028` (208 dòng) tạm để cảnh báo.
- **`engine.connect()` (SQLAlchemy + psycopg2) = 4 vòng mạng**: pre-ping `SELECT 1`, `BEGIN` (psycopg2 gửi riêng), query, `ROLLBACK` khi trả kết nối ⇒ ~230 ms tới Supabase dù query 55 ms. Đổi AUTOCOMMIT theo TỪNG kết nối (`execution_options`) KHÔNG đỡ (vẫn 236 ms, psycopg2 gửi lệnh đặt chế độ) ⇒ phải đặt `isolation_level` ở mức engine (`sql_read_engine`).
- **`async def` route + I/O đồng bộ = đứng cả server**: httpx đồng bộ, engine/DB, `time.sleep` trong thân `async def` chặn event loop (đo 1,0 s khi Storage chậm 1 s). Route async chỉ được `await`; việc chặn ⇒ `run_in_threadpool`. Test `test_p1_*` đo khoảng đứng lâu nhất của event loop bằng một ticker 10 ms.
- **Đo độ trễ từ Windows host bằng Python `urllib` cộng ~180 ms mỗi lần gọi** (curl và đo trong container không bị) ⇒ đo bằng `evidence/harness/probe_http.py` chạy TRONG container (`MSYS_NO_PATHCONV=1 docker exec -i -w /app …`).
- `docker exec -w /app` từ Git Bash bị đổi đường dẫn (`Cwd must be an absolute path`) ⇒ thêm `MSYS_NO_PATHCONV=1`; heredoc vào container cần `docker exec -i`.

## App điện thoại `src/mobile/` (PWA, plan 11, 2026-10-09)
- **`node.replaceChildren(a, null, b)` của DOM in `null` thành chữ "null"** (khác helper `el()` bỏ qua null). Ảnh lượt đầu lộ "null" ở thanh tiêu đề BQL và "nullnull" ở chi tiết cư dân, test vẫn xanh. Dùng `fill(node, …)` trong `js/ui.js`; harness quét chữ `null/undefined/NaN` mỗi lần chụp (phép phá `d-null-text`).
- **Specifier import ES module phải giống hệt nhau:** `./api.js` và `./api.js?v=1` là HAI module khác nhau ⇒ hai biến token, handler 401 không gắn. Mọi file dùng cùng `?v=N`; đổi vỏ app ⇒ tăng N ở `index.html`, mọi `import`, danh sách `SHELL` trong `sw.js` và `SHELL_CACHE`.
- **Cư dân chỉ có `ADD_INFO` khi `NEED_INFO`**, nhưng gửi ảnh được ở mọi trạng thái chưa kết thúc (`engine.add_resident_photo` chỉ chặn TERMINAL). Đừng gắn nút "Thêm ảnh" vào `ADD_INFO`. Ticket test có tòa/tầng rõ đi thẳng `ROUTED`; muốn `NEED_INFO` thì bỏ tòa/khu vực.
- **`bptn_resolve` bắt buộc `note` khi BPTN chọn/sửa giá trị** (vị trí, info, loại việc, phòng ban, tài sản, `asset_onsite`) ⇒ `409 GUARD_FAILED`. Form web `bptnForm` (`src/web/app.js`) ghi ô ghi chú "không bắt buộc" ⇒ web cũng dính (chưa sửa, ngoài phạm vi plan 11); app bắt buộc lý do trước khi gửi.
- **`evidence_requirements[].validation_status` chỉ đổi khi Agent đối soát (`report_complete`)**, không đổi ngay sau `POST …/evidence` ⇒ đừng dùng nó để xác nhận "đã lưu ghi chú".
- **NavTiles kéo lên `-80px` đè header nên `#tabbar` PHẢI đứng trước `#screen` trong `index.html`** (đợt 2): đặt sau thì menu nằm cuối trang, đè lên thẻ cuối — harness vẫn 26/26 xanh, chỉ ảnh chụp lộ ra.
- **Harness Playwright:** `text=Trả làm lại` trúng nhãn "Lý do trả làm lại" ⇒ dùng `button:has-text(...)`; toast cố định che nút ⇒ toast `pointer-events: none`; `setOffline(false)` bắn sự kiện `online` TRƯỚC khi promise trả về ⇒ lấy mốc thời gian trước khi bật mạng. `mutate.py` trên Windows cần đường dẫn Python tuyệt đối (CreateProcess không giải `.venv/Scripts/…` tương đối).

## Cổng phản ánh cư dân `portal/` (Next.js, 2026-10-07)
- **Next 16.4 khác kiến thức cũ:** `create-next-app` bật `cacheComponents` + `partialPrefetching`; đọc `cookies()`/DB ngoài `<Suspense>` là lỗi build. Mọi page đọc session đặt trong `<Suspense fallback={<DashboardSkeleton/>}>`. Tài liệu đúng bản nằm ở `portal/node_modules/next/dist/docs/`. `portal/AGENTS.md` do `next dev` tự sinh lại — giữ, không coi là luật dự án (luật ở `AGENTS.md` gốc).
- `RouteContext`/`LayoutProps` là kiểu Next sinh ra: chạy `next typegen` trước `tsc` (script `typecheck` đã gộp).
- So khớp từ khóa tiếng Việt bằng chuỗi con (như `indexOf` của thiết kế) sai: "ồn" khớp "cộng đ**ồn**g", "ống" khớp "ch**ống**". `hasWord()` dùng ranh giới `\p{L}\p{N}` (cờ `u`).
- Ảnh/nội dung theo phiên đừng trả `Cache-Control: private, max-age=…`: trình duyệt dùng chung phát lại cho người đăng nhập sau (E2E bắt được: kỹ thuật thấy ảnh ticket vệ sinh). Dùng `private, no-store`.
- `server-only` ném lỗi ngoài điều kiện react-server ⇒ Vitest alias sang `tests/server-only-stub.ts`; script `tsx` có top-level await phải là `.mts`.
- Git Bash trên Windows: tên file có `:` (vd `test:db.txt`) thành ký tự lạ/ADS — đặt `test-db.txt`.
- Test đồng thời bằng `Promise.all` hai action KHÔNG tạo tranh chấp (giao dịch đầu xong trước) ⇒ phép phá bỏ `FOR UPDATE` vẫn xanh. Test tất định: giữ khoá dòng từ một kết nối khác, đổi stage, rồi commit (`tests/db/workflow.test.ts`).
- Ô `<select>` rộng theo option dài làm trang tràn ngang ở 390px; `npm run screenshots` nay fail khi `scrollWidth > viewport`.
- `docker compose up -d --build` trước 2026-10-07 chỉ dựng `db` + `backend` (Python) ⇒ `localhost:8000` vẫn là UI cũ (đăng nhập màu cam), không phải portal. Nay có service `portal` ở `localhost:3000`. Mạng Docker Desktop chập chờn ("no such host" khi kéo `node:24-alpine") ⇒ `docker pull` lại vài lần.
- Cookie `secure` bật ở production làm đăng nhập lặp vòng khi mở bằng HTTP qua IP LAN; compose đặt `SESSION_COOKIE_SECURE=false`.
