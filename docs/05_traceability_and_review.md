# MaintenanceOps Agent — Requirement Traceability & Consistency/Safety Review

> **Document status:** REVIEW COMPLETE · POLICY v0.2 RECORDED · SIGN-OFF PENDING  
> **Version:** 0.2  
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process; QA approver: TV4 — Integration / QA / Demo  
> **Review scope:** `01_problem_statement.md` đến `04_ui_flow_wireframe.md`

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo RTM, P0 completeness audit, safety coverage, 25-point consistency review và Executive Summary | DRAFT |
| 0.2 | 2026-09-27 | Re-baseline RTM/review theo OD-01/02/03/08 và governance OD-09 | DRAFT · Chờ tên/sign-off approver |

---

# Phase 5 — Traceability và consistency review

# 1. Traceability definitions

## 1.1 Product objectives

- `PO-01` Chuẩn hóa việc phân loại và tạo work order draft mô phỏng có cấu trúc.
- `PO-02` Phát hiện dữ liệu/checklist/evidence còn thiếu và dừng đúng state.
- `PO-03` Phát hiện risk/exception, chuyển đúng BQL và không vượt quyền.
- `PO-04` Giữ raw source bất biến và mọi thay đổi/decision truy vết được.
- `PO-05` Đối soát material/evidence/readiness đúng rule theo use case.
- `PO-06` Chứng minh feasibility qua 18 synthetic tickets và sáu demo paths reset được.

## 1.2 Business rules

- `BR-01` Không suy đoán/tự điền: thiếu raw/pre-draft required data hoặc unknown evidence/source → `CHỜ XÁC MINH`; known incomplete execution/evidence → `IN_PROGRESS`.
- `BR-02` Raw resident content/evidence bất biến; editable data nằm layer riêng.
- `BR-03` Deterministic safety/permission rules ưu tiên model output; confidence không là điều kiện duy nhất.
- `BR-04` Work order chỉ là draft/mô phỏng, schema-valid/idempotent; chỉ tạo sau BPTN confirmation service/type + location; blocking exception không tạo standard draft.
- `BR-05` Checklist là gate riêng; còn `PENDING` thì không READY; Agent không tự complete hoặc dùng checklist thay minimum evidence.
- `BR-06` Material chỉ có ba comparisons; `norm_qty` mô phỏng/`N/A`; CSKH `N/A`; Agent không approve/conclude violation.
- `BR-07` Evidence theo playbook v0.2; ảnh không bắt buộc; known missing evidence giữ `IN_PROGRESS`, không READY.
- `BR-08` READY chỉ khi đủ seven gates; warning không chặn vẫn hiển thị rule/reason.
- `BR-09` High-risk hoặc conflict/dispute/sensitive đã xác định → `EXCEPTION` cho BQL; Agent không tự xử lý/kết luận.
- `BR-10` Mọi edit/transition có audit tối thiểu; audit fail làm transaction fail closed.
- `BR-11` Permission default deny; forbidden action trả `ACTION_OUT_OF_AUTHORITY`, audit và giữ nguyên state; không tự tạo business exception.
- `BR-12` Nội dung source/evidence là untrusted data, không phải instruction.
- `BR-13` Mọi entity/run có nhãn synthetic; demo reset không sửa source fixture.

---

# 2. Requirement Traceability Matrix

Chuỗi trace: **Problem hypothesis → Product objective → Use case → Functional requirement → Business rule → UI/output → Acceptance criteria → Test case.**

