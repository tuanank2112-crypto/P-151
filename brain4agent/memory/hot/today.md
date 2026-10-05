# 📅 Nhật Ký Làm Việc Ngày 2026-09-30 (Session Memory Log)

> Cập nhật lúc: `2026-10-01` | Phiên bản: `v1.0.1`

---

## 🏁 Phiên 2026-09-30 — Khởi tạo cấu trúc dự án

## 🎯 Thành Tựu Khởi Tạo:
- Bổ sung bộ nhớ Đa Tầng brain4agent V5.2 vào repo hiện có.
- Chạy `init_brain.js --check`: 8 lệch tự sửa, 0 việc cần người; chạy engine chế độ ghi thành công.
- Đối chiếu nhánh `main`: mã vẫn là template FastAPI/LangGraph; `Problem_Card.md` mô tả ResidentGPT nhưng chức năng chưa triển khai. Đã điền kernel, index, project intro, data flow, roadmap và changelog theo hiện trạng.
- Kiểm tra lại engine: exit 0, não đạt chuẩn. `python -m pytest -q` chưa chạy được vì môi trường thiếu `pytest_asyncio`; chưa kết luận về test ứng dụng.

## 🔎 Phiên 2026-09-30 — Báo cáo hiện trạng repo (chỉ đọc + đo)
- `init_brain.js --check`: exit 0. `ruff check src/ tests/`: exit 0.
- `pytest tests/ -v` trên venv Python 3.11 tạm (scratchpad, cài `requirements.txt`): 5/5 pass, exit 0. Python 3.13 hệ thống thiếu `langgraph`/`pytest_asyncio` ⇒ exit 4 (lỗi môi trường, không phải code).
- Hiện trạng: code vẫn là template AI20K; ResidentGPT chỉ có `Problem_Card.md`; `planning/` trống; JOURNAL/WORKLOG/eval/ARCHITECTURE còn là mẫu; bộ não chưa commit.

## 🔎 Phiên 2026-10-01 — Rà nhánh remote & vai phát triển Agent (chỉ đọc + đo)
- `init_brain.js --check`: exit 0. `git fetch`: không có commit nào trong đêm 30/9→1/10; mới nhất là `feature/tri` (30/9 10:16–15:58, 8 commit: ai_logger, panel đề xuất Agent, màn AI Logs, dark mode, UI-01..10).
- Sản phẩm thực tế trên các nhánh đã đổi sang **MaintenanceOps Agent MVP v0.3** (`feature/truong` FROZEN 28/09; `feature/chamanh` code + 7 tài liệu chuẩn). Não local (ResidentGPT/template) đã LỆCH — không commit nguyên trạng.
- Đo trên worktree tạm, Python 3.11, `LLM_MODE=mock`: `feature/tri` pytest 144 pass exit 0, ruff 10 lỗi; `feature/chamanh` 135 pass exit 0, ruff sạch.
- `git merge-tree chamanh tri`: 8 file xung đột (engine.py, proposer.py, routers/maintenance.py, main.py, app.js, index.html, conftest.py, 04_ui_flow). `feature/tri` thiếu `data-contract-v1.md`, `playbook-v1.md`. `feature/nhuy` không có merge-base với main (lịch sử dự án khác).
- Drift spec: kernel FROZEN ghi 4 state + duty lookup; PRD trên `chamanh` đã theo CR-BPTN-02 (phòng ban, VERIFYING/PENDING_REVIEW) — cần nhóm chốt baseline.
- Bản chất xung đột chamanh↔tri: `tri` CHÉP TAY code `chamanh` (bản 29/9 16:26) lên nhánh mọc từ `main` thay vì merge ⇒ git báo add/add. 7/8 file chỉ là "tri = chamanh + phần thêm" (ai_logger, 2 endpoint `/ai-logs`, dark mode, panel Agent); `conftest.py`/`main.py` của tri thêm try/except che lỗi thiếu thư viện. Xung đột THẬT duy nhất: `docs/04_ui_flow_wireframe.md` — hai tài liệu khác hẳn, mã UI-01..10 trùng tên khác nghĩa.
- Yêu cầu người dùng (2026-10-01): Agent NHẬN THỤ ĐỘNG sự kiện kho, không cần người bấm "Nhập kho". Phương án đề xuất: webhook inbox `POST /api/v1/integrations/stock-events` (HMAC + `event_id` chống trùng + tài khoản máy), n8n làm adapter nguồn kho mô phỏng. Đổi actor của `stock_received` từ người (PRD §2.5) sang hệ thống ⇒ lệch contract đã duyệt ⇒ chờ người dùng/nhóm duyệt CR trước khi viết SPEC.
- Phát hiện (đọc code `feature/tri`): tồn kho mô phỏng CHỈ có 2 chỗ ghi — `_reset_stock` (engine.py:264) và `receive_stock` cộng dồn (engine.py:817). Không trừ khi route, không trừ khi phòng ban ghi `issued_qty` ⇒ nhiều ticket cùng qua cổng kho trên một lượng hàng. Chưa rõ là lỗi hay giản lược có chủ ý (non-goal "quản lý tồn kho đầy đủ") — cần hỏi nhóm. Là điều kiện tiên quyết nếu tự động hoá nguồn kho.
- Đo (worktree tạm `feature/tri`, probe + 3 test sẵn có, 4 pass exit 0): nhập kho `POST /api/v1/mo/warehouse/stock/SIM-MAT-LAMP-02` ⇒ SIM-TKT-TEC-003 `ON_HOLD`→`ROUTED`, blocker=None, rời hàng chờ kho (chi tiết 200→404), BPTN thấy ROUTED. Dự phòng: job kiểm lại kho đầu mỗi ca (`next_shift_start`), ≤3 lần, 24h leo thang BQL. Khoảng trống duy nhất: AI GỌI API nhập kho — n8n (login `/api/v1/auth/login` → POST stock) làm được KHÔNG sửa backend.

