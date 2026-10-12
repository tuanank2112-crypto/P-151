1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng lệch `BRN-002 … khối luật: boot` là do checkout CRLF (Q21) ⇒ ghi exit vào report và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/plan.md` §2 → `specs/00-ARCHITECTURE.md` (I-25…I-28) → `specs/01-CONTRACTS.md` §2, §6 → `specs/SPEC-P02-engine-integration.md` §1–§3, §7–§9 (phần WP5) → lướt SPEC-P04…P07 mục "Hook"/chữ ký để biết stub phục vụ ai → `specs/TESTING-ACCEPTANCE.md` §1, §3.4 (C-06…C-11), §5 (dòng WP5), §10 → `specs/OPERATIONS.md` §2 (dòng WP5), §7.

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151` (có thể là worktree riêng). Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base giao>`; cây bẩn ⇒ DỪNG, báo.
- Base giao đã có WP0–WP4 (hợp đồng, sàn an toàn P1, gói `agent/`, cấu hình + revision `0002`). Số test nền = số SO ghi trong prompt phóng.
- `PY=C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; mọi lệnh python đặt `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.` (`.env` của máy bật openai + khoá thật — KHÔNG đọc/in/chép, KHÔNG gọi mạng).
- `--pg`: container `p151-pgtest` (127.0.0.1:55433, `p151`/`p151`) do SO dựng; DB RIÊNG của bạn: `docker exec p151-pgtest createdb -U p151 p151_wp5_test` (có rồi thì bỏ qua), `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp5_test`. CẤM đụng container/DB khác.

## 2. PHẠM VI
- ĐƯỢC GHI (dòng "File được ghi" phần WP5 của SPEC-P02): `src/maintenance/engine.py`, `src/maintenance/errors.py` (mới), `src/maintenance/common.py` (mới), `src/maintenance/coordination/{__init__,merge,split,department,neighbors}.py` (mới — CHỈ khung + stub theo bảng §3), `tests/test_maintenance/test_p1_infra.py` (mới), `planning/06_2026-10-05_reasoning-agent/evidence/WP5/*`, `…/reports/R05_thi-cong_WP5.md`.
- CẤM: `agent/**`, `rules.py`, `safety.py`, `lexicon.yaml`, `models.py`, `enums.py`, `catalog.py`, thân hook Wave 4 (chỉ stub đúng cột "Thân stub" §3), tham số `agent=`/`build_engine`/§4–§6 của SPEC-P02 (WP6), `src/api/**`, `src/web/**`, SPEC, `plan.md`, mọi test cũ.

## 3. VIỆC PHẢI LÀM
a. Viết `test_p1_infra.py` C-06…C-11 (TESTING §3.4; C-06, C-10 dùng `STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]` như `test_cr03_store.py`; tên hàm mang ID) TRƯỚC; chạy ⇒ `AttributeError` ⇒ `evidence/WP5/red-before.txt`.
b. Thi công SPEC-P02 §1 (mixin + chuyển lỗi/hằng sang `errors.py`/`common.py`, re-export giữ đường import cũ), §2 (`_Touched`, `_OpScope`, `_op_scope`, `_related_case`, `_insert_case`, `_case_view`, `_cases_snapshot`, `_build_case`, `_copy_additions`, `_copy_resident_photos`, `_link_pair`, `_mutate_locked` mới, `_record_event(public_message=)`), §3 (mọi chỗ gọi hook + stub đúng bảng + `_after_cancel` + mục "Sửa sẵn có"). Đường hiện tại phải giữ NGUYÊN hành vi.
   Xong khi: `$PY -m pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_infra.py; echo EXIT=$?` ⇒ `EXIT=0` ⇒ `evidence/WP5/green.txt`; `--pg` cùng file + `test_store_postgres.py` ⇒ `EXIT=0` ⇒ `evidence/WP5/pg.txt`.
c. Đột biến: commit ticket thứ hai TRƯỚC ticket chính trong `_mutate_locked` ⇒ C-10 (pg) hoặc ca thứ tự audit đỏ ⇒ `evidence/WP5/mutation-order.txt`; khôi phục.
d. Cổng chung: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP5/pytest.txt` (+`EXIT=$?`): 0 fail/skip, tổng ≥ nền + mới; bộ biến thể `test_safety_metamorphic.py test_classify_metamorphic.py` 0 fail ⇒ `evidence/WP5/variants.txt`; ruff check + format ⇒ `evidence/WP5/ruff.txt` `EXIT=0`. Đếm stub: `grep -rc 'NotImplementedError("plan 06' src/maintenance` ⇒ ghi số vào report (được phép > 0 tới hết Wave 4).

## 4. LUẬT
- Ghi file bằng Write/Edit, KHÔNG heredoc bash cho mã; mọi file đã ghi: `grep -cP '[\x08\x0b\x0c]' <file>` = 0.
- CẤM gọi `_mutate`/`transition`/`receive`/`resume` trong `op`; mọi ghi ticket thứ hai qua `_related_case`/`_insert_case`; không ghi ticket đã kết thúc (I-26).
- Test cũ đỏ ⇒ sửa code (không sửa test). SPEC buộc đổi test cũ ⇒ DỪNG, "Câu hỏi mở".
- Không commit/push, không `git add -A`; cuối việc `git add` TƯỜNG MINH từng file — SO gộp + commit. Không sửa SPEC/plan. Evidence = output máy, CẤM sửa tay.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
|---|---|---|
| WP5 a–d | 🟠 | SPEC chữ ký đầy đủ + test hạ tầng tự biết đúng/sai |

## 6. REPORT PHẢI CÓ
Mẫu `D:/brain4agent.release/docs/HANDOFF_PROTOCOL.md` §7: dòng 1 khai vai; `Handoff: handoffs/H05_thi-cong_WP5.md`; `Base: <SHA trước sửa>`; `Head: chưa commit (SO gộp)`; lệnh + exit; test tổng/pass/fail/skip (+deselected); `git diff --cached --stat`; đường worktree; số stub; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
Report: `planning/06_2026-10-05_reasoning-agent/reports/R05_thi-cong_WP5.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP5/pytest.txt`
