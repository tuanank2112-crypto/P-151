# MaintenanceOps Agent — Active Memory Router

> **Baseline:** MaintenanceOps MVP v0.3  
> **Status:** FROZEN · READY FOR BUILD  
> **Freeze date:** 28/09/2026  
> **Freeze authority:** OD-09 Sign-off Record  
> **Router status:** Active for MaintenanceOps; historical memory is excluded from startup decisions.

## 1. Startup route

Read in this order before changing product behavior, data contracts, UI flow or tests:

1. [memory-distill.txt](memory-distill.txt) — compact frozen kernel and non-negotiable rules.
2. [memory/hot/state.json](memory/hot/state.json) — machine-readable current state.
3. This file — route the task to the canonical documents and real workspace paths.
4. The relevant canonical document(s) in Section 2.
5. Actual implementation and tests, only after the frozen requirement is understood.

If implementation, supporting documentation or historical memory conflicts with the seven frozen documents, stop and record the drift. Do not silently reinterpret the requirement or expand scope.

## 2. Canonical documents

| Need | Canonical source | What it controls |
|---|---|---|
| Problem, actors, pain point, boundaries | [01_problem_statement.md](../docs/01_problem_statement.md) | Problem framing, assumptions, frozen scope |
| Product outcome and MVP boundaries | [02_product_brief.md](../docs/02_product_brief.md) | Included/excluded capabilities, success framing |
| Functional behavior and state oracle | [03_lean_prd.md](../docs/03_lean_prd.md) | Rules, gates, permissions, acceptance criteria |
| Screens, interactions and demo flows | [04_ui_flow_wireframe.md](../docs/04_ui_flow_wireframe.md) | UI behavior, visible fields, CTA restrictions |
| Requirement-to-test coverage and freeze | [05_traceability_and_review.md](../docs/05_traceability_and_review.md) | RTM, tests, OD status, readiness and change control |
| Entities, enums and validators | [data-contract-v1.md](../docs/data-contract-v1.md) | Schema, required fields, cross-entity invariants |
| Playbook rules and exception branches | [playbook-v1.md](../docs/playbook-v1.md) | CLN/TEC decision logic and routing gates |

### Source precedence

1. Freeze/governance and traceability.
2. Problem and product scope.
3. PRD rules and state oracle.
4. UI behavior.
5. Data contract.
6. Playbook rules.
7. Code, fixtures and non-canonical supporting documents.

This precedence resolves navigation, not genuine requirement conflicts. A conflict between frozen documents must be logged and handled through change control.

## 3. Frozen MVP at a glance

### Included

- `PB-CLN-01` — Vệ sinh.
- `PB-TEC-01` — Kỹ thuật.
- `IN_PROGRESS`.
- `CHỜ XÁC MINH`.
- `READY_FOR_REVIEW`.
- `EXCEPTION`.
- 12 synthetic tickets: 6 vệ sinh and 6 kỹ thuật.
- 4 main demo flows and 8 regression tickets.
- Team-only routing using simulated, read-only operational data.

### Deferred / Future Scope / Explicit exclusions

- CSKH.
- Gán nhân viên cụ thể.
- Tích hợp hệ thống vận hành thật.
- Lịch trực thật.
- Tối ưu nhân sự thực tế.
- Thanh toán, hóa đơn và thuê ngoài.

Any request in this section requires backlog handling or approved re-baseline; it is not an implementation task for MVP v0.3.

## 4. Canonical business flow

```text
Ticket từ app/form hiện có
→ BPTN xác nhận thông tin hành chính được phép
→ Agent phân loại ticket
→ Agent tra Playbook Registry read-only
→ Nếu kỹ thuật: Agent tra Asset Catalog read-only
→ Xác định vật tư dự kiến và định mức
→ Kiểm tra tồn kho mô phỏng
→ Tra team đang trực và capacity mô phỏng
→ Tạo WorkOrderDraft
→ Chỉ đề xuất route cấp team khi toàn bộ route gate hợp lệ
→ Nhân sự thực hiện checklist
→ Cập nhật vật tư, ghi chú và bằng chứng
→ Agent đối soát hồ sơ
→ IN_PROGRESS / CHỜ XÁC MINH / READY_FOR_REVIEW / EXCEPTION
→ BQL xem xét
```

### Gate summary

| Gate | CLN | TEC | Failure behavior |
|---|---:|---:|---|
| Raw ticket integrity | Required | Required | Không sửa raw content/evidence |
| BPTN administrative confirmation | Required | Required | Không đi tiếp khi chưa xác nhận |
| Playbook lookup | Required | Required | Không invent playbook |
| Asset lookup | N/A | Required | Zero/multiple match → không đoán, không route |
| Material and stock gate | Required | Required | Thiếu/không rõ → draft vẫn tồn tại, route không hợp lệ |
| Duty and capacity lookup | Required | Required | Không trực/unknown/quá capacity → không route |
| Team-only route | Required | Required | Không gán người; `assignee_id=null` |
| Readiness reconciliation | Required | Required | Không READY nếu prior route không hợp lệ |

### No-team and unknown-duty rules

- Team không trực nhưng dữ liệu rõ: `IN_PROGRESS`, reason `NO_AVAILABLE_TEAM`; draft tồn tại; không có route hợp lệ.
- Không xác định được duty data: `CHỜ XÁC MINH`, reason `DUTY_UNKNOWN`; draft tồn tại; không có route hợp lệ.
- Team vượt capacity mô phỏng: `IN_PROGRESS`, reason `TEAM_CAPACITY_EXCEEDED`; draft tồn tại; không có route hợp lệ.
- `route_status`, `queue_status`, `queue_reason` là trường phụ, không phải top-level state.

