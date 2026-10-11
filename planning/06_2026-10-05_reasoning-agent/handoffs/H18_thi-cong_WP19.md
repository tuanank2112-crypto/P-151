1. Bạn là worker của repo này. Đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại THI CÔNG runtime, tầng 🟠. **CHỜ DUYỆT P10:** chỉ bắt đầu khi dòng "Trạng thái" của `specs/SPEC-P10-catalog-not-quote.md` ghi ĐÃ DUYỆT; còn PROPOSED ⇒ dừng, báo người giao.
2. Bước 0: từ root `D:/P151` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; ghi exit (chạy trong worktree: chỉ ngoại lệ CRLF theo plan Q21; lệch khác ⇒ DỪNG). KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `brain4agent/memory-distill.txt` (dòng 21) → `brain4agent/-known-gotchas.md` mục "⚠ Kiểm trích dẫn bằng chuỗi con" và "Trích dẫn của Agent" → `planning/06_2026-10-05_reasoning-agent/specs/SPEC-P10-catalog-not-quote.md` TOÀN BỘ → `SPEC-P01-reasoning-agent.md` §3, §5 → `TESTING-ACCEPTANCE.md` §2, §10 → `OPERATIONS.md` §1.

## 1. Bối cảnh
- Q35 (hướng đã duyệt): ngữ nghĩa do LLM; code CHỈ kiểm giá trị có trong danh mục đóng/ứng viên/enum; quote chỉ để hiển thị/audit, không chặn. P10 §1 đo 6 cổng khớp quote đang loại/hạ đầu ra LLM; P10 §3 là hợp đồng sửa từng dòng.
- P10 đã mô phỏng trong bộ nhớ: suite cũ đỏ đúng 19 test (P10 §9.1); bản nháp test mới đỏ 15/xanh 3 trên Base (P10 §9.2). Không đoán thêm — làm đúng bảng.
- Repo `D:/P151`, nhánh `feature/nhuy-reasoning-agent`. Ghi Base = `git rev-parse HEAD` + `git status --porcelain` TRƯỚC khi sửa. Không reset/stash; không đụng `.claude/worktrees/`, `scratch/`, thay đổi có sẵn của người khác (file cần sửa đã bẩn ngoài phạm vi ⇒ dừng phần đó, báo).
- Env đo: `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`, Python 3.11 của `.venv`. Không mạng, không LLM, không đọc/in `.env` (G-LIVE chỉ khi người cho phép — P10 §9.5).

## 2. Phạm vi
- ĐƯỢC GHI: đúng hàng "File WP19 được ghi" của P10 — `src/maintenance/agent/schema.py`, `src/maintenance/agent/validate.py`, `src/maintenance/agent/baseline.py`, `src/maintenance/safety.py` (CHỈ P10 §3.3), `src/maintenance/engine.py` (CHỈ biểu thức P10 §3.5); `tests/test_maintenance/test_p10_catalog_not_quote.py` (mới); `tests/test_maintenance/test_agent_unit.py`, `test_p1_audit_fixes_safety.py`, `test_safety.py` (CHỈ các test ở P10 §9.1); `planning/06_2026-10-05_reasoning-agent/evidence/WP19/*.txt`; `planning/06_2026-10-05_reasoning-agent/reports/R18_thi-cong_WP19.md`.
- CẤM: hàng "CẤM chạm (WP19)" của P10 (gồm `agent/prompt.py`, `reconcile.py`, `lexicon.yaml`, `rules.py`, `models.py`, `store/**`, `coordination/**`, `src/api/**`, `src/web/**`); SPEC, REF, `plan.md`; commit, stage, push, `git stash`, `git add -A`.

