# SPEC-P03 — Từng màn theo doc anh Cố + trả lời người dùng 2026-10-09 (WP3–WP5, 🟠)

Giữ bố cục/thiết kế hiện có của từng `*-app.tsx` (UI mới = portal Next.js của Trí, mở qua cổng 8000 — Q19); chỉ đổi nguồn dữ liệu và những gì doc/người dùng yêu cầu. Doc chỉ là tham khảo hình ("không dùng nguyên form") — giữ ngôn ngữ thiết kế portal. Quyết định: plan.md Q08–Q19.

## 1. Chung
- `code` = `ticket_id` backend (Q18). Bấm mã/dòng ticket ⇒ `TicketDetailModal` (§7) ở MỌI màn nhân viên (Q11).
- Nút chỉ hiện khi trạng thái cho phép (01 §7, SPEC-P04); backend từ chối ⇒ hiện message backend (I-02).
- `urgent` (01 §3) hiện nhãn "Khẩn cấp" cho nhân viên; cư dân không thấy.

## 2. Cư dân (`app/resident`)
- Danh sách/chi tiết: stepper `stage`, `statusLabel`, `publicMessage`, timeline, bổ sung, ảnh, `deptName`.
- Gửi phản ánh: **Tiêu đề** (bắt buộc, 5–120 ký tự, Q14) + **Nội dung góp ý** (10–2000) + chọn nơi (`PLACE_DEFS`) + ≤ 5 ảnh. Gửi lên backend `original_description = "<tiêu đề>\n<nội dung>\nVị trí: <nơi>"`; portal tách lại tiêu đề = dòng 1, nội dung = giữa, vị trí = dòng "Vị trí:". Bỏ dự đoán từ khoá khi gõ, bỏ nút khẩn cấp (Q17).
- Nút: "Bổ sung" khi `needInfo`; "Đánh giá" khi `canRate`: sao 1–5 + thẻ (`GOOD_TAGS` khi ≥ 4, `BAD_TAGS` khi ≤ 3) + bình luận ≤ 500 (Q17, SPEC-P04 §4). Bỏ "Xác nhận hoàn tất", "Chưa đạt", "Hủy" (Q17).
- Tab Thông báo: ẩn (hoãn).

## 3. Tiếp nhận (`app/reception`) — giữ 3 tab cũ (Q10, Q11)
### 3.1 "Chờ phân loại"
Ticket có blocker chủ BPTN (chưa chuyển BQL). Thẻ: mã, tiêu đề, nội dung, vị trí, giờ, `blockerLabel`, mức an toàn, ảnh, bổ sung, **khối Agent thật** (phòng đề xuất + lý do ngắn từ `agent_decision`, nguồn; Agent lỗi ⇒ "Agent không quyết được — luật cố định"). Nút theo blocker:
| blocker | Nút |
|---|---|
| CATEGORY_UNCLEAR, OUT_OF_SCOPE, PENDING_REVIEW, WRONG_DEPT | "Phòng vệ sinh" · "Phòng kỹ thuật" · "Ban quản lý" (chỉ OUT_OF_SCOPE ⇒ `to-bql`) |
| ASSET_UNCLEAR | "Kiểm tra tại chỗ" |
| DUPLICATE | so sánh với ticket nghi trùng + "Gộp" / "Không trùng" |
| SAFETY_REVIEW_REQUIRED | "Xác nhận an toàn" · "Hỏi thêm cư dân" · "Chuyển BQL" (note bắt buộc) |
| MISSING_INFO | chỉ xem ("Đang chờ cư dân bổ sung") |
### 3.2 "Đã phân loại"
Ticket đã rời BPTN (đã giao phòng, đang ở BQL, đã đóng/hủy/gộp). Bảng; bấm dòng ⇒ modal §7.
### 3.3 "Hiệu suất Agent" (giữ, dữ liệu thật — ảnh người dùng 2026-10-09)
4 ô: Ticket đã chuyển · Agent gợi ý đúng (%) · Số lần nhân viên sửa · Chờ cư dân bổ sung — **thêm 2 số: "Agent đúng: N lần" và "Agent sai: M lần"** (định nghĩa SPEC-P04 §5). Danh sách "Các lần nhân viên sửa gợi ý của Agent": mã · phòng Agent đề xuất → phòng cuối; bấm mã ⇒ modal.

## 4. Phòng ban (`app/cleaning`, `app/technical`)
### 4.1 Hàng việc
Thẻ: mã, tiêu đề, nội dung, vị trí, giờ, khẩn cấp, `statusLabel`, `hoursLeft`, ảnh cư dân, bổ sung, nhân viên được giao.
| Trạng thái | Nút |
|---|---|
| ROUTED | "Phân công" (chọn tổ/kỹ thuật viên từ `GET /mo/staff`; phân công = nhận việc, SPEC-P04 §3) · "Không phải việc phòng mình" (note) |
| IN_PROGRESS | "Đánh dấu hoàn thành" (§4.4) · "Báo sai phòng ban" (note) · đổi người · kỹ thuật: "Yêu cầu vật tư" (§4.3) |
| ON_HOLD + WAITING_MATERIAL | "Chờ cấp trên duyệt vật tư" (đã đủ kho) hoặc "Chờ kho nhập hàng" (thiếu) + danh sách |
### 4.2 Phân công tổ (vệ sinh) / Lịch sử
Giữ tab "Phân công tổ" (tải theo nhân viên = số ticket mở) và "Lịch sử" (READY_FOR_REVIEW/CLOSED + sao/thẻ/bình luận, không danh tính cư dân).
### 4.3 Yêu cầu vật tư (kỹ thuật; R6, R7, Q15)
- Kỹ thuật KHÔNG có tab kho/tồn kho (R6 — CHỈ bỏ ở site kỹ thuật; BQL và Kho giữ, §6).
- Bấm "Yêu cầu vật tư" ⇒ modal nhiều dòng: chọn vật tư từ catalog (tên · đơn vị · tồn, tô đỏ khi 0) + số lượng (nút −/+); "+ Thêm dòng"; "+ Vật tư khác (ngoài danh sách)" ⇒ dòng nhập tên + đơn vị + số lượng (ẩn khi `custom_materials_enabled=false`); ghi chú bắt buộc. Gửi ⇒ ticket chờ cấp trên duyệt (Q15).
- Tab "Yêu cầu vật tư": vật tư đã yêu cầu theo ticket + trạng thái (chờ duyệt / chờ nhập hàng / đã cấp).
### 4.4 Form hoàn thành (R8, R9, R10, Q16)
- **Vệ sinh:** ảnh sau xử lý BẮT BUỘC (≥ 1) + checklist playbook + vật tư đã dùng + ghi chú.
- **Kỹ thuật:** checklist playbook + **checklist vật tư: mỗi vật tư đã cấp là một dòng "Đã dùng <tên> — số lượng", phải tích hết** + ảnh (≥ 1) + ghi chú.
- Gửi ⇒ `finishTicketAction`; không đạt ⇒ hiện `failing_items` dịch tiếng Việt; đạt ⇒ "Chờ nghiệm thu" (Q13).

