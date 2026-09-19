---
document_id: OCP1-FISHING-DECK-RULES-001
title: Nội quy tiện ích Sàn Câu cá
property_id: VINHOMES_OCEAN_PARK
property_scope: Sàn Câu cá, Khu Đô thị Vinhomes Ocean Park
area_type: fishing_deck
amenity_type: fishing_deck
audience: residents_and_eligible_customers
category: common_amenity_fishing_deck_rules
source_owner: Ban Quản lý Khu Đô thị Vinhomes Ocean Park
source_type: Official rules text transcribed by resident
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
contains_health_safety_rules: true
contains_public_business_contact: true
raw_source: ../raw/OCP1-FISHING-DECK-RULES-001.txt
normalized_at: 2026-09-19
review_log: ../review/review_log.md
---

# Nội quy tiện ích Sàn Câu cá

> **Giới hạn phạm vi:** Tài liệu chỉ áp dụng cho Sàn Câu cá tại Khu Đô thị
> Vinhomes Ocean Park. Không dùng giờ hoạt động, quy định đặt chỗ, dụng cụ
> câu hoặc chế tài này cho Bến Thuyền, Biển hồ hay tiện ích khác.

Tài liệu được ban hành ngày **27/02/2026**. Người cung cấp xác nhận nguồn
được lấy từ kênh nội quy chính thức trên ứng dụng Vinhomes, là phiên bản
mới nhất, đang có hiệu lực và được phép sử dụng cho MVP.

Phần III của nguồn làm rõ đối tượng sử dụng gồm Cư dân và Khách hàng có
thẻ chính chủ theo trạng thái bàn giao căn. Bản canonical sử dụng phần làm
rõ này nhưng không mở rộng quyền sử dụng cho đối tượng khác.

## Thời gian hoạt động

### FISH-00A — Giờ mở cửa

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Sàn Câu cá mở cửa hằng ngày trong hai khung giờ:

- Từ **08:00 đến 12:00**.
- Từ **14:00 đến 18:00**.

## Đặt lịch và kiểm soát sử dụng

### FISH-BOOK-01 — Đặt lịch trước

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Người sử dụng phải đặt lịch trên ứng dụng trước ít nhất **01 ngày**.

### FISH-BOOK-02 — Đối tượng sử dụng

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: general_rule_only; scope: fishing_deck -->

Nguồn ban đầu ghi Sàn Câu cá dành riêng cho Cư dân. Phần làm rõ sau đó nêu
đối tượng là Cư dân hoặc Khách hàng Khu Đô thị Vinhomes Ocean Park có loại
thẻ chính chủ phù hợp với trạng thái bàn giao căn.

ResidentGPT không được tự xác nhận tư cách của một cá nhân; trường hợp chưa
rõ phải đề xuất liên hệ BQL.

### FISH-BOOK-03 — Thẻ chính chủ theo trạng thái bàn giao

<!-- intent_ids: [I-01, I-03]; risk_level: medium; answer_policy: normal_faq_without_collecting_identity_or_booking_data; scope: fishing_deck -->

Khi sử dụng dịch vụ, người dùng phải mang:

- **Thẻ Cư dân chính chủ** đối với căn đã nhận bàn giao.
- **Thẻ Ra vào chính chủ** đối với căn chưa nhận bàn giao.

ResidentGPT không được yêu cầu hoặc lưu số thẻ, ảnh thẻ, tài khoản hay lịch
sử đặt chỗ thật trong dữ liệu MVP.

### FISH-BOOK-04 — Giới hạn đặt vị trí câu

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Mỗi Căn hộ hoặc Biệt thự được đặt tối đa **01 vị trí/01 khung giờ/01 ngày**.

### FISH-BOOK-05 — Hủy lịch

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: general_rule_only_missing_procedure; scope: fishing_deck -->

Nguồn yêu cầu người dùng hủy lịch đã đăng ký hoặc thông báo cho Ban Quản lý
khi không sử dụng.

Nguồn không cung cấp thời hạn hoặc thao tác hủy cụ thể. ResidentGPT không
được suy đoán quy trình; trường hợp cần thực hiện phải liên hệ BQL.

## I. Các quy định chung

### FISH-I-03A — Loại và số lượng cần câu

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: fishing_deck -->

Chỉ được sử dụng cần câu tay và tối đa **01 cần câu/01 người/01 lượt câu**.

### FISH-I-03B — Mồi câu và bảo vệ nguồn nước

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: normal_faq_with_environmental_warning; scope: fishing_deck -->

Không được sử dụng mồi chứa hóa chất gây ảnh hưởng nguồn nước và không được
xả mồi bả xuống hồ.

### FISH-I-03C — Loại lưỡi câu bị cấm

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: normal_faq_with_safety_warning; scope: fishing_deck -->

Không được sử dụng lưỡi chùm hoặc lưỡi ba tiêu.

### FISH-I-04 — Không xuống hồ

