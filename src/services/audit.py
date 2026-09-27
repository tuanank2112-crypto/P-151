"""Audit log and ticket state transitions. Every status change goes through here."""

from typing import Any

from sqlmodel import Session

from src.models.entities import (
    AuditLog,
    Escalation,
    EscalationReason,
    Ticket,
    TicketStatus,
    WorkOrder,
)
from src.services import clock


def log(
    session: Session,
    ticket: Ticket,
    action: str,
    actor: str,
    *,
    work_order: WorkOrder | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
    detail: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        ticket_id=ticket.id,
        work_order_id=work_order.id if work_order else None,
        actor=actor,
        action=action,
        from_status=from_status,
        to_status=to_status,
        detail=detail or {},
    )
    session.add(entry)
    return entry


def change_status(
    session: Session,
    ticket: Ticket,
    new_status: TicketStatus,
    actor: str,
    action: str,
    *,
    work_order: WorkOrder | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    old_status = ticket.status
    ticket.status = new_status
    ticket.updated_at = clock.now()
    session.add(ticket)
    log(
        session,
        ticket,
        action,
        actor,
        work_order=work_order,
        from_status=old_status,
        to_status=new_status,
        detail=detail,
    )


def escalate(
    session: Session,
    ticket: Ticket,
    reason: EscalationReason,
    detail: str,
    actor: str,
    *,
    work_order: WorkOrder | None = None,
) -> Escalation:
    """Open an escalation for BQL and move the ticket to ESCALATED."""
    escalation = Escalation(
        ticket_id=ticket.id,
        work_order_id=work_order.id if work_order else None,
        reason=reason,
        detail=detail,
        ticket_status_before=ticket.status,
    )
    session.add(escalation)
    session.flush()
    change_status(
        session,
        ticket,
        TicketStatus.ESCALATED,
        actor,
        "escalated",
        work_order=work_order,
        detail={"escalation_id": escalation.id, "reason": reason, "detail": detail},
    )
    return escalation
