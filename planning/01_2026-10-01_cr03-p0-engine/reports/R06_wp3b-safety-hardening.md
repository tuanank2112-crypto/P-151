Vai: worker · loại: thi công · họ/model: Claude Sonnet 5.5 (🟠) · Bước 0 exit: 0 · hiểu việc: sửa tầng an toàn 2b theo R05 N-01..N-10 với kỳ vọng Q25–Q27 (phủ định/hedge/marker chỉ trong cùng mệnh đề, B-01/B-04 hẹp lại, từ vựng bổ sung, chuẩn hoá ký tự lạ, bỏ O(n²), giới hạn 5000 ký tự, `>=` ở N-09, priority tôn trọng phủ định); ghi ca có nhãn ĐỎ trước rồi mới sửa; xong khi pytest/ruff exit 0, tổng >= 313+ca mới, 0 bỏ sót Bậc 1, auditor scripts chạy lại, một commit local; CẤM api/web/docs/.gitignore/specs/plan/rules/proposer/views/tickets.yaml, push, LLM thật
Handoff: H05_wp3b-safety-hardening.md
Base: a23a85f656cee8d0e76b90672ca271e0aa8ccf89
Head: 4983020fd41a60be85eaf83048f30527ed9b5d13

## Lệnh + exit (output máy ở `evidence/WP3b/*.txt`, đã commit trong Head)
| Lệnh | Kết quả | File |
|---|---|---|
| `init_brain.js --check` | exit 0 | — |
| Ca ĐỎ viết trước khi sửa (SC-43..SC-76 + 5 test N-07/N-09/N-10/N-05) | `37 failed, 315 passed`, EXIT=1 | `red-before.txt` |
| `python -m pytest -q -p no:cacheprovider` sau sửa | `352 passed`, EXIT=0 | `pytest.txt` |
| `pytest --collect-only -q \| grep -c "::"` | 352 | `collect.txt` |
| `ruff check` / `ruff format --check src tests` | `All checks passed!` EXIT=0 / `52 files already formatted` EXIT=0 | `ruff.txt` |
| `test_safety.py` + `test_priority.py` | `175 passed`; `false alarms: 0/46`, `tier-1 missed: 0/52` | `pytest-safety.txt` |
| REF prototype (không sửa) trên bộ spec | `TOTAL=84 BAD=0 TIER1_MISS=0`, `MERGE_SELFTEST=5 ok` | `ref-unchanged.txt` |
| Script auditor chạy lại | `a_text`: 1 FAIL (A4, xem dưới), `a_text2`: BAD 0, `a_fuzz`: `combos 900 issues 0`, `a_dos` + `dos2` | `auditor-rerun.txt` |

Test: tổng 352 · pass 352 · fail 0 · skip 0 (nền 313; +39: 34 ca nhãn SC-43..SC-76 và 5 test mới `test_assess_is_linear_on_a_24kb_text`, `test_description_length_limit_is_a_validation_error`, `test_tier1_without_location_in_the_engine`, `test_addition_at_the_same_instant_as_the_clearance_is_rescanned`, `test_negated_obstruction_is_not_h2`).
Bỏ sót Bậc 1: 0/52 (22 ca cũ + 30 ca mới). Báo nhầm: 0/46 ca NONE (44 cũ giữ nguyên + 2 ca giữ-phủ-định mới SC-75, SC-76). 84 ca cũ vẫn 0 sai.
`grep -cP '[\x08\x0c\x0b]'` trên các file ghi: 0.

## Bảng N-01..N-10 (kỳ vọng Q25–Q27)
| N | Ca (test) | Kỳ vọng | Trước sửa | Sau sửa |
|---|---|---|---|---|
| N-01 | SC-43..SC-49 (phẩy, xuống dòng, "không phải", "chưa thấy", "không bị gì") | EMERGENCY | NONE | EMERGENCY |
| N-02 | SC-50..SC-57 (marker "đã tắt/hết rồi", câu hỏi "đã ổn chưa?", hedge "nghi là/có vẻ/chưa rõ", liên từ và/nhưng) | EMERGENCY | UNCLEAR | EMERGENCY |
| N-03 | SC-58 (ổ cắm cạnh đèn bị cháy đen) | >= UNCLEAR | NONE | UNCLEAR (B-03) / SC-74 tủ điện cháy EMERGENCY |
| N-04 | SC-59..SC-61 (bếp cạnh hộp điện, dây điện màu nâu, nồi chiên) | EMERGENCY | UNCLEAR | EMERGENCY; SC-18 (nấu ăn thật) vẫn UNCLEAR |
| N-05 | SC-62..SC-69 (ngất, kẹt thang máy, hỏa hoạn, khói mù mịt, lửa bốc, dây bị hở, hở điện, ngất thiếu vị trí) | EMERGENCY | NONE | EMERGENCY; `test_tier1_without_location_in_the_engine` xanh (Q08) |
| N-06 | SC-70..SC-72 (kéo dài, zero-width, full-width) | EMERGENCY | NONE | EMERGENCY |
| N-07 | assess 24 KB; `receive` 5000/5001 | < 1 s; 5001 => 422 | 2,3 s (6 KB), 43 s (24 KB); không giới hạn | assess 24 KB: 0,31 s / 0,16 s / 0,12 s; `receive` 5000 ký tự 0,044 s; 5001 và 6027 ký tự => `ValidationError` (422) |
| N-08 | SC-73 (không phải không có khói) | >= UNCLEAR | NONE | UNCLEAR (rule `B-02D`) |
| N-09 | `test_addition_at_the_same_instant_as_the_clearance_is_rescanned` | quét lại 2b | không quét | quét (`>=` ở `_safety_scope_text` và `_cleared`) |
| N-10 | `test_negated_obstruction_is_not_h2` | không H2 khi bị phủ định | HIGH PRI-H2 | MEDIUM PRI-M2 / không H2; "không chắn lối đi nhưng trơn trượt" vẫn H2 |

