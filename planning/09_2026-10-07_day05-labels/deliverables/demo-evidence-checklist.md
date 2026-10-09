# Demo evidence checklist — D5-B-003/005/007

Trường chủ trì tổng hợp; Trí hỗ trợ nếu UI có vấn đề. Chưa chạy retest. Dùng QA cô lập, không suy quyền chạy trên Supabase chung.

## Trước khi chạy — D5-B-007

Ghi UTC bắt đầu, SHA hiện tại, trạng thái dirty và hash các source/config không bí mật thực tế được server nạp. Ghi backend/port, store mode và phiên bản công cụ; không sao chép .env, token, URL kết nối có password. Nếu server chưa restart sau đổi source, ghi đúng SHA của process/build, không chỉ HEAD hiện tại. Ghi start/end UTC cho từng bước, kể cả trước/sau restart nếu đo persistence. Không tạo timestamp quá khứ hoặc gán hash hiện tại cho run cũ.

## BQL đóng ticket — D5-B-003

Chọn đúng kịch bản S04 theo script hiện hành. Giữ một ticket ID xuyên suốt các bước. Chụp trước đóng, thao tác BQL và kết quả sau đóng; đối chiếu request/response và state. Lưu machine evidence vào evidence/retest-d4-03/s04-tickets.json với steps/ticket_id cùng build và screenshot refs. Các steps phải đầy đủ và không rỗng; kiểm một ID chung chỉ là điều kiện cần, chưa chứng minh đúng hành vi.

## Xác nhận hiện trường — D5-B-005

Chọn kịch bản A01, xác định ticket ID. Chụp trước xác nhận, lúc xác nhận và sau xác nhận; không dùng ảnh của ticket khác để minh họa. Lưu evidence/retest-d4-05/a01-tickets.json với steps/ticket_id và source refs. Có thể cùng run với S04 nếu script cho phép, không ghép các ảnh khác tình huống thành bằng chứng một ticket.

## Kết thúc

Lưu manifest mới cho D5-B-007 ở evidence/retest-d4-07/run-manifest.json. Trỏ từng ảnh/log vào đúng case, kèm build/ticket/UTC, không sửa output máy. Kiểm đủ steps, đúng actor/state, cùng ticket và source refs trước khi đóng mục. Chưa đủ evidence thì giữ OPEN, ghi phần thiếu. Bằng chứng demo không thay review nhãn của bộ 15 câu.
