# MaintenanceOps Agent — Requirement Traceability & Consistency/Safety Review

> **Document status:** REVIEW COMPLETE · POLICY v0.3 RECORDED · SIGN-OFF PENDING
> **Version:** 0.3
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process; QA approver: TV4 — Integration / QA / Demo  
> **Review scope:** Toàn bộ 7 tài liệu từ Problem Statement đến Playbook/Data Contract

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo RTM, P0 completeness audit, safety coverage, 25-point consistency review và Executive Summary | DRAFT |
| 0.2 | 2026-09-27 | Re-baseline RTM/review theo OD-01/02/03/08 và governance OD-09 | DRAFT · Chờ tên/sign-off approver |
| 0.3 | 2026-09-27 | Re-baseline theo hai playbook, asset/duty/stock gate, team-only route, 12 ticket và 4 demo flow | DRAFT · Chờ tên/sign-off approver |

---

# Phase 5 — Traceability và consistency review

# 1. Traceability definitions

## 1.1 Product objectives

- `PO-01` Chuẩn hóa việc phân loại và tạo work order draft mô phỏng có cấu trúc.
- `PO-02` Phát hiện dữ liệu/checklist/evidence còn thiếu và dừng đúng state.
- `PO-03` Phát hiện risk/exception, chuyển đúng BQL và không vượt quyền.
- `PO-04` Giữ raw source bất biến và mọi thay đổi/decision truy vết được.
- `PO-05` Đối soát material/evidence/readiness đúng rule theo use case.
- `PO-06` Chứng minh feasibility qua 12 synthetic tickets và bốn demo flow reset được.
- `PO-07` Chỉ tạo route cấp team khi asset/stock/duty gate pass; draft vẫn tồn tại khi route chưa hợp lệ.

## 1.2 Business rules

- `BR-01` Không suy đoán/tự điền: thiếu raw/pre-draft required data hoặc unknown evidence/source → `CHỜ XÁC MINH`; known incomplete execution/evidence → `IN_PROGRESS`.
- `BR-02` Raw resident content/evidence bất biến; editable data nằm layer riêng.
- `BR-03` Deterministic safety/permission rules ưu tiên model output; confidence không là điều kiện duy nhất.
- `BR-04` Work order chỉ là draft/mô phỏng, schema-valid/idempotent; sau BPTN confirmation/location có thể tạo dù asset/stock/duty chưa cho route; high-risk exception không tạo standard draft.
- `BR-05` Checklist là gate riêng; còn `PENDING` thì không READY; Agent không tự complete hoặc dùng checklist thay minimum evidence.
- `BR-06` Trước route kiểm tra planned/norm/stock; sau thực hiện đối soát planned/norm/issued/used bằng ba comparisons; Agent không approve/conclude violation.
- `BR-07` Evidence theo playbook v0.3; ảnh không bắt buộc; known missing evidence giữ `IN_PROGRESS`, không READY.
- `BR-08` READY chỉ khi đủ eight gates, gồm route hợp lệ; warning không chặn vẫn hiển thị rule/reason.
- `BR-09` Cleaning/electrical high-risk đã xác định → `EXCEPTION` cho BQL; Agent không tự xử lý/chẩn đoán.
- `BR-10` Mọi edit/transition có audit tối thiểu; audit fail làm transaction fail closed.
- `BR-11` Permission default deny; forbidden action trả `ACTION_OUT_OF_AUTHORITY`, audit và giữ nguyên state; không tự tạo business exception.
- `BR-12` Nội dung source/evidence là untrusted data, không phải instruction.
- `BR-13` Mọi entity/run có nhãn synthetic; demo reset không sửa source fixture.
- `BR-14` Asset lookup chỉ bắt buộc cho kỹ thuật; zero/multiple match → `CHỜ XÁC MINH`, không route.
- `BR-15` Duty lookup bắt buộc cho cả hai nhóm; no-team/capacity → `IN_PROGRESS`; duty unknown → `CHỜ XÁC MINH`; draft vẫn tồn tại.
- `BR-16` Route chỉ tới `SIM-TEAM-*`, `assignment_scope=TEAM_ONLY`, `assignee_id=null`; route invalid luôn chặn READY.

