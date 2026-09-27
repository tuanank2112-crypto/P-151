---
document_id: OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001
title: Cấp phát thẻ cho Cư dân Khu Đô thị Vinhomes Ocean Park
property_id: VINHOMES_OCEAN_PARK
property_scope: Căn hộ, Biệt thự, Shophouse và Thương mại dịch vụ tại Khu Đô thị Vinhomes Ocean Park
area_type: multi_property_resident_access
card_types:
  - resident_card
  - access_card
  - resident_parking_card
audience: owners_eligible_relatives_tenants_authorized_users_and_approved_parking_subscribers
category: resident_access_and_parking_card_issuance_guide
source_owner: Ban Quản lý Khu Đô thị Vinhomes Ocean Park
source_type: Official guidance text transcribed by resident
source_channel: Vinhomes app official rules channel
issued_at: 2026-08-16
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
contains_financial_information: true
contains_public_business_contact: false
source_ambiguities:
  - CARD-LIMIT-01A
  - CARD-PARK-FEE-03
raw_source: ../raw/OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001.txt
normalized_at: 2026-09-19
review_log: ../review/review_log.md
---

# Cấp phát thẻ cho Cư dân Khu Đô thị Vinhomes Ocean Park

> **Giới hạn phạm vi:** Tài liệu áp dụng cho việc cấp và sử dụng Thẻ Cư
> dân, Thẻ Ra vào và Thẻ gửi xe Cư dân tại các Căn hộ, Biệt thự,
> Shophouse, Shop hoặc diện tích Thương mại dịch vụ thuộc Khu Đô thị
> Vinhomes Ocean Park. Các quyền và hạn mức phải được áp dụng đúng loại thẻ
> và đúng loại hình bất động sản.

Tài liệu được ban hành ngày **16/08/2026**. Người cung cấp xác nhận nguồn
được lấy từ kênh nội quy chính thức trên ứng dụng Vinhomes, là phiên bản
mới nhất, đang có hiệu lực và được phép sử dụng cho MVP.

## Mục đích

### CARD-00A — Mục đích cấp phát và quản lý thẻ

<!-- intent_ids: [I-01, I-02]; risk_level: low; answer_policy: normal_faq; scope: multi_property_resident_access -->

Việc cấp thẻ nhằm hỗ trợ Cư dân sử dụng dịch vụ, tiện ích và ra vào Tòa
nhà, đồng thời phục vụ kiểm soát và an ninh của Khu Đô thị.

## Thẻ Cư dân

### CARD-RES-FEATURE-01 — Ra vào Tòa nhà

<!-- intent_ids: [I-01]; risk_level: low; answer_policy: normal_faq; scope: resident_card -->

Thẻ Cư dân có chức năng ra vào Tòa nhà.

### CARD-RES-FEATURE-02 — Sử dụng tiện ích công cộng

<!-- intent_ids: [I-01, I-03]; risk_level: medium; answer_policy: normal_faq_with_sapphire_caveat; scope: resident_card -->

Thẻ Cư dân được dùng cho các tiện ích công cộng đã bao gồm trong phí quản
lý.

Đối với Cư dân tại các tòa Vinhomes Sapphire, nguồn ghi **không bao gồm bể
bơi và BBQ**. Điều này chỉ có nghĩa hai tiện ích không nằm trong phạm vi
được nguồn xác nhận là đã bao gồm trong phí quản lý; ResidentGPT không được
suy luận rằng Cư dân tuyệt đối không được sử dụng hoặc tự xác định phương
thức sử dụng thay thế.

### CARD-RES-ELIG-01 — Đối tượng tại Căn hộ hoặc Biệt thự

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: general_eligibility_rule_no_personal_status_decision; scope: resident_card_apartment_or_villa -->

Đối tượng được nguồn liệt kê gồm:

- Chủ sở hữu.
- Người thân gồm tứ thân phụ mẫu, vợ hoặc chồng và con ruột của Chủ sở hữu.
- Khách thuê có đăng ký tạm trú, tạm vắng theo quy định.

ResidentGPT không xác nhận quan hệ nhân thân, tình trạng cư trú hoặc tư cách
của cá nhân cụ thể; trường hợp cần xét duyệt phải chuyển BQL.

### CARD-RES-ELIG-02 — Đối tượng tại Shop, Shophouse hoặc Thương mại dịch vụ

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: general_eligibility_rule_no_personal_status_decision; scope: resident_card_commercial_property -->

Đối tượng được nguồn liệt kê là Chủ sở hữu hoặc người được ủy quyền hợp lệ.
Việc xác nhận giấy ủy quyền phải do BQL thực hiện.

## Hạn mức Thẻ Cư dân

### CARD-LIMIT-01A — Nhóm được nguồn ghi hạn mức 04 thẻ

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: source_ambiguous_for_two_bedroom_escalate_when_needed; scope: resident_card_limit -->

