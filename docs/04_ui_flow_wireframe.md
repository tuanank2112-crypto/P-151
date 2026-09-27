# MaintenanceOps Agent — UI Flow & Low-fidelity Wireframe

> **Document status:** DRAFT · Policy v0.2 recorded, awaiting approver identity/sign-off  
> **Version:** 0.2  
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process; UX reviewer: TV3 — UX / UI / Prototype  
> **Boundary:** Prototype với dữ liệu mô phỏng; không có CTA tạo work order thật, gửi cư dân, nghiệm thu, đóng ticket hoặc phê duyệt vật tư

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo IA, 10 UI flows và wireframe cho `UI-01`–`UI-08` | DRAFT |
| 0.2 | 2026-09-27 | Áp dụng Agent proposal → BPTN confirmation, evidence/state oracle, CSKH conflict và permission rejection | DRAFT · Chờ sign-off |

---

# Phase 4 — UI Flow và Wireframe

# 1. Information architecture

| UI ID | Screen | Mục tiêu chính | Primary actor |
|---|---|---|---|
| `UI-01` | Work Queue | Chọn case theo state/service và thấy blocker/warning | BPTN, nhân sự thực hiện, BQL |
| `UI-02` | Ticket Detail | Tách raw source, administrative normalization và Agent proposal | BPTN, BQL |
| `UI-03` | Work Order Draft | Xem draft/playbook/requirements/reason | Nhân sự thực hiện, BQL |
| `UI-04` | Execution Update | Cập nhật progress/result note trong execution layer | Nhân sự thực hiện |
| `UI-05` | Checklist, Material & Evidence | Cập nhật/kiểm tra checklist, material, evidence | Nhân sự thực hiện, BQL |
| `UI-06` | `READY_FOR_REVIEW` Package | Xem seven-gate package và chuyển BQL xem xét | BQL; action handoff từ system/authorized user |
| `UI-07` | Exception Review | Xem reason/rule/source/risk và BQL action | BQL |
| `UI-08` | Audit History | Truy vết edit/decision/transition | BPTN, BQL, QA nội bộ |

`UI-04` và `UI-05` có thể là hai tab trong một Work Order Detail để giảm scope, nhưng ID, permission và acceptance criteria vẫn tách riêng.

## 1.1 Global UI rules

- Mọi screen có banner cố định: **“DỮ LIỆU MÔ PHỎNG — Không phải hồ sơ/quy trình vận hành thật.”**
- State hiển thị bằng text + icon/pattern, không chỉ bằng màu.
- Raw resident content/evidence luôn trong vùng read-only có nhãn **“Nguồn gốc — bất biến”**.
- CTA theo role; forbidden action không render hoặc disabled kèm lý do.
- Nếu vẫn gọi forbidden action, UI hiển thị `ACTION_OUT_OF_AUTHORITY`; hệ thống reject, audit và giữ nguyên business state.
- Mọi Agent result có playbook/rule/reason/source/version.
- Service/type/playbook của Agent hiển thị là **proposal** cho tới khi BPTN xác nhận; không tạo draft nếu service/type chưa confirmed hoặc thiếu location.
- Không dùng các CTA “Nghiệm thu”, “Hoàn tất công việc”, “Đóng ticket”, “Phê duyệt vật tư”.
- Không có CTA gửi thông báo, yêu cầu ảnh cư dân hoặc tạo work order thật.

---

# 2. UI flows

## 2.1 Flow 1 — Happy path vệ sinh

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | BPTN | Tiếp nhận, mở raw ticket read-only | Có ingest event | ingest → `IN_PROGRESS` | Không | Access/ingest event |
| 2 | Agent | Validate ba raw fields, match `PB-CLN-01`, chạy risk rule và đề xuất service/type | Đủ raw field; không hazard signal | `IN_PROGRESS` → `IN_PROGRESS` | Không | Proposal + reason/rule/source |
| 3 | BPTN | Xác nhận service/type và location | Dựa trên source; reason/audit bắt buộc | `IN_PROGRESS` → `IN_PROGRESS` | Thiếu confirmation/location → `CHỜ XÁC MINH` | Admin confirmation revision + audit |
| 4 | Agent | Tạo work order draft | Confirmation/location gate pass; không blocker | `IN_PROGRESS` → `IN_PROGRESS` | Không | Draft/checklist/material/evidence requirement + audit |
| 5 | Nhân sự thực hiện | Cập nhật progress, checklist, material, ghi chú | Chỉ execution layer | `IN_PROGRESS` → `IN_PROGRESS` | Chưa đủ thì giữ state | Execution revisions + audit |
| 6 | Agent | Reconcile/validate seven gates | Tất cả pass | `IN_PROGRESS` → `READY_FOR_REVIEW` | Không | Gate result + transition audit |
| 7 | Authorized UI user/System | Chọn “Chuyển BQL xem xét” | State READY | `READY_FOR_REVIEW` → `READY_FOR_REVIEW` | Không | Handoff event; không phải acceptance |

