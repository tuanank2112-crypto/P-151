# Knowledge Source Review Log

## REVIEW-001 — OCP1-BUILDING-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-BUILDING-RULES-001`
- **Result:** Approved for ResidentGPT MVP
- **Property scope:** Toàn bộ Vinhomes Ocean Park
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không có số thông báo
- **Effective status:** Đang có hiệu lực và là bản mới nhất
- **Superseded:** Không có văn bản mới hơn thay thế
- **Hotlines:** Được xác nhận vẫn còn sử dụng
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không phát hiện

### Validation basis

Các thông tin trên được xác nhận bởi người dùng là cư dân có quyền tiếp
cận nội dung do Ban Quản lý cung cấp. Bản raw được lưu nguyên văn để đối
chiếu. Khi có xác nhận trực tiếp từ Knowledge Owner/BQL, bổ sung người
xác nhận và bằng chứng vào review entry này mà không xóa lịch sử hiện tại.

### Normalization performed

- Chuẩn hóa dấu câu, khoảng trắng và cách viết `bất kỳ`.
- Thay ký hiệu `&` bằng `và` trong bản canonical.
- Sửa cụm lặp rõ ràng `những các hành động` thành `những hành động` mà
  không thay đổi ý nghĩa.
- Tách Điều 7 thành `RULE-007A` và `RULE-007B` vì chứa hai quy định độc lập.
- Tách Điều 10 thành `RULE-010A` và `RULE-010B` để hotline có thể được
  quản lý như dữ liệu dễ thay đổi.
- Thêm section ID, intent, risk level và answer policy; đây là curator
  metadata, không phải nội dung do BQL ban hành.

### Coverage findings

- Có coverage một phần cho `I-01`, `I-02` và `I-03`.
- Có coverage chính cho `I-05`.
- Không có coverage cho `I-04 — Chuyển đồ/thi công`; agent phải trả
  `no_relevant_document` cho đến khi có nguồn phù hợp.
- Không có thủ tục chi tiết làm thẻ cư dân, đăng ký thẻ xe, biểu phí hoặc
  giờ hoạt động tiện ích; không được suy luận các nội dung này.

### Safety decisions

- `RULE-006`, `RULE-009`, `RULE-010A` và `RULE-011` không được dùng để
  đưa ra quyết định cá nhân hoặc xử lý sự cố thay con người.
- `RULE-010B` chỉ được dùng làm thông tin liên hệ trong fallback/escalation.
- Trường hợp cụ thể về vi phạm, bồi thường, xử phạt, an ninh hoặc khẩn cấp
  phải chuyển Manual handling theo PRD.
- Câu hỏi về bồi thường, tranh chấp, trách nhiệm/lỗi, xử phạt hoặc diễn
  giải pháp lý không được tạo substantive answer draft; phải đề xuất chuyển
  BQL và log `legal_or_compensation_escalation`.

## REVIEW-002 — OCP1-PARKING-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-PARKING-RULES-001`
- **Result:** Approved for ResidentGPT MVP with high-risk handling restrictions
- **Property scope:** Vinhomes Ocean Park
- **Effective from:** 2025-10-01, stated explicitly in the supplied text
- **Issued at:** Không được cung cấp; ngày áp dụng được ghi riêng trong nguồn
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không phát hiện

### Normalization performed

- Khôi phục cấu trúc Mục I, II, III, IV và VI từ text một dòng.
- Gán section ID ổn định từ `PARK-I-01` đến `PARK-VI-01`.
- Tách các điểm a–m và các tiểu mục bồi thường thành section độc lập.
- Chuẩn hóa khoảng trắng, dấu câu, cách viết `bất kỳ`, `hằng tháng` và chữ
  hoa/thường mà không thay đổi nghĩa vụ được nêu trong nguồn.
- Chuyển tham chiếu Mục II.3 sang `PARK-II-03` khi cấu trúc tương ứng rõ
  ràng; giữ nguyên và đánh dấu các tham chiếu không xác định được.
- Thêm intent, risk level và answer policy dưới dạng curator metadata;
  đây không phải nội dung do Đơn vị TGX ban hành.

### Non-blocking source anomalies

1. Text nguồn không cung cấp ngày ban hành hoặc số thông báo; nguồn được
   xác nhận không có số phiên bản.
2. Mục III.2.(ii) có khả năng tự tham chiếu trong trường hợp xe không thể
   sửa chữa hoặc khôi phục.
3. Tham chiếu `II.1.4` không ánh xạ rõ tới một mục trong text được cung cấp.
4. Văn bản chuyển từ Mục IV sang Mục VI và không có Mục V.
5. Biểu phí, điều kiện giao dịch chung và biểu mẫu đăng ký không được đính
   kèm.

### Coverage findings

- Cung cấp coverage sâu cho `I-02 — Phương tiện/thẻ xe`, gồm quy tắc sử
  dụng bãi xe, sạc xe, Thẻ Xe, thay đổi thông tin và cấp lại Thẻ Xe.
- Không có mức phí cụ thể nên không được trả lời câu hỏi về số tiền.
- Phần bồi thường, xử lý tài sản, vi phạm và tranh chấp chỉ được dùng làm
  căn cứ để nhận diện high-risk. AI không trả lời nội dung; hệ thống phải
  đề xuất chuyển BQL và log `legal_or_compensation_escalation`.

### Approval decision and remaining restrictions

- Tài liệu đủ điều kiện để index cho MVP từ ngày review này.
- Các section có `answer_policy: do_not_answer_escalate_to_bql` chỉ được
  dùng để nhận diện high-risk và giải thích lý do chuyển BQL.
- `PARK-III-02B` và `PARK-III-02D` không được dùng để tạo kết luận về bồi
  thường cho đến khi các tham chiếu được Knowledge Owner làm rõ.
- Thiếu biểu phí không chặn các FAQ khác, nhưng mọi câu hỏi yêu cầu số tiền
  phải trả `no_relevant_document` hoặc chuyển Manual handling.

## REVIEW-003 — OCP1-COMMERCIAL-AREA-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-COMMERCIAL-AREA-RULES-001`
- **Result:** Approved for ResidentGPT MVP với giới hạn phạm vi và loại trừ phần nguồn bị thiếu
- **Property scope:** Khu Thương mại dịch vụ, Vinhomes Ocean Park
- **Area type:** `commercial_service`
- **Audience:** Chủ Sở Hữu hoặc Người Sử Dụng Lô TM
- **Issued at:** 2024-01-16
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành, nhưng không xuất hiện trong đoạn nguồn được cung cấp
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không phát hiện trong nguồn; số điện thoại liên hệ mà Chủ Sở Hữu phải đăng ký là một yêu cầu, không phải dữ liệu PII cụ thể
- **Source completeness:** `Partial`; đoạn cuối bị dừng giữa câu

### Validation basis

Các thông tin về nguồn, ngày ban hành, trạng thái hiện hành, phiên bản, văn
bản thay thế, quyền dùng cho MVP và độ mới của kênh liên hệ được người dùng
xác nhận. Bản raw được giữ nguyên để đối chiếu. Ngày ban hành không được tự
đồng nhất với ngày bắt đầu hiệu lực vì nguồn không nêu `effective_from`.

### Normalization performed

- Tách các mệnh đề nối bằng dấu chấm phẩy thành section ID ổn định từ
  `COMM-01A` đến `COMM-05B`.
- Tách quy định hành vi khỏi phần bồi hoàn/chế tài tại `COMM-01F1` và
  `COMM-01F2`, cũng như quy định bảo vệ cây xanh khỏi phần bồi hoàn tại
  `COMM-02M1` và `COMM-02M2`.
- Chuẩn hóa khoảng trắng, dấu câu và cách viết mà không thay đổi nội dung
  nghĩa vụ trong nguồn.
- Thêm intent, risk level, answer policy, phạm vi và audience dưới dạng
  curator metadata; đây không phải nội dung do BQL ban hành.
- Không thêm hotline hoặc email vào canonical vì giá trị liên hệ không xuất
  hiện trong đoạn nguồn, dù người dùng đã xác nhận chúng còn hiện hành.

### Source anomalies and exclusions

1. Nguồn kết thúc giữa câu tại cụm “Các Bên đồng”. Section
   `COMM-05-INCOMPLETE` được ghi nhận để truy vết nhưng bị loại khỏi RAG.
2. Tài liệu dẫn `Điều 2, Phụ Lục 2` để xác định mức phạt, nhưng Phụ Lục 2
   không có trong nội dung được cung cấp. AI không được suy đoán mức phạt.
3. Người dùng xác nhận đoạn `COMM-03C` về Khu Biệt Thự/Khu Nhà Ở thuộc một
   tài liệu khác, không thuộc Nội quy khu Thương mại dịch vụ. Đoạn này được
   giữ trong raw để đối chiếu nhưng bị loại hoàn toàn khỏi RAG của document
   hiện tại.
4. Nguồn không nêu ngày bắt đầu hiệu lực riêng; metadata giữ
   `effective_from: null` và `effective_status: Current` theo xác nhận.

### Scope and retrieval decision

- Tài liệu chỉ được retrieval khi câu hỏi xác định bối cảnh Lô TM/Khu
  Thương mại dịch vụ hoặc audience tương ứng.
- Không được dùng tài liệu để trả lời câu hỏi về căn hộ hoặc cư dân nói
  chung khi thiếu bối cảnh thương mại.
