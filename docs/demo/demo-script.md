# Kịch bản video demo — Cổng phản ánh cư dân (portal mới)

| Mục | Nội dung |
|---|---|
| Video | 1440×900, 3 phút 29 giây, giọng Microsoft An; tệp `demo.mp4` lưu ở Drive (đã gỡ khỏi git vì 13,4 MB), phụ đề `docs/demo/demo.srt` |
| Câu chuyện | Một phản ánh “đèn hành lang tầng 12 tắt” đi trọn vòng đời qua 6 vai: Cư dân → Tiếp nhận → Kỹ thuật → Kho → Kỹ thuật → BQL → Cư dân |
| Dữ liệu | Backend memory + LLM mock, dữ liệu mô phỏng `SIM-` (không phải Supabase, không phải dữ liệu thật). Ảnh hiện trường là ảnh vẽ, ghi rõ “Ảnh mô phỏng” |
| Giọng | Microsoft An (vi-VN, offline). Một giọng cho mọi vai, mỗi nhân vật đổi cao độ/tốc độ: Thuyết minh chuẩn · Cư dân Minh Anh, Tiếp nhận Thu Trang cao hơn · Kỹ thuật Hùng, Thủ kho Minh Kho, BQL Long trầm hơn |
| Trên màn hình | Con trỏ có vòng cam khi bấm · nhãn cảnh góc phải trên · khung phụ đề dưới (tên người nói + lời) |
| Quay lại | `portal/scripts/demo-video/`: `tts.ps1` (giọng) → `record.mts` (quay + ghép tiếng). Lời thoại sửa trong `narration.json` rồi chạy lại cả hai |

## Nhân vật

| Nhân vật | Tài khoản | Vai |
|---|---|---|
| Nguyễn Minh Anh | `cudan` | Cư dân căn 1208, tầng 12, tòa S2.05 |
| Phạm Thu Trang | `tiepnhan` | Ban tiếp nhận |
| Đặng Văn Hùng | `kythuat` | Phòng kỹ thuật |
| Trần Minh Kho | `kho` | Thủ kho |
| Vũ Hoàng Long | `quanly` | Ban quản lý |


## Giới thiệu

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Màn tiêu đề: “Cổng phản ánh cư dân · Ocean Park”, dòng chảy 7 bước. | Thuyết minh | Xin chào. Đây là bản demo Cổng phản ánh cư dân của khu đô thị Ocean Park, chạy trên dữ liệu mô phỏng. |
| 2 | Giữ màn tiêu đề. | Thuyết minh | Chúng ta sẽ theo chân một phản ánh duy nhất: từ lúc cư dân gửi, qua Ban tiếp nhận, phòng kỹ thuật, kho vật tư, đến khi Ban quản lý nghiệm thu và cư dân đánh giá. |

## Bước 1 · Cư dân

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Mở /login, gõ `cudan` / mật khẩu, bấm **Đăng nhập** → màn Gửi phản ánh. | Thuyết minh | Cư dân Nguyễn Minh Anh, căn 1208 tòa S2.05, đăng nhập vào cổng bằng tài khoản của mình. |
| 2 | Bấm ô **Tiêu đề**, gõ “Đèn hành lang tầng 12 chập chờn rồi tắt hẳn”. | Cư dân Minh Anh | “Đèn hành lang tầng tôi tắt hẳn từ tối qua. Tôi gửi phản ánh ngay đây.” |
| 3 | Bấm ô **Nội dung**, gõ mô tả chi tiết (gần thang máy, tắt hẳn, đi lại rất tối). | Thuyết minh | Chị nhập tiêu đề ngắn gọn, rồi mô tả chi tiết: đèn ở đoạn gần thang máy, chập chờn rồi tắt hẳn, buổi tối đi lại rất tối. |
| 4 | Chọn **Tầng của tôi** → chip **Hành lang**; dòng vị trí hiện “Tòa S2.05 · Tầng 12 · Hành lang”. | Thuyết minh | Phần vị trí, chị chọn Tầng của tôi, chi tiết là Hành lang. Tòa và tầng được lấy sẵn từ hồ sơ cư dân. |
| 5 | Đính kèm ảnh hiện trường (ảnh vẽ mô phỏng, có chữ “Ảnh mô phỏng”). | Thuyết minh | Chị đính kèm một ảnh hiện trường. Trong bản demo, đây là ảnh mô phỏng. |
| 6 | Bấm **Gửi phản ánh** → thông báo “Đã gửi” kèm mã `SIM-TKT-0001`. | Thuyết minh | Bấm Gửi phản ánh. Hệ thống cấp ngay một mã ticket để cư dân theo dõi. |
| 7 | Mở tab **Phản ánh của tôi** → bấm ticket vừa gửi → cuộn xem Tiến độ xử lý và Lịch sử. | Thuyết minh | Trong mục Phản ánh của tôi, chị xem được tiến độ xử lý và lịch sử của từng bước. |

