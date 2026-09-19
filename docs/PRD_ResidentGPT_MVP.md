# PRD — ResidentGPT MVP: Trợ lý soạn thảo FAQ cư dân

> **Document status:** FROZEN FOR MVP v0.2 — consistency alignment amendment; không mở rộng feature scope. **Nguồn:** `Problem_Card.md`, `Product_Brief_ResidentGPT_MVP.md`. **Nhãn:** FACT = đã có trong nguồn; HYPOTHESIS = cần MVP kiểm chứng; ASSUMPTION/TBD = chưa xác thực.
> **Alignment log:** `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md`

**Intent reference (5 Provisional MVP Intents — PM/SME-frozen cho vòng MVP evaluation này):** I-01 Thẻ cư dân/ra vào; I-02 Phương tiện/thẻ xe; I-03 Tiện ích chung; I-04 Chuyển đồ/thi công; I-05 Nội quy sinh hoạt. Việc đây có phải top production intents theo volume hay không vẫn là assumption cần validation.

**Metric reference:** M1 Answer Quality; M2 Efficiency; M3 Safety.

**Scope reference:** `knowledge_coverage_scope = VINHOMES_OCEAN_PARK` theo Knowledge Pack revision `1.18`; `pilot_operator_scope = BQL/CSKH của một cụm/tòa được chọn tại Vinhomes Ocean Park 1`. Knowledge coverage rộng hơn pilot operator scope không đồng nghĩa hỗ trợ multi-site; mọi câu trả lời vẫn phải khớp cụm/tòa, loại bất động sản hoặc khu vực của source.

**Evaluation baseline:** Golden Dataset revision `0.1` gồm 50 FAQ component cases và 30 E2E product-flow cases, đã được business/product/technical review, ghi approval và chuyển sang `Frozen` ngày 19/09/2026 cho MVP demo/offline evaluation.

## MVP Scope Freeze v0.1

Document amendment `v0.2` chỉ đồng bộ contract/metadata/evaluation đã được
chốt sau khi tạo Knowledge Pack và Golden Dataset; không thêm feature vào
MVP Scope Freeze `v0.1`.

**Frozen date:** 20/09/2026  
**MVP deadline:** 27/09/2026  
**Source of truth:** `docs/PRD_ResidentGPT_MVP.md`  
**Knowledge baseline:** `docs/MVP_DATA_SCOPE_LOCK.md`, revision `1.18`

### Mục tiêu MVP

Chứng minh AI có thể giúp nhân viên BQL/CSKH xác định intent,
tìm đúng thông tin đang có hiệu lực và tạo draft có nguồn nhanh
hơn quy trình tra cứu, soạn thảo thủ công.

Mọi AI output chỉ là draft. Nhân viên BQL/CSKH phải review,
có thể edit và phải chủ động Approve trước khi Copy hoặc sử dụng.

### Chúng ta sẽ build

1. Nhân viên BQL/CSKH nhập hoặc paste câu hỏi của cư dân.

2. Hệ thống xử lý năm Provisional MVP Intents:

   - I-01: Thẻ cư dân/ra vào.
   - I-02: Phương tiện/thẻ xe.
   - I-03: Tiện ích chung.
   - I-04: Chuyển đồ/thi công.
   - I-05: Nội quy sinh hoạt.

3. Hệ thống xác định intent hoặc trả trạng thái
   `unresolved/unsupported` khi không đủ căn cứ.

4. Khi thiếu required context, hệ thống yêu cầu bổ sung thông tin
   và không tự đoán câu trả lời.

5. Hệ thống chỉ sử dụng nguồn đáp ứng đầy đủ các điều kiện:

   - Status = Approved.
   - Đang có hiệu lực.
   - Có thể truy vết.
   - Thuộc allowed official source list.

6. Hệ thống tạo AI draft có citation khi có đủ context và nguồn hợp lệ.

7. Nhân viên BQL/CSKH có thể review và chỉnh sửa draft.

8. BQL/CSKH phải thực hiện explicit Approve trước khi Copy hoặc sử dụng draft.

9. Các trường hợp unsupported, high-risk, PII/account-specific,
   không có nguồn, nguồn hết hiệu lực hoặc nguồn mâu thuẫn phải
   được safe fallback và Manual handling/Escalation.

10. Hệ thống ghi minimal evaluation log để đo Answer Quality,
    Efficiency và Safety.

### Chúng ta không build

- Tích hợp trực tiếp Zalo hoặc hotline.
- Tự động gửi câu trả lời cho cư dân.
- Full autonomous response.
- Authentication và hệ thống phân quyền phức tạp.
- CRM hoặc ticketing integration.
- Admin dashboard.
- Rich case-history hoặc analytics UI.
- Booking hoặc thanh toán.
- Multi-site/multi-tenant runtime cho nhiều khu đô thị hoặc nhiều đội vận hành; Knowledge Pack có thể bao phủ nhiều phân khu trong Vinhomes Ocean Park nhưng pilot operator scope vẫn là một cụm/tòa được chọn.
- Xử lý dữ liệu cư dân thật trong MVP demo/evaluation.
- Production privacy architecture hoàn chỉnh.

### MVP được coi là hoàn thành khi

1. Normal FAQ flow chạy end-to-end:

   `Input → Intent → Retrieval → Draft → Review/Edit → Approve → Copy`

2. Clarification flow chạy end-to-end:

   `Missing context → Clarification → Bổ sung context → Xử lý lại`

3. Escalation flow chạy end-to-end:

   `Risk/Unsupported/No source → Safe fallback → Manual handling`

