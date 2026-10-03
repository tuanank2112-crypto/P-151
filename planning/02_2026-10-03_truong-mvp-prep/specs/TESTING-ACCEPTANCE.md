# WP5 — Target fixture and acceptance contract

WP5 writes seed/maintenance_cr03/tickets.yaml (full copy of 12 baseline fixtures, change ONLY expected and purpose for CLN004/TEC005), tests/test_maintenance/test_cr03_targets.py and this SPEC. Wait WP4 public API/file before dependent measurement. CẤM sửa seed/maintenance_v1, engine/models/catalog or baseline expectations/tests; baseline needed until Như Ý runtime integration. Both target rows VERIFYING / EMERGENCY_PENDING_BQL, draft_exists false, department_id null; remove incompatible asset/lookups/material ready expectations, preserve raw bytes/string and other ten expected values. Other classification expected follow classification-before-safety flow; risk validated separately assess_safety on raw. Use current Expected schema (risk absent) no unsupported fields.
Tests assert exactly12, ten unchanged expected, raw identical12, two target risk EMERGENCY and appropriate barrier fields. Explicitly target dataset not selected at startup; do not claim existing engine obeys emergency targets. Report readiness runtime BLOCKED_PENDING_INTEGRATION; no hiding by skip/xfail. Record checks actual local; group/runtime/online remain unchecked. Include fixture rows mapping contract, errors/caller, integration gate command+expected, red proof on deliberately damaged copy without touching production files.

## 1. Source and exact loader
Source `seed/maintenance_v1/tickets.yaml`: `maintenanceops-sim-v1.2`. Target `seed/maintenance_cr03/tickets.yaml`: `maintenanceops-sim-cr03-p0-v1`, synthetic=true.
Exact loader: `load_dataset(Path('seed/maintenance_cr03')) -> TicketDataset`; it reads only tickets.yaml. Existing frozen `Expected` accepts reason_code as string. CẤM risk_level in Expected, baseline/runtime edits, startup selection change or rewriting gold from old engine output.
BẮT BUỘC keep 12 ordered unique IDs, all raw mappings and identical UTF-8 description strings; flow/materials/execution unchanged. The other ten full rows remain equal to baseline.

## 2. Exact mapping and forbidden downstream claims
Both emergencies: status=VERIFYING, reason_code=EMERGENCY_PENDING_BQL, department_id=null, draft_exists=false, review_status=NOT_REQUIRED. Delete asset_resolution, asset_lookup_status, asset_id, material_stock_status expectations because safety stops before these stages. CẤM invent downstream null/ready observations. Purpose states CR03 P0/EMERGENCY/BQL handling.
- CLN-004: retain playbook_id=PB-CLN-01, proposed_department_id=DEPT_CLEANING, location="Tòa SIM-A / Tầng B1 / Hầm xe". Independent risk EMERGENCY with PRESENT S-14.
- TEC-005: retain playbook_id=PB-TEC-01, proposed_department_id=DEPT_TECHNICAL; add no location assertion (baseline omitted it). Independent risk EMERGENCY with PRESENT S-01/S-02.
- Ten unchanged rows: CLN001 READY_FOR_REVIEW; CLN002 ROUTED/OUT_OF_HOURS; CLN003 NEED_INFO/MISSING_INFO; CLN005 ROUTED; CLN006 IN_PROGRESS; TEC001 READY_FOR_REVIEW; TEC002 VERIFYING/ASSET_UNCLEAR; TEC003 ON_HOLD/WAITING_MATERIAL; TEC004 ROUTED; TEC006 ROUTED. All remaining expected fields equal baseline.
Gold comes from CR-BPTN-03 §6/14 and classification-before-safety contract. Source raw/history is immutable; audit quotes and retained context do not license modifying source data.

## 3. Errors and caller behavior
- Missing/malformed/schema-invalid fixture: propagate FileNotFoundError/YAML error/Pydantic ValidationError; caller refuses dataset use, CẤM silently fallback to pass acceptance.
- Duplicate/missing IDs, altered raw/old oracle or unsafe barrier: guard raises AssertionError; mark local gate red; repair only authorized scope.
- Safety returns UNCLEAR/NONE for either raw: test fails; send measured evidence to safety owner; CẤM weakening gold or rewriting raw.
- Safety ValueError: stop mutation and correct input under SPEC-P04 contract.
- Runtime mismatches: report BLOCKED_PENDING_INTEGRATION, schedule runtime work after approval; CẤM skip/xfail or interpreting fixture green as runtime readiness.

## 4. Measurements and falsification
Local command: `python -m pytest tests/test_maintenance/test_cr03_targets.py -q -p no:cacheprovider`; 9 cases, 0 fail/skip required. Ruff check + format --check target test must exit0. Root reviewer measures full regression.
Tests check source equality, exact target mapping, loader/default directory and independent signals. Five damaged copies (raw, duplicate ID, old oracle, draft, downstream assertion) must be rejected without touching disk fixtures.
Separate falsification command (in-memory only) must exit1/AssertionError:
```powershell
python -c "from copy import deepcopy; from tests.test_maintenance.test_cr03_targets import read_rows, assert_target_integrity, TARGET_DIR, FIXTURE_DIR; t=deepcopy(read_rows(TARGET_DIR)); t['tickets'][3]['expected']['draft_exists']=True; assert_target_integrity(t, read_rows(FIXTURE_DIR))"
```
Evidence under evidence/wp5/: initial-red.txt (2 failed/7 passed before repair, includes CLN004 S14 defect), damaged-copy-red.txt + exit record (unsafe draft rejected), pytest.txt + exit record (final result), ruff.txt + exit, format.txt + exit. CẤM manual edits to output evidence. Actual final counts belong to R05.

## 5. Environment-specific gates
- Local target: measured pytest/Ruff result in R05; 0fail/0skip required.
- Baseline startup: FIXTURE_DIR/load_dataset() remain maintenance_v1, no engine/config mutation here; full regression root reviewer responsibility.
- Group: ✅ APPROVED cho phạm vi MVP và D-01–D-07 theo thông báo người dùng; approver=Lê Thị Châm Anh (leader), approved_date=2026-10-02, approved_at=null (giờ chưa cung cấp), recorded_date=2026-10-03. Commit a5e2705/PR #6 là bản tham chiếu được xác nhận trong phiên ghi nhận. Không chứng nhận runtime/online.
- Runtime: ⬜ BLOCKED_PENDING_INTEGRATION. Engine does not call safety or implement emergency blocker. No test claims old runtime meets new target.
- Online/deploy: ⬜ no remote/production action; local evidence cannot close online gate.
Planned integration command after runtime implementation, isolated in-memory engine only:
```powershell
python -c "from pathlib import Path; from src.maintenance.catalog import load_dataset; from src.maintenance.engine import MaintenanceEngine; from src.maintenance.demo import evaluate; r=evaluate(MaintenanceEngine(dataset=load_dataset(Path('seed/maintenance_cr03')))); print(r.model_dump_json()); assert r.total == 12 and r.passed == 12 and r.demo_flows_passed == 4"
```
Required exit0, total12/pass12/demo4 plus emergency target barriers. PLANNED, not executed here; current engine is expected to fail at least the two emergency targets. Later runtime tests must separately cover resume/job blocking, new additions+persisted structured context, no automatic downgrade and BQL action/audit. These gates remain open.