- Cung cấp coverage có điều kiện cho `I-02 — Phương tiện/thẻ xe` qua
  `COMM-03*` và `I-05 — Nội quy sinh hoạt` qua `COMM-01*`, `COMM-02*`,
  `COMM-04*`, `COMM-05*`.
- Không bổ sung coverage cho `I-01`, `I-03` hoặc `I-04`.

### Safety decisions

- Các section về bồi thường, tranh chấp, chuyển nhượng/hợp đồng, xác định
  trách nhiệm, chế tài, ngừng dịch vụ và xử phạt có
  `answer_policy: do_not_answer_escalate_to_bql`.
- `COMM-02N` chỉ cho phép nêu quy tắc chung; sự cố hoặc nguy cơ hiện hữu
  phải chuyển quy trình khẩn cấp/BQL.
- `COMM-02P` không cho phép ResidentGPT thu thập hoặc lưu số điện thoại thật
  của người dùng trong dữ liệu MVP.
- Mọi câu hỏi yêu cầu kết luận pháp lý, trách nhiệm, bồi thường hoặc mức
  phạt phải không sinh substantive answer, đề xuất chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-004 — OCP1-VILLA-HOUSING-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-VILLA-HOUSING-RULES-001`
- **Result:** Approved for ResidentGPT MVP với giới hạn phạm vi và loại trừ Mục 4 chưa có nội dung
- **Property scope:** Khu Biệt Thự/Khu Nhà Ở, Vinhomes Ocean Park
- **Area type:** `villa_or_house`
- **Audience:** Cư Dân, Chủ Sở Hữu hoặc người sử dụng Nhà Ở
- **Issued at:** 2024-01-16
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành, nhưng không xuất hiện trong đoạn nguồn được cung cấp
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Partial`; Mục 4 mới chỉ có tiêu đề

### Validation basis

Người dùng xác nhận tài liệu được ban hành ngày 16/01/2024. Các xác nhận
chung về nguồn chính thức, trạng thái mới nhất/đang có hiệu lực, không có
văn bản thay thế, không có số phiên bản và quyền sử dụng cho MVP tiếp tục
được áp dụng. Bản raw được giữ nguyên để đối chiếu.

### Normalization performed

- Tạo document riêng cho Khu Biệt Thự/Khu Nhà Ở, không trộn với nguồn Khu
  Thương mại dịch vụ.
- Suy ra phần “Các quy định áp dụng đối với Cư Dân” là Mục 1 vì nguồn bắt
  đầu đánh số từ Mục 2; ghi rõ đây là curator metadata.
- Tách các mệnh đề thành section ID ổn định từ `VILLA-01A` đến
  `VILLA-03B`.
- Tách hành vi bị cấm khỏi nội dung bồi thường/trách nhiệm tại
  `VILLA-01J1`/`VILLA-01J2`, `VILLA-02F1`/`VILLA-02F2` và
  `VILLA-02J1`/`VILLA-02J2`.
- Thêm intent, risk level, answer policy, phạm vi và audience dưới dạng
  curator metadata; đây không phải nội dung do BQL ban hành.

### Source gaps and exclusions

1. Mục 4 chỉ có tiêu đề “Xử lý vi phạm”. `VILLA-04-INCOMPLETE` bị loại
   khỏi RAG cho đến khi người dùng bổ sung nội dung chính thức.
2. Nguồn dẫn chiếu `Điều 10.1` nhưng đoạn được cung cấp không chứa cấu trúc
   đầy đủ của điều này. AI không được tự ánh xạ hoặc diễn giải tham chiếu.
3. Tài liệu ghi là phụ lục của Hợp đồng mua bán Nhà Ở. Mọi yêu cầu diễn
   giải nghĩa vụ hợp đồng cho trường hợp cụ thể phải chuyển BQL.
4. Nguồn không cung cấp biểu phí, thủ tục chi tiết hoặc các giá trị hotline,
   email; AI không được suy đoán.

### Scope and retrieval decision

- Chỉ retrieval khi câu hỏi xác định bối cảnh Khu Biệt Thự/Khu Nhà Ở hoặc
  đối tượng Cư Dân/Chủ Sở Hữu Nhà Ở tương ứng.
- Không áp dụng cho căn hộ chung cư hoặc Lô TM nếu phạm vi không khớp.
- Cung cấp coverage có điều kiện cho `I-01` qua `VILLA-01F`, `I-02` qua
  `VILLA-03*` và `I-05` qua `VILLA-01*`, `VILLA-02*`.
- Không bổ sung coverage cho `I-03` hoặc `I-04`.

### Safety decisions

- Các section về bồi thường, trách nhiệm, chuyển nhượng/hợp đồng hoặc xác
  định nghĩa vụ pháp lý có `answer_policy: do_not_answer_escalate_to_bql`.
- Các điều khoản phòng cháy chữa cháy và vật liệu nguy hiểm chỉ cho phép
  nêu quy tắc chung; sự cố hiện hữu phải chuyển quy trình khẩn cấp/BQL.
- `VILLA-02M` không cho phép ResidentGPT thu thập hoặc lưu số điện thoại
  thật trong dữ liệu MVP.
- Mọi câu hỏi yêu cầu kết luận pháp lý, trách nhiệm, bồi thường, tranh chấp
  hoặc mức phạt phải không sinh substantive answer, đề xuất chuyển BQL và
  log `legal_or_compensation_escalation`.

## REVIEW-005 — Completion update for OCP1-VILLA-HOUSING-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-VILLA-HOUSING-RULES-001`
- **Canonical revision:** `1.1`
- **Change:** Bổ sung đầy đủ Mục 4 “Xử lý vi phạm” do người dùng cung cấp
- **Source completeness:** `Complete`
- **Supersedes:** Quyết định loại `VILLA-04-INCOMPLETE` tại `REVIEW-004`

### Normalization and safety decision

- Thay placeholder `VILLA-04-INCOMPLETE` bằng sáu section
  `VILLA-04A`–`VILLA-04F`.
- Các section lần lượt ghi nhận biện pháp ngừng tiện ích/dịch vụ, khắc phục
  và bồi thường, yêu cầu đơn vị khác ngừng dịch vụ, phạt và khấu trừ ký
  quỹ, báo cơ quan có thẩm quyền và biện pháp khác theo pháp luật.
- Phụ Lục 2 được dẫn chiếu nhưng chưa có trong Knowledge Source Pack; AI
  không được suy đoán mức phạt hoặc điều kiện khấu trừ.
- Toàn bộ `VILLA-04*` có
  `answer_policy: do_not_answer_escalate_to_bql`. Nội dung chỉ được dùng để
  nhận diện high-risk; không dùng để quyết định biện pháp cho Cư Dân cụ
  thể.

## REVIEW-006 — Completion update for OCP1-COMMERCIAL-AREA-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-COMMERCIAL-AREA-RULES-001`
- **Canonical revision:** `1.1`
- **Change:** Bổ sung phần còn lại của Mục 5 “Điều khoản thi hành”
- **Source completeness:** `Complete`, ngoại trừ đoạn `COMM-03C` đã được xác nhận thuộc tài liệu khác và vẫn bị loại khỏi RAG
- **Supersedes:** Quyết định loại `COMM-05-INCOMPLETE` tại `REVIEW-003`

### Source separation decision

Mặc dù người dùng gửi phần bổ sung cùng Mục 4 của tài liệu Khu Biệt
Thự/Khu Nhà Ở, Mục 5 sử dụng nhất quán các thuật ngữ `Lô TM`, `Người Sử
Dụng` và `Khu Thương Mại`, đồng thời nối nguyên vẹn câu bị cắt trong raw
source Khu Thương mại. Vì vậy phần này được đưa vào
`OCP1-COMMERCIAL-AREA-RULES-001`, không đưa vào source Khu Biệt Thự/Khu
Nhà Ở.

### Normalization and safety decision

- Thay `COMM-05-INCOMPLETE` bằng `COMM-05C` về biện pháp khi Chủ Sở Hữu vi
  phạm và `COMM-05D` về sửa đổi, bổ sung Nội quy với thời hạn thông báo 15
  ngày.
- Cả hai section liên quan quyền, nghĩa vụ và hiệu lực theo thỏa thuận nên
  có `answer_policy: do_not_answer_escalate_to_bql`.
- ResidentGPT không được xác định vi phạm, lựa chọn biện pháp hoặc diễn giải
  hiệu lực pháp lý; phải đề xuất chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-007 — OCP1-VILLA-BUSINESS-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-VILLA-BUSINESS-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với scope kép bắt buộc
- **Property scope:** Khu Biệt Thự/Khu Nhà Ở, Vinhomes Ocean Park
- **Activity scope:** Hoạt động kinh doanh tại Nhà Ở
- **Area type:** `villa_or_house`
- **Activity type:** `business_operation`
- **Audience:** Chủ Sở Hữu hoặc người được phép sử dụng Nhà Ở để kinh doanh
- **Issued at:** 2024-07-06
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Thông tin liên hệ được xác nhận còn hiện hành; nội dung chỉ chứa số Công an PCCC `114`, không chứa email
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được lưu nguyên
văn để đối chiếu.

### Normalization performed

- Tạo document riêng thay vì gộp vào Nội quy Khu Biệt Thự/Khu Nhà Ở vì
  retrieval cần thêm điều kiện `activity_type: business_operation`.
- Tổ chức nội dung thành bảy nhóm và gán section ID ổn định từ `VBIZ-01A`
  đến `VBIZ-07A`.
