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
