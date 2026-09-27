import re
from datetime import timedelta

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from sqlmodel import select

from src.api.deps import BQL, BQLOrTechnician, SessionDep, Technician
from src.api.routers.common import get_ticket, get_work_order, require_status, work_order_detail
from src.config import get_settings
from src.models.entities import (
    EscalationReason,
    Evidence,
    Playbook,
    Shift,
    TicketStatus,
    WorkOrder,
    WorkOrderStatus,
)
from src.models.schemas import CheckResponse, ReassignRequest, WorkOrderDetail
from src.services import audit, clock
from src.services.assignment import is_on_shift
from src.services.evidence_check import check_evidence, save_photo
from src.services.notifier import notify_technician

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@router.get("", response_model=list[WorkOrder])
def list_work_orders(
    session: SessionDep,
    _role: BQLOrTechnician,
    technician_id: str | None = None,
    status: WorkOrderStatus | None = None,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[WorkOrder]:
    query = select(WorkOrder).order_by(WorkOrder.id.desc()).limit(limit)
    if technician_id:
        query = query.where(WorkOrder.technician_id == technician_id)
    if status:
        query = query.where(WorkOrder.status == status)
    return list(session.exec(query).all())


@router.get("/{work_order_id}", response_model=WorkOrderDetail)
def read_work_order(work_order_id: int, session: SessionDep, _role: BQLOrTechnician) -> WorkOrderDetail:
    return work_order_detail(session, get_work_order(session, work_order_id))


@router.post("/{work_order_id}/reassign", response_model=WorkOrderDetail)
def reassign_work_order(
    work_order_id: int, body: ReassignRequest, session: SessionDep, _role: BQL
) -> WorkOrderDetail:
    """BQL đổi người được hệ thống tự giao (người mới phải đang trực đúng chuyên môn). Chỉ đổi được khi chưa nhận việc."""
    work_order = get_work_order(session, work_order_id)
    ticket = get_ticket(session, work_order.ticket_id)
    require_status(work_order.status, WorkOrderStatus.ASSIGNED, what="Work order")
    require_status(ticket.status, TicketStatus.ASSIGNED)
    if body.technician_id == work_order.technician_id:
        raise HTTPException(status_code=422, detail=f"Việc đang giao cho {body.technician_id}")

    now = clock.now()
    shifts = session.exec(
        select(Shift).where(Shift.technician_id == body.technician_id, Shift.skill == work_order.category)
    ).all()
    shift = next((s for s in shifts if is_on_shift(s, now)), None)
    if shift is None:
        raise HTTPException(
            status_code=422,
            detail=f"Kỹ thuật {body.technician_id} không trực ca '{work_order.category}' lúc này",
        )

    previous = work_order.technician_id
    playbook = session.get(Playbook, work_order.category)
    work_order.shift_id = shift.id
    work_order.technician_id = shift.technician_id
    work_order.technician_name = shift.technician_name
    # The new technician gets a full acceptance window
    work_order.accept_due_at = now + timedelta(minutes=playbook.sla_accept_minutes)
    session.add(work_order)
    audit.log(
        session,
        ticket,
        "work_order_reassigned",
        "bql",
        work_order=work_order,
        detail={
            "from": previous,
            "to": shift.technician_id,
            "note": body.note,
            "notification": notify_technician(work_order),
        },
    )
    session.commit()
    session.refresh(work_order)
    return work_order_detail(session, work_order)


@router.post("/{work_order_id}/accept", response_model=WorkOrderDetail)
def accept_work_order(work_order_id: int, session: SessionDep, _role: Technician) -> WorkOrderDetail:
    """Kỹ thuật xác nhận nhận việc (trước hạn nhận việc để không bị quét quá hạn)."""
    work_order = get_work_order(session, work_order_id)
    ticket = get_ticket(session, work_order.ticket_id)
    require_status(work_order.status, WorkOrderStatus.ASSIGNED, what="Work order")
    require_status(ticket.status, TicketStatus.ASSIGNED)
    work_order.status = WorkOrderStatus.ACCEPTED
    work_order.accepted_at = clock.now()
    session.add(work_order)
    audit.log(session, ticket, "work_order_accepted", "technician", work_order=work_order)
    session.commit()
    session.refresh(work_order)
    return work_order_detail(session, work_order)


def _split_list(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[,;\n]", value) if item.strip()]


def _merge(existing: list[str], new: list[str]) -> list[str]:
    return list(dict.fromkeys([*existing, *new]))


@router.post("/{work_order_id}/evidence", response_model=WorkOrderDetail)
async def submit_evidence(
    work_order_id: int,
    session: SessionDep,
    _role: Technician,
    before_photos: list[UploadFile] = File(default=[], description="Ảnh trước khi sửa"),
    after_photos: list[UploadFile] = File(default=[], description="Ảnh sau khi sửa"),
    checklist_done: str = Form(
        default="", description="Mã checklist đã làm, cách nhau bởi dấu phẩy. Ví dụ: diagnose,replace"
    ),
    materials_used: str = Form(
        default="", description="Vật tư đã dùng, cách nhau bởi dấu phẩy. Ví dụ: Bóng LED 18W x1"
    ),
    note: str | None = Form(default=None),
) -> WorkOrderDetail:
    """Kỹ thuật nộp ảnh trước/sau, checklist, vật tư. Nộp lại được nhiều lần; lần sau cộng dồn vào lần trước."""
    work_order = get_work_order(session, work_order_id)
    ticket = get_ticket(session, work_order.ticket_id)
    require_status(
        work_order.status,
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.ACCEPTED,
        WorkOrderStatus.EVIDENCE_SUBMITTED,
        WorkOrderStatus.CHECK_FAILED,
        what="Work order",
    )
    require_status(ticket.status, TicketStatus.ASSIGNED, TicketStatus.EVIDENCE_SUBMITTED, TicketStatus.CHECK_FAILED)

    checklist = _split_list(checklist_done)
    known_codes = {item["code"] for item in work_order.checklist}
    unknown = [code for code in checklist if code not in known_codes]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Mã checklist không hợp lệ: {', '.join(unknown)}. Mã hợp lệ: {', '.join(sorted(known_codes))}",
        )
    materials = _split_list(materials_used)
    if not (before_photos or after_photos or checklist or materials or note):
        raise HTTPException(status_code=422, detail="Chưa gửi gì: cần ít nhất ảnh, checklist hoặc vật tư")

    saved: list[Evidence] = []
    for kind, uploads in (("before", before_photos), ("after", after_photos)):
        for upload in uploads:
            saved.append(await save_photo(work_order, kind, upload))
    session.add_all(saved)

    now = clock.now()
    if work_order.accepted_at is None:
        work_order.accepted_at = now  # submitting evidence implies the job was taken
    work_order.status = WorkOrderStatus.EVIDENCE_SUBMITTED
    work_order.submitted_at = now
    work_order.checklist_done = _merge(work_order.checklist_done, checklist)
    work_order.materials_used = _merge(work_order.materials_used, materials)
    if note:
        work_order.note = note
    session.add(work_order)

    detail = {"photos": [f"{e.kind}:{e.sha256[:12]}" for e in saved], "checklist": checklist, "materials": materials}
    if ticket.status == TicketStatus.EVIDENCE_SUBMITTED:
        audit.log(session, ticket, "evidence_added", "technician", work_order=work_order, detail=detail)
    else:
        audit.change_status(
            session,
            ticket,
            TicketStatus.EVIDENCE_SUBMITTED,
            "technician",
            "evidence_submitted",
            work_order=work_order,
            detail=detail,
        )
    session.commit()
    session.refresh(work_order)
    return work_order_detail(session, work_order)


@router.post("/{work_order_id}/check", response_model=CheckResponse)
def check_work_order(work_order_id: int, session: SessionDep, _role: BQL) -> CheckResponse:
    """Soát hồ sơ bằng quy tắc cứng. Đạt: đề xuất đóng ticket. Thiếu: ghi nhắc bổ sung kèm lý do."""
    work_order = get_work_order(session, work_order_id)
    ticket = get_ticket(session, work_order.ticket_id)
    require_status(work_order.status, WorkOrderStatus.EVIDENCE_SUBMITTED, what="Work order")
    require_status(ticket.status, TicketStatus.EVIDENCE_SUBMITTED)

    evidence = list(session.exec(select(Evidence).where(Evidence.work_order_id == work_order.id)).all())
    result = check_evidence(work_order, evidence)
    work_order.check_count += 1
    if work_order.first_check_passed is None:
        work_order.first_check_passed = result.passed
    work_order.last_check = result.model_dump()
    escalation = None

    if result.passed:
        work_order.status = WorkOrderStatus.CHECK_PASSED
        audit.change_status(session, ticket, TicketStatus.CHECK_PASSED, "system", "check_passed", work_order=work_order)
        audit.change_status(
            session, ticket, TicketStatus.CLOSE_PROPOSED, "system", "close_proposed", work_order=work_order
        )
    else:
        work_order.status = WorkOrderStatus.CHECK_FAILED
        issues = [issue.model_dump() for issue in result.issues]
        audit.change_status(
            session,
            ticket,
            TicketStatus.CHECK_FAILED,
            "system",
            "check_failed",
            work_order=work_order,
            detail={"issues": issues, "attempt": work_order.check_count},
        )
        # The "please complete your report" reminder; Zalo delivery comes later
        audit.log(
            session,
            ticket,
            "reminder_requested",
            "system",
            work_order=work_order,
            detail={
                "to": work_order.technician_id,
                "missing": [i["message"] for i in issues],
                **notify_technician(work_order),
            },
        )
        if work_order.check_count >= get_settings().max_check_failures:
            escalation = audit.escalate(
                session,
                ticket,
                EscalationReason.REPEATED_CHECK_FAILURE,
                f"Hồ sơ không đạt {work_order.check_count} lần",
                "system",
                work_order=work_order,
            )
    session.add(work_order)
    session.commit()
    session.refresh(work_order)
    session.refresh(ticket)
    if escalation:
        session.refresh(escalation)
    return CheckResponse(result=result, work_order=work_order, ticket_status=ticket.status, escalation=escalation)
