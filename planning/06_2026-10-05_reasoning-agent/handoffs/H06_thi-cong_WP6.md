1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 → `specs/00-ARCHITECTURE.md` (I-16…I-24, §5) → `specs/01-CONTRACTS.md` §3, §6 → `specs/SPEC-P01-reasoning-agent.md` §3.3, §5–§7 → `specs/SPEC-P02-engine-integration.md` (TOÀN BỘ; làm §1 phần `agent=`/`build_engine`, §4–§6) → `specs/TESTING-ACCEPTANCE.md` §2, §3.5, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP6), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (có thể là worktree riêng). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao có WP0–WP5: gói `src/maintenance/agent/` (`agent.py` `ReasoningAgent`/`build_agent`, `client.py` client giả, `reconcile.safety_for`, …), mixin + hook + stub ở `coordination/`, giao dịch nhiều ticket. Import theo module con (`agent/__init__.py` CHỈ docstring — Q20).
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (`.env` của máy bật openai + khoá thật — KHÔNG đọc/in/chép, KHÔNG gọi mạng; mọi test dùng client giả).

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/engine.py`, `tests/test_maintenance/test_agent_engine.py` (mới), `tests/test_maintenance/test_agent_parity.py` (mới), `tests/test_maintenance/helpers.py` (CHỈ THÊM `agent_engine`, `decision` — TESTING §2), `planning/06_2026-10-05_reasoning-agent/evidence/WP6/*`, `…/reports/R06_thi-cong_WP6.md`.
- CẤM: `agent/**` (lỗi ở gói Agent ⇒ "Câu hỏi mở", SO quyết), `coordination/*.py` (thân Wave 4), `rules.py`, `safety.py`, `lexicon.yaml`, `models.py`, `src/api/**`, `src/web/**`, SPEC, `plan.md`, mọi test cũ.

## 3. VIỆC PHẢI LÀM
a. Viết 2 file test: A-03, A-07, A-13, A-20…A-31, A-33, PAR-01…PAR-03 (TESTING §3.5; A-20 phần `create_follow_up` để lại cho WP10 — ghi rõ; tên hàm mang ID) TRƯỚC; chạy ⇒ `TypeError` (`agent=`) ⇒ `evidence/WP6/red-before.txt`.
b. Thi công SPEC-P02 §1 (`agent=` + `ValueError` khi có cả `llm`; `build_engine` 3 nhánh), §4 (vân tay, `_decision_input`, `_prepare`, `_prepared`, `_with_decision`, `_StaleDecision`, `_STALE`, `_decision_for`, `_activate`, `DecisionView`, `_view`, `effective_location`), §5 (entry point: `receive`, `add_resident_info`, `bptn_resolve` + helper thuần `_bptn_locks`, `safety_confirm_safe`, `emergency_downgrade`, `run_jobs` hai pha), §6 (áp từng bước 2b/2/3/4–8; `max(..., ticket.risk_level)` ở 2b cho MỌI đường — I-17). Đường `_view is None` = code hiện tại NGUYÊN VẸN.
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_agent_engine.py tests/test_maintenance/test_agent_parity.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP6/green.txt`.
c. Đột biến SPEC-P02 §9: (a) gọi `agent.decide` trong `with self.lock` ở `receive` ⇒ A-20 đỏ; (b) bỏ `max(..., ticket.risk_level)` ⇒ A-07 đỏ; (c) dùng record cũ khi vân tay lệch ⇒ A-25 đỏ ⇒ `evidence/WP6/mutation-{a,b,c}.txt`; khôi phục sau mỗi cái.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP6/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ nền + mới; bộ biến thể (`test_safety_metamorphic.py test_classify_metamorphic.py`) + `test_agent_coordination.py` 0 fail ⇒ `evidence/WP6/variants.txt`; ruff check + format ⇒ `evidence/WP6/ruff.txt` `EXIT=0`.

## 4. LUẬT
- I-16: CẤM gọi `self.agent.decide` trong `with self.lock` / `op` / `repo.transaction()`, kể cả qua helper. Bước đọc quyết định CHỈ qua `DecisionView` (tôn trọng `rejected`).
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Test cũ đỏ ⇒ sửa code; SPEC buộc đổi test cũ ⇒ DỪNG, "Câu hỏi mở". Không `pytest.skip`/`xfail`; không `time.sleep` (dùng `Clock`).
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit. Không sửa SPEC/plan. Evidence = output máy.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP6 a–d | 🟠 | SPEC chữ ký + bảng áp từng bước đầy đủ, test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H06_thi-cong_WP6.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip; `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R06_thi-cong_WP6.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP6/pytest.txt`