---

# 2. Requirement Traceability Matrix

Chuỗi trace: **Problem hypothesis → Product objective → Use case → Functional requirement → Business rule → UI/output → Acceptance criteria → Test case.**

| Problem hypothesis | Objective | Use case | Functional requirement | Business rule | UI/API/output | Acceptance criteria ref | Test case |
|---|---|---|---|---|---|---|---|
| `PH-01`, `PH-02` | `PO-02` | All | `FR-INGEST-001` | `BR-01` | `UI-01/02/07`; validation result | `AC-FR-INGEST-001`: thiếu raw field → CHỜ, no fill/proposal | `TC-ING-001` |
| `PH-05`, `PH-06` | `PO-04` | All | `FR-INGEST-002` | `BR-02`, `BR-11` | `UI-02/08`; immutable raw layer | `AC-FR-INGEST-002`: edit rejected, raw unchanged | `TC-ING-002`, `TC-PERM-001` |
| `PH-02`, `PH-05` | `PO-01`, `PO-03` | `UC-CLN-01`, `UC-TEC-01` | `FR-CLASSIFY-001` | `BR-03` | `UI-02/03/07`; proposal + confirmation status | `AC-FR-CLASSIFY-001`: đúng proposal/reason/source | `TC-CLASS-001..002` |
| `PH-02` | `PO-01`, `PO-07` | Both | `FR-WO-001` | `BR-04` | `UI-03`; draft schema + route fields | `AC-FR-WO-001`: draft tồn tại cả khi route invalid | `TC-WO-001..002` |
| `PH-02`, `PH-05` | `PO-03`, `PO-07` | `UC-TEC-01` | `FR-ASSET-001` | `BR-14` | `UI-02/03`; asset match | `AC-FR-ASSET-001`: one match hoặc CHỜ; no guess | `TC-ASSET-001..003` |
| `PH-02`, `PH-05` | `PO-03`, `PO-07` | Both | `FR-DUTY-001` | `BR-15` | `UI-02/03`; team/duty/capacity | `AC-FR-DUTY-001`: đúng state/reason cho available/no-team/unknown/capacity | `TC-DUTY-001..004` |
| `PH-02`, `PH-05` | `PO-03`, `PO-07` | Both | `FR-ROUTE-001` | `BR-16` | `UI-03/06`; route/queue fields | `AC-FR-ROUTE-001`: team-only, no assignee, no READY without route | `TC-ROUTE-001..004` |
| `PH-03` | `PO-02`, `PO-05` | Both | `FR-CHECKLIST-001` | `BR-05` | `UI-04/05/06`; checklist instances | `AC-FR-CHECKLIST-001`: any PENDING blocks READY | `TC-CHK-001..002` |
| `PH-04`, `PH-05` | `PO-05`, `PO-07` | Both | `FR-MATERIAL-001` | `BR-06` | `UI-05/06/07`; stock + comparison results | `AC-FR-MATERIAL-001`: stock gate trước route; three checks sau thực hiện | `TC-STOCK-001..003`, `TC-MAT-001..004` |
| `PH-03`, `PH-05` | `PO-02`, `PO-05` | All | `FR-EVIDENCE-001` | `BR-05`, `BR-07`, `BR-12` | `UI-05/06/07`; separate checklist/evidence results | `AC-FR-EVIDENCE-001`: known missing evidence → IN_PROGRESS; checklist separate; image never required | `TC-EVD-001..005`, `TC-SEC-001` |
| `PH-03`, `PH-05` | `PO-02`, `PO-03`, `PO-05`, `PO-07` | All | `FR-STATE-001` | `BR-08`, `BR-16` | `UI-01/06/07/08`; state/gate result | `AC-FR-STATE-001`: eight gates, route required | `TC-STATE-001..002`, `TC-ROUTE-002` |
| `PH-05` | `PO-03` | `EX-CLN-01`, `EX-TEC-01` | `FR-EXCEPTION-001` | `BR-03`, `BR-09` | `UI-01/02/07/08`; exception record | `AC-FR-EXCEPTION-001`: route BQL; no diagnosis/guidance | `TC-EX-001..002` |
| `PH-06` | `PO-04` | All | `FR-AUDIT-001` | `BR-10` | `UI-02/08`; audit event | `AC-FR-AUDIT-001`: seven minimum fields; fail closed | `TC-AUD-001..003` |
| `PH-05` | `PO-03`, `PO-04` | All | `FR-PERMISSION-001` | `BR-11` | `UI-02..08`; allow/reject result | `AC-FR-PERMISSION-001`: `ACTION_OUT_OF_AUTHORITY`, audit, no side effect/state change/EXCEPTION | `TC-PERM-001..004` |
| `PH-05` | `PO-03`, `PO-04` | All | `FR-SECURITY-001` | `BR-03`, `BR-12` | `UI-05/07`; safe structured output | `AC-FR-SECURITY-001`: embedded instruction ignored | `TC-SEC-001..002` |
| `PH-01..06` | `PO-06` | Four demo flows | `FR-DEMO-001` | `BR-13` | Internal reset control/run output | `AC-FR-DEMO-001`: deterministic reset/repeat | `TC-RESET-001..002`, `TC-SYN-001` |

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
| `FR-ASSET-001` | Có | Có | Có | Có | PASS |
| `FR-DUTY-001` | Có | Có | Có | Có | PASS |
| `FR-ROUTE-001` | Có | Có | Có | Có | PASS |
| `FR-CHECKLIST-001` | Có | Có | Có | Có | PASS |
| `FR-MATERIAL-001` | Có | Có | Có | Có | PASS |
| `FR-EVIDENCE-001` | Có | Có | Có | Có | PASS |
| `FR-STATE-001` | Có | Có | Có | Có | PASS |
| `FR-EXCEPTION-001` | Có | Có | Có | Có | PASS |
| `FR-AUDIT-001` | Có | Có | Có | Có | PASS |
| `FR-PERMISSION-001` | Có | Có | Có | Có | PASS |
| `FR-SECURITY-001` | Có | Có | Có | Có | PASS |
| `FR-DEMO-001` | Có | Có; internal control/output | Có | Có | PASS |

