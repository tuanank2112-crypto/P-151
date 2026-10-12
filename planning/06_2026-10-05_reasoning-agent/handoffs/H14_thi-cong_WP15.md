1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: từ `D:/P151` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` ⇒ exit 0 (cây chính). Lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `brain4agent/memory-distill.txt` dòng "BẤT BIẾN NGƯỜI DÙNG" → `planning/06_2026-10-05_reasoning-agent/plan.md` §2 (Q28, Q35, **Q36**) → `specs/SPEC-P08-audit-fixes.md` §5–§9 (**§6 đọc banner Q36, đoạn dưới banner là lịch sử**) → `reports/R12_tham-dinh_WP12.md` §5 (F4–F9) → `specs/SPEC-P04-duplicate-merge.md` §2.1, §8 → `specs/SPEC-P05-split-two-jobs.md` §3, §5, §7 → `specs/SPEC-P07-neighbors-follow-up.md` §6.
(Cập nhật 2026-10-10 18:03 +0700 theo Q36; bản 2026-10-07 thay thế.)

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151`, nhánh `feature/nhuy-reasoning-agent`, làm trên cây chính. Đo Base bằng `git rev-parse HEAD`, ghi `git status --porcelain` trước sửa. Không reset/stash; không đụng thay đổi có sẵn, `.claude/worktrees/`, `scratch/`. File cần sửa đã bẩn ⇒ dừng phần đó, báo.
- Thẩm định R12 tìm ra lỗi luồng gộp/tách/follow-up: số đếm trùng sai sau hoàn tác tách, hoàn tác tách lần 2 ném 422, gộp dây chuyền, follow-up mất khoá vị trí. Probe tái hiện ở `planning/06_2026-10-05_reasoning-agent/evidence/WP12/probes/` (chỉ đọc).
- F8 "hai nơi": đường luật + Mirror ĐÃ không tách (`rules.split_verdict` ⇒ `two-places`). Đường Agent do LLM quyết theo ngữ nghĩa — code KHÔNG được gác bằng đếm từ chỉ nơi (Q36). Việc của gói này chỉ là test ghim hai chiều, không sửa runtime cho F8.
- Python: `.venv/Scripts/python.exe` (3.11.7). Env `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`. Không mạng, không đọc/in `.env`; thiếu thư viện ghi BLOCKED, không cài ngầm.
- `--pg`: Docker hiện TẮT ⇒ ghi `NOT_RUN (Docker tắt)` vào `pg.txt`, không cố bật.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/coordination/split.py`, `merge.py`, `neighbors.py`, `tests/test_maintenance/test_p1_audit_fixes_coord.py` (mới), test cũ mà §5–§7 buộc đổi khẳng định (liệt kê trong report), `…/evidence/WP15/*`, `…/reports/R14_thi-cong_WP15.md`.
- Chỉ sửa TẠM khi làm đột biến rồi khôi phục (diff cuối = 0): `src/maintenance/rules.py`.
- CẤM: `engine.py`, `agent/**`, `safety.py`, `lexicon.yaml`, `catalog.yaml`, `src/api/**`, `src/web/**`, `portal/**`, SPEC, `plan.md`, `git stash`, commit, push, `git add -A`. Cần đổi `engine.py` ⇒ DỪNG, báo SO.

## 3. VIỆC PHẢI LÀM
a. Viết test TRƯỚC cho F4, F5, F6, F7, F9 theo SPEC-P08 §5, §7 (chép logic probe vào test, không import evidence); chạy ⇒ đỏ ⇒ `evidence/WP15/red-before.txt`. F8: 2 test theo banner §6 — (i) luật và Mirror: 3 câu `[two-places]` không tách; (ii) client giả trả 2 jobs hợp lệ cùng vị trí danh mục cho câu nhắc hai nơi ⇒ VẪN tách. Hai test F8 xanh ngay trên Base là ĐÚNG (ghim hành vi), ghi rõ trong report.
b. Sửa đúng SPEC-P08 §5, §7. Xong khi: file test mới `EXIT=0` ⇒ `evidence/WP15/green.txt`; probe `extra_undo_split.py`, `extra_dup_count_walk.py`, `extra_followup_split_safety.py` trên HEAD của bạn: các mục F4–F7, F9 đạt; `break6_wrong_split.py` dòng `[two-places]`: rules/mirror `no-split` ⇒ `evidence/WP15/probes-after.txt`.
c. `planning/06_2026-10-05_reasoning-agent/specs/REF-split-verdict.py --variants` ⇒ `VARIANT_FAILURES=0`, 32 MUST_SPLIT vẫn tách ⇒ `evidence/WP15/split-verdict.txt`.
d. Đột biến (mỗi cái phải làm đỏ test mới, khôi phục sau, ghi `git diff --stat` sau khôi phục): (a) bỏ `_release_duplicate_count` trong `undo_split`; (b1) xoá nhánh `two-places` trong `rules.split_verdict` ⇒ test F8 (i) đỏ; (b2) thêm kiểm `location_mentions` > 1 vào nhánh Agent của `_has_two_jobs` ⇒ test F8 (ii) đỏ; (c) bỏ chép khoá vị trí ở follow-up ⇒ `evidence/WP15/mutation-{a,b1,b2,c}.txt`.
e. Cổng chung SPEC-P08 §9: pytest toàn bộ (`python -m pytest -q -p no:cacheprovider`), `--pg` (NOT_RUN nếu Docker tắt), `ruff check src tests` + `ruff format --check src tests` ⇒ `evidence/WP15/{pytest,pg,ruff}.txt` (mỗi file kết bằng `EXIT=`). Mốc so sánh: 3685 passed trên `8cf52d4`.

## 4. LUẬT
- Bất biến P04 §2.1 về `duplicate_count` là chuẩn duy nhất; không thêm trường mới vào model.
- CẤM dùng từ khoá/regex/khớp chuỗi để gác quyết định của Agent (kernel "BẤT BIẾN NGƯỜI DÙNG"). Thấy test/SPEC đòi việc đó ⇒ không làm, ghi "câu hỏi cần người".
- Không nới test cũ để xanh; đổi khẳng định ⇒ liệt kê + lý do.
- `\b` trong regex: ghi file bằng Write/Edit; `grep -cP '[\x08\x0b\x0c]'` = 0 mọi file đã ghi.
- Lệnh bị từ chối quyền ⇒ không lách, ghi "câu hỏi cần người".

## 5. TẦNG: 🟠 (có SPEC + test tự biết đúng/sai; tự làm, không giao con).

## 6. MẪU REPORT `reports/R14_thi-cong_WP15.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H14_thi-cong_WP15.md` / `Base: <sha>` / `Head: <SHA hiện tại; working tree chưa commit>`; bảng lệnh + exit + kết quả; test tổng/pass/fail/skip; `git diff --stat` + danh sách file untracked trong phạm vi; test cũ đã đổi khẳng định + lý do; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`

Report: `planning/06_2026-10-05_reasoning-agent/reports/R14_thi-cong_WP15.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP15/<ten-do>.txt`