| Problem hypothesis | Objective | Use case | Functional requirement | Business rule | UI/API/output | Acceptance criteria ref | Test case |
|---|---|---|---|---|---|---|---|
| `PH-01`, `PH-02` | `PO-02` | All | `FR-INGEST-001` | `BR-01` | `UI-01/02/07`; validation result | `AC-FR-INGEST-001`: thiếu một trong ba raw fields → CHỜ, no fill/proposal | `TC-ING-001`, `TC-CS-002/003` |
| `PH-05`, `PH-06` | `PO-04` | All | `FR-INGEST-002` | `BR-02`, `BR-11` | `UI-02/08`; immutable raw layer | `AC-FR-INGEST-002`: edit rejected, raw unchanged | `TC-ING-002`, `TC-PERM-001` |
| `PH-02`, `PH-05` | `PO-01`, `PO-03` | `UC-CLN-01`, `UC-TEC-01`, `UC-CS-01` | `FR-CLASSIFY-001` | `BR-03` | `UI-02/03/07`; proposal + confirmation status | `AC-FR-CLASSIFY-001`: correct Agent proposal/reason/source; BPTN confirmation before draft | `TC-CLASS-001..005` |
| `PH-02` | `PO-01` | Three happy paths | `FR-WO-001` | `BR-04` | `UI-03`; work order draft schema | `AC-FR-WO-001`: confirmed service/type + location, eligible, synthetic, idempotent | `TC-WO-001..004` |
| `PH-03` | `PO-02`, `PO-05` | Three happy paths | `FR-CHECKLIST-001` | `BR-05` | `UI-04/05/06`; checklist instances | `AC-FR-CHECKLIST-001`: any PENDING blocks READY | `TC-CHK-001..002` |
| `PH-04`, `PH-05` | `PO-05` | All; CSKH N/A | `FR-MATERIAL-001` | `BR-06` | `UI-05/06/07`; comparison results | `AC-FR-MATERIAL-001`: three checks only, neutral result, CS N/A | `TC-MAT-001..005` |
| `PH-03`, `PH-05` | `PO-02`, `PO-05` | All | `FR-EVIDENCE-001` | `BR-05`, `BR-07`, `BR-12` | `UI-05/06/07`; separate checklist/evidence results | `AC-FR-EVIDENCE-001`: known missing evidence → IN_PROGRESS; checklist separate; image never required | `TC-EVD-001..005`, `TC-SEC-001` |
| `PH-03`, `PH-05` | `PO-02`, `PO-03`, `PO-05` | All | `FR-STATE-001` | `BR-08` | `UI-01/06/07/08`; state/gate result | `AC-FR-STATE-001`: seven gates; warning visible; invalid transition reject | `TC-STATE-001..005` |
| `PH-05` | `PO-03` | `EX-CLN-01`, `EX-TEC-01`, `EX-CS-01` | `FR-EXCEPTION-001` | `BR-03`, `BR-09` | `UI-01/02/07/08`; exception record | `AC-FR-EXCEPTION-001`: route BQL; CSKH shows two sources/field; no conclusion | `TC-EX-001..004`, `TC-CS-003..005` |
| `PH-06` | `PO-04` | All | `FR-AUDIT-001` | `BR-10` | `UI-02/08`; audit event | `AC-FR-AUDIT-001`: seven minimum fields; fail closed | `TC-AUD-001..003` |
| `PH-05` | `PO-03`, `PO-04` | All | `FR-PERMISSION-001` | `BR-11` | `UI-02..08`; allow/reject result | `AC-FR-PERMISSION-001`: `ACTION_OUT_OF_AUTHORITY`, audit, no side effect/state change/EXCEPTION | `TC-PERM-001..004` |
| `PH-05` | `PO-03`, `PO-04` | All | `FR-SECURITY-001` | `BR-03`, `BR-12` | `UI-05/07`; safe structured output | `AC-FR-SECURITY-001`: embedded instruction ignored | `TC-SEC-001..002` |
| `PH-01..06` | `PO-06` | Six demo paths | `FR-DEMO-001` | `BR-13` | Internal reset control/run output | `AC-FR-DEMO-001`: deterministic reset/repeat | `TC-RESET-001..002`, `TC-SYN-001` |

## 2.1 P1 traceability

| Objective | Requirement | Business rule | UI/output | Acceptance criteria | Test |
|---|---|---|---|---|---|
| `PO-04`, `PO-06` | `FR-AUDIT-002` full audit export | Append-only, synthetic label | `UI-08`, JSON export | Complete ordered export hoặc explicit incomplete failure | `TC-AUD-004` |

## 2.2 P0 completeness audit