Nguồn ghi nguyên nhóm: “Căn hộ 01 phòng ngủ bao gồm căn 1+1, 2 phòng ngủ,
studio” có hạn mức **04 thẻ/Căn**.

Cách diễn đạt “01 phòng ngủ bao gồm … 2 phòng ngủ” có dấu hiệu không nhất
quán. Đối với câu hỏi về Căn hộ 02 phòng ngủ thông thường hoặc khi cần xác
định cách hiểu của nhóm này, ResidentGPT phải nêu rằng nguồn chưa rõ và
chuyển BQL xác nhận, không tự sửa câu chữ.

### CARD-LIMIT-01B — Căn hộ 02 phòng ngủ +1

<!-- intent_ids: [I-01]; risk_level: low; answer_policy: normal_faq; scope: resident_card_limit -->

Căn hộ 02 phòng ngủ +1 có hạn mức **05 Thẻ Cư dân/Căn**.

### CARD-LIMIT-01C — Căn hộ 03 phòng ngủ

<!-- intent_ids: [I-01]; risk_level: low; answer_policy: normal_faq; scope: resident_card_limit -->

Căn hộ 03 phòng ngủ có hạn mức **06 Thẻ Cư dân/Căn**.

### CARD-LIMIT-01D — Biệt thự, Shophouse, Thương mại dịch vụ và Căn hộ 04 phòng ngủ

<!-- intent_ids: [I-01]; risk_level: low; answer_policy: normal_faq; scope: resident_card_limit -->

Biệt thự, Shophouse, Thương mại dịch vụ và Căn hộ 04 phòng ngủ có hạn mức
**08 Thẻ Cư dân/Căn**.

### CARD-RES-FEE-01 — Phí cấp mới Thẻ Cư dân

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: published_fee_with_limit_caveat; scope: resident_card -->

Thẻ Cư dân được cấp mới **miễn phí trong hạn mức**. Nguồn không nêu chính
sách cấp vượt hạn mức; ResidentGPT không được suy đoán và phải đề xuất liên
hệ BQL.

### CARD-RES-FEE-02 — Phí cấp lại hoặc đổi Thẻ Cư dân

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: published_fee_then_bql_for_payment; scope: resident_card -->

Phí cấp lại hoặc đổi Thẻ Cư dân là **110.000 đồng/thẻ**, đã bao gồm 10%
thuế GTGT.

## Thẻ Ra vào

### CARD-ACCESS-FEATURE-01 — Chức năng Thẻ Ra vào

<!-- intent_ids: [I-01]; risk_level: low; answer_policy: normal_faq; scope: access_card -->

Thẻ Ra vào được dùng để ra vào Tòa nhà.

### CARD-ACCESS-ELIG-01 — Đối tượng được cấp Thẻ Ra vào

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: general_eligibility_rule_no_personal_status_decision; scope: access_card -->

Nguồn liệt kê các đối tượng:

- Chủ sở hữu đã cho thuê Căn hộ, Biệt thự, Shophouse, Shop hoặc diện tích
  Thương mại dịch vụ.
- Người thân, người giúp việc hoặc lái xe của Chủ sở hữu.

BQL là bên xác nhận tư cách và phê duyệt trường hợp cụ thể.

### CARD-ACCESS-LIMIT-01 — Hạn mức Thẻ Ra vào

<!-- intent_ids: [I-01]; risk_level: low; answer_policy: normal_faq; scope: access_card -->

Hạn mức tối đa là **03 Thẻ Ra vào/Căn**.

### CARD-ACCESS-FEE-01 — Phí cấp mới Thẻ Ra vào

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: published_fee_then_bql_for_payment; scope: access_card -->

Phí cấp mới Thẻ Ra vào là **55.000 đồng/thẻ**, đã bao gồm 10% thuế GTGT.

### CARD-ACCESS-FEE-02 — Phí cấp lại hoặc đổi Thẻ Ra vào

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: published_fee_then_bql_for_payment; scope: access_card -->

Phí cấp lại hoặc đổi Thẻ Ra vào là **110.000 đồng/thẻ**, đã bao gồm 10%
thuế GTGT.

## Thẻ gửi xe Cư dân

### CARD-PARK-FEATURE-01 — Chức năng Thẻ gửi xe

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: normal_faq; scope: resident_parking_card -->

Thẻ gửi xe Cư dân được dùng cho dịch vụ trông giữ xe theo thuê bao tháng
tại khu vực trông giữ xe, theo quy hoạch và chính sách của Khu Đô thị.

Thuê bao tháng của xe máy đã được đăng ký và phê duyệt theo quy định sẽ
được tích hợp vào Thẻ Cư dân.

### CARD-PARK-ELIG-01 — Điều kiện cấp Thẻ gửi xe

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: general_eligibility_then_bql_approval; scope: resident_parking_card -->

Thẻ gửi xe được cấp cho trường hợp đăng ký dịch vụ trông giữ xe và được
BQL phê duyệt theo quy định. ResidentGPT không tự xác nhận hồ sơ hoặc quyền
được cấp thẻ.

