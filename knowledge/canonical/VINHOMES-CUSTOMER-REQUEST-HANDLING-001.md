---
document_id: VINHOMES-CUSTOMER-REQUEST-HANDLING-001
title: Quy định xử lý khiếu nại/yêu cầu của Khách hàng
organization_scope: VINHOMES_ALL_PROJECTS
applicable_property_ids:
  - VINHOMES_OCEAN_PARK
property_scope: Tất cả dự án và bộ phận thuộc Công ty Cổ phần Vinhomes
area_type: all_vinhomes_projects_and_departments
process_type: customer_request_and_complaint_handling
audience: customers_residents_and_internal_receiving_processing_units
category: customer_request_complaint_handling_procedure
source_owner: Công ty Cổ phần Vinhomes
source_type: Official company procedure transcribed by resident
source_channel: Vinhomes app official rules channel
issued_at: null
last_updated_at: 2025-05-05
source_version: Unversioned
notice_number: null
canonical_revision: "1.0"
status: Approved
effective_status: Current
effective_from: null
effective_to: null
latest_confirmed: true
superseded_by: null
contact_current_confirmed: true
approved_for_mvp: true
allowed_for_rag: true
source_capture_completeness: Complete
contains_resident_pii: false
contains_personal_data_requirements: false
contains_health_safety_rules: true
contains_legal_process: true
contains_public_business_contact: true
raw_source: ../raw/VINHOMES-CUSTOMER-REQUEST-HANDLING-001.txt
normalized_at: 2026-09-19
review_log: ../review/review_log.md
---

# Quy định xử lý khiếu nại/yêu cầu của Khách hàng

> **Giới hạn phạm vi:** Đây là quy trình dùng chung cho tất cả dự án và bộ
> phận thuộc Công ty Cổ phần Vinhomes, bao gồm Vinhomes Ocean Park. Tài liệu
> cho phép ResidentGPT giải thích kênh tiếp nhận, trình tự và thời gian xử lý
> chung; không cho phép AI giải quyết nội dung khiếu nại, xác định lỗi, trách
> nhiệm, kết quả tranh chấp hoặc bồi thường của một vụ việc cụ thể.

Nguồn ghi **cập nhật gần nhất ngày 05/05/2025**, nhưng không cung cấp ngày
phát hành ban đầu. Người cung cấp xác nhận nguồn được lấy từ kênh nội quy
chính thức trên ứng dụng Vinhomes, là phiên bản mới nhất, đang có hiệu lực
và được phép sử dụng cho MVP.

## 1. Giải thích từ ngữ

### CASE-GLOSSARY-01 — Các từ viết tắt được định nghĩa trong nguồn

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: source_glossary_only; scope: all_vinhomes_customer_requests -->

- **BPTN:** Bộ phận tiếp nhận, đầu mối tiếp nhận thông tin sự vụ qua các
  kênh như Ban Quản lý, Phòng Thủ tục hoặc Tổng đài.
- **BPXL:** Bộ phận xử lý, có trách nhiệm trực tiếp xử lý khiếu nại; tùy sự
  vụ có thể gồm nhiều bộ phận.
- **CBLĐ:** Cán bộ lãnh đạo.
- **CNPQ:** Cẩm nang phân quyền.
- **KH:** Khách hàng/Cư dân.

Nguồn còn sử dụng từ viết tắt **NTD** nhưng không giải thích. ResidentGPT
không tự mở rộng hoặc suy đoán nghĩa của từ này.

## 2. Tiếp nhận sự vụ

### CASE-CHANNEL-01 — Tiếp nhận qua điện thoại

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: verified_escalation_contact; scope: all_vinhomes_customer_requests -->

Khách hàng/Cư dân có thể liên hệ Tổng đài **1900 232 389, nhánh số 4**.
Chuỗi số trong nguồn là `1900232389`; khoảng trắng được chuẩn hóa để dễ đọc.

### CASE-CHANNEL-02 — Tiếp nhận qua email

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: verified_escalation_contact; scope: all_vinhomes_customer_requests -->

Địa chỉ email tiếp nhận: **info@vinhomes.vn**.

### CASE-CHANNEL-03 — Gửi bản cứng

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_channel_then_clarify_missing_address; scope: all_vinhomes_customer_requests -->

Nguồn cho phép gửi bản cứng đến địa chỉ Công ty nhưng không nêu địa chỉ cụ
thể. ResidentGPT không tự bổ sung địa chỉ và phải hướng dẫn người dùng xác
nhận địa điểm nhận hồ sơ với BQL hoặc Tổng đài.

### CASE-CHANNEL-04 — Phản ánh trực tiếp

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: general_intake_channel; scope: all_vinhomes_customer_requests -->

