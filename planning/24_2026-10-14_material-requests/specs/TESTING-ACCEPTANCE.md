# TESTING & ACCEPTANCE

## 1. Ma trận test (`tests/test_maintenance/test_p24_material_requests.py`)
| ID | Kịch bản | Khẳng định |
|---|---|---|
| R-01 | bước 7 thiếu tồn | ticket `WAITING_MATERIAL`; notification `material.shortage` audience WAREHOUSE; `material_requests` có `PVT-<id>`, source AGENT, dòng thiếu đúng số |
| R-02 | phòng ban đang làm báo thiếu mã tồn 0 | `ON_HOLD/WAITING_MATERIAL` chủ WAREHOUSE; phiếu source DEPARTMENT, reported_by = nhân viên; notification |
| R-03 | báo thiếu khi kho đủ | 409 GUARD, ticket vẫn `IN_PROGRESS`, kế hoạch vật tư KHÔNG đổi |
| R-04 | sai phòng / cư dân / ticket ROUTED / mã của phòng khác / qty ≤ 0 / lines rỗng | 403/409/422 đúng bảng 01 §4 |
| R-05 | kho nhập đủ cho ticket R-02 | ticket về `IN_PROGRESS`; phiếu biến mất; alert phòng có ticket, `tickets[].waiting=False` |
| R-06 | nhập thiếu (một phần) | ticket vẫn chờ; phiếu còn, `shortage_qty` giảm; alert `waiting=True` |
| R-07 | hai phòng cùng chờ một mã | một lần nhập ⇒ đúng 2 alert (mỗi phòng một), mỗi alert chỉ ticket của phòng đó |
| R-08 | nhập mã không ai chờ, tồn trước > 0 | không alert |
| R-09 | nhập mã tồn trước 0, không ai chờ | alert cho phòng dùng mã đó (giữ hành vi plan 20) |
| R-10 | quyền alert: phòng ban chỉ phòng mình; ack phòng khác 403; kho ack 403; BQL `department=` lọc | |
| R-11 | API 4 route qua TestClient | mã HTTP đúng |
| R-12 | phòng ban thấy phiếu phòng mình, không thấy phòng khác | |
Test plan 20 cũ (`test_stock_alerts.py`) ghim "chỉ Kỹ thuật" / "qty_before ≤ 0": sửa theo M01.2, ghi trong report.

## 2. Phép phá (mỗi cái làm đỏ ≥ 1 test)
| Phá | Đỏ mong đợi |
|---|---|
| bỏ kiểm "kho đủ ⇒ từ chối" | R-03 |
| alert gửi mọi phòng | R-07 |
| không lọc phiếu theo phòng | R-12 |
| bỏ `_notify` material.shortage | R-01 |
| `waiting` luôn True | R-05 |

## 3. Exit Gates
| Gate | local | server |
|---|---|---|
| G1 pytest toàn bộ 0 fail 0 skip | ⬜ | — |
| G2 ruff file đã sửa | ⬜ | — |
| G3 portal typecheck + lint + vitest | ⬜ | — |
| G4 `node --check` mọi `src/mobile/js/*.js` + test mobile static | ⬜ | — |
| G5 phép phá đều đỏ | ⬜ | — |
| G6 thẩm định cô lập ✅ | ⬜ | — |
| G7 chạy backend + portal thật: báo thiếu → kho thấy phiếu → nhập → phòng thấy chuông | ⬜ | ⬜ |
