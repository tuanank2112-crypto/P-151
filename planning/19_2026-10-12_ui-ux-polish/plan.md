# 19 — Làm gọn UI/UX theo danh sách của người dùng

## Metadata
- Trạng thái: ĐỢT 1 XONG, ĐÃ COMMIT + PUSH (`e2ab6e4`, `489abe9`; chờ người dùng thử tay G5) · đợt 2 PROPOSED (chưa thi công).
- Nguồn yêu cầu: Google Doc của người dùng (2026-10-12, `19hhYbCikdDPjnhm985F1w4_YFaEOlqgsAAoiDUiv9tM`) + 3 ảnh chụp (Tổng quan BQL, Danh sách ticket, Kho vật tư).
- Nhánh: `feature/chamanh`. Base: `b7ae85b` (v1.12.3). Phiên bản đích đợt 1: **1.13.0** (MINOR).
- Không deploy, không ghi Supabase chung. Push chỉ khi người dùng bảo.

## Nhật ký quyết định
- 2026-10-12 D01 (người dùng duyệt Q1–Q7): Q1 dashboard Agent = tỷ lệ đúng theo thời gian + theo loại việc + số ca Agent/luật bất đồng; Q2 ô thứ ba của BQL = **Hoàn tất**; Q3 việc ngoài phạm vi chỉ ở Tiếp nhận, Tiếp nhận được đóng "Đã xử lý (ngoài phạm vi)" kèm lý do; Q4 Kho bỏ "Phiếu yêu cầu cấp phát", "Lịch sử Nhập/Xuất" chỉ xem, "Xuất hàng" thủ công chỉ cho hao hụt/điều chỉnh kèm lý do; Q6 định nghĩa số liệu theo 01-CONTRACTS §6; Q7 nhóm tòa theo tiền tố S1/S2.
- 2026-10-12 D02 (người dùng): ngưỡng tồn tối thiểu **riêng từng vật tư** + tồn mô phỏng sát thực tế (thay mặc định 30 ở Q5). Giá trị: 01-CONTRACTS §5.
- 2026-10-12 D03 (agent): đợt 1 = chỉ UI + dữ liệu mô phỏng + một trường đọc `min_qty` (cộng thêm, không phá API). Mọi thay đổi quy tắc nghiệp vụ backend để đợt 2.
- 2026-10-12 D04 (agent): việc ngoài phạm vi mà Agent đã chuyển BQL vẫn HIỆN ở BQL (cuối ô "Cần BQL quyết") cho tới khi đợt 2 đổi quy tắc Q3 — bỏ sớm sẽ làm ticket mồ côi (Tiếp nhận đang loại ticket đã leo thang).
- 2026-10-12 D06 (agent): vá rò phiên ở proxy cổng 8000 (`src/main.py`) ngay trong đợt 1 — phát hiện khi chụp ảnh, ảnh hưởng mọi vai; ngoài phạm vi UI nhưng là lỗi bảo mật đo được. Test `tests/test_portal_proxy_cookies.py`.
- 2026-10-12 D07 (agent, sau ảnh chụp): thêm nhóm "Chưa giao phòng" (01 §1), `hasLocation` (01 §7), nút phòng ban xếp dọc thay vì 2 cột (chữ dài xuống dòng trong thẻ hẹp).
- 2026-10-12 D05 (agent): biểu đồ bằng CSS/SVG, không thêm thư viện; không thêm nút chưa có backend (Xuất hàng, Lịch sử, tab Kho mới) vào đợt 1.


- 2026-10-12 D09 (người dùng duyệt A1–A5 sau khi agent rà UI vai BQL): A1 Danh sách ticket trên điện thoại gộp phòng ban + giờ dưới tiêu đề, không cuộn ngang; A2 "Chưa giao phòng" thay `--`, ẩn cột Phòng ban khi không dòng nào có phòng; A3 ticket không tiêu đề hiện "Chưa có nội dung, chờ cư dân bổ sung" (`headline`), chuông BQL một nhãn (Khẩn cấp ưu tiên), bấm thông báo ⇒ mở ticket / ô "Cần BQL quyết"; A4 ô lý do bắt buộc có dòng gợi ý khi nút còn khoá; A5 tên hiển thị seed `bql01` = "Ban quản lý Tòa nhà", ô điều hướng "Việc của Ban quản lý". Chưa làm (chờ duyệt): B1 thanh phụ tải có mẫu số, B2 rút gọn modal chi tiết, B3 ô Hoàn tất, C1 = SPEC-P04 §2. Ảnh: `evidence/a1-a5/`.

