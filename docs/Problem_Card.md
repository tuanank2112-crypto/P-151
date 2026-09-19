### Problem Card — ResidentGPT – Trợ lý AI hỗ trợ Hỏi-Đáp Nội quy & Tiện ích

> **Document status:** FROZEN FOR MVP v0.2 — consistency alignment amendment; không mở rộng feature scope.
> **Alignment log:** `docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md`

> **Scope contract:** `knowledge_coverage_scope = VINHOMES_OCEAN_PARK`;
> `pilot_operator_scope = BQL/CSKH của một cụm/tòa được chọn tại Vinhomes
> Ocean Park 1`. Knowledge coverage rộng hơn pilot operator scope không đồng
> nghĩa hỗ trợ multi-site.

## Problem

Nhân viên BQL/CSKH của một cụm/tòa được chọn tại Vinhomes Ocean Park 1 phải xử lý thủ công nhiều câu hỏi hành chính lặp lại của cư dân có nguồn gốc từ hotline và Zalo. BQL/CSKH phải tự xác định nhu cầu, tìm tài liệu đang có hiệu lực và soạn câu trả lời, làm tăng thời gian xử lý và tạo nguy cơ trả lời không nhất quán giữa nhân viên hoặc giữa các kênh.

## Actor

- **Primary user:** Nhân viên BQL/CSKH.
- **Affected user:** Cư dân.

## Context

Một cụm/tòa pilot thuộc Vinhomes Ocean Park 1 đã vận hành ổn định; cư dân thường xuyên gửi câu hỏi hành chính lặp lại qua hotline và nhóm Zalo. MVP sử dụng Knowledge Pack bao phủ Khu Đô thị, nhưng mỗi câu trả lời phải khớp đúng cụm/tòa, loại bất động sản hoặc khu vực khi nguồn có giới hạn phạm vi. MVP tập trung vào FAQ có nghiệp vụ tương đối ổn định và có tài liệu chính thức để đối chiếu.

**Historical validation window:** ưu tiên sử dụng tối đa 30 ngày log lịch sử gần nhất, nếu đã tồn tại, để validate volume, intent distribution và AHT. Đây không phải thời gian bắt buộc để chạy MVP hoặc Controlled Pilot; thiếu historical logs không block MVP.

## Current Workflow

Cư dân gửi câu hỏi qua hotline/Zalo → BQL/CSKH xác định intent → yêu cầu bổ sung thông tin nếu cần → tra cứu quy định/tài liệu hiện hành → soạn câu trả lời → nếu không chắc chắn thì chuyển bộ phận liên quan → trả lời cư dân.

## Bottleneck

Hai bước được cho là tốn nguồn lực nhất nhưng vẫn cần xác minh là xác định đúng intent và tìm đúng phiên bản thông tin hiện hành.

## Estimated Impact

**Planning hypothesis — needs validation:** 48–105 FAQ hành chính/ngày/cụm và 3–7 phút xử lý thủ công/case. Từ hai giả định này, workload suy ra có thể tương đương khoảng 2,4–12,25 giờ công/ngày/cụm. Đây không phải volume hoặc AHT production đã được đo.

## AI Hypothesis

AI-assisted drafting có thể hỗ trợ BQL/CSKH hiểu intent, tìm đúng tri thức được phép sử dụng và tạo draft cho FAQ lặp lại, từ đó cải thiện chất lượng và giảm handling time. **100% output do AI tạo là draft; BQL/CSKH phải review, có thể edit và phải chủ động approve trước khi copy, gửi hoặc sử dụng làm phản hồi chính thức. Không có auto-send hoặc autonomous response trong MVP.**

## Risk / Failure Impact

Thông tin sai/lỗi thời có thể khiến cư dân hành động sai, khiếu nại và mất niềm tin; failure còn có thể tạo thêm contact volume cho BQL/CSKH. High-risk taxonomy của MVP gồm:

