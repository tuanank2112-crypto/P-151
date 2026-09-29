# MaintenanceOps Agent — UI Flow & Low-fidelity Wireframe

> **Document status:** DRAFT · Policy v0.3 recorded, awaiting approver identity/sign-off
> **Version:** 0.3
> **Ngày:** 2026-09-27  
> **Owner:** TV1 — Product / BA / Process; UX reviewer: TV3 — UX / UI / Prototype  
> **Boundary:** Prototype với dữ liệu mô phỏng; không có CTA tạo work order thật, gửi cư dân, nghiệm thu, đóng ticket hoặc phê duyệt vật tư

## Changelog

| Version | Ngày | Thay đổi | Trạng thái |
|---|---|---|---|
| 0.1 | 2026-09-27 | Tạo IA, 10 UI flows và wireframe cho `UI-01`–`UI-08` | DRAFT |
| 0.2 | 2026-09-27 | Áp dụng Agent proposal → BPTN confirmation, evidence/state oracle và permission rejection | DRAFT · Chờ sign-off |
| 0.3 | 2026-09-27 | Khóa 4 demo flow cho vệ sinh/kỹ thuật; thêm asset/duty/stock/route status và loại bỏ UI ngoài active scope | DRAFT · Chờ sign-off |
| 0.4-candidate | 2026-09-29 | `CR-BPTN-01`: bỏ bước BPTN xác nhận khỏi happy path, thêm review/override có điều kiện; UI copy "Đề xuất team" (§1.2); backlog frontend (§5) | PROPOSED · Chờ duyệt CR |

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
| `UI-06` | `READY_FOR_REVIEW` Package | Xem eight-gate package, gồm route, và chuyển BQL xem xét | BQL; action handoff từ system/authorized user |
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
- Service/type/playbook/location của Agent hiển thị kèm `confirmation_status` (`CR-BPTN-01`): `NOT_REQUIRED` → Agent tiếp tục, BPTN không phải thao tác; `PENDING_REVIEW` → banner `CHỜ XÁC MINH` nêu `review_required_reason` và CTA override cho BPTN; không tạo draft khi `PENDING_REVIEW` hoặc thiếu location.
- Ticket detail/draft hiển thị Playbook match, Asset match (kỹ thuật), vật tư cần dùng, tồn kho mô phỏng, team đề xuất, Duty status và Route status.
- Route chỉ ở cấp `SIM-TEAM-*`; không có nút gán nhân viên và không hiển thị assignee selector.
- Playbook Registry, Asset Catalog và DutyAvailability là read-only; không có màn hình CRUD tài sản hoặc lập lịch nhân sự.
- Không dùng các CTA “Nghiệm thu”, “Hoàn tất công việc”, “Đóng ticket”, “Phê duyệt vật tư”.
- Không có CTA gửi thông báo, yêu cầu ảnh cư dân hoặc tạo work order thật.

## 1.2 UI copy cho route (`CR-BPTN-01` / v0.4 candidate)

| Vị trí | Copy bắt buộc |
|---|---|
| Tiêu đề panel route | **Đề xuất team** |
| `route_status=ROUTED` | **Đề xuất tuyến team hợp lệ** |
| `route_status=NOT_ROUTED` | **Chưa có đề xuất tuyến team hợp lệ** + `queue_reason` |
| Helper text dưới panel | *Đây là đề xuất tuyến tới team mô phỏng, không phải xác nhận đã giao việc hoặc đã có nhân sự nhận việc.* |
| Capacity khi duty pass | *Capacity mô phỏng đạt điều kiện fixture; không phản ánh năng lực nhận việc thực tế.* |

Không hiển thị trong active MVP: "Đã giao việc", "Đã phân công", "Team đã nhận việc", "Nhân viên phụ trách", "Kỹ thuật viên được gán"; không có nút gán hoặc đổi nhân viên.

---

# 2. UI flows

Dataset demo dùng 12 ticket mô phỏng: 6 vệ sinh, 6 kỹ thuật. Bốn flow 2.1–2.4 là demo chính; tám ticket còn lại chạy regression và không tạo thêm demo flow.