4. Không có đường nào cho phép Copy draft trước explicit Approval.

5. Mọi substantive AI draft có ít nhất một Approved/current,
   traceable source thuộc allowed official source list.

6. Hệ thống không tạo substantive answer draft khi thiếu nguồn,
   nguồn không hợp lệ hoặc trường hợp cần xử lý thủ công.

7. Answer Quality đạt tối thiểu 85% trên evaluation set đã khóa.

8. Correct Safe Behavior Rate đạt tối thiểu 90% trên safety set
   đã được pre-label.

9. Evaluation log có đủ dữ liệu để truy vết và tính các metrics.

10. MVP đã được deploy và có URL dùng cho demo.

### Scope Change Rule

Mọi feature không nằm trong phần **Chúng ta sẽ build** phải được
chuyển sang Post-MVP Backlog.

Nếu đề xuất thêm một Must-have mới trước deadline, nhóm phải:

1. Chứng minh feature đó cần thiết để đạt MVP Goal.
2. Xác định Must-have hiện tại sẽ bị loại bỏ hoặc giảm phạm vi.
3. Đánh giá ảnh hưởng tới deadline 27/09/2026.
4. Được PM và Technical Owner đồng ý trước khi triển khai.

## 1. Product Summary

BQL/CSKH của một cụm/tòa được chọn tại Vinhomes Ocean Park 1 đang xử lý thủ công FAQ hành chính qua hotline và Zalo; bottleneck là hiểu đúng nhu cầu và tìm đúng thông tin còn hiệu lực. Knowledge Pack bao phủ Vinhomes Ocean Park 1 nhưng pilot operator scope vẫn là một cụm/tòa được chọn. Primary user là nhân viên BQL/CSKH; cư dân là affected user. MVP kiểm chứng giả thuyết **AI-assisted drafting**: hỗ trợ nhận diện intent, tra cứu Approved/current official sources và tạo AI draft để BQL review/edit rồi chủ động approve trước khi copy/gửi/sử dụng; không auto-send. Giá trị cần chứng minh là draft vừa đúng và có căn cứ, vừa giảm thời gian xử lý, đồng thời clarify, escalate hoặc safe fallback đúng theo từng tình huống. **[FACT + HYPOTHESIS]**

## 2. Persona

### Primary Persona

| Thuộc tính | Mô tả |
|---|---|
| Role | Nhân viên BQL/CSKH — operator của MVP. |
| Context | Tiếp nhận câu hỏi cư dân qua hotline/Zalo tại một cụm/tòa pilot được chọn trong Vinhomes Ocean Park 1; source có thể bao phủ toàn Khu Đô thị nhưng phải được lọc đúng phạm vi. |
| Goals | Hiểu nhanh câu hỏi; dùng đúng Approved/current official sources; trả lời nhất quán; biết khi nào clarify/escalate. |
| Pain points | Phải tự xác định intent, tra cứu phiên bản tài liệu và soạn trả lời; có nguy cơ chậm hoặc không nhất quán. |
| Current behavior | Nhận câu hỏi → xác định intent → bổ sung context → tra cứu → soạn → chuyển bộ phận khi chưa chắc → trả lời. |
| Constraints | Chỉ dùng source có Status = Approved, còn current/effective, traceable và thuộc allowed official source list; không tự quyết case high-risk; phải review/edit và chủ động approve trước khi copy/gửi/sử dụng draft. |
| What success looks like | Hoàn tất draft được duyệt nhanh hơn manual, có nguồn kiểm chứng và fallback đúng lúc. **[HYPOTHESIS; đo bằng M1–M3]** |

### Secondary Persona

**Cư dân** gửi câu hỏi và cần hướng dẫn rõ ràng, kịp thời, đáng tin cậy. Cư dân không trực tiếp vận hành MVP và không nhận phản hồi tự động từ hệ thống trong scope hiện tại.

## 3. Jobs To Be Done (JTBD)

| Loại | JTBD | Trace |
|---|---|---|
| Functional | When tôi nhận câu hỏi của cư dân, I want to hiểu nhanh họ đang hỏi gì, so I can bắt đầu đúng quy trình. | Bottleneck; I-01…I-05 |
| Functional | When tôi cần trả lời FAQ, I want to tìm đúng Approved/current official source, so I can tránh dùng nội dung sai/lỗi thời. | Problem; M1 |
| Functional | When đã có đủ context và Approved/current official source, I want to có draft phản hồi, so I can review và hoàn tất nhanh hơn. | Solution hypothesis; M2 |
| Safety/Control | When câu hỏi thiếu dữ liệu, I want to biết cần hỏi lại gì, so I can không tự suy đoán. | M3 |
| Safety/Control | When case out of answerable scope (unsupported, high-risk, no/conflicting/expired/unknown evidence), I want hệ thống vẫn xử lý trong safety-handling scope bằng safe fallback và escalation đúng lý do, so I can xử lý thủ công an toàn. | Out of Answerable Scope; In Safety-Handling Scope; M3 |

## 4. MVP User Stories

### A. Core flow

| ID | User story | Priority | Related intent | Metric |
|---|---|---|---|---|
| US-01 | As a BQL/CSKH user, I want nhập câu hỏi cư dân vào UI MVP, so that tôi có thể bắt đầu xử lý mà chưa cần tích hợp hotline/Zalo. | Must | I-01…I-05 | M2 |
| US-02 | As a BQL/CSKH user, I want xem intent được gợi ý hoặc trạng thái “chưa xác định”, so that tôi không áp dụng sai quy trình. | Must | I-01…I-05 | M1, M3 |
| US-03 | As a BQL/CSKH user, I want nhận draft dựa trên Approved/current official sources, so that tôi có thể hoàn tất câu trả lời nhanh và nhất quán. | Must | I-01…I-05 | M1, M2 |

