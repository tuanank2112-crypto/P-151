Vai: worker (vai-thi-cong) · loại: thẩm định 🔴 (chỉ đọc + chạy lệnh) · họ/model: Claude Opus 5.5 (`claude-opus-5-5`), không agent con · Bước 0: exit 0 ("NÃO ĐÃ OK") · hiểu việc: phạm vi = đo lại WP19 (working tree chưa commit trên Base) theo SPEC-P10 §3/§9, chỉ ghi R19 + `evidence/WP19-review/` / xong khi = chạy lại pytest/ruff/REF, đối chiếu diff với §3 + hàng CẤM chạm, ≥3 cách phá có output máy, xét 2 khẳng định test bị đổi bằng đột biến / cấm = sửa src/tests/SPEC/plan/não, commit/stage/push, mạng/LLM, đọc `.env`, đột biến trên file dùng chung
Handoff: handoffs/H19_tham-dinh_WP19.md
Base: b6a1a413f73b61f7cb1ceafb549d7655350b1e01
Head: b6a1a413f73b61f7cb1ceafb549d7655350b1e01 + working tree chưa commit (8 file M trong `src/` `tests/` + `tests/test_maintenance/test_p10_catalog_not_quote.py` mới)

## 1. Lệnh nghiệm thu chạy lại (repo, `.venv` Python 3.11.7, env `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`)
| §9.4 | Lệnh | Kết quả | Evidence |
|---|---|---|---|
| #1 | `pytest test_p10_catalog_not_quote.py` trên 8 file lấy lại từ HEAD (sandbox) | 15 failed / 3 passed, đúng T-P10-01, -03×6, -04×3, -05×2, -06, -07, -08; xanh T-P10-02×3 · `EXIT=1` | [red-before.txt](../evidence/WP19-review/red-before.txt) |
| #2 | 4 file test P10/unit/F3/safety (sandbox = bản sao working tree) | 1586 passed · `EXIT=0` | (lệnh trong phiên; trùng #3) |
| #3 | `python -m pytest -q -p no:cacheprovider` (repo) | **3682 passed, 85 deselected, 0 failed, 0 skipped** · `EXIT=0` (= 3664 + 18 test mới; §9.1 thay 1–1) | [pytest-full.txt](../evidence/WP19-review/pytest-full.txt) |
| #4 | `ruff check src tests` | `All checks passed!` · `EXIT=0` | [ruff-grep.txt](../evidence/WP19-review/ruff-grep.txt) |
| #5 | `ruff format --check` 9 file WP19 chạm | `9 files already formatted` · `EXIT=0` (toàn repo `EXIT=1` chỉ `src/main.py`, có từ Base) | như trên |
| #6 | `grep -rnw -e grounded -e _grounded src/maintenance \| wc -l` | `0` | như trên |
| #7 | metamorphic safety+classify; `test_safety.py -k "stop_set or false_alarm_budget"` | 991 passed `EXIT=0`; 1083 passed `EXIT=0` | [safety-gates-scope.txt](../evidence/WP19-review/safety-gates-scope.txt) |
| #8 | `REF-agent-contract.py --selftest` | `SELFTEST_FAILURES=0` · `EXIT=0` | [ref-selftest.txt](../evidence/WP19-review/ref-selftest.txt) |
| #9 | `evidence/WP12/probes/extra_invented_location.py` (sandbox) | `tickets_routed_to_invented_place=3` (= số mô phỏng P10 §5; rủi ro chấp nhận, Q-P10-2 chờ người) | [invented-location.txt](../evidence/WP19-review/invented-location.txt) |
| #10 | m1–m7 (§9.3) chạy lại trên sandbox, 8 file test trọng điểm | cả 7 `EXIT=1`, test nêu tên trong §9.3 đều đỏ | [mutation-m1…m7.txt](../evidence/WP19-review/) |
| #11 | `git diff --stat HEAD -- src tests` | 8 file, +95/−104, ⊆ hàng "File WP19 được ghi" | [sha256-after-and-scope.txt](../evidence/WP19-review/sha256-after-and-scope.txt) |
| #12 | `--pg` | ⬜ không chạy (H19 không giao; WP19 không đổi store) | — |

