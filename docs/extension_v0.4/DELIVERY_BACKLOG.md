# ResidentGPT v0.4 — backlog bốn người đến 04/10/2026

> **Trạng thái:** kế hoạch cần thực thi, chưa đánh dấu task nào Done.
> **Giả định:** bốn người làm toàn thời gian 23/09–04/10, gồm cuối tuần. Code đang là template FastAPI/LangGraph; mốc này có rủi ro cao. Bốn capability phải chạy thật trong demo.
> **Mốc:** checkpoint MVP v0.3 trước 27/09; demo v0.4 hết ngày 04/10 (`Asia/Ho_Chi_Minh`). Mốc BTC 27/10 trong baseline frozen là lịch sử riêng.

## 1. Owner và cách bàn giao

| Owner vai trò | Phụ trách chính | Interface bàn giao |
|---|---|---|
| **A — AI/Agent** | Chat memory/rewrite, baseline RAG, classifier, composer, verifier, confidence calibration, eval chất lượng draft | `ResidentOutcome`, `EvidenceItem`, `VerifierResult`, eval run artifacts |
| **B — UI/UX** | Resident Chat, citations/feedback, BQL document preview, answer-review Inbox, eval/dashboard UI | API schemas và state taxonomy từ A/C/D |
| **C — Knowledge/Ingestion** | Baseline index và source eligibility, MD/TXT/PDF/DOCX/image parsers, OCR, version/publish/rollback | `DocumentVersion`, active source snapshot, retriever adapter |
| **D — Platform/API/Data** | Auth/RBAC, case/review/handoff event persistence, API orchestration, metric aggregation, deployment/observability | APIs, idempotency, dashboard cohort queries, release evidence |

Mỗi owner điền tên thật trong task board khi nhận việc. Thay đổi interface phải được cả owner sản xuất và owner tiêu thụ xác nhận trong ngày. Product owner/BQL chốt O-01…O-06 trong [decision log](README.md).

## 2. Công việc theo mốc

### 23–26/09: hoàn thành MVP v0.3 làm nền

| ID / owner | Việc cụ thể | Phụ thuộc | Bằng chứng hoàn thành |
|---|---|---|---|
| M-A1 / A | Thay graph mẫu bằng early hard-risk → rewrite → classify/context → retrieval → grounded answer/escalation; giữ 5 intents, Required Context và 10 reason codes | C baseline index, D schema | E2E `answered`, `clarification_required`, `escalated`; citation document+section đúng |
| M-B1 / B | Resident Chat, clarification, answer citations, Escalation Card và BQL Inbox tối thiểu; loading/error | D auth/API | Hai role thao tác được, không blank screen |
| M-C1 / C | Index 21 canonical của `1.18`, đọc eligibility/section exclusions từ manifest/map; không sửa corpus | D storage/index choice | Query có source đúng; negative guards không suy rộng |
| M-D1 / D | Auth resident/management, ownership conversation, ticket persistence/audit, health/deploy | A/B contracts | Cross-role 403, ticket không trùng, Live URL hoặc môi trường demo ghi rõ |
| M-ALL / A+B+C+D | Chạy validator và actual Golden v0.3 50 FAQ/30 E2E, ghi artifact lỗi và triage; smoke deployment | M-A1…M-D1 | Kết quả thật, n đã chạy, Gate 3A riêng; report vẫn `NOT RUN` nếu chưa chạy |

Ngày 26/09 là **checkpoint có bằng chứng**, không tự coi Done theo thời gian. Nếu thiếu Live URL, auth, RAG, memory hoặc golden run, ghi rõ phần thiếu và owner.

### 27–30/09: dựng xương sống v0.4 và contract liên team

