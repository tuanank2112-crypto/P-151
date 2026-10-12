# WP3 spec-check — SPEC-P03 §2–§3 (tự đối chiếu; ảnh trong cùng thư mục, kèm hậu tố -1440 / -390)

Nguồn đo: `ui-check.txt` (script `portal/scripts/ui-check-WP3.mts`, base http://localhost:3000, EXIT=0, số PASS ghi trong ui-check.txt, 0 FAIL) và `checks.txt`.

## §2 Cư dân
| Dòng SPEC | Kết quả | Chứng minh |
|---|---|---|
| Danh sách/chi tiết: stepper `stage`, `statusLabel`, `publicMessage`, timeline, bổ sung, ảnh, `deptName` | đạt (đã có từ trước, giữ nguyên; chi tiết thêm đoạn nội dung) | resident-mine-new; check "detail shows stepper/history/content/location" |
| Ô Tiêu đề bắt buộc 5–120 | đạt | resident-compose-empty/filled; check "empty title blocked", "title < 5 blocked" |
| Ô Nội dung góp ý 10–2000 | đạt | check "content < 10 blocked" |
| Chọn nơi (`PLACE_DEFS`) + ≤ 5 ảnh | đạt (giữ nguyên) | resident-compose-filled |
| Gửi `"<tiêu đề>\n<nội dung>\nVị trí: <nơi>"`; portal tách lại | đạt | check "submit shows ticket code", "new ticket title in list", "detail shows title/content/location" (ticket SIM-TKT-000x tạo thật trên backend) |
| Bỏ dự đoán từ khoá khi gõ, bỏ nút khẩn cấp, bỏ câu mẫu điền sẵn | đạt | check "no urgent button / keyword prediction" |
| Nút "Bổ sung" khi `needInfo` (form chỉ hiện khi needInfo) | đạt ở mã; CHƯA chạy trình duyệt | dữ liệu hiện tại không có ticket NEED_INFO của `cudan` (SKIP trong ui-check.txt) |
| Nút "Đánh giá" khi `canRate`: sao 1–5 + thẻ GOOD (≥4) / BAD (≤3) + bình luận ≤ 500; hiện lại sao/thẻ/bình luận sau khi đã đánh giá | đạt ở mã + typecheck; CHƯA chạy trình duyệt | không có ticket `canRate` trong dữ liệu (SKIP); script có sẵn nhánh kiểm khi dữ liệu có |
| Bỏ "Xác nhận hoàn tất", "Chưa đạt", "Hủy" | đạt | check "no confirm/cancel buttons" |
| Tab Thông báo ẩn | đạt (không có tab); chuông thông báo trên header (component dùng chung) giữ nguyên | check "no 'Thong bao' tab" |

## §3 Tiếp nhận
| Dòng SPEC | Kết quả | Chứng minh |
|---|---|---|
| Giữ 3 tab: Chờ phân loại · Đã phân loại · Hiệu suất Agent | đạt | check "exactly 3 tabs"; reception-inbox/done/perf |
| §3.1 Thẻ: mã, tiêu đề, nội dung, vị trí, giờ, `blockerLabel`, mức an toàn, ảnh, bổ sung | đạt | reception-step0; check "card shows content/location/blocker label" |
| §3.1 Khối Agent thật; không có quyết định ⇒ "Chưa có quyết định của Agent"; Agent lỗi ⇒ "Agent không quyết được — luật cố định" (lấy `agent.reason` từ DTO) | đạt cho trường hợp không có quyết định (dữ liệu hiện tại); nhánh có quyết định chưa quan sát được | reception-step0; backend memory chưa trả `agent_decision` |
| CATEGORY_UNCLEAR / OUT_OF_SCOPE / PENDING_REVIEW / WRONG_DEPT ⇒ Phòng vệ sinh · Phòng kỹ thuật · Ban quản lý (chỉ OUT_OF_SCOPE) | đạt ở mã; chưa có thẻ loại này trong dữ liệu | — |
| ASSET_UNCLEAR ⇒ "Kiểm tra tại chỗ" | đạt | reception-step1 (bấm xong, ticket rời hàng đợi, sang "Đã phân loại") |
| DUPLICATE ⇒ so sánh hai ticket + "Gộp" / "Không trùng" | đạt | reception-step0 (khối cạnh nhau); bấm "Không trùng" chạy ở step 0 |
| SAFETY_REVIEW_REQUIRED ⇒ "Xác nhận an toàn" · "Hỏi thêm cư dân" · "Chuyển BQL" (note bắt buộc) | đạt ở mã; chưa có thẻ loại này trong dữ liệu | — |
| MISSING_INFO ⇒ chỉ xem "Đang chờ cư dân bổ sung" | đạt | reception-step0 (thẻ SIM-TKT-CLN-003) |
| §3.2 Đã phân loại: bảng ticket đã rời BPTN, bấm dòng/mã ⇒ modal | đạt | reception-done, reception-done-modal; check "row opens detail modal", "click on row cell opens modal" |
| §3.3 4 ô + "Agent đúng: N lần" + "Agent sai: M lần" | đạt | reception-perf; 6 check "reception perf: tile ..." |
| §3.3 Danh sách các lần nhân viên sửa: mã · phòng Agent → phòng cuối, bấm mã ⇒ modal | đạt ở mã (rỗng ⇒ "Chưa có lần sửa nào."); chưa có dòng sửa trong dữ liệu | reception-perf |
| Mọi phần tử bấm được là `button`, focus ring, con trỏ tay | đạt | mã: `FOCUS` (focus-visible outline) + `cursor-pointer`; dòng bảng có thêm onClick chuột, bàn phím đi qua nút mã/tiêu đề |
| Không tràn ngang @1440 và @390 | đạt | mọi check "no horizontal overflow" trong ui-check.txt |
