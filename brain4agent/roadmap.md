# MaintenanceOps MVP v0.3 — Build Roadmap

> **Product baseline:** FROZEN  
> **Freeze date:** 28/09/2026  
> **Build readiness:** READY FOR BUILD  
> **Implementation completion:** NOT YET VERIFIED  
> **Change rule:** mọi thay đổi frozen scope phải qua change control và re-baseline.

## 1. Roadmap purpose

Roadmap này chuyển bảy tài liệu frozen thành trình tự triển khai và kiểm chứng MaintenanceOps Agent. Nó không thay thế PRD, Data Contract, Playbook hoặc Traceability Matrix.

Ba nguyên tắc điều phối:

1. Contract và deterministic rules đi trước UI hoặc model behavior.
2. Không work package nào được coi là hoàn tất nếu chưa có bằng chứng kiểm tra trên workspace hiện tại.
3. Khi code khác frozen documents, dừng và ghi drift; không sửa yêu cầu để hợp thức hóa code.

## 2. Current status

### Completed baseline work

- [x] `MO-00` — Freeze MaintenanceOps MVP v0.3 và đóng OD-09.
- [x] Bảy tài liệu canonical thống nhất về hai playbook, bốn state, 12 tickets, 4 demo flows và team-only routing.
- [x] `brain4agent/memory-distill.txt` đã rebase.
- [x] `brain4agent/memory/hot/state.json` đã rebase.
- [x] `brain4agent/index.md` đã rebase.
- [x] `brain4agent/project-intro.md` đã rebase.
- [x] `brain4agent/roadmap.md` đã rebase.
- [x] `brain4agent/-data-architecture.md` đã rebase.

### Active now

- [ ] Hoàn tất memory hygiene cho hot log, changelog, gotchas và archive boundary.

### Remaining memory hygiene

- [ ] Rotate/rebase `brain4agent/memory/hot/today.md`.
- [ ] Tạo legacy boundary trong `brain4agent/changelog.md`.
- [ ] Tách gotcha dùng chung khỏi gotcha lịch sử trong `brain4agent/-known-gotchas.md`.
- [ ] Gắn banner LEGACY và loại `brain4agent/memory/archive/*` khỏi startup context.
- [ ] Chạy consistency validator trên toàn bộ active memory.

### Not yet started or verified

- [ ] Audit implementation hiện có trong `src/` và `tests/`.
- [ ] Chuyển Data Contract thành executable schema/validators.
- [ ] Tạo đủ 12 synthetic ticket fixtures và lookup catalogs.
- [ ] Cài deterministic state/routing/readiness engine.
- [ ] Cài UI và bốn demo flow.
- [ ] Chạy full regression và demo rehearsal.

## 3. Dependency sequence

```text
MO-00 Frozen baseline
  → MO-01 Active memory alignment
  → MO-02 Implementation gap audit
  → MO-03 Executable contracts and validators
  → MO-04 Synthetic fixtures and reset
  → MO-05 Deterministic workflow engine
  → MO-06 API/application workflow
  → MO-07 BQL UI and four demo flows
  → MO-08 Traceability tests and adversarial validation
  → MO-09 Demo readiness and frozen release candidate
```

Không bỏ qua dependency gate. UI không được định nghĩa ngược business rule; model output không được thay deterministic validator.

## 4. Work packages

### MO-00 — Frozen product baseline

**Status:** COMPLETE.

**Inputs**

- Problem Statement.
- Product Brief.
- Lean PRD.
- UI Flow/Wireframe.
- Traceability and Review.
- Data Contract v1.1.
- Playbook v1.1.

**Exit evidence**

- MaintenanceOps MVP v0.3 có trạng thái `FROZEN`.
- OD-09 có approver/sign-off evidence.
- Hai playbook, bốn state, dataset và demo baseline không mâu thuẫn.
- Các quyết định mở còn lại là non-blocking và không mở rộng frozen scope.

### MO-01 — Active memory alignment

**Status:** IN PROGRESS.

**Scope**

- Rebase kernel, state, router, project overview, roadmap và data architecture.
- Cô lập historical memory khỏi startup.
- Giữ changelog lịch sử nhưng không cho lịch sử định tuyến quyết định hiện tại.
- Thiết lập required-term, stale-term, link và JSON validation.

**Exit criteria**

- Chín file active/root/hot phản ánh MaintenanceOps.
- Historical files có nhãn LEGACY và bị loại khỏi source precedence.
- Không còn link active bị hỏng.
- Không có mâu thuẫn giữa active memory và bảy tài liệu frozen.
- Mọi nội dung bị loại khỏi active scope chỉ xuất hiện trong Deferred/Future Scope/Backlog.

### MO-02 — Implementation gap audit

**Status:** PENDING; bắt đầu sau MO-01.

**Scope**

- Inventory `src/`, `tests/`, API routes, schemas, configuration và dependencies.
- Map code hiện tại tới FR, BR, validator và test IDs trong RTM.
- Phân loại từng thành phần: reuse, modify, replace hoặc remove from active path.
- Kiểm tra liệu architecture/supporting diagrams còn đúng hay đã stale.
- Không sửa code trong work package audit trừ khi có task triển khai riêng.

