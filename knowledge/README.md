# ResidentGPT Knowledge Source Pack

Đây là bộ nguồn sự thật có kiểm soát dùng cho ResidentGPT MVP. Knowledge
Source Pack tách rõ tài liệu gốc, phiên bản Markdown chuẩn hóa, trạng thái
phê duyệt và dữ liệu được sinh cho retrieval.

Baseline dữ liệu dùng cho MVP đã được khóa tại
[`docs/MVP_DATA_SCOPE_LOCK.md`](../docs/MVP_DATA_SCOPE_LOCK.md) ở revision
`1.18`, có hiệu lực từ ngày 20/09/2026.

## Cấu trúc

```text
knowledge/
├── README.md
├── manifest.yaml
├── intent_source_map.yaml
├── raw/
│   ├── OCP1-BUILDING-RULES-001.txt
│   ├── OCP1-PARKING-RULES-001.txt
│   ├── OCP1-COMMERCIAL-AREA-RULES-001.txt
│   ├── OCP1-VILLA-HOUSING-RULES-001.txt
│   ├── OCP1-VILLA-BUSINESS-RULES-001.txt
│   ├── OCP1-POOL-RULES-001.txt
│   ├── OCP1-KAYAK-DOCK-RULES-001.txt
│   ├── OCP1-SPORTS-COMPLEX-RULES-001.txt
│   ├── OCP1-CHILDREN-PLAYGROUND-RULES-001.txt
│   ├── OCP1-OUTDOOR-GYM-RULES-001.txt
│   ├── OCP1-SALTWATER-LAKE-RULES-001.txt
│   ├── OCP1-BBQ-GARDEN-RULES-001.txt
│   ├── OCP1-FISHING-DECK-RULES-001.txt
│   ├── OCP1-APARTMENT-CONSTRUCTION-GUIDE-001.txt
│   ├── OCP1-APARTMENT-CONSTRUCTION-RULES-001.txt
│   ├── OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001.txt
│   ├── OCP1-MOVE-IN-OUT-GUIDE-001.txt
│   ├── OCP1-BQL-OFFICE-DIRECTORY-001.txt
│   ├── OCP1-PARKING-FEE-SCHEDULE-001.txt
│   ├── OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001.txt
│   └── VINHOMES-CUSTOMER-REQUEST-HANDLING-001.txt
├── canonical/
│   ├── OCP1-BUILDING-RULES-001.md
│   ├── OCP1-PARKING-RULES-001.md
│   ├── OCP1-COMMERCIAL-AREA-RULES-001.md
│   ├── OCP1-VILLA-HOUSING-RULES-001.md
│   ├── OCP1-VILLA-BUSINESS-RULES-001.md
│   ├── OCP1-POOL-RULES-001.md
│   ├── OCP1-KAYAK-DOCK-RULES-001.md
│   ├── OCP1-SPORTS-COMPLEX-RULES-001.md
│   ├── OCP1-CHILDREN-PLAYGROUND-RULES-001.md
│   ├── OCP1-OUTDOOR-GYM-RULES-001.md
│   ├── OCP1-SALTWATER-LAKE-RULES-001.md
│   ├── OCP1-BBQ-GARDEN-RULES-001.md
│   ├── OCP1-FISHING-DECK-RULES-001.md
│   ├── OCP1-APARTMENT-CONSTRUCTION-GUIDE-001.md
│   ├── OCP1-APARTMENT-CONSTRUCTION-RULES-001.md
│   ├── OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001.md
│   ├── OCP1-MOVE-IN-OUT-GUIDE-001.md
│   ├── OCP1-BQL-OFFICE-DIRECTORY-001.md
│   ├── OCP1-PARKING-FEE-SCHEDULE-001.md
│   ├── OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001.md
│   └── VINHOMES-CUSTOMER-REQUEST-HANDLING-001.md
├── processed/
│   └── README.md
└── review/
    └── review_log.md
```

