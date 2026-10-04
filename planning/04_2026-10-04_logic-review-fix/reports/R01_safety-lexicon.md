Worker · thi công · Anthropic/Opus 5.5 (claude-opus-5-5[1m]) · Bước 0 exit 1 (CẦN NÂNG CẤP, chưa chạy chế độ GHI, xem "Việc KHÔNG làm") · hiểu việc: chỉ sửa từ vựng `lexicon.yaml` (safety + priority), THÊM ca vào `safety_cases_p0.yaml`, thêm `test_safety_review_fixes.py` / xong khi: cả 29 câu §3(a)(b)(c) đúng mức, 2 câu §3(d) không ra PRI-H2/PRI-M2, pytest + ruff exit 0, bộ dừng xanh, có bằng chứng ĐỎ / cấm: chạm `src/`, test/data khác, `seed/maintenance_cr03/`, `docs/`, `brain4agent/`, sửa nhãn cũ, hạ ngưỡng
Handoff: H01_safety-lexicon.md
Base: 7b9349686390a3258e247a2943cfd3ebaa31df30
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-aa7965d0f13f9e392)

## Lệnh + exit code (venv Python 3.11 tại `%TEMP%\venv-h01`, `LLM_MODE=mock PYTHONUTF8=1`)
| # | Lệnh | Kết quả | Exit |
|---|---|---|---|
| 0 | `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | `CẦN NÂNG CẤP` · BRN-002 (AGENTS.md khối boot) · BRN-028 (today.md 172 dòng) | 1 |
| 1 | `python -m pytest -q -p no:cacheprovider` (gốc, trước khi sửa) | `1641 passed, 29 deselected` | 0 |
| 1 | `python -m pytest -q -p no:cacheprovider` (sau khi sửa) | `1676 passed, 29 deselected` (= 1641 + 29 ca + 6 test priority) | 0 |
| 2 | `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_safety.py tests/test_maintenance/test_safety_p0.py tests/test_maintenance/test_cr03_targets.py` | `1379 passed` | 0 |
| 3 | `python -m ruff check src tests` | `All checks passed!` | 0 |
| 3 | `python -m ruff format --check src tests` | `71 files already formatted` | 0 |
| 5 | ĐỎ: `git stash push -m h01-red-lexicon-aa7965 -- seed/maintenance_v1/lexicon.yaml` rồi chạy `test_safety_review_fixes.py` + `test_labelled_case[SC-77..SC-105]` | `31 failed, 4 passed` (4 test "giữ đúng" của trơn/hôi vốn xanh trên lexicon cũ) | 1 |
| 5 | Khôi phục: `git stash apply 0a7fd3a1…` + `git stash drop` đúng mục theo tag; chạy lại #1–#3 | như trên, xanh | 0 |
| — | `grep -cP '[\x08\x0b\x0c]'` trên 3 file đã sửa | 0 / 0 / 0 | — |

Test: tổng 1676 · pass 1676 · fail 0 · skip 0 (29 deselected là postgres, không đổi so với gốc). Bộ dừng: `-k "stop_set"` 1068 pass (1065 gốc + 3 test stop-set khác cùng khớp `-k`; 1065 ca không đổi, đều xanh).

## git diff --stat (chưa commit)
```
 seed/maintenance_v1/lexicon.yaml                 | 43 +++++++++++++++++++-----
 tests/test_maintenance/data/safety_cases_p0.yaml | 32 ++++++++++++++++++
 2 files changed, 67 insertions(+), 8 deletions(-)