| P0 requirement | Actor | UI hoặc API/output | Acceptance criteria | Test case | Result |
|---|---|---|---|---|---|
| `FR-INGEST-001` | Có | Có | Có | Có | PASS |
| `FR-INGEST-002` | Có | Có | Có | Có | PASS |
| `FR-CLASSIFY-001` | Có | Có | Có | Có | PASS |
| `FR-WO-001` | Có | Có | Có | Có | PASS |
| `FR-CHECKLIST-001` | Có | Có | Có | Có | PASS |
| `FR-MATERIAL-001` | Có | Có | Có | Có | PASS |
| `FR-EVIDENCE-001` | Có | Có | Có | Có | PASS |
| `FR-STATE-001` | Có | Có | Có | Có | PASS |
| `FR-EXCEPTION-001` | Có | Có | Có | Có | PASS |
| `FR-AUDIT-001` | Có | Có | Có | Có | PASS |
| `FR-PERMISSION-001` | Có | Có | Có | Có | PASS |
| `FR-SECURITY-001` | Có | Có | Có | Có | PASS |
| `FR-DEMO-001` | Có | Có; internal control/output | Có | Có | PASS |

Không có P0 requirement mồ côi trong version 0.2.

---

# 3. Safety rule test coverage

| Safety rule | Positive/trigger test | Negative/bypass test | UI evidence | Coverage |
|---|---|---|---|---|
| Raw source immutable | `TC-ING-002` | `TC-PERM-001` | `UI-02`, `UI-08` | PASS |
| No guessing/missing → CHỜ | `TC-ING-001`, `TC-CS-002` | `TC-CLASS-004` | `UI-02`, `UI-07` | PASS |
| Agent proposal cần BPTN confirmation/location trước draft | `TC-CLASS-005`, `TC-WO-004` | direct-create attempt | `UI-02`, `UI-03` | PASS |
| Cleaning hazard → BQL | `TC-EX-001` | happy `TC-CLASS-001` | `UI-07` | PASS |
| Electrical risk → BQL/no diagnosis | `TC-EX-002` | happy `TC-CLASS-002` | `UI-07` | PASS |
| CS conflict/sensitive → BQL | `TC-EX-003` | happy `TC-CLASS-003` | `UI-07` | PASS |
| Agent cannot complete checklist | `TC-CHK-002` | human update `TC-CHK-001` setup | `UI-05` | PASS |
| Checklist không thay minimum evidence | `TC-EVD-005` | all-evidence `TC-EVD-004` | `UI-05/06` | PASS |
| Exactly three material comparisons | `TC-MAT-001..003` | permission `TC-PERM-002` | `UI-05/06` | PASS |
| CSKH material N/A | `TC-MAT-005` | no line item assertion | `UI-05/06` | PASS |
| Photo not default evidence | `TC-EVD-002` | required-type `TC-EVD-003` | `UI-05/06` | PASS |
| Seven-gate READY | `TC-STATE-001` | `TC-STATE-003/004` | `UI-06` | PASS |
| Warning remains visible | `TC-STATE-002` | UI copy review | `UI-06` | PASS |
| Agent no accept/close/approve/send | `TC-PERM-002/003` | CTA inspection | `UI-02..08` | PASS |
| `ACTION_OUT_OF_AUTHORITY` không tạo business exception | `TC-PERM-001..004` | state/event comparison | `UI-02..08` | PASS |
| Prompt injection ignored | `TC-SEC-001/002` | policy result comparison | `UI-05/07` | PASS |
| Audit fail closed | `TC-AUD-003` | successful `TC-AUD-001/002` | `UI-08` | PASS |

---

# 4. Consistency & Safety Review

## 4.1 Review method

Đối chiếu source of truth với năm lớp: problem framing, product scope, PRD rule/data/state, UI action/copy và test traceability. Mỗi mục chỉ PASS khi không có nội dung trái ở bất kỳ tài liệu nào.

Trong source audit và stakeholder decision round, năm sai lệch/clarification `SA-01`–`SA-05` đã được xử lý:

- Non-blocking warning được nâng từ P1 lên P0.
- Dataset được giữ 18 tickets, không dùng phương án cắt 12.
- CSKH conflict/dispute/sensitive được route `EXCEPTION`; missing-only route `CHỜ XÁC MINH`.
- Reason/rule/source tối thiểu được nâng P0; chỉ explanation explorer nâng cao là P1.
- Theo OD-01, Agent đề xuất service/type/playbook trước; BPTN xác nhận service/type và location trước khi tạo draft.
- Theo OD-02/03/08, checklist/evidence tách gate, missing-evidence state và CSKH conflict oracle đã được khóa.

