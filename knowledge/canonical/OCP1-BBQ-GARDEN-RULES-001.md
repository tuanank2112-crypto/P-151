---
document_id: OCP1-BBQ-GARDEN-RULES-001
title: Nội quy tiện ích Vườn Nướng BBQ
property_id: VINHOMES_OCEAN_PARK
property_scope: Vườn Nướng BBQ, Khu Đô thị Vinhomes Ocean Park
area_type: bbq_garden
amenity_type: bbq_garden
audience: residents_and_accompanied_guests
category: common_amenity_bbq_garden_rules
source_owner: Ban Quản lý Khu Đô thị Vinhomes Ocean Park
source_type: Official rules text transcribed by resident
source_channel: Vinhomes app official rules channel
issued_at: 2026-07-22
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
excluded_from_rag_sections:
  - BBQ-SAN-05
contains_resident_pii: false
contains_health_safety_rules: true
contains_financial_information: true
contains_public_business_contact: true
raw_source: ../raw/OCP1-BBQ-GARDEN-RULES-001.txt
normalized_at: 2026-09-19
review_log: ../review/review_log.md
---

# Nội quy tiện ích Vườn Nướng BBQ

> **Giới hạn phạm vi:** Tài liệu chỉ áp dụng cho Vườn Nướng BBQ tại Khu Đô
> thị Vinhomes Ocean Park. Không dùng giờ hoạt động, giá, quy trình đặt lịch
> hoặc chế tài này cho tiện ích khác.

Tài liệu được ban hành ngày **22/07/2026**. Người cung cấp xác nhận nguồn
được lấy từ kênh nội quy chính thức trên ứng dụng Vinhomes, là phiên bản
mới nhất, đang có hiệu lực và được phép sử dụng cho MVP.

Nguồn có xung đột về sức chứa: phần giá nêu phụ thu khi quá 06 người và
phần vận hành nêu tối đa 08 người, trong khi chế tài số 5 coi số lượng trên
06 người là vi phạm. ResidentGPT không được trả lời trường hợp có 07–08
người cho đến khi BQL xác nhận. `BBQ-SAN-05` bị loại khỏi RAG.

## Thời gian và địa điểm

### BBQ-00A — Giờ mở cửa

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Vườn Nướng BBQ mở cửa hằng ngày từ **09:30 đến 21:30**.

### BBQ-LOC-01 — Các khu vực Vườn Nướng

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Nguồn liệt kê ba khu vực:

1. Vườn Nướng BBQ hồ San Hô.
2. Vườn Nướng BBQ hồ Ngọc Trai.
3. Vườn Nướng BBQ Hải Âu.

## Giá và phụ thu

### BBQ-FEE-01 — Giá một lượt sử dụng

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq_with_source_freshness_check; scope: bbq_garden -->

Giá được ghi trong nguồn là **200.000 đồng/lượt/02 giờ**, áp dụng cho số
lượng không quá 06 người.

Giá chỉ được trả lời khi tài liệu vẫn có trạng thái `Current`. ResidentGPT
không được áp dụng giá này cho giao dịch đã phát sinh theo thông báo khác.

### BBQ-FEE-02 — Phụ thu khi quá 06 người

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: source_conflict_escalate_to_bql; scope: bbq_garden -->

Phần giá ghi mức phụ thu **40.000 đồng/người** khi số lượng vượt quá 06
người.

Nội dung này xung đột với chế tài số 5 về số người. ResidentGPT không được
tự xác nhận khả năng sử dụng cho nhóm 07–08 người hoặc tự tính phụ thu; phải
đề xuất liên hệ BQL.

### BBQ-FEE-03 — Phụ thu quá thời gian một lượt

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: source_ambiguity_escalate_to_bql; scope: bbq_garden -->

Nguồn ghi các mức phụ thu khi quá thời gian một lượt sử dụng:

- Dưới 60 phút: **100.000 đồng**.
- Dưới 120 phút: **200.000 đồng**.

Hai khoảng thời gian trong nguồn bị chồng lấn và không nêu mức áp dụng tại
đúng 60 phút, đúng 120 phút hoặc trên 120 phút. ResidentGPT không được tự
tính số tiền; trường hợp cụ thể phải chuyển BQL.

### BBQ-FEE-04 — Hủy lịch và hoàn tiền

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_with_manual_handling_for_exception_or_dispute; scope: bbq_garden -->

Nguồn ghi:

- Hủy lịch “trước 24 giờ” được hoàn 50% giá vé, không tính trên tổng gồm
  phụ thu.
