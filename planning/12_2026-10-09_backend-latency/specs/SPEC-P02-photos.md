# SPEC-P02 — Ảnh: khỏi event loop, một transaction cho cả lô, cache bytes

## §1. Vấn đề
- `resident_add_photos` / `add_execution_photos` là `async def` nhưng gọi Storage (httpx đồng bộ, timeout 30 s, `time.sleep` khi thử lại)
  và ghi DB (`_mutate`) trên event loop ⇒ mọi request khác (kể cả `/health`) đứng chờ.
- N ảnh = N `_mutate` (mỗi lần ghi lại toàn bộ doc, ~8–9 vòng mạng) và có thể ghi được một phần rồi lỗi.
- Xem lại ảnh = tải lại từ Storage (đo 527 ms median, max 1,4 s).

## §2. Luồng mới
```text
async route ─ await read_photos(files)            # chỉ đọc body (async)
           └ await run_in_threadpool(work)        # mọi I/O đồng bộ ở đây
                work: case = own/staff case (kiểm quyền) → room → refs = [photos.save(..) for each]
                      try: case = engine.add_*_photos(ticket_id, actor, refs)   # MỘT _mutate
                      except: photos.discard(ref) for each ref; raise
```
- Route cư dân vẫn trả `ResidentTicketView`, phòng ban trả `Case` (không đổi).
- `photos.load(ref)`: cache LRU theo byte (01-CONTRACTS §4). Route xem ảnh vẫn `def` (threadpool) như cũ.

## §3. BẮT BUỘC / CẤM
- BẮT BUỘC: mỗi ảnh vẫn một `EvidenceRecord` + một dòng audit (truy vết y như cũ).
- BẮT BUỘC: tất cả hoặc không: guard vi phạm ở ảnh thứ k ⇒ không ảnh nào được ghi, mọi file đã lưu bị xoá.
- CẤM: lưu ảnh vào Storage SAU khi ghi DB (bản ghi trỏ file không tồn tại).
- CẤM: cache khi chưa kiểm quyền; cache theo `evidence_id` (khác ticket trùng id).

## §4. Test
- P1 `/health` < 300 ms trong khi upload chờ Storage giả chậm 1 s (httpx `AsyncClient` + `ASGITransport`, cùng event loop) — ĐỎ trước sửa.
- P2 3 ảnh ⇒ đúng 1 lần `_mutate`, 3 bản ghi, 3 audit.
- P3 cư dân còn chỗ 2 ảnh, gửi 3 ⇒ 409, 0 bản ghi mới, 3 file đã lưu đều bị xoá (route kiểm `room` trước — vẫn không file nào sót).
- P4 guard engine ở ảnh 2 (ticket TERMINAL giữa chừng mô phỏng bằng monkeypatch) ⇒ 0 bản ghi, mọi file bị xoá.
- P5 xem cùng ảnh 2 lần ⇒ Storage `get` 1 lần; header `private, no-cache` + `ETag` (Q10, thay `immutable`); `discard` xoá cache.
- R1–R3, Z3, P5c (R01): người khác gửi `If-None-Match` ⇒ 404 không phải 304; URL dùng lại sau reset ⇒ 200 bytes mới; upload kiểm quyền trước khi xét file; route cư dân chỉ ảnh cư dân; ảnh > 1 KB giữ `identity`; LRU giữ trong ngân sách byte. Phép phá: `evidence/harness/mutate_r01.py` (8/8 đỏ).
