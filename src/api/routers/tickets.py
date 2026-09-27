from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select

from src.api.deps import BQL, BQLOrTechnician, SessionDep
from src.api.routers.common import get_ticket, require_status, ticket_detail
from src.models.entities import (
    AuditLog,
    EscalationReason,
    Location,
    Playbook,
    Ticket,
    TicketStatus,
)
from src.models.schemas import CloseRequest, EscalateRequest, TicketCreate, TicketDetail
from src.services import audit, clock
from src.services.assignment import draft_work_order, find_on_duty
from src.services.triage import triage

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.post("", response_model=TicketDetail, status_code=201)
def create_ticket(body: TicketCreate, session: SessionDep) -> TicketDetail:
    """Cư dân gửi phản ánh. Hệ thống kiểm tra an toàn, tách vị trí/loại sự cố và khớp danh mục vị trí.

    Kết quả: `TRIAGED` nếu đủ thông tin, hoặc `ESCALATED` (chuyển BQL) kèm lý do.
    """
    ticket = Ticket(
        text=body.text,
        channel=body.channel,
        reporter_name=body.reporter_name,
        reporter_contact=body.reporter_contact,
    )
    session.add(ticket)
    session.flush()
    audit.log(session, ticket, "created", "resident", to_status=TicketStatus.NEW, detail={"channel": body.channel})
    triage(session, ticket)
    session.commit()
    session.refresh(ticket)
    return ticket_detail(session, ticket)


@router.get("", response_model=list[Ticket])
def list_tickets(
    session: SessionDep,
    _role: BQL,
    status: TicketStatus | None = None,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[Ticket]:
    query = select(Ticket).order_by(Ticket.id.desc()).limit(limit)
    if status:
        query = query.where(Ticket.status == status)
    return list(session.exec(query).all())


@router.get("/{ticket_id}", response_model=TicketDetail)
def read_ticket(ticket_id: int, session: SessionDep, _role: BQLOrTechnician) -> TicketDetail:
    return ticket_detail(session, get_ticket(session, ticket_id))


@router.post("/{ticket_id}/propose-work-order", response_model=TicketDetail)
def propose_work_order(ticket_id: int, session: SessionDep, _role: BQL) -> TicketDetail:
    """Đề xuất người trực và nội dung việc theo playbook. Không có ai trực thì chuyển BQL."""
    ticket = get_ticket(session, ticket_id)
    require_status(ticket.status, TicketStatus.TRIAGED)
    location = session.get(Location, ticket.location_id)
    playbook = session.get(Playbook, ticket.category)
    if location is None or playbook is None:
        raise HTTPException(status_code=409, detail="Ticket thiếu vị trí hoặc loại sự cố chưa có playbook")

    shift = find_on_duty(session, playbook.category, location.building, clock.now())
    if shift is None:
        audit.escalate(
            session,
            ticket,
            EscalationReason.NO_ON_DUTY,
            f"Không có kỹ thuật '{playbook.category}' đang trực tại tòa {location.building}",
            "system",
        )
    else:
        work_order = draft_work_order(ticket, location, playbook, shift)
        session.add(work_order)
        session.flush()
        audit.change_status(
            session,
            ticket,
            TicketStatus.WO_PROPOSED,
            "system",
            "work_order_proposed",
            work_order=work_order,
            detail={"technician_id": shift.technician_id, "shift_id": shift.id},
        )
    session.commit()
    session.refresh(ticket)
    return ticket_detail(session, ticket)


@router.post("/{ticket_id}/close", response_model=TicketDetail)
def close_ticket(ticket_id: int, body: CloseRequest, session: SessionDep, _role: BQL) -> TicketDetail:
    """BQL đóng ticket sau khi hồ sơ đã đạt kiểm tra (trạng thái `CLOSE_PROPOSED`)."""
    ticket = get_ticket(session, ticket_id)
    require_status(ticket.status, TicketStatus.CLOSE_PROPOSED)
    ticket.closed_at = clock.now()
    ticket.close_note = body.note
    audit.change_status(session, ticket, TicketStatus.CLOSED, "bql", "closed", detail={"note": body.note})
    session.commit()
    session.refresh(ticket)
    return ticket_detail(session, ticket)


@router.post("/{ticket_id}/escalate", response_model=TicketDetail)
def escalate_ticket(ticket_id: int, body: EscalateRequest, session: SessionDep, role: BQLOrTechnician) -> TicketDetail:
    """Chuyển BQL thủ công từ bất kỳ bước nào (ví dụ kỹ thuật ra hiện trường thấy lỗi điện)."""
    ticket = get_ticket(session, ticket_id)
    if ticket.status in (TicketStatus.CLOSED, TicketStatus.ESCALATED):
        raise HTTPException(status_code=409, detail=f"Ticket đang ở trạng thái {ticket.status}")
    audit.escalate(session, ticket, EscalationReason.MANUAL, body.detail, role)
    session.commit()
    session.refresh(ticket)
    return ticket_detail(session, ticket)


@router.get("/{ticket_id}/audit", response_model=list[AuditLog])
def ticket_audit(ticket_id: int, session: SessionDep, _role: BQL) -> list[AuditLog]:
    """Nhật ký mọi quyết định và lần chuyển trạng thái của ticket."""
    get_ticket(session, ticket_id)
    return list(session.exec(select(AuditLog).where(AuditLog.ticket_id == ticket_id).order_by(AuditLog.id)).all())
