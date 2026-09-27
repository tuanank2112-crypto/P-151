# ResidentGPT v0.4 — bản đồ tài liệu triển khai

> **Trạng thái:** đặc tả mục tiêu, chưa phải bằng chứng hệ thống đã triển khai.
> **Ngày lập:** 23/09/2026.
> **Mốc đội dự án:** demo bốn hạng mục v0.4 trước hết ngày 04/10/2026 (Asia/Ho_Chi_Minh).
> **Baseline kế thừa:** MVP v0.3, Knowledge Pack `1.18`, Golden Dataset `0.3`.

## Đọc theo thứ tự

1. [PRD v0.4](PRD_ResidentGPT_v0.4.md): phạm vi, chính sách định tuyến, tiêu chí nghiệm thu và các quyết định còn mở.
2. [Kiến trúc và hợp đồng agent](AGENT_ARCHITECTURE_AND_CONTRACTS.md): state, đầu vào/đầu ra, evidence và API/event contract.
3. [Quản trị tài liệu và HITL](KNOWLEDGE_GOVERNANCE_AND_HITL.md): ingest, OCR, phê duyệt, xuất bản, version và duyệt câu trả lời.
4. [UI Flow v0.4](UI_FLOW.md): các màn hình và trạng thái cư dân/BQL.
5. [Eval và dashboard](EVAL_METRICS_DASHBOARD.md): rubric, tử số, mẫu số, cohort và nguồn sự kiện.
6. [Backlog bốn người](DELIVERY_BACKLOG.md): owner theo vai trò, phụ thuộc, mốc tích hợp và bằng chứng demo.

Các file v0.3 tại `docs/Problem_Card.md`, `docs/Product_Brief_ResidentGPT_MVP.md`, `docs/PRD_ResidentGPT_MVP.md`, `docs/UI_Flow_ResidentGPT_MVP.md`, `docs/MVP_DATA_SCOPE_LOCK.md`, `docs/MVP_CONSISTENCY_ALIGNMENT_v0.3.md` và `docs/architecture_diagram.md` tiếp tục mô tả baseline đóng băng. Mốc BTC `27/10/2026` ghi trong các file đó là lịch sử của baseline; mốc nộp `04/10/2026` trong bộ tài liệu này là quyết định mới của đội dự án. Mốc nội bộ hoàn thành MVP v0.3 trước 27/09/2026 là checkpoint kế hoạch, chưa có bằng chứng hoàn thành.

## Trạng thái có thể kiểm chứng tại thời điểm lập tài liệu

| Hạng mục | Bằng chứng đọc trong repo | Kết luận |
|---|---|---|
| API và graph | `src/main.py`, `src/api/routes.py`, `src/agents/graph.py` có FastAPI và LangGraph mẫu | Có khung chạy; chưa có flow ResidentGPT |
| Retrieval | `src/agents/tools/example_tool.py` trả chuỗi ví dụ; dependency vector DB còn comment trong `requirements.txt` | Chưa có retrieval/index thật |
| Auth, memory, persistence, UI | Không có implementation tương ứng trong `src/` hoặc frontend tại thời điểm kiểm tra | Chưa chứng minh đã triển khai |
| Knowledge | `knowledge/manifest.yaml` revision `1.18`, 21 canonical và scope lock | Baseline dữ liệu đã khóa; không phải upload runtime |
| Golden | `evals/golden/dataset_manifest.yaml` revision `0.3`, 50 FAQ và 30 E2E | Dataset đóng băng; validator PASS được ghi trong project report |
| Đánh giá sản phẩm | `eval/results/report.md` ghi `NOT RUN` | Chưa có actual product eval |

Không dùng các tài liệu mục tiêu v0.4 để tuyên bố các capability ở cột “chưa” đã hoàn thành. Mỗi kết quả demo phải có build, thời điểm, URL hoặc môi trường chạy, input, output và người kiểm tra.

## Nguồn sự thật và phạm vi