## 🧭 Phiên 2026-10-01 (chiều) — Chốt CR-BPTN-03 là spec duy nhất
- `init_brain.js --check`: exit 0. `git fetch`: PR #2 `docs/cr-bptn-03` (Truong) merge vào `feature/chamanh` (72cb28b, 12:15); `main` không đổi. Đã checkout `feature/chamanh` (track origin), file untracked giữ nguyên.
- Đọc kế hoạch nhóm (Notion public, lấy qua API `loadCachedPageChunkV2` vì trang render JS): MVP online 04/10 (CR-03 P0 + Supabase/Render + gpt-4o), bàn giao 19/10 (P1 + LangGraph + eval). Như Ý = engine/state machine/safety/LangGraph. Trang Notion bị dán nội dung 2 lần (390 block khác ID).
- Review `docs/Activity Diagram.png` theo CR-03: 11 điểm lệch (an toàn phải trước trùng/phân loại; thiếu Bậc 2 → BPTN 3 lựa chọn; BQL khẩn cấp có hạ báo nhầm; gộp → MERGED kết thúc; sai phòng ban không giao thẳng; thiếu kiểm 6 điều kiện hồ sơ; rework về Thực hiện; thiếu rating; "phân công" trái `assignee_id=null`).
- Người dùng chốt: bỏ hẳn CR-BPTN-01/02, mọi thứ theo CR-03. Đã `git rm` 2 file, sửa header CR-03 (baseline = code `a305fc0`), README, và toàn bộ não (kernel, index, intro, data-arch, roadmap, changelog v1.0.1, gotchas).
- pytest trên Python 3.13 hệ thống: exit 4 (thiếu `pytest_asyncio`) — lỗi môi trường đã biết.

## 🔀 Phiên 2026-10-01 (chiều, tiếp) — Kéo `1e2f42b` + chốt D-09
- Châm Anh đẩy `1e2f42b` (15:50): phân loại trước trùng, đổi tên hàm bước, hardening backend, và đưa `brain4agent/` (bản CR-02) vào git.
- Người dùng chốt: thứ tự theo Châm Anh (phân loại trước, trùng sau) → CR-03 thêm D-09, sửa §1/§5.1/§5.2/§8/§14; tầng an toàn 2b vẫn trước phân loại (AC-02).
- Kéo code: sao lưu não local ra scratchpad, `git stash`, dời `brain4agent/` local, `git pull --ff-only` (exit 0), `stash pop`; xung đột `CR-BPTN-02.md` (họ sửa / mình xoá) giải bằng `git rm`. README + CR-03 khớp bản sao lưu.
- Não: đặt lại bản CR-03, gộp ghi chú kỹ thuật từ não Châm Anh (bản gốc của họ còn ở `git show 1e2f42b:brain4agent/...`). `stash@{0}` còn giữ để phòng hờ; `stash@{1}` (main, cũ) không đụng.
- Phiên Châm Anh (theo não của họ): 142 test pass, ruff sạch; đảo lại thứ tự cũ ⇒ 3 test mới đỏ.