### B. Clarification

| ID | User story | Priority | Related intent | Metric |
|---|---|---|---|---|
| US-04 | As a BQL/CSKH user, I want hệ thống nêu thông tin còn thiếu và gợi ý câu hỏi làm rõ, so that tôi không phải đoán. | Must | I-01…I-05 | M3 |

### C. Review/Edit

| ID | User story | Priority | Related intent | Metric |
|---|---|---|---|---|
| US-05 | As a BQL/CSKH user, I want review/edit rồi chủ động approve draft trước khi copy/gửi/sử dụng, so that con người giữ quyền kiểm soát câu trả lời được sử dụng. | Must | I-01…I-05 | M1, M2, M3 |

### D. Escalation/Fallback

| ID | User story | Priority | Related intent | Metric |
|---|---|---|---|---|
| US-06 | As a BQL/CSKH user, I want hệ thống không tạo substantive answer draft và nêu đúng lý do khi case out of answerable scope, đồng thời safe fallback/escalate trong safety-handling scope, so that tôi có thể xử lý/chuyển tuyến thủ công. | Must | All/Safety-handling | M3 |
| US-07 | As a BQL/CSKH user, I want đánh dấu case cần xử lý thủ công, so that trạng thái và lý do escalation/fallback được lưu lại. | Must | All/Safety-handling | M3 |

### E. Evidence/Source visibility

| ID | User story | Priority | Related intent | Metric |
|---|---|---|---|---|
| US-08 | As a BQL/CSKH user, I want thấy nguồn và đoạn căn cứ của draft, so that tôi có thể kiểm tra trước khi duyệt. | Must | I-01…I-05 | M1 |
| US-09 | As a BQL/CSKH user, I want mỗi case có minimal evaluation log từ query → intent/status → evidence → draft/edit → review/escalation/fallback, so that M1–M3 có thể được tái tạo và đánh giá. | Must | All/Safety-handling | M1, M2, M3 |

## 5. Functional Requirements

> Đây là **Product Requirements**. Safety behavior bắt buộc được tách tại Mục 8.

> **Scope semantics:** Unsupported intents, high-risk cases, no evidence, conflicting evidence và expired/unknown evidence là **Out of Answerable Scope**: hệ thống không được giải quyết nội dung hoặc tạo substantive answer draft. Các case này vẫn thuộc **In Safety-Handling Scope**: hệ thống bắt buộc nhận diện, không hallucinate, safe fallback, clarify khi đúng loại thiếu context, escalate khi cần và log reason/state.

| ID | Requirement | Description | Priority | Related user story | Acceptance note | Trace |
|---|---|---|---|---|---|---|
| FR-01 | Input intake | UI cho phép nhập/paste một câu hỏi và gửi xử lý. Không yêu cầu tích hợp hotline/Zalo. | Must | US-01 | Query hợp lệ tạo một case; input trống không được gửi. | Current workflow; M2 |
| FR-02 | Intent understanding | Gợi ý một trong 5 Provisional MVP Intents hoặc trạng thái unresolved/unsupported; không ép intent khi chưa đủ chắc chắn. Thiếu required context thì clarify; unsupported intent thì safe fallback/escalate theo Mục 8. Ngưỡng/logic: TBD. | Must | US-02 | Hiển thị intent hoặc safety state rõ ràng. | Bottleneck; M1, M3 |
| FR-03 | Context clarification | Nhận biết thiếu required context và tạo câu hỏi clarification thay cho substantive answer draft. Required-context contract được khóa tại Mục 5.1; field có hậu tố `when_relevant` chỉ bắt buộc khi câu hỏi/source cần phân biệt đó. | Must | US-04 | Có lý do và đúng thông tin cần bổ sung; không hỏi thêm PII không cần thiết. | Workflow; M3 |
| FR-04 | Knowledge retrieval | Một source chỉ được ground draft khi đồng thời có Status = Approved, current/effective, traceable và thuộc allowed official source list. Không dùng source Draft, Deprecated, Expired hoặc Unknown effective status. Không có relevant Approved/current source thì fallback/escalate. Hai Approved/current sources conflict thì hiển thị conflict, không tạo substantive answer draft và escalate. Không xác định được source nào current thì không tạo substantive answer draft và escalate. | Must | US-03, US-08 | Mỗi draft chỉ dùng Approved/current official sources đáp ứng đủ rule; mọi trạng thái bị loại có reason/state. | Problem; M1, M3 |
| FR-05 | AI-assisted drafting | Tạo bản nháp phù hợp câu hỏi/context và nội dung nguồn; gắn nhãn rõ “AI draft”. | Must | US-03 | Draft không được coi là phản hồi đã duyệt. | Solution hypothesis; M1, M2 |
| FR-06 | Source grounding | Hiển thị định danh/tên source, Status, phiên bản hoặc effective status/date và đoạn căn cứ liên quan để source luôn traceable. | Must | US-08 | BQL có thể đối chiếu draft với Approved/current evidence. | Risk; M1 |
| FR-07 | Review/Edit | Cho phép review/edit và chủ động đánh dấu “Approved by BQL”; chỉ sau approval mới cho copy/gửi/sử dụng. Lưu generated draft và edited/approved output nếu có để evaluation. | Must | US-05 | Không tự chuyển trạng thái sang Approved; không auto-send. | Human control; M1, M2, M3 |
| FR-08 | Escalation | Cho phép đánh dấu “Manual review/escalated” và lưu reason; không cần tích hợp ticketing. | Must | US-06, US-07 | Case có trạng thái và lý do escalation. | Workflow; M3 |
| FR-09 | Safety handling for out-of-answerable cases | Nhận biết unsupported intent, high-risk, no evidence, conflicting evidence, expired/unknown evidence và PII/account-specific case cần identity verification; không hallucinate hoặc tạo substantive answer draft; thực hiện đúng pre-labeled clarify/escalate/safe-fallback behavior và log reason/state. | Must | US-06 | Các case này out of answerable scope nhưng vẫn in safety-handling scope. | M3 |
| FR-10 | Minimal evaluation logging | Lưu tối thiểu: case ID; de-identified query where applicable; timestamps; detected intent/status; clarification state; evidence/source used; generated draft; edited/approved output nếu có; review status; escalation/fallback reason. Không cố ý persist unnecessary raw PII. | Must | US-09 | 100% eval case có các field áp dụng; export/cách truy xuất: TBD trước test. | M1, M2, M3 |

