# Task breakdown — 9 ca demo trên localhost

## 1. Scope đã chốt

Chín ca H01,H02,I01,A01,M01,U01,S04,G03,R01 theo quyết định trực tiếp của Trường07/10. Sáu ca ngoài phạm vi đã loại khỏi hồ sơ kiểm thử; không phải việc còn nợ. Contract kết quả: 01-CONTRACTS schema day04-3. Chỉ thay phạm vi demo cá nhân, không thay luật engine/quyền/safety.

## 2. D4-02 — happy path

- H01 vệ sinh: cư dân tạo thành công201, ROUTED/DEPT_CLEANING → phòng ban nhận IN_PROGRESS → đủ checklist/vật tư/ảnh → READY_FOR_REVIEW → BQL CLOSED; timeline cư dân đúng. POST create422 rồi recovery phải ghi lỗi, không tính hành trình không lỗi.
- H02 đèn: tương tự DEPT_TECHNICAL; asset/vật tư đúng dữ liệu mô phỏng; Agent không gán nhân viên.

BẮT BUỘC evidence cùng ticket, đúng vai. CẤM lấy metadata ảnh thay upload/download thật.

## 3. D4-03 — thông tin và asset

- I01 NEED_INFO/MISSING_INFO → BPTN bổ sung đủ nội dung/vị trí/note → safety chạy lại → ROUTED hoặc blocker đúng; raw giữ nguyên.
- A01 VERIFYING/ASSET_UNCLEAR → BPTN xác nhận onsite có note → ROUTED/DEPT_TECHNICAL + ASSET_CHECK_ONSITE; không bịa asset.

Thiếu fixture hợp lệ: BLOCKED với owner; CẤM sửa DB để xóa vị trí tạo case.

## 4. D4-04 — vật tư và trùng

- M01 ON_HOLD/WAITING_MATERIAL, nhu cầu2/tồn0 → nhập1 còn dừng → nhập1 nữa đủ → tra bước6 rồi ROUTED; resume lặp không giao trùng.
- U01 hai phản ánh cùng category/location → DUPLICATE, BPTN chọn không gộp có note → đi tiếp đúng; không tự route khi trùng chưa được xử lý.

Kho ảnh hưởng nhóm khác: BLOCKED đến khi có QA cô lập/scope cho phép. CẤM retry nhập kho mù. Undo merge không thuộc scope này.

## 5. D4-05 — S04 safety

- S04 case Bậc1 có khói/mùi khét → VERIFYING/EMERGENCY_PENDING_BQL → BQL xác nhận xử lý có note → CLOSED/EMERGENCY_HANDLED; audit đủ, không yêu cầu checklist thường.

Chỉ có S04 trong scope safety của hồ sơ này. Không tuyên bố đã nghiệm thu mọi nhánh safety hoặc timeout4h/12h từ một ca. Evidence trước/sau phải cùng ticket.

## 6. D4-06 — G03 guard và wording

- G03 BPTN thử đóng/hạ Bậc1 →403; department sai accept →403; trạng thái nghiệp vụ không đổi, denial có audit.

Rà wording của những flow còn trong scope: cư dân không lộ nội bộ; nhân viên biết blocker và hành động hợp lệ. UI giấu nút không thay kiểm guard API; GET trước/sau hoặc bằng chứng độc lập phải khẳng định state.

## 7. D4-07 — R01 persistence

Postgres: cùng ticket/status/ảnh/audit/tồn kho trước/sau restart; ảnh tải lại khớp bytes/hash; không seed/draft trùng. Memory: BLOCKED_MEMORY_STORE, không PASS persistence. Lượt Supabase là bằng chứng riêng, không đổi record memory cũ. Ghi thời điểm stop/start thật; thiếu thì null + hạn chế, không lấy mtime làm event time.

## 8. Lỗi và bằng chứng

Safety sai quyền/mất data = CRITICAL, dừng nhánh và bàn giao owner. Luồng/UI/vật tư lỗi = MAJOR; wording nhỏ = MINOR. Giữ gold và raw evidence. Chuẩn hóa chỉ đọc bằng chứng, không làm lại runtime. Phải phân biệt kết luận báo cáo lịch sử và phép đo máy mới; không gộp PASS khác build thành9/9.