## 5. Quản lý (`app/management`)
### 5.1 Điều phối và phụ tải phòng ban (R1, Q12)
Chỉ Phòng vệ sinh, Phòng kỹ thuật (bỏ hàng Ban quản lý). Bấm ⇒ tab Tất cả lọc `dept` + "chưa xử lý xong" (stage < 5, không hủy) — ticket Tiếp nhận đã điều phối mà phòng chưa xử lý được; chip "Tất cả" trong tab để xem cả đã xong/hủy. Bỏ chip lọc "Ban quản lý" ở tab Tất cả.
### 5.2 Ô tổng quan BẤM ĐƯỢC (R2) — số trên ô = số dòng sau lọc
| Ô | Lọc |
|---|---|
| Tổng ticket | mọi ticket trừ MERGED |
| Chờ phân loại | stage 1–2, không hủy, không phải Việc của BQL |
| Đang xử lý | stage 3–4, không hủy (KHÔNG gồm Chờ nghiệm thu — Q12) |
| Khẩn cấp chưa xong | `riskLevel == EMERGENCY`, stage < 6, không hủy |
| Quá hạn | `late`, không hủy |
Cả ô (không chỉ số) là nút: con trỏ tay, `role="button"`, Enter/Space, focus ring.
### 5.3 Tất cả ticket (R3)
Bảng mọi ticket; bấm BẤT KỲ dòng/mã ⇒ modal §7. Cột "Agent gợi ý" hiện phòng Agent đề xuất THẬT (`agent_department`, không %).
### 5.4 Việc của BQL (R11, Q13, Q14)
Lọc trên cùng: **Đã tiếp nhận · Đã hoàn thành · Tất cả** (mặc định Đã tiếp nhận). Ba khối:
1. **Chờ nghiệm thu** (READY_FOR_REVIEW): ảnh sau xử lý, checklist, vật tư; 2 mục tích hiện trường khoá nút; "Nghiệm thu đạt — Hoàn thành" · "Trả làm lại" (lý do). Lọc "Đã hoàn thành" hiện ticket đã CLOSED.
2. **Việc của BQL** (OUT_OF_SCOPE + escalated, do Agent hoặc Tiếp nhận chuyển — hiện "Agent chuyển"/"Tiếp nhận chuyển"): mỗi dòng **tiêu đề + nội dung góp ý** + vị trí + giờ; "Đã xử lý xong" (note) ⇒ Hoàn thành · "Chuyển lại Tiếp nhận".
3. **Cần BQL quyết**: khẩn cấp chờ BQL (đóng / hạ mức) và báo sai phòng sau khi nhận (giữ phòng / chuyển về Tiếp nhận).
### 5.5 Hiệu suất phòng ban
Đang xử lý, quá hạn, đã đóng, sao trung bình, giờ hoàn thành trung bình (`closed_at − accepted_at`), theo phòng VS/KT.
### 5.6 Kho
Lối vào "Kho vật tư" ⇒ `/warehouse` đầy đủ quyền (Q08).

## 6. Kho (`app/warehouse`; R5, Q08, Q15) — vai kho và quản lý
- Tồn kho: mã · tên · đơn vị · tồn; "Thêm vật tư" (tên, đơn vị, số lượng đầu); "Nhập kho".
- Yêu cầu vật tư: ticket `WAITING_MATERIAL` — dòng cần · tồn · còn thiếu; nút **"Duyệt cấp"** (`POST /mo/tickets/{id}/materials/approve`; khoá + gợi ý "Nhập kho trước" khi thiếu); "Nhập đủ <vật tư>" điền sẵn số thiếu.

## 7. `TicketDetailModal` (R3, R4, Q10)
Mở bằng `ticketDetailAction(id)` (`GET /mo/tickets/{id}`). Hiện: mã, trạng thái, khẩn cấp, giờ, phòng, nhân viên, vị trí, tiêu đề, nội dung, `blockerLabel` + `publicMessage`, stepper, ảnh khi tiếp nhận / sau xử lý, checklist, vật tư, đánh giá, lịch sử. **Khối "Phân tích Agent" = dữ liệu thật** (SPEC-P04 §5): nguồn (Agent LLM / luật dự phòng), model, phòng đề xuất, mức an toàn Agent + trích dẫn, các bước suy luận, bất đồng với luật. Không có quyết định ⇒ "Chưa có quyết định của Agent". CẤM số/từ khoá/% viết cứng.
