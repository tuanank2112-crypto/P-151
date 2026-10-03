Vai: worker · loại: thi công · họ/model: Claude Sonnet 5.5 (🟠) · Bước 0 exit: 0 · hiểu việc: sửa hẹp theo Q31 sau thẩm định lần 3 (R09): A cue một chữ cái, B hedge/B-04 chỉ trên chữ có dấu, C R7 đồng tự không làm mất tín hiệu khi gõ sai dấu, D hazard "chữa/báo/phòng cháy", G ký tự điều khiển, 5 lỗ từ vựng; ca nhãn ĐỎ viết trước; xong khi pytest/ruff exit 0, atk1–atk4 đúng mức Q31, bộ dừng D-1…D-7, D-9 và ngưỡng báo nhầm Q29 không hồi quy, làm đỏ A/C (+B/D/G) rồi xanh, một commit local; CẤM engine/models/views/priority/rules/proposer/api/web/specs/plan, xoá/sửa ca nhãn cũ, đọc `judge/` hoặc `jx_holdout.py`
Handoff: H07_wp3d-safety-fixes.md
Base: a37926a1c44a88ee8b88829162fe4e0e51854ea6
Head: 6a356648dcf3067f3fe6cdee4d694f88a9a6d642

## Lệnh + exit (output máy ở `evidence/WP3d/*.txt`, đã commit trong Head)
| Lệnh | Kết quả | File |
|---|---|---|
| `init_brain.js --check` | exit 0 | — |
| Ca nhãn ĐỎ viết trước (76 ca `wp3d:*` thêm vào bộ dừng + 8 test `test_wp3d_*`) chạy trên code HEAD | `55 failed, 1407 passed` (47 ca bộ dừng + 8 test) | `red-before.txt` |
| `python -m pytest -q -p no:cacheprovider` sau sửa | `1462 passed`, EXIT=0 (nền 1378, +84) | `pytest.txt` |
| collected | 1462 | `collect.txt` |
| `ruff check` / `ruff format --check src tests` | `All checks passed!` EXIT=0 / `52 files already formatted` EXIT=0 | `ruff.txt` |
| `test_safety.py` + `test_priority.py` | `1285 passed` | `pytest-safety.txt` |
| atk1, atk2, atk3, atk4 của auditor chạy lại | xem bảng dưới | `atk-rerun.txt` |
| 16 script bộ dừng nguyên văn (TESTING §11.5) | 16/16 `EXIT=0`, số liệu = WP3c | `stopsets-scripts.txt` |
| M-04 / M-10 / G-05; chữ vô hình thô trong `safety.py`, `catalog.py` | `17 10 2` · bốn file `:0` · `12 4 []` · 0 / 0 | `contracts.txt` |

Test: tổng 1462 · pass 1462 · fail 0 · skip 0. `grep -cP '[\x08\x0b\x0c]'` trên các file ghi: 0.

## Bảng A–D, G, từ vựng (trước -> sau; atk1–atk4 + bộ dừng)
| Mục | Ca | Trước (HEAD) | Sau | Cách sửa |
|---|---|---|---|---|
| A | A1–A6, A8, A9 ("Tòa SIM-K có khói…", "Block K", "Khu K", "Căn hộ K", "Hanh lang toa SIM-K co khoi") | NONE (9/9) | EMERGENCY | bỏ cue `k co`, `k thay`; validator mới chặn mọi cue có token một ký tự |
| A | A7 "Tòa KO có khói bốc ra" | NONE | NONE | giới hạn đã biết (Q31): `ko` là cue hợp lệ; KHÔNG test |
| B | B1–B4, B6–B9 (cô Lệ/Lê/Vẽ, chị Nghị, Dương Như) | UNCLEAR (8/8) | EMERGENCY | `hedge_forms`: cue hedge chỉ tính khi viết đúng dấu; "Hình như/Có lẽ có khói" vẫn UNCLEAR, "hinh nhu co khoi" không dấu => EMERGENCY |
| B | F1, F2 (anh Chiến, chị Nương) | UNCLEAR (B-04) | EMERGENCY | mọi ngữ cảnh nấu ăn chuyển sang `khet_benign_contexts_accented` (khớp chữ có dấu); `khet_benign_contexts` = [] |
| C | C1–C7, C9–C13, C15–C19, C21 (khỏi/khối/lừa/lúa/ngắt/hộ/chảy sai dấu) | NONE hoặc UNCLEAR (23/26) | EMERGENCY | `homograph_confirmers` theo token (khoi: bốc/bay/lên/tỏa/mùi/mù/um; lua: bốc/lên/tóe/bùng/hộp điện/tủ điện/ổ cắm; ngat: người/bị/xỉu/ngã/bất; ho: ra/dây/lờ/tràn/thông; chay: lửa/khói/khét/bốc/máu) + `homograph_intended` mới |
| C | C3, C10, C14 | UNCLEAR | EMERGENCY | như trên |
| D | D1, D2, D5, D6 ("chữa/báo cháy hay …") | NONE / UNCLEAR | EMERGENCY | `coordination_hazard_exclusions: [chua chay, bao chay, phong chay]` |
| G | G1–G15 (Cc, DEL, NUL, U+0085, U+2800, U+E000…) | NONE (G1, G2, G3, G6, G9, G13 và các ca cùng loại) | EMERGENCY | `is_invisible` thêm Cc (trừ tab/xuống dòng/CR), U+2800, Private Use (`Co`) |
| Từ vựng | V1 "cháy sang tường", V5 "hộp điện nổ", V7 "bị bỏng", V14 "dây điện bị trần ra" | NONE | EMERGENCY (V5/V7/V14 >= UNCLEAR đạt) | S-05: `chay sang/ra`, thiết bị điện + `nổ`; S-09: `bi bong`, `nguoi ben trong khong ra duoc`; S-03: `day dien bi tran (ra)`; homographs `no` (nó), `bong` |
`atk1`: `FAILS: 4 ['A7','E1','F3','F5']` (HEAD: 33); `atk2`: `FAILS: 0` (HEAD: 16); `atk4`: `FAILS: 0` (HEAD: 4); `atk3` (qua engine): mọi ca `VERIFYING EMERGENCY_PENDING_BQL EMERGENCY`.
Còn lại ngoài Q31 (không thuộc A–D, G): A7 (giới hạn đã biết), E1 "có khói bay ra hết rồi" => UNCLEAR (R5 marker; R09 không liệt kê), F3 "phòng bánh kẹo" và F5 "chị Thịt" => UNCLEAR B-04 (chữ "bánh", "thịt" ĐÚNG dấu nên không thể phân biệt tên riêng; R09 chỉ nêu "anh Chiến", "chị Nương" đã sửa).

