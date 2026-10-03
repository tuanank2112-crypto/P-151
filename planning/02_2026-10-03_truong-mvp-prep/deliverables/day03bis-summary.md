# Day03-bis — đo lại 23 record sau khi merge develop

- Thời điểm: 2026-10-03 (đồng hồ máy); branch `feature/truong`; commit `cd83f1148e256bb34b0b26d80c16ec7011acb3db` (đã merge `origin/develop` e32e014); local cô lập (memory/mock/local), không phải online.
- Nguồn: [day03bis-results.json](day03bis-results.json), [day03bis-wording.md](day03bis-wording.md); handoff H13–H15, report R13–R15; root đo lại: `evidence/root/day03bis-*`.

## Số đo

23 record: **19 PASS, 4 BLOCKED, 0 FAIL, 0 NOT_RUN** (Day03 cũ SHA 0ea04ad: 17/5 BLOCKED/1 FAIL).

| Nhóm | Day03 cũ | Day03-bis |
|---|---|---|
| Asset ×3, vật tư ×4, trùng ×4 | 11 PASS | 11 PASS (audit có thêm ASSESS_SAFETY trước LOOKUP_ASSET) |
| Wording WORD-01 (cư dân) | BLOCKED | **PASS** — rating-once, REPORT_NOT_DONE/reopen đã bỏ khỏi view, chuỗi safety có |
| WORD-02 (BPTN), WORD-04 (BQL) | BLOCKED | BLOCKED — chưa có route safety/khẩn cấp |
| WORD-03 (phòng ban) | PASS | PASS |
| DEMO-01A/01B/02×2/03 | PASS | PASS |
| DEMO-01-RATING | **FAIL** | **PASS** (lần 2 → 409, rating giữ nguyên) |
| DEMO-04 Bậc 2 / Bậc 1 | BLOCKED | BLOCKED |

Root chạy lại harness g1r (31/31), g1a (26/26), g3 (21/21), g4a (2/10), g4b (2/2): khớp worker. OpenAPI có 45 path, 0 path safety/emergency/hazard. Ingest nay ra `SAFETY_REVIEW_REQUIRED` (Bậc 2) và `EMERGENCY_PENDING_BQL` (Bậc 1) thay vì OUT_OF_SCOPE. g4a 2/10 là do harness cũ khẳng định "không có safety" (lỗi thời), không phải lỗi sản phẩm.

## Còn chặn demo
Engine có 5 method (`safety_confirm_safe`, `safety_escalate`, `safety_request_info`, `emergency_downgrade`, `emergency_close`) nhưng không route nào gọi ⇒ DEMO-04 và WORD-02/04 BLOCKED. Owner: thiếu route/schema API = Châm Anh theo SPEC; brain của Như Ý ghi đó là việc mở của họ ⇒ **owner chưa thống nhất** (worker ghi DEMO-04 = Châm Anh, WORD-02/04 = Như Ý). Cần người chốt.

## Câu hỏi cần người (chưa đổi)
1. ASSET-03: SPEC §3 D3-02 vs OPERATIONS §3.2.2 (`asset_onsite`), oracle vẫn theo OPERATIONS.
2. STOCK-04: cờ `STOCK_CHECK_ON_ACCEPT` chỉ đặt, accept không xử lý (engine.py:2506-2508).
3. Owner route safety/khẩn cấp (mục trên); đồng bộ thứ tự an toàn trước phân loại với fixture CR03 của Trường.
4. Hub `../brain4agent.release` thiếu (Bước 0 exit 1).

## Trước nghiệm thu 04/10
Route + schema safety (BPTN 3 hành động, BQL đóng/hạ khẩn cấp) và chạy lại DEMO-04, WORD-02/04; D-01 delta/snapshot chưa code; persistence restart và bản online/UI chưa đo. Không có gate runtime/online nào đạt.
