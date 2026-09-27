# Problem Card — ResidentGPT: Trợ lý AI hai vai trò cho Cư dân và BQL

> **Document status:** FROZEN FOR MVP v0.3 — Dual-role & Confidence Escalation Alignment
> **Freeze date:** 21/09/2026
> **MVP deadline:** 27/10/2026
> **Alignment log:** `docs/MVP_CONSISTENCY_ALIGNMENT_v0.3.md`

> **Scope contract:** `knowledge_coverage_scope = VINHOMES_OCEAN_PARK`;
> `pilot_operator_scope = Cư dân Tòa S1.12, Cụm Sapphire 1 & Văn phòng BQL Tòa nhà (Tầng 1 S1.03) tại Vinhomes Ocean Park 1`.
> Knowledge coverage rộng hơn pilot operator scope không đồng nghĩa hỗ trợ multi-site.

## Problem

Cư dân thường ngại gọi hotline hoặc chờ phản hồi trên Zalo cho các câu hỏi hành chính nhỏ về nội quy, thẻ, phương tiện, tiện ích và chuyển đồ/thi công. Đồng thời, BQL/CSKH bị quá tải bởi câu hỏi lặp lại và chưa có một kênh tập trung để tiếp nhận, theo dõi và phản hồi các ca khó mà AI không đủ căn cứ hoặc không đủ độ tin cậy để xử lý.

## Actors

- **Primary user 1 — Cư dân:** đăng nhập để tự tra cứu nội quy và tiện ích tức thì qua hội thoại.
- **Primary user 2 — BQL/CSKH:** đăng nhập để tiếp nhận và xử lý các ca do AI chuyển lên trong **Escalation Inbox**.

## Context

MVP phục vụ thí điểm tại Tòa S1.12 Cụm Sapphire 1, Vinhomes Ocean Park 1 (Văn phòng BQL trực tại Tầng 1 Tòa S1.03, Hotline 1900 232 389 Nhánh 4) và dùng Knowledge Pack revision `1.18`, gồm đúng 21 tài liệu canonical. Câu trả lời phải khớp phạm vi tài liệu; khi thiếu trường bắt buộc, hệ thống phải hỏi lại theo Required Context Contract. Hotline và Văn phòng BQL là kênh hỗ trợ/handoff, không phải nguồn thay thế cho căn cứ RAG.

## Current Workflow

Cư dân tự tìm thông tin hoặc gửi câu hỏi qua hotline/Zalo → chờ nhân viên xác định nhu cầu và tra tài liệu → BQL trả lời thủ công hoặc chuyển bộ phận liên quan. Các ca khó nằm rải rác theo kênh, khó theo dõi trạng thái và lý do chuyển tuyến.

## Bottlenecks

- Cư dân không có kênh tự phục vụ 24/7 cho các câu hỏi lặp lại.
- BQL tốn thời gian tra cứu và lặp lại cùng một hướng dẫn.
- Câu hỏi phụ thuộc ngữ cảnh dễ bị hiểu sai nếu không lưu lịch sử hội thoại.
- Không có Confidence Gate thống nhất để chặn suy đoán khi evidence yếu hoặc rủi ro cao.
- Không có Escalation Inbox tập trung cho BQL.

## AI Hypothesis

Một trợ lý AI tự phục vụ đa lượt có Chat Memory và Query Rewriter có thể trả lời chính xác các câu hỏi nội quy/tiện ích dựa trên 21 tài liệu canonical, kèm `document_id` và `section_id`. Khi thiếu required context, hệ thống hỏi lại nhẹ nhàng; khi similarity dưới ngưỡng, Grader Node đánh giá không đủ tin cậy, hoặc câu hỏi thuộc nhóm rủi ro cao, hệ thống không suy đoán mà hiển thị thẻ liên hệ cho Cư dân và tạo ticket trong Escalation Inbox để BQL xử lý.

## Risk / Failure Impact

Thông tin sai hoặc lỗi thời có thể làm cư dân hành động sai, phát sinh khiếu nại và mất niềm tin. Các nhóm phải chuyển tuyến gồm:

1. Pháp lý, tranh chấp, bồi thường, xác định trách nhiệm hoặc chế tài.
2. Tài chính cá nhân/account-specific: công nợ, hóa đơn, hoàn tiền hoặc nghĩa vụ của một căn/cá nhân cụ thể.
3. PII, quyền truy cập, credential hoặc thông tin cần xác minh danh tính.
4. An ninh, khẩn cấp hoặc an toàn tính mạng.
5. Không có nguồn đủ điều kiện, nguồn mâu thuẫn, nguồn hết hiệu lực/không rõ hiệu lực, lỗi hệ thống hoặc Confidence thấp.

Trong mọi trường hợp trên, ResidentGPT không được bịa đặt. Hệ thống phải trả safe fallback/Thẻ Escalation, ghi đúng canonical reason code và đưa case vào Escalation Inbox.

## MVP Scope

MVP bao gồm đủ năm trụ cột nghiệm thu của BTC:

1. Web cloud-ready và phải có Live URL công khai trong bằng chứng nghiệm thu.
2. Đăng nhập và phân quyền hai vai trò: Cư dân và BQL/CSKH.
3. RAG trên 21 tài liệu canonical, mọi câu trả lời thành công có `document_id` và `section_id`.
4. Chat Memory đa lượt và Query Rewriter để viết lại câu hỏi phụ thuộc thành truy vấn độc lập trước retrieval.
5. Confidence Measurement bằng Similarity Score kết hợp Grader Node; Low Confidence hoặc High Risk phải chuyển tuyến an toàn.

Booking/đặt lịch, thanh toán tự động, upsell, tổng đài thoại và tự động giải quyết tranh chấp pháp lý không thuộc MVP.

## Provisional MVP Intents — Frozen

1. `I-01` — Thẻ cư dân/ra vào.
2. `I-02` — Phương tiện/thẻ xe.
3. `I-03` — Tiện ích chung.
4. `I-04` — Chuyển đồ/thi công.
5. `I-05` — Nội quy sinh hoạt.

## Success Definition

- Cư dân có thể đăng nhập, hỏi nối tiếp và nhận câu trả lời grounded có citations khi Confidence cao.
- Thiếu required context luôn dẫn đến `clarification_required`, không tự đoán.
- Low Confidence/High Risk luôn kết thúc bằng `escalated`, có Thẻ Escalation và ticket cho BQL.
- BQL có thể đăng nhập, xem danh sách, lý do chuyển tuyến, chi tiết hội thoại và phản hồi case.
- Lỗi model, retrieval hoặc UI luôn có fallback; không bao giờ trả màn hình trắng.
- Golden Dataset revision `0.3` giữ 50 FAQ cases và 30 E2E cases, với 20 `answered` và 10 `escalated`.

## Core Invariants

- Giữ nguyên Knowledge Pack `1.18`: 21 file `knowledge/canonical/*.md`, `knowledge/manifest.yaml` và `knowledge/intent_source_map.yaml`.
- Giữ nguyên 5 Provisional MVP Intents.
- Giữ nguyên 10 canonical reason codes.
- Giữ nguyên Required Context Contract tại PRD §5.1.

## Assumptions / Open Evidence

- Live URL phải được ghi vào release/evaluation artifact trước nghiệm thu; tài liệu này không tự khẳng định deployment đã diễn ra.
- Ngưỡng similarity và tiêu chí Grader Node cần được hiệu chỉnh trên Golden Dataset trước khi chốt production threshold.
- Chính sách PII retention/redaction/access và tuyến nội bộ sau khi BQL nhận case phải được chốt trước pilot có dữ liệu thật.
