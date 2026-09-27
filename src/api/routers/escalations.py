from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from src.api.deps import BQL, SessionDep
from src.api.routers.common import get_ticket, ticket_detail
from src.models.entities import (
    ACTIVE_WO_STATUSES,
    Escalation,
    EscalationReason,
    EscalationStatus,
    Location,
    Playbook,
    Ticket,
    TicketStatus,
    WorkOrder,
    WorkOrderStatus,
)
from src.models.schemas import ResolveRequest, TicketDetail
from src.services import audit, clock
from src.services.triage import apply_location

router = APIRouter(prefix="/escalations", tags=["escalations"])


@router.get("", response_model=list[Escalation])
def list_escalations(
    session: SessionDep, _role: BQL, status: Literal["OPEN", "RESOLVED", "ALL"] = "OPEN"
) -> list[Escalation]:
    """Hàng đợi ngoại lệ BQL cần xử lý (mặc định chỉ các ca đang mở)."""
    query = select(Escalation).order_by(Escalation.id)
    if status != "ALL":
        query = query.where(Escalation.status == status)
    return list(session.exec(query).all())


@router.post("/{escalation_id}/resolve", response_model=TicketDetail)
def resolve_escalation(escalation_id: int, body: ResolveRequest, session: SessionDep, _role: BQL) -> TicketDetail:
    """BQL xử lý ngoại lệ: tiếp tục luồng (resume), sửa thông tin rồi phân loại lại (retriage), hoặc đóng."""
    escalation = session.get(Escalation, escalation_id)
    if escalation is None:
        raise HTTPException(status_code=404, detail=f"Không có escalation {escalation_id}")
    if escalation.status != EscalationStatus.OPEN:
        raise HTTPException(status_code=409, detail="Escalation đã được xử lý")
    ticket = get_ticket(session, escalation.ticket_id)
    now = clock.now()
    active_work_orders = session.exec(
        select(WorkOrder).where(WorkOrder.ticket_id == ticket.id, WorkOrder.status.in_(ACTIVE_WO_STATUSES))
    ).all()

    if body.action == "resume":
        target = escalation.ticket_status_before
        if target == TicketStatus.NEW:
            raise HTTPException(status_code=422, detail="Ticket chưa qua phân loại; dùng action 'retriage'")
        # Give the technician a fresh deadline, or the overdue job escalates again immediately
        if escalation.work_order_id and escalation.reason in (
            EscalationReason.OVERDUE_ACCEPT,
            EscalationReason.OVERDUE_RESOLVE,
        ):
            work_order = session.get(WorkOrder, escalation.work_order_id)
            playbook = session.get(Playbook, work_order.category)
            if escalation.reason == EscalationReason.OVERDUE_ACCEPT:
                work_order.accept_due_at = now + timedelta(minutes=playbook.sla_accept_minutes)
            else:
                work_order.resolve_due_at = now + timedelta(hours=playbook.sla_resolve_hours)
            session.add(work_order)
        audit.change_status(
            session, ticket, TicketStatus(target), "bql", "escalation_resumed", detail={"note": body.note}
        )

    elif body.action == "retriage":
        if body.location_id:
            location = session.get(Location, body.location_id)
            if location is None:
                raise HTTPException(status_code=422, detail=f"Không có vị trí {body.location_id}")
            apply_location(ticket, location)
        if body.category:
            ticket.category = body.category
        if ticket.location_id is None:
            raise HTTPException(status_code=422, detail="Ticket chưa có vị trí: truyền location_id")
        if session.get(Playbook, ticket.category) is None:
            raise HTTPException(
                status_code=422, detail=f"Chưa có playbook cho loại '{ticket.category}': truyền category"
            )
        _cancel(session, ticket, active_work_orders)
        audit.change_status(
            session,
            ticket,
            TicketStatus.TRIAGED,
            "bql",
            "retriaged",
            detail={"location_id": ticket.location_id, "category": ticket.category, "note": body.note},
        )

    else:  # close
        _cancel(session, ticket, active_work_orders)
        ticket.closed_at = now
        ticket.close_note = body.note
        audit.change_status(session, ticket, TicketStatus.CLOSED, "bql", "closed_by_bql", detail={"note": body.note})

    escalation.status = EscalationStatus.RESOLVED
    escalation.resolved_at = now
    escalation.resolution = body.action
    escalation.resolution_note = body.note
    session.add(escalation)
    session.commit()
    session.refresh(ticket)
    return ticket_detail(session, ticket)


def _cancel(session: Session, ticket: Ticket, work_orders: list[WorkOrder]) -> None:
    for work_order in work_orders:
        work_order.status = WorkOrderStatus.CANCELLED
        session.add(work_order)
        audit.log(session, ticket, "work_order_cancelled", "bql", work_order=work_order)
