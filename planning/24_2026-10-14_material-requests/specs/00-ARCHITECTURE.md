# 00 — Kiến trúc

## 1. Hiện trạng (khảo sát 2026-10-14 trên `fc434d6`)
- Bước 7 thiếu tồn ⇒ ticket `ON_HOLD / WAITING_MATERIAL` (chủ `WAREHOUSE`, `resume_step=6`) nhưng **không tạo gì, không báo kho**; chỉ job nhắc sau và leo thang BQL.
- Phòng ban đang làm (`IN_PROGRESS`) **không có cách báo thiếu**: bảng chuyển trạng thái cho phép `IN_PROGRESS → ON_HOLD` lý do `WAITING_MATERIAL` nhưng không method/route nào dùng; "Tạm hoãn" chỉ ra `BLOCKED_ONSITE`.
- `receive_stock` tự `resume` ticket đang chờ mã đó (đủ ⇒ chạy tiếp; phòng ban đã nhận ⇒ về `IN_PROGRESS`), nhưng **không báo ai**, trừ `StockAlert` cho riêng Phòng Kỹ thuật khi tồn trước ≤ 0.
- Portal kho không có hàng chờ phiếu (`server/data/warehouse.ts` dựng `requests` nhưng UI không vẽ). App kho có danh sách ticket chờ vật tư ở tab "Nhập vật tư".

## 2. Mục tiêu
1. Mỗi ticket thiếu vật tư có một **phiếu vật tư** kho nhìn thấy ngay (portal + app), tự đóng khi đủ.
2. Phòng ban đang làm báo thiếu được bằng một thao tác.
3. Kho nhập ⇒ phòng ban của ticket đang chờ được báo (portal + app), biết ticket nào đã chạy tiếp, ticket nào vẫn thiếu.

## 3. Non-goals
- Không duyệt cấp, không đặt mua, không ETA nhà cung cấp, không thêm mã vật tư mới.
- Không đẩy thông báo ra ngoài (Zalo/SMS/push). Không báo cư dân riêng.

## 4. Bất biến
| # | Luật |
|---|---|
| I-1 | Phiếu chỉ là khung nhìn: tồn tại ⇔ ticket `ON_HOLD` + blocker `WAITING_MATERIAL` chưa gỡ. **CẤM** bảng/tài liệu phiếu riêng |
| I-2 | Không bước duyệt: `_material_approval_required()` giữ False; gỡ blocker chỉ do tồn đủ (`_cleared`) |
| I-3 | Báo thiếu chỉ khi THỰC SỰ thiếu: sau khi ghi kế hoạch, ít nhất một dòng `INSUFFICIENT`; ngược lại từ chối, không đổi gì |
| I-4 | Thông báo kho nhập ghi CÙNG giao dịch với `add_stock` (như plan 20) |
| I-5 | Mỗi lần nhập tạo tối đa MỘT thông báo cho mỗi phòng ban |
| I-6 | Phòng ban chỉ đọc/ack thông báo của phòng mình; kho chỉ đọc; BQL đọc mọi phòng |

## 5. Vùng cấm
- **Không tạo bảng `material_requests`** — hai nguồn sự thật (phiếu mở mà ticket đã chạy tiếp) là lỗi khó dò; xem M02.
- **Không bật lại `approve_materials`/luồng duyệt** — người dùng đã bỏ (plan 15/16).
- **Không lưu "đủ/chưa đủ" vào thông báo** — tồn đổi sau đó; tính lúc đọc từ ticket.
- **Không để báo thiếu chặn khi kho đủ** — thiếu thật mới dừng việc (I-3).

## 6. Thứ tự đọc
01-CONTRACTS → P01 → P02 → P03 → OPERATIONS → TESTING-ACCEPTANCE.
