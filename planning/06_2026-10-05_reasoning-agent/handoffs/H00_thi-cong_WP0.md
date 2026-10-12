1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21, SO đo ở root `D:/P151` = exit 0) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` → `specs/OPERATIONS.md` §1, §2 (dòng WP0), §3 → `specs/TESTING-ACCEPTANCE.md` §6 (chỉ để biết runner sau này đọc dữ liệu thế nào).

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (bạn có thể đang ở worktree riêng). Nhánh gốc `feature/nhuy-reasoning-agent`; base giao = SHA SO ghi trong prompt phóng (= `82f01f0` + hồ sơ plan 06; `src/` y hệt `82f01f0`).
- Đầu tiên: `git rev-parse HEAD`; khác base giao và `git status --porcelain` rỗng ⇒ `git reset --hard <base giao>`; khác mà cây bẩn ⇒ DỪNG, báo.
- Nền đo (SO, 2026-10-05 21:05): `pytest -q -p no:cacheprovider` ⇒ `2971 passed, 29 deselected`, ruff check + format sạch (76 file).
- Python: `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`. MỌI lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (máy có `.env` bật `LLM_MODE=openai` + khoá thật — KHÔNG đọc/in/chép `.env`, KHÔNG gọi mạng).
- Nguồn bộ eval (scratchpad, chỉ ĐỌC): `SP=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad` — `$SP/agent_audit/{audit_a.py,audit_c.py,audit_d.py,common.py,p3.txt,p6.txt}`, `$SP/redteam_lex.py`, `$SP/holdout_so.py`.

## 2. PHẠM VI
- ĐƯỢC GHI: `tests/test_maintenance/data/case_pre_p1.json`, `tests/test_maintenance/agent_eval/**`, `planning/06_2026-10-05_reasoning-agent/evidence/WP0/*`, `planning/06_2026-10-05_reasoning-agent/reports/R00_thi-cong_WP0.md`.
- CẤM: mọi file khác (đặc biệt `src/**`, `seed/**`, SPEC, `plan.md`, test hiện có). Vùng cấm + lý do: `specs/00-ARCHITECTURE.md` §6, `OPERATIONS.md` §8.

## 3. VIỆC PHẢI LÀM (thứ tự BẮT BUỘC)
a. Fixture trước P1 — chạy NGUYÊN lệnh OPERATIONS §3.3 (thay `python` bằng `$PY`) TRƯỚC mọi việc khác.
   Xong khi: `$PY -c "import json; json.load(open('tests/test_maintenance/data/case_pre_p1.json',encoding='utf-8'))"; echo EXIT=$?` ⇒ `EXIT=0`; và round-trip `Case.model_validate(doc).model_dump(mode='json') == doc` cho cả 3 case in `True` ⇒ lưu `evidence/WP0/fixture.txt`.
b. Chuyển bộ eval theo OPERATIONS §3.1 (đích, định dạng, dòng HELD-OUT) + §3.2 (đổi `SIM-A→S1`, `SIM-B→S2`, `SIM-C→S2` trong text VÀ kỳ vọng vị trí). Thêm: `holdout_so.py` ⇒ khoá `holdout_so` trong `safety_sentences.yaml` (mỗi ca `{id, text, acceptable: [...]}`); p6 (cặp câu) ⇒ mỗi câu một ca `expect: EMERGENCY` trừ câu mà nguồn ghi rõ khác (giữ đúng nguồn). Mỗi ca có `id` duy nhất, ổn định (vd `A01`, `C-…`, `P3-01`, `P6-01a`).
   - `common.py`: sửa import cho đường repo (`from tests.test_maintenance.helpers import …`, bỏ `sys.path.insert` cứng), thêm tham số `agent=None` cho `fresh()` (truyền `MaintenanceEngine(clock=clock, agent=agent)` CHỈ khi `agent is not None`, để vẫn chạy trên engine hiện tại).
   - File `.py` trong `agent_eval/` KHÔNG được tên `test_*` (pytest không được thu thập chúng) và phải qua `ruff check` + `ruff format --check`.
   Xong khi: `$PY -c "import yaml,glob; [yaml.safe_load(open(f,encoding='utf-8')) for f in glob.glob('tests/test_maintenance/agent_eval/*.yaml')]; print('YAML_OK')"` in `YAML_OK`; `$PY -c "import tests.test_maintenance.agent_eval.common, tests.test_maintenance.agent_eval.scenarios_c, tests.test_maintenance.agent_eval.scenarios_d; print('IMPORT_OK')"` in `IMPORT_OK`; `grep -rc "SIM-A\|SIM-B\|SIM-C" tests/test_maintenance/agent_eval/` tổng 0 (chỉ đếm tên tòa; `SIM-TKT`/`SIM-ASSET` không tính — dùng regex `SIM-[ABC]\b`). Lưu `evidence/WP0/port.txt` (số ca mỗi file).
c. Kiểm va chạm vị trí §3.2: viết lệnh MỘT dòng (hoặc script trong `$SP`, KHÔNG trong repo) so mọi ca có kỳ vọng `asset`/`ASSET_UNCLEAR` với `location_normalized` các asset trong `seed/maintenance_v1/catalog.yaml`; in từng dòng va chạm + `UNRESOLVED=<n>`. Mỗi va chạm: sửa KỲ VỌNG (không sửa text), ghi lý do vào report.
   Xong khi: chạy lại ⇒ `UNRESOLVED=0` ⇒ `evidence/WP0/collisions.txt` (gồm cả dòng lệnh đã chạy).
d. Chạy thử engine hiện tại trên bộ đã chuyển (không có Agent) chỉ để chứng minh dữ liệu dùng được: mỗi file in `cases=<n> ran=<n> errors=<n>` (lỗi kỳ vọng sai KHÔNG phải lỗi; `errors` = exception khi chạy) ⇒ `evidence/WP0/smoke.txt`, `errors=0`.
e. Cổng chung: `LLM_MODE=mock PYTHONUTF8=1 $PY -m pytest -q -p no:cacheprovider > …/evidence/WP0/pytest.txt 2>&1; echo "EXIT=$?" >> …` ⇒ `2971 passed`, `EXIT=0`; `ruff check src tests` + `ruff format --check src tests` ⇒ `EXIT=0` ⇒ `evidence/WP0/ruff.txt`.

## 4. LUẬT
- Ghi file bằng công cụ Write/Edit, KHÔNG heredoc bash cho mã/regex; mỗi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Không commit, không push, không `git add -A`. Cuối việc: `git add` TƯỜNG MINH từng đường dẫn đã ghi (`git add -f` cho `tests/test_maintenance/data/case_pre_p1.json` vì `.gitignore` chặn `data/`) để `git diff --cached --stat` liệt kê đủ — SO gộp + commit.
- Không sửa SPEC/plan; SPEC mâu thuẫn ⇒ ghi "Câu hỏi mở" trong report, làm phần độc lập. Không "sửa cho tốt hơn".
- Evidence = output máy (redirect, Git Bash), CẤM sửa tay; không chép khoá/`.env`.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP0 a–e | 🟢 | có mẫu/lệnh chép theo (OPERATIONS §3) |

## 6. REPORT PHẢI CÓ
Mẫu HANDOFF_PROTOCOL §7 (`D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md`): dòng 1 khai vai; dòng 2 `Handoff: handoffs/H00_thi-cong_WP0.md`; dòng 3 `Base: <git rev-parse HEAD trước sửa>`; dòng 4 `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip; `git diff --cached --stat`; đường dẫn worktree (`git rev-parse --show-toplevel`); bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R00_thi-cong_WP0.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP0/pytest.txt`
