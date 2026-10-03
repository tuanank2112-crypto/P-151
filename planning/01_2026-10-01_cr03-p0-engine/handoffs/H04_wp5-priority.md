Bạn là worker của repo này. Loại: THI CÔNG (được ghi trong phạm vi dưới đây).
Bước 0: từ D:\P151 chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: brain4agent/memory-distill.txt → brain4agent/-known-gotchas.md → planning/01_2026-10-01_cr03-p0-engine/plan.md (§2 Q01–Q23) → reports/R03_wp4-emergency.md (mục "chưa làm": E-02 priority, E-13 `set_priority`) → specs/OPERATIONS.md (dòng WP5) → specs/SPEC-P03-priority.md → specs/SPEC-P04-guards.md §4, §6.2, §7, §10 → specs/01-CONTRACTS.md (`set_priority`, `queue_sort_key`, trường priority) → specs/TESTING-ACCEPTANCE.md (dòng WP5).

## 1. Bối cảnh
WP2 (contract), WP3 (an toàn 2b), WP4 (luồng khẩn cấp, sửa 403 ở `0ef1c61`) đã ✅; 292 test xanh. Gói này (WP5) là gói thi công cuối: **priority theo luật** PRI-H1/H2/M1/M2/L1/D0 (PRI-U1/U2 là P1 — KHÔNG làm), `set_priority` của BPTN/BQL (lý do bắt buộc, audit, `HUMAN_OVERRIDE`), khoá sắp xếp hàng đợi, **`rate()` chỉ một lần**, dòng `priority:` kỳ vọng trong seed, và hai assert hoãn từ WP4 (E-02 `priority == HIGH`, E-13 ca `set_priority`).
Nhánh `feature/nhuy-cr03-p0`. Base = `git rev-parse HEAD` lúc bắt đầu.

## 2. Phạm vi
- ĐƯỢC GHI: cột ĐƯỢC GHI dòng **WP5** trong `specs/OPERATIONS.md`, CỘNG: `tests/test_maintenance/test_emergency.py` CHỈ cho 2 assert hoãn (E-02, E-13); `planning/01_2026-10-01_cr03-p0-engine/evidence/WP5/*.txt`; file report.
- CẤM CHẠM: cột CẤM CHẠM dòng WP5; luôn cấm `src/api/`, `src/web/`, `docs/`, `.gitignore`, `specs/`, `plan.md`, `src/maintenance/{rules,proposer,safety}.py`, `brain4agent/` (trừ đúng MỘT dòng `memory/hot/today.md`).

## 3. Việc phải làm
Hiện thực toàn bộ P03 + các mục WP5 của P04 + 2 assert hoãn, kèm test TESTING-ACCEPTANCE gán cho WP5.
Xong khi (venv `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\50fe2a3e-bc4a-4de2-bd98-02ab091c7e1d\scratchpad\venv311\Scripts\python.exe`, `LLM_MODE=mock`, `PYTHONUTF8=1`):
1. `python -m pytest -q -p no:cacheprovider` → exit 0, 0 fail, 0 skip, tổng ≥ max(292 + số test R-01…R-07 + G-04 + G-05, ngưỡng TESTING §8 G1).
2. `ruff check` + `ruff format --check` trên `src tests` → exit 0.
3. P03 §8 R-01…R-07 và P04 §10 G-04, G-05 đúng (dán output vào evidence).
4. Làm đỏ: (a) cho `rate()` ghi đè lần hai ⇒ test đỏ; (b) đổi thứ tự khoá sắp xếp (priority trước risk) ⇒ test đỏ; hoàn tác ⇒ xanh. Ghi exit code cả ba.
5. `set_priority` giữ `engine.lock` và đi qua `_mutate` (grep/AST chứng minh vào evidence); sai vai ⇒ 403 + audit; thiếu lý do ⇒ lỗi theo 01-CONTRACTS.
6. Một commit local theo mẫu message dòng WP5. Không push.

## 4. Luật
- Đọc code trước khi sửa; theo quy ước sẵn có. Priority TÁCH khỏi `risk_level`; ticket khẩn cấp luôn đứng đầu hàng đợi (CR-03 §7).
- Code/SPEC mâu thuẫn ⇒ dừng mục đó, ghi drift. Khi SPEC con lệch CR-03 ⇒ CR-03 thắng (tiền lệ Q23), ghi rõ.
- Hook pre-commit: đúng MỘT dòng nhật ký WP5 trong `today.md` (số test thật).
- CẤM `--no-verify`, push, gọi LLM thật. Không leo model; thiếu quyết định ⇒ "Câu hỏi mở".

## 5. Tầng
WP5 🟠 (SPEC + bảng luật tự biết đúng/sai).

## 6. Mẫu report
Ghi `planning/01_2026-10-01_cr03-p0-engine/reports/R04_wp5-priority.md`, KHÔNG commit file report:
- Dòng 1: `Vai: worker · loại: thi công · họ/model: <...> · Bước 0 exit: <n> · hiểu việc: <phạm vi / xong khi / cấm>`
- Dòng 2–4: `Handoff: H04_wp5-priority.md` · `Base: <sha>` · `Head: <sha>`
- Lệnh + exit (hoặc trỏ evidence); test tổng/pass/fail/skip; `git diff --stat <base>..HEAD`
- Bảng phân công thực tế; Việc KHÔNG làm + lý do; Drift; Câu hỏi mở. Dòng cuối để trống cho phán quyết SO.
Trả về chat: tóm tắt ≤25 dòng + đường dẫn report.