- Hủy lịch “sau 24 giờ”, kể cả trong điều kiện bất khả kháng như mưa, bão
  hoặc thiên tai, không được hoàn tiền.

Nguồn không xác định rõ mốc tham chiếu của cụm “trước/sau 24 giờ”.
ResidentGPT không được tự quyết định số tiền hoàn, ngoại lệ hoặc tranh chấp
giao dịch; phải chuyển BQL.

## Đặt lịch và check-in

### BBQ-BOOK-01 — Đối tượng sử dụng

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Vườn Nướng dành cho Cư dân Khu Đô thị Vinhomes Ocean Park và gia đình,
người thân, bạn bè hoặc khách đi cùng Cư dân.

### BBQ-BOOK-02 — Thời hạn và giờ đặt lịch

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Cư dân đăng ký qua ứng dụng:

- Tối thiểu trước **24 giờ**.
- Tối đa trước **07 ngày**.
- Thời gian đặt lịch trong ngày: từ **08:30 đến 17:30**.

### BBQ-BOOK-03 — Check-in bằng lịch sử đặt bếp

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq_without_collecting_booking_or_qr_data; scope: bbq_garden -->

Cư dân phải xuất trình lịch sử đặt bếp thành công để Nhân viên Tiện ích
check-in mã QR.

ResidentGPT không được yêu cầu hoặc lưu tài khoản ứng dụng, lịch sử đặt
bếp hay mã QR thật trong dữ liệu MVP.

### BBQ-BOOK-04 — Số người tối đa theo phần vận hành

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: source_conflict_escalate_to_bql; scope: bbq_garden -->

Phần vận hành ghi mỗi ô nướng phục vụ tối đa **08 người**, bao gồm người
lớn, trẻ em và người phụ thu nếu có.

Nội dung này xung đột với chế tài số 5 về số người. ResidentGPT không được
xác nhận trường hợp nhóm 07–08 người cho đến khi BQL làm rõ.

### BBQ-BOOK-05 — Vỉ nướng được nhận khi check-in

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Khách nhận **01 vỉ nướng cho 01 bếp** khi check-in hợp lệ.

### BBQ-LOC-02 — Địa điểm check-in và nhận vỉ nướng

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Khách check-in và nhận vỉ nướng trực tiếp tại cổng vào từng khu:

- **Hồ San Hô:** cửa tay quay thứ hai từ cổng có biểu tượng chữ V.
- **Hồ Ngọc Trai:** cửa giữa lối vào khu BBQ, đường San Hô.
- **Hải Âu:** Khu Biệt Thự Hải Âu.

## I. Các quy định chung

### BBQ-I-03 — Trẻ em dưới 12 tuổi

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: normal_faq_with_safety_warning; scope: bbq_garden -->

Trẻ em dưới 12 tuổi phải có người lớn đi kèm để hướng dẫn, theo dõi và
giám sát an toàn.

### BBQ-I-04 — Chỉ sử dụng bếp than

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: normal_faq_with_fire_safety_warning; scope: bbq_garden -->

Chỉ được sử dụng bếp than để nướng thực phẩm trong Vườn Nướng.

### BBQ-I-05 — Dập tắt tàn lửa

<!-- intent_ids: [I-03]; risk_level: critical; answer_policy: fire_safety_and_emergency_escalation; scope: bbq_garden -->

Tất cả tàn lửa phải được dập tắt ngay sau khi sử dụng.

Khi có dấu hiệu cháy hoặc nguy cơ hiện hữu, phải báo ngay nhân viên/BQL và
lực lượng phù hợp; ResidentGPT không hướng dẫn xử lý thay người tại hiện
trường.

### BBQ-I-06 — Vệ sinh và bàn giao sau sử dụng

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Khách phải vệ sinh, làm sạch Vườn Nướng và thông báo cho Ban Quản lý ngay
sau khi sử dụng.

### BBQ-I-07A — Bảo vệ tài sản, cảnh quan và môi trường

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: bbq_garden -->

Khách phải bảo vệ tài sản, cảnh quan và môi trường chung; sử dụng công
trình, tiện ích đúng chức năng và theo chỉ dẫn.

### BBQ-I-07B — Bồi thường hư hỏng tài sản chung

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn quy định Khách phải bồi thường và khắc phục toàn bộ thiệt hại phát
sinh nếu làm hư hỏng hoặc mất thiết bị, tài sản hay công trình.