- Tách thời gian kinh doanh, thông báo tạm dừng, chất thải, PCCC, phê duyệt,
  kiểm tra và từng biện pháp xử lý thành section độc lập.
- Chuẩn hóa lỗi khoảng trắng `này.Trong` thành hai câu và lỗi gõ `Nôi Quy`
  thành `Nội Quy` trong canonical; raw giữ nguyên.
- Thêm intent, risk level, answer policy, scope và audience dưới dạng
  curator metadata; đây không phải nội dung do BQL ban hành.

### Source observations and gaps

1. Nguồn không đánh số rõ các nhóm nội dung nhưng có dẫn “Mục 1”. Việc
   chia Mục 1–7 chỉ phục vụ retrieval và không được coi là đánh số gốc.
2. Nguồn không cung cấp giờ thu gom rác, vị trí hóa vàng mã, biểu mẫu đăng
   ký nhân sự, hồ sơ hoặc thời gian phê duyệt.
3. Nguồn không chứa hotline/email của BQL. Chỉ số khẩn cấp PCCC `114` được
   giữ trong `VBIZ-04B`; không tự thêm thông tin liên hệ khác.
4. Nguồn không cung cấp tiêu chuẩn kỹ thuật xử lý chất thải hoặc danh sách
   ngành nghề kinh doanh có điều kiện.

### Scope and coverage decision

- Chỉ retrieval khi đồng thời khớp Khu Biệt Thự/Khu Nhà Ở và bối cảnh hoạt
  động kinh doanh.
- Không áp dụng cho Lô TM hoặc câu hỏi sinh hoạt thông thường không liên
  quan kinh doanh.
- Cung cấp coverage có điều kiện cho `I-01` qua `VBIZ-03A`, `I-02` qua
  `VBIZ-01F`, `I-04` qua `VBIZ-05C` và `I-05` qua các section còn lại.
- Không bổ sung coverage cho `I-03 — Tiện ích chung`.

### Safety decisions

- Các yêu cầu xác định điều kiện pháp lý, giấy phép, nghĩa vụ thuế, hành vi
  cạnh tranh hoặc tính hợp lệ của hồ sơ phải chuyển BQL/cơ quan có thẩm
  quyền.
- `VBIZ-04B` chỉ cung cấp chỉ dẫn khẩn cấp được nêu trong nguồn và không
  thay thế lực lượng tại hiện trường.
- Các section về tạm dừng/chấm dứt kinh doanh, phá dỡ, ngừng tiện ích, bồi
  thường và biện pháp pháp lý có
  `answer_policy: do_not_answer_escalate_to_bql`.
- ResidentGPT không được kết luận lỗi, trách nhiệm, mức thiệt hại hoặc biện
  pháp xử lý cho trường hợp cụ thể; phải đề xuất chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-008 — OCP1-POOL-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-POOL-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về sức khỏe, an toàn và trách nhiệm
- **Property scope:** Khu Căn hộ Vinhomes Ocean Park 1
- **Area type:** `apartment_pool`
- **Audience:** Người sử dụng bể bơi
- **Issued at:** 2026-08-15
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; nội dung chỉ hiển thị hotline
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho bể bơi với scope `Khu Căn hộ Vinhomes Ocean Park
  1`, không suy rộng ra toàn bộ Vinhomes Ocean Park.
- Tổ chức thành năm nhóm: thời gian hoạt động, mô tả bể, nội quy sử dụng,
  chế tài và thông tin hỗ trợ.
- Tách giờ hoạt động bể bốn mùa và ngoài trời; tách từng quy tắc về chiều
  cao, giám hộ, sức khỏe, kiểm soát ra vào và chế tài thành section ổn định
  từ `POOL-01A` đến `POOL-05A`.
- Chuẩn hóa `06h00`, `1,2m`, `1m30` thành cách hiển thị thống nhất trong
  canonical; raw giữ nguyên.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan bể bơi thuộc Khu Căn hộ Vinhomes
  Ocean Park 1.
- Không áp dụng giờ hoạt động, độ sâu hoặc điều kiện sử dụng cho bể bơi tại
  phân khu khác nếu chưa có nguồn tương ứng.
- Cung cấp coverage chính cho `I-03 — Tiện ích chung` qua toàn bộ prefix
  `POOL-*`.
- Không bổ sung coverage cho `I-01`, `I-02`, `I-04` hoặc `I-05`.

### Health and emergency safety decisions

- Các điều kiện sức khỏe chỉ được trả lời dưới dạng “theo Nội quy”; AI
  không được chẩn đoán, xác nhận một cá nhân đủ điều kiện bơi hoặc suy rộng
  sang tình trạng không được nguồn liệt kê.
- `POOL-03M6` và `POOL-03M7` là tình huống khẩn cấp: ưu tiên lên bờ/kêu cứu
  và báo ngay nhân viên cứu hộ; không tiếp tục hội thoại FAQ thông thường.
- `POOL-03N` chỉ mô tả phương thức kiểm soát ra vào; ResidentGPT không thu
  thập hoặc lưu dữ liệu khuôn mặt, vân tay hay mã thẻ thật.

### Legal and enforcement safety decisions

- `POOL-03D2` và `POOL-03O` không được dùng để kết luận trách nhiệm, lỗi,
  bồi thường hoặc tranh chấp trong vụ việc cụ thể.
- `POOL-04A` và `POOL-04B` không được dùng để tự xác định vi phạm hoặc áp
  dụng chế tài ngừng dịch vụ 06 tháng; phải chuyển BQL.
- Các yêu cầu high-risk phải đề xuất chuyển nhân viên cứu hộ/BQL và dùng
  reason code phù hợp; yêu cầu pháp lý hoặc trách nhiệm log
  `legal_or_compensation_escalation`.

## REVIEW-009 — OCP1-KAYAK-DOCK-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-KAYAK-DOCK-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với một section bị loại do sai phạm vi
- **Property scope:** Bến Thuyền Kayak, Vinhomes Ocean Park
- **Area type:** `kayak_dock`
- **Amenity type:** `kayak`
- **Audience:** Cư dân và khách sử dụng Bến Thuyền
- **Issued at:** 2026-08-15
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành, nhưng không xuất hiện trong nội dung nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho Bến Thuyền Kayak và ánh xạ vào `I-03 — Tiện ích
  chung`.
- Chuẩn hóa giờ `9.00`, `12.00`, `14.00`, `17.00` thành định dạng `HH:MM`
  trong canonical; raw giữ nguyên.
- Tách điều kiện mua vé, chính sách đổi/hoàn, an toàn, giám sát trẻ em,
  trách nhiệm tài sản, từng hành vi cấm và xử lý vi phạm thành section ID
  ổn định từ `KAYAK-00A` đến `KAYAK-ENF-01`.
- Chuẩn hóa lỗi gõ rõ ràng `hàng quốc cấm` thành `hàng cấm` trong canonical;
  raw giữ nguyên.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Source anomaly and exclusion

Mục II.5 nhắc đến việc sử dụng thiết bị “trong Vườn Nướng”, không khớp với
phạm vi Bến Thuyền. `KAYAK-II-05` được giữ trong canonical để truy vết nhưng
bị loại khỏi index, retrieval và citation cho đến khi Knowledge Owner/BQL
xác nhận đây là lỗi sao chép hay nội dung thuộc tài liệu khác.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan Bến Thuyền Kayak tại Vinhomes Ocean
  Park.
- Không áp dụng giờ mở cửa, vé hoặc điều kiện an toàn cho tiện ích khác.
- Cung cấp coverage chính cho `I-03 — Tiện ích chung` qua prefix
  `KAYAK-*`.
- Không bổ sung coverage cho các intent còn lại.

### Safety and enforcement decisions

- Quy định mặc áo phao, cấm bơi, tuân thủ Nhân viên Cứu hộ và giám sát trẻ
  dưới 12 tuổi được đánh dấu safety-critical.
- Khi có nguy cơ trên mặt nước, cháy nổ hoặc vật liệu nguy hiểm, hệ thống
  phải chuyển Nhân viên Cứu hộ/BQL thay vì tiếp tục FAQ thông thường.
- `KAYAK-I-09B` và `KAYAK-I-11` không được dùng để kết luận trách nhiệm,
  lỗi, bồi thường hoặc tranh chấp trong sự việc cụ thể.
- `KAYAK-ENF-01` không được dùng để tự xác định vi phạm, lập biên bản hoặc
  quyết định mời cá nhân ra khỏi khu vực.
- Chính sách không đổi/hoàn vé có thể được nêu ở mức quy tắc chung; yêu cầu
  ngoại lệ hoặc tranh chấp giao dịch phải chuyển BQL.

## REVIEW-010 — OCP1-SPORTS-COMPLEX-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-SPORTS-COMPLEX-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về dữ liệu định danh, trách nhiệm và chế tài
- **Property scope:** Khu phức hợp Thể thao, Vinhomes Ocean Park
- **Area type:** `sports_complex`
- **Amenity type:** `sports_complex`
- **Audience:** Cư dân và khách sử dụng tiện ích
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; nội dung chỉ hiển thị hotline
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho Khu phức hợp Thể thao.
- Chuẩn hóa giờ `6.00`, `12.00`, `14.00`, `21.00` thành định dạng `HH:MM`
  trong canonical; raw giữ nguyên.
