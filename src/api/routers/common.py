from fastapi import HTTPException
from sqlmodel import Session, select

from src.models.entities import Escalation, Evidence, Ticket, WorkOrder
from src.models.schemas import TicketDetail, WorkOrderDetail


def get_ticket(session: Session, ticket_id: int) -> Ticket:
    ticket = session.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail=f"Không có ticket {ticket_id}")
    return ticket


def get_work_order(session: Session, work_order_id: int) -> WorkOrder:
    work_order = session.get(WorkOrder, work_order_id)
    if work_order is None:
        raise HTTPException(status_code=404, detail=f"Không có work order {work_order_id}")
    return work_order


def require_status(current: str, *allowed: str, what: str = "Ticket") -> None:
    if current not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"{what} đang ở trạng thái {current}; thao tác này cần {' hoặc '.join(allowed)}",
        )


def work_order_detail(session: Session, work_order: WorkOrder) -> WorkOrderDetail:
    evidence = session.exec(select(Evidence).where(Evidence.work_order_id == work_order.id).order_by(Evidence.id)).all()
    ticket = session.get(Ticket, work_order.ticket_id)
    return WorkOrderDetail(work_order=work_order, evidence=list(evidence), ticket_status=ticket.status)


def ticket_detail(session: Session, ticket: Ticket) -> TicketDetail:
    work_orders = session.exec(select(WorkOrder).where(WorkOrder.ticket_id == ticket.id).order_by(WorkOrder.id)).all()
    escalations = session.exec(
        select(Escalation).where(Escalation.ticket_id == ticket.id).order_by(Escalation.id)
    ).all()
    return TicketDetail(
        ticket=ticket,
        work_orders=[work_order_detail(session, wo) for wo in work_orders],
        escalations=list(escalations),
    )