?? tests/test_maintenance/test_safety_review_fixes.py
```

## Bảng trước/sau (`assess(text, load_lexicon().safety)`)
| Ca | Câu | Trước | Sau | Cơ chế (lexicon) |
|---|---|---|---|---|
| SC-77 | Thang máy kẹt, có người bên trong | NONE | EMERGENCY | S-09 regex `thang may … ket … nguoi` (trong khoảng không được có khong/ko/chua/chang; loại "mọi/nhiều người", "người dùng/dân/ta") |
| SC-78 | thang may bi ket, co 2 nguoi o trong | NONE | EMERGENCY | như trên |
| SC-79 | Thang máy bị kẹt giữa tầng 7 và 8, bên trong có 3 người | NONE | EMERGENCY | như trên (≤10 token) |
| SC-80 | Có người kêu cứu trong thang máy | NONE | EMERGENCY | S-09 `keu cuu` |
| SC-81 | Có người té xỉu ở sảnh chính | NONE | EMERGENCY | S-09 `te xiu` |
| SC-82 | co nguoi te xiu o sanh chinh | NONE | EMERGENCY | S-09 `te xiu` |
| SC-83 | Có cụ bà ngã ở cầu thang bộ, đang nằm dưới sàn không nhúc nhích | NONE | EMERGENCY | S-09 regex `nam … khong nhuc nhich` |
| SC-84 | Dây điện rơi xuống lối đi hành lang tầng 7 | NONE | EMERGENCY | S-03 regex `day (dien\|cap dien) … (lung lang\|tong teng\|roi xuong)` |
| SC-85 | Dây điện bị tróc vỏ ở hành lang tầng 3 | NONE | EMERGENCY | S-03 regex `day (dien\|cap dien) … (troc\|tuot\|bong) vo` |
| SC-86 | dây điện bị bong vỏ ở hành lang | NONE | EMERGENCY | như trên + `homograph_intended` {bong: [bong]} |
| SC-87 | Dây điện bị lủng lẳng ở hành lang tầng 4 | NONE | EMERGENCY | S-03 regex lủng lẳng |
| SC-88 | Hộp điện đang bốc hỏa ở tầng 3 | NONE | EMERGENCY | S-05 `boc hoa(?! don)` |
| SC-89 | Khói nhiều lắm ở hành lang tầng 5, không thở được | UNCLEAR | EMERGENCY | S-04 `khoi nhieu` |
| SC-90 | Lửa lớn lắm ở tầng 4, cứu với | UNCLEAR | EMERGENCY | S-05 `lua lon`, S-09 `cuu voi` |
| SC-91 | Ông cụ bị té cầu thang bộ | NONE | UNCLEAR | ambiguous `bi te` (homographs.te loại tê/tè/tế…) |
| SC-92 | Bé bị đứt tay do kính vỡ ở sảnh | NONE | UNCLEAR | ambiguous `bi dut tay` |
| SC-93 | tang 5 khoi nhieu lam | NONE | EMERGENCY | S-04 `khoi nhieu` (không dấu giữ mức cao) |
| SC-94 | Đèn hành lang cháy đen cả trần nhà | NONE | UNCLEAR | ambiguous regex `chay den (ca\|het\|thui\|xi\|tran\|tuong\|sam)` |
| SC-95 | Điện hành lang tầng 3 bị ngắt từ sáng nên đèn không sáng | EMERGENCY | NONE | bỏ intended của `bi ngat`; bỏ `bi` khỏi confirmers.ngat |
| SC-96 | Cầu dao tổng bị ngắt | EMERGENCY | NONE | như trên |
| SC-97 | Đèn hành lang bị ngắt | EMERGENCY | NONE | như trên |
| SC-98 | Wifi bị ngắt | EMERGENCY | NONE | như trên |
| SC-99 | Sảnh có khối rác chưa dọn | EMERGENCY | NONE | bỏ intended `co khoi` (gõ sai "có khối/khỏi bốc ra" vẫn giữ nhờ confirmers.khoi) |
| SC-100 | Có ai để quên cái bật lửa ở sảnh chính | EMERGENCY | NONE | homographs `bat: [bật]` + ambiguous_exclusions `bat lua` (chặn lưới R9) |
| SC-101 | Đèn hành lang cháy sáng suốt đêm không tắt | EMERGENCY | NONE | homographs `sang: [sáng]` ⇒ B-01 |
| SC-102 | Bóng đèn hành lang gần căn 1205 bị cháy | UNCLEAR | NONE | b01_prefix_words + `gan, can ho, can` |
| SC-103 | Bóng đèn chỗ thang máy tầng 5 bị cháy | UNCLEAR | NONE | b01_prefix_words + `cho` |
| SC-104 | Xin báo bóng đèn hành lang tầng 12 bị cháy | UNCLEAR | NONE | b01_prefix_words + `xin bao` |
| SC-105 | Tôi bị giật mình khi thấy rác nhiều ở sảnh | UNCLEAR | NONE | ambiguous_exclusions `bi giat minh`, `giat minh` (không cần đánh đổi) |
| §3(d) | vết bẩn hình tròn trên tường hành lang tầng 3 | PRI-H2 | PRI-M2 | `\btron\b` ⇒ `(?<!hinh )(?<!vong )\btron\b(?! tr)` |
| §3(d) | Cho em hỏi hành lang tầng 3 có ít bụi | PRI-M2 | PRI-L1 | `\bhoi\b` ⇒ cụm `hoi thoi/ham/khai/qua/lam`, `rat hoi`, `bi hoi` |

Báo nhầm `test_false_alarm_count_on_benign_strings`: trước 0/46 → sau 0/57 (trên lexicon cũ, tập mới cho 11/57; bỏ sót Bậc 1 trên lexicon cũ 14/66 → sau 0/66).
Ngân sách bộ dừng (tính trên lexicon HEAD và lexicon mới, cùng bộ câu): b_fp EM 0 / UNCLEAR 4 (trần 1/5) → không đổi; b_fp2 EM 3 (trần 3) → không đổi; jx_negfp EM 0 (trần 2) → không đổi.

## Đánh đổi đã quyết (🔴)
- `bị ngắt` có dấu nay theo nghĩa "cắt" trừ khi mệnh đề có người: confirmers.ngat = `nguoi, xiu, nga, bat, cu ba, cu ong, ba cu, ong cu, em be, tre em` (giữ wp3d:C14 "Cụ bà … bị ngắt, nằm bất động"). Câu gõ sai dấu mà không nêu người (vd "Bà bị ngắt") sẽ không lên Bậc 1. Văn bản KHÔNG dấu vẫn giữ mức cao.
- Không thêm `bi nga` vào ambiguous_terms: tôi đã thử, làm b_fp UNCLEAR từ 4 lên 5 (chạm trần) vì câu "bị ngã xe đạp … không sao"; té/ngã chỉ lên Bậc 2 qua `bi te`, `te nga`.
- "Cháy đen" để ở Bậc 2 (ambiguous), không phải Bậc 1: cháy có thể đã tắt, nên cho người xem lại.
- Thang máy: chỉ "kẹt + người" mới lên Bậc 1; "thang máy kẹt" một mình vẫn NONE (giữ R10_NONE).

## Việc KHÔNG làm + lý do
- **Không tăng `lexicon_version`** (handoff §3 yêu cầu). `tests/test_maintenance/test_safety.py:747` ghim `lexicon.lexicon_version == "2026-10-02.p0c"` mà file đó nằm ngoài phạm vi được sửa. Tôi đã thử đổi sang `2026-10-04.p0d` thì test đỏ, nên trả lại version cũ để đạt "xong khi #1". Cần người chọn: hoặc cấp quyền sửa 1 dòng ở `test_safety.py:747`, hoặc không tăng version.
- **Bước 0 chế độ GHI không chạy:** chạy sẽ sửa `AGENTS.md`/`brain4agent/` (vùng cấm); BRN-028 cần người xoay ký ức.
- **Không commit** (theo ghi đè của người giao việc: hook pre-commit đòi cập nhật `brain4agent/memory/hot/`, mà đó là vùng cấm).
- Ghi chú: worktree ban đầu đứng ở `5591925` (main), không chứa handoff. Worktree đang sạch nên tôi `git reset --hard 7b93496` (đầu `fix/nhuy-logic-review`) trước khi làm. `lexicon.yaml` trong working copy hiện dùng LF; git autocrlf tự chuẩn hoá nên diff chỉ có 43 dòng thật.

## Cần code (không sửa, ngoài phạm vi)
- B-01 `_proven_lamp` (`src/maintenance/safety.py` `_b01_ok`) coi câu là "đèn đã chứng minh" nếu có BẤT KỲ "đèn" có dấu nào trong mệnh đề, không xét chính token `den` ở cụm `cháy đèn`. Vì vậy "đèn … cháy đen" lọt B-01. Tôi vá bằng từ vựng (regex `chay den …`), nhưng chỉ phủ các đuôi đã liệt kê.
- Pattern cũ `ket nguoi` (S-09) bắt cả "Thang máy hay bị kẹt, người dùng phản ánh…" thành EMERGENCY. Lỗi này có từ trước, không do đợt sửa này. Sửa được bằng từ vựng nhưng sẽ đổi hành vi một pattern cũ; để SO quyết.

Phán quyết vòng 1: 🔁 mọi "xong khi" đã đạt (1676/0 fail, ruff 0, có ĐỎ 31 fail), trừ yêu cầu tăng `lexicon_version`: tôi chưa làm vì nó mâu thuẫn với phạm vi file, cần người quyết. (SO đã tự xử lý ở D:\P151.)

---

## Vòng 2 (SO giao lại sau thẩm định đối kháng: 107 câu, 57 sai)
Vẫn worker · thi công · Opus 5.5 · cùng phạm vi file · KHÔNG commit · KHÔNG đụng version (worktree vẫn để `2026-10-02.p0c`; SO đã tăng ở D:\P151).
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-aa7965d0f13f9e392)

### Lệnh + exit code (`LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=<worktree>`)
| Lệnh | Kết quả | Exit |
|---|---|---|
| `python scratchpad/redteam_lex.py` (script của thẩm định, không sửa; `load_lexicon()` đọc lexicon của worktree qua PYTHONPATH) | vòng 1: `TOTAL=107 ERRORS=57` → vòng 2: `TOTAL=107 ERRORS=10` | 0 |
| `python scratchpad/rt_compare.py` (tôi viết, import danh sách của redteam_lex, so từng câu với HEAD theo khoảng cách tới mức chấp nhận) | `errors HEAD=50 new=10 \| worse_than_HEAD=2 ['F04', 'F05'] \| better=44` | 0 |
| `python scratchpad/redteam_extra.py` | bật lửa ở ổ cắm/hộp điện/công tắc = EMERGENCY (= HEAD); "Gần căn 1205 cháy, đèn…", "Căn 1205 cháy đèn…", "Xin báo cháy đèn…" = UNCLEAR (= HEAD) | 0 |
| `python -m pytest -q -p no:cacheprovider` | `1773 passed, 29 deselected` (= 1676 + 97 ca mới) | 0 |
| `pytest test_safety.py test_safety_p0.py test_cr03_targets.py` | `1476 passed` | 0 |
| `pytest test_safety.py -k stop_set` | `1066 passed`, 0 fail (bộ dừng 1065 ca xanh) | 0 |
| `ruff check src tests` / `ruff format --check src tests` | `All checks passed!` / `71 files already formatted` | 0 / 0 |
| `test_false_alarm_count_on_benign_strings` / `test_tier1_never_missed…` | `false alarms: 0/83` / `tier-1 missed: 0/116` | 0 |
| Ngân sách (`scratchpad/budgets.py`, HEAD vs mới) | b_fp EM0/UN4 (trần 1/5), b_fp2 EM3 (trần 3), jx_negfp EM0 (trần 2): không đổi | 0 |
| ĐỎ (`scratchpad/red_r2.py`: SC-106..SC-202 chạy với lexicon khác, luật giống `test_labelled_case`) | HEAD: `45 failed / 97` · vòng 1 (bản SO gộp vào D:\P151): `57 failed / 97` · vòng 2: `0 failed / 97` | 0 |
| `grep -cP '[\x08\x0b\x0c]'` trên lexicon / cases / test | 0 / 0 / 0 | — |
Regex được ghi bằng script Python (Write tool, dùng chỗ giữ chỗ `%B` → `chr(92)*2`), không dùng heredoc bash.

### git diff --stat (so với Base 7b93496, chưa commit)
```
 seed/maintenance_v1/lexicon.yaml                 |  59 ++++++++--
 tests/test_maintenance/data/safety_cases_p0.yaml | 130 +++++++++++++++++++++++
 2 files changed, 181 insertions(+), 8 deletions(-)
