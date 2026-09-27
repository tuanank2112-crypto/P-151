---
document_id: OCP1-PARKING-FEE-SCHEDULE-001
title: Phí trông giữ xe tại Khu Đô thị Vinhomes Ocean Park
property_id: VINHOMES_OCEAN_PARK
property_scope: Hầm gửi xe các Tòa nhà và các Nhà xe nổi được liệt kê tại Khu Đô thị Vinhomes Ocean Park
area_type: parking_facilities
service_type: vehicle_parking_and_two_wheel_ev_charging
audience: residents_and_casual_parking_customers
category: parking_fee_schedule
source_owner: Ban Quản lý Khu Đô thị Vinhomes Ocean Park
source_type: Official fee schedule transcribed by resident
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
contains_resident_pii: false
contains_health_safety_rules: false
contains_financial_information: true
contains_public_business_contact: false
related_documents:
  - OCP1-PARKING-RULES-001
  - OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001
raw_source: ../raw/OCP1-PARKING-FEE-SCHEDULE-001.txt
normalized_at: 2026-09-19
review_log: ../review/review_log.md
---

# Phí trông giữ xe tại Khu Đô thị Vinhomes Ocean Park

> **Giới hạn phạm vi:** Đây là biểu phí **dịch vụ trông giữ xe và sạc xe
> hai bánh**, không phải phí cấp mới, cấp lại hoặc đổi Thẻ gửi xe. Mức phí
> phải được chọn đúng địa điểm, loại xe, hình thức gửi theo tháng/vãng lai
> và khung giờ.

Tài liệu được ban hành ngày **22/07/2026**. Người cung cấp xác nhận nguồn
được lấy từ kênh nội quy chính thức trên ứng dụng Vinhomes, là phiên bản
mới nhất, đang có hiệu lực và được phép sử dụng cho MVP.

## Quy ước chung

### PARKFEE-00A — Đơn vị tiền và thuế GTGT

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_general_rule; scope: all_listed_parking_facilities -->

Tất cả mức tiền trong tài liệu có đơn vị **đồng Việt Nam (VNĐ)** và đã bao
gồm VAT.

## I. Hầm gửi xe các Tòa nhà

### PARKFEE-BSM-MONTH-01 — Phí tháng dành cho Cư dân

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_then_bql_for_billing; scope: building_basement_monthly_parking -->

Mức phí tháng tại hầm gửi xe các Tòa nhà:

- Xe ô tô: **1.227.273 đồng/tháng**.
- Xe máy hoặc xe máy điện: **44.182 đồng/tháng**.
- Xe đạp hoặc xe đạp điện: **24.545 đồng/tháng**.
- Phí sạc xe máy hoặc xe đạp điện: **162.000 đồng/tháng**.

ResidentGPT chỉ được nêu mức công bố; việc xác nhận quyền đăng ký, kỳ tính
phí và hóa đơn cụ thể phải do BQL xử lý.

### PARKFEE-BSM-CASUAL-01 — Phí vãng lai từ 06:00 đến 17:59

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_no_custom_billing_calculation; scope: building_basement_casual_parking -->

Trong khung **06:00–17:59**:

- Xe ô tô: **10.000 đồng/lượt/giờ** theo cách ghi của nguồn.
- Xe máy hoặc xe máy điện: **2.000 đồng/lượt**.
- Sạc xe máy hoặc xe đạp điện: **1.000 đồng/lượt**.

### PARKFEE-BSM-CASUAL-02 — Phí vãng lai từ 18:00 đến 23:59

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_no_custom_billing_calculation; scope: building_basement_casual_parking -->

Trong khung **18:00–23:59**:

- Xe ô tô: **10.000 đồng/lượt/giờ** theo cách ghi của nguồn.
- Xe máy hoặc xe máy điện: **3.000 đồng/lượt**.
- Sạc xe máy hoặc xe đạp điện: **2.000 đồng/lượt**.

### PARKFEE-BSM-CASUAL-03 — Phí vượt khung từ 00:00 đến 05:59

