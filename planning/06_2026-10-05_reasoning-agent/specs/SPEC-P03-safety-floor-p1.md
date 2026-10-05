# SPEC-P03 (P1-C) — Lưới sàn luật an toàn P1: S-06, S-07, S-08, S-10, S-11, S-12, S-13 (+ S-00 cho Agent)

| Trường | Giá trị |
|---|---|
| WP | WP2 (🔴 — thiết kế từ vựng cần quyết định ngoài bảng; thẩm định đối kháng bắt buộc ở WP12) — Wave 1, độc lập với engine; mục S-00 làm SAU khi WP1 nhập `SignalDef.agent_only` |
| Vai trò trong kiến trúc mới | Agent (LLM) hiểu nghĩa và được NÂNG mức; luật P1 là **lưới sàn**: chạy cả khi mô hình lỗi, mức cuối = max(luật, Agent) (00 I-17). Báo nhầm của luật KHÔNG được Agent hạ ⇒ độ chính xác của luật quyết định tải BQL |
| Nguồn | CR §6.1, §6.2 (S-06…S-08, S-10…S-13), §6.6 (bẫy), §15 (AC-01, AC-02 "ví dụ mùi gas", bộ ≥ 40 câu), §16 P1; plan 05 Q01/Q10; plan Q02, Q10, Q11 |
| Máy đo | [`REF-p1-safety-meter.py`](REF-p1-safety-meter.py) (chạy từ root; exit 0 ⇔ mọi cổng §6 đạt) |
| File được ghi | `seed/maintenance_v1/lexicon.yaml` (CHỈ khối `safety` + `lexicon_version`; thêm mục S-00 ở 01 §4.2), `tests/test_maintenance/data/safety_cases_p1.yaml` (mới — `git add -f`), `tests/test_maintenance/test_safety_p1.py` (mới), và CHỈ các dòng liệt kê ở §5 trong `tests/test_maintenance/test_safety.py`, `test_safety_p0.py`, `test_safety_metamorphic.py`, `data/safety_cases_p0.yaml` |
| CẤM chạm | `src/maintenance/safety.py`, `catalog.py`, `engine.py`, `rules.py`, khối `priority` của lexicon, `data/safety_stop_sets_p0.yaml` (bộ dừng: chỉ được THÊM ca, không sửa ca cũ) |

## 1. Số đo nền (architect, đo lại 2026-10-05 trên base `82f01f0` — lexicon `2026-10-05.p0g`, câu dùng tòa S1/S2) — vì sao không thể chỉ "bật cờ"

| Phép đo | Lệnh | `active_phases: [P0]` (hiện tại) | Bật thô `[P0, P1]` (bản sao tạm, `--flip`) |
|---|---|---|---|
| Bộ dừng (800 tổ hợp + 40 ký tự ngăn + 226 ca nhãn) | meter | 1066 / 0 vi phạm | 1066 / 0 |
| Ngân sách `b_fp` (EM ≤ 1, UNCLEAR ≤ 5) | meter | EM 0, UNC 4 | EM 0, UNC 4 |
| `b_fp2` (EM ≤ 3) | meter | EM 3 | EM 3 |
| `jx_negfp` (EM ≤ 2) | meter | EM 0 | **EM 1** ("Không có ai bị thương, chỉ là đèn … rơi xuống sàn." — S-11, đúng CR) |
| Fixture khẩn cấp == {CLN-004, TEC-005} | meter | đạt | đạt |
| MUST_CATCH (47 câu, §3) | meter | 45 sai (P1 tắt) | **10 sai** (S-08 ×5, S-12 ×1, S-13 "chất thải y tế", S-11 "rớt", 2 câu hedge) |
| MUST_NOT_RAISE (21 câu, §3) | meter | 2 sai (2 câu đòi Bậc 2 theo chính sách mới) | **15 sai** (mau/màu, đèn rồi, lá/dây phơi rơi, quá nóng, mùi gà, đồ hóa chất, "Cháy đến … rồi") |
| Biến thể vị trí của 68 câu P1 | meter | 980 / 0 | 980 / 0 |
| Kho phân loại × 18 mẫu × 2 dấu (5587 câu) đổi mức | meter | — | 74 câu, đều "đèn rơi/sắp rơi" (S-11) |
| `pytest -q` toàn bộ | `pytest` trên bản sao `git archive HEAD` có bật thô | 2971 pass | **12 fail, 2959 pass** (liệt kê §5) |