ResidentGPT không được xác định lỗi, trách nhiệm hoặc mức bồi thường trong
trường hợp cụ thể; phải đề xuất chuyển BQL và log
`legal_or_compensation_escalation`.

### BBQ-I-08A — Bảo quản tài sản và an toàn cá nhân

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_only_no_health_or_liability_assessment; scope: bbq_garden -->

Khách phải tự bảo quản tài sản cá nhân và chủ động bảo đảm an toàn tính
mạng, sức khỏe trong quá trình sử dụng Vườn Nướng.

### BBQ-I-08B — Điều khoản trách nhiệm đối với tài sản và an toàn

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu Ban Quản lý không chịu trách nhiệm về mất mát tài sản hoặc an
toàn tính mạng của Khách trong quá trình sử dụng Vườn Nướng.

ResidentGPT không được dùng điều khoản này để kết luận trách nhiệm, lỗi,
bồi thường hoặc tranh chấp trong trường hợp cụ thể; phải chuyển BQL.

### BBQ-I-09 — Bồi thường thiệt hại cho bên khác

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn quy định Khách phải bồi thường hoặc khắc phục thiệt hại thực tế do
mình hoặc người được mình bảo hộ gây ra cho bên bị thiệt hại.

ResidentGPT không được đánh giá trách nhiệm hoặc mức thiệt hại; phải đề
xuất chuyển BQL.

### BBQ-I-10 — Trường hợp khẩn cấp hoặc không an toàn

<!-- intent_ids: [I-03]; risk_level: critical; answer_policy: emergency_guidance_and_manual_decision; scope: bbq_garden -->

Trong trường hợp khẩn cấp, nguy hiểm hoặc vì lý do an toàn, nguồn quy định
Ban Quản lý có quyền từ chối sử dụng hoặc mời Khách rời khỏi Vườn Nướng.

ResidentGPT phải ưu tiên hướng dẫn liên hệ người tại hiện trường và không
tự quyết định từ chối hay mời một cá nhân rời khu vực.

### BBQ-I-11 — Tuân thủ hướng dẫn

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: bbq_garden -->

Khách phải thực hiện theo hướng dẫn của nhân viên bảo vệ, nhân viên quản lý
Vườn Nướng và các quy định của Ban Quản lý.

## II. Các hành vi nghiêm cấm

### BBQ-II-01 — Vũ khí và vật liệu nguy hiểm

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_then_escalate_for_incident; scope: bbq_garden -->

Không được mang vũ khí, hung khí, chất cháy nổ, hóa chất độc hại hoặc hàng
cấm vào Vườn Nướng.

### BBQ-II-02 — Chất kích thích, tệ nạn và hành vi vi phạm pháp luật

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_then_escalate_for_incident; scope: bbq_garden -->

Không được sử dụng ma túy, chất kích thích; tổ chức đánh bạc, bói toán, mại
dâm; gây mất an ninh, trật tự hoặc thực hiện hành vi vi phạm pháp luật khác
trong Vườn Nướng.

### BBQ-II-03 — Tiếng ồn

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: bbq_garden -->

Không được gây tiếng ồn quá mức làm ảnh hưởng trật tự trong Khu Đô thị, ví
dụ sử dụng thiết bị phát âm thanh quá lớn hoặc hát karaoke.

### BBQ-II-04 — Hun khói và nhiên liệu dễ cháy

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: general_rule_then_escalate_for_incident; scope: bbq_garden -->

Không được hun khói hoặc sử dụng gas, xăng, dầu và hóa chất dễ cháy khác
trong Vườn Nướng.

### BBQ-II-05 — Không làm hư hại hoặc sử dụng sai thiết bị

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: normal_faq; scope: bbq_garden -->

Không được làm hư hại hoặc sử dụng dụng cụ, thiết bị, công trình tiện ích
sai chức năng hay sai đối tượng.

### BBQ-II-06A — Không bán hàng

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Không được bán hàng trong Vườn Nướng.

### BBQ-II-06B — Không xả rác và chất thải

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Không được xả rác hoặc chất thải bừa bãi, không đúng nơi quy định.

### BBQ-II-07 — Không mang động vật vào khu vực

<!-- intent_ids: [I-03]; risk_level: low; answer_policy: normal_faq; scope: bbq_garden -->

Không được mang gia súc, gia cầm hoặc vật nuôi vào Vườn Nướng.

## Quy định về Thẻ và quyền sử dụng

### BBQ-ACCESS-01 — Không cho mượn hoặc cho thuê quyền sử dụng