## 2. Đối chiếu diff với SPEC-P10 §3 và hàng CẤM chạm
- §3.1 schema: khối `_audit_quote`…`AuditQuote` của runtime và REF mục A `diff` ⇒ `DIFF_EXIT=0`; 3 trường `quote: AuditQuote = None`; T-P10-07 (JSON schema = REF) xanh. ĐẠT.
- §3.2 validate: xoá `_fold`, `grounded`, `_first_sentence`, dòng gate vị trí và gate job; `_check_location(loc, catalog)`; khối building/floor/area giữ. ĐẠT.
- §3.3 safety: 3 hunk chỉ trong `SignalJudgement`, `first_sentence` (thay `_grounded`), `merge_llm`; note đúng chữ SPEC (đo: `S-10: LLM PRESENT không kèm trích dẫn; vẫn tính (trích dẫn chỉ để audit)`). ĐẠT.
- §3.4 baseline, §3.5 engine (1 hunk dòng 3420). ĐẠT.
- CẤM chạm: `git diff --quiet HEAD -- seed rules.py prompt.py reconcile.py agent.py models.py coordination store src/api src/web` ⇒ `EXIT=0`. `plan.md` + `SPEC-P10` đang M: mtime 10:08:48 (dấu duyệt P10 10:08:38) < file WP19 đầu tiên 10:09:35, nội dung = dấu duyệt/checklist ⇒ không thuộc WP19 (SO commit riêng).
- Repo chính không bị đột biến: sha256 17 file trước/sau `diff` ⇒ `EXIT=0`.

