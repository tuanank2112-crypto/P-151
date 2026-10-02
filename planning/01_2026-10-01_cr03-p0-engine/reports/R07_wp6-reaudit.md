Vai: auditor · loại: thẩm định lần 2 · họ/model: Claude Sonnet 5.5 (agent mới, không đọc report trước) · Bước 0 exit: 0 · hiểu việc: làm đỏ tầng an toàn 2b sau WP3b bằng ≥8 cách phá mới, đo báo nhầm và hồi quy, không sửa code.
Handoff: (giao trực tiếp trong lời gọi; tóm ở plan.md Q24)
Base: acb82fd
Head: acb82fd (thẩm định không ghi; script ở scratchpad\audit2\)

## Bộ test + hồi quy
pytest 352 passed, 0 fail, 0 skip, EXIT=0. X-1..X-8 PASS. Script audit lần 1: không hồi quy (2 script tự lỗi do chính script / do 24 KB nay bị 422 đúng Q26). Hiệu năng: assess 5000 ký tự xấu nhất ≤ 38 ms; 50 receive p95 ≤ 45 ms. Giới hạn 5000: đúng (4999/5000 qua, 5001 ⇒ 422, không đổi trạng thái).

## Cách phá mới
| ID | Mô tả | KQ | Mức |
|---|---|---|---|
| M1 | Phủ định lan cửa sổ 4 từ khi không có dấu câu/ngăn cách lạ: "không có điện có tia lửa tóe ra" ⇒ NONE; 67/100 tổ hợp phủ định+tín hiệu không dấu câu lọt; 24/40 kiểu ngăn cách lọt | FAIL | **cao (bỏ sót Bậc 1)** |
| M13 | B-01 che "cháy" của vật không phải đèn khi có danh từ đèn trước trong câu: "thùng rác cạnh đèn… bị cháy", "rèm cửa bị cháy", "xe máy bị cháy" ⇒ NONE (12/20) | FAIL | **cao (bỏ sót)** |
| M14 | Nợ từ vựng P0 (không do WP3b): "đầy khói", "còn khói", "khói um/lan", "lửa to/bùng/lan", "bốc lửa", "té ngã không dậy", "đột quỵ", "co giật", "dây điện trần/thòng/lòi ra" ⇒ NONE (19/42 câu tự nghĩ) | FAIL | **cao (bỏ sót)** |
| M4 | Báo nhầm EMERGENCY MỚI do WP3b: "ngắt nước/đèn/wifi", "nước chảy lan", "tiền điện hộ", regex S-05 "tủ điện… chạy", "thang máy kẹt rác", "khối đặc" | FAIL | vừa (nghẽn BQL) |
| M6 | Bỏ Cf không chèn khoảng trắng ⇒ "có​khói" ⇒ NONE (hồi quy so với trước WP3b) | FAIL | vừa |
| M11 | Priority hồi quy: "rác chưa được dọn chắn hết lối đi", "sàn chưa lau nên trơn trượt" ⇒ L1 (trước: H2) | FAIL | vừa/thấp |
| M3, M7, M8, M12 | Hedge cùng mệnh đề không dấu câu hạ Bậc 2; lặp đúng 2 chữ; tổng bổ sung không giới hạn; `>=` với đồng hồ cố định chặn gỡ Bậc 2 trong mô phỏng | FAIL | thấp |
| M2, M5, M9, M10 | Tách chủ ngữ, câu bình thường theo danh sách, hiệu năng, phủ định cùng mệnh đề (19/20) | PASS/đo | — |

Báo nhầm: bộ 59 câu bình thường 12/59 bị nâng (0 ca mới do WP3b); bộ 33 câu nhắm từ vựng mới 27/33 (trước WP3b 14/33) — cận trên.

## Phán quyết SO (2026-10-02)
SO đo: 352/352 khớp; M1 tái hiện bằng một câu. Đây là lần FAIL thứ hai của cùng cổng an toàn (R05 → R07) ⇒ theo AGENTS.md K.5 + cò T1 ⇒ phân xử 🔴 (judge) về thiết kế trước khi mở WP3c (plan.md Q28).
🔁 SỬA: chờ phán xử judge (Q28)
