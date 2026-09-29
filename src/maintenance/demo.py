"""Replay the scripted fixture steps (execution updates) and compare with the expected oracle.

No fixture ticket needs BPTN review under CR-BPTN-01, so there is no scripted BPTN step.
"""

from typing import Any

from pydantic import BaseModel

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import ChecklistStatus, RouteStatus
from src.maintenance.models import Case

EXEC_ID = "SIM-ACTOR-EXEC-01"


def run_fixture(engine: MaintenanceEngine, ticket_id: str) -> Case:
    """Run every scripted human step for one fixture ticket. Execution only happens once the draft is routed."""
    fixture = engine.dataset.get(ticket_id)
    if fixture is None:
        raise KeyError(ticket_id)
    case = engine.get(ticket_id)
    routed = case.draft is not None and case.draft.route_status == RouteStatus.ROUTED
    if fixture.execution and routed:
        for item_id in fixture.execution.checklist:
            case = engine.update_checklist(ticket_id, EXEC_ID, item_id, status=ChecklistStatus.COMPLETED)
        for material in fixture.execution.materials:
            case = engine.record_material(
                ticket_id,
                EXEC_ID,
                material.item_code,
                issued_qty=material.issued_qty,
                used_qty=material.used_qty,
                variance_reason=material.variance_reason,
            )
        for evidence in fixture.execution.evidence:
            case = engine.add_evidence(
                ticket_id,
                EXEC_ID,
                requirement_id=evidence.requirement_id,
                evidence_type=evidence.evidence_type,
                content_or_metadata=evidence.content_or_metadata,
                readability_status=evidence.readability_status,
            )
    return case


def observe(case: Case) -> dict[str, Any]:
    """The same keys as the fixture `expected` block, read from the case."""
    proposal, draft = case.proposal, case.draft
    admin = case.ticket.administrative_normalization
    open_exception = next((e for e in case.exceptions if e.status == "OPEN"), None)
    return {
        "playbook_id": proposal.playbook_id.value if proposal else None,
        "draft_exists": draft is not None,
        "state": case.ticket.current_state.value,
        "rule_id": case.ticket.state_decision.rule_id,
        "location_normalized": admin.location_normalized if admin else None,
        "confirmation_status": admin.confirmation_status.value if admin else None,
        "asset_lookup_status": proposal.asset_lookup_status.value if draft else None,
        "asset_id": draft.asset_id if draft else None,
        "duty_lookup_status": draft.duty_status.value if draft else None,
        "material_stock_status": draft.material_stock_status.value if draft else None,
        "route_status": draft.route_status.value if draft else None,
        "routing_team_id": draft.routing_team_id if draft else None,
        "queue_reason": draft.queue_reason.value if draft and draft.queue_reason else None,
        "exception_type": open_exception.exception_type.value if open_exception else None,
        "warnings": tuple(w.warning_type for w in draft.non_blocking_warnings) if draft else (),
    }


class TicketResult(BaseModel):
    ticket_id: str
    flow: str
    purpose: str
    passed: bool
    mismatches: dict[str, dict[str, Any]]
    observed: dict[str, Any]


class EvaluationReport(BaseModel):
    run_id: str
    dataset_version: str
    total: int
    passed: int
    demo_flows_passed: int
    results: list[TicketResult]
    disclaimer: str = "Acceptance criteria nội bộ trên dữ liệu mô phỏng, không phải KPI vận hành thực tế."


def evaluate(engine: MaintenanceEngine) -> EvaluationReport:
    """Reset, replay all 12 tickets and compare every expected field that the fixture specifies."""
    run_id = engine.reset()
    results = []
    for fixture in engine.dataset.tickets:
        case = run_fixture(engine, fixture.raw.ticket_id)
        observed = observe(case)
        expected = fixture.expected.model_dump(exclude_unset=True)
        mismatches = {
            key: {"expected": value, "observed": observed[key]}
            for key, value in expected.items()
            if observed[key] != value
        }
        results.append(
            TicketResult(
                ticket_id=fixture.raw.ticket_id,
                flow=fixture.flow,
                purpose=fixture.purpose,
                passed=not mismatches,
                mismatches=mismatches,
                observed=observed,
            )
        )
    return EvaluationReport(
        run_id=run_id,
        dataset_version=engine.dataset.dataset_version,
        total=len(results),
        passed=sum(r.passed for r in results),
        demo_flows_passed=sum(r.passed for r in results if r.flow.startswith("DEMO")),
        results=results,
    )