## 3. Việc phải làm + xong khi (mỗi evidence kết bằng `EXIT=`)
a. Test trước: viết `test_p10_catalog_not_quote.py` đúng 8 ID, tham số và kỳ vọng của P10 §9.2; chạy trên code CHƯA sửa ⇒ `evidence/WP19/red-before.txt`. Xong khi: đúng P10 §9.4 #1 (15 đỏ: T-P10-01, -03×6, -04×3, -05×2, -06, -07, -08; 3 xanh: T-P10-02×3).
b. Sửa code đúng P10 §3.1–§3.5 (schema chép NGUYÊN VĂN REF mục A; xoá `grounded`, `_fold`, `_first_sentence`, `_grounded`); đổi test cũ đúng bảng P10 §9.1 (thay 1–1, không xoá ca, số test không giảm). Xong khi: P10 §9.4 #2 `EXIT=0` ⇒ `evidence/WP19/green.txt`.
c. Cổng chung P10 §9.4 #3–#8, #11 ⇒ `evidence/WP19/pytest.txt` (tổng/pass/fail/skip/deselected), `ruff.txt`, `grep-grounded.txt` (phải in `0`), `safety-gates.txt`, `ref-selftest.txt`, `diff-stat.txt`.
d. Đột biến P10 §9.3 m1–m7: trước mỗi cái chép file đã sửa ra scratchpad; áp đúng một đột biến; chạy test nêu tên; chép file lại; `git diff --stat` sau khôi phục = trước ⇒ `evidence/WP19/mutation-m1.txt` … `mutation-m7.txt` (mỗi file `EXIT≠0` + tên test đỏ).
e. Số đo rủi ro P10 §9.4 #9: chạy `planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes/extra_invented_location.py` trên cây đã sửa ⇒ `evidence/WP19/invented-location.txt` (ghi số, không phải cổng; mô phỏng P10 cho 3).
f. `--pg` (OPERATIONS §1): chạy nếu có Docker ⇒ `evidence/WP19/pg.txt`; không có ⇒ ghi ⬜ + lý do.

## 4. Luật
- P10 §6 BẮT BUỘC / CẤM / vùng cấm áp nguyên văn. Đặc biệt: không so quote với văn bản ở BẤT KỲ đâu (kể cả "cờ cảnh báo"); không bịa quote trong Mirror/test/helper; không thêm cờ bật lại cổng quote; không đổi prompt, lexicon, bảng G.
- Test cơ chế dùng client giả nêu điều luật KHÔNG thấy (P10 §6 BẮT BUỘC 6); không dùng `MirrorClient` để chứng minh nhánh Agent.
- `ruff format --check` toàn repo Base đã `EXIT=1` vì `src/main.py` (ngoài phạm vi, KHÔNG sửa) ⇒ chỉ kiểm các file mình chạm (P10 §9.4 #5).
- SPEC thiếu/mâu thuẫn, hoặc cần quyết định ngoài P10 (G-1/G-2, F8, marker DB — P10 §7) ⇒ KHÔNG tự quyết; ghi "Câu hỏi" trong report, làm phần độc lập.
- Lệnh bị từ chối quyền ⇒ không lách, ghi câu hỏi.

## 5. Tầng
- WP19: 🟠 (có SPEC + test tự biết đúng/sai). Việc chép theo mẫu (REF mục A sang `schema.py`, đổi tên/khẳng định test theo bảng §9.1) là 🟢 — giao xuống được; không có tầng 🟢 ⇒ tự làm ở 🟠. Cần quyết định chưa có trong P10 ⇒ dừng hỏi (gói không có 🔴).

## 6. Report `reports/R18_thi-cong_WP19.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm)`; dòng 2–4 `Handoff: handoffs/H18_thi-cong_WP19.md` / `Base: <sha>` / `Head: <sha; working tree chưa commit>`; bảng lệnh + exit nguyên văn; test tổng/pass/fail/skip trước và sau; `git diff --stat` + file untracked trong phạm vi; bảng test cũ đã đổi (đúng P10 §9.1) + lý do; bảng đột biến m1–m7; số đo rủi ro (#9); live: NOT_RUN hoặc số thật; bảng phân công (gói → tầng yêu cầu → họ/model đã dùng); việc KHÔNG làm + lý do; câu hỏi cần người. Dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R18_thi-cong_WP19.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP19/`