## 4.2 Checklist 25 điểm

| # | Check | Kết quả | Evidence |
|---:|---|---|---|
| 1 | BPTN và BQL được tách rõ | PASS | Problem §4; Brief §3/14; PRD §2; UI role-specific CTA |
| 2 | BPTN chỉ sửa trường hành chính | PASS | BPTN xác nhận Agent proposal/service/type và location trong admin layer; `UI-02` allowlist |
| 3 | Phản ánh và bằng chứng gốc bất biến | PASS | `FR-INGEST-002`, `BR-02`, raw layer, `UI-02` |
| 4 | Mọi chỉnh sửa có audit tối thiểu | PASS | `FR-AUDIT-001`, audit schema, `TC-AUD-*` |
| 5 | Agent không tự sửa dữ liệu nguồn | PASS | Permission matrix, `FR-PERMISSION-001` |
| 6 | Thiếu dữ liệu chuyển `CHỜ XÁC MINH` | PASS | Thiếu raw/pre-draft/unknown source → CHỜ; known incomplete evidence → IN_PROGRESS theo OD-02; `BR-01`, Flow 7/9 |
| 7 | Ảnh không là bằng chứng bắt buộc chung | PASS | OD-02 xác nhận ảnh không bắt buộc trong cả ba playbook; `TC-EVD-002` |
| 8 | CSKH có vật tư `N/A` | PASS | UC-CS, `BR-06`, `UI-05`, `TC-MAT-005` |
| 9 | `norm_qty` ghi mô phỏng hoặc `N/A` | PASS | Material schema/UI/FR |
| 10 | Chỉ ba phép đối soát vật tư | PASS | `BR-06`, `FR-MATERIAL-001`, `UI-05` |
| 11 | READY có playbook và work order | PASS | Seven gates, `UI-06`, `TC-STATE-001` |
| 12 | Checklist không còn `PENDING` | PASS | `BR-05`, state gate, `TC-CHK-001` |
| 13 | Evidence tối thiểu theo playbook đã đủ | PASS | Checklist/evidence tách gate; `BR-05/07`, `TC-EVD-001/004/005` |
| 14 | Material đã đối soát hoặc `N/A` | PASS | `BR-06/08`, READY package |
| 15 | Không còn blocking exception | PASS | `BR-08/09`, state machine |
| 16 | Non-blocking warning vẫn hiển thị | PASS | P0 scope, Flow 10, `UI-06`, `TC-STATE-002` |
| 17 | Agent không nghiệm thu hoặc đóng ticket | PASS | Permission matrix, absent CTA, `TC-PERM-002` |
| 18 | Agent không xác nhận chất lượng kỹ thuật | PASS | UC-TEC, UI copy/disabled action |
| 19 | Agent không phê duyệt/điều chỉnh vật tư | PASS | `FR-MATERIAL-001`, permission tests |
| 20 | Case rủi ro cao chuyển BQL | PASS | Three exception specs/flows/tests |
| 21 | Không có nội dung tài chính trong active flow | PASS | Chỉ xuất hiện trong Out of scope; không có field/CTA/AC/demo |
| 22 | Sáu demo path nằm trong scope | PASS | Brief §10/11; UI Flow 1–6; `FR-DEMO-001` |
| 23 | Use case còn lại nằm trong backlog | PASS | Brief §19; classifier không invent playbook |
| 24 | Synthetic acceptance criteria không gọi là KPI thật | PASS | Brief §17; PRD §9.3 có disclaimer bắt buộc |
| 25 | Không claim hiệu quả vận hành thật của Vinhomes | PASS | Boundary/disclaimer xuyên suốt; pain points là hypothesis |

**Kết quả:** 25/25 PASS, 0 FAIL sau corrective source-alignment review. Không cần câu sửa bổ sung ở vòng này.

## 4.3 Cross-document consistency