Khách hàng/Cư dân có thể phản ánh trực tiếp với:

- Cán bộ nhân viên phụ trách hồ sơ;
- Cán bộ phụ trách phân khu hoặc Tòa nhà đang sinh sống; hoặc
- Văn phòng Ban Quản lý.

### CASE-INTAKE-01 — Các đầu mối tiếp nhận

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: general_intake_routing; scope: all_vinhomes_customer_requests -->

Đầu mối tiếp nhận có thể là Trung tâm Tổng đài, Ban Quản lý, Kinh doanh,
Thủ tục hoặc bộ phận khác khi phát sinh.

ResidentGPT không tự chọn BPXL cho một sự vụ nội bộ; BPTN có trách nhiệm
chuyển thông tin đến bộ phận chuyên trách.

## 3. Quy trình theo kênh điện thoại

### CASE-PHONE-01 — Chuyển thông tin đến bộ phận chuyên trách

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_service_standard_no_case_promise; scope: phone_intake -->

Trong vòng **04 giờ làm việc** kể từ khi nhận thông tin từ KH, CSKH Tổng đài
cần chuyển thông tin đến đúng bộ phận chuyên trách.

Đây là tiêu chuẩn quy trình chung, không phải cam kết kết quả hoặc thời hạn
giải quyết cho một case cụ thể.

### CASE-PHONE-02 — Theo dõi bộ phận chuyên trách

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: general_internal_follow_up_standard; scope: phone_intake -->

CSKH Tổng đài theo dõi phản hồi và yêu cầu bộ phận chuyên trách xử lý với
tần suất tối thiểu **05 ngày/lần**.

### CASE-PHONE-03 — Xác nhận sau hỗ trợ và điều kiện đóng đầu việc

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_service_standard_no_case_status_decision; scope: phone_intake -->

Trong vòng **01 ngày làm việc** kể từ khi nhận kết quả hỗ trợ từ bộ phận
liên quan, CSKH cần xác nhận lại với KH; với yêu cầu kỹ thuật, thực hiện khảo
sát ghi nhận ý kiến sau hỗ trợ.

Nếu KH không bắt máy, cần gọi tối thiểu **03 lần trong 02 ngày** trước khi
đóng đầu việc. ResidentGPT không được tự xác định một đầu việc đã đủ điều
kiện đóng.

## 4. Quy trình theo kênh email

### CASE-EMAIL-01 — Phân loại email

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: general_email_classification; scope: email_intake -->

- **Email xử lý:** Email của khách hàng Vinhomes.
- **Email không xử lý:** Email rác, email trả lời tự động của nhà cung cấp
  dịch vụ khác và email quảng cáo sản phẩm/dịch vụ.

### CASE-EMAIL-02 — Xác nhận đã nhận email

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_service_standard_no_case_promise; scope: email_intake -->

BPTN phản hồi KH về việc đã nhận thông tin trong vòng **08 giờ làm việc**.

### CASE-EMAIL-03 — Giải quyết hoặc chuyển tiếp email

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_service_standard_no_case_promise; scope: email_intake -->

Email xử lý cần được giải quyết hoặc chuyển tiếp trong vòng **24 giờ**, trừ
Lễ/Tết. Email phát sinh ngoài giờ làm việc cần được xử lý trong ngày làm
việc tiếp theo.

### CASE-EMAIL-04 — Theo dõi email đã chuyển

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: low; answer_policy: general_internal_follow_up_standard; scope: email_intake -->

BPTN theo dõi phản hồi và thúc giục bộ phận chuyên trách xử lý tối thiểu
**05 ngày/lần**.

### CASE-EMAIL-05 — Phúc đáp sau khi có kết quả

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_service_standard_no_case_promise; scope: email_intake -->

Trong vòng **08 giờ làm việc** kể từ khi nhận kết quả từ BPXL, CSKH Tổng
đài cần gửi thư phúc đáp tới KH.

## 5. Quy trình đối với bản cứng

### CASE-HARDCOPY-01 — Xác nhận và phân loại bản cứng

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_service_standard_no_case_promise; scope: hardcopy_intake -->

- Phản hồi KH về việc đã nhận thông tin trong vòng **08 giờ làm việc**.
- BPTN phân loại và chuyển đến đúng bộ phận chuyên trách trong vòng
  **24 giờ**.

### CASE-HARDCOPY-02 — Theo dõi và phúc đáp

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_service_standard_no_case_promise; scope: hardcopy_intake -->

- Theo dõi phản hồi và yêu cầu bộ phận chuyên trách xử lý tối thiểu
  **05 ngày/lần**.
- Trong vòng **08 giờ làm việc** kể từ khi nhận kết quả từ BPXL, CSKH Tổng
  đài gửi thư phúc đáp tới KH.

