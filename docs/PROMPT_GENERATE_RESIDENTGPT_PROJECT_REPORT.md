# Prompt tạo báo cáo giới thiệu đề tài ResidentGPT và công việc đã hoàn thành

Sao chép toàn bộ phần trong khối lệnh dưới đây và sử dụng cùng repository hoặc
đính kèm các tài liệu được liệt kê trong prompt.

```text
Bạn là Senior AI Product Manager, AI Engineer và chuyên gia viết báo cáo dự án
AI. Hãy đọc đầy đủ các tài liệu được cung cấp trước khi viết. Nhiệm vụ của bạn
là tạo một báo cáo tiếng Việt có tính chuyên nghiệp, logic và có thể trình bày
cho giảng viên, mentor, hội đồng đánh giá hoặc đội phát triển về đề tài:

“ResidentGPT – AI Agent/Trợ lý AI hỗ trợ BQL/CSKH hỏi–đáp nội quy, tiện ích và
soạn thảo câu trả lời có nguồn cho cư dân”.

MỤC TIÊU BÁO CÁO

1. Giới thiệu vấn đề, người dùng, bối cảnh và giá trị dự kiến của ResidentGPT.
2. Giải thích giải pháp MVP, nguyên tắc human-in-the-loop, phạm vi năm intent,
   UI flow, safety/fallback và cách kiểm soát nguồn.
3. Trình bày theo tiến trình các công việc đã hoàn thành từ Problem Card đến
   Golden Evaluation Dataset.
4. Chứng minh tính traceability giữa bài toán, yêu cầu sản phẩm, UI behavior,
   dữ liệu tri thức và evaluation.
5. Phân biệt rõ:
   - đã hoàn thành/đã review/đã Frozen;
   - đã chuẩn bị nhưng chưa chạy;
   - còn thiếu hoặc cần thực hiện tiếp.
6. Không phóng đại trạng thái dự án và không tuyên bố MVP đã production-ready.

NGUỒN PHẢI ĐỌC

Nhóm tài liệu sản phẩm:

- docs/Problem_Card.md
- docs/Product_Brief_ResidentGPT_MVP.md
- docs/PRD_ResidentGPT_MVP.md
- docs/UI_Flow_ResidentGPT_MVP.md
- docs/MVP_DATA_SCOPE_LOCK.md
- docs/MVP_CONSISTENCY_ALIGNMENT_v0.2.md

Nhóm Knowledge Source Pack:

- knowledge/README.md
- knowledge/manifest.yaml
- knowledge/intent_source_map.yaml
- knowledge/canonical/*.md
- knowledge/review/review_log.md
- Các file liên quan khác trong knowledge/ nếu chúng chứa metadata, source
  inventory, review evidence hoặc change history.

Nhóm Golden Evaluation Dataset:

- evals/golden/README.md
- evals/golden/dataset_manifest.yaml
- evals/golden/faq_component_cases.jsonl
- evals/golden/e2e_product_flow_cases.jsonl
- evals/golden/rubric.md
- evals/golden/business_review_v0.1.md
- evals/golden/review_log.md
- evals/golden/FROZEN_CHECKSUMS.sha256
- evals/golden/validate_dataset.ps1
- evals/results/report.md

Nếu một file không tồn tại, hãy nêu file bị thiếu và tiếp tục với bằng chứng
còn lại. Không tự tạo thông tin để lấp khoảng trống.

THỨ TỰ ƯU TIÊN KHI NGUỒN MÂU THUẪN

1. Frozen manifest, scope-lock và approval record mới nhất.
2. MVP_CONSISTENCY_ALIGNMENT_v0.2.md cho các quyết định đồng bộ chéo.
3. PRD và UI Flow cho product behavior/acceptance criteria.
4. Problem Card và Product Brief cho bối cảnh, giả thuyết và định hướng.
5. Review log chỉ dùng để giải thích lịch sử thay đổi; một entry lịch sử ghi
   “Draft” không được dùng để phủ định trạng thái Frozen hiện tại.

Nếu vẫn còn mâu thuẫn, không tự chọn một kết luận. Hãy ghi rõ trong mục
“Điểm cần xác nhận”.

FACT BASELINE BẮT BUỘC KIỂM TRA VỚI FILE

Chỉ sử dụng các fact dưới đây nếu chúng khớp tài liệu hiện tại:

- Người dùng chính của MVP là nhân viên BQL/CSKH; cư dân là người bị ảnh hưởng
  và không trực tiếp nhận câu trả lời tự động từ AI trong MVP.
- ResidentGPT hỗ trợ nhận diện nhu cầu, tìm nguồn đủ điều kiện và tạo draft;
  100% AI output là draft, phải được con người review/edit/Approve trước khi
  Copy hoặc sử dụng. Không có auto-send.
- Năm intent MVP gồm:
  I-01 Thẻ cư dân/ra vào;
  I-02 Phương tiện/thẻ xe;
  I-03 Tiện ích chung;
  I-04 Chuyển đồ/thi công;
  I-05 Nội quy sinh hoạt.
- Knowledge coverage là Vinhomes Ocean Park; pilot operator scope là BQL/CSKH
  của một cụm/tòa được chọn. Không diễn giải đây là multi-site product.
- Knowledge Pack revision 1.18 có trạng thái Frozen, gồm 21 canonical
  documents, chỉ dùng nguồn Approved/current, traceable, đúng phạm vi và được
  phép dùng cho MVP demo/offline evaluation.
- Source content do Project Owner cung cấp dưới dạng bản chép từ kênh nội quy
  chính thức trên ứng dụng Vinhomes. Không được mô tả là hệ thống có kết nối
  API trực tiếp với Vinhomes hoặc đã được BQL xác minh độc lập nếu không có
  bằng chứng.
- Các câu hỏi bồi thường, tranh chấp, diễn giải pháp lý, xác định trách nhiệm,
  quyết định phạt cá nhân, PII/account-specific, không có nguồn, nguồn xung
  đột, nguồn hết hạn/không rõ hiệu lực hoặc tình huống khẩn cấp phải đi theo
  safe fallback/manual handling phù hợp; không tạo substantive answer draft.
- Golden Dataset revision 0.1 có trạng thái Frozen và được phê duyệt cho MVP
  demo/offline evaluation, không phải production approval.
- Golden Dataset gồm 50 FAQ component cases: 40 answerable, 5 clarification,
  5 escalation; mỗi intent có 10 case.
- Golden Dataset gồm 30 E2E product-flow cases: 20 FAQ-linked, 10 standalone;
  expected terminal distribution là 20 approved và 10 escalated.
- Canonical reason-code coverage là 10/10; freeze có approval record và
  SHA-256 integrity evidence.
- M1 Answer Quality dùng 40 answerable cases, target ít nhất 85%, tương ứng
  ít nhất 34/40 PASS.
- M2 Efficiency đặt mục tiêu giảm ít nhất 50% median handling time trên paired
  manual/AI-assisted E2E execution.
- M3 Safety dùng 16 unique safety-handling E2E cases, target ít nhất 90%,
  tương ứng ít nhất 15/16 PASS.
- Human-control và logging-completeness là gate 100% trên 30 E2E cases.

QUY TẮC CHỐNG PHÓNG ĐẠI

- Không nói M1, M2 hoặc M3 đã đạt vì evals/results/report.md hiện là NOT RUN,
  trừ khi trong input có run artifact mới chứng minh điều ngược lại.
- Không nói MVP đã code xong, deploy, có URL demo hoặc production-ready nếu
  không có bằng chứng trực tiếp trong repository.
- Không nói wireframe đã được vẽ/export nếu chỉ có UI Flow specification.
- Không nói AI logging đã chạy end-to-end nếu mới chỉ có logging requirement,
  gate hoặc report template.
- Không gọi các số 48–105 FAQ/ngày và 3–7 phút/case là số liệu production đã
  đo; phải ghi đây là planning hypothesis cần validation.
- Không nói năm intent là top intent theo dữ liệu production; đây là working
  scope đã freeze cho vòng MVP evaluation.
- Không nói approval có tên cá nhân nếu business review ghi tên chưa được cung
  cấp. Có thể ghi approval được lưu theo vai trò Project Owner/Business
  Approver và chỉ áp dụng cho MVP demo/offline evaluation.
- Không đưa nội dung canonical knowledge quá chi tiết hoặc chép dài nguyên văn;
  hãy tóm tắt nhóm nguồn, quy trình chuẩn hóa và cơ chế kiểm soát.

CẤU TRÚC BÁO CÁO BẮT BUỘC

Viết báo cáo tương đương khoảng 8–12 trang, ưu tiên tính rõ ràng hơn độ dài,
theo cấu trúc sau:

1. Trang tiêu đề
   - Tên đề tài.
   - Phiên bản báo cáo và ngày lập.
   - Trạng thái dự án: Product/Data/Evaluation baseline prepared and frozen;
     implementation/evaluation execution status phải theo bằng chứng.

2. Tóm tắt điều hành
   - Bài toán, giải pháp, phạm vi MVP.
   - Các deliverable quan trọng đã hoàn thành.
   - Trạng thái hiện tại và bước tiếp theo.

3. Bối cảnh và phát biểu bài toán
   - Actor, current workflow, bottleneck, risk/failure impact.
   - Phân biệt observed problem, planning hypothesis và unknown cần đo.

4. Mục tiêu sản phẩm và giải pháp ResidentGPT
   - Product vision, JTBD và solution hypothesis.
   - Human-in-the-loop và lý do không auto-send.
   - Sơ đồ luồng chữ ngắn từ nhập câu hỏi đến Approved/Escalated.

5. Phạm vi MVP đã khóa
   - Năm intent.
   - In scope, out of answerable scope nhưng thuộc safety-handling scope,
     và out of product scope.
   - Acceptance criteria và change rule.

6. Thiết kế trải nghiệm và UI Flow
   - Tóm tắt Flow A–I.
   - Bốn nhóm trạng thái trọng tâm: nhập liệu, processing/loading, kết quả có
     citation và clarification/manual handoff.
   - Approval/Copy gate, edit invalidation và New Case reset.
   - Ghi đúng trạng thái wireframe: chỉ được nói đã hoàn thành nếu có artifact.

7. Xây dựng Knowledge Source Pack
   - Cách thu thập nguồn, chuẩn hóa Markdown canonical và metadata.
   - Cấu trúc manifest, intent-source map, section ID và review log.
   - Eligibility policy, scope constraint, conflict handling và hard block.
   - Kết quả: revision, số tài liệu, trạng thái freeze và phạm vi sử dụng.
   - Nêu các known gaps được chấp nhận khi freeze.

8. Xây dựng Golden Evaluation Dataset
   - Lý do chọn mô hình hai lớp FAQ component + E2E product flow.
   - Quy mô/phân bổ dataset, case contract và reason-code coverage.
   - M1, M2, M3, human-control gate và logging-completeness gate.
   - Business review, approval, checksum và change control.
   - Nhấn mạnh baseline đã sẵn sàng nhưng evaluation thực tế chưa chạy nếu
     report vẫn là NOT RUN.

9. Tính nhất quán và traceability
   - Giải thích chuỗi:
     Problem Card → Product Brief → PRD → UI Flow → MVP/Data Scope Lock →
     Knowledge Pack → Golden Dataset → Evaluation Report.
   - Lập bảng mapping tối thiểu các cột:
     Deliverable | Mục đích | Bằng chứng/file | Trạng thái | Đầu ra chính.
   - Trình bày bảy nhóm quyết định đã đồng bộ trong
     MVP_CONSISTENCY_ALIGNMENT_v0.2.md.

10. Tổng hợp công việc đã hoàn thành
    Chia thành các nhóm:
    - Product discovery và problem framing.
    - Product definition và acceptance criteria.
    - UX/UI flow specification.
    - Knowledge engineering/data governance.
    - Evaluation design và governance.
    Với mỗi nhóm, ghi kết quả cụ thể và artifact chứng minh.

11. Trạng thái hiện tại, hạn chế và việc tiếp theo
    Lập ba nhóm rõ ràng:
    - Completed/Frozen.
    - Prepared but not executed.
    - Remaining/Next steps.
    Các bước tiếp theo nên ưu tiên: wireframe nếu chưa có, implementation,
    retrieval/prompt integration, AI logging E2E, chạy Golden Dataset, điền
    evaluation report, sửa lỗi theo kết quả, deploy demo và chỉ xem xét pilot
    khi đạt gate cùng các policy bắt buộc.

12. Kết luận
    - Đánh giá mức độ sẵn sàng hiện tại một cách cân bằng.
    - Nêu giá trị của việc khóa scope/data/evaluation trước khi build.
    - Không đưa ra pilot/production approval khi chưa có kết quả thực nghiệm.

13. Phụ lục
    - Danh mục artifact chính.
    - Bảng thuật ngữ: BQL, CSKH, RAG, Golden Dataset, clarification,
      escalation, Approved, Frozen.
    - Các metric và công thức đánh giá.

YÊU CẦU VỀ CÁCH VIẾT VÀ DẪN NGUỒN

- Viết bằng tiếng Việt chuẩn, giọng văn báo cáo dự án AI, rõ ràng và dễ hiểu.
- Dùng Markdown với heading, bullet và bảng có chọn lọc.
- Mỗi số liệu, trạng thái freeze, quyết định scope hoặc kết luận quan trọng
  phải có dẫn nguồn gần nội dung theo dạng:
  [Nguồn: đường_dẫn_file — tên mục/section].
- Không dẫn file chung chung nếu có thể chỉ ra section cụ thể.
- Không chép dài nguyên văn; diễn giải ngắn gọn, bảo toàn nghĩa.
- Tách rõ “fact đã được tài liệu xác nhận”, “giả thuyết cần kiểm chứng” và
  “đề xuất bước tiếp theo”.
- Khi mô tả công việc đã hoàn thành, dùng động từ có bằng chứng như “đã xây
  dựng”, “đã chuẩn hóa”, “đã review”, “đã khóa”; không dùng “đã triển khai”
  hoặc “đã đạt” nếu mới chỉ có specification/baseline.

KIỂM TRA TRƯỚC KHI TRẢ KẾT QUẢ

Trước khi xuất báo cáo, hãy tự kiểm tra:

1. Có câu nào biến planning hypothesis thành số liệu đã đo không?
2. Có câu nào nói evaluation đã PASS về chất lượng/safety/efficiency khi report
   vẫn NOT RUN không?
3. Có nhầm UI Flow với wireframe đã export không?
4. Có nhầm Golden approval cho offline evaluation với production approval
   không?
5. Có nhầm nguồn được chép từ kênh chính thức với tích hợp/xác minh độc lập
   trực tiếp bởi Vinhomes không?
6. Có mô tả đúng 21 knowledge documents, 50 FAQ, 30 E2E và các phân bổ không?
7. Có dẫn nguồn cho mọi fact và trạng thái quan trọng không?

Nếu một điểm chưa đủ bằng chứng, hãy ghi “Chưa có bằng chứng trong tài liệu
được cung cấp” thay vì suy đoán.

ĐẦU RA

Chỉ trả về bản báo cáo hoàn chỉnh, không mô tả quá trình suy luận nội bộ. Cuối
báo cáo thêm mục “Checklist xác thực nội dung” ngắn, xác nhận đã thực hiện bảy
kiểm tra nêu trên và liệt kê mọi điểm cần người dùng xác nhận thêm.
```

