Worker · thi công · Claude Sonnet 5.5 (claude-sonnet-5-5), một mình, không phóng subagent · Bước 0 exit 1 (MODULE_NOT_FOUND `C:\brain4agent.release\.agents\skills\.xay-dung-nao-bo\scripts\init_brain.js`; đúng như handoff đã biết, KHÔNG sửa luật managed) · hiểu việc: phạm vi = ghi `deliverables/tools/*.py`, `tools/tests/*.py`, `evidence/run04-harden/*.txt`, R05; CẤM `src/ seed/ tests/` có sẵn, `deliverables/*.json`, `review/`, `.env`, mạng, git add/commit/push / xong khi = pytest exit 0, 0 skip, >95 test; ruff check + format --check exit 0; attack_a/b/c trước/sau, mọi tấn công thuộc B1/M1–M5/m1–m3 bị từ chối / cấm = nới lỏng kiểm tra, xoá test cũ, đọc dữ liệu thật chỉnh luật, ghi "pass" khi chưa chạy.
Handoff: handoffs/H05_tools-harden.md
Base: 8dd6baa5e733fd9dd917b30522b131d520471e05
Head: (chưa commit)

## 1. Lệnh + exit (stdout nguyên văn nằm ở `evidence/run04-harden/`)

| # | Lệnh (từ `C:\P-151-truong`) | Exit | Kết quả | Evidence |
|---|---|---|---|---|
| 0 | `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 1 | `Error: Cannot find module ...init_brain.js` (MODULE_NOT_FOUND) | (in tại chỗ, không lưu file) |
| 1 | `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest planning/09_2026-10-07_day05-labels/deliverables/tools/tests -q -p no:cacheprovider` | 0 | `270 passed in 5.85s` | `pytest.txt` |
| 2 | `.venv/Scripts/python.exe -m ruff check planning/09_2026-10-07_day05-labels/deliverables/tools` | 0 | `All checks passed!` | `ruff-check.txt` |
| 3 | `.venv/Scripts/python.exe -m ruff format --check planning/09_2026-10-07_day05-labels/deliverables/tools` | 0 | `4 files already formatted` | `ruff-format-check.txt` |
| 4 | `attack_b.py` (scratchpad/audit, KHÔNG sửa) trước / sau | 0 / 0 | bảng §3 | `attack_b_before.txt` / `attack_b_after.txt` |
| 5 | `attack_c.py` (KHÔNG sửa) trước | 0 | bảng §3 | `attack_c_before.txt` |
| 6 | `attack_c.py` (KHÔNG sửa) sau | 1 | dòng 33 đọc lại `out.json` mà runner nay từ chối và KHÔNG ghi ⇒ `FileNotFoundError` sau dòng A7a runner (exit 2 đã in) | `attack_c_after_original.txt` |
| 7 | `scratchpad/attack_c_driver.py` = chạy NGUYÊN source `attack_c.py`, chỉ bỏ trong bộ nhớ đúng dòng 33 | 0 | bảng §3 | `attack_c_after.txt` |
| 8 | `scratchpad/b1_probe.py` (cùng fixture 80 case, tool cũ dựng lại vs tool mới) | 0 | §3 B1 | `b1_sheet_before_after.txt` |
| 9 | pytest của file test MỚI trên bản dựng lại công cụ TRƯỚC H05 (`scratchpad/old_tools`) | 1 | `174 failed, 96 passed` | `tests_new_vs_pre_h05_tools.txt` |

## 2. Test: tổng / pass / fail / skip

- Sau: tổng 270 / pass 270 / fail 0 / skip 0 (trước H05: 95; test mới + sửa 175). Dòng 0 skip: `grep -ci skip pytest.txt` = 0.
- Không xoá test nào. 4 test cũ đổi ASSERT và 1 test cũ đổi tên, vì mỗi cái khẳng định đúng hành vi mà H05 yêu cầu thay (§6); 90 test cũ còn lại không đổi một dòng và vẫn xanh.
- Đỏ → xanh: file test mới chạy trên công cụ TRƯỚC H05 (dựng lại: `validate_day05.py` = đảo ngược đúng các patch của tôi, 473 dòng như bản gốc; runner/pack gõ lại theo bản gốc; 90 test cũ không đổi vẫn xanh trên bản dựng lại ⇒ bản dựng lại đúng): 174 đỏ, 96 xanh.

| Mục | Test ĐỎ trên công cụ cũ (xanh sau) |
|---|---|
| B1 | 7 (sheet không lộ `D5-C-`, id RV liền mạch, thứ tự không tương quan (Pearson < 0.35, hoán vị ≠ gốc ≠ ngược), id-map round-trip + cảnh báo, `--map-out`, seed theo byte cases.json, text chứa case_id bị từ chối, thứ tự ≠ sha256(case_id)) |
| M1 | 24 control validator (đủ biến thể §3) |
| M2 | 5 control validator + 10 (định nghĩa hash, 4 file phủ hash, hash sai ở develop & held-out, sửa SAU freeze, held-out chạy khi hash đúng) |
| M3 | 3 control validator (EM/UNCLEAR ↔ ELIGIBLE, NONE ↔ SAFETY_STOP) + 4 runner (GOLD_INCOMPLETE ×2, kế toán case, eligible cần cả hai gold) |
| M4 | 92: `test_runner_refuses_every_dataset_mutation` chạy runner trên TOÀN BỘ 90 mutation dataset (mọi mã lỗi validator) ⇒ exit 2 `DATA_INVALID`, không ghi file; + case validator-reject + OPEN dispute loại có báo cáo |
| M5 | 11 control validator (TEXT_LEAK ×5, family case/space, D4_11 ×2, AUTHORED ref ×3) + 1 (exception family khớp bỏ hoa/thường) |
| m1 | 13 (5 file dữ liệu × {có,không} `--overwrite`, đường dẫn alias `d/../d/x.json`, output đã tồn tại, output là thư mục, CLI exit 2) |
| m2 | 3 control (UNCLEAR không signal, UNCLEAR chỉ ABSENT, NONE có PRESENT) |
| m3 | 1 (`STRUCTURE_PASS`, không còn `RESULT: PASS`) |

Xanh cả trước lẫn sau theo thiết kế (6 test mới, KHÔNG đỏ trên công cụ cũ): đối chứng dương chống chặn nhầm `test_default_mode_reports_plain_pass`, `test_reviewer_checks_accept_real_people_and_timestamps`, `test_signal_rules_allow_the_legal_shapes`; và 3 control công cụ cũ đã bắt sẵn: `non_object_case_record`, `reviewed_at_not_a_date`, `reviewer_named_như_ý__sonnet_` (kiểm: 95 test cũ − 5 đổi/đổi tên = 90 không đổi, + 6 test mới = 96 xanh trên bản cũ).

## 3. Bảng tấn công trước / sau

B1 (không có trong attack_a/b/c; đo bằng `b1_probe.py`, fixture 80 case):

| Phép đo | Trước | Sau |
|---|---|---|
| Số lần `D5-C-` trong sheet / case_id gốc lộ | 80 / 80 of 80 | 0 / 0 of 80 |
| 3 id đầu sheet | `D5-C-0074, D5-C-0033, D5-C-0019` | `RV-001, RV-002, RV-003` |
| Thứ tự sheet = sort theo sha256(case_id) (tái tạo công khai được) | True | False |
| `id-map.json` | không có | có (cạnh sheet, kèm cảnh báo) |

M1–M5 / m1–m2 (49 tấn công thuộc phạm vi; "ACCEPTED" = tool chấp nhận / chạy ra file):

| Tấn công | Mục | Trước | Sau |
|---|---|---|---|
| A1a same name diff case | M1 | rejected (exit 1) | rejected (exit 1) |
| A1b same name inner double space | M1 | ACCEPTED | rejected (exit 1) |
| A1c NFD vs NFC same name | M1 | ACCEPTED | rejected (exit 1) |
| A1d reviewer whitespace only | M1 | ACCEPTED | rejected (exit 1) |
| A1e reviewer AI Reviewer | M1 | ACCEPTED | rejected (exit 1) |
| A1f reviewer Codex | M1 | ACCEPTED | rejected (exit 1) |
| A1g reviewer Gemini | M1 | ACCEPTED | rejected (exit 1) |
| A1h reviewer GPT-6 Luna | M1 | rejected (exit 1) | rejected (exit 1) |
| A1i reviewer orchestrator | M1 | ACCEPTED | rejected (exit 1) |
| A1j reviewer TBD | M1 | ACCEPTED | rejected (exit 1) |
| A1k proposer Truong, reviewer Trường | M1 | ACCEPTED | rejected (exit 1) |
| A1l rationale whitespace | M1 | ACCEPTED | rejected (exit 1) |
| A1m spec_refs [""] | M1 | ACCEPTED | rejected (exit 1) |
| A1n spec_refs [123] | M1 | ACCEPTED | rejected (exit 1) |
| A1o reviewed_at 2099 | M1 | ACCEPTED | rejected (exit 1) |
| A1p reviewed_at 2026-10-05 (date only) | M1 | ACCEPTED | rejected (exit 1) |
| A1q reviewed_by = 5 | M1 | ACCEPTED | rejected (exit 1) |
| A1r reviewer Claude | M1 | rejected (exit 1) | rejected (exit 1) |
| A1s reviewer Như Ý (sonnet) | M1 | rejected (exit 1) | rejected (exit 1) |
| A1t reviewer cl4ude | M1 | ACCEPTED | rejected (exit 1) |
| A1u Trường == Truong (NFD) | M1 | ACCEPTED | rejected (exit 1) |
| A15 proposed_by None | M1 | ACCEPTED | rejected (exit 1) |
| A4d runner frozen=true hash=garbage | M2 | ACCEPTED, file written | rejected (exit 2) |
| A4e runner hash set then held-out text edited | M2 | ACCEPTED, file written | rejected (exit 2) |
| A4f validator frozen + garbage hash | M2 | ACCEPTED | rejected (exit 1) |
| A4g validator frozen=true hash='' | M2 | ACCEPTED | rejected (exit 1) |
| A4h validator stale source_hashes | M2 | ACCEPTED | rejected (exit 1) |
| A4i validator frozen=false + hash set | M2 | ACCEPTED | rejected (exit 1) |
| A7a validator: EM ACCEPTED, case ELIGIBLE | M3 | ACCEPTED | rejected (exit 1) |
| A7a runner: case biến mất âm thầm (safety.n=4, split_cases=5, excluded=[]) | M3 | ACCEPTED, file written | rejected (exit 2) |
| A5a runner: gold trỏ case_id không tồn tại | M4 | ACCEPTED, file written | rejected (exit 2) |
| A5a validator (đối chứng) | M4 | rejected (exit 1) | rejected (exit 1) |
| A5b runner: orphan classification gold | M4 | ACCEPTED, file written | rejected (exit 2) |
| A5c runner: BAD_EXCEPTION | M4 | ACCEPTED, file written | rejected (exit 2) |
| A5d runner: SECRET trong manifest | M4 | ACCEPTED, file written | rejected (exit 2) |
| A5e runner: record không phải object | M4 | ACCEPTED, file written | rejected (exit 2) |
| A5f runner: OPEN dispute trên một case | M4 | ACCEPTED, file written (cases=4) | exit 0 CÓ CHỦ ĐÍCH: case bị loại và liệt kê `summary.excluded_open_dispute` (đúng chữ H05 M4; xem §9 câu 2) |
| A5g runner: reviewer Codex | M4 | ACCEPTED, file written | rejected (exit 2) |
| A5h runner: quote sai | M4 | ACCEPTED, file written | rejected (exit 2) |
| A3b family khác nhau chỉ hoa/thường + khoảng trắng | M5 | ACCEPTED | rejected (exit 1, FAMILY_LEAK) |
| A3c text HELD_OUT = text DEVELOP | M5 | ACCEPTED | rejected (exit 1, TEXT_LEAK) |
| A3d text HELD_OUT = DEVELOP viết hoa | M5 | rejected (BAD_QUOTE ngẫu nhiên) | rejected (exit 1, thêm TEXT_LEAK) |
| A3f family `f-d4-11` ở HELD_OUT | M5 | ACCEPTED | rejected (exit 1, D4_11_HELD_OUT) |
| A3g câu D4-11 gốc ở HELD_OUT | M5 | rejected (BAD_QUOTE ngẫu nhiên) | rejected (BAD_QUOTE ngẫu nhiên; fixture DEVELOP không chứa câu này nên TEXT_LEAK không áp dụng) |
| A3i HELD_OUT AUTHORED, ref "claude-sonnet generated" | M5 | ACCEPTED | rejected (exit 1, HELDOUT_NOT_AUTHORED) |
| A3j text HELD_OUT = DEVELOP + dấu chấm | M5 | ACCEPTED | rejected (exit 1, TEXT_LEAK) |
| A8 runner `--output` = safety-gold.json | m1 | exit 0, gold bị ghi đè (changed=True) | exit 2 OUTPUT_CLOBBERS_DATA, changed=False |
| A10c UNCLEAR không signal | m2 | ACCEPTED | rejected (exit 1, UNCLEAR_NO_SIGNAL) |
| A10e NONE có PRESENT S-01 | m2 | ACCEPTED | rejected (exit 1, NONE_HAS_SIGNAL) |

Tổng 49 tấn công thuộc phạm vi: trước 42 bị chấp nhận / 7 bị từ chối; sau 0 bị chấp nhận (ngoại trừ A5f loại-có-báo-cáo theo thiết kế) / 48 bị từ chối. 31 control hồi quy ngoài phạm vi (A2*, A6*, A9*, A3a/e/h/k, A4a–c, A10a/d, A11–A14, V0, V0b): kết quả trước == sau (31/31). A4a–c vẫn `HELDOUT_NOT_FROZEN` (exit 2). V0/V0b (dataset hợp lệ, MINI + FULL mặc định G2/G3) vẫn exit 0.

m3 không có kịch bản tấn công; đo bằng test (§2): structure-only in `RESULT: STRUCTURE_PASS` + `GATE G2: OPEN` + `GATE G3: OPEN`; mặc định in `RESULT: PASS`.

## 4. Thay đổi shape / định nghĩa (contract `01-CONTRACTS` KHÔNG đổi; mọi dòng dưới là diễn giải công cụ)

- Định nghĩa `hash` freeze (diễn giải orchestrator, ghi trong docstring `validate_day05.py`): `sha256("\n".join(f"{n}:{sha256(file n)}"))`, n = `cases.json`, `classification-gold.json`, `safety-gold.json`, `disputes.json` theo thứ tự đó (có đuôi `.json`; không gồm `split-manifest.json`, `label-proposals.json`). Hàm `validate_day05.freeze_hash(data_dir)`.
- validator, mã lỗi mới: `REVIEWED_AT_FUTURE`, `FROZEN_HASH_MISMATCH`, `FROZEN_INCONSISTENT` (frozen=false/không phải bool mà có hash), `ELIGIBILITY_MISMATCH`, `UNCLEAR_NO_SIGNAL`, `NONE_HAS_SIGNAL`, `TEXT_LEAK`. `ACCEPTED_INCOMPLETE` nay gồm cả blank/không-phải-chuỗi/<2 chữ cái (reviewed_by, proposed_by), rationale blank, spec_refs không phải list ≥1 chuỗi không rỗng. reviewed_at date-only/không parse/thiếu giờ ⇒ `BAD_SCHEMA`. `G3_CODES` thêm `TEXT_LEAK`, `FROZEN_*`. `analyze(roots, count_gate, freeze_actual)` + hàm mới `check(data_dir, count_gate)` (CLI và runner dùng chung). Structure-only: `RESULT: STRUCTURE_PASS`.
- validator, so khớp: reviewer==proposer / family / text dùng NFC + casefold + bỏ dấu (đ→d) + gộp khoảng trắng (family: chỉ strip + casefold; text: bỏ cả dấu câu); không-phải-người = regex cũ (chuỗi con, KHÔNG nới) + từ `ai|codex|gemini|orchestrator|system|bot|tbd|unknown|n/a|none|test` + chạy lại sau khi đổi chữ số→chữ (`0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`, bắt `cl4ude`). TEXT_LEAK: ratio `difflib.SequenceMatcher` ≥ 0.9 hoặc bằng nhau sau bỏ dấu/dấu câu/khoảng trắng, HELD_OUT vs mọi DEVELOP. reviewed_at: chuỗi ISO8601 có phần giờ; không tz coi là UTC; so với `datetime.now(UTC)`.
- runner: cờ mới `--overwrite`; mã exit-2 mới `OUTPUT_CLOBBERS_DATA` (không bao giờ vượt được, kể cả `--overwrite`; bảo vệ 6 file dataset + `backlog.json`, so bằng `samefile`), `OUTPUT_EXISTS`, `DATA_INVALID`, `GOLD_INCOMPLETE`; `FROZEN_HASH_MISMATCH` hiện ở dòng đầu `DATA_INVALID: n validator error(s) [codes]`. Runner gọi `validate_day05.check(count_gate=False)` (gồm cả `label-proposals.json`) nên 1 file thiếu = `DATA_INVALID`. Summary: BỎ `excluded_invalid_cases`; THÊM `excluded_open_dispute`, `excluded_not_accepted`, `classification.missing_gold` (luôn `[]` trong file đã ghi); `family_count` đếm theo strip+casefold. `run_manifest` thêm `freeze_hash_recomputed`.
- build_review_pack: sheet giữ khoá `case_id` (REVIEW-GUIDE vẫn đúng chữ "case_id + text") nhưng GIÁ TRỊ là `RV-001..`; id gán theo thứ tự xáo = sắp theo `sha256(f"{sha256(cases.json bytes)}:{case_id}")`; `--map-out` (mặc định `<out>/id-map.json`) ghi `{schema_version, created_at, warning, map:{RV-nnn: case_id}}`; stdout in `WARNING <đường dẫn>: CHỈ cho điều phối, không đưa reviewer`; exit 1 `BAD_CASES` nếu một text chứa chuỗi case_id (sheet không thể mù).

## 5. Phạm vi file ghi (đối chiếu H05 §2)

| File | Dòng | sha256 (16 đầu) |
|---|---|---|
| `deliverables/tools/validate_day05.py` | 591 | f9742f2d204afb64 |
| `deliverables/tools/run_day05_baseline.py` | 243 | 0884a73c7548de8e |
| `deliverables/tools/build_review_pack.py` | 78 | 1ef7b5b0b86d1bdc |
| `deliverables/tools/tests/test_day05_tools.py` | 1401 | fbf6590c24a6d99e |
| `evidence/run04-harden/*.txt` | 10 file | stdout lệnh (không sửa tay) |
| `reports/R05_tools-harden.md` | file này | |

Không ghi/sửa: `src/ seed/ tests/`, `deliverables/*.json`, `review/`, `.env`; không mạng; không git add/commit/push. (`git status` ban đầu đã có `M src/maintenance/models.py`, `proposer.py`, `tests/test_maintenance/test_store_memory.py` — có từ trước, không phải của H05.) Scratch ngoài repo (scratchpad): `old_tools/`, `patch_val*.py`, `attack_c_driver.py`, `b1_probe.py`, `mk_table.py`, `red_green.py`, `count_items.py`.

## 6. Test cũ bị đổi assertion / fixture (mỗi cái trực tiếp đối nghịch yêu cầu H05)

| Test cũ | Vì sao đổi |
|---|---|
| `test_valid_fixture_passes_structure_only` | m3: `RESULT: STRUCTURE_PASS`, không còn `RESULT: PASS` |
| `test_runner_eligible_case_needs_both_gold` | M3: thiếu classification gold cho ELIGIBLE ⇒ exit 2 `GOLD_INCOMPLETE` (cũ: exit 0 và bỏ case) |
| `test_runner_excludes_cases_the_validator_rejects` → đổi tên `test_runner_refuses_cases_the_validator_rejects` | M4: lỗi validator ⇒ exit 2 `DATA_INVALID` (cũ: loại case, exit 0) |
| `test_runner_held_out_runs_when_frozen` | M2: dùng hash tính thật (`freeze_hash`) thay `"a"*64` |
| `test_blind_sheet_order_is_deterministic_sha256` (giữ tên) | B1: cũ khẳng định thứ tự = sha256(case_id) = chính lỗ hổng; nay khẳng định ổn định với cùng byte và KHÁC thứ tự sha256(case_id)/thứ tự gốc |
| Fixture `review()` | `reviewed_at` 2026-10-08 → 2026-10-06 (hôm nay 2026-10-07; M1 từ chối tương lai) |
| Fixture HELD_OUT | thêm bộ câu riêng `HELD_TEXT` (cùng khuôn với DEVELOP ⇒ ratio > 0.9 ⇒ TEXT_LEAK đúng luật); DEVELOP giữ nguyên |

## 7. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| B1 + M1–M5 + m1–m3 (sửa 3 công cụ) | 🟠 | Claude Sonnet 5.5 |
| Test đỏ→xanh, dựng lại công cụ trước H05 để đo đỏ | 🟠 | Claude Sonnet 5.5 |
| Chạy lệnh, lưu evidence, dựng bảng từ log | 🟢 | Claude Sonnet 5.5 (KHÔNG xuống Haiku: không phóng subagent; việc cơ học, chi phí khởi động nguội lớn hơn lợi ích) |
| Quyết định contract | 🔴 | không có quyết định contract; diễn giải ghi ở §9 |

## 8. Việc KHÔNG làm

- Không chạy validator/runner/pack trên dữ liệu thật (`deliverables/*.json`, `review/`) và không đọc chúng để chỉnh luật; orchestrator tự chạy lại pack và validator. Dataset thật có thể bị luật mới bắt lỗi (vd reviewed_at date-only, UNCLEAR không signal); CHƯA đo.
- Không sửa `attack_a/b/c.py`, `indep.py` (chỉ chạy; dòng 33 của `attack_c.py` bỏ trong bộ nhớ ở driver).
- Không sửa Bước 0 / luật managed; không đổi `01-CONTRACTS`.
- Không kiểm `source_hashes` của manifest so với file thật (A4h chỉ bị bắt qua `hash`); không siết `SIGNAL` regex (A2f `S-99` vẫn qua `BAD_SIGNAL_ID`, bị bắt gián tiếp bởi `EM_NO_TIER1`); không đổi kiểm backlog (`reviewed_at` tương lai của backlog không nằm trong H05).
- Không git add/commit/push.

## 9. Câu hỏi mở

1. M3 `classification.missing_gold`: exit 2 không ghi file, nên danh sách chỉ hiện ở stdout (`GOLD_INCOMPLETE: ... ['D5-C-0003', ...]`); trong file đã ghi luôn là `[]`. Nếu cần file kèm danh sách thì phải quyết định ghi file khi exit 2 (trái "exit 2 = không ghi").
2. M4 OPEN dispute: `ACCEPTED_OPEN_DISPUTE` là lỗi validator duy nhất runner KHÔNG coi là `DATA_INVALID` (theo chữ "chỉ case có dispute OPEN / không ACCEPTED được loại có báo cáo"): case bị loại, `excluded_open_dispute` liệt kê, exit 0 (A5f). Muốn từ chối cứng (exit 2): bỏ vế `!= "ACCEPTED_OPEN_DISPUTE"` trong `run_day05_baseline.py`.
3. M1: từ `ai` khớp theo từ nên tên người Việt "Ái"/"Ai" bị coi không phải người; phép đổi chữ số→chữ (bắt `cl4ude`) vượt danh sách trong handoff.
4. M1: reviewed_at không có múi giờ được coi là UTC; so với đồng hồ máy.
5. B1: giữ khoá `case_id` (giá trị `RV-nnn`) hay đổi thành `review_id`; shape `id-map.json` là `map:{RV→case_id}` (không phải `records`).
6. M2: `FROZEN_HASH_MISMATCH` cũng chặn run `--split develop` trên manifest `frozen=true` có hash lệch (dữ liệu đã bị sửa sau freeze); hash không phủ `label-proposals.json`, `split-manifest.json`.
7. Luật mới có thể làm dataset H02/H04 hiện tại fail validator — chỉ orchestrator đo được vì H05 cấm đọc dữ liệu thật.

## Đo lại của orchestrator
- pytest 270 passed exit 0 (0 skip); ruff check + format --check exit 0; validator `--backlog` exit 0; `--structure-only` trên dữ liệu thật exit 0 `STRUCTURE_PASS`; mặc định exit 1 (COUNT_G2/G3, đúng); runner develop exit 2 `NO_VALID_GOLD`, không ghi file. Chạy lại attack_b của auditor: mọi tấn công A1a–A1u, A2a–A2k, A6a/A6c bị từ chối, đối chứng V0/V0b/A6b xanh. 10/10 đột biến của orchestrator vẫn bị từ chối. Blind sheet dựng lại: 0 chuỗi `D5-C-`, ID `RV-001..`, bảng ánh xạ ở deliverables/review-key/id-map.json (tách khỏi review/). Evidence: evidence/run05-orch-remeasure/.
- Chưa đo: kiểm lại M2–M5 bằng attack_a/attack_c do orchestrator (dựa vào evidence run04-harden của worker + 270 test); chưa chạy vòng thẩm định cô lập thứ hai. Diễn giải A5f (case OPEN dispute loại có báo cáo, exit 0) và khoá `case_id` giữ tên trong sheet: giữ nguyên, ghi ở day05-summary.

✅ DUYỆT (công cụ; chưa phải duyệt dữ liệu hay gate Day05)
