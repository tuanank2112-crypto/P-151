Bạn là worker của repo này. Loại: THI CÔNG (được ghi trong phạm vi dưới đây).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: planning/01_2026-10-01_cr03-p0-engine/plan.md (§2 Q29–Q31; **Q31 là hợp đồng của gói này**) → reports/R09_wp6-audit3.md (bảng A–D, G, lỗ từ vựng) → specs/SPEC-P01-safety-layer.md §3 (R1, R4, R5, R7, R8) → specs/01-CONTRACTS.md §5 → code src/maintenance/safety.py, seed/maintenance_v1/lexicon.yaml, tests/test_maintenance/test_safety.py. Script tái hiện của auditor (chỉ chạy, không sửa): C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\audit3\atk1.py…atk4.py (PYTHONPATH=...\scratchpad\audit2).

## 1. Bối cảnh
WP3c ✅ (1378 test). Thẩm định lần 3 (R09) còn 4 lỗi cơ chế hạ mức hẹp (A cue một chữ cái, B hedge/B-04 khớp tên người không dấu, C R7 đồng tự làm mất tín hiệu khi gõ sai dấu, D hazard token "chữa/báo cháy") + G ký tự điều khiển + 5 lỗ từ vựng. Gói này (WP3d) sửa đúng các mục đó theo Q31.
Nhánh `feature/nhuy-cr03-p0`. Base = `git rev-parse HEAD` lúc bắt đầu.

## 2. Phạm vi
- ĐƯỢC GHI: `src/maintenance/safety.py`, `src/maintenance/catalog.py` (chỉ loader/validator khoá lexicon nếu cần), `seed/maintenance_v1/lexicon.yaml`, `tests/test_maintenance/test_safety.py`, `tests/test_maintenance/data/safety_stop_sets_p0.yaml` (CHỈ THÊM ca, `git add -f`), `planning/01_2026-10-01_cr03-p0-engine/evidence/WP3d/*.txt`, đúng MỘT dòng `brain4agent/memory/hot/today.md`, file report.
- CẤM: mọi file khác (đặc biệt `engine.py`, `models.py`, `views.py`, `priority.py`, `rules.py`, `proposer.py`, `src/api/`, `src/web/`, `specs/`, `plan.md`); không xoá/sửa ca nhãn cũ.

## 3. Việc phải làm
1. Thêm mỗi câu A, B, C, D, G và 5 lỗ từ vựng của R09 thành ca có nhãn (kỳ vọng: Bậc 1 ⇒ EMERGENCY; "Tòa KO có khói" ⇒ ghi giới hạn đã biết, không test). Chạy ⇒ ĐỎ trước (`evidence/WP3d/red-before.txt`).
2. Sửa theo Q31 (A, B, C, D, G, từ vựng).
Xong khi (venv `...\scratchpad\venv311\Scripts\python.exe`, `LLM_MODE=mock`, `PYTHONUTF8=1`):
- pytest exit 0, 0 fail, 0 skip, tổng ≥ 1378 + số ca mới; ruff check + format --check exit 0.
- atk1–atk4 chạy lại: mọi ca A–D, G ra đúng mức Q31 (dán output).
- Bộ dừng D-1…D-7, D-9 không hồi quy; ngưỡng báo nhầm Q29 giữ (b_fp EMERGENCY ≤1, UNCLEAR ≤5; jx_negfp EMERGENCY ≤2; b_fp2 EMERGENCY ≤3) — in số.
- Làm đỏ: thêm lại cue `k co` ⇒ ca A đỏ; bỏ từ đồng hiện của C ⇒ ca C đỏ; hoàn tác ⇒ xanh.
- Một commit local `fix(engine): tighten safety cues, homographs and invisible chars per third audit (WP3d)`. Không push.

## 4. Luật
- Q31 là hợp đồng; mâu thuẫn với SPEC-P01 ⇒ theo Q31 (SO đã quyết), ghi drift. Ca mơ hồ ⇒ mức CAO hơn.
- CẤM bật LLM, `--no-verify`, push. Không đọc `scratchpad\judge\` hay `jx_holdout.py`.

## 5. Tầng
WP3d 🟠.

## 6. Mẫu report
Ghi `planning/01_2026-10-01_cr03-p0-engine/reports/R10_wp3d-safety-fixes.md`, KHÔNG commit: dòng 1 khai vai; dòng 2–4 `Handoff: H07_wp3d-safety-fixes.md` · `Base` · `Head`; bảng A–D, G, từ vựng (trước/sau); bộ dừng + ngưỡng; lệnh + exit; `git diff --stat`; bảng phân công; KHÔNG làm; Drift; Câu hỏi mở; dòng cuối trống. Trả về chat ≤25 dòng.
