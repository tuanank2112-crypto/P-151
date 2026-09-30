"""MaintenanceOps Agent engine, CR-BPTN-02 (v0.5 candidate).

Flow: resident report → Agent pipeline steps 2–8 (data, duplicate, category + department, BPTN review, asset,
material, route to department) → department accepts and works → step 10 reconciliation → BQL closes.

Rules that hold everywhere:
  - every status change goes through `_apply_transition`: it checks TRANSITIONS, writes exactly one StatusEvent
    and emits `ticket.status_changed`. An invalid transition raises; it is never skipped silently;
  - only BQL closes or cancels; the Agent never writes `assignee_id` or a locked field; the raw report never changes;
  - a stop is a `blocker` with an owner, a resume step and escalation times. Escalation only raises a flag and
    notifies BQL, it never changes the status;
  - every public operation checks permission first (denial = ACTION_DENIED audit, nothing else changes), works on a
    deep copy and commits only after the audit sink accepted the new rows (audit failure = fail closed).
"""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from src.maintenance.catalog import Catalog, TicketDataset, load_catalog, load_dataset
from src.maintenance.enums import (
    BPTN_REASONS,
    PLAYBOOK_BY_CATEGORY,
    PLAYBOOK_VERSION,
    TERMINAL_STATUSES,
    Action,
    ActionResult,
    ActorRole,
    AssetLookupStatus,
    AssetResolution,
    BlockerOwner,
    ChecklistStatus,
    ComparisonStatus,
    ComparisonType,
    Department,
    EvidenceSource,
    EvidenceType,
    EvidenceValidationStatus,
    MaterialGateStatus,
    MaterialRequirementMode,
    MaterialStockStatus,
    NormLabel,
    PlaybookId,
    ReadabilityStatus,
    ReasonCode,
    ReviewStatus,
    ServiceCategory,
    TicketFlag,
    TicketStatus,
)
from src.maintenance.messages import field_label, public_message
from src.maintenance.models import (
    AgentClassificationProposal,
    AuditEvent,
    Blocker,
    Case,
    ChecklistItem,
    ClassificationRecord,
    EvidenceRecord,
    LockedFields,
    MaterialComparisonResult,
    MaterialLine,
    NonBlockingWarning,
    Notification,
    PlannedMaterial,
    RawTicket,
    ReadinessEvaluation,
    ResidentAddition,
    StatusEvent,
    Ticket,
    WorkOrderDraft,
)
from src.maintenance.proposer import LLMClient, propose
from src.maintenance.rules import extract_location, missing_location_parts

LOCAL_TZ = timezone(timedelta(hours=7))
AGENT_ID = "SIM-ACTOR-AGENT"
SYSTEM_ID = "SIM-ACTOR-SYSTEM"
DEFAULT_RESIDENT_ID = "SIM-ACTOR-RESIDENT-01"
# Photos: optional for the resident, required from the department before step 10 passes
MAX_RESIDENT_PHOTOS = 5
MAX_EXECUTION_PHOTOS = 10
EXECUTION_PHOTO = "execution_photo"  # failing_items entry when the department sent no photo
SOURCE_REVISION = "SRC-001"

S = TicketStatus
R = ReasonCode
Role = ActorRole

# Permission matrix for non-transition actions. Anything not listed is denied for every role (default deny).
PERMISSIONS: dict[Action, frozenset[ActorRole]] = {
    Action.INGEST: frozenset({Role.SYSTEM}),
    Action.RUN_PIPELINE: frozenset({Role.AGENT, Role.SYSTEM}),
    Action.ADD_RESIDENT_INFO: frozenset({Role.RESIDENT}),
    Action.ADD_RESIDENT_PHOTO: frozenset({Role.RESIDENT}),
    Action.RATE_TICKET: frozenset({Role.RESIDENT}),
    Action.BPTN_RESOLVE: frozenset({Role.BPTN}),
    Action.RECEIVE_STOCK: frozenset({Role.WAREHOUSE}),
    Action.SET_ASSIGNEE: frozenset({Role.DEPARTMENT}),
    Action.UPDATE_CHECKLIST: frozenset({Role.DEPARTMENT}),
    Action.UPDATE_MATERIAL: frozenset({Role.DEPARTMENT}),
    Action.ADD_EVIDENCE: frozenset({Role.DEPARTMENT}),
    Action.REPORT_COMPLETE: frozenset({Role.DEPARTMENT}),
    Action.RUN_JOBS: frozenset({Role.SYSTEM}),
}


@dataclass(frozen=True)
class TransitionRule:
    actors: frozenset[ActorRole]
    reasons: frozenset[ReasonCode] = frozenset()  # reason codes this transition may carry
    reason_required: bool = False
    pipeline_only: bool = False  # driven by the pipeline / resume, never by an outside caller


def _rule(*actors: ActorRole, reasons=(), required=False, pipeline=False) -> TransitionRule:
    return TransitionRule(frozenset(actors), frozenset(reasons), required, pipeline)


# CR-BPTN-02 §3. The only allowed status changes.
TRANSITIONS: dict[tuple[TicketStatus, TicketStatus], TransitionRule] = {
    (S.RECEIVED, S.NEED_INFO): _rule(Role.SYSTEM, reasons=[R.MISSING_INFO], required=True, pipeline=True),
    (S.NEED_INFO, S.RECEIVED): _rule(Role.SYSTEM, pipeline=True),
    (S.RECEIVED, S.VERIFYING): _rule(
        Role.AGENT,
        reasons=[R.DUPLICATE, R.CATEGORY_UNCLEAR, R.OUT_OF_SCOPE, R.PENDING_REVIEW, R.ASSET_UNCLEAR],
        required=True,
        pipeline=True,
    ),
    (S.VERIFYING, S.MERGED): _rule(Role.BPTN),
    (S.VERIFYING, S.RECEIVED): _rule(Role.SYSTEM, pipeline=True),
    (S.RECEIVED, S.ON_HOLD): _rule(Role.AGENT, reasons=[R.WAITING_MATERIAL], required=True, pipeline=True),
    (S.ON_HOLD, S.RECEIVED): _rule(Role.SYSTEM, pipeline=True),
    (S.RECEIVED, S.ROUTED): _rule(Role.SYSTEM, reasons=[R.OUT_OF_HOURS], pipeline=True),
    (S.ROUTED, S.IN_PROGRESS): _rule(Role.DEPARTMENT),
    (S.ROUTED, S.VERIFYING): _rule(Role.DEPARTMENT, reasons=[R.WRONG_DEPT], required=True),
    (S.IN_PROGRESS, S.ON_HOLD): _rule(Role.DEPARTMENT, reasons=[R.BLOCKED_ONSITE], required=True),
    (S.ON_HOLD, S.IN_PROGRESS): _rule(Role.DEPARTMENT),
    (S.IN_PROGRESS, S.READY_FOR_REVIEW): _rule(Role.AGENT, pipeline=True),
    (S.READY_FOR_REVIEW, S.CLOSED): _rule(Role.BQL),
    (S.READY_FOR_REVIEW, S.IN_PROGRESS): _rule(Role.BQL, reasons=[R.REWORK], required=True),
    (S.CLOSED, S.READY_FOR_REVIEW): _rule(Role.RESIDENT),
    **{(status, S.CANCELLED): _rule(Role.BQL) for status in S if status not in TERMINAL_STATUSES},
}

BLOCKER_OWNERS: dict[ReasonCode, BlockerOwner] = {
    R.MISSING_INFO: BlockerOwner.RESIDENT,
    **{code: BlockerOwner.BPTN for code in BPTN_REASONS},
    R.WAITING_MATERIAL: BlockerOwner.WAREHOUSE,
    R.OUT_OF_HOURS: BlockerOwner.SYSTEM,
    R.NOT_ACCEPTED: BlockerOwner.DEPARTMENT,
    R.BLOCKED_ONSITE: BlockerOwner.DEPARTMENT,
    R.REWORK: BlockerOwner.DEPARTMENT,
}

SCOPE_LABELS = {
    PlaybookId.CLN: "vệ sinh khu vực chung",
    PlaybookId.TEC: "đèn chiếu sáng khu vực chung không hoạt động",
}


