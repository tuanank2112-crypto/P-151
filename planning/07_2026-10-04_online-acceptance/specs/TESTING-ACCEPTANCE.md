# Kiểm thử và nghiệm thu ngày 04

## 1. Manifest và ma trận chính xác

15 ca bắt buộc: H01,H02,I01,A01,M01,U01,S01,S02,S03,S04,S05,G01,G02,G03,R01. 14 ca H/I/A/M/U/S/G thuộc bản local QA; R01 theo store được xác nhận. Giữ đủ15 record: memory ⇒ R01 BLOCKED_MEMORY_STORE, không làm giả PASS persistence. Mỗi ca theo contract trong SPEC-P01; schema CONTRACTS §2. Kiểm wording được gắn vào ca liên quan, không cộng thêm record làm đổi mẫu số.

BẮT BUỘC kết quả và evidence cùng build; khi build đổi giữ lịch sử và đo lại ca ảnh hưởng, smoke H01/S04/G02 trên bản chốt. CẤM bỏ ca, sửa gold hoặc gộp PASS local vào online. Bốn nhãn lệch engine đã biết và lỗi "bóng đèn bị cháy" ghi backlog/giới hạn nếu chưa sửa; không tuyên bố classification ≥90% từ demo này.

## 2. Gates theo môi trường

- ⬜ chuẩn bị: kế hoạch duyệt, 15 expected và role, manifest xác nhận, scope QA.
- ⬜ local nghiệp vụ: 14/14 H/I/A/M/U/S/G PASS, evidence đầy đủ.
- ⬜ local persistence: R01 PASS khi postgres; memory ghi BLOCKED_MEMORY_STORE, không chặn gate14 ca nghiệp vụ nhưng gate lưu bền vẫn mở.
- ⬜ online nghiệp vụ: BLOCKED_NO_DEPLOYMENT; khi có bản triển khai, chạy lại đủ15 ca trên online, không kế thừa PASS local.
- ⬜ online persistence: R01 PASS; ảnh thực sự upload/mở sau restart, không chỉ metadata.
- ⬜ bản chốt: smoke H01/S04/G02 sau thay đổi build và ca ảnh hưởng đã đo lại.
- ⬜ nhóm: leader ghi quyết định nghiệm thu + tên/thời điểm thật; không suy từ duyệt thiết kế D-08.

CRITICAL còn mở ⇒ không đề xuất nghiệm thu MVP. Nếu nhóm chọn bản bàn giao có thiếu sót, ghi quyết định/ngoại lệ rõ; gates không đạt vẫn để mở. CI/build/rollback/fallback/trace/chi phí do owner cung cấp; thiếu bằng chứng ghi trong báo cáo nhóm, không tự nhận đã đạt. Trường không phải chủ nghiệm thu kỹ thuật toàn sản phẩm.

## 3. D4-08 — contract báo cáo (30–45 phút)

`deliverables/day04-summary.md`: thời gian/build/URL/môi trường đã xác nhận; tổng15/PASS/FAIL/BLOCKED/NOT_RUN; link results/issues/evidence; 4 nhóm demo đạt/chưa đạt; lỗi chặn và owner; giới hạn SIM-/hosting sleep/LLM thực tế/P1/D-01; việc ngày05; kết luận cá nhân riêng kết luận MVP. Không tạo file kết quả trong giai đoạn lập kế hoạch.

Công việc cá nhân có thể báo "đã thực hiện và bàn giao" khi mọi ca đã thử hoặc có blocker cụ thể, issue/owner/evidence/bước tiếp đầy đủ và 0 NOT_RUN không giải thích. Không đổi FAIL/BLOCKED thành PASS; không tick online product gate. Nếu còn ca chưa thử dù đủ điều kiện, chưa hoàn thành phạm vi cá nhân.

## 4. Lỗi và caller

Sai schema/thiếu refs/count !=15: trả báo cáo để sửa, không nhận sign-off. Missing environment: BLOCKED tới owner xác nhận. Expected conflict: giữ CR đã duyệt, người quyết sửa SPEC trước tái đo. UI/API bất đồng: FAIL ca, giữ cả hai bằng chứng. Evidence máy bị sửa: đo lại, không chỉnh tay để khớp report.

## 5. Bằng chứng hiện tại

Day04: chưa chạy lại local trong hồ sơ này; online BLOCKED_NO_DEPLOYMENT, chưa có manifest/results/evidence nghiệm thu. Bước0 exit1 do hub thiếu. Hồ sơ chỉ được kiểm cấu trúc và tham chiếu khi lập xong; đây không phải test runtime. Không chạy typecheck/lint/pytest ứng dụng vì gói chỉ thêm kế hoạch Markdown, không thay code. Trước phát hành, chủ tích hợp vẫn phải cung cấp test/lint/build theo quy định repo.