### 5.1. Required-context contract — Frozen for MVP v0.2

Các field dưới đây là danh mục context có thể bắt buộc theo intent. Hệ thống
chỉ hỏi field cần thiết để chọn đúng rule/source cho câu hỏi hiện tại; field
có hậu tố `when_relevant` là conditional, không bắt buộc cho mọi case. Không
được dùng clarification để yêu cầu thêm PII/account data không cần thiết.

| Intent | Required-context fields |
|---|---|
| I-01 — Thẻ cư dân/ra vào | `card_type`, `request_type`, `property_type`, `unit_type_when_limit_is_relevant` |
| I-02 — Phương tiện/thẻ xe | `parking_card_or_parking_service`, `facility_type`, `monthly_or_casual`, `vehicle_type`, `time_window_when_casual` |
| I-03 — Tiện ích chung | `amenity_type`, `amenity_variant_when_relevant`, `age_or_height_when_safety_relevant` |
| I-04 — Chuyển đồ/thi công | `moving_or_construction`, `property_type`, `building_or_area_when_relevant`, `work_type_when_construction_schedule_is_asked`, `requested_day_or_time_when_schedule_is_asked` |
| I-05 — Nội quy sinh hoạt | `rule_topic`, `apartment_commercial_or_villa_scope`, `general_rule_or_case_specific_decision` |

`evals/golden/dataset_manifest.yaml` revision `0.1` phải giữ cùng danh sách
này. Thay đổi material đối với required-context contract cần cập nhật PRD,
UI Flow, Golden Dataset và tăng revision phù hợp trước khi chạy lại evaluation.

## 6. Non-Functional Requirements

| ID | Nhóm | Requirement | Measurement / validation | Target | Trace |
|---|---|---|---|---|---|
| NFR-01 | Performance | UI phải hiển thị trạng thái đang xử lý và kết thúc bằng draft hoặc fallback; không treo im lặng. | Đo median/P95 từ submit đến trạng thái hoàn tất trên eval set. | Latency target: **TBD theo milestone**; không block khởi động build/MVP demo và không phải pilot hard gate. | Performance acceptance |
| NFR-02 | Reliability | Lỗi retrieval/model phải trả fallback có giải thích và cho phép retry/escalate; không trả màn hình trống. | Inject lỗi trong test; kiểm tra response và log. | 100% test case lỗi có fallback giải thích. | M3; fallback |
| NFR-03 | Explainability / Traceability | Mỗi draft phải truy vết được query → Approved/current official source và effective status/version → draft. Không có evidence đáp ứng source rule thì dùng fallback/escalate. | Audit log và UI trên eval set. | 100% draft được tạo có ít nhất một Approved/current, traceable evidence thuộc allowed official source list. | M1 |
| NFR-04 | Usability | BQL đọc được evidence, review/edit, chủ động approve rồi mới copy/gửi/sử dụng draft; phân biệt rõ “AI draft” với “Approved by BQL”. | Task-based demo cho toàn bộ core flow. | Tất cả bước bắt buộc hoàn thành được; tiêu chí UX chi tiết **TBD**. | Human control; M2, M3 |
| NFR-05 | Data / Privacy | Nếu input chứa obvious PII/account-specific information cần identity verification: không xử lý substantive content, không tạo substantive personalized answer draft và không coi là normal FAQ; hiển thị safe fallback và yêu cầu manual handling/escalation. Evaluation chỉ dùng synthetic hoặc de-identified data. Không cố ý persist unnecessary raw PII. Exact redaction/retention/access policy: **TBD trước real-user pilot**. | Test case PII + review bộ dữ liệu eval và log. | MVP demo/evaluation không bị block bởi production privacy architecture; mọi real-user pilot (Controlled hoặc Conditional) với data thật phải chờ policy được chốt. | Out of Answerable Scope; In Safety-Handling Scope; M3 |
| NFR-06 | Observability | Log phải đủ để tái tạo M1–M3, gồm timestamps và trạng thái safety/review. | Kiểm tra schema và completeness sau test run. | 100% eval case có các field bắt buộc của FR-10. | M1–M3 |

## 7. Acceptance Criteria

### A. Normal FAQ

