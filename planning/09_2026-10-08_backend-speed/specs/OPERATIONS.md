# OPERATIONS — Deploy, runbook, rollback (plan 09)

## §1. Thứ tự bắt buộc
1. Code + test local (`MO_STORE=memory`): `ruff check src tests`, `pytest tests -q`.
2. `pytest --pg` trên DB docker local `p151_test` (KHÔNG Supabase) — kiểm cache với Postgres thật.
3. Đo SAU trên Supabase chung bằng probe CHỈ ĐỌC (`evidence/audit/probes/*.py`), ghi `evidence/audit/*-after.txt`.
4. `docker compose up -d --build backend` (code nằm trong image) → đo lại HTTP → gate server.

## §2. Không cần
- Không migration, không đổi `.env`, không reset DB.

## §3. Rollback
- `git revert <commit plan 09>` rồi `docker compose up -d --build backend`. Cache trong tiến trình biến mất khi restart — không có dữ liệu để dọn.

## §4. Giám sát
- Log 1 dòng INFO mỗi 100 lần `list()`: `list cache hits=… misses=… size=…` (từ `cache_stats()`); không log nội dung ticket.

## §5. Ràng buộc dữ liệu chung
- CẤM chạy thao tác GHI nào lên Supabase chung để đo (tạo ticket, transition). Đo ghi chỉ trên DB local.