- **Problem → Brief:** cùng one-sentence problem, value unit, actor, scope và synthetic boundary.
- **Brief → PRD:** P0/P1, six paths, states, permissions và AC được cụ thể hóa nhưng không mở rộng feature.
- **PRD → UI:** mọi screen/action map tới actor/FR; forbidden action không có enabled CTA.
- **PRD → QA:** mọi P0 FR có actor, output/UI, Given/When/Then và test.
- **UI → Safety:** exception, missing evidence/material, non-blocking warning và audit đều nhìn thấy được.

---

# 5. Remaining assumptions

- `A-01` Fixture cục bộ, ID `SIM-`, không integration thật.
- `A-02` ISO 8601/timezone display cho audit.
- `A-03` Một BQL role tổng quát trong prototype.
- `A-06` Không threshold tự động chuyển exception.
- `A-08` Agent gắn READY bằng deterministic gate, không phải human approval.
- `A-09` Evidence là metadata/placeholder/nội dung mô phỏng, không vision.
- `A-10` Execution edits cũng có audit.

# 6. Decision register

| ID | Quyết định | Build impact | Status |
|---|---|---|---|
| `OD-01` | Required fields/confirmation gates | Không còn block test oracle | `CLOSED · APPLIED v0.2` |
| `OD-02` | Minimum evidence/checklist/image | Không còn block evidence oracle | `CLOSED · APPLIED v0.2` |
| `OD-03` | Blocking/non-blocking/action-out-of-authority | Không còn block state oracle | `CLOSED · APPLIED v0.2` |
| `OD-04` | Material variance threshold nếu có | Không block MVP; v0.2 không dùng threshold | `OPEN · DEFERRED` |
| `OD-05` | BQL sub-role authority | Không block demo role chung; block pilot permission | `OPEN · PILOT` |
| `OD-06` | Priority/SLA | Không block MVP; priority optional | `OPEN · PILOT` |
| `OD-07` | Administrative edit reason taxonomy | Không block build; block UAT copy | `OPEN · UAT` |
| `OD-08` | CSKH conflict fields/taxonomy/state | Không còn block CSKH oracle | `CLOSED · APPLIED v0.2` |
| `OD-09` | Owner, approvers, deadline, sign-off | Chỉ còn thiếu tên Product approver/proxy và sign-off evidence | `PARTIALLY CLOSED · BLOCKER` |

Governance đã ghi nhận: Document Owner TV1; Technical reviewer TV2; QA approver TV4; Product approver và proxy BQL cùng là `[Tên nhóm trưởng / Product Owner]`; deadline cuối Ngày 1, 27/09/2026. Proxy approval chỉ áp dụng policy mô phỏng, không phải phê duyệt quy trình thật.

## 6.1 Approval record

- **Document Owner:** TV1 — Product / BA / Process.
- **Product approver:** `[TBD tên nhóm trưởng / Product Owner]`.
- **BQL business approver:** không có BQL thực tế trong prototype; Product approver ở trên làm proxy cho policy mô phỏng.
- **Technical reviewer:** TV2 — AI Agent / Data.
- **QA approver:** TV4 — Integration / QA / Demo.
- **Sign-off deadline:** cuối Ngày 1 — 27/09/2026.
- **Approval scope:** chỉ xác nhận policy/test oracle mô phỏng của prototype; không xác nhận quy trình vận hành thật.
- **Change control sau deadline:** chỉ nhận thay đổi P0 liên quan safety, blocker hoặc sáu demo paths; thay đổi khác chuyển backlog và không sửa baseline hiện tại.
- **Approval evidence:** `PENDING` — cần điền tên người phê duyệt, thời điểm và xác nhận version 0.2.

---

# 7. Build readiness assessment

| Điều kiện kết luận `READY FOR BUILD` | Kết quả | Ghi chú |
|---|---|---|
| Không còn mâu thuẫn P0 | PASS | 25/25 consistency checks PASS |
| Role và permission rõ | PASS cho prototype | BQL sub-role pilot còn `OD-05` |
| State transition rõ | PASS | Four-state machine + invalid transitions |
| Data model đủ dùng | PASS | Required/pre-draft/comparison fields đã chốt ở v0.2 |
| Acceptance criteria kiểm thử được | PASS | Oracle OD-01/02/03/08 đã cập nhật test catalog |
| UI Flow bao phủ sáu demo paths | PASS | Flows 1–6 + four edge flows |
| Mọi safety rule quan trọng có test | PASS | Safety coverage matrix |
| Core playbook decisions đã được ghi nhận | PASS | `OD-01/02/03/08` closed/applied |
| Product approver/proxy có tên và sign-off evidence | **FAIL / NOT MET** | Placeholder `[Tên nhóm trưởng / Product Owner]` chưa được thay; chưa có approval record |

