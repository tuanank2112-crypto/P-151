# ResidentGPT — MVP Data Scope Lock v1.0

> **Status:** FROZEN  
> **Knowledge Pack revision:** `1.18`  
> **Baseline prepared:** 19/09/2026  
> **Freeze effective date:** 20/09/2026  
> **MVP deadline:** 27/09/2026  
> **Property target:** Vinhomes Ocean Park  
> **Intended use:** MVP demo và offline evaluation  
> **Decision:** GO cho implementation và offline evaluation trong phạm vi
> được khóa tại tài liệu này.

## 1. Mục đích khóa dữ liệu

Tài liệu này chốt tập dữ liệu mà ResidentGPT được phép sử dụng trong MVP,
phạm vi câu hỏi có thể tạo substantive answer draft, các khoảng trống bắt
buộc clarification/manual handling và quy trình thay đổi sau thời điểm
freeze.

Data freeze không có nghĩa Knowledge Pack đã bao phủ mọi nội quy, tiện ích
hoặc nghiệp vụ của Vinhomes Ocean Park. Data freeze có nghĩa phạm vi dữ liệu
đủ ổn định để đội dự án bắt đầu ingestion, retrieval, prompt integration và
offline evaluation mà không tiếp tục mở rộng source trước deadline MVP.

## 2. Source of truth

Các file sau là nguồn kiểm soát chính thức của baseline `1.18`:

- [Knowledge manifest](../knowledge/manifest.yaml): danh sách tài liệu,
  metadata, trạng thái, hiệu lực và quyền sử dụng cho RAG.
- [Intent source map](../knowledge/intent_source_map.yaml): ánh xạ năm intent,
  section được phép dùng, scope constraint, conflict và safety policy.
- [Knowledge review log](../knowledge/review/review_log.md): bằng chứng review,
  normalization và quyết định phê duyệt.
- [Knowledge Pack README](../knowledge/README.md): quy tắc vận hành và cập
  nhật nguồn.
- [PRD ResidentGPT MVP](PRD_ResidentGPT_MVP.md): product scope, acceptance
  criteria và metric gate.

Nếu tài liệu này và dữ liệu kỹ thuật không đồng nhất, `manifest.yaml` và
`intent_source_map.yaml` tại revision `1.18` quyết định source nào được
index và cách hệ thống phải xử lý.

## 3. Baseline đã khóa

Baseline `1.18` gồm:

- **21** tài liệu raw dùng để đối chiếu nguồn.
- **21** tài liệu canonical Markdown có section ID và curator metadata.
- **21/21** tài liệu có `status: Approved`.
- **21/21** tài liệu có `effective_status: Current`.
- **21/21** tài liệu có `allowed_for_rag: true` ở cấp tài liệu.
- Không chứa dữ liệu cá nhân thật của cư dân.
- Có source mapping cho cả năm Provisional MVP Intents.

Điều kiện `allowed_for_rag: true` ở cấp tài liệu không ghi đè các section bị
loại, section mâu thuẫn, scope constraint hoặc safety policy trong
`intent_source_map.yaml`.

## 4. Danh mục tài liệu trong baseline

### 4.1. Nội quy nền tảng và phạm vi bất động sản

- `OCP1-BUILDING-RULES-001` — Nội quy quản lý sử dụng Tòa nhà.
- `OCP1-PARKING-RULES-001` — Nội quy trông giữ xe.
- `OCP1-COMMERCIAL-AREA-RULES-001` — Nội quy Khu Thương mại dịch vụ.
- `OCP1-VILLA-HOUSING-RULES-001` — Nội quy Khu Biệt thự/Khu Nhà ở.
- `OCP1-VILLA-BUSINESS-RULES-001` — Quy định kinh doanh tại Khu Biệt
  thự/Khu Nhà ở.

### 4.2. Tiện ích