## 2.2 Flow 2 — Exception vệ sinh

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate raw fields và chạy high-risk rule trước confirmation/draft | Rule `EX-CLN-01` match raw source | `IN_PROGRESS` → `EXCEPTION` | **Blocking** | Exception record: rule, reason, source, risk, BQL; transition audit |
| 3 | BQL | Review exception | Agent không đưa hướng dẫn xử lý | `EXCEPTION` → giữ/`CHỜ XÁC MINH`/`IN_PROGRESS` theo resolution | BQL quyết định | BQL resolution/request audit; không có close/accept action |

## 2.3 Flow 3 — Happy path kỹ thuật

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate raw fields, match `PB-TEC-01`, risk scan và đề xuất service/type | Không mùi khét/tia lửa/dây hở | `IN_PROGRESS` → `IN_PROGRESS` | Không | Proposal/rule/source reason |
| 2 | BPTN | Xác nhận service/type và location | Source đủ để xác nhận | giữ `IN_PROGRESS` | Thiếu gate → `CHỜ XÁC MINH` | Confirmation audit |
| 3 | Agent | Tạo draft và requirements | Confirmation/location gate pass | giữ `IN_PROGRESS` | Không | Draft + checklist an toàn/result/material/evidence |
| 4 | Nhân sự thực hiện | Cập nhật execution data | Không sửa raw | giữ `IN_PROGRESS` | Pending/missing evidence giữ IN_PROGRESS | Execution audit |
| 5 | Agent | Validate | Safety checklist gate, result evidence và material gate đủ | `IN_PROGRESS` → `READY_FOR_REVIEW` | Không | Gate summary + transition |
| 6 | System/user | Handoff BQL | READY | giữ READY | Không | Handoff audit |

## 2.4 Flow 4 — Exception kỹ thuật

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Detect mùi khét/tia lửa/dây hở | Bất kỳ signal match source | `IN_PROGRESS` → `EXCEPTION` | **Blocking** | `EX-TEC-01`, source reference, risk; audit |
| 2 | UI | Dừng standard path; ẩn/disable draft continuation | State EXCEPTION | giữ `EXCEPTION` | **Blocking** | UI event optional; no operational guidance |
| 3 | BQL | Review/request verification/record resolution | Theo quyền BQL | `EXCEPTION` → state hợp lệ | BQL quyết định | Resolution audit |

## 2.5 Flow 5 — Happy path CSKH

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate raw fields, đề xuất CSKH/status-update playbook | Đủ ba raw fields | ingest → `IN_PROGRESS` | Không | Proposal + reason/source |
| 2 | BPTN | Xác nhận service/type và location | Có source phù hợp | giữ `IN_PROGRESS` | Thiếu gate → `CHỜ XÁC MINH` | Confirmation audit |
| 3 | Agent | Compare allowlisted fields giữa request và history | Có `reference_ticket_id` + history; không conflict/sensitive | giữ `IN_PROGRESS` | Không | Comparison result |
| 3a | Agent | Dừng comparison và yêu cầu xác minh | Thiếu `reference_ticket_id` hoặc history source | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Blocking** | Missing-source reason + audit |
| 4 | Agent | Tạo CSKH draft | Gate pass; material `N/A` | giữ `IN_PROGRESS` | Không | Draft/checklist/evidence requirement |
| 5 | Nhân sự thực hiện | Ghi nội dung xử lý/bản nháp phản hồi và log liên hệ | Không gửi ra ngoài | giữ `IN_PROGRESS` | Thiếu evidence → giữ IN_PROGRESS | Execution audit |
| 6 | Agent | Validate gates | Material `N/A`, checklist riêng và evidence đủ | `IN_PROGRESS` → `READY_FOR_REVIEW` | Không | Gate/transition audit |

