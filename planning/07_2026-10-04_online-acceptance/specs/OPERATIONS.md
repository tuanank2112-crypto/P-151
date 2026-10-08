# Vận hành nghiệm thu ngày 04

## 1. D4-01 — chuẩn bị/preflight (30–45 phút)

Offline làm ngay: đọc kết luận cuối Day03, chốt9 expected, danh sách role, bảng issue trống và giới hạn. Kiểm thử local bắt đầu sau khi xác nhận địa chỉ localhost/build/tài khoản SIM-/scope thao tác/ảnh và môi trường local QA. Không cần chờ deploy. Chưa xác nhận = BLOCKED, không tự đoán URL, lấy secrets, gọi reset/evaluate.

GET /health = HTTP200/status ok chỉ kiểm app sống. Đối chiếu cấu hình hiệu lực của tiến trình local: MO_STORE, MO_PHOTO_STORE, LLM_MODE/model. Repo mặc định memory/local/mock, nhưng không coi đó là cấu hình đang chạy. Mock thì ghi mock, không tuyên bố đã kiểm gpt-4o thật. Nếu không có QA đủ cô lập cho stock/guard/restart, giữ các ca đó BLOCKED.

## 2. Thứ tự và lịch dự kiến

Sau preflight: H01/H02 → I01/A01 → M01/U01 → S04 → G03 → R01 → D4-08. Safety ưu tiên sớm ngay sau happy path nếu nghi thiếu route hoặc lỗi an toàn; không đợi hết các ca ít rủi ro.

Tổng thời lượng đề xuất 5–7 giờ gồm chờ phối hợp/tái kiểm tra; đây là ước lượng, không log giờ thật. Từ lúc bản localhost sẵn sàng, chia phiên 30–90 phút theo SPEC-P01. Trước20:30 tổng hợp; 21:00 nhóm nghiệm thu; 21:00–23:59 chỉ sửa/đo lại lỗi chặn và khóa phiên bản do chủ việc. Nếu local chưa sẵn sàng, báo thiếu ca và BLOCKED thay vì rút bỏ guard để kịp giờ.

## 3. Contract R01 — restart local theo store thực tế

- MO_STORE=memory: mất state sau restart là dự kiến. R01 persistence ghi BLOCKED_MEMORY_STORE, không ghi FAIL hay PASS lưu bền. Có thể ghi quan sát restart riêng, không đổi scope9; giữ lượt Supabase riêng.
- MO_STORE=postgres: chạy R01 trước/sau restart backend cùng DB. Chủ tiến trình thực hiện; Trường đối chiếu, Châm Anh hỗ trợ.
- MO_PHOTO_STORE=local: ảnh còn trên ổ máy không chứng minh ảnh tồn tại trên Render.
- Không rõ cấu hình: BLOCKED_CONFIG_UNKNOWN; không suy từ /health hoặc .env.example.

Trước restart: Trường ghi ticket_id của case đã đóng có ảnh; status, checklist/material/evidence refs, audit/event count, stock liên quan; bằng chứng ảnh mở được trong đúng role. Chủ tiến trình ghi build/DB/Storage và thời điểm restart được phép.

Sau restart: đăng nhập lại nếu session hết; mở cùng ticket, so trạng thái/ảnh/audit/stock. Không thiếu bản ghi; count có thể tăng vì hành động mới nhưng không được mất hoặc có seed/status event trùng không giải thích được. Restart không tự reset. Build thay đổi thì xác nhận lại build, chạy lại ca bị ảnh hưởng. Refresh trình duyệt không phải restart server. GET ảnh trả200 một mình không chứng minh ảnh đúng; đối chiếu ảnh/ref với trước.

## 4. Phục hồi và rollback

Thử nghiệm lỗi: dừng nhánh, giữ evidence, ghi issue và người xử lý; Trường không rollback server. Châm Anh quyết định thao tác phục hồi/deploy theo quyền đã duyệt; Trường đo lại ca ảnh hưởng. Không xóa/reset data demo chung để làm sạch kết quả, không retry nhập kho mù.

Không gửi tin cho nhóm tự động. Nội dung bàn giao được chuẩn bị để người dùng chuyển: case/build → bước tái hiện → expected/actual → evidence → owner → cần đo lại gì. Evidence output máy lưu dưới evidence/<run>/, report chỉ trỏ. Nếu giao worker sau duyệt, bắt buộc H/R cùng đuôi và report chuẩn giao thức repo.

## 5. Lỗi và nghiệm thu vận hành

Hạ tầng sleep/mạng: retry GET hữu hạn sau kiểm health, ghi lần thất bại; mutation đọc state trước retry. Auth hết hạn: đăng nhập lại, không reset. Môi trường/build chưa biết: BLOCKED. R01 persistence chỉ PASS với postgres và evidence trước/sau và người thực hiện restart, chưa đo thì ghi coverage thiếu hoặc BLOCKED có owner; không suy từ test memory local.
