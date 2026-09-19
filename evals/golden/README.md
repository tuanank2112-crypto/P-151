# ResidentGPT Golden Evaluation Dataset

Đây là Golden Evaluation Dataset dạng hai lớp cho ResidentGPT MVP, được
xây từ Knowledge Pack revision `1.18` đã khóa.

Dataset revision `0.1` đã được review, ghi approval và chuyển sang `Frozen`
ngày 19/09/2026 cho MVP demo/offline evaluation. Đây là gold baseline chính
thức trong phạm vi này; không phải phê duyệt Controlled Pilot hoặc Production.

## Cấu trúc

```text
evals/golden/
├── README.md
├── dataset_manifest.yaml
├── faq_component_cases.jsonl
├── e2e_product_flow_cases.jsonl
├── rubric.md
├── business_review_v0.1.md
├── review_log.md
├── FROZEN_CHECKSUMS.sha256
├── validate_dataset.ps1
└── results/
    └── README.md
```

## Hai lớp evaluation

### FAQ component

`faq_component_cases.jsonl` có 50 case, mỗi intent có 10 case. Lớp này
chạy nhanh để kiểm tra:

- intent;
- required-context behavior;
- retrieval và scope;
- document/section citation;
- critical facts;
- unsupported claim;
- clarification hoặc escalation ở mức component.

M1 Answer Quality sử dụng 40 case `answerable` trong lớp này.

### E2E product flow

`e2e_product_flow_cases.jsonl` có 30 flow case. Hai mươi case tham chiếu
FAQ case qua `base_faq_case_id`; mười case còn lại kiểm tra lỗi hệ thống,
no-source, unsupported/unresolved intent, human control và New Case reset.

Lớp này kiểm tra state transition từ input đến đúng business terminal
state. `Approved` và `Escalated` đều là completion state hợp lệ của sản
phẩm, nhưng mỗi case chỉ PASS khi kết thúc đúng `expected_terminal_state`.

M3 dùng 16 unique safety-handling E2E case ID được khóa trong manifest;
target ≥90% tương ứng tối thiểu 15/16 PASS. Canonical reason-code enum có
10 code và mỗi code có ít nhất một E2E case trong revision `0.1`.

Copy là optional event, không phải completion state và không kết thúc M2.

## Quy ước FAQ case

Mỗi dòng JSON là một object độc lập. Các trường cốt lõi:

- `case_id`: ID ổn định.
- `intent_id`: `I-01` đến `I-05`.
- `scenario_type`: `answerable`, `clarification` hoặc `escalation`.
- `query`: câu hỏi synthetic, không chứa dữ liệu cư dân thật.
- `context`: context đã có và còn thiếu.
- `expected_behavior`: `generate_draft`, `clarification_required` hoặc
  `escalate`.
- `gold_sources`: document và section được phép hỗ trợ đáp án.
- `prohibited_source_sections`: section không được sử dụng.
- `must_include_facts`: fact bắt buộc.
- `must_not_include`: claim hoặc hành vi bị cấm.
- `expected_reason_code`: reason code của fallback/escalation, nếu có.
- `review_status`: trạng thái review label.

## Quy ước E2E case

- `flow_case_id`: ID flow ổn định.
- `base_faq_case_id`: FAQ scenario được dùng, hoặc `null` cho flow thuần UI.
- `flow_groups`: Flow A–I được case bao phủ.
- `operator_actions`: hành động BQL/test runner cần thực hiện.
- `expected_state_sequence`: các state bắt buộc theo thứ tự.
- `critical_checkpoints`: tất cả phải pass.
- `expected_terminal_state`: `approved` hoặc `escalated`.
- `post_terminal_expectation`: kiểm tra sau completion, nếu có.
- `diagnostic_applicability`: diagnostic nào phải chấm và diagnostic nào
  là `not_applicable`.

## Chạy kiểm tra cấu trúc

Từ repository root:

```powershell
powershell -ExecutionPolicy Bypass -File evals/golden/validate_dataset.ps1
```

Validator kiểm tra số lượng và phân bổ case, ID trùng, required fields,
behavior/scenario consistency, reason code, diagnostic applicability, E2E
reference, terminal state, required-context contract, coverage của toàn bộ
canonical reason-code enum, document ID, section ID và Knowledge Pack revision.
Validator kiểm tra cả approval record, trạng thái freeze và SHA-256 integrity;
business approval vẫn được kiểm soát bởi `business_review_v0.1.md`.

## Quy tắc sử dụng

- Không index dataset vào RAG.
- Không dùng câu hỏi/đáp án trong dataset làm retrieval knowledge.
- Không đưa dữ liệu cư dân thật vào query hoặc result fixture.
- Không thay gold label sau khi freeze mà không tăng revision và ghi log.
- Model/prompt không được truy cập expected behavior hoặc gold facts trong
  lúc chạy evaluation.
