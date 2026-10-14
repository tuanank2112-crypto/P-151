Worker · thi công · Claude Sonnet 5.5 · Bước 0 exit=0 · hiểu việc: phạm vi = portal/src (warehouse, technical, cleaning, actions, server/data, lib) + portal/tests/unit + src/mobile/js/{api,dept,kho}.js (+ ?v=/SHELL_CACHE); xong khi = typecheck/eslint/vitest exit 0 (>=145), node --check + test_mobile_static exit 0, chạy thật 4 ảnh trên backend memory; cấm = nút duyệt, "Thêm vật tư mới", chạm src/maintenance|src/api|brain4agent|.env, commit/push, Supabase
Handoff: H02_portal-mobile.md
Base: fc434d6
Head: working tree (chưa commit)

## Lệnh + exit code (chạy lại cuối phiên, exit lấy trực tiếp)
- `init_brain.js --check` exit 0 (chỉ cảnh báo BRN-028 today.md 691 dòng, không thuộc gói).
- portal/: `npm run -s typecheck` exit 0 · `npx eslint <13 file đã sửa/tạo>` exit 0 · `npm run -s test` exit 0: Test Files 11 passed, Tests 159 passed / 0 failed / 0 skipped (nền 145; +14 test mới: material-requests.test.ts mới 10 + stock-alerts.test.ts viết lại 4 thay 2).
- Root: `node --check` mọi `src/mobile/js/*.js` + `sw.js` exit 0; `pytest tests/test_maintenance/test_mobile_static.py` exit 0 (5 passed). Không cần sửa test (không ghim số ?v=).
- `grep -cP '[\x08\x0c\x0b]'` trên mọi file đã sửa = 0.
- Chạy thật: backend `MO_STORE=memory LLM_MODE=mock` cổng 8011 + `next dev` cổng 3011 (BACKEND_URL=8011; mở bằng `localhost`, không dùng `127.0.0.1` vì dev chặn HMR ⇒ không hydrate), Playwright `evidence/M2/m2-flow.mts` ⇒ exit 0, 15/15 PASS (`m2-flow.log`). Đã tắt cả hai tiến trình theo PID (cổng 3011/8011 hết nghe). Không trỏ Supabase.

## Ảnh evidence (planning/24_2026-10-14_material-requests/evidence/M2/)
1a-technical-refusal.png (409 "Kho đủ vật tư, không cần báo thiếu" hiện nguyên văn, form giữ) · 1b-technical-shortage-form.png · 1c-technical-waiting.png ("Chờ kho nhập vật tư") · 2-warehouse-request.png (PVT-SIM-TKT-0001) · 3a-warehouse-import-prefilled.png ("Nhập đủ" điền sẵn mã + số thiếu 3) · 3b-warehouse-after-import.png (phiếu biến mất) · 4a-technical-bell.png ("Kho đã nhập Bóng đèn tuýp +3 Cái", "SIM-TKT-0001: Đã chạy tiếp") · 4b-technical-resumed.png (ticket "Đang xử lý", sau ack chuông hết thông báo) · m2-flow.log · mutation.txt · backend.log · portal.log.
Phép phá bộ đo mới (mutation.txt): nền 16 passed → 4 phép phá đều đỏ (đổi nhãn Đã chạy tiếp/Vẫn thiếu; chấp nhận số lượng 0; nhãn nguồn bỏ AGENT; bỏ nhãn "Chờ kho nhập vật tư") → khôi phục 16 passed. Script Playwright chưa phá ngược.

## git diff --stat (chỉ phần gói này; file ghi chú (23) chung dòng: dto.ts, build.test không đụng thêm)
Portal sửa: app/actions/departments.ts, app/cleaning/{cleaning-app,dept-parts}.tsx, app/technical/technical-app.tsx, app/warehouse/warehouse-app.tsx, lib/{dto,stock-alerts}.ts, server/data/{shared,warehouse,departments}.ts, tests/unit/stock-alerts.test.ts. Mới: lib/material-requests.ts, tests/unit/material-requests.test.ts. Mobile: `git diff --stat -- src/mobile` = 11 files, 209 insertions, 58 deletions (api.js +21, dept.js ~+134, kho.js ~44, còn lại chỉ đổi ?v=18→19).
Hồ sơ 23 trong working tree: không chạm hunk nào (build.ts, types.ts, build.test.ts, management*, backend-map.ts nguyên; dto.ts chỉ thêm import + đổi kiểu `requests` + 1 comment).

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
|---|---|---|
| M2 portal + mobile + test + chạy thật | 🟠 | Claude Sonnet 5.5 (tự làm, không phóng subagent) |

## Quyết định thực thi (người duyệt đổi được)
1. Mã lỗi guard thật `GUARD_FAILED` 409 (R01): UI không rẽ nhánh theo mã, hiện nguyên văn `detail.message`.
2. Chuông phòng ban: portal = số ticket cần chú ý + alert chưa xem (Kỹ thuật như cũ, Vệ sinh mới có); alert gộp chung danh sách chuông, bấm = ack. Mobile `#/d`: chuông chỉ đếm alert chưa xem (không còn đếm "Chờ nhận", tile vẫn đếm), bấm cuộn tới khối "Thông báo kho" + nút "Đã xem"; do main.js (ngoài phạm vi) cố định nhãn BELL nên nhãn aria được set lại từ dept.js.
3. Mobile kho: tab "Nhập vật tư" thay danh sách ticket bằng thẻ phiếu `PVT-…` (vẫn lọc ticket seed `-CLN-/-TEC-`); "Nhập đủ" điền sẵn form.
4. Tăng `?v=18→19` + `SHELL_CACHE v19` ở MỌI file vỏ (index.html, sw.js, và import trong bptn/bql/main/photo/resident/staff/dept/kho.js) vì specifier phải đồng nhất (docs/mobile.md §3); các file ngoài {api,dept,kho} chỉ đổi đúng chuỗi ?v=.
5. `buildWarehouseRequest` + `WarehouseRequest` cũ giữ nguyên (không còn dùng ở runtime) để không làm giảm số test / chạm file của hồ sơ 23; dọn ở bước sau nếu người duyệt muốn.
6. Giữ CRLF theo working tree.

## Việc KHÔNG làm + lý do
- Chưa chạy giao diện điện thoại (`src/mobile/`) trên trình duyệt thật: handoff chỉ đòi chụp portal; mobile mới kiểm cú pháp + test tĩnh. 
- Chưa phá ngược script Playwright.
- Chưa cập nhật docs/portal.md, docs/mobile.md, brain4agent, plan.md checklist (ngoài phạm vi, nằm ở bước đồng bộ cuối plan).
- Không commit/push.

## Câu hỏi cần người
- Có muốn dọn `buildWarehouseRequest` cũ (kèm 5 test của nó) ở bước đồng bộ cuối không?
- Bell mobile của phòng ban không còn đếm "Chờ nhận": chấp nhận không?

