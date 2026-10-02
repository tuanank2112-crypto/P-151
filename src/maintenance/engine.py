"""MaintenanceOps Agent engine, CR-BPTN-03 (v0.6 candidate). The user's swimlane diagram (2026-10-01) wins where the
CR text differs from it.

Flow: resident report → Agent pipeline steps 2–8 (data, category + department, 3b safety layer, duplicate, BPTN
review, asset, material + stock, route to department) → department accepts and works → step 10 reconciliation →
BQL closes. Classification runs before the duplicate check: the check then compares only tickets of the same
category, and a ticket whose category is unclear stops before any other ticket is read. Step 3b runs on every ticket,
even one whose category is unclear: tier 1 stops at EMERGENCY_PENDING_BQL (only BQL acts), tier 2 at
SAFETY_REVIEW_REQUIRED (BPTN chooses one of three answers).

Rules that hold everywhere:
  - every status change goes through `_apply_transition`: it checks TRANSITIONS, writes exactly one StatusEvent
    and emits `ticket.status_changed`. An invalid transition raises; it is never skipped silently;
  - only BQL closes or cancels; the Agent never writes `assignee_id` or a locked field; the raw report never changes;
  - nothing automatic ever clears EMERGENCY_PENDING_BQL; BPTN touching a BQL-owned blocker is ACTION_DENIED;
  - a write that also changes another ticket (merge, cancel of a merge target, duplicate count, follow-up ticket)
    happens in the same transaction (`_related`);
  - a stop is a `blocker` with an owner, a resume step and escalation times. Escalation only raises a flag and
    notifies BQL, it never changes the status;
  - every public operation checks permission first (denial = ACTION_DENIED audit, nothing else changes), works on a
    deep copy and commits only after the audit sink accepted the new rows (audit failure = fail closed).
"""

import logging
import threading
from collections.abc import Callable, Iterator, Mapping, MutableMapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Literal

from src.maintenance import priority as priority_rules
from src.maintenance import safety
from src.maintenance.catalog import Catalog, TicketDataset, load_catalog, load_dataset
from src.maintenance.enums import (
    BPTN_REASONS,
    BQL_REASONS,
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
    ClosureKind,
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
    Priority,
    PrioritySource,
    ReadabilityStatus,
    ReasonCode,
    ReviewStatus,
    RiskLevel,
    ServiceCategory,
    TicketFlag,
    TicketStatus,
)
from src.maintenance.messages import emergency_closed_message, field_label, public_message, safety_info_message
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
from src.maintenance.store.base import (  # the error hierarchy lives with the store
    CaseRepository,
    EngineError,
    GuardError,
    NotFoundError,
    Tx,
)
from src.maintenance.store.memory import InMemoryRepository

if TYPE_CHECKING:
    from src.config import Settings

logger = logging.getLogger(__name__)

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
    # CR-BPTN-03 actions that are not a status change
    Action.SAFETY_ESCALATE: frozenset({Role.BPTN, Role.BQL}),
    Action.SET_PRIORITY: frozenset({Role.BPTN, Role.BQL}),
    Action.CREATE_FOLLOW_UP: frozenset({Role.BQL}),
    Action.BQL_REASSIGN_TO_BPTN: frozenset({Role.BQL}),
}


@dataclass(frozen=True)
class TransitionRule:
    actors: frozenset[ActorRole]
    reasons: frozenset[ReasonCode] = frozenset()  # reason codes this transition may carry
    reason_required: bool = False
    pipeline_only: bool = False  # driven by the pipeline / resume, never by an outside caller


def _rule(*actors: ActorRole, reasons=(), required=False, pipeline=False) -> TransitionRule:
    return TransitionRule(frozenset(actors), frozenset(reasons), required, pipeline)


# CR-BPTN-03 §4.1 (T01 is ingest). The only allowed status changes. SYSTEM and AGENT never call `transition()`
# from outside: their rows are driven by the pipeline, `resume()` and the job.
TRANSITIONS: dict[tuple[TicketStatus, TicketStatus], TransitionRule] = {
    (S.RECEIVED, S.NEED_INFO): _rule(Role.SYSTEM, reasons=[R.MISSING_INFO], required=True, pipeline=True),  # T02
    (S.NEED_INFO, S.RECEIVED): _rule(Role.SYSTEM, Role.BQL),  # T03 (BQL: safe after a safety question escalated)
    (S.RECEIVED, S.VERIFYING): _rule(  # T04
        Role.AGENT,
        reasons=[
            R.DUPLICATE,
            R.CATEGORY_UNCLEAR,
            R.OUT_OF_SCOPE,
            R.PENDING_REVIEW,
            R.ASSET_UNCLEAR,
            R.SAFETY_REVIEW_REQUIRED,
            R.EMERGENCY_PENDING_BQL,
        ],
        required=True,
        pipeline=True,
    ),
    (S.VERIFYING, S.RECEIVED): _rule(Role.SYSTEM, Role.BPTN, Role.BQL),  # T05 (BPTN safe, BQL downgrade)
    (S.VERIFYING, S.NEED_INFO): _rule(Role.BPTN, Role.BQL, reasons=[R.MISSING_INFO], required=True),  # T06
    (S.NEED_INFO, S.VERIFYING): _rule(Role.BQL, reasons=[R.EMERGENCY_PENDING_BQL], required=True),  # T07
    (S.VERIFYING, S.MERGED): _rule(Role.BPTN, Role.BQL),  # T08
    (S.MERGED, S.RECEIVED): _rule(Role.BPTN, Role.BQL, Role.SYSTEM),  # T09 undo merge / merge target cancelled
    (S.VERIFYING, S.CLOSED): _rule(Role.BQL),  # T10 emergency handled
    (S.RECEIVED, S.ON_HOLD): _rule(Role.AGENT, reasons=[R.WAITING_MATERIAL], required=True, pipeline=True),  # T11
    (S.ON_HOLD, S.RECEIVED): _rule(Role.SYSTEM, pipeline=True),  # T12
    (S.RECEIVED, S.ROUTED): _rule(Role.SYSTEM, reasons=[R.OUT_OF_HOURS], pipeline=True),  # T13
    (S.ROUTED, S.IN_PROGRESS): _rule(Role.DEPARTMENT),  # T14
    (S.ROUTED, S.VERIFYING): _rule(Role.DEPARTMENT, reasons=[R.WRONG_DEPT], required=True),  # T15
    (S.IN_PROGRESS, S.VERIFYING): _rule(Role.DEPARTMENT, reasons=[R.WRONG_DEPT_AFTER_START], required=True),  # T16
    (S.VERIFYING, S.IN_PROGRESS): _rule(Role.BQL),  # T17 BQL keeps the department
    (S.IN_PROGRESS, S.ON_HOLD): _rule(  # T18
        Role.DEPARTMENT, reasons=[R.BLOCKED_ONSITE, R.WAITING_MATERIAL], required=True
    ),
    (S.ON_HOLD, S.IN_PROGRESS): _rule(Role.DEPARTMENT, Role.SYSTEM),  # T19 (SYSTEM: stock arrived mid-work)
    (S.IN_PROGRESS, S.READY_FOR_REVIEW): _rule(Role.AGENT, pipeline=True),  # T20
    (S.READY_FOR_REVIEW, S.CLOSED): _rule(Role.BQL),  # T21
    (S.READY_FOR_REVIEW, S.IN_PROGRESS): _rule(Role.BQL, reasons=[R.REWORK], required=True),  # T22
    **{(status, S.CANCELLED): _rule(Role.BQL) for status in S if status not in TERMINAL_STATUSES},  # T23
}
# Never callable through `transition()` by an outside caller
MACHINE_ROLES = frozenset({Role.SYSTEM, Role.AGENT})

