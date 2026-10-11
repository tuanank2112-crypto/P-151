Vai ORCHESTRATOR · THẨM ĐỊNH đối kháng (chỉ đọc runtime) · Anthropic Claude Opus 5.5 (`claude-opus-5-5`) · Bước 0 exit 1 (hub `../brain4agent.release` không tồn tại, MODULE_NOT_FOUND) · hiểu việc: phá §C1–§C4 + §U1–§U3 bằng ≥3 hướng (guard, giao dịch memory+pg, đồng thời/UI trình duyệt thật), xong khi mọi phép đo có stdout+exit máy ở `evidence/wp4/`, cấm sửa runtime/test/SPEC/evidence worker, cấm :8000/.env/LLM thật, mutant chỉ trên bản sao ngoài repo.
Handoff: H04_adversarial.md
Base: 71315109d845fe69935050b09d4ab4c67efb024a + baseline.txt
Head: 71315109d845fe69935050b09d4ab4c67efb024a + sha256(`git diff HEAD`)=987570627e9292bde00c45810b33f8c5d702d0e11e3c29309aa6a346bdc2e2ee (không có commit mới; untracked: material_policy.py + 3 file test mới, tree_sha256 src/tests/seed/specs = 6630a8811ea04bfca25fb7a8bdaa2608aca0876956a2e8f1be5a3e0460ba8514)

## 1. Lệnh · exit · số đếm (evidence/wp4/)

