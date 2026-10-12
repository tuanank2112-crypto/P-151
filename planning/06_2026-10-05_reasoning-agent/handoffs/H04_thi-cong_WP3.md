1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q09 LangGraph CÓ, Q20) → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §3, §4.1, §11 → `specs/SPEC-P01-reasoning-agent.md` (TOÀN BỘ) + `specs/REF-agent-contract.py` → `specs/SPEC-P05-split-two-jobs.md` §2, §10 + `specs/REF-split-verdict.py` → `specs/TESTING-ACCEPTANCE.md` §2, §3.1–§3.3, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP3), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (có thể là worktree riêng). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao đã có WP1 (enum/model/catalog/`agent/schema.py`/`agent/inputs.py` theo Q20) và WP4 (`Settings.mo_agent_*`). `agent/__init__.py` CHỈ docstring (models.py import `agent.schema` ⇒ `__init__` import gì thêm sẽ vòng import) — giữ nguyên; import theo module con (`from src.maintenance.agent.agent import ReasoningAgent, build_agent`).
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe` (đã có `openai` 3.24, `langgraph` 1.2.12); mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (`.env` của máy bật openai + khoá thật — KHÔNG đọc/in/chép, KHÔNG gọi mạng; `openai_json_client` chỉ được dựng trong test bằng client giả/không gọi `create`).

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/agent/{prompt,client,baseline,validate,reconcile,graph,agent}.py` (mới); `agent/schema.py`/`inputs.py` CHỈ khi thiếu thứ SPEC-P01 đòi (nêu từng dòng trong report, không đổi tên/kiểu đã có); `src/maintenance/rules.py` (CHỈ thêm 4 hàm 01 §11 + `SplitVerdict` + refactor `_matches_both`); `requirements.txt` (thêm `openai>=1.40.0`); `tests/test_maintenance/test_agent_unit.py`, `test_agent_prompt.py`, `test_rule_evidence.py` (mới); `planning/06_2026-10-05_reasoning-agent/evidence/WP3/*`; `…/reports/R04_thi-cong_WP3.md`.
- CẤM: `engine.py`, `models.py`, `enums.py`, `catalog.py`, `safety.py`, `proposer.py`, `lexicon.yaml`, `src/api/**`, `src/web/**`, `src/agents/**`, SPEC, `plan.md`. Vùng cấm + lý do: SPEC-P01 §9, 00 §6.

## 3. VIỆC PHẢI LÀM
a. Viết 3 file test (A-01, A-02, A-04…A-19 phần thuần, A-32 — TESTING §3.1; P-01…P-08 §3.2; RE-01…RE-06 §3.3; tên hàm mang ID) TRƯỚC; chạy trên base ⇒ lỗi import ⇒ `evidence/WP3/red-before.txt`.
b. Thi công SPEC-P01 §1–§8 (LangGraph CÓ — §8, chỉ API liệt kê) + client giả TESTING §2 (`ScriptedClient`, `MirrorClient`, `FailingClient`, `LockProbeClient`, `CountingClient` trong `agent/client.py`) + `ReasoningAgent.fallback` (SPEC-P02 §4.3) + `build_agent` (None khi `llm_mode != "openai"`, thiếu khoá, hoặc `mo_agent_enabled=False`). Prompt/schema CHÉP NGUYÊN VĂN REF. Bằng chứng luật SPEC-P05 §2 (cụm R-S3, `location_mentions` chép nguyên văn REF-split-verdict).
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_agent_unit.py tests/test_maintenance/test_agent_prompt.py tests/test_maintenance/test_rule_evidence.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP3/green.txt`.
c. REF: `$PY planning/06_2026-10-05_reasoning-agent/specs/REF-agent-contract.py --selftest | tail -1` ⇒ `SELFTEST_FAILURES=0`; `$PY …/REF-split-verdict.py --variants | tail -3` ⇒ `FAILURES=0`, `VARIANT_FAILURES=0` ⇒ `evidence/WP3/ref.txt`.
d. Đột biến SPEC-P01 §11: (a) bỏ kiểm grounded của job ⇒ A-08 đỏ; (b) `max` thay `merge_llm` ⇒ A-04 đỏ; (c) bỏ dòng G-1 ⇒ A-18 đỏ ⇒ `evidence/WP3/mutation-{a,b,c}.txt`; khôi phục sau mỗi cái.
e. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP3/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ số nền base giao + mới; `test_classify_metamorphic.py` 0 vi phạm; ruff check + format ⇒ `evidence/WP3/ruff.txt` `EXIT=0`.

## 4. LUẬT
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã/regex/prompt; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- `decide()` không ném lỗi do mô hình; bug vẫn ném. Một lượt gọi; không retry; `temperature=0`; mọi lần gọi ghi `ai_logger`.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit.
- Không sửa SPEC/plan; SPEC mâu thuẫn ⇒ "Câu hỏi mở", làm phần độc lập. Không "sửa cho tốt hơn". Evidence = output máy, CẤM sửa tay.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP3 a–e | 🟠 | REF chạy được + test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H04_thi-cong_WP3.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip; `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R04_thi-cong_WP3.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP3/pytest.txt`
