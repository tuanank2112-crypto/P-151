"""Two levels of detail over the same ticket (CR-BPTN-02 §6).

The resident view is built field by field from an allow-list, so internal data (reason_code, internal_note,
assignee_id, staff, materials, retries, escalation) cannot leak through a new model field.
"""

from collections.abc import Iterable
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from src.maintenance.engine import MaintenanceEngine, resident_photos
from src.maintenance.enums import (
    SAFETY_REASONS,
    AssetResolution,
    BlockerOwner,
    ClosureKind,
    Department,
    Priority,
    PrioritySource,
    ReasonCode,
    ReviewStatus,
    RiskLevel,
    TicketFlag,
    TicketStatus,
)
from src.maintenance.messages import _templates, overdue_eta_message, status_label
from src.maintenance.models import Blocker, Case, Ticket

ResidentAction = Literal["ADD_INFO", "RATE"]

PRIORITY_RANK: dict[Priority | None, int] = {Priority.HIGH: 0, Priority.MEDIUM: 1, Priority.LOW: 2, None: 3}


def _created_key(created_at: str) -> str:
    try:
        return datetime.fromisoformat(created_at).isoformat()  # normalised offset
    except ValueError:
        return created_at


def queue_sort_key(ticket: Ticket) -> tuple[int, int, str, str]:
    """CR-BPTN-03 §7 (Q14): EMERGENCY on top, then priority high to low, then oldest first, then ticket_id."""
    emergency = 0 if ticket.risk_level == RiskLevel.EMERGENCY else 1
    return (emergency, PRIORITY_RANK[ticket.priority], _created_key(ticket.raw.created_at), ticket.ticket_id)


def sort_queue(cases: Iterable[Case]) -> list[Case]:
    return sorted(cases, key=lambda c: queue_sort_key(c.ticket))


class TimelineEntry(BaseModel):
    status: TicketStatus
    status_label: str
    public_message: str
    created_at: datetime


class MergedInto(BaseModel):
    ticket_id: str
    status: TicketStatus
    status_label: str
    department_name: str | None
    public_message: str


class ResidentTicketView(BaseModel):
    ticket_id: str
    created_at: str
    description: str  # the resident's own report
    additions: list[str]  # the resident's own additions, oldest first
    photos: list[str]  # evidence IDs of the resident's own photos; department photos stay internal
    status: TicketStatus
    status_label: str
    department_name: str | None
    public_message: str
    eta: datetime | None
    timeline: list[TimelineEntry]
    allowed_actions: list[ResidentAction]
    merged_into: MergedInto | None = None


def _department_name(engine: MaintenanceEngine, case: Case) -> str | None:
    """Only the department the ticket was handed to at step 8; the step-4 proposal stays internal."""
    department = case.ticket.department_id
    return engine.catalog.department(department).name if department else None


def _current_message(case: Case) -> str:
    ticket = case.ticket
    if ticket.blocker is not None:
        return ticket.blocker.public_message
    public = [e for e in case.events if e.public]
    return public[-1].public_message


def _resident_status_label(case: Case) -> str:
    """CR-BPTN-03 §13: tier 1 and tier 2 tickets share one neutral label."""
    blocker = case.ticket.blocker
    if blocker is not None and blocker.code in SAFETY_REASONS:
        return _templates()["safety_status_label"]
    return status_label(case.ticket.status)


def resident_view(engine: MaintenanceEngine, case: Case, now: datetime) -> ResidentTicketView:
    ticket = case.ticket
    actions: list[ResidentAction] = []
    if ticket.status == TicketStatus.NEED_INFO:  # only ask when the resident is the one blocking the ticket
        actions.append("ADD_INFO")
    if ticket.status == TicketStatus.CLOSED:
        if ticket.rating is None:
            actions.append("RATE")
    eta = ticket.blocker.eta if ticket.blocker else None
    eta_passed = eta is not None and eta <= now
    merged = None
    if ticket.merged_into:
        original = engine.get(ticket.merged_into)
        merged = MergedInto(
            ticket_id=original.ticket.ticket_id,
            status=original.ticket.status,
            status_label=status_label(original.ticket.status),
            department_name=_department_name(engine, original),
            public_message=_current_message(original),
        )
    return ResidentTicketView(
        ticket_id=ticket.ticket_id,
        created_at=ticket.raw.created_at,
        description=ticket.raw.original_description,
        additions=[a.content for a in case.additions],
        photos=[e.evidence_id for e in resident_photos(case)],
        status=ticket.status,
        status_label=_resident_status_label(case),
        department_name=_department_name(engine, case),
        public_message=overdue_eta_message(eta) if eta_passed else _current_message(case),
        eta=None if eta_passed else eta,
        timeline=[
            TimelineEntry(
                status=e.to_status,
                status_label=status_label(e.to_status),
                public_message=e.public_message,
                created_at=e.created_at,
            )
            for e in case.events
            if e.public
        ],
        allowed_actions=actions,
        merged_into=merged,
    )


