"""Fixture dataset integrity: 12 synthetic tickets, 6/6 split, 4 demo flows + 8 regression, SIM- IDs only."""

from src.maintenance.catalog import load_catalog, load_dataset
from src.maintenance.demo import evaluate
from src.maintenance.engine import MaintenanceEngine


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
    assert all(a.asset_type == "LIGHTING" for a in catalog.assets)
    assert all(
        d.duty_id.startswith("SIM-DUTY-") and d.team_id.startswith("SIM-TEAM-") for d in catalog.duty_availability
    )
    assert all(d.assignment_scope == "TEAM_ONLY" for d in catalog.duty_availability)
    assert all(m.item_code.startswith("SIM-") and m.synthetic for m in catalog.materials)
    assert all(t.not_real_sop_label for t in catalog.checklist_templates)
    # No evidence requirement may require an image (VAL-EVD-IMG-001)
    assert all("SIMULATED_IMAGE" not in r.allowed_evidence_types for r in catalog.evidence_requirements)


def test_all_twelve_tickets_match_expected_outcome():
    report = evaluate(MaintenanceEngine())
    failures = {r.ticket_id: r.mismatches for r in report.results if not r.passed}
    assert failures == {}
    assert report.passed == 12 and report.demo_flows_passed == 4


def test_quality_gates_over_the_dataset():
    """PRD §9.3: duty lookup 12/12 reachable, asset only for TEC, no individual assignment, no READY without route."""
    engine = MaintenanceEngine()
    report = evaluate(engine)
    assert report.passed == 12
    for case in engine.cases.values():
        draft = case.draft
        if draft is None:
            continue
        assert draft.assignee_id is None
        assert draft.assignment_scope == "TEAM_ONLY" and draft.assignment_mode == "SIMULATED_TEAM_ROUTE"
        if draft.routing_team_id:
            assert draft.routing_team_id.startswith("SIM-TEAM-")
        if case.ticket.current_state == "READY_FOR_REVIEW":
            assert draft.route_status == "ROUTED"
        if draft.playbook_id == "PB-CLN-01":
            assert case.proposal.asset_lookup_status == "NOT_APPLICABLE"
        else:
            assert case.proposal.asset_lookup_status != "NOT_APPLICABLE"
