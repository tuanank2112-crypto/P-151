# Báo cáo công việc ngày 04/10/2026 — Kiểm thử demo MaintenanceOps

Người thực hiện: Cao Văn Trường · Thời gian: 2026-10-04 22:25 → 2026-10-05 11:49 (Asia/Saigon)
Nguồn số liệu: [evaluation.md](../../evaluation.md) (output thực tế từng ca) · Ảnh: [evidence/ui/](../../planning/07_2026-10-04_online-acceptance/evidence/ui/) · Kế hoạch: [plan 07](../../planning/07_2026-10-04_online-acceptance/plan.md)

## 1. Mục tiêu và phạm vi

Thực hiện demo **theo script 4 nhóm** (happy path · thiếu info/asset · vật tư/trùng · an toàn), **đối chiếu expected outcome** với kết quả thật trên giao diện, **ghi phần chưa hoàn thành** và **giới hạn mô phỏng**. Phạm vi này được người thực hiện chủ động rút gọn so với SPEC gốc 15 ca (quyết định và xác nhận của người thực hiện ghi trong plan 07, 2026-10-05 11:49 và 11:52; bỏ qua S01, S02, S03, S05, G01, G02 ở đợt này).

## 2. Kết quả đối chiếu expected

| Nhóm demo | Ca | Expected | Kết quả thực tế | Kết luận | Bằng chứng |
|---|---|---|---|---|---|
| 1. Happy path | H01 vệ sinh | Giao Phòng Vệ sinh → xử lý → BQL nghiệm thu → cư dân thấy timeline | `SIM-TKT-0001`: Đã tiếp nhận → Chuyển phòng ban → Đang xử lý → Chờ nghiệm thu → Hoàn thành (22:25–22:32), 16 sự kiện audit | **PASS** | [H01_01](../../planning/07_2026-10-04_online-acceptance/evidence/ui/H01_01_cudan01_gui-phan-anh.png) … [H01_06](../../planning/07_2026-10-04_online-acceptance/evidence/ui/H01_06_cudan01_timeline-cuoi.png) |
| 1. Happy path | H02 đèn | Giao Phòng Kỹ thuật, khớp tài sản, vật tư, ảnh, nghiệm thu | `SIM-TKT-0002`: tài sản `SIM-ASSET-LIGHT-001` khớp, vật tư đã xuất/dùng 1, 1 ảnh sau xử lý, Hoàn thành 22:42 | **PASS** | [H02_01](../../planning/07_2026-10-04_online-acceptance/evidence/ui/H02_01_cudan01_phan_anh.png) … [H02_06](../../planning/07_2026-10-04_online-acceptance/evidence/ui/H02_06_cudan01_timeline-cuoi.png) |
| 2. Thiếu info | I01 | Dừng chờ bổ sung; BPTN bổ sung → đi tiếp; raw giữ nguyên | `SIM-TKT-0003`: "Chờ bổ sung thông tin" → BPTN bổ sung → chuyển Phòng Vệ sinh; nội dung gốc không đổi | **PASS** | [I01_01](../../planning/07_2026-10-04_online-acceptance/evidence/ui/I01_01_cudan01_thieu-thong-tin.png) … [I01_04](../../planning/07_2026-10-04_online-acceptance/evidence/ui/I01_04_ket-qua.png) |
| 2. Asset chưa rõ | A01 | BPTN xác nhận tại hiện trường, không bịa mã asset → giao Kỹ thuật, cờ ASSET_CHECK_ONSITE | `SIM-TKT-TEC-002` chuyển Phòng Kỹ thuật, có cảnh báo `ASSET_CHECK_ONSITE` | **PASS** | [A01_01](../../planning/07_2026-10-04_online-acceptance/evidence/ui/A01_01_bptn01_asset-chua-ro.png), [A01_03](../../planning/07_2026-10-04_online-acceptance/evidence/ui/A01_03_ket-qua.png) |
| 3. Vật tư | M01 | Thiếu → dừng; nhập thiếu vẫn dừng; nhập đủ → tự giao, không trùng | `SIM-TKT-TEC-003`: cần 2/tồn 0 → "Tạm hoãn, Chờ vật tư" → kho nhập 1: vẫn tạm hoãn (11:33) → nhập thêm 1: tự giao Phòng Kỹ thuật (11:34) | **PASS** | [M01_01](../../planning/07_2026-10-04_online-acceptance/evidence/ui/M01_01_bql01_cho-vat-tu.png) (thiếu), [M01_03](../../planning/07_2026-10-04_online-acceptance/evidence/ui/M01_03_van-tam-hoan.png) (nhập 1, vẫn tạm hoãn), [M01_04](../../planning/07_2026-10-04_online-acceptance/evidence/ui/M01_04_kho01_nhap-du.png) (nhập đủ), [M01_05](../../planning/07_2026-10-04_online-acceptance/evidence/ui/M01_05_da-giao.png) (đã giao) |
| 3. Trùng | U01 | Giữ ở "Nghi trùng", BPTN quyết định, nhánh không gộp đi tiếp | `SIM-TKT-0005` nghi trùng `0004`; BPTN thấy 2 nút Gộp / Không trùng; chọn không trùng → chuyển phòng ban | **PASS** | [U01_02](../../planning/07_2026-10-04_online-acceptance/evidence/ui/U01_02_bptn01_canh-bao-trung.png), [U01_04](../../planning/07_2026-10-04_online-acceptance/evidence/ui/U01_04_ket-qua.png) |
| 4. An toàn | S04 (Bậc 1) | Dừng chờ BQL, BQL có đúng 2 lựa chọn, đóng khẩn cấp có audit | `SIM-TKT-0006`: cư dân thấy "đang được kiểm tra" (không lộ mã nội bộ); BQL đóng, Hoàn thành 23:18 | **PASS** | [S04_01](../../planning/07_2026-10-04_online-acceptance/evidence/ui/S04_01_cudan01_trang-thai.png), [S04_02](../../planning/07_2026-10-04_online-acceptance/evidence/ui/S04_02_bql01_lua-chon.png) |
| Guard | G03 | Sai vai bị 403, ticket không đổi | BPTN hạ Bậc 1 → 403 `ACTION_DENIED` (audit `SIM-AUD-TEC-005-0003`); phòng Vệ sinh nhận ticket Kỹ thuật → 403 (`...-0004`) | **PASS** | [G03_01](../../planning/07_2026-10-04_online-acceptance/evidence/ui/G03_01_bptn-ha-bac1-403.png), [G03_02](../../planning/07_2026-10-04_online-acceptance/evidence/ui/G03_02_phong-sai-accept-403.png) |
| Lưu bền | R01 | Với store memory, mất dữ liệu sau restart là dự kiến; ghi BLOCKED | `MO_STORE=memory`; ticket tối 4/10 không còn sau khi khởi động lại | **BLOCKED_MEMORY_STORE** | [R01_02](../../planning/07_2026-10-04_online-acceptance/evidence/ui/R01_02_truoc-restart.png), [sau restart](../../planning/07_2026-10-04_online-acceptance/evidence/ui/01_03_sau-restart.png) |