## 6. Phản ánh trực tiếp và khảo sát

### CASE-DIRECT-01 — Trách nhiệm xử lý khi phản ánh trực tiếp

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_process_no_internal_assignment_decision; scope: direct_intake -->

Bộ phận CSKH/Lễ tân sảnh quầy chịu trách nhiệm cuối trong việc xử lý, phản
hồi yêu cầu của KH theo bước xử lý sự vụ trong quy trình này.

Ban Quản lý là đầu mối triển khai, lưu trữ và phân tích kết quả khảo sát độ
hài lòng của KH định kỳ hằng năm hoặc đột xuất.

## 7. Xử lý sự vụ nội bộ

### CASE-INTERNAL-01 — Phê duyệt phương án xử lý

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: high; answer_policy: describe_internal_process_no_case_outcome; scope: internal_case_handling -->

BPTN/BPXL báo cáo CBLĐ theo CNPQ để xin phê duyệt phương án, sau đó xử lý
sự vụ theo phê duyệt hoặc chỉ đạo. Việc họp hoặc trả lời bằng văn bản cho
KH thực hiện theo phương án đã được phê duyệt.

Nguồn không cung cấp nội dung CNPQ. ResidentGPT không được suy đoán thẩm
quyền, tự phê duyệt hoặc dự báo phương án giải quyết.

### CASE-INTERNAL-02 — Khi KH không đồng ý với phương án

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: high; answer_policy: general_process_then_escalate_to_bql; scope: internal_case_handling -->

Khi KH không đồng ý, bộ phận phụ trách có thể phân loại lại mức độ sự việc
nếu cần, trình phương án tiếp theo và thực hiện sau khi được phê duyệt.

ResidentGPT không thương lượng, phân xử tranh chấp hoặc đề xuất kết quả
thay BQL.

### CASE-LEGAL-01 — Sự vụ đã khởi kiện

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: critical; answer_policy: do_not_answer_escalate_to_bql_and_legal; scope: litigation_case -->

Sự vụ đã khởi kiện được BPTN/BPXL chuyển cho Pháp chế Vinhomes xử lý và
phối hợp theo chỉ đạo của CBLĐ có thẩm quyền.

ResidentGPT không trả lời nội dung pháp lý của vụ việc; phải chuyển
BQL/Pháp chế và log `legal_or_compensation_escalation`.

## 8. Thời gian xử lý yêu cầu

### CASE-SLA-01 — Yêu cầu đơn giản

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_sla_no_case_classification_or_guarantee; scope: request_handling_time -->

Nguồn quy định yêu cầu đơn giản được xử lý trong vòng **04 ngày làm việc**.

Nguồn không nêu tiêu chí xác định “đơn giản”. ResidentGPT không tự phân
loại case hoặc cam kết case cụ thể sẽ hoàn tất trong mốc này.

### CASE-SLA-02 — Yêu cầu phức tạp trở lên

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_sla_no_case_classification_or_guarantee; scope: request_handling_time -->

Yêu cầu phức tạp trở lên, cần phối hợp nhiều đơn vị tại BQL/Khối Hỗ trợ,
được hẹn phản hồi chính thức trong vòng **06 ngày làm việc**.

Nguồn không nêu tiêu chí xác định “phức tạp”. ResidentGPT không tự phân
loại hoặc bảo đảm kết quả trong mốc này.

### CASE-SLA-03 — Yêu cầu khẩn/gấp liên quan an toàn tính mạng

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: critical; answer_policy: immediate_emergency_escalation; scope: life_safety_request -->

Yêu cầu khẩn/gấp liên quan đến an toàn tính mạng của KH phải được phối hợp
xử lý **ngay khi tiếp nhận**.

ResidentGPT không đưa tình huống nguy hiểm vào hàng đợi FAQ thông thường;
phải hướng dẫn liên hệ ngay nhân viên tại chỗ/BQL, lực lượng cứu hộ, an
ninh hoặc dịch vụ khẩn cấp phù hợp với tình huống.

### CASE-SLA-04 — Gia hạn phản hồi

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: medium; answer_policy: general_extension_process_no_case_status_decision; scope: request_handling_time -->

Nếu đến hạn chưa có phương án được duyệt, đơn vị xử lý thực hiện gia hạn
phản hồi qua ứng dụng, email hoặc điện thoại tùy kênh tiếp nhận yêu cầu.

ResidentGPT không tự gia hạn, xác nhận trạng thái hoặc đưa ra mốc mới cho
một case cụ thể.

## 9. Tổng kết và rút kinh nghiệm

### CASE-REVIEW-01 — Điều tra lỗi và báo cáo

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: high; answer_policy: describe_internal_process_no_fault_or_penalty_decision; scope: internal_case_review -->