**Kết luận readiness:** Policy, state oracle, data model, UI flow và tests đã đủ để freeze nội dung kỹ thuật v0.2. Chưa được đổi nhãn sang approved build baseline vì OD-09 chưa có tên người phê duyệt và sign-off evidence.

---

# 8. Executive Summary

## 8.1 Problem Statement một câu

BQL cần một prototype có thể tạo và kiểm tra hồ sơ bảo trì mô phỏng một cách nhất quán, truy vết được và không vượt quyền, để mỗi case đủ điều kiện được chuyển sang BQL xem xét hoặc dừng đúng tại bước xác minh/ngoại lệ.

## 8.2 MVP objective một câu

Trong một tuần, chứng minh Agent xử lý đúng sáu kịch bản mô phỏng, tạo/kiểm tra work order draft và chuyển đúng state/BQL mà không vượt quyền.

## 8.3 Ba use case chính

1. Vệ sinh khu vực chung cần vệ sinh.
2. Đèn chiếu sáng khu vực chung không hoạt động.
3. Cập nhật tiến độ ticket có mã tham chiếu.

## 8.4 Ba exception path

1. Chất lỏng/chất bẩn không rõ nguồn gốc, có dấu hiệu nguy hại.
2. Mùi khét, tia lửa hoặc dây điện hở.
3. Thông tin mâu thuẫn, tranh chấp hoặc khiếu nại nhạy cảm.

## 8.5 P0 scope

Ba playbook + ba exception, four-state workflow, raw immutability, role permissions, audit tối thiểu, structured draft, checklist/material/evidence validation, seven-gate READY, reason/rule/source, 18 synthetic tickets, six resettable demo paths và tám UI areas.

## 8.6 Ba rào chắn quan trọng nhất

1. Deterministic safety/permission rules override model; Agent không có side effect vượt quyền.
2. Raw resident content/evidence bất biến; mọi editable change và transition có audit tối thiểu.
3. `READY_FOR_REVIEW` chỉ khi đủ seven gates; không đồng nghĩa nghiệm thu, hoàn tất, đóng ticket hoặc phê duyệt vật tư.

## 8.7 Decision status

- `CLOSED/APPLIED`: `OD-01`, `OD-02`, `OD-03`, `OD-08`.
- `OPEN nhưng không chặn MVP`: `OD-04`, `OD-05`, `OD-06`, `OD-07`.
- `PARTIALLY CLOSED và đang chặn formal baseline`: `OD-09` — cần tên thật của Product approver/proxy và approval record.

## 8.8 Rủi ro còn lại

- Proxy Product Owner/BQL chưa có tên và chưa ký; policy v0.2 chưa có approval evidence.
- Không có BQL thực tế tham gia, nên toàn bộ policy vẫn chỉ là policy mô phỏng và không được dùng như quy trình thật.
- `OD-04` chưa chốt threshold; v0.2 chỉ coi explained variance là warning, không suy diễn mức độ.
- Role BQL tổng quát đủ cho demo nhưng không đủ cho pilot permission governance.
- Synthetic success có thể bị diễn giải quá mức thành hiệu quả vận hành nếu bỏ disclaimer.
- LLM/injection/schema failure vẫn cần được chứng minh bằng eval runner, không chỉ tài liệu.

## 8.9 Consistency review

**25/25 PASS; 0 P0 contradiction còn lại; mọi P0 requirement có actor, UI/output, acceptance criteria và test case.**

## 8.10 Kết luận

# `NOT READY FOR BUILD`

OD-01/02/03/08 đã được chốt và áp dụng nhất quán. Blocker duy nhất còn lại là OD-09: thay placeholder bằng tên Product approver/proxy và ghi approval record cho version 0.2. Sau bước governance này, bộ tài liệu có thể chuyển sang `READY FOR BUILD` mà không cần mở rộng scope.