## 📐 Phiên 2026-10-01 17:15 — Hồ sơ 01 (CR-03 P0 engine)
- Nhánh `feature/nhuy-cr03-p0`, nền `e5ececf` (142/142, ruff sạch). SPEC ✅ (8 file; proto 84 câu, 0 bỏ sót Bậc 1). Quyết định Q01–Q20 ở `planning/01_2026-10-01_cr03-p0-engine/plan.md` §2. Phóng WP2 (contracts).
- WP2 (contracts) xong: 149 test pass (142 nền, sửa 6 test cũ, +7 mới), ruff sạch; M-01..M-03, M-05..M-08 đúng; nền trước commit `738a58b`; chưa có logic an toàn/hành động BPTN-BQL/priority (WP3-WP5).
- WP2 ✅ (R01, SO đo 149 pass). Phóng WP3 (safety 2b) theo H02.
- WP3 (safety 2b) xong: 266 test pass (nền WP2 149, +117 trong test_safety.py), ruff sạch; REF TOTAL=84 BAD=0 TIER1_MISS=0; evaluate 12/4/[]; làm đỏ lexicon (active_phases P1 / xoá S-02) rồi xanh; nền trước commit `27655d5`.
- WP3 ✅ (R02, SO đo 266 pass; 0 bỏ sót Bậc 1). Q22: "bóng đèn bị cháy" bị classifier cho OUT_OF_SCOPE — chuyển Trường. Phóng WP4 theo H03.
- WP4 (luồng khẩn cấp) xong: 292 test pass (nền WP3 266, +26 trong test_emergency.py), ruff sạch; 5 method safety_*/emergency_*, T03/T05/T06/T07/T10, chặn BPTN trên blocker BQL, guard Q19; làm đỏ resume-gỡ-khẩn-cấp và bỏ Q19 rồi xanh; nền trước commit `f854cf3`.
- WP4 🔁 (R03): BPTN trên blocker BQL phải 403 kể cả bptn_resolve (CR-03 §4.4.5). Trả worker sửa.
- WP4 sửa 🔁 (drift 1): BPTN bị 403+audit trên mọi blocker chủ BQL kể cả bptn_resolve; 292 test pass, ruff sạch; làm đỏ (thêm lại ngoại lệ) rồi xanh; nền `dae9513`.
- WP4 ✅ sau 🔁 (R03, 292 pass, BPTN trên blocker BQL = 403). Phóng WP5 theo H04.
- WP5 (priority) xong: 313 test pass (nền WP4 292, +21), ruff sạch; PRI-H1/H2/M1/M2/L1/D0, set_priority, queue sort, rate một lần, seed priority; làm đỏ rate-ghi-đè và đảo khoá sắp xếp rồi xanh; nền `8c91c2d`.
- WP5 ✅ (R04, 313 pass). Đã push nhánh feature/nhuy-cr03-p0 lên origin (yêu cầu người dùng). Tiếp: WP6 thẩm định cô lập.
- WP6 thẩm định 🔁 (R05): quyền/audit/đồng thời PASS nhưng bỏ sót Bậc 1 (phủ định lan qua dấu phẩy, thiếu từ vựng, ký tự lạ) + DoS O(n²). Kỳ vọng Q24–Q27; phóng WP3b theo H05.
- WP3b (safety hardening) xong: 352 test pass (nền 313, +39), ruff sạch; 0 bỏ sót Bậc 1 / 0 báo nhầm trên 52 ca Bậc 1 và 46 ca NONE; N-01..N-10 sửa; assess 24 KB < 0,35 s, mô tả > 5000 ký tự => 422; nền `a23a85f`.
- WP3b ✅ (R06, 352 pass, 0 bỏ sót Bậc 1 trên 52 ca, 0 báo nhầm trên 46 ca NONE, 24 KB 0,3 s). Phóng thẩm định lại bằng auditor mới.
- Thẩm định lần 2 🔁 (R07): còn bỏ sót Bậc 1 (M1 phủ định lan không dấu câu, M13 B-01, M14 từ vựng) + báo nhầm mới. Fail ×2 ⇒ leo judge (Q28).
- Judge (Opus) phán Q29: sửa thiết kế phạm vi phủ định/B-01 theo R1–R10, tiêu chí dừng đo được, không bật LLM ở P0. Phóng architect (Opus, không Fable) sửa SPEC-P01 + 01 §5.
- SPEC sửa đổi (architect Opus) ✅ Q30; phóng WP3c theo H06.
- WP3c (thiết kế lại phạm vi tầng an toàn R1-R10) xong: 1378 test pass (nền 352, +1026), ruff sạch; bộ dừng 989/989 xanh, D-1..D-7, D-9 đạt (D-8 holdout do SO); assess 24 KB <= 0,28 s; RED-6..10 có cặp đỏ/xanh; nền `c911971`.
- WP3c ✅ (R08): 1378 pass; holdout judge NONE 3/39 đạt. Phóng thẩm định lần 3 (auditor mới).
- Thẩm định lần 3 🔁 (R09): gate máy xanh hết, còn 4 lỗi cơ chế hẹp (cue 1 chữ, hedge khớp tên, đồng tự gõ sai dấu, chữa cháy). Q31: sửa WP3d, không mở vòng 4.
- WP3d (siết cue/đồng tự/ký tự điều khiển theo thẩm định lần 3) xong: 1462 test pass (nền 1378, +84), ruff sạch; atk1-atk4 ca A-D, G, từ vựng đúng mức Q31; bộ dừng + ngưỡng báo nhầm Q29 không hồi quy; RED A,B,C,D,G có cặp đỏ/xanh; nền `a37926a`.
- WP3d ✅ (R10, 1462 pass, holdout NONE 2/39) ⇒ cổng WP6 đóng ✅ (Q32). Giao H08 đóng hồ sơ + đồng bộ + v1.1.0.
- H08 đóng hồ sơ 01 (2026-10-02 20:04 +0700): đồng bộ chữ SPEC-P01 (§0.1 WP3d), TESTING (X-2 = 403, §4.3, Exit Gates local ✅ / server ⬜), OPERATIONS (WP3b/c/d/H08), 00-ARCHITECTURE (D14–D16), CR-03 §5.2 + D-10 (Q17); `docs/maintenance.md` mới; não 6 điểm + project-intro + data-architecture; brain `current_version` 1.0.1 → 1.1.0 (KHÔNG đổi version app). Số đo cuối: 1462 test pass, ruff sạch, bộ dừng 1065 ca xanh, holdout NONE 2/39.
- Hồ sơ 01 ĐÓNG ✅ (R11). Push nhánh feature/nhuy-cr03-p0.
- Đồng bộ não sau đóng hồ sơ (2026-10-02): thêm gotcha log AI (python3 alias ⇒ .ai-log trống; .env có key), roadmap (log AI, đồng bộ 01-CONTRACTS §5), kernel trạng thái remote/develop.
- Tắt alias Python Store (đổi tên *.disabled) ⇒ hook log AI dùng Python313; từ prompt kế tiếp có log, push kế tiếp nộp BTC.
- Mở hồ sơ 02 (merge develop): plan.md Q01–Q07, handoff H01; worker Opus.
- Hồ sơ 02 WP1 (merge `origin/develop` `deab467`): 13 file xung đột giải theo Q03–Q05; Q04 xử + `test_cr03_store.py`; pytest/ruff ở `planning/02_2026-10-02_merge-develop/evidence/`.

