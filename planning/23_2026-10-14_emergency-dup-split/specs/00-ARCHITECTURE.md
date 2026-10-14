# 00 — Kiến trúc

## 1. Vấn đề (đo 2026-10-14 trên `fc434d6`, engine memory, đường luật)
| Ca | Hiện trạng đo được |
|---|---|
| A. Hai cư dân báo cùng một khẩn cấp (cùng vị trí) | 2 ticket `EMERGENCY_PENDING_BQL` rời; chỉ `related_ticket_ids`; `duplicate_count` = 0; không có route để BQL gộp |
| C. Phản ánh hai việc có khẩn cấp, BQL hạ mức | Ticket dừng `CATEGORY_UNCLEAR`, không tách (P05 §3 đk 4) |
| E. Khẩn cấp đèn đang mở + "đèn không sáng" cùng chỗ | Ticket thường `ROUTED` Kỹ thuật song song |

## 2. Mục tiêu
1. BQL thấy ngay ca khẩn cấp nào nghi trùng ca nào, bao nhiêu người cùng báo, và gộp được bằng một nút (SPEC-P01).
2. Ca khẩn cấp hai việc, sau khi người gỡ an toàn, đi tiếp như phản ánh hai việc thường: tách, mỗi việc một phòng (SPEC-P02).
3. Không giao phòng ban làm cùng loại việc ở đúng chỗ đang có khẩn cấp mở (SPEC-P03).

## 3. Non-goals
- Không tự gộp ca khẩn cấp. Không đổi luật/từ vựng an toàn. Không gọi thêm LLM.
- Không đổi app điện thoại `src/mobile/` ở hồ sơ này (portal trước; mobile = Idea Vault).

## 4. Bất biến
| # | Luật |
|---|---|
| I-1 | Ca khẩn cấp nghi trùng VẪN ở `VERIFYING / EMERGENCY_PENDING_BQL`, chủ BQL. **CẤM** đổi trạng thái/ẩn nó vì nghi trùng |
| I-2 | Chỉ người (BQL) gộp ca khẩn cấp (`bql_merge`). Engine chỉ đánh dấu + đếm |
| I-3 | Mỗi ca nghi trùng được đếm đúng MỘT lần trên ca gốc; rời trạng thái nghi trùng (hạ mức, đóng, hủy, gộp vào ca khác) ⇒ trả lại đúng một lần |
| I-4 | Ticket con của tách thừa hưởng mốc gỡ an toàn của gốc; KHÔNG được bật lại khẩn cấp từ nội dung đã được người gỡ |
| I-5 | Loại việc của ca khẩn cấp CHỈ do người ghim hoặc Agent đọc (SPEC-P04). **CẤM** suy từ chữ bằng luật/từ khoá (Q30, E05) |
| I-6 | Mọi ghi qua `_mutate`/`_apply_transition`; ticket đã kết thúc không bị ghi (I-26) |

## 5. Vùng cấm
- **Không tự gộp khi vị trí trùng** — hai ca cháy cùng hành lang có thể là hai đám khác nhau; gộp sai làm mất một ca khẩn cấp.
- **Không dùng cửa sổ thời gian 48 giờ cho nghi trùng khẩn cấp** — ca khẩn cấp mở là còn mở (giống P1-E `_open_emergencies_at`).
- **Không đoán loại ca khẩn cấp bằng từ khoá** (`category_evidence`, `_classification`) — đã thử (E02) và bị R01 F1 + người dùng bác: đổi một chữ là đổi kết quả, có ca giao Kỹ thuật vào chỗ nguy hiểm điện.
- **Không bật cờ `hold_near_open_emergency` thành true** — cờ vẫn nghĩa "giữ mọi ticket cùng chỗ", người dùng chưa chọn.

## 6. Thứ tự đọc
01-CONTRACTS → P01 → P02 → P03 → P04 → OPERATIONS → TESTING-ACCEPTANCE.
