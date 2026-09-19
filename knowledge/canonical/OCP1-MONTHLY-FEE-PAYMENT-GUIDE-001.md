---
document_id: OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001
title: Hướng dẫn thanh toán các khoản phí hàng tháng
property_id: VINHOMES_OCEAN_PARK
property_scope: Căn hộ và Nhà ở tại Khu Đô thị Vinhomes Ocean Park
area_type: multi_property_resident_billing
service_type: monthly_service_fee_payment
audience: owners_and_residents_responsible_for_payment
category: monthly_fee_payment_guide
source_owner: Ban Quản lý Khu Đô thị Vinhomes Ocean Park
source_type: Official payment guidance transcribed by resident
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
contains_personal_data_requirements: false
contains_financial_information: true
contains_public_business_bank_account: true
contains_public_business_contact: false
excluded_from_rag_sections:
  - MONTHPAY-BANK-02
related_sections:
  - APTC-PAY-02
raw_source: ../raw/OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001.txt
normalized_at: 2026-09-19
review_log: ../review/review_log.md
---

# Hướng dẫn thanh toán các khoản phí hàng tháng

> **Giới hạn phạm vi:** Tài liệu hướng dẫn thanh toán phí quản lý, phí gửi
> xe và các khoản phí phát sinh khác được BQL thông báo hằng tháng tại Khu
> Đô thị Vinhomes Ocean Park. Tài liệu không cung cấp mức phí cụ thể và
> không cho phép ResidentGPT tự xác định công nợ hay nghĩa vụ thanh toán của
> một Căn hộ/Nhà ở.

Tài liệu được ban hành ngày **27/02/2026**. Người cung cấp xác nhận nguồn
được lấy từ kênh nội quy chính thức trên ứng dụng Vinhomes, là phiên bản
mới nhất, đang có hiệu lực và được phép sử dụng cho MVP.

## Phạm vi khoản phí

### MONTHPAY-00A — Các khoản phí được hướng dẫn

<!-- intent_ids: [I-02, I-05]; risk_level: medium; answer_policy: general_billing_scope_only; scope: monthly_resident_billing -->

Hướng dẫn áp dụng cho các khoản phí hằng tháng như phí quản lý, phí gửi xe
và khoản phí phát sinh khác được BQL thông báo.

Mức tiền của từng khoản phải lấy từ hóa đơn hoặc thông báo chính thức;
ResidentGPT không tự tạo số tiền.

## 1. Hình thức thanh toán

### MONTHPAY-APP-01 — Thanh toán qua ứng dụng Vinhomes Resident

<!-- intent_ids: [I-02, I-05]; risk_level: medium; answer_policy: official_app_payment_without_collecting_credentials; scope: monthly_resident_billing -->

Cư dân có thể thanh toán qua tính năng **“Hóa đơn”** trên ứng dụng
**Vinhomes Resident**.

ResidentGPT không thu thập tài khoản, mật khẩu, mã OTP, thông tin thẻ ngân
hàng, ảnh hóa đơn hoặc dữ liệu giao dịch của người dùng.

### MONTHPAY-BANK-01 — Thanh toán bằng chuyển khoản ngân hàng

<!-- intent_ids: [I-02, I-05]; risk_level: high; answer_policy: payment_method_then_manual_verification; scope: monthly_resident_billing -->

Nguồn cho phép thanh toán bằng chuyển khoản ngân hàng đến tài khoản của
Công ty Cổ phần Vinhomes tại Techcombank.

Trước khi chuyển tiền, người dùng phải kiểm tra thông tin tài khoản trên
hóa đơn, ứng dụng hoặc xác minh trực tiếp với BQL qua kênh chính thức.
ResidentGPT không được tự xác nhận tài khoản nhận tiền còn chính xác tại
thời điểm giao dịch.

### MONTHPAY-BANK-02 — Thông tin tài khoản trong nguồn

<!-- intent_ids: [I-02, I-05]; risk_level: critical; answer_policy: excluded_from_rag_pending_payment_verification; scope: monthly_resident_billing -->

Nguồn có chứa tên đơn vị thụ hưởng, số tài khoản và thông tin ngân hàng.
Section này được giữ để truy vết nhưng bị loại khỏi RAG.

ResidentGPT không được hiển thị số tài khoản hoặc hướng dẫn người dùng
chuyển tiền chỉ dựa trên Knowledge Pack.

### MONTHPAY-BANK-03 — Nội dung chuyển khoản

<!-- intent_ids: [I-02, I-05]; risk_level: high; answer_policy: general_payment_memo_without_collecting_unit_data; scope: monthly_resident_billing -->

Nguồn hướng dẫn nội dung chuyển khoản theo cấu trúc:

```text
Mã căn hộ/biệt thự thanh toán phí dịch vụ kỳ tháng…/năm/…
```

Ví dụ nguồn dùng dạng mã đã che một phần: `S2.01xxxx`, kèm số tầng, mã căn
và kỳ phí.

ResidentGPT có thể mô tả cấu trúc nhưng không yêu cầu người dùng gửi mã căn
thật, ảnh giao dịch hoặc nội dung thanh toán đầy đủ vào hệ thống MVP.

## 2. Thông báo phí và thời hạn thanh toán

### MONTHPAY-NOTICE-01 — Thông báo lần 1

<!-- intent_ids: [I-02, I-05]; risk_level: low; answer_policy: normal_faq_with_holiday_caveat; scope: monthly_resident_billing -->

