import hashlib
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import select

from src.api.deps import BQL, BQLOrTechnician, SessionDep
from src.api.routers.common import get_ticket, require_status, ticket_detail
from src.models.entities import (
    AuditLog,
    EscalationReason,
    Ticket,
    TicketPhoto,
    TicketStatus,
)
from src.models.schemas import CloseRequest, EscalateRequest, TicketDetail
from src.services import audit, clock
from src.services.assignment import assign
from src.services.evidence_check import read_image, write_image
from src.services.triage import triage

router = APIRouter(prefix="/tickets", tags=["tickets"])


MAX_TICKET_PHOTOS = 5


@router.post("", response_model=TicketDetail, status_code=201)
async def create_ticket(
    session: SessionDep,
    text: str = Form(
        ...,
        min_length=5,
        max_length=2000,
        description="Nội dung phản ánh của cư dân",
        examples=["Đèn hành lang tầng 5 bị hỏng, tối om từ tối qua"],
    ),
    channel: Literal["app", "form", "zalo", "hotline"] = Form(default="form"),
    reporter_name: str | None = Form(default=None, max_length=100),
    reporter_contact: str | None = Form(
        default=None, max_length=100, description="SĐT hoặc căn hộ", examples=["S1.01-0512"]
    ),
    photos: list[UploadFile] = File(default=[], description=f"Ảnh hiện trạng (không bắt buộc, tối đa {MAX_TICKET_PHOTOS})"),
) -> TicketDetail:
    """Cư dân gửi phản ánh, có thể kèm ảnh. Hệ thống kiểm tra an toàn, tách vị trí/loại sự cố và khớp danh mục vị trí.

    Đủ thông tin thì tự giao ngay cho kỹ thuật đang trực: `ASSIGNED`.
    Nghi lỗi an toàn, vị trí mơ hồ, chưa có playbook hoặc không ai trực: `ESCALATED` (chuyển BQL) kèm lý do.
    Ảnh chỉ được lưu để BQL/kỹ thuật xem, không dùng để phân loại.
    """
    if len(photos) > MAX_TICKET_PHOTOS:
        raise HTTPException(status_code=422, detail=f"Tối đa {MAX_TICKET_PHOTOS} ảnh")
    # Validate every photo before creating anything, so a bad file does not leave a half-made ticket
    images = [(upload, *await read_image(upload)) for upload in photos]

    ticket = Ticket(text=text, channel=channel, reporter_name=reporter_name, reporter_contact=reporter_contact)
    session.add(ticket)
    session.flush()
    for upload, data, extension in images:
        path = write_image(f"ticket_{ticket.id}", "resident", data, extension)
        session.add(
            TicketPhoto(
                ticket_id=ticket.id,
                file_path=str(path),
                content_type=upload.content_type,
                size_bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest(),
            )
        )
    audit.log(
        session,
        ticket,
        "created",
        "resident",
        to_status=TicketStatus.NEW,
        detail={"channel": channel, "photos": len(images)},
    )
    triage(session, ticket)
    if ticket.status == TicketStatus.TRIAGED:
        assign(session, ticket)
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


@router.get("/{ticket_id}/photos/{photo_id}", response_class=FileResponse)
def read_ticket_photo(ticket_id: int, photo_id: int, session: SessionDep, _role: BQLOrTechnician) -> FileResponse:
    """Xem ảnh cư dân gửi kèm phản ánh."""
    photo = session.get(TicketPhoto, photo_id)
    if photo is None or photo.ticket_id != ticket_id or not Path(photo.file_path).is_file():
        raise HTTPException(status_code=404, detail=f"Không có ảnh {photo_id} của ticket {ticket_id}")
    return FileResponse(photo.file_path, media_type=photo.content_type)


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
