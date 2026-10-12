Worker · thi công · Anthropic/Opus 5.5 (claude-opus-5-5[1m]) · Bước 0 exit 1 (CẦN NÂNG CẤP: BRN-002 khối boot AGENTS.md, BRN-028 today.md 181 dòng; KHÔNG chạy chế độ ghi) · hiểu việc: thêm ≥6 mẫu biến thể chèn vị trí GIỮA câu (phải làm đỏ 8/12 cặp p6 trên bản cũ), sửa khối `safety` của lexicon + `safety.py` cho hết bỏ sót (b)(c), hết báo nhầm (d)(e), không hạ mức câu đang đúng / xong khi: pytest exit 0 ≥ 2780 + test mới, biến thể 0 vi phạm (hoặc từng vi phạm + lý do), p6 0/12 bị hạ, p3 45/45 EMERGENCY, bộ dừng 1065 xanh, false alarm 0, ngân sách không vượt trần, redteam ≤ 7 lỗi, ruff 0, có bằng chứng ĐỎ / cấm: rules.py, proposer.py, engine.py, src/api, src/web, test/nhãn cũ, docs/, brain4agent/, `lexicon_version`, khối `priority`, commit, agent con
Handoff: H03_safety-round2.md
Base: 699a566
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-ae8fde84568a4125f)

## Lệnh + exit (`LLM_MODE=mock PYTHONUTF8=1`, venv `scratchpad/venv311`)
| # | Lệnh | Kết quả | Exit |
|---|---|---|---|
| 0 | `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | `CẦN NÂNG CẤP` (BRN-002, BRN-028) | 1 |
| 1 | `python -m pytest -q -p no:cacheprovider` (Base 699a566) | `2780 passed, 29 deselected` | 0 |
| 1 | như trên, sau sửa | `2840 passed, 29 deselected` (= 2780 + 47 test metamorphic mới + 13 ca SC-243…SC-256) | 0 |
| 2 | `python -m tests.test_maintenance.test_safety_metamorphic` (bản cũ lexicon + safety.py, bộ mẫu mới) | `VARIANTS=5669 VIOLATIONS=216` | 0 |
| 2 | như trên, sau sửa | `VARIANTS=5669 VIOLATIONS=0` (4 biến thể được chấp nhận, xem dưới) | 0 |
| 2 | `ROOT=<worktree> python scratchpad/agent_audit/probe.py p6.txt` | trước: 8/12 cặp bị hạ (EM→NONE/UNCLEAR) · sau: 24/24 câu EMERGENCY, 0/12 cặp bị hạ | 0 |
| 2 | `… probe.py p3.txt` | trước: 37/45 EMERGENCY · sau: 45/45 EMERGENCY (không có câu P1 trong p3) | 0 |
| 3 | `pytest tests/test_maintenance/test_safety.py -k stop_set` | `1066 passed` (1065 ca bộ dừng + 1 test cùng khớp `-k`) | 0 |
| 3 | `pytest test_safety.py -k "false_alarm or tier1_never or 24kb" -s` | `false alarms: 0/104` · `tier-1 missed: 0/140` · `assess 24027 chars: 0.221s` · `slowest adversarial 24 KB text: 0.325s` | 0 |
| 3 | `python scratchpad/h03/h03_compare.py` (Base 699a566 vs worktree, cùng câu) | b_fp EM0/UN4 (trần EM1/UN5) = Base · b_fp2 EM3/UN1 (trần EM3) = Base · jx_negfp EM0/UN0 (trần EM2; Base UN1) · kho 6468 câu: LOWER 89 / HIGHER 376 · R10 0.740s (lần đo khác, máy đang chạy pytest) | 0 |
| 3 | `python scratchpad/redteam_lex.py` (`PYTHONPATH=<worktree>`) | `TOTAL=107 ERRORS=7`, cùng 7 mã M08 M43 M44 M45 M47 F04 F05 như Base | 0 |
| 4 | `python -m ruff check src tests` | `All checks passed!` | 0 |
| 4 | `python -m ruff format --check src tests` | `75 files already formatted` | 0 |
| 5 | ĐỎ: `git checkout 699a566 -- seed/maintenance_v1/lexicon.yaml src/maintenance/safety.py` rồi `pytest test_safety_metamorphic.py test_safety.py` | `54 failed, 1459 passed`: M1–M8 8, cặp p6 8, H03 24, SC mới 12, false_alarm 1, tier1_never 1; khôi phục bản mới từ `scratchpad/h03/keep/`, chạy lại #1 #4 | 1 |
| — | `grep -cP '[\x08\x0c\x0b]'` lexicon / safety.py / cases / test metamorphic | 0 / 0 / 0 / 0 | — |

Test: tổng 2840 · pass 2840 · fail 0 · skip 0 (29 deselected là postgres, như Base).

## git diff --stat (chưa commit)
```
 seed/maintenance_v1/lexicon.yaml                  |  17 +-
 src/maintenance/safety.py                         | 216 +++++++++++++++++++++-
 tests/test_maintenance/data/safety_cases_p0.yaml  |  14 ++
 tests/test_maintenance/test_safety_metamorphic.py | 162 +++++++++++++++-
 ?? planning/05_2026-10-04_agent-hardening/reports/R03_safety-round2.md
