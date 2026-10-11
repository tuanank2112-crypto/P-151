# 00 — Kiến trúc: tài sản đèn theo khu vực (plan 14)

Thứ tự đọc: 00 → [01-CONTRACTS](01-CONTRACTS.md) → [OPERATIONS](OPERATIONS.md) → [TESTING-ACCEPTANCE](TESTING-ACCEPTANCE.md).

## §1. Mục tiêu
Người dùng (2026-10-10, ảnh form "Xác định tài sản"): "Mỗi loại vật tư đại diện cho khu vực: Sảnh - hành lang - Phòng rác
(không phải chi tiết từng tòa-tầng như vậy ⇒ dư thừa)", "đèn hành lang tầng 1 cũng giống tầng 6", "có cả cầu thang bộ".

⇒ Catalog có đúng **4 tài sản đèn ACTIVE**, mỗi khu vực một cái: Hành lang · Sảnh thang máy · Cầu thang bộ · Phòng rác
(trùng 4 khu vực form cư dân `src/mobile/js/resident.js` `AREAS`). Engine (bước 6), Agent và danh sách chọn của BPTN
chỉ nhìn **khu vực** của vị trí; tòa/tầng vẫn nằm trong `location` của ticket cho phòng ban đi tới.

## §2. Non-goals
- KHÔNG đổi luật trích vị trí (`rules.extract_location`, `AREA_PATTERNS`), luật ưu tiên, luật trùng (trùng vẫn so đủ tòa/tầng/khu vực).
- KHÔNG thêm loại tài sản ngoài `LIGHTING`; KHÔNG thêm tài sản cho Hầm xe, Sảnh chính, Sảnh cư dân, Lối thoát hiểm… (người dùng chốt 4).
- KHÔNG migrate ticket cũ trong DB chung: mã cũ trên ticket giữ nguyên làm lịch sử.

## §3. Bất biến
| # | Bất biến | Chốt chặn |
|---|---|---|
| I-1 | Mỗi khu vực tối đa MỘT tài sản `ACTIVE_SIMULATED`; `area` phải là nhãn của `rules.AREA_PATTERNS` | `Catalog._assets_one_per_area` (load lỗi ⇒ app không khởi động) |
| I-2 | Tra tài sản = so `rules.location_area(location)` với `asset.area`, CHỈ tài sản active | `engine._step_6_lookup_asset` |
| I-3 | Tài sản `RETIRED_SIMULATED` không bao giờ được đề xuất, chọn, hay trả cho UI | engine guard `bptn_resolve`, `_decision_input` (ứng viên Agent), API `/mo/catalog` |
| I-4 | Khu vực không có tài sản ⇒ `NOT_FOUND` ⇒ `VERIFYING / ASSET_UNCLEAR` (BPTN chọn hoặc "kiểm tại hiện trường") — không tự giao | step 6 không đổi nhánh |
| I-5 | Đổi chữ prompt ⇒ `PROMPT_VERSION` tăng và REF plan 06 đổi cùng chữ (test `test_p_01`) | `agent-prompt/2` |

## §4. Vùng cấm (đã cân nhắc, KHÔNG làm)
| Ý tưởng | Vì sao không |
|---|---|
| Chỉ đổi chữ hiển thị trong dropdown, giữ 6 tài sản theo tòa-tầng | Danh sách ra nhiều dòng "Hành lang" giống nhau, mỗi dòng vẫn gửi mã của một tòa-tầng cụ thể ⇒ dữ liệu sai |
| Xoá hẳn 6 mã cũ | Ticket cũ trong Supabase chung còn trỏ tới `SIM-ASSET-LIGHT-00x`; giữ dạng RETIRED rẻ và an toàn |
| Tự map mã cũ → mã khu vực khi BPTN chọn | Lén đổi giá trị người chọn; guard từ chối rõ ràng tốt hơn |
| So khu vực bằng chuỗi con (`"hành lang" in location`) | "Sảnh thang máy" vs "Sảnh chính"… — dùng đúng `AREA_PATTERNS` theo thứ tự như trích vị trí |
| Gom "Sảnh chính"/"Sảnh cư dân" vào tài sản "Sảnh thang máy" | Người dùng chốt 4 khu vực theo form cư dân; sảnh khác ⇒ BPTN chọn tay (I-4) |

## §5. Ảnh hưởng hành vi (đo trên 12 ticket mẫu, sau khi chỉnh 2 ticket mẫu — xem 01 §4)
| Trước | Sau |
|---|---|
| Sảnh thang máy tầng 5 S1 ⇒ AMBIGUOUS (2 tài sản) ⇒ ASSET_UNCLEAR | MATCHED `SIM-ASSET-LIGHT-LIFT-LOBBY` ⇒ ROUTED |
| Cầu thang bộ / Phòng rác / hành lang tầng không đăng ký ⇒ NOT_FOUND | MATCHED theo khu vực |
| Hầm xe tầng B1 S1 ⇒ MATCHED `…-006` | NOT_FOUND ⇒ ASSET_UNCLEAR (không có tài sản Hầm xe) |
