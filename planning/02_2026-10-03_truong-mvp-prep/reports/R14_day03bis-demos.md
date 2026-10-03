Vai · thi công · Sonnet · Bước 0 exit 1 (MODULE_NOT_FOUND, hub thiếu, không sửa) · hiểu việc: đo lại 8 record D3-06 trên HEAD mới, ghi vào bis/ và evidence/bis/demos; xong khi RATING có PASS/FAIL thật và DEMO-04 kết luận bằng OpenAPI; cấm sửa src/tests/docs/evidence cũ, cấm gọi engine trực tiếp làm PASS.
Handoff: ../handoffs/H14_day03bis-demos.md
Base: cd83f1148e256bb34b0b26d80c16ec7011acb3db
Head: cd83f1148e256bb34b0b26d80c16ec7011acb3db (working tree, không commit)

## Lệnh + exit
Env ép như handoff; `python evidence/bis/demos/harness.py <case>` (bản sao harness d3-06): g1a 0, g1b 0, g1r 0, g2 0, g2neg 0, g3 0, g4a 1 (harness cũ, xem dưới), g4b 0. `init_brain --check` exit 1. Chi tiết: evidence/bis/demos/*-exit.txt, openapi-safety-scan.txt, git-head.txt.

## Kết quả
| Record | Kết quả | Cũ (Day03) |
| --- | --- | --- |
| DEMO-01A-CLEANING | PASS 26/26 | PASS |
| DEMO-01B-LIGHT | PASS 26/26 | PASS |
| DEMO-01-RATING | PASS 31/31 (lần 2 = 409, rating giữ 5) | FAIL |
| DEMO-02-NEED-INFO | PASS 13+10 | PASS |
| DEMO-02-ASSET-UNCLEAR | PASS | PASS |
| DEMO-03-STOCK | PASS 21/21 | PASS |
| DEMO-04-SAFETY-TIER2 | BLOCKED (owner Châm Anh: không có route safety) | BLOCKED |
| DEMO-04-SAFETY-TIER1 | BLOCKED (owner Châm Anh) | BLOCKED |

## So sánh với Day03
- RATING FAIL -> PASS: engine.rate() có guard once.
- DEMO-04 vẫn BLOCKED nhưng ingest đã đổi: Bậc 2 -> SAFETY_REVIEW_REQUIRED (BPTN), Bậc 1 -> EMERGENCY_PENDING_BQL (BQL) + thông báo BQL (trước: OUT_OF_SCOPE). Engine có 5 method safety/emergency nhưng 0 route trong 45 path OpenAPI; owner đổi Như Ý -> Châm Anh (API).
- g4a exit 1: 8/10 check "vắng mặt" lỗi thời; không đổi expected, ghi nhận.

## git diff --stat + SHA
Chỉ file untracked mới trong P/deliverables/bis, P/evidence/bis/demos, P/reports; không sửa file tracked. SHA cd83f1148e256bb34b0b26d80c16ec7011acb3db.

## Phân công
| Gói | Tầng | Họ/model |
| --- | --- | --- |
| D3-06 | 🟠 | Sonnet |

## Không làm
Gọi engine trực tiếp, D01/deadline/negative safety (không có route); sửa expected.

## Câu hỏi mở
Châm Anh: route + body safety/emergency khi nào? Hub brain4agent.release thiếu, cần người xử.

## Root đo lại (2026-10-03)

Root chạy lại harness g1r/g1a/g3/g4a/g4b trong scratchpad: 31/31, 26/26, 21/21, 2/10, 2/2 khớp worker (evidence/root/day03bis-rerun-*). OpenAPI 45 path, 0 safety. g4a 2/10 do harness cũ lỗi thời. Owner DEMO-04 ghi 'Châm Anh' (route API) — root chuẩn hoá tên trong results; owner cuối chờ người chốt.

✅ DUYỆT (Day03-bis demos: 6 PASS, DEMO-04 ×2 BLOCKED chưa có route; rating-once PASS)