## 3. Bảng probe (mọi đột biến chỉ trên bản sao ở scratchpad, khôi phục và sha256 = trước: `restored=YES` ở mọi file)
| # | Cách phá | Lệnh | Exit | Kết quả |
|---|---|---|---|---|
| a | Còn chỗ nào dưới `src/` so quote/câu cư dân (tên khác, `in`, fuzzy, difflib…) | `grep` quote/`grounded`/`_fold`/`verbatim_in`/difflib/fuzz ([probe-a-grep.txt](../evidence/WP19-review/probe-a-grep.txt)) | 0/1 | Không còn; `catalog._fold`, `safety._fold` có từ Base, không đọc đầu ra LLM; `verbatim_in` không vào runtime |
| b | Agent PRESENT Bậc 1 (S-10, luật NONE) qua engine thật với quote nguyên văn/diễn đạt khác/vô can/`..`/1 ký tự/khoảng trắng/rỗng/null/400 ký tự; đường bổ sung của cư dân (3 quote) | `probe_bce.py` ([probe-bce.txt](../evidence/WP19-review/probe-bce.txt)) | 0 | 12/12 ⇒ `VERIFYING/EMERGENCY_PENDING_BQL/EMERGENCY`, đúng 1 `emergency.created`; UNCLEAR ⇒ `SAFETY_REVIEW_REQUIRED` |
| c | AI hạ mức / xoá tín hiệu luật: luật UNCLEAR + Agent ABSENT + UNCLEAR quote 299 ký tự; Agent NONE không tín hiệu; luật PRESENT + LLM UNCLEAR/ABSENT/PRESENT quote dài; luật EMERGENCY + Agent NONE | như trên | 0 | Không hạ, tín hiệu luật giữ nguyên; luật EMERGENCY ⇒ Agent không được gọi (0 lần) |
| d | Mirror/luật/client giả/helper test còn chép câu cư dân làm quote | `grep` ([probe-d-fabricated-quotes.txt](../evidence/WP19-review/probe-d-fabricated-quotes.txt)) | 0 | Mirror `quote=None` (job, vị trí); quote tín hiệu = `source_quote` luật; client test chỉ dùng chuỗi cố định. Chỉ `first_sentence(safety_text)` cho `source_quote` S-00/LLM-NOQUOTE (SPEC §3.3 cho phép) |
| e | Vị trí diễn đạt khác + trong danh mục (chữ thường/tiền tố, quote tòa khác, quote 400, thiếu khoá) end-to-end; ngoài danh mục (S9, "tầng cao", "Ban công", S9+Ban công) | `probe_bce.py` | 0 | 4/4 ROUTED `DEPT_CLEANING`, `rejected=[]`; 4/4 loại đúng trường, NEED_INFO, ghi chú `Thiếu: location_<phần>` |
| f-X1 | Cổng vị trí `difflib` ratio < 0.6 trong `validate()` | `mutate.py X1` | 1 | 12 test đỏ (T-P10-01, -02, A-09b…) |
| f-X2 | Cổng việc: quote không chung từ (tách theo khoảng trắng) | `mutate.py X2` | 1 | chỉ 1 test đỏ (A-08b, nhờ token `"rác,"` dính dấu phẩy) |
| f-X3 | `merge_llm` BỎ tín hiệu khi quote chuẩn hoá không có trong văn bản | `mutate.py X3` | 1 | 4 đỏ (T-P10-05[quote], A-04, 2 test safety) |
| f-X3b | `merge_llm` quote không chung từ ⇒ UNCLEAR | `mutate.py X3b` | 1 | 3 đỏ |
| f-X4 | Cổng vị trí chuyển sang file khác (`agent._validate_node`, casefold substring) | `mutate.py X4` | 1 | 3 đỏ (T-P10-01, A-09b, invented-place) |
| f-X5 | Mirror bịa quote VỊ TRÍ (`location_text`) | `mutate.py X5` | 1 | 4 đỏ (T-P10-04×3, mirror-location) |
| f-X7 | Schema bỏ "trắng ⇒ None", min_length 2 | `mutate.py X7` | 1 | 7 đỏ (T-P10-03, -07, F3×3) |
| f-X8 | Mất dấu `LLM-NOQUOTE` | `mutate.py X8` | 1 | 2 đỏ |
| f-X9 | Quote vị trí bịa ⇒ loại `jobs[0]` (đường không phải `location`) | `mutate.py X9` | 1 | suite 10 đỏ; **test invented-place của worker XANH**, bản khẳng định chính xác `== ["jobs[1].asset_id"]` ĐỎ |
| **f-X1b** | **Cổng vị trí: quote có chữ mà KHÔNG chung từ nào (bỏ dấu câu) với `location_text` ⇒ huỷ vị trí** (CẤM 1 "độ giống mờ/ngưỡng") | `mutate.py X1b` + `--full` | **0** | **SỐNG: 1646/1646 trọng điểm, 3412/3412 toàn `tests/`** ([mutation-X1b-full.txt](../evidence/WP19-review/mutation-X1b-full.txt)) |
| **f-X2b** | **Cổng việc: quote KHÔNG chung từ nào với `report_text` ⇒ loại job** | `mutate.py X2b` + `--full` | **0** | **SỐNG: 3412/3412** ([mutation-X2b-full.txt](../evidence/WP19-review/mutation-X2b-full.txt)) |
| f-X6 | Vùng cấm hàng 1: giữ so chuỗi làm ghi chú CẢNH BÁO (không đổi mức) | `mutate.py X6 --full` | 0 | SỐNG: 3412/3412 |
| bù | 4 test ứng viên CHỈ ở sandbox ([test_zz_h19_candidate.py.txt](../evidence/WP19-review/test_zz_h19_candidate.py.txt)): quote vị trí/việc không chung từ, `rejected == ["jobs[1].asset_id"]`, `merge_llm` bất biến theo chữ của quote | sạch; rồi `--only` với X1b, X2b, X6, X9 | 0; 1/1/1/1 | xanh 4/4 trên code hiện tại; đỏ đúng với từng đột biến ([candidate-green.txt](../evidence/WP19-review/candidate-green.txt), `mutation-*-cand.txt`) |