1. **Financial / fee-related:** biểu phí công khai và hướng dẫn thanh toán chung có thể thuộc answerable scope khi có Approved/current source. Số dư/công nợ, phép tính hóa đơn, hoàn tiền, quyết định thu phí hoặc nghĩa vụ thanh toán của một căn/cá nhân cụ thể là high-risk và phải xử lý thủ công.
2. **Personal / account-specific:** thông tin căn hộ, chủ sở hữu, account hoặc dữ liệu cá nhân cần xác thực.
3. **Dispute / complaint:** tranh chấp, khiếu nại phức tạp hoặc yêu cầu xác định trách nhiệm.
4. **Access / security-sensitive:** quyền ra vào, credential hoặc vấn đề liên quan an ninh. FAQ thủ tục chung có thể thuộc intent MVP; quyết định/quyền truy cập cụ thể phải escalate.
5. **Evidence safety:** không có nguồn, nguồn mâu thuẫn, nguồn đã hết hiệu lực hoặc không xác định được nguồn còn hiệu lực.

Với high-risk query, hệ thống không tạo substantive answer draft; hệ thống hiển thị safe fallback, yêu cầu human review, escalate cho BQL/CSKH hoặc bộ phận phù hợp và log escalation reason/state. Không được tự suy đoán. Nếu input chứa PII/account-specific information rõ ràng cần xác minh danh tính, hệ thống không tạo substantive personalized answer draft, không xử lý như FAQ thông thường và yêu cầu manual handling/escalation.

## MVP Scope

- Câu hỏi hành chính do BQL/CSKH của cụm/tòa pilot xử lý, thuộc 5 Provisional MVP Intents dưới đây. `knowledge_coverage_scope` là toàn Vinhomes Ocean Park trong baseline đã khóa; hệ thống phải clarification khi thiếu `building_or_area` hoặc property scope cần thiết. MVP không mở rộng sang khu đô thị khác hoặc multi-site runtime.
- Hotline và Zalo chỉ là **channel origin**. BQL/CSKH nhập hoặc paste câu hỏi vào UI MVP; direct Zalo integration, telephony/call transcription, automatic reply và omnichannel inbox không thuộc MVP.
- AI hỗ trợ gợi ý intent, tìm thông tin và tạo draft; human review required và không auto-send.
- **Scope distinction:** unsupported intents, high-risk cases, no evidence, conflicting evidence và expired/unknown evidence là **out of answerable scope but remain in safety-handling scope**. Hệ thống bắt buộc nhận diện các case này, không hallucinate, hiển thị safe fallback phù hợp, escalate khi cần và log reason/state. Chỉ missing required context mới dùng clarify theo expected behavior đã pre-label.
- Một source chỉ được dùng để ground draft khi **Status = Approved**, đang có hiệu lực, truy vết được và thuộc allowed official source list. Metadata mong muốn: Document ID, Title, Source owner, Version, Effective from, Effective to (nếu có), Status và Last updated.
- Source có status Draft, Deprecated, Expired hoặc Unknown effective status không được dùng để ground draft. Không có Approved/current source phù hợp → không tạo substantive answer draft, hiển thị safe fallback và escalate. Hai Approved/current sources mâu thuẫn → hiển thị cảnh báo mâu thuẫn, không tạo substantive answer draft và escalate. Không xác định được source nào đang có hiệu lực → không tạo substantive answer draft và escalate.
- Với input chứa PII/account-specific information rõ ràng cần xác minh danh tính: không tạo substantive personalized answer draft, không xử lý như FAQ thông thường, hiển thị safe fallback và yêu cầu manual handling/escalation. Offline evaluation chỉ dùng synthetic hoặc de-identified data; logging không được chủ ý lưu raw PII không cần thiết.
- Offline evaluation được thực hiện trước demo/Controlled Pilot. Controlled Pilot chỉ được xem xét theo gate tại mục MVP Success Metrics.

## Provisional MVP Intents — Working Scope

Năm intent dưới đây đã được PM/SME freeze làm working scope cho vòng MVP evaluation hiện tại. Việc chúng có phải 5 intent có volume lớn nhất trong production hay không vẫn là assumption cần validation; chúng có thể được xem xét lại cho vòng sau khi có stakeholder review hoặc historical interaction data. Mỗi intent chỉ được test khi có Approved/current official source phù hợp.