- **AC-01:** Given câu hỏi thuộc 5 Provisional MVP Intents, đủ context và có Approved/current official source đáp ứng source rule, When hệ thống xử lý, Then hiển thị intent phù hợp, traceable evidence và grounded AI draft. **[FR-02, FR-04–06; M1]**
- **AC-02:** Given AI draft đã tạo, When BQL review/edit, Then BQL phải chủ động đánh dấu Approved trước khi copy/gửi/sử dụng; hệ thống không tự approve hoặc auto-send. **[FR-07; M2, M3]**
- **AC-03:** Given draft có factual claim, When BQL xem evidence, Then thấy định danh/tên source, Status, đoạn căn cứ và phiên bản hoặc effective status/date để xác nhận source là Approved/current và traceable. **[FR-06; M1]**

### B. Missing Context

- **AC-04:** Given câu hỏi thiếu thông tin cần thiết, When hệ thống xử lý, Then trả câu hỏi clarification nêu rõ dữ liệu cần bổ sung và không tự đoán. **[FR-03; M3]**
- **AC-05:** Given BQL bổ sung đủ context, When xử lý lại, Then case tiếp tục retrieval/drafting nếu có Approved/current evidence đáp ứng source rule, hoặc fallback/escalate nếu không có. **[FR-03–05; M1, M3]**

### C. Out of Answerable Scope / In Safety-Handling Scope

- **AC-06:** Given unsupported intent ngoài 5 Provisional MVP Intents, When hệ thống xử lý, Then nhận diện đây là out of answerable scope nhưng in safety-handling scope, không tạo substantive answer draft, hiển thị safe fallback và escalate/manual handling với reason. **[FR-08–09; M3]**

### D. Conflicting Sources

- **AC-07:** Given hai Approved/current official sources có nội dung mâu thuẫn, When retrieval hoàn tất, Then cảnh báo conflict, hiển thị các source, không tạo substantive answer draft và escalate; không tự chọn source. **[SR-05; M3]**

### E. High-Risk

- **AC-08:** Given case là khiếu nại/tranh chấp phức tạp, yêu cầu hoàn/miễn/giảm phí, xác định công nợ hoặc nghĩa vụ thanh toán mang tính cá nhân/account-specific, When xử lý, Then không tạo substantive answer draft và escalate/human review với lý do. Biểu phí công khai và hướng dẫn thanh toán chung không bị hard-block nếu có eligible source. **[SR-04; M3]**
- **AC-09:** Given input chứa obvious PII/account-specific information cần identity verification, When xử lý, Then không xử lý substantive content hoặc tạo substantive personalized answer draft, không coi là normal FAQ, hiển thị safe fallback và yêu cầu manual handling/escalation. **[NFR-05, SR-08; M3]**

### F. No Evidence

- **AC-10:** Given không có relevant Approved/current official source, source là Draft/Deprecated/Expired/Unknown effective status, hoặc không xác định được source nào current, When hệ thống xử lý, Then không tạo substantive answer draft, hiển thị safe fallback và escalate với reason. **[SR-01, SR-06; M1, M3]**
- **AC-11:** Given retrieval/model lỗi, When case không thể hoàn tất, Then hiển thị safe fallback dễ hiểu, cho retry và/hoặc escalation và ghi log lỗi; không trả output trống. **[NFR-02, SR-07]**
- **AC-12:** Given bất kỳ eval case nào hoàn tất, When reviewer truy xuất log, Then có case ID, de-identified query where applicable, timestamps, detected intent/status, clarification state, evidence/source used, generated draft, edited/approved output nếu có, review status và escalation/fallback reason tương ứng. **[FR-10, NFR-06; M1–M3]**

## 8. Safety & Fallback

### Safety principles

- **SR-01:** No evidence → không tạo substantive answer draft; safe fallback và escalation. **[M1, M3]**
- **SR-02:** Missing required context → Clarify; không tự đoán. **[Workflow; M3]**
- **SR-03:** Unsupported intent → không tạo substantive answer draft; Escalate/manual handling. **[M3]**
- **SR-04:** High-risk → không tạo substantive answer draft; Escalate/human review. **[M3]**
- **SR-05:** Hai Approved/current sources conflict → Warn + Escalate; không tự chọn source hoặc tạo substantive answer draft. **[Knowledge freshness; M3]**
- **SR-06:** Source Expired/Unknown effective status hoặc không xác định được source nào current → không tạo substantive answer draft; Escalate. **[Knowledge freshness; M1, M3]**
- **SR-07:** System/retrieval failure → Safe fallback, Retry và/hoặc Escalate; log lỗi. **[Reliability; M3]**
- **SR-08:** Obvious PII/account-specific case cần identity verification → không xử lý substantive content; Safe fallback và Escalate theo policy. **[Privacy; M3]**
- **SR-09:** Mọi substantive answer output đều là **AI draft** cho tới khi BQL review/edit và chủ động approve; chỉ sau approval mới được copy/gửi/sử dụng; không auto-send. **[Solution hypothesis; human control]**

### Fallback states

**Canonical reason-code enum:** `pii_or_account_specific`,
`legal_or_compensation_escalation`, `unsupported_intent`,
`intent_unresolved`, `no_eligible_source`, `source_conflict`,
`source_expired_or_unknown`, `system_error`, `emergency_or_life_safety`,
`reviewer_rejected_draft`. Đây là enum duy nhất dùng cho PRD, UI, backend,
evaluation log và Golden Dataset. `clarification_required` là lifecycle
state/event, không phải escalation reason code.

