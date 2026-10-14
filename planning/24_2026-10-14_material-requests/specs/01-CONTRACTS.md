# 01 — Contracts

## 1. Engine
```python
def report_material_shortage(self, ticket_id: str, actor_id: str, *, lines: list[PlannedMaterial], note: str | None = None) -> Case
    # P01 §2. Vai DEPARTMENT của đúng phòng ticket; ticket IN_PROGRESS.
def material_requests(self, actor_id: str) -> list[MaterialRequestView]
    # P01 §3. Vai WAREHOUSE, BQL, DEPARTMENT (phòng ban: chỉ phiếu của phòng mình).
def receive_stock(self, actor_id, item_code, qty) -> list[Case]          # giữ chữ ký; P02 đổi phần thông báo
def list_stock_alerts(self, actor_id, *, unread_only=False, department_id: Department | None = None) -> list[StockAlert]
def acknowledge_stock_alert(...)                                           # giữ chữ ký; quyền theo 00 §4 I-6
```

## 2. Model
```python
class MaterialRequestLine(BaseModel):
    item_code: str; item_name: str; unit: str | None
    needed_qty: float          # _still_to_issue(line) của dòng INSUFFICIENT
    stock_qty: float | None    # tồn hiện tại (None = không theo dõi)
    shortage_qty: float        # max(0, needed_qty - (stock_qty or 0))

class MaterialRequestView(BaseModel):     # views.py, chỉ response
    request_id: str            # f"PVT-{ticket_id}"
    ticket_id: str
    department_id: Department | None      # ticket.department_id, else proposed_department_id
    location: str | None                  # engine.effective_location(case)
    source: Literal["AGENT", "DEPARTMENT"]  # bước 7 ⇒ AGENT; report_material_shortage ⇒ DEPARTMENT
    reported_by: str           # actor của sự kiện tạo blocker (AGENT_ID hoặc nhân viên)
    since: datetime            # blocker.since
    note: str | None           # blocker.internal_note
    lines: list[MaterialRequestLine]      # chỉ các dòng còn INSUFFICIENT, ≥ 1
    status: Literal["OPEN"] = "OPEN"
```
`StockAlert`: bỏ ràng buộc `qty_before ≤ 0` và `qty_after > 0` (chỉ giữ `qty_added > 0`). Không đổi cột DB.

`Notification.type` thêm `"material.shortage"` (audience `WAREHOUSE`, payload `{"request_id", "item_codes", "source"}`).

## 3. API (prefix `/api/v1`)
| Route | Body / query | Vai | Trả |
|---|---|---|---|
| `POST /mo/tickets/{id}/material-shortage` | `{"lines":[{"item_code","planned_qty"}], "note": str?}` | phòng ban của ticket | `Case` |
| `GET /mo/warehouse/requests` | — | kho, BQL, phòng ban | `list[MaterialRequestView]` (cũ nhất trước) |
| `GET /mo/stock-alerts?unread=&department=` | `department` chỉ cho BQL/kho; phòng ban bỏ qua tham số, luôn phòng mình | kho (đọc), BQL, phòng ban | `list[StockAlert]` |
| `POST /mo/stock-alerts/{id}/ack` | — | phòng ban của alert, BQL | `StockAlert` |

## 4. Lỗi
| Lỗi | HTTP | Khi | Caller (UI) |
|---|---|---|---|
| `ACTION_DENIED` | 403 | sai vai/sai phòng | hiện lời nguyên văn |
| `INVALID_TRANSITION` | 409 | ticket không `IN_PROGRESS` | tải lại ticket |
| `GUARD` | 409 | `lines` rỗng; mã không có trong catalog/không thuộc phòng; `planned_qty ≤ 0`; kho đủ cho mọi dòng ("Kho đủ vật tư, không cần báo thiếu") | hiện lời, giữ form |
| `NOT_FOUND` | 404 | ticket/alert không có | tải lại |
| 422 | 422 | body sai kiểu | hiện lỗi form |
