Bạn là worker THI CÔNG của repo D:\P151 (được ghi trong phạm vi dưới).
Bước 0: từ root chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi mã thoát vào report.
Thứ tự đọc: brain4agent/memory-distill.txt → docs/portal.md → docs/mobile.md → planning/24_2026-10-14_material-requests/plan.md → specs/00-ARCHITECTURE.md → 01-CONTRACTS.md (§2 model, §3 API, §4 lỗi) → SPEC-P03-UI.md → reports/R01_engine-api.md (contract thực tế của backend).

## 1. Bối cảnh
Backend (gói M1, đã xong) có: `POST /api/v1/mo/tickets/{id}/material-shortage`, `GET /api/v1/mo/warehouse/requests`, `GET /api/v1/mo/stock-alerts?unread=&department=` (mỗi alert có `tickets: [{ticket_id, waiting}]`), `POST /api/v1/mo/stock-alerts/{id}/ack` cho cả hai phòng ban. Gói này = M2: portal Next.js + app điện thoại PWA dùng các route đó theo SPEC-P03.

## 2. Phạm vi
- ĐƯỢC sửa: `portal/src/**` (warehouse, technical, cleaning, actions, server/data, lib), `portal/tests/unit/**`, `src/mobile/js/{api,dept,kho}.js`, `src/mobile/index.html`/`sw.js` chỉ để tăng `?v=`/`SHELL_CACHE`, `src/mobile/app.css` nếu cần.
- CẤM chạm: `src/maintenance/`, `src/api/`, `tests/` Python (trừ `tests/test_maintenance/test_mobile_static.py` nếu nó ghim số `?v=`), `brain4agent/`, `planning/` (trừ report + evidence của gói), `.env`.
- Thay đổi chưa commit của hồ sơ 23/24 trong working tree: GIỮ NGUYÊN.

## 3. Việc phải làm
SPEC-P03 §1 (portal: khối "Phiếu vật tư cần nhập" ở Kho; "Báo thiếu vật tư" + chuông "Thông báo kho" cho Kỹ thuật VÀ Vệ sinh) và §2 (mobile dept.js/kho.js/api.js). Hàm dựng dữ liệu thuần (map response → DTO) phải có unit test vitest.
Xong khi (lệnh + kết quả máy đọc được), chạy trong `portal/`:
- `npm run -s typecheck` exit 0; `npx eslint <file đã sửa>` exit 0; `npm run -s test` exit 0 (nền: 145 passed, không giảm).
- Root: `node --check src/mobile/js/<mỗi file>.js` exit 0; `D:\P151\.venv\Scripts\python.exe -m pytest tests/test_maintenance/test_mobile_static.py -q -p no:cacheprovider` exit 0.
- Chạy thật: backend memory `D:\P151\.venv\Scripts\python.exe -m uvicorn src.main:app --port 8011` với env `MO_STORE=memory LLM_MODE=mock` + portal dev/build trỏ backend đó (xem docs/portal.md), dùng Playwright (đã có trong portal) chụp: (1) Kỹ thuật báo thiếu, (2) Kho thấy phiếu `PVT-…`, (3) Kho bấm "Nhập đủ", (4) Kỹ thuật thấy chuông "Kho đã nhập…" + ticket "Đã chạy tiếp". Ảnh + log vào `planning/24_2026-10-14_material-requests/evidence/M2/`. KHÔNG trỏ Supabase. Tắt tiến trình theo PID khi xong.

## 4. Luật
- Không hiện tên đăng nhập/mật khẩu trên UI. Không nút duyệt, không "Thêm vật tư mới" (vùng cấm SPEC-P03 §3).
- Lỗi API hiện lời nguyên văn (01 §4). Text UI tiếng Việt; code/tên tiếng Anh.
- Spec-first: thiếu contract ⇒ dừng, ghi câu hỏi. Không commit, không push.

## 5. Tầng
M2 = 🟠. Không phóng subagent.

## 6. Mẫu report (`planning/24_2026-10-14_material-requests/reports/R02_portal-mobile.md`, chỉ số đo)
Dòng 1: `Vai · thi công · họ/model · Bước 0 exit=<n> · hiểu việc: <phạm vi / xong khi / cấm>`
Dòng 2–4: `Handoff: H02_portal-mobile.md` · `Base: <sha>` · `Head: working tree (chưa commit)`
- Lệnh + exit code nguyên văn; vitest tổng/pass/fail.
- `git diff --stat` trong phạm vi; danh sách ảnh evidence.
- Bảng phân công: gói → tầng → họ/model.
- Việc KHÔNG làm + lý do; câu hỏi cần người.
