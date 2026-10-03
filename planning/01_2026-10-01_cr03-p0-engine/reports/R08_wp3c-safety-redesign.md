Vai: worker · loại: thi công · họ/model: Claude Sonnet 5.5 (🟠) · Bước 0 exit: 0 · hiểu việc: cài thiết kế tầng an toàn R1–R10 (SPEC-P01 WP3c, 01 §5, SPEC-P03 §1) thay cơ chế cửa sổ 4 từ và `non_lamp`, chỉ trong "File được ghi (WP3c)" (không đụng engine.py); viết test §4.1 + bộ dừng §11 TRƯỚC và thấy ĐỎ rồi mới cài; xong khi pytest/ruff exit 0, collected >= 1378, D-1…D-7 và D-9 đạt (D-8 holdout do SO đo), RED-6…RED-10 có cặp red/green, M-04/M-09/M-10 đúng, assess 24 KB < 1 s, một commit local; CẤM engine/models/views/rules/proposer/api/web/specs/plan/.gitignore, `safety_cases_p0.yaml`, đọc holdout, chép bản thử architect
Handoff: H06_wp3c-safety-redesign.md
Base: c9119719501675ba53905e0b07cfaef4c06bc0c0
Head: 6034a2ef72b78682920ffd9c60dc9cfa8136c389

## Lệnh + exit (output máy ở `evidence/WP3c/*.txt`, đã commit trong Head)
| Lệnh | Kết quả | File |
|---|---|---|
| `init_brain.js --check` | exit 0 | — |
| Test §4.1 + bộ dừng §11 viết trước, chạy trên code HEAD (RED-6) | `286 failed, 1092 passed` (collected 1378) | `red-before.txt` |
| `python -m pytest -q -p no:cacheprovider` sau cài | `1378 passed`, EXIT=0 | `pytest.txt` |
| `pytest --collect-only -q \| grep -c "::"` | 1378 | `collect.txt` |
| `ruff check` / `ruff format --check src tests` | `All checks passed!` EXIT=0 / `52 files already formatted` EXIT=0 | `ruff.txt` |
| `test_safety.py` + `test_priority.py` | `1201 passed`, EXIT=0 | `pytest-safety.txt` |
| 16 script bộ dừng chạy nguyên văn (§11.5, `AUDIT_ROOT=D:\P151`) | 16/16 `EXIT=0`, số liệu ở bảng dưới | `stopsets-scripts.txt` |
| sha256 18 script nguồn | khớp 18/18 giá trị ở TESTING §11.1 | `sha256.txt` |
| trích bộ dừng bằng `ast` + khứ hồi YAML | `ROUNDTRIP_DIFF 0`, `RAW_INVISIBLE 0`, `LABELLED 145 SEPARATORS 40 BUDGET_TEXTS 112`, `negations 10 signals 10 joiners 8`, 792 dòng | `stopsets-roundtrip.txt` |
| M-04 / M-09 / M-10 / S-03…S-06 / G-05 | `17 10 2` · `2 80 20 ('co','thay','bi','he','duoc','con') ('S-09',) ['bat dong','khoi','lua','mau'] True False 2026-10-02.p0c` · bốn file `:0` · S-03 `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY None ['S-01','S-02']`, S-04 `... ['S-14']`, S-05 `... UNCLEAR 4:00:00`, S-06 `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY`, G-05 `12 4 []`; grep tên đã xoá (`words_before`, `is_negated`, `negation_spans`, `WINDOW_CHARS`, `negation_window_words`, `hedge_window_words`, `non_lamp`) `exit=1` (không còn) | `contracts.txt` |

Test: tổng 1378 · pass 1378 · fail 0 · skip 0 (nền 352; +1026: 989 bộ dừng + 26 R10 + 10 test đơn ở `test_safety.py` + 1 ở `test_priority.py`). `grep -cP '[\x08\x0b\x0c]'` trên mọi file ghi: 0.
RED-6: bộ dừng đỏ đúng 251 (combo 175, separator 24, labelled 49, budget 3), `test_lexicon_r10_vocabulary` 24/26, 9 test đơn (R1, R3, R4, R5, R6, R7, R8, R9, validator) + `test_priority_uses_shared_scope` + `test_llm_present_needs_grounded_quote`: 286 = đúng kỳ vọng TESTING §6.