- `OCP1-POOL-RULES-001` — Nội quy bể bơi.
- `OCP1-KAYAK-DOCK-RULES-001` — Nội quy Bến Thuyền Kayak.
- `OCP1-SPORTS-COMPLEX-RULES-001` — Nội quy Khu phức hợp Thể thao.
- `OCP1-CHILDREN-PLAYGROUND-RULES-001` — Nội quy Sân chơi trẻ em.
- `OCP1-OUTDOOR-GYM-RULES-001` — Nội quy Gym ngoài trời.
- `OCP1-SALTWATER-LAKE-RULES-001` — Nội quy Biển hồ nước mặn.
- `OCP1-BBQ-GARDEN-RULES-001` — Nội quy Vườn Nướng BBQ.
- `OCP1-FISHING-DECK-RULES-001` — Nội quy Sàn Câu cá.

### 4.3. Thủ tục, phí và hỗ trợ vận hành

- `OCP1-APARTMENT-CONSTRUCTION-GUIDE-001` — Hướng dẫn và hồ sơ đăng ký thi
  công Căn hộ.
- `OCP1-APARTMENT-CONSTRUCTION-RULES-001` — Nội quy thi công Khu Căn hộ.
- `OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001` — Cấp phát thẻ cho Cư dân.
- `OCP1-MOVE-IN-OUT-GUIDE-001` — Hướng dẫn đăng ký chuyển đồ ra/vào Tòa
  nhà.
- `OCP1-BQL-OFFICE-DIRECTORY-001` — Địa chỉ và giờ làm việc của Văn phòng
  BQL.
- `OCP1-PARKING-FEE-SCHEDULE-001` — Phí trông giữ xe.
- `OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001` — Hướng dẫn thanh toán các khoản phí
  hằng tháng.
- `VINHOMES-CUSTOMER-REQUEST-HANDLING-001` — Quy định xử lý khiếu nại/yêu
  cầu của Khách hàng.

## 5. Answerable scope đã khóa theo intent

### I-01 — Thẻ Cư dân/ra vào

ResidentGPT có thể tạo draft có nguồn cho:

- Chức năng và đối tượng được cấp Thẻ Cư dân, Thẻ Ra vào.
- Hạn mức đã nêu rõ trong nguồn.
- Phí cấp mới, cấp lại hoặc đổi thẻ khi nguồn có mức phí.
- Kênh đăng ký chung qua ứng dụng Vinhomes Resident.
- Thu hồi, báo mất hoặc hủy thẻ ở mức quy trình chung.

Phải clarification hoặc manual handling đối với:

- Quyền truy cập hoặc credential của cá nhân/căn cụ thể.
- Hồ sơ chi tiết và thao tác từng bước trên ứng dụng chưa có trong nguồn.
- Thời gian xử lý, thời hạn sử dụng, gia hạn hoặc cấp vượt hạn mức.
- Trường hợp Căn hộ hai phòng ngủ khi câu chữ nguồn không đủ rõ.

### I-02 — Phương tiện/thẻ xe

ResidentGPT có thể tạo draft có nguồn cho:

- Nội quy trông giữ xe và nghĩa vụ chung của người gửi xe.
- Mức phí tháng hoặc vãng lai đã công bố, sau khi xác định đúng địa điểm,
  loại xe, hình thức gửi và khung giờ.
- Phí sạc xe hai bánh đã có trong biểu phí.
- Phân biệt phí dịch vụ trông giữ xe với phí cấp/cấp lại Thẻ gửi xe.
- Kênh thanh toán phí hằng tháng ở mức hướng dẫn chung.

Phải clarification hoặc manual handling đối với:

- Hồ sơ đăng ký mới thuê bao xe tháng chưa có trong nguồn.
- Phí cấp/cấp lại/đổi thẻ hoặc thuê bao xe máy bị thiếu.
- Tự tính tổng hóa đơn, làm tròn giờ hoặc xác định công nợ thực tế.
- Phí vãng lai xe đạp/xe đạp điện hoặc phí sạc ô tô điện chưa được cung cấp.
- Quyền sở hữu, xử lý tài sản hoặc tranh chấp đối với xe để quá thời hạn.

