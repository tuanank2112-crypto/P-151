Worker · thi công · Anthropic/Opus 5.5 (claude-opus-5-5[1m]) · Bước 0 exit 1 (CẦN NÂNG CẤP: BRN-002 khối boot AGENTS.md, BRN-028 today.md 180 dòng; KHÔNG chạy chế độ ghi) · hiểu việc: dựng bộ biến thể bọc vị trí trên mọi ca nhãn an toàn, rà từ xác nhận/đệm trùng chữ vị trí, sửa khối `safety` của lexicon + `safety.py` (chỉ không hạ mức câu đang đúng) đến 0 vi phạm / xong khi: pytest exit 0 ≥ 1843 + test mới, biến thể 0 vi phạm, redteam không tệ hơn 7 lỗi, ruff 0, có bằng chứng ĐỎ / cấm: rules.py, proposer.py, engine.py, src/api, src/web, test/nhãn cũ, docs/, brain4agent/, `lexicon_version`, khối `priority`, commit
Handoff: H01_safety-metamorphic.md
Base: e14b1a9
Head: uncommitted (worktree D:\P151\.claude\worktrees\agent-a914fc7bd44a89973)

## Lệnh + exit (`LLM_MODE=mock PYTHONUTF8=1`, venv `scratchpad/venv311`)
| # | Lệnh | Kết quả | Exit |
|---|---|---|---|
| 0 | `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | `CẦN NÂNG CẤP` (BRN-002, BRN-028) | 1 |
| 1 | `python -m pytest -q -p no:cacheprovider` (Base, trước khi sửa) | `1843 passed, 29 deselected` | 0 |
| 1 | `python -m pytest -q -p no:cacheprovider` (sau sửa) | `1884 passed, 29 deselected` = 1843 + 18 (test biến thể) + 23 (SC-220…SC-242) | 0 |
| 2 | `python -m tests.test_maintenance.test_safety_metamorphic` (Base lexicon + safety.py) | `VARIANTS=3890 VIOLATIONS=33` | 0 |
| 2 | như trên, sau sửa (bộ ca có thêm SC-220…242) | `VARIANTS=4166 VIOLATIONS=0` | 0 |
| 3 | `python scratchpad/redteam_lex.py` (không sửa script; `PYTHONPATH=<worktree>` nên `load_lexicon()`/`assess` đọc worktree) | trước `TOTAL=107 ERRORS=7` → sau `TOTAL=107 ERRORS=7`, cùng 7 mã M08 M43 M44 M45 M47 F04 F05 | 0 |
| 4 | `python -m ruff check src tests` | `All checks passed!` | 0 |
| 4 | `python -m ruff format --check src tests` | `74 files already formatted` | 0 |
| 5 | ĐỎ: `git checkout e14b1a9 -- lexicon.yaml safety.py safety_cases_p0.yaml` rồi `pytest tests/test_maintenance/test_safety_metamorphic.py` | `10 failed, 8 passed` (T2 3/321, T5 1, T6 1, T9 1, T10 2, T11 10, T12 11, T13 4 vi phạm + 2 câu demo); khôi phục bản mới từ scratchpad, chạy lại #1 #4 | 1 |
| 6 | `pytest test_safety.py -k stop_set` | `1066 passed` (1065 ca bộ dừng + 1 test cùng khớp `-k`) | 0 |
| 6 | `pytest test_safety.py -k "false_alarm or tier1_never or 24kb" -s` | `false alarms: 0/99` · `tier-1 missed: 0/132` · `slowest adversarial 24 KB text: 0.348s` | 0 |
| 7 | `scratchpad/h01_compare.py` (Base vs worktree, cùng câu) | b_fp EM0/UN4 (trần 1/5) = Base · b_fp2 EM3/UN1 (trần EM3) = Base · jx_negfp EM0/UN1 (trần EM2) = Base · R10 24 KB chậm nhất 0.450s (lần đo khác) | 0 |
| 7 | như trên, kho 4823 câu (mọi data test + 90 câu dò + mọi biến thể) | LOWER 248 / HIGHER 21; mọi LOWER là câu lành bị báo nhầm hoặc biến thể của chúng (40 câu gốc riêng biệt, liệt kê trong scratchpad), 19 câu EM→UNCLEAR đều là "…giờ hết rồi + vị trí"; HIGHER = "khói tỏa khắp…", "Khỏi lan ra…" | 0 |
| — | `grep -cP '[\x08\x0b\x0c]'` lexicon / safety.py / cases / test mới | 0 / 0 / 0 / 0 | — |

Test: tổng 1884 · pass 1884 · fail 0 · skip 0 (29 deselected là postgres, như Base).

## git diff --stat (chưa commit)
```
 seed/maintenance_v1/lexicon.yaml                 | 27 ++++++++++--------
 src/maintenance/safety.py                        | 35 ++++++++++++++++++++----
 tests/test_maintenance/data/safety_cases_p0.yaml | 24 ++++++++++++++++
 3 files changed, 70 insertions(+), 16 deletions(-)
