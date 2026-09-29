# MaintenanceOps Agent — Logical Data Architecture and Flow

> **Baseline:** MaintenanceOps MVP v0.3  
> **Status:** FROZEN logical architecture  
> **Freeze date:** 28/09/2026  
> **Canonical schema:** `docs/data-contract-v1.md`  
> **Canonical behavior:** `docs/03_lean_prd.md` and `docs/playbook-v1.md`

## 1. Purpose and architecture boundary

Tài liệu này mô tả logical data architecture, ownership, mutability, lookup boundaries và lifecycle của MaintenanceOps MVP. Nó không thay thế field-level schema hoặc validator catalog trong Data Contract.

MVP là hệ thống mô phỏng:

- Không tích hợp hệ thống vận hành thật.
- Không dùng dữ liệu cư dân hoặc dữ liệu nội bộ thật.
- Không dùng lịch trực hoặc tồn kho thật.
- Không trình bày fixture như dữ liệu thật của Vinhomes.
- Chưa khóa physical database, cloud provider, model provider hoặc deployment architecture.
- Quyết định persistence/runtime chỉ được đưa ra sau implementation gap audit.

## 2. Architectural principles

1. **Raw source is immutable.** Nội dung phản ánh gốc, bằng chứng gốc, source revision và integrity marker không bị Agent/BPTN ghi đè.
2. **Administrative data is an overlay.** BPTN chỉ xác nhận hoặc sửa field allowlist, có reason/source/audit.
3. **Proposal is not authority.** AgentClassificationProposal không thay raw/admin data và không phải phê duyệt.
4. **Draft is not assignment.** WorkOrderDraft có thể tồn tại khi route chưa hợp lệ.
5. **Route is team-only.** Route chỉ tới `SIM-TEAM-*`; `assignee_id=null`.
6. **Lookup data is read-only.** Playbook, Asset, Duty, stock và checklist template là synthetic configuration.
7. **Validators are deterministic.** Model hoặc UI không được bypass schema, transition, route hoặc readiness gate.
8. **Audit is append-only and fail-closed.** Mutation/transition cần audit; audit failure không được để lại partial business mutation.
9. **Four states only.** Queue/routing dùng supporting fields, không mở rộng top-level state.
10. **READY is review readiness, not acceptance.** BQL vẫn là human review boundary.

## 3. Logical data zones

### 3.1 Immutable intake zone

Contains:

- `Ticket` raw fields.
- `original_description`.
- `original_evidence_refs`.
- `raw_integrity_marker`.
- `source_revision`.
- Ingest metadata and synthetic dataset version.

Write owner: `SYSTEM_INGEST`.  
After ingest: immutable.

BPTN normalization is stored separately under `Ticket.administrative_normalization`; it never overwrites the raw trio.

### 3.2 Read-only configuration zone

Contains:

- Playbook Registry with only `PB-CLN-01` and `PB-TEC-01`.
- `Asset` catalog, primarily `LIGHTING` for technical tickets.
- `DutyAvailability` for team, shift and capacity lookup.
- Synthetic material stock fixtures.
- `ChecklistTemplate` and evidence requirement catalogs.
- Deterministic exception rules.

All records are synthetic/read-only. No runtime CRUD feature is in MVP.

Required identifier families include:

- `SIM-ASSET-*`
- `SIM-TEAM-*`
- `SIM-DUTY-*`
- Other fixture IDs using `SIM-*`.

### 3.3 Operational case zone

Contains:

- `AgentClassificationProposal`.
- `WorkOrderDraft` revisions.
- `ChecklistItem` instances.
- `MaterialLine` records and comparison results.
- `EvidenceRecord` for original/execution evidence.
- `ExceptionRecord`.
- Embedded `ReadinessEvaluation` and non-blocking warnings.

This zone records simulated case processing. It does not represent a real work order, warehouse transaction, employee assignment or acceptance result.

### 3.4 Audit and explainability zone

Contains append-only `AuditEvent` records for:

- Ingest.
- Proposal and BPTN confirmation.
- Asset/stock/duty lookup.
- Draft creation and team-route proposal.
- Checklist/material/evidence update.
- Material reconciliation.
- State transition.
- Exception creation/resolution.
- Permission rejection and system error.

