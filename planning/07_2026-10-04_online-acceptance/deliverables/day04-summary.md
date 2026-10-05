# Day04 — Báo cáo công việc cá nhân (Trường)

Môi trường: **localhost**, KHÔNG phải online · `LLM_MODE=mock`, `MO_STORE=memory` (xác nhận bằng `Select-String` trên `.env`) · dữ liệu mô phỏng `SIM-*` · baseline commit `3efb660` (feature/truong) · thực hiện 2026-10-04 22:25 → 2026-10-05 11:49 (Asia/Saigon).
Live URL/build online: chưa có (`BLOCKED_NO_DEPLOYMENT`). Chi tiết ca: [evaluation.md](../../evaluation.md). Ảnh: [evidence/ui/](evidence/ui/).

## Kết quả 15 ca (SPEC-P01)

**8 PASS · 0 FAIL · 1 BLOCKED · 6 NOT_RUN** (8+1+6 = 15).

| Nhóm demo | Ca | Kết quả |
|---|---|---|
| 1. Happy path | H01 vệ sinh · H02 đèn | PASS · PASS |
| 2. Thiếu info / asset | I01 · A01 | PASS · PASS |
| 3. Vật tư / trùng | M01 · U01 | PASS · PASS |
| 4. An toàn | S04 | PASS |
| 4. An toàn (chưa chạy) | S01, S02, S03, S05 | NOT_RUN |
| Guard | G03 | PASS |
| Guard (chưa chạy) | G01, G02 | NOT_RUN |
| Lưu bền | R01 | BLOCKED_MEMORY_STORE |

## Phần chưa hoàn thành và lý do

| Hạng mục | Trạng thái | Lý do / owner |
|---|---|---|
| S01, S02, S03, S05 | NOT_RUN | Rút gọn phạm vi theo quyết định của Trường (chỉ chạy flow theo script demo). Nhóm an toàn mới đo S04. |
| G01 (rating lần hai), G02 (đóng sớm) | NOT_RUN | Cùng quyết định rút gọn. |
| M01 (hạn chế) | PASS | Nhập 1 (vẫn dừng) rồi 1 (đủ, tự giao). Chưa gọi resume lần hai để chứng minh không giao trùng; thông báo "chạy tiếp" trên ảnh M01_02 xuất hiện sớm hơn thực tế. |
| R01 / D4-07 | BLOCKED | Store memory nên không chứng minh lưu bền. Cần `MO_STORE=postgres` (Supabase); owner Châm Anh. Chưa ghi thời điểm restart. |
| Manifest/results/issues JSON | Chưa tạo | CONTRACTS §1–2 cần xác nhận của người quản lý môi trường và mốc thời gian máy; chưa có. |
| Wording theo 4 vai | Một phần | Xem mục wording; chưa rà đầy đủ. |
| Online | BLOCKED_NO_DEPLOYMENT | Chưa có bản triển khai. |

## Lỗi / quan sát cần owner (chưa phân loại CRITICAL)

1. Ngoài giờ phòng ban: hiển thị "xử lý từ 06:00" nhưng phòng ban vẫn nhận việc và hoàn tất (H01, H02) — xác nhận thiết kế hay lỗi. Owner: nhóm backend.
2. Chữ "Agent" ở form cư dân; U01 ghi "4h" ở thẻ nhưng "2 days" ở ghi chú nội bộ. Owner: UI/rules.
3. Màn Kho hiển thị "cần 2 · tồn 0" chưa làm mới ngay sau khi nhập (M01_02). Owner: UI.
4. Bằng chứng: S04_02/S04_04 hiển thị ticket mẫu CLN-004 thay vì SIM-TKT-0006; G03_03 chưa phải GET sau thử; R01 thiếu R01_01 và chưa ghi giờ restart.

## Giới hạn mô phỏng

Máy cá nhân, dữ liệu giả, LLM mock (độ tin cậy 95% là từ luật cố định), store memory, jobs tắt, ảnh sau xử lý là ảnh minh họa, không có RAGAS/đo thời gian/người dùng thật. D-01 delta/snapshot ở mốc 19/10, không thuộc ngày này.

## Việc tiếp theo (ngày 05)

- Nếu còn thời gian: S02, G01, G02; gọi resume lần hai cho M01.
- Xin Châm Anh Supabase để đo R01 thật; tạo manifest/results/issues JSON.
- Rà wording 4 vai.

## Kết luận cá nhân (tách khỏi kết luận MVP)

Phạm vi rút gọn của Trường: 8/15 ca PASS có bằng chứng, 1 BLOCKED có owner, 6 NOT_RUN có lý do. **Không đồng nghĩa MVP đạt**, và không đủ điều kiện "hoàn thành đủ 15 ca" theo TESTING-ACCEPTANCE §3.
