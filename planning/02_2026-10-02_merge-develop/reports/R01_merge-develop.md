Vai: worker · loại: THI CÔNG (merge + giải xung đột) · họ/model: Claude Opus 5.5 (1M) · Bước 0 exit 0 · hiểu việc: merge `origin/develop` vào `feature/nhuy-cr03-p0`, nền lưu trữ của develop + toàn bộ CR-03 P0, xử Q04 có test; xong khi pytest 0 fail, ruff sạch, không còn file U, đúng một commit merge; cấm push/rebase/force, cấm sửa src/web, src/api ngoài chỗ bắt buộc, cấm xoá test, cấm .gitignore
Handoff: H01_merge-develop.md
Base: 853ed6f
Head: b4f8a5d (merge, parents 853ed6f + deab467)

## 1. Nền develop `deab467` (worktree tạm, đã gỡ)
Đo bằng `evidence/01-develop-baseline.txt`: pytest **185 passed, 20 deselected (marker `pg`, chỉ chạy với `--pg`), 0 skip**, exit 0. `ruff check` exit 0. `ruff format --check` **exit 1**: 2 file nợ từ trước (`src/api/routers/maintenance.py`, `src/maintenance/ai_logger.py`, plan lưu trữ 01 ghi nhận ở TESTING §6 G3). Có 47 test id chỉ ở develop.

## 2. Bảng xung đột: 13 file (handoff ghi 12, thực tế thêm `brain4agent/-data-architecture.md`)
| File | Cách giải |
|---|---|
| `src/maintenance/engine.py` | Nền develop (`repo`, `CasesView`/`StockView`, `_mutate_locked` dùng `tx.get_for_update`, `_commit(tx, …)`, `_Denied`) + CR-03: tham số `lexicon`/`safety_llm`; kiểm I-11 (BPTN trên blocker BQL) chạy trên bản đã khoá và ném `_Denied`; `_deny` gọi trong `op` (cổng Q19) thì hoãn: `_Denied` mang đủ tham số, ghi sau rollback (không lồng transaction); `_related_ticket_ids` đọc `repo.list()`; `_new_blocker`/`_schedule` theo Q04 (mục 3) |
| `src/maintenance/catalog.py` | `MissingInfoSla` chỉ còn `safety_context` (bỏ 24h/72h theo `f1c6ebf`); giữ `safety_review`; không lấy lại `reopen_window_days` (CR-03 bỏ reopen) |
| `seed/maintenance_v1/catalog.yaml` | Như trên: `missing_info: {safety_context: {escalate_after_hours: 12}}`, `safety_review` 4; ghi chú MISSING_INFO thường theo `bptn` |
| `docs/CR-BPTN-03.md` | Header ours + chú thích develop; luồng ours (2b trước phân loại, D-09) + câu "giao BPTN liên hệ cư dân"; §5.2 thêm "BPTN nhập đủ phần thiếu"; §8 lấy chữ develop; D-08..D-10 ours, develop D-10..D-12 đánh lại thành D-11..D-13; sửa các dòng auto-merge "3b"/khoá `safety_context_need_info` cho khớp code; thêm §19.1 |
| `brain4agent/` (8 file) | Q05: bản nhánh này làm nền, thêm sự thật develop (store/Supabase/`MO_STORE`, Alembic, gotchas lưu bền, plan lưu trữ 01, `f1c6ebf`); changelog thêm mục `[Unreleased]` hồ sơ 02; `state.json` giữ bản nhánh; `today.md` thêm đúng 1 dòng cho phiên này + nối 2 phiên của develop |

Ngoài xung đột (để hai phần chạy chung): `src/maintenance/messages.py` + `i18n/vi.yaml` thêm `safety_info_message`; `tests/test_maintenance/test_engine.py` 1 dòng hợp đồng `len(BPTN_REASONS) == 7` (`f1c6ebf` thêm MISSING_INFO); `test_store_memory.py` 5 chỗ, `test_store_postgres.py` 2 chỗ đổi trường dò `ticket.assignee_id` → `ticket.cancel_reason` (CR-03 ép `assignee_id: None`, gán chuỗi ném ValidationError; ý nghĩa test rollback/ConcurrencyError giữ nguyên). `ruff format` 2 file nợ của develop: `src/maintenance/ai_logger.py` (chỉ định dạng), **`src/api/routers/maintenance.py` +2 dòng trống trước dòng 253** (sửa duy nhất trong `src/api`, chỉ để đạt cổng format exit 0; `git diff deab467..HEAD -- src/api src/web` = 1 file, 2 insertions).

## 3. Điểm giao Q04 (`f1c6ebf` × NEED_INFO `safety_context`)
- MISSING_INFO thường: chủ BPTN, SLA `bptn` (develop). `bptn_resolve` gỡ xong → `_resume` → chạy lại từ bước 2, **2b chạy trên `info` BPTN nhập** (test: info có "hình như có mùi khét" → `SAFETY_REVIEW_REQUIRED`).
- NEED_INFO an toàn (T06): `bptn_resolve` → `GuardError` (409), không ghi gì; chủ blocker giữ RESIDENT (như code P0, develop gán MISSING_INFO cho BPTN); `next_retry_at=None` (nếu theo `bptn` sẽ nhắc mỗi giờ và leo thang sau 3 lần, trước mốc 12 giờ); leo thang 12 giờ lịch; lời cư dân giữ "Vui lòng bổ sung: …" (`safety_info_message`), không dùng câu "BPTN sẽ liên hệ".
- Test mới `tests/test_maintenance/test_cr03_store.py` (9 test, mỗi test có bản `postgres` chỉ chạy với `--pg`): 5 test Q04 + 4 test round-trip (5 method an toàn/khẩn cấp, `set_priority`, rating một lần) đọc lại bằng engine mới trên cùng repo, kiểm JSON round-trip + dòng audit trong `repo.log_rows()`. Đã làm đỏ 4 lần (`evidence/06-red-checks.txt`): bỏ guard Q04, cho NEED_INFO an toàn nhắc mỗi giờ, cho `_deny` mở transaction lồng (độ sâu 2), trả chủ về BPTN → mỗi lần 1 failed, exit 1; khôi phục → 9 passed.