## 2.6 Flow 6 — Exception CSKH

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Compare request/history và run sensitive rules | Hai nguồn cùng nói về một allowlisted field nhưng giá trị không tương thích; hoặc denial/right-wrong/sensitive flag | `IN_PROGRESS` → `EXCEPTION` | **Blocking** | `EX-CS-01`, comparison field, hai source/value, neutral reason; audit |
| 2 | UI | Hiển thị raw/history cạnh nhau, read-only | State EXCEPTION | giữ `EXCEPTION` | **Blocking** | Không kết luận đúng/sai; no message CTA |
| 3 | BQL | Request verification hoặc record resolution | BQL authority | `EXCEPTION` → `CHỜ XÁC MINH`/`IN_PROGRESS`/giữ | Theo BQL | Resolution audit |

Thiếu một trong hai source không đi Flow 6; case đi `CHỜ XÁC MINH` theo Flow 5 bước 3a.

## 2.7 Flow 7 — Thiếu required field → `CHỜ XÁC MINH`

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate ba raw fields | Thiếu `ticket_id`, `created_at` hoặc `original_description` | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Blocking** | Missing-field list, rule/source, transition audit |
| 2 | Agent | Đề xuất service/type/playbook | Đủ raw fields | `IN_PROGRESS` → giữ | Không | Proposal/reason/source |
| 3 | UI/BPTN | Kiểm tra pre-draft gate | Service/type chưa confirmed hoặc thiếu location | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Blocking draft** | Gate list; no draft |
| 4 | BPTN | Xác nhận proposal và location với reason | Dữ liệu đã xác minh; BPTN có quyền | `CHỜ XÁC MINH` → `IN_PROGRESS` qua revalidation | Gỡ block sau validate | Confirmation/edit audit đầy đủ |

## 2.8 Flow 8 — Material variance

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Nhân sự thực hiện | Nhập planned/norm/issued/used/reason | Use case vệ sinh/kỹ thuật | `IN_PROGRESS` → giữ | Tùy kết quả | Material update audit |
| 2 | Agent | Chạy đúng ba comparisons | Có mismatch | giữ `IN_PROGRESS` | Chưa có reason: blocking clarification | Comparison result + neutral explanation |
| 3a | Agent | Yêu cầu xác minh | `variance_reason` thiếu | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Blocking** | Missing reason + transition audit |
| 3b | Agent | Mark reconciled với warning | Có reason; không safety rule khác (`CONFIRMED OD-03`) | `IN_PROGRESS` → có thể READY nếu gate khác pass | **Non-blocking** | Warning rule/reason/comparison + audit |

## 2.9 Flow 9 — Missing minimum evidence

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate evidence requirements, tách khỏi checklist gate | Required evidence `MISSING/INVALID_TYPE` nhưng requirement đã rõ | `IN_PROGRESS` → giữ `IN_PROGRESS` | **Blocking READY** | Evidence gap result + rule/source |
| 2 | UI | Chỉ rõ evidence thiếu/sai loại | Không được mặc định yêu cầu ảnh | giữ | **Blocking READY** | View event optional |
| 3 | Nhân sự thực hiện | Add evidence mô phỏng đúng loại | Execution evidence only | giữ `IN_PROGRESS` | Revalidate | Evidence + audit |
| 4 | Agent | Revalidate | Tất cả gate pass | `IN_PROGRESS` → `READY_FOR_REVIEW` | Không | Gate/transition audit |

Nếu không xác định được evidence nào cần bổ sung hoặc source cần con người xác minh, Agent chuyển `CHỜ XÁC MINH` thay vì giữ `IN_PROGRESS`.

## 2.10 Flow 10 — Non-blocking warning trong `READY_FOR_REVIEW`

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Evaluate seven gates | Tất cả pass; có explained variance warning | `IN_PROGRESS` → `READY_FOR_REVIEW` | **Non-blocking** | Warning + gate/transition audit |
| 2 | UI | Hiển thị banner warning cùng rule/reason/comparison | Không dùng copy “không có vấn đề” | giữ READY | Không | Warning acknowledgment không bắt buộc |
| 3 | BQL | Mở package để xem | Warning còn active/visible | giữ READY | Không | Review access event optional |

---

# 3. Low-fidelity wireframes

