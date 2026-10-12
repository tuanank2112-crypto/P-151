"""Shared actors, texts and step helpers for the MaintenanceOps tests."""

from datetime import datetime, timedelta, timezone

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import ChecklistStatus, EvidenceType, ReadabilityStatus

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

CLEANING = "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh."
LIGHTING = "Đèn hành lang tầng 3 tòa S1 không sáng."


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
    photo: bool = True,
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
    if photo:
        engine.add_evidence(
            ticket_id,
            actor,
            requirement_id=None,
            evidence_type=EvidenceType.SIMULATED_IMAGE,
            content_or_metadata="after.jpg",
            readability_status=ReadabilityStatus.READABLE,
        )


def finish(engine: MaintenanceEngine, ticket_id: str):
    """Do the work and report completion (step 10) on an accepted ticket."""
    do_work(engine, ticket_id)
    return engine.report_complete(ticket_id, dept_of(engine, ticket_id))


def to_ready(engine: MaintenanceEngine, ticket_id: str):
    engine.accept(ticket_id, dept_of(engine, ticket_id))
    return finish(engine, ticket_id)


# ---------------------------------------------------------------------- plan 06 WP6 (TESTING §2): the Agent in the engine


def agent_engine(clock, client) -> MaintenanceEngine:
    """An engine whose Agent asks `client` (a fake from `agent/client.py`), on `clock`, with no fixture ticket."""
    from src.maintenance.agent.agent import ReasoningAgent
    from src.maintenance.catalog import load_catalog, load_lexicon

    agent = ReasoningAgent(client, catalog=load_catalog(), lexicon=load_lexicon(), model_label="fake", clock=clock)
    engine = MaintenanceEngine(clock=clock, agent=agent)
    engine.reset(with_fixtures=False)
    return engine


def decision(**overrides) -> str:
    """JSON of the prompt example (01 §3.1) with dotted-path overrides, e.g. decision(**{"jobs.1.quote": "..."})."""
    import copy
    import json

    from src.maintenance.agent import prompt

    doc = copy.deepcopy(prompt.EXAMPLE)
    for path, value in overrides.items():
        node = doc
        *head, last = path.split(".")
        for part in head:
            node = node[int(part)] if isinstance(node, list) else node[part]
        if isinstance(node, list):
            node[int(last)] = value
        else:
            node[last] = value
    return json.dumps(doc, ensure_ascii=False)
