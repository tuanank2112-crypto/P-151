1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — ở root exit 0; trong worktree exit 1 với ĐÚNG MỘT dòng `BRN-002 … khối luật: boot` (CRLF) ⇒ ghi exit và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/08_2026-10-07_inflight-emergency/plan.md` §2 → `specs/00-ARCHITECTURE.md` §4 → `specs/01-CONTRACTS.md` §1–§5, §9 → `specs/SPEC-P01-report-restore.md` §1–§5 → `specs/TESTING-ACCEPTANCE.md` §1–§4 → `specs/OPERATIONS.md` §2–§3 → `docs/maintenance.md`.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151`, nhánh `feature/nhuy-reasoning-agent`. Đo Base bằng `git rev-parse HEAD` ngay trước dòng sửa đầu tiên; ghi `git status --porcelain` trước sửa. Không reset/stash; không đụng `.claude/worktrees/`, `scratch/`, file bẩn có sẵn của người khác.
- Lỗ cần vá: ticket đã tới phòng ban (`ROUTED`/`IN_PROGRESS`/`ON_HOLD`) mà luật + Agent bỏ sót nguy hiểm thì không ai nâng được lên Bậc 1. Thêm báo khẩn (E03) và BQL trả về chỗ cũ (E04) đúng SPEC-P01.
- Điều kiện vào: `plan.md` §4 đã tick "Người dùng duyệt", "P1", "P5", "H13 plan 06 ✅" và `.venv` tồn tại. Thiếu bất kỳ ô nào ⇒ DỪNG, report BLOCKED.
- Python: `.venv/Scripts/python` (3.11). Env theo OPERATIONS §2. Không mạng, không đọc/in `.env`.

## 2. PHẠM VI
- ĐƯỢC GHI: `src/maintenance/enums.py` (2 `Action`), `src/maintenance/models.py` (`EmergencyReturn`, `Ticket.emergency_return`, validator 01 §2, hằng `REPORTABLE_STATUSES`), `src/maintenance/engine.py` (CHỈ: `TransitionRule`, `TRANSITIONS`, `PERMISSIONS`, kiểm trong `_apply_transition`, `reachable`/`method_only` trong `transition()`, mixin vào khai báo lớp, chặn T05 + `bql_merge` theo SPEC-P01 §3), `src/maintenance/coordination/emergency.py` (mới), `src/maintenance/coordination/merge.py` (CHỈ chặn §3 nếu `bql_merge` nằm ở đây), `src/maintenance/store/postgres.py` (`HEAD_REVISION`), `src/maintenance/store/migrations/versions/0003_emergency_return.py` (mới), `tests/test_maintenance/test_p08_inflight_emergency.py` (mới), hai test đếm `TRANSITIONS` (01 §3), `planning/08_2026-10-07_inflight-emergency/evidence/WP1/*`, `…/reports/R01_thi-cong_WP1.md`.
- CẤM: `safety.py`, `seed/**`, `agent/**`, `src/api/**`, `src/web/**`, `portal/**`, SPEC/`plan.md`, `docs/**`, `brain4agent/**`, `git stash`, commit, push, `git add -A`.

## 3. VIỆC PHẢI LÀM
a. Viết test TRƯỚC cho A-01…A-23 (TESTING §1); chạy ⇒ đỏ ⇒ `evidence/WP1/red-before.txt`.
b. Cài đúng 01 §1–§5, §9 và SPEC-P01 §1–§3. Xong khi: `.venv/Scripts/python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p08_inflight_emergency.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP1/green.txt`.
c. Đột biến a–d (TESTING §2): mỗi cái đỏ test mới, khôi phục, ⇒ `evidence/WP1/mutation-{a,b,c,d}.txt`. Bia đột biến chỉ là file bạn sửa trong phạm vi.
d. `git diff --exit-code -- src/maintenance/safety.py seed/ src/maintenance/agent/; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP1/safety-diff.txt`.
e. Cổng chung OPERATIONS §3 ⇒ `evidence/WP1/{pytest,pg,ruff}.txt` (mỗi file kết `EXIT=`); Docker không chạy ⇒ `pg.txt` ghi `NOT_RUN` + lý do.

## 4. LUẬT
- Bất biến I-1…I-9 (00 §4) và vùng cấm SPEC-P01 §5 là luật, không phải gợi ý. Mâu thuẫn giữa SPEC và code ⇒ DỪNG phần đó, ghi câu hỏi; KHÔNG tự chọn.
- Test cũ phải đổi khẳng định ⇒ chỉ hai test đếm `TRANSITIONS` (01 §3) và ca do F10 (H13) đã đổi; ca khác đỏ ⇒ dừng, báo.
- `\b` trong regex: ghi bằng Write/Edit; `grep -cP '[\x08\x0b\x0c]'` = 0 mọi file đã ghi.
- Lệnh bị từ chối quyền ⇒ không lách, ghi "câu hỏi cần người". Chạy lệnh dài ở tiền cảnh; viết report TRƯỚC phần phụ thuộc tác vụ nền.

## 5. TẦNG: 🟠 (spec + test tự biết đúng/sai). Gặp quyết định chưa có trong SPEC ⇒ dừng hỏi SO (🔴), không tự quyết.

## 6. MẪU REPORT `reports/R01_thi-cong_WP1.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm)`; dòng 2–4 `Handoff: handoffs/H01_thi-cong_WP1.md` / `Base: <sha>` / `Head: <sha; working tree chưa commit>`; bảng lệnh + exit nguyên văn; test tổng/pass/fail/skip; `git diff --stat` + file untracked trong phạm vi; test cũ đã đổi + lý do; bảng phân công (gói → tầng yêu cầu → họ/model); việc không làm + lý do; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.` (CẤM tự ghi phán quyết, CẤM để trống).

Report: `planning/08_2026-10-07_inflight-emergency/reports/R01_thi-cong_WP1.md` · Evidence: `planning/08_2026-10-07_inflight-emergency/evidence/WP1/<ten-do>.txt`