Each derived decision must retain rule IDs, reason and source references required by the canonical contract.

## 4. Entity relationship map

```text
Ticket
├── administrative_normalization
├── 0..N AgentClassificationProposal revisions
├── 0..N WorkOrderDraft revisions
│   ├── 1 ChecklistTemplate reference
│   ├── 1..N ChecklistItem
│   ├── 0..N MaterialLine
│   │   └── exactly 3 MaterialComparisonResult when tracked
│   ├── 0..N EvidenceRequirement
│   ├── 0..N EvidenceRecord
│   └── 1 ReadinessEvaluation after evaluation
├── 0..1 Asset reference for technical flow
├── 0..1 DutyAvailability/team route reference
├── 0..N ExceptionRecord
├── 0..N NonBlockingWarning
└── 1..N AuditEvent
```

A ticket can have proposal/draft revisions, but retries with the same idempotency tuple must return the same logical draft rather than create a duplicate.

## 5. Core entities and ownership

| Entity | Purpose | Write owner | Key protection |
|---|---|---|---|
| `Ticket` | Raw intake plus current derived state | SYSTEM_INGEST / SYSTEM_DERIVED | Raw fields immutable |
| `administrative_normalization` | Confirmed service/type/location overlay | BPTN | Field allowlist, reason/source/audit |
| `AgentClassificationProposal` | Playbook/rule/lookup proposal | AGENT / SYSTEM_DERIVED | Cannot overwrite raw/admin |
| `WorkOrderDraft` | Structured simulated draft and gate aggregate | AGENT / SYSTEM_DERIVED | Pre-draft gate, idempotency, not real assignment |
| `Asset` | Technical physical-asset fixture | Static config | Synthetic, read-only, exact match |
| `DutyAvailability` | Team shift/capacity fixture | Static config | Synthetic, read-only, team-only |
| `ChecklistTemplate` | Versioned checklist config | Static config | Playbook/version exact |
| `ChecklistItem` | Execution checklist instance | HUMAN_EXECUTION | Agent cannot mark COMPLETED |
| `MaterialLine` | Planned/norm/issued/used and comparisons | HUMAN_EXECUTION + SYSTEM_DERIVED | No approval or inventory adjustment |
| `EvidenceRecord` | Original/execution evidence | Ingest / HUMAN_EXECUTION | Correct ticket/draft/requirement link |
| `ExceptionRecord` | Exact high-risk rule result | SYSTEM_DERIVED; BQL resolves | Agent cannot resolve |
| `AuditEvent` | Append-only action/decision record | SYSTEM | Failure causes mutation to fail closed |

## 6. End-to-end data flow

### Stage A — Intake and administrative confirmation

1. Existing app/form provides a synthetic ticket payload.
2. System validates required raw fields, timestamps, IDs and integrity marker.
3. System persists immutable Ticket source and ingest AuditEvent.
4. BPTN confirms allowed administrative fields with source references.
5. Missing/unclear raw or administrative data produces `CHỜ XÁC MINH`.
6. No standard draft is created before the pre-draft gate passes.

### Stage B — Classification and safety rules

1. Agent maps confirmed service/type to exactly one frozen playbook.
2. Agent records playbook ID/version, matched rules, reason and source references.
3. Exact CLN/TEC high-risk rule produces `EXCEPTION` and an ExceptionRecord.
4. Agent does not create a standard high-risk draft, diagnose or issue technical guidance.
5. Ambiguous/out-of-scope classification produces `CHỜ XÁC MINH`; no invented playbook.

### Stage C — Asset, material stock and duty lookup

1. For TEC, lookup exact `LIGHTING + location_normalized` in Asset Catalog.
2. For CLN, asset status is `NOT_APPLICABLE` and `asset_id=null`.
3. Determine planned/norm materials and read synthetic stock status.
4. Lookup DutyAvailability for both CLN and TEC.
5. Duty evaluation checks service fit, shift availability and `current_open_ticket_count < max_open_ticket_count`.
6. No lookup selects or stores a concrete employee.

