# TESTING & ACCEPTANCE

## 1. Ma trận test (`tests/test_maintenance/test_p23_emergency_coordination.py`)
| ID | Kịch bản | Khẳng định |
|---|---|---|
| D-01 | 2 ca khẩn cấp cùng chỗ | ca 2 `related_ticket_id=ca1`, vẫn `EMERGENCY_PENDING_BQL`; ca 1 `duplicate_count=1` |
| D-02 | 3 ca | ca 2, 3 trỏ ca 1; ca 1 đếm 2 |
| D-03 | khác vị trí / thiếu vị trí | không đánh dấu |
| D-04 | BQL gộp ca 2 vào ca 1 | ca 2 `MERGED`; ca 1 vẫn đếm 1 (không đếm đôi) |
| D-05 | BQL hạ mức ca 2 | ca 1 đếm về 0 |
| D-06 | BQL đóng ca 2 / hủy ca 2 | ca 1 đếm về 0 |
| D-07 | gộp ca 2 vào ca 3 (khác gốc) | ca 1 −1, ca 3 +1 |
| D-08 | E01 BPTN nâng Bậc 2 → khẩn cấp cùng chỗ | đánh dấu |
| D-09 | API `POST /api/v1/bql/tickets/{id}/emergency/merge`: BQL 200; BPTN 403; thiếu note lỗi; ca thường 409 | |
| S-01 | phản ánh hai việc có khẩn cấp, BQL hạ mức | tách: gốc VE_SINH, con KY_THUAT, con không khẩn cấp, có `safety_cleared_at` |
| S-02 | như S-01, đường Agent (client giả trả 2 job) | tách |
| S-03 | ca còn khẩn cấp | không tách |
| H-01 | khẩn cấp luật, không Agent + ticket thường cùng chỗ | `ROUTED` + liên kết (chưa ai đọc ⇒ không giữ) |
| P04-1 | Agent (giả) đọc ca khẩn cấp luật ra KY_THUAT | record AGENT; đèn tới sau GIỮ, rác GIAO; đọc lại không gọi mô hình |
| P04-2 | mô hình nói NONE khi đọc | ca vẫn EMERGENCY_PENDING_BQL |
| P04-3 | BQL đóng trước khi đọc | không gọi mô hình, record giữ SKIPPED |
| P04-4 | đọc ra không job | không giữ |
| H-02 | khẩn cấp có job Agent KY_THUAT + ticket đèn cùng chỗ | giữ |
| H-03 | khẩn cấp có job Agent KY_THUAT + ticket rác cùng chỗ | `ROUTED`, có liên kết |
| H-04 | BQL hạ mức/đóng khẩn cấp | ticket giữ chạy tiếp tới `ROUTED` |
Test cũ ghim hành vi bị thay (P05 S-03 "cleared ⇒ không tách", P07 "cờ tắt ⇒ chỉ liên kết") SỬA theo quyết định E01, ghi trong report.

## 2. Phép phá (mỗi cái phải làm đỏ ít nhất một test)
| Phá | Test đỏ mong đợi |
|---|---|
| bỏ gọi `_mark_emergency_duplicate` ở 2b | D-01 |
| `counted=True` luôn trong `bql_merge` | D-04 |
| không trả số khi hạ mức | D-05 |
| không chép `safety_cleared_*` sang con | S-01 |
| Agent không bao giờ đọc ca khẩn cấp (bỏ cờ `read_emergency`) | P04-1 |
| ca chưa đọc lại giữ | H-01 |

## 3. Exit Gates
| Gate | local | server |
|---|---|---|
| G1 pytest toàn bộ (`--ignore=integration`) 0 fail 0 skip | ⬜ | — |
| G2 ruff check + format | ⬜ | — |
| G3 portal typecheck + lint + vitest | ⬜ | — |
| G4 5 phép phá đều đỏ | ⬜ | — |
| G5 thẩm định cô lập ✅ | ⬜ | — |
| G6 chạy backend thật + portal, BQL gộp được trên UI | ⬜ | ⬜ |
