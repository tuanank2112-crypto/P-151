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