## 4. Lệnh + exit (venv311, `LLM_MODE=mock`, `PYTHONUTF8=1`)
| Lệnh | Kết quả | Evidence |
|---|---|---|
| `python -m pytest -q -p no:cacheprovider -rs` | 1514 passed, 29 deselected, 0 fail, 0 skip, exit 0 (chạy lại sau commit: 1514 passed) | 02 |
| `ruff check src tests` / `ruff format --check src tests` | exit 0 / exit 0 (67 file) | 03 |
| safety+emergency+priority+store_memory+persistence_api+persistence_guards+photo_store+cr03_store | 1350 passed, 17 deselected, exit 0 | 04 |
| `git diff --name-only --diff-filter=U` | rỗng | 07 |
| `grep -cP '[\x08\x0c\x0b]'` 18 file sửa tay | 0 hết | 07 |
| `init_brain.js --check` | exit 0 | 07 |
| `git commit` (hook pre-commit) | exit 0, `b4f8a5d` | — |

Số test: 1514 = 1462 (HEAD) + 47 (chỉ ở develop) − 4 + 9 mới. 4 id mất KHÔNG do merge này xoá: mỗi cái đã bị một bên thay thế trước đó, git 3-way giữ bản thay thế (`evidence/05-test-ids.txt`): `test_02_…waits_for_the_resident…` và `test_missing_info_reminds_daily_…72h` (develop `f1c6ebf` thay), `test_09_reopen_window` và `test_invariant_2_agent_never_writes_assignee` (hồ sơ 01 thay). Vì vậy tiêu chí chữ "≥ 1462 + 47 = 1509" đạt 1514 nhưng chỉ nhờ 9 test mới; không tính chúng thì là 1505.

## 5. `git diff --stat 853ed6f..HEAD`
`110 files changed, 10038 insertions(+), 2576 deletions(-)` (đa số là nội dung develop). Phần `src tests seed docs/CR-BPTN-03.md brain4agent planning/02…`: 55 file, +5230/−503.

## 6. Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| Đo nền develop, merge, giải 13 xung đột, Q04 + test, evidence | 🔴 | Claude Opus 5.5 (một agent, không giao xuống tầng dưới) |

## 7. KHÔNG làm
- Không push, không PR, không bump version (plan Q07 / WP3).
- Không chạy `pytest --pg` (không có DB docker `*_test`): 9 bản `postgres` của test mới và 20 test pg của develop chưa được đo trên Postgres.
- Không sửa `docs/maintenance.md` (ngoài phạm vi handoff): §4/§6/§9 còn ghi "chưa persistence", SLA 72h; cần cập nhật ở bước đồng bộ não.
- Hai file ảnh `docs/flow_maintenanceops_v04.png`, `docs/flow_pb_cln_01.png`: **develop đã xoá chúng (`4b6f3bc`)**, nên `git merge` tự stage việc xoá và commit merge có xoá. Tôi không tự stage, không khôi phục. `docs/Activity Diagram.png` vẫn untracked.
- Không đồng bộ não đủ 6 điểm (plan §4 để sau WP2); chỉ giải xung đột theo Q05.

## 8. Câu hỏi mở
1. **Phân công nhân sự (mâu thuẫn Q03, không tự chọn):** develop (CR-03 §19, D-12 ở đó, nay D-13) ghi phòng ban tự ghi `assignee_id`; code develop có `set_assignee` cho phòng ban. CR-03 P0 (hồ sơ 01) chặn mọi `set_assignee` (403 + audit) và `assignee_id: None`. Git giữ hành vi P0 (develop không sửa đoạn này). Không router/UI nào ghi `assignee_id`. Cần người quyết; nhiều câu ở CR-03 §2/§4.4/§12.1/AC-15 đang theo bản develop, mâu thuẫn với code.
2. Chủ blocker NEED_INFO an toàn: develop CR-03 §6.4 ghi "vẫn là BPTN", code giữ RESIDENT (test P0). Có giữ không?
3. Có cho BPTN ghi lời cư dân qua điện thoại vào NEED_INFO an toàn (rồi chạy lại 2b) không? Hiện chặn (`GUARD_FAILED`).
4. Có giữ sửa format 2 dòng trống ở `src/api/routers/maintenance.py` không (chỉ để cổng format exit 0)?

Phán quyết:

SO đo lại 2026-10-02: pytest 1514 passed EXIT=0 (29 pg deselected) · ruff EXIT=0 · format EXIT=0 · không còn xung đột · src/api +2 dòng trống · holdout NONE 2/39, f_neg 0, a_b01 0, jx_negfp EM 0. Câu hỏi mở xử ở plan Q08.
✅ DUYỆT
