# 00 — Kiến trúc & bất biến: tăng tốc đọc backend (plan 09)

## §1. Bối cảnh đo được (evidence/audit/*-before.txt, 2026-10-08, DB Supabase chung, 65 ticket)
| Phép đo | Số | Nguồn |
|---|---|---|
| Round trip `select 1` tới Supabase (Session pooler) | median 44 ms | `db-probe-before.txt` |
| `select doc from maintops.cases` (= `PostgresRepository.list()`) | median 2723 ms (min 2334, max 3581) | `db-probe-before.txt` |
| `select ticket_id, xmin` cùng 65 dòng | median 43 ms | `db-probe-before.txt` |
| Tổng JSON doc | 725 KB (audit 261, events 124, ticket 103, notifications 83 KB) | `db-probe-before.txt` |
| `GET /resident/tickets` (cudan01) | median 2676 ms, 7 câu SQL (1 list + 6 `get` từng ticket) | `bench-http-before.txt`, `sql-count-before.txt` |
| `GET /mo/tickets` (bptn01) | median 1514 ms (max 2327) | `bench-http-before.txt` |
| `GET /bql/tickets` (bql01) | median 503 ms (max 2708); màn BQL gọi THÊM `/mo/tickets` song song | `bench-http-before.txt`, `src/web/app.js:1738` |
| Validate 65 doc bằng Pydantic | 7 ms | phiên audit (không phải nút cổ chai) |

**Kết luận audit:** >90% thời gian các màn danh sách là kéo toàn bộ doc JSONB qua mạng mỗi request. CPU Python, Pydantic,
auth (session in-memory, 0 SQL) và catalog KHÔNG phải nút cổ chai.

## §2. Mục tiêu
1. Màn danh sách (`/mo/tickets`, `/resident/tickets`, `/bql/tickets`) khi cache ấm: median ≤ 300 ms trên Supabase chung.
2. Không N+1: mỗi request danh sách đúng 1 câu SQL (phiên bản + doc của dòng đổi trong cùng câu — plan.md Q08).

## §3. Non-goals
- Không đổi schema DB, không migration (giữ `0002_p1_doc_shape`).
- Không đổi API: không thêm/bớt/đổi trường, đường dẫn, status code, thứ tự sắp xếp.
- Không đụng luồng ghi (`transaction`, `get_for_update`, `save`), engine nghiệp vụ, agent/LLM.
- Không đổi giao diện (`src/web/`) — người dùng chốt 2026-10-08 (plan.md Q07).
- Không gzip, không gộp lời gọi màn BQL (đã đề xuất, người dùng bỏ — plan.md Q07).

## §4. Bất biến kiến trúc
- I-1: Kết quả `list()` có cache phải BẰNG kết quả không cache tại cùng thời điểm đã commit (mọi backend khác ghi vào DB chung đều được thấy ở request kế tiếp — không có TTL, không có dữ liệu cũ).
- I-2: Object `Case` trả từ `list()` là CHỈ ĐỌC — cùng hợp đồng với `MemoryRepository.list()` (trả object dùng chung, `src/maintenance/store/memory.py:146`). Engine sửa qua `_mutate` (bản sao sâu) như hiện tại.
- I-3: Luồng ghi và `get()` / `get_for_update()` không đọc cache.
- I-4: Cache là trạng thái trong tiến trình; restart = cache lạnh, không cần dọn.

## §5. Thứ tự đọc
1. `01-CONTRACTS.md` → 2. `SPEC-P01-list-cache.md` → 3. `SPEC-P02-view-prefetch.md` → 4. `OPERATIONS.md` → 5. `TESTING-ACCEPTANCE.md`.

## §6. Vùng cấm (đã cân nhắc, KHÔNG làm — kèm lý do)
| Ý định | Vì sao không |
|---|---|
| Cache có TTL (vd 5 s) | Vi phạm I-1: backend khác ghi DB chung ⇒ màn hiển thị trạng thái cũ, nút bấm sai trạng thái ⇒ 409 khó hiểu |
| `select doc - 'audit' - 'notifications'` cho danh sách | Đo vẫn 951 ms (chỉ giảm ~3 lần) và `Case` cần đủ trường; cache theo `xmin` cho 43 ms |
| Bỏ `audit`/`notifications` khỏi doc (đã có bảng riêng) | Đổi data contract + migration; để Idea Vault, kế hoạch riêng |
| Tắt `pool_pre_ping` để bớt 1 round trip/checkout | Pooler Supabase cắt kết nối rảnh ⇒ 503 ngẫu nhiên; lợi ~40 ms không đáng |
| Tăng `pool_size` | Session pooler giới hạn kết nối theo user; lỗi gốc là băng thông, không phải số kết nối |
| Cache `get()` | 1 dòng ≤ 24 KB, vẫn cần 1 round trip kiểm phiên bản ⇒ lợi nhỏ, thêm rủi ro I-3 |
| Đưa agent/LLM ra nền (bất đồng bộ) khi cư dân gửi | Đổi luồng nghiệp vụ + contract plan 06; Idea Vault |
| Lưu session đăng nhập vào DB | Bảo mật/auth là việc 🔴 riêng; Idea Vault |
| Phân trang danh sách | Cache `xmin` giữ chi phí ấm ~1 round trip + số dòng đổi; phân trang đổi UI + API; Idea Vault |
| Gzip + `description` cho BQL để màn BQL gọi 1 API | Người dùng chỉ chọn cách 1 và 2 (Q07); màn BQL vẫn gọi 2 API nhưng cả hai đều đi qua cache |
