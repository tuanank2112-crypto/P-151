1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — root exit 0; worktree exit 1 với ĐÚNG MỘT dòng `BRN-002 … khối luật: boot` ⇒ ghi exit, ĐI TIẾP; lệch khác ⇒ DỪNG. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/08_2026-10-07_inflight-emergency/specs/01-CONTRACTS.md` §6 → `specs/SPEC-P01-report-restore.md` §4 → `specs/TESTING-ACCEPTANCE.md` A-24 → `src/api/routers/maintenance.py` (mẫu: route `emergency/close`, `emergency/downgrade`, `return`).

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151`, nhánh `feature/nhuy-reasoning-agent`. Engine đã có `report_emergency` và `emergency_restore` (WP1 đã duyệt — kiểm `plan.md` §4 ô WP1 `[x]`; chưa ⇒ DỪNG, BLOCKED). Base: `git rev-parse HEAD` trước dòng sửa đầu tiên.
- Việc: thêm đúng hai route mỏng bọc engine; mọi kiểm vai/trạng thái do engine.
- Python `.venv/Scripts/python`; env OPERATIONS §2.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/api/routers/maintenance.py` (2 route), `tests/test_maintenance/test_api_safety.py` (thêm ca), `planning/08_2026-10-07_inflight-emergency/evidence/WP2/*`, `…/reports/R02_thi-cong_WP2.md`.
- CẤM: `src/maintenance/**`, `src/web/**`, `portal/**`, SPEC, `plan.md`, commit, push, `git add -A`.

## 3. VIỆC PHẢI LÀM
a. Test A-24 trước (2 route × 200/403/404/409, `TestClient`, actor theo cách test API hiện có) ⇒ đỏ ⇒ `evidence/WP2/red-before.txt`.
b. Thêm `POST /mo/tickets/{ticket_id}/emergency/report` (`router`) và `POST /bql/tickets/{ticket_id}/emergency/restore` (`bql_router`), body `RequiredNoteBody`, gọi qua `_call`. Docstring tiếng Việt một dòng như route bên cạnh. Xong khi: `.venv/Scripts/python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_api_safety.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP2/api.txt`.
c. Cổng chung OPERATIONS §3 (bỏ `--pg`) ⇒ `evidence/WP2/{pytest,ruff}.txt`.

## 4. LUẬT
- Route KHÔNG tự bắt lỗi, KHÔNG kiểm vai, KHÔNG đổi ánh xạ `_call`.
- Không đổi route cũ; `git diff --stat` chỉ 2 file trong phạm vi.

## 5. TẦNG: 🟢 (có mẫu route sẵn để chép).

## 6. MẪU REPORT `reports/R02_thi-cong_WP2.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H02_thi-cong_WP2.md` / `Base: <sha>` / `Head: <sha; chưa commit>`; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`

Report: `planning/08_2026-10-07_inflight-emergency/reports/R02_thi-cong_WP2.md` · Evidence: `planning/08_2026-10-07_inflight-emergency/evidence/WP2/<ten-do>.txt`
