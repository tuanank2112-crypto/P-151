Vai: auditor · loại: thẩm định · họ/model: Claude Sonnet 5.5 · Bước 0 exit: 0 · hiểu việc: chỉ đọc + chạy lệnh trên HEAD 5a6110c để phá tầng an toàn 2b, đường gỡ EMERGENCY_PENDING_BQL, view cư dân, quyền/audit, đồng thời; không đọc handoff/report/evidence/plan.
Handoff: (giao trực tiếp trong lời gọi WP6 — nội dung tóm ở plan.md Q24)
Base: 5a6110c
Head: 5a6110c (thẩm định không ghi; script ở scratchpad\audit\)

## Bộ test có sẵn
`python -m pytest -q -p no:cacheprovider` (LLM_MODE=mock): 313 passed, 0 fail, 0 skip, EXIT=0.

## X-1..X-8 (TESTING-ACCEPTANCE)
X-1..X-8 đều PASS. Ghi chú X-2: `bptn_resolve` trên blocker BQL ra 403 (đúng CR §4.4.5, theo Q23) — chữ "409" trong TESTING X-2 lỗi thời.

## Cách phá mới
| ID | Mô tả | KQ | file:dòng |
|---|---|---|---|
| N-01 | Phủ định lan qua dấu phẩy/xuống dòng/"và": "không có điện, tia lửa tóe ra"; "không thấy đèn sáng\nTia lửa tóe ra"; "không phải đèn hỏng, khói bốc ra" ⇒ NONE | **FAIL (bỏ sót Bậc 1)** | safety.py:104-112, 45-48; lexicon.yaml:11-28 |
| N-02 | Marker đã xảy ra/hedge áp sang tín hiệu khác mệnh đề: "đèn đã tắt, có khói bốc ra"; "hỏng hết rồi, có mùi khét"; "có khói … đã ổn chưa?"; "nghi là chập, có khói" ⇒ hạ Bậc 2 | FAIL | safety.py:113-126; lexicon.yaml:30-55 |
| N-03 | B-01 che "Ổ cắm … cạnh đèn … bị cháy đen" ⇒ NONE | FAIL | safety.py:204-209; lexicon.yaml:63-72 |
| N-04 | B-04 quá rộng: "hộp điện cạnh bếp … mùi khét"; "dây điện màu nâu … mùi khét" (nâu/nấu → `nau`) ⇒ hạ Bậc 2 | FAIL | safety.py:157-160; lexicon.yaml:90-102 |
| N-05 | Thiếu từ vựng: "ngất", "hỏa hoạn", "khói mù mịt", "thấy lửa bốc lên", "dây điện bị hở", "hở điện", "kẹt thang máy" ⇒ NONE ("ngất" còn ra NEED_INFO) | **FAIL (bỏ sót Bậc 1)** | lexicon.yaml:137-147 |
| N-06 | Ký tự lạ: zero-width, fullwidth, kéo dài ("khóiiiii") ⇒ NONE | **FAIL (bỏ sót Bậc 1)** | safety.py:29-52; catalog.py:140 |
| N-07 | DoS: mô tả 6 KB ⇒ 2,3 s, chặn request khác 2 s; 24 KB ⇒ 43 s; không giới hạn độ dài | FAIL | safety.py:84-94 (O(n²)); routers/maintenance.py:208 |
| N-08 | Phủ định kép "không phải không có khói" ⇒ NONE | FAIL (nhẹ) | safety.py:104-112 |
| N-09 | Bổ sung cùng instant với lúc xác nhận an toàn không quét lại 2b | FAIL (nhẹ, biên) | engine.py:2007 (`>` thay `>=`), 1879 |
| N-10 | Priority bỏ qua phủ định: "không chắn lối đi, không trơn trượt" ⇒ HIGH PRI-H2 | FAIL (nhẹ) | priority.py:41-44; lexicon.yaml:168-182 |
| N-11 | Prompt injection trong nội dung | PASS | |
| N-12 | Mọi đường gỡ EMERGENCY ngoài BQL (10 vai × 10 đích, resume, jobs +60 ngày, receive_stock, bổ sung, HTTP) | PASS | |
| N-13 | View cư dân suốt vòng đời không lộ risk/reason/priority | PASS (ghi chú: `cancel_reason` hiển thị nguyên văn — có từ trước) | |
| N-14 | Fuzz 900 tổ hợp quyền/audit/bất biến | PASS (quan sát: `cancel` không có AuditEvent) | engine.py:1114-1117 |
| N-15 | Hạn 4 h lịch / 12 h, job không tự gỡ, BQL trước leo thang 403 | PASS | |

## Kết luận auditor
Đề xuất 🔁 SỬA N-01..N-10. Không ⛔: quyền, audit, chặn gỡ EMERGENCY, đồng thời giữ vững.

## Phán quyết SO (2026-10-02)
SO đo: report đủ dòng khai vai; 313/313 khớp lần đo của SO; N-01 tái hiện được bằng một lệnh. Kết quả mong đợi cho từng ca chốt ở plan.md Q24–Q27; sửa theo H05.
🔁 SỬA: N-01..N-10 theo H05_wp3b-safety-hardening.md
