# D3-06 Day03-bis notes (demos), HEAD cd83f1148e256bb34b0b26d80c16ec7011acb3db, 2026-10-03

| Nhóm | Actor | Prerequisite | Trạng thái chạy thử |
| --- | --- | --- | --- |
| 01A/01B happy path | vesinh01/kythuat01 -> bql01 | seed SIM-TKT-CLN-001 / TEC-001 ROUTED | PASS 26/26 mỗi nhánh |
| 01-RATING | cudan01 | ticket CLOSED | PASS 31/31; rating lần 2 = 409 (Day03 FAIL, nay engine guard) |
| 02 NEED-INFO / ASSET-UNCLEAR | bptn01 | seed CLN-003 / TEC-002 | PASS 13/13 + 10/10 |
| 03 STOCK | kho01, qa01 | seed TEC-003 ON_HOLD | PASS 21/21 |
| 04 Bậc 2 (SAFETY_REVIEW_REQUIRED) | cudan01 ingest; BPTN 3 lựa chọn | route safety | ingest OK (VERIFYING/SAFETY_REVIEW_REQUIRED); quyết định BPTN BLOCKED, owner Châm Anh (API) |
| 04 Bậc 1 (EMERGENCY_PENDING_BQL) | cudan01 ingest; BQL close/downgrade | route emergency | ingest OK (+ thông báo BQL); hành động BQL BLOCKED, owner Châm Anh (API) |

DEMO-04: engine có safety_confirm_safe/escalate/request_info, emergency_downgrade/close nhưng router không có route; không gọi engine trực tiếp. g4a exit 1 do harness cũ kiểm "vắng mặt" (8/10 lỗi thời), không phải lỗi sản phẩm. D01, deadline jobs, negative 403: chưa chạy (cần route).
Bước 0: init_brain --check exit 1 (MODULE_NOT_FOUND, hub thiếu), không sửa governance.
