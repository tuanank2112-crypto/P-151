# portal — Web Next.js dùng backend Python (plan 18, v1.11.0 local)

Python `/api/v1` là nguồn duy nhất cho đăng nhập, ticket, Agent, an toàn, vật tư và kho. Next.js giữ giao diện mới từ develop, Server Actions và BFF ảnh. `/`, `/app/` và `/ui/` dùng cùng ticket ID/trạng thái khi nối cùng backend. Code Python, contract API, safety/G-1/SPEC-P09 và `.env` không thay trong plan18.

Hồ sơ: [plan18](../planning/18_2026-10-10_portal-python-api/plan.md). Kiến trúc DB/workflow portal riêng của plan06/17 là lịch sử đã được thay thế cho runtime mới; DB cũ được giữ để rollback, không chuyển dữ liệu.

## Chạy local

Khởi động Python theo cấu hình hiện có, sau đó trong PowerShell:

```powershell
cd C:\P-151\portal
$env:BACKEND_URL = 'http://127.0.0.1:8000'
$env:SESSION_COOKIE_SECURE = 'false'
npm.cmd ci
npm.cmd run build
npm.cmd run start
```

Không cần DATABASE_URL hoặc chạy migrate/seed portal. Đăng nhập tài khoản Python; demo accounts/password chỉ hiện khi API Python cho phép, không tạo alias từ tài khoản portal cũ.

## Docker / rollout

```powershell
cd C:\P-151
docker compose up -d --build --force-recreate backend portal
docker compose ps
docker compose logs --tail 100 backend portal
Invoke-RestMethod http://localhost:8000/health
```

Backend proxy `/` sang portal3000; `/api/v1`, `/app/`, `/ui/` vẫn do Python phục vụ. Portal BACKEND_URL=http://backend:8000 và chỉ chạy next start; không migrate/seed hoặc phụ thuộc DB portal. Service db/pgdata giữ nguyên. Backend vẫn đọc `.env` và kho dữ liệu đã cấu hình, gồm Supabase nếu người dùng chọn. Rebuild này chưa được chạy trong môi trường agent; không suy image hiện tại đã cập nhật.

## Cấu trúc / hợp đồng

- `server/backend-client.ts`: server-only, cookie token → Bearer Python, no-store, timeout15s, không retry POST, loại header actor/auth/cookie do caller cung cấp.
- `server/session.ts`: cookie python_portal_session HttpOnly/SameSiteLax/Path=/, TTL theo Python; `/auth/me` kiểm phiên mỗi request/action; logout xoá cookie cả khi backend lỗi.
- `server/backend-dto.ts`, `queries.ts`: ID string, 6 vai Python → dashboard, list summary rồi detail on demand; cư dân chỉ ResidentTicketView, không nhận catalog vật tư/kho/Case nội bộ.
- `app/actions/backend.ts` + `lib/backend-actions.ts`: endpoint/body allowlist, kiểm vai, Python kiểm trạng thái/phạm vi. Không actor_id từ browser.
- `lib/case-view.ts`: projection Case trước gửi client; bỏ resident_id/audit/actor IDs/prompt. ResidentTicketView không bổ sung dữ liệu nội bộ.
- `components/python-dashboard.tsx`: shell/CSS/icon của UI mới, 6 dashboard, modal và form dùng Python; không classify JS.
- `/api/backend-photos/{scope}/{ticketId}/{evidenceId}`: BFF xác thực, private,no-cache/ETag; Python kiểm quyền trước304. Resident internal scope403. `/api/photos/{integer}` legacy410 sau kiểm phiên.
- `server/workflow.ts`, `legacy-queries.ts`, `db/`, Drizzle/scripts seed còn để rollback/test lịch sử, không reachable từ runtime. `act.ts` fail closed.

## Nghiệp vụ hiển thị

ROUTED là đã giao phòng ban, không chờ BPTN click. BPTN chỉ gỡ blocker thuộc vai của mình. Phòng ban nhận việc, checklist, nhập vật tư đã dùng, ảnh, ghi chú, báo hoàn thành. BQL nghiệm thu/làm lại/huỷ/khẩn cấp; safety BQL chỉ sau escalation ở VERIFYING, hoặc CONFIRM_SAFE/ESCALATE khi NEED_INFO+safety_context.

Vật tư: danh mục/lọc phòng ban từ server, không điền sẵn đề xuất Agent; một POST material-usage thay toàn bộ thực tế. Không yêu cầu lý do vì lệch định mức. Backend giữ guard plan16 và delta/rollback tồn kho. Qty nguyên dương, technical ≥1; cleaning có lựa chọn không dùng. Lỗi giữ draft và không tự reload30s. Complete200 nhưng IN_PROGRESS là chưa đạt, hiển thị failing_items.

Các controls không có API đã bỏ theo SPEC duyệt: gán nhân viên, pause SLA riêng, cư dân huỷ/nghiệm thu, tags/comment rating, vật tư tự do/catalog mới, keyword/notice DB. Không thay luồng Agent/safety bằng frontend. Trạng thái MERGED/CANCELLED riêng; ON_HOLD giữ nhãn tạm dừng.

401 → đăng nhập;404 → tải danh sách;403/409/422 giữ input; lỗi mạng/5xx của ghi không auto retry, yêu cầu kiểm tra trạng thái trước thử lại. Offline khoá nút ghi. Tài khoản Python hết phiên sau backend restart; restart portal không làm mất phiên còn hợp lệ.

## Kiểm tra

`npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` không DATABASE_URL. Test unit giữ bộ cũ và bổ sung auth/DTO/actions/ảnh/privacy/import graph/form policy. Tests DB legacy trỏ legacy-queries, không chứng minh workflow mới.

Python memory riêng8018, LLM_MODE=mock, MO_STORE=memory, MO_PHOTO_STORE=local, jobsfalse; portal production3018. Browser/evidence tại plan18; tuyệt đối không ghi test vào Supabase chung. Docker/điện thoại/boot hub là gate riêng, chưa coi viewport390 là điện thoại thật. H/R lưu từng gói và thẩm định độc lập.

Rollback: checkout snapshot UI/compose plan17 và rebuild portal; không xoá volumes/ticket Python. DB portal cũ không chứa ticket mới đã tạo qua Python; phải chọn giao diện/API phù hợp khi rollback.