<!-- intent_ids: [I-03]; risk_level: critical; answer_policy: emergency_guidance_and_human_escalation; scope: fishing_deck -->

Không được xuống hồ dưới bất kỳ hình thức hoặc vì bất kỳ lý do nào.

Nếu có người rơi hoặc xuống hồ, phải báo ngay nhân viên/BQL và lực lượng
cứu hộ phù hợp; ResidentGPT không hướng dẫn cứu hộ thay người tại hiện
trường.

### FISH-I-05 — Trẻ em dưới 12 tuổi

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: normal_faq_with_safety_warning; scope: fishing_deck -->

Trẻ em dưới 12 tuổi không được vào khu vực Sàn Câu cá.

### FISH-I-06A — Vệ sinh và bảo vệ môi trường

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Phải giữ gìn vệ sinh, bảo vệ môi trường; không xả rác hoặc làm bẩn khu vực
Sàn Câu cá.

### FISH-I-06B — Không thả vật nuôi

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Không được thả vật nuôi gây mất vệ sinh hoặc mỹ quan tại Sàn Câu cá.

### FISH-I-07 — Giữ gìn tài sản chung và báo hư hại

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: fishing_deck -->

Người sử dụng phải giữ gìn tài sản chung và thông báo ngay cho Ban Quản lý
khi phát hiện cơ sở vật chất của Sàn Câu cá bị hư hại.

Yêu cầu xác định trách nhiệm hoặc chi phí đối với hư hại cụ thể phải chuyển
BQL.

### FISH-I-08 — Bảo vệ bãi cỏ và cây xanh

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Không được dẫm đạp hoặc để vật dụng, đồ cá nhân lên bãi cỏ; không được treo
đồ vật lên cây.

### FISH-I-09 — Nếp sống văn minh

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: general_rule_then_escalate_for_incident; scope: fishing_deck -->

Không được gây gổ, đánh nhau, nói tục hoặc chửi bậy. Khi đang xảy ra xô
xát hoặc nguy cơ an ninh, phải báo nhân viên/BQL.

### FISH-I-10 — Hút thuốc, ăn uống và rượu bia

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: fishing_deck -->

Nghiêm cấm hút thuốc, ăn uống hoặc sử dụng rượu bia trong khu vực Sàn Câu
cá.

### FISH-I-11A — Bảo quản tài sản cá nhân

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: general_rule_only; scope: fishing_deck -->

Khách phải tự bảo quản tư trang, dụng cụ và tài sản cá nhân.

### FISH-I-11B — Điều khoản trách nhiệm đối với tài sản cá nhân

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu Ban Quản lý không chịu trách nhiệm bồi thường khi tư trang, dụng
cụ hoặc tài sản cá nhân bị hư hại hay mất mát.

ResidentGPT không được dùng điều khoản này để kết luận trách nhiệm, lỗi,
bồi thường hoặc tranh chấp trong trường hợp cụ thể; phải chuyển BQL và log
`legal_or_compensation_escalation`.

### FISH-I-12 — Điều khoản trách nhiệm đối với rủi ro và tai nạn

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu người câu tự chịu trách nhiệm đối với rủi ro có thể xảy ra và
Ban Quản lý hoặc Chủ Đầu tư không chịu trách nhiệm đối với tai nạn, thương
tích, tổn thất hoặc mất mát liên quan trực tiếp hay gián tiếp đến việc sử
dụng cơ sở vật chất tại Sàn Câu cá.

ResidentGPT không được xác định trách nhiệm, lỗi hoặc bồi thường cho tai
nạn cụ thể; phải đề xuất chuyển BQL.

## II. Các hành vi nghiêm cấm

### FISH-II-01 — Vũ khí và vật liệu nguy hiểm

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_then_escalate_for_incident; scope: fishing_deck -->

Không được mang vũ khí, hung khí, chất cháy nổ, hóa chất độc hại hoặc hàng
cấm vào khu vực Sàn Câu cá.

### FISH-II-02 — Chất kích thích, tệ nạn và hành vi vi phạm pháp luật

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_then_escalate_for_incident; scope: fishing_deck -->

Không được sử dụng ma túy, chất kích thích; tổ chức đánh bạc, bói toán, mại
dâm; gây mất an ninh, trật tự hoặc thực hiện hành vi vi phạm pháp luật khác
trong khu vực Sàn Câu cá.

### FISH-II-03 — Tiếng ồn

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: fishing_deck -->

Không được gây tiếng ồn quá mức làm ảnh hưởng trật tự trong Khu Đô thị, ví
dụ sử dụng thiết bị phát âm thanh quá lớn hoặc hát karaoke.

### FISH-II-04 — Hun khói và chất dễ cháy

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_then_escalate_for_incident; scope: fishing_deck -->

Không được hun khói hoặc sử dụng gas, xăng, dầu và hóa chất dễ cháy khác
trong khu vực Sàn Câu cá.

### FISH-II-05 — Không làm hư hại hoặc sử dụng sai thiết bị

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: fishing_deck -->

