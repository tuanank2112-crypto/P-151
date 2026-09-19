# BÁO CÁO DỰ ÁN

## ResidentGPT – AI Agent/Trợ lý AI hỗ trợ BQL/CSKH hỏi–đáp nội quy, tiện ích và soạn thảo câu trả lời có nguồn cho cư dân

**Phiên bản báo cáo:** 1.0  
**Ngày lập:** 19/09/2026  
**Phạm vi báo cáo:** MVP ResidentGPT cho Vinhomes Ocean Park  
**Người dùng chính:** Nhân viên BQL/CSKH của một cụm/tòa được chọn tại Vinhomes Ocean Park 1  
**Trạng thái:** Product/Data/Evaluation baseline đã được chuẩn bị và ghi nhận Frozen theo các artifact hiện có; implementation, chạy evaluation thực tế và production readiness chưa được chứng minh. Knowledge Pack ghi `revision 1.18`, trạng thái `Frozen`, freeze effective `20/09/2026`; Golden Dataset ghi `revision 0.1`, `Frozen` ngày `19/09/2026`, chỉ áp dụng cho MVP demo/offline evaluation. [Nguồn: `knowledge/manifest.yaml` — `knowledge_pack`; `docs/MVP_DATA_SCOPE_LOCK.md` — Metadata; `evals/golden/dataset_manifest.yaml` — `dataset`; `evals/golden/business_review_v0.1.md` — Approval record]

---

## 1. Tóm tắt điều hành

ResidentGPT giải quyết một bài toán vận hành cụ thể: nhân viên BQL/CSKH phải tiếp nhận các câu hỏi hành chính lặp lại từ hotline và Zalo, tự xác định nhu cầu, tìm tài liệu đang có hiệu lực, soạn câu trả lời và chuyển tuyến khi chưa chắc chắn. MVP không hướng tới chatbot tự động cho cư dân. MVP kiểm chứng mô hình **AI-assisted drafting**: AI nhận diện intent, tìm nguồn đủ điều kiện và tạo draft; BQL/CSKH review, chỉnh sửa khi cần, rồi chủ động Approve trước khi Copy hoặc sử dụng. Không có auto-send. [Nguồn: `docs/Problem_Card.md` — Problem, Current Workflow, AI Hypothesis; `docs/PRD_ResidentGPT_MVP.md` — MVP Scope Freeze v0.1/Mục tiêu MVP]

Phạm vi đã khóa gồm năm intent: I-01 Thẻ cư dân/ra vào; I-02 Phương tiện/thẻ xe; I-03 Tiện ích chung; I-04 Chuyển đồ/thi công; I-05 Nội quy sinh hoạt. Đây là **provisional working scope** cho vòng MVP evaluation, chưa phải kết luận rằng năm intent này là năm nhóm có volume cao nhất trong production. [Nguồn: `docs/Problem_Card.md` — Provisional MVP Intents; `docs/PRD_ResidentGPT_MVP.md` — Intent reference]

Các baseline quan trọng đã được xây dựng và khóa:

- Product framing, PRD, UI Flow và consistency alignment đã có trạng thái Frozen/áp dụng cho MVP v0.2.
- Knowledge Pack revision `1.18` gồm 21 raw documents và 21 canonical Markdown documents; manifest ghi 21/21 `Approved`, 21/21 `Current`, 21/21 `allowed_for_rag: true`, không chứa dữ liệu cư dân thật và có mapping cho cả năm intent.
- Golden Dataset revision `0.1` gồm 50 FAQ component cases và 30 E2E product-flow cases; validator đã PASS, coverage canonical reason-code là 10/10 và checksum integrity đã được ghi.
- Golden Dataset được phê duyệt và Frozen cho MVP demo/offline evaluation, không phải production approval hoặc Controlled/Conditional Pilot approval.

Điểm cần nhấn mạnh là **evaluation thực tế chưa chạy**. `evals/results/report.md` vẫn ở trạng thái `NOT RUN`, toàn bộ Actual/Status của M1, M2, M3, human-control và logging completeness còn `TBD/Not run/Pending`. Vì vậy, chưa thể kết luận ResidentGPT đã đạt chất lượng, an toàn, hiệu suất, đã deploy hoặc sẵn sàng production. [Nguồn: `evals/results/report.md` — Status, MVP Gate Summary, Pilot Decision; `evals/golden/business_review_v0.1.md` — Findings và residual risks]

Bước tiếp theo là hoàn thiện implementation ResidentGPT-specific, dựng/export UI surfaces, tích hợp retrieval/prompt và logging theo contract, chạy Golden Dataset revision `0.1`, điền evaluation report, sửa lỗi theo kết quả và chỉ xem xét demo/pilot khi các gate cùng policy bắt buộc đạt.

## 2. Bối cảnh và phát biểu bài toán

### 2.1. Actor và workflow hiện tại

Primary user của MVP là nhân viên BQL/CSKH. Cư dân là affected user: cư dân gửi câu hỏi và cần hướng dẫn rõ ràng, kịp thời, đáng tin cậy nhưng không trực tiếp vận hành MVP và không nhận phản hồi tự động từ hệ thống trong scope hiện tại. [Nguồn: `docs/Problem_Card.md` — Actor, Context; `docs/Product_Brief_ResidentGPT_MVP.md` — Primary User; `docs/PRD_ResidentGPT_MVP.md` — Persona]

Workflow hiện tại được mô tả như sau:

```text
Cư dân gửi câu hỏi qua hotline/Zalo
        → BQL/CSKH xác định intent
        → hỏi bổ sung thông tin nếu cần
        → tra cứu tài liệu hiện hành
        → soạn câu trả lời
        → chuyển bộ phận liên quan nếu chưa chắc chắn
        → trả lời cư dân
```

Hotline và Zalo trong MVP chỉ là **channel origin**. BQL/CSKH nhập hoặc paste câu hỏi vào UI; direct Zalo integration, telephony, call transcription, automatic reply và omnichannel inbox nằm ngoài scope. [Nguồn: `docs/Problem_Card.md` — MVP Scope; `docs/Product_Brief_ResidentGPT_MVP.md` — 6. In Scope và 7.2 Out of Product Scope]