| Lệnh | Exit | Kết quả | File |
|---|---|---|---|
| `python -m pytest tests -q -p no:cacheprovider` | 0 | 3433 passed, 95 deselected (pg), 0 fail, 0 skip, 148.94 s (nền 3387/88 ⇒ +46 / +7 = 53 test mới: 46 memory + 7 pg) | full_suite.txt |
| docker `python -m pytest tests --pg -q` (p151_test) | 0 | 3528 passed, 0 fail/skip | pg_suite.txt |
| `ruff check src tests` / `ruff format --check src tests` | 0 / 0 | All checks passed / 117 files formatted | ruff_check.txt, ruff_format.txt |
| `git diff --check` | **2** | `brain4agent/-known-gotchas.md:152: new blank line at EOF` (file docs, mtime 17:41 sau baseline 17:08; không phải runtime) | git_diff_check.txt |
| `node --check` 10 file JS đổi | 0 | checked=10 | node_check.txt |
| `probe_backend.py memory` | 1 | 92 probe: 85 HELD, 7 BROKEN | probe_backend_memory.txt |
| `probe_backend.py pg` (docker, p151_test) | 1 | 92 probe: 85 HELD, 7 BROKEN (cùng 7) | probe_backend_pg.txt |
| `probe_api.py` (TestClient, memory) | 1 | 48 probe: 44 HELD, 4 BROKEN | probe_api_memory.txt |
| `live_bigint.sh http://127.0.0.1:8017` (uvicorn thật) | 0 | 3/3 endpoint trả HTTP 500 | live_bigint.txt, live_bigint_serverlog.txt |
| `ui_probe.mjs http://127.0.0.1:8017 C:/P-151/portal screens` (Chromium, web 1440 + app 390) | 1 | 26 probe: 24 HELD, 2 BROKEN | ui_probe.txt, screens/*.png |
| `mutants.py C:/P-151 <scratch>` (5 mutant snapshot.py + 4 mutant riêng) | 0 | 9/9 bị giết bởi cả probe WP4 lẫn 3 file test mới; head: 46 passed | mutants.txt |
| m4 trên pg (docker, snapshot riêng) | 1 | pg từ chối tx lồng (`RuntimeError`) ⇒ m4 không commit nửa chừng được trên pg | mutant_m4_pg.txt |
| `tree_state.py` trước/sau | 0/0 | HEAD, status_sha256 2d88de60…, diff_head_sha256 987570…, tree_sha256 6630a881… giống hệt | tree_before.txt, tree_after.txt |

Lần chạy UI loại khỏi kết luận (giữ raw): ui_probe_run1.txt (lỗi probe: `page.click` của Playwright chờ nút enabled ⇒ click thứ hai xảy ra sau 200, không phải POST đôi), ui_probe_run2_setup.txt (ticket trùng vị trí với run1 ⇒ DUPLICATE, accept 403).

## 2. Các cách phá → kết quả đo

| # | Cách phá | Memory | PostgreSQL | API/UI |
|---|---|---|---|---|
| B1 | Mã khác phòng ban (Kỹ thuật←CLEAN/BAG, Vệ sinh←LAMP/STARTER) qua save/confirm/record trực tiếp engine | HELD ×7, state nguyên | HELD ×7 | A3/A5/A6 409, state nguyên; UI U12 tiêm option CLEAN vào DOM ⇒ server 409, kho/dòng nguyên |
| B2 | Số 0/-1/0.5/True/False/"1"/NaN/±inf/None/10**400 trên save/record/confirm trực tiếp | **7 BROKEN** (TypeError/OverflowError thay GuardError), state nguyên | **7 BROKEN** như memory | A1/A5/A6: 422 mọi giá trị trừ **10**400 ⇒ 500** |
| B3–B5 | Kỹ thuật `[]`, mã trùng, mã lạ; nhận 1 và 1.0 | HELD | HELD | A2 extra field/`lines` null ⇒ 422 |
| B6 | Hoàn thành bằng dữ liệu cũ ghi thẳng store: Kỹ thuật N_A rỗng, CLEAN 2/2, LAMP 0.5, LAMP 0/0, Vệ sinh mang LAMP | HELD ×5 (IN_PROGRESS, material_required/invalid) | HELD ×5 | — |
| B7 | `transition` IN_PROGRESS→READY_FOR_REVIEW bởi phòng ban | HELD (ActionDenied) | HELD | — |
| T1–T2 | Lưu 4 lặp, 4→2→4, thay dòng, STARTER stock None | HELD: LAMP 1,1,3,1,4,5; STARTER None; +1 audit/lần | HELD giống hệt | A7 lưu ×4 hai lần ⇒ 200/200, kho 1.0/1.0 |
| T3–T5 | Đổi LAMP-01×4 sang LAMP-02 hết hàng; 2 dòng dòng 2 thiếu; legacy vượt kho; used>issued | HELD, state nguyên | HELD | UI U3 409 giữ input (web+app ngay sau lỗi) |
| T6–T9 | Lỗi take_stock lần 2, tx.save, tx.append_log, audit sink sau khi đã có 2 lần ghi kho | HELD ×4, ticket/kho/audit/outbox/version nguyên | HELD ×4 | — |
| P1–P4 | Vệ sinh/BQL/Kho/Cư dân lưu ticket Kỹ thuật; ROUTED; READY_FOR_REVIEW; ticket không tồn tại | HELD (403 + 1 dòng audit từ chối; 409; 404) | HELD | A4 403/401/404 |
| R1 | Hai ticket ×4 tranh kho 5, 2 engine (2 lock riêng) cùng DB, take ngủ 0.3 s trong tx, 5 vòng | HELD (1 ok, 1 GuardError) | HELD 5/5: kho 1, tổng xuất 4 | — |
| R2 | Cùng ticket, 2 writer (×2, ×3), 3 vòng | HELD | HELD 3/3: kho+issued = 5 | — |
| X1 | Dòng cũ mang mã không còn trong catalog rồi lưu mới | HELD | HELD | — |
| U1–U13 | Không prefill Agent, rỗng/0.5 chặn trước POST, mạng đứt, dblclick+click+Enter khi đang gửi chậm 2 s, lưu lại, offline, Vệ sinh không dùng, server cũ thiếu mapping, lỗi JS/tràn ngang | — | — | web 13/13 HELD; app 11/13 (**U3b, U7 BROKEN**). POST trong lúc in-flight = 1 (web, app); body đúng `{"lines":[{"item_code":"SIM-MAT-LAMP-01","used_qty":4}]}`; "Đã lưu" chỉ sau 200; kho 8→4; pageerror 0; overflow 0 px |

## 3. Lỗi tìm được (file:line · tái hiện)

F1 — HTTP 500 với số nguyên JSON vượt float (vi phạm §C1 "API kiểm trước coercion", §C5 422, §C6 "API errors trả qua wrapper").
- Gốc: `src/maintenance/material_policy.py:39` `math.isfinite(value)` ném `OverflowError` với int > float; BeforeValidator chỉ đổi ValueError ⇒ lọt ra 500. Ảnh hưởng `_whole_qty` (:46), `src/api/routers/maintenance.py:568` (`material-plan`), engine `record_material` (`src/maintenance/engine.py:1417`), `check_selection` (material_policy.py:70).
- Tái hiện: `sh planning/16_2026-10-10_material-guards/evidence/wp4/live_bigint.sh http://127.0.0.1:8017` ⇒ `material-usage`, `material-plan`, `materials/SIM-MAT-LAMP-01` đều `HTTP 500`; log container: `OverflowError: int too large to convert to float`. Không đổi state (probe A1/A5/A6 state_unchanged=True).

F2 — Engine trực tiếp không trả GuardError cho mọi số sai (vi phạm §C5 "Engine trực tiếp: mọi số sai GuardError").
- `record_material`: `src/maintenance/engine.py:1412` so `used_qty > issued_qty` trước kiểm `whole_positive` ở :1417 ⇒ `issued_qty="1"`/`None` hoặc `used_qty="1"`/`None` ném `TypeError`. 10**400 trên save/confirm/record(issued) ném `OverflowError` (gốc F1).
- Tái hiện: `python planning/16_2026-10-10_material-guards/evidence/wp4/probe_backend.py memory` ⇒ 7 dòng `BROKEN B2 …` (memory và pg như nhau); state nguyên.

F3 — App xoá lựa chọn vật tư sau lỗi khi tự tải lại 30 s (vi phạm SPEC-P02 §U3 "409 shortage … giữ lựa chọn", TESTING §T2 UI).
- Gốc: `src/mobile/js/main.js:54-61` `screenIsDirty()` chỉ tính `[data-dirty="1"]`, ô INPUT/TEXTAREA đang focus, và `textarea, input[type="text"]` đổi giá trị; khối vật tư `src/mobile/js/dept.js:115-165` dùng `<select>` + `input[type=number]` và không đặt `data-dirty` ⇒ refresh vẽ lại.
- Tái hiện: `node planning/16_2026-10-10_material-guards/evidence/wp4/ui_probe.mjs http://127.0.0.1:8017 C:/P-151/portal <out>` ⇒ `app U3 shortage 409 keeps input` HELD (`["SIM-MAT-LAMP-02:1"]`) rồi `app U3b … rows_after_32s=[":1"]` BROKEN; ảnh `screens/app-after-error-32s.png`. Web giữ nguyên sau 32 s (HELD).

F4 — App với server thiếu `material_codes_by_department`: nút Lưu không bị vô hiệu (vi phạm SPEC-P02 §U2 "vô hiệu Lưu").
- Gốc: `src/mobile/js/main.js:114-116` `applyOnline()` chạy sau mỗi render (:302) đặt lại `disabled = !online` cho mọi `[data-write]`, đè `save.disabled = true` ở `src/mobile/js/dept.js:164`.
- Tái hiện: cùng lệnh F3 ⇒ `app U7 … disabled=false posts=0 options=[]` (0 POST vì không có option; web: disabled=true).

F5 — Phạm vi: `src/main.py` bị sửa (+13 dòng: handler 422 cho NaN/Infinity) ngoài danh sách owner SPEC-P01 §B1 (engine, models, catalog, router, material_policy). Theo §A4 root đối chiếu diff và quyết; thay đổi có chủ đích, probe A1 NaN/Infinity/1e400 ⇒ 422 nhờ nó.

F6 — Gate G3: `git diff --check` exit 2 tại `brain4agent/-known-gotchas.md:152` (file docs, không thuộc runtime WP2/WP3).

Ghi nhận (không tính lỗi, root quyết): O1 `GET /api/v1/mo/catalog` bằng cư dân trả 200 kèm `material_codes_by_department` (§U2 ghi "chỉ cho actor internal theo quyền catalog hiện có"; quyền catalog hiện có cho mọi actor đăng nhập). O2 w10 làm probe_backend dừng ở T1 do GuardError không bắt (vẫn tính bị giết; tests cũng đỏ 5).

## 4. Mutant (bản sao ngoài repo, `scratchpad/mutants/<tên>`)

| Mutant | Probe WP4 đỏ mới | 3 file test mới |
|---|---|---|
| m1-no-department | 9 (B1×6, B4, A3, A5) | rc1, 4 failed |
| m2-no-integer | 8 (B2 0.5, B6 0.5, A1/A5/A6 0.5) | rc1, 3 failed |
| m3-no-technical-empty | 7 (B3, A3, A5 …) | rc1, 1 failed |
| m4-partial-commit | 10 (T3–T10, A3, A7); pg: RuntimeError tx lồng | rc1, 7 failed |
| m5-norm-block | 1 (C2) | rc1, 1 failed |
| w6-no-in-progress | 4 (P2, P3, A3, A7) | rc1, 1 failed |
| w7-no-completion-guard | 5 (B6×5) | rc1, 3 failed |
| w8-extra-allowed | 1 (A2) | rc1, 1 failed |
| w10-no-delta | 2 (C1, A7) + dừng ở T1 | rc1, 5 failed |

## 5. diffstat / phân công / chưa làm

- `git diff --stat HEAD`: 39 files, +769/−247; `git diff --numstat HEAD` runtime: routers +29/−3, src/main.py +13/−0, engine +99/−10, agent/client.py +7/−0 (so với HEAD, gồm cả plan 15); untracked runtime `src/maintenance/material_policy.py` 88 dòng; 3 test mới 626 dòng.
- WP4 chỉ ghi `evidence/wp4/*` và file này; tree trước/sau giống (mục 1).

| Gói | Tầng yêu cầu | Họ/model thực tế |
|---|---|---|
| Thẩm định luật/transaction, thiết kế phép phá | 🔴 | Anthropic Claude Opus 5.5 |
| Đo oracle (probe, pg, UI, mutant) | 🟠 | Anthropic Claude Opus 5.5 (cùng phiên: không được phép phóng subagent) |
| Report | 🟢 | Anthropic Claude Opus 5.5 (cùng lý do) |

- Chưa làm: G4 server (chưa deploy, ngoài phạm vi); mutant UI (JS) không chạy; boot hub (thiếu hub, exit 1 — G0 giữ ⬜).
- Câu hỏi cho root: (1) F5 `src/main.py` có đưa vào §B1 không; (2) O1 mapping cho cư dân có chấp nhận không; (3) F6 thuộc H05.

🔁 SỬA: CONTRACTS §C1/§C5 (F1 OverflowError→500, F2 TypeError ở engine) · SPEC-P02 §U3/§U2 (F3 app xoá lựa chọn sau 30 s, F4 nút Lưu không vô hiệu) · SPEC-P01 §B1 phạm vi src/main.py (F5)

## Đo lại sau sửa

Phạm vi: root báo sửa F1–F4, F6; F5 chấp nhận (D08/D12). Vẫn cô lập: không đọc R01–R03, evidence wp1–wp3. Container :8017 đã rebuild; sha256 12 file runtime/client trong container = working tree (SAME 12/12). Head đo lại: 71315109d845fe69935050b09d4ab4c67efb024a + sha256(`git diff HEAD`)=06fe2b4b3683715b6e12d251e772fb91cc9b920c5283926a2c8c1ead2ca1e20f; tree_sha256 src/tests/seed/specs = 315fd01614263ea4a0093ff31de99636189e3e745ad0664743485ddd3a439c55, giống nhau trước/sau đợt đo (recheck_tree_before/after.txt). diff_head đổi a79fc502… → 06fe2b4b… trong lúc đo nhưng tree_sha256 không đổi ⇒ thay đổi nằm ngoài src/tests/seed/specs. Lệnh diff: 39 files, +780/−249.

| Lệnh | Exit | Kết quả | File |
|---|---|---|---|
| `python -m pytest tests -q -p no:cacheprovider` | 0 | 3438 passed, 95 deselected, 0 fail/skip, 170.59 s | recheck_full_suite.txt |
| docker `pytest tests --pg -q` (p151_test) | 0 | 3533 passed | recheck_pg_suite.txt |
| `probe_backend.py memory` | 0 | 92/92 HELD (7 BROKEN B2 cũ ⇒ GuardError) | recheck_probe_backend_memory.txt |
| `probe_backend.py pg` | 0 | 92/92 HELD | recheck_probe_backend_pg.txt |
| `probe_backend.py pg` lần 1 | 1 | NotFoundError SIM-TKT-0001 giữa chừng: p151_test bị truncate từ ngoài (65 HELD trước đó, 0 BROKEN); đo lại ngay ⇒ dòng trên | recheck_probe_backend_pg_run1_interrupted.txt |
| `probe_api.py` | 0 | 48/48 HELD (A1/A5/A6 10**400 ⇒ 422) | recheck_probe_api_memory.txt |
| `live_bigint.sh http://127.0.0.1:8017` | 0 | material-usage/material-plan/materials ⇒ HTTP 422 ×3 | recheck_live_bigint.txt |
| `ui_probe_v2.mjs` (= ui_probe + U14) | 0 | 27/27 HELD; app U3b `rows_after_32s=["SIM-MAT-LAMP-02:1"]`; app U7 `disabled=true posts=0` | recheck_ui_probe.txt, screens_recheck/ |
| `git diff --check` (18:11 và cuối đợt) | 0 / 0 | sạch | recheck_git_diff_check.txt, recheck_git_diff_check_final.txt |
| `ruff check` / `ruff format --check` | 0 / 0 | All checks passed / 117 files | recheck_ruff_*.txt |
| `node --check` 10 JS | 0 | checked=10 | recheck_node_check.txt |
| `mutants.py` (9 mutant) | 0 | 9/9 bị giết bởi cả probe và test; head 51 passed, 7 deselected | recheck_mutants.txt |

Probe mới U14 (app): form không chạm ⇒ `data-dirty` rỗng, 1 GET refresh/33 s; đối chứng đặt `data-dirty=1` ⇒ 0 GET/33 s, nhãn "Tạm dừng tự cập nhật khi đang nhập" (phép đo phân biệt được refresh chạy/dừng; không làm đóng băng refresh khi không nhập).

| Lỗi | Trạng thái đo lại |
|---|---|
| F1 10**400 ⇒ 500 | Hết: 422 ×3 (live + TestClient), engine GuardError |
| F2 TypeError ở engine | Hết: record issued/used "1"/None ⇒ GuardError, state nguyên |
| F3 app mất lựa chọn sau 30 s | Hết: giữ sau 32 s |
| F4 nút Lưu app không vô hiệu | Hết: disabled=true, 0 POST |
| F5 src/main.py ngoài §B1 | Root chấp nhận (D08/D12), không đo lại |
| F6 git diff --check | Hết: exit 0 |
| O1 cư dân thấy mapping | Root chấp nhận (D12); vẫn đo 200 has_mapping=True |

Còn treo: G4 server ⬜ (chưa deploy); G0 boot hub ⬜ (Bước 0 exit 1); p151_test dùng chung giữa các agent ⇒ đo pg phải chạy tuần tự.

✅ DUYỆT
