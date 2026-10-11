# SPEC-P03 — Màn BQL trên điện thoại (`js/bql.js`)

Bản gọn của `renderBql` (`src/web/app.js:1766`). Web vẫn là màn BQL đầy đủ (bộ lọc chi tiết, AI trace, audit, hiệu suất).

## §1. `#/b` — Danh sách
- Tải MỘT lần `GET /bql/tickets` không query; lọc ở client (không dùng query `blocker_owner_role` — roadmap ghi lọc này đang bị bỏ qua ở server).
- Ẩn ticket mẫu như web: `isSeedTicket(id)` = `/-(CLN|TEC)-/i` (`src/web/app.js:108`).
- 3 tab trên đầu (đếm số trong ngoặc):
| Tab | Điều kiện trên `BqlTicketRow` |
|---|---|
| **Cần tôi** (mặc định) | `isEmergency(r)` HOẶC `r.status === 'READY_FOR_REVIEW'` HOẶC `r.blocker_owner_role === 'BQL'` HOẶC `isEscalatedSafety(r)` |
| **Khẩn cấp** | `isEmergency(r)` |
| **Tất cả** | mọi dòng (đã ẩn seed) |
  - `isEmergency(r)` = `r.status === 'EMERGENCY_PENDING_BQL' || r.blocker?.code === 'EMERGENCY_PENDING_BQL'`
  - `isEscalatedSafety(r)` = `r.blocker?.code === 'SAFETY_REVIEW_REQUIRED' && (r.escalated || r.status === 'SAFETY_REVIEW_REQUIRED')` (điều kiện web `app.js` khối BQL)
- Thứ tự: giữ thứ tự server (khẩn cấp trên cùng), không sắp lại.
- Thẻ: mã, `status_label`, phòng ban (`department_id` → tên từ `GET /mo/catalog` nạp một lần), cờ `overdue` ("Quá hạn"), `escalated` ("Đã leo thang"), `rework_count > 0` ("Làm lại ×n"), thẻ khẩn cấp viền đỏ.
- 20 thẻ + "Xem thêm"; tải lại định kỳ SPEC-P01 §6.

## §2. `#/b/<id>` — Chi tiết
- Gọi song song `GET /mo/tickets/{id}` (`Case`) + `GET /bql/tickets` (lấy dòng `BqlTicketRow` cùng `ticket_id`). Điều kiện nút §3 và cờ
  (`status`, `blocker`, `escalated`, `rework_count`, `overdue`) đọc từ **dòng `BqlTicketRow`**; nội dung hiển thị đọc từ `Case`.
  Không còn dòng nào khớp ⇒ coi như 404 (bảng lỗi). Hiện: mô tả gốc + bổ sung, trạng thái, phòng ban, priority, `blocker` (mã + thông điệp), ảnh cư dân và ảnh thực hiện (qua `/mo/tickets/{id}/photos/{evidence_id}`), timeline `events` (20 dòng mới nhất).
- Nút "Mở bản web đầy đủ" ⇒ `/ui/` (tab mới).

## §3. Hành động — điều kiện hiện nút (server vẫn là trọng tài; 403/409 ⇒ bảng lỗi)
| Nút | Hiện khi | Gọi | Bắt buộc nhập | Xác nhận |
|---|---|---|---|---|
| Nghiệm thu | `status === 'READY_FOR_REVIEW'` | `POST /bql/tickets/{id}/close` `{}` | — | không |
| Trả làm lại | `status === 'READY_FOR_REVIEW'` | `…/rework` `{note}` | lý do | có; nếu `rework_count >= 2` thêm câu "Đây là lần trả thứ 3" |
| Đã xử lý khẩn cấp — đóng | `isEmergency` | `…/emergency/close` `{note}` | ghi chú (khuyến nghị) | có |
| Báo động giả — hạ mức | `isEmergency` | `…/emergency/downgrade` `{note}` | lý do | có |
| Hủy phản ánh | `status` ∉ {`CLOSED`,`MERGED`,`CANCELLED`} | `…/cancel` `{cancel_reason}` | lý do | có |

Ticket an toàn Bậc 2 đã leo thang (`isEscalatedSafety`): app CHỈ hiển thị + nút "Xử lý trên web" (form an toàn có nhiều trường — ngoài phạm vi đợt này, xem vùng cấm).
Sau thành công ⇒ toast + tải lại chi tiết và danh sách (I-2).

## §4. Vùng cấm
| Không làm | Lý do |
|---|---|
| Form an toàn Bậc 2 (`/mo/tickets/{id}/safety`), đổi priority, AI trace, audit, hiệu suất | Nhiều trường/bảng, phù hợp màn lớn; web đã có |
| Bộ lọc phòng ban/trạng thái chi tiết | 3 tab đủ cho việc "cần tôi"; web có lọc đủ |
| Ẩn nút theo suy đoán ngoài bảng §3 | Server là trọng tài, tránh lệch luật |
