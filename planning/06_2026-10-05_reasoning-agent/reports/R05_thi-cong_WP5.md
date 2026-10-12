Worker · thi công · Sonnet 5.5 (🟠) · Bước 0 exit 1 (đúng một dòng `BRN-002 … khối luật: boot`, checkout CRLF Q21 ⇒ đi tiếp, không chạy chế độ ghi) · hiểu việc: phạm vi = `engine.py`, `errors.py`, `common.py`, `coordination/*` (chỉ khung + stub), `test_p1_infra.py`, evidence WP5, report này; xong khi = C-06…C-11 xanh (memory + pg), toàn bộ suite 0 fail/skip và ≥ nền + mới, ruff exit 0, đột biến thứ tự commit làm đỏ test thứ tự; cấm = `agent/**`, rules/safety/lexicon/models/enums/catalog, thân hook Wave 4, `agent=`/§4–§6 SPEC-P02, api/web, SPEC, plan, test cũ
Handoff: handoffs/H05_thi-cong_WP5.md
Base: 37cfd2dc50ebd9649a8a050d674f015ca5119636
Head: chưa commit (SO gộp)

## Số đo (output máy ở `evidence/WP5/`)
| Lệnh (env `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.`) | Exit | Kết quả | Evidence |
|---|---|---|---|
| `pytest -q -p no:cacheprovider tests/test_maintenance/test_p1_infra.py` TRƯỚC khi sửa engine | 1 | 16 failed, 1 passed (26 dòng `AttributeError`) | [red-before.txt](../evidence/WP5/red-before.txt) |
| cùng lệnh SAU khi sửa | 0 | 17 passed, 17 deselected (pg) | [green.txt](../evidence/WP5/green.txt) |
| `--pg` (DB `p151_wp5_test`) `test_p1_infra.py` + `test_store_postgres.py` | 0 | 46 passed, 0 skip | [pg.txt](../evidence/WP5/pg.txt) |
| đột biến: commit ticket chính SAU ticket liên quan (`--pg test_p1_infra.py`) | 1 | 2 failed (`test_c10b…[memory]`, `[postgres]`), 32 passed; khôi phục xong | [mutation-order.txt](../evidence/WP5/mutation-order.txt) |
| `pytest -q -p no:cacheprovider` toàn bộ | 0 | **3016 passed, 48 deselected**, 0 fail, 0 skip | [pytest.txt](../evidence/WP5/pytest.txt) |
| `test_safety_metamorphic.py test_classify_metamorphic.py` | 0 | 991 passed, 0 fail | [variants.txt](../evidence/WP5/variants.txt) |
| `ruff check src tests` + `ruff format --check src tests` | 0 / 0 | All checks passed; 90 files already formatted | [ruff.txt](../evidence/WP5/ruff.txt) |
| `grep -rc 'NotImplementedError("plan 06' src/maintenance` | — | tổng **8** (merge 3, department 3, neighbors 1, split 1) | (stdout) |
| `grep -cP '[\x08\x0b\x0c]'` trên 9 file đã ghi | — | 0 ở cả 9 | (stdout) |

Nền đo trước khi sửa (cùng base, bỏ file mới): `2999 passed, 31 deselected`. Sau: 3016 = 2999 + 17 (17 ca mới; 34 gồm cả biến thể pg).

## `git diff --cached --stat` (trước khi thêm report này)
```
16 files changed, 1584 insertions(+), 66 deletions(-)
 src/maintenance/engine.py (359 dòng đổi) · errors.py (+21) · common.py (+30)
 src/maintenance/coordination/{__init__ 13, department 54, merge 49, neighbors 21, split 14}
 tests/test_maintenance/test_p1_infra.py (+445)
 planning/06_2026-10-05_reasoning-agent/evidence/WP5/{red-before,green,pg,mutation-order,pytest,variants,ruff}.txt
```
Không file nào ngoài phạm vi (không đụng `test_engine.py`: dòng `23 + 7` đã đúng từ WP1). Worktree: `D:/P151/.claude/worktrees/agent-a15025a643ead2e7e`.

