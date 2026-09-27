from fastapi import APIRouter
from sqlmodel import select

from src.api.deps import BQL, SessionDep
from src.models.entities import EscalationReason, Ticket, TicketStatus, WorkOrder, WorkOrderStatus
from src.models.schemas import OverdueResult
from src.services import audit, clock

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/check-overdue", response_model=OverdueResult)
def check_overdue(session: SessionDep, _role: BQL) -> OverdueResult:
    """Quét việc quá hạn (thay cho cron; bấm tay để test). Quá hạn nhận việc hoặc hoàn thành thì chuyển BQL."""
    now = clock.now()
    work_orders = session.exec(
        select(WorkOrder).where(
            WorkOrder.status.in_([WorkOrderStatus.ASSIGNED, WorkOrderStatus.ACCEPTED, WorkOrderStatus.CHECK_FAILED])
        )
    ).all()

    created = []
    for work_order in work_orders:
        ticket = session.get(Ticket, work_order.ticket_id)
        if ticket.status in (TicketStatus.ESCALATED, TicketStatus.CLOSED):
            continue
        if work_order.status == WorkOrderStatus.ASSIGNED and now > work_order.accept_due_at:
            reason, deadline, what = EscalationReason.OVERDUE_ACCEPT, work_order.accept_due_at, "nhận việc"
        elif now > work_order.resolve_due_at:
            reason, deadline, what = EscalationReason.OVERDUE_RESOLVE, work_order.resolve_due_at, "hoàn thành"
        else:
            continue
        detail = f"{work_order.technician_name} ({work_order.technician_id}) quá hạn {what} ({deadline:%H:%M %d/%m})"
        created.append(audit.escalate(session, ticket, reason, detail, "system", work_order=work_order))

    session.commit()
    for escalation in created:
        session.refresh(escalation)
    return OverdueResult(checked_at=now.isoformat(timespec="seconds"), created=created)