**Deliverables**

- Code-to-requirement gap matrix.
- Danh sách đường dẫn implementation được xác nhận.
- Rủi ro và dependency thực tế.
- Kế hoạch patch theo lát dọc có thể kiểm thử.

**Exit gate**

Không còn assumption chưa kiểm chứng về framework, provider, storage, runtime hoặc deployment.

### MO-03 — Executable contracts and validators

**Status:** PENDING.

**Scope**

- Định nghĩa enum chính xác cho playbook, state, lookup, stock, route, queue, checklist, evidence và reconciliation.
- Cài entity schema tối thiểu: Ticket, BPTN confirmation, AgentClassificationProposal, Asset, DutyAvailability, WorkOrderDraft, checklist, material, evidence, execution update, audit và readiness evaluation.
- Bảo vệ raw resident fields và raw evidence khỏi mutation.
- Reject `assignee_id` khác `null`.
- Enforce `assignment_mode=SIMULATED_TEAM_ROUTE` và `assignment_scope=TEAM_ONLY`.
- Enforce ID prefixes và `synthetic/read_only`.

**Exit gate**

- Contract tests pass.
- Invalid enum/cross-entity payload fail closed.
- Pre-draft, route và readiness invariants có validator độc lập.
- Schema không có trường hoặc action gán nhân viên thật.

### MO-04 — Synthetic fixtures and deterministic reset

**Status:** PENDING; phụ thuộc MO-03.

**Scope**

- 12 ticket: 6 CLN, 6 TEC.
- 4 demo tickets và 8 regression tickets.
- Playbook Registry read-only.
- Asset Catalog ưu tiên `LIGHTING`.
- DutyAvailability cho available, no-team, unknown và capacity-exceeded.
- Stock fixtures cho sufficient, insufficient, unknown và explicit N/A.
- Checklist/material/evidence expected outcomes.
- Reset command hoặc fixture loader idempotent.

**Required IDs**

- `SIM-TKT-*`
- `SIM-ASSET-*`
- `SIM-TEAM-*`
- `SIM-DUTY-*`
- Các ID mô phỏng khác phải tiếp tục dùng tiền tố `SIM-`.

**Exit gate**

- Tổng và phân bổ fixture đúng 12/6/6/4/8.
- Expected oracle có playbook, lookups, draft existence, route, state/reason và readiness.
- Reset không sửa source fixture và cho kết quả lặp lại.

### MO-05 — Deterministic workflow engine

**Status:** PENDING; phụ thuộc MO-03 và MO-04.

**Required order**

1. Validate raw ticket integrity.
2. Validate BPTN administrative confirmation.
3. Match playbook.
4. Run high-risk exception rules.
5. Lookup asset cho TEC.
6. Determine planned/norm materials và stock status.
7. Lookup duty/capacity cho CLN và TEC.
8. Create idempotent WorkOrderDraft.
9. Route cấp team chỉ khi mọi applicable gate pass.
10. Validate execution updates.
11. Reconcile planned/norm/issued/used materials.
12. Evaluate readiness gates.
13. Emit state/reason/audit.

**Critical branch oracles**

- Asset zero/multiple → draft asset unresolved, `CHỜ XÁC MINH`, no route.
- Stock insufficient → draft, `IN_PROGRESS`, `MATERIAL_SHORTAGE`, no route.
- Stock unknown → draft, `CHỜ XÁC MINH`, `MATERIAL_STOCK_UNKNOWN`, no route.
- No team on duty → draft, `IN_PROGRESS`, `NO_AVAILABLE_TEAM`, no route.
- Duty unknown → draft, `CHỜ XÁC MINH`, `DUTY_UNKNOWN`, no route.
- Capacity exceeded → draft, `IN_PROGRESS`, `TEAM_CAPACITY_EXCEEDED`, no route.
- Invalid route → không được coi là assigned và không thể READY.
- High-risk exception → `EXCEPTION` và không tạo standard draft theo playbook rule.

**Exit gate**

Deterministic tests chứng minh mọi branch trên; model output không thể bypass validator.

### MO-06 — API and application workflow

**Status:** PENDING; phụ thuộc MO-05.

**Scope**

- Ingest synthetic ticket từ contract tương đương app/form hiện có.
- BPTN confirmation command với field allowlist.
- Classification/lookup/draft/route orchestration.
- Human execution update cho checklist, material, note và evidence.
- Readiness evaluation và BQL review query.
- Idempotency, audit, validation error và permission rejection.

**Exit gate**

- API không có action tự nghiệm thu, đóng ticket, duyệt vật tư hoặc duyệt thanh toán.
- Raw source không mutate.
- Retry không tạo duplicate logical draft.
- Forbidden action fail closed và có audit.

### MO-07 — BQL UI and four demo flows

**Status:** PENDING; phụ thuộc MO-06.

**Required UI areas**

