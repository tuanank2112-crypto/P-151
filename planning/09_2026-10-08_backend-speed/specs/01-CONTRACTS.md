# 01 — Contracts (plan 09)

## §1. `PostgresRepository.list()` — chữ ký KHÔNG đổi
```python
def list(self) -> list[Case]  # thứ tự: ticket_id collate "C" tăng dần (như hiện tại)
```
Thay đổi chỉ ở bên trong (SPEC-P01). Hai hàm mới, nội bộ lớp:
```python
self._list_cache: dict[str, tuple[str, Case]]   # ticket_id -> (xmin dạng text, Case đã validate)
self._list_lock: threading.Lock                 # bảo vệ _list_cache khi thay/xoá phần tử
def cache_stats(self) -> dict[str, int]         # {"hits": n, "misses": n, "size": n}; cho test + log, không cho API
```
`MemoryRepository` KHÔNG đổi.

## §2. SQL dùng trong `list()` — MỘT câu, MỘT round trip (plan.md Q08)
```sql
select c.ticket_id, c.xmin::text as v,
       case when k.v is distinct from c.xmin::text then c.doc end as doc
from maintops.cases c
left join unnest(cast(:ids as text[]), cast(:vs as text[])) as k(tid, v) on k.tid = c.ticket_id
order by c.ticket_id collate "C"
```
`:ids`, `:vs` = các cặp (ticket_id, v) cache đang giữ (có thể rỗng). Dòng không đổi trả `doc = NULL` (không truyền doc);
dòng mới/đổi trả doc. Dòng đã xoá không có trong kết quả. Một câu lệnh = một snapshot nhất quán (không cần `REPEATABLE READ`).
Giữ nguyên `test_t24_sql_budget`: `GET /mo/tickets` = đúng 1 câu SQL.

## §3. API & HTTP — KHÔNG đổi
Mọi endpoint giữ nguyên đường dẫn, status code, schema response (byte-for-byte cùng nội dung JSON với cùng dữ liệu).
Không middleware mới.

## §4. (bỏ — gzip không thuộc phạm vi, plan.md Q07)

## §5. Views — chữ ký có tham số tuỳ chọn mới
```python
def resident_view(engine, case, now, lookup: Mapping[str, Case] | None = None) -> ResidentTicketView
```
`lookup` = bản đồ ticket_id → Case lấy từ CÙNG snapshot danh sách. `None` ⇒ hành vi cũ (`engine.get`).
Ticket không có trong `lookup` ⇒ rơi về `engine.get` (đúng ngữ nghĩa NotFound hiện tại).

## §6. Bảng phân loại lỗi
| Lỗi | Nơi phát sinh | Hành vi bắt buộc |
|---|---|---|
| `StoreUnavailableError` / `StorePermissionError` khi chạy (1) hoặc (2) | `list()` | Ném như hiện tại (qua `_db_errors`), KHÔNG sửa cache, KHÔNG trả cache cũ |
| `ValidationError` khi validate doc ở (2) | `list()` | Ném như hiện tại (route trả 500 như trước); KHÔNG ghi doc lỗi vào cache |
| Dòng có ở (1) nhưng biến mất ở (2) (bị xoá giữa hai câu) | không xảy ra trong `REPEATABLE READ` | Nếu vẫn thiếu ⇒ bỏ khỏi kết quả và khỏi cache |
| Lỗi giữa chừng khi cập nhật cache | `list()` | Cache chỉ được thay SAU khi (2) và validate xong toàn bộ — không để nửa vời |