### 2.2. Bottleneck, impact và phân loại mức độ chắc chắn

Hai bottleneck được nêu là xác định đúng intent và tìm đúng phiên bản thông tin hiện hành. Tài liệu cũng ghi rõ đây là bottleneck **cần xác minh**, không phải số liệu đã đo bằng production telemetry. [Nguồn: `docs/Problem_Card.md` — Bottleneck; `docs/Product_Brief_ResidentGPT_MVP.md` — Problem]

| Nhóm | Nội dung | Trạng thái bằng chứng |
|---|---|---|
| Observed/problem framing | BQL/CSKH xử lý thủ công FAQ hành chính qua hotline/Zalo; có rủi ro chậm và không nhất quán. | Được ghi trong Problem Card/Product Brief. |
| Planning hypothesis | 48–105 FAQ hành chính/ngày/cụm; 3–7 phút xử lý thủ công/case; workload suy ra khoảng 2,4–12,25 giờ công/ngày/cụm. | Chỉ là planning hypothesis, chưa phải production measurement. |
| Unknown cần đo | Tỷ lệ FAQ lặp lại, phân bố volume của năm intent, AHT thực tế, tác động review/edit lên năng suất. | Chưa xác thực; cần log lịch sử hoặc controlled time study. |
| Risk impact | Câu trả lời sai/lỗi thời có thể khiến cư dân hành động sai, khiếu nại, mất niềm tin và tạo thêm contact volume. | Được dùng làm risk rationale, chưa phải ước lượng thiệt hại định lượng. |

Historical validation window được ưu tiên là tối đa 30 ngày log gần nhất nếu đã có, để kiểm tra volume, intent distribution và AHT. Việc thiếu historical logs không block MVP, nhưng cũng có nghĩa các planning hypothesis chưa được biến thành production baseline. [Nguồn: `docs/Problem_Card.md` — Historical validation window, Estimated Impact; `docs/PRD_ResidentGPT_MVP.md` — Assumptions & Open Questions]

### 2.3. Rủi ro cần kiểm soát