Lệnh tái lập: `PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-p1-safety-meter.py --flip; echo "EXIT=$?"` ⇒ `GATES_FAILED=25`, `EXIT=1`; chế độ repo (P0) ⇒ `GATES_FAILED=47` (45 MUST_CATCH + 2 MUST_NOT_RAISE).

## 2. Hợp đồng dữ liệu
- `safety.active_phases: [P0, P1]`; `lexicon_version: "2026-10-05.p1a"` (đổi mỗi vòng sửa: `.p1b`, …).
- Bảy tín hiệu giữ `signal_id`, `tier: 1`, `phase: P1`, `name`; được viết lại `patterns`. Thêm ĐÚNG MỘT mục `S-00` (`agent_only: true`, không pattern — chỉ Agent ghi, phải có trích dẫn; 01 §4.2). Không thêm tín hiệu khác (C-01 ngoài phạm vi). Tổng `signals` 18, P0 vẫn 10 (assert `test_lexicon_loads_and_every_pattern_compiles` đổi `17` → `18`).
- Cơ chế được dùng (đều là dữ liệu, `safety.py` đã hỗ trợ): `patterns` (cụm hoặc `re:`; khoảng chen giữa PHẢI chặn phủ định như các mẫu S-03/S-05 hiện có: `(?: (?!khong\b|ko\b|chua\b|chang\b)\w+){0,N}`), `homographs` + `homograph_intended` + `homograph_confirmers` (R7), `ambiguous_terms` (Bậc 2, T2-03), `ambiguous_exclusions`. Validator V-01…V-12 + khoá WP3d phải qua (nạp hỏng ⇒ engine không khởi tạo).
- Bẫy đã biết: thêm khoá vào `homographs` (vd `mau`, `roi`, `ga`, `do`) ảnh hưởng MỌI mẫu chứa token đó, kể cả P0 (vd `chay mau` của S-09 cần `homograph_intended` chứa `mau: [mau, máu]`; S-13 "chất thải y tế" hiện bị `homographs.te` loại vì "tế" — cần `homograph_intended`). Sau mỗi lần sửa chạy lại TOÀN BỘ cổng §6.

## 3. Chính sách từ hai nghĩa (quyết định của architect — worker làm cho khớp, không bàn lại)

