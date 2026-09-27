---
document_id: OCP1-APARTMENT-CONSTRUCTION-GUIDE-001
title: Hướng dẫn và hồ sơ đăng ký thi công Căn hộ
property_id: VINHOMES_OCEAN_PARK
property_scope: Căn hộ, Khu Đô thị Vinhomes Ocean Park
area_type: apartment
activity_type: construction_or_renovation
audience: apartment_owner_authorized_representative_and_contractor
category: apartment_construction_application_guide
source_owner: Ban Quản lý Khu Đô thị Vinhomes Ocean Park
source_type: Official guidance text transcribed by resident
source_channel: Vinhomes app official rules channel
issued_at: 2026-02-27
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
contains_personal_data_requirements: true
contains_health_safety_rules: true
contains_financial_information: true
contains_public_business_contact: true
cross_scope_references_present: true
excluded_from_rag_sections:
  - ACON-II-01X
  - ACON-NOTE-04X
raw_source: ../raw/OCP1-APARTMENT-CONSTRUCTION-GUIDE-001.txt
normalized_at: 2026-09-19
review_log: ../review/review_log.md
---

# Hướng dẫn và hồ sơ đăng ký thi công Căn hộ

> **Giới hạn phạm vi:** Tài liệu này được dùng cho hồ sơ đăng ký cải tạo,
> sửa chữa **Căn hộ** tại Khu Đô thị Vinhomes Ocean Park. Không áp dụng
> khoản tiền, hồ sơ hoặc yêu cầu kỹ thuật trong tài liệu này cho Biệt thự,
> Nhà liền kề, Shop hoặc Shophouse nếu chưa có nguồn đúng phạm vi.

Tài liệu được ban hành ngày **27/02/2026**. Người cung cấp xác nhận nguồn
được lấy từ kênh nội quy chính thức trên ứng dụng Vinhomes, là phiên bản
mới nhất, đang có hiệu lực và được phép sử dụng cho MVP.

Nguồn có một số dòng tham chiếu Shop và Shophouse dù tiêu đề là hướng dẫn
cho Căn hộ. Các dòng đó được giữ để truy vết nhưng bị loại khỏi RAG cho đến
khi BQL xác nhận phạm vi bằng một nguồn phù hợp.

## I. Tiếp nhận hồ sơ đăng ký thi công

### ACON-I-01A — Đơn đăng ký thi công

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: normal_faq; scope: apartment_construction -->

Hồ sơ cần **01 bản gốc Đơn đăng ký thi công**. Đơn phải nêu rõ:

- Hạng mục dự kiến thực hiện, ví dụ cải tạo hoặc sửa chữa.
- Biện pháp thực hiện do Chủ hộ hoặc Nhà thầu phụ trách mô tả, ví dụ đập
  bỏ, lắp vào, đục hoặc khoét.

### ACON-I-01B — Thời gian BQL xem xét hồ sơ

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: general_process_no_approval_prediction; scope: apartment_construction -->

Ban Quản lý xem xét và phê duyệt hồ sơ trong **07 ngày làm việc**, tính từ
khi Cư dân đã nộp **đầy đủ hồ sơ**.

ResidentGPT chỉ được nêu thời gian công bố chung, không được dự đoán ngày
duyệt hoặc kết quả phê duyệt của một hồ sơ cụ thể.

### ACON-I-01C — Thông báo nội dung cần làm rõ hoặc bổ sung

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: general_process_no_case_status; scope: apartment_construction -->

Nếu có nội dung cần làm rõ hoặc bổ sung, sau **03 ngày làm việc**, Ban Quản
lý sẽ liên hệ với Chủ hộ để thông báo.

Nguồn không nêu thời điểm bắt đầu tính 03 ngày. ResidentGPT không được tự
suy diễn mốc thời gian hoặc trạng thái hồ sơ cụ thể.

## Các hạng mục không được phép thi công

### ACON-PROHIBIT-01 — Hộp kỹ thuật

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_rule_with_bql_confirmation; scope: apartment_construction -->