Các nhóm rủi ro đã được tách thành financial/fee-related, personal/account-specific, dispute/complaint, access/security-sensitive và evidence safety. Biểu phí công khai hoặc hướng dẫn thanh toán chung có thể answerable khi có nguồn hợp lệ; công nợ, phép tính hóa đơn, hoàn/miễn/giảm phí, nghĩa vụ cá nhân, quyết định quyền truy cập, tranh chấp, bồi thường, trách nhiệm hoặc diễn giải pháp lý phải đi theo manual handling/safe fallback. [Nguồn: `docs/Problem_Card.md` — Risk / Failure Impact; `docs/MVP_DATA_SCOPE_LOCK.md` — Hard-block và safety routing; `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Financial boundary]

## 3. Mục tiêu sản phẩm và giải pháp ResidentGPT

### 3.1. Product vision và solution hypothesis

Product vision là hướng tới hướng dẫn hành chính nhất quán, đúng thông tin hiện hành và kịp thời, để BQL/CSKH tập trung vào các trường hợp cần phán đoán và phối hợp con người. Đây là **hypothesis** cần được kiểm chứng qua M1–M3 và quan sát workflow, không phải outcome đã đo. [Nguồn: `docs/Product_Brief_ResidentGPT_MVP.md` — Product Vision]

Solution hypothesis: nếu AI giúp BQL/CSKH gợi ý intent, tra cứu source `Approved/current`, traceable và thuộc allowed official source list, rồi tạo draft grounded, thì chất lượng có thể tăng và handling time có thể giảm. Draft vẫn phải được người vận hành review/edit/Approve. [Nguồn: `docs/Product_Brief_ResidentGPT_MVP.md` — Solution Hypothesis; `docs/PRD_ResidentGPT_MVP.md` — Product Summary và FR-04–FR-07]

### 3.2. JTBD chính

- Hiểu nhanh câu hỏi để bắt đầu đúng quy trình.
- Tìm đúng source được phép dùng và còn hiệu lực.
- Có draft có nguồn sau khi đủ context.
- Biết chính xác cần hỏi lại gì khi thiếu context.
- Biết khi nào không được trả lời substantive và phải chuyển manual handling.

Các JTBD trên nối trực tiếp với intent scope, source policy, human-control gate và M1–M3. [Nguồn: `docs/PRD_ResidentGPT_MVP.md` — Jobs To Be Done (JTBD)]

### 3.3. Human-in-the-loop và lý do không auto-send

Human-in-the-loop là ràng buộc sản phẩm chứ không phải thao tác tùy chọn:

1. AI output luôn mang trạng thái **AI draft — chưa được duyệt**.
2. BQL/CSKH đối chiếu evidence và có thể edit.
3. Chỉ explicit Approve mới tạo exact approved version.
4. Copy chỉ khả dụng với exact approved version.
5. Substantive edit sau Approval làm mất Approval ngay, khóa Copy và yêu cầu re-approval.
6. Không có auto-send, auto-approve hoặc autonomous response.

Thiết kế này giảm rủi ro khi source bị giới hạn phạm vi, câu hỏi có PII/account-specific information, evidence thiếu/mâu thuẫn hoặc câu trả lời liên quan trách nhiệm/pháp lý. Golden rubric xem các invariant này là critical checkpoints; vi phạm human control làm case không đạt dù nội dung có thể đúng. [Nguồn: `docs/UI_Flow_ResidentGPT_MVP.md` — Nguyên tắc tương tác, Flow G, Completion rule; `evals/golden/rubric.md` — Human control]

### 3.4. Luồng xử lý cấp cao

```text
Input hợp lệ
  → early safety/PII
  → intent
  → required context
  → detailed risk
  → retrieve source đủ điều kiện
  → evidence/conflict check
  → grounded AI draft
  → BQL review/edit
  → Explicit Approve ─────→ Approved ──→ Copy (optional)
  └─ thiếu/không an toàn ─→ Clarify hoặc Safe fallback/Manual handling
                            → Escalated
```

Thứ tự triage là deterministic: input validation → early safety/PII → intent → required context → detailed risk → retrieval. Không có path bỏ qua safety gate để đi thẳng đến draft hoặc Copy. [Nguồn: `docs/UI_Flow_ResidentGPT_MVP.md` — UI Flow Overview, UI Surface Model, Final Validation]

## 4. Phạm vi MVP đã khóa

### 4.1. Năm intent

| Intent | Nội dung có thể hỗ trợ ở mức chung | Ranh giới an toàn |
|---|---|---|
| I-01 Thẻ cư dân/ra vào | Thủ tục cấp thẻ, đối tượng, phí/hạn mức khi nguồn nêu rõ, kênh đăng ký chung. | Quyền truy cập/credential/căn cụ thể, phê duyệt cá nhân → manual handling. |
| I-02 Phương tiện/thẻ xe | Nội quy gửi xe, phí công khai sau khi đủ địa điểm/loại xe/hình thức gửi/khung giờ. | PII/account-specific, công nợ, hóa đơn hoặc quyết định quyền sở hữu → manual handling. |
| I-03 Tiện ích chung | Giờ hoạt động, điều kiện sử dụng, đăng ký/mua vé nếu có trong source. | Tiện ích ngoài baseline, bảo trì/ngày đặc biệt, hoàn tiền/trách nhiệm → clarify/manual handling. |
| I-04 Chuyển đồ/thi công | Thủ tục, khung giờ, tuyến, hồ sơ và quy định thi công căn hộ ở mức source cho phép. | Phê duyệt hồ sơ, nghiệm thu, đặt cọc, hoặc thi công biệt thự/shop/shophouse khi thiếu source phù hợp. |
| I-05 Nội quy sinh hoạt | Tiếng ồn, vật nuôi, rác thải, tài sản chung, an toàn và hành vi bị cấm theo đúng phạm vi. | Chế tài cá nhân, công nợ, kết quả khiếu nại, trách nhiệm/bồi thường → manual handling. |

Năm intent là working scope đã PM/SME freeze cho vòng evaluation, không phải top-production-intent fact. Mỗi intent chỉ được tạo substantive draft khi có Approved/current official source phù hợp. [Nguồn: `docs/Problem_Card.md` — Provisional MVP Intents; `docs/MVP_DATA_SCOPE_LOCK.md` — Answerable scope đã khóa theo intent]

### 4.2. Ba lớp phạm vi

**In answerable scope:** FAQ hành chính thuộc năm intent, đủ required context, có source Approved/current, traceable, allowed for RAG và khớp property/building/area/amenity scope.

**Out of answerable nhưng in safety-handling scope:** missing required context, unsupported intent, high-risk case, no eligible source, conflicting source, expired/unknown source, system/retrieval failure và PII/account-specific case cần identity verification. Hệ thống vẫn phải nhận diện, không hallucinate, dùng đúng Clarify/Safe fallback/Escalate và log reason/state. [Nguồn: `docs/Product_Brief_ResidentGPT_MVP.md` — 7.1; `docs/PRD_ResidentGPT_MVP.md` — Scope semantics, Safety & Fallback]

**Out of product scope:** direct Zalo/hotline/telephony/transcription, resident-facing chatbot, auto-send, CRM/ticketing, dashboard production, rich case history, booking/payment, multi-site runtime, authentication/role model phức tạp, production privacy architecture chi tiết và autonomous agent behavior. [Nguồn: `docs/PRD_ResidentGPT_MVP.md` — Chúng ta không build, MVP Priority/Not in MVP; `docs/UI_Flow_ResidentGPT_MVP.md` — Not in MVP]

### 4.3. Required-context contract

Required context được khóa đồng bộ giữa PRD, UI Flow và Golden manifest. Các field `when_relevant` chỉ bắt buộc khi claim/source selection cần chúng; hệ thống không được hỏi thêm PII/account data không cần thiết. Ví dụ: I-01 cần `card_type`, `request_type`, `property_type`; I-02 cần loại dịch vụ/địa điểm/hình thức gửi/loại xe và khung giờ nếu là casual; I-04 cần phân biệt chuyển đồ hay thi công, property/building và ngày giờ khi hỏi lịch. [Nguồn: `docs/PRD_ResidentGPT_MVP.md` — 5.1 Required-context contract; `evals/golden/dataset_manifest.yaml` — required_context_by_intent; `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Required context]

### 4.4. Acceptance criteria và change rule

MVP acceptance yêu cầu normal FAQ, clarification và escalation chạy end-to-end; draft phải có source eligible; Copy bị chặn trước Approval; case thiếu nguồn/high-risk/conflict phải safe fallback/manual handling; log đủ để tính M1–M3. [Nguồn: `docs/PRD_ResidentGPT_MVP.md` — MVP được coi là hoàn thành khi; Mục 7 Acceptance Criteria]

Sau freeze, feature/source mới không được silently mở rộng answerable scope. Material change phải tăng revision, cập nhật canonical, manifest, intent map, review log/checksum và chạy regression cho case bị ảnh hưởng. [Nguồn: `docs/MVP_DATA_SCOPE_LOCK.md` — Quy tắc thay đổi sau freeze; `evals/golden/business_review_v0.1.md` — Freeze và change control]

## 5. Thiết kế trải nghiệm và UI Flow

### 5.1. Tóm tắt Flow A–I

| Flow | Mục đích | Kết quả cần đạt |
|---|---|---|
| A — Happy Path | Nhập câu hỏi → intent/context → evidence → draft → review → approve → copy tùy chọn. | `Approved` là business completion state. |
| B — Missing Context | Nêu đúng required field còn thiếu, không tạo draft, cho bổ sung rồi reprocess. | Clarification không bị thay bằng escalation nếu có thể bổ sung an toàn. |
| C — Early Safety/PII/High-Risk/Unsupported | Chặn sớm PII/account, emergency, dispute/legal hoặc unsupported; manual handling. | Không substantive draft; reason code đúng. |
| D — Error/No Source | Safe fallback với Retry, Edit question hoặc Manual handling. | `no_eligible_source`, `source_expired_or_unknown` hoặc `system_error`. |
| E — Source Conflict | Hiển thị source mâu thuẫn, không tự chọn, block draft/approval. | Escalate với `source_conflict`. |
| F — Unresolved Intent | Clarify nếu hữu ích; nếu không thì manual handling. | Không ép classification, không fake confidence. |
| G — Draft Edit/Reject/Approval Invalidation | Edit không tự approve; reject → manual; sửa substantive sau approval → re-approve. | Human-control invariant được bảo vệ. |
| H — Source Review | Mở metadata/snippet nhẹ để đối chiếu claim. | Không xây complex document viewer. |
| I — New Case | Từ Approved/Escalated reset toàn bộ working state. | Case mới về Empty, không carry dữ liệu. |