## 🏁 Phiên 2026-10-01 (nhánh `develop`, Châm Anh) — Sửa flow theo biểu đồ: phân loại trước kiểm tra trùng
- Đảo bước 3↔4 trong `_run_pipeline`; hàm bước đổi tên `_step_<số>_<việc>` để grep theo số bước.
- `_find_duplicate_ticket_id`: lọc status/category trước, chỉ parse vị trí ticket cùng category trong cửa sổ 48h.
- Resume: CATEGORY_UNCLEAR/OUT_OF_SCOPE → 4, bác DUPLICATE → 5, WAITING_MATERIAL → 6.
- Test: 142 passed (thêm 10d, 10e; 10b đổi tên → step_5). Đảo lại thứ tự cũ ⇒ 3 test mới đỏ (đã kiểm).
- Chưa làm (Idea Vault): nhánh khẩn cấp → BQL; BQL không duyệt → BPTN đối chiếu lại phòng ban.
- Người dùng chốt: BQL trả làm lại → về thẳng phòng ban cũ (giữ hành vi hiện tại), bỏ ô "BPTN đối chiếu lại phòng ban" của biểu đồ. Ghi CR-BPTN-02 §9.3.
- Người dùng chốt: theo biểu đồ của mình, bỏ qua CR-BPTN-03 (Trường).
- Thiếu dữ liệu giao BPTN: MISSING_INFO ∈ BPTN_REASONS, `bptn_resolve` nhận NEED_INFO (`location`/`info` + note, phải đủ mọi phần thiếu); bỏ `sla_config.missing_info`; UI BPTN thêm form. 146 passed; gỡ MISSING_INFO khỏi BPTN_REASONS ⇒ 13 fail + 43 error (đã kiểm đỏ).
- Sửa docs/CR-BPTN-03.md khớp flow đang code (thêm §19, D-09…D-12, AC-19/20); tầng an toàn đề xuất đặt ở bước 3b sau phân loại.

