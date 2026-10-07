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
## 🎨 Phiên 2026-10-07 — Màn đăng nhập theo mockup (dev)
- Dựng lại `showLogin` theo ảnh mẫu người dùng (gradient cam, thẻ trắng, nút cam bo tròn, "Hiện/Ẩn" trong ô mật khẩu); "[TÊN KHU ĐÔ THỊ]" điền `Khu đô thị Ocean Park` (catalog). Demo accounts gập trong `<details>`.
- Đo: `node --check` OK; `test_api.py` 26 passed; chụp Chrome headless 1000px + 520px khớp mockup (390px bị Chrome headless Windows cắt — giới hạn công cụ, layout co giãn đúng ở 520px).
- Bỏ khối "Tài khoản thử nghiệm (demo)" khỏi màn đăng nhập (xoá `demoAccountList`). `test_api`+`test_auth` 39 passed; ảnh chụp xác nhận. Câu hỏi xoá hẳn `qa01` còn treo (cách 1/2).
- Lỗi 500 màn cư dân: 16/53 doc Supabase có `ticket.merged_children` (bản code PR #11 ghi 05/10) ⇒ `extra="forbid"` vỡ `list()`. Thêm field theo CR-03 §8 + test hồi quy (đỏ trước sửa). pytest 2972 passed / 1 failed (`test_partial_delivery_updates_the_stock_the_waiting_ticket_shows` đỏ sẵn, không do sửa này); ruff sạch; DB 53/53 doc hợp lệ. Server :8000 của người dùng cần khởi động lại.

## 🏗️ Phiên 2026-10-07 — Plan 06: Cổng phản ánh cư dân `portal/` (Next.js, v1.2.0)
- Yêu cầu: dựng web Next.js + TS + Tailwind + PostgreSQL theo `design-ticket-cu-dan/…/HANDOFF.md` + 6 file `.dc.html`, thứ tự dữ liệu → auth → Cư dân → Tiếp nhận → phòng ban → BQL, mỗi màn so lại thiết kế.
- Bước 0 `init_brain.js --check` exit 0. Bộ SPEC `planning/06_2026-10-07_resident-portal-next/` (00/01/P01/P02/OPERATIONS/TESTING). Docker Desktop bật lại; DB `portal` + `portal_test` tạo trong `p151-db-1`.
- Quyết định: app độc lập backend Python; Drizzle (không Prisma); session tự viết; giữ `cacheComponents`; một mô hình stage 1..6; 9 lệch thiết kế D1–D9.
- Lỗi bắt được khi nghiệm thu: Agent khớp chuỗi con ("ồn"/"cộng đồng") → so khớp nguyên từ; ảnh cache `max-age` lộ cho người đăng nhập sau → `no-store`; ô Gộp tràn ngang 390px.
- Đo: typecheck/lint exit 0; unit 14/14; DB 15/15 (2 phép phá cố ý đều đỏ); `next build` exit 0; E2E trên production PASS; 38 ảnh đối chiếu, 0 tràn ngang. Evidence: `planning/06_…/evidence/`.
- Chưa commit (chờ người dùng). Cột server của gate còn ⬜.

## 🎨 Phiên 2026-10-07 — Plan 07: UI `src/web/` theo design `portal/` (v1.3.0)
- Yêu cầu: "Chuyển Ui theo design của foder portal sang UI của P151". Bước 0 exit 0. Hồ sơ `planning/07_2026-10-07_web-portal-reskin/` (plan + 5 SPEC).
- Cách làm: reskin 3 lớp — remap palette trong `tailwind.config`, `src/web/theme.css` chép class portal, viết lại header/đăng nhập/helper. Không đổi API/logic. Tắt dark mode; không thêm chuông/tile.
- Màn đăng nhập cam (sáng cùng ngày) bị thay bằng bản xanh portal — ghi ở "Quyết định bị thay thế".
- Đo trên backend local `:8001` memory (KHÔNG trên Supabase chung): 22 ảnh 1440/390, 0 tràn ngang; thao tác thật kythuat01/cudan01/bptn01 0 lỗi JS. pytest 2972 passed, ruff sạch.
- Chưa: container `backend` `:8000` vẫn chạy image cũ (cần `docker compose up -d --build backend`); chưa commit.