## UI-01 — Work Queue

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG                                      [Role: BPTN/BQL/...] |
| Work Queue                                                                 |
| [State filter (P1)] [Service filter (P1)] [Warning filter (P1)]            |
|----------------------------------------------------------------------------|
| SIM-T-001 | Vệ sinh | IN_PROGRESS       | Missing: 0 | Warning: 0          |
| SIM-T-002 | Kỹ thuật| EXCEPTION          | Rule: EX-TEC-01              |
| SIM-T-003 | CSKH    | READY_FOR_REVIEW   | Warning: 1                    |
|----------------------------------------------------------------------------|
| Chọn case → Ticket Detail                                                  |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** ưu tiên case theo state và mở đúng detail/review screen.
- **Actor:** BPTN, nhân sự thực hiện, BQL; row actions theo role.
- **Hiển thị:** SIM ID, service, state text, blocker/warning count, last updated, synthetic label.
- **Được sửa:** không sửa entity trực tiếp trên queue.
- **Bất biến:** raw summary chỉ preview read-only.
- **Primary CTA:** “Mở hồ sơ”.
- **Secondary CTA:** filter P1; reset demo nằm ở internal control, không phải operational CTA.
- **Disabled/absent:** close, accept, approve material, send resident message.
- **Status/warning/error:** state badge text; system error không giả READY.
- **Audit:** last transition/time/actor preview.

## UI-02 — Ticket Detail

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | SIM-T-001 | State: IN_PROGRESS                         |
|----------------------------------------------------------------------------|
| NỘI DUNG PHẢN ÁNH GỐC — READ ONLY / BẤT BIẾN                               |
| original_description ...                           [Copy reference only]    |
| BẰNG CHỨNG GỐC — READ ONLY / BẤT BIẾN                                      |
| evidence metadata ...                                                       |
|----------------------------------------------------------------------------|
| TRƯỜNG HÀNH CHÍNH BPTN            | AGENT PROPOSAL — CHỜ XÁC NHẬN          |
| Department [editable allowlist]    | Service category proposed              |
| Location [required before draft]   | Ticket type proposed                   |
| Priority [optional]                | Playbook + version                     |
| Reason for change [required]       | Matched rules + source + reason        |
| [Xác nhận service/type + location] | confirmation_status                    |
| [Lưu trường hành chính]            | [Xem proposal details]                 |
|----------------------------------------------------------------------------|
| AUDIT PREVIEW: actor | field | old → new | reason | timestamp              |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** tách trực quan raw/admin/proposal và chống sửa nguồn.
- **Actor:** BPTN chỉnh admin; Agent/BQL/nhân sự read theo quyền.
- **Field hiển thị:** toàn bộ raw content/evidence; Agent-proposed service/type/playbook/reason/source; BPTN confirmation status; admin revision.
- **Field sửa/xác nhận:** BPTN xác nhận hoặc chỉnh service/type dựa trên source, bổ sung/xác nhận location, department và optional priority; reason bắt buộc khi chỉnh proposal.
- **Field bất biến:** original content, original evidence, original timestamp/ID.
- **Primary CTA:** BPTN “Xác nhận service/type + location”; chỉ khi pass mới enable đường tới draft.
- **Secondary CTA:** “Xem audit history”.
- **Disabled:** raw editor, overwrite evidence, auto-fill missing data.
- **Banner:** `CHỜ XÁC MINH` liệt kê field; `EXCEPTION` dẫn UI-07.
- **Audit:** preview edit và link UI-08.

## UI-03 — Work Order Draft

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | WORK ORDER DRAFT — KHÔNG PHẢI LỆNH THẬT                 |
| Draft: SIM-WO-001 | Ticket: SIM-T-001 | Playbook PB-CLN-01 v0.x            |
|----------------------------------------------------------------------------|
| Raw required fields: [PASS] | BPTN service/type confirmation: [PASS]       |
| Location before draft: [PASS] | Priority: [OPTIONAL]                       |
| Scope summary (source-grounded)                                             |
| Checklist template                                                         |
| Material requirement: simulated / N/A                                      |
| Evidence requirements: required/optional (Ảnh: optional nếu rule không nêu) |
|----------------------------------------------------------------------------|
| AGENT REASON: matched rule | source reference | generated timestamp        |
| [Đi tới Execution Update] [Xem Ticket Source]                              |
| CTA tạo work order thật: KHÔNG TỒN TẠI                                     |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** cho thấy draft có cấu trúc, nguồn và giới hạn.
- **Actor:** nhân sự thực hiện, BQL; BPTN/Agent read.
- **Được sửa:** không sửa draft trực tiếp; execution ở UI-04/05.
- **Bất biến:** link/raw source; generated draft revision read-only.
- **Primary CTA:** “Đi tới Execution Update”.
- **Secondary:** “Xem Ticket Source”, “Xem reason/rule”.
- **Disabled/absent:** create real work order, assign staff, approve.
- **Warning/error:** schema error giữ IN_PROGRESS; blocker dẫn UI-07.
- **Audit:** created/revised by Agent, versions, idempotency context.