### I-03 — Tiện ích chung

ResidentGPT có thể tạo draft có nguồn cho tám tiện ích đã liệt kê tại Mục
4.2, bao gồm giờ hoạt động, điều kiện sử dụng, đặt lịch/mua vé nếu có,
quy tắc an toàn và hành vi bị cấm.

Phải clarification hoặc manual handling đối với:

- Tiện ích không nằm trong danh mục nguồn đã khóa.
- Mức phí, cách đăng ký hoặc ngoại lệ không xuất hiện trong nguồn.
- Tình trạng mở cửa theo ngày đặc biệt, bảo trì hoặc thông báo vận hành mới.
- Quyết định từ chối phục vụ, ngừng dịch vụ, tai nạn, trách nhiệm hoặc hoàn
  tiền của case cụ thể.

### I-04 — Chuyển đồ/thi công

ResidentGPT có thể tạo draft có nguồn cho:

- Đăng ký và vận chuyển đồ sinh hoạt ra/vào các Tòa nhà được nguồn liệt kê.
- Khung giờ, tuyến vận chuyển, yêu cầu giấy/QR được duyệt và quy định về xe.
- Hồ sơ, trình tự, giờ thi công và nội quy thi công **Khu Căn hộ**.
- Yêu cầu an toàn, PCCC, vệ sinh, vận chuyển vật tư và rác thi công ở mức
  quy định chung.

Phải clarification hoặc manual handling đối với:

- Khi chưa rõ là chuyển đồ sinh hoạt hay vận chuyển phục vụ thi công.
- Phê duyệt hồ sơ, nghiệm thu, hoàn/khấu trừ đặt cọc hoặc xử lý vi phạm.
- Thi công Biệt thự, Nhà liền kề, Shop hoặc Shophouse do chưa có source đúng
  phạm vi riêng.
- Mẫu biểu, địa điểm nộp, SLA sửa/hủy đăng ký hoặc thông tin chưa xuất hiện
  trong nguồn.
- Các mốc ngày, phí hoặc tải trọng đang cần BQL xác nhận.

### I-05 — Nội quy sinh hoạt

ResidentGPT có thể tạo draft có nguồn cho:

- Nội quy sinh hoạt và sử dụng Tòa nhà.
- Quy định tiếng ồn, vệ sinh, vật nuôi, tài sản chung, an toàn và hành vi bị
  cấm.
- Nội quy đúng phạm vi Khu Thương mại dịch vụ hoặc Khu Biệt thự/Khu Nhà ở.
- Quy định kinh doanh tại Khu Biệt thự/Khu Nhà ở khi bối cảnh khớp.
- Lịch thông báo và kênh thanh toán phí hằng tháng ở mức quy trình chung.
- Kênh tiếp nhận và SLA chung của quy trình khiếu nại/yêu cầu.

Phải clarification hoặc manual handling đối với:

- Quyết định chế tài hoặc mức xử lý cho cá nhân/căn cụ thể.
- Ngoại lệ vận hành chưa có nguồn theo từng Tòa nhà.
- Xác định công nợ, nghĩa vụ thanh toán hoặc tình trạng ngừng dịch vụ.
- Kết quả khiếu nại, lỗi, trách nhiệm, tranh chấp hoặc bồi thường.

## 6. Nguồn dùng chung cho năm intent

Các nguồn sau có thể hỗ trợ nhiều intent nhưng chỉ trong đúng chức năng:

- `OCP1-BQL-OFFICE-DIRECTORY-001`: địa chỉ và giờ làm việc của BQL; phải
  biết cụm/Khối nhà trước khi chọn địa điểm.