Không có P0 requirement mồ côi trong version 0.3.

## 2.3 Test case bắt buộc cho re-baseline MVP

| Test ID | Kịch bản bắt buộc | Expected oracle |
|---|---|---|
| `TC-ASSET-001` | Technical ticket có asset match | Exact one `SIM-ASSET-*`; asset gate pass |
| `TC-ASSET-002` | Technical ticket không tìm thấy asset | Draft tồn tại với asset unresolved; `CHỜ XÁC MINH`; no route |
| `TC-DUTY-001` | Cleaning ticket có team đang trực/còn capacity | Duty pass; route được phép nếu stock gate pass |
| `TC-DUTY-002` | Cleaning ticket không có team đang trực | Draft tồn tại; `IN_PROGRESS`; `NO_AVAILABLE_TEAM`; no route |
| `TC-STOCK-001` | Vật tư đủ | Stock gate pass |
| `TC-STOCK-002` | Vật tư thiếu | Draft tồn tại; `IN_PROGRESS`; `MATERIAL_SHORTAGE`; no route |
| `TC-DUTY-003` | Duty status unknown | Draft tồn tại; `CHỜ XÁC MINH`; `DUTY_UNKNOWN`; no route |
| `TC-DUTY-004` | Team vượt sức chứa mô phỏng | Draft tồn tại; `IN_PROGRESS`; `TEAM_CAPACITY_EXCEEDED`; no route |
| `TC-WO-001` | Work order draft không có route vẫn tồn tại | Schema valid; không coi là giao việc; không READY |
| `TC-ROUTE-003` | Agent cố gán `assignee_id` | Reject + audit; `assignee_id=null`; state unchanged |