- Hợp nhất các quy định bị lặp ở phần cuối nguồn nhưng tách riêng thông tin
  chi tiết về đặt trước 01 ngày, đến muộn 30 phút, hủy trước 02 giờ và bằng
  chứng đặt lịch trên ứng dụng.
- Tách vệ sinh, vật nuôi, thiết bị, trẻ em, tài sản cá nhân, hành vi cấm,
  hoạt động kinh doanh, chế tài và liên hệ thành section ID ổn định từ
  `SPORT-00A` đến `SPORT-CONTACT-01`.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan Khu phức hợp Thể thao tại Vinhomes
  Ocean Park.
- Không áp dụng giờ mở cửa, đặt lịch hay chế tài cho tiện ích khác.
- Cung cấp coverage chính cho `I-03 — Tiện ích chung` qua prefix
  `SPORT-*`.
- `SPORT-01B` và `SPORT-III-01B` bổ sung coverage có điều kiện cho `I-01 —
  Thẻ cư dân/ra vào`; nguồn không cung cấp thủ tục cấp hoặc cấp lại thẻ.

### Data and safety decisions

- ResidentGPT chỉ mô tả yêu cầu xuất trình Thẻ Cư dân và lịch đặt; không
  thu thập hoặc lưu số thẻ, ảnh thẻ, tài khoản hay lịch sử đặt thật.
- `SPORT-I-06` yêu cầu người lớn giám sát trẻ dưới 12 tuổi.
- Vũ khí, chất cháy nổ, hóa chất độc hại, ma túy hoặc xô xát đang xảy ra
  phải chuyển nhân viên/BQL hoặc lực lượng phù hợp.

### Legal and enforcement decisions

- `SPORT-I-08B` và `SPORT-I-09` không được dùng để kết luận trách nhiệm,
  lỗi, bồi thường hoặc tranh chấp đối với tài sản hay tai nạn cụ thể.
- `SPORT-III-02` không được dùng để tự áp dụng việc từ chối phục vụ hoặc
  ngừng dịch vụ 02 tháng.
- `SPORT-ENF-01` không được dùng để tự xác định vi phạm, lập biên bản hoặc
  mời cá nhân ra khỏi khu vực.
- Các yêu cầu trên phải chuyển BQL và log
  `legal_or_compensation_escalation` khi liên quan trách nhiệm/pháp lý.

## REVIEW-011 — OCP1-CHILDREN-PLAYGROUND-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-CHILDREN-PLAYGROUND-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về an toàn trẻ em và trách nhiệm
- **Property scope:** Sân chơi trẻ em, Khu Đô thị Vinhomes Ocean Park
- **Area type:** `children_playground`
- **Amenity type:** `children_playground`
- **Audience:** Con em Cư dân và người lớn giám hộ
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành, nhưng không xuất hiện trong nội dung nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho Sân chơi trẻ em và ánh xạ vào `I-03 — Tiện ích
  chung`.
- Chuẩn hóa giờ `6.00`–`22.00` thành `06:00`–`22:00` trong canonical; raw
  giữ nguyên.
- Chuẩn hóa lỗi gõ rõ ràng “Để Không được hút thuốc” thành “Không được hút
  thuốc” và hoàn thiện danh từ “sân chơi trẻ” thành “Sân chơi trẻ em” theo
  tiêu đề, phạm vi và ngữ cảnh của cùng câu; không bổ sung nghĩa vụ mới.
- Tách đối tượng sử dụng, giám hộ, an toàn, vệ sinh, tài sản, thay đổi giờ,
  hành vi cấm và xử lý vi phạm thành section ID ổn định từ `PLAY-00A` đến
  `PLAY-ENF-01`.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan Sân chơi trẻ em tại Khu Đô thị
  Vinhomes Ocean Park.
- Không áp dụng giờ hoạt động hoặc quy định này cho khu vui chơi khác.
- Nguồn chỉ nêu đối tượng là con em Cư dân; AI không được tự tạo ngoại lệ
  cho khách hoặc đối tượng khác.
- Cung cấp coverage cho `I-03 — Tiện ích chung` qua prefix `PLAY-*`.

### Safety and enforcement decisions

- `PLAY-I-02` yêu cầu trẻ dưới 12 tuổi luôn có người lớn đi kèm và được xử
  lý như safety-critical.
- Khi có trò chơi nguy hiểm, tai nạn, vũ khí, chất cháy nổ hoặc hành vi gây
  mất an ninh, hệ thống phải chuyển nhân viên/BQL hoặc lực lượng phù hợp.
- `PLAY-I-10` không được dùng để kết luận trách nhiệm, lỗi hoặc bồi thường
  đối với tai nạn cụ thể.
- `PLAY-ENF-01` không được dùng để tự xác định vi phạm, lập biên bản hoặc
  mời cá nhân ra khỏi khu vực.
- Các yêu cầu pháp lý/trách nhiệm phải chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-016 — OCP1-APARTMENT-CONSTRUCTION-GUIDE-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-APARTMENT-CONSTRUCTION-GUIDE-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về phạm vi, dữ liệu cá nhân, kỹ thuật, phê duyệt và hoàn tiền đặt cọc
- **Property scope:** Căn hộ, Khu Đô thị Vinhomes Ocean Park
- **Area type:** `apartment`
- **Activity type:** `construction_or_renovation`
- **Audience:** Chủ hộ, người được ủy quyền và Nhà thầu thi công Căn hộ
- **Issued at:** 2026-02-27
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email trong nguồn được xác nhận còn hiện hành
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể; nguồn mô tả các loại giấy tờ cá nhân phải nộp
- **Source completeness:** `Complete` theo nội dung được cung cấp; các mẫu và tài liệu được dẫn chiếu chưa được cung cấp

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của hotline/email. Bản raw được giữ để đối chiếu.

### Normalization performed

- Tách các yêu cầu về đơn, ủy quyền, nhà thầu, nội quy ký, bản vẽ và Thẻ
  Nhà thầu thành section ID ổn định.
- Tách thời gian xem xét 07 ngày làm việc và thông báo bổ sung sau 03 ngày
  thành hai section; không suy diễn ngày hoàn thành hồ sơ cụ thể.
- Tách sáu nhóm hạng mục không được thi công để retrieval chính xác hơn.
- Tách tiền đặt cọc, phí thi công, đăng ký vật liệu, đăng ký bổ sung, nghiệm
  thu và hoàn cọc thành các section riêng.
- Giữ nguyên các yêu cầu kỹ thuật ACOTEC nhưng giới hạn thành quy tắc chung,
  không chuyển thành tư vấn kỹ thuật cho phương án cụ thể.
- Chuẩn hóa hotline thành `1900 232389`, nhánh `4`; giữ email
  `info@vinhomes.vn` như trong nguồn.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Tài liệu chỉ cung cấp coverage cho `I-04 — Chuyển đồ/thi công` trong bối
  cảnh cải tạo, sửa chữa Căn hộ.
- Khi câu hỏi không nêu loại hình bất động sản, hệ thống phải hỏi lại trước
  khi retrieval.
- Hai section `ACON-II-01X` và `ACON-NOTE-04X` nhắc Shop/Shophouse nhưng bị
  loại khỏi RAG do tiêu đề nguồn chỉ xác định phạm vi Căn hộ.
- Nguồn này không thay thế Nội quy thi công đầy đủ, vì chính hồ sơ yêu cầu
  một bản Nội quy thi công có chữ ký nhưng nội dung đó chưa được cung cấp.
- Nguồn chưa cung cấp quy trình chuyển đồ/chuyển nhà, mẫu hồ sơ, kênh nộp,
  giờ tiếp nhận, thông tin thanh toán hoặc thời gian hoàn tiền đặt cọc.

### Privacy, safety and financial decisions

- `ACON-I-02`, `ACON-I-06A` và `ACON-I-06B` chỉ dùng để liệt kê loại hồ sơ;
  ResidentGPT không thu thập CMND, ảnh 3x4 hay dữ liệu nhân sự thật.
- Các câu hỏi kỹ thuật tác động kết cấu, PCCC, hệ thống chung, khoan rút lõi
  sàn hoặc ACOTEC chỉ được trả lời bằng quy tắc chung và phải chuyển BQL/đơn
  vị chuyên môn khi áp dụng cho phương án cụ thể.
- `ACON-II-01A` và `ACON-II-01B` được dùng để nêu mức công bố cho Căn hộ,
  nhưng không xác nhận nghĩa vụ hoặc tự hướng dẫn thanh toán.
- `ACON-III-02` không được dùng để quyết định nghiệm thu, vi phạm, khoản
  khấu trừ hoặc số tiền hoàn; phải chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-013 — OCP1-SALTWATER-LAKE-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-SALTWATER-LAKE-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về an toàn mặt nước, trách nhiệm và giao dịch
- **Property scope:** Biển hồ nước mặn, Vinhomes Ocean Park
- **Area type:** `saltwater_lake`
- **Amenity type:** `saltwater_lake`
- **Audience:** Cư dân và khách sử dụng tiện ích
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; nội dung chỉ hiển thị hotline
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho Biển hồ nước mặn, không gộp với Bến Thuyền Kayak
  hoặc bể bơi.
- Tách giờ hoạt động thứ Hai–thứ Sáu và thứ Bảy–Chủ nhật thành hai section
  độc lập; chuẩn hóa `8:00` thành `08:00`.
- Tách mua vé, đổi/trả vé, hướng dẫn cứu hộ, trẻ dưới 15 tuổi, tài sản cá
  nhân, tai nạn, xử lý vi phạm và liên hệ thành section ID ổn định từ
  `LAKE-00A` đến `LAKE-CONTACT-01`.
