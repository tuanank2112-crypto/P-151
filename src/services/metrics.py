"""The three MVP metrics: time to assignment, first-pass evidence rate, escalations."""

from collections import Counter
from statistics import median

from pydantic import BaseModel
from sqlmodel import Session, select

from src.models.entities import Escalation, EscalationStatus, Ticket, WorkOrder


class Metrics(BaseModel):
    tickets_total: int
    tickets_by_status: dict[str, int]
    median_minutes_to_assign: float | None
    assigned_work_orders: int
    first_pass_rate: float | None
    checked_work_orders: int
    escalations_total: int
    escalations_open: int
    escalations_by_reason: dict[str, int]


def compute_metrics(session: Session) -> Metrics:
    tickets = {t.id: t for t in session.exec(select(Ticket)).all()}
    work_orders = session.exec(select(WorkOrder)).all()
    escalations = session.exec(select(Escalation)).all()

    # Ticket created -> first work order approved
    first_approval: dict[int, float] = {}
    for wo in work_orders:
        if wo.approved_at is None:
            continue
        minutes = (wo.approved_at - tickets[wo.ticket_id].created_at).total_seconds() / 60
        first_approval[wo.ticket_id] = min(minutes, first_approval.get(wo.ticket_id, minutes))

    checked = [wo for wo in work_orders if wo.first_check_passed is not None]
    passed = sum(1 for wo in checked if wo.first_check_passed)

    return Metrics(
        tickets_total=len(tickets),
        tickets_by_status=dict(Counter(t.status for t in tickets.values())),
        median_minutes_to_assign=round(median(first_approval.values()), 1) if first_approval else None,
        assigned_work_orders=len(first_approval),
        first_pass_rate=round(passed / len(checked), 3) if checked else None,
        checked_work_orders=len(checked),
        escalations_total=len(escalations),
        escalations_open=sum(1 for e in escalations if e.status == EscalationStatus.OPEN),
        escalations_by_reason=dict(Counter(e.reason for e in escalations)),
    )
