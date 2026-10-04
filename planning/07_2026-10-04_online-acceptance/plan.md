# Trường — kiểm thử nghiệp vụ MVP trên localhost ngày 04/10

- Status: PROPOSED — chờ người dùng duyệt kế hoạch; chưa thực thi kiểm thử ngày04.
- Created: 2026-10-04T11:49:44+07:00 (Asia/Saigon).
- Owner: Cao Văn Trường — nghiệp vụ, expected outcome, demo, tổng hợp thiếu sót.
- Source: https://storm-jade-f74.notion.site/K-ho-ch-MaintenanceOps-MVP-3e43b68a924d80d7a81fe0579e1eddb9 (phân công đã đọc trực tiếp 03/10).
- Milestones: nghiệm thu nhóm 2026-10-04T21:00:00+07:00; khóa MVP 23:59 cùng ngày.
- Baseline: kết luận local Day03 trên f46a53c; SHA deploy online phải xác nhận mới.
- Dependencies: địa chỉ localhost/build/tài khoản demo/cấu hình local được xác nhận; restart do Châm Anh thực hiện.

## Nhật ký quyết định

- 2026-10-04: người dùng xác nhận nhóm chỉ chạy localhost, chưa có URL online. Thay môi trường thực thi hôm nay bằng local-qa; giữ đường dẫn hồ sơ. Nghiệm thu online riêng BLOCKED_NO_DEPLOYMENT. Không đoán port hoặc cấu hình tiến trình.

- 2026-10-04T11:49:44+07:00: lập kế hoạch từ yêu cầu người dùng, chia 8 task/15 ca bắt buộc. Chỉ lập hồ sơ, không gọi API ghi, restart, deploy, push hoặc gửi tin cho nhóm.
- 2026-10-04T11:49:44+07:00: D-01 delta/snapshot ngoài MVP theo quyết định ngày 03; không tự đưa lại thành gate ngày 04. Quét safety khi cư dân bổ sung trong NEED_INFO vẫn thuộc ca S03.
- 2026-10-04T11:49:44+07:00: dùng contract/code hiện tại và kết luận cuối Day03; không dùng các câu TARGET UNIMPLEMENTED lịch sử trong runbook cũ để kết luận hiện trạng.
- 2026-10-04T11:49:44+07:00: Bước 0 exit1 MODULE_NOT_FOUND do thiếu hub. Không sửa luật managed; không suy ra ứng dụng lỗi từ lỗi hub.

### Quyết định bị thay thế

- Giả định chạy online QA trong bản lập đầu bị thay thế bởi xác nhận chỉ có localhost; yêu cầu online của MVP vẫn chưa đạt. Trạng thái lỗi của các vòng Day03 đầu chỉ là lịch sử, không thay thế kết luận cuối.

## Work packages và checklist

- [ ] D4-01 🟢: chuẩn bị expected + manifest + preflight; OPERATIONS §1, CONTRACTS §1.
- [ ] D4-02 🟠: happy path vệ sinh và đèn; SPEC-P01 §1 (H01/H02).
- [ ] D4-03 🟠: thiếu thông tin và asset; SPEC-P01 §2 (I01/A01).
- [ ] D4-04 🟠: vật tư và trùng cơ bản; SPEC-P01 §3 (M01/U01).
- [ ] D4-05 🟠: năm nhánh safety; SPEC-P01 §4 (S01–S05).
- [ ] D4-06 🟠: guard + wording theo vai; SPEC-P01 §5 (G01–G03).
- [ ] D4-07 🟠: đối chiếu persistence sau restart cùng Châm Anh; OPERATIONS §3 (R01).
- [ ] D4-08 🟢: báo cáo, giới hạn mô phỏng, đối chiếu trước 21:00; TESTING §3.
- [ ] 🔴 nếu phát sinh: quyết định đổi scope/contract hoặc nhận rủi ro — chuyển leader/người dùng duyệt, không tự quyết.

## Router SPEC

- [Kiến trúc và phạm vi](specs/00-ARCHITECTURE.md).
- [Contract kết quả và evidence](specs/01-CONTRACTS.md).
- [Task và ca kiểm tra](specs/SPEC-P01-DAY04.md).
- [Thứ tự chạy, phối hợp và phục hồi](specs/OPERATIONS.md).
- [Cổng nghiệm thu](specs/TESTING-ACCEPTANCE.md).

## Exit checklist

- [ ] Người dùng duyệt kế hoạch.
- [ ] Manifest xác nhận localhost/build/store và phạm vi thao tác local.
- [ ] 14 ca nghiệp vụ có kết quả thật; R01 theo store thực tế; evidence theo TESTING §2.
- [ ] Báo cáo công việc cá nhân đầy đủ; không đồng nghĩa MVP đạt.
- [ ] Local gate theo TESTING §2; online product gate vẫn BLOCKED_NO_DEPLOYMENT.
- [ ] Nhóm sign-off lúc nghiệm thu; ghi tên người duyệt + thời điểm thật.

Không phát hành, tăng version ứng dụng hoặc đánh dấu hoàn thành MVP trong giai đoạn lập kế hoạch. Chưa phóng worker; nếu phóng sau duyệt phải tạo handoff/report theo giao thức repo.