Không được thay đổi, cải tạo hoặc tác động đến vị trí, công năng hay tường
bao quanh của hộp kỹ thuật.

### ACON-PROHIBIT-02 — Mặt ngoài Căn hộ

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_rule_with_bql_confirmation; scope: apartment_construction -->

Không được thực hiện thay đổi ảnh hưởng đến hình ảnh, mỹ quan, kiến trúc
hoặc ngôn ngữ kiến trúc mặt ngoài Căn hộ.

### ACON-PROHIBIT-03 — Kết cấu chịu lực

<!-- intent_ids: [I-04]; risk_level: critical; answer_policy: safety_rule_and_escalate_for_specific_work; scope: apartment_construction -->

Không được thực hiện thay đổi ảnh hưởng đến kết cấu chịu lực của tòa nhà.

ResidentGPT không đánh giá một phương án thi công cụ thể có ảnh hưởng kết
cấu hay không; phải chuyển BQL và đơn vị chuyên môn xem xét.

### ACON-PROHIBIT-04 — Phần sử dụng chung, PCCC và hệ thống chung

<!-- intent_ids: [I-04]; risk_level: critical; answer_policy: safety_rule_and_escalate_for_specific_work; scope: apartment_construction -->

Không được thực hiện thay đổi ảnh hưởng đến phần sử dụng chung, hệ thống
thiết bị phòng cháy chữa cháy, hệ thống hoặc trục kỹ thuật chung, hay các
đường tín hiệu chung của tòa nhà.

### ACON-PROHIBIT-05 — Tường ngăn

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_rule_with_bql_confirmation; scope: apartment_construction -->

Không được cắt tường ngăn theo phương ngang hoặc đục tường ngăn.

### ACON-PROHIBIT-06 — Thoát nước thiết bị vệ sinh

<!-- intent_ids: [I-04]; risk_level: critical; answer_policy: safety_rule_and_escalate_for_specific_work; scope: apartment_construction -->

Không được thay đổi vị trí thoát nước của thiết bị vệ sinh nếu việc thay
đổi yêu cầu khoan rút lõi sàn.

## Hồ sơ đi kèm

### ACON-I-02 — Giấy ủy quyền

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: normal_faq_without_collecting_personal_data; scope: apartment_construction -->

Nếu Chủ hộ ủy quyền cho người khác thay mặt quản lý Căn hộ trong quá trình
cải tạo, hồ sơ cần **01 bản gốc Giấy ủy quyền**, bao gồm:

- Giấy ủy quyền theo mẫu, có đính kèm bản CMND của Chủ hộ.
- Bản CMND của người được ủy quyền.
- Thời hạn ủy quyền được điền rõ.

ResidentGPT chỉ hướng dẫn danh mục giấy tờ; không yêu cầu người dùng gửi
số CMND, ảnh CMND hoặc bản giấy tờ cá nhân vào hệ thống MVP.

### ACON-I-03 — Giấy xác nhận Nhà thầu

<!-- intent_ids: [I-04]; risk_level: low; answer_policy: normal_faq; scope: apartment_construction -->

Hồ sơ cần **01 bản gốc Giấy xác nhận Nhà thầu**. Chủ hộ hoặc người được ủy
quyền xác nhận các Nhà thầu phụ trách thi công, sửa chữa Căn hộ.

### ACON-I-04 — Nội quy thi công có chữ ký

<!-- intent_ids: [I-04]; risk_level: low; answer_policy: normal_faq; scope: apartment_construction -->

Hồ sơ cần **01 bản gốc Nội quy thi công**, có chữ ký của cả Chủ hộ và Nhà
thầu.

Nội dung Nội quy thi công và mẫu ký không được cung cấp kèm nguồn này.

### ACON-I-05A — Số lượng và loại bản vẽ

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: normal_faq; scope: apartment_construction -->

Hồ sơ cần:

