# OPERATIONS — Triển khai và rollback

## 1. Thứ tự bắt buộc

1. Merge code (không có migration Alembic: schema `maintops` không đổi, field mới nằm trong `cases.doc` JSONB).
2. Khởi động backend. Ticket cũ đọc được: field mới lấy mặc định; khoá `reopen_until` cũ bị bỏ khi đọc.
3. Ticket cũ đã qua bước 3b không được đánh giá an toàn lại (không có lần chạy pipeline mới). Muốn áp tầng an toàn cho
   dữ liệu demo: QA chạy `POST /api/v1/mo/reset` (chỉ khi `MO_ALLOW_RESET=true`) — XOÁ toàn bộ dữ liệu, hỏi người trước.
4. `dataset_version` đổi `maintenanceops-sim-v1.3` (kết quả mong đợi CLN-004, TEC-005 đổi).

## 2. Kiểm sau deploy

| Lệnh | Kỳ vọng |
|---|---|
| `GET /api/v1/bql/tickets` (tài khoản `bql01`) | 200, có field `risk_level`, `priority` |
| `POST /api/v1/mo/evaluate` (QA, môi trường memory) | `passed == total` |

## 3. Rollback

- Quay commit. Doc đã ghi field mới (`risk_level`, `priority`…) sẽ làm code cũ lỗi (`extra="forbid"`) ⇒ rollback
  trên DB dùng chung PHẢI kèm reset dữ liệu demo (hỏi người trước) hoặc giữ bản mới.
- Memory mode: rollback tự do.

## 4. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Hai ticket khoá chéo nhau trên Postgres (gộp A↔B cùng lúc) | Khoá ticket thứ hai trong cùng transaction; xung đột ⇒ `ConcurrencyError`/deadlock ⇒ 409, người thao tác lại |
| Báo nhầm khẩn cấp làm tràn BQL | Đo trên bộ ≥40 câu (TESTING §3); BQL hạ bằng `emergency_downgrade` |