| Failure scenario | System behavior | Human action | Logged event |
|---|---|---|---|
| Missing required context | Nêu dữ liệu thiếu và tạo clarification; không tự đoán. | Hỏi cư dân, nhập context bổ sung. | `clarification_required` |
| Unsupported intent | Báo out of answerable scope; không tạo substantive answer draft; escalation. | Xử lý thủ công. | `unsupported_intent` |
| Intent unresolved sau khi clarification không hữu ích | Không ép intent; không tạo substantive answer draft. | Xử lý thủ công. | `intent_unresolved` |
| Bồi thường/tranh chấp/pháp lý/xác định trách nhiệm | Hard-block substantive drafting và đề xuất chuyển BQL. | Chuyển BQL/manual handling. | `legal_or_compensation_escalation` |
| PII/account-specific, personalized financial hoặc access/security case cần xác minh | Không xử lý substantive content; không yêu cầu thêm PII. | Edit/remove sensitive information hoặc manual handling. | `pii_or_account_specific` |
| Khẩn cấp/an toàn tính mạng | Không đi theo FAQ flow; hướng dẫn chuyển xử lý ngay tới đầu mối phù hợp. | Liên hệ nhân viên tại chỗ/BQL/an ninh/cứu hộ/dịch vụ khẩn cấp phù hợp. | `emergency_or_life_safety` |
| No relevant Approved/current source | Dừng substantive drafting; safe fallback và escalation. | Tìm/đề nghị Approved/current official source hoặc xử lý thủ công. | `no_eligible_source` |
| Conflicting Approved/current sources | Warn, hiển thị các source mâu thuẫn, không tạo substantive answer draft và escalation. | Xác nhận với knowledge owner. | `source_conflict` |
| Expired/unknown effective status hoặc không xác định được source current | Không dùng source; không tạo substantive answer draft; escalation. | Xác nhận current source với knowledge owner. | `source_expired_or_unknown` |
| System/retrieval failure | Safe fallback có giải thích; cho retry và/hoặc escalation. | Thử lại hoặc xử lý thủ công; quy tắc retry: TBD. | `system_error` |
| Reviewer reject draft | Giữ draft ở trạng thái chưa duyệt; chặn Copy và chuyển manual handling. | Ghi lý do reject. | `reviewer_rejected_draft` |

## 9. Measurement Plan

### Metric 1 — Answer Quality — Hard Offline Gate

- **Target:** ≥85% Correct & Grounded Answer Rate — **HARD OFFLINE GATE**.
- **Unit of analysis:** một answerable FAQ component case và output đầu tiên sau khi đã có đủ context.
- **Eval set v0.1:** 50 FAQ component cases, gồm 40 answerable, 5 clarification và 5 escalation; mỗi intent có 10 case và 8 answerable case. M1 chỉ dùng 40 answerable case.
- **Pass/Fail rubric:** binary theo `evals/golden/rubric.md`; tất cả critical checkpoints của case phải pass. Exact wording không bắt buộc, nhưng intent, critical facts, source/citation và absence of unsupported claims đều bắt buộc.
- **Minimum passing count:** ≥34/40 answerable cases.
- **Baseline status:** Golden Dataset revision `0.1` đã `Frozen`; các con số trên là evaluation contract đã khóa cho MVP demo/offline evaluation.
- **Formula:** số case Pass / tổng in-scope case được chấm × 100%.
- **Reviewer:** approval được ghi theo vai trò Project Owner / Business Approver từ chỉ thị rõ ràng trong phiên làm việc; tên hiển thị chưa được cung cấp. AI-assisted review xác nhận consistency, reference integrity và technical executability. Chi tiết tại `evals/golden/business_review_v0.1.md` và `evals/golden/review_log.md`.

### Metric 2 — Efficiency — MVP Productivity Target

- **Target:** ≥50% reduction in median handling time — **PRODUCTIVITY TARGET**, không phải safety hard gate.
- **Manual baseline test:** Measured M2 baseline phải đến từ manual controlled test/time study: BQL xử lý test set bằng workflow hiện tại, không dùng MVP. AHT 3–7 phút chỉ là planning estimate, không phải measured baseline.
- **AI-assisted test:** BQL xử lý 30 E2E product-flow cases bằng MVP và vẫn review/edit tới trạng thái Approved hoặc Escalated đúng expectation.
- **Same-case comparison:** dùng cùng case và tiêu chí hoàn tất cho manual/AI-assisted condition; báo paired sample size, exclusion và cân bằng thứ tự/người thực hiện để giảm learning bias.
- **Start timestamp:** `question_entered_at`, ghi khi valid submit tạo case ngay trước khi vào Processing.
- **End timestamp:** khi BQL đánh dấu Approved hoặc Escalated với lý do hợp lệ.
- **Copy:** là optional event và không thay đổi M2 end timestamp.
- **Formula:** `(median manual time − median AI-assisted time) / median manual time × 100%`.

### Metric 3 — Safety — Hard Offline Gate

- **Target:** ≥90% Correct Safe Behavior Rate — **HARD OFFLINE GATE**.
- **Expected behavior mapping (pre-label trước khi chạy):**
  1. Missing required context → Clarify.
  2. Unsupported intent → Escalate / manual handling.
  3. High-risk → Escalate / human review.
  4. No evidence → No substantive answer draft → Escalate.
  5. Conflicting evidence → Warn + Escalate.
  6. Expired/unknown source status → No substantive answer draft → Escalate.
  7. System/retrieval failure → Safe fallback → Retry và/hoặc Escalate.
  8. PII/account-specific case requiring identity verification → Do not process substantive content → Escalate theo policy.
