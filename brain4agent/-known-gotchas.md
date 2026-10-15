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

## curl tiếng Việt trên Git Bash Windows (2026-10-04)
- `curl -d '{"original_description":"...có dấu..."}'` trả 422 `There was an error parsing the body` do mã hoá tham số; truyền qua file `--data-binary @body.json`, PowerShell dùng UTF-8 bytes, hoặc Swagger. Không phải bug API.
## Phạm vi tòa thí điểm Ocean Park S1/S2 (2026-10-05)
- Vị trí cư dân chỉ hợp lệ khi tòa nằm trong `catalog.yaml` `site.buildings`; seed/test đã đổi `SIM-A`→`S1`, `SIM-B`→`S2`. Text test qua engine dùng tòa khác (vd `SIM-A`, `S3`) sẽ rơi NEED_INFO thiếu tòa.
- KHÔNG đổi tòa trong bộ nhãn an toàn (`tests/.../data/safety_*_p0.yaml`, `test_safety_p0.py`) và `test_b01_closed_prefix_twenty_tokens_and_lamp_accent`: `assess()` không xét vị trí, còn "tòa SIM-A" = 3 token, "tòa S1" = 2 token ⇒ ca biên 20/21 token của B-01 lệch.

## LLM qua vyceai.com `deepseek-v4.1` quá chậm cho Agent (đo 2026-10-07)
- Gọi ngắn ("trả JSON {ok:true}") OK. Lượt gọi thật của Agent (system ~7.6k + user ~1k ký tự, `max_tokens` 2500, JSON mode) ⇒ 504 Cloudflare sau ~14–17 s (non-stream) hoặc "request timed out" sau ~25 s (stream) ⇒ `FALLBACK_RULE/HTTP_ERROR`, engine chạy luật (an toàn, nhưng KHÔNG có suy luận).
- Thông lượng đo: câu ngắn stream 63 chunk mất 21 s (chunk đầu 4.9 s) ≈ 3 chunk/s ⇒ JSON quyết định 1–2k token cần vài phút. Lỗi tầng 1 (hạ tầng nhà cung cấp), không phải code. Không nâng timeout để "chữa": 504 do proxy cắt.
- Mô hình trần (không system prompt) coi "Thay bóng đèn cháy … giúp với" là EMERGENCY ⇒ hướng dẫn ngữ nghĩa trong `prompt.py` là bắt buộc, đừng đo LLM bằng prompt trần.
- Đã thêm `MO_AGENT_STREAM=true` (mặc định) ở `agent/client.py`: hết 504 Cloudflare, nhưng `deepseek-v4-flash` qua vyceai vẫn tự báo "The request timed out" sau ~28–30 s ở 3/4 câu (lần đo riêng: 17 s, chunk đầu 5.6 s) ⇒ nhà cung cấp chậm/không ổn định. `timeout` của client chặn TỔNG thời gian stream.
- Prompt Agent (`prompt.py` EXAMPLE) chỉ có `"signals": []`, không mô tả object `{signal_id, status, quote}` ⇒ mô hình thật trả `signals` dạng chuỗi ⇒ `SCHEMA_INVALID` ⇒ FALLBACK. Lộ ra CHỈ khi chạy live; mock không thấy.
- `deepseek-v4-flash` là mô hình suy nghĩ ngầm: `completion_tokens` ~1.300–1.600 dù JSON chỉ ~450 token; vyceai KHÔNG chuyển `reasoning_content` và gom nội dung gửi một lần cuối (stream không thật); `extra_body.thinking=disabled` vô tác dụng. `reasoning_effort=low` (`MO_AGENT_REASONING_EFFORT=low`) giảm còn ~800 token ở một lần đo. Sau `agent-prompt/3` + stream + low: 2/4 câu thử AGENT quyết đúng (kêu cứu + cháy ⇒ S-05 PRESENT ⇒ BQL; nhờ thay đèn cháy ⇒ NONE), 2/4 vẫn bị vyceai cắt ~28 s.
- **Antigravity CLI (`agy -p`) làm LLM cho Agent:** LUÔN truyền `--model` (vd `gemini-3.8-flash-low`) — không truyền thì dùng model mặc định có quota nhỏ, báo "Individual quota reached" dù Gemini còn đầy. `agy` không có cờ thay system prompt/tắt tool ⇒ client ghép system prompt vào đầu prompt, chạy thư mục trống + `--sandbox`, không auto-approve; mỗi lượt ~17k token vào (agy tự chèn ~13.8k). Worker chạy Antigravity dùng chung quota.