**Tổng (ma trận 15 ca Day04): 8 PASS · 0 FAIL · 1 BLOCKED · 6 NOT_RUN** (8+1+6 = 15).

## 3. Phần chưa hoàn thành

- **NOT_RUN (chủ động rút gọn):** S01, S02, S03, S05 (an toàn Bậc 2; hạ mức Bậc 1), G01 (rating lần hai), G02 (đóng sớm / đóng khẩn cấp bằng đường thường). Nhóm an toàn mới đo 1/5 ca.
- **M01 hạn chế:** chưa gọi resume lần hai để chứng minh "chạy lại không giao trùng"; thông báo "chạy tiếp" trên ảnh M01_02 xuất hiện trước khi ticket được giao.
- **R01 BLOCKED:** cần `MO_STORE=postgres` (Supabase) do Châm Anh cung cấp; chưa ghi thời điểm restart.
- Chưa tạo manifest/results/issues JSON theo contract; chưa rà wording đầy đủ 4 vai; chưa có bản online (`BLOCKED_NO_DEPLOYMENT`).

## 4. Giới hạn mô phỏng

| Hạng mục | Thực tế khi đo |
|---|---|
| Môi trường | localhost (máy cá nhân), không phải online/deploy |
| LLM | `LLM_MODE=mock`: chỉ luật cố định; "độ tin cậy 95%" không phải số đo mô hình |
| Lưu trữ | `MO_STORE=memory`: restart mất dữ liệu |
| Dữ liệu | Fixture `SIM-*`, tài khoản demo; không có cư dân/ảnh thật (ảnh sau xử lý là ảnh minh họa) |
| Thao tác | UI web cho H01, H02, I01, A01, M01, U01, S04; Swagger cho G03 |
| Chưa đo | RAGAS/chất lượng LLM, thời gian phản hồi, nhiều người dùng, phản hồi người dùng thật |

## 5. Quan sát phụ (chưa sửa)

1. Ticket gửi ngoài giờ hiển thị "xử lý từ 06:00" nhưng phòng ban vẫn nhận việc và hoàn tất (H01, H02) — cần xác nhận là thiết kế hay lỗi.
2. Chữ "Agent" ở form cư dân là thuật ngữ nội bộ; U01 ghi "4h" ở thẻ nhưng "2 days" ở ghi chú nội bộ; màn Kho chưa làm mới tồn ngay sau khi nhập (M01).
3. Hạn chế bằng chứng: S04_02/S04_04 hiển thị ticket mẫu `SIM-TKT-CLN-004` thay vì `0006`; G03_03 chưa phải GET sau thử; ảnh R01 chưa đặt đúng tên trước/sau. Token trong ảnh G03 đã được che.

## 6. Kết luận

Đã **thực hiện demo theo script cho 4 nhóm**, đối chiếu expected và có ảnh bằng chứng cho từng ca đạt. **Phạm vi rút gọn đã hoàn thành** (8 ca PASS, 1 BLOCKED có owner). **Không đồng nghĩa** đã chạy đủ 15 ca theo SPEC gốc, và **không đồng nghĩa** MVP đạt.