## Tiêu chí dừng D-1…D-10 (TESTING §10)
| # | Đo | Kết quả | Ngưỡng |
|---|---|---|---|
| D-1 | `test_labelled_case[SC-43…SC-76]` + `a_text`/`a_text2` | 0 lọt; `a_text` `BAD 1` (chỉ A4 phủ định kép => UNCLEAR, đúng Q25.2); `a_text2` `BAD 0` | 0 lọt, chỉ A4 |
| D-2 | `test_stop_set_labelled[145]` + `a_split`, `c_uni`, `c_elong`, `i_recall`, `f_neg`, `a_b01` | 0/145 đỏ; `a_split` 0; `a_b01` 0; `f_neg` `FAILS: 0`; `c_uni` `FAILS: 5` và `c_elong` `FAILS: 6` = đúng 11 id giới hạn đã biết §11.4; `i_recall` `{'EMERGENCY': 31, 'UNCLEAR': 9, 'NONE': 2}` (2 NONE = 2 câu P1) | 0 lọt ngoài §11.4 |
| D-3 | `test_stop_set_combo_is_emergency[800]`, `test_stop_set_separator_is_emergency[40]` + `f_neg`, `a_sep`, `jx_coord`, `a_b01` | 0 đỏ; `f_neg` 0/100 (mọi ngăn cách 0/100); `a_sep` 0; `jx_coord` 0/100 × 4 cầu nối; `a_b01` 0 | 0 |
| D-4 | `test_false_alarm_budget[fixture]` + `j_fix` | EMERGENCY = {CLN-004, TEC-005}; `{'NONE': 10, 'EMERGENCY': 2}` | đúng 2 |
| D-5 | `b_fp` (59) | EMERGENCY 0, UNCLEAR 4 (cơm khét B-04, nấu ăn khét B-04, kêu ù ù T2-04, khói bếp nướng R9) | EM <= 1, UNCLEAR <= 5 |
| D-6 | `jx_negfp` (20) | `{'EMERGENCY': 0, 'UNCLEAR': 1, 'NONE': 19}` | EM <= 2 |
| D-7 | `b_fp2` (33) | EMERGENCY 3 ("gãy chân/tay" của đồ vật, S-09), UNCLEAR 1 (khó thở nhẹ T2-05) | EM <= 3 (đúng ngưỡng) |
| D-8 | holdout của judge | **SO đo** (worker không đọc, không chạy `jx_holdout.py`) | NONE <= 3/39 |
| D-9 | `test_assess_is_linear_on_adversarial_24kb_texts` + `test_assess_is_linear_on_a_24kb_text` | chậm nhất 0,275 s (6 văn bản >= 24 000 ký tự); 24 KB một mệnh đề 0,162 s | < 1 s |
| D-10 | G1, G2 | 1378 passed, 0 fail, 0 skip; ruff EXIT=0 | >= 1378 |
Ngoài D: `g_prio` `FAILS 1` và dòng FAIL duy nhất là `g10` (R-09); R-08 = `test_priority_uses_shared_scope` xanh (`priority.scope_before is safety.scope_before`); `a_fuzz` `combos 900 issues 0`.

## RED-6…RED-10 (TESTING §6)
| # | Cách làm đỏ | Đỏ | Xanh sau hoàn tác |
|---|---|---|---|
| RED-6 | test + bộ dừng trước khi sửa code | 286 đỏ (`red-before.txt`) | 1378 xanh (`pytest.txt`) |
| RED-7 | `merge_spans` trả `sorted(spans)` | `test_overlapping_matches_are_judged_once` đỏ: EMERGENCY thay vì NONE, EXIT=1 (`red-7.txt`) | EXIT=0 (`green-7.txt`) |
| RED-8 | cửa sổ `lo = 0` (bỏ mệnh đề + 80 ký tự) | `test_assess_is_linear_on_adversarial_24kb_texts` đỏ: 3,54 s, EXIT=1 (`red-8.txt`) | EXIT=0 (`green-8.txt`) |
| RED-9 | bỏ kiểm `resolved_bridge_tokens` (A2) | `test_hedge_adjacent_and_marker_after_signal` đỏ: UNCLEAR thay vì EMERGENCY, EXIT=1 (`red-9.txt`) | EXIT=0 (`green-9.txt`) |
| RED-10 | danh từ đèn đã chứng minh (A1) luôn đúng | `test_b01_closed_prefix_twenty_tokens_and_lamp_accent` đỏ: NONE thay vì UNCLEAR, EXIT=1 (`red-10.txt`) | EXIT=0 (`green-10.txt`) |
Sau cả bốn lần hoàn tác: `1378 passed` EXIT=0, ruff EXIT=0 (`green-after-restore.txt`).

