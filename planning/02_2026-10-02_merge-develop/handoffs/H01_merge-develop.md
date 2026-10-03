Bạn là worker của repo này. Loại: THI CÔNG (merge + giải xung đột).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: brain4agent/memory-distill.txt → brain4agent/-known-gotchas.md → planning/02_2026-10-02_merge-develop/plan.md (§2 Q01–Q07 = hợp đồng) → docs/maintenance.md (hành vi CR-03 P0 phải giữ) → trên `origin/develop`: `git show origin/develop:planning/01_2026-10-02_supabase-persistence/plan.md` và specs của nó (hành vi lưu trữ phải giữ) → `git log --oneline 1e2f42b..origin/develop`.

## 1. Bối cảnh
Nhánh `feature/nhuy-cr03-p0` có CR-03 P0 cho engine (1462 test). `origin/develop` có lưu trữ bền (CaseRepository, PostgreSQL/Supabase), `f1c6ebf` (BPTN gỡ MISSING_INFO), UI của Trí. Merge thử: 12 file xung đột (`src/maintenance/engine.py`, `catalog.py`, `seed/maintenance_v1/catalog.yaml`, `docs/CR-BPTN-03.md`, 8 file `brain4agent/`).

## 2. Phạm vi
- ĐƯỢC: `git merge origin/develop` trên `feature/nhuy-cr03-p0`; sửa file xung đột và file cần thiết để hai phần chạy chung trong `src/maintenance/`, `src/store*` hoặc tương đương của develop, `tests/`, `seed/`, `docs/CR-BPTN-03.md`, `brain4agent/`; `planning/02_2026-10-02_merge-develop/{evidence/*.txt, reports/R01_merge-develop.md}`.
- CẤM: force-push, push, rebase, `--no-verify`; sửa `src/web/`, `src/api/` NGOÀI chỗ bắt buộc để import/compile được (nếu buộc phải sửa, ghi rõ từng dòng trong report); xoá test của bất kỳ bên nào; bật LLM thật; `.gitignore`.

## 3. Việc phải làm
1. Đo nền `develop` riêng trong worktree tạm NGOÀI repo (`git worktree add <scratchpad>/wt-develop origin/develop`): pytest tổng/pass/fail/skip, ruff. Gỡ worktree sau khi đo (`git worktree remove`).
2. `git merge origin/develop`, giải xung đột theo Q03–Q05; xử điểm giao nhau Q04 + thêm test cho nó.
3. Xong khi (venv `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\venv311\Scripts\python.exe` — cài thêm dependency mới của develop vào venv nếu cần, `LLM_MODE=mock`, `PYTHONUTF8=1`):
   - pytest exit 0, 0 fail; tổng ≥ 1462 + số test chỉ có ở develop; skip ≤ số skip nền develop (ghi lý do từng skip).
   - ruff check + format --check `src tests` exit 0.
   - `tests/test_maintenance/test_safety.py` + `test_emergency.py` + `test_priority.py` + test store của develop đều chạy và xanh.
   - Thao tác ghi mới của CR-03 (5 method khẩn cấp, `set_priority`, rating một lần) có ít nhất 1 test chạy qua repository của develop (bộ nhớ) chứng minh trạng thái lưu và đọc lại đúng.
   - `git diff --name-only --diff-filter=U` rỗng; một commit merge (message mặc định của merge + dòng `Co-Authored-By`). Kèm đúng một dòng `brain4agent/memory/hot/today.md` nếu hook đòi.
4. Lưu output máy vào `planning/02_2026-10-02_merge-develop/evidence/*.txt`.

## 4. Luật
Đọc code hai bên trước khi giải. Mâu thuẫn không giải được theo Q03 ⇒ dừng mục đó, ghi "Câu hỏi mở" (không tự chọn bỏ hành vi). Giữ `engine.lock`, `_apply_transition`, `_mutate` (hoặc tương đương mới của develop).

## 5. Tầng
🔴 (bất biến an toàn + lưu trữ).

## 6. Mẫu report
`planning/02_2026-10-02_merge-develop/reports/R01_merge-develop.md`, KHÔNG commit report: dòng 1 khai vai; dòng 2–4 `Handoff: H01_merge-develop.md` · `Base` · `Head`; nền develop (số test/skip); bảng 12 file xung đột → cách giải; điểm giao Q04; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat <base>..HEAD`; bảng phân công; KHÔNG làm; Câu hỏi mở; dòng cuối trống. Trả về chat ≤25 dòng.