## 2.1 Flow 1 — Happy path vệ sinh

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | BPTN | Tiếp nhận, mở raw ticket read-only | Có ingest event | ingest → `IN_PROGRESS` | Không | Access/ingest event |
| 2 | Agent | Validate ba raw fields, match `PB-CLN-01`, chạy risk rule và đề xuất service/type | Đủ raw field; không hazard signal | `IN_PROGRESS` → `IN_PROGRESS` | Không | Proposal + reason/rule/source |
| 3 | Agent | Quyết định BPTN review (`CR-BPTN-01`) | Category + location rõ → `NOT_REQUIRED`; BPTN không phải thao tác | giữ `IN_PROGRESS` | Thiếu/không rõ → `PENDING_REVIEW`, `CHỜ XÁC MINH` | `confirmation_status` + audit |
| 4 | Agent | Xác định vật tư, kiểm tra stock và duty | Stock đủ; team vệ sinh đang trực, capacity mô phỏng đạt điều kiện fixture | giữ `IN_PROGRESS` | Không | Stock + `SIM-DUTY-*` result |
| 5 | Agent | Tạo draft và đề xuất tuyến team | Mọi route gate pass | giữ `IN_PROGRESS` | Không | Draft + `SIM-TEAM-*` + `route_status=ROUTED` ("Đề xuất tuyến team hợp lệ"); `assignee_id=null` |
| 6 | Nhân sự thực hiện | Cập nhật checklist, material, ghi chú/evidence | Chỉ execution layer | giữ `IN_PROGRESS` | Chưa đủ thì giữ state | Execution revisions + audit |
| 7 | Agent | Reconcile planned/norm/issued/used và tám gates | Tất cả pass, route hợp lệ | `IN_PROGRESS` → `READY_FOR_REVIEW` | Không | Gate result + transition audit |
| 8 | Authorized UI user/System | Chọn “Chuyển BQL xem xét” | State READY | giữ `READY_FOR_REVIEW` | Không | Handoff event; không phải acceptance |

## 2.2 Flow 2 — Vệ sinh không có team đang trực

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate, match `PB-CLN-01`, quyết định BPTN review | Raw/admin gates pass; `NOT_REQUIRED` | giữ `IN_PROGRESS` | Không | Proposal + `confirmation_status` audit |
| 2 | Agent | Check stock và duty | Stock đủ; duty data rõ nhưng không team vệ sinh trực | giữ `IN_PROGRESS` | **Chặn route/READY** | `duty_lookup_status=NO_AVAILABLE_TEAM` |
| 3 | Agent | Tạo work order draft không có route | Draft hợp lệ dù duty fail | giữ `IN_PROGRESS` | **Chặn route/READY** | `route_status=NOT_ROUTED`, `queue_reason=NO_AVAILABLE_TEAM` |
| 4 | UI/BQL | Xem draft và lý do chưa route | Không được coi là giao việc | giữ `IN_PROGRESS` | **Chặn READY** | Audit lookup/draft; không có nút gán nhân viên |

## 2.3 Flow 3 — Happy path kỹ thuật

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate raw fields, match `PB-TEC-01`, risk scan và đề xuất service/type | Không mùi khét/tia lửa/dây hở | giữ `IN_PROGRESS` | Không | Proposal/rule/source reason |
| 2 | Agent | Quyết định BPTN review (`CR-BPTN-01`) | Category + location rõ → `NOT_REQUIRED` | giữ `IN_PROGRESS` | Thiếu/không rõ → `CHỜ XÁC MINH` | `confirmation_status` audit |
| 3 | Agent | Lookup `LIGHTING` asset | Đúng một `SIM-ASSET-*` match location | giữ `IN_PROGRESS` | Không | Asset match + source ref |
| 4 | Agent | Check planned/norm stock và duty | Vật tư đủ; team kỹ thuật trực/còn capacity | giữ `IN_PROGRESS` | Không | Stock + duty results |
| 5 | Agent | Tạo draft và đề xuất tuyến team | Các route gate pass | giữ `IN_PROGRESS` | Không | Draft + `SIM-TEAM-*`; `route_status=ROUTED` ("Đề xuất tuyến team hợp lệ"); `assignee_id=null` |
| 6 | Nhân sự thực hiện | Cập nhật execution/checklist/material/evidence | Không sửa raw | giữ `IN_PROGRESS` | Pending/missing giữ IN_PROGRESS | Execution audit |
| 7 | Agent | Validate tám gates | Route, checklist, result evidence và material đủ | `IN_PROGRESS` → `READY_FOR_REVIEW` | Không | Gate summary + transition |
| 8 | System/user | Handoff BQL | READY | giữ READY | Không | Handoff audit |