---

# 3. Safety rule test coverage

| Safety rule | Positive/trigger test | Negative/bypass test | UI evidence | Coverage |
|---|---|---|---|---|
| Raw source immutable | `TC-ING-002` | `TC-PERM-001` | `UI-02`, `UI-08` | PASS |
| No guessing/missing → CHỜ | `TC-ING-001`, `TC-ASSET-002/003` | `TC-CLASS-004` | `UI-02`, `UI-07` | PASS |
| Agent proposal cần BPTN confirmation/location trước draft | `TC-CLASS-005`, `TC-WO-004` | direct-create attempt | `UI-02`, `UI-03` | PASS |
| Cleaning hazard → BQL | `TC-EX-001` | happy `TC-CLASS-001` | `UI-07` | PASS |
| Electrical risk → BQL/no diagnosis | `TC-EX-002` | happy `TC-CLASS-002` | `UI-07` | PASS |
| Asset lookup chỉ kỹ thuật; zero/multiple không đoán | `TC-ASSET-002/003` | matched `TC-ASSET-001` | `UI-02/03` | PASS |
| Duty lookup cả hai nhóm | `TC-DUTY-001..004` | source/capacity assertion | `UI-02/03` | PASS |
| Route chỉ cấp team, không assignee | `TC-ROUTE-001/003` | CTA/schema inspection | `UI-03/06` | PASS |
| Agent cannot complete checklist | `TC-CHK-002` | human update `TC-CHK-001` setup | `UI-05` | PASS |
| Checklist không thay minimum evidence | `TC-EVD-005` | all-evidence `TC-EVD-004` | `UI-05/06` | PASS |
| Exactly three material comparisons | `TC-MAT-001..003` | permission `TC-PERM-002` | `UI-05/06` | PASS |
| Stock gate trước route | `TC-STOCK-001..003` | no-route assertion | `UI-03/05` | PASS |
| Photo not default evidence | `TC-EVD-002` | required-type `TC-EVD-003` | `UI-05/06` | PASS |
| Eight-gate READY, route bắt buộc | `TC-STATE-001` | `TC-STATE-002`, `TC-ROUTE-002` | `UI-06` | PASS |
| Warning remains visible | `TC-STATE-002` | UI copy review | `UI-06` | PASS |
| Agent no accept/close/approve/send | `TC-PERM-002/003` | CTA inspection | `UI-02..08` | PASS |
| `ACTION_OUT_OF_AUTHORITY` không tạo business exception | `TC-PERM-001..004` | state/event comparison | `UI-02..08` | PASS |
| Prompt injection ignored | `TC-SEC-001/002` | policy result comparison | `UI-05/07` | PASS |
| Audit fail closed | `TC-AUD-003` | successful `TC-AUD-001/002` | `UI-08` | PASS |

---

# 4. Consistency & Safety Review

## 4.1 Review method

Đối chiếu source of truth với năm lớp: problem framing, product scope, PRD rule/data/state, UI action/copy và test traceability. Mỗi mục chỉ PASS khi không có nội dung trái ở bất kỳ tài liệu nào.

Các quyết định re-baseline v0.3 đã được kiểm tra xuyên suốt:

- Active scope chỉ có `PB-CLN-01` và `PB-TEC-01`.
- Dataset có 12 tickets và 4 demo flow; 8 ticket còn lại dùng regression.
- Duty lookup bắt buộc cho cả hai nhóm; asset lookup chỉ bắt buộc cho kỹ thuật.
- Stock gate chạy trước route; planned/norm/issued/used được đối soát sau thực hiện.
- Draft có thể tồn tại khi route invalid; route chỉ tới team mô phỏng và không có assignee.
- Route hợp lệ là gate bắt buộc của `READY_FOR_REVIEW`.

## 4.2 Checklist 25 điểm