- **01 bản vẽ mặt bằng hiện trạng**, căn cứ vào bản vẽ hoàn công tại thời
  điểm bàn giao.
- **01 bản vẽ mặt bằng cải tạo**, thể hiện nội dung cần thi công, có khoanh
  mây khu vực và chú thích chi tiết hạng mục cần cải tạo.

Hai bản vẽ phải cùng tỉ lệ và khớp với nội dung đăng ký cải tạo.

### ACON-I-05B — Yêu cầu trình bày bản vẽ

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: normal_faq; scope: apartment_construction -->

Bản vẽ phải thể hiện trên nền trắng, chữ đen, phông chữ rõ ràng và dễ đọc.
Ban Quản lý không nhận bản vẽ có phần khoanh mây hoặc ghi chú bằng chữ
viết tay.

### ACON-I-06A — Hồ sơ làm Thẻ Nhà thầu

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: normal_faq_without_collecting_personal_data; scope: apartment_construction -->

Tại thời điểm nộp hồ sơ, Nhà thầu thi công Căn hộ phải nộp bản photo CMND
và ảnh 3x4 của tất cả công nhân thi công.

ResidentGPT không thu thập, lưu trữ hoặc yêu cầu người dùng tải các giấy
tờ và ảnh cá nhân này lên hệ thống MVP. Việc nộp phải thực hiện qua kênh
chính thức do BQL hướng dẫn.

### ACON-I-06B — Thay đổi danh sách công nhân

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: normal_faq_without_collecting_personal_data; scope: apartment_construction -->

Khi có thay đổi nhân sự thi công, hồ sơ bổ sung phải được cung cấp trước
**02 ngày**.

Nguồn không nêu rõ đây là ngày làm việc hay ngày theo lịch và không nêu
kênh nộp; nếu cần xác định mốc cụ thể, phải liên hệ BQL.

## II. Sau khi hồ sơ được phê duyệt

### ACON-II-01A — Tiền đặt cọc thi công Căn hộ

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: published_fee_then_bql_for_payment; scope: apartment_construction -->

Nếu hồ sơ thi công được duyệt, Ban Quản lý sẽ thông báo cho Chủ hộ hoặc
Nhà thầu về việc thanh toán tiền đặt cọc. Mức công bố cho **Căn hộ** là
**10.000.000 đồng/lần thi công**.

Hồ sơ thanh toán cần **01 bản photo ủy nhiệm chi**. ResidentGPT không được
cung cấp số tài khoản hoặc hướng dẫn chuyển tiền khi nguồn chưa nêu; người
dùng phải chờ thông báo chính thức của BQL.

### ACON-II-01B — Phí thi công Căn hộ

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: published_fee_then_bql_for_payment; scope: apartment_construction -->

Mức phí thi công được công bố cho **Căn hộ** là **110.000 đồng/ngày**, đã
bao gồm VAT.

ResidentGPT chỉ được nêu mức phí từ nguồn và không tự tính tổng tiền hoặc
xác nhận nghĩa vụ thanh toán cho một hồ sơ cụ thể.

### ACON-II-01X — Tham chiếu tiền đặt cọc và phí của Shop/Shophouse

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: excluded_from_rag_pending_scope_confirmation; scope: cross_scope_reference -->

Nguồn có nêu các mức sau ngoài phạm vi tiêu đề:

- Căn Shop: đặt cọc **50.000.000 đồng/lần thi công**; phí thi công được ghi
  chung với Căn hộ là **110.000 đồng/ngày**, đã bao gồm VAT.
- Shophouse: đặt cọc **100.000.000 đồng/lần thi công**; phí thi công
  **220.000 đồng/ngày**, đã bao gồm VAT.

Section này bị loại khỏi RAG vì nguồn mang tiêu đề dành cho Căn hộ và chưa
xác định phạm vi Shop/Shophouse cụ thể. Chỉ được sử dụng sau khi BQL xác
nhận bằng nguồn đúng phạm vi.

