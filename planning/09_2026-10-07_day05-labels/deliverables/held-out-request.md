> LỊCH SỬ: yêu cầu 30 câu đã được thay bằng PRELIMINARY_15 ngày 08/10/2026; không cần điền thêm để đạt quota cũ. Xem ../specs/SPEC-P03-PRELIMINARY15.md.

# Held-Out Request — 30 Cases Cần Soạn Độc Lập (AUTHORED)

Bảng dưới đây yêu cầu 30 cases mới (AUTHORED, chưa dùng tuning) để xây dựng bộ held-out test độc lập với DEVELOP.

**Phân bố:**
- 5 EMERGENCY (P0 signals: S-01..S-05, S-09, S-14)
- 5 UNCLEAR (nghi ngờ, đã xảy ra, từ đa nghĩa, âm thanh lạ, phủ định kép)
- 20 NONE: 7 VE_SINH + 7 chiếu sáng + 6 UNKNOWN

**Ràng buộc:**
- ≥10 families, ≤3 cases per family
- CẤM D4-11 (đã biết lỗi, dùng cho DEVELOP regression)
- CẤM copy fixture từ seed/maintenance_cr03/safety_cases.json hay tests/

**Gợi ý hiện tượng cần phủ:**

| Danh mục | Gợi ý cho người soạn | Số cases |
|----------|-------|------|
| **EMERGENCY (5)** | S-01 mùi khét, S-02 tia lửa, S-03 dây điện hở, S-04 khói, S-05 lửa thật, S-09 người bị thương/mắc kẹt, S-14 chất lạ + dấu nguy hại | 5 |
| **UNCLEAR (5)** | Hedged ("hình như", "có vẻ"), past event ("hôm qua... giờ hết"), multimeaning ("cháy", "chập" riêng), strange sound, double negation | 5 |
| **NONE VE_SINH (7)** | Rác tràn, sàn ẩm, tường bẩn, mùi hôi, côn trùng, chất lạ mô phỏng, sự cố vệ sinh khác | 7 |
| **NONE KY_THUAT chiếu sáng (7)** | Bóng đèn cháy, hỏng, nhấp nháy, không sáng, hệ thống chiếu sáng công cộng | 7 |
| **NONE UNKNOWN (6)** | Ngoài phạm vi (cửa, khóa, thiết bị khác), mixed category không rõ (kho, máy giặt), vật lạ không hazard | 6 |
| **Tổng** | | **30** |

---

## Checklist Người Soạn

Mỗi case cần:
- [ ] Text tiếng Việt, cư dân báo cáo, không copy fixture
- [ ] Phenomena: ≥1 thẻ mô tả
- [ ] Notes: giải thích ngắn tại sao thuộc category này
- [ ] family_id: nhóm biến thể, ≤3 cases per family
- [ ] Source kind: "AUTHORED" khi tự soạn (không EXISTING_FIXTURE, không LLM_PROPOSAL)
- [ ] No PII, no credentials

---

## Template HTML Table (Người soạn điền vào)

Sau khi hoàn tất, submit bảng với format:

| # | Case Text | Risk Level | Phenomena | Family | Notes | Phenomena cần cover |
|----|-----------|-----------|-----------|--------|-------|----------|
| H1 | | EMERGENCY | | F-HO-01 | S-01 mùi khét | |
| H2 | | EMERGENCY | | F-HO-02 | S-02 tia lửa | |
| H3 | | EMERGENCY | | F-HO-03 | S-03 dây điện hở | |
| H4 | | EMERGENCY | | F-HO-04 | S-04 khói | |
| H5 | | EMERGENCY | | F-HO-05 | S-05 lửa/cháy | |
| U1 | | UNCLEAR | | F-HO-U01 | Hedged + P0 signal | |
| U2 | | UNCLEAR | | F-HO-U02 | Past event | |
| U3 | | UNCLEAR | | F-HO-U03 | Multi-meaning | |
| U4 | | UNCLEAR | | F-HO-U04 | Strange sound | |
| U5 | | UNCLEAR | | F-HO-U05 | Double negation | |
| N1 | | NONE | garbage | F-HO-N01 | VE_SINH | |
| N2 | | NONE | garbage | F-HO-N02 | VE_SINH | |
| N3 | | NONE | wet | F-HO-N03 | VE_SINH | |
| N4 | | NONE | wet | F-HO-N04 | VE_SINH | |
| N5 | | NONE | odor | F-HO-N05 | VE_SINH | |
| N6 | | NONE | wall | F-HO-N06 | VE_SINH | |
| N7 | | NONE | pest | F-HO-N07 | VE_SINH | |
| N8 | | NONE | lamp | F-HO-N08 | KY_THUAT | |
| N9 | | NONE | lamp | F-HO-N09 | KY_THUAT | |
| N10 | | NONE | lamp | F-HO-N10 | KY_THUAT | |
| N11 | | NONE | lamp | F-HO-N11 | KY_THUAT | |
| N12 | | NONE | lamp | F-HO-N12 | KY_THUAT | |
| N13 | | NONE | lamp | F-HO-N13 | KY_THUAT | |
| N14 | | NONE | lamp | F-HO-N14 | KY_THUAT | |
| N15 | | NONE | door | F-HO-N15 | UNKNOWN | |
| N16 | | NONE | water | F-HO-N16 | UNKNOWN | |
| N17 | | NONE | laundry | F-HO-N17 | UNKNOWN | |
| N18 | | NONE | substance | F-HO-N18 | UNKNOWN | |
| N19 | | NONE | equipment | F-HO-N19 | UNKNOWN | |
| N20 | | NONE | other | F-HO-N20 | UNKNOWN | |

---

**Deadline:** Ghi rõ trong bảng khi hoàn tất.  
**Format final:** JSON per CONTRACTS §2, 01-CONTRACTS §3-4 cho classification/safety gold khi review.
