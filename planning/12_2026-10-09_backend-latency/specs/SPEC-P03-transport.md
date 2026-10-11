# SPEC-P03 — Truyền tải: gzip JSON, job không đọc thừa

## §1. Gzip
- `GZipMiddleware(minimum_size=1024)` trong `src/main.py`, thêm SAU CORS (Starlette chạy middleware thêm sau ở NGOÀI cùng — gzip bọc ngoài).
- Chỉ nén khi client gửi `Accept-Encoding: gzip` (trình duyệt luôn gửi). Body < 1 KB không nén.
- Ảnh: route gắn `Content-Encoding: identity` ⇒ middleware bỏ qua (V6).
- Đo: danh sách 54–69 KB ⇒ ~4 KB trên dây.

## §2. `run_jobs`
`if len(self.repo.get(ticket_id).events) != before` ⇒ dùng `Case` mà `_mutate` trả về (`len(updated.events)`), bỏ một lần đọc DB mỗi ticket
đến hạn trong lúc giữ `engine.lock`. Ngữ nghĩa giữ nguyên: ticket bị từ chối (`_Denied`) ⇒ `_mutate` ném ⇒ không vào `changed` (như cũ: except).

## §3. BẮT BUỘC / CẤM
- CẤM đổi thứ tự/điều kiện `changed` của `run_jobs` (test job hiện có là trọng tài).
- CẤM nén phản hồi lỗi bằng cách khác middleware (để chung một đường).

## §4. Test
- Z1 `GET /api/v1/resident/tickets` (>1 KB) với `Accept-Encoding: gzip` ⇒ `content-encoding: gzip`, giải nén khớp JSON không nén.
- Z2 `/health` (<1 KB) ⇒ không nén. Z3 ảnh ⇒ không nén, bytes nguyên vẹn.