- `raw/`: nội dung nguồn được lưu nguyên văn để đối chiếu. Không sửa trực
  tiếp sau khi capture.
- `canonical/`: Markdown đã chuẩn hóa về cấu trúc, section ID và metadata.
- `manifest.yaml`: danh sách tài liệu, trạng thái, hiệu lực và quyền sử dụng.
- `intent_source_map.yaml`: ánh xạ intent MVP với section có thể sử dụng và
  khoảng trống tri thức.
- `processed/`: output do ingestion sinh ra; không phải nguồn sự thật.
- `review/`: bằng chứng kiểm tra và quyết định phê duyệt.

## Quy tắc nguồn được phép dùng cho RAG

Một tài liệu chỉ được index khi đồng thời thỏa mãn:

1. `status: Approved`.
2. `effective_status: Current` hoặc có khoảng ngày hiệu lực hợp lệ.
3. `allowed_for_rag: true`.
4. Phạm vi tài sản khớp với câu hỏi.
5. Có thể truy vết về tài liệu và section nguồn.
6. Không chứa dữ liệu cá nhân của cư dân.

`property_scope`, `area_type` và `audience` phải khớp với bối cảnh câu hỏi.
Ví dụ, `OCP1-COMMERCIAL-AREA-RULES-001` chỉ dùng cho Lô TM/Khu Thương mại
dịch vụ; không được dùng để trả lời câu hỏi về căn hộ hoặc cư dân nói chung
khi người dùng chưa xác định bối cảnh thương mại.

Tương tự, `OCP1-VILLA-HOUSING-RULES-001` chỉ dùng cho Khu Biệt Thự/Khu Nhà
Ở; không được áp dụng cho căn hộ chung cư hoặc Lô TM khi phạm vi không khớp.

`OCP1-VILLA-BUSINESS-RULES-001` yêu cầu khớp đồng thời phạm vi Khu Biệt
Thự/Khu Nhà Ở và bối cảnh hoạt động kinh doanh. Không dùng source này cho
Lô TM hoặc câu hỏi sinh hoạt không liên quan kinh doanh.

`OCP1-POOL-RULES-001` chỉ dùng cho bể bơi thuộc Khu Căn hộ Vinhomes Ocean
Park 1. Các quy tắc sức khỏe trong nguồn không cho phép AI chẩn đoán hoặc
đánh giá điều kiện sức khỏe cá nhân; tình huống khẩn cấp phải chuyển nhân
viên cứu hộ/BQL.

`OCP1-KAYAK-DOCK-RULES-001` chỉ dùng cho Bến Thuyền Kayak. Section
`KAYAK-II-05` nhắc đến Vườn Nướng nên bị loại khỏi RAG cho đến khi phạm vi
được Knowledge Owner/BQL xác nhận.

`OCP1-SPORTS-COMPLEX-RULES-001` chỉ dùng cho Khu phức hợp Thể thao. Dữ
liệu Thẻ Cư dân và lịch đặt thật không được thu thập; quyết định từ chối
phục vụ hoặc ngừng dịch vụ phải do BQL xử lý.

`OCP1-CHILDREN-PLAYGROUND-RULES-001` chỉ dùng cho Sân chơi trẻ em. Quy định
người lớn đi kèm trẻ dưới 12 tuổi là safety-critical; tai nạn, trách nhiệm
và xử lý vi phạm phải chuyển BQL.

`OCP1-OUTDOOR-GYM-RULES-001` chỉ dùng cho Khu Gym ngoài trời, không dùng
cho Phức hợp Thể thao hoặc gym trong nhà. Tai nạn, trách nhiệm và xử lý vi
phạm phải chuyển BQL.

`OCP1-SALTWATER-LAKE-RULES-001` chỉ dùng cho Biển hồ nước mặn, không dùng
cho Bến Thuyền Kayak hoặc bể bơi. Trẻ dưới 15 tuổi phải có người giám sát
và không được trực tiếp lái/chèo thuyền; tai nạn và quyết định hoàn chi phí
phải chuyển BQL.