### CARD-PARK-LIMIT-01 — Số lượng Thẻ gửi xe

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: bql_approval_required; scope: resident_parking_card -->

Số lượng Thẻ gửi xe phụ thuộc số lượng dịch vụ trông giữ xe được đăng ký
và BQL phê duyệt. Nguồn không công bố hạn mức cố định.

### CARD-PARK-FEE-01 — Phí cấp mới thẻ xe ô tô hoặc xe đạp

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_then_bql_for_payment; scope: resident_parking_card -->

Phí cấp mới:

- Thẻ xe ô tô: **55.000 đồng/thẻ**.
- Thẻ xe đạp: **55.000 đồng/thẻ**.

Các mức trên đã bao gồm 10% thuế GTGT.

### CARD-PARK-FEE-02 — Phí cấp lại hoặc đổi thẻ xe ô tô hoặc xe đạp

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_then_bql_for_payment; scope: resident_parking_card -->

Phí cấp lại hoặc đổi:

- Thẻ xe ô tô: **110.000 đồng/thẻ**.
- Thẻ xe đạp: **110.000 đồng/thẻ**.

Các mức trên đã bao gồm 10% thuế GTGT.

### CARD-PARK-FEE-03 — Khoảng trống về phí thẻ xe máy

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: do_not_infer_missing_fee_escalate_to_bql; scope: resident_parking_card_motorbike -->

Nguồn đề cập xe máy trong tên nhóm Thẻ gửi xe và nêu thuê bao xe máy có
thể được tích hợp vào Thẻ Cư dân, nhưng **không cung cấp mức phí cấp mới,
cấp lại hoặc đổi thẻ xe máy**.

ResidentGPT không được áp dụng mức phí của xe đạp hoặc xe ô tô cho xe máy;
phải chuyển BQL xác nhận.

## Đăng ký và quản lý thẻ

### CARD-PROCESS-01 — Đăng ký trực tuyến

<!-- intent_ids: [I-01, I-02]; risk_level: medium; answer_policy: official_app_registration_without_collecting_personal_data; scope: all_card_types -->

Cư dân đăng ký thẻ trực tuyến trên ứng dụng **Vinhomes Resident**.

Nguồn không cung cấp danh mục hồ sơ, các bước thao tác, thời gian xử lý
hoặc tiêu chí phê duyệt. ResidentGPT không yêu cầu người dùng cung cấp tài
khoản, mật khẩu, số giấy tờ hoặc hồ sơ cá nhân trong MVP.

### CARD-PROCESS-02 — Thu hồi Thẻ Ra vào cũ

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: general_process_then_bql_for_handover; scope: access_card -->

Để được cấp các loại thẻ, Cư dân phải gửi lại BQL những Thẻ Ra vào đã được
cấp tại thời điểm ký Hợp đồng mua bán và/hoặc trước khi nhận bàn giao Căn
hộ hoặc Biệt thự.

### CARD-PROCESS-03 — Mất hoặc thất lạc Thẻ Ra vào cũ

<!-- intent_ids: [I-01]; risk_level: medium; answer_policy: published_fee_then_bql_for_payment; scope: access_card -->

Nếu Thẻ Ra vào cũ phải thu hồi bị mất hoặc thất lạc, nguồn nêu mức
**110.000 đồng/thẻ**, đã bao gồm 10% thuế GTGT.

### CARD-SECURITY-01 — Báo mất, hủy hoặc thu hồi thẻ

<!-- intent_ids: [I-01, I-02]; risk_level: high; answer_policy: immediate_report_to_bql_no_identity_collection; scope: all_card_types -->

Khi không còn nhu cầu sử dụng hoặc bị mất Thẻ Cư dân, Thẻ Ra vào hay Thẻ
gửi xe, người được cấp thẻ hoặc Chủ sở hữu phải báo ngay cho BQL để thu hồi
hoặc hủy thẻ, phục vụ kiểm soát an ninh và an toàn.

ResidentGPT không thực hiện khóa thẻ và không thu thập số thẻ hoặc dữ liệu
định danh; phải hướng dẫn người dùng báo BQL qua kênh chính thức.

## Khoảng trống của nguồn

Nguồn chưa cung cấp:

- Hồ sơ cần nộp cho từng loại thẻ.
- Các bước chi tiết trên ứng dụng Vinhomes Resident.
- Thời gian xử lý hoặc thời hạn sử dụng thẻ.
- Quy trình gia hạn thẻ.
- Chính sách cấp Thẻ Cư dân vượt hạn mức.
- Mức phí cấp mới, cấp lại hoặc đổi đối với thẻ/thuê bao xe máy.
- Cách xử lý khi ứng dụng không hoạt động hoặc hồ sơ bị từ chối.
- Hotline hoặc email hỗ trợ trong chính tài liệu này.

ResidentGPT không được tự điền các khoảng trống; phải đề xuất liên hệ BQL.
