# SPEC-P02 — Màn Cư dân (`js/resident.js`)

Dữ liệu duy nhất: `ResidentTicketView` (`src/maintenance/views.py:81`). CẤM gọi `/mo/*` hoặc `/bql/*` từ màn này.

## §1. `#/r` — Danh sách "Phản ánh của tôi"
- Tải: `GET /resident/tickets`. Vòng tải lại SPEC-P01 §6 với loader này.
- Mỗi thẻ: mã ticket, 2 dòng đầu `description`, `status_label` (badge), `created_at`, `department_name` nếu có.
- Thẻ có `merged_into` ⇒ thêm dòng "Đã gộp vào <ticket_id>".
- Rỗng ⇒ "Bạn chưa gửi phản ánh nào" + nút "Gửi phản ánh".
- Nút nổi "+ Gửi phản ánh" ⇒ `#/r/new`.
- Chia trang: hiển thị 20 thẻ đầu + nút "Xem thêm" (+20), không gọi API thêm (cùng tinh thần plan 10).

## §2. `#/r/new` — Gửi phản ánh
Trường:
| Trường | Ràng buộc client | Gửi |
|---|---|---|
| Mô tả (textarea) | bắt buộc, trim ≥ 10 ký tự; gợi ý "Nêu rõ tòa, tầng, vị trí và sự cố" | `original_description` |
| Ảnh | 0–5 ảnh, xem trước dạng lưới, xoá được từng ảnh | bước 2 |

Luồng BẮT BUỘC theo thứ tự:
1. Bấm "Gửi" ⇒ khoá form (I-5), nhãn nút "Đang gửi và phân loại…".
2. `POST /resident/tickets` `{original_description, channel: "app"}` (timeout `WRITE_TIMEOUT_MS`).
3. Có ảnh ⇒ nén từng ảnh (SPEC-P01 §8) ⇒ MỘT `POST /resident/tickets/{id}/photos` gửi tất cả.
4. Xong ⇒ toast "Đã gửi phản ánh <id>" ⇒ `#/r/<id>`.

Lỗi:
| Bước lỗi | Hành vi |
|---|---|
| Bước 2 `timeout` | KHÔNG gửi lại; gọi `GET /resident/tickets`; nếu có ticket mới cùng `description` tạo trong 3 phút ⇒ coi là đã gửi, mở nó; không có ⇒ mở khoá form, giữ nội dung, báo "Chưa gửi được, thử lại" |
| Bước 2 lỗi khác | Bảng `01-CONTRACTS` §7; mở khoá form, giữ nội dung + ảnh |
| Bước 3 lỗi | Ticket ĐÃ tồn tại ⇒ vẫn chuyển `#/r/<id>`, toast cảnh báo "Đã gửi phản ánh nhưng ảnh chưa tải lên — bấm Thêm ảnh để thử lại". KHÔNG tạo ticket mới |

## §3. `#/r/<id>` — Chi tiết
- Tải `GET /resident/tickets/{id}`; tải lại định kỳ như §1.
- Khối đầu: mã, badge `status_label`, `public_message` (nổi bật), `department_name`, `eta` (nếu có, "Dự kiến xong: …").
- Thanh tiến trình 6 bước theo `RESIDENT_STEPS` (`src/web/app.js:93`): RECEIVED → VERIFYING → ROUTED → IN_PROGRESS → READY_FOR_REVIEW → CLOSED.
  Trạng thái phụ `NEED_INFO`/`ON_HOLD` ⇒ đánh dấu ở bước VERIFYING kèm `status_label` (Bậc 1/Bậc 2 là mã blocker, status vẫn `VERIFYING` —
  cư dân chỉ thấy `public_message`); `CANCELLED`/`MERGED` ⇒ thay thanh bằng dòng kết thúc.
- Nội dung đã gửi: `description` + `additions[]` (cũ → mới) + lưới ảnh `photos[]` (tải qua `GET …/photos/{evidence_id}` kèm Bearer, hiển thị `blob:` URL, giải phóng URL khi rời màn).
- Liên kết: `split_from`, `split_into[]`, `follow_up_of` (cùng cư dân) ⇒ dòng bấm được tới `#/r/<id kia>` (404 ⇒ toast).
  `merged_into` có thể là ticket của người khác ⇒ hiện tại chỗ (mã, `status_label`, `public_message`), KHÔNG làm liên kết.
- Timeline: `timeline[]` mới nhất trên cùng, mỗi dòng `status_label` · `public_message` · thời gian.

## §4. Hành động
| Điều kiện | UI | Gọi |
|---|---|---|
| `"ADD_INFO"` ∈ `allowed_actions` (server chỉ cho khi `NEED_INFO`) | Ô nhập "Bổ sung thông tin" + nút Gửi | `POST …/additions` `{content}` |
| `status` ∉ {CLOSED, MERGED, CANCELLED} và `photos.length < 5` | Khối "Thêm ảnh" (còn lại `5 - photos.length`) — theo guard `engine.add_resident_photo` (chỉ chặn ticket đã kết thúc), KHÔNG theo `ADD_INFO` | `POST …/photos` |
| `"RATE"` ∈ `allowed_actions` | 5 sao + nút "Gửi đánh giá"; gửi xong ẩn (đánh giá một lần, server chặn lần 2 ⇒ 409 hiện thông điệp) | `POST …/rating` `{score}` |

Sau mỗi ghi thành công ⇒ vẽ lại từ body trả về (I-2).

## §5. CẤM
- Hiện trường nội bộ (phòng ban đề xuất, priority, blocker nội bộ, audit) — API cư dân đã không trả, app không lấy bù từ chỗ khác.
- Tự đổi badge/thanh bước trước khi server trả.
- Cho cư dân chọn phòng ban/mức khẩn cấp (engine tự quyết).