### ACON-II-02 — Đăng ký mang vật liệu hoặc nội thất ra vào

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: general_process_then_bql_for_registration; scope: apartment_construction -->

Trong quá trình thi công, việc vận chuyển vật tư hoặc nội thất ra vào Khu
Căn hộ phải được đăng ký. Bộ phận Bảo vệ thực hiện kiểm soát để tránh thất
thoát hoặc hư hỏng tài sản của Cư dân.

Nguồn chưa nêu biểu mẫu, thời hạn và kênh đăng ký. ResidentGPT không được
tự tạo quy trình; người dùng cần liên hệ BQL.

### ACON-II-03 — Đăng ký thi công bổ sung

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: general_process_then_bql_for_registration; scope: apartment_construction -->

Chủ hộ cần đăng ký thi công bổ sung khi:

- Phát sinh thêm hạng mục cải tạo trong quá trình thi công.
- Thời gian đăng ký sắp hết nhưng việc cải tạo chưa hoàn tất.
- Muốn cho nhân công làm ngoài giờ.

Nguồn không nêu điều kiện được chấp thuận làm ngoài giờ, thời hạn nộp hoặc
biểu mẫu. ResidentGPT không được mặc nhiên xác nhận yêu cầu sẽ được duyệt.

## III. Nghiệm thu và hoàn tiền đặt cọc

### ACON-III-01 — Thông báo hoàn tất và yêu cầu nghiệm thu

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: general_process_then_bql_for_scheduling; scope: apartment_construction -->

Sau khi hoàn tất cải tạo, Chủ hộ phải:

- Thông báo cho Ban Quản lý về việc hoàn tất thi công.
- Cung cấp Nhật ký thi công.
- Đề nghị thời gian để Ban Quản lý nghiệm thu.

Nguồn không nêu biểu mẫu, kênh gửi hoặc thời hạn BQL thực hiện nghiệm thu.

### ACON-III-02 — Điều kiện hoàn tiền đặt cọc và khoản khấu trừ

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: apartment_construction -->

Nguồn nêu rằng sau khi BQL nghiệm thu và xác nhận Căn hộ được cải tạo đúng
hồ sơ đã đăng ký, BQL sẽ tiến hành hoàn tiền đặt cọc. Số tiền hoàn được mô
tả là tiền đặt cọc trừ số tiền vi phạm trong quá trình thi công, nếu có.

ResidentGPT không được xác định một trường hợp đã đạt nghiệm thu, có vi
phạm hay không, số tiền bị khấu trừ hoặc số tiền được hoàn. Các yêu cầu này
phải chuyển BQL và log `legal_or_compensation_escalation`.

## Yêu cầu kỹ thuật và lưu ý chung

### ACON-NOTE-01 — Bản vẽ hiện trạng và cải tạo

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: normal_faq; scope: apartment_construction -->

Hồ sơ phải có bản vẽ mặt bằng hiện trạng Căn hộ. Các hạng mục xin cải tạo
phải được thể hiện và chú thích rõ ràng trên bản vẽ cải tạo.

### ACON-NOTE-02 — Thể hiện cốt sàn

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_technical_rule_then_professional_review; scope: apartment_construction -->

Nếu cải tạo sàn, bản vẽ phải thể hiện cốt sàn. ResidentGPT không thiết kế
hoặc đánh giá thông số kỹ thuật cho phương án cụ thể.

### ACON-NOTE-03 — Hồ sơ thiết kế hệ thống kỹ thuật

<!-- intent_ids: [I-04]; risk_level: critical; answer_policy: general_technical_rule_then_professional_and_bql_review; scope: apartment_construction -->

Hồ sơ phải có đầy đủ thiết kế Điện, Nước, Điều hòa không khí và PCCC nếu
cần. Việc xác định thiết kế nào bắt buộc cho một hạng mục cụ thể phải do
BQL hoặc đơn vị chuyên môn xác nhận.

### ACON-NOTE-04X — Yêu cầu riêng được nguồn nhắc tới cho Shop/Shophouse

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: excluded_from_rag_pending_scope_confirmation; scope: cross_scope_reference -->

