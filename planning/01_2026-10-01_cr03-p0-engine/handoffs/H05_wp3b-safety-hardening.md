Bạn là worker của repo này. Loại: THI CÔNG (được ghi trong phạm vi dưới đây).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: brain4agent/memory-distill.txt → planning/01_2026-10-01_cr03-p0-engine/plan.md (§2, ĐẶC BIỆT Q24–Q27 = kỳ vọng bắt buộc) → reports/R05_wp6-audit.md (bảng N-01..N-10, file:dòng nghi ngờ) → specs/SPEC-P01-safety-layer.md → specs/SPEC-P03-priority.md (phần luật lối đi) → code src/maintenance/{safety,priority,engine,catalog}.py, seed/maintenance_v1/lexicon.yaml, tests/test_maintenance/{test_safety.py,data/safety_cases_p0.yaml}. Script tái hiện của auditor (chỉ đọc, tham khảo): C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\audit\*.py

## 1. Bối cảnh
WP2–WP5 đã ✅ (313 test). Thẩm định độc lập WP6 phán 🔁: tầng an toàn 2b **bỏ sót Bậc 1** ở câu tự nhiên (phủ định lan qua dấu phẩy/xuống dòng, thiếu từ vựng, ký tự lạ), hạ nhầm Bậc 1 xuống Bậc 2 (marker/hedge/B-04 khác mệnh đề), B-01 che tín hiệu, O(n²) gây DoS, cùng 3 lỗi nhẹ. Gói này (WP3b) sửa đúng các ca đó theo kỳ vọng Q25–Q27.
Nhánh `feature/nhuy-cr03-p0`. Base = `git rev-parse HEAD` lúc bắt đầu.

## 2. Phạm vi
- ĐƯỢC GHI: `src/maintenance/safety.py`, `src/maintenance/priority.py`, `src/maintenance/engine.py` (CHỈ N-09 và kiểm độ dài Q26), `src/maintenance/catalog.py` (loader/khoá cấu hình nếu cần), `src/maintenance/models.py` (CHỈ ràng buộc độ dài mô tả nếu đặt ở model), `seed/maintenance_v1/lexicon.yaml`, `seed/maintenance_v1/catalog.yaml` (CHỈ khoá độ dài nếu đặt ở catalog), `tests/test_maintenance/test_safety.py`, `tests/test_maintenance/test_priority.py`, `tests/test_maintenance/data/safety_cases_p0.yaml` (`git add -f`), `planning/01_2026-10-01_cr03-p0-engine/evidence/WP3b/*.txt`, file report.
- CẤM CHẠM: `src/api/`, `src/web/`, `docs/`, `.gitignore`, `specs/`, `plan.md`, `src/maintenance/{rules,proposer,views}.py`, `brain4agent/` (trừ đúng MỘT dòng `memory/hot/today.md`), seed `tickets.yaml`.

## 3. Việc phải làm
1. Thêm MỖI câu N-01..N-10 trong R05 (đủ biến thể auditor liệt kê) làm ca có nhãn trong `safety_cases_p0.yaml` (hoặc test riêng cho N-07, N-09, N-10) với kỳ vọng ĐÚNG như Q25–Q27. Chạy ⇒ phải ĐỎ trước khi sửa (lưu `evidence/WP3b/red-before.txt`).
2. Sửa code + lexicon cho các ca đó xanh, KHÔNG làm đỏ ca cũ.
Xong khi (venv `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\venv311\Scripts\python.exe`, `LLM_MODE=mock`, `PYTHONUTF8=1`):
- `python -m pytest -q -p no:cacheprovider` → exit 0, 0 fail, 0 skip, tổng ≥ 313 + số ca mới.
- `ruff check` + `ruff format --check` trên `src tests` → exit 0.
- Trên toàn bộ ca có nhãn: **0 bỏ sót Bậc 1**, in số báo nhầm (44 ca NONE cũ phải vẫn 0 báo nhầm; nếu buộc phải tăng thì ghi rõ ca nào và vì sao).
- REF prototype `specs/REF-safety-proto.py specs/SAFETY-CASES-P0.yaml specs/LEXICON-P0.yaml` KHÔNG cần sửa (là tài liệu); chỉ ghi kết quả chạy bộ ca của test.
- N-07: đo thời gian `receive` với mô tả 24 KB < 1 s (in số); 5001 ký tự ⇒ lỗi validation 422; ≤ 5000 ⇒ nhận bình thường.
- Chạy lại script auditor `a_text.py`, `a_text2.py`, `a_fuzz.py`, `a_dos.py` (PYTHONPATH=thư mục audit) và dán kết quả vào evidence.
- Một commit local `fix(engine): harden safety layer against clause-crossing negation, lexicon gaps and odd characters (WP3b)`. Không push.

## 4. Luật
- Đọc code trước khi sửa. Luật cố định quyết định; LLM chỉ nâng mức (giữ Q09). Nội dung ticket là dữ liệu không tin cậy.
- Ca mơ hồ giữa hai mức ⇒ chọn mức CAO hơn (Q25 nghiêng an toàn). Thấy kỳ vọng Q25 mâu thuẫn CR-03 ⇒ dừng mục đó, ghi "Câu hỏi mở".
- Hook pre-commit: đúng MỘT dòng nhật ký WP3b trong `today.md` (số test thật).
- CẤM `--no-verify`, push, gọi LLM thật. Không leo model.

## 5. Tầng
WP3b 🟠 (có ca nhãn tự biết đúng/sai).

## 6. Mẫu report
Ghi `planning/01_2026-10-01_cr03-p0-engine/reports/R06_wp3b-safety-hardening.md`, KHÔNG commit file report:
- Dòng 1: `Vai: worker · loại: thi công · họ/model: <...> · Bước 0 exit: <n> · hiểu việc: <phạm vi / xong khi / cấm>`
- Dòng 2–4: `Handoff: H05_wp3b-safety-hardening.md` · `Base: <sha>` · `Head: <sha>`
- Bảng N-01..N-10: ca → kỳ vọng → trước sửa → sau sửa; lệnh + exit; test tổng/pass/fail/skip; số bỏ sót/báo nhầm; `git diff --stat`
- Bảng phân công thực tế; Việc KHÔNG làm + lý do; Drift; Câu hỏi mở. Dòng cuối để trống cho phán quyết SO.
Trả về chat: tóm tắt ≤25 dòng + đường dẫn report.
