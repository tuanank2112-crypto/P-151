# Hợp đồng
## §C1. API client server-only
`backendFetch<T>(path: string, init?: RequestInit): Promise<T>` chỉ nhận path bắt đầu /api/v1/; origin BACKEND_URL do server cấu hình, không từ browser/body. Auth qua cookie HttpOnly python_portal_session → Authorization Bearer; cache no-store cho dữ liệu/quyền/ảnh. Cấm X-Actor-Id/header QA, forward client Authorization, trả token vào DTO/log/client props.
`BackendError {status:number; code?:string; message:string; detail?:unknown}`; giữ 422 detail có lọc input nhạy cảm. JSON204 trả void; không ép mọi success200.
Login gọi POST /api/v1/auth/login {username,password}, lưu access_token bằng cookie TTL=expires_in (Python hiện8giờ); get user gọi GET /api/v1/auth/me mỗi request/action; logout POST auth/logout rồi xoá cookie kể cả 401.
SameSite=Lax, HttpOnly, Path=/, secure theo SESSION_COOKIE_SECURE/HTTPS; mọi ghi browser qua same-origin Server Action với Origin check Next, không GET mutation.

## §C2. Identity/types
TicketId=string, EvidenceId=string, ActorId=string, MaterialCode=string. Không Number(id), ID số/hash/mapDB. PhotoRef={ticketId:string,evidenceId:string,name:string,scope:'resident'|'internal'}.
Vai Python: RESIDENT→resident; BPTN→reception; BQL→management; WAREHOUSE→warehouse; DEPARTMENT+DEPT_CLEANING→cleaning; DEPARTMENT+DEPT_TECHNICAL→technical; QA_INTERNAL không dashboard portal, liên kết /ui theo quyền. Giá trị lạ từ chối, không mặc định BQL.
Status/backendStatus giữ enum nguyên bản. Bước hiển thị như app hiện có: RECEIVED1, NEED_INFO/VERIFYING/ON_HOLD2, ROUTED3, IN_PROGRESS4, READY_FOR_REVIEW5, CLOSED6. ON_HOLD giữ nhãn tạm dừng và public_message/blocker theo quyền; không suy trở về chưa nhận từ chỉ số bước. MERGED/CANCELLED là trạng thái riêng, không ép hoàn tất. Pause/escalation/safety lấy backend field, không suy từ ageH trên UI.
DTO giữ title/code/bố cục; id string thay number. Các field không có trong response dùng null/ẩn hợp lý; không invent rating/profile/staff/confidence.

## §C3. API đọc
Cư dân: GET resident/tickets và resident/tickets/{tid} (ResidentTicketView); không lấy Case nội bộ để bổ sung field bị che. Giữ status_label/public_message/allowed_actions do Python.
Nhân viên: GET mo/tickets (TicketSummary) → GET mo/tickets/{tid} cho case thực sự hiển thị; catalog /mo/catalog và stock /mo/warehouse/stock khi có quyền. BQL list /bql/tickets + chi tiết /mo/tickets/{tid}.
Cấm N+1 toàn bộ ticket mỗi render: list/card chỉ dùng summary; fetch detail on demand/modal, giữ pagination20. Không cache theo user khác hay public resource.
Không chạy classify() JS/rules DB. AI insight đọc Case.agent_decision/classification; thiếu decision hiện chưa có đánh giá, không dựng conf0 thành đã phân loại.

## §C4. Lỗi/caller + số đo
401 clear/login;403 báo denied không reveal Case;404 reload danh sách;409/422 giữ form;503/timeout không auto retryPOST. Đọc retry tối đa1 lần với lỗi mạng; mutation không retry ngầm. Partial tạo ticket+upload ảnh: trả ticket_id đã tạo và lỗi upload riêng, không tạo lại ticket.
Đo cookie TTL/flags, mọi vai/status/ID roundtrip, 401/403/404/409/422/503, không có token trong HTML/console. Cấm thay hợp đồng Python để ép DTO portal.