Nguồn nhắc rằng Shop/Shophouse kinh doanh ẩm thực phải có hệ thống hút
mùi, xử lý mùi và bẫy mỡ; thiết kế bảng biển theo tiêu chuẩn Chủ Đầu tư và
chuẩn bị giấy tờ đăng ký kinh doanh.

Section này bị loại khỏi RAG của tài liệu Căn hộ. Không dùng để trả lời cho
Shop/Shophouse nếu chưa có nguồn riêng đúng phạm vi.

## Thi công tấm tường ACOTEC

Các yêu cầu dưới đây là quy tắc kỹ thuật chung từ nguồn. ResidentGPT không
được chuyển chúng thành hướng dẫn thi công từng bước hoặc xác nhận an toàn
cho công trình cụ thể; phương án thực tế phải được Nhà thầu đủ năng lực và
BQL xem xét.

### ACON-ACOTEC-01 — Không treo đồ nặng bằng vít

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_technical_rule_then_professional_review; scope: apartment_construction -->

Không bắt vít để treo đồ nặng lên tấm tường ACOTEC.

### ACON-ACOTEC-02 — Trình tự tháo dỡ

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_technical_rule_then_professional_review; scope: apartment_construction -->

Khi tháo dỡ tấm tường ACOTEC, phải tháo từ trên xuống.

### ACON-ACOTEC-03 — Cắt tạo lỗ và hạn chế bụi

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_technical_rule_then_professional_review; scope: apartment_construction -->

Không được đục tấm tường ACOTEC khi chưa cắt tạo lỗ. Phải có dưỡng để kiểm
soát chiều sâu vết cắt và thường xuyên phun nước vào vết cắt trong quá
trình cắt, đục để hạn chế bụi.

### ACON-ACOTEC-04 — Không khoan thủng tấm tường

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_technical_rule_then_professional_review; scope: apartment_construction -->

Không được khoan thủng tấm tường ACOTEC tại các vị trí khoan, đục.

### ACON-ACOTEC-05 — Chiều sâu đường cắt ngang

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_technical_rule_then_professional_review; scope: apartment_construction -->

Tại vị trí phải cắt ngang trên tấm tường ACOTEC, đường cắt không được sâu
quá **50 mm**.

### ACON-ACOTEC-06 — Bù vữa tại vị trí rỗng

<!-- intent_ids: [I-04]; risk_level: high; answer_policy: general_technical_rule_then_professional_review; scope: apartment_construction -->

Phải bù mác vữa 100 tại các vị trí rỗng sau khi khoan, đục.

## Thông tin hỗ trợ

### ACON-CONTACT-01 — Email và hotline hỗ trợ

<!-- intent_ids: [I-04]; risk_level: medium; answer_policy: verified_escalation_contact; scope: apartment_construction -->

Khi có thắc mắc hoặc ý kiến, Cư dân có thể liên hệ:

- Email: **info@vinhomes.vn**.
- Trung tâm Chăm sóc khách hàng: **1900 232389**, nhánh số **4**.

Email và hotline đã được người cung cấp xác nhận còn hiện hành.

## Khoảng trống của nguồn

Nguồn chưa cung cấp:

- Mẫu Đơn đăng ký thi công, Giấy ủy quyền, Giấy xác nhận Nhà thầu, Nội quy
  thi công và Nhật ký thi công.
- Địa điểm hoặc kênh nộp hồ sơ và giờ tiếp nhận.
- Số tài khoản, nội dung chuyển khoản hoặc quy trình thanh toán.
- Thời hạn nghiệm thu và hoàn tiền đặt cọc.
- Biểu mẫu, thời hạn và kênh đăng ký vận chuyển vật tư/nội thất.
- Điều kiện và khung giờ được phép thi công ngoài giờ.

ResidentGPT không được tự điền các khoảng trống này; phải đề xuất liên hệ
BQL qua kênh chính thức.