| ID / owner | Việc cụ thể | Phụ thuộc | Bằng chứng hoàn thành |
|---|---|---|---|
| E-A1 / A | Classifier, retriever và verifier typed; trace source/prompt/model/index versions; coordinator có giới hạn retry và decision gate | M-A1, C active snapshot, D event schema | Demo answer auto được verifier PASS; unsupported claim bị giữ |
| E-A2 / A | Calibrate low-confidence gate trên validation có người review, ghi threshold/version và error trade-off; hard-risk override | M-ALL, D config | O-01 được chốt trước auto-send; severe cases không draft |
| E-B1 / B | Document list/upload/preview/review/publish/version UI; chặn action sai trạng thái | C parser/version API, D RBAC | BQL đi trọn một file từ upload tới published; resident 403 |
| E-B2 / B | Answer Review UI: draft, claim verdict, citations, approve/edit/reject/needs_more_info; resident waiting state | A verifier, D review API | Draft chưa duyệt không lộ; approved final gửi một lần |
| E-C1 / C | Parser `.md/.txt/.pdf/.docx/.png/.jpg/.jpeg`, OCR PDF scan/ảnh, warning trang lỗi; preview + locator | D storage/upload API | Mỗi format có mẫu demo; parse_failed/needs_review không publish |
| E-C2 / C | Version lifecycle, approval, index smoke, atomic active snapshot, supersede/withdraw/rollback | E-C1, D transaction/event | Retrieval chỉ thấy approved published current version; rollback đúng |
| E-D1 / D | Schema/API case, document version, review, support handoff, feedback; role/permission; event ID/idempotency | M-D1, hợp đồng v0.4 | Audit actor/time/reason; retry không nhân đôi task/ticket |
| E-D2 / D | Eval run registry và lưu event để dựng dashboard; API có numerator/denominator/cohort | E-D1, metric contract | Tính lại được metric từ event, không hardcode UI |

### 01–03/10: tích hợp, eval và diễn tập

| ID / owner | Việc cụ thể | Phụ thuộc | Bằng chứng hoàn thành |
|---|---|---|---|
| I-A1 / A | Chạy eval draft faithfulness/relevance trên dataset v0.4 riêng; người review mẫu; drill-down claim/rubric | E-A1, E-C2, E-D2 | Run ID/version/n/denominator và severe failures hiển thị |
| I-B1 / B | Feedback `Đã/Chưa giải quyết`, eval table và dashboard UI; cohort/date/timezone/unknown/immature | E-D2 | Card số liệu khớp API; denominator 0 hiển thị N/A |
| I-C1 / C | Regression trên supersede, conflict, OCR kém và hiệu lực; câu hỏi dùng đúng snapshot | E-C2, E-A1 | Version cũ/withdrawn không xuất hiện; conflict đi review/handoff |
| I-D1 / D | Tính auto-answer, confirmed auto-resolution, 72h proxy, feedback coverage; separate review/handoff; lỗi auth/data | E-D1, I-B1 | Kết quả truy vấn với sample case có thể kiểm tay |
| I-ALL / A+B+C+D | E2E bốn capability, regression các invariant chung v0.3 trên v0.4, giữ actual golden run của build v0.3 riêng; fault injection và role isolation | Các task trên | Mỗi AC4-01…AC4-09 có pass/fail và link artifact; không đổi nhãn golden cũ |

### 04/10: chốt bản nộp

| ID / owner | Việc cụ thể | Bằng chứng hoàn thành |
|---|---|---|
| R-A / A | Đóng băng version model/prompt/index/threshold, chạy lại representative AI/eval cases | Actual run artifact và danh sách severe issues |
| R-B / B | Kiểm UI hai role, mobile chat, BQL workflow và rehearsal theo demo script | Video/screenshot và checklist từng flow |
| R-C / C | Khóa active knowledge snapshot; xác nhận publish/withdraw/rollback và file formats | Snapshot/version IDs, OCR/preview evidence |
| R-D / D | Deploy/health/smoke, dashboard `as_of`, export release evidence, kiểm logs/role isolation | Live URL/môi trường, build, timestamp, health và metric query |
| R-ALL | Product owner xem bốn flow live, ghi kết quả thực và open defects | Quyết định nộp dựa trên bằng chứng |

## 3. Đường phụ thuộc và ưu tiên

`D auth + persistence` và `C baseline/active index` mở khóa `A agent`; `A verifier` và `D review API` mở khóa `B answer review`; `D events` và `B feedback` mở khóa dashboard. Parser/OCR chạy từ 27/09 vì ảnh/PDF scan cần thời gian xử lý lỗi thực. Eval và dashboard bắt đầu ghi event cùng lúc xây API.

Bốn capability và các format đã chốt đều là tiêu chí demo. Khi trễ, báo blocker và người/giờ bổ sung cần thiết trong ngày; không xóa bớt capability hoặc đổi thành mock mà không có quyết định Product owner. Ưu tiên sửa blocker: hard-risk/grounding và auth → publish eligibility → answer review → event correctness/metric → giao diện phụ.

## 4. Definition of Done theo task

Một task Done khi interface được tích hợp với ít nhất một consumer, có ví dụ input/output thật, xử lý failure path, có người khác review và artifact kiểm chứng. PRD/diagram hoàn thành không chứng minh code đã chạy. Báo tiến độ hàng ngày theo `Done / In progress / Blocked`, owner, link kết quả và quyết định cần chốt; giữ `eval/results/report.md` là `NOT RUN` cho tới khi actual Golden run được ghi đúng mẫu.