## UI-04 — Execution Update

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Execution Update | SIM-WO-001                           |
| Progress note [editable by Nhân sự thực hiện]                              |
| Result note   [editable by Nhân sự thực hiện]                              |
| Last saved by / at / revision                                               |
| [Lưu cập nhật]  [Sang Checklist, Material & Evidence]                      |
|----------------------------------------------------------------------------|
| Không sửa: resident source, Agent classification, playbook/version          |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** ghi execution updates tách khỏi source/proposal.
- **Actor:** nhân sự thực hiện.
- **Primary CTA:** “Lưu cập nhật”.
- **Secondary:** tới UI-05; xem draft.
- **Disabled:** state override, source edit, send message, mark complete/accept.
- **Status/error:** save validation; audit failure làm save fail closed.
- **Audit:** actor/time/field/old/new/reason hoặc note context.

## UI-05 — Checklist, Material & Evidence

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Checklist, Material & Evidence                          |
| CHECKLIST: [PENDING/COMPLETED] item ...                                     |
|----------------------------------------------------------------------------|
| MATERIAL (VE SINH/KY THUAT)                                                 |
| item | planned_qty | norm_qty [MÔ PHỎNG/N/A] | issued_qty | used_qty       |
| variance | variance_reason                                                  |
| Comparisons: planned↔norm | issued↔planned | used↔issued                   |
| CSKH: MATERIAL GATE = N/A                                                   |
|----------------------------------------------------------------------------|
| EVIDENCE REQUIREMENTS — TÁCH KHỎI CHECKLIST GATE                            |
| requirement | required? | present/missing/invalid | source                  |
| Ảnh không bắt buộc trong MVP                                                |
| [Lưu execution data] [Chạy kiểm tra hồ sơ]                                 |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** cập nhật và nhìn rõ ba nhóm readiness data.
- **Actor:** nhân sự thực hiện edit; Agent validate; BQL read.
- **Field sửa:** checklist status, material fields/reason, execution evidence metadata.
- **Bất biến:** original resident evidence; playbook requirement/version.
- **Primary CTA:** “Lưu execution data”.
- **Secondary:** “Chạy kiểm tra hồ sơ” (Agent validation, không nghiệm thu).
- **Disabled:** Agent auto-complete; approve/adjust inventory; image quality confirmation.
- **Warning/error:** checklist pending hoặc known missing evidence giữ `IN_PROGRESS`; unknown evidence/source cần xác minh → `CHỜ XÁC MINH`; variance label blocking/non-blocking rõ.
- **Audit:** per change + validation run ID.

## UI-06 — `READY_FOR_REVIEW` Package

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | READY_FOR_REVIEW                                        |
| Sẵn sàng để BQL xem xét — KHÔNG phải nghiệm thu/hoàn tất/đóng               |
|----------------------------------------------------------------------------|
| Playbook + version                 [PASS]                                   |
| Work order draft                   [PASS]                                   |
| Required fields                    [PASS]                                   |
| Checklist: no PENDING              [PASS]                                   |
| Material reconciliation / N/A      [PASS]                                   |
| Minimum evidence                   [PASS]                                   |
| Blocking exception                 [NONE]                                   |
|----------------------------------------------------------------------------|
| NON-BLOCKING WARNINGS                                                        |
| rule | reason | comparison/source (không ẩn)                                |
|----------------------------------------------------------------------------|
| [Chuyển BQL xem xét] [Xem audit] [Quay lại detail]                          |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** một review package kiểm chứng đủ seven gates.
- **Actor:** BQL xem; handoff action từ system/authorized internal role.
- **Hiển thị:** playbook, draft, field/checklist/material/evidence/blocker status, warnings.
- **Được sửa:** không edit dữ liệu trong package.
- **Primary CTA:** **“Chuyển BQL xem xét”.**
- **Secondary:** xem detail/audit.
- **Không dùng CTA:** nghiệm thu, hoàn tất công việc, đóng ticket, phê duyệt vật tư.
- **Status:** warning vẫn prominent; không dùng copy “hồ sơ hoàn toàn không có vấn đề”.
- **Audit:** gate evaluation/transition/handoff.