```

## (a) Mẫu chèn giữa câu (`MID_TEMPLATES`, 8 mẫu)
M1 "{h} ở hành lang tầng 3 tòa SIM-A {t}" · M2 "{h} tầng 6 tòa SIM-B {t}" · M3 "{h}, ngay sảnh thang máy tầng 2 tòa SIM-C, {t}" · M4 "{h} ở sảnh thang máy tầng 5 tòa SIM-A {t}" · M5 "{h} tại cầu thang bộ tầng 11 tòa SIM-A {t}" · M6 "{h} ở hành lang tầng 3 tòa SIM-A, {t}" (tách ở dấu phẩy đầu) · M7 không dấu "{h} o hanh lang tang 3 toa SIM-A {t}" · M8 "{h} ở hầm B1 tòa SIM-A {t}".
Cách tách (chế độ "S", sau chủ ngữ): trước từ đầu tiên (chỉ số ≥ 1) mở vị ngữ — tập `PREDICATE_START` gồm động từ/tính từ tín hiệu + cue phủ định/nghi ngờ (có, bị, đang, không, chưa, hình, nghe, thấy, bốc, ngã, kẹt, cháy, lộ, lòi, hở, treo, tuột, tróc…), so CÓ dấu (câu không dấu so không dấu). Câu mở bằng vị ngữ (không có chủ ngữ) hoặc không có vị ngữ thì bỏ qua (mẫu bọc T1–T14 đã phủ). Lý do không dùng "sau 1–3 từ đầu": lần đo đầu tách cả từ ghép ("Tia | lửa", "Đèn cầu | thang bộ", "Chất | lạ") — cư dân không viết vậy. Cue phủ định/hedge thuộc tập nên vị trí không chen giữa cue và tín hiệu. Thêm 12 cặp `NATURAL_PAIRS` (p6) và 27 câu `H03_EXPECTED` (8 + 12 + 27 = 47 test mới).

## Sửa `safety.py`: vị trí là trong suốt (Q01)
- `_place_runs`: dò cụm vị trí bằng tập đóng `b01_prefix_words` (bỏ cụm chứa danh từ đèn) + `b01_code_token_regex`, trong một đoạn (không qua `,:().;!?`), cắt sau mã neo cuối (mã có chữ số, hoặc chữ cái sau "sim"). Không có mã neo thì không phải vị trí. Tuyến tính theo số token.
- `_readings`: đọc A = câu gốc, nhưng cụm vị trí đứng giữa hai dấu phẩy (", ngay sảnh … SIM-C, ") hoặc ngay sau dấu phẩy được đọc liền mệnh đề. Có cụm vị trí nối được hai token cùng câu thì thêm đọc B (bỏ phần trạng ngữ từ giới từ ở/tại/ngay, giữ chủ ngữ "phòng rác", "thang máy" + bỏ mã của chủ ngữ) và đọc C (chỉ bỏ "tầng N", "tòa SIM-X"). Mọi đọc trích dẫn câu GỐC (index ghép về vị trí gốc); bản ghi gộp lại ⇒ mức = cao nhất các đọc, vị trí không bao giờ hạ mức. Bản ghi của A được ưu tiên (giữ trích dẫn cũ), đọc B/C chỉ thêm cặp (tín hiệu, trạng thái) A chưa có.
- Giới hạn: câu dài > `PLACE_SENTENCE_MAX` = 1000 ký tự norm chỉ đọc A (giữ R10 dưới 1 s; câu cư dân không dài vậy).
- `TextContext` thêm `soft_cuts`, `conjunction_cuts` (mặc định rỗng, priority.py không đổi).

## Sửa khối `safety` của lexicon (không đổi `lexicon_version`, không đụng `priority`)
| Mục | Thay đổi | Câu |
|---|---|---|
| b01_prefix_words | + `ngay, gan, can, can ho` | (e) "gần căn 705", "trước cửa căn 1205", ", ngay sảnh …," |
| ambiguous_terms `chap` | `(?! chon\b)` | (e)(f) "chập chờn" (đèn, wifi, sóng) không phải "chập" |
| S-03 `day tran` | regex `(?! roi\|ra(?! ngoai)\|het\|ca\|lan\|lenh lang\|nuoc\|rac\|xuong\|ngap)` | (d) "day tran roi / ra ca hanh lang" = đầy tràn; "Dây trần", "dây điện trần" giữ EM |
| S-03 | + `day (dien\|cap dien) …{0,4} (lo\|loi\|tuot\|thong\|ho) ra`, + `(loi\|lo\|ho)(ca\|het\|…){0,2} day (dien\|cap dien)` | (c) lộ/lòi/tuột ra, "lòi cả dây điện" |
| S-04 | + `khoi tu …{1,4} (bay\|boc\|toa\|tuon\|phut\|lan\|cuon) (ra\|len)` | p3 "khói từ phòng rác bay ra nhiều lắm" |
| S-05 | + "cháy rồi mọi người/cả nhà/bà con… ơi" khi câu không có danh từ đèn/phủ định trước (+ intended cho mọi khoá trừ `chay`) | p3 "Hành lang … cháy rồi mọi người ơi" |
| components | unknown_substance + `chat (long\|bot\|…) \w? (la\|khong ro)`; hazard_sign + `ho sac sua` | p3 "chất bột trắng không rõ … ho sặc sụa" (S-14) |

## Trước / sau từng mục
- (a) Bản cũ: 216 vi phạm trên mẫu mới, 8/12 cặp p6 đỏ → sau: 0.
- (b) 3 câu bắt buộc + 8 câu p3 hụt: NONE/UNCLEAR → EMERGENCY.
- (c) 6 câu: NONE → EMERGENCY.
- (d) 2 câu: EMERGENCY → NONE.
- (e) 6/7 câu: UNCLEAR → NONE. "bong den hanh lang tang 7 toa SIM-B bi chay roi" vẫn UNCLEAR (xem việc không làm).
- (f) "wifi chập chờn" UNCLEAR → NONE; "Tuần trước có khói … giờ hết rồi" đã UNCLEAR từ Base (giữ).
- Kho 6468 câu: 89 LOWER đều thuộc lớp chủ đích (chập chờn, đầy tràn không dấu, B-01 gần/trước căn, mệnh đề vị trí giữa hai dấu phẩy, và biến thể của chúng); 0 câu Bậc 1 bị hạ. HIGHER 376: biến thể chèn giữa câu được sửa và câu S-03/S-05/S-14 mới; 0 câu lành trong p1/p2/p4/p5 bị nâng.

## Vi phạm còn lại được chấp nhận (`ACCEPTED_MID_VIOLATIONS`, đều NONE → UNCLEAR, hướng an toàn)
4 biến thể: câu gốc ĐÃ có vị trí đầy đủ (SC-242, SC-255), chèn thêm vị trí thứ hai làm tiền tố B-01 vượt `b01_max_prefix_tokens` = 20 (R6) ⇒ đèn cháy vẫn UNCLEAR. Không nâng trần (sẽ nới B-01 cho mọi câu; handoff cấm hạ ngưỡng).

## Việc KHÔNG làm + lý do
- "bong den hanh lang tang 7 toa SIM-B bi chay roi" ⇒ NONE: đã thử cho danh từ đèn hai chữ không dấu được coi là chứng minh (A1); làm đỏ test cũ `test_b01_closed_prefix_twenty_tokens_and_lamp_accent` ("Bong den hanh lang tang 3 bi chay" == UNCLEAR, P1-11). Không sửa nhãn cũ ⇒ hoàn lại, câu giữ UNCLEAR. Cần người quyết: giữ P1-11 hay đổi.
- (f) tên riêng "Anh Chập", "Em là Khói" vẫn UNCLEAR (không bắt buộc; cần luật tên riêng theo chữ hoa, rủi ro bỏ sót cao).
- Không làm tín hiệu P1 (handoff). 7 lỗi redteam giữ nguyên (M47 "Cháy rồi! Hành lang tầng 4 mọi người ơi": dấu "!" cắt câu, pattern mới chỉ khớp trong một câu; F04/F05 khoá bởi Q03).
- `PLACE_PREPOSITIONS` (ở/tại/ngay) và `PLACE_SENTENCE_MAX` là hằng trong `safety.py`, không ở lexicon: catalog `extra="forbid"`, `catalog.py` ngoài phạm vi. SO cần quyết đưa vào lexicon ở đợt sau.
- `docs/maintenance.md` chưa ghi luật vị trí trong suốt + mẫu M1–M8 (docs/ ngoài phạm vi) — SO đồng bộ. Không chạy Bước 0 chế độ ghi, không commit, không phóng agent con. Không đụng khối `priority` (SO đã thêm "Lối thoát hiểm" ở repo chính — gộp không xung đột vì diff lexicon chỉ ở khối `safety`).
- Ghi chú: worktree ban đầu ở `0794e1a`, sạch ⇒ `git reset --hard 699a566`. Phiên bị ngắt giữa chừng, làm tiếp trên cùng worktree.

Phán quyết: ✅ mọi "xong khi" đạt (2840/0 fail, biến thể 216 → 0 + 4 chấp nhận có lý do, p6 0/12 hạ, p3 45/45, bộ dừng xanh, false alarm 0, ngân sách ≤ trần, redteam 7 = 7, ruff 0, ĐỎ 54 failed trên Base); 1 câu (e) không dấu còn UNCLEAR do mâu thuẫn test cũ P1-11 — chờ SO đo lại.