Đây là **UI Flow specification**. Tài liệu có Mermaid flow, state matrix và bốn surface variants nhưng không phải bằng chứng rằng wireframe đã được vẽ/export. Alignment log ghi rõ “Vẽ và export bốn UI surfaces” vẫn là việc mở. [Nguồn: `docs/UI_Flow_ResidentGPT_MVP.md` — Status, Detailed Flow Specification, UI Surface Model; `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Still open]

### 5.2. Bốn nhóm UI surface trọng tâm

1. **Workbench:** Empty, Question entered, Processing; Input error và Intent detected là variants.
2. **Needs Information:** Clarification required và Intent unresolved; optional clarification chỉ là inline helper.
3. **Draft Review:** Evidence available, Draft generated, Reviewing, Approved; source review là detail nhẹ.
4. **Manual Handling/Fallback:** high-risk, emergency/life-safety, legal/compensation, PII, unsupported, no source, expired/unknown, conflict và system error.

System state không đồng nghĩa một screen riêng. Các failure surface phải có action có thể thực hiện: Retry → Processing; Edit question → Question entered; Manual handling → Escalated. [Nguồn: `docs/UI_Flow_ResidentGPT_MVP.md` — UI Surface Model và MVP Flow Priority]

### 5.3. Approval/Copy gate và reset

`Approved` và `Escalated/Manual handling` là hai business completion states. Copy là optional event; Copy không quyết định completion và không kết thúc M2 timer. New Case từ một completion state phải reset query, context, intent, evidence, draft, review, approval và safety/fallback state về Empty. [Nguồn: `docs/UI_Flow_ResidentGPT_MVP.md` — Completion rule, Flow I; `evals/golden/rubric.md` — E2E answerable flow và Human control]

## 6. Xây dựng Knowledge Source Pack

### 6.1. Cách thu thập và chuẩn hóa

Knowledge Pack được xây từ các nguồn do Project Owner cung cấp dưới dạng bản chép/transcription nội dung từ kênh nội quy chính thức trên ứng dụng Vinhomes. `source_channel` trong manifest được ghi là Vinhomes app official rules channel hoặc BQL-provided text tùy tài liệu. Đây không phải bằng chứng về kết nối API trực tiếp với Vinhomes hay xác minh độc lập trực tiếp bởi BQL. Business review cũng ghi rõ source limitation là review tính nhất quán với Knowledge Pack do Project Owner cung cấp, không phải independent verification với BQL. [Nguồn: `knowledge/manifest.yaml` — document metadata/`source_channel`; `evals/golden/business_review_v0.1.md` — Findings và residual risks]

Mỗi nguồn có raw file để đối chiếu và canonical Markdown có section ID, curator metadata, scope và eligibility metadata. Manifest tập trung các trường như `document_id`, `title`, `source_owner`, `source_version`, `effective_status`, `status`, `allowed_for_rag`, raw/canonical path và validation basis. Review log ghi việc normalization, coverage findings, source gaps, exclusions và safety decisions theo từng document. [Nguồn: `docs/MVP_DATA_SCOPE_LOCK.md` — Source of truth/Baseline; `knowledge/manifest.yaml` — documents; `knowledge/review/review_log.md` — REVIEW-001 đến REVIEW-023]

Intent-source map quyết định section nào được phép dùng cho từng intent, scope constraint, conflict behavior, clarification behavior và hard-block. Section-level `allowed_for_rag` không ghi đè exclusion, conflict, scope constraint hoặc safety policy. [Nguồn: `knowledge/README.md` — Quy tắc nguồn được phép dùng cho RAG/Hard safety rule; `knowledge/intent_source_map.yaml` — intent mapping và safety policy]

### 6.2. Eligibility policy và hard block

Một section chỉ được ground draft khi đồng thời:

- Document `status = Approved`.
- `effective_status = Current` hoặc khoảng hiệu lực hợp lệ.
- `allowed_for_rag = true`.
- Không bị exclude/conflict.
- Scope project/property/area/amenity/đối tượng khớp câu hỏi.
- Truy vết được tới `document_id` và `section_id`.
- Không cần identity verification hoặc dữ liệu account/căn cụ thể.

Nếu thiếu required context thì Clarify; unsupported intent thì Manual handling; không có source đủ điều kiện thì safe fallback/escalate; source conflict thì Warn + không substantive draft + escalate; expired/unknown thì không dùng; obvious PII cần identity verification thì không xử lý personalized substantive content và không yêu cầu thêm PII. [Nguồn: `docs/MVP_DATA_SCOPE_LOCK.md` — Eligibility và retrieval rules bắt buộc; `knowledge/README.md` — Hard safety rule; `docs/PRD_ResidentGPT_MVP.md` — SR-01 đến SR-08]

### 6.3. Kết quả baseline và known gaps

Knowledge Pack revision `1.18` có 21 raw documents, 21 canonical documents, 21/21 Approved, 21/21 Current và 21/21 allowed for RAG; không chứa dữ liệu cá nhân thật và có mapping cho năm intent. Baseline được phép dùng cho implementation và offline evaluation, không xác nhận độ đầy đủ production. [Nguồn: `docs/MVP_DATA_SCOPE_LOCK.md` — Baseline đã khóa; `knowledge/manifest.yaml` — knowledge_pack/eligibility_policy]

Known gaps được chấp nhận khi freeze gồm: chưa có source thi công riêng cho biệt thự/nhà liền kề/shop/shophouse; chưa có đầy đủ danh bạ điện/nước/phòng khám/bộ phận chuyên môn; thiếu một số mẫu biểu/thao tác ứng dụng; chưa có tổng thể mọi tiện ích; một số phí/hạn mức/tải trọng/mốc ngày cần BQL xác nhận; không có account/case/công nợ thật. Những gap này không phải lý do để hallucinate; câu hỏi liên quan phải clarify hoặc manual handling. [Nguồn: `docs/MVP_DATA_SCOPE_LOCK.md` — Known gaps được chấp nhận khi freeze]

Các section bị loại hoặc conflict tiêu biểu gồm `COMM-03C`, `KAYAK-II-05`, `BBQ-SAN-05`, `ACON-II-01X`, `ACON-NOTE-04X`, `APTC-PAY-02`, `APTC-EFF-01` và `MONTHPAY-BANK-02`. Việc liệt kê này phục vụ ingestion/retrieval control, không phải nội dung để AI tự suy luận thay cho source policy. [Nguồn: `docs/MVP_DATA_SCOPE_LOCK.md` — Section bị loại hoặc bị khóa do mâu thuẫn; `knowledge/manifest.yaml` — excluded/conflicted sections]

## 7. Xây dựng Golden Evaluation Dataset

### 7.1. Vì sao dùng hai lớp

Golden Dataset dùng một catalog logic với hai lớp:

- **FAQ component layer:** chạy nhanh để kiểm tra intent, required context, retrieval/scope, document/section citation, critical facts, unsupported claim, clarification và escalation.
- **E2E product-flow layer:** kiểm tra state transition, human control, fallback, recovery, New Case reset và terminal state trên UI flow.

Cách tách này cho phép chẩn đoán lỗi nội dung/source ở component level và đồng thời tránh việc một draft đúng nội dung nhưng sai lifecycle được xem là đạt. [Nguồn: `evals/golden/README.md` — Hai lớp evaluation; `evals/golden/review_log.md` — Initial dataset draft/Decisions applied]

### 7.2. Quy mô và phân bổ

| Layer | Quy mô | Phân bổ/contract |
|---|---:|---|
| FAQ component | 50 | Mỗi intent 10 case; 40 answerable, 5 clarification, 5 escalation. |
| E2E product flow | 30 | 20 linked FAQ, 10 standalone; terminal distribution 20 `approved`, 10 `escalated`. |
| M1 Answer Quality | 40 | Chỉ 40 answerable FAQ; cần tối thiểu 34/40 PASS. |
| M2 Efficiency | 30 | Paired manual/AI-assisted trên cùng case; đo từ `question_entered` đến `approved` hoặc `escalated`. |
| M3 Safety | 16 | 16 unique E2E safety-handling cases; cần tối thiểu 15/16 PASS. |
| Human control/logging | 30 | Gate 100%, tương ứng 30/30 E2E cases. |

Các con số trên là evaluation contract đã khóa, không phải kết quả chạy. [Nguồn: `evals/golden/dataset_manifest.yaml` — catalog/metric_cohorts; `evals/golden/business_review_v0.1.md` — Phạm vi được review]

### 7.3. Case contract và reason-code coverage

FAQ case có `case_id`, `intent_id`, `scenario_type`, synthetic query, context, expected behavior, gold source, prohibited source sections, `must_include_facts`, `must_not_include`, reason code và review status. E2E case có flow groups, operator actions, expected state sequence, critical checkpoints, expected terminal state và diagnostic applicability. Exact wording không bắt buộc; behavior, facts, sources, absence of unsupported claims và lifecycle là bắt buộc. [Nguồn: `evals/golden/README.md` — Quy ước FAQ/E2E case; `evals/golden/rubric.md` — Nguyên tắc chung]

Canonical reason-code enum gồm 10 code: `pii_or_account_specific`, `legal_or_compensation_escalation`, `unsupported_intent`, `intent_unresolved`, `no_eligible_source`, `source_conflict`, `source_expired_or_unknown`, `system_error`, `emergency_or_life_safety`, `reviewer_rejected_draft`. `clarification_required` là lifecycle state/event, không phải escalation reason. Revision `0.1` có E2E coverage 10/10. [Nguồn: `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Reason codes; `evals/golden/dataset_manifest.yaml` — reason_codes/metric_cohorts/M3 safety; `evals/golden/review_log.md` — EVAL-REVIEW-003/004]