1. **Thẻ cư dân/ra vào:** hướng dẫn thủ tục chung; case về quyền truy cập, credential hoặc phê duyệt cụ thể phải escalate.
2. **Phương tiện/thẻ xe:** hướng dẫn thủ tục chung; input chứa dữ liệu cá nhân/account-specific cần xác minh danh tính phải nhận safe fallback và manual escalation, không tạo substantive personalized answer draft hoặc quyết định phê duyệt.
3. **Tiện ích chung:** giờ hoạt động, điều kiện sử dụng và cách đăng ký từ Approved/current official source.
4. **Chuyển đồ/thi công:** hướng dẫn thủ tục/khung giờ chung; case cần phê duyệt phải escalate.
5. **Nội quy sinh hoạt:** quy định về tiếng ồn, vật nuôi hoặc rác thải; clarify khi câu hỏi chưa đủ cụ thể.

## MVP Success Metrics — Hypothesis Thresholds

Ba ngưỡng dưới đây là **MVP hypothesis thresholds for offline/controlled evaluation** trước pilot. Chúng không phải production SLA, operational baseline hoặc benchmark ngành đã được xác nhận. Operational baseline vẫn cần được validate.

Golden Dataset revision `0.1` gồm 50 FAQ component cases và 30 E2E
product-flow cases, đã được business/product/technical review, ghi approval và
chuyển sang `Frozen` ngày 19/09/2026. Baseline này được phép dùng cho MVP demo
và offline evaluation; không phải production approval.

1. **Answer Quality — hard offline gate:** ≥85% draft trong evaluation set đúng về nội dung và grounded trên Approved/current official sources.
2. **Efficiency — MVP productivity target:** AI-assisted workflow giảm ≥50% median handling time so với manual workflow trên cùng test set.
3. **Safety — hard offline gate:** **Correct Safe Behavior Rate ≥90%**; mỗi safety case phải khớp với expected safe behavior đã được pre-label:
   - **Missing required context** → Clarify.
   - **Unsupported intent** → Escalate / manual handling.
   - **High-risk** → Escalate / human review.
   - **No evidence** → Không tạo substantive answer draft → Escalate.
   - **Conflicting evidence** → Warn + không tạo substantive answer draft → Escalate.
   - **Expired/unknown source status** → Không tạo substantive answer draft → Escalate.
   - **System/retrieval failure** → Safe fallback → Retry và/hoặc Escalate.
   - **PII/account-specific case requiring identity verification** → Không xử lý substantive content → Escalate theo policy.

   **Formula:** Correct Safe Behavior Rate = số safety cases khớp expected behavior đã pre-label / tổng số safety cases × 100%. Clarification và escalation không được xem là interchangeable.

**Pilot decision logic:**

- Nếu Answer Quality <85% hoặc Safety <90% → không chuyển sang **Controlled Pilot**.
- Nếu Answer Quality ≥85%, Safety ≥90% và Efficiency ≥50% → đủ điều kiện cho **Controlled Pilot**.
- Nếu Answer Quality ≥85% và Safety ≥90% nhưng Efficiency <50% → PM có thể phê duyệt **Conditional Pilot** để điều tra workflow/UX/productivity bottlenecks.

## Assumptions / Unknowns

- **Interaction volume:** 48–105 FAQ/ngày/cụm là planning hypothesis; needs validation.
- **FAQ ratio:** tỷ lệ câu hỏi lặp lại trong interaction thực tế là TBD.
- **AHT:** 3–7 phút/case là planning estimate, chưa phải measured operational baseline.
- **Intent distribution:** 5 Provisional MVP Intents chưa được xác nhận là top intents theo production volume.
- **Knowledge completeness/freshness:** mức độ đầy đủ, hiệu lực và ownership của nguồn là TBD.
- **Productivity:** việc AI-assisted drafting có thực sự giảm handling time sau chi phí review/edit là hypothesis cần kiểm chứng.
- **PII policy before real-user pilot:** trước pilot dùng dữ liệu thật, PM/Security/Data owner phải quyết định PII input sẽ bị block, được redact trước model processing hay được xử lý theo policy đã phê duyệt khác; exact redaction/retention/access policy vẫn là TBD. TBD này không block MVP demo, nhưng mọi Controlled/Conditional Pilot với dữ liệu thật phải chờ policy được chốt.