?? tests/test_maintenance/test_safety_metamorphic.py
?? planning/05_2026-10-04_agent-hardening/reports/R01_safety-metamorphic.md
```

## Bộ biến thể (`test_safety_metamorphic.py`)
Nguồn: `safety_cases` + `regression_strings` của `safety_cases_p0.yaml`, 62 câu `test_independent_gold` (đọc từ `pytestmark`), `seed/maintenance_cr03/safety_cases.json`; khử trùng lặp. Mức kỳ vọng = mức engine trên câu gốc (các file test khác đã ghim nó bằng nhãn). 14 mẫu: 8 mẫu của handoff (T1–T8; T4 chỉ cho câu không dấu) + T9 "Sảnh thang máy tầng 2 tòa SIM-C {câu}" (đúng câu demo, không dấu câu), T10 "{câu}, tòa SIM-A tầng 3", T11 "Bãi đỗ xe tầng hầm B1 tòa SIM-A {câu}", T12 "Tòa nhà SIM-C tầng bảy phòng rác {câu}", T13 "{câu} ở phòng rác tầng 2 tòa SIM-B", T14 "tang 3 toa SIM-B {câu không dấu}". Một test cho mỗi mẫu (in danh sách vi phạm), 1 test nguồn, 3 test câu bắt buộc.

| Lớp vi phạm trên Base (33) | Mẫu | Nguyên nhân | Sửa |
|---|---|---|---|
| "…có khối rác…" ⇒ EMERGENCY (6) | T2 T9 T11 T12 T13 | `confirmers.khoi` có `toa` (tòa), `bay` (tầng bảy) | cặp chữ chắc nghĩa, xem bảng rà |
| "Đèn hành lang cháy sáng…" ⇒ EMERGENCY (2) | T12 T13 | `confirmers.sang` có `phong rac` | bỏ; regex S-05 riêng cho phòng/thùng/xe rác … cháy sáng không có danh từ đèn |
| "Chị ấy bốc hoả…" ⇒ EMERGENCY (3) | T5 T6 T12 | regex bốc hỏa nhận "phòng rác/xe" + 3 từ bất kỳ, xuyên dấu ":" | cấm đại từ người trong khoảng (toi, minh, ay, em, anh, chi, nguoi) |
| "…có tia lửa, giờ hết rồi" + vị trí ⇒ EMERGENCY (6) | T2 T10 T13 | R5: sau marker chỉ được tiểu từ | `safety.py`: bỏ qua đuôi vị trí thuộc tập đóng B-01 sau marker |
| B-01 "Bóng đèn bị cháy" ⇒ UNCLEAR (16) | T11 T12 | tập đóng thiếu "bãi đỗ xe", "tòa nhà", số đọc chữ ("bảy") | thêm vào `b01_prefix_words` |

Câu bắt buộc: "Sảnh thang máy tầng 2 tòa SIM-C có khối rác chưa dọn" NONE (Base EMERGENCY) · "Hành lang tầng 3 tòa SIM-A có khói tỏa ra từ hộp điện" EMERGENCY · "khói tỏa khắp hành lang tầng 5 tòa SIM-B" EMERGENCY (Base UNCLEAR; thêm S-04 `re:\bkhoi toa\b(?! nha\b| sim\b)`).

## Bảng rà từ vựng (Q02)
| Mục | Từ | Rủi ro (trùng chữ phản ánh) | Xử lý |
|---|---|---|---|
| confirmers.khoi | toa | CAO: "tòa" có ở gần mọi phản ánh | bỏ; thay `toa ra`, `toa khap`, `toa len` |
| confirmers.khoi | bay | CAO: "tầng bảy" | thay `bay ra`, `bay len`, `khoi bay` |
| confirmers.khoi | len | CAO: "lên tầng", "chất lên cầu thang" | thay `boc len`, `bay len`, `toa len` |
| confirmers.khoi | boc | CAO: "khối rác bốc mùi", "bọc nilon" | thay `boc len`, `boc ra` |
| confirmers.khoi | mui | CAO: "bốc mùi", "mùi hôi" | thay `mui khoi` (giữ stop set wp3d:C5 "có mùi khỏi") |
| confirmers.khoi | mu, um | thấp | `mu` → `mu mit`, `khoi mu`; giữ `um`; thêm `khoi lan`, `khoi cuon`, `nghi ngut`, `cuon cuon`. KHÔNG thêm `khoi toa`, `khoi den` (khối tòa nhà, khối đen) |
| intended `khoi boc` | khối | TB: "khối bọc nilon" | chỉ còn khỏi/khơi; "khối bốc ra" giữ nhờ `boc ra` |
| intended `boc khoi` | khối | TB: "bốc khối rác" (dọn rác) | GIỮ khối: stop set wp3d "Hộp điện … bốc khối" đòi EMERGENCY (đã thử bỏ ⇒ đỏ) |
| confirmers.lua | len | CAO: "lừa đảo lên tầng 5" | thay `lua len`, `len cao`, `len tran` |
| confirmers.lua | boc, toe, bung, hop dien, tu dien, o cam | thấp | giữ |
| confirmers.ngat | bat | CAO: "cầu dao bị ngắt bật mãi không lên" | thay `bat tinh` |
| confirmers.ngat | co nguoi | TB: "điện bị ngắt nên có người phải đi bộ" | thay `nguoi ngat` (giữ `nguoi bi`) |
| confirmers.ngat | nga | thấp ("ngã ba") | giữ |
| confirmers.ho | ra | CAO: "ra vào", "ra hỏi" | thay `ho ra`, `loi ra` |
| confirmers.ho | thong | TB: "thông báo cắt điện hộ dân" | thay `thong ra` |
| confirmers.ho | day, lo, tran | thấp/TB (dãy bị `homographs.day` loại; lo lắng, trần nhà) | giữ, ghi rủi ro còn |
| confirmers.chay | boc | TB: "ống bọc nilon chảy ra" | thay `boc chay` (giữ wp3d:C4 "bốc chảy") |
| confirmers.chay | mau | CAO: "nước màu vàng chảy ra" | thay `chay mau` (giữ wp3d:C10 "chạy máu") |
| confirmers.sang | phong rac, thung rac | CAO: "đèn phòng rác cháy sáng suốt đêm" | bỏ; S-05 regex `(?<!den )…(phong rac\|thung rac\|xe rac)(không den/bong/tuyp/phủ định){0,3} chay sang` + intended |
| confirmers.bat | o cam, hop dien… | thấp (thiết bị điện) | giữ |
| negation_fillers | co thay bi he duoc con | không có chữ vị trí; vị trí chen giữa cue và tín hiệu làm MẤT phủ định ⇒ mức cao hơn (hướng an toàn) | giữ |
| hedge_fillers | co thay bi la nhu dang tieng | như trên | giữ |
| b01_prefix_words | (thiếu) | thiếu vị trí cư dân ⇒ B-01 hụt (NONE→UNCLEAR) | thêm `bai do xe, bai xe, bai giu xe, toa nha, san thuong, san choi, tret, ba, bon, tu, nam, sau, bay, tam, chin, muoi` (chỉ là token tiền tố, vẫn cần danh từ đèn có dấu) |
| resolved_bridge_tokens | ra len bay gio… | thấp: chỉ xét khoảng giữa tín hiệu và marker | giữ |
| final_particles | a, day | "SIM-A", "dãy B" sau marker | xử lý bằng `_place_tail` (mã tòa/tầng là code token) |
| regex bốc hỏa | `\w+{0,3}` | CAO: chủ ngữ người ("Chị ấy bốc hoả") nối qua ":" với "phòng rác" | cấm đại từ người trong khoảng |
| regex S-05 `(tu dien…){0,8} chay`, thang máy…kẹt…người, khói nhiều | `\w+` khoảng | vị trí trong khoảng chỉ làm TĂNG bắt; biến thể 0 vi phạm | giữ |

## Sửa `safety.py` (một chỗ, R5)
`_Lookups.valid_markers`: sau khi bỏ tiểu từ cuối câu, bỏ thêm đuôi vị trí (`_place_tail`: chuỗi tách được thành tập đóng `b01_prefix_words` + `b01_code_token_regex`, ≤ `b01_max_prefix_tokens`, PHẢI có mã hoặc cụm ≥ 2 chữ — từ đệm đơn lẻ như "lại đang" không tính). Hạ mức duy nhất: "…<tín hiệu>, giờ hết rồi ở hành lang tầng 4 tòa SIM-B" EMERGENCY → UNCLEAR (đúng T2-02 khi không có vị trí). Tín hiệu MỚI sau marker vẫn tự phán PRESENT (SC-238 "Có khói, giờ hết rồi lại bốc khói ở tầng 3" = EMERGENCY). Không thêm khoá lexicon (catalog `extra="forbid"`, catalog.py ngoài phạm vi) nên dùng lại tập đóng vị trí của B-01.

## Đánh đổi đã quyết (🔴)
- Gõ sai dấu "khói" thành "khối/khỏi" chỉ còn giữ khi cụm hai chữ chắc nghĩa có trong mệnh đề (hoặc pattern intended `co khoi`, `boc khoi`, `khoi boc`); câu như "Khỏi bay khắp hành lang" vẫn EMERGENCY (`khoi bay`), nhưng "Khối … lên tầng" thì không. Văn bản không dấu không bị ảnh hưởng (giữ mức cao).
- "bốc khối rác" vẫn EMERGENCY (giữ stop set wp3d "bốc khối"). Không sửa được trong phạm vi mà không làm đỏ ca cũ.
- Đuôi vị trí sau marker hạ EM → UNCLEAR (vẫn leo thang Bậc 2 cho người xem).

## Việc KHÔNG làm + lý do
- Không đổi `lexicon_version`, không đụng khối `priority` (handoff §2).
- 7 lỗi redteam còn nguyên (M08 M43 M44 M45 M47 F04 F05): ngoài phạm vi lớp lỗi vị trí; F04/F05 ("cứu với"/"kêu cứu" nghĩa bóng) bị plan 05 Q03 khoá theo spec.
- Bước 0 chế độ GHI không chạy (sửa AGENTS.md/brain4agent = vùng cấm). Không commit, không phóng agent con.
- `docs/maintenance.md` §3 chưa ghi luật `_place_tail` và các cặp confirmers mới (docs/ ngoài phạm vi) — SO cần đồng bộ.
- Ghi chú: worktree ban đầu ở `5591925`, sạch ⇒ `git reset --hard e14b1a9` trước khi làm.

Phán quyết: ✅ mọi "xong khi" đạt (1884/0 fail, biến thể 33 → 0, redteam 7 = 7, ruff 0, ĐỎ 10 failed trên Base) — chờ SO đo lại.
