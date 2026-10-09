# 01 — Contracts

## §1. `src/maintenance/store/postgres.py`
```python
@functools.lru_cache(maxsize=4)
def sql_engine(url: str) -> sa.Engine:          # GHI: pool_size=2, max_overflow=0, pool_timeout=30, pool_pre_ping=True, pool_recycle=300
@functools.lru_cache(maxsize=4)
def sql_read_engine(url: str) -> sa.Engine:     # ĐỌC: pool_size=2, max_overflow=1, pool_timeout=30, pool_pre_ping=False,
                                                #      pool_recycle=300, isolation_level="AUTOCOMMIT", cùng connect_args_for(url)
class PostgresRepository:
    def _read(self, fn: Callable[[Connection], T]) -> T   # I-3: một lần thử lại khi connection_invalidated, rồi _db_errors như cũ
```
Hàm đọc nào chuyển sang `_read`: bảng I-1 (00-ARCHITECTURE §4). Chữ ký công khai của repository KHÔNG đổi.
`next_ticket_number` đổi `begin()` → `_read` (`nextval` không phụ thuộc transaction).

## §2. `src/maintenance/engine.py`
```python
def add_resident_photos(self, ticket_id: str, actor_id: str, file_refs: Sequence[str]) -> Case   # MỘT _mutate
def add_execution_photos(self, ticket_id: str, actor_id: str, file_refs: Sequence[str]) -> Case  # MỘT _mutate
```
- `add_resident_photo(ticket_id, actor_id, ref)` = `add_resident_photos(..., [ref])` (giữ cho code/test cũ).
- Mỗi ảnh vẫn MỘT `EvidenceRecord` + MỘT audit như cũ (`ADD_RESIDENT_PHOTO` / `ADD_EVIDENCE`), evidence_id tăng dần như cũ.
- Guard (TERMINAL, tối đa ảnh, `_require_in_progress`) kiểm cho TỪNG ảnh trong cùng `op` ⇒ ảnh nào vi phạm ⇒ cả lô rollback.
- `file_refs` rỗng ⇒ `GuardError("Chưa có ảnh")`.

## §3. `src/api/routers/maintenance.py`
- `_attach_photos(files, room, limit, attach_many)`: `await photos.read_photos(files)` (giữ) rồi
  `await run_in_threadpool(_store_and_attach, batch, attach_many)`; `_store_and_attach` lưu hết ảnh, gọi `attach_many(refs)` một lần,
  lỗi ⇒ `photos.discard` từng ref rồi ném lại.
- Phần đọc/kiểm quyền đầu route (`_own_case`, `_staff_case`) cũng chạy trong threadpool.
- Đường dẫn, body, mã lỗi (409 quá số ảnh, 413, 415, 422, 502 Storage) KHÔNG đổi.

## §4. `src/api/photos.py`
```python
PHOTO_CACHE_BYTES = 32 * 1024 * 1024
def load(ref: str) -> tuple[bytes, str]   # đọc cache trước; miss ⇒ Storage rồi nạp cache (LRU theo tổng byte, khoá threading.Lock)
```
Ảnh > `PHOTO_CACHE_BYTES / 8` không cache. `discard(ref)` xoá khỏi cache.
Header ảnh (Q10, thay `private, max-age=31536000, immutable`): `Cache-Control: private, no-cache`, `ETag: "<ref>"` (tên đã lưu, uuid — không bao giờ dùng lại cho bytes khác; `photos.etag(ref)`), `Content-Encoding: identity` (để GZip bỏ qua — V6). `If-None-Match` khớp ⇒ `304` rỗng, CHỈ sau khi `allowed(case)` tìm thấy ảnh cho actor này; không khớp/không có ⇒ `200` + bytes. Upload: kiểm quyền/tồn tại ticket TRƯỚC `read_photos` (mã lỗi như `e9960f0`: 404/403 trước 413/415/422 — R01 #7).

## §5. `src/main.py`
`app.add_middleware(GZipMiddleware, minimum_size=1024)` (Starlette 1.7.0). Không đổi CORS, route, mount.

## §6. Bảng lỗi
| Tình huống | Hành vi |
|---|---|
| Đọc: kết nối bị đóng phía server (pooler/idle) | thử lại 1 lần trên kết nối mới; vẫn lỗi ⇒ `StoreUnavailableError` (503) như cũ |
| Đọc: lỗi SQL/quyền | không thử lại; dịch như cũ (503/403) |
| Upload: Storage lỗi ở ảnh k | xoá ảnh 1..k-1 đã lưu; 502 `PHOTO_STORE_FAILED` như cũ; không bản ghi nào |
| Upload: guard engine (quá số ảnh, ticket đã đóng) | xoá MỌI ảnh đã lưu; 409 như cũ; không bản ghi nào |
| Cache ảnh đầy | bỏ ảnh dùng lâu nhất; không lỗi |
