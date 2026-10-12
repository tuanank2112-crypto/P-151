1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21, SO đo ở root `D:/P151` = exit 0) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (gồm Q20) → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` (toàn bộ) → `specs/SPEC-P06-department.md` §5 → `specs/REF-agent-contract.py` mục A → `specs/TESTING-ACCEPTANCE.md` §3.4, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP1), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (có thể là worktree riêng). Đầu tiên `git rev-parse HEAD`; khác SHA SO ghi ở dòng "Base giao" cuối file này và `git status --porcelain` rỗng ⇒ `git reset --hard <SHA đó>`; cây bẩn ⇒ DỪNG, báo.
- Nền đo (SO 21:05): `pytest -q -p no:cacheprovider` ⇒ `2971 passed, 29 deselected`; ruff check + format sạch.
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (`.env` của máy bật openai + khoá thật — KHÔNG đọc/in/chép, KHÔNG gọi mạng).
- Q20 (SO quyết, plan.md §2): `Case.agent_decision` cần `AgentDecisionRecord` nên WP1 tạo luôn hợp đồng Agent thuần: `src/maintenance/agent/__init__.py` (CHỈ docstring — không import gì, tránh vòng import với `models.py`), `agent/schema.py` = REF mục A CHÉP NGUYÊN VĂN + `Disagreement` + `AgentDecisionRecord` (01 §3.3; chỉ import pydantic/stdlib/`enums`), `agent/inputs.py` = `DuplicateCandidate`, `AssetCandidate`, `DecisionInput` (01 §3.2; import `models.LockedFields`). Tên/kiểu đúng từng ký tự 01 §3.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/{enums,models,catalog,views,messages}.py`, `src/maintenance/i18n/vi.yaml`, `seed/maintenance_v1/catalog.yaml`, `src/maintenance/engine.py` (CHỈ hằng `TRANSITIONS`/`BLOCKER_OWNERS`/`PERMISSIONS` + chỗ khác BẮT BUỘC để giữ test xanh — nêu từng chỗ trong report), `src/maintenance/agent/{__init__,schema,inputs}.py` (mới), `tests/test_maintenance/test_p1_contracts.py` (mới), `tests/test_maintenance/test_engine.py` (CHỈ dòng `18 + 7` → `23 + 7`), `planning/06_2026-10-05_reasoning-agent/evidence/WP1/*`, `…/reports/R01_thi-cong_WP1.md`.
- CẤM: `lexicon.yaml`, `safety.py`, `rules.py`, `proposer.py`, `priority.py`, `store/**`, `src/api/**`, `src/web/**`, SPEC, `plan.md`, mọi test khác. Vùng cấm + lý do: 00 §6, 01 §14.

## 3. VIỆC PHẢI LÀM
a. Viết `test_p1_contracts.py` (C-01…C-05, C-12…C-14 — TESTING §3.4; tên hàm mang ID, vd `test_c01_…`) TRƯỚC khi sửa `src`; chạy ⇒ đỏ ⇒ `evidence/WP1/red-before.txt`. C-05 đọc `tests/test_maintenance/data/case_pre_p1.json` (WP0 sinh). Chưa có trong cây ⇒ tự sinh bằng lệnh OPERATIONS §3.3 TRƯỚC mọi sửa `src`, KHÔNG stage file đó.
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_contracts.py` trên code chưa sửa ⇒ có fail ở C-01, C-04, C-12.
b. Thi công 01 §1 (enum + `SPLIT_PAIR`), §2 (7 trường `Ticket`, V-T1…V-T5, `merged_from`/`copied_from`, `category_source`, `ExecutionSnapshot` theo SPEC-P06 §5, `Case.execution_snapshots`, `Case.agent_decision`, `BLOCKER_CODES_BY_STATUS`), §3 theo Q20, §4.2 (catalog + YAML: `wrong_dept_return`, `agent_policy`, `playbook_materials`, `SignalDef.agent_only` + 2 validator; `duplicate_raise_at_count: 3` đã chốt Q19), §5 (bảng 23+7, `BLOCKER_OWNERS`, đúng 4 khoá `PERMISSIONS`), §8 view (`LinkedTicket`, 9 trường `BqlTicketRow`, `bql_rows(flag=)`, `ResidentTicketView`), §9 i18n + `messages.py`.
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_contracts.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP1/green.txt`.
c. Đột biến: bỏ validator V-T4 ⇒ C-04 đỏ ⇒ `evidence/WP1/mutation-vt4.txt`; khôi phục.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP1/pytest.txt` (+ `EXIT=$?`): ≥ 2971 + số test mới, 0 fail, 0 skip; `ruff check src tests` + `ruff format --check src tests` ⇒ `evidence/WP1/ruff.txt` `EXIT=0`. Test cũ đỏ do bảng chuyển/view ⇒ sửa code theo SPEC; SPEC buộc đổi test cũ ⇒ DỪNG, "Câu hỏi mở".
e. Kiểm REF: `$PY planning/06_2026-10-05_reasoning-agent/specs/REF-agent-contract.py --selftest | tail -1` ⇒ `SELFTEST_FAILURES=0`; và `diff` lớp mục A giữa REF và `agent/schema.py` chỉ khác dòng import/chú thích ⇒ `evidence/WP1/schema-diff.txt`.

## 4. LUẬT
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã/regex; file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Mọi trường mới có mặc định (doc cũ đọc được); mọi khoá cấu hình mới BẮT BUỘC trong YAML. Không đổi kiểu/ý nghĩa trường cũ, không đổi tên `not_duplicate_of`, không thêm `Notification.type`.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file đã ghi (evidence, report gồm) — SO gộp + commit.
- Không sửa SPEC/plan; SPEC mâu thuẫn ⇒ "Câu hỏi mở" trong report, làm phần độc lập. Không "sửa cho tốt hơn". Evidence = output máy, CẤM sửa tay.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP1 a–e | 🟠 | có SPEC chữ ký đầy đủ + test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H01_thi-cong_WP1.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip; `git diff --cached --stat`; đường worktree; bảng phân công; mọi chỗ sửa ngoài 3 hằng trong `engine.py` + lý do; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Base giao: xem prompt phóng (SO ghi SHA khi phóng).
Report: `planning/06_2026-10-05_reasoning-agent/reports/R01_thi-cong_WP1.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP1/pytest.txt`