- `VINHOMES-CUSTOMER-REQUEST-HANDLING-001`: kênh tiếp nhận, trình tự và SLA
  chung; không dùng để hứa thời hạn hoặc quyết định kết quả của case.
- `OCP1-MONTHLY-FEE-PAYMENT-GUIDE-001`: chỉ dùng cho intent có liên quan
  thanh toán phí hằng tháng; không dùng để xác định số dư/công nợ.

Danh bạ đầy đủ của điện, nước, phòng khám và các bộ phận chuyên môn chưa có
trong baseline. Hệ thống không được tự tạo số liên hệ hoặc ghép từ nguồn
không được phê duyệt.

## 7. Eligibility và retrieval rules bắt buộc

Một section chỉ được dùng để tạo substantive answer draft khi đồng thời:

1. Tài liệu có `status: Approved`.
2. Tài liệu có `effective_status: Current` hoặc khoảng hiệu lực hợp lệ.
3. Tài liệu có `allowed_for_rag: true`.
4. Section không bị exclude hoặc conflict.
5. Phạm vi dự án, loại bất động sản, tiện ích và đối tượng khớp câu hỏi.
6. Có thể truy vết đến `document_id` và `section_id`.
7. Không cần xác minh danh tính hoặc dữ liệu account/căn cụ thể.

Khi không thỏa đủ điều kiện:

- Thiếu required context → clarification, không đoán.
- Intent ngoài năm intent → unsupported và manual handling.
- Không có Approved/current source → safe fallback và manual handling.
- Hai nguồn hợp lệ mâu thuẫn → `source_conflict`, không tự chọn nguồn.
- Source hết hiệu lực hoặc không xác định được độ mới → không tạo
  substantive answer draft.
- Input có obvious PII/account-specific data cần xác minh → không xử lý nội
  dung cá nhân hóa và không yêu cầu thêm PII.

## 8. Hard-block và safety routing

ResidentGPT không được tạo substantive answer draft cho:

- Bồi thường.
- Tranh chấp.
- Diễn giải hoặc kết luận pháp lý.
- Xác định trách nhiệm hoặc lỗi.
- Quyết định chế tài/xử phạt cá nhân.
- Sự vụ đã khởi kiện.

Các trường hợp này phải đề xuất chuyển BQL/Pháp chế và ghi reason code
`legal_or_compensation_escalation`.

Yêu cầu khẩn/gấp liên quan an toàn tính mạng phải được hướng dẫn chuyển xử
lý ngay qua nhân viên tại chỗ/BQL, cứu hộ, an ninh hoặc dịch vụ khẩn cấp
phù hợp; không đi theo flow FAQ thông thường.

## 9. Section bị loại hoặc bị khóa do mâu thuẫn

Các section sau không được tự động dùng để tạo draft:

- `COMM-03C` — nội dung sai phạm vi tài liệu Khu Thương mại dịch vụ.
- `KAYAK-II-05` — nội dung nhắc sai phạm vi Vườn Nướng.
- `BBQ-SAN-05` — mâu thuẫn về số người sử dụng Vườn Nướng.
- `ACON-II-01X` và `ACON-NOTE-04X` — nội dung Shop/Shophouse nằm ngoài
  phạm vi hướng dẫn thi công Căn hộ.
- `APTC-PAY-02` — thông tin thanh toán bị loại khỏi RAG.
- `APTC-EFF-01` — mốc hiệu lực chưa thống nhất.
- `MONTHPAY-BANK-02` — thông tin tài khoản ngân hàng giữ để audit nhưng bị
  loại khỏi RAG.

Các section được đánh dấu conflicted hoặc ambiguous khác trong
`intent_source_map.yaml` phải tuân theo `conflict_behavior` hoặc
`clarification_behavior` tương ứng. Danh sách kỹ thuật trong file map là
nguồn quyết định khi ingestion.

## 10. Known gaps được chấp nhận khi freeze