`OCP1-BBQ-GARDEN-RULES-001` chỉ dùng cho Vườn Nướng BBQ. Các câu hỏi về
nhóm 07–08 người phải chuyển BQL do nguồn mâu thuẫn giữa phần phụ thu/sức
chứa và chế tài số 5; `BBQ-SAN-05` bị loại khỏi RAG.

`OCP1-FISHING-DECK-RULES-001` chỉ dùng cho Sàn Câu cá. Trẻ dưới 12 tuổi
không được vào khu vực; dữ liệu Thẻ và lịch đặt thật không được thu thập;
quyết định chế tài phải chuyển BQL.

`OCP1-APARTMENT-CONSTRUCTION-GUIDE-001` chỉ dùng cho hồ sơ cải tạo, sửa
chữa Căn hộ. Khi chưa rõ loại hình bất động sản, hệ thống phải hỏi lại
trước khi retrieval. Hai section nhắc Shop/Shophouse bị loại khỏi RAG;
không được thu thập CMND, ảnh công nhân hoặc hồ sơ cá nhân qua MVP. Quyết
định phê duyệt, nghiệm thu, khấu trừ hay hoàn tiền đặt cọc phải do BQL xử
lý.

`OCP1-APARTMENT-CONSTRUCTION-RULES-001` chỉ dùng cho hoạt động thi công,
cải tạo và vận chuyển thuộc Khu Căn hộ theo định nghĩa của chính nguồn.
Không dùng cho Biệt thự hoặc Nhà liền kề. Thông tin tài khoản ngân hàng và
mốc ngày chưa thống nhất bị loại khỏi RAG; toàn bộ quyết định bồi thường,
khấu trừ, xử phạt, đình chỉ hoặc trục xuất phải chuyển BQL. Lịch tại
`APTC-TIME-03` sử dụng bản sửa của người cung cấp: công việc ít bụi, ít
hoặc không gây ồn được thực hiện 08:30–11:30 và 14:00–17:30 cả Thứ Bảy,
Chủ nhật và ngày lễ.

`OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001` tách rõ Thẻ Cư dân, Thẻ Ra vào và
Thẻ gửi xe Cư dân. Phí cấp thẻ không được dùng như phí dịch vụ trông giữ
xe hằng tháng. Không thu thập tài khoản ứng dụng, số thẻ hoặc dữ liệu định
danh trong MVP. Câu chữ về nhóm Căn hộ được cấp 04 thẻ và khoảng trống phí
thẻ xe máy phải chuyển BQL khi câu hỏi rơi đúng trường hợp chưa rõ.

`OCP1-MOVE-IN-OUT-GUIDE-001` dùng cho đăng ký và vận chuyển đồ đạc sinh
hoạt ra/vào các Tòa nhà được liệt kê. Khi chưa rõ người dùng đang chuyển
đồ sinh hoạt hay vật tư/rác thi công, hệ thống phải hỏi lại trước khi chọn
khung giờ. Không thu thập mã QR hoặc giấy đăng ký thật; giới hạn xe
3,5–5 tấn cần BQL/An ninh xác nhận cho từng khu vực. Yêu cầu bồi thường hư
hỏng phải chuyển BQL.

`OCP1-BQL-OFFICE-DIRECTORY-001` là nguồn dùng chung được ưu tiên cho địa
chỉ và giờ làm việc của Quầy Lễ tân/Văn phòng BQL. Hệ thống phải hỏi cụm
hoặc Khối nhà khi bối cảnh chưa rõ; không suy đoán lịch Lễ, Tết hoặc địa
điểm cho Tòa nhà không có trong danh sách. Hotline và email không xuất hiện
trong source này nên không được tự ghép vào câu trả lời từ tài liệu này.