- Work Queue chỉ cho CLN/TEC.
- Ticket/admin confirmation.
- Classification and playbook match.
- Asset match cho TEC.
- Planned/norm materials và stock status.
- Proposed team, duty/capacity và route status.
- WorkOrderDraft detail.
- Execution/checklist/material/evidence update.
- Readiness breakdown và BQL review.

**Forbidden UI**

- Nút gán nhân viên cụ thể.
- Màn hình quản lý tài sản riêng.
- Màn hình lập lịch nhân sự.
- CTA ngụ ý Agent đã nghiệm thu, đóng ticket hoặc phê duyệt vật tư.
- Ảnh như field bắt buộc.

**Exit gate**

Bốn demo flow chạy đúng expected state/reason; draft và lý do chưa route luôn hiển thị ở blocked-route flows.

### MO-08 — Traceability tests and adversarial validation

**Status:** PENDING; phụ thuộc MO-03 đến MO-07.

**Minimum regression coverage**

- TEC exact asset match.
- TEC asset not found.
- TEC asset ambiguous.
- CLN team available.
- CLN no team on duty.
- Stock sufficient.
- Stock insufficient.
- Stock unknown.
- Duty unknown.
- Team capacity exceeded.
- Draft exists without route.
- Agent cannot assign non-null `assignee_id`.
- Invalid route cannot transition to `READY_FOR_REVIEW`.
- Raw content/evidence mutation rejected.
- Agent cannot complete checklist or approve material/payment.
- High-risk exception branches.
- Missing/invalid evidence and material variance reason.

**Exit gate**

- RTM không có orphan requirement hoặc orphan test.
- Tests sử dụng frozen oracle, không dựa vào UI copy.
- Negative and permission tests pass.
- Dataset reset và bốn demo paths deterministic.

### MO-09 — Demo readiness and release candidate

**Status:** PENDING; phụ thuộc MO-08.

**Scope**

- Rehearse bốn demo flows từ clean reset.
- Capture expected state/reason/route evidence.
- Kiểm tra copy không trình bày synthetic data như dữ liệu thật.
- Kiểm tra không có integration hoặc secret thật cần cho demo.
- Lập release checklist và known limitations.
- Freeze release candidate; mọi thay đổi sau đó phải qua change control.

**Exit gate**

- 4/4 demo flows pass sau reset.
- 12/12 ticket classification/expected outcome pass.
- Không broken link, stale active memory hoặc unresolved blocking contradiction.
- Bằng chứng demo truy vết tới RTM/test IDs.

## 5. Global quality gates

Mọi work package triển khai phải giữ các điều kiện sau:

- Exactly two active playbooks.
- Exactly four top-level states.
- Duty lookup cho cả CLN và TEC.
- Asset lookup bắt buộc riêng cho TEC.
- Stock gate trước route.
- WorkOrderDraft tồn tại độc lập với route.
- `route_status=ROUTED` chỉ khi mọi applicable route gate pass.
- `READY_FOR_REVIEW` yêu cầu prior valid route và đủ readiness gates.
- Team-only route và `assignee_id=null`.
- Agent không vượt quyền.
- Fixture synthetic/read-only và không có dữ liệu nội bộ thật.
- Không thay đổi frozen scope mà thiếu approval.

## 6. Risk register

| Risk | Impact | Mitigation / required evidence |
|---|---|---|
| Code hiện tại thuộc kiến trúc khác | Reuse sai và lan drift vào MVP | Hoàn thành MO-02 trước khi build |
| Model tạo state/reason không hợp lệ | Route/READY sai | Deterministic enum and transition validator |
| Draft bị đồng nhất với assignment | Báo giao việc sai | Tách draft existence khỏi `route_status` trong contract/UI/test |
| Asset match mơ hồ | Route nhầm thiết bị | Exact-one lookup; zero/multiple fail closed |
| Duty/capacity silently default | Route tới team không hợp lệ | Explicit status/source; unknown có state/reason riêng |
| Stock thiếu nhưng vẫn route | Vi phạm frozen gate | Pre-route stock validator và negative test |
| UI cho phép gán cá nhân | Vượt MVP scope | Schema reject + không render CTA + inspection test |
| READY bị hiểu là nghiệm thu | Sai authority | Copy guard và BQL review step bắt buộc |
| Fixture bị trình bày như dữ liệu thật | Sai data posture | Synthetic labels, SIM prefixes và demo disclaimer |
| Active memory tái nhiễm lịch sử | Agent ra quyết định sai | Legacy isolation + stale-term/link checks |

## 7. Deferred / Future Scope / Backlog

- CSKH.
- Gán nhân viên cụ thể.
- Tích hợp hệ thống vận hành thật.
- Lịch trực thật và tối ưu nhân sự thực tế.
- Thanh toán, hóa đơn và thuê ngoài.
- CRUD cho Playbook Registry, Asset Catalog hoặc lịch nhân sự.

Không triển khai backlog trong các work package MO-01 đến MO-09 nếu chưa có change approval.

## 8. Immediate next actions

1. Rebase `today.md`, `changelog.md` và `-known-gotchas.md`; cô lập archive.
2. Chạy validator toàn bộ active memory.
3. Bắt đầu MO-02 implementation gap audit.