## 5. Data and authority invariants

- Nội dung phản ánh gốc và bằng chứng gốc của cư dân là bất biến.
- BPTN chỉ được sửa các trường hành chính mà contract cho phép.
- Agent chỉ đề xuất, kiểm tra và đối soát; không tự nghiệm thu, đóng ticket, duyệt vật tư, chỉnh tồn kho hoặc duyệt thanh toán.
- Ảnh không bắt buộc trong MVP.
- Playbook Registry không phải một tính năng CRUD riêng.
- Asset Catalog, Duty Availability và stock fixtures là synthetic, read-only.
- ID mô phỏng dùng tiền tố phù hợp, đặc biệt `SIM-ASSET-*`, `SIM-TEAM-*`, `SIM-DUTY-*`.
- Không dùng dữ liệu nội bộ thật và không trình bày fixture như dữ liệu thật của Vinhomes.

## 6. Task-to-document routing

| Task | Read first | Then verify |
|---|---|---|
| Thay đổi scope hoặc actor | Product Brief + Problem Statement | Traceability/freeze record |
| Thay đổi state, reason hoặc gate | Lean PRD | Data Contract + Playbook + RTM |
| Thay đổi entity/field/validator | Data Contract | PRD + Playbook + affected tests |
| Thay đổi CLN/TEC logic | Playbook | PRD + Data Contract + RTM |
| Thay đổi màn hình/copy/CTA | UI Flow | PRD permissions + Data Contract |
| Tạo/chỉnh fixtures | Data Contract + RTM | 12-ticket/4-demo distribution |
| Viết acceptance/regression test | Traceability | PRD oracle + Data Contract |
| Thay đổi ngoài frozen scope | Traceability change control | Do not implement before approval |

## 7. Actual workspace map

The following paths were verified as present on 28/09/2026.

```text
project-root/
├── brain4agent/
│   ├── memory-distill.txt
│   ├── index.md
│   ├── project-intro.md
│   ├── roadmap.md
│   ├── changelog.md
│   ├── -known-gotchas.md
│   ├── -data-architecture.md
│   └── memory/
│       ├── hot/
│       │   ├── state.json
│       │   └── today.md
│       └── archive/
├── docs/
│   ├── 01_problem_statement.md
│   ├── 02_product_brief.md
│   ├── 03_lean_prd.md
│   ├── 04_ui_flow_wireframe.md
│   ├── 05_traceability_and_review.md
│   ├── data-contract-v1.md
│   ├── playbook-v1.md
│   └── architecture_diagram.md
├── src/
│   ├── main.py
│   ├── config.py
│   ├── agents/
│   │   ├── graph.py
│   │   ├── state.py
│   │   ├── nodes/
│   │   └── tools/
│   ├── api/routes.py
│   ├── models/schemas.py
│   └── services/llm.py
├── tests/
│   ├── conftest.py
│   ├── test_agents/test_graph.py
│   └── test_api/test_routes.py
├── scripts/
├── presentation/
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

### Implementation caution

- Presence of a path does not prove alignment with MaintenanceOps MVP v0.3.
- `src/`, `tests/`, root architecture files and supporting diagrams require a separate implementation audit before reuse.
- Do not infer framework, provider, database, deployment status or test coverage from historical memory.
- Do not read secrets from `.env`; use `.env.example` only when configuration work is explicitly in scope.
- Ignore generated caches such as `__pycache__/` and `.pytest_cache/`.

## 8. Active memory roles

| File | Role | Current migration status |
|---|---|---|
| `memory-distill.txt` | Frozen kernel | Rebased to MaintenanceOps v0.3 |
| `memory/hot/state.json` | Machine-readable snapshot | Rebased to MaintenanceOps v0.3 |
| `index.md` | Canonical router and verified path map | Rebased to MaintenanceOps v0.3 |
| `project-intro.md` | Human-readable product overview | Rebased to MaintenanceOps v0.3 |
| `roadmap.md` | Build sequence and controlled backlog | Rebased to MaintenanceOps v0.3 |
| `-data-architecture.md` | Data lifecycle and boundaries | Rebased to MaintenanceOps v0.3 |
| `memory/hot/today.md` | Current work log | Pending rotation/rebase |
| `changelog.md` | Release history with legacy boundary | Pending rebase |
| `-known-gotchas.md` | Active implementation cautions | Pending split/rebase |
| `memory/archive/*` | Historical record only | Pending legacy banner/isolation |

Historical records must not override this router or any frozen document.

## 9. Change protocol

1. Classify the request as frozen-scope implementation, defect correction, documentation alignment or scope change.
2. Read the routed canonical documents.
3. Inspect actual code/tests without assuming they implement the contract.
4. Preserve unrelated worktree changes and edit only in-scope files.
5. Add or update deterministic tests for every changed rule or validator.
6. Re-run consistency checks for playbooks, states, route rules, dataset counts and forbidden assignment behavior.
7. Update active memory only with verified current state.
8. If scope changes, stop until change control approves a new baseline.

## 10. Definition of done for an aligned implementation

- Exactly two active playbooks and four top-level states.
- Duty lookup applies to CLN and TEC; asset lookup is mandatory only for TEC.
- Material stock gate runs before route.
- WorkOrderDraft may exist without a valid route.
- No valid route when asset, stock, duty or capacity gate fails.
- No `READY_FOR_REVIEW` without a valid prior route and all frozen readiness gates.
- Team-only routing; no concrete employee assignment.
- Dataset remains 12 synthetic tickets with 4 demo flows and 8 regression cases.
- All affected validators/tests pass and active links resolve.
- No contradiction remains among the seven frozen documents, active memory and the verified implementation.
