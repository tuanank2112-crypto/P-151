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
- G6 đọc ✅: cổng 8000 chạy trên Supabase thật (67 ticket, schema 0002), cờ 0003/0004 tắt. Mật khẩu DB đúng nằm trong `D:\P151\.env` (gitignored). Gotcha psycopg2 + pooler bỏ qua read-only.
- Tab Hiệu suất Agent: số lần đúng/sai đặt cạnh % trong ô "Agent gợi ý đúng" (yêu cầu người dùng); trên Supabase hiện 1 ticket có quyết định Agent để chấm.
- Đồng bộ não (nao-dong-bo): docs/portal.md, index, roadmap, changelog, state.json, kernel theo G6 Supabase + ô Agent đúng/sai + PR #20.
- 2026-10-11 Người dùng: bỏ gán từng nhân viên ở portal. Phòng vệ sinh/kỹ thuật chỉ "Nhận việc" cả phòng; bỏ nút Phân công/Đổi người, tab "Phân công tổ", dòng "Người xử lý/Nhân viên phụ trách", không gọi `/mo/staff`. Backend `/assign`, `/mo/staff` GIỮ (không đổi contract). typecheck/lint 0, vitest 123 passed. Chia Điện/Nước chưa làm: backend chỉ có playbook đèn PB-TEC-01, cần chốt nguồn nhãn (Agent/danh mục, không khớp từ khoá).
- 2026-10-11 Chụp toàn bộ UI sau khi bỏ phân công: backend memory :8003 + portal production :3003 (không đụng Supabase). WP3 54/54, WP4 14/14, WP5 72/72, exit 0; 78 ảnh (kể cả login) ở `planning/11_…/evidence/drop-assign-20261011/`. `ui-check-WP4.mts` thêm `--api` (trước ghi cứng :8000 ⇒ "fetch failed" khi chạy cổng khác).
- 2026-10-11 Gom 40 màn (78 ảnh) vào `docs/screenshots/<0-login…6-warehouse>/NN-<man>-desktop|mobile.png` + `README.md` xem toàn bộ; nguồn là ảnh máy chụp ở evidence drop-assign-20261011 (không sửa tay).
- 2026-10-11 Portal mới bỏ khối "Tài khoản demo nghiệm thu (123456)" ở login (áp đúng diff `0f8e4dc` của nhánh agent). Build lại 08:38, chụp lại toàn bộ: WP3 54/54, WP4 14/14, WP5 72/72; 78 ảnh trong `docs/screenshots/` đều mới hơn build. Gotcha: TaskStop chỉ dừng vỏ bash, `next start` con vẫn giữ cổng ⇒ phải Stop-Process theo PID trước khi build/khởi động lại.
- 2026-10-11 Video demo portal mới: `docs/demo/demo.mp4` (3:29, 1440×900) + `demo.srt` + kịch bản `demo-script.md`; công cụ `portal/scripts/demo-video/` (`narration.json` → `tts.ps1` giọng Microsoft An offline → `record.mts` Playwright quay + ffmpeg ghép). Kokoro af_bella thử và loại: không có tiếng Việt. Gotcha: hàm TS truyền vào `addInitScript`/`evaluate` qua tsx bị chèn `__name` ⇒ dùng chuỗi JS thuần; `.ps1` có tiếng Việt phải có BOM (PS 5.1 đọc ANSI); `alimiter` mặc định `level` tự kéo lên 0 dB.

