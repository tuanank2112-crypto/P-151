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
## 🛠 Phiên 2026-10-05 — Sửa luồng UI/engine theo phản hồi demo (develop)
- Nút Nghiệm thu BQL bấm một lần (`oneShotButton`, `act()` trả bool).
- Thí điểm Ocean Park: `catalog.yaml` `site.buildings: [S1, S2]`; tòa khác ⇒ thiếu `location_building`; giữ tòa con `S1.12`; "Sảnh cư dân" mặc định Tầng 1. Seed/test `SIM-A`→`S1`, `SIM-B`→`S2` (giữ bộ nhãn an toàn).
- Ticket "tiếng nổ" thiếu khu vực: Q08 (an toàn trước dữ liệu) ⇒ cư dân chưa được hỏi. Giữ Q08; `internal_note` blocker an toàn kèm `· Thiếu: …`, UI BPTN cảnh báo + điền sẵn REQUEST_INFO.
- Vật tư kiểm tại hiện trường: `confirm_materials` + `POST /mo/tickets/{id}/material-plan` + khung UI phòng ban. Không thêm gate nghiệm thu, không chặn theo tồn kho.
- Đo: pytest 1649 pass (29 deselected), ruff check/format sạch, `node --check app.js` OK. CHƯA: bấm thử UI trên trình duyệt, `pytest --pg`, reset DB online (dữ liệu SIM-A cũ còn trên Supabase).
- Mở cho nhóm: đổi Q08 để hỏi cư dân song song? bắt buộc xác nhận vật tư trước nghiệm thu?

## Plan 06 — Agent suy luận làm trung tâm điều phối + P1 — 2026-10-05
- Người dùng: Agent phải suy luận, không bắt từ khoá; AI toàn quyền điều phối; AI KHÔNG tự hạ mức (khẩn cấp ⇒ BQL, chỉ BQL hạ); dùng DeepSeek (khoá đã ghi .env, thiếu base URL/model). Architect viết SPEC planning/06_2026-10-05_reasoning-agent (00/01/P01–P07/OPERATIONS/TESTING, 3 REF chạy được); người dùng duyệt với mặc định Q09 LangGraph, Q11 S-00, Q18 không giữ, Q19=3. Bắt đầu thi công Wave 0–4.
- Thi công plan 06 (SO orchestrator, 2026-10-05 21:09): handoff H00 (WP0), H01 (WP1), H02 (WP2) + Q20 (WP1 tạo hợp đồng Agent thuần agent/schema.py + agent/inputs.py); phóng Wave 0–1 song song trong worktree.
- Ghi Q20 vào plan.md (commit trước thiếu dòng do Edit hụt).
- Q21: Bước 0 trong worktree ra BRN-002 do CRLF (root exit 0) ⇒ worker ghi exit, đi tiếp; thêm handoff H03 (WP4).
- Viết sẵn handoff H04 (WP3), H05 (WP5), H06 (WP6), H07–H10 (WP7–WP10), H11 (WP11 phần không khoá); container Postgres tạm p151-pgtest (127.0.0.1:55433) cho cổng --pg, mỗi worker một DB riêng.
- DỪNG GIỮA CHỪNG 21:17 (SO bị buộc nộp report): CHƯA WP nào gộp/commit. Đang chạy nền trong worktree: WP0 lần 2 (.claude/worktrees/agent-a308b53f50055d95a), WP1 (agent-ab1fd4bc145dfa1ca), WP2 (agent-a3198662536f091e1, opus), WP4 (agent-a316ebd4bc3288a2d). Worktree agent-a99ca0507891d2397 = WP0 lần 1 bỏ (lệnh chạy script converter bị hệ thống quyền từ chối). Container p151-pgtest đang chạy (127.0.0.1:55433) — xoá khi xong. Tiếp: đo lại + gộp WP0/WP1/WP2/WP4 theo patch git diff --cached, rồi phóng H04 (WP3), H05 (WP5), H06, H07–H11.
- Plan 06 WP4 gộp (cấu hình Agent + revision 0002_p1_doc_shape): SO đo lại 2975 passed, --pg 34 passed, ruff sạch. WP0 bị hệ thống quyền chặn (chờ người dùng); WP1, WP2 đang chạy.
- Plan 06 WP0 bước a gộp (case_pre_p1.json, round-trip 3/3; giống hệt bản WP1 tự sinh). Bước b (chuyển bộ eval) bị hệ thống quyền chặn, chờ người dùng.
- Plan 06 WP1 gộp (hợp đồng: enum/model/catalog/TRANSITIONS 23+7/view/i18n + agent/schema.py, inputs.py): SO đo 2999 passed, --pg 3030 passed.
- Plan 06 WP2 báo cáo: C6/C7 đỏ do mâu thuẫn SPEC (S-08 phải bắt 'nước tràn vào tủ điện'). SO quyết Q22: sửa SPEC-P03 C6 + REF gate_corpus chấp nhận S-08; duyệt dòng version + 17→18.
- Plan 06 WP5 (hạ tầng engine: giao dịch nhiều ticket, mixin coordination/, hook) gộp: SO đo lại 3016 pass, --pg 3064 pass, ruff sạch. Q23 chốt câu hỏi mở R05.
- Plan 06 WP3 (gói agent suy luận: agent/graph/client/prompt/validate/reconcile/baseline + bằng chứng luật) gộp: 3096 pass, --pg 3144. SO phát hiện lỗi B-01: "thay bóng đèn đã cháy" ra UNCLEAR (Q24) → giao WP2.
- Sửa test phụ thuộc giờ test_partial_delivery_… (fixture engine dùng đồng hồ thật, đỏ sau 22:00): cố định Clock(MONDAY_9AM); ghi gotcha.
- Plan 06 WP2 (lớp an toàn P1, lexicon p1d: S-00, S-08 nước vào thiết bị điện, sửa B-01 "thay bóng đèn đã cháy") gộp: 3226 pass, --pg 3274, meter 0. Q25 ghi cho WP12.
- Plan 06 WP6 (tích hợp Agent vào engine: agent=, build_engine, tính ngoài khoá, vân tay, áp từng bước, run_jobs hai pha) gộp: 3248 pass, --pg 3296. Q26.