## ⚠ Kiểm trích dẫn bằng chuỗi con = word-by-word trá hình (2026-10-10, plan 06 Q35)
- Người dùng cấm khớp từ khoá (Q01/Q29/Q30), nhưng WP14 F3 vẫn lọt: `validate._check_location` huỷ CẢ vị trí LLM nếu quote không là chuỗi con (gấp) của câu cư dân ⇒ LLM hiểu đúng mà diễn đạt khác ("chỗ đi bộ trước thang máy" → Hành lang) là kẹt thiếu vị trí; `mirror_decision` chép nguyên `location_text` làm quote chỉ để qua cổng. P09 B1 (giao span) / B2 (quote đủ 3 thành phần) cùng loại. Worker + thẩm định đều "đúng SPEC" vì SPEC (Q28, 05/10) có trước Q29 và không ai rà lại.
- Cách tránh: trước khi giao/duyệt việc đụng đầu ra LLM, hỏi "code đang kiểm NGỮ NGHĨA bằng câu chữ không?". Kiểm hợp lệ bằng danh mục đóng (catalog), quote chỉ audit. Mục dưới (09/10) giữ làm lịch sử, KHÔNG phải hướng dẫn.
- Đã sửa bằng SPEC-P10/WP19. Thẩm định R19 còn bắt được: test cũ KHÔNG đỏ khi cài cổng "quote không chung từ nào với câu cư dân" ⇒ bài học: mỗi lần gỡ một cổng khớp chữ, viết test ĐỎ cho cả biến thể cổng khác tên (token, difflib, ghi chú cảnh báo) chứ không chỉ cổng cũ. `_check_location` còn loại "Toà" (dấu trên a) ≠ "Tòa" — chính tả danh mục, backlog.

