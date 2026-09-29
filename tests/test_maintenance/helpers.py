"""Shared actors, texts and step helpers for the MaintenanceOps tests."""

from datetime import datetime, timedelta, timezone

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import ChecklistStatus, ReadabilityStatus

TZ = timezone(timedelta(hours=7))
MONDAY_9AM = datetime(2026, 9, 28, 9, tzinfo=TZ)  # inside business hours and both departments' shifts

RESIDENT = "SIM-ACTOR-RESIDENT-01"
OTHER_RESIDENT = "SIM-ACTOR-RESIDENT-02"
BPTN = "SIM-ACTOR-BPTN-01"
CLN = "SIM-ACTOR-DEPT-CLN-01"
TEC = "SIM-ACTOR-DEPT-TEC-01"
WAREHOUSE = "SIM-ACTOR-WAREHOUSE-01"
BQL = "SIM-ACTOR-BQL-01"
AGENT = "SIM-ACTOR-AGENT"
SYSTEM = "SIM-ACTOR-SYSTEM"

CLEANING = "Hành lang tầng 3 tòa SIM-A nhiều rác, cần vệ sinh."
LIGHTING = "Đèn hành lang tầng 3 tòa SIM-A không sáng."


class Clock:
    """Test clock: the engine reads it on every operation; tests move it forward."""

    def __init__(self, now: datetime):
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta) -> datetime:
        self.now += timedelta(**delta)
        return self.now


def report(engine: MaintenanceEngine, text: str, resident: str = RESIDENT) -> str:
    return engine.receive(text, resident_id=resident).ticket.ticket_id


def dept_of(engine: MaintenanceEngine, ticket_id: str) -> str:
    return {"DEPT_CLEANING": CLN, "DEPT_TECHNICAL": TEC}[engine.get(ticket_id).ticket.department_id]


def do_work(
    engine: MaintenanceEngine,
    ticket_id: str,
    *,
    note: bool = True,
    variance_reason: str | None = None,
    issued_delta: float = 0,
):
    """Everything the department does between accepting and 'báo hoàn thành'."""
    actor = dept_of(engine, ticket_id)
    case = engine.get(ticket_id)
    for item in case.checklist_items:
        engine.update_checklist(ticket_id, actor, item.template_item_id, status=ChecklistStatus.COMPLETED)
    for line in case.material_lines:
        qty = line.planned_qty + issued_delta
        engine.record_material(
            ticket_id, actor, line.item_code, issued_qty=qty, used_qty=qty, variance_reason=variance_reason
        )
    if note:
        requirement = case.draft.evidence_requirements[0]
        engine.add_evidence(
            ticket_id,
            actor,
            requirement_id=requirement.requirement_id,
            evidence_type=requirement.allowed_evidence_types[0],
            content_or_metadata="Đã xử lý (mô phỏng)",
            readability_status=ReadabilityStatus.NOT_APPLICABLE,
        )


def finish(engine: MaintenanceEngine, ticket_id: str):
    """Do the work and report completion (step 10) on an accepted ticket."""
    do_work(engine, ticket_id)
    return engine.report_complete(ticket_id, dept_of(engine, ticket_id))


def to_ready(engine: MaintenanceEngine, ticket_id: str):
    engine.accept(ticket_id, dept_of(engine, ticket_id))
    return finish(engine, ticket_id)