?? tests/test_maintenance/test_safety_review_fixes.py
?? planning/04_2026-10-04_logic-review-fix/reports/R01_safety-lexicon.md
```

### Sửa gì (chỉ `lexicon.yaml`)
| Mục SO | Sửa |
|---|---|
| 1 · bật lửa (M42) | `homograph_confirmers.bat: [o cam, hop dien, tu dien, cong tac, cau dao, cam sac, day dien, xet]` ⇒ "bật lửa" trong ngữ cảnh điện vẫn là S-05; "cái bật lửa để quên" vẫn NONE |
| 1 · B-01 (M43–M45) | bỏ `gan, can ho, can, cho, xin bao` đứng riêng; thay bằng cụm có danh từ đèn: `den hanh lang gan can, bong den cho, xin bao bong den, xin bao den` |
| 1 · M41 | `homograph_confirmers.sang: [ruc, lua, khoi, phong rac, thung rac]` |
| 1 · M37 | khôi phục `homograph_intended.co khoi` chỉ cho `[khỏi, khơi]` (không có `khối` ⇒ "có khối rác" vẫn NONE) |
| 2 · thang máy (F32–F36) | regex mới: thang máy … kẹt … rồi phải có cụm HIỆN DIỆN: `có/còn (+≤2 token) <người>` (không đứng sau khong/ko/chua/chang), hoặc `<người> (+≤2) ở trong/bên trong/trong đó/đứng trong` (không đứng sau có/thấy), hoặc `bên trong/ở trong/trong đó có`. "người già phải…", "gọi người sửa", "ảnh hưởng người đi làm" không khớp |
| 2 · nằm (F21–F24, F43) | thêm `homographs.nam: [năm, nấm, nắm, nậm, nạm, nám]`; bỏ regex `nam … khong nhuc nhich`; thay bằng 2 regex S-09: (té/ngã … nằm … im/không nhúc nhích/không cử động/bất động/bất tỉnh) và (<người> … nằm … im/không nhúc nhích/không cử động). Regex có <người> KHÔNG gồm "bất động", để test R9 "Có người nằm bất động" vẫn ra B-03N |
| 2 · bốc hỏa (F25–F27) | `boc hoa` chỉ khớp khi chủ ngữ là chỗ/vật (hộp điện, tủ điện, ổ cắm, phòng rác, thùng rác, căn hộ, nhà, xe, hầm…) trong ≤3 token |
| 2 · lửa lớn (F10 F11) | `(?<!de )(?<!nau )lua lon` |
| 2 · khói nhiều (F12 F13) | bỏ `khoi nhieu` khỏi S-04; thêm ambiguous `khoi (rat\|qua\|that)? nhieu` (Bậc 2). SC-89 vẫn EMERGENCY nhờ S-04 mới `khoi … khong tho duoc` (≤8 token) |
| 2 · dây điện thoại (F29), té nước (F08/F40/F41) | `day (dien\|cap dien)(?! thoai)`; ambiguous_exclusions `bi te nuoc`, `te nuoc` |
| 3 · bỏ sót | thang máy (regex trên) · `bi nhot trong thang may`, `bi nhot trong` (M07) · `cuu (≤3 token) voi` trừ cứu hộ/hỏa/thương (M49, X04, X05) · `la cuu` (M50) · `keu cuu` trừ sau mèo/chó (F06) · `nga guc`, `guc nga` (M17) · `chay (rat\|qua\|nhieu\|that){1,3} mau` (intended chảy) (M21) · `lua dang lan` (M38) · dây điện: khoảng chen 0..4 token, `troc/tuot/bong (het\|ca)? vo`, `lo lung`, `loi loi dong`, `lo loi dong` (M25–M28, M31) · `toan la khoi` (M35) |
| 5 · confirmers.ngat | `nguoi` → `co nguoi, nguoi bi` (F16–F18 nay NONE; "Có người bị ngắt" vẫn EMERGENCY) |
| Chung | Regex dài có `homograph_intended` giữ mọi dạng đồng tự TRỪ token mà regex cần xét (thang máy/dây điện/bốc hỏa: giữ hết; té-ngã-nằm: vẫn xét `te`, `nam`; người-nằm: vẫn xét `nam`; khói-không thở được: vẫn xét `khoi`). Nếu không có intended, "sáng"/"hộ"/"năm" nằm giữa span sẽ làm rơi cả match |

### Bảng trước/sau theo ID (HEAD = lexicon trước plan 04 · R1 = vòng 1 · R2 = vòng 2)
Chỉ ghi câu có R1 hoặc R2 khác HEAD, hoặc còn sai. 51 câu còn lại đúng ở cả ba bản.
| ID | HEAD | R1 | R2 | Chấp nhận |
|---|---|---|---|---|
| M01–M06, M09 | NONE | NONE | EMERGENCY | E |
| M07 | NONE | NONE | EMERGENCY | E |
| M08 | NONE | NONE | **NONE** | E |
| M11 | NONE | EMERGENCY | EMERGENCY | E |
| M13, M14, M16, M17 | NONE | NONE | EMERGENCY | E |
| M15 | UNCLEAR | UNCLEAR | EMERGENCY | E |
| M18, M19 | NONE | EMERGENCY | EMERGENCY | E |
| M21 | UNCLEAR | UNCLEAR | EMERGENCY | E |
| M22 | NONE | UNCLEAR | EMERGENCY | E |
| M25–M28, M31 | NONE | NONE | EMERGENCY | E |
| M29, M30, M32 | NONE | EMERGENCY | EMERGENCY | E |
| M33 | UNCLEAR | UNCLEAR | **UNCLEAR** | E |
| M34 | NONE | NONE | **UNCLEAR** | E |
| M35 | UNCLEAR | UNCLEAR | EMERGENCY | E |
| M36 | NONE | EMERGENCY | **UNCLEAR** | E |
| M37 | EMERGENCY | NONE | EMERGENCY | E |
| M38 | UNCLEAR | UNCLEAR | EMERGENCY | E |
| M39, M40, M46, M48, M52 | NONE | EMERGENCY | EMERGENCY | E |
| M41 | EMERGENCY | UNCLEAR | EMERGENCY | E |
| M42 | EMERGENCY | NONE | EMERGENCY | E |
| M43, M44, M45 | UNCLEAR | NONE | **UNCLEAR** | E |
| M47 | UNCLEAR | UNCLEAR | **UNCLEAR** | E |
| M49, M50 | NONE | NONE | EMERGENCY | E |
| F04, F05 | NONE | EMERGENCY | **EMERGENCY** | N/U (SO §4 cho phép) |
| F06 | NONE | EMERGENCY | NONE | N/U |
| F08 | NONE | UNCLEAR | NONE | N |
| F10–F13 | UNCLEAR | EMERGENCY | UNCLEAR | N/U |
| F15, F19, F38, F45 | EMERGENCY | NONE | NONE | N |
| F16, F17, F18 | EMERGENCY | EMERGENCY | NONE | N |
| F21, F43 | NONE | EMERGENCY | NONE | N/U |
| F22–F27 | NONE | EMERGENCY | NONE | N |
| F29 | NONE | EMERGENCY | NONE | N/U |
| F32, F33, F34 | NONE | EMERGENCY | NONE | N/U |
| F41 | NONE | UNCLEAR | NONE | N/U |
Tổng lỗi: HEAD 50 · R1 57 · R2 10. Số câu R2 tệ hơn HEAD: 2 (F04, F05, SO đã chấp nhận ở §4).

### 10 câu còn sai + lý do
- F04, F05: SO chốt "kêu cứu/cứu với" nghĩa bóng được lên EMERGENCY.
- M33, M34, M36 ("khói rất nhiều", "khoi nhieu…"): ra UNCLEAR, không phải EMERGENCY. Đánh đổi với F12/F13 (mục 2 ưu tiên hơn mục 3): "Hút thuốc… khói nhiều lắm" có cùng cấu trúc, và từ vựng không loại được ngữ cảnh đứng TRƯỚC chữ "khói" (lookbehind độ dài cố định; span dài thì đồng tự trong span làm rơi match). M34/M36 vẫn tốt hơn HEAD (NONE → UNCLEAR).
- M43, M44, M45: = HEAD (UNCLEAR), đúng mức sàn SO yêu cầu. Lên EMERGENCY phải coi "cháy" đứng riêng là Bậc 1, việc này đổi B-03 ⇒ cần SPEC.
- M47 "Cháy rồi! …": = HEAD. Lý do như trên ("cháy" đứng riêng là B-03).
- M08 "thang may dung giua tang 5 va 6, nguoi ben trong dap cua keu": không có "kẹt"; SO không liệt kê; chưa vá để tránh mở rộng regex.

### Ca hồi quy đã thêm
SC-106..SC-202 (97 ca, sinh bằng `scratchpad/gen_cases_r2.py` từ danh sách của thẩm định + 7 câu dò thêm X01–X07). Gồm mọi câu R2 xử lý đúng, trừ F04/F05 (không ghim chiều nào). M43–M45 ghim `expect_any: [UNCLEAR, EMERGENCY]` (sàn = HEAD). Không sửa ca cũ.

### Đã biết, chưa sửa
- "Thang máy hay bị kẹt, người dùng phản ánh…" vẫn EMERGENCY qua pattern CŨ `ket nguoi` (có từ trước plan 04).
- "Thang máy cháy, đèn tắt hết" ra NONE (= HEAD): "thang may" có sẵn trong b01_prefix_words, và `_b01_ok` nhận "đèn" đứng SAU dấu phẩy là bằng chứng (`following`). Cần code: không nhận danh từ đèn bên kia dấu phẩy mềm.

Phán quyết vòng 2 (giữ để đối chiếu): 🔁 các "xong khi" vòng 2 đã đạt: tệ hơn HEAD chỉ còn F04/F05 (SO đã chấp nhận), lỗi 57 → 10, pytest 1773/0 fail, ruff 0, ngân sách không đổi, ĐỎ 57/97 → 0/97. Còn mở: 8 câu bỏ sót (M08, M33, M34, M36, M43–M45, M47) cần SPEC/code hoặc SO quyết đánh đổi.

---

## Vòng 3 (SO giao; KHÔNG commit)
Worker · thi công · Opus 5.5 · hiểu việc: (1) khói nhiều → Bậc 1 trừ ngữ cảnh thuốc/nhang/nướng; nhốt/kẹt trong thang máy → Bậc 1; (2) hết báo nhầm "khói thuốc lá", "kẹt, người dùng"; (3) hedge "nghe như có tiếng xẹt" (không bắt buộc); (4) B-01 không nhận đèn ở mệnh đề khác / được sửa: lexicon (safety), THÊM ca, `test_safety_review_fixes.py`, `safety.py` chỉ cho mục 4 / cấm: sửa nhãn cũ, hạ ngưỡng, heredoc khi ghi regex.
Handoff: H01_safety-lexicon.md (vòng 3 qua tin nhắn SO)
Base: 7b9349686390a3258e247a2943cfd3ebaa31df30
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-aa7965d0f13f9e392)

Đồng bộ trước khi làm: chép đúng 4 file từ D:\P151 (`lexicon.yaml` có version `2026-10-04.p0d` + `high_areas` thêm "Bãi đỗ xe", "Lối đi"; `safety_cases_p0.yaml`; `test_safety_review_fixes.py`; `test_safety.py`). Trước đó đã lưu lexicon vòng 2 vào `scratchpad/r2_lex/lexicon.yaml` để làm bằng chứng ĐỎ. Sau khi chép, lexicon chỉ khác vòng 2 ở dòng version và high_areas.

### Lệnh + exit code (`LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=<worktree>`)
| Lệnh | Kết quả | Exit |
|---|---|---|
| `python scratchpad/probe3.py scratchpad/r2_lex` (28 câu vòng 3, cột alt = lexicon vòng 2) | `BAD 0` (trước khi sửa: `BAD 9`) | 0 |
| `python scratchpad/rt_compare_r2.py` (bộ 107 câu của thẩm định: HEAD / vòng 2 / vòng 3) | `errors {'HEAD': 50, 'r2': 10, 'r3': 7} \| r3_worse_than_r2=0 []`. Đổi so với vòng 2: M33, M34, M36 UNCLEAR → EMERGENCY | 0 |
| `python -m pytest -q -p no:cacheprovider` | `1796 passed, 29 deselected` (= 1773 + 17 ca + 6 test B-01) | 0 |
| `pytest test_safety.py test_safety_p0.py test_cr03_targets.py` | `1493 passed` | 0 |
| `pytest test_safety.py -k stop_set` | `1066 passed`, 0 fail (bộ dừng 1065 xanh) | 0 |
| `test_false_alarm_count…` / `test_tier1_never_missed…` / `test_assess_is_linear…` | `false alarms: 0/84` / `tier-1 missed: 0/125` / `slowest adversarial 24 KB text: 0.326s` | 0 |
| `scratchpad/budgets.py` (lexicon mới) | b_fp EM0/UN4 (trần 1/5), b_fp2 EM3 (trần 3), jx_negfp EM0 (trần 2): không đổi | 0 |
| `ruff check src tests` / `ruff format --check src tests` | `All checks passed!` / `71 files already formatted` (đã chạy `ruff format` cho file test mới) | 0 / 0 |
| ĐỎ từ vựng: `python scratchpad/red_r3.py scratchpad/r2_lex` | lexicon vòng 2: `8 failed / 17` (SC-205..208, SC-211..214) · vòng 3: `0 failed / 17` | 0 |
| ĐỎ code: `git stash push -m h01-r3-red-safetypy-aa7965 -- src/maintenance/safety.py`, rồi `pytest test_safety_review_fixes.py test_safety.py -k "b01_lamp_noun or b01_same_clause or SC-2"` | `2 failed, 34 passed` ("Thang máy cháy, đèn tắt hết" ở test mới và SC-215) | 1 |
| Khôi phục: `git stash apply d3b7a4ae…` + drop đúng mục theo tag; chạy lại pytest + ruff | như trên, xanh | 0 |
| `grep -cP '[\x08\x0b\x0c]'` (lexicon, cases, test, safety.py) | 0 / 0 / 0 / 0 | — |

### git diff --stat (so với Base, chưa commit)
```
 seed/maintenance_v1/lexicon.yaml                 |  72 +++++++++--
 src/maintenance/safety.py                        |   5 +-
 tests/test_maintenance/data/safety_cases_p0.yaml | 148 +++++++++++++++++++++++
 tests/test_maintenance/test_safety.py            |   2 +-   (bản SO, chép nguyên)