| # | Check | Kết quả | Evidence |
|---:|---|---|---|
| 1 | BPTN và BQL được tách rõ | PASS | Problem §4; Brief §3/14; PRD §2; UI role-specific CTA |
| 2 | BPTN chỉ sửa trường hành chính | PASS | BPTN xác nhận Agent proposal/service/type và location trong admin layer; `UI-02` allowlist |
| 3 | Phản ánh và bằng chứng gốc bất biến | PASS | `FR-INGEST-002`, `BR-02`, raw layer, `UI-02` |
| 4 | Mọi chỉnh sửa có audit tối thiểu | PASS | `FR-AUDIT-001`, audit schema, `TC-AUD-*` |
| 5 | Agent không tự sửa dữ liệu nguồn | PASS | Permission matrix, `FR-PERMISSION-001` |
| 6 | Thiếu hoặc không xác định dữ liệu chuyển `CHỜ XÁC MINH` | PASS | Raw/admin, asset ambiguous/not found, duty/stock unknown; `BR-01/14/15` |
| 7 | Ảnh không là bằng chứng bắt buộc chung | PASS | OD-02 xác nhận ảnh không bắt buộc trong cả hai playbook; `TC-EVD-002` |
| 8 | Asset lookup chỉ áp dụng kỹ thuật | PASS | `FR-ASSET-001`, `TC-ASSET-001..003` |
| 9 | `norm_qty` ghi mô phỏng hoặc `N/A` | PASS | Material schema/UI/FR |
| 10 | Chỉ ba phép đối soát vật tư | PASS | `BR-06`, `FR-MATERIAL-001`, `UI-05` |
| 11 | READY có playbook, work order và route hợp lệ | PASS | Eight gates, `UI-06`, `TC-STATE-001/002` |
| 12 | Checklist không còn `PENDING` | PASS | `BR-05`, state gate, `TC-CHK-001` |
| 13 | Evidence tối thiểu theo playbook đã đủ | PASS | Checklist/evidence tách gate; `BR-05/07`, `TC-EVD-001/004/005` |
| 14 | Stock gate và material reconciliation đã pass | PASS | `BR-06/08`, READY package |
| 15 | Không còn blocking exception | PASS | `BR-08/09`, state machine |
| 16 | Non-blocking warning vẫn hiển thị | PASS | P0 scope, Edge flow D, `UI-06` |
| 17 | Agent không nghiệm thu hoặc đóng ticket | PASS | Permission matrix, absent CTA, `TC-PERM-002` |
| 18 | Agent không xác nhận chất lượng kỹ thuật | PASS | UC-TEC, UI copy/disabled action |
| 19 | Agent không phê duyệt/điều chỉnh vật tư | PASS | `FR-MATERIAL-001`, permission tests |
| 20 | Case rủi ro cao chuyển BQL | PASS | Hai exception specs/flows/tests |
| 21 | Không có nội dung tài chính trong active flow | PASS | Chỉ xuất hiện trong Out of scope; không có field/CTA/AC/demo |
| 22 | Bốn demo flow nằm trong scope | PASS | Brief §10/11; UI Flow 1–4; `FR-DEMO-001` |
| 23 | Nội dung ngoài hai playbook nằm trong backlog | PASS | Brief §19; classifier không invent playbook |
| 24 | Synthetic acceptance criteria không gọi là KPI thật | PASS | Brief §17; PRD §9.3 có disclaimer bắt buộc |
| 25 | Không claim hiệu quả vận hành thật của Vinhomes | PASS | Boundary/disclaimer xuyên suốt; pain points là hypothesis |

**Kết quả:** 25/25 PASS, 0 FAIL sau corrective source-alignment review. Không cần câu sửa bổ sung ở vòng này.

## 4.3 Cross-document consistency