class BqlTicketRow(BaseModel):
    ticket_id: str
    status: TicketStatus
    status_label: str
    department_id: Department | None
    proposed_department_id: Department | None
    review_status: ReviewStatus | None
    asset_resolution: AssetResolution | None
    assignee_id: str | None
    blocker: Blocker | None
    flags: list[TicketFlag]
    rework_count: int
    escalated: bool
    overdue: bool
    created_at: str
    accepted_at: datetime | None
    closed_at: datetime | None
    merged_into: str | None
    cancel_reason: str | None
    risk_level: RiskLevel
    priority: Priority | None
    priority_source: PrioritySource | None
    blocker_owner_role: BlockerOwner | None  # the "needs me" box of BQL/BPTN
    safety_cleared_by: str | None
    closure_kind: ClosureKind | None


def _overdue(case: Case, now: datetime) -> bool:
    blocker = case.ticket.blocker
    return blocker is not None and (
        blocker.escalated or (blocker.escalate_at is not None and blocker.escalate_at <= now)
    )


def bql_rows(
    engine: MaintenanceEngine,
    now: datetime,
    *,
    status: TicketStatus | None = None,
    department_id: Department | None = None,
    blocker_code: ReasonCode | None = None,
    escalated: bool | None = None,
    overdue: bool | None = None,
    risk_level: RiskLevel | None = None,
    priority: Priority | None = None,
    blocker_owner_role: BlockerOwner | None = None,
) -> list[BqlTicketRow]:
    rows = []
    # snapshot: a new ticket may arrive from another thread; sorted by the CR-BPTN-03 §7 queue key
    for case in sort_queue(list(engine.cases.values())):
        ticket, blocker = case.ticket, case.ticket.blocker
        row = BqlTicketRow(
            ticket_id=ticket.ticket_id,
            status=ticket.status,
            status_label=status_label(ticket.status),
            department_id=ticket.department_id,
            proposed_department_id=ticket.proposed_department_id,
            review_status=ticket.review_status,
            asset_resolution=ticket.asset_resolution,
            assignee_id=ticket.assignee_id,
            blocker=blocker,
            flags=ticket.flags,
            rework_count=ticket.rework_count,
            escalated=bool(blocker and blocker.escalated),
            overdue=_overdue(case, now),
            created_at=ticket.raw.created_at,
            accepted_at=ticket.accepted_at,
            closed_at=ticket.closed_at,
            merged_into=ticket.merged_into,
            cancel_reason=ticket.cancel_reason,
            risk_level=ticket.risk_level,
            priority=ticket.priority,
            priority_source=ticket.priority_source,
            blocker_owner_role=blocker.owner_role if blocker else None,
            safety_cleared_by=ticket.safety_cleared_by,
            closure_kind=ticket.closure_kind,
        )
        if status is not None and row.status != status:
            continue
        if department_id is not None and row.department_id != department_id:
            continue
        if blocker_code is not None and (blocker is None or blocker.code != blocker_code):
            continue
        if escalated is not None and row.escalated != escalated:
            continue
        if overdue is not None and row.overdue != overdue:
            continue
        if risk_level is not None and row.risk_level != risk_level:
            continue
        if priority is not None and row.priority != priority:
            continue
        if blocker_owner_role is not None and row.blocker_owner_role != blocker_owner_role:
            continue
        rows.append(row)
    return rows