`OCP1-PARKING-FEE-SCHEDULE-001` là nguồn phí dịch vụ trông giữ xe và sạc
xe hai bánh, không phải phí cấp Thẻ gửi xe. Retrieval phải khớp địa điểm,
hình thức gửi tháng/vãng lai, loại xe và khung giờ; đặc biệt không trộn mức
`00:00–05:59` của hầm Tòa nhà với Nhà xe nổi. Hệ thống không tự tính hóa
đơn. Điều khoản xử lý xe vãng lai quá 30 ngày liên quan quyền sở hữu và
phải chuyển BQL.

`OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001` dùng cho kênh thanh toán, lịch thông
báo và hạn thanh toán phí quản lý, phí gửi xe hoặc khoản phát sinh hằng
tháng. Thông tin tài khoản ngân hàng bị loại khỏi RAG; hệ thống không thu
thập thông tin đăng nhập, OTP, mã căn, hóa đơn hoặc chứng từ giao dịch.
Yêu cầu xác nhận công nợ, giao dịch, ngừng dịch vụ hoặc chế tài phải chuyển
BQL.

`VINHOMES-CUSTOMER-REQUEST-HANDLING-001` là nguồn quy trình cấp Công ty,
áp dụng cho tất cả dự án và bộ phận thuộc Công ty Cổ phần Vinhomes, đồng
thời dùng chung cho cả năm intent của ResidentGPT tại Vinhomes Ocean Park.
Hệ thống chỉ được giải thích kênh tiếp nhận, trình tự và SLA chung; không
được tự phân loại một case là đơn giản/phức tạp, hứa thời hạn xử lý, quyết
định kết quả hoặc mô tả nội dung CNPQ chưa có trong nguồn. Sự vụ đã khởi
kiện, tranh chấp, xác định lỗi/trách nhiệm hoặc bồi thường phải chuyển
BQL/Pháp chế. Tình huống liên quan an toàn tính mạng phải được chuyển xử lý
khẩn cấp ngay, không đi theo flow FAQ thông thường. MVP không thu thập hồ
sơ khiếu nại, chứng cứ pháp lý, dữ liệu định danh hoặc hồ sơ sức khỏe.

Nếu không có nguồn đủ điều kiện, ResidentGPT không được tạo substantive
answer draft và phải chuyển sang safe fallback/manual handling theo PRD.

## Hard safety rule

Mọi câu hỏi yêu cầu xác định bồi thường, giải quyết tranh chấp, diễn giải
pháp lý, xác định trách nhiệm/lỗi hoặc quyết định xử phạt đều bị loại khỏi
answer generation, kể cả khi có tài liệu nguồn. Hệ thống phải:

1. Không tạo substantive answer draft.
2. Hiển thị rằng trường hợp cần Ban Quản lý xem xét.
3. Đề xuất chuyển case sang BQL.
4. Ghi reason code `legal_or_compensation_escalation`.

Safe response mẫu: “Yêu cầu này liên quan đến bồi thường, tranh chấp,
trách nhiệm hoặc vấn đề pháp lý nên ResidentGPT không thể đưa ra câu trả
lời. Vui lòng chuyển trường hợp cho Ban Quản lý để được xem xét.”

## Quy trình cập nhật

1. Lưu nguồn mới vào `raw/` với một `document_id` ổn định.
2. Tạo hoặc cập nhật bản canonical mà không ghi đè lịch sử nguồn.
3. Ghi thay đổi vào `review/review_log.md`.
4. Xác nhận owner, phạm vi, trạng thái và hiệu lực.
5. Cập nhật `manifest.yaml` và `intent_source_map.yaml`.
6. Chạy lại ingestion để sinh dữ liệu trong `processed/`.

Khi có văn bản mới thay thế, không xóa tài liệu cũ. Đặt tài liệu cũ thành
`Deprecated` hoặc `Expired`, điền `superseded_by`, rồi tạo document/version
mới.