- 2026-10-12 D10 (người dùng chọn phương án B): Lịch sử hoàn thành của Kỹ thuật/Vệ sinh đổi từ ô chọn một tòa sang chip lọc chọn nhiều (không chọn = tất cả) + chip trạng thái Chờ nghiệm thu/Hoàn tất + tìm kiếm + nhãn tòa trên thẻ + "Xem thêm". Ảnh: `evidence/history-chips/`. Chưa đổi app điện thoại (`dept.js`).

- 2026-10-12 D11 (người dùng): Kho — bỏ thẻ "Hết hàng"; thẻ "Cần nhập thêm" đổi màu theo mức nặng nhất (xanh/vàng/đỏ); bảng xếp hết hàng lên đầu; thêm thẻ "Vật tư dùng nhiều trong tuần". Agent: thêm endpoint đọc `GET /mo/warehouse/usage` (kho + BQL) vì thủ kho không đọc được ticket đã hoàn thành; test `tests/test_maintenance/test_material_weekly_usage.py` (đỏ khi bỏ lọc quyền/cửa sổ 7 ngày). Phiên bản/não chưa tăng.

### Quyết định bị thay thế
- SPEC-P03 §1 "đỏ khi > 0, thẻ Hết hàng" → bởi D11.
- SPEC-P01 §3 "danh sách chỉ hiện ticket của ô tòa đang chọn" → bởi D10.
- SPEC-P02 §2/§4 "Phòng ban `--` khi chưa có" → "Chưa giao phòng" bởi D09 (A2).
- Q5 "ngưỡng mặc định 30 cho mọi vật tư" → thay bởi D02 (ngưỡng riêng). Lý do: tồn mô phỏng 10/20/5/0 khiến gần như mọi dòng "Sắp hết".
- Tab "Đã phân loại" v1.12.3 có chip "Đang ở phòng ban" → tách thành "Phòng kỹ thuật" và "Phòng vệ sinh" (SPEC-P01 §1).

## Work Packages
| WP | Nội dung | SPEC | Tầng |
|---|---|---|---|
| WP1 | Tiếp nhận + Kỹ thuật + Vệ sinh | SPEC-P01 | 🟠 |
| WP2 | BQL: điều hướng, Danh sách ticket, Việc của BQL, Tổng quan | SPEC-P02 | 🟠 |
| WP3 | Kho: bảng, nhãn tồn, thẻ lọc, dữ liệu mô phỏng, `min_qty` | SPEC-P03 | 🟠 (🔴 phần contract `min_qty` đã chốt ở 01 §5) |
| WP4 | Đợt 2: Q3 backend, endpoint hiệu suất, Kho lịch sử/xuất, dashboard Agent | SPEC-P04 | 🔴 (PROPOSED) |

## Checklist thực thi
- [x] Commit v1.12.3 còn chờ (`b7ae85b`)
- [x] Bộ SPEC đợt 1
- [x] WP1 (P01 §1–§3)
- [x] WP2 (P02 §1–§5)
- [x] WP3 (P03 §1–§4)
- [x] Gate đợt 1 G1–G4 ✅ local (TESTING-ACCEPTANCE §2)
- [x] Đồng bộ não + 1.13.0
- [x] BQL A1–A5 (D09) ✅ local: typecheck/lint sạch, vitest 136 unit pass, ảnh 1440/390 không tràn ngang
- [x] Lịch sử hoàn thành dạng chip lọc (D10) ✅ local: vitest 140 pass, tsc/eslint sạch, trình duyệt 1440/390 cho Kỹ thuật + Vệ sinh không tràn ngang, 0 lỗi JS
- [ ] Người dùng thử tay và duyệt đợt 1
- [ ] Đợt 2: chi tiết hoá SPEC-P04 rồi xin duyệt

## Router SPEC
00-ARCHITECTURE.md → 01-CONTRACTS.md → SPEC-P01-reception-dept.md → SPEC-P02-bql.md → SPEC-P03-warehouse.md → SPEC-P04-wave2.md → OPERATIONS.md → TESTING-ACCEPTANCE.md
