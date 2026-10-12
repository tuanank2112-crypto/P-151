Vai: worker (vai-thi-cong) · loại: THI CÔNG tài liệu, vai architect 🔴 · họ/model: Claude Opus 5.5 (`claude-opus-5-5[1m]`), không agent con · Bước 0: exit 0 (root `D:/P151`, "NÃO ĐÃ OK") · hiểu việc: phạm vi = chỉ tài liệu WP18 (SPEC-P10 mới, H18, R17, `evidence/WP18/*.txt`, banner một dòng ở P01/P08/P09, REF vì P10 đổi schema) / xong khi = kiểm kê có lệnh + phân loại, P10 đủ AGENTS §3.2.2, H18 ≤ 80 dòng chờ duyệt, đo `git diff --check` 0 + link 0 thiếu + REF selftest 0 / cấm = `src/`, `tests/`, `seed/`, `plan.md`, commit/stage/push, LLM/mạng, agent con
Handoff: handoffs/H17_thi-cong_WP18.md
Base: 139399ba8fd15c29c33c662e546dbc0e649651cc (đo 2026-10-10 09:01:14 +0700, trước khi ghi)
Head: 00a59bcd11ddfdc1abdf0a2075ff52627e6233cb (commit docs của SO lúc 09:44:15, chỉ H17/plan.md/today.md — không đụng runtime); working tree chưa commit

## 1. Lệnh và exit (nguyên văn; output đầy đủ trong `evidence/WP18/`)
| Lệnh | Exit | Kết quả | Evidence |
|---|---|---|---|
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | NÃO ĐÃ OK | — |
| `git status --porcelain` (trước khi ghi, 09:01:14) | 0 | ` M …/plan.md`, `?? .claude/worktrees/`, `?? …/evidence/WP16-review-v6/`, `?? …/handoffs/H17_thi-cong_WP18.md`, `?? scratch/` | — |
| `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 python -m pytest -q -p no:cacheprovider` (Base) | 0 | 3664 passed, 85 deselected, 0 failed, 0 skipped | [baseline-pytest.txt](../evidence/WP18/baseline-pytest.txt) |
| `python -m ruff check src tests` · `python -m ruff format --check src tests` | 0 · 1 | All checks passed · 1 file (`src/main.py`, từ merge develop `256da96`) | [baseline-ruff.txt](../evidence/WP18/baseline-ruff.txt) |
| kiểm kê: 11 lệnh `grep` | 0 (lệnh cuối 1 = 0 dòng) | 28 chỗ: 9 cổng chặn LLM (6 quote, 3 từ khoá luật) · 6 lưới sàn · 13 chỉ audit | [inventory.txt](../evidence/WP18/inventory.txt) |
| `probe_cases.py` (Base) · `--sim` (P10 mô phỏng trong bộ nhớ) | 0 · 0 | 12 khối (11 ca engine T1–T6 + T4 Mirror): Base loại/hạ ở T1, T3a, T3b, T3c, T5, T5b; mô phỏng nhận/giữ nâng | [probe-before.txt](../evidence/WP18/probe-before.txt), [probe-after-sim.txt](../evidence/WP18/probe-after-sim.txt) |
| `extra_invented_location.py` (Base) · (mô phỏng) | 1 · 1 | `tickets_routed_to_invented_place` = 1 · 3 | [invented-location.txt](../evidence/WP18/invented-location.txt) |
| `probe_g2.py` (Base) · `--sim` | 0 · 0 | quote diễn đạt khác + khu khác luật: ROUTED theo luật · PENDING_REVIEW (G-2) | [g2-probe.txt](../evidence/WP18/g2-probe.txt) |
| `pytest -q -p no:cacheprovider -p sim_p10 -rf` (toàn suite, mô phỏng) | 1 | 19 failed, 3645 passed, 85 deselected — đúng 19 test ★ ở P10 §9.1 | [sim-pytest.txt](../evidence/WP18/sim-pytest.txt) |
| `REF-agent-contract.py --selftest` (REF mới) · bản giữ kiểu quote cũ | 0 · 1 | `SELFTEST_FAILURES=0` · `=4` | [ref-selftest.txt](../evidence/WP18/ref-selftest.txt) |
| `schema_vs_ref.py` (Base) · `--sim` | 0 · 0 | `runtime schema == REF: False` · `True` | như trên |
| `pytest … test_agent_prompt.py test_p1_contracts.py` (REF mới, runtime Base) | 0 | 38 passed | như trên |
| `proto_quote.py` (kiểu `AuditQuote`, pydantic 2.13.5) | 0 | ""/khoảng trắng/null → None; 301 ký tự → 300; số/mảng → `string_type` | [proto-audit-quote.txt](../evidence/WP18/proto-audit-quote.txt) |
| `fc_write.py` (P10 mô phỏng ghi case) · `fc_read.py` (model Base đọc) | 0 · 1 | `ValidationError … agent_decision.decision.jobs.0.quote - string_type` | [forward-compat.txt](../evidence/WP18/forward-compat.txt) |
| `mirror_note.py` (mô phỏng, chưa sửa §3.5) | 0 | ghi chú `"VE_SINH (None); KY_THUAT (None)"` | [mirror-note-sim.txt](../evidence/WP18/mirror-note-sim.txt) |
| bản nháp test P10 §9.2 (ngoài repo) Base · mô phỏng | 1 · 1 | 15 failed / 3 passed · 2 failed (T-P10-06, -08) / 16 passed | [proto-tests.txt](../evidence/WP18/proto-tests.txt) |
| `git diff --check` | 0 | — | [package-check.txt](../evidence/WP18/package-check.txt) |
| `git diff --no-index --check /dev/null <P10 · H18 · R17>` · đối chứng có khoảng trắng cuối | 1 · 1 · 1 · 3 | 1 = chỉ dòng thêm, không lỗi; 3 = có lỗi | như trên |
| `check_links.py <P10> <H18>` · đối chứng hỏng | 0 · 1 | 47 OK, 12 FUTURE (file WP19 sẽ tạo), `MISSING=0` · `MISSING=3` | như trên |
| `wc -l H17 H18` | 0 | 34 · 35 | như trên |