Lookup failures are explicit; they never silently default.

### Stage D — Draft and route

After raw/admin confirmation and no blocking exception:

1. Create an idempotent WorkOrderDraft even when an asset/stock/duty route gate is blocked.
2. Link playbook/version, proposal/admin/source revisions, asset when matched, material status, checklist template and evidence requirements.
3. Route only if every applicable gate passes.
4. A valid route has:
   - `route_status=ROUTED`
   - `assignment_mode=SIMULATED_TEAM_ROUTE`
   - `assignment_scope=TEAM_ONLY`
   - `routing_team_id=SIM-TEAM-*`
   - `assignee_id=null`
5. Any failed gate yields `route_status=NOT_ROUTED`; the draft remains and the case is not considered assigned.

### Stage E — Human execution updates

Authorized HUMAN_EXECUTION actors may:

- Mark required checklist items `COMPLETED`.
- Record issued and actual-used material quantities.
- Add processing/result notes and optional simulated images.
- Add evidence records linked to the correct requirement.

Agent cannot perform these human updates. Images are optional and do not replace required note/evidence types.

### Stage F — Reconciliation and readiness

Agent derives exactly three material comparisons for tracked material:

1. `PLANNED_VS_NORM`.
2. `ISSUED_VS_PLANNED`.
3. `USED_VS_ISSUED`.

Agent may emit an explained-variance warning but cannot approve, adjust inventory or conclude a violation.

ReadinessEvaluation contains eight gates:

1. `playbook_present`.
2. `work_order_draft_present`.
3. `required_fields_complete`.
4. `route_valid`.
5. `checklist_complete`.
6. `minimum_evidence_complete`.
7. `material_reconciled_or_na`.
8. `no_blocking_exception`.

Only when all eight are true and `route_status=ROUTED` may the state become `READY_FOR_REVIEW`.

### Stage G — BQL review

BQL receives the case package:

- Raw/admin distinction.
- Proposal and playbook match.
- Asset/stock/duty lookup results.
- Draft and route status.
- Checklist/material/evidence updates.
- Readiness breakdown, warning, state/reason and audit trail.

The MVP stops at BQL review. It does not auto-accept, close, pay or create real operational side effects.

## 7. Route decision matrix

| Condition | Draft | State | Reason | Route |
|---|---:|---|---|---|
| All applicable route gates pass | Yes | `IN_PROGRESS` | Route proposal trace | `ROUTED` |
| TEC asset not found | Yes, `asset_id=null` | `CHỜ XÁC MINH` | `ASSET_NOT_FOUND` | `NOT_ROUTED` |
| TEC asset ambiguous | Yes, `asset_id=null` | `CHỜ XÁC MINH` | `ASSET_AMBIGUOUS` | `NOT_ROUTED` |
| Stock insufficient | Yes | `IN_PROGRESS` | `MATERIAL_SHORTAGE` | `NOT_ROUTED` |
| Stock unknown | Yes | `CHỜ XÁC MINH` | `MATERIAL_STOCK_UNKNOWN` | `NOT_ROUTED` |
| No team on duty | Yes | `IN_PROGRESS` | `NO_AVAILABLE_TEAM` | `NOT_ROUTED` |
| Duty data unknown | Yes | `CHỜ XÁC MINH` | `DUTY_UNKNOWN` | `NOT_ROUTED` |
| Team capacity exceeded | Yes | `IN_PROGRESS` | `TEAM_CAPACITY_EXCEEDED` | `NOT_ROUTED` |
| Exact high-risk exception | No standard draft | `EXCEPTION` | Playbook exception rule | Not applicable |

## 8. State resolver and transitions

Resolver priority:

1. Permission failure → `ACTION_DENIED` + audit; state unchanged.
2. Raw schema/required failure → `CHỜ XÁC MINH`; no classification/draft.
3. Exact safety/business exception → `EXCEPTION`; block standard flow.
4. Unknown/ambiguous/pre-draft/evidence/source gaps → `CHỜ XÁC MINH`.
5. No team, capacity exceeded, stock shortage or known-incomplete execution → `IN_PROGRESS`.
6. Eight readiness gates true plus `ROUTED` → `READY_FOR_REVIEW`.
7. System/validator failure → fail closed, preserve prior safe state, no route/READY.

