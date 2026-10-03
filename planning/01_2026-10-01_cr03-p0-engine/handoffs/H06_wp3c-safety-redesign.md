Bạn là worker của repo này. Loại: THI CÔNG (được ghi trong phạm vi dưới đây).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: brain4agent/memory-distill.txt → planning/01_2026-10-01_cr03-p0-engine/plan.md (§2 Q24–Q30) → specs/SPEC-P01-safety-layer.md (TOÀN BỘ; §0 bảng R1–R10 + A1–A4, §1 chữ ký, §3, §7, §8, §9) → specs/01-CONTRACTS.md §5 (lexicon, validator V-01…V-12, M-09/M-10) → specs/SPEC-P03-priority.md §1, §6, §8 → specs/TESTING-ACCEPTANCE.md §4.1, §4.2, §6 (RED-6…10), §8 (G3c, G10–G12), §10 (D-1…D-10), §11 (bộ dừng).

## 1. Bối cảnh
Thẩm định 2 lần bỏ sót Bậc 1; judge (Opus) phán đổi THIẾT KẾ tầng an toàn 2b theo R1–R10 (phạm vi phủ định hẹp dùng chung safety+priority, gộp span, B-01 tập đóng, ký tự vô hình 2 biến thể, lưới Bậc 2, đồng tự theo pattern, từ vựng). SPEC đã được viết lại và duyệt (Q30). Gói này (WP3c) cài đúng SPEC đó. Thay thế cơ chế cửa sổ 4 từ và `non_lamp` — KHÔNG giữ song song.
Nhánh `feature/nhuy-cr03-p0`. Base = `git rev-parse HEAD` lúc bắt đầu.

## 2. Phạm vi
- ĐƯỢC GHI: đúng dòng "File được ghi (WP3c)" ở đầu SPEC-P01, cộng `brain4agent/memory/hot/today.md` (đúng MỘT dòng).
- CẤM: mọi file khác, đặc biệt `engine.py`, `models.py`, `views.py`, `rules.py`, `proposer.py`, `src/api/`, `src/web/`, `specs/`, `plan.md`, `.gitignore`, `tests/test_maintenance/data/safety_cases_p0.yaml`. Chỉ được sửa đúng 2 test cũ ghi trong TESTING §4.2.
- Bộ dừng lấy từ scratchpad theo TESTING §11 (sha256 + chép bằng `ast`); file data mới `git add -f` (Q21).

## 3. Việc phải làm
1. Thêm test §4.1 + bộ dừng §11 TRƯỚC; chạy ⇒ phải ĐỎ (lưu `evidence/WP3c/red-before.txt`).
2. Cài SPEC-P01 + 01 §5 + SPEC-P03 §1.
Xong khi (venv `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\venv311\Scripts\python.exe`, `LLM_MODE=mock`, `PYTHONUTF8=1`):
- pytest exit 0, 0 fail, 0 skip; tổng ≥ ngưỡng G3c (TESTING §8). ruff check + format --check exit 0.
- Tiêu chí dừng D-1…D-10 (TESTING §10) — TRỪ D-8 (holdout, SO tự đo) — đạt, in số từng mục.
- RED-6…RED-10 (TESTING §6): mỗi cái làm đỏ rồi hoàn tác xanh; lưu evidence.
- M-09, M-10 (01 §11) đúng; validator từ chối biến thể hỏng như SPEC ghi.
- 24 KB < 1 s (in số).
- Một commit local `fix(engine): redesign safety scope rules per judge ruling (WP3c)`. Không push.

## 4. Luật
- SPEC là hợp đồng; mâu thuẫn ⇒ dừng mục đó, ghi drift, không tự chọn. Ca mơ hồ ⇒ mức CAO hơn.
- CẤM bật LLM. CẤM `--no-verify`, push. Không leo model; thiếu quyết định ⇒ "Câu hỏi mở".

## 5. Tầng
WP3c 🟠 (SPEC + bộ dừng tự biết đúng/sai).

## 6. Mẫu report
Ghi `planning/01_2026-10-01_cr03-p0-engine/reports/R08_wp3c-safety-redesign.md`, KHÔNG commit:
- Dòng 1: `Vai: worker · loại: thi công · họ/model: <...> · Bước 0 exit: <n> · hiểu việc: <phạm vi / xong khi / cấm>`
- Dòng 2–4: `Handoff: H06_wp3c-safety-redesign.md` · `Base: <sha>` · `Head: <sha>`
- Bảng D-1…D-10 (D-8 ghi "SO đo"); RED-6…10; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`.
- Bảng phân công thực tế; Việc KHÔNG làm + lý do; Drift; Câu hỏi mở. Dòng cuối để trống cho phán quyết SO.
Trả về chat: tóm tắt ≤25 dòng + đường dẫn report.