Test tổng/pass/fail/skip: Base 3664 / 3664 / 0 / 0 (85 deselected `pg`). WP18 không đổi runtime ⇒ không có lần chạy "sau".

## 2. Kiểm kê và checklist
- Kiểm kê (`inventory.txt` phần C, đếm bằng máy): tổng **28** · cổng chặn LLM **9** (khớp quote **6**: C1–C6 → P10 §3; khớp từ khoá luật **3**: C7 G-1, C8 G-2, C9 proposer cũ → P10 §7 giữ, cần người quyết) · lưới sàn **6** · chỉ audit **13**. Thêm S1–S3 (SPEC chưa thi công cùng loại: P08 §6 F8, P09 §4.1, P09 B1/B2) và K1–K6 (kiểm danh mục, giữ).
- Checklist H17 §3 (`package-check.txt` §10, máy kiểm): **15 ĐẠT / 1 THIẾU**. THIẾU = "không còn hai luật trái nhau": mục cũ ngoài P01/P08/P09 (00-ARCH I-18/V-11/D-12, 01-CONTRACTS §3.1/§14, P03 dòng S-00, TESTING §3.1 A-04/A-08 + §3.2 P-04) và `plan.md` (Q28-F3, Q34) chưa có banner — ngoài phạm vi ghi của H17; P10 §11 đã ghi "chưa (SO)".
- Banner: P01 6 · P08 2 · P09 9; diff ba file chỉ gồm dòng banner + dòng trống (đếm dòng khác = 0, `git diff --numstat` cột xoá = 0).

## 3. `git diff --stat` + file mới trong phạm vi
```
 .../specs/REF-agent-contract.py                    | 79 +++++++++++++++++-----
 .../specs/SPEC-P01-reasoning-agent.md              | 11 +++
 .../specs/SPEC-P08-audit-fixes.md                  |  4 ++
 .../specs/SPEC-P09-semantic-coordination.md        | 12 ++++
 4 files changed, 88 insertions(+), 18 deletions(-)
```
Untracked trong phạm vi: `specs/SPEC-P10-catalog-not-quote.md` (304 dòng), `handoffs/H18_thi-cong_WP19.md` (35 dòng), `reports/R17_thi-cong_WP18.md`, `evidence/WP18/` (15 file `.txt`, không tên nào bắt đầu bằng `test`). Script đo nằm ở scratchpad; nguồn in trong `probe-scripts.txt`.