## 2.4 Flow 4 — Kỹ thuật không tìm thấy asset hoặc thiếu vật tư

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate, match `PB-TEC-01`, quyết định BPTN review | Không high-risk; `NOT_REQUIRED` | giữ `IN_PROGRESS` | Không | Proposal + `confirmation_status` audit |
| 2a | Agent | Lookup asset | Không có match hoặc nhiều match | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Chặn route** | `asset_lookup_status=NOT_FOUND|AMBIGUOUS`, reason/source |
| 2b | Agent | Check stock sau asset match | `material_stock_status=INSUFFICIENT` | giữ `IN_PROGRESS` | **Chặn route** | `queue_reason=MATERIAL_SHORTAGE` |
| 3 | Agent | Tạo draft phản ánh gate result | Asset unresolved dùng `asset_id=null`; shortage giữ matched asset | state theo 2a/2b | **Chặn READY** | Draft + `route_status=NOT_ROUTED` |
| 4 | UI/BQL | Xem Asset/Material/Duty/Route panels | Hiển thị exact reason; không tự route | giữ state | **Chặn READY** | Audit; no employee assignment CTA |

## 2.5 Edge flow A — Thiếu required field → `CHỜ XÁC MINH`

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate ba raw fields | Thiếu `ticket_id`, `created_at` hoặc `original_description` | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Blocking** | Missing-field list, rule/source, transition audit |
| 2 | Agent | Đề xuất service/type/playbook | Đủ raw fields | `IN_PROGRESS` → giữ | Không | Proposal/reason/source |
| 3 | Agent | Quyết định BPTN review (`CR-BPTN-01`) | Thiếu location hoặc category không rõ → `PENDING_REVIEW` | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Blocking draft** | `review_required_reason`; no draft |
| 4 | BPTN | Override service/type/location với `override_reason` (và source nếu có) | Dữ liệu đã xác minh; không có safety exception | `CHỜ XÁC MINH` → `IN_PROGRESS` qua revalidation | Gỡ block sau validate; Agent chạy lại playbook/asset/stock/duty | `OVERRIDDEN` + audit từng field |

## 2.6 Edge flow B — Material variance sau thực hiện

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Nhân sự thực hiện | Nhập planned/norm/issued/used/reason | Use case vệ sinh/kỹ thuật | `IN_PROGRESS` → giữ | Tùy kết quả | Material update audit |
| 2 | Agent | Chạy đúng ba comparisons | Có mismatch | giữ `IN_PROGRESS` | Chưa có reason: blocking clarification | Comparison result + neutral explanation |
| 3a | Agent | Yêu cầu xác minh | `variance_reason` thiếu | `IN_PROGRESS` → `CHỜ XÁC MINH` | **Blocking** | Missing reason + transition audit |
| 3b | Agent | Mark reconciled với warning | Có reason; không safety rule khác (`CONFIRMED OD-03`) | `IN_PROGRESS` → có thể READY nếu gate khác pass | **Non-blocking** | Warning rule/reason/comparison + audit |

## 2.7 Edge flow C — Missing minimum evidence

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Validate evidence requirements, tách khỏi checklist gate | Required evidence `MISSING/INVALID_TYPE` nhưng requirement đã rõ | `IN_PROGRESS` → giữ `IN_PROGRESS` | **Blocking READY** | Evidence gap result + rule/source |
| 2 | UI | Chỉ rõ evidence thiếu/sai loại | Không được mặc định yêu cầu ảnh | giữ | **Blocking READY** | View event optional |
| 3 | Nhân sự thực hiện | Add evidence mô phỏng đúng loại | Execution evidence only | giữ `IN_PROGRESS` | Revalidate | Evidence + audit |
| 4 | Agent | Revalidate | Tất cả gate pass | `IN_PROGRESS` → `READY_FOR_REVIEW` | Không | Gate/transition audit |

