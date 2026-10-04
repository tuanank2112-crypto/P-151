# Task breakdown — 15 ca kiểm tra nghiệp vụ trên localhost

Contract mỗi ca: ghi CaseResult theo CONTRACTS §2; exact status/blocker theo CR-03. Một ca chỉ PASS khi mọi bước bắt buộc đạt. Dùng bốn nhóm demo từ hồ sơ02 OPERATIONS §2–§5 làm nguồn dữ liệu/bước thao tác; bỏ các câu trạng thái chưa triển khai lịch sử, áp kết luận cuối Day03 và route hiện tại.

## 1. D4-02 — happy path (60–90 phút, ước lượng)

- H01 vệ sinh: cư dân gửi → đúng DEPT_CLEANING → phòng ban nhận → đủ checklist/vật tư/ảnh mô phỏng → READY_FOR_REVIEW → BQL đóng CLOSED; timeline cư dân đúng.
- H02 đèn: tương tự với DEPT_TECHNICAL; asset/vật tư đúng dữ liệu demo; Agent không gán nhân viên.

Chia việc: tạo ticket và kiểm route; phòng ban hoàn tất; BQL nghiệm thu; chụp timeline. Giữ một ticket CLOSED có ảnh cho R01. CẤM dùng metadata ảnh thay bằng chứng upload/storage của môi trường thực tế.

## 2. D4-03 — thông tin và asset (30–45 phút)

- I01: NEED_INFO/MISSING_INFO → BPTN bổ sung đủ nội dung/vị trí/note → chạy lại safety và đi tiếp đúng blocker/ROUTED; raw được giữ.
- A01: VERIFYING/ASSET_UNCLEAR → BPTN xác nhận onsite với note → ROUTED/DEPT_TECHNICAL, cờ ASSET_CHECK_ONSITE; không bịa mã asset.

Không có case QA hợp lệ: BLOCKED, Châm Anh hỗ trợ chuẩn bị. Không xóa location bằng sửa DB để tạo ca.

## 3. D4-04 — vật tư và trùng (30–45 phút)

- M01: ON_HOLD/WAITING_MATERIAL, nhu cầu2/tồn0 → kho nhập1 còn dừng → nhập1 nữa đủ → tra lại asset/bước6 rồi ROUTED; resume không giao trùng.
- U01: gửi hai phản ánh cùng category/location theo quy tắc trùng đã duyệt → blocker DUPLICATE, BPTN chọn không gộp có note → đi tiếp đúng; không tự route lúc chưa xử lý trùng. Chỉ kiểm trùng cơ bản, không undo merge P1.

Stock thiếu fixture riêng hoặc ảnh hưởng ca người khác: BLOCKED tới khi chủ môi trường xác nhận cô lập. CẤM nhập lặp khi chưa biết lần trước đã thành công.

## 4. D4-05 — safety, tách 5 ca (60–90 phút)

- S01 Bậc2 CONFIRM_SAFE: mô tả nghi ngờ → VERIFYING/SAFETY_REVIEW_REQUIRED → BPTN xác nhận có lý do → risk NONE, audit actor/lý do, đi tiếp luồng thường hoặc blocker nghiệp vụ đúng.
- S02 Bậc2 ESCALATE: case mới → BPTN nâng → VERIFYING/EMERGENCY_PENDING_BQL, chưa draft/giao phòng ban, chủ BQL.
- S03 Bậc2 REQUEST_INFO: case mới → NEED_INFO safety_context → cư dân bổ sung khói/mùi khét dù vị trí thiếu → khẩn cấp, không bị thiếu dữ liệu che mất hazard.
- S04 Bậc1 CLOSE: case mới có khói/mùi khét → EMERGENCY_PENDING_BQL → BQL xác nhận xử lý có note → CLOSED/EMERGENCY_HANDLED, audit, không yêu cầu hoàn tất checklist thường.
- S05 Bậc1 DOWNGRADE: case riêng → BQL báo nhầm có lý do → luồng thường; lưu audit và state trước/sau, không lẫn với đóng khẩn cấp.

BẮT BUỘC mỗi lựa chọn dùng case riêng; CẤM dùng một ticket đã đóng để thử nhánh khác. Timeout 4h/12h đã đo local Day03; xin nhóm bằng chứng build hiện hành, không đổi đồng hồ/gọi jobs với now giả trên server chung. Chưa có kiểm chứng timeout online phải ghi giới hạn, không nhận PASS online cho phần này.

## 5. D4-06 — guard và wording (30–45 phút)

- G01 rating: trên ticket H01/H02 của đúng cư dân, lần đầu score5 đạt; lần hai score1 bị409, rating vẫn5.
- G02 close thường: BQL thử close khi chưa READY_FOR_REVIEW và close ticket EMERGENCY_PENDING_BQL bằng route thường →409, state không đổi.
- G03 sai quyền: BPTN thử đóng/hạ Bậc1 →403; department sai thử accept →403; không mutate case. API kiểm phủ định chỉ trên local QA đã cho phép, UI không có nút không thay bằng chứng deny backend.

Rà wording xuyên suốt: cư dân hiểu trạng thái, không lộ risk/reason nội bộ; BPTN có đúng 3 lựa chọn Bậc2; BQL có đúng2 lựa chọn Bậc1; phòng ban biết thiếu gì để complete. UI không thao tác được dù API pass = FAIL ca liên quan. Lưu screenshot theo vai, không sửa UI trong gói này.

## 6. D4-07 — R01 persistence (30–45 phút phối hợp)

Theo OPERATIONS §3. Contract postgres: cùng ticket_id/status/ảnh/audit/tồn kho trước và sau restart; memory không chứng minh persistence, ghi BLOCKED_MEMORY_STORE; không sinh seed/draft trùng. Trường đối chiếu nghiệp vụ, chủ tiến trình local thực hiện restart với phối hợp Châm Anh và cung cấp bằng chứng hạ tầng.

## 7. Lỗi, caller và bằng chứng

Safety bỏ sót/auto-clear/sai quyền hoặc mất data = CRITICAL, dừng nhánh, bàn giao Như Ý/Châm Anh. Happy path/UI/vật tư không hoạt động = MAJOR, bàn giao đúng owner và đo lại. Wording nhỏ không sai quyền = MINOR, ghi nguyên văn. CONTRACTS §4 quy định retry, không tự sửa oracle. Acceptance thật: 15 ca local CHƯA ĐO; online BLOCKED_NO_DEPLOYMENT; không điền số PASS dự kiến.