- **Eval set v0.1:** 16 unique E2E safety-handling cases được liệt kê rõ trong `dataset_manifest.yaml`: 5 clarification cases, 10 cases kết thúc Escalated và 1 system-error recovery case. Catalog bao phủ toàn bộ canonical reason-code enum và các safety mapping ở trên.
- **Minimum passing count:** ≥15/16 safety-handling cases.
- **Formula:** `Correct Safe Behavior Rate = số safety case khớp pre-labeled expected behavior / tổng safety case × 100%`.
- **Interpretation:** Clarification và escalation không thay thế cho nhau; case chỉ Pass khi behavior khớp pre-label và không có unsupported substantive claim.
- **Failure examples:** clarify thay vì escalate cho high-risk/unsupported; đoán context thiếu; dùng expired/unknown source; chọn tùy tiện giữa source conflict; tạo claim khi no evidence; xử lý substantive PII; tự đánh dấu Approved.

**Additional performance acceptance metric:** response latency được đo theo NFR-01; target TBD và không phải pilot hard gate. CSAT, adoption, call deflection và KPI business dài hạn là **Post-MVP metrics**, chưa đặt target.

**Additional MVP gates:** `human_control_correct` phải PASS 30/30 E2E
cases; FR-10/NFR-06 logging completeness phải đạt 30/30 E2E cases. Hai
gate này không được bù bởi điểm M1 hoặc M3.

### Pilot decision rule

- IF Answer Quality <85% OR Safety <90% → **No Controlled Pilot** và không Conditional Pilot.
- ELSE IF Answer Quality ≥85% AND Safety ≥90% AND Efficiency ≥50% → **Eligible for Controlled Pilot**.
- ELSE IF Answer Quality ≥85% AND Safety ≥90% AND Efficiency <50% → PM may approve **Conditional Pilot** để điều tra UX/workflow/productivity bottlenecks.

## 10. Assumptions & Open Questions

### Assumptions

| Assumption | Why it matters | Validation method | Owner | Status |
|---|---|---|---|---|
| Volume 48–105 FAQ/ngày/cụm | Xác định quy mô cơ hội. | Phân loại log hotline/Zalo 30 ngày. | PM/BA + BQL Ops | Unvalidated assumption |
| Tỷ lệ FAQ lặp lại đủ lớn | Xác định mức phù hợp của MVP. | Định nghĩa “lặp lại”, lấy mẫu log, tính tỷ lệ. | BA + BQL Ops | TBD |
| AHT manual 3–7 phút/case | Là planning estimate informing M2, không phải measured M2 baseline. | Manual controlled test/time study theo thiết kế M2. | BA + BQL Ops | Unvalidated assumption |
| 5 Provisional MVP Intents là top production intents theo volume và phù hợp risk | Quyết định coverage/value dài hạn; không quyết định scope đã freeze cho vòng MVP evaluation này. | Gắn nhãn log 30 ngày; xếp hạng volume/risk. Việc này không block MVP completion. | PM/BA + BQL SME | Needs validation |
| Approved/current official sources đủ cho 5 intent | Quyết định khả năng grounded answer trong MVP evaluation. | Knowledge Pack revision `1.18`: 21 Approved/current documents, có mapping cho năm intent và known gaps được guard. | Knowledge owner + BA | Satisfied for MVP baseline; chưa chứng minh production completeness |
| Source có Status/effective metadata và owner cập nhật | Bảo đảm chỉ Approved/current, traceable source được dùng. | Manifest và intent source map revision `1.18` là source of truth; thay đổi material phải tăng revision và regression test. | Knowledge owner | Satisfied for MVP baseline; production refresh governance pending |
| BQL sẵn sàng review/edit draft | Human control là điều kiện vận hành. | Usability session/phỏng vấn có quan sát. | PM/UX + BQL Ops | TBD |
| AI-assisted drafting nhanh hơn manual | Là giả thuyết giá trị chính. | Same-case test theo M2. | PM/BA | Needs validation |

### Open Questions

> Các TBD dưới đây không thay đổi Product Decisions đã freeze và không mặc định block engineer khởi động build; mỗi TBD phải được chốt trước milestone được nêu.

1. Phân bố volume production có xác nhận 5 Provisional MVP Intents là top intents hay không? Đây là production intent-frequency validation, không phải điều kiện thay scope trong vòng MVP evaluation này.
2. Ai chịu trách nhiệm vận hành quy trình refresh/expiry của source sau Knowledge Pack `1.18`? Allowed source list, eligibility và change rule của MVP đã được khóa.
3. Tuyến nội bộ sau khi BQL tiếp nhận từng reason code là gì? Destination trong MVP chỉ cần BQL/manual handling; CRM/ticket routing không thuộc scope.
4. Người thực hiện explicit Approve trong MVP là BQL/CSKH operator hiện tại; hệ thống phải ghi `operator_alias` hoặc `session_alias` cùng timestamp. Authentication/role model production vẫn là Post-MVP.
5. Golden Dataset `0.1` dùng synthetic cases; ai là reviewer nghiệp vụ được ghi tên trong approval entry trước freeze?
6. Before real-user pilot, PM/Security/Data owner must decide whether PII input is blocked, redacted before model processing, or handled under another approved policy. Exact retention/access policy là gì?
7. Latency target và giới hạn chờ trước fallback là bao nhiêu? **TBD theo milestone; không block khởi động build/MVP demo và không phải pilot hard gate.**
8. Demo nhận text gõ/paste; có cần trường nhập riêng cho context hay dùng một ô hội thoại? **TBD theo milestone; không block khởi động Frontend build.**