## Bước 2 · Ban tiếp nhận

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Đăng nhập `tiepnhan` → tab **Chờ phân loại**. | Thuyết minh | Chuyển sang Ban tiếp nhận. Chị Phạm Thu Trang đăng nhập. |
| 2 | Trỏ vào thẻ ticket: nhãn Khẩn cấp, “Chưa rõ tài sản”, Mức an toàn, vị trí, khối Agent. | Thuyết minh | Phản ánh mới nằm trong mục Chờ phân loại. Thẻ ghi rõ ticket đã được đánh dấu khẩn cấp, lý do đang dừng là chưa rõ tài sản, và mức an toàn. |
| 3 | Bấm mã ticket → cửa sổ chi tiết (nội dung, vị trí, ảnh, Phân tích Agent) → cuộn → Esc. | Thuyết minh | Bấm vào mã ticket để xem đầy đủ nội dung, vị trí, ảnh và phân tích của Agent. |
| 4 | Bấm **Kiểm tra tại chỗ** (nút duy nhất hệ thống đưa ra cho lý do “Chưa rõ tài sản”). | Tiếp nhận Thu Trang | “Hệ thống chưa tìm thấy thiết bị chiếu sáng nào ở vị trí này. Tôi bấm Kiểm tra tại chỗ để chuyển phòng kỹ thuật xuống kiểm tra.” |
| 5 | (Chỉ khi hệ thống đưa ra nút **Phòng kỹ thuật**) bấm chuyển phòng. Lần quay này KHÔNG xuất hiện. | Tiếp nhận Thu Trang | “Đây là sự cố đèn chiếu sáng. Tôi chuyển cho Phòng kỹ thuật.” |
| 6 | Tab **Đã phân loại** → trỏ vào dòng ticket. | Thuyết minh | Ticket rời hàng chờ và xuất hiện trong mục Đã phân loại, đã chuyển Phòng kỹ thuật. |

## Bước 3 · Phòng kỹ thuật

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Đăng nhập `kythuat` → **Hàng việc kỹ thuật**, trỏ vào thẻ ở cột Cần nhận. | Thuyết minh | Anh Đặng Văn Hùng của phòng kỹ thuật đăng nhập, và thấy ticket trong cột Cần nhận. |
| 2 | Bấm **Nhận việc** → thẻ sang cột Đang xử lý (không có bước gán nhân viên). | Kỹ thuật Hùng | “Việc này phòng tôi nhận. Bấm Nhận việc là bắt đầu xử lý, không phải gán cho từng người.” |
| 3 | Bấm **Yêu cầu vật tư** → chọn “Bóng đèn LED mô phỏng” ở dòng 1. | Thuyết minh | Cần thay bóng đèn, anh Hùng mở Yêu cầu vật tư và chọn bóng đèn LED trong danh mục kho. |
| 4 | Gõ ghi chú “Thay bóng đèn LED hành lang tầng 12, bóng cũ đã cháy” → **Gửi yêu cầu** → thẻ hiện “Chờ cấp trên duyệt vật tư”. | Thuyết minh | Anh ghi chú lý do rồi gửi. Ticket chuyển sang trạng thái chờ cấp trên duyệt vật tư. |