- Chuẩn hóa lỗi gõ rõ ràng `hàng quốc cấm` thành `hàng cấm`, `Ban Quàn lý`
  thành `Ban Quản lý` và bổ sung dấu phẩy giữa `tổn thất, mất mát` trong
  canonical; raw giữ nguyên.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan Biển hồ nước mặn tại Vinhomes Ocean
  Park.
- Không áp dụng giờ hoạt động, vé hoặc độ tuổi giám sát cho Bến Thuyền
  Kayak, bể bơi hoặc tiện ích mặt nước khác.
- Cung cấp coverage cho `I-03 — Tiện ích chung` qua prefix `LAKE-*`.

### Safety and enforcement decisions

- Hướng dẫn và hiệu lệnh của Nhân viên Cứu hộ được ưu tiên trong sự cố;
  ResidentGPT không thay thế lực lượng tại hiện trường.
- Trẻ dưới 15 tuổi phải có người giám sát và không được trực tiếp lái/chèo
  thuyền.
- `LAKE-06B` và `LAKE-07` không được dùng để kết luận trách nhiệm, lỗi,
  bồi thường hoặc tranh chấp đối với tài sản hay tai nạn cụ thể.
- `LAKE-ENF-01` và `LAKE-ENF-02` không được dùng để tự xác định vi phạm,
  yêu cầu cá nhân rời khu vực hoặc quyết định hoàn chi phí.
- Chính sách vé có thể được nêu ở mức quy tắc chung; ngoại lệ hoặc tranh
  chấp giao dịch phải chuyển BQL.

## REVIEW-014 — OCP1-BBQ-GARDEN-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-BBQ-GARDEN-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với một section bị loại và các guard tài chính/chế tài
- **Property scope:** Vườn Nướng BBQ, Khu Đô thị Vinhomes Ocean Park
- **Area type:** `bbq_garden`
- **Amenity type:** `bbq_garden`
- **Audience:** Cư dân và gia đình/người thân/bạn bè/khách đi cùng Cư dân
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; nội dung chỉ hiển thị hotline
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho Vườn Nướng BBQ và giữ ba địa điểm hồ San Hô, hồ
  Ngọc Trai, Hải Âu trong cùng document vì cùng giờ, giá và Nội quy.
- Tách giờ hoạt động, địa điểm, giá cơ bản, từng loại phụ thu, hoàn tiền,
  đặt lịch, QR check-in, sức chứa, điểm nhận vỉ nướng, quy tắc an toàn và
  từng dòng chế tài thành section ID ổn định từ `BBQ-00A` đến
  `BBQ-SAN-10`.
- Chuẩn hóa `200.000đ`, `40.000đ`, `09h30`, `21h30` thành cách trình bày
  thống nhất; raw giữ nguyên.
- Chuẩn hóa lỗi gõ `Vườn Nường BBQ Hải Âu` thành `Vườn Nướng BBQ Hải Âu`.
- Thêm intent, risk level, answer policy, scope và conflict metadata dưới
  dạng curator metadata; đây không phải nội dung do BQL ban hành.

### Source conflicts and ambiguities

1. Phần giá cho phép phụ thu khi quá 06 người và phần vận hành nêu tối đa
   08 người, nhưng chế tài số 5 coi trên 06 người là vi phạm. Nhóm section
   `BBQ-FEE-02`, `BBQ-BOOK-04`, `BBQ-SAN-05` được đánh dấu conflict;
   `BBQ-SAN-05` bị loại khỏi RAG. Câu hỏi về nhóm 07–08 người phải chuyển
   BQL.
2. Phụ thu quá giờ dùng các khoảng “dưới 60 phút” và “dưới 120 phút”, gây
   chồng lấn và không nêu mức tại đúng 60/120 phút hoặc trên 120 phút.
   ResidentGPT không được tự tính phụ thu thời gian.
3. Chính sách hoàn tiền dùng cụm “trước 24 giờ” và “sau 24 giờ” nhưng không
   xác định rõ mốc tham chiếu. Yêu cầu tính hoàn tiền phải chuyển BQL.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan Vườn Nướng BBQ tại Khu Đô thị
  Vinhomes Ocean Park.
- Cung cấp coverage chính cho `I-03 — Tiện ích chung` qua prefix `BBQ-*`.
- `BBQ-ACCESS-01` bổ sung coverage có điều kiện cho `I-01 — Thẻ cư dân/ra
  vào`; nguồn không cung cấp thủ tục cấp hoặc cấp lại thẻ.
- ResidentGPT không thu thập tài khoản, lịch sử đặt bếp, mã QR hoặc số Thẻ
  Cư dân thật.

### Safety, legal and enforcement decisions

- Chỉ được sử dụng bếp than; phải dập tắt tàn lửa sau sử dụng. Sự cố cháy
  hoặc nguy cơ hiện hữu phải chuyển người tại hiện trường/BQL.
- Trẻ dưới 12 tuổi phải có người lớn hướng dẫn, theo dõi và giám sát.
- Các section bồi thường, mất tài sản, an toàn tính mạng và thiệt hại cho
  bên khác không được dùng để kết luận trách nhiệm hoặc mức bồi thường.
- Toàn bộ `BBQ-SAN-*` chỉ dùng nhận diện high-risk. Ngoại trừ section bị
  loại do conflict, các section còn lại có
  `answer_policy: do_not_answer_escalate_to_bql`.
- ResidentGPT không được xác định vi phạm, áp dụng mức tiền, ngừng dịch vụ,
  mời ra khỏi khu vực hoặc quyết định hoàn tiền; phải chuyển BQL.

## REVIEW-015 — OCP1-FISHING-DECK-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-FISHING-DECK-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về an toàn mặt nước, dữ liệu định danh và chế tài
- **Property scope:** Sàn Câu cá, Khu Đô thị Vinhomes Ocean Park
- **Area type:** `fishing_deck`
- **Amenity type:** `fishing_deck`
- **Audience:** Cư dân và Khách hàng đủ điều kiện theo trạng thái bàn giao căn
- **Issued at:** 2026-02-27
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; nội dung chỉ hiển thị hotline
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho Sàn Câu cá, không gộp với Bến Thuyền hoặc Biển hồ.
- Chuẩn hóa giờ `8.00`, `12.00`, `14.00`, `18.00` thành định dạng `HH:MM`
  trong canonical; raw giữ nguyên.
- Hợp nhất phần III làm rõ với các quy định chung nhưng giữ riêng yêu cầu
  thẻ chính chủ, giới hạn vị trí, bạt/thảm, hoạt động kinh doanh và chế tài.
- Tách đặt lịch, thẻ, cần/lưỡi/mồi câu, an toàn mặt nước, môi trường, tài
  sản, hành vi cấm và từng dòng chế tài thành section ID ổn định từ
  `FISH-00A` đến `FISH-SAN-10`.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Source observations and gaps

1. Phần đầu ghi tiện ích chỉ dành cho Cư dân; phần III làm rõ thêm Khách
   hàng có Thẻ Ra vào chính chủ đối với căn chưa bàn giao. Canonical giữ
   phạm vi `residents_and_eligible_customers` nhưng AI không tự xác nhận tư
   cách cá nhân.
2. Nguồn yêu cầu hủy lịch hoặc thông báo BQL nhưng không cung cấp thời hạn
   và thao tác hủy. AI không được suy đoán quy trình.
3. Nguồn cấm kinh doanh, mua/bán cá nhưng không quy định việc giữ cá cho
   mục đích phi thương mại. AI không được suy luận.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan Sàn Câu cá tại Khu Đô thị Vinhomes
  Ocean Park.
- Cung cấp coverage chính cho `I-03 — Tiện ích chung` qua prefix `FISH-*`.
- `FISH-BOOK-03` và `FISH-ACCESS-01` bổ sung coverage có điều kiện cho
  `I-01 — Thẻ cư dân/ra vào`; nguồn không cung cấp thủ tục cấp thẻ.
- ResidentGPT không thu thập số thẻ, ảnh thẻ, tài khoản hoặc lịch sử đặt
  chỗ thật.

### Safety, legal and enforcement decisions

- Không được xuống hồ dưới mọi hình thức; sự cố mặt nước phải chuyển ngay
  nhân viên/BQL và lực lượng cứu hộ phù hợp.
- Trẻ dưới 12 tuổi không được vào khu vực Sàn Câu cá.
- `FISH-I-11B` và `FISH-I-12` không được dùng để kết luận trách nhiệm, lỗi,
  bồi thường hoặc tranh chấp đối với tài sản hay tai nạn cụ thể.
- Toàn bộ `FISH-SAN-01`–`FISH-SAN-10` chỉ dùng nhận diện high-risk và có
  `answer_policy: do_not_answer_escalate_to_bql`.
- ResidentGPT không được xác định vi phạm, mời cá nhân ra khỏi khu vực hoặc
  ngừng dịch vụ; phải chuyển BQL.

## REVIEW-012 — OCP1-OUTDOOR-GYM-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-OUTDOOR-GYM-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về an toàn, trách nhiệm và xử lý vi phạm
- **Property scope:** Khu Gym ngoài trời, Khu Đô thị Vinhomes Ocean Park
- **Area type:** `outdoor_gym`
- **Amenity type:** `outdoor_gym`
- **Audience:** Cư dân
- **Issued at:** 2026-02-27
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành, nhưng không xuất hiện trong nội dung nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể trong nguồn
- **Source completeness:** `Complete`

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của thông tin liên hệ. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tạo source riêng cho Gym ngoài trời thay vì gộp với Phức hợp Thể thao vì
  phạm vi, ngày ban hành và quy định vận hành khác nhau.