<!-- intent_ids: [I-02]; risk_level: high; answer_policy: published_fee_no_custom_billing_calculation; scope: building_basement_casual_parking -->

Mức phí vãng lai vượt khung tại hầm Tòa nhà trong khoảng
**00:00–05:59**:

- Xe ô tô: **100.000 đồng/lượt**.
- Xe máy hoặc xe máy điện: **30.000 đồng/lượt**.
- Sạc xe máy hoặc xe đạp điện: **10.000 đồng/lượt**.

Không áp dụng mức này cho Nhà xe nổi; Nhà xe nổi có biểu phí riêng.

## II. Các Nhà xe nổi

### PARKFEE-FLT-MONTH-01 — Đại Dương, Hải Đăng 1, Lý Thánh Tông và Hải Đăng 2

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_then_bql_for_billing; scope: listed_standard_floating_parking -->

Mức phí tháng tại Nhà xe nổi Đại Dương, Hải Đăng 1, Lý Thánh Tông và Hải
Đăng 2:

- Xe ô tô: **1.227.273 đồng/tháng**.
- Xe máy hoặc xe máy điện: **44.182 đồng/tháng**.
- Xe đạp hoặc xe đạp điện: **24.545 đồng/tháng**.
- Phí sạc xe máy hoặc xe đạp điện: **162.000 đồng/tháng**.

### PARKFEE-TECHNO-MONTH-01 — Hầm xe Tòa nhà Techno Park

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_with_time_restriction_then_bql_confirmation; scope: techno_park_monthly_parking -->

Mức phí tháng dành cho xe ô tô tại hầm xe Tòa nhà Techno Park là
**613.636 đồng/tháng**, áp dụng trong thời gian:

- Thứ Hai đến Thứ Bảy: từ **18:00 đến 07:00 ngày hôm sau**.
- Chủ nhật: cả ngày.

Nguồn ghi không áp dụng tại địa điểm này cho xe máy/xe máy điện, xe
đạp/xe đạp điện và phí sạc xe hai bánh.

### PARKFEE-HAIAU3-MONTH-01 — Nhà xe nổi Hải Âu 3

<!-- intent_ids: [I-02]; risk_level: high; answer_policy: promotional_fee_then_bql_freshness_confirmation; scope: hai_au_3_monthly_parking -->

Mức phí tháng tại Nhà xe nổi Hải Âu 3:

- Xe ô tô: **600.000 đồng/tháng**, là đơn giá ưu đãi từ **01/08/2025** đến
  khi có thông báo mới từ BQL.
- Xe máy hoặc xe máy điện: **44.182 đồng/tháng**.
- Xe đạp hoặc xe đạp điện: **24.545 đồng/tháng**.
- Phí sạc xe máy hoặc xe đạp điện: **162.000 đồng/tháng**.

Trước khi áp dụng mức ưu đãi ô tô, người dùng phải xác nhận với BQL rằng
chưa có thông báo mới.

### PARKFEE-FLT-CASUAL-01 — Phí vãng lai từ 06:00 đến 17:59

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_no_custom_billing_calculation; scope: floating_parking_casual -->

Tại các Nhà xe nổi, trong khung **06:00–17:59**:

- Xe ô tô: **10.000 đồng/lượt/giờ** theo cách ghi của nguồn.
- Xe máy hoặc xe máy điện: **2.000 đồng/lượt**.
- Sạc xe máy hoặc xe đạp điện: **1.000 đồng/lượt**.

### PARKFEE-FLT-CASUAL-02 — Phí vãng lai từ 18:00 đến 23:59

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: published_fee_no_custom_billing_calculation; scope: floating_parking_casual -->

Tại các Nhà xe nổi, trong khung **18:00–23:59**:

- Xe ô tô: **10.000 đồng/lượt/giờ** theo cách ghi của nguồn.
- Xe máy hoặc xe máy điện: **3.000 đồng/lượt**.
- Sạc xe máy hoặc xe đạp điện: **2.000 đồng/lượt**.

### PARKFEE-FLT-CASUAL-03 — Phí vãng lai từ 00:00 đến 05:59

