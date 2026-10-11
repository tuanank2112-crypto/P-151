Vai: worker (vai-thi-cong) · loại: thi công runtime · họ/model: Claude Sonnet 5.5 (`claude-sonnet-5-5`), không agent con · Bước 0: exit 0 ("NÃO ĐÃ OK", root `D:/P151`, không chạy chế độ ghi) · hiểu việc: phạm vi = `agent/schema.py`, `validate.py`, `baseline.py`, `safety.py` (chỉ §3.3), `engine.py` (chỉ biểu thức §3.5), test mới `test_p10_catalog_not_quote.py` + 3 test cũ theo bảng P10 §9.1, evidence/WP19, R18 / xong khi = P10 §9.4 #1 đỏ 15 xanh 3 trên code chưa sửa, #2–#8 và #11 `EXIT=0`, `grep` = 0, m1–m7 đều `EXIT≠0` kèm tên test đỏ, #9 ghi số / cấm = so quote với văn bản ở bất kỳ đâu, bịa quote, cờ bật lại cổng, đổi prompt/lexicon/rules/reconcile/store/api/web, SPEC/REF/plan, commit/stage/push, mạng/LLM/`.env`
Handoff: handoffs/H18_thi-cong_WP19.md
Base: b6a1a413f73b61f7cb1ceafb549d7655350b1e01 (`git status --porcelain` trước khi sửa: ` M plan.md`, ` M SPEC-P10`, `?? .claude/worktrees/`, `?? evidence/WP16-review-v6/`, `?? scratch/` — không file nào trong phạm vi ghi bị bẩn)
Head: b6a1a413f73b61f7cb1ceafb549d7655350b1e01; working tree chưa commit

## Lệnh đo (env `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`)
| # P10 §9.4 | Lệnh | Kết quả nguyên văn | Exit | Evidence |
|---|---|---|---|---|
| Bước 0 | `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | "NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!" | 0 | (stdout) |
| 1 | `pytest -q -p no:cacheprovider tests/test_maintenance/test_p10_catalog_not_quote.py` trên code CHƯA sửa | `15 failed, 3 passed` — xanh đúng T-P10-02 ×3; đỏ T-P10-01, -03×6, -04×3, -05×2, -06, -07, -08 | 1 | [red-before.txt](../evidence/WP19/red-before.txt) |
| 2 | như #1 + `test_agent_unit.py test_p1_audit_fixes_safety.py test_safety.py` sau sửa | `1586 passed` | 0 | [green.txt](../evidence/WP19/green.txt) |
| 3 | `pytest -q -p no:cacheprovider` | `3682 passed, 85 deselected` (0 failed, 0 skipped) | 0 | [pytest.txt](../evidence/WP19/pytest.txt) |
| 4 | `python -m ruff check src tests` | `All checks passed!` | 0 | [ruff.txt](../evidence/WP19/ruff.txt) |
| 5 | `python -m ruff format --check <9 file .py chạm>` | `9 files already formatted` | 0 | [ruff.txt](../evidence/WP19/ruff.txt) |
| 6 | `grep -rnw -e grounded -e _grounded src/maintenance --include=*.py \| wc -l` | `0` | 0 | [grep-grounded.txt](../evidence/WP19/grep-grounded.txt) |
| 7 | `pytest` `test_safety_metamorphic.py` + `test_classify_metamorphic.py`; `test_safety.py -k "stop_set or false_alarm_budget"` | `991 passed`; `1083 passed, 388 deselected` | 0; 0 | [safety-gates.txt](../evidence/WP19/safety-gates.txt) |
| 8 | `REF-agent-contract.py --selftest` | `SELFTEST_FAILURES=0` | 0 | [ref-selftest.txt](../evidence/WP19/ref-selftest.txt) |
| 9 | probe `evidence/WP12/probes/extra_invented_location.py` | `RESULT reports=4 tickets_routed_to_invented_place=3` (số đo rủi ro, không phải cổng; khớp mô phỏng P10 = 3; probe tự thoát 1 theo thiết kế) | 1 | [invented-location.txt](../evidence/WP19/invented-location.txt) |
| 10 | m1–m7 | bảng dưới | 1 mỗi cái | `mutation-m1.txt` … `mutation-m7.txt` |
| 11 | `git diff --stat -- src tests` | bảng dưới | — | [diff-stat.txt](../evidence/WP19/diff-stat.txt) |
| 12 | `--pg` | NOT RUN: Docker daemon không chạy (`failed to connect to the docker API`); WP19 không đổi store | — | [pg.txt](../evidence/WP19/pg.txt) |
| — | `grep -cP '[\x08\x0c\x0b]'` trên 9 file chạm | `0` cả 9 | — | (stdout) |

Test tổng/pass/fail/skip: trước (Base P10 §9) 3664 passed / 85 deselected / 0 fail / 0 skip → sau 3682 passed / 85 deselected / 0 fail / 0 skip (+18 = 18 test mới của `test_p10_catalog_not_quote.py`; test cũ số lượng giữ nguyên).

## `git diff --stat -- src tests` + untracked trong phạm vi
```
 src/maintenance/agent/baseline.py                  | 18 ++++------
 src/maintenance/agent/schema.py                    | 20 ++++++++---
 src/maintenance/agent/validate.py                  | 37 +++-----------------
 src/maintenance/engine.py                          |  4 ++-
 src/maintenance/safety.py                          | 33 ++++++++++--------
 tests/test_maintenance/test_agent_unit.py          | 29 ++++++++--------
 tests/test_maintenance/test_p1_audit_fixes_safety.py | 39 +++++++++++-----------
 tests/test_maintenance/test_safety.py              | 19 ++++++-----
 8 files changed, 95 insertions(+), 104 deletions(-)
