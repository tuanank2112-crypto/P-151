# Day04 — hồ sơ demo cá nhân của Trường

## Phạm vi đã chốt

Theo yêu cầu trực tiếp ngày07/10, phạm vi còn9 ca: H01,H02,I01,A01,M01,U01,S04,G03,R01. Sáu ca trước đây để NOT_RUN đã được loại khỏi scope, không thuộc việc còn nợ và không nằm trong mẫu số. Quyết định được ghi trong plan/manifest; không thay luật runtime hoặc nghiệm thu toàn sản phẩm.

Hồ sơ chuẩn schema **day04-3**: [manifest.json](manifest.json), [results.json](results.json), [issues.json](issues.json). Mỗi lượt có cấu hình/build/nguồn bằng chứng riêng. Timestamp hoặc source fingerprint chưa có ghi null/status hạn chế, không bịa dữ kiện.

## Lượt UI/Swagger 04–05/10

Localhost8000, mock/memory; build3efb660 là thông tin báo cáo lịch sử, chưa có fingerprint chính xác. Báo cáo nguồn: [evaluation.md](../../../evaluation.md); ảnh [evidence/ui/](../evidence/ui/).

Theo báo cáo lịch sử: **8 PASS, 0 FAIL, 1 BLOCKED** trong scope9 ca. H01/H02/I01/A01/M01/U01/S04/G03 được báo PASS; R01 BLOCKED_MEMORY_STORE. Các PASS mang evidence_basis=HISTORICAL_REPORT, không phải đo lại trên build hiện tại. Hạn chế ảnh/thao tác của A01/M01/S04/G03 có issues riêng, không tuyên bố mọi phép kiểm bổ sung đều đạt. Lượt cũ chưa có timestamp chính xác từng ca hoặc metadata Storage.

## Lượt bổ sung Supabase/Luna 07/10

Localhost8001 nối DB/Storage chung, GPT-6 Luna thật; ticket SIM-TKT-0042, hai ảnh mô phỏng. Bằng chứng: [báo cáo lượt mới](shared-supabase-demo-20261007.md), [output máy](../evidence/supabase-demo-20261007/result.json).

Lượt này có2 ca được ghi nhận, **1 PASS, 1 FAIL, 0 BLOCKED**:

- H01: FAIL hành trình tạo→đóng không lỗi, vì POST create trả422 sau ingest RECEIVED. Sửa model merged_children và recovery trên cùng ticket đã giúp luồng tiếp tục ROUTED → IN_PROGRESS → READY_FOR_REVIEW → CLOSED. Guard thiếu ảnh đúng. Đây là kết quả phục hồi thành công, chưa thay thế retest create201; D4-06 FIXED_PENDING_RETEST.
- R01: PASS lưu bền; CLOSED và hai ảnh khớp bytes/hash sau restart, audit24/notification7, 53 ticket cũ và tồn kho không đổi. Thiếu mốc từng bước stop/start và source fingerprint lúc chạy đã ghi hạn chế, không sửa giờ máy.

Luna SUCCESS, proposer rules+llm:gpt-6-luna, khoảng2 giây. Bảy ca khác trong scope9 chưa đo lại trong lượt Supabase; ghi coverage riêng, không biến thành kết quả lượt này. **Không cộng kết quả hai build để tuyên bố9/9 PASS.**

## Issues và phần còn cần xử lý

[issues.json](issues.json) ghi owner/expected/actual/evidence/next step cho: memory không lưu bền; M01 thiếu resume lặp; ảnh S04/A01 lệch ticket; G03 thiếu GET sau guard; create422 đã sửa chưa retest201; build/time metadata thiếu; public deployment/sign-off chưa có; ngoài giờ và wording lịch sử cần owner xác nhận. Các vấn đề lịch sử chưa tự coi đã được sửa trên build mới.

Chuẩn hóa hồ sơ không đồng nghĩa mọi ca đạt. Không tạo thêm ticket, nhập kho, reset, chạy jobs, restart hoặc gửi tin cho nhóm trong lượt này. Khi làm retest, dùng QA cô lập/scope ghi đã được cho phép và giữ kết quả mỗi build riêng.

## Giới hạn mô phỏng

Chỉ localhost; Supabase chung không phải URL triển khai public. Ticket/vị trí/checklist/vật tư/ảnh đều mô phỏng, không xử lý bảo trì hiện trường, không feedback/rating người thật. Luna chỉ phân loại văn bản, chưa đọc ảnh; demo không đo chất lượng classification/vision. Jobs/seed/reset tắt trên tiến trình demo; AI Logs trong bộ nhớ, SUCCESS đã lưu ra file. LangGraph runtime, D-01/P1, user test và sign-off nhóm ngoài lượt demo này.

## Kết luận bàn giao

Đã thực hiện demo và chuẩn hóa báo cáo theo scope9 ca, bỏ sáu ca không cần thiết. Có đầy đủ3 file hồ sơ và issue/owner/giới hạn theo bằng chứng hiện có. Chưa có kết luận9/9 cùng build, online hoặc leader nghiệm thu. Bộ kiểm hồ sơ: [validation.txt](../evidence/normalization-20261007/validation.txt); validator không thay runtime retest.

## Lỗi safety mới từ ảnh người dùng — 2026-10-07T04:38:20.572561+00:00

D4-11 **CRITICAL / OPEN**, owner chính **Như Ý**; Châm Anh phối hợp tích hợp/retest API. Câu "có trẻ con bị kẹt ở sảnh chung cư tòa S5" tái hiện local thành NONE/OUT_OF_SCOPE/BPTN. Đổi S1 vẫn lỗi, thêm "mắc" thì đúng EMERGENCY_PENDING_BQL. Không phải bằng chứng mọi tuyến safety đã đạt; issue này chặn đề xuất nghiệm thu sản phẩm tới khi xử lý/đo lại. Bằng chứng riêng [safety-child-trapped.json](../evidence/normalization-20261007/safety-child-trapped.json); không sửa kết quả các lượt cũ hay tái đưa sáu ca đã bỏ vào scope. Chưa đọc/sửa ticket live TK-0046, chưa sửa engine/lexicon trong lượt chẩn đoán.