BLOCKER_OWNERS: dict[ReasonCode, BlockerOwner] = {
    **{code: BlockerOwner.BPTN for code in BPTN_REASONS},
    R.SAFETY_REVIEW_REQUIRED: BlockerOwner.BPTN,
    **{code: BlockerOwner.BQL for code in BQL_REASONS},
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


class InvalidTransitionError(GuardError):
    code = "INVALID_TRANSITION"


class ActionDeniedError(EngineError):
    """Permission rejection (canonical code ACTION_DENIED). The denial itself is audited."""

    code = "ACTION_DENIED"


class AuditWriteError(EngineError):
    code = "AUDIT_WRITE_FAILED"


AuditSink = Callable[[list[AuditEvent | StatusEvent]], None]
NotifySink = Callable[[list[Notification]], None]


class _Denied(Exception):  # noqa: N818 - internal signal, not an error
    """Leaves the transaction of `_mutate_locked` (rollback) so the denial is written in its own transaction."""

    def __init__(self, case: Case, message: str | None):
        super().__init__(message)
        self.case = case
        self.message = message


@dataclass
class _Related:
    work: Case
    marks: tuple[int, int, int]  # audit / events / notifications already committed
    inserted: bool = False


@dataclass
class _OpContext:
    """The transaction of the running operation, its main ticket and the other tickets it changes."""

    tx: Tx
    main: Case
    related: dict[str, _Related] = field(default_factory=dict)


def initial_stock(catalog: Catalog) -> dict[str, float | None]:
    """Simulated stock as the catalog defines it (start state and the state after `reset`)."""
    return {m.item_code: m.simulated_stock_qty for m in catalog.materials}


class CasesView(Mapping[str, Case]):
    """Read-only `engine.cases` kept for tests and old callers; every read goes to the repository."""

    def __init__(self, repo: CaseRepository):
        self._repo = repo

    def __getitem__(self, ticket_id: str) -> Case:
        try:
            return self._repo.get(ticket_id)
        except NotFoundError as exc:
            raise KeyError(ticket_id) from exc

    def __iter__(self) -> Iterator[str]:
        return iter([case.ticket.ticket_id for case in self._repo.list()])

    def __len__(self) -> int:
        return self._repo.count()

    def values(self) -> list[Case]:  # type: ignore[override] - one list() instead of one get() per key
        return self._repo.list()

    def items(self) -> list[tuple[str, Case]]:  # type: ignore[override]
        return [(case.ticket.ticket_id, case) for case in self._repo.list()]


class StockView(MutableMapping[str, float | None]):
    """`engine.stock` kept for tests: reads and item assignment go to the repository."""

    def __init__(self, repo: CaseRepository):
        self._repo = repo

    def __getitem__(self, item_code: str) -> float | None:
        stock = self._repo.stock()
        if item_code not in stock:
            raise KeyError(item_code)
        return stock[item_code]

    def __setitem__(self, item_code: str, qty: float | None) -> None:
        self._repo.set_stock(item_code, qty)

    def __delitem__(self, item_code: str) -> None:
        raise TypeError("Không xoá được vật tư khỏi tồn kho")

    def __iter__(self) -> Iterator[str]:
        return iter(self._repo.stock())

    def __len__(self) -> int:
        return len(self._repo.stock())


def route_blockers(ticket: Ticket) -> list[str]:
    """Why `can_route` is false (CR-BPTN-03 §5.3): review done, asset resolved, a department proposed, no
    emergency."""
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
    if ticket.risk_level == RiskLevel.EMERGENCY:
        failing.append("risk_level=EMERGENCY")
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
        repo: CaseRepository | None = None,
    ):
        self.catalog = catalog or load_catalog()
        self.dataset = dataset or load_dataset()
        self.audit_sink = audit_sink or (lambda rows: None)
        self.notify_sink = notify_sink or (lambda rows: None)
        self._base_clock = clock or (lambda: datetime.now(LOCAL_TZ))
        self._local = threading.local()  # per-thread clock override set by `at()`
        # One writer at a time: API requests run in a thread pool and the scheduled job runs beside them
        self.lock = threading.RLock()
        self.llm = llm  # None = fixed rules only (deterministic, used by tests and LLM_MODE=mock)
        self.llm_label = llm_label
        # Source of truth for cases and stock (I-1): the engine keeps no Case between two calls
        self.repo: CaseRepository = repo or InMemoryRepository(initial_stock(self.catalog))
        self._set_run(self.repo.run_number())

    # ------------------------------------------------------------------ run control

    @property
    def cases(self) -> CasesView:
        """Read-only view over the repository (compatibility for tests and old callers)."""
        return CasesView(self.repo)

    @property
    def stock(self) -> StockView:
        """Stock view over the repository; item assignment is for tests only."""
        return StockView(self.repo)

    def _set_run(self, run_number: int) -> None:
        self.run_number = run_number
        self.run_id = f"SIM-RUN-{run_number:03d}"

    def clock(self) -> datetime:
        """The current time, or the moment an enclosing `at()` set for this thread."""
        moment = getattr(self._local, "moment", None)
        return moment if moment is not None else self._base_clock()

    @contextmanager
    def at(self, moment: datetime) -> Iterator[None]:
        """Run the enclosed calls as if the clock showed `moment` (demo replays and scheduled jobs).

        Thread-local, so a replay never shifts the time other requests see.
        """
        previous = getattr(self._local, "moment", None)
        self._local.moment = moment
        try:
            yield
        finally:
            self._local.moment = previous

    def reset(self, *, with_fixtures: bool = True) -> str:
        """FR-DEMO-001: drop every mutable layer and re-ingest the fixture, each at its own created_at."""
        with self.lock:
            return self._reset(with_fixtures)

    def _reset(self, with_fixtures: bool) -> str:
        self._set_run(self.repo.wipe(initial_stock(self.catalog)))
        if with_fixtures:
            self.seed()
        return self.run_id

    def seed(self) -> None:
        """Ingest the fixture tickets, each at its own created_at, and run the Agent on each."""
        with self.lock:
            present = self.repo.stock()
            for item_code, qty in initial_stock(self.catalog).items():
                if item_code not in present:  # a new database starts with an empty stock table; never overwrite
                    self.repo.set_stock(item_code, qty)
            for fixture in self.dataset.tickets:
                planned = list(fixture.materials) if fixture.materials is not None else None
                with self.at(_created_at(fixture.raw) or self.clock()):
                    self.ingest(fixture.raw, planned_materials=planned)
                    self.run_agent(fixture.raw.ticket_id)

    def get(self, ticket_id: str) -> Case:
        return self.repo.get(ticket_id)

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
        with self.lock:
            number = self.repo.next_ticket_number()  # never handed out twice, even across processes
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
        with self.lock:
            return self._ingest(raw, planned_materials, resident_id)

    def _ingest(self, raw: RawTicket, planned_materials: list[PlannedMaterial] | None, resident_id: str) -> Case:
        work = self._new_case(raw, planned_materials, resident_id, self.clock())
        with self.repo.transaction() as tx:
            tx.insert(work)  # a duplicate ticket_id raises GuardError("... đã được ingest")
            self._commit(tx, work, 0, 0, 0)
        return work

    def _new_case(
        self, raw: RawTicket, planned_materials: list[PlannedMaterial] | None, resident_id: str, now: datetime
    ) -> Case:
        """Step 1: the raw report stored unchanged in RECEIVED, with its ingest audit, event and notification."""
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
            self._append_addition(work, content, actor_id, Role.RESIDENT, "Cư dân bổ sung thông tin", now)
            self._resume(work, now)

        return self._mutate(ticket_id, actor_id, Action.ADD_RESIDENT_INFO, op)

    def _append_addition(self, work: Case, content: str, actor_id: str, role: ActorRole, reason: str, now: datetime):
        """Append to what the Agent reads (the original never changes). `submitted_by` tells resident from BPTN."""
        addition = ResidentAddition(
            addition_id=f"SIM-ADD-{_suffix(work.ticket.ticket_id)}-{len(work.additions) + 1:02d}",
            ticket_id=work.ticket.ticket_id,
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
            role,
            "additions",
            None,
            addition.content,
            reason,
            now=now,
        )

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
        """1–5 stars, once (CR-BPTN-03 §11). A merged ticket is rated once its original is CLOSED. Rating never changes
        the status, priority or department."""

        def op(work: Case, now: datetime) -> None:
            if not self.can_rate(work):
                raise GuardError("Chỉ đánh giá được khi phản ánh đã hoàn thành")
            if work.ticket.rating is not None:
                raise GuardError("Phản ánh đã được đánh giá; không sửa được")
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

    def can_rate(self, case: Case) -> bool:
        ticket = case.ticket
        if ticket.status == S.CLOSED:
            return True
        return ticket.status == S.MERGED and self.repo.get(ticket.merged_into).ticket.status == S.CLOSED

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
        info: str | None = None,
    ) -> Case:
        """Event `bptn_resolved`. BPTN answers the open blocker; chosen values go to `locked_fields`.

        MISSING_INFO (status NEED_INFO): BPTN contacted the resident and enters a `location` and/or `info` (what the
            resident said, appended as an addition by BPTN; the original report never changes). Reason required.
            Every missing field must be covered, otherwise nothing is saved; then the pipeline resumes at step 2.

        DUPLICATE: merge=True → MERGED; merge=False → pipeline resumes at step 5 (BPTN review, then asset).
        CATEGORY_UNCLEAR / OUT_OF_SCOPE: `category` required → review CONFIRMED, resume at step 4 (duplicate
            check on the chosen category).
        PENDING_REVIEW: confirm as is, or change category/location → CONFIRMED, resume at step 6.
        ASSET_UNCLEAR: `asset_id`, a new `location`, or `asset_onsite` ("xác định tại hiện trường", reason
            required → ONSITE_BY_BPTN + flag ASSET_CHECK_ONSITE); resume at step 6.
        WRONG_DEPT: `category` and/or `department`. A new category resets the asset and resumes at step 6;
            the same category resumes at step 7. Never straight to step 8.
        """

        def op(work: Case, now: datetime) -> None:
            ticket = work.ticket
            blocker = ticket.blocker
            if blocker is not None and blocker.code in BQL_REASONS:
                raise _Denied(work, f"{blocker.code} chỉ Ban quản lý xử lý")  # CR-BPTN-03 §4.4.5
            if blocker is not None and blocker.code == R.SAFETY_REVIEW_REQUIRED:
                raise GuardError("Rủi ro chưa rõ: chọn xác nhận an toàn, nâng khẩn cấp hoặc yêu cầu cư dân bổ sung")
            if blocker is None or blocker.code not in BPTN_REASONS:
                raise GuardError("Không có blocker nào chờ BPTN", {"status": ticket.status})
            code = blocker.code
            if ticket.status != (S.NEED_INFO if code == R.MISSING_INFO else S.VERIFYING):
                raise GuardError("Không có blocker nào chờ BPTN", {"status": ticket.status})
            if info is not None and code != R.MISSING_INFO:
                raise GuardError("`info` chỉ dùng cho MISSING_INFO", {"reason_code": code})
            if code == R.MISSING_INFO and _blank(location) and _blank(info):
                raise GuardError("MISSING_INFO: nhập vị trí hoặc thông tin thu thập từ cư dân")
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
                self._merge(work, blocker.related_ticket_id, actor_id, Role.BPTN, now, note=note)
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
            if (locks or asset_onsite or info is not None) and _blank(note):
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
            if not _blank(info):
                self._append_addition(work, info, actor_id, Role.BPTN, "BPTN ghi thông tin thu thập từ cư dân", now)
            if code == R.MISSING_INFO and (still_missing := self._missing_fields(work)):
                raise GuardError(f"Vẫn thiếu: {', '.join(still_missing)}", {"fields": still_missing})
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

    # ------------------------------------------------------------------ safety layer (CR-BPTN-03 §6.4, §6.5)

    def safety_review(
        self,
        ticket_id: str,
        actor_id: str,
        *,
        decision: Literal["CONFIRM_SAFE", "ESCALATE", "REQUEST_INFO"],
        note: str | None = None,
    ) -> Case:
        """BPTN's three answers to a tier-2 ticket (BQL may give them too, e.g. after escalation).

        CONFIRM_SAFE: VERIFYING → RECEIVED (T05), or for BQL a safety question left unanswered NEED_INFO → RECEIVED
            (T03). Reason required; valid only for the content of this moment.
        ESCALATE: SAFETY_REVIEW_REQUIRED → EMERGENCY_PENDING_BQL (E01, no way back for BPTN), or for BQL
            NEED_INFO → VERIFYING (T07).
        REQUEST_INFO: VERIFYING → NEED_INFO (T06) with `safety_context`; reason required.
        """
        case = self.get(ticket_id)
        ticket = case.ticket
        if self._role(actor_id) == Role.BQL and ticket.blocker and ticket.blocker.code in BQL_REASONS:
            raise GuardError("Ticket khẩn cấp: dùng đóng khẩn cấp, hạ khẩn cấp hoặc tạo ticket tiếp theo")
        if decision == "CONFIRM_SAFE":
            return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=ticket.status)
        if decision == "REQUEST_INFO":
            return self.transition(ticket_id, S.NEED_INFO, actor_id, note=note, expected_from=S.VERIFYING)
        if ticket.status == S.NEED_INFO:
            return self.transition(ticket_id, S.VERIFYING, actor_id, note=note, expected_from=S.NEED_INFO)

        def op(work: Case, now: datetime) -> None:
            blocker = work.ticket.blocker
            if blocker is not None and blocker.code in BQL_REASONS:
                raise _Denied(work, "Ticket đã ở mức khẩn cấp, chỉ Ban quản lý xử lý")
            if blocker is None or blocker.code != R.SAFETY_REVIEW_REQUIRED:
                raise GuardError("Chỉ nâng khẩn cấp ticket đang chờ đánh giá rủi ro")
            self._raise_emergency(work, actor_id, self._role(actor_id), now, note)

        return self._mutate(ticket_id, actor_id, Action.SAFETY_ESCALATE, op)

    def emergency_close(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """T10: BQL handled the emergency. Result note required; no department ever had the ticket."""
        return self.transition(ticket_id, S.CLOSED, actor_id, note=note, expected_from=S.VERIFYING)

    def emergency_downgrade(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """T05 by BQL: a false alarm. The maintenance work itself continues on the normal flow."""
        blocker = self.get(ticket_id).ticket.blocker
        if self._role(actor_id) == Role.BQL and (blocker is None or blocker.code != R.EMERGENCY_PENDING_BQL):
            raise GuardError("Chỉ hạ được ticket đang khẩn cấp")
        return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.VERIFYING)

    def create_follow_up(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """BQL opens the repair ticket that follows an emergency (CR-BPTN-03 §6.5). The new ticket inherits the
        content, the resident's photos and the safety confirmation, and runs the pipeline at once. The emergency
        ticket keeps its status (BQL closes it with T10). Returns the NEW ticket."""
        created: dict[str, str] = {}

        def op(work: Case, now: datetime) -> None:
            blocker = work.ticket.blocker
            if blocker is None or blocker.code != R.EMERGENCY_PENDING_BQL:
                raise GuardError("Chỉ tạo ticket tiếp theo từ ticket đang khẩn cấp")
            if _blank(note):
                raise GuardError("Tạo ticket tiếp theo phải có ghi chú")
            number = self.repo.next_ticket_number()
            raw = RawTicket(
                ticket_id=f"SIM-TKT-{number:04d}",
                created_at=now.astimezone(LOCAL_TZ).isoformat(timespec="seconds"),
                original_description=self._content(work),
                channel="follow_up",
            )
            new = self._new_case(raw, None, work.ticket.resident_id, now)
            self._set_ticket(
                new,
                follow_up_of=ticket_id,
                safety_cleared_by=actor_id,
                safety_cleared_at=now,
                safety_clear_reason=note.strip(),
                risk_level=RiskLevel.NONE,
            )
            new.not_duplicate_of.append(ticket_id)  # the emergency ticket itself is not a duplicate to merge into
            for photo in resident_photos(work):
                self._copy_photo(photo, new, now)
            self._insert_related(new)
            self._run_pipeline(new, 2, now)
            self._audit(
                work,
                Action.CREATE_FOLLOW_UP,
                "Ticket",
                ticket_id,
                actor_id,
                Role.BQL,
                "follow_up",
                None,
                raw.ticket_id,
                note.strip(),
                now=now,
            )
            created["ticket_id"] = raw.ticket_id

        self._mutate(ticket_id, actor_id, Action.CREATE_FOLLOW_UP, op)
        return self.get(created["ticket_id"])

    # ------------------------------------------------------------------ merge (CR-BPTN-03 §8)

    def bql_merge(self, ticket_id: str, actor_id: str, *, into: str, note: str) -> Case:
        """T08 by BQL: several emergency tickets about the same incident become one."""
        return self.transition(ticket_id, S.MERGED, actor_id, note=note, into=into, expected_from=S.VERIFYING)

    def undo_merge(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """T09: the merge was wrong. The pipeline runs again and never proposes this pair again."""
        return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.MERGED)

    # ------------------------------------------------------------------ priority (CR-BPTN-03 §7)

    def set_priority(self, ticket_id: str, actor_id: str, *, priority: Priority, note: str) -> Case:
        def op(work: Case, now: datetime) -> None:
            ticket = work.ticket
            if ticket.status in TERMINAL_STATUSES:
                raise GuardError("Ticket đã kết thúc")
            if _blank(note):
                raise GuardError("Sửa mức ưu tiên phải có lý do")
            old = ticket.priority
            self._set_ticket(
                work,
                priority=priority,
                priority_source=PrioritySource.HUMAN_OVERRIDE,
                priority_rule_id=None,
                priority_reason=note.strip(),
            )
            self._audit(
                work,
                Action.SET_PRIORITY,
                "Ticket",
                ticket_id,
                actor_id,
                self._role(actor_id),
                "priority",
                old,
                priority,
                note.strip(),
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.SET_PRIORITY, op)

    # ------------------------------------------------------------------ department

    def accept(self, ticket_id: str, actor_id: str) -> Case:
        """Event `department_accepted`: ROUTED → IN_PROGRESS, clears OUT_OF_HOURS / NOT_ACCEPTED."""
        return self.transition(ticket_id, S.IN_PROGRESS, actor_id, expected_from=S.ROUTED)

    def return_wrong_department(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """T15: only before accepting. Once the work has started the department reports instead (T16)."""
        return self.transition(ticket_id, S.VERIFYING, actor_id, note=note, expected_from=S.ROUTED)

    def report_wrong_department(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """T16 'Báo cần BQL xem': the work has started, so the department may not hand it back itself; BQL decides.
        Everything already done (checklist, materials, notes, photos) is kept."""
        return self.transition(ticket_id, S.VERIFYING, actor_id, note=note, expected_from=S.IN_PROGRESS)

    def block_onsite(self, ticket_id: str, actor_id: str, *, note: str, eta: datetime) -> Case:
        return self.transition(ticket_id, S.ON_HOLD, actor_id, note=note, eta=eta)

    def material_short(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """T18 with WAITING_MATERIAL: stock found short after accepting. Stock arriving resumes the work (T19)."""
        return self.transition(
            ticket_id, S.ON_HOLD, actor_id, note=note, reason=R.WAITING_MATERIAL, expected_from=S.IN_PROGRESS
        )

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

    def bql_wrong_department(
        self, ticket_id: str, actor_id: str, *, decision: Literal["TO_BPTN", "KEEP"], note: str
    ) -> Case:
        """BQL answers a department's T16 report. KEEP: T17, the same department goes on. TO_BPTN: E02, BPTN picks
        the department or category again; the work done so far is kept. Not the same as rework (T22)."""
        if decision == "KEEP":
            return self.transition(ticket_id, S.IN_PROGRESS, actor_id, note=note, expected_from=S.VERIFYING)

        def op(work: Case, now: datetime) -> None:
            blocker = work.ticket.blocker
            if work.ticket.status != S.VERIFYING or blocker is None or blocker.code != R.WRONG_DEPT_AFTER_START:
                raise GuardError("Chỉ chuyển về BPTN khi phòng ban báo sai phòng ban sau khi đã làm")
            if _blank(note):
                raise GuardError("Chuyển về BPTN phải có ghi chú")
            wrong = self._new_blocker(work, R.WRONG_DEPT, now, resume_step=6, note=note)
            self._set_blocker(
                work,
                wrong,
                actor_id,
                Role.BQL,
                now,
                note=note,
                department_id=None,
                dispatched_at=None,
                accepted_at=None,
            )
            self._audit(
                work,
                Action.BQL_REASSIGN_TO_BPTN,
                "Ticket",
                ticket_id,
                actor_id,
                Role.BQL,
                "blocker",
                R.WRONG_DEPT_AFTER_START,
                R.WRONG_DEPT,
                note.strip(),
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.BQL_REASSIGN_TO_BPTN, op)

    # ------------------------------------------------------------------ warehouse

    def receive_stock(self, actor_id: str, item_code: str, qty: float) -> list[Case]:
        """Event `stock_received`: raise simulated stock, then resume every ticket waiting for that item."""
        if self.catalog.actor_role(actor_id) != Role.WAREHOUSE:
            raise ActionDeniedError("Chỉ kho được nhập vật tư", {"code": "ACTION_DENIED", "actor_id": actor_id})
        if self.catalog.material(item_code) is None:
            raise NotFoundError(f"Không có vật tư {item_code} trong catalog")
        if qty <= 0:
            raise GuardError("Số lượng nhập phải > 0")
        with self.lock:
            with self.repo.transaction() as tx:
                tx.add_stock(item_code, qty)
            waiting = [
                case.ticket.ticket_id
                for case in self.repo.list()
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
        with self.lock, self.repo.job_lease() as leader, self.at(moment):
            if not leader:
                return []  # another process runs the job this round
            for case in self.repo.list():
                ticket_id = case.ticket.ticket_id
                if not self._due(case.ticket, moment):
                    continue  # nothing for _tick to do: skip the deep copy
                before = len(case.events)
                try:
                    self._mutate(ticket_id, SYSTEM_ID, Action.RUN_JOBS, lambda work, now: self._tick(work, now))
                except EngineError:  # one broken ticket must not stop the job for all the others
                    logger.exception("run_jobs: ticket %s failed", ticket_id)
                    continue
                if len(self.repo.get(ticket_id).events) != before:
                    changed.append(ticket_id)
        return changed

    def _due(self, ticket: Ticket, now: datetime) -> bool:
        """Whether `_tick` would change anything: the same conditions it checks, without copying the case."""
        blocker = ticket.blocker
        if blocker is None:
            wait = timedelta(hours=self.catalog.sla_config.not_accepted.start_after_hours)
            return (
                ticket.status == S.ROUTED
                and ticket.accepted_at is None
                and ticket.dispatched_at is not None
                and now >= ticket.dispatched_at + wait
            )
        retry_due = blocker.next_retry_at is not None and blocker.next_retry_at <= now
        escalation_due = blocker.escalate_at is not None and blocker.escalate_at <= now and not blocker.escalated
        return retry_due or escalation_due

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
        reason: ReasonCode | None = None,
        into: str | None = None,
    ) -> Case:
        """Change status on behalf of a person (department, BQL, BPTN, resident). Checks the CR-BPTN-03 §4.1 table.

        A role that may never reach `to` is denied and audited (e.g. anyone but BQL closing; SYSTEM and AGENT never
        call this). A role that may reach `to`, but not from the current status, gets INVALID_TRANSITION.
        `expected_from` pins the source for the named actions that share a target (accept / resume_work / rework all
        lead to IN_PROGRESS). `reason` picks the reason code where a row allows two (T18); `into` is the merge
        target BQL picks (T08 on an emergency ticket).
        """
        extra = {"note": note, "eta": eta, "cancel_reason": cancel_reason, "reason": reason, "into": into}
        with self.lock:
            return self._transition(ticket_id, to, actor_id, expected_from, extra)

    def _transition(
        self,
        ticket_id: str,
        to: TicketStatus,
        actor_id: str,
        expected_from: TicketStatus | None,
        extra: dict[str, Any],
    ) -> Case:
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
        if role is None or role in MACHINE_ROLES or role not in reachable:
            self._deny(
                case,
                actor_id,
                role,
                Action.TRANSITION,
                "status",
                to,
                extra["note"],
                now,
                message=f"{role or 'actor không xác định'} không được chuyển sang {to}",
            )
        rule = TRANSITIONS.get((current, to))
        if rule is None or rule.pipeline_only or role not in rule.actors or expected_from not in (None, current):
            raise InvalidTransitionError(
                f"Không chuyển được {current} → {to}", {"from": current, "to": to, "actor_role": role}
            )

        def op(work: Case, now: datetime) -> None:
            locked = work.ticket.status  # the copy read under the row lock: another backend may have moved it
            locked_rule = TRANSITIONS.get((locked, to))
            if (
                locked_rule is None
                or locked_rule.pipeline_only
                or role not in locked_rule.actors
                or expected_from not in (None, locked)
            ):
                raise InvalidTransitionError(
                    f"Không chuyển được {locked} → {to}", {"from": locked, "to": to, "actor_role": role}
                )
            self._human_transition(work, to, actor_id, role, now, **extra)

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
        with self.lock:
            return self._mutate_locked(ticket_id, actor_id, action, op, roles, field_name, new_value, reason)

    def _mutate_locked(
        self,
        ticket_id: str,
        actor_id: str,
        action: Action,
        op: Callable[[Case, datetime], None],
        roles: frozenset[ActorRole] | None,
        field_name: str,
        new_value: Any,
        reason: str | None,
    ) -> Case:
        now = self.clock()
        role = self._role(actor_id)
        allowed = PERMISSIONS.get(action, frozenset()) if roles is None else roles
        try:
            with self.repo.transaction() as tx:
                case = tx.get_for_update(ticket_id)  # row lock (I-3)
                if role is None or role not in allowed:
                    raise _Denied(case, None)
                scope_error = self._scope_error(case, actor_id, role)
                if scope_error:
                    raise _Denied(case, scope_error)

                if case.ticket.raw.integrity_marker() != case.ticket.raw_integrity_marker:
                    raise EngineError("Raw integrity marker không khớp; dừng xử lý (fail closed)")

                work = case.model_copy(deep=True)
                marks = (len(work.audit), len(work.events), len(work.notifications))
                previous = getattr(self._local, "ctx", None)
                self._local.ctx = _OpContext(tx, work)
                try:
                    op(work, now)
                    self._commit(tx, work, *marks)
                    for other in self._local.ctx.related.values():  # same transaction: all or nothing (I-9)
                        if other.inserted:
                            tx.insert(other.work)
                        self._commit(tx, other.work, *other.marks)
                finally:
                    self._local.ctx = previous
        except _Denied as denied:  # the transaction above rolled back; the denial is written in its own
            self._deny(denied.case, actor_id, role, action, field_name, new_value, reason, now, message=denied.message)
        return work

    def _related(self, ticket_id: str) -> Case:
        """Another ticket this operation also changes, locked and written in the same transaction."""
        ctx: _OpContext | None = getattr(self._local, "ctx", None)
        if ctx is None:
            raise EngineError("Ghi ticket liên quan ngoài một thao tác", {"ticket_id": ticket_id})
        if ticket_id == ctx.main.ticket.ticket_id:
            return ctx.main
        if ticket_id not in ctx.related:
            other = ctx.tx.get_for_update(ticket_id).model_copy(deep=True)
            ctx.related[ticket_id] = _Related(other, (len(other.audit), len(other.events), len(other.notifications)))
        return ctx.related[ticket_id].work

    def _insert_related(self, work: Case) -> None:
        """A new ticket created by this operation (follow-up), inserted in the same transaction."""
        ctx: _OpContext = self._local.ctx
        ctx.related[work.ticket.ticket_id] = _Related(work, (0, 0, 0), inserted=True)

    def _commit(self, tx: Tx, work: Case, audit_from: int, events_from: int, notes_from: int) -> None:
        """Save `work` and append its new rows inside `tx`. A failing append or sink rolls everything back."""
        tx.save(work)
        new_rows = [*work.audit[audit_from:], *work.events[events_from:]]
        new_notifications = work.notifications[notes_from:]
        tx.append_log(new_rows)  # a store failure surfaces as itself (409/503/403), never as AuditWriteError
        self._sink(self.audit_sink, new_rows)
        if new_notifications:
            tx.append_notifications(new_notifications)
            self._sink(self.notify_sink, new_notifications)

    @staticmethod
    def _sink(sink: Callable[[Any], None], rows: Sequence[Any]) -> None:
        """Only the external callback is wrapped: its failure means nothing is committed (D3)."""
        try:
            sink(rows)
        except Exception as exc:  # audit/notify failure → nothing is committed
            raise AuditWriteError("Không ghi được audit; thay đổi bị huỷ", {"error": str(exc)}) from exc

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
        """Write one ACTION_DENIED audit row in its own transaction, then raise ActionDeniedError."""
        with self.repo.transaction() as tx:
            fresh = tx.get_for_update(case.ticket.ticket_id)  # locked: the audit sequence number is right
            event = self._make_audit(
                fresh,
                Action.ACTION_DENIED,
                "Ticket",
                fresh.ticket.ticket_id,
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
            denied = fresh.model_copy(deep=True)
            denied.audit.append(event)
            tx.save(denied)
            tx.append_log([event])
            try:
                self.audit_sink([event])
            except Exception as exc:
                raise AuditWriteError("Không ghi được audit cho lần từ chối", {"error": str(exc)}) from exc
        raise ActionDeniedError(
            message or f"{action} ngoài quyền của {role or 'actor không xác định'}",
            {
                "decision": "DENY",
                "code": "ACTION_DENIED",
                "requested_action": action,
                "actor_id": actor_id,
                "actor_role": role,
                "target_field": field_name,
                "unchanged_status": fresh.ticket.status,
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
        if ticket.closure_kind == ClosureKind.EMERGENCY_HANDLED:
            return emergency_closed_message()  # §11: a general message, no risk detail, no technical advice
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
        safety_context: bool = False,
    ) -> Blocker:
        sla = self.catalog.sla_config
        next_retry_at, escalate_at, dispatch_at = self._schedule(work, code, now, eta), None, None
        if safety_context:  # §6.4: a safety question to the resident has its own, calendar-hour deadline
            next_retry_at = None
            escalate_at = now + timedelta(hours=sla.safety_context_need_info.escalate_after_hours)
        elif code == R.SAFETY_REVIEW_REQUIRED:
            escalate_at = now + timedelta(hours=sla.safety_review.escalate_after_hours)
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
        if safety_context:
            message = safety_info_message()
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
        resume_step: int | None,
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
        reason: ReasonCode | None = None,
        into: str | None = None,
    ) -> None:
        """Guards and side effects of each human-driven row of the CR-BPTN-03 §4.1 table."""
        ticket = work.ticket
        key = (ticket.status, to)
        blocker = ticket.blocker
        code = blocker.code if blocker else None
        if role == Role.BPTN and code in BQL_REASONS:
            raise _Denied(work, f"{code} chỉ Ban quản lý xử lý")  # CR-BPTN-03 §4.4.5, audited

        def need_note(message: str) -> str:
            if _blank(note):
                raise GuardError(message)
            return note.strip()

        if to == S.CANCELLED:
            if _blank(cancel_reason):
                raise GuardError("cancel_reason bắt buộc khi hủy")
            self._apply_transition(work, to, actor_id, role, now, note=note, cancel_reason=cancel_reason.strip())
            for child_id in list(ticket.merged_children):  # §8.5: merged tickets go back to the pipeline
                child = self._related(child_id)
                if child.ticket.status == S.MERGED and child.ticket.merged_into == ticket.ticket_id:
                    self._unmerge(child, SYSTEM_ID, Role.SYSTEM, now, f"Ticket gốc {ticket.ticket_id} bị hủy")
        elif key == (S.ROUTED, S.IN_PROGRESS):
            self._apply_transition(work, to, actor_id, role, now, note=note, accepted_at=now)
        elif key == (S.ROUTED, S.VERIFYING):  # T15
            text = need_note("Trả lại sai phòng ban phải có lý do")
            count = ticket.wrong_department_return_count + 1
            # resume_step is decided by BPTN's answer: 6 if the category changes, 7 if not (never 8)
            wrong = self._new_blocker(work, R.WRONG_DEPT, now, resume_step=6, note=text)
            escalate = count >= self.catalog.sla_config.wrong_dept_return.escalate_at_count
            wrong.escalated = escalate
            self._apply_transition(
                work,
                to,
                actor_id,
                role,
                now,
                blocker=wrong,
                note=text,
                department_id=None,
                dispatched_at=None,
                wrong_department_return_count=count,
            )
            if escalate:
                self._notify(
                    work, "escalation", BlockerOwner.BQL, now, {"reason_code": R.WRONG_DEPT, "return_count": count}
                )
        elif key == (S.IN_PROGRESS, S.VERIFYING):  # T16: department data stays as it is
            text = need_note("Báo sai phòng ban phải có lý do")
            reported = self._new_blocker(work, R.WRONG_DEPT_AFTER_START, now, note=text)
            self._apply_transition(work, to, actor_id, role, now, blocker=reported, note=text)
            self._audit(
                work,
                Action.REPORT_WRONG_DEPT,
                "Ticket",
                ticket.ticket_id,
                actor_id,
                role,
                "blocker",
                None,
                R.WRONG_DEPT_AFTER_START,
                text,
                now=now,
            )
        elif key == (S.VERIFYING, S.IN_PROGRESS):  # T17
            if code != R.WRONG_DEPT_AFTER_START:
                raise InvalidTransitionError("Chỉ giữ phòng ban khi phòng ban báo sai sau khi đã làm")
            text = need_note("Giữ lại phòng ban phải có ghi chú")
            self._apply_transition(work, to, actor_id, role, now, note=text)
            self._audit(
                work,
                Action.BQL_KEEP_DEPARTMENT,
                "Ticket",
                ticket.ticket_id,
                actor_id,
                role,
                "department_id",
                ticket.department_id,
                ticket.department_id,
                text,
                now=now,
            )
        elif key == (S.IN_PROGRESS, S.ON_HOLD):  # T18
            if (reason or R.BLOCKED_ONSITE) == R.WAITING_MATERIAL:
                text = need_note("Báo thiếu vật tư phải có ghi chú")
                short = self._new_blocker(work, R.WAITING_MATERIAL, now, resume_step=6, note=text)
                self._apply_transition(work, to, actor_id, role, now, blocker=short, note=text)
            else:
                if _blank(note) or eta is None:
                    raise GuardError("BLOCKED_ONSITE bắt buộc lý do và eta")
                if eta.tzinfo is None or eta <= now:
                    raise GuardError("eta phải có timezone và ở tương lai")
                onsite = self._new_blocker(work, R.BLOCKED_ONSITE, now, note=note, eta=eta)
                self._apply_transition(work, to, actor_id, role, now, blocker=onsite, note=note)
        elif key == (S.ON_HOLD, S.IN_PROGRESS):
            if code != R.BLOCKED_ONSITE:
                raise InvalidTransitionError("Chỉ tiếp tục được khi đang tạm hoãn tại hiện trường (BLOCKED_ONSITE)")
            self._apply_transition(work, to, actor_id, role, now, note=note)
        elif key == (S.READY_FOR_REVIEW, S.CLOSED):  # T21
            self._apply_transition(
                work,
                to,
                actor_id,
                role,
                now,
                note=note,
                closed_by=actor_id,
                closed_at=now,
                closure_kind=ClosureKind.NORMAL,
            )
        elif key == (S.READY_FOR_REVIEW, S.IN_PROGRESS):  # T22: back to the same department, no BPTN re-check
            text = need_note("Trả lại làm lại (REWORK) phải có lý do")
            count = ticket.rework_count + 1
            rework = self._new_blocker(work, R.REWORK, now, note=text)
            escalate = count >= self.catalog.sla_config.rework.escalate_at_count
            rework.escalated = escalate
            for item in work.checklist_items:
                item.status, item.updated_by, item.updated_at = ChecklistStatus.PENDING, None, None
            self._apply_transition(work, to, actor_id, role, now, blocker=rework, note=text, rework_count=count)
            if escalate:
                self._notify(
                    work, "escalation", BlockerOwner.BQL, now, {"reason_code": R.REWORK, "rework_count": count}
                )
        elif key == (S.VERIFYING, S.MERGED):  # T08
            if code == R.DUPLICATE and role == Role.BPTN:
                target = blocker.related_ticket_id
            elif code == R.EMERGENCY_PENDING_BQL and role == Role.BQL:
                if _blank(into) or into == ticket.ticket_id:
                    raise GuardError("Chọn ticket gốc để gộp (khác ticket này)")
                target = into.strip()
            else:
                raise InvalidTransitionError("Chỉ gộp ticket chờ xác nhận trùng (BPTN) hoặc ticket khẩn cấp (BQL)")
            self._merge(work, target, actor_id, role, now, note=note)
        elif key == (S.MERGED, S.RECEIVED):  # T09
            self._unmerge(work, actor_id, role, now, need_note("Hoàn tác gộp phải có ghi chú"))
        elif key == (S.VERIFYING, S.RECEIVED):  # T05 by a person: tier 2 judged safe, or an emergency downgraded
            if code == R.SAFETY_REVIEW_REQUIRED and role in (Role.BPTN, Role.BQL):
                action = Action.SAFETY_CONFIRM_SAFE
            elif code == R.EMERGENCY_PENDING_BQL and role == Role.BQL:
                action = Action.EMERGENCY_DOWNGRADE
            else:
                raise InvalidTransitionError("Chỉ xác nhận an toàn (Bậc 2) hoặc hạ khẩn cấp (BQL) mới về RECEIVED")
            text = need_note("Xác nhận an toàn phải có lý do")
            self._clear_safety(work, actor_id, role, now, text, action)
            self._apply_transition(work, S.RECEIVED, actor_id, role, now, note=text)
            self._run_pipeline(work, 3 if self._category(work) is None else 4, now)
        elif key == (S.NEED_INFO, S.RECEIVED):  # T03 by BQL: the resident never answered a safety question
            if not ticket.safety_context:
                raise InvalidTransitionError("BQL chỉ xác nhận an toàn cho ticket đang hỏi cư dân vì nghi nguy hiểm")
            text = need_note("Xác nhận an toàn phải có lý do")
            self._clear_safety(work, actor_id, role, now, text, Action.SAFETY_CONFIRM_SAFE)
            self._apply_transition(work, S.RECEIVED, actor_id, role, now, note=text, safety_context=False)
            self._run_pipeline(work, 2, now)
        elif key == (S.VERIFYING, S.NEED_INFO):  # T06
            if code != R.SAFETY_REVIEW_REQUIRED:
                raise InvalidTransitionError("Chỉ hỏi cư dân bổ sung khi ticket đang chờ đánh giá rủi ro")
            text = need_note("Yêu cầu cư dân bổ sung phải có lý do")
            ask = self._new_blocker(work, R.MISSING_INFO, now, resume_step=2, note=text, safety_context=True)
            self._apply_transition(work, to, actor_id, role, now, blocker=ask, note=text, safety_context=True)
            self._audit(
                work,
                Action.SAFETY_REQUEST_INFO,
                "Ticket",
                ticket.ticket_id,
                actor_id,
                role,
                "safety_context",
                False,
                True,
                text,
                now=now,
            )
        elif key == (S.NEED_INFO, S.VERIFYING):  # T07
            self._raise_emergency(work, actor_id, role, now, need_note("Nâng khẩn cấp phải có ghi chú"))
        elif key == (S.VERIFYING, S.CLOSED):  # T10
            if code != R.EMERGENCY_PENDING_BQL:
                raise InvalidTransitionError("Chỉ đóng trực tiếp ticket khẩn cấp đã được BQL xử lý")
            text = need_note("Đóng ticket khẩn cấp phải ghi kết quả xử lý")
            self._apply_transition(
                work,
                to,
                actor_id,
                role,
                now,
                note=text,
                closed_by=actor_id,
                closed_at=now,
                closure_kind=ClosureKind.EMERGENCY_HANDLED,
            )
            self._audit(
                work,
                Action.EMERGENCY_CLOSE,
                "Ticket",
                ticket.ticket_id,
                actor_id,
                role,
                "closure_kind",
                None,
                ClosureKind.EMERGENCY_HANDLED,
                text,
                now=now,
            )
        else:
            raise InvalidTransitionError(f"Không chuyển được {ticket.status} → {to}")

    # ------------------------------------------------------------------ safety, merge helpers

    def _clear_safety(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, reason: str, action: Action
    ) -> None:
        """A person judged the current content safe. Valid only for this content: a later addition runs 3b again."""
        old = work.ticket.risk_level
        self._set_ticket(
            work,
            safety_cleared_by=actor_id,
            safety_cleared_at=now,
            safety_clear_reason=reason,
            risk_level=RiskLevel.NONE,
        )
        self._audit(
            work,
            action,
            "Ticket",
            work.ticket.ticket_id,
            actor_id,
            role,
            "risk_level",
            old,
            RiskLevel.NONE,
            reason,
            now=now,
        )

    def _raise_emergency(self, work: Case, actor_id: str, role: ActorRole, now: datetime, note: str | None) -> None:
        """E01 (VERIFYING, blocker changes owner to BQL) or T07 (from NEED_INFO). Never reversible by BPTN."""
        emergency = self._new_blocker(work, R.EMERGENCY_PENDING_BQL, now, note=note)
        old = work.ticket.risk_level
        if work.ticket.status == S.VERIFYING:
            self._set_blocker(work, emergency, actor_id, role, now, note=note, risk_level=RiskLevel.EMERGENCY)
        else:
            self._apply_transition(
                work,
                S.VERIFYING,
                actor_id,
                role,
                now,
                blocker=emergency,
                note=note,
                risk_level=RiskLevel.EMERGENCY,
                safety_context=False,
            )
        self._audit(
            work,
            Action.SAFETY_ESCALATE,
            "Ticket",
            work.ticket.ticket_id,
            actor_id,
            role,
            "risk_level",
            old,
            RiskLevel.EMERGENCY,
            note.strip() if not _blank(note) else "Nâng thành khẩn cấp",
            now=now,
        )
        self._notify(work, "emergency.created", BlockerOwner.BQL, now, {"by": role})

    def _merge(self, work: Case, into: str, actor_id: str, role: ActorRole, now: datetime, *, note: str | None) -> None:
        """T08 plus §8.1–8.2 on the original, in the same transaction: two-way link, the merged ticket's additions and
        photos appended to the original (append-only, with their source). The merged ticket's own report is kept."""
        original = self._related(into)
        if original.ticket.status in TERMINAL_STATUSES:
            raise GuardError(f"Ticket gốc {into} đã kết thúc; không gộp được", {"status": original.ticket.status})
        child_id = work.ticket.ticket_id
        self._apply_transition(work, S.MERGED, actor_id, role, now, note=note, merged_into=into)
        if child_id not in original.ticket.merged_children:
            original.ticket.merged_children = [*original.ticket.merged_children, child_id]
        for addition in work.additions:
            original.additions.append(
                ResidentAddition(
                    addition_id=f"SIM-ADD-{_suffix(into)}-{len(original.additions) + 1:02d}",
                    ticket_id=into,
                    content=f"[Từ {child_id}] {addition.content}",
                    submitted_by=addition.submitted_by,
                    submitted_at=now,
                )
            )
        for photo in resident_photos(work):
            self._copy_photo(photo, original, now)
        self._audit(
            original,
            Action.BQL_MERGE if role == Role.BQL else Action.BPTN_RESOLVE,
            "Ticket",
            into,
            actor_id,
            role,
            "merged_children",
            None,
            child_id,
            note.strip() if not _blank(note) else f"Gộp {child_id} vào ticket này",
            now=now,
        )

    def _unmerge(self, work: Case, actor_id: str, role: ActorRole, now: datetime, note: str) -> None:
        """T09: back to RECEIVED and through the pipeline again; the pair is never proposed again. What was already
        appended to the original stays there (append-only)."""
        original_id = work.ticket.merged_into
        original = self._related(original_id)
        original.ticket.merged_children = [c for c in original.ticket.merged_children if c != work.ticket.ticket_id]
        if original_id not in work.not_duplicate_of:
            work.not_duplicate_of.append(original_id)
        self._apply_transition(work, S.RECEIVED, actor_id, role, now, note=note, merged_into=None)
        self._audit(
            work,
            Action.MERGE_UNDO,
            "Ticket",
            work.ticket.ticket_id,
            actor_id,
            role,
            "merged_into",
            original_id,
            None,
            note,
            now=now,
        )
        emergency = work.ticket.risk_level == RiskLevel.EMERGENCY
        self._run_pipeline(work, 3 if emergency or self._category(work) is None else 4, now)

    def _copy_photo(self, photo: EvidenceRecord, target: Case, now: datetime) -> None:
        """The resident's photo attached to another ticket: a new record pointing to the same stored file."""
        target.evidence.append(
            photo.model_copy(
                update={
                    "evidence_id": f"SIM-EVD-{_suffix(target.ticket.ticket_id)}-{len(target.evidence) + 1:02d}",
                    "ticket_id": target.ticket.ticket_id,
                    "submitted_at": now,
                }
            )
        )

    # ------------------------------------------------------------------ resume and scheduled checks

    def _cleared(self, work: Case, blocker: Blocker, now: datetime) -> bool:
        code = blocker.code
        if code == R.MISSING_INFO:
            if work.ticket.safety_context:  # a safety question: only a new answer clears it, never the clock
                answered = any(a.submitted_at >= blocker.since for a in work.additions)
                return answered and not self._missing_fields(work)
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
        # NOT_ACCEPTED, BLOCKED_ONSITE, REWORK clear through their own transitions; SAFETY_REVIEW_REQUIRED through
        # BPTN's answer; EMERGENCY_PENDING_BQL and WRONG_DEPT_AFTER_START only through BQL (§4.4.4)
        return False

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
        if code == R.WAITING_MATERIAL and work.ticket.accepted_at is not None:  # T19: short after accepting
            self._apply_transition(work, S.IN_PROGRESS, SYSTEM_ID, Role.SYSTEM, now, note="Kho đã nhập đủ vật tư")
            self._notify(
                work, "department.dispatch", BlockerOwner.DEPARTMENT, now, {"department_id": work.ticket.department_id}
            )
            return True
        resume_step = {R.MISSING_INFO: 2, R.WAITING_MATERIAL: 6}.get(code, blocker.resume_step)
        self._apply_transition(work, S.RECEIVED, SYSTEM_ID, Role.SYSTEM, now, note=f"Gỡ {code}", safety_context=False)
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
            # §6.4: an unanswered safety question is never treated as safe; BQL decides
            safety_wait = blocker.code == R.SAFETY_REVIEW_REQUIRED or work.ticket.safety_context
            kind = "safety.review_escalated" if safety_wait else "escalation"
            self._notify(work, kind, BlockerOwner.BQL, now, {"reason_code": blocker.code, "why": why})

    # ------------------------------------------------------------------ pipeline (steps 2–8)

    def _run_pipeline(self, work: Case, from_step: int, now: datetime) -> None:
        if work.ticket.status != S.RECEIVED:
            raise EngineError(f"Pipeline chạy khi ticket ở {work.ticket.status}")
        steps = (
            (2, self._step_2_check_required_data),
            (3, self._step_3_classify_and_propose_department),
            (4, self._step_4_check_duplicate_ticket),
            (5, self._step_5_check_bptn_review_needed),
            (6, self._step_6_lookup_asset),
            (7, self._step_7_check_material_stock),
            (8, self._step_8_route_to_department),
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

    def _step_2_check_required_data(self, work: Case, now: datetime) -> bool:
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
            outcome = propose(self._content(work), self.llm, self.llm_label)  # the only place the LLM is called
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
                llm_risk_signals=list(outcome.risk_signals),
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

    def _step_3_classify_and_propose_department(self, work: Case, now: datetime) -> bool:
        """Category → playbook → proposed department, then step 3b (safety) and the priority. Runs before the
        duplicate check, which needs the category. An unclear category stops only after 3b has run (§5.1)."""
        locked = work.ticket.locked_fields.category
        cls = None
        if locked:
            self._bind_category(work, locked, "BPTN_LOCKED", now)  # BPTN already chose; never reclassify
        else:
            cls = self._classification(work, now)
            if cls.playbook_id is not None:
                self._bind_category(work, cls.service_category, "AGENT", now)
        if self._step_3b_check_safety_signals(work, now):
            return True
        self._set_agent_priority(work, now)
        if cls is not None and cls.playbook_id is None:
            return self._stop(
                work, S.VERIFYING, cls.reason_code or R.CATEGORY_UNCLEAR, now, resume_step=4, note=cls.reason
            )
        return False

    def _safety_text(self, work: Case) -> str | None:
        """What step 3b reads. After a person confirmed safe, only what was added since; None = nothing new (skip)."""
        cleared = work.ticket.safety_cleared_at
        if cleared is None:
            return self._content(work)
        new = [a.content for a in work.additions if a.submitted_at > cleared]
        return "\n".join(new) if new else None

    def _step_3b_check_safety_signals(self, work: Case, now: datetime) -> bool:
        """Safety layer for EVERY ticket, unclear or out-of-scope ones included (§6). Fixed rules decide; the model's
        signals cached at classification may only raise the level. Tier 1 → BQL; tier 2 → BPTN."""
        ticket = work.ticket
        text = self._safety_text(work)
        if text is None:
            return False
        rule = safety.assess(text)
        fresh = ticket.safety_cleared_at is None  # the model read the full report, so its signals still apply
        llm = work.classification.llm_risk_signals if fresh and work.classification else []
        result = safety.merge_llm(rule, llm, text)
        signals = list(result.signals) if fresh else [*ticket.risk_signals, *result.signals]
        amplifiers = sorted({*ticket.risk_amplifiers, *result.amplifiers})
        self._set_ticket(work, risk_level=result.risk_level, risk_signals=signals, risk_amplifiers=amplifiers)
        self._agent(
            work,
            Action.ASSESS_SAFETY,
            "Ticket",
            ticket.ticket_id,
            "risk_level",
            None,
            {"risk_level": result.risk_level, "signals": [s.signal_id for s in result.signals if s.status != "ABSENT"]},
            "Tầng an toàn bước 3b" + ("" if fresh else " trên phần bổ sung sau xác nhận an toàn"),
            now=now,
        )
        if result.risk_level == RiskLevel.NONE:
            return False
        self._set_agent_priority(work, now)
        quotes = "; ".join(f"{s.signal_id}: {s.source_quote}" for s in result.signals if s.status != "ABSENT")
        if result.risk_level == RiskLevel.EMERGENCY:
            self._link_same_place(work)  # §8.6: link only, never stop or merge on its own
            self._stop(work, S.VERIFYING, R.EMERGENCY_PENDING_BQL, now, resume_step=None, note=quotes)
            self._notify(work, "emergency.created", BlockerOwner.BQL, now, {"signals": quotes})
            return True
        return self._stop(work, S.VERIFYING, R.SAFETY_REVIEW_REQUIRED, now, resume_step=3, note=quotes)

    def _link_same_place(self, work: Case) -> None:
        """An emergency is linked (both ways) to open tickets at the same place inside the window, same category when
        the category is known. BQL may then merge them (T08)."""
        location = self.effective_location(work)
        created = _created_at(work.ticket.raw)
        if location is None or created is None:
            return
        category = self._category(work)
        window = timedelta(hours=self.catalog.sla_config.duplicate_window_hours)
        for other in self.repo.list():
            ticket = other.ticket
            if ticket.ticket_id == work.ticket.ticket_id or ticket.status in TERMINAL_STATUSES:
                continue
            if category is not None and self._category(other) != category:
                continue
            other_created = _created_at(ticket.raw)
            if other_created is None or abs(other_created - created) > window:
                continue
            if self.effective_location(other) == location:
                self._link(work, ticket.ticket_id)

    def _link(self, work: Case, other_id: str) -> bool:
        """Two-way `related_ticket_ids`. Returns True when the other ticket had not been linked to this one yet."""
        other = self._related(other_id)
        mine = work.ticket.ticket_id
        if other_id not in work.ticket.related_ticket_ids:
            work.ticket.related_ticket_ids = [*work.ticket.related_ticket_ids, other_id]
        if mine in other.ticket.related_ticket_ids:
            return False
        other.ticket.related_ticket_ids = [*other.ticket.related_ticket_ids, mine]
        return True

    def _set_agent_priority(self, work: Case, now: datetime) -> None:
        """§7 rules. A priority a person set is never overwritten."""
        ticket = work.ticket
        if ticket.priority_source == PrioritySource.HUMAN_OVERRIDE:
            return
        decision = priority_rules.decide(
            self._category(work),
            self.effective_location(work),
            self._content(work),
            duplicate_count=ticket.duplicate_count,
            raise_at=self.catalog.sla_config.priority.duplicate_raise_at_count,
            amplifiers=ticket.risk_amplifiers,
        )
        current = (ticket.priority, ticket.priority_rule_id, ticket.priority_reason)
        if current == (decision.priority, decision.rule_id, decision.reason):
            return
        self._set_ticket(
            work,
            priority=decision.priority,
            priority_source=PrioritySource.AGENT_RULE,
            priority_rule_id=decision.rule_id,
            priority_reason=decision.reason,
        )
        self._agent(
            work,
            Action.SET_PRIORITY,
            "Ticket",
            ticket.ticket_id,
            "priority",
            current[0],
            decision.priority,
            decision.reason,
            now=now,
            rule_id=decision.rule_id,
        )

    def _step_4_check_duplicate_ticket(self, work: Case, now: datetime) -> bool:
        """An open ticket created earlier, same category and location, within the window → BPTN decides. The original
        counts the report (§8) and may move up a priority level (PRI-U1)."""
        duplicate_of = self._find_duplicate_ticket_id(work)
        if duplicate_of is None:
            return False
        if self._link(work, duplicate_of):
            original = self._related(duplicate_of)
            original.ticket.duplicate_count += 1
            self._agent(
                original,
                Action.RUN_PIPELINE,
                "Ticket",
                duplicate_of,
                "duplicate_count",
                original.ticket.duplicate_count - 1,
                original.ticket.duplicate_count,
                f"{work.ticket.ticket_id} có thể trùng ticket này",
                now=now,
            )
            if original.ticket.status not in TERMINAL_STATUSES:
                self._set_agent_priority(original, now)
        window = timedelta(hours=self.catalog.sla_config.duplicate_window_hours)
        return self._stop(
            work,
            S.VERIFYING,
            R.DUPLICATE,
            now,
            resume_step=5,
            related_ticket_id=duplicate_of,
            note=f"Cùng vị trí và loại với {duplicate_of} trong {window}",
        )

    def _find_duplicate_ticket_id(self, work: Case) -> str | None:
        """The earliest matching ticket. Cheap fields are compared first; the location, the one comparison that
        parses report text, is read only for open tickets of the same category inside the window."""
        category, location = self._category(work), self.effective_location(work)
        created = _created_at(work.ticket.raw)
        if category is None or location is None or created is None:
            return None  # steps 2 and 3 already stop such tickets
        mine = (created, work.ticket.ticket_id)
        earliest = created - timedelta(hours=self.catalog.sla_config.duplicate_window_hours)
        matches = []
        for other in self.repo.list():
            ticket = other.ticket
            if (
                ticket.ticket_id == work.ticket.ticket_id
                or ticket.ticket_id in work.not_duplicate_of
                or ticket.status in TERMINAL_STATUSES
                or self._category(other) != category
            ):
                continue
            other_created = _created_at(ticket.raw)
            if other_created is None or other_created < earliest or (other_created, ticket.ticket_id) >= mine:
                continue
            if self.effective_location(other) == location:
                matches.append((other_created, ticket.ticket_id))
        return min(matches)[1] if matches else None

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
        """Step 3: only a proposal. `department_id` is written at step 8, after review and asset lookup."""
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

    def _step_5_check_bptn_review_needed(self, work: Case, now: datetime) -> bool:
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

    def _step_6_lookup_asset(self, work: Case, now: datetime) -> bool:
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
        stock = self.repo.stock_of(item_code)
        if stock is None:
            return MaterialStockStatus.UNKNOWN
        return MaterialStockStatus.INSUFFICIENT if stock < planned_qty else MaterialStockStatus.SUFFICIENT

    def _step_7_check_material_stock(self, work: Case, now: datetime) -> bool:
        """Planned materials, then each line against simulated stock. Short → ON_HOLD; when stock arrives the
        pipeline resumes at step 6 (asset lookup), as the flow diagram draws it."""
        source = self._plan_materials_for_playbook(work)
        status = self._check_material_lines_against_stock(work)
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
                work, S.ON_HOLD, R.WAITING_MATERIAL, now, resume_step=6, note="Tồn kho mô phỏng không đủ vật tư dự kiến"
            )
        return False

    def _plan_materials_for_playbook(self, work: Case) -> str:
        """Keep the ticket's own plan, or take the playbook defaults. Returns where the plan came from."""
        playbook_id = work.proposal.playbook_id
        if work.planned_for_playbook not in (None, playbook_id):
            work.planned_materials = None  # the previous plan belonged to the other playbook
        if work.planned_materials is None:
            work.planned_materials = list(self.catalog.default_materials.get(playbook_id, ()))
            source = f"vật tư mặc định của {playbook_id}"
        else:
            source = "kế hoạch vật tư của ticket"
        work.planned_for_playbook = playbook_id
        return source

    def _check_material_lines_against_stock(self, work: Case) -> MaterialStockStatus:
        suffix = _suffix(work.ticket.ticket_id)
        previous = {line.item_code: line for line in work.material_lines}
        lines = [
            self._material_line(f"SIM-WOD-{suffix}", suffix, index, planned)
            for index, planned in enumerate(work.planned_materials, start=1)
        ]
        for line in lines:  # E02: what the first department already issued and used is kept (CR-BPTN-03 §9.3)
            old = previous.get(line.item_code)
            if old is not None and (old.issued_qty is not None or old.used_qty is not None):
                line.issued_qty, line.used_qty, line.variance_reason = old.issued_qty, old.used_qty, old.variance_reason
        work.material_lines = lines
        return _aggregate_stock(work.material_lines)

    def _step_8_route_to_department(self, work: Case, now: datetime) -> bool:
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
            simulated_stock_qty=self.repo.stock_of(planned.item_code),
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


def build_engine(settings: "Settings | None" = None) -> MaintenanceEngine:
    """Engine configured from settings: MO_STORE picks the repository (postgres is checked before use, a wrong URL or
    schema revision raises RuntimeError); LLM_MODE=openai with a key adds the OpenAI proposer, otherwise rules only."""
    from src.config import get_settings
    from src.maintenance.proposer import openai_client

    settings = settings or get_settings()
    repo = None
    if settings.mo_store == "postgres":
        from src.maintenance.store.postgres import PostgresRepository  # lazy: memory mode needs no psycopg2

        repo = PostgresRepository(settings.database_url)
        repo.check()
    if settings.llm_mode == "openai" and settings.openai_api_key:
        return MaintenanceEngine(
            repo=repo,
            llm=openai_client(settings.model_name, settings.openai_api_key, settings.openai_base_url),
            llm_label=settings.model_name,
        )
    return MaintenanceEngine(repo=repo)


def seed_if_empty(engine: MaintenanceEngine) -> bool:
    """Startup seeding: the fixture goes in only when the store holds no ticket. True if this call seeded."""
    with engine.lock, engine.repo.seed_lease() as leader:  # engine.lock first, the DB lease second (I-9)
        if not leader or engine.repo.count() > 0:
            return False
        engine.seed()
        return True
