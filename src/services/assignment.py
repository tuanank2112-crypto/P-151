"""Pick the on-duty technician and assign the work order right after triage. No BQL approval step."""

from datetime import datetime, time, timedelta

from sqlmodel import Session, func, select

from src.models.entities import (
    EscalationReason,
    Location,
    Playbook,
    Shift,
    Ticket,
    TicketStatus,
    WorkOrder,
    WorkOrderStatus,
)
from src.services import audit, clock
from src.services.notifier import notify_technician


def _parse_hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def is_on_shift(shift: Shift, at: datetime) -> bool:
    start, end, t = _parse_hhmm(shift.start), _parse_hhmm(shift.end), at.time()
    if start <= end:
        return str(at.weekday()) in shift.days and start <= t < end
    # Overnight shift (22:00-06:00): the part after midnight belongs to the previous day's shift
    if t >= start:
        return str(at.weekday()) in shift.days
    previous_day = (at.weekday() - 1) % 7
    return t < end and str(previous_day) in shift.days


def find_on_duty(session: Session, category: str, building: str, at: datetime) -> Shift | None:
    """On-duty technician for this skill; ties go to whoever has fewer open work orders."""
    shifts = session.exec(select(Shift).where(Shift.skill == category, Shift.building == building)).all()
    on_duty = [s for s in shifts if is_on_shift(s, at)]
    if not on_duty:
        return None

    open_counts = dict(
        session.exec(
            select(WorkOrder.technician_id, func.count())
            .where(WorkOrder.status.in_([WorkOrderStatus.ASSIGNED, WorkOrderStatus.ACCEPTED]))
            .group_by(WorkOrder.technician_id)
        ).all()
    )
    return min(on_duty, key=lambda s: (open_counts.get(s.technician_id, 0), s.id))


def draft_work_order(ticket: Ticket, location: Location, playbook: Playbook, shift: Shift) -> WorkOrder:
    steps = "\n".join(f"{i}. {step}" for i, step in enumerate(playbook.steps, start=1))
    instructions = f"{playbook.title} tại {location.name} ({location.id}).\nPhản ánh: {ticket.summary}\n\n{steps}"
    return WorkOrder(
        ticket_id=ticket.id,
        category=playbook.category,
        shift_id=shift.id,
        technician_id=shift.technician_id,
        technician_name=shift.technician_name,
        instructions=instructions,
        checklist=list(playbook.checklist),
        required_photos=list(playbook.required_photos),
        requires_materials=playbook.requires_materials,
    )


def assign(session: Session, ticket: Ticket) -> WorkOrder | None:
    """Assign a TRIAGED ticket to the on-duty technician and notify them. Nobody on duty: escalate to BQL."""
    location = session.get(Location, ticket.location_id)
    playbook = session.get(Playbook, ticket.category)
    now = clock.now()
    shift = find_on_duty(session, playbook.category, location.building, now)
    if shift is None:
        audit.escalate(
            session,
            ticket,
            EscalationReason.NO_ON_DUTY,
            f"Không có kỹ thuật '{playbook.category}' đang trực tại tòa {location.building}",
            "system",
        )
        return None

    work_order = draft_work_order(ticket, location, playbook, shift)
    work_order.status = WorkOrderStatus.ASSIGNED
    work_order.approved_at = now
    work_order.accept_due_at = now + timedelta(minutes=playbook.sla_accept_minutes)
    work_order.resolve_due_at = now + timedelta(hours=playbook.sla_resolve_hours)
    session.add(work_order)
    session.flush()
    audit.change_status(
        session,
        ticket,
        TicketStatus.ASSIGNED,
        "system",
        "work_order_assigned",
        work_order=work_order,
        detail={
            "technician_id": shift.technician_id,
            "shift_id": shift.id,
            "notification": notify_technician(work_order),
        },
    )
    return work_order