## 4. Hai khẳng định worker tự đổi so với §9.1
| Test | Đo | Kết luận |
|---|---|---|
| `test_p10_an_invented_place_in_the_catalog_is_kept_and_audited` (thay `rejected == []` bằng "không đường dẫn `location*`") | trên code đúng `rejected=['jobs[1].asset_id']` ([probe-bce.txt](../evidence/WP19-review/probe-bce.txt) MEASURE x1) ⇒ khẳng định §9.1 không đạt được (SPEC sai). Dưới X9: bản worker XANH, bản `== ["jobs[1].asset_id"]` ĐỎ; suite vẫn bắt X9 qua 10 test khác | Lệch cần thiết, nhưng YẾU HƠN mức làm được: phải là khẳng định chính xác |
| `test_engine_with_safety_llm_never_lowers` (bỏ `audit.new_value["notes"]`) | trên code đúng `notes=[]` (MEASURE x2) ⇒ khẳng định cũ đỏ trên hành vi đúng; khẳng định cũ chỉ ghim ghi chú "trích dẫn không có trong phản ánh" (hành vi bị cấm). X6 thêm ghi chú ⇒ khẳng định cũ (truthy) cũng xanh | Bỏ là bắt buộc, KHÔNG làm yếu test |

## 5. Mục §3 handoff: đạt / lệch
- Chạy lại pytest/ruff/REF: ĐẠT (số ở §1). Đối chiếu diff + CẤM chạm: ĐẠT. ≥3 cách phá: 6 probe (a–e) + 13 đột biến riêng.
- Runtime WP19: không làm đỏ được bằng (a)–(e).
- Bộ đo mới (§9.2) + test §9.1: **LỆCH** — cổng word-by-word dạng "không chung từ nào" ở vị trí (X1b) và việc (X2b) sống qua toàn suite; nguyên nhân gốc: ca §9.2 T-P10-01 / A-08 / A-08b dùng quote chung từ với câu cư dân ("hành lang tầng 3 tòa S1", "bóng đèn nổ tung", "rác khắp nơi"), §9.3 chỉ có đột biến chuỗi con.

## 6. Quan sát ngoài phạm vi WP19 (không tính vào phán quyết)
- `_check_location` loại tòa `"Toà S1"` (dấu đặt trên `a`) ⇒ `rejected=['location.building']` (OBSERVE e3); khối này SPEC §3.2 bắt giữ nguyên từng ký tự ⇒ SO/architect quyết.
- T-P10-07 nạp REF bằng đường tương đối `Path("planning/…")` ⇒ chỉ chạy đúng khi cwd = root repo.
- `pytest` ở root gom thêm 270 test của `planning/09_2026-10-07_day05-labels/` (3682 = 3412 `tests/` + 270).

## 7. Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| Thẩm định cô lập WP19 (đo lại, probe, đột biến) | 🔴 | Claude Opus 5.5, tự làm, không agent con |

Việc KHÔNG làm: không sửa test/SPEC (ngoài phạm vi ghi); không chạy `--pg`, không eval live (NOT_RUN, cấm mạng/LLM). Câu hỏi cần người: §8.

## 8. Tiếp theo
- 🖐 Cần tay người: SO duyệt mở rộng phạm vi test WP19 (thêm 3 ca ở §9 dưới) và chuyển architect sửa SPEC-P10 §9.1 hàng invented-place (`rejected == ["jobs[1].asset_id"]`) + §9.3 thêm m8 = X1b, m9 = X2b; quyết quan sát "Toà S1".
- 🤖 Agent làm được ngay: worker WP19 thêm vào `test_p10_catalog_not_quote.py` ca quote vị trí và quote việc không chung từ nào với câu cư dân, đổi khẳng định invented-place thành chính xác; chạy lại X1b/X2b/X9 bằng [mutate.py](../evidence/WP19-review/mutate.py) phải `EXIT=1`.
- ⭐ Nên làm trước: thêm 2 ca "không chung từ" — vì đó đúng dạng word-by-word Q35 cấm mà hiện CI không bắt.
- ⏸ Chưa làm: `--pg` (#12) và eval live §9.5 (NOT_RUN, cần Docker/quota người cấp); test bất biến ghi chú `merge_llm` theo chữ quote (X6, Vùng cấm hàng 1) để SO cân nhắc, không bắt buộc.

🔁 SỬA: test WP19 (SPEC-P10 §9.2/§9.1) — thêm ca quote vị trí và quote việc KHÔNG chung từ nào với câu cư dân (đột biến X1b, X2b sống qua 3412/3412 test) và khẳng định chính xác `rejected == ["jobs[1].asset_id"]` ở `test_p10_an_invented_place_in_the_catalog_is_kept_and_audited`; runtime §3 giữ nguyên