| Lớp va chạm | Có dấu — nghĩa nguy hiểm | Có dấu — nghĩa thường | Không dấu |
|---|---|---|---|
| gas / gà | "mùi gas/ga", "mùi khí đốt", "rò rỉ gas", "xì gas" ⇒ EMERGENCY (S-10) | "mùi gà" ⇒ NONE | "mui gas", "mui ga" ⇒ EMERGENCY (nghĩa gas trội, bỏ sót gas là thảm hoạ) |
| rơi / rồi | chủ ngữ kết cấu (đèn, bóng đèn, máng đèn, đèn ốp trần, trần, tấm trần, kính, quạt trần) + "rơi/rớt/sắp rơi/sắp sập/sập" ⇒ EMERGENCY (S-11) — span BẮT ĐẦU ở danh từ chủ ngữ để luật phủ định/nghi ngờ (R1/R5) áp được ("Có vẻ đèn … sắp rơi" ⇒ UNCLEAR) | "đèn rồi", "hỏng đèn rồi", "lá cây/rác/dây phơi/dây điện thoại rơi xuống" ⇒ NONE | "den roi xuong", "tran sap" ⇒ EMERGENCY; "den roi" đứng riêng (rơi hay rồi?) ⇒ UNCLEAR (Bậc 2, tiền lệ B-01 không dấu) |
| máu / màu / mau | "máu" (danh từ) có dấu, "vết máu", "dính máu" ⇒ EMERGENCY (S-13; D-11) | "màu", "mầu", "mẫu"; "mau" (= nhanh, viết không dấu kể cả trong câu có dấu) ⇒ NONE | "vet mau", "dinh mau" ⇒ EMERGENCY; "mau" đứng riêng ⇒ NONE (không thể là tín hiệu) |
| đổ / đồ hóa chất | "đổ hóa chất", "hóa chất … đổ/tràn/loang", "axit/acid … đổ" ⇒ EMERGENCY (S-12) | "đồ hóa chất (để ở góc)" ⇒ NONE | "do hoa chat" ⇒ UNCLEAR (Bậc 2) |
| nóng thiết bị / nóng thời tiết | thiết bị điện (đèn, bóng, hộp đèn, ổ cắm, công tắc, dây điện, tủ điện) + "nóng ran/nóng bỏng tay/quá nóng/chảy nhựa/cháy xém/biến dạng vì nóng" ⇒ EMERGENCY (S-07) | "hành lang quá nóng", "trời nóng" ⇒ NONE | như có dấu (luật theo thiết bị) |
| nước + thiết bị điện | chất lỏng (nước, nước mưa, chất lỏng) + "tràn/ngập/nhỏ/thấm/rò rỉ" + thiết bị điện, hai chiều ("nước tràn vào tủ điện", "tủ điện bị ngập nước", "tủ điện … bị nước tràn vào") ⇒ EMERGENCY (S-08) | "nước tràn ra sàn" (không thiết bị) ⇒ NONE (việc vệ sinh) | như có dấu |
| điện giật / giật mình | "bị điện giật", "giật tê tay", "rò điện", "tê điện" ⇒ EMERGENCY (S-06) | "giật mình", "giật nước" ⇒ NONE (loại trừ sẵn có) | như có dấu |
| kim tiêm | "kim tiêm", "ống kim tiêm", "chất thải y tế", "bông băng dính máu" ⇒ EMERGENCY (S-13) | — | như có dấu |

Phủ định ("không có mùi gas") ⇒ NONE; nghi ngờ đặt NGAY trước tín hiệu ("hình như có mùi gas") ⇒ UNCLEAR (T2-01); "đã xảy ra, giờ hết" ⇒ UNCLEAR (T2-02) — luật R1/R5 sẵn có, không đổi.

### 3.1 Bộ câu nghiệm thu tối thiểu (nguồn `tests/test_maintenance/data/safety_cases_p1.yaml`)
Đúng 68 câu trong `REF-p1-safety-meter.py` (`MUST_CATCH` 47 kể cả 2 phủ định, 3 nghi ngờ, 2 không dấu; `MUST_NOT_RAISE` 21) là TỐI THIỂU, chép nguyên văn sang YAML cùng `id`, `expect`/`expect_any`, `signals`. Worker THÊM để mỗi tín hiệu có ≥ 6 câu phải bắt, trong đó ≥ 1 câu không dấu và ≥ 1 câu vị trí giữa câu kiểu cư dân ("Đèn ở hành lang tầng 3 tòa S1 nóng ran"); thêm ≥ 1 câu phủ định mỗi tín hiệu. Định dạng:
```yaml
# P1 (plan 06 SPEC-P03). expect ∈ {EMERGENCY, UNCLEAR, NONE} | expect_any: [...]; signals = tối thiểu phải ghi status != ABSENT
must_catch:
  - {id: P1-S10-01, text: "Hành lang tầng 5 tòa S1 có mùi gas nồng nặc", expect: EMERGENCY, signals: [S-10]}
must_not_raise:
  - {id: P1-FP-01, text: "Hành lang tầng 3 tòa S1 nhiều rác, nhờ dọn mau giúp", expect: NONE}
```
Danh sách trong REF và trong YAML phải trùng nhau (SO kiểm bằng cách chạy meter chế độ repo: `GATES_FAILED=0`).

## 4. `safety.py` — mặc định CẤM sửa
Nếu một câu §3.1 KHÔNG THỂ đạt bằng dữ liệu (chứng minh bằng một câu tối thiểu + lý do cơ chế), worker DỪNG, ghi "Câu hỏi mở" trong report, không tự sửa luật — quyết định 🔴 của SO/judge (V-12). Ngoại lệ đã biết: không có.

