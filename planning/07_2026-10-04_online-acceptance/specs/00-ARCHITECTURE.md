# Kiến trúc và phạm vi nghiệm thu ngày 04

## 1. Contract phạm vi

Đầu vào: phân công Notion ngày 04, CR-BPTN-03 §5–§8/§16, code router hiện tại, kết luận Day03 f46a53c, bản localhost được xác nhận. Đầu ra: manifest môi trường, kết quả 15 ca, issue register và báo cáo nghiệm thu nghiệp vụ. Thứ tự đọc: CONTRACTS → SPEC-P01 → OPERATIONS → TESTING.

Trường sở hữu expected, thao tác demo và kết luận nghiệp vụ. Như Ý sở hữu engine/safety; Châm Anh sở hữu deploy/API/persistence/CI và restart; Trí sở hữu UI/wording/ảnh màn hình. BẮT BUỘC ghi owner theo căn nguyên, không quy toàn bộ fail cho Trường.

## 2. Bất biến và vùng cấm

BẮT BUỘC dữ liệu SIM-, safety trước phân loại, human đúng quyền gỡ blocker, audit truy vết, thiếu ảnh/checklist không hoàn tất, rating một lần. PASS local không thay PASS online. API PASS nhưng UI không thao tác được = không PASS ca UI.

CẤM đổi engine/router/UI/dataset/gold trong hồ sơ nghiệm thu này; tự reset/evaluate DB chung; fake feedback; chuyển fail thành pass bằng sửa oracle. D-01 delta/snapshot, LangGraph thật, P1/follow-up/undo merge, user test 3–5 người và pitch hoàn chỉnh ngoài phạm vi ngày 04, vì lịch nhóm đặt sau MVP. Không lấy diagram target 19/10 làm bằng chứng runtime 04/10.

## 3. Lỗi và caller

- Thiếu địa chỉ localhost/build/quyền thao tác: ghi BLOCKED cho ca phụ thuộc, chuẩn bị offline các ca còn lại.
- CR/code khác nhau: giữ expected đã duyệt, ghi issue; đổi contract phải người quyết.
- UI/API thiếu tính năng: ghi FAIL khi thử được và sai; BLOCKED khi không thể thực hiện vì phụ thuộc chưa có.
- Build đổi giữa lượt: đánh dấu kết quả thuộc build cũ; chạy lại ca bị ảnh hưởng trước sign-off.

## 4. Bằng chứng

Số đo hiện biết: Day03 local asset3/3, stock4/4, dup4/4; bốn demo/wording PASS theo kết luận cuối. Ngày04 local: CHƯA ĐO; online: BLOCKED_NO_DEPLOYMENT; không suy ra tỷ lệ hoàn thành. Nghiệm thu hồ sơ khi 8 task, 15 case và owner/ràng buộc trong các SPEC khớp; nghiệm thu local và online tách riêng theo TESTING §2.