## Phiên 2026-10-10 08:55:11 +0700 — Q35: khớp chuỗi trích dẫn = word-by-word
- Người dùng nhắc lại "không word by word": WP14 F3 (`validate.grounded` chặn vị trí LLM theo chuỗi con, `mirror_decision` quote giả) và P09 B1/B2 (span, đủ 3 thành phần) là khớp chữ trá hình. Lỗi quy trình: SPEC Q28 có trước Q29, không ai rà lại; agent tóm tắt phiên còn báo "✅ DUYỆT" mà không đối chiếu kernel dòng 21.
- Đã ghi não: kernel dòng 21 + dòng plan 06, gotchas (mục ⚠ mới), roadmap Active, plan 06 Q35. Code CHƯA sửa — chờ người duyệt hướng "LLM quyết vị trí, code kiểm catalog, quote chỉ audit".
- Bài học khởi động: ĐỌC kernel + index (Bước 1–2) trước khi tóm tắt/đánh giá, không chỉ chạy Bước 0.
- 09:xx Đóng gói WP18 (🔴 SPEC-P10, architect chạy Opus — không Fable) / WP19 (🟠 runtime) trong plan 06; handoff H17. Push tạm `feature/nhuy-reasoning-agent`. Frontend mới (portal gọi backend v1.7.0, PR #20 `feature/nhuy-portal-fe`; mobile PWA v1.9.4 `feature/chamanh`) CHƯA vào develop/nhánh này.
- WP18 xong (architect Opus): SPEC-P10 PROPOSED, H18 chờ duyệt, R17; kiểm kê 28 chỗ = 9 cổng chặn LLM/6 lưới sàn/13 audit. SO đo lại: REF selftest 0, banner P01/P08/P09 chỉ thêm dòng. Chờ người: Q-P10-1..5.
- WP19 (Sonnet) xong 2 vòng: vòng 1 R19 (Opus cô lập) 🔁 vì test không bắt cổng "không chung từ"; vòng 2 thêm T-P10-09/10/11 + khẳng định chính xác invented-place. SO đo lại đột biến X1b/X2b/X6/X9 đều đỏ. Worker: 3685 passed. SO sửa SPEC-P10 §9.1/§9.3 (m8/m9). Người dùng dừng giữa lúc SO chạy lại pytest toàn bộ ⇒ cập nhật não; code CHƯA commit.
- 11:20 SO đo lại toàn bộ: 3685 passed/0 fail/0 skip, ruff+format sạch ⇒ WP19 ✅ DUYỆT local; commit + push nhánh (PR #19 vào develop tự cập nhật, KHÔNG merge thẳng develop).

## Phiên 2026-10-10 18:03:31 +0700 — Q36: F8 "hai nơi" không gác Agent
- Bước 0 exit 0. HEAD = origin `8cf52d4` (WP19 đã push). Docker tắt ⇒ `--pg` NOT_RUN.
- Người dùng nhắc "đừng có word by word" ⇒ rà H14/WP15 trước khi giao: SPEC-P08 §6 F8 dùng `rules.location_mentions` (đếm từ) gác CẢ đường Agent = cổng từ khoá chặn LLM (Q-P10-3). Đo `break6_wrong_split.py`: luật/Mirror đã không tách 3/3 câu hai nơi (`split_verdict` two-places); chỉ client "reckless" tách.
- Chốt Q36 (plan 06): bỏ vế Agent; P08 §6 banner, P10 §7 Q-P10-3 chốt; H14 viết lại (F8 = test ghim hai chiều + đột biến b1/b2, venv `.venv`, Docker tắt). Giao WP15 cho worker 🟠 chạy nền.
- 18:15 WP15 xong (worker 🟠): SO đo lại 3704 passed/0 fail/0 skip, ruff check sạch; format chỉ lệch `src/main.py` có sẵn từ HEAD (ngoài phạm vi). R14 ✅ DUYỆT local; `--pg` ⬜. Chưa commit — chờ người gật.
- 19:41 Người dùng: "đừng cho data đăng nhập hiển thị trên frontend" (KHÔNG xoá data mock). Bỏ ô đổi vai trò + `autologin` (`src/web`) và khối tài khoản demo portal login. `node --check` 0; portal typecheck/lint/test 0 (17 passed); pytest web/auth 51 passed. Chưa commit; `feature/nhuy-portal-fe` (PR #20) có cùng file login, chưa áp.
- 2026-10-11 Gộp `feature/nhuy-reasoning-agent` (6 commit 10/10: Q35 SPEC-P10/WP19, WP15, ẩn tài khoản `src/web`) vào nhánh portal rồi đẩy `develop` (người dùng gật). Code gộp sạch, 5 file não gộp hai phía. pytest 3822 passed/95 deselected (pg), ruff check 0 (format chỉ lệch `src/main.py` có sẵn trên develop), portal typecheck/lint 0, vitest 123; sửa `prefer-const` ở `record.mts`.
