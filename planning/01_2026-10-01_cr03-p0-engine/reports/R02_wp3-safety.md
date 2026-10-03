Vai: worker · loại: thi công · họ/model: Claude Sonnet 5.5 (🟠) · Bước 0 exit: 0 · hiểu việc: cài tầng an toàn 2b (safety.py thuần, lexicon.yaml là dữ liệu, chèn 2b trước bước 2, guard LLM chỉ nâng mức, seed CLN-004/TEC-005 sang Bậc 1) + phần WP2 hoãn (loader lexicon, constructor lexicon/safety_llm, Expected/observe); xong khi pytest/ruff exit 0, tổng >= 149+76+15, REF 0 bỏ sót, S-01..S-07 + M-04 đúng, bộ đo mới từng đỏ, một commit local; CẤM api/web/docs/brain (trừ 1 dòng today.md), specs, plan, push, LLM thật
Handoff: H02_wp3-safety.md
Base: 27655d5b91110226424daf43bd11c2e2958f8c18
Head: 7839c3f3cf3e0c8474e7dfae8f6ca81ca08ea074

## Lệnh + exit (output máy nguyên văn ở `evidence/WP3/*.txt`, đã commit trong Head)
| Lệnh | Kết quả | File |
|---|---|---|
| `init_brain.js --check` | exit 0 (NÃO ĐÃ OK) | — |
| `python -m pytest -q -p no:cacheprovider` | `266 passed`, EXIT=0 | `pytest.txt` |
| `pytest --collect-only -q \| grep -c "::"` | 266 | `collect.txt` |
| `ruff check` / `ruff format --check src tests` | `All checks passed!` EXIT=0 / `49 files already formatted` EXIT=0 | `ruff.txt` |
| REF (OPERATIONS §1) | `TOTAL=84 BAD=0 TIER1_MISS=0 levels={'EMERGENCY': 22, 'UNCLEAR': 10, 'NONE': 44}`, `MERGE_SELFTEST=5 ok`, EXIT=0 | `ref.txt` |
| pytest `test_safety.py` | `117 passed`; in `false alarms: 0/44`, `tier-1 missed: 0/22` | `pytest-safety.txt` |
| M-04 | `17 10 2` | `contracts.txt` |
| S-03 / S-04 | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY None ['S-01', 'S-02']` / `... ['S-14']` | `contracts.txt` |
| S-05 | `VERIFYING SAFETY_REVIEW_REQUIRED UNCLEAR 4:00:00` | `contracts.txt` |
| S-06 | `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY` | `contracts.txt` |
| G-05 `evaluate` | `12 4 []` | `contracts.txt` |
| G-06 `test_fixtures.py` | `5 passed` | `contracts.txt` |

Test: tổng 266 · pass 266 · fail 0 · skip 0 (nền WP2 149; +117 trong `test_safety.py`: 42 `test_labelled_case` + 34 `test_regression_string_stays_none` + 7 `test_emergency_ticket_has_no_draft_no_department[S-xx]` + 34 test đơn). Ngưỡng WP3 149+76+15 = 240: đạt.
`grep -cP '[\x08\x0c\x0b]'` trên mọi file ghi: 0.

Làm đỏ (bộ đo mới từng ĐỎ):
- RED-1: `active_phases: [P1]` ⇒ `65 failed, 52 passed`, EXIT=1 (`red-phases.txt`).
- Xoá S-02 khỏi lexicon ⇒ `13 failed, 104 passed`, EXIT=1; gồm `test_labelled_case` SC-02/SC-08, `test_emergency_ticket_has_no_draft_no_department[S-02]`, `test_fixture_cln004_tec005_are_emergency` (`red-s02.txt`).
- Hoàn tác ⇒ `117 passed`, toàn bộ pytest EXIT=0 (`green-after-restore.txt`).

## git diff --stat 27655d5..7839c3f
```
 brain4agent/memory/hot/today.md                  |   1 +
 planning/.../evidence/WP3/*.txt (9 file)         |  50 +
 seed/maintenance_v1/lexicon.yaml                 | 200 +++++
 seed/maintenance_v1/tickets.yaml                 |  37 +-
 src/maintenance/catalog.py                       | 115 ++-
 src/maintenance/demo.py                          |   2 +
 src/maintenance/engine.py                        |  98 ++-
 src/maintenance/safety.py                        | 335 +++++
 tests/test_maintenance/data/safety_cases_p0.yaml |  96 +++
 tests/test_maintenance/test_api.py               |   2 +-
 tests/test_maintenance/test_engine.py            |   9 +-
 tests/test_maintenance/test_safety.py            | 471 +++++
 20 files changed, 1391 insertions(+), 25 deletions(-)
```
Cây còn lại không đụng: `D docs/flow_*.png` x2, `?? docs/Activity Diagram.png`.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP3 safety 2b (code + test + seed) | 🟠 | Claude Sonnet 5.5 (🟠); phần chuẩn hoá/so khớp tự làm, không giao xuống thấp hơn |

## Việc KHÔNG làm + lý do
- `_new_blocker(..., safety_context=...)` (12 h cho MISSING_INFO an toàn): P01 §5.5 trỏ P02 §5.3 = WP4.
- Method `safety_*`/`emergency_*`/`set_priority`, nhánh T03/T05/T06/T07/T10 trong `_human_transition`, deny BPTN trên blocker BQL: WP4.
- `priority.py`, `rate()` một lần: WP5. `Expected.priority` có khai báo + `observe.priority` (01 §9) nhưng chưa fixture nào dùng.

## Drift
1. `.gitignore` dòng 32 `data/` chặn `tests/test_maintenance/data/safety_cases_p0.yaml` (đường dẫn do SPEC quy định). Đã `git add -f` đúng file này; không sửa `.gitignore` (ngoài phạm vi). Cần SO quyết định có sửa `.gitignore` không.
2. P01 §3.1 ví dụ `norm = "mui khet o hanh lang"` cho `"MÙI  KHÉT!!! Ở HÀNH LANG"`, nhưng cùng mục nói `.;!?` được giữ ⇒ `norm` thực = `"mui khet!!! o hanh lang"`. Cài theo luật (và theo REF); test `test_normalize_with_map_quote_roundtrip` khẳng định quote `"MÙI  KHÉT"` cho match (0,8) như SPEC.
3. `tests/test_maintenance/test_engine.py` KHÔNG nằm trong cột ĐƯỢC GHI của WP3 nhưng phải sửa 1 test của chính WP2 (`test_p0_contract_queue_sort_key_and_bql_row_fields`: `len(rows) == 12` -> 10 vì CLN-004/TEC-005 thành Bậc 1; thêm assert hai ticket Bậc 1). Hậu quả bắt buộc của seed D13; xin SO xác nhận (nếu coi là 🔁, hoàn tác 9 dòng này và đổi test thành so với `engine.cases`).
4. `test_benign_lamp_report_routes_normally`: SPEC §5.6/TESTING nói "flow thường"; thực tế "Bóng đèn ... bị cháy" qua 2b NONE rồi bị proposer (không đổi, V-10) cho `OUT_OF_SCOPE`. Test khẳng định đúng điều thuộc WP3 (risk NONE, B-01 ghi vết, 2b không dừng, step 3 đã chạy), không ép `ROUTED`.
5. Mọi ticket qua pipeline nay có thêm 1 audit row `ASSESS_SAFETY` (cả NONE) theo P01 §5.3/§5.6; 149 test cũ vẫn xanh nên không có test phụ thuộc số audit.
6. `compile_pattern` dùng `functools.cache` (ruff UP033 cấm `lru_cache(maxsize=None)`); tương đương "cache theo pattern" của P01 §7.4.

## Câu hỏi mở
- Drift 1 và 3 cần SO phán (sửa `.gitignore`; chấp nhận hay hoàn tác sửa `test_engine.py`).
- `source_quote` của judgement LLM bịa (không có trong text) vẫn được lưu nguyên văn như LLM đưa (kèm status UNCLEAR + note), đúng REF; không thuộc khẳng định "quote là chuỗi con" (chỉ áp cho bản ghi RULE).

⏳ Chờ người duyệt.

SO đo lại 2026-10-01 18:00: pytest 266 passed EXIT=0 · ruff check EXIT=0 · ruff format EXIT=0 · diff 27655d5..7839c3f 20 file trong phạm vi WP3 (+ test_engine.py 9 dòng, chấp nhận Q21). Evidence làm đỏ có (red-phases, red-s02, green-after-restore). Drift 1–5 xử ở plan Q21–Q22.
✅ DUYỆT