- Chuẩn hóa giờ `6.00`–`22.00` thành `06:00`–`22:00` trong canonical; raw
  giữ nguyên.
- Chuẩn hóa lỗi gõ “liên qua trực tiếp” thành “liên quan trực tiếp” và cụm
  “Sân Khu Gym ngoài trời” thành “Khu Gym ngoài trời” mà không thay đổi
  nghĩa vụ trong nguồn.
- Tách đối tượng sử dụng, vệ sinh, vật nuôi, thiết bị, trẻ em, tài sản cá
  nhân, hành vi cấm và xử lý vi phạm thành section ID ổn định từ `GYM-00A`
  đến `GYM-ENF-01`.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Chỉ retrieval khi câu hỏi liên quan Khu Gym ngoài trời tại Khu Đô thị
  Vinhomes Ocean Park.
- Không áp dụng giờ hoạt động hoặc quy định này cho Phức hợp Thể thao, gym
  trong nhà hay tiện ích khác.
- Nguồn chỉ nêu đối tượng là Cư dân đang sinh sống tại Khu Đô thị; AI không
  được tự tạo ngoại lệ cho khách.
- Cung cấp coverage cho `I-03 — Tiện ích chung` qua prefix `GYM-*`.

### Safety and enforcement decisions

- `GYM-I-06` yêu cầu người lớn giám sát trẻ dưới 12 tuổi.
- Khi có xô xát, vũ khí, chất cháy nổ, hóa chất độc hại hoặc hành vi gây
  mất an ninh, hệ thống phải chuyển nhân viên/BQL hoặc lực lượng phù hợp.
- `GYM-I-08B` và `GYM-I-09` không được dùng để kết luận trách nhiệm, lỗi,
  bồi thường hoặc tranh chấp đối với tài sản hay tai nạn cụ thể.
- `GYM-ENF-01` không được dùng để tự xác định vi phạm, lập biên bản hoặc
  mời cá nhân ra khỏi khu vực.
- Các yêu cầu pháp lý/trách nhiệm phải chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-017 — OCP1-APARTMENT-CONSTRUCTION-RULES-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-APARTMENT-CONSTRUCTION-RULES-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về ngày, phạm vi, an toàn, thanh toán, bồi thường và chế tài
- **Property scope:** Khu Căn hộ và các đối tượng được nguồn định nghĩa là “Căn Hộ”, Khu Đô thị Vinhomes Ocean Park
- **Area type:** `apartment_complex`
- **Activity type:** `construction_or_renovation`
- **Audience:** Chủ Căn Hộ, người được ủy quyền, Nhà thầu và công nhân
- **User-confirmed issued at:** 2026-07-22
- **Embedded issued/effective date:** 2026-04-21
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành nhưng không xuất hiện trong nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể; nguồn mô tả yêu cầu CMND/CCCD đối với Thẻ Nhà thầu
- **Source completeness:** `Complete`, bao gồm bảng phí/đặt cọc và bảng mức phạt

### Validation basis

Người dùng xác nhận nguồn chính thức, ngày 22/07/2026, trạng thái mới nhất
và đang có hiệu lực, không có văn bản thay thế, không có số phiên bản,
quyền sử dụng cho MVP và độ mới của hotline/email. Chính văn lại ghi ngày
21/04/2026; cả hai mốc được giữ để BQL xác nhận.

Người dùng bổ sung bản sửa cho mục 3.1, dòng 3: công việc ít bụi, không hoặc
ít gây tiếng ồn được thực hiện 08:30–11:30 và 14:00–17:30 vào cả Thứ Bảy,
Chủ nhật và ngày lễ. Raw giữ nội dung chụp ban đầu và source correction;
canonical sử dụng nội dung đã sửa.

### Normalization performed

- Tách đối tượng, đăng ký, giấy phép, thông báo, phí/đặt cọc, quy trình hồ
  sơ, thời gian, vệ sinh, an toàn, thiết kế, Nhà thầu, vận chuyển, giám sát
  và chế tài thành các section `APTC-*` ổn định.
- Chuẩn hóa các khung giờ sang `HH:MM`, nhưng giữ nguyên giá trị và ngày áp
  dụng được nêu trong nguồn.
- Tách từng dòng trong bảng phí và 21 hành vi vi phạm thành section riêng;
  thêm section riêng cho cách thông báo tiền phạt.
- Giữ thông tin tài khoản ngân hàng trong raw/canonical để truy vết nhưng
  loại `APTC-PAY-02` khỏi RAG.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Cung cấp coverage chính cho `I-04 — Chuyển đồ/thi công` qua prefix
  `APTC-*`.
- Không áp dụng nguồn cho Biệt thự hoặc Nhà liền kề.
- Nguồn định nghĩa Nhà Dịch Vụ, diện tích thương mại và Gian Hàng Kinh
  Doanh trong thuật ngữ “Căn Hộ”; khi loại hình không rõ, hệ thống phải hỏi
  lại trước khi retrieval.
- Tài liệu bổ sung giờ dọn chuyển đồ, giờ vận chuyển rác, đăng ký thang máy
  và giới hạn thang hàng, nhưng chưa thay thế một quy trình đăng ký chuyển
  nhà/chuyển đồ hoàn chỉnh.

### Conflicts and source gaps

- `APTC-EFF-01` bị loại khỏi RAG do chưa thống nhất mốc 22/07/2026 và
  21/04/2026.
- `APTC-FEE-02` có cách trình bày chưa rõ về khoản 500.000 đồng liên quan
  nước thất thoát khi thi công PCCC; không dùng để tính phí.
- Bảng phạt không nêu trường hợp có đúng 02 hoặc 03 công nhân cùng vi phạm
  trang bị bảo hộ; không được suy luận.
- `SH` và `OF` không được giải nghĩa trong nguồn.

### Privacy, safety, payment and enforcement decisions

- ResidentGPT chỉ được liệt kê loại giấy tờ; không thu thập CMND/CCCD hoặc
  hồ sơ công nhân thật.
- Các câu hỏi về kết cấu, điện, hàn cắt, chất cháy, PCCC hoặc an toàn lao
  động chỉ được trả lời bằng quy tắc nguồn và chuyển BQL/đơn vị chuyên môn
  khi áp dụng cho công việc cụ thể.
- Không hiển thị số tài khoản hoặc hướng dẫn chuyển tiền từ Knowledge Pack;
  người dùng phải xác minh trực tiếp với BQL trước giao dịch.
- `APTC-III-06`, `APTC-III-11`, `APTC-III-12`, `APTC-DEPOSIT-04`,
  `APTC-DESIGN-02`, `APTC-MONITOR-02`, `APTC-LIABILITY-01`, `APTC-ENF-01`
  và toàn bộ `APTC-SAN-01`–`APTC-SAN-22` không được dùng để xác định trách
  nhiệm, bồi thường, khấu trừ, vi phạm hoặc chế tài; phải chuyển BQL.

## REVIEW-018 — OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về phạm vi thẻ, tư cách, phí và dữ liệu cá nhân
- **Property scope:** Căn hộ, Biệt thự, Shophouse và Thương mại dịch vụ tại Khu Đô thị Vinhomes Ocean Park
- **Area type:** `multi_property_resident_access`
- **Card types:** Thẻ Cư dân, Thẻ Ra vào và Thẻ gửi xe Cư dân
- **Issued at:** 2026-08-16
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành nhưng không xuất hiện trong nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể
- **Source completeness:** `Complete` theo nội dung được cung cấp

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của hotline/email. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tách chức năng, đối tượng, hạn mức và mức phí theo ba loại Thẻ Cư dân,
  Thẻ Ra vào và Thẻ gửi xe.
- Tách hạn mức Thẻ Cư dân theo từng loại hình và số phòng ngủ để retrieval
  không trộn các nhóm.
- Tách phí cấp mới khỏi phí cấp lại/đổi và chuẩn hóa tiền tệ sang “đồng”.
- Ghi rõ tất cả mức phí trong nguồn đã bao gồm 10% thuế GTGT.
- Tách đăng ký trực tuyến, thu hồi thẻ cũ, mất thẻ và báo mất/hủy thẻ thành
  các section riêng.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Cung cấp coverage chính cho `I-01 — Thẻ cư dân/ra vào` qua các prefix
  `CARD-RES-*`, `CARD-ACCESS-*` và `CARD-LIMIT-*`.
- Cung cấp coverage có điều kiện cho `I-02 — Phương tiện/thẻ xe` qua prefix
  `CARD-PARK-*`; phí cấp thẻ không phải phí trông giữ xe tháng hoặc theo
  lượt.
- `CARD-RES-FEATURE-02` bổ sung coverage cho `I-03 — Tiện ích chung`, nhưng
  chỉ về chức năng Thẻ Cư dân và ngoại lệ Vinhomes Sapphire.
- Khi chưa rõ loại thẻ, loại hình bất động sản hoặc loại Căn hộ, hệ thống
  phải hỏi lại trước khi retrieval.

### Source observations and gaps

