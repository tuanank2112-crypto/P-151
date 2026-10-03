"""Fixture dataset integrity: 12 synthetic tickets, 6/6 split, 4 demo flows + 8 regression, SIM- IDs only."""

from pathlib import Path

from src.maintenance.catalog import load_catalog, load_dataset
from src.maintenance.demo import evaluate
from src.maintenance.engine import MaintenanceEngine

# seed/maintenance_v1 stays the CR-02 baseline (v1.2); the CR-03 engine is judged on the CR-03 target oracle.
CR03_DIR = Path("seed/maintenance_cr03")


def test_dataset_shape():
    tickets = load_dataset().tickets
    assert len(tickets) == 12
    assert sum(t.raw.ticket_id.startswith("SIM-TKT-CLN-") for t in tickets) == 6
    assert sum(t.raw.ticket_id.startswith("SIM-TKT-TEC-") for t in tickets) == 6
    assert sorted(t.flow for t in tickets if t.is_demo) == ["DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4"]
    assert sum(not t.is_demo for t in tickets) == 8
    assert len({t.raw.ticket_id for t in tickets}) == 12


def test_every_catalog_record_is_synthetic():
    catalog = load_catalog()
    assert catalog.synthetic and load_dataset().synthetic
    assert all(a.asset_id.startswith("SIM-ASSET-") and a.synthetic and a.read_only for a in catalog.assets)
    assert all(m.item_code.startswith("SIM-") and m.synthetic for m in catalog.materials)
    assert all(t.not_real_sop_label for t in catalog.checklist_templates)
    # No evidence requirement may require an image (VAL-EVD-IMG-001)
    assert all("SIMULATED_IMAGE" not in r.allowed_evidence_types for r in catalog.evidence_requirements)


def test_department_table_is_config_not_code():
    catalog = load_catalog()
    assert {p.value: d.value for p, d in catalog.playbook_departments.items()} == {
        "PB-CLN-01": "DEPT_CLEANING",
        "PB-TEC-01": "DEPT_TECHNICAL",
    }
    assert {d.department_id for d in catalog.departments} == set(catalog.playbook_departments.values())
    department_actors = [a for a in catalog.actors if a.actor_role == "DEPARTMENT"]
    assert all(a.department_id for a in department_actors)


def test_all_twelve_tickets_match_expected_outcome():
    report = evaluate(MaintenanceEngine(dataset=load_dataset(CR03_DIR)))
    failures = {r.ticket_id: r.mismatches for r in report.results if not r.passed}
    assert failures == {}
    assert report.passed == 12 and report.demo_flows_passed == 4


def test_quality_gates_over_the_dataset():
    """No person is ever picked, no ticket is closed without BQL, the safety states are gone."""
    engine = MaintenanceEngine()
    evaluate(engine)
    for case in engine.cases.values():
        assert case.ticket.assignee_id is None
        assert case.ticket.status not in ("CLOSED", "CANCELLED", "EXCEPTION")
        if case.draft:
            assert case.draft.assignee_id is None and case.draft.department_id == case.ticket.department_id
            if case.draft.playbook_id == "PB-CLN-01":
                assert case.proposal.asset_lookup_status == "NOT_APPLICABLE"
