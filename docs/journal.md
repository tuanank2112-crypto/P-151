# Nhật ký phát triển — MaintenanceOps (P-151)


## Tuần 1 (14/09 – 20/09): Tìm hiểu vấn đề

Tuần này nhóm chỉ làm một việc: xem pain point có thật không và có đáng làm không. Lúc đầu nhóm nghĩ tới chatbot. Sau khi trao đổi và tìm hiểu thêm, nhóm thấy chatbot chưa thật sự cần cho vấn đề này nên bỏ, và chuyển sang bài toán hiện tại: cư dân phản ánh sự cố bảo trì, vệ sinh bằng câu chữ tự do, ban quản lý phải đọc, phân loại rồi giao việc bằng tay. Nhóm viết Problem Statement và dựng một ít dữ liệu mô phỏng để kiểm tra bài toán này có đủ cụ thể không.

Bài học: xác định vấn đề có đáng làm trước, chọn công nghệ sau.

## Tuần 2 (21/09 – 27/09): Chốt MVP

Nhóm viết MVP, PRD, luồng giao diện và bộ dữ liệu mẫu, rồi chốt phạm vi thí điểm nhỏ. Cuối tuần đã có bản chạy đầu tiên: nhận phản ánh, phân loại, giao việc, cho đính kèm ảnh.

Khó khăn: mỗi người hình dung sản phẩm hơi khác nhau (giao việc cho từng nhân viên, hay giao cho cả phòng ban). Nhóm thống nhất lấy tài liệu MVP làm chuẩn và bỏ các luồng cũ.

Bài học: chốt phạm vi sớm thì code ít lệch spec.

## Tuần 3 (28/09 – 04/10): Đóng băng v0.3 và sửa luồng

Ngày 28–29/09 nhóm chốt baseline v0.3 (hai loại việc: vệ sinh và đèn; Agent chỉ đề xuất). Song song với backend, nhóm làm giao diện app: đăng nhập, các màn hình theo từng vai (cư dân, ban bảo trì, phòng ban, quản lý), màn xem log AI, chế độ tối, hiển thị được trên điện thoại. Thêm ảnh đính kèm. Sau khi thử luồng, nhóm thấy việc bắt ban bảo trì xác nhận mọi phiếu là thừa nên đổi sang giao thẳng theo phòng ban (CR-BPTN-02). Đầu tháng 10 chốt thêm CR-BPTN-03 với tầng an toàn (phát hiện ca khẩn cấp), mức ưu tiên, gộp phiếu trùng, giữ vật tư khi thiếu.

Từ 02/10 dữ liệu chuyển sang lưu trên PostgreSQL/Supabase, không còn mất khi khởi động lại. Ngày 04/10 chạy tay 9 ca trên máy cá nhân: 8 đạt, 1 chưa kiểm được vì khi đó vẫn dùng bộ nhớ tạm.

Khó khăn: nhiều người sửa song song, merge chồng nhau và xung đột vài lần. Nhóm backup trước khi tích hợp và kéo `develop` về nhánh riêng thường xuyên hơn.

Bài học: thay đổi nghiệp vụ phải ghi thành yêu cầu thay đổi riêng, không sửa lặng lẽ vào bản đã chốt. Test xanh chưa đủ, phải chạy ca thật.

## Tuần 4 (05/10 – 11/10): Agent suy luận và cổng thông tin mới

Nhóm đưa Agent suy luận vào luồng chính: tách, gộp phiếu, nhận ra giao nhầm phòng ban. Phần nhận biết an toàn bằng luật cố định bỏ sót những câu viết lạ (tách chữ, không dấu, phủ định), nên nhóm chuyển phần hiểu ngữ nghĩa sang Agent, còn luật cố định chỉ làm lớp chặn cuối. Đầu ra của model luôn được kiểm lại theo danh mục có sẵn.

Giao diện app được làm lại hoàn toàn theo bản thiết kế mới: một cổng thông tin gọi backend thật cho mọi vai, thêm bản chạy trên điện thoại cho các vai vận hành, màn quản lý kho và cổng nghiệm thu. Nhóm chỉnh các màn hình theo góp ý khi xem thử (ví dụ form cư dân hỏi vị trí trước mô tả, mỗi phiếu một khung, danh sách phân trang). Nhóm gỡ tài khoản và mật khẩu cứng khỏi giao diện, siết quyền xem ảnh. Cuối tuần có video demo chạy local và ảnh chụp các màn hình.

Khó khăn: kho vật tư sinh nhiều lỗi nhất vì cùng lúc có phê duyệt, trả lại, huỷ và nhiều phiếu dùng chung tồn kho. Nhóm sửa qua nhiều vòng đến khi số tồn khớp ở cả đường trả lại và huỷ.

Bài học: phần có tiền, kho, quyền cần test cả những đường ít gặp.

## Tuần 5 (12/10 – 18/10): Triển khai, đo và nộp

Nhóm bỏ giao diện cũ và dùng một giao diện duy nhất trên PostgreSQL. Deploy lên Vercel, đặt vùng chạy gần Supabase nên API nhanh hơn rõ (trung vị khoảng 2,4 s xuống 0,7 s). Chạy serverless làm lộ vấn đề đăng nhập giữa các instance không đồng nhất, nhóm đổi sang token có chữ ký và không giữ kết nối DB giữa các lần gọi; thử đăng nhập trên production được 12/12. Dành nhiều thời gian chỉnh giao diện app theo phản hồi thực tế: danh sách dài cuộn trong khung riêng, bảng việc theo phòng ban được làm gọn và bỏ bớt khung bao cho thoáng mắt, dọn bảng đối soát thừa ở trang quản lý, lọc và tìm kiếm ở màn lễ tân, tab đã phân loại, biểu đồ và báo cáo hiệu suất phòng ban, xử lý ca khẩn cấp trùng, tách hai việc cùng vị trí, yêu cầu vật tư, lễ tân bổ sung thông tin thiếu. Viết hướng dẫn chạy và rollback trong README.

Ngày 17/10 nhóm chạy đo chất lượng: tầng luật cố định bắt đúng 219/219 ca khẩn cấp, phân loại đúng 151/151 câu dev; đồng thời chạy thực nghiệm với 91 câu khó dùng model `gpt-6-luna` thật qua OpenAI API để đo độ trễ (p50 đạt 4,8 s) và số token tiêu thụ (trung bình ~4.250 token/lượt). Kết quả suy luận, độ trễ và lượng token tiêu thụ được lưu lại đầy đủ thành hồ sơ kiểm thử và bộ 8 trace mẫu trong log AI phục vụ Demo Day.

18/10 (kế hoạch): kiểm lại đủ 10 deliverable (link, quyền truy cập, không lộ khoá, CI, địa chỉ online), backup, gắn tag, tick checklist.

Khó khăn chung của tuần: giao diện và backend đổi nhiều nên phải sửa lại màn hình liên tục theo từng thay đổi nghiệp vụ; CI trên GitHub không chạy được do hết hạn mức của tổ chức nên phải test và đo kiểm ở máy cá nhân; thời gian dồn lại cuối nên phần đo kết quả với model thật bị trễ so với tiến độ xây tính năng.

Bài học: đo sớm hơn; giao diện càng tinh giản thì trải nghiệm người dùng càng tốt; nhãn dữ liệu cần người ngoài gán thì số liệu mới hoàn toàn khách quan.


