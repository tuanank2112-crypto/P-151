Vai: worker · loại: THI CÔNG (merge lần 2 + giải xung đột) · họ/model: Claude Opus 5.5 (1M) · Bước 0 exit 0 · hiểu việc: merge `origin/develop` 0cb16e2 (PR #6 Trường), giữ `safety.py` nhánh này, chạy bộ nhãn Trường trên `assess`/engine, thấp hơn nhãn thì thêm từ vựng, cao hơn thì ghi danh sách, lệch cơ chế thì hỏi; xong khi pytest 0 fail/0 skip mới, ruff sạch, không còn U, một commit merge; cấm đổi nhãn, xoá test, sửa src/api/web, push/rebase/force/--no-verify, bật LLM
Handoff: H02_merge-develop-2.md
Base: ee0c16e
Head: 510f888 (merge, parents ee0c16e + 0cb16e2). §1–§7 là vòng 1 (dừng trước commit); §8 là phần làm theo quyết định SO Q10

## 1. 8 xung đột → cách giải
| File | Cách giải |
|---|---|
| `src/maintenance/safety.py` (add/add) | Lấy bản nhánh này (`--ours`), Q09. Module của Trường không có pattern nào cần đưa vào `lexicon.yaml` ngoài `giật` (§2). `git diff --cached ee0c16e -- src/` rỗng |
| `docs/maintenance.md` (add/add) | Giữ bản nhánh này. Thêm §10 "Bộ nhãn CR-03 của Trường": router tới hồ sơ `02_2026-10-03_truong-mvp-prep`, ghi rõ `assess_safety` không còn trong code, thêm các lệch còn mở |
| `docs/CR-BPTN-03.md` §17 | Giữ số D-09…D-13 của nhánh này. Lấy D-08 của develop (GROUP_PENDING). D-13 theo §17.1 (MVP không gán nhân viên, khớp `set_assignee` bị chặn). Thêm nguyên văn §17.1 kèm ghi chú đối chiếu số ("D-12 cũ" = D-13) |
| `brain4agent/memory-distill.txt` | Giữ bản nhánh này, thêm 1 dòng PR #6/Q09 (50 dòng) |
| `brain4agent/-data-architecture.md` | Giữ cả hai bên (thêm mục "Trường MVP preparation") |
| `brain4agent/changelog.md` | Giữ dòng V5.2 của nhánh này và mục "Trường MVP preparation" |
| `brain4agent/memory/hot/state.json` | Hợp khoá của hai bên (`active_plan`, `last_session` của Trường); JSON parse được, không trùng khoá |
| `brain4agent/memory/hot/today.md` | Giữ cả hai bên |

## 2. Bộ nhãn Trường trên engine (evidence/10-h02-truong-labels.txt)
Tổng 98 ca: 62 câu gold trong `test_safety_p0.py`, 34 ca `safety_cases.json`, 2 raw đích CLN-004/TEC-005.
- Trước khi sửa từ vựng: 90 khớp / 2 thấp / 6 cao. Sau khi sửa: **92 khớp / 0 thấp / 6 cao**.
- **Thấp (đã vá):** "Giật" (gold-38, P0-015), nhãn UNCLEAR, engine ra NONE. Thêm `ambiguous_terms: "re:\\bgiat\\b"` (chỉ dữ liệu, Q29). Chữ "giặt" có dấu vẫn bị loại nhờ `homographs.giat`. Nhãn này là Bậc 2, ngoài chữ của Q09 (Q09 chỉ nói Bậc 1): SO duyệt hoặc trả lại. Thêm 3 ca vào bộ dừng (`h02:*`). Ngưỡng báo nhầm giữ: `b_fp` EM 0/UNCLEAR 4, `jx_negfp` EM 0, `b_fp2` EM 3. `test_safety.py` 1267 passed.
- **Cao hơn nhãn (không hạ, gửi Trường).** Mức engine ghim trong `ABOVE_LABEL`:
  - "Chất lạ nhưng không cay mắt" (gold-28, P0-029): UNCLEAR → EMERGENCY (S-14). Phủ định không áp vào từng thành phần S-14.
  - "Chất lỏng gây ngạt mũi" (gold-47, P0-025): UNCLEAR → EMERGENCY (S-09 + T2-05). "ngạt" không có trong `homographs.ngat`.
  - "Không có tia lửa và khói." (gold-54): NONE → UNCLEAR. R4: phủ định không lan qua "và"; "khói" rơi vào lưới R9.
  - "Hôm qua có tia lửa" (P0-012): UNCLEAR → EMERGENCY. R5 không có marker "hôm qua".
- **Fixture đích** (evidence/11-h02-target-vs-engine.txt): raw 12/12 trùng nhau. 10 ca thường chỉ khác ở trường `priority` mà nhánh này có thêm. CLN-004/TEC-005 khớp `VERIFYING`/`EMERGENCY_PENDING_BQL`/không phòng ban/không draft. Hai ca này lệch `playbook_id`, `proposed_department_id`, `review_status`, đây là lệch cơ chế (§6).

## 3. Test của Trường: chỉ viết lại phần gọi
`test_safety_p0.py`: thêm adapter `assess_safety` (gồm `RiskLevel(previous)`, ranh giới `RawTicket`, `assess`, max với mức cũ), `check()` (dùng `ABOVE_LABEL`), `quotes_in()` (S-14 nối 2 đoạn bằng " | "). Test frozen đọc `rule_id == "B-01"` và nhận `ValidationError` (RiskSignal là pydantic frozen). `test_cr03_targets.py`: dùng `assess(text, lexicon)`, tách quote. Không đổi dòng nhãn nào: `git diff origin/develop -- seed/maintenance_cr03` rỗng (evidence/12).

## 4. Lệnh + exit
- `init_brain.js --check` → exit 0
- `pytest -q -p no:cacheprovider -rfs` → **exit 1**: 1596 passed / 2 failed / 0 skip / 29 deselected (pg). Tổng 1598 = 1514 + 81 test PR #6 + 3 ca bộ dừng (evidence/08)
- `ruff check src tests` → exit 0. `ruff format --check src tests` → exit 0 (evidence/09)
- `git diff --name-only --diff-filter=U` → rỗng. `grep -cP '[\x08\x0c\x0b]'` = 0 trên 8 file đã sửa (evidence/12)

## 5. git diff --cached --stat ee0c16e
78 files changed, 2092 insertions(+), 7 deletions(-). `src/` không có thay đổi, `src/api` và `src/web` không bị đụng. Chi tiết ở evidence/12.

## 6. KHÔNG làm
- **Không commit merge**, vì cổng "pytest exit 0" mâu thuẫn với luật "không đổi kỳ vọng trong test của Trường". 2 test đỏ:
  - `test_target_twelve_rows_preserve_source_and_ten_unchanged_oracles`: so đích với `seed/maintenance_v1` coi như baseline v1.2. Bản v1.3 của nhánh này có `priority` và CLN-004/TEC-005 Bậc 1.
  - `test_target_loads_through_existing_schema_and_default_stays_baseline`: kỳ vọng `maintenanceops-sim-v1.2`, CLN-004 `ROUTED`, TEC-005 `ASSET_UNCLEAR`.
  - Ngoài ra 5 test `damaged_copy` đang xanh rỗng: hàm so sánh tự đỏ vì baseline đã lệch.
- Không chạy holdout 39 câu (không có trong cổng H02), không chạy `--pg`, không thêm ngoại lệ `giat nuoc`. Hiện "Bồn cầu không giật nước được" ra UNCLEAR và chưa nằm trong bộ báo nhầm nào.

## 7. Câu hỏi mở
1. Hai test baseline (§6): (a) Trường đổi baseline sang v1.3 hoặc so với ảnh chụp v1.2 cố định; (b) SO cho phép worker sửa riêng phần baseline; (c) tạm giữ đỏ. Cần người quyết.
2. Thứ tự pipeline: fixture đích của Trường (`# classification before safety`) gán playbook/phòng ban đề xuất cho ca Bậc 1. Engine (D-09, Q08) chạy 2b trước phân loại nên các trường này null. Đây là lệch cơ chế, không sửa.
3. 4 câu cao hơn nhãn (§2): Trường đổi nhãn, hoặc đội chấp nhận mức cao hơn.
4. Có giữ "giật" đứng riêng ⇒ Bậc 2 không (nhãn Bậc 2, ngoài chữ của Q09)?

## 8. Theo quyết định SO (Q10)
1. Hai test baseline đã sửa, kèm comment `# CR-03 §14/Q20: baseline v1.3 — Trường review`:
   - `test_target_loads_through_existing_schema_and_default_stays_baseline`: kỳ vọng v1.3, CLN-004 `VERIFYING`, TEC-005 `EMERGENCY_PENDING_BQL`.
   - `test_target_twelve_rows_preserve_source_and_ten_unchanged_oracles`: baseline v1.3 bỏ `priority`/`risk_level`. Với 2 ca Bậc 1, 3 trường phân loại (`playbook_id`, `proposed_department_id`, `review_status`) lấy từ fixture đích vì lệch thứ tự vẫn mở (mục 2). `playbook_id`/`proposed_department_id` vẫn bị ghim bởi hằng `EMERGENCIES` của Trường.
   - `seed/maintenance_cr03/*` không đổi.
   - **5 test `damaged_copy` vẫn xanh rỗng:** `assert_target_integrity(fixture đích chưa hỏng, baseline v1.3 thô)` đã ném AssertionError rồi, nên phá kiểu nào cũng "đỏ". Không sửa, theo SO.
2. Lệch thứ tự phân loại/an toàn của fixture đích (CLN-004/TEC-005 có playbook/phòng ban đề xuất, engine để null): KHÔNG sửa, vẫn là Câu hỏi mở.
3. Giữ `ABOVE_LABEL`. Nguyên văn: "Chất lạ nhưng không cay mắt" (UNCLEAR→EMERGENCY), "Chất lỏng gây ngạt mũi" (UNCLEAR→EMERGENCY), "Không có tia lửa và khói." (NONE→UNCLEAR), "Hôm qua có tia lửa" (UNCLEAR→EMERGENCY).
4. Giữ "giật" đứng riêng ⇒ Bậc 2. Thêm `ambiguous_exclusions: giat nuoc` và 2 ca bộ dừng: `h02:giat-nuoc-bon-cau` "bồn cầu không giật nước được" ⇒ NONE, `h02:giat-cong-tac` "bị giật khi chạm công tắc" ⇒ EMERGENCY|UNCLEAR. Cả hai xanh.

Lệnh + exit sau Q10:
- `pytest -q -p no:cacheprovider -rfs` → exit 0: **1600 passed / 0 fail / 0 skip / 29 deselected (pg)**. 1600 = 1514 + 81 + 5 ca bộ dừng (evidence/08).
- `ruff check src tests` → exit 0. `ruff format --check src tests` → exit 0, 69 files (evidence/09).
- Bộ nhãn: 92 khớp / 0 thấp / 6 cao. Báo nhầm: `b_fp` EM 0/U 4, `b_fp2` EM 3, `jx_negfp` EM 0, giữ đúng ngưỡng Q29 (evidence/10).
- `--diff-filter=U` rỗng.
- Commit `510f888`: 2 parent, Co-Authored-By, có một dòng `today.md`. Không push.
- `git diff --stat ee0c16e 510f888`: 78 files changed, `src/` không đổi.
- Không stage: report, evidence 08–12, `plan.md` (SO đang sửa), `docs/Activity Diagram.png`.


SO đo lại 2026-10-03: pytest 1600 passed EXIT=0 (29 pg deselected) · ruff EXIT=0 · format EXIT=0 · merge 510f888 (ee0c16e + 0cb16e2), develop contained · src/ không đổi so với ee0c16e · holdout NONE 2/39, f_neg 0, a_b01 0, jx_negfp EM 0. Quyết định Q10 đã áp.
✅ DUYỆT
