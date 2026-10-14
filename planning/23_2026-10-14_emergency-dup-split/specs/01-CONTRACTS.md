# 01 — Contracts

## 1. Dữ liệu (không đổi schema, không migration)
| Trường | Nghĩa mới |
|---|---|
| `Blocker.related_ticket_id` | Ngoài `DUPLICATE`, nay dùng cho `EMERGENCY_PENDING_BQL`: ca khẩn cấp mở cùng vị trí, tạo trước, mà ca này nghi trùng. `None` = không nghi trùng |
| `Ticket.duplicate_count` | Ca gốc khẩn cấp: số ca khẩn cấp đang nghi trùng nó + số ca đã gộp vào nó (định nghĩa P04 §2.1 mở rộng) |
| `Ticket.safety_cleared_by/at/clear_reason` | Ticket con của tách: chép từ gốc khi gốc đã được gỡ an toàn |
| `ReasonCode.WAITING_EMERGENCY` | Có sẵn (P07). Nay cũng dùng khi cờ tắt mà cùng loại/không rõ loại |

## 2. Engine (chữ ký)
```python
# coordination/merge.py
def _mark_emergency_duplicate(self, work: Case, now: datetime) -> str | None
    # gọi ngay sau khi work có blocker EMERGENCY_PENDING_BQL (2b, E01, T07). Trả id ca gốc hoặc None.
def _release_duplicate_count(self, work: Case, previous_blocker: Blocker | None, now: datetime) -> None
    # mở rộng: code ∈ {DUPLICATE, EMERGENCY_PENDING_BQL} có related_ticket_id ⇒ -1 trên gốc còn mở
def bql_merge(self, ticket_id, actor_id, *, into, note) -> Case
    # into == blocker.related_ticket_id ⇒ counted=False; khác ⇒ -1 gốc cũ (nếu có), counted=True
# coordination/neighbors.py
def _emergency_kinds(self, emergency: Case) -> frozenset[ServiceCategory] | None   # None = không biết
def _hold_for_emergency(self, work: Case, now: datetime) -> bool                   # quy tắc P03 §1
# coordination/split.py
def _try_split(...)   # đk 4 = risk_level == NONE
def _split_mixed_report(...)  # chép safety_cleared_* sang con
```

## 3. API mới
`POST /api/v1/bql/tickets/{ticket_id}/emergency/merge` (router `bql_router`, cùng tiền tố với `/emergency/close`)
- Body: `{"into": "SIM-TKT-0001", "note": "Cùng đám khói hầm B1"}` — `into` bắt buộc, có ký tự khác khoảng trắng (cắt hai đầu), `note` bắt buộc không rỗng.
- Quyền: BQL. Trả `Case` (ticket vừa gộp).

| Lỗi | HTTP | Khi |
|---|---|---|
| `ACTION_DENIED` | 403 | không phải BQL |
| `INVALID_TRANSITION` | 409 | ticket không ở `VERIFYING/EMERGENCY_PENDING_BQL` |
| `GUARD` (mã hiện hành của `GuardError`) | 409/422 theo `_call` | thiếu lý do, gộp vào chính nó, gốc đã kết thúc, gốc không khẩn cấp, gộp dây chuyền |
| `NOT_FOUND` | 404 | `into` không tồn tại |
Caller (portal): hiện thông báo lỗi nguyên văn, không thử lại tự động.

## 4. Portal (presentation)
- Thẻ BQL ca khẩn cấp: nếu `blocker.related_ticket_id` ⇒ dòng "Nghi trùng với `<mã>`" + nút **Gộp vào `<mã>`** (dùng ô lý do sẵn có, bắt buộc). Ca gốc có `duplicate_count > 0` ⇒ nhãn "`N+1` người cùng báo".
- `WAITING_EMERGENCY` hiện nhãn "Chờ xử lý khẩn cấp cùng vị trí".
