"""CR-BPTN-02 §2.7: v0.4 case snapshot → v0.5 status."""

import pytest

from src.maintenance.catalog import load_catalog
from src.maintenance.migration import plan_v04_migration


def v04(state, rule_id, *, playbook="PB-TEC-01", queue_reason=None, routed=False, checklist=(), review=None):
    return {
        "ticket": {
            "current_state": state,
            "state_decision": {"rule_id": rule_id, "queue_reason": queue_reason},
            "administrative_normalization": {"review_required_reason": review},
        },
        "proposal": {"playbook_id": playbook} if playbook else None,
        "draft": {"route_status": "ROUTED" if routed else "NOT_ROUTED", "queue_reason": queue_reason},
        "checklist_items": [{"status": s} for s in checklist],
        "material_lines": [],
        "evidence": [],
    }


@pytest.mark.parametrize(
    ("snapshot", "status", "reason"),
    [
        (v04("IN_PROGRESS", "PB-COM-R-CHK-01", routed=True, checklist=("PENDING",)), "ROUTED", None),
        (v04("IN_PROGRESS", "PB-COM-R-CHK-01", routed=True, checklist=("COMPLETED", "PENDING")), "IN_PROGRESS", None),
        (v04("IN_PROGRESS", "PB-COM-R-STK-01", queue_reason="MATERIAL_SHORTAGE"), "ON_HOLD", "WAITING_MATERIAL"),
        (v04("IN_PROGRESS", "PB-COM-R-DTY-01", queue_reason="NO_AVAILABLE_TEAM"), "ROUTED", "OUT_OF_HOURS"),
        (v04("IN_PROGRESS", "PB-COM-R-DTY-02", queue_reason="TEAM_CAPACITY_EXCEEDED"), "ROUTED", "OUT_OF_HOURS"),
        (v04("CHỜ XÁC MINH", "PB-COM-R-ING-01", playbook=None), "NEED_INFO", "MISSING_INFO"),
        (v04("CHỜ XÁC MINH", "PB-COM-R-CFM-01", review="LOCATION_MISSING"), "NEED_INFO", "MISSING_INFO"),
        (v04("CHỜ XÁC MINH", "PB-COM-R-CLS-01", playbook=None), "VERIFYING", "CATEGORY_UNCLEAR"),
        (v04("CHỜ XÁC MINH", "PB-COM-R-AST-01"), "VERIFYING", "ASSET_UNCLEAR"),
        (v04("CHỜ XÁC MINH", "PB-COM-R-DTY-03"), "VERIFYING", "PENDING_REVIEW"),
        (v04("EXCEPTION", "PB-TEC-R-EX-01"), "VERIFYING", "PENDING_REVIEW"),
        (v04("READY_FOR_REVIEW", "PB-COM-R-READY-01", routed=True), "READY_FOR_REVIEW", None),
    ],
)
def test_v04_to_v05(snapshot, status, reason):
    plan = plan_v04_migration(snapshot, load_catalog())
    assert (plan.status, plan.reason_code) == (status, reason)


def test_exception_goes_to_bql_by_hand_and_team_becomes_department():
    plan = plan_v04_migration(v04("EXCEPTION", "PB-CLN-R-EX-01", playbook="PB-CLN-01"), load_catalog())
    assert plan.internal_note == "migrated from EXCEPTION" and plan.owner_role == "BQL"
    assert plan.proposed_department_id == "DEPT_CLEANING" and plan.department_id is None  # not handed over


def test_routed_v04_ticket_keeps_its_department():
    plan = plan_v04_migration(v04("IN_PROGRESS", "PB-COM-R-CHK-01", routed=True), load_catalog())
    assert plan.status == "ROUTED" and plan.department_id == "DEPT_TECHNICAL"


def test_out_of_hours_recomputes_its_retry_time():
    plan = plan_v04_migration(v04("IN_PROGRESS", "PB-COM-R-DTY-01", queue_reason="NO_AVAILABLE_TEAM"), load_catalog())
    assert plan.recompute_schedule


def test_unknown_state_is_rejected():
    with pytest.raises(ValueError):
        plan_v04_migration(v04("DONE", "x"), load_catalog())
