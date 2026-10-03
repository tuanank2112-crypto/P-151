Vai: worker · loại: thi công · họ/model: Claude Sonnet 5.5 (🟠) · Bước 0 exit: 0 · hiểu việc: dựng contract WP2 (enum, trường Ticket, TRANSITIONS 18+7, BLOCKER_OWNERS, PERMISSIONS, sla_config, i18n, views, bỏ reopen, SET_ASSIGNEE bị từ chối) chỉ trong cột ĐƯỢC GHI của WP2; xong khi pytest/ruff exit 0, tổng >= 142 + mới, M-01..M-03, M-05..M-08 đúng, một commit local; CẤM logic an toàn, hành động BPTN/BQL, priority, sửa api/web/docs/brain (trừ today.md), push
Handoff: H01_wp2-contracts.md
Base: 738a58b8dcf46f4ca06705b6df3895f5e415f117
Head: 619dc811dbf4715fd2c315a66b3e1fc609762b99

## Lệnh + exit code (nguyên văn; output máy gốc ở scratchpad `ev/*.txt`, KHÔNG ghi vào `planning/` vì handoff §2 cấm)
```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
... NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!      EXIT=0

$ python -m pytest -q -p no:cacheprovider      (LLM_MODE=mock, venv 3.11)
149 passed in 11.44s
EXIT=0

$ python -m ruff check src tests
All checks passed!
EXIT=0
$ python -m ruff format --check src tests
47 files already formatted
EXIT=0
```
Test: tổng 149 · pass 149 · fail 0 · skip 0 (nền 142).

## Số đo 01 §11 (mỗi lệnh đúng như SPEC)
```
M-01  25 False
M-02  15 True
M-03  4.0 12.0 3 False
M-05  False ['EMERGENCY_CLOSE', 'EMERGENCY_DOWNGRADE', 'SAFETY_CONFIRM_SAFE', 'SAFETY_ESCALATE', 'SAFETY_REQUEST_INFO', 'SET_PRIORITY']
M-06  (không dòng) exit=1
M-07  <class 'NoneType'> True True True False
M-08  4
P04 §8.2 grep reopen_until|reopen_window_days|REPORT_NOT_DONE trên src/maintenance seed tests: (không dòng) exit=1
P04 §10 G-02: NORMAL / INVALID_TRANSITION
P04 §10 G-03: ACTION_DENIED / ACTION_DENIED assignee_id
```
`grep -cP '[\x08\x0c\x0b]'` trên 10 file sửa + today.md: 0 hết.

Làm đỏ bộ đo mới: thêm lại `Action.SET_ASSIGNEE` vào PERMISSIONS ⇒ `test_p0_contract_permissions` FAILED (`1 failed, 1 passed`, EXIT=1); hoàn tác ⇒ `2 passed` EXIT=0.

## git diff --stat 738a58b8..619dc81
```
 brain4agent/memory/hot/today.md           |   1 +
 seed/maintenance_v1/catalog.yaml          |   9 +-
 src/maintenance/catalog.py                |  16 +++-
 src/maintenance/engine.py                 | 102 ++++++++++++---------
 src/maintenance/enums.py                  |  62 ++++++++++++-
 src/maintenance/i18n/vi.yaml              |   7 ++
 src/maintenance/models.py                 |  57 +++++++++++-
 src/maintenance/views.py                  |  68 ++++++++++++--
 tests/test_maintenance/test_acceptance.py |  22 +++--
 tests/test_maintenance/test_api.py        |   6 +-
 tests/test_maintenance/test_engine.py     | 143 +++++++++++++++++++++++++++---
 11 files changed, 409 insertions(+), 84 deletions(-)
```
Cây còn lại không đụng (của người khác): `D docs/flow_*.png` ×2, `?? docs/Activity Diagram.png`.