class EngineError(Exception):
    code = "ENGINE_ERROR"

    def __init__(self, message: str, detail: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.detail = detail or {}


class NotFoundError(EngineError):
    code = "NOT_FOUND"


class GuardError(EngineError):
    """Business precondition not met. Nothing is written."""

    code = "GUARD_FAILED"


class InvalidTransitionError(GuardError):
    code = "INVALID_TRANSITION"


class ActionDeniedError(EngineError):
    """Permission rejection (canonical code ACTION_DENIED). The denial itself is audited."""

    code = "ACTION_DENIED"


class AuditWriteError(EngineError):
    code = "AUDIT_WRITE_FAILED"


AuditSink = Callable[[list[AuditEvent | StatusEvent]], None]
NotifySink = Callable[[list[Notification]], None]


def route_blockers(ticket: Ticket) -> list[str]:
    """Why `can_route` is false (CR-BPTN-02 §3): review done, asset resolved, a department proposed."""
    failing = []
    if ticket.review_status not in (ReviewStatus.NOT_REQUIRED, ReviewStatus.CONFIRMED):
        failing.append(f"review_status={ticket.review_status}")
    if ticket.asset_resolution not in (
        AssetResolution.FOUND,
        AssetResolution.ONSITE_BY_BPTN,
        AssetResolution.NOT_APPLICABLE,
    ):
        failing.append(f"asset_resolution={ticket.asset_resolution}")
    if ticket.proposed_department_id is None:
        failing.append("proposed_department_id=null")
    return failing


def can_route(ticket: Ticket) -> bool:
    return not route_blockers(ticket)


def _blank(value: str | None) -> bool:
    return value is None or not value.strip() or value.strip().upper() == "UNKNOWN"


def _suffix(ticket_id: str) -> str:
    return ticket_id.removeprefix("SIM-TKT-")


def _created_at(raw: RawTicket) -> datetime | None:
    try:
        moment = datetime.fromisoformat(raw.created_at)
    except ValueError:
        return None
    return moment if moment.tzinfo else None


class MaintenanceEngine:
    def __init__(
        self,
        catalog: Catalog | None = None,
        dataset: TicketDataset | None = None,
        audit_sink: AuditSink | None = None,
        notify_sink: NotifySink | None = None,
        clock: Callable[[], datetime] | None = None,
        llm: LLMClient | None = None,
        llm_label: str = "llm",
    ):
        self.catalog = catalog or load_catalog()
        self.dataset = dataset or load_dataset()
        self.audit_sink = audit_sink or (lambda rows: None)
        self.notify_sink = notify_sink or (lambda rows: None)
        self.clock = clock or (lambda: datetime.now(LOCAL_TZ))
        self.llm = llm  # None = fixed rules only (deterministic, used by tests and LLM_MODE=mock)
        self.llm_label = llm_label
        self.cases: dict[str, Case] = {}
        self.stock: dict[str, float | None] = {}
        self.run_number = 0
        self.run_id = "SIM-RUN-000"
        self._reset_stock()

    # ------------------------------------------------------------------ run control

    def _reset_stock(self) -> None:
        self.stock = {m.item_code: m.simulated_stock_qty for m in self.catalog.materials}

    @contextmanager
    def at(self, moment: datetime) -> Iterator[None]:
        """Run the enclosed calls as if the clock showed `moment` (demo replays and scheduled jobs)."""
        previous = self.clock
        self.clock = lambda: moment
        try:
            yield
        finally:
            self.clock = previous

    def reset(self, *, with_fixtures: bool = True) -> str:
        """FR-DEMO-001: drop every mutable layer and re-ingest the fixture, each at its own created_at."""
        self.cases = {}
        self._reset_stock()
        self.run_number += 1
        self.run_id = f"SIM-RUN-{self.run_number:03d}"
        if with_fixtures:
            for fixture in self.dataset.tickets:
                planned = list(fixture.materials) if fixture.materials is not None else None
                with self.at(_created_at(fixture.raw) or self.clock()):
                    self.ingest(fixture.raw, planned_materials=planned)
                    self.run_agent(fixture.raw.ticket_id)
        return self.run_id

    def get(self, ticket_id: str) -> Case:
        case = self.cases.get(ticket_id)
        if case is None:
            raise NotFoundError(f"Không có ticket {ticket_id}")
        return case

    # ------------------------------------------------------------------ resident

    def receive(
        self,
        original_description: str,
        *,
        resident_id: str = DEFAULT_RESIDENT_ID,
        channel: str = "form",
        received_at: datetime | None = None,
    ) -> Case:
        """A resident report arrives: the system assigns ticket_id/created_at, then the Agent pipeline runs.

        `received_at` only exists to simulate a time of day in demos; normally it is the current time.
        """
        if self.catalog.actor_role(resident_id) != Role.RESIDENT:
            raise ActionDeniedError(f"{resident_id} không phải cư dân", {"code": "ACTION_DENIED"})
        moment = (received_at or self.clock()).astimezone(LOCAL_TZ)
        number = len(self.cases) + 1
        while f"SIM-TKT-{number:04d}" in self.cases:
            number += 1
        raw = RawTicket(
            ticket_id=f"SIM-TKT-{number:04d}",
            created_at=moment.isoformat(timespec="seconds"),
            original_description=original_description,
            channel=channel,
        )
        with self.at(moment):
            self.ingest(raw, resident_id=resident_id)
            return self.run_agent(raw.ticket_id)

    def ingest(
        self,
        raw: RawTicket,
        planned_materials: list[PlannedMaterial] | None = None,
        *,
        resident_id: str = DEFAULT_RESIDENT_ID,
    ) -> Case:
        """Store the raw resident report unchanged in status RECEIVED (step 1)."""
        if raw.ticket_id in self.cases:
            raise GuardError(f"Ticket {raw.ticket_id} đã được ingest")
        now = self.clock()
        marker = raw.integrity_marker()
        ticket = Ticket(
            ticket_id=raw.ticket_id,
            raw=raw,
            raw_integrity_marker=marker,
            resident_id=resident_id,
            source_revision=SOURCE_REVISION,
            dataset_version=self.dataset.dataset_version,
            status=S.RECEIVED,
        )
        work = Case(ticket=ticket, planned_materials=planned_materials)
        self._audit(
            work,
            Action.INGEST,
            "Ticket",
            raw.ticket_id,
            SYSTEM_ID,
            Role.SYSTEM,
            "ticket",
            None,
            {"raw_integrity_marker": marker},
            "Ingest raw ticket mô phỏng",
            now=now,
        )
        self._record_event(work, None, S.RECEIVED, None, SYSTEM_ID, Role.SYSTEM, now, public=True)
        self._notify(work, "ticket.status_changed", BlockerOwner.RESIDENT, now, {"to": S.RECEIVED})
        self._commit(work, 0, 0, 0)
        return work

    def run_agent(self, ticket_id: str) -> Case:
        """Run the pipeline from step 2 on a RECEIVED ticket."""

        def op(work: Case, now: datetime) -> None:
            if work.ticket.status != S.RECEIVED:
                raise GuardError("Pipeline chỉ chạy khi ticket ở RECEIVED", {"status": work.ticket.status})
            self._run_pipeline(work, 2, now)

        return self._mutate(ticket_id, AGENT_ID, Action.RUN_PIPELINE, op)

    def add_resident_info(self, ticket_id: str, actor_id: str, content: str) -> Case:
        """Event `resident_info_added`: append (never edit the original), then resume."""

        def op(work: Case, now: datetime) -> None:
            if work.ticket.status in TERMINAL_STATUSES:
                raise GuardError("Ticket đã kết thúc; không nhận thêm thông tin")
            if work.ticket.status != S.NEED_INFO:
                raise GuardError("Phản ánh không cần bổ sung thông tin lúc này")
            if _blank(content):
                raise GuardError("Nội dung bổ sung không được rỗng")
            addition = ResidentAddition(
                addition_id=f"SIM-ADD-{_suffix(ticket_id)}-{len(work.additions) + 1:02d}",
                ticket_id=ticket_id,
                content=content.strip(),
                submitted_by=actor_id,
                submitted_at=now,
            )
            work.additions.append(addition)
            if work.ticket.status == S.NEED_INFO and work.ticket.locked_fields.category is None:
                work.classification = None  # new content: classify again from original + additions
            self._audit(
                work,
                Action.ADD_RESIDENT_INFO,
                "ResidentAddition",
                addition.addition_id,
                actor_id,
                Role.RESIDENT,
                "additions",
                None,
                addition.content,
                "Cư dân bổ sung thông tin",
                now=now,
            )
            self._resume(work, now)

        return self._mutate(ticket_id, actor_id, Action.ADD_RESIDENT_INFO, op)

    def add_resident_photo(self, ticket_id: str, actor_id: str, file_ref: str) -> Case:
        """Optional photo the resident attaches to their own report. Kept as original evidence: never edited, never
        read by the Agent, never a condition for anything."""

        def op(work: Case, now: datetime) -> None:
            if work.ticket.status in TERMINAL_STATUSES:
                raise GuardError("Ticket đã kết thúc; không nhận thêm ảnh")
            if len(resident_photos(work)) >= MAX_RESIDENT_PHOTOS:
                raise GuardError(f"Mỗi phản ánh tối đa {MAX_RESIDENT_PHOTOS} ảnh")
            record = EvidenceRecord(
                evidence_id=f"SIM-EVD-{_suffix(ticket_id)}-{len(work.evidence) + 1:02d}",
                ticket_id=ticket_id,
                work_order_draft_id=None,
                requirement_id=None,
                evidence_type=EvidenceType.RESIDENT_ORIGINAL,
                content_or_metadata=file_ref,
                source=EvidenceSource.RESIDENT_ORIGINAL,
                submitted_by=actor_id,
                submitted_at=now,
                readability_status=ReadabilityStatus.READABLE,
                immutable=True,
            )
            work.evidence.append(record)
            self._audit(
                work,
                Action.ADD_RESIDENT_PHOTO,
                "EvidenceRecord",
                record.evidence_id,
                actor_id,
                Role.RESIDENT,
                "evidence",
                None,
                {"evidence_type": record.evidence_type},
                "Cư dân đính kèm ảnh",
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.ADD_RESIDENT_PHOTO, op)

    def rate(self, ticket_id: str, actor_id: str, score: int) -> Case:
        def op(work: Case, now: datetime) -> None:
            if work.ticket.status != S.CLOSED:
                raise GuardError("Chỉ đánh giá được khi ticket đã hoàn thành")
            old = work.ticket.rating
            work.ticket.rating = score
            self._audit(
                work,
                Action.RATE_TICKET,
                "Ticket",
                ticket_id,
                actor_id,
                Role.RESIDENT,
                "rating",
                old,
                score,
                "Cư dân đánh giá",
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.RATE_TICKET, op)

    def reopen(self, ticket_id: str, actor_id: str, *, note: str | None = None) -> Case:
        """'Báo chưa xong': CLOSED → READY_FOR_REVIEW inside the reopen window."""
        return self.transition(ticket_id, S.READY_FOR_REVIEW, actor_id, note=note)

    # ------------------------------------------------------------------ BPTN

    def bptn_resolve(
        self,
        ticket_id: str,
        actor_id: str,
        *,
        note: str | None = None,
        merge: bool | None = None,
        category: ServiceCategory | None = None,
        department: Department | None = None,
        location: str | None = None,
        asset_id: str | None = None,
        asset_onsite: bool = False,
    ) -> Case:
        """Event `bptn_resolved`. BPTN answers the open VERIFYING blocker; chosen values go to `locked_fields`.

        DUPLICATE: merge=True → MERGED; merge=False → pipeline resumes at step 4.
        CATEGORY_UNCLEAR / OUT_OF_SCOPE: `category` required → review CONFIRMED, resume at step 6.
        PENDING_REVIEW: confirm as is, or change category/location → CONFIRMED, resume at step 6.
        ASSET_UNCLEAR: `asset_id`, a new `location`, or `asset_onsite` ("xác định tại hiện trường", reason
            required → ONSITE_BY_BPTN + flag ASSET_CHECK_ONSITE); resume at step 6.
        WRONG_DEPT: `category` and/or `department`. A new category resets the asset and resumes at step 6;
            the same category resumes at step 7. Never straight to step 8.
        """

        def op(work: Case, now: datetime) -> None:
            ticket = work.ticket
            blocker = ticket.blocker
            if ticket.status != S.VERIFYING or blocker is None or blocker.code not in BPTN_REASONS:
                raise GuardError("Không có blocker nào chờ BPTN", {"status": ticket.status})
            code = blocker.code
            if (merge is not None) != (code == R.DUPLICATE):
                raise GuardError("`merge` chỉ dùng và bắt buộc với DUPLICATE", {"reason_code": code})
            if code == R.DUPLICATE and merge:
                self._audit(
                    work,
                    Action.BPTN_RESOLVE,
                    "Ticket",
                    ticket_id,
                    actor_id,
                    Role.BPTN,
                    "merged_into",
                    None,
                    blocker.related_ticket_id,
                    note or "BPTN xác nhận trùng",
                    now=now,
                )
                self._human_transition(work, S.MERGED, actor_id, Role.BPTN, now, note=note)
                return
            if code in (R.CATEGORY_UNCLEAR, R.OUT_OF_SCOPE) and category is None:
                raise GuardError(f"{code}: BPTN phải chọn loại việc (category)")
            if code == R.WRONG_DEPT and category is None and department is None:
                raise GuardError("WRONG_DEPT: BPTN phải chọn lại loại việc hoặc phòng ban")
            if department is not None and code != R.WRONG_DEPT:
                raise GuardError("Chỉ chọn phòng ban trực tiếp khi phòng ban trả về (WRONG_DEPT)")
            if code == R.ASSET_UNCLEAR and not (asset_id or location or asset_onsite):
                raise GuardError("ASSET_UNCLEAR: chọn asset_id, sửa location hoặc chọn xác định tại hiện trường")
            if asset_onsite and code != R.ASSET_UNCLEAR:
                raise GuardError("asset_onsite chỉ dùng cho ASSET_UNCLEAR")
            locks: dict[str, Any] = {}
            if category is not None:
                if category not in PLAYBOOK_BY_CATEGORY:
                    raise GuardError("Category không thuộc playbook v1.1", {"category": category})
                locks["category"] = category
            if department is not None:
                locks["department"] = department
            if location is not None:
                if _blank(location):
                    raise GuardError("location không được rỗng")
                locks["location"] = location.strip()
            if asset_id is not None:
                if not any(a.asset_id == asset_id for a in self.catalog.assets):
                    raise GuardError(f"Không có asset {asset_id} trong catalog")
                locks["asset_id"] = asset_id
            if (locks or asset_onsite) and _blank(note):
                raise GuardError("BPTN thay đổi giá trị hoặc chọn xác định tại hiện trường thì bắt buộc ghi lý do")

            category_changed = category is not None and category != self._category(work)
            if code == R.DUPLICATE:
                work.not_duplicate_of.append(blocker.related_ticket_id)
            current_locks = ticket.locked_fields.model_dump()
            if category_changed:
                # A new kind of work: the old asset and department choices no longer apply; step 6 runs again
                current_locks.update(asset_id=None, department=None)
                ticket.asset_resolution = None
                ticket.flags = [f for f in ticket.flags if f != TicketFlag.ASSET_CHECK_ONSITE]
            ticket.locked_fields = LockedFields(**{**current_locks, **locks})
            if asset_onsite and TicketFlag.ASSET_CHECK_ONSITE not in ticket.flags:
                ticket.flags = [*ticket.flags, TicketFlag.ASSET_CHECK_ONSITE]
            if category is not None:
                self._bind_category(work, category, "BPTN_LOCKED", now)
            elif department is not None:
                self._propose_department(work, now)
            if code in (R.CATEGORY_UNCLEAR, R.OUT_OF_SCOPE, R.PENDING_REVIEW, R.WRONG_DEPT):
                ticket.review_status = ReviewStatus.CONFIRMED
            resume_step = (6 if category_changed else 7) if code == R.WRONG_DEPT else blocker.resume_step
            ticket.blocker = blocker.model_copy(
                update={"resolved_at": now, "resolved_by": actor_id, "resume_step": resume_step}
            )
            self._audit(
                work,
                Action.BPTN_RESOLVE,
                "Ticket",
                ticket_id,
                actor_id,
                Role.BPTN,
                "locked_fields",
                None,
                {**locks, "asset_onsite": asset_onsite, "reason_code": code, "resume_step": resume_step},
                note.strip() if not _blank(note) else "BPTN xác nhận, không đổi giá trị",
                now=now,
            )
            self._resume(work, now)

        return self._mutate(ticket_id, actor_id, Action.BPTN_RESOLVE, op)

    # ------------------------------------------------------------------ department

    def accept(self, ticket_id: str, actor_id: str) -> Case:
        """Event `department_accepted`: ROUTED → IN_PROGRESS, clears OUT_OF_HOURS / NOT_ACCEPTED."""
        return self.transition(ticket_id, S.IN_PROGRESS, actor_id, expected_from=S.ROUTED)

    def return_wrong_department(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        return self.transition(ticket_id, S.VERIFYING, actor_id, note=note)

    def block_onsite(self, ticket_id: str, actor_id: str, *, note: str, eta: datetime) -> Case:
        return self.transition(ticket_id, S.ON_HOLD, actor_id, note=note, eta=eta)

    def resume_work(self, ticket_id: str, actor_id: str) -> Case:
        """Event `department_resumed`: ON_HOLD (BLOCKED_ONSITE) → IN_PROGRESS."""
        return self.transition(ticket_id, S.IN_PROGRESS, actor_id, expected_from=S.ON_HOLD)

    def set_assignee(self, ticket_id: str, actor_id: str, assignee_id: str | None) -> Case:
        """Staff assignment inside the department is the department's own business (out of CR scope)."""

        def op(work: Case, now: datetime) -> None:
            if work.ticket.status in TERMINAL_STATUSES:
                raise GuardError("Ticket đã kết thúc")
            old = work.ticket.assignee_id
            work.ticket.assignee_id = assignee_id
            self._audit(
                work,
                Action.SET_ASSIGNEE,
                "Ticket",
                ticket_id,
                actor_id,
                Role.DEPARTMENT,
                "assignee_id",
                old,
                assignee_id,
                "Phòng ban phân công nội bộ",
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.SET_ASSIGNEE, op)

    def update_checklist(
        self, ticket_id: str, actor_id: str, template_item_id: str, *, status: ChecklistStatus, note: str | None = None
    ) -> Case:
        def op(work: Case, now: datetime) -> None:
            self._require_in_progress(work)
            item = next((i for i in work.checklist_items if i.template_item_id == template_item_id), None)
            if item is None:
                raise GuardError(f"Không có checklist item {template_item_id} trong draft")
            if note is not None and not note.strip():
                raise GuardError("note nếu có phải không rỗng")
            old = item.status
            item.status, item.updated_by, item.updated_at, item.note = status, actor_id, now, note
            self._audit(
                work,
                Action.UPDATE_CHECKLIST,
                "ChecklistItem",
                item.checklist_item_id,
                actor_id,
                Role.DEPARTMENT,
                "status",
                old,
                status,
                note or "Cập nhật checklist mô phỏng",
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.UPDATE_CHECKLIST, op)

    def record_material(
        self,
        ticket_id: str,
        actor_id: str,
        item_code: str,
        *,
        issued_qty: float,
        used_qty: float,
        variance_reason: str | None = None,
    ) -> Case:
        def op(work: Case, now: datetime) -> None:
            self._require_in_progress(work)
            line = next((m for m in work.material_lines if m.item_code == item_code), None)
            if line is None:
                raise GuardError(f"Không có dòng vật tư {item_code} trong draft")
            old = {"issued_qty": line.issued_qty, "used_qty": line.used_qty, "variance_reason": line.variance_reason}
            line.issued_qty = issued_qty
            line.used_qty = used_qty
            line.variance_reason = None if _blank(variance_reason) else variance_reason.strip()
            new = {"issued_qty": issued_qty, "used_qty": used_qty, "variance_reason": line.variance_reason}
            self._audit(
                work,
                Action.UPDATE_MATERIAL,
                "MaterialLine",
                line.material_line_id,
                actor_id,
                Role.DEPARTMENT,
                "issued_qty,used_qty,variance_reason",
                old,
                new,
                "Nhập vật tư xuất và dùng mô phỏng",
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.UPDATE_MATERIAL, op)

    def add_evidence(
        self,
        ticket_id: str,
        actor_id: str,
        *,
        requirement_id: str | None,
        evidence_type: EvidenceType,
        content_or_metadata: str,
        readability_status: ReadabilityStatus,
    ) -> Case:
        """Execution note. The content is stored as untrusted data and never interpreted (FR-SECURITY-001)."""

        def op(work: Case, now: datetime) -> None:
            self._require_in_progress(work)
            draft = work.draft
            known = {r.requirement_id for r in draft.evidence_requirements}
            if requirement_id is not None and requirement_id not in known:
                raise GuardError(
                    f"Requirement {requirement_id} không thuộc playbook của draft", {"known": sorted(known)}
                )
            if evidence_type == EvidenceType.RESIDENT_ORIGINAL:
                raise GuardError("Execution evidence không được mang type RESIDENT_ORIGINAL")
            if evidence_type == EvidenceType.SIMULATED_IMAGE and len(execution_photos(work)) >= MAX_EXECUTION_PHOTOS:
                raise GuardError(f"Mỗi lần xử lý tối đa {MAX_EXECUTION_PHOTOS} ảnh")
            record = EvidenceRecord(
                evidence_id=f"SIM-EVD-{_suffix(ticket_id)}-{len(work.evidence) + 1:02d}",
                ticket_id=ticket_id,
                work_order_draft_id=draft.work_order_draft_id,
                requirement_id=requirement_id,
                evidence_type=evidence_type,
                content_or_metadata=content_or_metadata,
                source=EvidenceSource.DEPARTMENT_EXECUTION,
                submitted_by=actor_id,
                submitted_at=now,
                readability_status=readability_status,
            )
            work.evidence.append(record)
            self._audit(
                work,
                Action.ADD_EVIDENCE,
                "EvidenceRecord",
                record.evidence_id,
                actor_id,
                Role.DEPARTMENT,
                "evidence",
                None,
                {"requirement_id": requirement_id, "evidence_type": evidence_type},
                "Thêm ghi chú xử lý mô phỏng",
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.ADD_EVIDENCE, op)

    def report_complete(self, ticket_id: str, actor_id: str) -> Case:
        """'Báo hoàn thành' → step 10 reconciliation. Pass: READY_FOR_REVIEW. Fail: stays IN_PROGRESS, the
        failing items go back to the department in `draft.readiness_evaluation` and a notification; no blocker."""

        def op(work: Case, now: datetime) -> None:
            self._require_in_progress(work)
            self._audit(
                work,
                Action.REPORT_COMPLETE,
                "Ticket",
                ticket_id,
                actor_id,
                Role.DEPARTMENT,
                "status",
                None,
                "REPORTED_COMPLETE",
                "Phòng ban báo hoàn thành",
                now=now,
            )
            evaluation = self._reconcile(work, now)
            self._agent(
                work,
                Action.RECONCILE,
                "WorkOrderDraft",
                work.draft.work_order_draft_id,
                "readiness_evaluation",
                None,
                {"all_pass": evaluation.all_pass, "failing_items": evaluation.failing_items},
                "Đối soát bước 10",
                now=now,
            )
            if evaluation.all_pass:
                self._apply_transition(work, S.READY_FOR_REVIEW, AGENT_ID, Role.AGENT, now, note="Đối soát đạt")
            else:
                self._notify(
                    work,
                    "department.reconcile_failed",
                    BlockerOwner.DEPARTMENT,
                    now,
                    {"failing_items": evaluation.failing_items},
                )

        return self._mutate(ticket_id, actor_id, Action.REPORT_COMPLETE, op)

    # ------------------------------------------------------------------ BQL

    def close(self, ticket_id: str, actor_id: str, *, note: str | None = None) -> Case:
        return self.transition(ticket_id, S.CLOSED, actor_id, note=note)

    def rework(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        return self.transition(ticket_id, S.IN_PROGRESS, actor_id, note=note, expected_from=S.READY_FOR_REVIEW)

    def cancel(self, ticket_id: str, actor_id: str, *, cancel_reason: str) -> Case:
        return self.transition(ticket_id, S.CANCELLED, actor_id, cancel_reason=cancel_reason)

    # ------------------------------------------------------------------ warehouse

    def receive_stock(self, actor_id: str, item_code: str, qty: float) -> list[Case]:
        """Event `stock_received`: raise simulated stock, then resume every ticket waiting for that item."""
        if self.catalog.actor_role(actor_id) != Role.WAREHOUSE:
            raise ActionDeniedError("Chỉ kho được nhập vật tư", {"code": "ACTION_DENIED", "actor_id": actor_id})
        if self.catalog.material(item_code) is None:
            raise NotFoundError(f"Không có vật tư {item_code} trong catalog")
        if qty <= 0:
            raise GuardError("Số lượng nhập phải > 0")
        self.stock[item_code] = (self.stock.get(item_code) or 0) + qty
        waiting = [
            case.ticket.ticket_id
            for case in self.cases.values()
            if case.ticket.blocker is not None
            and case.ticket.blocker.code == R.WAITING_MATERIAL
            and any(line.item_code == item_code for line in case.material_lines)
        ]
        return [self.resume(ticket_id) for ticket_id in waiting]

    # ------------------------------------------------------------------ system: resume + scheduled job

    def resume(self, ticket_id: str) -> Case:
        """Clear the blocker if its condition is met and continue. Idempotent: a second call changes nothing."""
        return self._mutate(ticket_id, SYSTEM_ID, Action.RUN_PIPELINE, lambda work, now: self._resume(work, now))

    def run_jobs(self, now: datetime | None = None) -> list[str]:
        """The 5-minute job: tickets whose `next_retry_at` or `escalate_at` is due, plus ROUTED tickets nobody
        accepted. Returns the ticket IDs that changed."""
        moment = now or self.clock()
        changed = []
        with self.at(moment):
            for ticket_id in list(self.cases):
                before = len(self.cases[ticket_id].events)
                self._mutate(ticket_id, SYSTEM_ID, Action.RUN_JOBS, lambda work, now: self._tick(work, now))
                if len(self.cases[ticket_id].events) != before:
                    changed.append(ticket_id)
        return changed

    # ------------------------------------------------------------------ the one transition entry point

    def transition(
        self,
        ticket_id: str,
        to: TicketStatus,
        actor_id: str,
        *,
        note: str | None = None,
        eta: datetime | None = None,
        cancel_reason: str | None = None,
        expected_from: TicketStatus | None = None,
    ) -> Case:
        """Change status on behalf of a person (department, BQL, BPTN, resident). Checks the CR §3 table.

        A role that may never reach `to` is denied and audited (e.g. anyone but BQL closing). A role that may reach
        `to`, but not from the current status, gets INVALID_TRANSITION. `expected_from` pins the source for the
        named actions that share a target (accept / resume_work / rework all lead to IN_PROGRESS).
        """
        case = self.get(ticket_id)
        now = self.clock()
        role = self._role(actor_id)
        current = case.ticket.status
        reachable = {
            actor
            for (_, target), rule in TRANSITIONS.items()
            if target == to and not rule.pipeline_only
            for actor in rule.actors
        }
        if role is None or role not in reachable:
            self._deny(
                case,
                actor_id,
                role,
                Action.TRANSITION,
                "status",
                to,
                note,
                now,
                message=f"{role or 'actor không xác định'} không được chuyển sang {to}",
            )
        rule = TRANSITIONS.get((current, to))
        if rule is None or rule.pipeline_only or role not in rule.actors or expected_from not in (None, current):
            raise InvalidTransitionError(
                f"Không chuyển được {current} → {to}", {"from": current, "to": to, "actor_role": role}
            )

        def op(work: Case, now: datetime) -> None:
            self._human_transition(work, to, actor_id, role, now, note=note, eta=eta, cancel_reason=cancel_reason)

        return self._mutate(
            ticket_id, actor_id, Action.TRANSITION, op, roles=rule.actors, field_name="status", new_value=to
        )

    def attempt(
        self, ticket_id: str, actor_id: str, action: Action, *, field_name: str, new_value: Any, reason: str
    ) -> Case:
        """Entry point for actions outside every role's authority (edit raw, edit catalog, adjust inventory...).
        They always end in ACTION_DENIED; the method exists so the denial path can be exercised and audited."""
        return self._mutate(
            ticket_id,
            actor_id,
            action,
            lambda work, now: None,
            roles=frozenset(),
            field_name=field_name,
            new_value=new_value,
            reason=reason,
        )

    # ------------------------------------------------------------------ transaction + permission

    def _role(self, actor_id: str) -> ActorRole | None:
        return self.catalog.actor_role(actor_id)

    def _mutate(
        self,
        ticket_id: str,
        actor_id: str,
        action: Action,
        op: Callable[[Case, datetime], None],
        *,
        roles: frozenset[ActorRole] | None = None,
        field_name: str = "-",
        new_value: Any = None,
        reason: str | None = None,
    ) -> Case:
        case = self.get(ticket_id)
        now = self.clock()
        role = self._role(actor_id)
        allowed = PERMISSIONS.get(action, frozenset()) if roles is None else roles
        if role is None or role not in allowed:
            self._deny(case, actor_id, role, action, field_name, new_value, reason, now)
        scope_error = self._scope_error(case, actor_id, role)
        if scope_error:
            self._deny(case, actor_id, role, action, field_name, new_value, reason, now, message=scope_error)

        if case.ticket.raw.integrity_marker() != case.ticket.raw_integrity_marker:
            raise EngineError("Raw integrity marker không khớp; dừng xử lý (fail closed)")

        work = case.model_copy(deep=True)
        marks = (len(work.audit), len(work.events), len(work.notifications))
        op(work, now)
        self._commit(work, *marks)
        return work

    def _commit(self, work: Case, audit_from: int, events_from: int, notes_from: int) -> None:
        try:
            self.audit_sink([*work.audit[audit_from:], *work.events[events_from:]])
        except Exception as exc:  # audit failure → nothing is committed
            raise AuditWriteError("Không ghi được audit; thay đổi bị huỷ", {"error": str(exc)}) from exc
        self.cases[work.ticket.ticket_id] = work
        new_notifications = work.notifications[notes_from:]
        if new_notifications:
            self.notify_sink(new_notifications)

    def _scope_error(self, case: Case, actor_id: str, role: ActorRole | None) -> str | None:
        """A department acts only on its own tickets; a resident only on the tickets they reported."""
        if role == Role.DEPARTMENT:
            actor = self.catalog.actor(actor_id)
            if actor.department_id is None or actor.department_id != case.ticket.department_id:
                return f"Ticket không thuộc phòng ban của {actor_id}"
        if role == Role.RESIDENT and actor_id != case.ticket.resident_id:
            return f"Ticket không do {actor_id} phản ánh"
        return None

    def _deny(
        self,
        case: Case,
        actor_id: str,
        role: ActorRole | None,
        action: Action,
        field_name: str,
        new_value: Any,
        reason: str | None,
        now: datetime,
        *,
        message: str | None = None,
    ) -> None:
        event = self._make_audit(
            case,
            Action.ACTION_DENIED,
            "Ticket",
            case.ticket.ticket_id,
            actor_id,
            role or Role.SYSTEM,
            field_name,
            None,
            new_value,
            reason or message or f"Yêu cầu {action} ngoài quyền",
            now=now,
            result=ActionResult.ACTION_DENIED,
            rule_id="PB-COM-R-PERM-01",
            extra_reason=f"requested={action}",
        )
        try:
            self.audit_sink([event])
        except Exception as exc:
            raise AuditWriteError("Không ghi được audit cho lần từ chối", {"error": str(exc)}) from exc
        denied = case.model_copy(deep=True)
        denied.audit.append(event)
        self.cases[case.ticket.ticket_id] = denied
        raise ActionDeniedError(
            message or f"{action} ngoài quyền của {role or 'actor không xác định'}",
            {
                "decision": "DENY",
                "code": "ACTION_DENIED",
                "requested_action": action,
                "actor_id": actor_id,
                "actor_role": role,
                "target_field": field_name,
                "unchanged_status": case.ticket.status,
                "audit_event_id": event.event_id,
            },
        )

    # ------------------------------------------------------------------ audit, events, notifications

    def _make_audit(
        self,
        work: Case,
        action: Action,
        entity_type: str,
        entity_id: str,
        actor_id: str,
        role: ActorRole,
        field_name: str,
        old: Any,
        new: Any,
        reason: str,
        *,
        now: datetime,
        result: ActionResult = ActionResult.ALLOWED,
        rule_id: str | None = None,
        extra_reason: str | None = None,
    ) -> AuditEvent:
        return AuditEvent(
            event_id=f"SIM-AUD-{_suffix(work.ticket.ticket_id)}-{len(work.audit) + 1:04d}",
            ticket_id=work.ticket.ticket_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            actor_role=role,
            timestamp=now,
            field_name=field_name,
            old_value=_plain(old),
            new_value=_plain(new),
            reason=f"{reason} ({extra_reason})" if extra_reason else reason,
            action_result=result,
            rule_id=rule_id,
            playbook_version=PLAYBOOK_VERSION if work.proposal else None,
            run_id=self.run_id,
        )

    def _audit(self, work: Case, *args: Any, now: datetime, rule_id: str | None = None) -> None:
        work.audit.append(self._make_audit(work, *args, now=now, rule_id=rule_id))

    def _agent(
        self,
        work: Case,
        action: Action,
        entity_type: str,
        entity_id: str,
        field_name: str,
        old: Any,
        new: Any,
        reason: str,
        *,
        now: datetime,
        rule_id: str | None = None,
    ) -> None:
        self._audit(
            work,
            action,
            entity_type,
            entity_id,
            AGENT_ID,
            Role.AGENT,
            field_name,
            old,
            new,
            reason,
            now=now,
            rule_id=rule_id,
        )

    def _record_event(
        self,
        work: Case,
        from_status: TicketStatus | None,
        to_status: TicketStatus,
        reason: ReasonCode | None,
        actor_id: str | None,
        role: ActorRole,
        now: datetime,
        *,
        public: bool,
        note: str | None = None,
    ) -> None:
        blocker = work.ticket.blocker
        message = blocker.public_message if blocker else self._status_message(work)
        work.events.append(
            StatusEvent(
                id=f"SIM-EVT-{_suffix(work.ticket.ticket_id)}-{len(work.events) + 1:04d}",
                ticket_id=work.ticket.ticket_id,
                from_status=from_status,
                to_status=to_status,
                reason_code=reason,
                actor_role=role,
                actor_id=actor_id,
                public_message=message,
                internal_note=None if _blank(note) else note.strip(),
                public=public,
                created_at=now,
            )
        )

    def _notify(self, work: Case, kind: str, audience: BlockerOwner, now: datetime, payload: dict[str, Any]) -> None:
        work.notifications.append(
            Notification(
                notification_id=f"SIM-NTF-{_suffix(work.ticket.ticket_id)}-{len(work.notifications) + 1:04d}",
                ticket_id=work.ticket.ticket_id,
                type=kind,
                audience=audience,
                payload=_plain(payload),
                created_at=now,
            )
        )

    def _department_config(self, work: Case):
        """The department whose hours apply: the assigned one, or before step 8 the proposed one."""
        ticket = work.ticket
        return self.catalog.department(ticket.department_id or ticket.proposed_department_id)

    def _department_name(self, work: Case) -> str:
        department = work.ticket.department_id
        return self.catalog.department(department).name if department else "phòng ban phụ trách"

    def _status_message(self, work: Case) -> str:
        ticket = work.ticket
        return public_message(
            ticket.status,
            department=self._department_name(work),
            merged_into=ticket.merged_into,
            cancel_reason=ticket.cancel_reason,
        )

    # ------------------------------------------------------------------ transitions and blockers

    def _set_ticket(self, work: Case, **changes: Any) -> None:
        """Apply several ticket fields at once, so the cross-field validators see the final combination."""
        work.ticket = Ticket.model_validate({**work.ticket.model_dump(), **changes})

    def _apply_transition(
        self,
        work: Case,
        to: TicketStatus,
        actor_id: str,
        role: ActorRole,
        now: datetime,
        *,
        blocker: Blocker | None = None,
        note: str | None = None,
        **changes: Any,
    ) -> None:
        """The only place a status changes: validate against TRANSITIONS, write one event, notify."""
        current = work.ticket.status
        rule = TRANSITIONS.get((current, to))
        if rule is None:
            raise InvalidTransitionError(f"Transition {current} → {to} không hợp lệ", {"from": current, "to": to})
        if role not in rule.actors:
            raise InvalidTransitionError(f"{role} không được chuyển {current} → {to}", {"actor_role": role})
        reason = blocker.code if blocker else None
        if (rule.reason_required and reason is None) or (reason is not None and reason not in rule.reasons):
            raise InvalidTransitionError(f"Lý do {reason} không hợp lệ cho {current} → {to}")
        if to == S.ROUTED:
            failing = route_blockers(work.ticket)
            if failing:
                raise InvalidTransitionError("Chưa đủ điều kiện giao phòng ban (can_route)", {"failing": failing})
            if changes.get("department_id") != work.ticket.proposed_department_id:
                raise InvalidTransitionError("department_id khi giao phải bằng proposed_department_id")
        self._set_ticket(work, status=to, blocker=blocker, **changes)
        self._record_event(work, current, to, reason, actor_id, role, now, public=True, note=note)
        self._notify(
            work,
            "ticket.status_changed",
            BlockerOwner.RESIDENT,
            now,
            {"from": current, "to": to, "reason_code": reason},
        )

    def _set_blocker(
        self,
        work: Case,
        blocker: Blocker | None,
        actor_id: str,
        role: ActorRole,
        now: datetime,
        *,
        note: str | None = None,
        **changes: Any,
    ) -> None:
        """Blocker change without a status change (ROUTED + OUT_OF_HOURS cleared, retries, escalation).

        Still one event; shown to the resident only when the blocker itself was set, cleared or replaced.
        """
        old = work.ticket.blocker
        self._set_ticket(work, blocker=blocker, **changes)
        status = work.ticket.status
        code = (blocker or old).code if (blocker or old) else None
        public = (old.code if old else None) != (blocker.code if blocker else None)
        self._record_event(work, status, status, code, actor_id, role, now, public=public, note=note)

    def _new_blocker(
        self,
        work: Case,
        code: ReasonCode,
        now: datetime,
        *,
        resume_step: int | None = None,
        note: str | None = None,
        eta: datetime | None = None,
        related_ticket_id: str | None = None,
        fields: list[str] | None = None,
    ) -> Blocker:
        sla = self.catalog.sla_config
        next_retry_at, escalate_at, dispatch_at = self._schedule(work, code, now, eta), None, None
        if code == R.MISSING_INFO:
            escalate_at = now + timedelta(hours=sla.missing_info.escalate_after_hours)
        elif code in BPTN_REASONS:
            escalate_at = self.catalog.business_hours.add(now, sla.bptn.escalate_after_business_hours)
        elif code == R.WAITING_MATERIAL:
            escalate_at = now + timedelta(hours=sla.waiting_material.escalate_after_hours)
            eta = eta or escalate_at
        elif code == R.OUT_OF_HOURS:
            dispatch_at = next_retry_at
        elif code == R.BLOCKED_ONSITE:
            escalate_at = eta
        message = public_message(
            work.ticket.status,
            code,
            department=self._department_name(work),
            fields=", ".join(field_label(f) for f in fields or []),
            eta=eta,
            dispatch_at=dispatch_at,
        )
        return Blocker(
            code=code,
            owner_role=BLOCKER_OWNERS[code],
            since=now,
            resume_step=resume_step,
            next_retry_at=next_retry_at,
            escalate_at=escalate_at,
            eta=eta,
            public_message=message,
            internal_note=None if _blank(note) else note.strip(),
            related_ticket_id=related_ticket_id,
        )

    def _schedule(self, work: Case, code: ReasonCode, now: datetime, eta: datetime | None = None) -> datetime | None:
        """When the job should next retry / remind for this blocker. None = no automatic retry."""
        sla = self.catalog.sla_config
        if code == R.MISSING_INFO:
            return now + timedelta(hours=sla.missing_info.retry_every_hours)
        if code in BPTN_REASONS:
            return self.catalog.business_hours.add(now, sla.bptn.retry_every_business_hours)
        if code in (R.WAITING_MATERIAL, R.OUT_OF_HOURS):
            return self._department_config(work).next_shift_start(now)
        if code == R.NOT_ACCEPTED:
            return now + timedelta(hours=sla.not_accepted.retry_every_hours)
        return None  # BLOCKED_ONSITE (escalates at eta), REWORK (escalates on count)

    def _stop(
        self,
        work: Case,
        to: TicketStatus,
        code: ReasonCode,
        now: datetime,
        *,
        resume_step: int,
        actor_id: str = AGENT_ID,
        role: ActorRole = Role.AGENT,
        **blocker_args: Any,
    ) -> bool:
        """Pipeline stop: enter a side status with a blocker. Returns True so the step loop ends."""
        blocker = self._new_blocker(work, code, now, resume_step=resume_step, **blocker_args)
        self._apply_transition(work, to, actor_id, role, now, blocker=blocker, note=blocker.internal_note)
        return True

    def _human_transition(
        self,
        work: Case,
        to: TicketStatus,
        actor_id: str,
        role: ActorRole,
        now: datetime,
        *,
        note: str | None = None,
        eta: datetime | None = None,
        cancel_reason: str | None = None,
    ) -> None:
        """Guards and side effects of each human-driven row of the CR §3 table."""
        ticket = work.ticket
        key = (ticket.status, to)
        blocker = ticket.blocker

        if to == S.CANCELLED:
            if _blank(cancel_reason):
                raise GuardError("cancel_reason bắt buộc khi hủy")
            self._apply_transition(work, to, actor_id, role, now, note=note, cancel_reason=cancel_reason.strip())
        elif key == (S.ROUTED, S.IN_PROGRESS):
            self._apply_transition(work, to, actor_id, role, now, note=note, accepted_at=now)
        elif key == (S.ROUTED, S.VERIFYING):
            if _blank(note):
                raise GuardError("Trả lại sai phòng ban phải có lý do")
            # resume_step is decided by BPTN's answer: 6 if the category changes, 7 if not (never 8)
            wrong = self._new_blocker(work, R.WRONG_DEPT, now, resume_step=6, note=note)
            self._apply_transition(
                work, to, actor_id, role, now, blocker=wrong, note=note, department_id=None, dispatched_at=None
            )
        elif key == (S.IN_PROGRESS, S.ON_HOLD):
            if _blank(note) or eta is None:
                raise GuardError("BLOCKED_ONSITE bắt buộc lý do và eta")
            if eta.tzinfo is None or eta <= now:
                raise GuardError("eta phải có timezone và ở tương lai")
            onsite = self._new_blocker(work, R.BLOCKED_ONSITE, now, note=note, eta=eta)
            self._apply_transition(work, to, actor_id, role, now, blocker=onsite, note=note)
        elif key == (S.ON_HOLD, S.IN_PROGRESS):
            if blocker is None or blocker.code != R.BLOCKED_ONSITE:
                raise InvalidTransitionError("Chỉ tiếp tục được khi đang tạm hoãn tại hiện trường (BLOCKED_ONSITE)")
            self._apply_transition(work, to, actor_id, role, now, note=note)
        elif key == (S.READY_FOR_REVIEW, S.CLOSED):
            reopen_until = now + timedelta(days=self.catalog.sla_config.reopen_window_days)
            self._apply_transition(
                work, to, actor_id, role, now, note=note, closed_by=actor_id, closed_at=now, reopen_until=reopen_until
            )
        elif key == (S.READY_FOR_REVIEW, S.IN_PROGRESS):
            if _blank(note):
                raise GuardError("Trả lại làm lại (REWORK) phải có lý do")
            count = ticket.rework_count + 1
            rework = self._new_blocker(work, R.REWORK, now, note=note)
            escalate = count >= self.catalog.sla_config.rework.escalate_at_count
            rework.escalated = escalate
            for item in work.checklist_items:
                item.status, item.updated_by, item.updated_at = ChecklistStatus.PENDING, None, None
            self._apply_transition(work, to, actor_id, role, now, blocker=rework, note=note, rework_count=count)
            if escalate:
                self._notify(
                    work, "escalation", BlockerOwner.BQL, now, {"reason_code": R.REWORK, "rework_count": count}
                )
        elif key == (S.CLOSED, S.READY_FOR_REVIEW):
            if ticket.reopen_until is None or now >= ticket.reopen_until:
                raise GuardError("Đã quá hạn báo chưa xong", {"reopen_until": ticket.reopen_until})
            self._apply_transition(
                work, to, actor_id, role, now, note=note, closed_by=None, closed_at=None, reopen_until=None
            )
        elif key == (S.VERIFYING, S.MERGED):
            if blocker is None or blocker.code != R.DUPLICATE:
                raise InvalidTransitionError("Chỉ gộp được ticket đang chờ xác nhận trùng (DUPLICATE)")
            self._apply_transition(work, to, actor_id, role, now, note=note, merged_into=blocker.related_ticket_id)
        else:
            raise InvalidTransitionError(f"Không chuyển được {ticket.status} → {to}")

    # ------------------------------------------------------------------ resume and scheduled checks

    def _cleared(self, work: Case, blocker: Blocker, now: datetime) -> bool:
        code = blocker.code
        if code == R.MISSING_INFO:
            return not self._missing_fields(work)
        if code in BPTN_REASONS:
            return blocker.resolved_at is not None
        if code == R.WAITING_MATERIAL:
            return not any(
                self._line_stock(line.item_code, line.planned_qty) == MaterialStockStatus.INSUFFICIENT
                for line in work.material_lines
            )
        if code == R.OUT_OF_HOURS:
            return self.catalog.department(work.ticket.department_id).on_shift(now)
        return False  # NOT_ACCEPTED, BLOCKED_ONSITE, REWORK clear through their own transitions

    def _resume(self, work: Case, now: datetime) -> bool:
        blocker = work.ticket.blocker
        if blocker is None or not self._cleared(work, blocker, now):
            return False
        code = blocker.code
        if code == R.OUT_OF_HOURS:
            self._set_blocker(work, None, SYSTEM_ID, Role.SYSTEM, now, note="Đầu ca phòng ban", dispatched_at=now)
            self._notify(
                work, "department.dispatch", BlockerOwner.DEPARTMENT, now, {"department_id": work.ticket.department_id}
            )
            return True
        resume_step = {R.MISSING_INFO: 2, R.WAITING_MATERIAL: 7}.get(code, blocker.resume_step)
        self._apply_transition(work, S.RECEIVED, SYSTEM_ID, Role.SYSTEM, now, note=f"Gỡ {code}")
        self._run_pipeline(work, resume_step, now)
        return True

    def _tick(self, work: Case, now: datetime) -> None:
        ticket = work.ticket
        sla = self.catalog.sla_config
        blocker = ticket.blocker
        if blocker is None:
            waited = ticket.dispatched_at and now >= ticket.dispatched_at + timedelta(
                hours=sla.not_accepted.start_after_hours
            )
            if ticket.status == S.ROUTED and ticket.accepted_at is None and waited:
                nudge = self._new_blocker(work, R.NOT_ACCEPTED, now)
                nudge.auto_retry_count = 1
                self._set_blocker(work, nudge, SYSTEM_ID, Role.SYSTEM, now, note="Nhắc trưởng phòng lần 1")
                self._notify(work, "reminder", BlockerOwner.DEPARTMENT, now, {"reason_code": R.NOT_ACCEPTED})
            return

        if blocker.next_retry_at and blocker.next_retry_at <= now:
            if self._resume(work, now):
                return
            if blocker.auto_retry_count >= sla.max_auto_retries:
                self._escalate(work, now, f"Quá {sla.max_auto_retries} lần tự chạy lại/nhắc")
            else:
                count = blocker.auto_retry_count + 1
                retried = blocker.model_copy(
                    update={"auto_retry_count": count, "next_retry_at": self._schedule(work, blocker.code, now)}
                )
                self._set_blocker(work, retried, SYSTEM_ID, Role.SYSTEM, now, note=f"Tự chạy lại/nhắc lần {count}")
                self._notify(work, "reminder", blocker.owner_role, now, {"reason_code": blocker.code})
        blocker = work.ticket.blocker
        if blocker and blocker.escalate_at and blocker.escalate_at <= now and not blocker.escalated:
            self._escalate(work, now, "Quá mốc leo thang")

    def _escalate(self, work: Case, now: datetime, why: str) -> None:
        """Flag and notify BQL. Never cancels, closes or otherwise changes the status."""
        blocker = work.ticket.blocker
        escalated = blocker.model_copy(update={"escalated": True, "next_retry_at": None})
        if escalated == blocker:
            return
        self._set_blocker(work, escalated, SYSTEM_ID, Role.SYSTEM, now, note=f"Leo thang: {why}")
        if not blocker.escalated:
            self._notify(work, "escalation", BlockerOwner.BQL, now, {"reason_code": blocker.code, "why": why})

    # ------------------------------------------------------------------ pipeline (steps 2–8)

    def _run_pipeline(self, work: Case, from_step: int, now: datetime) -> None:
        if work.ticket.status != S.RECEIVED:
            raise EngineError(f"Pipeline chạy khi ticket ở {work.ticket.status}")
        steps = (
            (2, self._step_check_data),
            (3, self._step_duplicate),
            (4, self._step_classify),
            (5, self._step_review),
            (6, self._step_asset),
            (7, self._step_material),
            (8, self._step_route),
        )
        for number, step in steps:
            if number >= from_step and step(work, now):
                return
        raise EngineError("Pipeline kết thúc mà không route hoặc dừng")

    def _content(self, work: Case) -> str:
        """Original report plus resident additions: what the Agent reads. The original itself never changes."""
        parts = [work.ticket.raw.original_description, *(a.content for a in work.additions)]
        return "\n".join(p for p in parts if p and p.strip())

    def effective_location(self, work: Case) -> str | None:
        return work.ticket.locked_fields.location or extract_location(self._content(work))

    def _category(self, work: Case) -> ServiceCategory | None:
        locked = work.ticket.locked_fields.category
        if locked:
            return locked
        cls = work.classification
        return cls.service_category if cls and cls.playbook_id else None

    def _missing_fields(self, work: Case) -> list[str]:
        raw = work.ticket.raw
        missing = []
        if _blank(raw.ticket_id) or not raw.ticket_id.startswith("SIM-TKT-"):
            missing.append("ticket_id")
        if _created_at(raw) is None:
            missing.append("created_at")
        if _blank(self._content(work)):
            missing.append("description")
        if self.effective_location(work) is None:
            parts = missing_location_parts(self._content(work))
            # name only the parts still missing; a report with none of them gets the general request
            missing.extend(["location"] if len(parts) == 3 else [f"location_{part}" for part in parts])
        return missing

    def _step_check_data(self, work: Case, now: datetime) -> bool:
        missing = self._missing_fields(work)
        if missing:
            return self._stop(
                work,
                S.NEED_INFO,
                R.MISSING_INFO,
                now,
                resume_step=2,
                actor_id=SYSTEM_ID,
                role=Role.SYSTEM,
                fields=missing,
                note=f"Thiếu: {', '.join(missing)}",
            )
        return False

    def _classification(self, work: Case, now: datetime) -> ClassificationRecord:
        if work.classification is None:
            outcome = propose(
                self._content(work), self.llm, self.llm_label, ticket_id=work.ticket.ticket_id
            )  # the only place the LLM is called
            result = outcome.classification
            work.classification = ClassificationRecord(
                playbook_id=result.playbook_id,
                service_category=result.service_category,
                ticket_type=result.ticket_type,
                rule_id=result.rule_id,
                reason=result.reason,
                reason_code=result.reason_code,
                needs_review=outcome.needs_review,
                proposer=outcome.proposer,
                notes=outcome.notes,
            )
            self._agent(
                work,
                Action.CREATE_PROPOSAL,
                "Ticket",
                work.ticket.ticket_id,
                "classification",
                None,
                work.classification,
                result.reason,
                now=now,
                rule_id=result.rule_id,
            )
        return work.classification

    def _step_duplicate(self, work: Case, now: datetime) -> bool:
        if work.ticket.locked_fields.category is None:
            self._classification(work, now)
        category, location = self._category(work), self.effective_location(work)
        if category is None or location is None:
            return False  # step 4 decides what to do with an unclear category
        mine = (_created_at(work.ticket.raw), work.ticket.ticket_id)
        window = timedelta(hours=self.catalog.sla_config.duplicate_window_hours)
        candidates = sorted(
            (
                (_created_at(other.ticket.raw), other.ticket.ticket_id)
                for other in self.cases.values()
                if other.ticket.ticket_id != work.ticket.ticket_id
                and other.ticket.ticket_id not in work.not_duplicate_of
                and other.ticket.status not in TERMINAL_STATUSES
                and _created_at(other.ticket.raw) is not None
                and self._category(other) == category
                and self.effective_location(other) == location
            ),
        )
        for created, ticket_id in candidates:
            if (created, ticket_id) < mine and mine[0] - created <= window:
                return self._stop(
                    work,
                    S.VERIFYING,
                    R.DUPLICATE,
                    now,
                    resume_step=4,
                    related_ticket_id=ticket_id,
                    note=f"Cùng vị trí và loại với {ticket_id} trong {window}",
                )
        return False

    def _step_classify(self, work: Case, now: datetime) -> bool:
        locked = work.ticket.locked_fields.category
        if locked:
            self._bind_category(work, locked, "BPTN_LOCKED", now)  # BPTN already chose; never reclassify
            return False
        cls = self._classification(work, now)
        if cls.playbook_id is None:
            return self._stop(
                work, S.VERIFYING, cls.reason_code or R.CATEGORY_UNCLEAR, now, resume_step=6, note=cls.reason
            )
        self._bind_category(work, cls.service_category, "AGENT", now)
        return False

    def _bind_category(self, work: Case, category: ServiceCategory, source: str, now: datetime) -> None:
        """Proposal + department for a category. The department comes from the playbook → department table."""
        ticket_type, playbook_id = PLAYBOOK_BY_CATEGORY[category]
        location = self.effective_location(work)
        existing = work.proposal
        if existing and existing.playbook_id == playbook_id:
            existing.location_proposed = location
            if source == "BPTN_LOCKED":
                existing.category_source = source
        else:
            cls = work.classification
            technical = playbook_id == PlaybookId.TEC
            agent_made = source == "AGENT" and cls is not None
            work.proposal = AgentClassificationProposal(
                proposal_id=f"SIM-ACP-{_suffix(work.ticket.ticket_id)}",
                ticket_id=work.ticket.ticket_id,
                proposal_revision=(existing.proposal_revision + 1) if existing else 1,
                service_category_proposed=category,
                ticket_type_proposed=ticket_type,
                playbook_id=playbook_id,
                category_source=source,
                asset_type="LIGHTING" if technical else None,
                reported_symptom="NOT_WORKING" if technical else None,
                location_proposed=location,
                matched_rule_ids=[cls.rule_id] if agent_made else ["PB-COM-R-OVR-01"],
                classification_reason=cls.reason if agent_made else "Category do BPTN chọn (locked_fields)",
                source_references=["ticket.original_description", "ticket_resident_additions"]
                if agent_made
                else ["locked_fields.category"],
                created_at=now,
            )
        self._propose_department(work, now)

    def _propose_department(self, work: Case, now: datetime) -> None:
        """Step 4: only a proposal. `department_id` is written at step 8, after review and asset lookup."""
        ticket = work.ticket
        department = ticket.locked_fields.department or self.catalog.department_for(work.proposal.playbook_id)
        if ticket.proposed_department_id != department:
            self._agent(
                work,
                Action.CREATE_PROPOSAL,
                "Ticket",
                ticket.ticket_id,
                "proposed_department_id",
                ticket.proposed_department_id,
                department,
                "BPTN chọn phòng ban" if ticket.locked_fields.department else f"Playbook → {department}",
                now=now,
            )
            ticket.proposed_department_id = department

    def _step_review(self, work: Case, now: datetime) -> bool:
        ticket = work.ticket
        if ticket.review_status == ReviewStatus.CONFIRMED:
            return False
        cls = work.classification
        if cls is not None and cls.needs_review:
            ticket.review_status = ReviewStatus.PENDING_REVIEW
            return self._stop(
                work,
                S.VERIFYING,
                R.PENDING_REVIEW,
                now,
                resume_step=6,
                note="Playbook chỉ do LLM đề xuất; cần BPTN xác nhận",
            )
        ticket.review_status = ReviewStatus.NOT_REQUIRED
        return False

    def _step_asset(self, work: Case, now: datetime) -> bool:
        proposal, ticket = work.proposal, work.ticket
        location = self.effective_location(work)
        if proposal.playbook_id != PlaybookId.TEC:
            status, asset_id, reason = AssetLookupStatus.NOT_APPLICABLE, None, "Vệ sinh không tra tài sản"
        elif ticket.locked_fields.asset_id:
            status, asset_id, reason = AssetLookupStatus.LOCKED_BY_BPTN, ticket.locked_fields.asset_id, "BPTN chọn"
        elif TicketFlag.ASSET_CHECK_ONSITE in ticket.flags:
            status, asset_id, reason = AssetLookupStatus.CHECK_ONSITE, None, "BPTN: không xác định được, kiểm tại chỗ"
        else:
            matches = [
                a for a in self.catalog.assets if a.asset_type == "LIGHTING" and a.location_normalized == location
            ]
            if len(matches) == 1:
                status, asset_id = AssetLookupStatus.MATCHED, matches[0].asset_id
                reason = f"Một asset LIGHTING khớp vị trí ({matches[0].source_ref})"
            elif matches:
                status, asset_id, reason = AssetLookupStatus.AMBIGUOUS, None, f"{len(matches)} asset cùng vị trí"
            else:
                status, asset_id, reason = AssetLookupStatus.NOT_FOUND, None, "Không có asset LIGHTING tại vị trí"
        proposal.asset_lookup_status, proposal.asset_id, proposal.asset_match_reason = status, asset_id, reason
        ticket.asset_resolution = {
            AssetLookupStatus.NOT_APPLICABLE: AssetResolution.NOT_APPLICABLE,
            AssetLookupStatus.MATCHED: AssetResolution.FOUND,
            AssetLookupStatus.LOCKED_BY_BPTN: AssetResolution.FOUND,
            AssetLookupStatus.CHECK_ONSITE: AssetResolution.ONSITE_BY_BPTN,  # only BPTN sets the flag
        }.get(status)
        self._agent(
            work,
            Action.LOOKUP_ASSET,
            "AgentClassificationProposal",
            proposal.proposal_id,
            "asset_lookup_status",
            None,
            {"status": status, "asset_id": asset_id},
            reason,
            now=now,
        )
        if status in (AssetLookupStatus.NOT_FOUND, AssetLookupStatus.AMBIGUOUS):
            return self._stop(work, S.VERIFYING, R.ASSET_UNCLEAR, now, resume_step=6, note=reason)
        return False

    def _line_stock(self, item_code: str, planned_qty: float) -> MaterialStockStatus:
        stock = self.stock.get(item_code)
        if stock is None:
            return MaterialStockStatus.UNKNOWN
        return MaterialStockStatus.INSUFFICIENT if stock < planned_qty else MaterialStockStatus.SUFFICIENT

    def _step_material(self, work: Case, now: datetime) -> bool:
        playbook_id = work.proposal.playbook_id
        if work.planned_for_playbook not in (None, playbook_id):
            work.planned_materials = None  # the previous plan belonged to the other playbook
        if work.planned_materials is None:
            work.planned_materials = list(self.catalog.default_materials.get(playbook_id, ()))
            source = f"vật tư mặc định của {playbook_id}"
        else:
            source = "kế hoạch vật tư của ticket"
        work.planned_for_playbook = playbook_id
        suffix = _suffix(work.ticket.ticket_id)
        work.material_lines = [
            self._material_line(f"SIM-WOD-{suffix}", suffix, index, planned)
            for index, planned in enumerate(work.planned_materials, start=1)
        ]
        status = _aggregate_stock(work.material_lines)
        self._agent(
            work,
            Action.CHECK_MATERIAL_STOCK,
            "Ticket",
            work.ticket.ticket_id,
            "material_stock_status",
            None,
            status,
            f"So vật tư dự kiến ({source}) với định mức và tồn kho mô phỏng",
            now=now,
        )
        flags = [f for f in work.ticket.flags if f != TicketFlag.STOCK_CHECK_ON_ACCEPT]
        if status == MaterialStockStatus.UNKNOWN:
            flags.append(TicketFlag.STOCK_CHECK_ON_ACCEPT)  # not a stop: the department checks on acceptance
        work.ticket.flags = flags
        if status == MaterialStockStatus.INSUFFICIENT:
            return self._stop(
                work, S.ON_HOLD, R.WAITING_MATERIAL, now, resume_step=7, note="Tồn kho mô phỏng không đủ vật tư dự kiến"
            )
        return False

    def _step_route(self, work: Case, now: datetime) -> bool:
        ticket = work.ticket
        failing = route_blockers(ticket)
        if failing:  # the step order should make this impossible; refuse rather than hand over
            raise EngineError("Bước 8 chạy khi can_route sai", {"failing": failing})
        self._build_draft(work, now)
        department = self.catalog.department(ticket.proposed_department_id)
        handover = {"department_id": department.department_id}
        if department.on_shift(now):
            self._apply_transition(work, S.ROUTED, SYSTEM_ID, Role.SYSTEM, now, dispatched_at=now, **handover)
            self._notify(
                work, "department.dispatch", BlockerOwner.DEPARTMENT, now, {"department_id": department.department_id}
            )
        else:
            late = self._new_blocker(work, R.OUT_OF_HOURS, now, resume_step=8, note="Ngoài ca phòng ban")
            self._apply_transition(
                work,
                S.ROUTED,
                SYSTEM_ID,
                Role.SYSTEM,
                now,
                blocker=late,
                note=late.internal_note,
                dispatched_at=None,
                **handover,
            )
        return True

    def _build_draft(self, work: Case, now: datetime) -> None:
        proposal, ticket = work.proposal, work.ticket
        playbook_id = proposal.playbook_id
        suffix = _suffix(ticket.ticket_id)
        draft_id = f"SIM-WOD-{suffix}"
        existing = work.draft
        rebuild = existing is None or existing.playbook_id != playbook_id
        template = self.catalog.template_for(playbook_id)
        if rebuild:
            work.checklist_items = [
                ChecklistItem(
                    checklist_item_id=f"SIM-CHK-{suffix}-{index:02d}",
                    work_order_draft_id=draft_id,
                    checklist_template_id=template.checklist_template_id,
                    template_item_id=item.template_item_id,
                    label_snapshot=item.label,
                    required=item.required,
                )
                for index, item in enumerate(template.items, start=1)
            ]
        lines = work.material_lines
        location = self.effective_location(work)
        work.draft = WorkOrderDraft(
            work_order_draft_id=draft_id,
            ticket_id=ticket.ticket_id,
            proposal_id=proposal.proposal_id,
            playbook_id=playbook_id,
            source_revision=ticket.source_revision,
            draft_revision=(existing.draft_revision + 1) if existing else 1,
            scope_summary=f"Ghi nhận {SCOPE_LABELS[playbook_id]} tại {location} theo phản ánh mô phỏng. "
            "Bản nháp, không phải lệnh công việc thật.",
            matched_rule_ids=[*proposal.matched_rule_ids, "PB-COM-R-WO-01"],
            source_references=["ticket.original_description", "locked_fields", "ticket_resident_additions"],
            location=location,
            asset_id=proposal.asset_id,
            department_id=ticket.proposed_department_id,
            flags=list(ticket.flags),
            material_stock_status=_aggregate_stock(lines),
            checklist_template_id=template.checklist_template_id,
            checklist_item_ids=[i.checklist_item_id for i in work.checklist_items],
            material_requirement_mode=MaterialRequirementMode.TRACKED if lines else MaterialRequirementMode.N_A,
            material_gate_status=MaterialGateStatus.NEEDS_CLARIFICATION if lines else MaterialGateStatus.NA,
            material_line_ids=[m.material_line_id for m in lines],
            evidence_requirements=self.catalog.requirements_for(playbook_id)
            if rebuild
            else existing.evidence_requirements,
            created_at=existing.created_at if existing else now,
        )
        self._agent(
            work,
            Action.CREATE_DRAFT,
            "WorkOrderDraft",
            draft_id,
            "draft_revision",
            existing.draft_revision if existing else None,
            work.draft.draft_revision,
            f"Giao {ticket.proposed_department_id}; assignee_id để trống cho phòng ban tự phân công",
            now=now,
            rule_id="PB-COM-R-WO-01",
        )

    def _material_line(self, draft_id: str, suffix: str, index: int, planned: PlannedMaterial) -> MaterialLine:
        item = self.catalog.material(planned.item_code)
        return MaterialLine(
            material_line_id=f"SIM-MAT-LINE-{suffix}-{index:02d}",
            work_order_draft_id=draft_id,
            item_code=planned.item_code,
            item_name=item.item_name if item else "Vật tư mô phỏng chưa có trong catalog",
            unit=item.unit if item else None,
            planned_qty=planned.planned_qty,
            norm_qty=item.norm_qty if item else None,
            norm_label=item.norm_label if item else NormLabel.N_A,
            simulated_stock_qty=self.stock.get(planned.item_code),
            material_stock_status=self._line_stock(planned.item_code, planned.planned_qty),
        )

    # ------------------------------------------------------------------ step 10 reconciliation

    @staticmethod
    def _require_in_progress(work: Case) -> None:
        if work.ticket.status != S.IN_PROGRESS or work.draft is None:
            raise GuardError("Phòng ban chưa nhận việc hoặc ticket không ở IN_PROGRESS", {"status": work.ticket.status})

    def _reconcile(self, work: Case, now: datetime) -> ReadinessEvaluation:
        ticket = work.ticket
        checklist_pending = [
            i.template_item_id for i in work.checklist_items if i.required and i.status != ChecklistStatus.COMPLETED
        ]
        notes_missing = self._validate_evidence(work)
        photos = execution_photos(work)
        for photo in photos:
            photo.evidence_validation_status = EvidenceValidationStatus.PRESENT
        incomplete, unexplained = self._compare_materials(work, now)
        # REWORK is the reason the department is working again, not something still to clear
        open_blocker = ticket.blocker is not None and ticket.blocker.code != R.REWORK
        evaluation = ReadinessEvaluation(
            department_accepted=ticket.department_id is not None and ticket.accepted_at is not None,
            checklist_complete=not checklist_pending,
            processing_note_present=not notes_missing,
            photo_present=bool(photos),
            materials_entered=not incomplete,
            variance_explained=not unexplained,
            no_open_blocker=not open_blocker,
            evaluated_at=now,
            failing_items=[
                *checklist_pending,
                *([] if photos else [EXECUTION_PHOTO]),
                *incomplete,
                *unexplained,
                *([f"blocker:{ticket.blocker.code}"] if open_blocker else []),
            ],
        )
        work.draft.readiness_evaluation = evaluation
        return evaluation

    def _compare_materials(self, work: Case, now: datetime) -> tuple[list[str], list[str]]:
        """Three comparisons per line (VAL-MAT-CMP-001). Returns (lines missing qty, lines with unexplained variance).
        An explained variance is a non-blocking warning."""
        incomplete, unexplained = [], []
        warnings: list[NonBlockingWarning] = []
        for line in work.material_lines:
            if line.issued_qty is None or line.used_qty is None:
                line.comparison_results = []
                line.reconciliation_status = "NEEDS_CLARIFICATION"
                incomplete.append(line.material_line_id)
                continue
            comparisons = [
                _compare(ComparisonType.PLANNED_VS_NORM, "planned_qty", "norm_qty", line.planned_qty, line.norm_qty),
                _compare(
                    ComparisonType.ISSUED_VS_PLANNED, "issued_qty", "planned_qty", line.issued_qty, line.planned_qty
                ),
                _compare(ComparisonType.USED_VS_ISSUED, "used_qty", "issued_qty", line.used_qty, line.issued_qty),
            ]
            variances = [c for c in comparisons if c.status == ComparisonStatus.VARIANCE]
            for c in variances:
                c.reason_reference = "variance_reason" if line.variance_reason else None
            line.comparison_results = comparisons
            if variances and not line.variance_reason:
                line.reconciliation_status = "NEEDS_CLARIFICATION"
                unexplained.append(line.material_line_id)
                continue
            line.reconciliation_status = "RECONCILED"
            if variances:
                warnings.append(
                    NonBlockingWarning(
                        warning_id=f"SIM-WRN-{_suffix(work.ticket.ticket_id)}-{len(warnings) + 1:02d}",
                        rule_id="PB-COM-R-WARN-01",
                        reason=f"Chênh lệch vật tư đã có giải thích: {line.variance_reason}",
                        material_line_ids=[line.material_line_id],
                        comparison_types=[c.comparison_type for c in variances],
                        created_at=now,
                    )
                )
        draft = work.draft
        if draft.material_requirement_mode == MaterialRequirementMode.N_A:
            draft.material_gate_status = MaterialGateStatus.NA
        elif incomplete or unexplained:
            draft.material_gate_status = MaterialGateStatus.NEEDS_CLARIFICATION
        else:
            draft.material_gate_status = MaterialGateStatus.RECONCILED
        draft.non_blocking_warnings = warnings
        return incomplete, unexplained

    def _validate_evidence(self, work: Case) -> list[str]:
        """Processing/result note per requirement. Returns the requirement IDs still missing. Images never count."""
        missing = []
        draft = work.draft
        for requirement in draft.evidence_requirements:
            records = [
                e
                for e in work.evidence
                if e.requirement_id == requirement.requirement_id and e.work_order_draft_id == draft.work_order_draft_id
            ]
            for record in records:
                record.evidence_validation_status = _evidence_status(record, requirement.allowed_evidence_types)
            present = [
                r.evidence_id for r in records if r.evidence_validation_status == EvidenceValidationStatus.PRESENT
            ]
            statuses = {r.evidence_validation_status for r in records}
            if present:
                requirement.validation_status = EvidenceValidationStatus.PRESENT
            else:
                requirement.validation_status = next(
                    (
                        s
                        for s in (EvidenceValidationStatus.SOURCE_UNVERIFIED, EvidenceValidationStatus.INVALID_TYPE)
                        if s in statuses
                    ),
                    EvidenceValidationStatus.MISSING,
                )
                missing.append(requirement.requirement_id)
            requirement.satisfied_by = present
        for record in work.evidence:
            if record.requirement_id is None and record.evidence_type != EvidenceType.SIMULATED_IMAGE:
                record.evidence_validation_status = EvidenceValidationStatus.MISSING
        return missing


def _compare(kind: ComparisonType, left: str, right: str, left_value: float, right_value: float | None):
    if right_value is None:
        status = ComparisonStatus.NA
    else:
        status = ComparisonStatus.MATCH if left_value == right_value else ComparisonStatus.VARIANCE
    return MaterialComparisonResult(
        comparison_type=kind,
        left_field=left,
        right_field=right,
        left_value=left_value,
        right_value=right_value,
        status=status,
    )


def _aggregate_stock(lines: list[MaterialLine]) -> MaterialStockStatus:
    statuses = {line.material_stock_status for line in lines}
    if not lines:
        return MaterialStockStatus.NOT_APPLICABLE
    if MaterialStockStatus.INSUFFICIENT in statuses:
        return MaterialStockStatus.INSUFFICIENT
    if MaterialStockStatus.UNKNOWN in statuses:
        return MaterialStockStatus.UNKNOWN
    return MaterialStockStatus.SUFFICIENT


def resident_photos(case: Case) -> list[EvidenceRecord]:
    return [e for e in case.evidence if e.source == EvidenceSource.RESIDENT_ORIGINAL]


def execution_photos(case: Case) -> list[EvidenceRecord]:
    """Photos the department took for the current work order (a new draft after rework needs its own)."""
    draft_id = case.draft.work_order_draft_id if case.draft else None
    return [
        e
        for e in case.evidence
        if e.evidence_type == EvidenceType.SIMULATED_IMAGE
        and e.source == EvidenceSource.DEPARTMENT_EXECUTION
        and e.work_order_draft_id == draft_id
    ]


def _evidence_status(record: EvidenceRecord, allowed: list[EvidenceType]) -> EvidenceValidationStatus:
    if record.evidence_type not in allowed:
        return EvidenceValidationStatus.INVALID_TYPE
    if record.source != EvidenceSource.DEPARTMENT_EXECUTION:
        return EvidenceValidationStatus.SOURCE_UNVERIFIED
    if not record.content_or_metadata.strip() or record.readability_status == ReadabilityStatus.UNREADABLE:
        return EvidenceValidationStatus.MISSING
    return EvidenceValidationStatus.PRESENT


def _plain(value: Any) -> Any:
    """Audit values are JSON-friendly snapshots."""
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value) if hasattr(value, "value") else value


def build_engine() -> MaintenanceEngine:
    """Engine configured from settings: LLM_MODE=openai with a key adds the OpenAI proposer, otherwise rules only."""
    from src.config import get_settings
    from src.maintenance.proposer import openai_client

    settings = get_settings()
    if settings.llm_mode == "openai" and settings.openai_api_key:
        return MaintenanceEngine(
            llm=openai_client(settings.model_name, settings.openai_api_key, settings.openai_base_url),
            llm_label=settings.model_name,
        )
    return MaintenanceEngine()
