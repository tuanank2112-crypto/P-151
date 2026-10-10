# API retest checklist — Day05 backlog

Hướng xử lý được Trường duyệt. Trường xác nhận Như Ý và Châm Anh đã đồng ý nhận việc; Châm Anh dẫn kiểm thử, Như Ý hỗ trợ lỗi engine. Chưa có kết quả kiểm thử. Chưa chạy, không có PASS runtime.

## Môi trường và bằng chứng chung

Dùng QA cô lập với DB/storage riêng. Các phép thử tạo ticket và ghi trạng thái: không áp dụng lên Supabase chung theo quyết định backlog này. Chọn đúng backend Python/CR-03; portal Next.js độc lập không thay thế bằng chứng API engine. Ghi build SHA, dirty source hashes, config không có secret, UTC, actor/role, ticket ID, request/response đã lược credential. Chụp fingerprint lúc chạy, không suy ngược từ trạng thái hiện tại. Không dùng tài khoản/dữ liệu thật, không reset DB nhóm.

## D5-B-006 — tạo ticket

Tạo ticket mới bằng hợp đồng API của build đang kiểm thử. Ghi HTTP201, ticket ID mới và GET xác nhận dữ liệu được lưu đúng. Phục hồi ticket cũ không thay thế thử tạo mới. Ghi evidence/retest-d4-06/create.json; trường http_status=201, thêm build/ticket/request/GET evidence. Không đóng nếu API lỗi hoặc chỉ có recovery cũ.

## D5-B-002 — resume hai lần

Chuẩn bị ticket có blocker phù hợp để gỡ và resume theo quyền hợp lệ. Ghi lần đầu và lần thứ hai trên cùng ticket/build. Đối chiếu số giao việc VÀ thông báo trước/sau lần hai, state nghiệp vụ và ID phát sinh. Không đếm audit entry như giao việc; audit có thể tăng hợp lệ. Lưu evidence/retest-d4-02/resume-twice.json với dispatch_count_after_first_resume, dispatch_count_after_second_resume, notification counts, requests/responses và state. Hai số dispatch bằng nhau chưa đủ nếu vẫn tạo thông báo trùng.

## D5-B-004 — permission guard

Dùng vai không có quyền cho thao tác xác định. GET bằng vai đủ quyền trước thao tác, gọi thao tác sai quyền và ghi HTTP403, GET độc lập sau. So sánh trạng thái nghiệp vụ; audit được phép thêm bản ghi denial và phải chứng minh có denial đúng actor/action/ticket. Không so toàn bộ JSON tuyệt đối vì audit/thời gian có thể thay đổi hợp lệ. Lưu evidence/retest-d4-04/guard-get.json với denied_status, state_before, state_after và denial audit evidence.

## Kết thúc

Đo trên cùng build; mỗi fail ghi đúng owner để sửa. Thiếu kết quả giữ OPEN hoặc FIXED_PENDING_RETEST. Các lệnh done_when cũ trong backlog chỉ là kiểm tra sơ bộ trường evidence, không thay thế xác minh đủ checklist này. Không sửa output máy hoặc viết PASS khi chưa chạy.