## Bộ dừng + ngưỡng báo nhầm Q29 (không hồi quy; số = WP3c)
| Mục | Kết quả | Ngưỡng |
|---|---|---|
| D-1 `a_text` / `a_text2` | `BAD 1` (chỉ A4) / `BAD 0` | chỉ A4 |
| D-2 `a_split`, `c_uni`, `c_elong`, `i_recall`, `f_neg` | 0 · 5 (đúng 5 id §11.4) · 6 (đúng 6 id) · `{'EMERGENCY': 31, 'UNCLEAR': 9, 'NONE': 2}` · 0 | 0 lọt ngoài §11.4 |
| D-3 `f_neg`, `a_sep`, `jx_coord`, `a_b01` | 0/100 mọi ngăn cách · 0 · 0/100 × 4 · 0 | 0 |
| D-4 `j_fix` | `{'NONE': 10, 'EMERGENCY': 2}` (CLN-004, TEC-005) | đúng 2 |
| D-5 `b_fp` (59) | EMERGENCY 0, UNCLEAR 4 | EM <= 1, UNCLEAR <= 5 |
| D-6 `jx_negfp` (20) | `{'EMERGENCY': 0, 'UNCLEAR': 1, 'NONE': 19}` | EM <= 2 |
| D-7 `b_fp2` (33) | EMERGENCY 3 (gãy chân/tay đồ vật), UNCLEAR 1 | EM <= 3 |
| D-9 24 KB | chậm nhất < 1 s (test `slowest adversarial` xanh) | < 1 s |
| `g_prio`, `a_fuzz` | `FAILS 1` (chỉ g10) · `combos 900 issues 0` | như WP3c |
Bộ dừng trong pytest: 989 ca cũ + 76 ca `wp3d:*` xanh; D-8 (holdout) do SO.

## Làm đỏ (TESTING-style: đỏ rồi hoàn tác xanh)
| # | Cách làm đỏ | Đỏ | Xanh |
|---|---|---|---|
| A | thêm lại `k co`/`k thay` (+ tắt validator một chữ cái) | 10 ca A + test đỏ: `NONE` thay vì `EMERGENCY`, EXIT=1 (`red-A.txt`) | `10 passed` EXIT=0 (`green-A.txt`) |
| C | tắt `homograph_confirmers` | `test_wp3d_homograph_typos_keep_the_signal` đỏ ("…có lúa"), EXIT=1 (`red-C.txt`) | EXIT=0 (`green-C.txt`) |
| B | bỏ kiểm dấu của hedge | `test_wp3d_hedge_cue_needs_accents` đỏ ("cô Lệ"), EXIT=1 (`red-B.txt`) | EXIT=0 (`green-B.txt`) |
| D | bỏ `coordination_hazard_exclusions` | `test_wp3d_fire_equipment_is_not_a_hazard_in_coordination` đỏ, EXIT=1 (`red-D.txt`) | EXIT=0 (`green-D.txt`) |
| G | bỏ nhánh Cc của `is_invisible` | `test_wp3d_control_characters_are_invisible` đỏ (`'\x08'`), EXIT=1 (`red-G.txt`) | EXIT=0 (`green-G.txt`) |
Sau cả năm lần hoàn tác: `1462 passed` EXIT=0, ruff EXIT=0 (`green-after-restore.txt`).

