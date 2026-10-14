"""Two levels of detail over the same ticket (CR-BPTN-02 §6).

The resident view is built field by field from an allow-list, so internal data (reason_code, internal_note,
assignee_id, staff, materials, retries, escalation) cannot leak through a new model field.
"""

from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel

from src.maintenance.catalog import load_staff
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
from src.maintenance.models import (  # noqa: F401 - MaterialRequest*: defined in models (the engine returns them)
    Blocker,
    Case,
    MaterialRequestLine,
    MaterialRequestView,
    StockAlert,
    Ticket,
)
from src.maintenance.store.base import Assignment, NotFoundError, RatingDetail

ResidentAction = Literal["ADD_INFO", "RATE"]
# One neutral resident label (CR-BPTN-03 §13) for safety blockers and for a ticket held next to an emergency
NEUTRAL_LABEL_REASONS = SAFETY_REASONS | {ReasonCode.WAITING_EMERGENCY}

PRIORITY_RANK: dict[Priority | None, int] = {Priority.HIGH: 0, Priority.MEDIUM: 1, Priority.LOW: 2, None: 3}


def _created_key(created_at: str) -> str:
    try:
        parsed = datetime.fromisoformat(created_at)
    except ValueError:
        return created_at
    return parsed.astimezone(UTC).isoformat() if parsed.tzinfo else created_at


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


class LinkedTicket(BaseModel):
    """A ticket of the SAME resident that this one was split from / into or follows up (plan 06 01 §8)."""

    ticket_id: str
    status: TicketStatus
    status_label: str
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
    split_from: LinkedTicket | None = None
    split_into: list[LinkedTicket] = []
    follow_up_of: LinkedTicket | None = None
    rating: int | None = None  # plan 11: the stars the resident gave (response only, not a document field)
    rating_tags: list[str] = []  # plan 11 SPEC-P04 §4: from table rating_details, never from the ticket document
    rating_comment: str = ""


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
    """CR-BPTN-03 §13: tier 1 and tier 2 tickets (and a ticket held next to an emergency) share one neutral label."""
    blocker = case.ticket.blocker
    if blocker is not None and blocker.code in NEUTRAL_LABEL_REASONS:
        return _templates()["safety_status_label"]
    return status_label(case.ticket.status)


def _related(engine: MaintenanceEngine, ticket_id: str, lookup: Mapping[str, Case] | None) -> Case:
    """Same snapshot when the list already holds it; otherwise a fresh read (raises NotFoundError like engine.get)."""
    if lookup is not None and ticket_id in lookup:
        return lookup[ticket_id]
    return engine.get(ticket_id)


def _linked(
    engine: MaintenanceEngine, ticket_id: str, resident_id: str, lookup: Mapping[str, Case] | None = None
) -> LinkedTicket | None:
    """Only a ticket of the same resident is shown; a missing or foreign one is silently left out."""
    try:
        other = _related(engine, ticket_id, lookup)
    except NotFoundError:
        return None
    if other.ticket.resident_id != resident_id:
        return None
    return LinkedTicket(
        ticket_id=other.ticket.ticket_id,
        status=other.ticket.status,
        status_label=_resident_status_label(other),
        public_message=_current_message(other),
    )


def _can_rate(engine: MaintenanceEngine, ticket: Ticket, lookup: Mapping[str, Case] | None = None) -> bool:
    """CLOSED, or MERGED into a root that is CLOSED (plan 06 P04 §7); one rating only."""
    if ticket.rating is not None:
        return False
    if ticket.status == TicketStatus.CLOSED:
        return True
    if ticket.status == TicketStatus.MERGED and ticket.merged_into:
        try:
            return _related(engine, ticket.merged_into, lookup).ticket.status == TicketStatus.CLOSED
        except NotFoundError:
            return False
    return False


def staff_name(staff_id: str | None) -> str | None:
    member = load_staff().member(staff_id) if staff_id else None
    return member.name if member else None


def rating_detail_of(
    engine: MaintenanceEngine, ticket: Ticket, details: Mapping[str, RatingDetail] | None
) -> RatingDetail | None:
    """Tags and comment of a rated ticket; `details` is a table read the caller already made for a whole list."""
    if ticket.rating is None:
        return None
    return (details if details is not None else engine.repo.rating_details()).get(ticket.ticket_id)


def agent_fields(case: Case) -> dict[str, str | None]:
    """What the Agent said about a ticket (plan 11 SPEC-P04 §5): source, the department of its first valid job, and
    its scope. All None when no Agent decision exists; the department and scope are None for a fallback record."""
    record = case.agent_decision
    decision = record.decision if record else None
    first = decision.jobs[record.valid_job_indexes[0]] if decision and record.valid_job_indexes else None
    return {
        "agent_source": record.source if record else None,
        "agent_department": first.department_id if first else None,
        "agent_scope": decision.scope if decision else None,
    }