## 🏁 Phiên 2026-10-02 (nhánh `develop`, Châm Anh) — Kế hoạch 01: WP2–WP4 (Postgres, ảnh Storage, startup không reset)
- WP2: `store/postgres.py` (FOR UPDATE + version, sequence số ticket, advisory lease, dịch lỗi pgcode), Alembic `0001`, C1–C4, `--pg`.
- WP3: `store/photos.py` Local/Supabase (retry 0,5/1 s, Duplicate-ở-lần-retry, key chỉ `SecretStr`); API ảnh trả `Response` bytes.
- WP4: `get_engine` → `build_engine(settings)` + `seed_if_empty`; cổng `RESET_DISABLED`; compose `COMPOSE_DATABASE_URL`; `.env.example`.
- Đo: mặc định 185 passed + 20 deselected; `--pg` 205 passed; ruff sạch; 11 bằng chứng đỏ exit 1; restart uvicorn thật PASS.
- Sự cố: G1 đầu tiên (trước khi ép env trong conftest) mở kết nối Supabase chỉ-đọc — đã chặn, ghi gotcha.
- Còn: WP4b, WP5 (owner chạy migration Supabase + M-SB1/M-SB2), WP6; R02 chờ người duyệt; chưa commit.
- Owner đã migrate Supabase (`0001_maintops_initial`, kiểm chỉ-đọc PASS, TLSv1.3 client). Chạy alembic phải bằng `.venv\Scripts\python.exe` (conda base không có alembic).
- Hồ sơ 02: merge develop ✅ (b4f8a5d, 1514 test, an toàn không hồi quy). Brain v1.1.1. Push nhánh; PR chờ người dùng.
- 2026-10-03: develop có PR #5 của Trí (2f00a2c, chỉ src/web/app.js) ⇒ merge vào nhánh, không xung đột. PR của nhánh này chưa merge vào develop.
- 2026-10-03: develop nhận PR #6 Trường (safety.py độc lập + bộ nhãn) ⇒ 8 xung đột với nhánh. Q09: giữ safety.py nhánh này, chạy bộ nhãn Trường trên engine. Giao H02 (Opus).

## Trường MVP preparation — 2026-10-03
- Thực hiện lúc 2026-10-03T09:39:18+07:00; đầu việc giao cho 01/10–02/10, không dựng lại lịch sử.
- User yêu cầu 5 sub-agent cho 5 gói; giới hạn 4 slot (root +3) nên chạy hai lượt.
- D-01 được user xác nhận delta + structured persisted context, safety luôn chạy, risk không tự hạ. D-02–07 defaults; D-08 group approval pending.
- Boot exit1 MODULE_NOT_FOUND hub; không sửa managed rules.
- Python offline3.11.16 + archive cache: baseline185passed20deselected exit0. Ruff check sạch; format baseline đỏ2file ngoài scope.
- Chưa commit/push/deploy; chưa tích hợp safety hoặc D-01 runtime.

- Chốt đầu ra local lúc 2026-10-03T09:50:39+07:00: 5/5 sub-agent nộp report, 5 gói chuẩn bị đã hoàn thành; kế hoạch chưa đóng.
- Root đo lại: 266 passed / 20 Postgres deselected, exit0; gồm 72 safety và 9 fixture target. Ruff check exit0; format 3 file mới exit0; hồ sơ 57/57 pass, skip0, exit0.
- Format toàn repo vẫn exit1 do 2 file baseline ngoài scope; boot hub exit1; không chạy Postgres/online trong phiên này.
- Review đã sửa false positive phủ định liên tiếp, giữ risk cũ; bằng chứng red-negation → green-negation. Contract đích thêm nguồn ticket và clearance residual-risk guard.
- Group approval, runtime integration và online acceptance pending. Không tăng version ứng dụng, không stage/commit/push/deploy.


## D-08 approval recorded — 2026-10-03
- D-08 APPROVED: người dùng thông báo leader Lê Thị Châm Anh duyệt phạm vi MVP 04/10 và D-01–D-07; ngày duyệt được báo là 2026-10-02, chưa cung cấp giờ. Ghi nhận ngày 2026-10-03; commit a5e2705/PR #6 là bản tham chiếu được người dùng xác nhận trong phiên này, không khẳng định commit đã tồn tại ngày 02/10. Nguồn: thông báo người dùng trong phiên; chưa có link biên bản ngoài. Không mở rộng thành duyệt mọi CR/backlog hoặc nghiệm thu runtime.
- Không đổi engine/storage/API, không đóng runtime/online gates; chưa commit/push bản ghi này.
- Kiểm tra bản ghi D-08: verify_package.py 57/57 pass, fail0, skip0, exit0; giữ nguyên bằng chứng nghiệm thu cũ.

## Day03 tasks planned — 2026-10-03
- 2026-10-03T10:43:10+07:00: tạo SPEC/checklist 7 task, chưa chạy. Phạm vi Trường: nghiệp vụ, dữ liệu/expected, kiểm thử, wording, demo; không sửa app safety/engine/API/UI. Không phát hành, không commit/push.

