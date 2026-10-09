# SPEC-P01 — Cache `list()` theo phiên bản dòng (`xmin`)

File được sửa: `src/maintenance/store/postgres.py` (lớp `PostgresRepository`). Không file nào khác.

## §1. Giải thuật (BẮT BUỘC đúng thứ tự) — v2 theo plan.md Q08
1. Dưới `_list_lock`, chụp `known = {tid: v for tid, (v, _) in _list_cache.items()}`; nhả khoá.
2. Chạy SQL của 01-CONTRACTS §2 với `ids=list(known)`, `vs=[known[t] for t in ids]` (một câu, kết nối đọc như `get()`).
3. Với mỗi dòng: `doc is None` ⇒ dùng `Case` trong `known`; ngược lại `Case.model_validate(doc)` ⇒ `fresh[tid] = (v, case)`.
   Validate TẤT CẢ trước khi đụng cache (lỗi ⇒ ném, cache giữ nguyên).
4. Dưới `_list_lock`: dựng cache mới = các dòng của kết quả (cũ giữ nguyên object, mới/đổi lấy từ `fresh`) — tid không còn trong kết quả bị bỏ;
   `hits += số dòng doc NULL`, `misses += len(fresh)`.
5. Trả danh sách `Case` theo thứ tự kết quả SQL (`collate "C"`).

Ca hiếm: dòng trả `doc NULL` nhưng tid đã bị luồng khác xoá khỏi cache giữa bước 1 và 4 — không xảy ra vì bước 4 chỉ thay cache
bằng kết quả của chính câu SQL; nếu `known` thiếu tid mà doc NULL (không thể theo SQL) ⇒ `RuntimeError` (lỗi lập trình, không nuốt).

## §2. Luật
- BẮT BUỘC: kết quả phải giống hệt `list()` cũ (cùng tập ticket, cùng thứ tự, cùng nội dung) — test parity TESTING §2 T1.
- BẮT BUỘC: cache chỉ chứa doc đã validate thành công.
- BẮT BUỘC: không giữ khoá `_list_lock` trong lúc gọi DB.
- BẮT BUỘC: đúng 1 câu SQL mỗi lần `list()` (giữ `test_t24_sql_budget`).
- CẤM: TTL, cache theo thời gian, trả cache mà không chạy câu SQL.
- CẤM: trả bản sao sâu (`model_copy(deep=True)`) — I-2 đã chốt object chỉ đọc như store memory; bản sao làm chậm tuyến tính theo số ticket.
- CẤM: `get()`, `get_for_update()`, `transaction()` đọc hoặc ghi cache.
- CẤM: đổi `sql_engine()` (pool, pre_ping, recycle).

## §3. Vì sao `xmin` đúng
Mỗi UPDATE/INSERT tạo tuple mới với `xmin` = xid của transaction ghi ⇒ mọi thay đổi doc (kể cả từ backend khác, `wipe()` rồi seed lại) đổi `xmin`.
Trùng `xmin` với nội dung khác chỉ có thể sau ~4 tỉ transaction (wraparound) — chấp nhận. Freeze của VACUUM chỉ có thể làm `xmin` KHÁC đi ⇒ tải lại thừa, không sai.

## §4. Số đo nghiệm thu (TESTING §3)
- `list()` ấm, không thay đổi: 1 round trip, không truyền doc ⇒ ≤ 150 ms median trên Supabase (đo sẵn: `select ticket_id, xmin` = 43 ms).
- Sau 1 ticket đổi: tải đúng 1 doc (`misses` tăng đúng 1).
