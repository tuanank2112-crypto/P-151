1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q18: KHÔNG giữ — cờ `hold_near_open_emergency: false`, chỉ liên kết hai chiều) → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §6, §8, §9 → `specs/SPEC-P02-engine-integration.md` §2–§5 → `specs/SPEC-P07-neighbors-follow-up.md` (TOÀN BỘ) → `specs/TESTING-ACCEPTANCE.md` §1, §2, §3.9, §3.10, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP10), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (worktree riêng; 3 worker khác làm WP7/WP8/WP9 song song ở file mixin khác). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao có WP0–WP6: stub `_link_emergency_both_ways`, `_hold_for_emergency`, `_release_waiting_for`, `create_follow_up` ở `src/maintenance/coordination/neighbors.py`; chỗ gọi trong `engine.py`; `_prepare`/`_decision_input`/`self._local.prepared`; client giả `LockProbeClient`, `CountingClient`, helper `agent_engine`.
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (KHÔNG đọc/in `.env`, KHÔNG gọi mạng).
- `--pg`: container `p151-pgtest` (127.0.0.1:55433, `p151`/`p151`); DB RIÊNG `p151_wp10_test` (`docker exec p151-pgtest createdb -U p151 p151_wp10_test`); `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp10_test`. CẤM đụng DB khác.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/coordination/neighbors.py`, `tests/test_maintenance/test_p1_neighbors.py`, `tests/test_maintenance/test_p1_follow_up.py` (mới) + `planning/06_2026-10-05_reasoning-agent/evidence/WP10/*`, `…/reports/R10_thi-cong_WP10.md`.
- CẤM: `engine.py`, `seed/**`, `agent/**`, `merge.py`, `split.py`, `department.py`, SPEC, `plan.md`, mọi test cũ. KHÔNG bật `hold_near_open_emergency` trong YAML (test E-03/E-05/E-06/F-05 bật cờ bằng bản sao catalog trong test). Vùng cấm + lý do: SPEC-P07 §4.2, §7.

## 3. VIỆC PHẢI LÀM
a. Hai file test E-01…E-08, F-01…F-06 (TESTING §3.9, §3.10; F-03 `memory` + `postgres`; F-06 dùng `LockProbeClient` ⇒ mọi lần gọi `_is_owned()==False`, `tx_depth==0`; tên hàm mang ID) TRƯỚC; chạy ⇒ E-01, F-01 đỏ ⇒ `evidence/WP10/red-before.txt`.
b. Lấp thân SPEC-P07 §2, §3, §6 (`_open_emergencies_at`, 3 hook, `create_follow_up`: tính quyết định Agent NGOÀI khoá với case tạm `"PENDING-FOLLOWUP"` theo P02 §5, rồi `_mutate` bước 1–8).
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_neighbors.py tests/test_maintenance/test_p1_follow_up.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP10/green.txt`; `--pg` hai file ⇒ `EXIT=0` ⇒ `evidence/WP10/pg.txt`.
c. Đột biến SPEC-P07 §9: (a) bỏ `follow_up_of` khỏi `exclude` ⇒ F-05 đỏ; (b) nhả khi còn khẩn cấp khác ⇒ E-06 đỏ; (c) cờ TẮT mà vẫn giữ ⇒ E-02 đỏ ⇒ `evidence/WP10/mutation-{a,b,c}.txt`; khôi phục sau mỗi cái.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP10/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ nền + mới; `evaluate` fixture 12/12 (E-08); ruff check + format ⇒ `evidence/WP10/ruff.txt` `EXIT=0`; `grep -c 'NotImplementedError("plan 06' src/maintenance/coordination/neighbors.py` = 0.

## 4. LUẬT
- I-16: CẤM gọi `self.agent.decide` trong khoá/`op`/giao dịch. Mọi ghi ticket khác qua `_related_case`/`_insert_case`; nhả chỉ theo sự kiện BQL, KHÔNG theo giờ/job.
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Hook/chỗ gọi trong `engine.py` thiếu hoặc sai ⇒ KHÔNG sửa `engine.py`; ghi "Câu hỏi mở" (SO xử), làm phần còn lại. Không skip/xfail.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit. Không sửa SPEC/plan. Evidence = output máy.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP10 a–d | 🟠 | SPEC hook + thứ tự bước đầy đủ, test tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H10_thi-cong_WP10.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip (+deselected); `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R10_thi-cong_WP10.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP10/pytest.txt`
