1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21, SO đo ở root `D:/P151` = exit 0) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` §4.2 (dòng Lexicon) → `specs/SPEC-P03-safety-floor-p1.md` (TOÀN BỘ) + `specs/REF-p1-safety-meter.py` → `specs/TESTING-ACCEPTANCE.md` §3.11, §4.2, §5, §10 → `specs/OPERATIONS.md` §2 (dòng WP2), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (có thể là worktree riêng). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và `git status --porcelain` rỗng ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Nền đo (SO 21:05, base): `pytest -q` ⇒ `2971 passed, 29 deselected`; ruff sạch; meter chế độ repo `GATES_FAILED=47`; `--flip` ⇒ `GATES_FAILED=25` (SPEC-P03 §1).
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (`.env` của máy bật openai + khoá thật — KHÔNG đọc/in/chép, KHÔNG gọi mạng). Script tạm/đo nháp để ở `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/wp2/`, KHÔNG trong repo.
- Mục `S-00` (`agent_only: true`) cần trường `SignalDef.agent_only` do WP1 thêm (chạy song song). Làm S-00 SAU CÙNG: `git log --oneline -3 feature/nhuy-reasoning-agent` có commit message chứa `plan 06 contracts` ⇒ đưa commit đó vào cây của bạn (`git stash && git reset --hard <sha đó> && git stash pop`, xung đột ⇒ DỪNG báo) rồi thêm S-00 + đổi assert `17 → 18`; chưa có ⇒ BỎ S-00, giữ assert 17, ghi rõ trong report ("S-00 chờ WP1").

## 2. PHẠM VI
- ĐƯỢC GHI: đúng dòng "File được ghi" của SPEC-P03 (lexicon khối `safety` + `lexicon_version`; `tests/test_maintenance/data/safety_cases_p1.yaml` mới — `git add -f`; `tests/test_maintenance/test_safety_p1.py` mới; CHỈ các dòng SPEC-P03 §5 trong `test_safety.py`, `test_safety_p0.py`, `test_safety_metamorphic.py`, `data/safety_cases_p0.yaml`) + `planning/06_2026-10-05_reasoning-agent/evidence/WP2/*` + `…/reports/R02_thi-cong_WP2.md`.
- CẤM: `safety.py`, `catalog.py`, `engine.py`, `rules.py`, khối `priority` của lexicon, ca cũ của `data/safety_stop_sets_p0.yaml` (chỉ được THÊM), SPEC, `plan.md`. Vùng cấm + lý do: SPEC-P03 §8, 00 §6 (V-05, V-13).

## 3. VIỆC PHẢI LÀM
a. Viết `safety_cases_p1.yaml` (SPEC-P03 §3.1: 68 câu REF nguyên văn + câu thêm để mỗi tín hiệu ≥ 6 câu bắt, ≥ 1 không dấu, ≥ 1 vị trí giữa câu, ≥ 1 phủ định) + `test_safety_p1.py` (C4, C6, ca engine §7). Chạy trên lexicon CHƯA sửa ⇒ ≥ 45 fail ⇒ `evidence/WP2/red-before.txt`.
b. Sửa DỮ LIỆU lexicon theo SPEC-P03 §2–§3 (chính sách từ hai nghĩa — không bàn lại), đổi `lexicon_version` mỗi vòng (`2026-10-05.p1a`, `.p1b`, …); sửa đúng các dòng test §5. Sau MỖI vòng chạy đủ C1–C8.
   Xong khi (mỗi cổng một file `evidence/WP2/c<N>.txt`, có dòng lệnh + `EXIT=$?`): C1 `-k stop_set` 0 fail; C2 `-k false_alarm_budget` 0 fail; C3 `test_safety.py test_safety_p0.py test_cr03_targets.py` 0 fail; C4 `test_safety_p1.py` 0 fail (≥ 68 ca + ca engine); C5 `test_safety_metamorphic.py` 0 fail; C6 trong `test_safety_p1.py` 0 fail; C7 `$PY planning/06_2026-10-05_reasoning-agent/specs/REF-p1-safety-meter.py; echo EXIT=$?` ⇒ `GATES_FAILED=0`, `EXIT=0`; C8 `-k "24kb"` 0 fail.
c. Đột biến SPEC-P03 §10 (a) `active_phases: [P0]` ⇒ C4 đỏ; (b) bỏ dạng "gà" khỏi `homographs.ga` ⇒ `P1-FP-07` đỏ; (c) bỏ chủ ngữ khỏi đầu span S-11 ⇒ `P1-HED-03` hoặc `P1-FP-05` đỏ ⇒ `evidence/WP2/mutation-{a,b,c}.txt`; khôi phục sau mỗi cái.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP2/pytest.txt` (+`EXIT=$?`): 0 fail, 0 skip, tổng ≥ 2971 + test mới; bộ biến thể TESTING §4.2 (`test_safety_metamorphic.py test_classify_metamorphic.py`) 0 fail ⇒ `evidence/WP2/variants.txt`; ruff check + format ⇒ `evidence/WP2/ruff.txt` `EXIT=0`.
e. Câu §3.1 không thể đạt bằng dữ liệu ⇒ DỪNG phần đó, ghi "Câu hỏi mở" kèm câu tối thiểu + lý do cơ chế (SPEC-P03 §4) — KHÔNG sửa `safety.py`, KHÔNG hạ nhãn, KHÔNG nới ngân sách.

## 4. LUẬT
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho YAML/regex (heredoc làm hỏng `\b`); mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file (`-f` cho `data/`) — SO gộp + commit.
- Không sửa SPEC/plan; không "sửa cho tốt hơn". Evidence = output máy, CẤM sửa tay. Cổng C1/C2/C5 đỏ sau 2 vòng sửa ⇒ dừng, báo (leo thang).

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP2 a–e | 🔴 | thiết kế từ vựng cần quyết định ngoài bảng; sai = bỏ sót Bậc 1 |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H02_thi-cong_WP2.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; bảng cổng C1–C8 + exit; số vòng `lexicon_version`; test tổng/pass/fail/skip; `git diff --cached --stat`; đường worktree; bảng phân công; trạng thái S-00; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R02_thi-cong_WP2.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP2/c7.txt`