## Test đã sửa/thêm
Sửa (P04 §7 hàng WP2, 6 test): `test_invariant_5_event_chain_over_every_fixture_and_scenario`, `test_invariant_2_agent_never_writes_assignee` -> `test_invariant_2_nobody_writes_assignee`, `test_transition_table_matches_the_cr` (18+7, không CLOSED->RFR, owners == ReasonCode), `test_09_reopen_window` -> `test_09_no_reopen_and_closure_kind`, `test_12_resident_view_hides_internal_fields`, `test_resident_full_journey_over_http`.
Mới (7, test_engine.py): `test_p0_contract_blocker_groups_and_owners`, `..._new_transition_rows`, `..._permissions`, `..._ticket_cross_field_validators`, `..._route_blockers_flag_emergency`, `..._sla_config_and_i18n_keys`, `..._queue_sort_key_and_bql_row_fields`.
(today.md ghi "sửa 5 test cũ"; số đúng là 6.)

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP2 contracts + test | 🟠 | Claude Sonnet 5.5 (🟠), không giao xuống tầng thấp hơn |

## Việc KHÔNG làm + lý do
- 01 §5 (Lexicon/`SafetyLexicon`/`load_lexicon`, `seed/.../lexicon.yaml`), §3.5 (constructor `lexicon`/`safety_llm`), M-04: không thuộc danh sách §1–§4, §6, §8 của WP2 và `SafetyLLMClient` chưa tồn tại (safety.py = WP3); handoff loại M-04 khỏi đo WP2. Để WP3.
- 01 §9 (`Expected.risk_level/priority`, `demo.observe`): `demo.py` không nằm cột ĐƯỢC GHI WP2. Để WP3.
- 01 §7 method mới (`safety_*`, `emergency_*`, `set_priority`), nhánh `_human_transition` cho T03/T05/T06/T07/T10, chặn `_cleared`/BPTN: WP4. Hậu quả đã chấp nhận: T03/T05 bỏ `pipeline_only`, T06/T07/T10 có trong bảng nhưng gọi `transition()` tới các cặp đó hiện rơi vào `else` => `InvalidTransitionError` (an toàn, chưa có logic).
- `rate()` một lần: WP5.
- Evidence `.txt` vào `planning/.../evidence/WP2/`: handoff §2 cấm ghi `planning/` (trừ report); OPERATIONS §3.3 đòi ghi. Chọn theo handoff; output nguyên văn dán ở trên.

## Drift
1. 01 §4 yêu cầu dòng chú thích `# reopen_window_days: BỎ ...` trong `catalog.yaml`, nhưng M-06 (grep `reopen_window_days` trong `seed`) đòi 0 dòng ⇒ hai yêu cầu không cùng thoả. Đã viết chú thích không chứa tên khoá: `# Cửa sổ mở lại ticket: BỎ (CR-BPTN-03 §4.3 — không reopen)`; M-06 đúng.
2. P04 §8.2 grep `REPORT_NOT_DONE`/`reopen_*` trong `tests` = 0 ⇒ test mới của tôi không nêu các chuỗi đó.
3. Hai file `seed/.../catalog.yaml`, `i18n/vi.yaml`, các `.py` đều CRLF: giữ nguyên CRLF.

## Câu hỏi mở
- Evidence nên được SO tạo lại trong `planning/.../evidence/WP2/` từ lệnh trên, hay cho phép worker ghi ở WP sau?
- Báo hộ SO: `views.bql_rows` giờ trả theo `sort_queue` (01 §8) thay vì thứ tự chèn; 149 test vẫn xanh nên không phát hiện phụ thuộc thứ tự.

⏳ Chờ người duyệt.

SO đo lại 2026-10-01: pytest 149 passed EXIT=0 · ruff check EXIT=0 · ruff format EXIT=0 · diff 738a58b..619dc81 11 file trong phạm vi WP2. Drift 1 (chú thích catalog) chấp nhận; drift 2 (evidence) — từ H02 worker được ghi evidence/WPn/; mục 3 (bql_rows sắp theo queue_sort_key) đúng 01 §8; mục 4 SO sửa chữ today.md.
✅ DUYỆT
