Vai: worker (vai-thi-cong) · thi công · Claude Sonnet 5.5 · Bước 0: exit 0 · hiểu việc: phạm vi = thay lớp dữ liệu/phiên/ảnh/đăng nhập của portal/ bằng backend /api/v1, chỉ ghi trong portal/ (không src/db, drizzle, commit); xong khi = test/typecheck/lint EXIT=0, grep=0, smoke với 8001; cấm = ngoài portal/, commit/push, ghi Supabase
Handoff: handoffs/H02_thi-cong_WP2.md
Base: da20de9626fec59fd8732b404204f8b91c6f9118
Head: da20de9626fec59fd8732b404204f8b91c6f9118; working tree chưa commit

## Lệnh + exit (evidence/WP2/)
| Lệnh | Nơi đo | Exit | File |
|---|---|---|---|
| vitest (red trước khi viết code) | worktree | 1 | red-before.txt |
| npm run test: 6 file, 57 test, 0 fail, 0 skip | BẢN SAO KIỂM | 0 | unit.txt |
| npm run typecheck | BẢN SAO KIỂM | 0 | typecheck.txt |
| npm run lint | BẢN SAO KIỂM | 0 | lint.txt |
| next build (12 trang, route ảnh + session/expired) | BẢN SAO KIỂM | 0 | build-mirror.txt |
| rg gate | bản sao kiểm: 1 dòng (portal/src/db/seed.ts:8) | — | grep.txt |
| smoke thật 8001 (6 test): reception all=13 inbox=3; resident 13; BQL 13; vệ sinh 4; kỹ thuật 4; kho inventory=5; quanly vào warehouse inventory=5 | worktree | 0 | smoke.txt |
| tsc tại worktree (file cũ chưa xoá) | worktree | 20 lỗi, chỉ ở file cũ + route [id] | typecheck-inplace.txt |
Worktree: `npm run test` = 7 file/60 test pass (gồm duplicates.test cũ). Ctrl-char = 0 trên file text đã sửa.

## BỊ CHẶN: xoá file
Sandbox từ chối `rm` file cũ (Irreversible Local Destruction), nên các file sau CÒN trong worktree, người cần xoá: portal/src/server/queries.ts, portal/src/server/workflow.ts, portal/src/lib/duplicates.ts, portal/tests/unit/duplicates.test.ts, portal/src/app/api/photos/[id]/ (trùng slug với [ticketId], làm next dev lỗi), portal/tests/db/queries.test.ts, portal/tests/db/workflow.test.ts. Số đo "sau xoá" lấy trên bản sao ở scratchpad (đã bỏ các file đó).
Lệnh: `git rm -r portal/src/server/queries.ts portal/src/server/workflow.ts portal/src/lib/duplicates.ts portal/tests/unit/duplicates.test.ts "portal/src/app/api/photos/[id]" portal/tests/db/queries.test.ts portal/tests/db/workflow.test.ts`

## Export mới (chữ ký)
- server/backend.ts: api<T>(path, {method?,json?,form?,token?,query?}), apiRaw(path, token), re-export BackendError/BackendUnavailable/errorFrom
- server/backend-error.ts: errorFrom(status, body): BackendError; detailText(body)
- server/session-token.ts: signSession(payload, secret), verifySession(value, secret, now?)
- server/session.ts: createSession(login), getSessionUser(), getToken(), requireUser(roles?), destroySession(), clearSessionCookie(), userFromLogin
- server/act.ts: act(fn(user)), str, id, num; server/uploads.ts: filesOf, photoForm
- lib/backend-map.ts: mapStatus, lastKnownStage, isUrgent, isBqlWork, deptKey, parseDescription, titleOf, blockerLabel, REASON_CODES(16), failingLabels, roleFromMe, BPTN_REASON_CODES
- server/data/{resident,reception,departments,management,warehouse}.ts: residentData/receptionData/deptData/managementData/warehouseData(user); build.ts (builder thuần), safe.ts
- actions: login, logout; submitTicketAction, addExtraAction, rateTicketAction; routeTicketAction, resolveAssetAction, confirmReviewAction, duplicateAction, safetyAction, setPriorityAction; acceptAction, returnAction, reportWrongDeptAction, requestMaterialsAction, finishTicketAction; approveInspectionAction, rejectInspectionAction, bqlDecideWrongDeptAction, finishBqlTicketAction, returnBqlTicketAction, emergencyCloseAction, emergencyDowngradeAction, cancelTicketAction; receiveStockAction, addStockItemAction; ticketDetailAction
- route /api/photos/[ticketId]/[evidenceId], /api/session/expired

## File UI sửa (tối thiểu để biên dịch; thực tế phải bỏ tính năng đã hết)
components/{board,photo-strip,rating-summary,ticket-detail-modal}.tsx, components/backend-down.tsx (mới); app/{cleaning,technical,warehouse}/*-app.tsx sửa; app/{reception,management}/*-app.tsx VIẾT LẠI gọn; app/resident/resident-app.tsx bỏ Agent/thông báo/xác nhận/hủy/tag; các page.tsx. WP3-5 làm lại giao diện.

## Quyết định của worker
1. Vai management dùng /warehouse đầy đủ (theo tin bổ sung): action kho không giới hạn vai ở portal, gate trang ["warehouse","management"], loader chạy được bằng token BQL (đo smoke). Backend hiện (engine.py:1728) `receive_stock` chỉ cho WAREHOUSE ⇒ WP1 phải mở cho BQL.
2. Hai trang tạm: cư dân thêm `rated` (BackendResidentView không trả điểm); `rating` luôn null; MgmtTicket.ratingStars=null (BqlTicketRow không có rating), thêm `merged`.
3. 401 khi render ⇒ /api/session/expired xoá cookie rồi /login (tránh vòng lặp).
4. Form hoàn thành tạm: gửi mọi checklist chưa xong khi các ô xác nhận được tích; KHÔNG gửi vật tư đã dùng (WP4 làm thật).
5. catalog DeptData lấy từ /mo/warehouse/stock; nút "+" chỉ hiện khi catalog.custom_materials_enabled===true.
6. Thêm tests/unit/build.test.ts, tests/smoke (project vitest "smoke", ngoài npm test).
7. tests/db và src/db giữ; test:db hết dùng được (workflow bị xoá).

## Phân công
| Gói | Tầng yêu cầu | Đã dùng |
| WP2 | 🟠 | Claude Sonnet 5.5, không giao con |

## Việc KHÔNG làm + lý do
- Xoá file cũ (bị chặn, xem trên). 
- rg gate = 0: không đạt, còn portal/src/db/seed.ts:8 import lib/agent; src/db cấm sửa, nên lib/agent.ts + agent.test.ts giữ. 
- .env.example (BACKEND_URL, SESSION_SECRET) và docs/portal.md: ngoài danh sách file.
- Chưa chạy next dev/UI thật (trùng slug [id]).

## Câu hỏi mở
1. Cho phép sửa src/db/seed.ts (hoặc nới grep) để gate = 0? 2. Backend cần trả rating trong BqlTicketRow/ResidentTicketView? 3. WP1: mở receive_stock/stock cho BQL.

⏳ Chờ người duyệt.