1. Cụm “Căn hộ 01 phòng ngủ bao gồm căn 1+1, 2 phòng ngủ, studio” có cách
   phân nhóm không nhất quán. `CARD-LIMIT-01A` giữ nguyên câu chữ và chuyển
   BQL khi câu hỏi liên quan Căn hộ 02 phòng ngủ thông thường.
2. Nguồn nhắc xe máy nhưng không nêu phí cấp mới, cấp lại hoặc đổi thẻ xe
   máy. Không được áp mức của xe đạp hoặc ô tô.
3. Nguồn chưa có danh mục hồ sơ, thao tác chi tiết trên ứng dụng, thời gian
   xử lý, thời hạn thẻ, gia hạn hoặc chính sách cấp vượt hạn mức.
4. Hotline và email không xuất hiện trong nguồn nên không được bổ sung vào
   canonical này.

### Privacy, financial and security decisions

- ResidentGPT không thu thập tài khoản/mật khẩu ứng dụng, số thẻ, giấy tờ
  định danh hoặc hồ sơ đăng ký thật.
- Mức phí công bố có thể được nêu kèm citation nhưng việc thanh toán và phê
  duyệt hồ sơ phải do BQL xử lý.
- Khi mất hoặc không còn nhu cầu sử dụng thẻ, hệ thống phải hướng dẫn báo
  ngay BQL; không được tuyên bố đã khóa hoặc hủy thẻ.

## REVIEW-019 — OCP1-MOVE-IN-OUT-GUIDE-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-MOVE-IN-OUT-GUIDE-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về phạm vi vận chuyển, dữ liệu đăng ký, an toàn và bồi thường
- **Property scope:** Các cụm và Tòa nhà được liệt kê tại Khu Đô thị Vinhomes Ocean Park
- **Area type:** `multi_property_move_in_out`
- **Activity type:** `moving_belongings_in_or_out`
- **Audience:** Cư dân
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; chỉ hotline An ninh xuất hiện trong nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể
- **Source completeness:** `Complete` theo nội dung được cung cấp

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của hotline/email. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tách đăng ký online và đăng ký trực tiếp thành hai section riêng.
- Tách năm nhóm địa điểm/giờ tiếp nhận theo đúng cụm hoặc Tòa nhà.
- Chuẩn hóa giờ đăng ký, giờ chuyển đồ và thời gian vận chuyển rác sang
  định dạng `HH:MM`.
- Tách yêu cầu giấy/QR đã duyệt, hotline An ninh, lối vận chuyển, phương
  tiện, vật liệu nguy hiểm, rác và từng cam kết thành section riêng.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Cung cấp coverage cho `I-04 — Chuyển đồ/thi công` qua prefix `MOVE-*`.
- `MOVE-TIME-01` được dùng cho chuyển đồ sinh hoạt qua tầng hầm; không tự
  áp dụng cho vật tư hoặc rác thi công.
- Khi câu hỏi không nêu rõ chuyển nhà/đồ sinh hoạt hay vận chuyển phục vụ
  thi công, hệ thống phải hỏi lại trước khi chọn giữa `MOVE-*` và `APTC-*`.
- Nguồn đã cung cấp flow cơ bản: đăng ký, địa điểm, giờ, bằng chứng đã
  duyệt, tuyến vận chuyển và hotline hỗ trợ.

### Source observations and gaps

1. Nguồn không nêu các trường trong mẫu, SLA phê duyệt, cách sửa/hủy đăng
   ký hoặc cách tính thời hạn trước 04 giờ.
2. Cụm “trọng tải tối đa từ 3,5 tấn đến 5 tấn” không phân bổ mức cụ thể
   theo khu vực hoặc điều kiện; `MOVE-VEH-01` phải chuyển An ninh/BQL xác
   nhận.
3. Email được xác nhận còn hiện hành nhưng không xuất hiện trong nguồn nên
   không được bổ sung vào canonical.

### Privacy, safety and liability decisions

- ResidentGPT không thu thập mã QR, ảnh giấy đăng ký, tài khoản ứng dụng,
  số căn hoặc dữ liệu định danh thật.
- Vật liệu dễ cháy nổ, bình khí nén và thiết bị hàn/cắt dùng khí hóa lỏng
  phải đăng ký riêng và có xác nhận Kỹ thuật; AI không tự phê duyệt.
- `MOVE-COMMIT-04` không được dùng để xác định hư hỏng, lỗi, trách nhiệm
  hoặc số tiền bồi thường; phải chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-020 — OCP1-BQL-OFFICE-DIRECTORY-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-BQL-OFFICE-DIRECTORY-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP
- **Property scope:** Các cụm và Khối nhà được liệt kê tại Khu Đô thị Vinhomes Ocean Park
- **Area type:** `multi_property_management_office`
- **Audience:** Cư dân
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành nhưng không xuất hiện trong nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có
- **Source completeness:** `Complete` theo nội dung được cung cấp

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của hotline/email. Năm dòng địa điểm và giờ làm
việc khớp với dữ liệu trong `OCP1-MOVE-IN-OUT-GUIDE-001`.

### Normalization performed

- Tạo source danh bạ BQL độc lập thay vì chỉ để địa điểm nằm trong hướng
  dẫn chuyển đồ.
- Tách năm phạm vi cụm/Khối nhà thành `BQLOFF-01`–`BQLOFF-05`.
- Chuẩn hóa toàn bộ khung giờ sang định dạng `HH:MM`.
- Giữ riêng ba kiểu lịch: các ngày trong tuần trừ Lễ/Tết; các ngày trong
  tuần với lịch Lễ/Tết theo thông báo; và Thứ Hai–Thứ Bảy trừ Chủ nhật,
  Lễ/Tết.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and routing decision

- Tài liệu là nguồn dùng chung cho `I-01`–`I-05` khi người dùng hỏi địa chỉ
  hoặc giờ làm việc của BQL.
- Đây là nguồn được ưu tiên hơn phần địa chỉ nằm trong hướng dẫn chuyển đồ,
  nhưng hai nguồn hiện khớp nhau.
- Khi người dùng chưa nêu cụm hoặc Khối nhà, hệ thống phải hỏi lại trước
  khi trả lời địa điểm.
- Không áp dụng địa điểm cho Tòa nhà ngoài danh sách và không suy đoán lịch
  làm việc vào Lễ, Tết.

### Source gaps

- Chưa có địa điểm cho các cụm/Khối nhà ngoài danh sách.
- Chưa có lịch cụ thể cho từng dịp Lễ, Tết.
- Chưa nêu loại yêu cầu được tiếp nhận tại từng điểm.
- Hotline và email không xuất hiện trong nguồn nên không được bổ sung vào
  canonical này.

## REVIEW-021 — OCP1-PARKING-FEE-SCHEDULE-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-PARKING-FEE-SCHEDULE-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về phạm vi phí, tính hóa đơn và xử lý tài sản
- **Property scope:** Hầm gửi xe các Tòa nhà và các Nhà xe nổi được liệt kê tại Khu Đô thị Vinhomes Ocean Park
- **Area type:** `parking_facilities`
- **Service type:** `vehicle_parking_and_two_wheel_ev_charging`
- **Audience:** Cư dân và Khách hàng gửi xe vãng lai
- **Issued at:** 2026-07-22
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành nhưng không xuất hiện trong nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có
- **Source completeness:** `Complete` theo nội dung được cung cấp

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của hotline/email. Nguồn ghi tất cả mức phí đã
bao gồm VAT.

### Normalization performed

- Tách phí tháng và phí vãng lai của hầm Tòa nhà khỏi các Nhà xe nổi.
- Tách từng khung giờ vãng lai để tránh áp nhầm mức `00:00–05:59`.
- Tách Nhà xe tiêu chuẩn, Techno Park và Hải Âu 3 vì giá và điều kiện sử
  dụng khác nhau.
- Giữ nguyên đơn vị “lượt/giờ” của ô tô theo tiêu đề bảng nguồn; không tự
  tạo quy tắc làm tròn hoặc công thức hóa đơn.
- Tách đăng ký thuê bao, thời hạn 30 ngày, thời gian tính phí tháng và nghĩa
  vụ tuân thủ thành các section riêng.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Cung cấp coverage chính cho `I-02 — Phương tiện/thẻ xe` qua prefix
  `PARKFEE-*`.
- Đây là phí dịch vụ trông giữ xe/sạc xe hai bánh; không dùng làm phí cấp,
  cấp lại hoặc đổi Thẻ gửi xe trong `CARD-PARK-*`.
- Trước khi trả lời phải xác định địa điểm, gửi theo tháng hay vãng lai,
  loại xe và khung giờ nếu là vãng lai.
- ResidentGPT được nêu mức phí có citation nhưng không tự tính tổng hóa
  đơn, ngày kích hoạt, ngày dừng hoặc nghĩa vụ thanh toán của case cụ thể.

### Source observations and gaps

1. Không có quy tắc làm tròn giờ hoặc cách tính tổng tiền ô tô vãng lai.
2. Không có phí vãng lai riêng cho xe đạp/xe đạp điện hoặc phí sạc ô tô
   điện.
3. Mức ô tô Hải Âu 3 là ưu đãi từ 01/08/2025 đến khi có thông báo mới; cần
   BQL xác nhận độ mới trước khi áp dụng.
4. Nguồn chưa có hồ sơ đăng ký, SLA phê duyệt hoặc thao tác đổi/hủy thuê
   bao tháng.
5. Hotline và email không xuất hiện nên không bổ sung vào canonical.

### Legal and asset-handling decision