Không được làm hư hại hoặc sử dụng dụng cụ, thiết bị, công trình tiện ích
sai chức năng hay sai đối tượng.

### FISH-II-06A — Không bán hàng

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Không được bán hàng trong khu vực Sàn Câu cá.

### FISH-II-06B — Không xả rác và chất thải

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Không được xả rác hoặc chất thải bừa bãi, không đúng nơi quy định.

### FISH-II-07 — Không mang động vật vào khu vực

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Không được mang gia súc, gia cầm hoặc vật nuôi vào khu vực Sàn Câu cá.

## III. Quy định làm rõ và bổ sung

### FISH-III-06 — Không căng hoặc trải vật dụng

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: fishing_deck -->

Không được căng bạt, treo đồ vật lên cây, trải bạt hoặc trải thảm tại khu
vực Sàn Câu cá.

### FISH-III-07 — Không kinh doanh hoặc cho thuê dụng cụ câu

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: fishing_deck -->

Không được dùng dịch vụ để hoạt động kinh doanh hoặc cho thuê cần câu.

Nguồn cũng cấm kinh doanh, mua hoặc bán cá tại khu vực Sàn Câu cá. Nguồn
không quy định việc giữ cá cho mục đích phi thương mại; ResidentGPT không
được suy luận nội dung này.

### FISH-III-08 — Tuân thủ các quy định liên quan

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: general_rule_only; scope: fishing_deck -->

Người sử dụng phải tuân thủ Nội quy Sàn Câu cá, Nội quy Khu Đô thị, các
quy định khác của Ban Quản lý và quy định pháp luật.

ResidentGPT không được tự diễn giải quy định pháp luật hoặc tài liệu chưa
có trong Knowledge Source Pack.

## Quy định về Thẻ và quyền sử dụng

### FISH-ACCESS-01 — Không cho mượn hoặc cho thuê quyền sử dụng

<!-- intent_ids: [I-01, I-03]; risk_level: medium; answer_policy: normal_faq_without_collecting_identity_or_booking_data; scope: fishing_deck -->

Không được cho mượn hoặc cho thuê Thẻ Cư dân, Thẻ Ra vào, ô câu cá, cần câu
hoặc mồi câu tại khu vực Sàn Câu cá.

## Xử lý vi phạm chung

### FISH-ENF-01 — Quyền nhắc nhở, lập biên bản và mời ra khỏi khu vực

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu Ban Quản lý có quyền nhắc nhở, lập biên bản, xử lý hành vi vi
phạm hoặc mời cá nhân vi phạm ra khỏi khu vực Sàn Câu cá.

ResidentGPT không được tự xác định vi phạm hoặc lựa chọn biện pháp xử lý;
phải đề xuất chuyển BQL.

## Thông tin hỗ trợ

### FISH-CONTACT-01 — Liên hệ khi cần tư vấn hoặc hỗ trợ

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: verified_escalation_contact; scope: fishing_deck -->

Khi cần tư vấn hoặc hỗ trợ, Khách thông báo cho nhân viên bảo vệ, nhân viên
quản lý hoặc liên hệ hotline **1900 232389**, nhánh số **4**.

Hotline đã được người cung cấp xác nhận còn hiện hành. Email cũng được xác
nhận còn hiện hành nhưng không xuất hiện trong nội dung nguồn này nên không
được bổ sung vào section.

## Chế tài xử lý vi phạm

Toàn bộ section trong phần này chỉ dùng để nhận diện high-risk và chuyển
BQL. ResidentGPT không được xác định vi phạm hoặc áp dụng chế tài cho cá
nhân.

### FISH-SAN-01 — Vi phạm quy định cần hoặc lưỡi câu

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **02
tháng** khi dùng nhiều hơn 01 cần/người/lượt hoặc dùng lưỡi chùm, lưỡi ba
tiêu.

### FISH-SAN-02 — Mồi hóa chất hoặc xả mồi bả

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **02
tháng**.

### FISH-SAN-03 — Không hủy hoặc không thông báo hủy lịch

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **02
tháng**.

### FISH-SAN-04 — Sử dụng quá giờ

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **02
tháng**.

### FISH-SAN-05 — Vi phạm vệ sinh

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **02
tháng** khi không giữ vệ sinh, xả rác hoặc đi vệ sinh không đúng nơi.

### FISH-SAN-06 — Kinh doanh hoặc mua bán cá

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **02
tháng**.

### FISH-SAN-07 — Không tuân thủ các quy định liên quan

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **02
tháng**.

### FISH-SAN-08 — Vào trái phép hoặc chưa đăng ký

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **03
tháng**.

### FISH-SAN-09 — Cho mượn hoặc cho thuê quyền sử dụng

<!-- intent_ids: [I-01, I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **06
tháng**.

### FISH-SAN-10 — Không hợp tác ký xác nhận vi phạm

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: fishing_deck -->

Nguồn nêu biện pháp mời ra khỏi khu vực và ngừng dịch vụ câu cá trong **06
tháng**.