## git diff --stat c911971..6034a2e
```
 brain4agent/memory/hot/today.md                    |   1 +
 planning/.../evidence/WP3c/*.txt (18 file)         | ~750
 seed/maintenance_v1/lexicon.yaml                   | 146 ++--
 src/maintenance/catalog.py                         | 148 +++-
 src/maintenance/priority.py                        |  20 +-
 src/maintenance/safety.py                          | 416 ++++++--
 tests/test_maintenance/data/safety_stop_sets_p0.yaml | 792 +++ (mới, `git add -f`)
 tests/test_maintenance/test_priority.py            |  21 +
 tests/test_maintenance/test_safety.py              | 324 ++++-
 26 files changed, 2416 insertions(+), 211 deletions(-)
```
Chỉ đường dẫn thuộc "File được ghi (WP3c)"; `engine.py`, `models.py`, `views.py`, `rules.py`, `proposer.py`, `safety_cases_p0.yaml` không đổi. Cây còn lại không đụng: `D docs/flow_*.png` x2, `?? docs/Activity Diagram.png`.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP3c thiết kế lại phạm vi (code + lexicon + test + bộ dừng) | 🟠 | Claude Sonnet 5.5 (🟠), không giao xuống thấp hơn |

## Việc KHÔNG làm + lý do
- D-8 (holdout): thuộc SO; không đọc `jx_holdout.py` trong `audit2/`.
- Không đọc/chép `scratchpad\arch3\root2` (bản thử architect): cài từ SPEC; mọi số khớp bản thử nên không cần đối chiếu mã.
- Không sửa `safety_cases_p0.yaml`, `LEXICON-P0.yaml`, REF (lịch sử đóng băng); 84 ca cũ + SC-43…SC-76 vẫn chạy qua `test_labelled_case` / `test_regression_string_stays_none` (xanh).
- Không bật LLM; chữ ký `assess_with_llm`/`merge_llm` giữ nguyên nên không sửa `engine.py`.

## Drift
1. TESTING §6 RED-8 nói đặt `lo = 0` "trong `_judge`"; cài của tôi tách cửa sổ thành hàm `_window` (dùng chung cho R1, R4, hedge), nên làm đỏ ở dòng `lo = ...` của `_window`. Kết quả đúng ý (3,54 s trên văn bản 24 KB).
2. TESTING §4.1 `test_lexicon_wp3c_keys_and_validator` liệt kê 6 biến thể hỏng; tôi chạy đúng 6 (`homographs.chay=["chả"]`, `homograph_intended` trỏ pattern không có, bỏ `va`, cue có dấu `"không có"`, khoá `negation_window_words`, `priority.scope_max_chars = 81`).
3. Hệ quả R6 cần Trường biết (an toàn, không ca nhãn nào bị ảnh hưởng): "chập chờn" đứng riêng không có danh từ đèn đã chứng minh trong mệnh đề nay là UNCLEAR (T2-03) thay vì NONE; `b_fp` "Đèn tuýp … kêu ù ù" là 1 trong 4 UNCLEAR vì T2-04 (không phải B-01).
4. `khet_electric_contexts` có `den` (chuẩn hoá của "đèn", cũng của "đến/đen"): câu có "đến" cùng câu với "khét" không được hạ B-04 (nghiêng Bậc 1, đúng Q25/P1-02). Giá trị đúng như 01 §5.3, không đổi.
5. `catalog.py` thêm `import unicodedata` và hàm `_fold` (01 §5.1) trùng chức năng `_fold` của `safety.py`; hai bản cố ý độc lập (catalog không được import safety, 01 §10 CẤM 5).
6. Bốn lần RED-7…RED-10 chạy trên bản sao lưu rồi chép lại; `git diff` sau cùng khớp commit (không còn dòng làm đỏ).

## Câu hỏi mở
- Các điểm architect đã ghi sẵn (A1–A4, `c-fullwidth-no-space`, 2 câu P1 `nóng đỏ rực`/`mùi gas`) giữ nguyên theo SPEC; không có câu hỏi mới.
- `b_fp2` đang đúng ngưỡng 3 EMERGENCY ("gãy chân/tay" của đồ vật, S-09): mọi thay đổi từ vựng S-09 sau này phải chạy lại bộ dừng (01 §5.5).

⏳ Chờ người duyệt.

SO đo lại 2026-10-02: pytest 1378 passed EXIT=0 · ruff EXIT=0 · format EXIT=0 · diff c911971..6034a2e src/seed/tests đúng "File được ghi (WP3c)" (không engine/models/views). D-8 holdout (SO tự chạy, worker không xem): {EMERGENCY 30, UNCLEAR 6, NONE 3}/39 ≤ 3 ĐẠT; lỗ từ vựng holdout (vd "có người bên trong không ra được") ⇒ thêm YAML sau, không chặn (Q29). f_neg 0 · a_b01 0 · jx_negfp EMERGENCY 0 · b_fp2 FLAGGED 4 (EMERGENCY 3 ≤ 3). Drift 1–3 chấp nhận.
✅ DUYỆT