Bộ phận Thanh tra điều tra lỗi liên quan nếu có, trình xử lý vi phạm theo
CNPQ, tổng hợp thông tin xử lý vụ việc và báo cáo CBLĐ theo quy định.

ResidentGPT không xác định lỗi, vi phạm, hình thức xử lý hoặc trách nhiệm
của cá nhân/bộ phận.

## 10. Khách hàng dễ bị tổn thương

### CASE-VULN-01 — Các nhóm được nêu trong nguồn

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: high; answer_policy: general_categories_no_legal_health_or_status_determination; scope: vulnerable_customers -->

Nguồn liệt kê các nhóm sau:

- Người cao tuổi theo quy định pháp luật;
- Người khuyết tật theo quy định pháp luật;
- Trẻ em theo quy định pháp luật;
- Người dân tộc thiểu số; người sinh sống tại vùng đồng bào dân tộc thiểu
  số và miền núi, hải đảo, vùng có điều kiện kinh tế - xã hội khó khăn hoặc
  đặc biệt khó khăn theo quy định pháp luật;
- Phụ nữ đang mang thai hoặc nuôi con dưới 36 tháng tuổi;
- Người bị bệnh hiểm nghèo theo quy định pháp luật; và
- Thành viên hộ nghèo theo quy định pháp luật.

ResidentGPT có thể trình bày danh sách chung nhưng không yêu cầu bằng chứng
sức khỏe/hoàn cảnh, không thu thập hồ sơ nhạy cảm và không tự xác định một
người có thuộc nhóm pháp lý này hay không.

### CASE-VULN-02 — Ưu tiên tiếp nhận và hỗ trợ

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: high; answer_policy: general_priority_rule_then_human_handling; scope: vulnerable_customers -->

Quy trình chung vẫn được áp dụng, nhưng Công ty phải ưu tiên tiếp nhận và
hỗ trợ xử lý các phản ánh/yêu cầu hợp pháp, hợp lý từ KH dễ bị tổn thương.

Việc đánh giá tính hợp pháp, hợp lý và mức ưu tiên của case cụ thể do đơn
vị có thẩm quyền thực hiện, không phải ResidentGPT.

### CASE-VULN-03 — Từ chối giải quyết yêu cầu

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: critical; answer_policy: general_rule_then_escalate_no_legal_conclusion; scope: vulnerable_customers -->

Nếu từ chối giải quyết yêu cầu của KH dễ bị tổn thương, Công ty trả lời
bằng văn bản và bảo đảm đúng quy định pháp luật.

ResidentGPT không quyết định từ chối hoặc đánh giá tính hợp pháp của văn
bản; phải chuyển BQL/bộ phận có thẩm quyền.

### CASE-VULN-04 — Nội dung liên quan bồi thường

<!-- intent_ids: [I-01, I-02, I-03, I-04, I-05]; risk_level: critical; answer_policy: do_not_answer_escalate_to_bql_and_legal; scope: vulnerable_customers -->

Nguồn nêu trường hợp Công ty chậm, từ chối ưu tiên hoặc từ chối tiếp nhận,
xử lý mà gây thiệt hại cho KH dễ bị tổn thương thì việc bồi thường được xem
xét theo pháp luật dân sự.

ResidentGPT không xác định có thiệt hại, quan hệ nhân quả, trách nhiệm hay
mức bồi thường; phải chuyển BQL/Pháp chế và log
`legal_or_compensation_escalation`.

## Khoảng trống và giới hạn sử dụng

Nguồn chưa cung cấp:

- Ngày phát hành ban đầu; chỉ có ngày cập nhật gần nhất 05/05/2025.
- Ý nghĩa của từ viết tắt `NTD`.
- Địa chỉ Công ty để nhận bản cứng.
- Tiêu chí phân loại yêu cầu đơn giản, phức tạp hoặc mức độ sự việc.
- Nội dung CNPQ và ma trận thẩm quyền của từng bộ phận.
- Quy tắc tính mốc giờ/ngày làm việc khi rơi vào cuối tuần hoặc ngày nghỉ,
  ngoài ngoại lệ Lễ/Tết đã nêu cho email.
- Cơ chế tra cứu mã case, trạng thái case hoặc gửi hồ sơ kèm theo.

Trong MVP, ResidentGPT không thu thập nội dung hồ sơ khiếu nại, dữ liệu
định danh, hồ sơ sức khỏe, chứng cứ pháp lý hoặc tài liệu tranh chấp. Khi
người dùng cần xử lý một case thật, hệ thống chỉ cung cấp kênh chính thức
và đề xuất chuyển BQL/đơn vị có thẩm quyền.
