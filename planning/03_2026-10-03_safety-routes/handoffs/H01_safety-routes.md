Bạn là worker của repo này. Loại: THI CÔNG (route API mỏng bọc method engine).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: `planning/02_2026-10-03_truong-mvp-prep/deliverables/handoff-noy-safety-routes.md` (**văn bản bàn giao gốc của Trường — hợp đồng chính, làm đủ mục 1–4 của nó**) → `planning/03_2026-10-03_safety-routes/plan.md` §2 (Q01 tên route, Q02 luật bọc, Q03 không làm) → `docs/CR-BPTN-03.md` §6.4, §6.5 → `planning/02_2026-10-03_truong-mvp-prep/specs/OPERATIONS.md` §5 → `docs/maintenance.md` → `src/api/routers/maintenance.py` (cách khai báo route, `_call`/xử lý lỗi, `ActorDep`/`EngineDep` sẵn có) → `src/maintenance/engine.py` (chữ ký `safety_confirm_safe`, `safety_request_info`, `safety_escalate`, `emergency_close`, `emergency_downgrade`) → `src/web/app.js` dòng ~904–925 và ~1236–1255 (body UI gửi).

## 1. Bối cảnh
Engine (develop) đã có 5 method; UI (PR #8) đã gọi `/mo/tickets/{id}/safety` và `/bql/tickets/{id}/emergency/{close,downgrade}`; router chưa có route ⇒ DEMO-04 của Trường BLOCKED. Nhánh `feature/nhuy-safety-routes`. Base = `git rev-parse HEAD` lúc bắt đầu.

## 2. Phạm vi
- ĐƯỢC: `src/api/routers/maintenance.py` (route + body model), test API (`tests/test_maintenance/test_api.py` hoặc file mới `tests/test_maintenance/test_api_safety.py`), `docs/maintenance.md` (bảng route), `planning/02_2026-10-03_truong-mvp-prep/specs/01-CONTRACTS.md` CHỈ thêm dòng route (handoff Trường §3 yêu cầu ghi vào CONTRACTS), `planning/03_2026-10-03_safety-routes/{evidence/*.txt, reports/R01_safety-routes.md}`, đúng một dòng `brain4agent/memory/hot/today.md`.
- CẤM: sửa `src/maintenance/` (engine, safety, models…), `src/web/`, seed; thêm logic an toàn hay kiểm vai ở router; skip/xfail; push; `--no-verify`; LLM thật.

## 3. Việc phải làm
Route theo Q01, bọc theo Q02. Test API (qua `TestClient` với đăng nhập/actor như test API hiện có) phủ ĐỦ mục 1–4 handoff Trường: BPTN 3 lựa chọn (200 + trạng thái đúng; thiếu note ⇒ 409/422 và không clear; vai khác ⇒ 403 + audit, trạng thái không đổi), BQL đóng/hạ (BQL ⇒ CLOSED/EMERGENCY_HANDLED hoặc clearance có người + thời điểm; BPTN/phòng ban ⇒ 403), BQL dùng `/safety` trước leo thang ⇒ 403 (Q19 hồ sơ 01), bổ sung cư dân khi NEED_INFO an toàn có hazard ⇒ vẫn `VERIFYING`/`EMERGENCY_PENDING_BQL`, `resume` + `jobs/run` trên khẩn cấp chưa xử lý giữ nguyên, `decision` lạ ⇒ 422; OpenAPI có 3 path mới.
Xong khi (venv `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\venv311\Scripts\python.exe`; cài thêm dependency mới của develop nếu thiếu):
1. `DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 LLM_MODE=mock PYTHONUTF8=1 python -m pytest -q -p no:cacheprovider` → exit 0; tổng ≥ nền develop (đo trước khi sửa, ghi số) + số test mới; 0 skip mới.
2. `python -m ruff check src tests` exit 0; `python -m ruff format --check src tests` exit 0.
3. `python -c "from src.main import app; ..."` (hoặc GET `/openapi.json` qua TestClient) in đúng 3 path mới.
4. Làm đỏ: tạm cho route BPTN gọi nhầm `emergency_close` ⇒ test đỏ; hoàn tác ⇒ xanh.
5. Một commit local `feat(api): add safety review and emergency routes wrapping engine methods`. Không push.
Lưu output nguyên văn từng lệnh vào `planning/03_2026-10-03_safety-routes/evidence/*.txt` (SO gửi Trường).

## 4. Luật
Đọc code trước khi sửa, theo đúng mẫu route sẵn có. Mâu thuẫn handoff Trường ↔ CR-03 ⇒ dừng mục đó, ghi "Câu hỏi mở".

## 5. Tầng
🟠.

## 6. Mẫu report
`planning/03_2026-10-03_safety-routes/reports/R01_safety-routes.md`, KHÔNG commit: dòng 1 khai vai; dòng 2–4 `Handoff: H01_safety-routes.md` · `Base` · `Head`; bảng route ↔ method ↔ test; lệnh + exit nguyên văn; tổng/pass/fail/skip (nền và sau); `git diff --stat`; bảng phân công; KHÔNG làm; Câu hỏi mở; dòng cuối trống. Trả về chat ≤20 dòng.