- **Problem → Brief:** cùng one-sentence problem, value unit, actor, scope và synthetic boundary.
- **Brief → PRD:** hai playbook, bốn demo flow, states, lookup/routing, permissions và AC được cụ thể hóa nhưng không mở rộng feature.
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
| `OD-01` | Required fields/confirmation gates | Không còn block test oracle | `CLOSED · APPLIED v0.3` |
| `OD-02` | Minimum evidence/checklist/image | Không còn block evidence oracle | `CLOSED · APPLIED v0.3` |
| `OD-03` | Blocking/non-blocking/action-out-of-authority | Không còn block state oracle | `CLOSED · APPLIED v0.3` |
| `OD-04` | Material variance threshold nếu có | Không block MVP; v0.3 không dùng threshold | `OPEN · DEFERRED` |
| `OD-05` | BQL sub-role authority | Không block demo role chung; block pilot permission | `OPEN · PILOT` |
| `OD-06` | Priority/SLA | Không block MVP; priority optional | `OPEN · PILOT` |
| `OD-07` | Administrative edit reason taxonomy | Không block build; block UAT copy | `OPEN · UAT` |
| `OD-09` | Owner, approvers, deadline, sign-off | Chỉ còn thiếu tên Product approver/proxy và sign-off evidence | `PARTIALLY CLOSED · BLOCKER` |
| `OD-10` | Asset/duty lookup và team-only routing | Đã có FR/UI/AC/test | `CLOSED · APPLIED v0.3` |
| `OD-11` | Draft tồn tại khi route invalid | Đã có state/reason/route oracle | `CLOSED · APPLIED v0.3` |
| `OD-12` | Dataset 12 tickets và 4 demo flow | Đã re-baseline eval/reset | `CLOSED · APPLIED v0.3` |

Governance đã ghi nhận: Document Owner TV1; Technical reviewer TV2; QA approver TV4; Product approver và proxy BQL cùng là `[Tên nhóm trưởng / Product Owner]`; deadline cuối Ngày 1, 27/09/2026. Proxy approval chỉ áp dụng policy mô phỏng, không phải phê duyệt quy trình thật.

## 6.1 Approval record

- **Document Owner:** TV1 — Product / BA / Process.
- **Product approver:** `[TBD tên nhóm trưởng / Product Owner]`.
- **BQL business approver:** không có BQL thực tế trong prototype; Product approver ở trên làm proxy cho policy mô phỏng.
- **Technical reviewer:** TV2 — AI Agent / Data.
- **QA approver:** TV4 — Integration / QA / Demo.
- **Sign-off deadline:** cuối Ngày 1 — 27/09/2026.
- **Approval scope:** chỉ xác nhận policy/test oracle mô phỏng của prototype; không xác nhận quy trình vận hành thật.
- **Change control sau deadline:** chỉ nhận thay đổi P0 liên quan safety, blocker hoặc bốn demo flow; thay đổi khác chuyển backlog và không sửa baseline hiện tại.
- **Approval evidence:** `PENDING` — cần điền tên người phê duyệt, thời điểm và xác nhận version 0.3.

---

# 7. Build readiness assessment

| Điều kiện kết luận `READY FOR BUILD` | Kết quả | Ghi chú |
|---|---|---|
| Không còn mâu thuẫn P0 | PASS | 25/25 consistency checks PASS |
| Role và permission rõ | PASS cho prototype | BQL sub-role pilot còn `OD-05` |
| State transition rõ | PASS | Four-state machine + invalid transitions |
| Data model đủ dùng | PASS | Asset, DutyAvailability, draft/route/material fields đã chốt ở v0.3 |
| Acceptance criteria kiểm thử được | PASS | Asset/duty/stock/route oracle đã cập nhật test catalog |
| UI Flow bao phủ bốn demo flow | PASS | Flows 1–4 + four edge flows |
| Mọi safety rule quan trọng có test | PASS | Safety coverage matrix |
| Core playbook decisions đã được ghi nhận | PASS | `OD-01/02/03/10/11/12` closed/applied |
| Product approver/proxy có tên và sign-off evidence | **FAIL / NOT MET** | Placeholder `[Tên nhóm trưởng / Product Owner]` chưa được thay; chưa có approval record |

