1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q12 held-out, Q17 khoá chưa đủ) → `specs/00-ARCHITECTURE.md` → `specs/SPEC-P01-reasoning-agent.md` §4 → `specs/TESTING-ACCEPTANCE.md` §2, §6, §10 → `specs/OPERATIONS.md` §2 (dòng WP11), §3.1, §4, §8 → `tests/test_maintenance/agent_eval/` (bộ eval WP0 đã chuyển).

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (worktree riêng; WP7–WP10 chạy song song ở file khác). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao có WP0–WP6: Agent tích hợp engine; client giả `MirrorClient`/`ScriptedClient`; `openai_json_client` trong `agent/client.py`; bộ eval ở `tests/test_maintenance/agent_eval/` (`common.py` có `fresh(agent=…)`).
- PHẠM VI LẦN NÀY = phần chạy được KHÔNG CẦN KHOÁ: runner + cổng G-EVAL-FAKE. Khoá DeepSeek CHƯA đủ (thiếu base URL/model) ⇒ KHÔNG chạy `--client live`, KHÔNG gọi mạng, KHÔNG đổi chữ prompt (§4.4 cần eval thật), G-LIVE-1…7 để ⬜.
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (KHÔNG đọc/in `.env`).

## 2. PHẠM VI
- ĐƯỢC GHI: `tests/test_maintenance/agent_eval/run_eval.py` (mới), `tests/test_maintenance/test_agent_eval_fake.py` (mới), `planning/06_2026-10-05_reasoning-agent/evidence/WP11/*`, `…/reports/R11_thi-cong_WP11.md`.
- CẤM: `src/**` (kể cả `prompt.py` lần này), dữ liệu eval WP0 (chỉ đọc; sai dữ liệu ⇒ "Câu hỏi mở"), `.env`, SPEC, `plan.md`, mọi test cũ.

## 3. VIỆC PHẢI LÀM
a. Viết `test_agent_eval_fake.py` (G-EVAL-FAKE, TESTING §6) TRƯỚC; chạy ⇒ đỏ (runner chưa có) ⇒ `evidence/WP11/red-before.txt`.
b. `run_eval.py`: CLI đúng TESTING §6 (`--client {mirror,live} --set {safety,classify,audit_a,scenarios_c,scenarios_d,split,all} --out <file.json> [--sample N] [--concurrency 4]`); ép `MO_STORE=memory`; `live` dựng `openai_json_client` từ biến môi trường (OPERATIONS §4) và THOÁT mã 2 với thông báo rõ khi thiếu `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`MODEL_NAME` (không in giá trị khoá); báo cáo JSON mỗi ca `{id, set, text, expected, got, pass, source, fallback_reason, latency_ms, tokens}` + tổng; `--sample` chọn tất định (seed cố định). `split` lấy 32/18 câu REF-split-verdict; `classify` lấy kho phân loại có sẵn trong test (vd `cm.CORPUS` × mẫu vị trí).
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_agent_eval_fake.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP11/green.txt`.
c. Chạy thật với client giả: `$PY -m tests.test_maintenance.agent_eval.run_eval --client mirror --set all --out <scratchpad>/eval_mirror.json > planning/06_2026-10-05_reasoning-agent/evidence/WP11/eval-mirror.txt 2>&1; echo EXIT=$? >> …` ⇒ tổng từng tập, `errors=0` (lệch kỳ vọng do đường luật là SỐ ĐO, không phải lỗi); và `--client live` không biến môi trường ⇒ exit 2 ⇒ `evidence/WP11/live-guard.txt` (chạy với `env -u OPENAI_API_KEY -u OPENAI_BASE_URL -u MODEL_NAME`, KHÔNG trong cây có `.env` đọc được — runner KHÔNG được đọc `.env`; ép `Settings(_env_file=None)` hoặc đọc thẳng `os.environ`).
d. Đột biến: runner đánh `pass` luôn True ⇒ test G-EVAL-FAKE đỏ ⇒ `evidence/WP11/mutation-pass.txt`; khôi phục.
e. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP11/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ nền + mới; ruff check + format ⇒ `evidence/WP11/ruff.txt` `EXIT=0`.

## 4. LUẬT
- CẤM gọi mạng/mô hình thật, CẤM ghi khoá vào evidence/report; held-out (`cases_audit_a.yaml`, `scenarios_d.py`) chỉ chạy bằng mirror để đo nền, KHÔNG dùng chỉnh gì.
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit. Không sửa SPEC/plan. Evidence = output máy.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP11 a–e (phần không khoá) | 🟠 | CLI + định dạng báo cáo có trong SPEC; phần 🔴 (chỉnh prompt bằng eval thật) KHÔNG làm lần này |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H11_thi-cong_WP11.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip; bảng số đo mirror theo tập; `git diff --cached --stat`; đường worktree; bảng phân công; việc không làm (G-LIVE ⬜ + lý do); câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R11_thi-cong_WP11.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP11/eval-mirror.txt`