Những khoảng trống sau được chấp nhận và không chặn MVP:

1. Chưa có dữ liệu thi công riêng cho Biệt thự, Nhà liền kề, Shop và
   Shophouse.
2. Chưa có danh bạ đầy đủ của điện, nước, phòng khám và bộ phận chuyên môn.
3. Chưa có đầy đủ mẫu biểu hoặc thao tác chi tiết trên ứng dụng.
4. Chưa có danh mục tổng thể của mọi tiện ích tại Khu Đô thị.
5. Chưa có tiêu chí phân loại khiếu nại “đơn giản/phức tạp”, địa chỉ nhận
   bản cứng hoặc định nghĩa từ viết tắt `NTD`.
6. Một số mức phí, hạn mức, tải trọng, mốc ngày hoặc điều kiện vận hành còn
   cần BQL xác nhận và đã được gắn guard.
7. Không có dữ liệu account/case/công nợ thật và không dùng dữ liệu cư dân
   thật trong MVP demo/evaluation.

Các câu hỏi rơi vào known gap phải clarification nếu có thể bổ sung context
để chọn source; nếu thiếu knowledge hoặc cần quyết định con người thì phải
manual handling. Không được coi known gap là lý do để hallucinate.

## 11. Quy tắc thay đổi sau freeze

Từ ngày freeze, không bổ sung thêm nhóm dữ liệu hoặc mở rộng answerable
scope cho MVP. Feature hoặc source mới được đưa vào Post-MVP Backlog.

Chỉ được mở lại baseline khi có một trong các điều kiện:

- Phát hiện sai lệch giữa raw và canonical.
- Phát hiện lỗi có thể gây trả lời nguy hiểm hoặc sai phạm vi.
- Có văn bản chính thức mới thay thế hoặc thay đổi hiệu lực.
- Có lỗi metadata, mapping hoặc exclusion làm retrieval sai.

Khi có thay đổi material:

1. Không ghi đè hoặc xóa bản raw cũ.
2. Capture nguồn mới với `document_id` ổn định hoặc tạo document/version
   mới theo loại thay đổi.
3. Cập nhật canonical và review log.
4. Cập nhật manifest và intent source map.
5. Tăng Knowledge Pack revision từ `1.18` lên revision tiếp theo.
6. Chạy lại ingestion và regression evaluation cho các case bị ảnh hưởng.

Không được silently edit dữ liệu đã freeze mà không tăng revision và không
ghi review log.

## 12. Điều kiện sử dụng baseline trong MVP

Baseline `1.18` được phép dùng cho implementation và offline evaluation khi:

- Retrieval index chỉ chứa source/section đủ điều kiện.
- Evaluation set chỉ kỳ vọng substantive answer cho nội dung thuộc
  answerable scope đã khóa.
- Known gaps, source conflict, unsupported và high-risk case được pre-label
  clarification hoặc escalation đúng loại.
- Mọi draft có citation đến source và section hợp lệ.
- Không sử dụng dữ liệu cư dân thật.
- BQL/CSKH review và explicit Approve trước khi Copy hoặc sử dụng draft.

## 13. Freeze decision

**Knowledge Pack revision `1.18` được FROZEN cho ResidentGPT MVP.**

Quyết định này:

- Cho phép bắt đầu ingestion, retrieval, prompt implementation và xây dựng
  evaluation set.
- Không xác nhận Knowledge Pack đầy đủ cho production.
- Không cho phép mở rộng answerable scope ngoài tài liệu này.
- Không thay thế các quality/safety gate trong PRD.
- Không phải phê duyệt Controlled Pilot hoặc Production release.

Controlled Pilot chỉ được xem xét sau khi evaluation set đã khóa và kết quả
đạt các ngưỡng trong PRD, bao gồm Answer Quality tối thiểu **85%** và
Correct Safe Behavior Rate tối thiểu **90%**.