<!-- intent_ids: [I-01, I-03]; risk_level: medium; answer_policy: normal_faq_without_collecting_identity_or_booking_data; scope: bbq_garden -->

Không được cho mượn hoặc cho thuê Thẻ Cư dân, Thẻ Ra vào hay ô nướng dưới
bất kỳ hình thức nào.

## Xử lý vi phạm chung

### BBQ-ENF-01 — Quyền nhắc nhở, lập biên bản và mời ra khỏi khu vực

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu Ban Quản lý có quyền nhắc nhở, lập biên bản, xử lý hành vi vi
phạm hoặc mời cá nhân vi phạm ra khỏi Vườn Nướng.

ResidentGPT không được tự xác định vi phạm hoặc lựa chọn biện pháp xử lý;
phải đề xuất chuyển BQL.

## Thông tin hỗ trợ

### BBQ-CONTACT-01 — Liên hệ khi cần tư vấn hoặc hỗ trợ

<!-- intent_ids: [I-03]; risk_level: medium; answer_policy: verified_escalation_contact; scope: bbq_garden -->

Khi cần tư vấn hoặc hỗ trợ, Khách thông báo cho nhân viên bảo vệ, nhân viên
quản lý Vườn Nướng hoặc liên hệ hotline **1900 232389**, nhánh số **4**.

Hotline đã được người cung cấp xác nhận còn hiện hành. Email cũng được xác
nhận còn hiện hành nhưng không xuất hiện trong nội dung nguồn này nên không
được bổ sung vào section.

## Chế tài xử lý vi phạm

Toàn bộ section trong phần này chỉ dùng để nhận diện high-risk và chuyển
BQL. ResidentGPT không được xác định vi phạm hoặc áp dụng chế tài cho cá
nhân.

### BBQ-SAN-01 — Không vệ sinh hoàn trả khu vực

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài **300.000 đồng/ô nướng**, đã bao gồm VAT, và ngừng cung
cấp dịch vụ cho đến khi hoàn thành thanh toán đối với trường hợp không giữ
vệ sinh hoặc không hoàn trả mặt bằng, cảnh quan sau sử dụng.

### BBQ-SAN-02 — Dựng lều, cắm trại, trải bạt hoặc thảm

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **02 tháng**.

### BBQ-SAN-03 — Gây tiếng ồn quá mức

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **02 tháng**.

### BBQ-SAN-04 — Sử dụng chất dễ cháy nổ

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **02 tháng**.

### BBQ-SAN-05 — Xung đột về số người sử dụng

<!-- excluded_from_rag: true; reason: conflicts_with_pricing_and_max_capacity_sections -->

Bảng chế tài coi số lượng trên 06 người, bao gồm cả trẻ em, trên mỗi ô
nướng là vi phạm và nêu chế tài ngừng dịch vụ trong 02 tháng.

Nội dung này xung đột trực tiếp với `BBQ-FEE-02` và `BBQ-BOOK-04`, vốn nêu
phụ thu trên 06 người và tối đa 08 người. Section này **không được index,
retrieval hoặc trích dẫn** cho đến khi BQL xác nhận quy định đúng.

### BBQ-SAN-06 — Không tuân thủ các quy định liên quan

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **02 tháng**
khi không tuân thủ Nội quy Khu Đô thị, quy định của Ban Quản lý hoặc pháp
luật.

### BBQ-SAN-07 — Hủy lịch nhưng không thông báo

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **02 tháng**
đối với trường hợp hủy lịch nhưng không thông báo Ban Quản lý.

### BBQ-SAN-08 — Quảng cáo, bán hàng hoặc giới thiệu sản phẩm

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu các biện pháp yêu cầu dừng hoạt động, mời ra khỏi khu vực và
ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **03 tháng**.

### BBQ-SAN-09 — Cho mượn hoặc cho thuê quyền sử dụng

<!-- intent_ids: [I-01, I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **06 tháng**
đối với việc cho mượn hoặc cho thuê Thẻ Cư dân, Thẻ Ra vào hay ô nướng.

### BBQ-SAN-10 — Không hợp tác ký xác nhận vi phạm

<!-- intent_ids: [I-03]; risk_level: high; answer_policy: do_not_answer_escalate_to_bql; scope: bbq_garden -->

Nguồn nêu chế tài ngừng cung cấp dịch vụ Vườn Nướng BBQ trong **06 tháng**
đối với trường hợp không hợp tác ký xác nhận vi phạm khi đại diện Ban Quản
lý yêu cầu.