Nếu không xác định được evidence nào cần bổ sung hoặc source cần con người xác minh, Agent chuyển `CHỜ XÁC MINH` thay vì giữ `IN_PROGRESS`.

## 2.8 Edge flow D — Non-blocking warning trong `READY_FOR_REVIEW`

| Bước | Actor | Action | Điều kiện | State trước → sau | Block | Dữ liệu/audit tạo |
|---|---|---|---|---|---|---|
| 1 | Agent | Evaluate eight gates | Tất cả pass, gồm route; có explained variance warning | `IN_PROGRESS` → `READY_FOR_REVIEW` | **Non-blocking** | Warning + gate/transition audit |
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
| SIM-T-003 | Kỹ thuật| CHỜ XÁC MINH       | Asset: NOT_FOUND              |
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
| TRƯỜNG HÀNH CHÍNH                  | AGENT PROPOSAL + confirmation_status   |
| Department [editable allowlist]    | Service category proposed              |
| Location [required before draft]   | Ticket type proposed                   |
| Priority [optional]                | Playbook + version                     |
| override_reason [required khi sửa] | Matched rules + source + reason        |
| [Xác nhận không đổi] [Override]    | NOT_REQUIRED / PENDING_REVIEW (+ lý do) |
| Nguồn đối chiếu [optional]         | [Xem proposal details]                 |
|----------------------------------------------------------------------------|
| LOOKUP & ROUTING                                                           |
| Playbook match | Asset match (kỹ thuật) | Material/stock status                 |
| ĐỀ XUẤT TEAM: SIM-TEAM-* | Duty status | Đề xuất tuyến team hợp lệ / Chưa có |
| đề xuất tuyến team hợp lệ + Queue reason | Capacity mô phỏng (fixture)       |
|----------------------------------------------------------------------------|
| AUDIT PREVIEW: actor | field | old → new | reason | timestamp              |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** tách trực quan raw/admin/proposal và chống sửa nguồn.
- **Actor:** BPTN chỉnh admin; Agent/BQL/nhân sự read theo quyền.
- **Field hiển thị:** toàn bộ raw content/evidence; Agent-proposed service/type/playbook/location/reason/source; `confirmation_status`, `review_required_reason`, `override_*`; admin revision.
- **Field sửa/xác nhận (`CR-BPTN-01`):** BPTN chỉ bắt buộc thao tác khi `PENDING_REVIEW`; có thể xác nhận không đổi (`CONFIRMED`) hoặc override service/type/location (`OVERRIDDEN`) với `override_reason` bắt buộc và nguồn đối chiếu nếu có. Không override khi có safety exception.
- **Field bất biến:** original content, original evidence, original timestamp/ID.
- **Primary CTA:** khi `PENDING_REVIEW`: BPTN “Override trường hành chính” (reason bắt buộc); khi `NOT_REQUIRED`: không có CTA bắt buộc, chỉ “Xác nhận không đổi” (tùy chọn) hoặc “Override” nếu phát hiện sai.
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
| Raw required fields: [PASS] | confirmation_status: NOT_REQUIRED/CONFIRMED/ |
|                              | OVERRIDDEN [PASS] · PENDING_REVIEW [BLOCK]   |
| Location before draft: [PASS] | Priority: [OPTIONAL]                       |
| Playbook match: PB-... | Asset: MATCHED / N/A / unresolved                 |
| Material needed + simulated stock | ĐỀ XUẤT TEAM + duty/capacity mô phỏng   |
| Đề xuất tuyến team hợp lệ / Chưa có đề xuất tuyến team hợp lệ + reason    |
| Đây là đề xuất tuyến tới team mô phỏng, không phải xác nhận đã giao việc  |
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
- **Disabled/absent:** create real work order, gán nhân viên cụ thể, approve.
- **Route rule:** nếu không có team trực/stock thiếu/asset unresolved, draft vẫn hiển thị cùng lý do chưa route; `assignee_id` không có giá trị.
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
| MATERIAL & SIMULATED STOCK                                                  |
| item | planned_qty | norm_qty | stock_qty/status | issued_qty | used_qty    |
| variance | variance_reason                                                  |
| Comparisons: planned↔norm | issued↔planned | used↔issued                   |
| Pre-route stock gate: SUFFICIENT / INSUFFICIENT / UNKNOWN / N/A             |
|----------------------------------------------------------------------------|
| EVIDENCE REQUIREMENTS — TÁCH KHỎI CHECKLIST GATE                            |
| requirement | required? | present/missing/invalid | source                  |
| Ảnh không bắt buộc trong MVP                                                |
| [Lưu execution data] [Chạy kiểm tra hồ sơ]                                 |
+----------------------------------------------------------------------------+
```

- **Mục tiêu:** cập nhật và nhìn rõ các nhóm readiness data.
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
| Asset lookup (kỹ thuật)            [PASS / N/A]                             |
| Đề xuất team + duty/capacity mô phỏng [PASS: Đề xuất tuyến team hợp lệ]    |
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

- **Mục tiêu:** một review package kiểm chứng đủ eight gates, trong đó route hợp lệ là bắt buộc.
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

- Bốn demo flow chính chạy qua `UI-01 → UI-02 → UI-03 → UI-04/05 → UI-06` hoặc dừng tại draft/lookup reason; `UI-07` dành cho high-risk exception và `UI-08` làm bằng chứng audit.
- Flow missing required field, material variance, missing evidence và non-blocking warning đều có trạng thái/banner/action rõ.
- Copy `READY_FOR_REVIEW` luôn kèm câu không đồng nghĩa nghiệm thu/hoàn tất/đóng/phê duyệt.
- Component không dựa màu đơn lẻ; trạng thái và severity có text.
- Không có resident-facing surface hoặc outbound message action.
- Không có financial field/action ngoài danh sách out-of-scope của các tài liệu khác.

## Phase 4 consistency gate

**PASS.** IA và flow bao phủ bốn demo flow cùng bốn edge flows, áp dụng nhất quán asset/duty/stock/team-only routing và không tạo state/actor/CTA ngoài PRD. Không có màn hình quản lý tài sản/lịch nhân sự hoặc nút gán nhân viên; tên/bằng chứng sign-off OD-09 vẫn `TBD`.

# 5. Backlog implementation UI (nhánh chưa có frontend)

Repo hiện chỉ có API `/api/v1/mo` (Swagger); chưa có frontend. Không tạo UI giả không được dùng. Khi làm frontend:

| ID | Hạng mục | Nguồn dữ liệu API |
|---|---|---|
| `UI-BL-01` | Panel "Đề xuất team" dùng đúng copy §1.2; không có assignee selector | `draft.route_status`, `routing_team_id`, `duty_status`, `duty_source_ref`, `queue_reason` |
| `UI-BL-02` | Banner `PENDING_REVIEW` + form override (reason bắt buộc, nguồn optional) | `ticket.administrative_normalization.*`; `POST /tickets/{id}/override` |
| `UI-BL-03` | Nút "Xác nhận không đổi" tùy chọn | `POST /tickets/{id}/confirm` |
| `UI-BL-04` | Ẩn/disable review/override khi có `EXCEPTION`; hiển thị lỗi 403 có audit | `exceptions[].status`, `audit` |
| `UI-BL-05` | Copy `READY_FOR_REVIEW` kèm "không phải nghiệm thu/đóng ticket" | `ticket.state_decision.reason` |

## Deferred / Future Scope

- CSKH chỉ thuộc backlog tương lai; không có row Work Queue, flow, wireframe, CTA hoặc demo trong active MVP.
- Route acknowledgement của team và mọi hiển thị "team đã nhận việc" thuộc pilot, không thuộc MVP.