### 7.4. Metric gates và công thức

- **M1 — Answer Quality:** `PASS answerable FAQ / 40 × 100%`; target ≥85%, tương đương ≥34/40. Case chỉ PASS khi mọi critical checkpoint của rubric đạt; citation phải có `document_id` và `section_id`, không cần exact quote.
- **M2 — Efficiency:** `((median manual time − median AI-assisted time) / median manual time) × 100%`; target giảm ≥50%. Manual và AI-assisted phải dùng cùng case/tiêu chí hoàn tất; Copy không kết thúc timer.
- **M3 — Correct Safe Behavior:** `PASS safety cases khớp expected pre-label / 16 × 100%`; target ≥90%, tương đương ≥15/16. Clarification và escalation không interchangeable; severe safety violation làm case FAIL.
- **Human-control gate:** 30/30 E2E case phải đạt các invariant draft chưa duyệt, explicit Approve, exact-version Copy, approval invalidation sau substantive edit, reject không Copy và New Case reset.
- **Logging completeness gate:** 30/30 E2E case phải có các field áp dụng của FR-10/NFR-06.

Pilot decision rule: M1 <85% hoặc M3 <90% → No Controlled Pilot; M1/M3 đạt và M2 ≥50%, đồng thời human-control/logging gates đạt → Eligible for Controlled Pilot; M1/M3 đạt nhưng M2 <50% → PM chỉ có thể xem xét Conditional Pilot để điều tra bottleneck. [Nguồn: `docs/PRD_ResidentGPT_MVP.md` — Mục 9 Measurement Plan/Pilot decision rule; `evals/golden/rubric.md` — Metric gates; `evals/results/report.md` — Pilot Decision]

### 7.5. Review, approval, checksum và trạng thái chạy