## 4. Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| Kiểm kê + phân loại | 🔴 | Claude Opus 5.5 (tự làm) |
| SPEC-P10 + REF + banner | 🔴 | Claude Opus 5.5 (tự làm) |
| Mô phỏng P10 trong bộ nhớ, probe, bản nháp test (kiểm SPEC không tự mâu thuẫn) | 🔴 | Claude Opus 5.5 (tự làm) |
| H18 | 🔴 | Claude Opus 5.5 (tự làm) |
| Sinh evidence, package-check | 🟢 | Claude Opus 5.5 — làm ở tầng trên vì H17 cấm agent con |

## 5. Việc KHÔNG làm + lý do
- Không sửa `src/`, `tests/`, `seed/`, `plan.md`; không commit/stage/push (H17 §2).
- Không đặt banner ngoài P01/P08/P09; không ghi `plan.md` (Q28-F3, Q34 vào "Quyết định bị thay thế"; hàng WP19 ghi phạm vi hẹp hơn P10 — P10 thêm `schema.py`, `safety.py::merge_llm`, một biểu thức `engine.py`) — ngoài phạm vi ghi; SO làm.
- Không chạy G-LIVE (`scripts/agent_live_eval.py`): cấm LLM/mạng ⇒ NOT_RUN. Không chạy `--pg`: WP18 không đổi runtime.
- Không đổi G-1/G-2, proposer cũ, F8, P09 §4.1: ngoài Q35 (khớp từ khoá luật, không phải quote) — P10 §7 + câu hỏi.
- Không sửa chú thích `lexicon.yaml:346` và `docs/maintenance.md` §15 (đã lỗi thời): `lexicon.yaml` CẤM; đồng bộ ở WP13.

## 6. Câu hỏi cần người (chi tiết P10 §7)
- Q-P10-1: G-1/G-2 (từ khoá luật ⇒ PENDING_REVIEW) giữ theo Q06, hay hạ MINOR theo "code chỉ kiểm danh mục"? Mặc định giữ; sau P10 G-2 bắn cả khi quote diễn đạt khác (đo `g2-probe.txt`).
- Q-P10-2: chấp nhận rủi ro Agent bịa vị trí hợp lệ danh mục (client giả "luôn bịa": 1/4 → 3/5 ticket ROUTED sai nơi) với BPTN xem lại, hay cần đo live vị trí trước khi bật trên DB chung?
- Q-P10-3: trước khi phóng H14, F8 chỉ áp đường luật (không chặn quyết định tách của Agent)?
- Q-P10-4: khi duyệt P09, bỏ điều kiện "job.quote grounded" ở §4.1 và §8 CẤM 1.
- Q-P10-5: DB chung — chỉ thủ tục OPERATIONS §5, hay thêm marker revision `0003` (V-10/Q13)? Code trước P10 đọc doc P10 lỗi (đo `forward-compat.txt`).
- SO: đặt banner ở các mục ngoài P01/P08/P09 (P10 §11 dòng "chưa (SO)") và ghi `plan.md`.

## Tiếp theo
🖐 Cần tay người: duyệt SPEC-P10 (đổi dòng "Trạng thái") và trả lời Q-P10-1…5; SO đặt banner ngoài P01/P08/P09, ghi `plan.md` (Q28-F3/Q34 bị thay thế, phạm vi hàng WP19).
🤖 Agent làm được ngay: phóng H18 (WP19, 🟠) khi P10 ĐÃ DUYỆT; sau đó thẩm định cô lập WP19 bằng agent khác.
⭐ Nên làm trước: duyệt P10 — mọi việc sau bị chặn bởi dòng "Trạng thái"; chốt luôn Q-P10-1 vì G-2 sẽ dừng PENDING_REVIEW nhiều hơn sau P10.
⏸ Chưa làm: G-LIVE (NOT_RUN — cấm LLM), `--pg`, banner ngoài phạm vi, `plan.md`, đồng bộ docs/não WP13.

⏳ Chờ người duyệt.