- `PARKFEE-CASUAL-30D-01` chỉ dùng để nhận diện tình huống xe vãng lai trên
  30 ngày. ResidentGPT không được xác định quyền sở hữu, hết hạn, từ bỏ tài
  sản, thanh lý, tiêu hủy hoặc tranh chấp; phải chuyển BQL và log
  `legal_or_compensation_escalation`.

## REVIEW-022 — OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001

- **Review date:** 2026-09-19
- **Document:** `OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về thanh toán, dữ liệu cá nhân, công nợ và chế tài
- **Property scope:** Căn hộ và Nhà ở tại Khu Đô thị Vinhomes Ocean Park
- **Area type:** `multi_property_resident_billing`
- **Service type:** `monthly_service_fee_payment`
- **Audience:** Chủ sở hữu và Cư dân chịu trách nhiệm thanh toán
- **Issued at:** 2026-02-27
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; không có địa chỉ/số cụ thể trong nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII:** Không có giá trị PII cụ thể
- **Source completeness:** `Complete` theo nội dung được cung cấp

### Validation basis

Người dùng xác nhận ngày ban hành, nguồn chính thức, trạng thái mới nhất và
đang có hiệu lực, không có văn bản thay thế, không có số phiên bản, quyền
sử dụng cho MVP và độ mới của hotline/email. Bản raw được giữ nguyên để
đối chiếu.

### Normalization performed

- Tách thanh toán qua ứng dụng và chuyển khoản ngân hàng thành các section
  riêng.
- Giữ thông tin tài khoản trong raw để audit nhưng loại
  `MONTHPAY-BANK-02` khỏi RAG.
- Tách cấu trúc nội dung chuyển khoản khỏi thông tin tài khoản nhận tiền.
- Tách ba lần thông báo với kênh gửi, ngày gửi và hạn thanh toán riêng.
- Tách dữ liệu liên hệ đã đăng ký, thay đổi lịch Lễ/Tết, chế tài, sai lệch
  sau thanh toán và nghĩa vụ kiểm tra thông báo thành các section riêng.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do BQL ban hành.

### Scope and coverage decision

- Cung cấp coverage cho `I-05 — Nội quy sinh hoạt` đối với thanh toán phí
  quản lý và khoản phát sinh hằng tháng.
- Cung cấp coverage có điều kiện cho `I-02 — Phương tiện/thẻ xe` khi câu
  hỏi liên quan cách thanh toán phí gửi xe đã xuất hóa đơn.
- Tài liệu không chứa mức phí và không dùng để tính công nợ; số tiền phải
  lấy từ hóa đơn hoặc thông báo chính thức.
- Câu hỏi yêu cầu xác nhận đã thanh toán, số dư, công nợ hoặc tranh chấp
  hóa đơn phải chuyển BQL.

### Privacy, payment and enforcement decisions

- ResidentGPT không thu thập tài khoản/mật khẩu ứng dụng, OTP, thông tin
  thẻ ngân hàng, mã căn thật, ảnh hóa đơn, mã giao dịch hoặc sao kê.
- Chỉ hướng dẫn cấu trúc nội dung chuyển khoản; không yêu cầu người dùng
  cung cấp mã căn vào chat.
- Người dùng phải xác minh tài khoản nhận tiền trên hóa đơn, ứng dụng hoặc
  trực tiếp với BQL trước khi giao dịch.
- `MONTHPAY-NOTICE-03` chỉ mô tả lịch thông báo lần 3, không cho phép AI
  kết luận một Căn sẽ hoặc đã bị ngừng dịch vụ.
- `MONTHPAY-ENF-01` không được dùng để xác định công nợ, vi phạm hoặc chế
  tài; phải chuyển BQL và log `legal_or_compensation_escalation`.

### Source gaps

- Chưa có thao tác chi tiết trong tính năng “Hóa đơn”.
- Chưa có thời gian ghi nhận giao dịch, quy trình thanh toán một phần hoặc
  xử lý khoản phí đang khiếu nại.
- Chưa có quy trình cập nhật email/số điện thoại nhận thông báo.
- Không nêu loại chế tài cụ thể hoặc điều kiện ngừng dịch vụ.

## REVIEW-023 — VINHOMES-CUSTOMER-REQUEST-HANDLING-001

- **Review date:** 2026-09-19
- **Document:** `VINHOMES-CUSTOMER-REQUEST-HANDLING-001`
- **Canonical revision:** `1.0`
- **Result:** Approved for ResidentGPT MVP với guard về SLA, dữ liệu cá nhân, an toàn tính mạng, tranh chấp và bồi thường
- **Organization scope:** Tất cả dự án và bộ phận thuộc Công ty Cổ phần Vinhomes
- **Applicable property:** Khu Đô thị Vinhomes Ocean Park
- **Process type:** `customer_request_and_complaint_handling`
- **Audience:** Khách hàng/Cư dân và các đơn vị tiếp nhận, xử lý nội bộ
- **Issued at:** Không được cung cấp
- **Last updated at:** 2025-05-05
- **Source version:** Không có số phiên bản
- **Notice number:** Không được cung cấp trong nội dung nguồn
- **Current/latest status:** Được xác nhận là phiên bản mới nhất và đang có hiệu lực
- **Source channel:** Kênh nội quy chính thức trên ứng dụng Vinhomes
- **Superseded:** Hiện không có văn bản mới thay thế
- **Contact freshness:** Hotline và email được xác nhận còn hiện hành; cả hai xuất hiện trong nguồn
- **MVP permission:** Được phép sử dụng
- **Resident PII in source:** Không có
- **Source completeness:** `Complete` theo nội dung được cung cấp

### Validation basis

Nguồn tự nêu đơn vị phát hành, phạm vi áp dụng cho toàn bộ dự án/bộ phận
thuộc Công ty Cổ phần Vinhomes và ngày cập nhật gần nhất 05/05/2025. Người
dùng xác nhận nguồn chính thức, trạng thái mới nhất/đang có hiệu lực, không
có văn bản thay thế, không có số phiên bản, quyền sử dụng cho MVP và độ mới
của hotline/email. Bản raw được giữ riêng để đối chiếu.

### Normalization performed

- Tạo 29 section `CASE-*` có thể truy vết độc lập.
- Tách bốn kênh tiếp nhận: điện thoại, email, bản cứng và phản ánh trực tiếp.
- Tách từng mốc SLA của điện thoại, email và bản cứng thay vì gộp thành một
  đoạn dài.
- Chuẩn hóa hotline thành `1900 232 389 (nhánh số 4)` nhưng giữ cùng chuỗi
  số `1900232389` như nguồn.
- Tách quy trình nội bộ, sự vụ đã khởi kiện, bốn trường hợp SLA, tổng kết và
  quy định với KH dễ bị tổn thương.
- Thêm intent, risk level, answer policy và scope dưới dạng curator
  metadata; đây không phải nội dung do Công ty phát hành.

### Scope and routing decision

- Nguồn dùng chung cho `I-01`–`I-05` khi người dùng hỏi cách gửi yêu cầu,
  khiếu nại, kênh liên hệ, trình tự hoặc thời gian xử lý chung.
- Các mốc 04 giờ, 08 giờ, 24 giờ, 04 ngày và 06 ngày là tiêu chuẩn quy trình
  chung; ResidentGPT không được biến chúng thành cam kết cho case cụ thể.
- Nguồn không có tiêu chí phân loại “đơn giản” và “phức tạp”; hệ thống không
  tự gán loại case.
- Nguồn không cung cấp CNPQ; hệ thống không suy đoán thẩm quyền hoặc phương
  án xử lý nội bộ.
- Địa chỉ nhận bản cứng không có trong nguồn nên phải hỏi/xác nhận với
  BQL/Tổng đài, không tự ghép địa chỉ từ nguồn khác.

### Safety, legal and privacy decisions

- Yêu cầu khẩn/gấp liên quan an toàn tính mạng phải chuyển xử lý ngay qua
  nhân viên tại chỗ/BQL, cứu hộ, an ninh hoặc dịch vụ khẩn cấp phù hợp;
  không đi theo flow FAQ thông thường.
- Sự vụ đã khởi kiện phải chuyển BQL/Pháp chế; AI không đưa ra tư vấn hoặc
  kết luận pháp lý.
- ResidentGPT không xác định lỗi, trách nhiệm, thiệt hại, quan hệ nhân quả,
  kết quả tranh chấp hoặc bồi thường; log
  `legal_or_compensation_escalation`.
- Hệ thống có thể nêu các nhóm KH dễ bị tổn thương theo nguồn nhưng không
  tự xác định tình trạng pháp lý/sức khỏe của cá nhân và không thu thập hồ
  sơ chứng minh.
- MVP không thu thập nội dung hồ sơ khiếu nại, dữ liệu định danh, hồ sơ sức
  khỏe, chứng cứ pháp lý hoặc tài liệu tranh chấp.

### Source observations and gaps

1. Không có ngày phát hành ban đầu; chỉ có ngày cập nhật gần nhất.
2. Từ viết tắt `NTD` được sử dụng nhưng không được định nghĩa.
3. Không có địa chỉ Công ty để nhận bản cứng.
4. Không có tiêu chí phân loại yêu cầu đơn giản/phức tạp hoặc mức độ sự vụ.
5. Không có nội dung CNPQ, quy tắc tính ngày làm việc đầy đủ, tra cứu mã
   case hoặc cách gửi hồ sơ kèm theo.
