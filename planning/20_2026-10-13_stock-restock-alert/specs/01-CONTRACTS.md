# 01 — Contracts

## 1. Model (`src/maintenance/models.py`)
```python
class StockAlert(Entity):  # extra="forbid", frozen=True
    alert_id: Annotated[str, _sim_id("SIM-SAL-")]
    item_code: str
    item_name: str
    unit: str | None
    department_id: DepartmentId        # luôn DEPT_TECHNICAL ở đợt này
    qty_added: float                   # > 0
    qty_before: float                  # ≤ 0
    qty_after: float                   # > 0
    received_by: str                   # actor_id Kho/BQL
    created_at: AwareDatetime
    acknowledged_by: str | None = None
    acknowledged_at: AwareDatetime | None = None
```
`alert_id` = `SIM-SAL-<mã vật tư rút gọn>-<YYYYMMDDHHMMSSffffff>` theo đồng hồ engine (`engine.at()`).

## 2. DDL — `0005_stock_alerts.py` (down_revision `0004_portal_extras`)
```sql
create table maintops.stock_alerts (
  alert_id text primary key, item_code text not null, item_name text not null, unit text,
  department_id text not null,
  qty_added double precision not null check (qty_added > 0),
  qty_before double precision not null, qty_after double precision not null,
  received_by text not null, created_at timestamptz not null,
  acknowledged_by text, acknowledged_at timestamptz,
  check ((acknowledged_by is null) = (acknowledged_at is null)));
create index stock_alerts_dept_unread on maintops.stock_alerts (department_id, created_at desc)
  where acknowledged_at is null;
grant select, insert, update on maintops.stock_alerts to maintops_dev;
```
Downgrade: `drop table if exists maintops.stock_alerts`. Không `%` trong SQL; không import app (như 0004).

## 3. Store
```python
# Tx
def put_stock_alert(self, alert: StockAlert) -> None: ...
# Repository
def stock_alerts(self, department_id: str, *, unread_only: bool) -> list[StockAlert]: ...   # created_at giảm dần
def acknowledge_stock_alert(self, alert_id: str, actor_id: str, at: datetime) -> StockAlert: ...
```
`acknowledge_*`: `NotFoundError` nếu không có; đã ack ⇒ trả bản cũ, KHÔNG ghi đè (idempotent).

## 4. Engine (`src/maintenance/engine.py`)
```python
def receive_stock(self, actor_id, item_code, qty) -> list[Case]      # chữ ký giữ nguyên
def list_stock_alerts(self, actor_id: str, *, unread_only: bool = False) -> list[StockAlert]
def acknowledge_stock_alert(self, actor_id: str, alert_id: str) -> StockAlert
```
~~Thêm `Action.READ_STOCK_ALERTS`, `Action.ACK_STOCK_ALERT` vào `PERMISSIONS`~~ — thay bởi plan D08(b): kiểm vai trong engine, `PERMISSIONS` không đổi.

## 5. API (`/api/v1/mo`, `src/api/routers/maintenance.py`)
| Method | Path | Vai | Trả |
|---|---|---|---|
| GET | `/stock-alerts?unread=true` | DEPARTMENT(DEPT_TECHNICAL), BQL, WAREHOUSE | `list[StockAlert]` |
| POST | `/stock-alerts/{alert_id}/ack` | DEPARTMENT(DEPT_TECHNICAL), BQL | `StockAlert` |

Cờ tắt ⇒ GET trả `[]`, POST trả 404 `STOCK_ALERTS_DISABLED`.