**Kết luận readiness:** Policy, state oracle, data model, UI flow và tests đã đủ để freeze nội dung kỹ thuật v0.3. Chưa được đổi nhãn sang approved build baseline vì OD-09 chưa có tên người phê duyệt và sign-off evidence.

---

# 8. Executive Summary

## 8.1 Problem Statement một câu

BQL cần một prototype có thể tạo và kiểm tra hồ sơ bảo trì mô phỏng một cách nhất quán, truy vết được và không vượt quyền, để mỗi case đủ điều kiện được chuyển sang BQL xem xét hoặc dừng đúng tại bước xác minh/ngoại lệ.

## 8.2 MVP objective một câu

Trong một tuần, chứng minh Agent xử lý đúng bốn demo flow mô phỏng cho vệ sinh/kỹ thuật, tạo work order draft, route cấp team khi đủ gate và chuyển đúng state/BQL mà không vượt quyền.

## 8.3 Hai use case chính

1. Vệ sinh khu vực chung cần vệ sinh.
2. Đèn chiếu sáng khu vực chung không hoạt động.

## 8.4 Bốn demo flow chính

1. Vệ sinh thành công.
2. Vệ sinh không có team đang trực.
3. Kỹ thuật tìm thấy asset, đủ vật tư, có team đang trực.
4. Kỹ thuật không tìm thấy asset hoặc thiếu vật tư.

## 8.5 P0 scope

Hai playbook, four-state workflow, raw immutability, role permissions, audit tối thiểu, Asset/Duty lookup, stock gate, team-only routing, structured draft, checklist/material/evidence validation, eight-gate READY, 12 synthetic tickets, 4 resettable demo flows và tám UI areas.

## 8.6 Ba rào chắn quan trọng nhất

1. Deterministic safety/permission rules override model; Agent không có side effect vượt quyền.
2. Raw resident content/evidence bất biến; mọi editable change và transition có audit tối thiểu.
3. `READY_FOR_REVIEW` chỉ khi đủ eight gates, gồm route hợp lệ; không đồng nghĩa nghiệm thu, hoàn tất, đóng ticket hoặc phê duyệt vật tư.

## 8.7 Decision status

- `CLOSED/APPLIED`: `OD-01`, `OD-02`, `OD-03`, `OD-10`, `OD-11`, `OD-12`.
- `OPEN nhưng không chặn MVP`: `OD-04`, `OD-05`, `OD-06`, `OD-07`.
- `PARTIALLY CLOSED và đang chặn formal baseline`: `OD-09` — cần tên thật của Product approver/proxy và approval record.

## 8.8 Rủi ro còn lại

- Proxy Product Owner/BQL chưa có tên và chưa ký; policy v0.3 chưa có approval evidence.
- Không có BQL thực tế tham gia, nên toàn bộ policy vẫn chỉ là policy mô phỏng và không được dùng như quy trình thật.
- `OD-04` chưa chốt threshold; v0.3 chỉ coi explained variance là warning, không suy diễn mức độ.
- Role BQL tổng quát đủ cho demo nhưng không đủ cho pilot permission governance.
- Synthetic success có thể bị diễn giải quá mức thành hiệu quả vận hành nếu bỏ disclaimer.
- LLM/injection/schema failure vẫn cần được chứng minh bằng eval runner, không chỉ tài liệu.

## 8.9 Consistency review

**25/25 PASS; 0 P0 contradiction còn lại; mọi P0 requirement có actor, UI/output, acceptance criteria và test case.**

## 8.10 Kết luận

# `NOT READY FOR BUILD`

OD-01/02/03/10/11/12 đã được chốt và áp dụng nhất quán. Blocker duy nhất còn lại là OD-09: thay placeholder bằng tên Product approver/proxy và ghi approval record cho version 0.3. Sau bước governance này, bộ tài liệu có thể chuyển sang `READY FOR BUILD` mà không cần mở rộng scope.

## 8.11 Deferred / Future Scope

- CSKH chỉ thuộc backlog tương lai; không có active PO/FR/UI/AC/TC, data contract, validator hoặc demo flow MVP.