## git diff --stat a37926a..6a35664
```
 brain4agent/memory/hot/today.md                    |   1 +
 planning/.../evidence/WP3d/*.txt (20 file)         | ~720
 seed/maintenance_v1/lexicon.yaml                   |  74 ++++-
 src/maintenance/catalog.py                         |  26 +-
 src/maintenance/safety.py                          |  51 ++-
 tests/test_maintenance/data/safety_stop_sets_p0.yaml | 246 ++-  (chỉ thêm 76 ca `wp3d:*`; escape U+2800 cũ)
 tests/test_maintenance/test_safety.py              | 122 +
 26 files changed, 1210 insertions(+), 27 deletions(-)
```
Chỉ đường dẫn thuộc phạm vi H07; `engine.py`, `priority.py`, `models.py`, `views.py`, `rules.py`, `proposer.py` không đổi; không sửa/xoá ca nhãn cũ.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP3d sửa hẹp (code + lexicon + ca nhãn) | 🟠 | Claude Sonnet 5.5 (🟠), không giao xuống thấp hơn |

## Việc KHÔNG làm + lý do
- A7 "Tòa KO có khói" (giới hạn đã biết), E1 (R5 marker), F3/F5 (chữ có dấu thật): ngoài Q31/R09.
- Không đọc `scratchpad\judge\` và `jx_holdout.py`; không sửa script auditor; không chạm `priority.py` (SPEC-P03 không đổi).

## Drift (so với Q31 / SPEC)
1. Q31.C ghi một danh sách từ đồng hiện phẳng (bốc/bay/ra/lên/tỏa/cháy/điện/người/bị/xỉu/té). Cài theo TỪNG token đồng tự (`homograph_confirmers`, dữ liệu trong lexicon): danh sách phẳng làm "Nước chảy lan ra sảnh" (có "ra") thành Bậc 1 và phá `test_homographs_by_accented_token_per_pattern` + ngưỡng báo nhầm; "bị", "người", "điện" trần cũng gây báo nhầm ("bị ngắt điện", "tiền điện … có lựa chọn"). Mọi từ Q31 vẫn có mặt ở token mà nghĩa nguy hiểm cần chúng. Cần SO xác nhận.
2. Q31.C yêu cầu `homograph_intended` cho `co lua`: KHÔNG thêm, vì `Cư dân có lựa chọn đỗ xe ở hầm xe B1…` phải giữ NONE (test TESTING §4.1 `test_homographs_by_accented_token_per_pattern`); "có lừa/lúa bốc lên" được giữ bằng confirmers (bốc/lên/hộp điện…). Các key còn lại của Q31 đã thêm: `co khoi`, `boc khoi`, `khoi boc`, `lua boc`, `ngat di`, `day dien ho`, `day dien ho ra`.
3. `bi ngat` + intended (Q31) làm "Phòng 502 bị ngắt điện" thành EMERGENCY; để tránh, pattern S-09 `bi ngat` chuyển thành regex có lookahead loại `điện/nước/…` (cùng danh sách với regex `ngat` cũ) và validator V-08 nới: khoá `homograph_intended` có thể là chuỗi regex có thật (vẫn phải nằm trong pattern của tín hiệu, token vẫn ∈ `homographs`).
4. Ba khoá lexicon mới bắt buộc, không mặc định (như WP3c): `hedge_forms` (mỗi hedge một mục dạng có dấu), `homograph_confirmers`, `coordination_hazard_exclusions`; validator ném `ValidationError` khi thiếu/sai (test `test_wp3d_lexicon_validators`).
5. Lỗi công cụ ghi (gotcha): bộ ghi file giải mã chuỗi `\uXXXX` thành ký tự thật nên bản WP3c của `safety.py` mang chữ Hangul filler THÔ trong mã nguồn (M-10 vẫn xanh vì chỉ bắt `\x08\x0b\x0c`). Đã thay bằng mã điểm (`map(chr, (0x115F, …))`, `ord(...)`); kiểm 0 ký tự vô hình thô trong `safety.py`/`catalog.py` (`contracts.txt`).
6. File bộ dừng: ca mới `wp3d:*` trích bằng `ast` từ `atk1/atk2/atk4` (không gõ tay), loại A7, B5, E*, F*; ký tự U+2800 thô có sẵn từ WP3c nay được escape `⠀` (nội dung ca không đổi).

## Câu hỏi mở
- Xác nhận drift 1–3 (đồng hiện theo token, bỏ `co lua` intended, regex `bi ngat`).
- Đồng bộ chữ SPEC-P01 §3.3.1 (R7) và hedge khi đóng hồ sơ (Q31 đã ghi).

⏳ Chờ người duyệt.

SO đo lại 2026-10-02: pytest 1462 passed · ruff sạch · diff 5 file đúng H07; holdout {EM 31, UNCLEAR 6, NONE 2}/39; f_neg 0; a_b01 0; jx_negfp EM 0; b_fp2 trong ngưỡng; atk2/atk4 0; atk1 còn A7/E1/F3/F5 ngoài Q31. Drift 1–3 chấp nhận (Q32).
✅ DUYỆT