## 5. Nhãn/test được đổi (DUY NHẤT danh sách này; mọi test khác đỏ ⇒ sửa từ vựng, không sửa test)
| Test | Đổi | Lý do |
|---|---|---|
| `test_safety.py::test_lexicon_loads_and_every_pattern_compiles` | `LEX.active_phases == ("P0", "P1")`; `len(LEX.signals) == 18` | hợp đồng §2 |
| `data/safety_cases_p0.yaml` SC-37 ("Có bị điện giật nhẹ khi chạm vào hộp đèn tầng 4 tòa SIM-A.") | `expect: UNCLEAR` → `EMERGENCY`, `signals: [S-06]` | S-06 bật (plan 01 Q18 đã báo trước) |
| `test_safety_p0.py::ABOVE_LABEL` | thêm `"Mùi gas": "EMERGENCY"`, `"Kim tiêm": "EMERGENCY"` (KHÔNG sửa nhãn vàng của Trường) | nhãn vàng ghi theo phase P0; cơ chế ABOVE_LABEL sẵn có (plan 02 Q09) |
| `test_safety.py::test_llm_p1_signal_ignored_in_p0` | viết lại: phán quyết LLM cho `signal_id` không có trong từ vựng đang bật (vd `"S-99"`) bị bỏ qua, ghi chú "ngoài từ vựng" | S-10 nay đang bật |
| `test_safety.py::test_tier2_net_outside_spans` | dòng "Thấy máu ở cầu thang bộ tòa S1" kỳ vọng S-13 `PRESENT`, mức EMERGENCY; giữ dòng "khói" (R9) | D-11 |
| `test_safety_metamorphic.py::labelled_texts` | nối thêm mọi `text` của `safety_cases_p1.yaml` (cả hai danh sách) | biến thể vị trí phủ P1 |
PHẢI giữ xanh không sửa (bật thô làm đỏ): `test_labelled_case[SC-178]`, `[SC-179]`, `[SC-194]`, `[SC-239]`, `test_false_alarm_count_on_benign_strings`, `test_b01_closed_prefix_twenty_tokens_and_lamp_accent` ("Cháy đến tầng 3 tòa SIM-A rồi" ⇒ UNCLEAR).

## 6. Cổng (máy đo, số kỳ vọng)
| # | Cổng | Lệnh | Kỳ vọng |
|---|---|---|---|
| C1 | Bộ dừng | `pytest -q tests/test_maintenance/test_safety.py -k "stop_set"` | 0 fail (1066 ca) |
| C2 | Ngân sách báo nhầm | `pytest -q tests/test_maintenance/test_safety.py -k "false_alarm_budget"` | `b_fp` EM ≤ 1 & UNC ≤ 5; `b_fp2` EM ≤ 3; `jx_negfp` EM ≤ 2; fixture == {CLN-004, TEC-005} |
| C3 | Ca nhãn P0 + vàng + CR03 | `pytest -q tests/test_maintenance/test_safety.py tests/test_maintenance/test_safety_p0.py tests/test_maintenance/test_cr03_targets.py` | 0 fail |
| C4 | Ca P1 | `pytest -q tests/test_maintenance/test_safety_p1.py` | 0 fail; ≥ 68 ca + ca engine |
| C5 | Biến thể vị trí (P0 + P1) | `pytest -q tests/test_maintenance/test_safety_metamorphic.py` | 0 vi phạm |
| C6 | Kho phân loại chỉ đổi qua S-11 "đèn rơi" hoặc S-08 "nước vào thiết bị điện" (Q22) | test trong `test_safety_p1.py` (logic như `gate_corpus` của meter) | mọi câu đổi mức đều có (S-11 `PRESENT` + danh từ đèn + rơi/rớt) HOẶC S-08 `PRESENT` (Q22) |
| C7 | Meter tổng | `PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-p1-safety-meter.py; echo "EXIT=$?"` | `GATES_FAILED=0`, `EXIT=0` |
| C8 | Hiệu năng | `test_assess_is_linear_on_a_24kb_text`, `..._adversarial_24kb_texts` | < 1 s như cũ |