- **Nội dung baseline:** `knowledge/manifest.yaml` và `knowledge/intent_source_map.yaml` revision `1.18`; [MVP Data Scope Lock](../MVP_DATA_SCOPE_LOCK.md) quyết định eligibility. `knowledge_coverage_scope = VINHOMES_OCEAN_PARK`; `pilot_operator_scope = SAPPHIRE_1_BUILDING_S1_12_VINHOMES_OCEAN_PARK_1`. Knowledge rộng hơn pilot operator không tự tạo quyền trả lời cho site khác.
- **Hành vi MVP:** [PRD v0.3](../PRD_ResidentGPT_MVP.md), nhất là §5.1 và §8.1, cùng [Golden manifest](../../evals/golden/dataset_manifest.yaml). Năm intent, mười canonical reason code, Required Context Contract và 21 canonical giữ nguyên.
- **Hành vi bổ sung v0.4:** bộ tài liệu trong thư mục này. Tài liệu BQL xuất bản ở v0.4 nằm trong runtime corpus có version riêng; không ghi đè Knowledge Pack `1.18` hoặc golden `0.3`.
- **Kết quả thực tế:** chỉ artifact thực thi, log demo và eval run mới là bằng chứng. Tài liệu đặc tả không thay kết quả chạy.

## Kiểm tra nhất quán và quyết định

| ID | Quan sát / quyết định | Hệ quả |
|---|---|---|
| D-01 | PRD v0.3 §8.1 hiện đặt early high-risk gate trước required-context check; thiếu field phải `clarification_required` trước retrieval. FR-03 và UI Flow cùng quy tắc này. | Không sửa baseline. v0.4 giữ thứ tự: hard risk → classify/context → retrieval. |
| D-02 | Baseline v0.3: low confidence/no source/conflict tạo Escalation Card và ticket, không sinh substantive answer. v0.4 thêm HITL cho draft có evidence nhưng chưa đạt gate tự gửi. | Hard-risk và không có eligible evidence vẫn chuyển hỗ trợ. v0.3 golden phải chạy trên build/config v0.3 đã ghi version; v0.4 dùng bộ case/revision riêng. Chỉ các invariant chung được regression ngang hai version. |
| D-03 | `knowledge/manifest.yaml` là nguồn được duyệt; baseline khóa 21 tài liệu. | Upload v0.4 phải tạo version runtime độc lập và chỉ `published` mới được tìm kiếm. Eval v0.3 vẫn dùng snapshot `1.18`. |
| D-04 | Golden v0.3 có Gate 3A 100% cho severe cases, Gate 3B 15/16 cho safety handling. | Báo hai gate riêng, không để Gate 3B che một severe failure. |
| D-05 | User chốt demo v0.4 ngày 04/10/2026; baseline ghi mốc BTC 27/10/2026. | Không thay ngày lịch sử trong tài liệu frozen. Báo mốc mới ở v0.4 và backlog. |

## Open decisions trước khi bật demo

| ID | Quyết định cần chốt | Ảnh hưởng | Owner vai trò | Hạn đề xuất |
|---|---|---|---|---|
| O-01 | Ngưỡng confidence và phiên bản Grader sau calibration, cùng chính sách khi chưa có ngưỡng | Chặn auto-send | AI/Eval + Product owner | 30/09 |
| O-02 | Nhà cung cấp OCR/parser, giới hạn size/trang, chuẩn chất lượng trích xuất; ngưỡng mơ hồ giữ ở `needs_review` | Chặn nghiệm thu từng định dạng | Data/Infra + BQL | 28/09 |
| O-03 | BQL có được tự duyệt bản mình upload hay cần người duyệt khác; danh sách tài khoản demo | RBAC/audit | Product owner + BQL | 27/09 |
| O-04 | SLA review/handoff, người nhận nội bộ và chính sách dữ liệu cá nhân/retention | Vận hành có cư dân thật | BQL + Product owner | Trước pilot thật |
| O-05 | Cửa sổ quan sát 72 giờ cho reopen/follow-up cùng vấn đề có phù hợp thực tế BQL; phương thức thu feedback | Định nghĩa dashboard | Product owner + BQL | 29/09 |
| O-06 | Ngưỡng chất lượng số cho faithfulness/relevance và release, sau khi xem baseline thực đo | Quyết định go/no-go | Product owner + Eval | Trước release review |

Mọi TBD là việc cần chốt và ghi phiên bản quyết định. Không suy ra ngưỡng số từ tài liệu baseline nếu mục tiêu v0.4 chưa được duyệt.
