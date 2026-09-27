"""Database tables (SQLModel) for the maintenance-ops ticket flow.

Times are naive local time (Asia/Ho_Chi_Minh), see src.services.clock.
"""

from enum import StrEnum
from typing import Any

from pydantic import NaiveDatetime
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from src.services import clock


class TicketStatus(StrEnum):
    NEW = "NEW"
    TRIAGED = "TRIAGED"
    WO_PROPOSED = "WO_PROPOSED"
    ASSIGNED = "ASSIGNED"
    EVIDENCE_SUBMITTED = "EVIDENCE_SUBMITTED"
    CHECK_PASSED = "CHECK_PASSED"
    CHECK_FAILED = "CHECK_FAILED"
    CLOSE_PROPOSED = "CLOSE_PROPOSED"
    CLOSED = "CLOSED"
    ESCALATED = "ESCALATED"


class WorkOrderStatus(StrEnum):
    PROPOSED = "PROPOSED"
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    EVIDENCE_SUBMITTED = "EVIDENCE_SUBMITTED"
    CHECK_PASSED = "CHECK_PASSED"
    CHECK_FAILED = "CHECK_FAILED"
    CANCELLED = "CANCELLED"


# Work orders a technician is still expected to act on
ACTIVE_WO_STATUSES = (
    WorkOrderStatus.PROPOSED,
    WorkOrderStatus.ASSIGNED,
    WorkOrderStatus.ACCEPTED,
    WorkOrderStatus.EVIDENCE_SUBMITTED,
    WorkOrderStatus.CHECK_FAILED,
)


class EscalationReason(StrEnum):
    SAFETY_RISK = "SAFETY_RISK"  # suspected electrical fault, entrapment, smoke...
    AMBIGUOUS_LOCATION = "AMBIGUOUS_LOCATION"
    UNKNOWN_CATEGORY = "UNKNOWN_CATEGORY"  # no playbook for this kind of issue
    INTAKE_FAILED = "INTAKE_FAILED"  # LLM call failed
    NO_ON_DUTY = "NO_ON_DUTY"
    OVERDUE_ACCEPT = "OVERDUE_ACCEPT"
    OVERDUE_RESOLVE = "OVERDUE_RESOLVE"
    REPEATED_CHECK_FAILURE = "REPEATED_CHECK_FAILURE"
    MANUAL = "MANUAL"


class EscalationStatus(StrEnum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class Location(SQLModel, table=True):
    id: str = Field(primary_key=True)  # e.g. S101-T05-HL
    building: str = Field(index=True)
    floor: int | None = None  # -1 = basement B1; None = not tied to a floor (elevator car)
    area: str  # corridor | elevator_lobby | stairwell | lobby | parking | elevator_car
    unit: str | None = None  # elevator number, ...
    name: str


class Shift(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    technician_id: str = Field(index=True)
    technician_name: str
    zalo_chat_id: str | None = None
    skill: str  # matches Playbook.category
    building: str
    days: str  # weekdays as digits, Monday=0, e.g. "0123456"
    start: str  # "HH:MM"
    end: str  # "HH:MM"; end < start means overnight shift


class Playbook(SQLModel, table=True):
    category: str = Field(primary_key=True)
    title: str
    sla_accept_minutes: int
    sla_resolve_hours: int
    requires_materials: bool = True
    required_photos: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    steps: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    checklist: list[dict[str, str]] = Field(default_factory=list, sa_column=Column(JSON))


class Ticket(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: NaiveDatetime = Field(default_factory=lambda: clock.now())
    updated_at: NaiveDatetime = Field(default_factory=lambda: clock.now())
    channel: str = "form"
    reporter_name: str | None = None
    reporter_contact: str | None = None
    text: str
    status: str = Field(default=TicketStatus.NEW, index=True)

    # Filled by intake
    category: str | None = None
    summary: str | None = None
    urgency: str | None = None
    building: str | None = None
    floor: int | None = None
    area: str | None = None
    unit: str | None = None
    location_id: str | None = Field(default=None, foreign_key="location.id")
    safety_flags: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    closed_at: NaiveDatetime | None = None
    close_note: str | None = None


class WorkOrder(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="ticket.id", index=True)
    status: str = Field(default=WorkOrderStatus.PROPOSED, index=True)
    category: str
    shift_id: int | None = Field(default=None, foreign_key="shift.id")
    technician_id: str
    technician_name: str
    instructions: str
    checklist: list[dict[str, str]] = Field(default_factory=list, sa_column=Column(JSON))
    required_photos: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    requires_materials: bool = True

    created_at: NaiveDatetime = Field(default_factory=lambda: clock.now())
    approved_at: NaiveDatetime | None = None
    accepted_at: NaiveDatetime | None = None
    accept_due_at: NaiveDatetime | None = None
    resolve_due_at: NaiveDatetime | None = None

    # Technician submission
    submitted_at: NaiveDatetime | None = None
    checklist_done: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    materials_used: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    note: str | None = None

    # Evidence check results
    check_count: int = 0
    first_check_passed: bool | None = None
    last_check: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))


class Evidence(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    work_order_id: int = Field(foreign_key="workorder.id", index=True)
    kind: str  # before | after
    file_path: str
    content_type: str
    size_bytes: int
    sha256: str
    uploaded_at: NaiveDatetime = Field(default_factory=lambda: clock.now())


class TicketPhoto(SQLModel, table=True):
    """Photo the resident attached when reporting. Not used by triage or the evidence check."""

    id: int | None = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="ticket.id", index=True)
    file_path: str
    content_type: str
    size_bytes: int
    sha256: str
    uploaded_at: NaiveDatetime = Field(default_factory=lambda: clock.now())


class Escalation(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="ticket.id", index=True)
    work_order_id: int | None = Field(default=None, foreign_key="workorder.id")
    reason: str
    detail: str
    status: str = Field(default=EscalationStatus.OPEN, index=True)
    # Ticket status before escalating, so BQL can resume the flow
    ticket_status_before: str
    created_at: NaiveDatetime = Field(default_factory=lambda: clock.now())
    resolved_at: NaiveDatetime | None = None
    resolution: str | None = None
    resolution_note: str | None = None


class AuditLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="ticket.id", index=True)
    work_order_id: int | None = Field(default=None, foreign_key="workorder.id")
    created_at: NaiveDatetime = Field(default_factory=lambda: clock.now())
    actor: str  # system | llm | bql | technician | resident
    action: str
    from_status: str | None = None
    to_status: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