## 7. Ca cấp engine (trong `test_safety_p1.py`, `fresh` engine)
- AC-02: `receive("Có mùi gas")` (ngoài phạm vi, không vị trí) ⇒ `VERIFYING/EMERGENCY_PENDING_BQL`, `draft is None`, `department_id is None`, outbox `emergency.created` có `signal_ids` chứa `S-10`.
- `receive("Có kim tiêm vứt bừa ở cầu thang bộ tầng 4 tòa S1")` ⇒ khẩn cấp; `receive("Nước tràn vào tủ điện ở hầm B1 tòa S1")` ⇒ khẩn cấp (trước P1 engine dừng `OUT_OF_SCOPE`); `receive("Đèn hành lang tầng 3 tòa S1 nóng ran, chạm vào bỏng tay")` ⇒ khẩn cấp.
- Câu thường có chữ va chạm (`P1-FP-01`, `-03`, `-06`, `-11` có vị trí đầy đủ) ⇒ ROUTED đúng phòng ban như trước P1.

## 8. Luật

**BẮT BUỘC**
1. Sửa DỮ LIỆU, không sửa luật (§4); mỗi vòng đổi `lexicon_version`.
2. Câu nghiệm thu viết như cư dân thật, có vị trí đầy đủ (plan 05 Q04), cả có dấu và không dấu.
3. Chạy đủ C1–C8 sau MỖI lần sửa từ vựng; evidence từng cổng.

**CẤM**
1. Hạ mức bất kỳ ca nhãn P0/vàng/CR03 nào; sửa ca cũ trong bộ dừng; nới ngân sách báo nhầm.
2. Khớp "mau" đứng riêng thành tín hiệu; khớp "rơi xuống" không có chủ ngữ kết cấu thành Bậc 1.
3. Bật `C-01`/B-05, thêm tín hiệu ngoài bảy mã.

**Vùng cấm**
| Không làm | Lý do |
|---|---|
| Không đặt "den roi" không dấu thành NONE cho đỡ tải BPTN | có thể là "đèn rơi"; Bậc 2 để người xem (tiền lệ B-01) |
| Không coi mọi "nước tràn" là S-08 | tràn ra sàn là việc vệ sinh phổ biến (PB-CLN-01); chỉ khi có thiết bị điện |
| Không gỡ ca `jx_negfp` "đèn … rơi xuống sàn" khỏi ngân sách | CR nói "đèn rơi" là Bậc 1; còn trong ngân sách; Trường rà nhãn (bàn giao, ngoài hồ sơ) |
| Không sửa `rules.ELECTRICAL_HAZARD_PATTERNS` | là lớp chặn thứ hai của phân loại; 2b nay bắt trước |

## 9. Phân loại lỗi + hành vi caller
| Lỗi | Dấu hiệu | Caller (worker/SO) |
|---|---|---|
| YAML sai validator | `ValidationError` khi `load_lexicon()`; app không khởi động | sửa YAML theo thông báo; không sửa code để "chịu" |
| Một câu §3.1 không đạt được bằng dữ liệu | chứng minh tối thiểu | dừng, hỏi 🔴 (§4) |
| Cổng C1/C2/C5 đỏ sau 2 vòng | hai report cùng đỏ | leo thang judge (AGENTS K.5) |
| Báo nhầm mới ngoài danh sách | thẩm định WP12 tìm thấy | thêm ca vào `must_not_raise`, sửa từ vựng, vòng mới |

## 10. Nghiệm thu
- C1–C8 đạt (bảng §6); `pytest -q` toàn bộ: 0 fail.
- Phải ĐỎ trước (`evidence/WP2/red-before.txt`): `test_safety_p1.py` + YAML mới chạy trên lexicon cũ ⇒ ≥ 45 fail (đo nền: 45 MUST_CATCH + 2 MUST_NOT_RAISE sai ở P0).
- Đột biến (`evidence/WP2/mutation-*.txt`): (a) `active_phases: [P0]` ⇒ C4 đỏ; (b) bỏ dạng "gà" khỏi `homographs.ga` ⇒ `P1-FP-07` đỏ; (c) bỏ chủ ngữ khỏi đầu span S-11 ⇒ `P1-HED-03` hoặc `P1-FP-05` đỏ.