## Trích dẫn của Agent: "chỉ dấu câu" = không có trích dẫn (WP14 vòng 2, 2026-10-09 — cổng này bị đình chỉ theo Q35)
- `agent/validate.grounded` gấp quote (bỏ dấu, dấu câu thành khoảng trắng) rồi kiểm chuỗi con. Quote `".."`/`"--"` qua được schema (`Quote` min_length=2) nhưng gấp ra `""` — chuỗi rỗng là con của mọi văn bản ⇒ trước đây vị trí/việc bịa được coi là có trích dẫn. Nay `grounded` trả False khi quote gấp ra rỗng (cùng luật `safety._grounded`). Viết kiểm "có trích dẫn" mới thì kiểm SAU khi gấp, đừng kiểm chuỗi thô.
- Test "đường Agent" dùng `MirrorClient` không chứng minh nhánh Agent: Mirror quyết y như luật, nên thay đường 2b bằng luật thuần vẫn xanh. Muốn bắt nhánh Agent phải có client giả nêu tín hiệu mà luật KHÔNG thấy (vd `SeesDanger` trong `test_p1_audit_fixes_safety.py`).
- Git Bash trên máy này: `/tmp_x` = `D:\Git\tmp_x` (root của Git Bash), không phải thư mục tạm — ghi file tạm vào scratchpad.


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
- **Sửa `portal/src/db/schema.ts` thì PHẢI `npx drizzle-kit generate --name <tên>`** và commit file `drizzle/00NN_*.sql` + `meta/`. `drizzle-kit push` chỉ sửa DB trên máy mình ⇒ người khác `db:migrate` thiếu bảng/enum (gặp 2026-10-08: role `warehouse`). Kiểm nhanh: `drizzle-kit generate` trên nhánh sạch phải báo "No schema changes".
- `docker-compose.yml` cố định `name: p151` ⇒ worktree khác chạy `docker compose up` sẽ DÙNG CHUNG volume DB với repo chính. Cô lập bằng `docker compose -p <tên-khác>` + `POSTGRES_PORT` khác.
- **Supabase: tài khoản dashboard ≠ tài khoản DB.** Được thêm vào team supabase.com chỉ cho vào dashboard; script/app cần mật khẩu Postgres của project (Supabase KHÔNG hiện lại, chỉ người tạo biết; Reset làm đứt backend Render + máy cả nhóm). Không có mật khẩu ⇒ chạy SQL qua dashboard **SQL Editor** (chạy quyền `postgres`), agent soạn sẵn truy vấn. Qua Session pooler user có dạng `postgres.<project-ref>`, cổng 5432, DB `postgres`.
- Chuỗi kết nối Supabase để ở `portal/.env.supabase` (gitignore `.env*`), KHÔNG để vào `.env.local`: `next dev` tự nạp lại `.env.local` khi đổi ⇒ UI local bấm thử là ghi thẳng DB chung. Kiểm DB chung luôn kèm `PGOPTIONS="-c default_transaction_read_only=on"`.
- Cookie `secure` bật ở production làm đăng nhập lặp vòng khi mở bằng HTTP qua IP LAN; compose đặt `SESSION_COOKIE_SECURE=false`.
- **(2026-10-09, plan 13) Web `src/web/` ẩn ticket mẫu (`isSeedTicket`) ở mọi danh sách và tự bỏ `state.selected` không có trong danh sách** ⇒ harness UI phải tạo ticket THẬT (vd câu của fixture `SIM-TKT-TEC-002` ra `ASSET_UNCLEAR`), không chọn được fixture bằng `select(id)`.
- **(2026-10-09) Đáy độ trễ GET trên Supabase ≈ 50 ms = một câu SQL** (sau plan 12). Ảnh xem lại (56 ms) đã chỉ còn `repo.get` để kiểm quyền; muốn thấp hơn phải bỏ vòng DB đó = quyết định bảo mật, không phải tối ưu thường.
- **(2026-10-09) Cache trình duyệt KHÔNG kiểm quyền:** ảnh trả `Cache-Control: private, max-age=…` (không `Vary`) ⇒ cùng profile trình duyệt, tài khoản khác `fetch` cùng URL nhận ảnh từ cache, server không thấy request (R01 plan 12 #2). Header cache của tài nguyên có kiểm quyền = quyết định bảo mật.
- **(2026-10-09) `test_safety.py::test_assess_is_linear_*` đo thời gian, đỏ khi máy tải** (cả bộ chạy 332 s thay vì ~110 s). Chạy riêng + chạy lại cả bộ trước khi kết luận hồi quy; không đo khi auditor/trình duyệt test đang chạy.


## Docker build context tr?n Windows (2026-10-10)
- `docker compose up -d --build backend` c? th? d?ng ? `load build context` v?i `Access is denied` khi root repo ch?a worktree `integration/maintenanceops/.pytest_cache`. Khi build th?t b?i, backend ch?a ???c t?o n?n `/health` kh?ng k?t n?i v? `compose logs backend` tr?ng.
- `.dockerignore` ph?i lo?i `integration/`, `.worktrees/`, `.python/`, `.uv-cache/`, th? m?c c?ng c? agent v? cache l?ng nhau. Kh?ng s?a ACL hay xo? worktree ?? x? l? l?i n?y. Backend c?n `src/`, `seed/`, `requirements.txt`; portal c? build context ri?ng `./portal`.
- B?n s?a ?? ki?m tra t?nh; ch?a x?c nh?n Docker build th?nh c?ng tr?n m?y ng??i d?ng.


## Area assets and emergency downgrade test (2026-10-10)
- After plan 14 area-based asset lookup, TEC-005 can route after BQL clears the emergency, leaving blocker=None. API consumers/tests must accept no blocker; do not subscript it unconditionally. Before fix: 1 failed / 3382 passed; focused suite after fix: 40 passed. No production logic change.


## Plan 15 verification gaps (2026-10-10)
- material-plan + each materials/{code} is a sequence of independent transactions; a later stock failure does not revert the plan/refunds already committed. Test whole save sequences, not only failing record_material.
- Current API permits fractional material quantities, cross-department items, and technical empty lists; browser-only guards do not enforce these business requirements. Full tests 3387 green do not cover rejecting these cases. Web materialPlanCard still pre-fills Agent plan and has a separate save flow.

## Plan 16 vật tư guard (2026-10-10)
- **Body JSON có `NaN`/`Infinity` làm 422 thành 500:** `json.loads` của Starlette nhận `NaN`, pydantic báo lỗi kèm `input=nan`, handler 422 mặc định của FastAPI không encode được ⇒ 500. Đã sửa một chỗ ở `src/main.py` (`_validation_error_handler`: bỏ `input`/`ctx` chỉ khi không encode được). Test gửi NaN phải dùng `content=json.dumps(...)`: `TestClient(json=...)` từ chối NaN trước khi gửi.
- **psycopg2 bị Windows Application Control chặn trên host** (`DLL load failed … Application Control policy`) ⇒ `pytest --pg` chạy trong image: `docker run --rm --network p151_default -v C:/P-151:/app -w /app -e MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@db:5432/p151_test p151-backend python -m pytest tests --pg` (Git Bash cần `MSYS_NO_PATHCONV=1`). DB `p151_test` phải tạo trước trong `p151-db-1`.
- **Harness web `/ui/`: `select(id)` không đồng bộ** — `#detail-pane` vẽ ticket đầu hàng đợi trước; chờ theo nội dung riêng của ticket (mô tả có RUN), không chỉ chờ selector, kẻo đo nhầm ticket khác.
- **`shutil.rmtree` thư mục snapshot trong scratchpad có thể `WinError 5`** — tạo snapshot vào thư mục mới mỗi lần.
- Đổi luật vật tư ⇒ guard nằm ở `material_policy.py` (API + engine + `_reconcile`); client CHỈ lọc theo `catalog.material_codes_by_department`, CẤM map vật tư trong JS.
- **`p151_test` dùng chung giữa các agent/phiên:** fixture `pg_repo` TRUNCATE bảng ⇒ hai đợt `--pg` song song làm nhau `NotFoundError`. Chạy tuần tự (hoặc mỗi đợt một DB `*_test` riêng).

## Plan18 — BFF/UI Python (2026-10-10)
- Không chuyển nguyên Case vào browser phòng ban: Python internal response có resident_id/audit. Dùng allowlist case-view cho cả detail, mutation, upload và Case lỗi complete.
- CompleteHTTP200 có thể vẫn IN_PROGRESS; phải đọc status/failing_items, không toast hoàn tất giả.
- BQL safety VERIFYING cần escalated=true; NEED_INFO+safety_context chỉ CONFIRM_SAFE/ESCALATE. Owner BPTN có thể vẫn giữ sau escalation; không suy quyền chỉ từ owner.
- Form đăng nhập không đặt interactive LoginForm trong Suspense fallback: backend demo-data stream có thể thay form và làm mất input trước click. Fallback loading tĩnh.
- Windows PowerShell dùng npm.cmd; script stdin chứa tiếng Việt cần OutputEncoding UTF8. Playwright controlled checklist phải click rồi đợi server xác nhận checked, không dùng check() kỳ vọng synchronous.
- Không build ghi đè .next trong lúc đo server production đang chạy; stop/rebuild/restart trước browser. Fixtures memory dùng kho hữu hạn; harness reset chỉ tại loopback8018 memory riêng, cấm chuyển đến DB chung.

- Plan18: emergency_close Python bắt buộc note; UI không được ghi tùy chọn. Cleaning blankTRACKED khác N_A: phải lưu xác nhận không sử dụng trước khi nút giữ trạng thái đã lưu. Browser4/4+6/6, reviewer11/11+6/6.
### Stash + Windows live logs and line endings — 2026-10-07T13:30:26.152115+00:00
Stash push -u may save successfully but exit1 without cleaning tracked files when open log files prevent removal. Check backup/state before merge. Keep stash, restore only verified tracked changes; never delete active logs. Git normalization can alter mixed LF/CRLF in untracked machine evidence; preserve/recover exact bytes only when original manifest hash matches. Conflict marker regex must use [^\n]* for marker lines: .* with DOTALL can consume trailing document/test content. Final preservation/test evidence is under plan06 integration-latest-20261007.

## `.gitignore` `data/` nuốt thư mục mã tên `data` (hồ sơ 11, 2026-10-09)
- Dòng `data/` (cho dữ liệu lớn ở root) khớp MỌI thư mục tên `data` ⇒ `portal/src/server/data/` (mã nguồn) bị bỏ qua âm thầm, commit thiếu file mà typecheck local vẫn xanh. Đã thêm `!portal/src/server/data/`. Tạo thư mục mã tên `data` ở chỗ khác ⇒ kiểm `git check-ignore -v <file>`. `tests/test_maintenance/data/` thì đã `git add -f`.
- **Portal sau proxy backend (cổng 8000) phải chạy production.** `next dev` cần WebSocket HMR (`/_next/hmr`); route bắt-tất của FastAPI chỉ chuyển HTTP ⇒ uvicorn trả 403 cho WebSocket ⇒ trang KHÔNG hydrate, bấm nút không gửi gì (đăng nhập "đứng"). Dev thì mở thẳng `localhost:3000`; demo qua 8000 thì `next build && next start`. `127.0.0.1:3000` cũng không hydrate ở dev (chặn cross-origin dev, cần `allowedDevOrigins`).
- **Supabase qua Session pooler (hồ sơ 11, 2026-10-10):** (1) `DATABASE_URL=postgresql://…` làm SQLAlchemy bản trong venv đòi driver `psycopg` (v3, không cài) ⇒ backend exit 3 lúc khởi động; dùng `postgresql+psycopg2://…?sslmode=require`. (2) `options=-c default_transaction_read_only=on` KHÔNG áp qua pooler (`show transaction_read_only` = off) ⇒ "kiểm chỉ đọc" phải tự giữ bằng chỉ chạy SELECT. (3) Mật khẩu DB ≠ mật khẩu dashboard; sai 2 lần thì dừng (pooler có thể chặn IP). Chạy backend trên Supabase từ worktree: `uvicorn … --env-file /d/P151/.env` (biến shell thắng file).

## Gộp develop (2026-10-11)
- `MO_PORTAL_EXTRAS` BẬT mặc định ở store memory ⇒ luồng yêu cầu/duyệt vật tư của develop tự chạy và đè quyết định "ghi số đã dùng". Đã chặn bằng `_material_approval_required()` = False; đừng bật lại khi chưa có hồ sơ mới.
- `pytest` từ root thu nhặt cả `integration/*/tests` (worktree cũ) ⇒ `ImportPathMismatchError`; chạy `python -m pytest tests`.
- `.next/` cũ còn tham chiếu route đã xoá ⇒ typecheck lỗi giả; xoá `portal/.next` rồi chạy lại.
- Mã tòa con (S2.05, S1.12): validator `_check_location` chấp nhận `S2(.\d{1,2})?`, NHƯNG prompt LLM từng bảo "tòa ngoài danh sách = thiếu tòa" ⇒ LLM tự chuyển BPTN với lý do do chính nó viết (không có chuỗi này trong code). Đổi chữ prompt ⇒ tăng `PROMPT_VERSION` + sửa REF plan 06 trước.
- Portal "Khẩn cấp" = `risk_level EMERGENCY` thôi; `priority HIGH` là ticket thường (đèn không sáng hành lang vẫn HIGH).
- Khu vực "Thang máy": mẫu `AREA_PATTERNS` chỉ khớp văn bản có `trong|buồng|cabin|lòng` (mốc "trước/cạnh thang máy" KHÔNG phải cabin) nên `location_area` phải nhận NGAY nhãn chuẩn "Thang máy" (nếu không tài sản đèn không bao giờ khớp). Tầng cabin = `—`. Mẫu cabin phải có ở CẢ `AREA_PATTERNS` và `COMMON_AREA_PATTERNS`.
- Form portal có mục vị trí mà danh mục không biết ⇒ LLM kết luận OUT_OF_SCOPE ⇒ develop Q14 đẩy thẳng sang "Việc của BQL" (`blocker.escalated`, người thực hiện `SIM-ACTOR-AGENT`). Rà `PLACE_DEFS` của portal với `AREA_PATTERNS` khi thêm lựa chọn.
- **Proxy cổng 8000 (`src/main.py`) dùng chung MỘT httpx client:** client này KHÔNG được giữ cookie (đã chặn bằng `DefaultCookiePolicy(allowed_domains=[])` trên `client.cookies.jar`). `httpx.AsyncClient(cookies=…)` SAO CHÉP cookie sang kho mới nên chính sách truyền qua tham số bị mất — phải `set_policy` trên kho của client. Dấu hiệu lỗi: trình duyệt mới vào thẳng màn của người đăng nhập trước.
- Portal: `parseDescription` trả `"—"` khi không có vị trí; UI mới dùng `hasLocation()` để không hiện dấu gạch lẻ. CSS bảng chỉ khai theo màn (`.scr-reception/.scr-management/.scr-warehouse`): màn mới dùng `<table>` phải thêm selector.
- `scripts/ui-check-WP5.mts` (develop) dò `tile-all`, `bql-work article` theo bố cục cũ ⇒ cần cập nhật theo hồ sơ 19 trước khi dùng lại.

## Vercel chặn deploy CLI vì tác giả commit (2026-10-15)
- `vercel deploy` từ thư mục có `.git` gửi kèm metadata git; tác giả commit (`tuanank2112@…`, LeNhuY) không thuộc tài khoản Hobby `lenq2112-4310` ⇒ bản deploy `● Blocked` ("commit author doesn't have permission"), lệnh CLI treo không báo lỗi.
- Cách làm: `git archive HEAD | tar -x -C <thư mục tạm>` (backend: bỏ portal/planning/docs/tests/brain4agent; portal: `git archive HEAD:portal`), `vercel link --yes --project <tên>` trong thư mục tạm, rồi `vercel deploy --prod --yes`. Luôn `VERCEL_TOKEN` + `--global-config <scratch>`.
- `vercel link` ở root repo sinh `.vercel/`, `.env.local` (chứa `VERCEL_OIDC_TOKEN`) và sửa `.gitignore` ⇒ xoá/khôi phục ngay. Backend production có `MO_STOCK_ALERTS=true` từ 2026-10-15 (Supabase đã ở revision 0006).
- **Phiên đăng nhập trên Vercel (2026-10-15, hồ sơ 26):** phiên giữ trong RAM ⇒ mỗi instance serverless một bộ nhớ ⇒ 401 ngẫu nhiên ngay sau đăng nhập. Đã đổi sang token ký HMAC; backend production BẮT BUỘC có env `AUTH_TOKEN_SECRET` (thiếu ⇒ khoá ngẫu nhiên mỗi instance ⇒ lỗi cũ quay lại). 503 thoáng qua = `StoreUnavailableError` (Supabase không tới được), portal hiện "Máy chủ trả lỗi 503".
- **Supabase Session pooler tối đa 15 client (2026-10-15):** instance Vercel giữ pool khi rảnh ⇒ `EMAXCONNSESSION` ⇒ backend 503 (`StoreUnavailableError`) / 500 lúc khởi động. Production đặt `MO_DB_POOL=none` (NullPool). Máy local nối Supabase chung cũng chiếm slot — tắt khi không dùng.