## Bước 4 · Kho vật tư

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Đăng nhập `kho` → tab **Yêu cầu cấp phát** → trỏ vào yêu cầu của ticket (Cần / Tồn / Còn thiếu). | Thuyết minh | Thủ kho Trần Minh Kho mở mục Yêu cầu cấp phát. Yêu cầu của phòng kỹ thuật ghi rõ vật tư cần, tồn kho hiện có và số còn thiếu. |
| 2 | (Chỉ khi thiếu hàng) bấm **Nhập đủ**. Lần quay này đủ hàng nên KHÔNG xuất hiện. | Thuyết minh | Tồn kho chưa đủ, nên thủ kho nhập thêm hàng trước khi cấp. |
| 3 | Bấm **Duyệt cấp**. | Thủ kho Minh Kho | “Đủ hàng rồi. Tôi duyệt cấp cho phòng kỹ thuật.” |

## Bước 5 · Hoàn thành

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Đăng nhập `kythuat` → bấm **Đánh dấu hoàn thành** → mở form Hoàn thành. | Thuyết minh | Thay bóng xong, anh Hùng quay lại và bấm Đánh dấu hoàn thành. |
| 2 | Tích 3 mục Checklist quy trình và 2 mục “Đã dùng … — số lượng”. | Thuyết minh | Anh tích xác nhận đã dùng từng vật tư được cấp, và các mục của biểu mẫu hoàn thành. |
| 3 | Đính kèm ảnh sau xử lý → **Gửi nghiệm thu** → form đóng. | Kỹ thuật Hùng | “Tôi đính kèm ảnh sau xử lý rồi gửi nghiệm thu cho Ban quản lý.” |

## Bước 6 · Ban quản lý

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Đăng nhập `quanly` → **Tổng quan** (5 ô số liệu, phụ tải Vệ sinh/Kỹ thuật). | Thuyết minh | Anh Vũ Hoàng Long của Ban quản lý đăng nhập. Trang tổng quan cho thấy tổng số ticket, việc khẩn cấp, quá hạn và phụ tải từng phòng. |
| 2 | Tab **Việc của BQL** → trỏ vào thẻ ở mục Chờ nghiệm thu (ảnh, checklist, vật tư). | Thuyết minh | Trong Việc của Ban quản lý, ticket nằm ở mục Chờ nghiệm thu, kèm ảnh sau xử lý, checklist và vật tư đã cấp. |
| 3 | Tích “Hiện trường đã xử lý dứt điểm…” và “Kết quả khớp nội dung phản ánh…” → **Nghiệm thu đạt — Hoàn thành**. | Ban quản lý Long | “Hiện trường đã xử lý dứt điểm, đúng nội dung cư dân phản ánh. Tôi nghiệm thu đạt.” |

## Bước 7 · Cư dân đánh giá

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Đăng nhập `cudan` → **Phản ánh của tôi** → mở ticket (Cần bạn đánh giá). | Thuyết minh | Cuối cùng, cư dân Minh Anh mở lại phản ánh của mình. Ticket đã hoàn tất và chờ chị đánh giá. |
| 2 | Chọn 5 sao → chip **Xử lý nhanh** → gõ nhận xét “Kỹ thuật đến nhanh, hành lang sáng lại rồi. Cảm ơn ban quản lý!”. | Cư dân Minh Anh | “Năm sao nhé. Kỹ thuật đến nhanh, hành lang sáng lại rồi.” |
| 3 | Bấm **Gửi đánh giá** → đánh giá hiện trong ticket. | Thuyết minh | Đánh giá được lưu lại. Ban quản lý dùng nó để theo dõi chất lượng của từng phòng. |

## Bước 8 · Theo dõi

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Đăng nhập `quanly` → Tổng quan đã cập nhật. | Thuyết minh | Quay lại Ban quản lý, số liệu đã cập nhật theo ticket vừa đóng. |
| 2 | Tab **Hiệu suất phòng ban**. | Thuyết minh | Mục Hiệu suất phòng ban tổng hợp việc đang xử lý, quá hạn, đã đóng, số sao trung bình và thời gian hoàn thành. |

## Kết thúc

| # | Thao tác trên màn hình | Người nói | Lời |
|---|---|---|---|
| 1 | Màn kết: “Một phản ánh, sáu vai trò, một nơi theo dõi” · dữ liệu mô phỏng. | Thuyết minh | Một phản ánh, sáu vai trò, một nơi theo dõi. Cảm ơn anh chị đã xem bản demo. |