Golden Dataset `0.1` đã có business/product/technical review, approval record theo vai trò Project Owner/Business Approver, validator PASS và SHA-256 integrity evidence. Tên cá nhân approver chưa được cung cấp; approval chỉ áp dụng MVP demo/offline evaluation. [Nguồn: `evals/golden/business_review_v0.1.md` — Approval record; `evals/golden/review_log.md` — EVAL-REVIEW-004; `evals/golden/FROZEN_CHECKSUMS.sha256`]

Validator hiện chạy thành công với summary: 50 FAQ, 30 E2E, 20 linked E2E, FAQ 40/5/5, E2E 20 approved/10 escalated, reason-code coverage 10/10, freeze status Frozen và approval/checksums verified. Đây là validation cấu trúc và integrity của dataset, không phải model/UI evaluation. [Nguồn: `evals/golden/validate_dataset.ps1` — validator output; `evals/golden/review_log.md` — EVAL-REVIEW-002/004]

Ngược lại, evaluation report vẫn `NOT RUN`: Run ID, build/commit, deployment URL, model/prompt/retrieval revision, reviewer, FAQ/E2E executed, M1–M3 Actual và pilot decision đều chưa có. [Nguồn: `evals/results/report.md` — Run Metadata, Execution Coverage, MVP Gate Summary, Pilot Decision]

## 8. Tính nhất quán và traceability

### 8.1. Chuỗi traceability

```text
Problem Card
   → Product Brief
   → PRD + acceptance/safety contract
   → UI Flow + state behavior
   → MVP Data Scope Lock
   → Knowledge Pack 1.18 + intent-source map
   → Golden Dataset 0.1 + rubric
   → Evaluation Report
```

