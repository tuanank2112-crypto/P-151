# SPEC-P03 — Từng màn theo doc của anh Cố (WP3–WP6, 🟠)

Giữ bố cục/thiết kế hiện có của từng `*-app.tsx` (Trí); chỉ đổi nguồn dữ liệu, nút và những gì doc yêu cầu. Doc chỉ là tham khảo hình ("không dùng nguyên form") — giữ ngôn ngữ thiết kế của portal.

## 1. Chung
- Mọi danh sách/thẻ dùng `code` = `ticket_id`. Bấm mã ⇒ mở `TicketDetailModal` (§7) ở MỌI màn nhân viên.
- Nút chỉ hiện khi trạng thái cho phép theo bảng 01 §7; bấm mà backend từ chối ⇒ hiện message backend (I-02).
- `urgent` (01 §3) hiện nhãn "Khẩn cấp" đỏ cho nhân viên; cư dân không thấy.

## 2. Cư dân (`app/resident`)
- Danh sách/chi tiết: `stage` stepper, `statusLabel`, `publicMessage`, `history` (timeline công khai), `extras`, ảnh, `deptName`.
- Gửi phản ánh: mô tả (10–2000 ký tự) + chọn nơi (`PLACE_DEFS` giữ nguyên) + ≤ 5 ảnh. Bỏ dự đoán Agent khi gõ, bỏ nút khẩn cấp (00 §2). Banner sau khi gửi: `statusLabel` + `publicMessage` backend trả.
- Nút: "Bổ sung" khi `needInfo`; "Đánh giá" (1–5 sao, bỏ thẻ/bình luận) khi `canRate`. Bỏ "Xác nhận hoàn tất", "Chưa đạt", "Hủy".
- Tab Thông báo: ẩn (00 §2).
- Chuông: đếm ticket `canRate` hoặc `needInfo`.

## 3. Tiếp nhận (`app/reception`)
### 3.1 Tab "Chờ xử lý" (inbox)
Thẻ mỗi ticket có blocker chủ BPTN. Hiện: mã, mô tả, vị trí, giờ, `blockerLabel`, đề xuất phòng (`proposedDept`, chữ thường "Đề xuất: Phòng …", không %), mức an toàn, ảnh, bổ sung. Nút theo `blockerCode`:
| blocker | Nút |
|---|---|
| CATEGORY_UNCLEAR, OUT_OF_SCOPE, PENDING_REVIEW, WRONG_DEPT | "Phòng vệ sinh" · "Phòng kỹ thuật" (`routeTicketAction`) · "Ban quản lý" (chỉ OUT_OF_SCOPE ⇒ `to-bql`) |
| ASSET_UNCLEAR | "Kiểm tra tại chỗ" (`resolveAssetAction`) |
| DUPLICATE | khung so sánh với `duplicate` + "Gộp" / "Không trùng" |
| SAFETY_REVIEW_REQUIRED | "Xác nhận an toàn" · "Hỏi thêm cư dân" · "Chuyển BQL" (`safetyAction`) — note bắt buộc |
| MISSING_INFO | chỉ xem ("Đang chờ cư dân bổ sung") |
### 3.2 Tab "Đã chuyển"
Ticket đã rời BPTN (stage ≥ 3 hoặc đang ở BQL), bảng bấm được.
### 3.3 Tab "Tất cả ticket" (R4)
MỌI ticket (kể cả hủy/gộp/đóng), bảng mã · mô tả · vị trí · trạng thái · phòng · giờ; lọc theo trạng thái; bấm mã ⇒ modal §7. Bỏ cột "Agent gợi ý".
### 3.4 Tab "Hiệu suất Agent": XOÁ (Agent cứng, R4).

## 4. Phòng ban (`app/cleaning`, `app/technical`)
### 4.1 Hàng việc
Thẻ: mã, mô tả, vị trí, giờ, khẩn cấp, `statusLabel`, `hoursLeft`, ảnh cư dân, bổ sung. Bỏ dòng "Agent nhận diện…" (R3 tinh thần "bỏ Agent cứng"), bỏ chọn nhân viên.
| stage/trạng thái | Nút |
|---|---|
| ROUTED | "Nhận việc" (`acceptAction`) · "Không phải việc phòng mình" (`returnAction`, note) |
| IN_PROGRESS | "Đánh dấu hoàn thành" (§4.4) · "Báo sai phòng ban" (`reportWrongDeptAction`, note) · kỹ thuật: "Yêu cầu vật tư" (§4.3) |
| ON_HOLD + WAITING_MATERIAL | nhãn "Chờ kho cấp vật tư" + danh sách thiếu |
### 4.2 Lịch sử (vệ sinh)
Ticket đã READY_FOR_REVIEW/CLOSED của phòng; sao đánh giá nếu có (`rating` từ chi tiết). Tab "Phân công tổ": XOÁ (00 §2).
### 4.3 Yêu cầu vật tư (kỹ thuật; R6, R7)
- Kỹ thuật KHÔNG có tab kho/tồn kho (R6). Tab "Yêu cầu vật tư" chỉ liệt kê vật tư đã yêu cầu theo ticket + trạng thái (đủ / chờ kho).
- Bấm "Yêu cầu vật tư" ⇒ modal: nhiều dòng; mỗi dòng chọn vật tư từ `catalog` (tên · đơn vị · tồn hiện tại, tô đỏ khi tồn 0) + số lượng; nút "+ Thêm dòng"; nút "+ Vật tư khác (ngoài danh sách)" ⇒ dòng nhập tên + đơn vị + số lượng (ẩn khi `custom_materials_enabled=false`); ghi chú bắt buộc. Gửi ⇒ `requestMaterialsAction` (01 §7). Thiếu tồn ⇒ backend chuyển `WAITING_MATERIAL`, thẻ hiện "Chờ kho cấp vật tư".
- Giao diện: modal rộng, dòng dạng thẻ, ô số lượng có nút −/+ (doc "chỉnh cho đẹp").
### 4.4 Form hoàn thành (R8, R9, R10)
Bấm "Đánh dấu hoàn thành" ⇒ modal riêng từng phòng:
- **Vệ sinh:** ảnh sau xử lý BẮT BUỘC (≥ 1; nút gửi khoá đến khi có ảnh) + checklist của playbook backend (`checklist`) + vật tư đã dùng (dòng `materials` có sẵn, nhập số dùng) + ghi chú.
- **Kỹ thuật:** checklist playbook + **checklist vật tư (R10): mỗi vật tư đã yêu cầu là một dòng "Đã lắp/dùng <tên> — số lượng dùng"; phải tích hết** + ảnh (≥ 1, backend yêu cầu) + ghi chú.
- Gửi ⇒ `finishTicketAction` (01 §7). Backend `complete` không đạt ⇒ hiện từng mục `failing_items` dịch tiếng Việt (bảng trong `backend-map.ts`: `checklist_complete`→"Chưa xong checklist", `photo_present`→"Thiếu ảnh sau xử lý", `materials_entered`→"Chưa nhập vật tư đã dùng", `variance_explained`→"Vật tư dùng khác định mức, cần ghi lý do", `no_open_blocker`→"Ticket đang bị chặn", `department_accepted`→"Chưa nhận việc"). Đạt ⇒ `READY_FOR_REVIEW` ("Chờ nghiệm thu") (R8).