```
Untracked trong phạm vi: `tests/test_maintenance/test_p10_catalog_not_quote.py` (mới), `planning/06_2026-10-05_reasoning-agent/evidence/WP19/*.txt`, file này. Ngoài phạm vi có sẵn từ trước và KHÔNG đụng: `plan.md`, `SPEC-P10` (đã M), `.claude/worktrees/`, `evidence/WP16-review-v6/`, `scratch/`. Không file `src/` nào ngoài 5 file được cấp.

## Test cũ đã đổi (P10 §9.1; thay 1–1, không xoá ca)
| File::test | Đổi | Lệch so với bảng §9.1 |
|---|---|---|
| `test_agent_unit.py` dòng 33 | xoá import `grounded` | — |
| `test_a_04_…` → `test_a_04_an_agent_raise_keeps_its_level_whatever_its_quote` | `[("S-02","PRESENT")]`, merged EMERGENCY, `agent_risk_level` EMERGENCY | — |
| `test_a_06c_…` | xoá dòng `assert grounded(...)` | — |
| `test_a_08_…` → `test_a_08_a_job_quote_not_in_the_text_is_kept_for_audit` | `rejected == []`, `valid == [0,1]`, `jobs[1].quote == "bóng đèn nổ tung"`, `"category" not in minor` | — |
| `test_a_08b_…` → `test_a_08b_no_job_is_dropped_for_its_quote` | `valid == [0,1]`, không `jobs[i]` trong `rejected` | — |
| `test_a_09b_…` 3 dòng cuối | quote "tầng 9 tòa S3" ⇒ `agent_location == LOC`, `rejected == []` | — |
| `test_p1_audit_fixes_safety.py` docstring + import | docstring F3 thay bởi P10; import chỉ `_check_location` | — |
| `test_f3_location_without_quote_is_rejected` → `test_p10_location_is_kept_whatever_its_quote` | 12 tham số (3 `parts` × 4 `quote`), kỳ vọng theo bảng đo | — |
| `test_f3_punctuation_quote_…` → `test_p10_an_invented_place_in_the_catalog_is_kept_and_audited` | `agent_location == "Tòa S2 / Tầng 7 / Hành lang"`, `location.quote == ".."`, không `location*` trong `rejected` | **Có.** §9.1 ghi `rejected == []`; đo thật `rejected == ['jobs[1].asset_id']` (asset của job mẫu không ở S2/7 — kiểm danh mục tài sản, không phải quote). Khẳng định đổi thành "không đường dẫn nào bắt đầu bằng `location`". Xem câu hỏi 1 |
| `test_f3_no_location_and_no_quote_…` | `_check_location(loc, CATALOG)[2] == []` | — |
| `test_f3_mirror_quotes_…` → `test_p10_mirror_location_has_no_quote_and_is_kept` | `location.quote is None`, `"location" not in rejected`, `agent_location == "Tòa S1 / Tầng 3 / Hành lang"` | — |
| `test_safety.py::test_llm_present_needs_grounded_quote` → `test_llm_present_counts_whatever_its_quote` | EMERGENCY với quote lạ (`rule_id "LLM"`) và không quote (`"LLM-NOQUOTE"`, `source_quote == first_sentence(TEXT_NONE)`); thêm import `first_sentence` | — |
| `test_safety.py::test_engine_with_safety_llm_never_lowers` | nửa sau ⇒ EMERGENCY + `EMERGENCY_PENDING_BQL`; docstring bỏ vế "fake quote" | **Có.** bỏ `and audit.new_value["notes"]`: sau P10 không còn note khi tín hiệu hợp lệ có quote, nên `notes == []`; vẫn giữ khẳng định `proposer == "rules+llm:llm"`. Xem câu hỏi 2 |

## Đột biến (mỗi cái áp riêng lên cây đã sửa, chạy, khôi phục; kiểm sha256 trước == sau và `git diff --stat` trước == sau: cả 7 `True`)
| # | File bị đột biến | Test đỏ (nguyên văn) | Exit |
|---|---|---|---|
| m1 | `validate.py` | `test_p10_01_location_worded_differently_but_in_the_catalog_is_kept` | 1 |
| m2 | `validate.py` | `test_a_08_a_job_quote_not_in_the_text_is_kept_for_audit`, `test_a_08b_no_job_is_dropped_for_its_quote` | 1 |
| m3 | `safety.py` | `test_p10_05_…[bình gas bị xì]`, `test_llm_present_counts_whatever_its_quote` | 1 |
| m4 | `safety.py` | `test_p10_05_…[None]` | 1 |
| m5 | `baseline.py` | `test_p10_04_…[Chỗ đi bộ …]`, `test_p10_04_…[Hành lang … cần vệ sinh.]` | 1 |
| m6 | `schema.py` | `test_p10_03_…[job-None]`, `[job-]`, `[job-value5]`, `test_p10_07_runtime_schema_is_the_reference_schema` | 1 |
| m7 | `engine.py` | `test_p10_08_a_missing_job_quote_is_not_shown_as_none` | 1 |

## Số đo rủi ro và live
- #9: `tickets_routed_to_invented_place=3` (đúng mô phỏng P10; Base = 1). Đây là rủi ro §5 chấp nhận có chủ đích, chờ Q-P10-2.
- Live (§9.5 / G-LIVE-3): NOT_RUN — không gọi LLM/mạng, không đọc `.env`.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| WP19 toàn bộ (test trước, sửa code, đổi test cũ, đột biến, evidence, report) | 🟠 | Claude Sonnet 5.5, một mình; không có agent con 🟢 nên phần chép theo mẫu cũng làm ở 🟠 |

## Việc KHÔNG làm + lý do
- Không đổi `agent/prompt.py`, `reconcile.py`, `agent.py`, `lexicon.yaml`, `rules.py`, `models.py`, `store/**`, `coordination/**`, `src/api/**`, `src/web/**`, `safety.assess` (CẤM của P10).
- Không đổi G-1/G-2/G-3, F8, marker DB `0003` (P10 §7; Q-P10-1…5 vẫn chờ người).
- Không sửa SPEC/REF/`plan.md`; không đồng bộ não `brain4agent/` và `docs/maintenance.md` (ngoài phạm vi H18; để WP13 / người điều phối).
- Không chạy `--pg` (không có Docker daemon); không chạy live.
- Không commit/stage/push.

## Câu hỏi cần người
1. SPEC-P10 §9.1 hàng `test_f3_punctuation_quote_…` ghi `rejected == []` nhưng đo thật còn `jobs[1].asset_id` (asset của job mẫu ở nơi khác). Em giữ ý đồ (vị trí không bị loại, quote ".." lưu nguyên) bằng khẳng định "không có đường dẫn `location*`". Người/SO duyệt có muốn sửa dòng §9.1 cho khớp đo không?
2. SPEC-P10 §9.1 hàng `test_engine_with_safety_llm_never_lowers` không nói về `notes`; sau P10 `notes` rỗng nên em bỏ khẳng định `notes` truthy. Duyệt chấp nhận?
3. Giữ nguyên Q-P10-1…5 (§7) — không thuộc WP19.

## Vòng 2 (sau R19 🔁 SỬA phần test; runtime `src/` KHÔNG đổi: `git diff --stat -- src` vẫn 5 file +50/−62, [round2-ruff.txt](../evidence/WP19/round2-ruff.txt))
Vai: worker · thi công test · Claude Sonnet 5.5 · không agent con. File ghi: `tests/test_maintenance/test_p10_catalog_not_quote.py`, `tests/test_maintenance/test_p1_audit_fixes_safety.py`, evidence/WP19/round2-*, R18.

| Việc | Thực hiện |
|---|---|
| 1 | thêm `test_p10_09` (quote vị trí "the walkway by the lift" không chung từ ⇒ `rejected == []`, ROUTED) và `test_p10_10` (quote việc "rubbish everywhere" ⇒ `valid_job_indexes == [0]`, ROUTED) |
| 2 | `test_p10_an_invented_place_…`: khẳng định chính xác `record.rejected == ["jobs[1].asset_id"]` |
| 3 | thêm `test_p10_11`: `merge_llm` với quote "tiếng xì xì từ bình gas" / "gas leak" / "bình gas bị xì" ra cùng `(risk_level, notes, [(signal_id, status, rule_id)])` |
| 4 | T-P10-07 nạp REF bằng `Path(__file__).resolve().parents[2] / "planning" / …`; đo: gọi hàm test từ cwd `%TEMP%` ⇒ "T-P10-07 OK from foreign cwd" (pytest chạy từ cwd lạ bị INTERNALERROR socket, ngoài phạm vi, không liên quan test này) |

| Lệnh | Kết quả nguyên văn | Exit | Evidence |
|---|---|---|---|
| `pytest -q -p no:cacheprovider` | `3685 passed, 85 deselected` (= 3682 + 3; 0 fail, 0 skip) | 0 | [round2-pytest.txt](../evidence/WP19/round2-pytest.txt) |
| `ruff check src tests`; `ruff format --check` 9 file chạm | `All checks passed!`; `9 files already formatted` | 0; 0 | [round2-ruff.txt](../evidence/WP19/round2-ruff.txt) |
| `grep -cP '[\x08\x0c\x0b]'` 2 file test | 0; 0 | — | (stdout) |
| `evidence/WP19-review/mutate.py <bản sao> <out> X1b,X2b,X9,X6` (khôi phục, sha256 trước = sau `restored=YES` cả 4) | X1b: 1 đỏ `test_p10_09…`; X2b: 1 đỏ `test_p10_10…`; X9: 14 đỏ gồm `test_p10_an_invented_place_in_the_catalog_is_kept_and_audited`; X6: 1 đỏ `test_p10_11…` | 1 mỗi cái | `round2-mutation-X1b/X2b/X9/X6.txt` |
| m1–m7 chạy lại (khôi phục, sha256 + `git diff --stat` trước = sau `True`) | cả 7 vẫn đỏ đúng test như vòng 1 | 1 mỗi cái | `round2-mutation-m1.txt` … `m7.txt` |

Không làm: không sửa `src/`; không sửa "Toà S1" (SO ghi backlog); không commit/stage/push.

⏳ Chờ người duyệt.