<!-- intent_ids: [I-02]; risk_level: high; answer_policy: published_fee_no_custom_billing_calculation; scope: floating_parking_casual -->

Tại các Nhà xe nổi, trong khung **00:00–05:59**:

- Xe ô tô: **30.000 đồng/lượt/giờ** theo tiêu đề đơn vị của bảng nguồn.
- Xe máy hoặc xe máy điện: **10.000 đồng/lượt**.
- Sạc xe máy hoặc xe đạp điện: **10.000 đồng/lượt**, nếu có.

Không áp dụng mức này cho hầm gửi xe Tòa nhà.

## III. Đăng ký và lưu ý

### PARKFEE-REG-01 — Đăng ký gửi xe thuê bao tháng

<!-- intent_ids: [I-02]; risk_level: medium; answer_policy: official_channels_without_collecting_personal_data; scope: monthly_parking_registration -->

Cư dân đăng ký gửi xe thuê bao tháng bằng một trong hai hình thức:

- Qua ứng dụng **Vinhomes Resident**.
- Trực tiếp tại Quầy Lễ tân/Văn phòng BQL.

Nguồn không cung cấp thành phần hồ sơ, thời gian phê duyệt hoặc các bước
trên ứng dụng. ResidentGPT không thu thập tài khoản, mật khẩu, biển số,
giấy tờ xe hoặc dữ liệu cá nhân trong MVP.

### PARKFEE-CASUAL-30D-01 — Thời hạn tối đa 30 ngày và xử lý tài sản

<!-- intent_ids: [I-02]; risk_level: critical; answer_policy: do_not_answer_escalate_to_bql; scope: casual_parking -->

Nguồn nêu xe vãng lai chỉ được nhận trông giữ tối đa **30 ngày**. Nguồn
đồng thời mô tả việc coi xe và tài sản trên xe là tài sản bị từ bỏ sau thời
hạn này, cùng quyền thanh lý, tiêu hủy hoặc xử lý của Đơn vị Trông giữ xe.

ResidentGPT không được xác định quyền sở hữu, việc hết hạn, quyền xử lý tài
sản hoặc hướng dẫn thanh lý/tiêu hủy đối với trường hợp cụ thể; phải chuyển
BQL và log `legal_or_compensation_escalation`.

### PARKFEE-MONTH-BILLING-01 — Thời gian tính phí tháng

<!-- intent_ids: [I-02]; risk_level: high; answer_policy: general_billing_rule_then_bql_for_case; scope: monthly_parking_registration -->

Đối với xe gửi theo tháng, thời gian tính phí bắt đầu từ “Ngày kích hoạt”
được ghi nhận tại Đơn đăng ký và tiếp tục đến khi Cư dân đăng ký đề nghị
dừng dịch vụ, nếu có.

ResidentGPT không xác định ngày kích hoạt, ngày dừng, số tháng hoặc số tiền
phải thanh toán cho trường hợp cụ thể.

### PARKFEE-COMPLY-01 — Tuân thủ nội quy và đỗ xe

<!-- intent_ids: [I-02]; risk_level: low; answer_policy: normal_faq; scope: all_listed_parking_facilities -->

Cư dân và Khách hàng gửi xe phải tuân thủ quy định của BQL, Nội quy trông
giữ xe và đỗ xe đúng nơi quy định.

## Khoảng trống của nguồn

Nguồn chưa cung cấp:

- Hồ sơ và thời gian phê duyệt đăng ký thuê bao tháng.
- Cách thay đổi hoặc hủy đăng ký trên ứng dụng.
- Quy tắc làm tròn giờ hoặc công thức tính tổng tiền đối với ô tô vãng lai
  có đơn vị “lượt/giờ”.
- Phí vãng lai dành riêng cho xe đạp hoặc xe đạp điện.
- Phí sạc ô tô điện.
- Hotline hoặc email hỗ trợ trong chính tài liệu này.

ResidentGPT không tự tính hóa đơn hoặc suy diễn mức phí còn thiếu; phải đề
xuất liên hệ BQL.