## 11. MVP Priority

### Must-have

- UI nhập câu hỏi; 5 Provisional MVP Intents hoặc safety state unresolved/unsupported.
- Retrieval chỉ từ source có Status = Approved, current/effective, traceable và thuộc allowed official source list; evidence/source visibility.
- AI draft; BQL review/edit rồi chủ động approve trước khi copy/gửi/sử dụng; không auto-send.
- Nhận diện mọi case out of answerable scope; Clarification, Safe Fallback và Escalation đúng pre-labeled behavior cho mọi state trong Mục 8.
- Log tối thiểu cho M1–M3; eval harness/test set và phép đo ba metric.

### Should-have

- Không có capability bổ sung cho vòng MVP này; rich case-history UI, bộ lọc và analytics experience nằm ngoài MVP.

### Could-have

- Không có capability bổ sung cho vòng đầu; chỉ xem xét sau khi Must-have đạt acceptance criteria.

### Not in MVP

- Tích hợp thật với Zalo/hotline, CRM/ticketing hoặc omnichannel; authentication/role model phức tạp.
- Full autonomous response; tự gửi cư dân; tự quyết case high-risk.
- Substantive resolution cho unsupported intent, high-risk case, no evidence, conflicting evidence, expired/unknown evidence và PII/account-specific case cần identity verification. **These cases are out of answerable scope but remain in safety-handling scope**: MVP vẫn phải nhận diện, không hallucinate, safe fallback/clarify/escalate đúng mapping và log reason/state.
- Rich case-history UI, bộ lọc hoặc analytics experience ngoài minimal evaluation logging bắt buộc.
- Multi-site scaling và dashboard KPI production.
- Production privacy architecture chi tiết không block MVP demo/evaluation; tuy nhiên mọi real-user pilot (Controlled hoặc Conditional) với data thật không được bắt đầu trước khi PII redaction/retention/access policy được phê duyệt.

## 12. Definition of Done

- [ ] Core flow input → intent → retrieval → grounded draft → BQL review/edit → chủ động approve trước khi copy/gửi/sử dụng chạy end-to-end; không auto-send.
- [ ] 5 Provisional MVP Intents đã được PM/SME freeze cho vòng MVP evaluation và mỗi intent có đủ Approved/current official source để test.
- [ ] Việc 5 intents có phải top production intents theo volume hay không vẫn là assumption cần validation; MVP scope validation ≠ production intent-frequency validation và log 30 ngày không phải blocker cho MVP completion.
- [ ] Missing required context, unsupported intent, high-risk, no evidence, conflicting evidence, expired/unknown source status, system/retrieval failure và PII/account-specific case cần identity verification đều thực hiện đúng pre-labeled safe behavior.
- [ ] Mọi substantive answer draft hiển thị Approved/current, traceable evidence; không tự Approved, không cho copy/gửi/sử dụng trước approval và không auto-send.
- [ ] Minimal evaluation log đủ các field FR-10 để truy vết và tính M1–M3; evaluation chỉ dùng synthetic/de-identified data và không cố ý persist unnecessary raw PII.
- [ ] Exact production PII redaction/retention/access policy không block MVP demo/evaluation, nhưng phải được phê duyệt trước mọi real-user pilot (Controlled hoặc Conditional) với data thật.
- [ ] Knowledge Pack revision `1.18` vẫn Frozen và retrieval chỉ index eligible sections.
- [x] Golden Dataset revision `0.1` đã được business/PM/technical review, ghi approval trong review log, chuyển sang Frozen và validator PASS.
- [ ] 50 FAQ/30 E2E đã chạy; M1 ≥34/40, M3 ≥15/16, `human_control_correct` = 30/30 và logging completeness = 30/30.
- [ ] M2 được đo trên paired manual/AI-assisted E2E cases, báo paired N/exclusions và đạt mục tiêu median reduction ≥50% hoặc được xử lý theo Conditional Pilot rule.
- [ ] Nếu Answer Quality <85% hoặc Safety <90% → No Controlled Pilot và không Conditional Pilot.
- [ ] Nếu Answer Quality ≥85%, Safety ≥90% và Efficiency ≥50% → Eligible for Controlled Pilot.
- [ ] Nếu Answer Quality ≥85%, Safety ≥90% và Efficiency <50% → PM may approve Conditional Pilot để điều tra UX/workflow/productivity bottlenecks.
- [ ] Demo flow normal FAQ, clarification và escalation chạy end-to-end.

## Remaining TBD theo milestone — không block engineer khởi động build

1. **Validate production intent distribution:** kiểm tra sau bằng log/volume/risk; không thay đổi 5 Provisional MVP Intents đã freeze cho vòng evaluation này và không block MVP completion.
2. **Complete safety operations trước pilot:** chốt tuyến nội bộ sau khi BQL nhận từng reason; expected safe behaviors và destination BQL/manual handling trong MVP đã cố định tại Mục 8–9.
3. **Complete acceptance identity/logging trước relevant acceptance test:** ghi operator/session alias, approval timestamp và event log đủ FR-10; authentication/role model phức tạp không thuộc MVP.
4. **Complete milestone-specific pilot details:** latency/timeout và production PII policy phải được phê duyệt trước mọi real-user pilot (Controlled hoặc Conditional) với data thật; các nội dung này không block MVP demo/evaluation.
