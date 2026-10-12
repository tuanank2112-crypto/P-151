# SPEC-P01 — Engine đọc AUTOCOMMIT + thử lại khi rớt kết nối

## §1. Vấn đề (đo)
`self._engine.connect()` của SQLAlchemy + psycopg2 mở transaction ngầm: pre-ping (`SELECT 1`) + `BEGIN` + query + `ROLLBACK` khi trả kết nối
= 4 vòng × ~55 ms. Đọc một câu không cần transaction (một câu SQL đã tự nhất quán; `list()` dùng một câu từ plan 09 Q08).

## §2. Giải thuật
1. `sql_read_engine(url)`: engine riêng, `isolation_level="AUTOCOMMIT"` ở mức engine (KHÔNG đổi chế độ mỗi lần mượn kết nối — đo: đổi theo
   từng kết nối vẫn 236 ms vì psycopg2 gửi lệnh đặt chế độ), `pool_pre_ping=False`.
2. `_read(fn)`:
   ```python
   for attempt in (0, 1):
       try:
           with self._read_engine.connect() as conn:
               return fn(conn)
       except DBAPIError as exc:
           if attempt == 0 and exc.connection_invalidated:
               logger.info("read retry after a dropped connection")
               continue
           with _db_errors():
               raise
   ```
   `connection_invalidated` do SQLAlchemy đặt khi dialect nhận ra rớt kết nối; pool tự bỏ kết nối hỏng.
3. Cache `list()` (plan 09) giữ nguyên, chỉ đổi kết nối sang `_read`.

## §3. BẮT BUỘC / CẤM
- BẮT BUỘC: mọi hàm ở bảng I-1 dùng `_read`; `transaction()`/`get_for_update`/`_lease`/`wipe`/`set_stock`/`check` giữ `self._engine`.
- CẤM: đọc trong `_read` rồi ghi dựa trên kết quả đó mà không khoá dòng (engine đã dùng `get_for_update` trong `_mutate` — không đổi).
- CẤM: `with self._read_engine.begin()`.

## §4. Test (local docker, `--pg`)
- T1 `get`/`list` qua `_read`: phiên đọc ở `AUTOCOMMIT` (`conn.get_isolation_level() == "AUTOCOMMIT"`) và KHÔNG có câu `BEGIN`.
- T2 rớt kết nối: `pg_terminate_backend` kết nối đọc đang nằm trong pool ⇒ `repo.get` vẫn trả đúng (thử lại 1 lần).
- T3 lỗi khác (bảng bị đổi tên trong transaction test riêng) ⇒ không thử lại, ném `StoreUnavailableError`/`StorePermissionError` như cũ.
- T4 budget: `GET /mo/tickets` vẫn 1 câu SQL (cập nhật bộ đếm nghe cả hai engine).