def resident_view(
    engine: MaintenanceEngine,
    case: Case,
    now: datetime,
    lookup: Mapping[str, Case] | None = None,
    details: Mapping[str, RatingDetail] | None = None,
) -> ResidentTicketView:
    """`lookup`: ticket_id -> Case of the same snapshot (the resident list), so linked tickets are not read again.
    `details`: the `rating_details` table read once for that list."""
    ticket = case.ticket
    detail = rating_detail_of(engine, ticket, details)
    actions: list[ResidentAction] = []
    if ticket.status == TicketStatus.NEED_INFO:  # BPTN follows up, but the resident may still add it directly
        actions.append("ADD_INFO")
    if _can_rate(engine, ticket, lookup):
        actions.append("RATE")
    split_into = [item for tid in ticket.split_children if (item := _linked(engine, tid, ticket.resident_id, lookup))]
    eta = ticket.blocker.eta if ticket.blocker else None
    eta_passed = eta is not None and eta <= now
    merged = None
    if ticket.merged_into:
        original = _related(engine, ticket.merged_into, lookup)
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
        additions=[a.content for a in case.additions if a.merged_from is None],  # merged-in text is staff only
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
        split_from=_linked(engine, ticket.split_from, ticket.resident_id, lookup) if ticket.split_from else None,
        split_into=split_into,
        rating=ticket.rating,
        rating_tags=list(detail.tags) if detail else [],
        rating_comment=detail.comment if detail else "",
        follow_up_of=(
            _linked(engine, ticket.follow_up_of, ticket.resident_id, lookup) if ticket.follow_up_of else None
        ),
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
    rating: int | None = None  # plan 11: BQL averages the stars (response only)
    rating_tags: list[str] = []
    rating_comment: str = ""
    staff_name: str | None = None  # plan 11 SPEC-P04 §3: from table assignments (assignee_id stays None)
    # Plan 06 (01 §8): staff only
    duplicate_count: int
    merged_children: list[str]
    related_ticket_ids: list[str]
    split_from: str | None
    split_children: list[str]
    follow_up_of: str | None
    wrong_department_return_count: int
    agent_source: str | None  # case.agent_decision.source
    agent_department: Department | None = None  # plan 11 SPEC-P04 §5: department of the Agent's first valid job
    agent_scope: str | None = None  # IN_SCOPE / OUT_OF_SCOPE / UNCLEAR as the Agent concluded
    agent_disagreements: list[str]  # "<field>:<severity>"


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
    flag: TicketFlag | None = None,
) -> list[BqlTicketRow]:
    rows = []
    assignments: Mapping[str, Assignment] = engine.repo.assignments()
    details = engine.repo.rating_details()
    # snapshot: a new ticket may arrive from another thread; sorted by the CR-BPTN-03 §7 queue key
    for case in sort_queue(list(engine.cases.values())):
        ticket, blocker, record = case.ticket, case.ticket.blocker, case.agent_decision
        assigned = assignments.get(ticket.ticket_id)
        detail = rating_detail_of(engine, ticket, details)
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
            rating=ticket.rating,
            rating_tags=list(detail.tags) if detail else [],
            rating_comment=detail.comment if detail else "",
            staff_name=staff_name(assigned.staff_id) if assigned else None,
            duplicate_count=ticket.duplicate_count,
            merged_children=list(ticket.merged_children),
            related_ticket_ids=list(ticket.related_ticket_ids),
            split_from=ticket.split_from,
            split_children=list(ticket.split_children),
            follow_up_of=ticket.follow_up_of,
            wrong_department_return_count=ticket.wrong_department_return_count,
            **agent_fields(case),
            agent_disagreements=[f"{d.field}:{d.severity}" for d in record.disagreements] if record else [],
        )
        if flag is not None and flag not in ticket.flags:
            continue
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


class StockAlertTicket(BaseModel):
    ticket_id: str
    waiting: bool  # the ticket is still ON_HOLD for WAITING_MATERIAL right now (read time, never stored)


class StockAlertView(StockAlert):
    """Plan 24 SPEC-P02 §2: the stored alert plus, per ticket it names, whether it still waits for material."""

    tickets: list[StockAlertTicket] = []


def stock_alert_views(engine: MaintenanceEngine, alerts: Iterable[StockAlert]) -> list[StockAlertView]:
    """A ticket that no longer exists is left out of `tickets`."""
    cache: dict[str, StockAlertTicket | None] = {}

    def state(ticket_id: str) -> StockAlertTicket | None:
        if ticket_id not in cache:
            try:
                ticket = engine.get(ticket_id).ticket
            except NotFoundError:
                cache[ticket_id] = None
            else:
                waiting = (
                    ticket.status == TicketStatus.ON_HOLD
                    and ticket.blocker is not None
                    and ticket.blocker.code == ReasonCode.WAITING_MATERIAL
                )
                cache[ticket_id] = StockAlertTicket(ticket_id=ticket_id, waiting=waiting)
        return cache[ticket_id]

    views = []
    for alert in alerts:
        tickets = [s for tid in alert.ticket_ids if (s := state(tid)) is not None]
        views.append(StockAlertView(**alert.model_dump(), tickets=tickets))
    return views
