Bạn là worker THI CÔNG của repo D:\P151 (được ghi trong phạm vi dưới).
Bước 0: từ root chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi mã thoát vào report.
Thứ tự đọc: brain4agent/memory-distill.txt → docs/maintenance.md (§4, mục "Kho", "Lưu vật tư nguyên tử") → planning/24_2026-10-14_material-requests/plan.md → specs/00-ARCHITECTURE.md → 01-CONTRACTS.md → SPEC-P01-REQUESTS.md → SPEC-P02-RESTOCK-NOTICE.md → TESTING-ACCEPTANCE.md.

## 1. Bối cảnh
Engine MaintenanceOps (Python 3.11, FastAPI) thiếu: phiếu vật tư khi ticket chờ vật tư, cách cho phòng ban đang làm báo thiếu, và thông báo cho phòng ban khi kho nhập. Người dùng đã duyệt hướng (plan.md M01–M03). Gói này = M1 (engine + API + test). UI là gói khác, KHÔNG làm.

## 2. Phạm vi
- ĐƯỢC sửa: `src/maintenance/engine.py`, `src/maintenance/models.py`, `src/maintenance/views.py`, `src/maintenance/enums.py` (nếu cần Action), `src/api/routers/maintenance.py`, `tests/test_maintenance/test_stock_alerts.py` (chỉ chỗ ghim hành vi bị thay, ghi lý do), file mới `tests/test_maintenance/test_p24_material_requests.py`.
- CẤM chạm: `portal/`, `src/mobile/`, `src/maintenance/coordination/`, migration, seed, `brain4agent/`, `planning/` (trừ ghi report + evidence của gói này), `.env`.
- Code đang có thay đổi chưa commit của hồ sơ 23 (coordination/, engine.py chỗ khẩn cấp) — GIỮ NGUYÊN, không revert, không format lại file ngoài chỗ mình sửa.

## 3. Việc phải làm
1. SPEC-P01 §1–§3 (tự sinh thông báo ở bước 7, `report_material_shortage`, `material_requests`).
2. SPEC-P02 §1–§3 (điều kiện alert theo phòng, `tickets[].waiting` lúc đọc, quyền).
3. Route 01-CONTRACTS §3; lỗi theo §4.
4. Test R-01..R-12 (TESTING §1) + 5 phép phá (TESTING §2): mỗi phép phá áp tạm, chạy file test p24, ghi kết quả, KHÔI PHỤC file; ghi output máy vào `planning/24_2026-10-14_material-requests/evidence/M1/mutation.txt`.

Xong khi (lệnh + kết quả máy đọc được):
- `D:\P151\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider --ignore=integration` ⇒ exit 0, 0 failed, 0 skipped (nền trước gói: 3653 passed).
- `.venv\Scripts\python.exe -m ruff check <file đã sửa>` và `ruff format --check <file đã sửa>` ⇒ exit 0 (lỗi ruff có sẵn ở `reports.py`, `test_reports.py`, thứ tự import đầu `maintenance.py` KHÔNG phải của bạn — không sửa).
- `evidence/M1/mutation.txt`: 5/5 phép phá exit ≠ 0.

## 4. Luật
- Spec-first: lệch SPEC thì DỪNG, ghi câu hỏi vào report, không tự đổi thiết kế. Vùng cấm ở 00 §5 và từng SPEC là luật.
- Mọi ghi ticket qua `_mutate`/`_apply_transition`; giữ `engine.lock`; không gọi LLM mới.
- Không commit, không push. Comment/tên code tiếng Anh, khớp mật độ comment của file.
- Không đọc/ghi Supabase; engine memory là mặc định cho test.

## 5. Tầng
M1 = 🟠 (có SPEC + test tự biết đúng/sai). Không phóng subagent.

## 6. Mẫu report (ghi vào `planning/24_2026-10-14_material-requests/reports/R01_engine-api.md`, chỉ số đo)
Dòng 1: `Vai · thi công · họ/model · Bước 0 exit=<n> · hiểu việc: <phạm vi / xong khi / cấm>`
Dòng 2–4: `Handoff: H01_engine-api.md` · `Base: <git rev-parse --short HEAD>` · `Head: working tree (chưa commit)`
- Lệnh + exit code nguyên văn; pytest tổng/pass/fail/skip.
- `git diff --stat` các file trong phạm vi.
- Bảng phân công: gói → tầng yêu cầu → họ/model đã dùng.
- Test cũ đã sửa + lý do (trỏ quyết định M01.x).
- Việc KHÔNG làm + lý do; câu hỏi cần người.
