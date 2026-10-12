# 00 — Kiến trúc: giảm độ trễ backend (đọc DB, ảnh, truyền tải)

## §0. Router đọc
1. File này → 2. `01-CONTRACTS.md` → 3. `SPEC-P01-read-engine.md`, `SPEC-P02-photos.md`, `SPEC-P03-transport.md` → 4. `OPERATIONS.md`, `TESTING-ACCEPTANCE.md`.
Đọc kèm (bối cảnh): `planning/09_2026-10-08_backend-speed/` (cache `list()` theo `xmin`), `planning/01_2026-10-02_supabase-persistence/specs/01-CONTRACTS.md` §2 (pool ≤5 kết nối).

## §1. Số đo trước (2026-10-09, `evidence/before/probe-8000.txt`, đo TRONG container, Supabase ap-southeast-1)
| Đo | Giá trị |
|---|---|
| Vòng mạng container → Supabase | ~55 ms (TCP connect 54–61 ms; `select 1` trên kết nối đang mở 55 ms) |
| Mọi GET chạm DB (1 câu SQL) | 226–236 ms median = 4 vòng: pre-ping `SELECT 1` + `BEGIN` + query + `ROLLBACK` khi trả kết nối |
| Engine đọc thử nghiệm `isolation_level=AUTOCOMMIT` | pre-ping bật: 95 ms; tắt: 52 ms (cùng câu SQL) |
| Ảnh xem lại | 527 ms median, max 1386 ms (backend tải lại từ Supabase Storage mỗi lần) |
| Body danh sách | 54–69 KB, không nén; gzip ⇒ ~4 KB |
| Route ảnh | `async def` gọi Storage đồng bộ (httpx, timeout 30 s, `time.sleep` 0,5 + 1 s khi lỗi) + N transaction ghi DB TRÊN event loop (đọc code) |

## §2. Mục tiêu
- G-1 Mọi GET đọc DB ≤ 120 ms median trong container (từ ~230 ms).
- G-2 Gửi ảnh không chặn request khác: `/health` trả < 300 ms khi một upload đang chờ Storage chậm 1 s.
- G-3 N ảnh trong một request = MỘT `_mutate` (một transaction), tất cả hoặc không ảnh nào.
- G-4 JSON > 1 KB nén gzip khi client hỗ trợ; ảnh không bị nén lại.
- G-5 Ảnh xem lại không đi Supabase Storage (cache trong tiến trình). ~~trình duyệt không hỏi lại (`immutable`)~~ — THAY bởi Q10 (R01 #2/#3): trình duyệt LUÔN hỏi lại (`no-cache` + `ETag`), server kiểm quyền rồi trả 304. CẤM header ảnh cho trình duyệt dùng lại bytes không hỏi server (`max-age`, `immutable`): cache trình duyệt không kiểm quyền.
- G-6 Không đổi API (path, body, mã lỗi), schema DB, luật nghiệp vụ; 3349 test hiện có vẫn xanh.

## §3. Non-goals
Khoá theo ticket thay `engine.lock`; bỏ audit/notifications khỏi doc (đổi schema); endpoint mới (`/bql/tickets/{id}`); gỡ route mẫu `/api/v1/chat`
(phải xoá test); agent chạy nền; session lưu DB.

## §4. Bất biến (BẮT BUỘC)
- **I-1** Đọc ngoài transaction (`get`, `list`, `stock`, `stock_of`, `count`, `version_of`, `run_number`, `log_rows`, `notification_rows`,
  `next_ticket_number`) đi qua engine ĐỌC (`AUTOCOMMIT`); `transaction()`, `get_for_update`, ghi, lease, `wipe`, `set_stock` giữ engine GHI.
- **I-2** Mỗi tiến trình ≤ 5 kết nối Supabase: GHI `pool_size=2, max_overflow=0`; ĐỌC `pool_size=2, max_overflow=1`.
- **I-3** Đọc thử lại ĐÚNG MỘT lần khi lỗi là rớt kết nối (`DBAPIError.connection_invalidated`); lỗi khác dịch như cũ (`_db_errors`).
- **I-4** Không I/O đồng bộ (Storage, DB, engine) trong thân `async def` của route; chỉ `await file.read()` ở đó.
- **I-5** Ảnh được lưu (Storage) TRƯỚC khi ghi bản ghi; ghi lỗi ⇒ xoá MỌI ảnh vừa lưu của request.
- **I-6** Cache ảnh chỉ trả bytes SAU khi route đã kiểm quyền xem ticket/ảnh (như cũ); khoá = `ref` (uuid, không đổi nội dung).

## §5. Vùng cấm
| # | Không làm | Lý do |
|---|---|---|
| V1 | Bỏ pre-ping cho engine GHI | Transaction không thử lại được an toàn giữa chừng; ghi ít hơn đọc nhiều |
| V2 | Thử lại đọc vô hạn / thử lại cả lỗi SQL | Che lỗi thật; chỉ rớt kết nối mới thử lại 1 lần |
| V3 | Tăng tổng kết nối > 5 | Giới hạn client của pooler chưa đo (plan 01 Q7) |
| V4 | Nhiều worker uvicorn | `engine.lock` là khoá trong tiến trình |
| V5 | Signed URL ảnh từ Supabase | Plan 01 chọn proxy bytes (không lộ bucket); đổi là đổi bảo mật |
| V6 | Nén ảnh bằng gzip | JPEG/PNG đã nén; tốn CPU, không lợi |
| V7 | Cache phản hồi API ở server | Dữ liệu dùng chung nhiều backend; `list()` đã có cache `xmin` đúng đắn |