## git diff --stat a23a85f..4983020
```
 brain4agent/memory/hot/today.md                  |   1 +
 planning/.../evidence/WP3b/*.txt (7 file)        |  78 +
 seed/maintenance_v1/lexicon.yaml                 |  44 +-
 src/maintenance/catalog.py                       |  12 +
 src/maintenance/engine.py                        |   4 +-
 src/maintenance/models.py                        |   5 +-
 src/maintenance/priority.py                      |  18 +-
 src/maintenance/safety.py                        | 316 +++---
 tests/test_maintenance/data/safety_cases_p0.yaml |  36 +
 tests/test_maintenance/test_priority.py          |  16 +
 tests/test_maintenance/test_safety.py            |  76 +-
 17 files changed, 509 insertions(+), 96 deletions(-)
```
Cây còn lại không đụng: `D docs/flow_*.png` x2, `?? docs/Activity Diagram.png`.

## Thiết kế (ngắn)
- `safety.py`: chuẩn hoá NFKC -> lower -> NFD, bỏ ký tự định dạng (Cf) không chèn khoảng trắng, gộp chuỗi >= 3 chữ giống nhau còn 1; `,:()—–` và xuống dòng thành điểm ngắt mệnh đề nhưng `norm` vẫn giữ khoảng trắng (cụm từ vẫn khớp xuyên dấu phẩy); liên từ lấy từ lexicon (`clause_conjunctions`). `TextContext` tách câu/mệnh đề một lần, tra bằng `bisect`; phủ định/hedge/marker chỉ xét trong mệnh đề; marker ở mệnh đề sau chỉ hạ khi bắt đầu bằng "giờ" (giữ SC-14 "tia lửa, giờ hết rồi"). Hai phủ định không chồng nhau trong cửa sổ => UNCLEAR. B-01 bị bỏ khi mệnh đề có thiết bị điện khác (`non_lamp_electrical`); B-04 chỉ hạ khi có ngữ cảnh nấu ăn và không có từ điện (`khet_electric_contexts`), "nấu" so khớp trên văn bản gốc có dấu (`khet_benign_contexts_accented`).
- `priority.py` dùng cùng ngữ cảnh mệnh đề và danh sách phủ định (`priority.negation_prefixes`). `models.py`: `MAX_DESCRIPTION_CHARS = 5000` cho `RawTicket.original_description` và `ResidentAddition.content`.
- Các khoá lexicon mới đều có giá trị mặc định rỗng nên `LEXICON-P0.yaml` của spec (REF) vẫn nạp được.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP3b hardening (code + lexicon + ca nhãn) | 🟠 | Claude Sonnet 5.5 (🟠), không giao xuống thấp hơn |

## Việc KHÔNG làm + lý do
- `cancel_reason` hiển thị nguyên văn cho cư dân, `cancel` thiếu AuditEvent: ngoài phạm vi (Q27, Idea Vault).
- Không sửa REF/specs/views/rules/proposer.

## Drift
1. N-07: `receive` 24 KB không còn tồn tại (giới hạn 5000 ký tự). Đo `assess` 24 KB riêng (0,31 s) và `receive` 5000 ký tự (0,044 s); script gốc `a_dos.py` nay báo `KeyError: 'big'` vì báo cáo 6 KB bị từ chối (đúng ý Q26).
2. `a_text.py::A4` (phủ định kép) vẫn "FAIL" theo kỳ vọng cũ EMERGENCY của auditor; kỳ vọng chốt ở Q25(2) là >= UNCLEAR, kết quả UNCLEAR (rule `B-02D`).
3. Thêm ngoài danh sách N: mẫu "tủ điện/ổ cắm/dây điện/công tắc/hộp điện/cầu dao ... bị cháy" vào S-05 (R05 A24, SC-74) và lookahead `ngất` loại "ngắt điện/ngắt cầu dao..." (SC-76) để không dùng `ngat` trần (SPEC-P01 CẤM 3). Khoảng cách tối đa 8 từ, không xuyên chữ phủ định hay danh từ đèn.
4. Vì B-04 nay đòi "không có từ điện", mọi câu có chữ "đến/đèn" (chuẩn hoá thành `den`) cùng câu với "khét" sẽ giữ Bậc 1: nghiêng về an toàn (Q25), có thể tăng báo nhầm ở câu nấu ăn; hiện 0 ca nhãn bị ảnh hưởng.
5. `a_fuzz.py` chạy 900 tổ hợp, 0 vấn đề (không đổi so với R05).

## Câu hỏi mở
- Trường rà nhãn các từ mới trong `lexicon.yaml` (`thang may ket`, `thay lua`, `chay lan`, `bi xiu`) và danh sách `khet_electric_contexts`.

⏳ Chờ người duyệt.

SO đo lại 2026-10-02: pytest 352 passed EXIT=0 · ruff EXIT=0 · format EXIT=0 · diff a23a85f..4983020 17 file trong phạm vi H05. Spot-check 5 câu bỏ sót của R05 ⇒ EMERGENCY; "bóng đèn … bị cháy" ⇒ NONE (B-01). Drift 1–4 chấp nhận (A4 phủ định kép = UNCLEAR đúng Q25(2)).
✅ DUYỆT