## 5. Quản lý (`app/management`)
### 5.1 Phòng ban (R1)
Nhóm phụ tải chỉ có Phòng vệ sinh, Phòng kỹ thuật (nhãn ngắn "Phòng VS", "Phòng KT"); bấm ⇒ tab Tất cả lọc `dept`. Bỏ chip lọc "Ban quản lý" ở tab Tất cả và hàng BQL ở Hiệu suất (giữ "Việc của BQL" là tab riêng).
### 5.2 Ô tổng quan (R2) — mỗi ô bấm ⇒ tab Tất cả với bộ lọc tương ứng; số trên ô = đúng số dòng sau lọc
| Ô | Lọc |
|---|---|
| Tổng ticket | mọi ticket trừ MERGED |
| Chờ phân loại | stage 1–2 và không `cancelled` |
| Đang xử lý | stage 3–4 và không `cancelled` |
| Khẩn cấp chưa xong | `riskLevel==EMERGENCY` và stage < 6 và không `cancelled` |
| Quá hạn | `late` và không `cancelled` |
### 5.3 Tất cả ticket (R3)
Bảng mọi ticket; bấm BẤT KỲ mã nào ⇒ modal §7. Bỏ cột "Agent gợi ý".
### 5.4 Việc của BQL (R11)
Ba khối, mỗi khối là danh sách bấm được + nút:
1. **Chờ nghiệm thu** (READY_FOR_REVIEW): xem ảnh sau xử lý, checklist, vật tư (từ chi tiết); 2 mục tích hiện trường (giữ `SITE_CHECKS`) khoá nút; "Nghiệm thu đạt — Hoàn thành" (`approveInspectionAction`) · "Trả làm lại" (lý do). Có bộ lọc xem "Hoàn thành" (CLOSED) ngay trong khối ("view để nó có hoàn thành").
2. **Việc của BQL** (OUT_OF_SCOPE + escalated, mô tả "Ticket về phí, thủ tục, an ninh, tranh chấp cư dân. Có thể chuyển lại nếu không thuộc thẩm quyền."): "Đã xử lý xong" (note ⇒ `finishBqlTicketAction`) · "Chuyển lại Tiếp nhận" (`returnBqlTicketAction`).
3. **Cần BQL quyết**: khẩn cấp chờ BQL (EMERGENCY_PENDING_BQL: "Đóng khẩn cấp" / "Hạ mức") và báo sai phòng sau khi nhận (WRONG_DEPT_AFTER_START: "Giữ phòng" / "Chuyển về Tiếp nhận").
### 5.5 Hiệu suất phòng ban
Tính từ ticket: số đang xử lý, quá hạn, đã đóng, sao trung bình (`ratingStars`). Không có giờ hoàn thành nếu backend không trả — bỏ chỉ số đó thay vì bịa.

## 6. Kho (`app/warehouse`; R5)
- Tồn kho: bảng mã · tên · đơn vị · tồn (null ⇒ "Chưa rõ"); "Thêm vật tư" (tên, đơn vị, số lượng đầu ⇒ `addStockItemAction`; ẩn khi cờ tắt); "Nhập kho" (chọn vật tư, số lượng ⇒ `receiveStockAction`).
- Yêu cầu: ticket `WAITING_MATERIAL` với dòng thiếu (cần · tồn · còn thiếu); nút "Nhập đủ <vật tư>" điền sẵn số còn thiếu. Nhập đủ ⇒ backend chạy tiếp ticket ⇒ dòng biến mất sau refresh.
- Quản lý mở `/warehouse` chỉ xem (nút ghi ẩn; backend cũng 403).

## 7. `TicketDetailModal` (R3, R4)
Mở bằng server action đọc `ticketDetailAction(id)` (`GET /mo/tickets/{id}`, map 01 §5.6). Hiện: mã, trạng thái, khẩn cấp, giờ, phòng, vị trí, mô tả, `blockerLabel` + `publicMessage`, stepper, ảnh khi tiếp nhận / ảnh sau xử lý, checklist, vật tư, lịch sử (nhãn + ghi chú + vai). **KHÔNG có khối Agent** (bỏ "Phân tích Agent Thông Minh", độ tin cậy, từ khoá, kỹ năng).
