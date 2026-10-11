# SPEC-P04 — Đợt 2 (PROPOSED, chưa thi công)

Phải chi tiết hoá thành contract đủ (chữ ký, lỗi, test) và xin người dùng duyệt TRƯỚC khi thi công. Đây là danh sách phạm vi đã được người dùng đồng ý ở Q1–Q6.

## §1 Việc ngoài phạm vi chỉ ở Tiếp nhận (Q3) 🔴
- Engine: `_stop_out_of_scope(by_agent=True)` KHÔNG còn đặt `blocker.escalated` (thay quy tắc Q14 của develop).
- Tiếp nhận được đóng ticket `VERIFYING + OUT_OF_SCOPE` với lý do bắt buộc (mở rộng quyền `bql_handle_out_of_scope` cho BPTN, hoặc endpoint mới). Ticket đã leo thang trước đó: hiện lại ở Tiếp nhận.
- Gỡ phần "ngoài phạm vi" khỏi ô "Cần BQL quyết" (plan D04 hết hiệu lực).
- Cần test quyền (403 sai vai), test trạng thái (409), test dữ liệu cũ đã leo thang.

## §2 Hiệu suất phòng ban — dashboard (Q6) 🔴 contract / 🟠 UI
- Endpoint đọc mới (đề xuất `GET /bql/performance?from&to`) trả theo phòng: tổng tiếp nhận, hoàn thành, đúng hạn, quá hạn/đang xử lý, thời gian xử lý TB, CSAT, số đánh giá. Định nghĩa 01 §6.
- UI: bộ lọc thời gian (Hôm nay / Tuần này mặc định / Tháng này / Tuỳ chỉnh bằng `<input type="date">`), 4 thẻ KPI, biểu đồ cột nhóm (SVG), bảng có SLA % (xanh ≥ 90, vàng 70–89, đỏ < 70) và Tổng tiếp nhận, bấm tên phòng ⇒ Danh sách ticket lọc phòng.

## §3 Kho (Q4) 🔴 contract
- Nhật ký nhập/xuất chỉ đọc: nhập do thủ kho, xuất tự sinh khi phòng ban lưu vật tư đã dùng.
- "Xuất hàng" thủ công cho hao hụt/điều chỉnh, lý do bắt buộc, không âm kho.
- Thanh tab Kho: Danh mục tồn kho · Lịch sử nhập/xuất (KHÔNG có "Phiếu yêu cầu cấp phát").
- App điện thoại đang cảnh báo theo `qty < 30` (Q37 cũ) ⇒ thống nhất về `min_qty`.

## §4 Dashboard hiệu suất Agent (Q1) 🟠
Tỷ lệ đúng theo thời gian, theo loại việc, số ca Agent/luật bất đồng, chung bộ lọc thời gian với §2.
