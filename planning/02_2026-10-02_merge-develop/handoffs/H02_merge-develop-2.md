Bạn là worker của repo này. Loại: THI CÔNG (merge lần 2 + giải xung đột).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: brain4agent/memory-distill.txt → brain4agent/-known-gotchas.md (mục "Tầng an toàn & tiếng Việt") → planning/02_2026-10-02_merge-develop/plan.md (§2, **Q09 = hợp đồng gói này**, Q03–Q05 vẫn áp) → docs/maintenance.md → `git show 0cb16e2` phần của PR #6 (`git show a5e2705 --stat`, đọc `src/maintenance/safety.py`, `tests/test_maintenance/test_safety_p0.py`, `test_cr03_targets.py`, `seed/maintenance_cr03/*`, `planning/02_2026-10-03_truong-mvp-prep/specs/SPEC-P04-SAFETY.md` trên `origin/develop`).

## 1. Bối cảnh
Nhánh `feature/nhuy-cr03-p0` (HEAD hiện tại) có engine CR-03 P0 đã nối tầng an toàn (1514 test). `origin/develop` = `0cb16e2` vừa nhận PR #6 của Trường: một `safety.py` ĐỘC LẬP (chưa nối engine) + bộ nhãn + test. Merge thử: 8 xung đột (`src/maintenance/safety.py`, `docs/maintenance.md`, `docs/CR-BPTN-03.md`, 5 file `brain4agent/`).

## 2. Phạm vi
- ĐƯỢC: `git merge origin/develop`; sửa file xung đột; viết lại phần import/gọi trong `tests/test_maintenance/test_safety_p0.py`, `test_cr03_targets.py` cho chạy trên API của nhánh này (`assess`/`engine.receive`); `seed/maintenance_v1/lexicon.yaml` (chỉ THÊM từ theo Q09); `tests/test_maintenance/data/safety_stop_sets_p0.yaml` (chỉ thêm ca); `planning/02_2026-10-02_merge-develop/{evidence/*.txt, reports/R02_merge-develop-2.md}`; đúng một dòng `today.md` nếu hook đòi.
- CẤM: đổi nhãn kỳ vọng trong `seed/maintenance_cr03/*` hay trong test của Trường; xoá test của bất kỳ ai; sửa `src/api/`, `src/web/`; push/force/rebase/`--no-verify`; bật LLM.

## 3. Việc phải làm
1. `git merge origin/develop`; `safety.py` lấy bản nhánh này; nếu module Trường có hàm/khoá dữ liệu hữu ích (vd pattern mới) thì đưa vào `lexicon.yaml` chứ không thêm module thứ hai.
2. Chạy bộ nhãn của Trường trên engine nhánh này. Lập bảng: ca | nhãn Trường | engine ra | khớp/thấp hơn/cao hơn.
   - Thấp hơn nhãn Bậc 1 ⇒ thêm từ vựng (luật Q29: chỉ dữ liệu, không đổi cơ chế), chạy lại.
   - Cao hơn nhãn ⇒ ghi danh sách cho Trường, KHÔNG hạ.
   - Lệch cơ chế (cần đổi luật R1–R10 mới khớp) ⇒ KHÔNG sửa, ghi "Câu hỏi mở".
3. Xong khi (venv `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\venv311\Scripts\python.exe`, `LLM_MODE=mock`, `PYTHONUTF8=1`):
   - pytest exit 0, 0 fail, 0 skip mới; tổng ≥ 1514 + số test của PR #6; ruff check + format sạch.
   - Bộ dừng an toàn của nhánh xanh (`test_safety.py`); ngưỡng báo nhầm Q29 giữ.
   - `--diff-filter=U` rỗng; một commit merge kèm `Co-Authored-By`.
   - Evidence: pytest, ruff, bảng đối chiếu bộ nhãn Trường.

## 4. Luật
Đọc code hai bên trước khi giải. CR-03 + quyết định Q29–Q33 của hồ sơ 01 là hợp đồng tầng an toàn. Không tự chọn bỏ hành vi; mâu thuẫn ⇒ "Câu hỏi mở".

## 5. Tầng
🔴.

## 6. Mẫu report
`planning/02_2026-10-02_merge-develop/reports/R02_merge-develop-2.md`, KHÔNG commit: dòng 1 khai vai; dòng 2–4 Handoff/Base/Head; bảng 8 xung đột → cách giải; bảng đối chiếu bộ nhãn Trường (số khớp/thấp/cao + danh sách lệch); lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; KHÔNG làm; Câu hỏi mở; dòng cuối trống. Trả về chat ≤25 dòng.