## Tối ưu não cho Trường — 2026-10-03
- Đọc Notion "Kế hoạch MaintenanceOps MVP" qua API public `loadCachedPageChunkV2` (WebFetch không render được trang JS).
- Kernel thêm `<truong_focus>` (chủ việc, ranh giới không sửa, chỉ tiêu 19/10); sửa nhánh `feature/chamanh` → `feature/truong`.
- Roadmap: lịch Trường 01/10–19/10 dạng checklist (01–02/10 ✅, còn lại mở). project-intro: sửa persistence cũ (in-memory → memory|postgres), thêm mốc/nhóm, ghi CR-BPTN-01/02 không có trên nhánh này. index: router việc Trường, dataset, deliverables; map src/seed/tests.
- Bước 0 vẫn exit 1 MODULE_NOT_FOUND (không có `../brain4agent.release`). Chỉ sửa docs não, không chạm code; chưa commit.

## Day03 kết quả — 2026-10-03
- Chạy local cô lập (MO_STORE=memory, mock, MO_JOBS_ENABLED=false), nhánh feature/truong, SHA 0ea04ad. 23 record: 17 PASS / 1 FAIL / 5 BLOCKED / 0 NOT_RUN.
- D3-02 asset 3/3 PASS; D3-03 vật tư 4/4 PASS; D3-04 trùng 4/4 PASS; D3-05 WORD-03 PASS, WORD-01/02/04 BLOCKED; D3-06 5 PASS, 1 FAIL (DEMO-01-RATING: engine.rate ghi đè rating, engine.py:548-553), 2 BLOCKED (DEMO-04 safety chưa tích hợp). Owner Như Ý.
- Checklist plan.md: D3-01/02/03/04/07 [x] (D3-07 chỉ là đã lập báo cáo); D3-05/06 chưa [x]. Plan chưa đóng; không tăng version; runtime/online/group-runtime gates mở.
- Chờ người quyết: ASSET-03 (SPEC §3 vs OPERATIONS §3.2.2), STOCK-04 (STOCK_CHECK_ON_ACCEPT chỉ đặt cờ), owner reopen/rating-once. Bước 0 vẫn exit 1 (thiếu ../brain4agent.release).
- Harness tái hiện: planning/02_2026-10-03_truong-mvp-prep/evidence/d3-06/harness.py (PYTHONPATH=repo root). Chưa commit/push.
- 2026-10-03: merge lần 2 develop 0cb16e2 (PR #6 Trường) theo H02 + SO Q10: giữ safety.py nhánh này, bộ nhãn Trường chạy trên assess (92 khớp/6 cao ghim ABOVE_LABEL), lexicon thêm giật (Bậc 2) + loại trừ giật nước; 1600 passed, ruff sạch.
- 2026-10-03: merge lần 2 develop (0cb16e2, PR #6 Trường) ✅ 510f888: 1600 test; bộ nhãn Trường 92 khớp/0 thấp/6 cao. Push nhánh + Activity Diagram.
- Thêm docs/Activity Diagram.png (bản nháp swimlane của Như Ý; còn lệch CR-03: thiếu 2b trước phân loại và nhánh Bậc 2 — xem roadmap).

## Day03-bis + chốt quyết định — 2026-10-03
- Merge develop e32e014 → cd83f11 (đã push), pytest 1600 passed/29 deselected, ruff đạt. Day03-bis (cd83f11): 23 record = 19 PASS / 4 BLOCKED (DEMO-04, WORD-02/04: chưa có route safety); rating-once FAIL→PASS. Local 2a753c8 chưa push.
- Người dùng chốt: ASSET-03 = A (giữ OPERATIONS asset_onsite, SPEC sửa chữ), STOCK-04 = A (cờ chỉ là lời nhắc), owner route safety = Như Ý. Handoff cho Như Ý: planning/02_*/deliverables/handoff-noy-safety-routes.md.
- Môi trường: cần DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 + sqlalchemy 2.0.x (2.1 bị Application Control chặn DLL).

## Day03 đóng — 2026-10-03
- Người dùng chốt D-01 ngoài phạm vi MVP 04/10. Rà lại WORD-04 trên develop f46a53c: PASS (UI hết fallback, /close trả 409 với khẩn cấp). D3-01..07 tick [x]; D01-A/C giữ BLOCKED trong results. Runtime/online gates vẫn mở.

- 2026-10-03 11:11: PR #7 merge vào develop (6265436) bởi người dùng; cây trùng nhánh đã đo. Hồ sơ 02 ĐÓNG ✅. CI fail do billing Actions. gh: token git thiếu read:org ⇒ dùng GH_TOKEN qua REST.
- 2026-10-03 12:10: Trường giao route safety/khẩn cấp (handoff-noy-safety-routes). Mở hồ sơ 03, nhánh feature/nhuy-safety-routes từ develop 512131a; route khớp UI PR #8 (Q01).
- 2026-10-03: WP1 plan 03 (worker): 3 route safety/khẩn cấp bọc engine (Q01), test_api_safety.py 40 test, pytest 1600→1640; chờ SO đo + phán.
- Hồ sơ 03 ✅: route /mo/tickets/{id}/safety + /bql/tickets/{id}/emergency/{close,downgrade} (24a99ac), 1640 test, ruff sạch. Push + PR vào develop.

## 🔀 Phiên 2026-10-03 (chiều) — feature/chamanh đặt router lên engine CR-03 của Như Ý (PR #7)
- Người dùng chốt: engine/safety/priority/models/views/enums, test, brain4agent/ theo develop; Châm Anh chỉ giữ `src/api/`, `src/main.py`, hồ sơ `planning/02_…`. Bản CR-03 cũ ở nhánh `backup/chamanh-cr03-full` (d562973).
- Router: `/safety {decision}` rẽ sang `safety_confirm_safe` / `safety_request_info` / `safety_escalate`; giữ `/priority`, `/emergency/close|downgrade`; sắp hàng chờ bằng `_queue_key` trong router (develop chưa có `priority.sort_key`); bỏ `reason`/`into` khỏi TransitionRequest.
- Tạm gỡ route chưa có engine: `/unmerge`, `/report-wrong-dept`, `/material-short`, `/bql/safety-clearances`, `/bql/…/follow-up`, `/bql/…/merge`, `/bql/…/wrong-dept`.
- Đo: pytest 1600 passed + 29 deselected exit 0; ruff check exit 0; smoke API 6/6 route. Chưa chạy `--pg`.

## v1.1.2 — chặn `/close` thường trên ticket khẩn cấp — 2026-10-03
- Đo trước sửa: `POST /bql/tickets/SIM-TKT-TEC-005/close` kèm note → 200 CLOSED/EMERGENCY_HANDLED (trái OPERATIONS §5.3 mục 1). Người dùng chọn (a): chỉ còn `/emergency/close`.
- Sửa `engine.close` ghim `expected_from=READY_FOR_REVIEW`; test mới đỏ 2 → xanh; pytest 1601 passed/29 deselected exit 0; ruff check/format exit 0. Field đúng là `safety_clear_reason` (repo không có `safety_cleared_reason`).
- Tiêu đề OPERATIONS §5 vẫn ghi "TARGET BLOCKED — UNIMPLEMENTED" dù route emergency đã có — chưa sửa (hồ sơ của Trường). Chưa commit.
- Merge origin/develop (a68513e, PR feature/tri UI readiness/6 gates) vào feature/chamanh: chỉ đổi src/web/app.js, 0 xung đột; pytest 1601 passed/29 deselected, ruff src+tests exit 0, node --check app.js exit 0. UI chỉ gọi /close ở nút Nghiệm thu (READY_FOR_REVIEW).

## Merge develop ← nhuy-safety-routes + feature/chamanh — 2026-10-03
- Router: route `/safety` và `/emergency/{close,downgrade}` giữ bản Như Ý (`EmergencyNoteBody` bỏ qua field lạ như `closure_kind`); thêm từ chamanh `/priority`, hàng chờ `_queue_key`, lọc BQL risk_level/priority, bỏ `/resident/.../reopen`, v1.1.2 chặn `/close` trên ticket khẩn cấp.
- Đo: pytest 1641 passed/29 deselected exit 0 (gồm 40 test test_api_safety.py), ruff check + format src/tests exit 0.

## Đóng lệch thứ tự phân loại/an toàn (plan 02 Q11) — 2026-10-04
- Trường sửa fixture `954dcab` (PR #12, develop `dff898e`): CLN-004/TEC-005 bỏ 3 trường phân loại; engine không đổi.
- Đo lại (evidence/13 của plan 02): evaluate CR03 12/12, 4 demo; target 9 passed; phá thử 3/3 đều đỏ; pytest 1641 passed/29 deselected, ruff sạch. Ghi Q11 vào plan 02, sửa `docs/maintenance.md` §10, thêm Idea Vault.

## Rà soát toàn dự án + mở plan 04 sửa logic — 2026-10-04
- Rà engine (tự đọc) + 2 thẩm định Opus (an toàn/phân loại; API/quyền/lưu trữ): pytest 1641 pass/29 deselected, ruff sạch, nhưng 16 lỗi đo được (plan 04 §1): bỏ sót Bậc 1 (thang máy kẹt người, té xỉu, dây điện rơi), báo nhầm "bị ngắt"; cư dân dò/phình ticket người khác qua route hành động; ảnh giả qua cổng bước 10; REWORK dùng lại ảnh cũ; BQL bị khoá sau T06; AI Log luôn `PENDING`; LLM trong `engine.lock`; ticket mồ côi.
- Mở `planning/04_2026-10-04_logic-review-fix/` (PATCH, nhánh `fix/nhuy-logic-review`): WP1 lexicon (Opus worktree), WP2 rules/proposer (Sonnet worktree), WP3 engine/router (SO).
- Thực thi plan 04 (v1.1.3): WP3 engine/router/auth (SO) + WP2 rules/proposer (Sonnet) + WP1 lexicon (Opus, 2 vòng sau thẩm định đối kháng 🔁: 57 → 10 lỗi/107 câu). Gộp: pytest 1808 passed/29 deselected, ruff sạch; evidence/01–05.
- Q10: ngoài phạm vi giữ 403 + audit (8 test đã duyệt) nhưng không lộ `unchanged_status`; 404 chờ nhóm. Bẫy mới: heredoc bash biến `\b` thành backspace khi Python ghi file (đã ghi gotchas). Chưa commit/push — chờ người dùng gật.
- Vòng Agent (người dùng: "fix agent", chỉ giữ phần Agent, không giữ backend/UI): rules.py tách vị trí mở rộng + đèn sau khu vực + Q22 bóng đèn cháy; từ vựng an toàn vòng 3 + `_b01_ok`. pytest 1848 passed, ruff sạch; đối kháng 107 câu 50 → 7 lỗi; holdout 18/18; kho phản ánh thật 34 câu chỉ còn "ngoài phạm vi bị hỏi vị trí" (spec). Lỗi backend/UI của thẩm định E2E chuyển Châm Anh/Trí (roadmap). Chưa commit.
- Q16: tách phần backend (router/auth + 5 test) sang `planning/04_.../handoffs/H03_backend-api.patch` + ghi chú H03 (Châm Anh), H04 (Trí, UI), H05 (Trường, rules/spec). Phần Agent/engine còn lại: pytest 1843 passed, ruff sạch. Người dùng duyệt push phần Agent.
- PR #14 mở vào develop (commit 1516309, phần Agent + engine; backend ở H03).

## Plan 05 — làm cứng Agent bằng kiểm thử biến thể — 2026-10-04
- Demo trên develop lộ 'Sảnh thang máy tầng 2 tòa SIM-C có khối rác' ⇒ khẩn cấp (confirmer khoi: toa khớp chữ 'tòa'); plan 04 chỉ sửa câu không tên tòa. Người dùng: 'sửa toàn diện phần agent'. Mở planning/05_2026-10-04_agent-hardening (nhánh fix/nhuy-agent-hardening từ develop 37a0fb3, đã gỡ upstream): WP1 an toàn + WP2 phân loại/vị trí bằng bộ biến thể vị trí, WP3 thẩm định độc lập câu có vị trí.
- Plan 05 vòng 1 gộp (WP1 an toàn 33→0 vi phạm biến thể; WP2 phân loại 1483→0; sửa job chết do plan 04 E5): pytest 2780 passed, ruff sạch. Thẩm định end-to-end 🔁: vị trí chèn giữa câu làm sót Bậc 1, S-03 lộ/lòi dây, 'day tran' không dấu, tách vị trí lấy tầng đầu tiên, B-01 'cứ/gần căn'. Mở H03 (an toàn vòng 2), H04 (phân loại vòng 2); SO làm engine (Q05 ngoài phạm vi không hỏi vị trí, vị trí bổ sung ưu tiên, chuẩn hoá vị trí BPTN).
- Plan 05 vòng 2 gộp (H03 an toàn: biến thể giữa câu 216→0, p3 45/45; H04 phân loại: 2117→0) + engine Q05 thu hẹp (Q09) + vị trí bổ sung mới nhất + chuẩn hoá vị trí BPTN. pytest 2941 passed; script thẩm định chạy lại 77 câu 16→7, phần còn lại P1/spec. Người dùng: push rồi làm P1 (luồng trùng §8, tách ticket hai việc).
- Bản vá 05b (v1.1.5): người dùng 'đèn cháy/đèn chập không phải khẩn cấp, là đèn hỏng'. Sửa B-01 + chấp nhận 'den' không dấu khi cả câu không dấu + triệu chứng 'chập', 'bị cháy' trong rules. pytest 2941 passed; ca mới đỏ 12 trên code cũ. Kiến trúc sư P1 dừng vì hết hạn mức phiên (5 file SPEC dở ở planning/06, chưa commit).