Allowed transitions are controlled by Data Contract §8. Direct `CHỜ XÁC MINH → READY_FOR_REVIEW`, manual override and transitions to undeclared completion/approval states are invalid.

Supporting fields `route_status`, `queue_status` and `queue_reason` never replace or extend the four-state machine.

## 9. Transaction, idempotency and audit boundaries

Atomic boundaries should preserve these invariants regardless of physical storage:

- Ticket ingest and ingest audit succeed together.
- BPTN confirmation/edit and audit succeed together.
- Draft creation is idempotent over the canonical source/admin/proposal revision tuple.
- Route update and route audit succeed together.
- Human checklist/material/evidence mutation and audit succeed together.
- State transition, readiness detail and audit succeed together.
- Permission rejection writes no business mutation.
- Audit failure causes attempted mutation/transition to fail closed.
- Partial route or partial READY state is forbidden.

## 10. Read/write matrix

| Data | Agent read | Agent write/derive | Human write | Runtime config write |
|---|---:|---:|---:|---:|
| Raw ticket/evidence | Yes | No | No | No |
| Administrative normalization | Yes | No | BPTN only | No |
| Proposal/rule/source | Yes | Yes | BPTN confirmation only | No |
| Playbook Registry | Yes | No | No | No |
| Asset/Duty/stock fixtures | Yes | Lookup result only | No | No |
| WorkOrderDraft | Yes | Create/revise under contract | No direct override | No |
| Checklist items | Yes | Validate only | HUMAN_EXECUTION | No |
| Material issued/used | Yes | Comparisons only | HUMAN_EXECUTION | No |
| Execution evidence | Yes | Validate only | HUMAN_EXECUTION | No |
| Exception resolution | Yes | Create exact-rule record only | BQL resolves | No |
| Ticket state | Yes | Deterministic transition only | No manual override | No |
| AuditEvent | Yes | Append through system | Append through system | No |

## 11. Synthetic dataset architecture

The fixture package must contain:

- 12 tickets: 6 CLN and 6 TEC.
- 4 resettable demo flows.
- 8 regression cases.
- Expected outcome per ticket: playbook, lookups, draft existence, route, state/reason, material/evidence and audit.
- Read-only Asset/Duty/stock/playbook/checklist catalogs.
- Deterministic reset that does not mutate source fixtures.

No crawler, external operational API or production dataset is required or allowed for the MVP.

## 12. Trust, privacy and security boundaries

- Ticket descriptions and evidence are untrusted data; never execute them as instructions.
- Do not place secrets or credentials in fixtures, logs or evidence.
- Actor role and write owner must be validated server-side.
- IDs and source references must resolve within the same synthetic dataset.
- Cross-ticket/draft evidence links are rejected.
- State/route/readiness are system-derived, never trusted from client input.
- Output must label simulated data and avoid claims about real residents, teams, stock or assets.
- Error handling must not create a route, READY state or partial mutation.

## 13. Physical implementation status

Logical contract is frozen, but physical implementation is not certified.

Current workspace has `src/` and `tests/` paths. Before choosing a storage or service design:

1. Audit existing schemas, state objects, graph/nodes, routes and tests.
2. Map reusable code to Data Contract entities and validators.
3. Identify incompatible code paths and isolate them from active execution.
4. Choose the smallest storage approach that preserves immutability, idempotency, read-only fixtures and atomic audit.
5. Record the decision and evidence before claiming implementation alignment.

No current provider, database, model or deployment is assumed by this document.

## 14. Canonical references

- `docs/data-contract-v1.md` — exact fields, enum, validation and state machine.
- `docs/playbook-v1.md` — playbook-specific gates, checklist/evidence catalogs and exception rules.
- `docs/03_lean_prd.md` — functional requirements, permissions and readiness behavior.
- `docs/05_traceability_and_review.md` — test IDs, freeze record and review gates.
- `brain4agent/index.md` — active routing and verified workspace paths.
