# Backlog Day05 — hướng xử lý đã chốt để bàn giao

Trường đã xác nhận hướng xử lý đủ 15/15 mục qua các nhóm quyết định. Chốt hướng xử lý không đồng nghĩa 15 việc đã hoàn thành. Trường xác nhận Như Ý và Châm Anh đã đồng ý nhận và duyệt phần việc. Chưa có kết quả review/kiểm thử; không suy Trí hoặc leader đã nhận việc. Day05 đang chờ review nhãn/baseline và nghiệm thu cuối.

## Ưu tiên trước

- D5-B-011: Như Ý sửa safety; Trường chuẩn bị câu; Châm Anh kiểm tra API. D4-11 vẫn OPEN/CRITICAL/P0; retest S1/S2 và S5 theo policy ngoài phạm vi đã duyệt.
- D5-B-015: 15 câu Trường soạn; Như Ý review safety, Châm Anh review classification. Phiếu riêng ở review-human15/. Chưa có review hoàn tất; không tự ACCEPTED.
- D5-B-006: Châm Anh dẫn retest tạo ticket mới, Như Ý hỗ trợ engine. Giữ FIXED_PENDING_RETEST cho đến khi API201 và dữ liệu lưu đúng trên cùng build.

## Bổ sung kiểm chứng và bằng chứng

- D5-B-002/004: Châm Anh kiểm tra resume không giao/thông báo trùng và 403 không đổi state nghiệp vụ, audit có denial. Theo api-retest-checklist.md; QA cô lập.
- D5-B-003/005: Trường thu ảnh đúng cùng ticket cho bước BQL đóng và xác nhận hiện trường; Trí hỗ trợ khi cần UI. Theo demo-evidence-checklist.md.
- D5-B-007: Trường ghi SHA, dirty source hashes và UTC đúng lúc chạy; không hồi cứu giả thông tin demo cũ.
- D5-B-009: Châm Anh đối chiếu thông báo ngoài giờ với thực tế; Trường xác nhận giờ phục vụ theo cấu hình. Khẩn cấp vẫn ưu tiên luồng safety, không bị giữ vì ngoài giờ. Chưa ấn định giờ mới hoặc SLA mới.
- D5-B-010: Trường duyệt wording, Trí rà hiển thị, Như Ý phối hợp dữ liệu engine. Hạn xử lý thống nhất, form cư dân dùng ngôn ngữ dễ hiểu. Rà đúng màn cư dân hiện tại trước khi kết luận cần sửa.

## Giới hạn và phần để kế hoạch riêng

- D5-B-001 NO_ACTION: không sửa memory để lưu bền; dùng bằng chứng Postgres/Supabase, ghi giới hạn memory.
- D5-B-008 DEFER: public deployment/online sign-off riêng; localhost đủ cho đánh giá sơ bộ Day05.
- D5-B-012 DEFER: AI vision ngoài Day05; upload/lưu ảnh không đồng nghĩa phân tích ảnh.
- D5-B-013/014 DEFER: nghiệm thu LangGraph/blocker/resume và P1 ở kế hoạch tích hợp riêng. Code đã có module LangGraph và cấu hình P0/P1; không dùng backlog cũ để kết luận tính năng chưa tồn tại hoặc yêu cầu làm lại.

## Theo dõi và nghiệm thu

backlog.json giữ trạng thái thực tế; backlog-scope-decisions.json chứa 13 scope decisions, 2 mục 011/015 có xác nhận riêng trong assignment/scope và plan. Owner acceptance khác scope approval. Xem owner-acknowledgement.json cho xác nhận mới nhất do Trường báo. Không đóng lỗi khi chưa retest hoặc giả nhận việc thay thành viên. Không tự gửi tin, push, deploy, ghi DB chung theo quyết định backlog này.

Đóng Day05 sơ bộ sau khi nhận review thật, giải quyết tranh chấp, kiểm family/corpus, khóa dữ liệu, baseline và report có hash/bằng chứng; backlog sản phẩm còn mở được bàn giao rõ, không nhận là sản phẩm đã nghiệm thu.
