"""Replay the scripted fixture steps and compare with the expected oracle.

A routed fixture with an `execution` block is accepted by its department, worked on and reported complete (step 10).
Nothing here closes a ticket: only BQL does that.
"""

from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import ChecklistStatus, Department, TicketStatus
from src.maintenance.models import Case

DEPARTMENT_ACTORS = {
    Department.DEPT_CLEANING: "SIM-ACTOR-DEPT-CLN-01",
    Department.DEPT_TECHNICAL: "SIM-ACTOR-DEPT-TEC-01",
}


def run_fixture(engine: MaintenanceEngine, ticket_id: str) -> Case:
    """Run every scripted department step for one fixture ticket, one hour after it was reported."""
    fixture = engine.dataset.get(ticket_id)
    if fixture is None:
        raise KeyError(ticket_id)
    case = engine.get(ticket_id)
    ticket = case.ticket
    if not fixture.execution or ticket.status != TicketStatus.ROUTED or ticket.blocker is not None:
        return case
    actor = DEPARTMENT_ACTORS[ticket.department_id]
    with engine.at(datetime.fromisoformat(fixture.raw.created_at) + timedelta(hours=1)):
        engine.accept(ticket_id, actor)
        for item_id in fixture.execution.checklist:
            engine.update_checklist(ticket_id, actor, item_id, status=ChecklistStatus.COMPLETED)
        for material in fixture.execution.materials:
            engine.record_material(
                ticket_id,
                actor,
                material.item_code,
                issued_qty=material.issued_qty,
                used_qty=material.used_qty,
                variance_reason=material.variance_reason,
            )
        for evidence in fixture.execution.evidence:
            engine.add_evidence(
                ticket_id,
                actor,
                requirement_id=evidence.requirement_id,
                evidence_type=evidence.evidence_type,
                content_or_metadata=evidence.content_or_metadata,
                readability_status=evidence.readability_status,
            )
        return engine.report_complete(ticket_id, actor)


def observe(engine: MaintenanceEngine, case: Case) -> dict[str, Any]:
    """The same keys as the fixture `expected` block, read from the case."""
    ticket, proposal, draft = case.ticket, case.proposal, case.draft
    readiness = draft.readiness_evaluation if draft else None
    return {
        "status": ticket.status.value,
        "reason_code": ticket.blocker.code.value if ticket.blocker else None,
        "playbook_id": proposal.playbook_id.value if proposal else None,
        "proposed_department_id": ticket.proposed_department_id.value if ticket.proposed_department_id else None,
        "department_id": ticket.department_id.value if ticket.department_id else None,
        "review_status": ticket.review_status.value if ticket.review_status else None,
        "asset_resolution": ticket.asset_resolution.value if ticket.asset_resolution else None,
        "draft_exists": draft is not None,
        "location": draft.location if draft else engine.effective_location(case),
        "asset_lookup_status": proposal.asset_lookup_status.value if proposal else None,
        "asset_id": proposal.asset_id if proposal else None,
        "material_stock_status": draft.material_stock_status.value if draft else None,
        "flags": tuple(f.value for f in ticket.flags),
        "warnings": tuple(w.warning_type for w in draft.non_blocking_warnings) if draft else (),
        "failing_items": tuple(readiness.failing_items) if readiness else (),
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
        observed = observe(engine, case)
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