?? tests/test_maintenance/test_safety_review_fixes.py
?? planning/04_2026-10-04_logic-review-fix/reports/R01_safety-lexicon.md
```

### Sửa gì
| Mục | Sửa |
|---|---|
| 1 · khói nhiều | S-04 thêm regex: span từ ĐẦU CÂU (`^` hoặc sau `.;!?`) tới `khói (rất/quá/thật/là)? nhiều`. Regex không khớp nếu trước đó trong câu có thuốc/nhang/hương/vàng mã/nướng/bếp/nấu, một cue phủ định (không/ko/chưa/chẳng/hok) hay một cue hedge; cũng không khớp nếu sau đó trong câu có thuốc/nhang/hương/vàng mã/nướng/bếp. Khi không khớp, câu rơi về ambiguous `khoi … nhieu` (Bậc 2), và R1/R5 vẫn xét ở đó. Regex có `homograph_intended` giữ mọi dạng đồng tự trừ `khoi` (span dài) |
| 1 · nhốt/kẹt | đã đúng từ vòng 2 (`bi nhot trong…`, `ket trong thang may`); nay ghim thêm ca |
| 2 · khói thuốc lá | `nhieu khoi` → `nhieu khoi(?! (thuoc\|nhang\|huong\|vang ma\|nuong\|bep))` |
| 2 · kẹt người | `ket nguoi` → `ket nguoi(?! (dung\|dan\|gia\|ta\|lon\|di\|phan\|bao\|than\|nao\|khac\|lam\|ngoai\|tre\|quen))`. "Thang máy kẹt người già bên trong" vẫn EMERGENCY nhờ regex hiện diện của vòng 2 |
| 3 · hedge | `hedge_fillers` thêm `tieng` ⇒ "Hình như nghe như có tiếng xẹt điện ở hộp điện": S-02 UNCLEAR (T2-01), mức UNCLEAR |
| 4 · B-01 (`safety.py` `_b01_ok`, hàm nội bộ, +4/−1 dòng) | (a) candidate `[p, e)` vượt qua một chỗ ngắt mệnh đề ⇒ không phải B-01 (bắt benign regex `chay den` khớp qua dấu phẩy); (b) danh từ đèn ĐỨNG SAU candidate chỉ tính khi cùng mệnh đề. Theo SPEC-P01 R6: phần trước tín hiệu là tập đóng, dấu câu kết thúc mệnh đề. Không đổi hàm công khai |

### Bảng câu vòng 3 (vòng 2 → vòng 3)
| ID | Câu | R2 | R3 |
|---|---|---|---|
| R3-04 | Khói rất nhiều ở hành lang tầng 9 | UNCLEAR | EMERGENCY |
| R3-05 | khoi rat nhieu o tang ham | UNCLEAR | EMERGENCY |
| R3-07 | Hành lang tầng 9 khói rất nhiều, mọi người chạy hết xuống | UNCLEAR | EMERGENCY |
| R3-08 | khoi nhieu o hanh lang tang 4 | UNCLEAR | EMERGENCY |
| R3-09/10/12/13 | Hút thuốc… / đốt nhang… / đốt vàng mã… / nướng thịt… khói nhiều | UNCLEAR | UNCLEAR |
| R3-11 | Khói nhang nhiều quá ở hành lang tầng 8 | NONE | NONE |
| R3-14 | Hành lang tầng 3 nhiều khói thuốc lá do có người hút | EMERGENCY | NONE |
| R3-15 | Thang máy hay bị kẹt, người dùng phản ánh nhiều | EMERGENCY | NONE |
| R3-16 | Thang máy kẹt, người dân bức xúc | EMERGENCY | NONE |
| R3-17 | Hình như nghe như có tiếng xẹt điện ở hộp điện | EMERGENCY | UNCLEAR |
| R3-18/19/20 | Căn hộ 1205 cháy, đèn… / Chỗ thang máy cháy, đèn… / Xin báo cháy, đèn… | UNCLEAR | UNCLEAR |
| R3-21 | Thang máy cháy, đèn tắt hết | NONE | UNCLEAR |
| R3-22/23/24 | Bóng đèn … gần căn 1205 / chỗ thang máy / cầu thang tầng 9 bị cháy, nhờ thay | NONE | NONE |
| R3-01/02/03, R3-06, R3-25..28 | nhốt / kẹt trong thang máy, toàn là khói, kẹt người | EMERGENCY | EMERGENCY |

### Ca hồi quy đã thêm
SC-203..SC-219 (17 ca, `scratchpad/gen_cases_r3.py` sinh từ `probe3.CASES`; 11 câu đã được ghim từ vòng 2 nên bỏ qua). Test mới trong `test_safety_review_fixes.py`: `test_b01_lamp_noun_in_another_clause_is_not_benign` (3 câu) và `test_b01_same_clause_stays_benign` (3 câu). Không sửa ca cũ.

### Giới hạn đã biết (đánh đổi)
- "Không có lửa nhưng khói rất nhiều" ra UNCLEAR, chưa lên EMERGENCY: có cue phủ định ở trước trong câu thì regex khói nhiều không khớp. Tôi chọn vậy để R1 không bị né.
- Ngữ cảnh khói thuốc ở CÂU KHÁC thì không loại: "Hút thuốc ở sảnh bị cấm. Hành lang khói rất nhiều" vẫn ra EMERGENCY.
- Cụm "Khói rất nhiều" lên Bậc 1 có trích dẫn là cả phần đầu câu tới chữ "nhiều" (trích dẫn vẫn nguyên văn).
- R3-18..21 dừng ở UNCLEAR, chưa EMERGENCY: "cháy" đứng riêng là B-03 (Bậc 2), muốn đổi phải qua SPEC.
- Còn sai trong bộ thẩm định (7 câu): F04, F05 (SO chấp nhận), M08, M43, M44, M45, M47 (lý do như vòng 2).

Phán quyết vòng 3: 🔁 mọi câu mục 1–4 đúng mức (mục 3 cũng đạt), redteam không câu nào tệ hơn vòng 2 (lỗi 10 → 7), pytest 1796/0 fail, ruff 0, ngân sách không đổi, có ĐỎ cả từ vựng (8/17) lẫn code (2 fail). Đề nghị SO đo lại và duyệt riêng phần sửa `safety.py` (vùng code, cổng 🔴).