- Nội dung: Thông báo phí sử dụng dịch vụ, hay Debit note.
- Kênh gửi: Email và tin nhắn Zalo OA.
- Thời gian gửi: Ngày **05 hằng tháng**.
- Thời hạn thanh toán: Đến hết ngày **13 hằng tháng**.

### MONTHPAY-NOTICE-02 — Nhắc phí lần 2

<!-- intent_ids: [I-02, I-05]; risk_level: low; answer_policy: normal_faq_with_holiday_caveat; scope: monthly_resident_billing -->

Áp dụng đối với những Căn chưa thanh toán:

- Kênh gửi: Tin nhắn SMS và Zalo OA.
- Thời gian gửi: Ngày **14 hằng tháng**.
- Thời hạn thanh toán: Đến hết ngày **21 hằng tháng**.

### MONTHPAY-NOTICE-03 — Thông báo lần 3

<!-- intent_ids: [I-02, I-05]; risk_level: high; answer_policy: general_notice_schedule_no_enforcement_decision; scope: monthly_resident_billing -->

Đối với khoản phí chưa thanh toán:

- Nội dung: Yêu cầu thanh toán và thông báo ngừng dịch vụ.
- Kênh gửi: Email, SMS và Zalo OA.
- Thời gian gửi: Ngày **22 hằng tháng**.
- Thời hạn thanh toán: Đến hết ngày **29 hằng tháng**.

ResidentGPT chỉ được trình bày lịch thông báo chung, không được tuyên bố
một Căn cụ thể sẽ hoặc đã bị ngừng dịch vụ.

## 3. Lưu ý quan trọng

### MONTHPAY-CONTACT-DATA-01 — Email và số điện thoại nhận thông báo

<!-- intent_ids: [I-02, I-05]; risk_level: high; answer_policy: general_rule_without_collecting_or_displaying_personal_data; scope: monthly_resident_billing -->

Thông báo được gửi đến email và số điện thoại mà Chủ sở hữu đã đăng ký với
Chủ Đầu Tư hoặc BQL.

ResidentGPT không được hiển thị, xác nhận, thu thập hoặc cập nhật email/số
điện thoại cá nhân trong MVP. Khi cần thay đổi thông tin, phải hướng dẫn
người dùng liên hệ BQL qua kênh chính thức.

### MONTHPAY-HOLIDAY-01 — Thay đổi lịch vào ngày Lễ hoặc Tết

<!-- intent_ids: [I-02, I-05]; risk_level: medium; answer_policy: normal_faq_with_current_notice_required; scope: monthly_resident_billing -->

Thời gian thông báo và hạn thanh toán có thể thay đổi vào ngày Lễ hoặc
Tết. Khi có thay đổi, BQL sẽ gửi thông báo trước.

ResidentGPT không được suy đoán lịch thay thế nếu thông báo hiện hành chưa
có trong Knowledge Pack.

### MONTHPAY-ENF-01 — Chế tài do thanh toán không đúng hạn

<!-- intent_ids: [I-02, I-05]; risk_level: critical; answer_policy: do_not_answer_escalate_to_bql; scope: monthly_resident_billing -->

Nguồn nêu BQL có thể áp dụng chế tài theo quy định đối với Căn hộ/Nhà ở
không thực hiện nghĩa vụ thanh toán đúng kỳ hạn.

ResidentGPT không được xác định công nợ, vi phạm, loại chế tài, ngừng dịch
vụ hoặc nghĩa vụ thanh toán cho trường hợp cụ thể; phải chuyển BQL và log
`legal_or_compensation_escalation`.

### MONTHPAY-MISMATCH-01 — Đã thanh toán nhưng vẫn nhận thông báo

<!-- intent_ids: [I-02, I-05]; risk_level: high; answer_policy: contact_bql_without_collecting_transaction_data; scope: monthly_resident_billing -->

Nếu đã thanh toán nhưng vẫn nhận được thông báo phí hoặc nhắc thanh toán,
Cư dân phải liên hệ BQL để được kiểm tra và hỗ trợ.

ResidentGPT không yêu cầu người dùng gửi ảnh chuyển khoản, số tài khoản,
mã giao dịch hoặc sao kê trong MVP và không tự xác nhận khoản tiền đã được
ghi nhận.

### MONTHPAY-CHECK-01 — Kiểm tra điện thoại và email

<!-- intent_ids: [I-02, I-05]; risk_level: low; answer_policy: normal_faq; scope: monthly_resident_billing -->

Cư dân được đề nghị kiểm tra điện thoại và email trong các mốc thông báo,
đồng thời thực hiện thanh toán đúng hạn theo hóa đơn hoặc thông báo chính
thức.

## Khoảng trống của nguồn

Nguồn chưa cung cấp:

- Các bước chi tiết trong tính năng “Hóa đơn”.
- Cách thanh toán một phần hoặc xử lý khoản phí đang khiếu nại.
- Thời gian hệ thống ghi nhận giao dịch.
- Quy trình thay đổi email hoặc số điện thoại nhận thông báo.
- Loại chế tài cụ thể và điều kiện ngừng dịch vụ.
- Hotline hoặc địa chỉ email hỗ trợ cụ thể trong chính tài liệu này.

ResidentGPT không tự điền các khoảng trống, xác nhận giao dịch hay giải
quyết tranh chấp công nợ; phải đề xuất liên hệ BQL.
