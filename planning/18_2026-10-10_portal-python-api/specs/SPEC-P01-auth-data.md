# Đăng nhập và dữ liệu
## §D1. Owner/chữ ký
session.ts/getSessionUser():Promise<SessionUser|null>, requireUser(roles?):Promise<SessionUser>, destroySession():Promise<void> giữ cách gọi pages nhưng SessionUser.id thành ActorId. Login action giữ LoginState {error,username}, gọi Python theo C1, redirect ROLE_HOME theo C2.
queries.ts residentData/receptionData/deptData/managementData/warehouseData chỉ gọi API, không nhận Db mặc định. BACKEND_URL default http://backend:8000 Docker, local override http://127.0.0.1:8000. App runtime import graph không đi tới db/index, password, workflow hoặc classify.
Profile thiếu trong Me không tự suy apartment/home; form cư dân chọn vị trí theo catalog/tự nhập, không lấy nơi ở làm vị trí sự cố.

## §D2. Dữ liệu nhạy cảm
ResidentTicketView là nguồn cư dân, không render nội bộ/tên actor audit/blocker safety bị che. Nhân viên anonymous theo dữ liệu API có quyền, không dùng account mapping ở client.
Tất cả image src qua BFF/photo route hoặc fetch có auth; browser img không gắn được Bearer. GET route mới /api/backend-photos/{scope}/{ticketId}/{evidenceId} → Python đường đúng scope; req params encode đúng; session auth; không nhận URL tuỳ ý.
Response ảnh private,no-cache/ETag; 304 phải có quyền Python và chuyển conditional headers. Không override lỗi403/404 thành image dummy, không cache public.
Legacy /api/photos/[id] không đọc portalDB; ngừng sử dụng và trả410 có kiểm session, cấm route còn đọc DB.

## §D3. Lỗi/caller, BẮT BUỘC/CẤM
Python unavailable không login DB/không demo account fallback. HttpOnly token không localStorage. Không in password/APIkey/token lên evidence. 429 login hiện thời gian chờ nếu server có, không tự thử liên tục.
Nghiệm thu: Python-only user login thành công; token hết hạn/restart backend yêu cầu login; hai actor cùng browsercontexts không lẫn data; resident mở internal image bị403.
