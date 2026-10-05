1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng `BRN-002 … khối luật: boot` (CRLF, Q21) ⇒ ghi exit và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q28) → `specs/SPEC-P08-audit-fixes.md` §1–§4, §8, §9 → `reports/R12_tham-dinh_WP12.md` §5 (F1, F2, F3, F10, F11) → `specs/SPEC-P03-safety-floor-p1.md` §6 (cổng C1–C8) → `specs/00-ARCHITECTURE.md` (I-16…I-30, V-05, V-13).

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151`. Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base>`; cây bẩn ⇒ DỪNG, báo.
- Thẩm định R12 tìm ra: cư dân bổ sung "có người bị điện giật ngất" vào ticket đang chờ vị trí ⇒ ticket vẫn `NEED_INFO`, `risk=NONE` (F1, CHẶN). Probe tái hiện ở `planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes/` (chỉ đọc).
- Python: gọi NGUYÊN VĂN `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe` (KHÔNG dùng biến làm tên lệnh), env `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.`. Không mạng, không đọc/in `.env`.
- `--pg`: chỉ `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp14_test` (container `p151-pgtest`; tạo DB nếu chưa có).

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/engine.py` (CHỈ `_resume_activated`/helper mới cho F1 và đoạn kiểm vai trong `transition` cho F10), `src/maintenance/agent/validate.py` (`_check_location`, F3), `seed/maintenance_v1/lexicon.yaml` (F2/F11, tăng `version`), `tests/test_maintenance/test_p1_audit_fixes_safety.py` (mới), dữ liệu ca an toàn `tests/test_maintenance/data/safety_*.yaml` (CHỈ THÊM ca), test cũ mà §3/§4 buộc đổi khẳng định (liệt kê trong report), `…/evidence/WP14/*`, `…/reports/R14_thi-cong_WP14.md`.
- CẤM: `safety.py` (V-13 — dữ liệu không đủ ⇒ DỪNG báo SO), `agent/prompt.py`, `coordination/**` (WP15 đang sửa song song), `src/api/**`, `src/web/**`, SPEC, `plan.md`, `git stash`, commit, push, `git add -A`.

## 3. VIỆC PHẢI LÀM
a. Viết test TRƯỚC cho F1, F3, F10, F2/F11 theo nghiệm thu SPEC-P08 §1–§4 (chép logic probe vào test, không import evidence); chạy ⇒ đỏ ⇒ `evidence/WP14/red-before.txt`.
b. Sửa đúng SPEC-P08 §1–§4. Xong khi: file test mới `EXIT=0` ⇒ `evidence/WP14/green.txt`; các probe `extra_addition_not_assessed.py`, `extra_invented_location.py`, `extra_permissions.py`, `extra_context_lowers.py` chạy trên HEAD của bạn đều exit 0 ⇒ `evidence/WP14/probes-after.txt`.
c. Cổng an toàn P03 §6: C1–C8 + `REF-p1-safety-meter.py` (`GATES_FAILED=0`) + `test_safety_metamorphic.py test_classify_metamorphic.py` ⇒ `evidence/WP14/safety-gates.txt`.
d. Đột biến (mỗi cái phải làm đỏ test mới, khôi phục sau): (a) bỏ nhánh chạy lại 2b ở F1; (b) cho quote vị trí rỗng đi qua ở F3; (c) đổi `_deny` F10 về 409 ⇒ `evidence/WP14/mutation-{a,b,c}.txt`.
e. Cổng chung SPEC-P08 §9: pytest toàn bộ, `--pg` toàn bộ, ruff check + format ⇒ `evidence/WP14/{pytest,pg,ruff}.txt` (mỗi file kết bằng `EXIT=`).

## 4. LUẬT
- AI/luật không bao giờ hạ mức an toàn (I-17); mọi thay đổi từ vựng chỉ được NÂNG hoặc giữ — chứng minh bằng vi sai trước/sau trên kho câu (`evidence/WP14/lexicon-diff.txt`: 0 câu EMERGENCY→thấp hơn, 0 câu UNCLEAR→NONE mới).
- `\b` trong regex: ghi file bằng Write/Edit; `grep -cP '[\x08\x0b\x0c]'` = 0 mọi file đã ghi.
- Lệnh bị từ chối quyền ⇒ không lách, ghi "câu hỏi cần người".

## 5. TẦNG: 🔴 (an toàn + quyền; tự làm, không giao con).

## 6. MẪU REPORT `reports/R14_thi-cong_WP14.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H13_thi-cong_WP14.md` / `Base: <sha>` / `Head: chưa commit (SO gộp)`; bảng lệnh + exit + kết quả; test tổng/pass/fail/skip; `git diff --cached --stat`; test cũ đã đổi khẳng định + lý do; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