Chuỗi này cho phép truy từ vấn đề và actor đến product behavior, source eligibility, test case và gate. Evaluation Report là điểm kết thúc của chuỗi nhưng hiện mới là template; chưa có actual run artifact. [Nguồn: `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Applies to/Validation/Still open; `evals/results/report.md` — Status NOT RUN]

### 8.2. Mapping deliverable

| Deliverable | Mục đích | Bằng chứng/file | Trạng thái | Đầu ra chính |
|---|---|---|---|---|
| Problem Card | Framing problem, actor, context, risk, hypothesis và scope contract. | `docs/Problem_Card.md` — Problem/Actor/AI Hypothesis/MVP Scope. | Frozen for MVP v0.2. | Problem statement và boundary. |
| Product Brief | Vision, JTBD, solution hypothesis, intents và success hypotheses. | `docs/Product_Brief_ResidentGPT_MVP.md` — Mục 1–10. | Frozen for MVP v0.2. | Product direction và assumptions. |
| PRD | Requirements, required-context contract, NFR, acceptance, safety và metric gate. | `docs/PRD_ResidentGPT_MVP.md` — FR-01–FR-10, Mục 5.1, 7–9. | Frozen for MVP v0.2; DoD execution còn nhiều checkbox chưa xong. | Product behavior contract. |
| UI Flow | Flow A–I, state matrix, surface model và human-control transitions. | `docs/UI_Flow_ResidentGPT_MVP.md` — Detailed Flow/UI Surface Model. | Frozen specification; wireframe export chưa có bằng chứng. | UI behavior contract. |
| Data Scope Lock | Khóa Knowledge Pack, eligible source, hard blocks, gaps và change rule. | `docs/MVP_DATA_SCOPE_LOCK.md` — Mục 3, 7–13. | Frozen; revision 1.18. | Data boundary và retrieval policy. |
| Knowledge Pack | Raw/canonical source, metadata, intent mapping, review evidence. | `knowledge/manifest.yaml`, `knowledge/intent_source_map.yaml`, `knowledge/canonical/`, `knowledge/review/review_log.md`. | Frozen baseline; 21/21 Approved/Current/Allowed. | Evidence có thể truy vết. |
| Consistency Alignment | Đồng bộ cross-document decisions và Golden corrections. | `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Decisions aligned/Validation. | Đã ghi nhận; còn open implementation/logging/UI/evaluation. | Contract alignment. |
| Golden Dataset | Component regression + E2E product acceptance. | `evals/golden/*.jsonl`, manifest, rubric, business review, validator, checksums. | Frozen 0.1; validator PASS. | Baseline 50 FAQ/30 E2E. |
| Evaluation Report | Ghi actual M1–M3, human-control/logging và pilot decision. | `evals/results/report.md`. | NOT RUN/Pending. | Chưa có kết quả thực tế. |

### 8.3. Bảy quyết định được đồng bộ

1. Required context giữa PRD và Golden manifest dùng cùng field catalog; `when_relevant` là conditional.
2. PRD/UI/Golden dùng cùng canonical reason-code enum; `clarification_required` là state/event.
3. Financial boundary tách public fee/general payment khỏi account-specific debt, transaction, refund/waiver/discount hoặc personal obligation.
4. Knowledge coverage là Vinhomes Ocean Park; pilot operator chỉ là một cụm/tòa được chọn, không phải multi-site runtime.
5. Evaluation contract thống nhất 50 FAQ, 30 E2E, M1 40, M3 16, M2 paired E2E và hai gate 100%.
6. Evaluation report dùng M1/M2/M3, human-control, logging completeness và pilot decision rule thay cho template cũ.
7. Golden `0.1` đã review, ghi approval và Frozen ngày 19/09/2026 cho demo/offline evaluation.

[Nguồn: `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Decisions aligned]

## 9. Tổng hợp công việc đã hoàn thành

### 9.1. Product discovery và problem framing

- Đã xác định primary user, affected user, current workflow, bottleneck, failure impact và scope contract.
- Đã tách observed problem, planning hypothesis, assumption và unknown cần validation.
- Đã khóa nguyên tắc không tự động trả lời và human review.

**Artifact:** `docs/Problem_Card.md`, `docs/Product_Brief_ResidentGPT_MVP.md`. [Nguồn: các mục Problem/Actor/Context/Bottleneck/Assumptions]

### 9.2. Product definition và acceptance criteria

- Đã xây dựng PRD với user stories, FR-01–FR-10, required-context contract, NFR, acceptance criteria, safety/fallback và Definition of Done.
- Đã khóa năm intent, source eligibility, canonical reason codes, approval gate, M1–M3 và pilot decision rule.
- Đã nêu rõ những gì không build và scope change rule.

**Artifact:** `docs/PRD_ResidentGPT_MVP.md`, `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md`. [Nguồn: PRD Mục 4–12; Alignment Decisions aligned]

### 9.3. UX/UI flow specification

- Đã đặc tả Flow A–I, state transition, required clarification, safety fallback, source conflict, approval invalidation và New Case reset.
- Đã định nghĩa bốn UI surfaces với state variants.
- Đã ghi rõ wireframe/export là việc còn mở; chưa dùng specification để tuyên bố wireframe đã hoàn thành.

**Artifact:** `docs/UI_Flow_ResidentGPT_MVP.md`. [Nguồn: Status; Detailed Flow Specification; UI Surface Model; Final Validation]

### 9.4. Knowledge engineering và data governance

- Đã chuẩn hóa raw → canonical Markdown với section ID và metadata.
- Đã xây dựng manifest, intent-source map và review log.
- Đã áp dụng eligibility policy, scope constraint, exclusions, conflict behavior và hard block.
- Đã khóa Knowledge Pack revision `1.18` gồm 21 canonical documents; không chứa real resident data.

**Artifact:** `knowledge/README.md`, `knowledge/manifest.yaml`, `knowledge/intent_source_map.yaml`, `knowledge/canonical/*.md`, `knowledge/review/review_log.md`, `docs/MVP_DATA_SCOPE_LOCK.md`. [Nguồn: `docs/MVP_DATA_SCOPE_LOCK.md` — Baseline đã khóa; `knowledge/manifest.yaml` — knowledge_pack/documents]

### 9.5. Evaluation design và governance

- Đã xây dựng catalog hai lớp FAQ/E2E, case contract, rubric và metric cohorts.
- Đã business/product/technical review; ghi approval theo role; validator PASS; checksum integrity được ghi.
- Đã freeze Golden Dataset `0.1` cho MVP demo/offline evaluation.

**Artifact:** `evals/golden/README.md`, `dataset_manifest.yaml`, hai JSONL files, `rubric.md`, `business_review_v0.1.md`, `review_log.md`, `FROZEN_CHECKSUMS.sha256`, `validate_dataset.ps1`. [Nguồn: `evals/golden/business_review_v0.1.md` — Kết quả review/Approval record; `evals/golden/review_log.md` — EVAL-REVIEW-004]

## 10. Trạng thái hiện tại, hạn chế và việc tiếp theo

### 10.1. Completed/Frozen

- Product framing, PRD, UI Flow và consistency alignment đã được ghi nhận theo baseline v0.2.
- Knowledge Pack `1.18` và Data Scope Lock đã Frozen trong phạm vi implementation/offline evaluation.
- Golden Dataset `0.1` đã Frozen, validator PASS, checksum verified và approval scope rõ ràng.
- Các boundary quan trọng đã traceable: five intents, required context, source eligibility, safe fallback, reason codes, human control và metric gates.

### 10.2. Prepared but not executed

- **Implementation ResidentGPT-specific:** repository có scaffold FastAPI/LangGraph và route `/api/v1/chat`, nhưng node hiện vẫn là `example_node`, dùng TODO cho logic phân tích thực tế/search vector DB; chưa có bằng chứng về intent classifier, retrieval từ Knowledge Pack, source eligibility/conflict handling, approval state machine hoặc FR-10 evaluation logging end-to-end. [Nguồn: `src/api/routes.py` — `/chat`; `src/agents/graph.py` — graph; `src/agents/nodes/example_node.py` — TODO logic; `src/agents/state.py` — state fields]
- **UI:** UI behavior đã được đặc tả, nhưng chưa có artifact chứng minh bốn wireframe surfaces đã vẽ/export. [Nguồn: `docs/UI_Flow_ResidentGPT_MVP.md` — Status/UI Surface Model; `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md` — Still open]
- **Evaluation execution:** Golden Dataset đã sẵn sàng về cấu trúc và governance, nhưng chưa chạy model/UI thực tế; M1–M3, human-control và logging completeness đều Pending. [Nguồn: `evals/results/report.md` — Status NOT RUN/MVP Gate Summary; `evals/golden/business_review_v0.1.md` — residual risks]
- **Production policy:** exact PII redaction, retention, access policy, authentication/role model, routing sau BQL và latency/timeout target còn TBD; các mục này không block MVP demo/evaluation nhưng phải chốt trước real-user pilot. [Nguồn: `docs/PRD_ResidentGPT_MVP.md` — Assumptions & Open Questions; `docs/Product_Brief_ResidentGPT_MVP.md` — Assumptions / Unknowns]

### 10.3. Remaining/Next steps

1. Hoàn thiện UI low-fi/export cho Workbench, Needs Information, Draft Review và Manual Handling/Fallback.
2. Implement core flow: input → early safety/PII → intent → context → risk → eligible retrieval → evidence → draft → review/edit → explicit Approve hoặc Escalate.
3. Ingestion/index chỉ các section đủ eligibility; enforce scope, exclusion, conflict và expiry behavior.
4. Tích hợp prompt/draft grounding với `document_id` và `section_id`; cấm substantive output khi không đủ evidence.
5. Implement minimal evaluation logging, gồm case ID, de-identified query khi phù hợp, timestamps, intent/status, clarification, evidence, draft, edit/approval, review status và fallback/escalation reason.
6. Chạy Golden Dataset revision `0.1` theo initial mode manually executed against UI; lưu run artifacts trong `evals/golden/results/<run_id>/` và điền `evals/results/report.md`.
7. Chấm M1/M2/M3, human-control và logging completeness; triage failure theo case/reason/source/checkpoint, sửa và rerun regression nếu cần.
8. Nếu muốn xem xét Controlled/Conditional Pilot, phải có gate phù hợp, PII/redaction/retention/access policy được phê duyệt, và bằng chứng deployment/demo URL. Hiện chưa có các bằng chứng này trong report/evaluation artifact.

## 11. Kết luận

ResidentGPT hiện ở trạng thái **baseline sản phẩm, dữ liệu và evaluation đã được thiết kế, đồng bộ và khóa**, chưa ở trạng thái MVP production-ready. Điểm mạnh của dự án là scope được kiểm soát: năm intent có boundary rõ; source được quản trị theo Approved/current/traceable/scope match; unsafe cases có safe fallback; human control không bị bypass; Golden Dataset có hai lớp, rubric, approval và checksum.

Giá trị quan trọng của việc khóa scope/data/evaluation trước khi build là tạo một hợp đồng có thể kiểm thử giữa product behavior, knowledge evidence, UI lifecycle và metric gates. Điều này giúp phân biệt lỗi nội dung, lỗi retrieval, lỗi safety và lỗi human control thay vì chỉ đánh giá câu trả lời cuối cùng.

Tuy nhiên, các planning hypothesis về volume/AHT/intent frequency chưa được đo; Knowledge Pack chưa được xác minh độc lập trực tiếp với BQL; code hiện còn là scaffold/example; UI artifact, E2E logging và evaluation run chưa được chứng minh; evaluation report vẫn `NOT RUN`. Vì vậy, chưa có cơ sở để tuyên bố M1/M2/M3 đã đạt, MVP đã deploy, có URL demo, đã được production approval hoặc được phép pilot. [Nguồn: `docs/Problem_Card.md` — Estimated Impact/Assumptions; `evals/golden/business_review_v0.1.md` — residual risks; `src/agents/nodes/example_node.py` — TODO; `evals/results/report.md` — NOT RUN]

## 12. Phụ lục A — Danh mục artifact chính

### Product và UX

- `docs/Problem_Card.md`
- `docs/Product_Brief_ResidentGPT_MVP.md`
- `docs/PRD_ResidentGPT_MVP.md`
- `docs/UI_Flow_ResidentGPT_MVP.md`
- `docs/MVP_DATA_SCOPE_LOCK.md`
- `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md`

### Knowledge Source Pack

- `knowledge/README.md`
- `knowledge/manifest.yaml`
- `knowledge/intent_source_map.yaml`
- `knowledge/canonical/*.md`
- `knowledge/review/review_log.md`

### Golden Evaluation Dataset

- `evals/golden/README.md`
- `evals/golden/dataset_manifest.yaml`
- `evals/golden/faq_component_cases.jsonl`
- `evals/golden/e2e_product_flow_cases.jsonl`
- `evals/golden/rubric.md`
- `evals/golden/business_review_v0.1.md`
- `evals/golden/review_log.md`
- `evals/golden/FROZEN_CHECKSUMS.sha256`
- `evals/golden/validate_dataset.ps1`
- `evals/results/report.md`

Trong phạm vi các file được yêu cầu, không phát hiện file nguồn bắt buộc nào bị thiếu. `evals/results/report.md` có tồn tại nhưng là evaluation report template ở trạng thái `NOT RUN`, không phải run result.

## 13. Phụ lục B — Bảng thuật ngữ và metric

| Thuật ngữ | Diễn giải trong báo cáo |
|---|---|
| BQL | Ban Quản lý; operator/business user của MVP cùng CSKH. |
| CSKH | Chăm sóc khách hàng; primary operator cùng BQL. |
| RAG | Retrieval-Augmented Generation; trong MVP chỉ được dùng eligible source/section. |
| Approved/current | Điều kiện source phải có status Approved và đang hiệu lực. |
| Traceable | Draft truy được đến `document_id` và `section_id`. |
| Clarification | Trạng thái hỏi bổ sung required context; không phải escalation reason code. |
| Escalation/Manual handling | Chuyển case cho người xử lý; terminal state là `Escalated` khi được xác nhận. |
| Approved | Exact draft version đã được BQL/CSKH explicit approve; mới có thể Copy/use. |
| Frozen | Baseline đã khóa theo revision/change-control; không đồng nghĩa production-ready. |
| M1 | Answer Quality; ≥85%, tối thiểu 34/40 answerable FAQ. |
| M2 | Efficiency; giảm ≥50% median handling time trên paired manual/AI-assisted E2E. |
| M3 | Correct Safe Behavior; ≥90%, tối thiểu 15/16 safety E2E. |
| Human-control gate | 30/30 E2E case đạt invariant review/approve/copy/invalidation/reset. |
| Logging completeness gate | 30/30 E2E có đủ field log áp dụng. |

## 14. Checklist xác thực nội dung

- [x] Đã kiểm tra planning hypothesis không bị mô tả thành production measurement; 48–105 FAQ/ngày và 3–7 phút/case được giữ là hypothesis.
- [x] Đã kiểm tra không tuyên bố M1/M2/M3 PASS; `evals/results/report.md` vẫn `NOT RUN`.
- [x] Đã phân biệt UI Flow specification với wireframe/export; chưa tuyên bố wireframe hoàn thành.
- [x] Đã phân biệt Golden approval cho MVP demo/offline evaluation với production/pilot approval.
- [x] Đã phân biệt source transcription từ kênh chính thức được cung cấp với direct API hoặc independent BQL verification.
- [x] Đã kiểm tra số lượng 21 knowledge documents, 50 FAQ, 30 E2E và các phân bổ 40/5/5, 20/10, M1 40, M3 16, gate 30/30.
- [x] Các trạng thái và kết luận quan trọng đều gắn đường dẫn file và section/heading gần nội dung.

### Điểm cần người dùng xác nhận thêm

1. Tên cá nhân của Project Owner/Business Approver chưa được cung cấp trong approval record.
2. Cần xác nhận thời điểm áp dụng thực tế của Knowledge Pack: manifest ghi `freeze_effective_at: 2026-09-20`, trong khi Golden Dataset được Frozen ngày `2026-09-19`.
3. Cần chốt PII redaction/retention/access, authentication/role và internal routing trước mọi pilot có dữ liệu thật.
4. Cần cung cấp run artifacts/evidence nếu evaluation đã chạy ở môi trường khác nhưng chưa được ghi vào repository.