## UI-07 — Exception Review

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | EXCEPTION | SIM-T-002                                  |
|----------------------------------------------------------------------------|
| Lý do chuyển tuyến                                                        |
| Rule đã kích hoạt | Risk level [taxonomy TBD]                              |
| Dữ liệu nguồn liên quan — READ ONLY                                       |
| Thông tin còn thiếu / mâu thuẫn                                            |
| Hành động đề xuất an toàn (không chẩn đoán/hướng dẫn high-risk)            |
| Người có thẩm quyền: BQL                                                   |
|----------------------------------------------------------------------------|
| [Yêu cầu xác minh] [Ghi nhận resolution của BQL] [Xem audit]               |
| Forbidden: Agent resolve | close | accept | approve material | send         |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** giúp BQL hiểu chính xác lý do/rule/source và xử lý trong quyền.
- **Actor:** BQL; các role khác read-only theo permission.
- **Field sửa:** BQL resolution note/request verification; sub-permission `OD-05`.
- **Bất biến:** source, Agent rule record, prior audit.
- **Primary CTA:** “Yêu cầu xác minh” hoặc “Ghi nhận resolution của BQL”.
- **Secondary:** xem raw side-by-side/audit.
- **Disabled:** Agent resolution, technical diagnosis, standard continuation khi blocker active, close/approve/send.
- **Status/error:** rule engine unavailable hiển thị fail-closed system error. `ACTION_OUT_OF_AUTHORITY` là permission error có audit, không tự tạo business exception.
- **Audit:** exception created, viewed, resolution/request.

## UI-08 — Audit History

```text
+----------------------------------------------------------------------------+
| DỮ LIỆU MÔ PHỎNG | Audit History | SIM-T-001                              |
| Filters (P1)                                                                  |
|----------------------------------------------------------------------------|
| time | actor_id/role | entity/field | old_value → new_value | reason        |
| time | SYSTEM/AGENT  | state        | IN_PROGRESS → READY... | rule          |
| time | BQL           | exception    | open → resolved        | note          |
|----------------------------------------------------------------------------|
| [Back to case]   [Export JSON — P1]                                        |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** truy vết đầy đủ edit/decision/transition tối thiểu.
- **Actor:** BPTN/BQL/QA nội bộ; visibility theo role.
- **Hiển thị:** actor ID/role, timestamp, field, old/new, reason, entity, rule/version/run khi có.
- **Được sửa:** không; append-only.
- **Primary CTA:** “Back to case”.
- **Secondary:** export JSON P1.
- **Disabled:** edit/delete audit event; export full trail nếu P1 chưa bật.
- **Status/error:** incomplete event là P0 error; không che field thiếu.
- **Synthetic label:** xuất hiện trên screen/export.

---

# 4. UI acceptance notes

- Six demo paths có thể chạy qua `UI-01 → UI-02 → UI-03 → UI-04/05 → UI-06` hoặc `UI-07`, với `UI-08` làm bằng chứng audit.
- Flow missing required field, material variance, missing evidence và non-blocking warning đều có trạng thái/banner/action rõ.
- Copy `READY_FOR_REVIEW` luôn kèm câu không đồng nghĩa nghiệm thu/hoàn tất/đóng/phê duyệt.
- Component không dựa màu đơn lẻ; trạng thái và severity có text.
- Không có resident-facing surface hoặc outbound message action.
- Không có financial field/action ngoài danh sách out-of-scope của các tài liệu khác.

## Phase 4 consistency gate

**PASS.** IA và flow bao phủ sáu demo paths cùng bốn edge flows, áp dụng nhất quán OD-01/02/03/08 và không tạo state/actor/CTA ngoài PRD. BQL sub-role OD-05 chỉ còn là vấn đề pilot; tên/bằng chứng sign-off OD-09 vẫn `TBD`.
