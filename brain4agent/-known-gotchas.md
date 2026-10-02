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