## Đã làm (theo SPEC-P02)
- §1: `errors.py` (`InvalidTransitionError`, `ActionDeniedError`, `AuditWriteError`), `common.py` (`LOCAL_TZ`, `AGENT_ID`, `SYSTEM_ID`, `DEFAULT_RESIDENT_ID`, `_blank`, `_suffix`, `_created_at`); `engine.py` import lại ⇒ đường import cũ chạy (test cũ không sửa). `MaintenanceEngine(MergeMixin, SplitMixin, DepartmentMixin, NeighborMixin)`; mixin không import `engine` (test chạy subprocess kiểm `sys.modules`).
- §2: `_Touched`, `_OpScope` (thêm trường `listing` để `repo.list()` đọc đúng một lần/thao tác), `_op_scope`, `_related_case`, `_insert_case`, `_case_view`, `_cases_snapshot`, `_build_case` (`_ingest` dùng nó), `_copy_additions`, `_copy_resident_photos`, `_link_pair`, `_mutate_locked` đúng khối SPEC (chính trước, rồi liên quan theo thứ tự chạm, ticket chèn `tx.insert` trước `_commit`, ticket không đổi không lưu), `_record_event(public_message=)`.
- §3: mọi chỗ gọi hook đặt đúng bảng (`_on_duplicate_detected` bước 4 sau `_related_case(root)`, `_merge_into(counted=False)`, `_t09/_t15/_t16/_t17`, `_after_cancel`, `_apply_pri_u1`, `_try_split` + nhánh `split_category` ở bước 3, `_carry_over_material_qty`, `_link_emergency_both_ways` ×3, `_hold_for_emergency`, `_release_waiting_for` ×3) + stub đúng cột "Thân stub"; thân T15 chuyển nguyên sang `DepartmentMixin`.
- "Sửa sẵn có": `_category` + `split_category`; `_append_addition` xoá `classification` chỉ khi cả hai khoá None; `_content`/`_location_text`/`_safety_scope_text` bỏ `merged_from`; `resident_photos` thêm `merged_from is None`; `_find_duplicate_ticket_id`/`_related_ticket_ids` quét `_cases_snapshot()`; nhánh `(VERIFYING, MERGED)` chỉ BPTN + DUPLICATE (thông điệp đúng SPEC); `to == MERGED` từ ON_HOLD/ROUTED ⇒ `InvalidTransitionError("Chỉ hoàn tác tách (undo_split) được gộp ticket ở trạng thái này")`; `return_wrong_department` ghim `expected_from=S.ROUTED`.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP5 a–d | 🟠 | Claude Sonnet 5.5 (một worker, không phát sinh gói con) |

## Việc KHÔNG làm / quyết định nhỏ cần SO biết
- Không sửa `_bind_category`: với nguồn `"AGENT_SPLIT"` nó rơi vào nhánh `else` (mô tả "Category do BPTN chọn", rule `PB-COM-R-OVR-01`) — sai chữ nhưng chưa có ticket nào mang `split_category` trước WP8; WP8/WP6 (P05/P02 §6.3) quyết nội dung đúng.
- `_copy_additions`/`_copy_resident_photos`: SPEC không nêu actor của audit `LINK_TICKETS` ⇒ ghi qua `_agent` (actor `AGENT_ID`, vai AGENT, không `rule_id`), nhất quán §5.3 ("ghi nội bộ qua `_agent`/`_audit`").
- `_link_emergency_both_ways` ở E01/T07 nhận `list(work.ticket.related_ticket_ids)` (đúng "như hiện tại": hai nhánh đó chưa tính `related_ticket_ids`); nếu WP10 muốn E01/T07 cũng liên kết ngược thì phải tính danh sách đó (đổi hành vi đường cũ) — xem Câu hỏi mở.
- Thân `_t09_unmerge_by_person` còn là stub nên `transition(MERGED→RECEIVED)` từ ticket MERGED ném `NotImplementedError` tới hết WP7 (trước WP5: 409). Không test cũ nào chạm; G-STUB bắt.
- Đột biến chỉ làm đỏ ca thứ tự (`test_c10b`), không làm đỏ C-10 pg: tại tầng khoá ngoại, `tx.insert` luôn đứng trước audit của chính ticket đó nên đảo thứ tự giữa các ticket không vi phạm khoá ngoại; handoff cho phép "C-10 (pg) hoặc ca thứ tự audit".
- Không `git commit`, không push; chỉ `git add` tường minh từng file.

## Câu hỏi mở
1. P07 §1 nói E01/T07 cũng "THÊM liên kết hai chiều", nhưng 2 nhánh này hiện không có `related_ticket_ids` — WP10 có được tính danh sách ở đó (đổi hành vi đường cũ) hay chỉ giữ nhánh 2b? (không chặn WP5)

## Tiếp theo
🖐 Cần tay người: không có.
🤖 Agent làm được ngay: SO gộp + commit WP5 (`refactor(engine): one-transaction multi-ticket writes, coordination mixins and P1 hooks (plan 06 WP5)`), rồi phóng WP6/Wave 4.
⭐ Nên làm trước: thẩm định WP5 độc lập (chạy lại `--pg` + đột biến) trước khi phóng Wave 4, vì cả 4 mixin dựa vào `_related_case`/`_mutate_locked`.
⏸ Chưa làm: thân hook Wave 4 (stub = 8), `agent=`/§4–§6 SPEC-P02 (WP6), sửa chữ `_bind_category` cho `AGENT_SPLIT`.

⏳ Chờ người duyệt.
