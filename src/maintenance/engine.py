"""MaintenanceOps Agent engine, CR-BPTN-02 (v0.5 candidate).

Flow: resident report → Agent pipeline steps 2–8 (data, category + department, duplicate, BPTN review, asset,
material + stock, route to department) → department accepts and works → step 10 reconciliation → BQL closes.
Classification runs before the duplicate check: the check then compares only tickets of the same category, and a
ticket whose category is unclear stops before any other ticket is read.

Rules that hold everywhere:
  - every status change goes through `_apply_transition`: it checks TRANSITIONS, writes exactly one StatusEvent
    and emits `ticket.status_changed`. An invalid transition raises; it is never skipped silently;
  - only BQL closes or cancels; the Agent never writes `assignee_id` or a locked field; the raw report never changes;
  - a stop is a `blocker` with an owner, a resume step and escalation times. Escalation only raises a flag and
    notifies BQL, it never changes the status;
  - every public operation checks permission first (denial = ACTION_DENIED audit, nothing else changes), works on a
    deep copy and commits only after the audit sink accepted the new rows (audit failure = fail closed).
"""

import logging
import threading
from collections.abc import Callable, Iterator, Mapping, MutableMapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

from src.maintenance.catalog import Catalog, Lexicon, TicketDataset, load_catalog, load_dataset, load_lexicon
from src.maintenance.enums import (
    BPTN_REASONS,
    BQL_REASONS,
    PLAYBOOK_BY_CATEGORY,
    PLAYBOOK_VERSION,
    SAFETY_REASONS,
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
    SignalStatus,
    TicketFlag,
    TicketStatus,
)
from src.maintenance.messages import field_label, public_message, safety_info_message
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
from src.maintenance.priority import propose_priority
from src.maintenance.proposer import LLMClient, propose
from src.maintenance.rules import extract_location, missing_location_parts
from src.maintenance.safety import SafetyLLMClient, assess_with_llm
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
    # Action.SET_ASSIGNEE is not listed: every role is denied, with an audit row (CR-BPTN-03 §4.4.2)
    Action.UPDATE_CHECKLIST: frozenset({Role.DEPARTMENT}),
    Action.UPDATE_MATERIAL: frozenset({Role.DEPARTMENT}),
    Action.ADD_EVIDENCE: frozenset({Role.DEPARTMENT}),
    Action.REPORT_COMPLETE: frozenset({Role.DEPARTMENT}),
    Action.RUN_JOBS: frozenset({Role.SYSTEM}),
    Action.SAFETY_CONFIRM_SAFE: frozenset({Role.BPTN, Role.BQL}),  # §6.4 (BPTN), §6.4 last paragraph (BQL)
    Action.SAFETY_ESCALATE: frozenset({Role.BPTN, Role.BQL}),  # E01 (BPTN|BQL); T07 is BQL only (via TRANSITIONS)
    Action.SAFETY_REQUEST_INFO: frozenset({Role.BPTN, Role.BQL}),  # T06
    Action.EMERGENCY_DOWNGRADE: frozenset({Role.BQL}),  # §6.5
    Action.EMERGENCY_CLOSE: frozenset({Role.BQL}),  # T10
    Action.SET_PRIORITY: frozenset({Role.BPTN, Role.BQL}),  # §7
}


@dataclass(frozen=True)
class TransitionRule:
    actors: frozenset[ActorRole]
    reasons: frozenset[ReasonCode] = frozenset()  # reason codes this transition may carry
    reason_required: bool = False
    pipeline_only: bool = False  # driven by the pipeline / resume, never by an outside caller


def _rule(*actors: ActorRole, reasons=(), required=False, pipeline=False) -> TransitionRule:
    return TransitionRule(frozenset(actors), frozenset(reasons), required, pipeline)


# CR-BPTN-03 §4.1. The only allowed status changes: 18 rows + cancel from the 7 non-terminal statuses.
TRANSITIONS: dict[tuple[TicketStatus, TicketStatus], TransitionRule] = {
    (S.RECEIVED, S.NEED_INFO): _rule(Role.SYSTEM, reasons=[R.MISSING_INFO], required=True, pipeline=True),  # T02
    (S.NEED_INFO, S.RECEIVED): _rule(Role.SYSTEM, Role.BQL),  # T03: not pipeline-only, BQL clears a safety NEED_INFO
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
    (S.VERIFYING, S.MERGED): _rule(Role.BPTN),  # T08 (BQL merge is P1)
    (S.VERIFYING, S.RECEIVED): _rule(Role.SYSTEM, Role.BPTN, Role.BQL),  # T05: not pipeline-only
    (S.VERIFYING, S.NEED_INFO): _rule(Role.BPTN, Role.BQL, reasons=[R.MISSING_INFO], required=True),  # T06
    (S.NEED_INFO, S.VERIFYING): _rule(Role.BQL, reasons=[R.EMERGENCY_PENDING_BQL], required=True),  # T07
    (S.VERIFYING, S.CLOSED): _rule(Role.BQL),  # T10
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
    **{(status, S.CANCELLED): _rule(Role.BQL) for status in S if status not in TERMINAL_STATUSES},
}

BLOCKER_OWNERS: dict[ReasonCode, BlockerOwner] = {
    **{code: BlockerOwner.BPTN for code in BPTN_REASONS},
    R.SAFETY_REVIEW_REQUIRED: BlockerOwner.BPTN,
    R.EMERGENCY_PENDING_BQL: BlockerOwner.BQL,
    R.WRONG_DEPT_AFTER_START: BlockerOwner.BQL,  # Q-A: declared only, nothing creates it in P0
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

    def __init__(self, case: Case, message: str | None, deny_kwargs: dict[str, Any] | None = None):
        super().__init__(message)
        self.case = case
        self.message = message
        self.deny_kwargs = deny_kwargs  # set when `_deny` itself deferred: the exact denial to write


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
        lexicon: Lexicon | None = None,
        safety_llm: SafetyLLMClient | None = None,
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
        self.lexicon = lexicon or load_lexicon()  # fail fast: a broken lexicon.yaml stops the engine (01 §10.4)
        self.safety_llm = safety_llm  # Q09: P0 never sets it outside tests; build_engine() leaves it None
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
        with self.repo.transaction() as tx:
            tx.insert(work)  # a duplicate ticket_id raises GuardError("... đã được ingest")
            self._commit(tx, work, 0, 0, 0)
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
        def op(work: Case, now: datetime) -> None:
            if work.ticket.status != S.CLOSED:
                raise GuardError("Chỉ đánh giá được khi ticket đã hoàn thành")
            if work.ticket.rating is not None:
                raise GuardError(
                    "Đã đánh giá; không sửa được đánh giá (CR-BPTN-03 §11)", {"rating": work.ticket.rating}
                )
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
        """CR-BPTN-03 §4.3: a closed ticket is never reopened. Kept because the router still calls it (Q03).

        Always INVALID_TRANSITION (409), no audit: a pair outside the table is not a permission denial.
        """
        self.get(ticket_id)  # 404 first
        raise InvalidTransitionError(
            "Không còn mở lại ticket đã đóng (CR-BPTN-03 §4.3); cư dân tạo phản ánh mới",
            {"from": S.CLOSED, "to": S.READY_FOR_REVIEW, "actor_id": actor_id},
        )

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
            Every missing field must be covered, otherwise nothing is saved; then the pipeline resumes at step 2,
            so the safety layer 2b runs again on the new content. Never on a safety NEED_INFO (`safety_context`,
            T06): GuardError, only the resident's answer or BQL (T03/T07) moves it (plan 02 Q04).

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
            if blocker is None or blocker.code not in BPTN_REASONS:
                raise GuardError("Không có blocker nào chờ BPTN", {"status": ticket.status})
            code = blocker.code
            if ticket.status != (S.NEED_INFO if code == R.MISSING_INFO else S.VERIFYING):
                raise GuardError("Không có blocker nào chờ BPTN", {"status": ticket.status})
            if code == R.MISSING_INFO and ticket.safety_context:
                # Q04 (plan 02): a safety NEED_INFO (T06) moves only on the resident's own answer (2b reruns) or a
                # BQL decision (T03 confirm safe / T07 escalate); BPTN's phone note must not clear it.
                raise GuardError(
                    "NEED_INFO do tầng an toàn: chờ cư dân tự bổ sung hoặc BQL quyết (T03/T07); BPTN không gỡ",
                    {"reason_code": code, "safety_context": True},
                )
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
            ticket = work.ticket  # `_set_ticket` (priority) replaced the object: refresh before writing more fields
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

    # ------------------------------------------------------------------ safety layer: human actions (SPEC-P02)

    def safety_confirm_safe(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """CR-03 T05 (BPTN or BQL, VERIFYING + SAFETY_REVIEW_REQUIRED) and T03 (BQL only, safety NEED_INFO).

        Clears the safety state with a mandatory reason, then reruns the pipeline from step 2 (2b skips itself).
        """
        with self.lock:
            case = self.get(ticket_id)
            if case.ticket.status == S.NEED_INFO:  # T03: BQL only
                self._safety_precheck(
                    ticket_id,
                    actor_id,
                    Action.SAFETY_CONFIRM_SAFE,
                    statuses={S.NEED_INFO},
                    codes={R.MISSING_INFO},
                    note=note,
                    note_required=True,
                    require_safety_context=True,
                    bql_only_when={S.NEED_INFO},
                )
                return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.NEED_INFO)
            case = self._safety_precheck(
                ticket_id,
                actor_id,
                Action.SAFETY_CONFIRM_SAFE,
                statuses={S.VERIFYING},
                codes={R.SAFETY_REVIEW_REQUIRED, R.EMERGENCY_PENDING_BQL},
                note=note,
                note_required=True,
                bql_needs_escalation=True,
            )
            if case.ticket.blocker.code == R.EMERGENCY_PENDING_BQL:
                raise GuardError("Ticket khẩn cấp: dùng emergency_downgrade", {"reason_code": R.EMERGENCY_PENDING_BQL})
            return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.VERIFYING)

    def safety_escalate(self, ticket_id: str, actor_id: str, *, note: str | None = None) -> Case:
        """CR-03 E01 (BPTN or BQL: tier 2 becomes tier 1, status unchanged) and T07 (BQL only, safety NEED_INFO)."""
        with self.lock:
            case = self.get(ticket_id)
            if case.ticket.status == S.NEED_INFO:  # T07: BQL only
                self._safety_precheck(
                    ticket_id,
                    actor_id,
                    Action.SAFETY_ESCALATE,
                    statuses={S.NEED_INFO},
                    codes={R.MISSING_INFO},
                    note=note,
                    note_required=False,
                    require_safety_context=True,
                    bql_only_when={S.NEED_INFO},
                )
                return self.transition(ticket_id, S.VERIFYING, actor_id, note=note, expected_from=S.NEED_INFO)
            self._safety_precheck(
                ticket_id,
                actor_id,
                Action.SAFETY_ESCALATE,
                statuses={S.VERIFYING},
                codes={R.SAFETY_REVIEW_REQUIRED},
                note=note,
                note_required=False,
                bql_needs_escalation=True,
            )
            role = self._role(actor_id)

            def op(work: Case, now: datetime) -> None:  # E01: the owner changes, the status does not
                ticket, blocker = work.ticket, work.ticket.blocker
                if ticket.status != S.VERIFYING or blocker is None or blocker.code != R.SAFETY_REVIEW_REQUIRED:
                    raise GuardError("Chỉ nâng khẩn cấp từ SAFETY_REVIEW_REQUIRED", {"status": ticket.status})
                emergency = self._new_blocker(work, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=note)
                self._audit(
                    work,
                    Action.SAFETY_ESCALATE,
                    "Ticket",
                    ticket.ticket_id,
                    actor_id,
                    role,
                    "blocker.code",
                    R.SAFETY_REVIEW_REQUIRED,
                    R.EMERGENCY_PENDING_BQL,
                    note.strip() if not _blank(note) else "Nâng Bậc 2 thành khẩn cấp (E01)",
                    now=now,
                )
                self._set_blocker(work, emergency, actor_id, role, now, note=note, risk_level=RiskLevel.EMERGENCY)
                self._notify(
                    work,
                    "emergency.created",
                    BlockerOwner.BQL,
                    now,
                    {"risk_level": RiskLevel.EMERGENCY, "escalated_by": actor_id, "from": R.SAFETY_REVIEW_REQUIRED},
                )

            return self._mutate(ticket_id, actor_id, Action.SAFETY_ESCALATE, op)

    def safety_request_info(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """CR-03 T06 (BPTN or BQL): ask the resident for more detail; VERIFYING → NEED_INFO with safety_context."""
        with self.lock:
            self._safety_precheck(
                ticket_id,
                actor_id,
                Action.SAFETY_REQUEST_INFO,
                statuses={S.VERIFYING},
                codes={R.SAFETY_REVIEW_REQUIRED},
                note=note,
                note_required=True,
                bql_needs_escalation=True,
            )
            return self.transition(ticket_id, S.NEED_INFO, actor_id, note=note, expected_from=S.VERIFYING)

    def emergency_downgrade(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """CR-03 T05 (BQL only, VERIFYING + EMERGENCY_PENDING_BQL): a false alarm; the normal flow restarts."""
        with self.lock:
            self._safety_precheck(
                ticket_id,
                actor_id,
                Action.EMERGENCY_DOWNGRADE,
                statuses={S.VERIFYING},
                codes={R.EMERGENCY_PENDING_BQL},
                note=note,
                note_required=True,
            )
            return self.transition(ticket_id, S.RECEIVED, actor_id, note=note, expected_from=S.VERIFYING)

    def emergency_close(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """CR-03 T10 (BQL only, VERIFYING + EMERGENCY_PENDING_BQL): handled outside the system; closes the ticket."""
        with self.lock:
            self._safety_precheck(
                ticket_id,
                actor_id,
                Action.EMERGENCY_CLOSE,
                statuses={S.VERIFYING},
                codes={R.EMERGENCY_PENDING_BQL},
                note=note,
                note_required=True,
            )
            return self.transition(ticket_id, S.CLOSED, actor_id, note=note, expected_from=S.VERIFYING)

    def set_priority(self, ticket_id: str, actor_id: str, priority: Priority, *, note: str) -> Case:
        """CR-03 §7 manual change: BPTN or BQL, reason required, audit SET_PRIORITY, source HUMAN_OVERRIDE.

        No status event and no notification. Later pipeline reruns never overwrite it.
        """
        try:
            priority = Priority(priority)
        except ValueError as exc:
            raise GuardError(f"priority không hợp lệ: {priority!r}") from exc

        def op(work: Case, now: datetime) -> None:
            ticket = work.ticket
            if ticket.status in TERMINAL_STATUSES:
                raise GuardError("Ticket đã kết thúc; không sửa priority", {"status": ticket.status})
            if _blank(note):
                raise GuardError("Sửa priority bắt buộc ghi lý do")
            self._audit(
                work,
                Action.SET_PRIORITY,
                "Ticket",
                ticket_id,
                actor_id,
                self._role(actor_id),
                "priority",
                ticket.priority,
                priority,
                note.strip(),
                now=now,
            )
            self._set_ticket(
                work,
                priority=priority,
                priority_source=PrioritySource.HUMAN_OVERRIDE,
                priority_rule_id=None,
                priority_reason=note.strip(),
            )

        return self._mutate(ticket_id, actor_id, Action.SET_PRIORITY, op)

    def _bql_escalation_gate(
        self, case: Case, actor_id: str, role: ActorRole | None, action: Action, note: str | None, now: datetime
    ) -> None:
        """Q19: BQL uses the three tier-2 choices only on a ticket that has already been escalated (4 h passed)."""
        blocker = case.ticket.blocker
        if (
            role == Role.BQL
            and blocker is not None
            and blocker.code == R.SAFETY_REVIEW_REQUIRED
            and not blocker.escalated
        ):
            self._deny(
                case,
                actor_id,
                role,
                action,
                "blocker",
                blocker.code,
                None if _blank(note) else note,
                now,
                message="BQL chỉ xử lý Bậc 2 sau khi ticket đã leo thang (CR-03 §2)",
            )

    def _safety_precheck(
        self,
        ticket_id: str,
        actor_id: str,
        action: Action,
        *,
        statuses: set[TicketStatus] | frozenset[TicketStatus],
        codes: set[ReasonCode] | frozenset[ReasonCode],
        note: str | None,
        note_required: bool,
        require_safety_context: bool = False,
        bql_only_when: set[TicketStatus] | frozenset[TicketStatus] = frozenset(),
        bql_needs_escalation: bool = False,
    ) -> Case:
        """Checks shared by the safety methods, in the fixed order: 404, 403 (role, BPTN on a BQL blocker, BQL-only
        statuses, Q19), 409 INVALID (status / blocker / safety_context), 409 GUARD (note). Call under `self.lock`."""
        case = self.get(ticket_id)
        now = self.clock()
        role = self._role(actor_id)
        ticket, blocker = case.ticket, case.ticket.blocker
        target = blocker.code if blocker else None
        reason = None if _blank(note) else note

        def deny(message: str) -> None:
            self._deny(case, actor_id, role, action, "blocker", target, reason, now, message=message)

        if role is None or role not in PERMISSIONS.get(action, frozenset()):
            deny(f"{role or 'actor không xác định'} không được {action}")
        if role == Role.BPTN and blocker is not None and blocker.code in BQL_REASONS:
            deny(f"Blocker {blocker.code} thuộc BQL; BPTN không được tác động (CR-03 §4.4.5)")
        if role != Role.BQL and ticket.status in bql_only_when:
            deny(f"Chỉ BQL được {action} khi ticket ở {ticket.status}")
        if bql_needs_escalation:
            self._bql_escalation_gate(case, actor_id, role, action, note, now)
        if ticket.status not in statuses or blocker is None or blocker.code not in codes:
            raise InvalidTransitionError(
                f"{action} không áp dụng cho ticket ở {ticket.status} / {target}", {"status": ticket.status}
            )
        if require_safety_context and not ticket.safety_context:
            raise InvalidTransitionError(f"{action} chỉ áp dụng cho NEED_INFO do tầng an toàn (safety_context)")
        if note_required and _blank(note):
            raise GuardError(f"{action} bắt buộc ghi lý do")
        return case

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
        """CR-BPTN-03 §4.4.2: nobody assigns a person in this version. Every role gets ACTION_DENIED with an audit."""
        return self._mutate(
            ticket_id,
            actor_id,
            Action.SET_ASSIGNEE,
            lambda work, now: None,
            roles=frozenset(),
            field_name="assignee_id",
            new_value=assignee_id,
            reason="Gán nhân viên bị tắt (CR-BPTN-03 §4.4.2)",
        )

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
    ) -> Case:
        """Change status on behalf of a person (department, BQL, BPTN, resident). Checks the CR §3 table.

        A role that may never reach `to` is denied and audited (e.g. anyone but BQL closing). A role that may reach
        `to`, but not from the current status, gets INVALID_TRANSITION. `expected_from` pins the source for the
        named actions that share a target (accept / resume_work / rework all lead to IN_PROGRESS).
        """
        with self.lock:
            return self._transition(ticket_id, to, actor_id, note, eta, cancel_reason, expected_from)

    def _transition(
        self,
        ticket_id: str,
        to: TicketStatus,
        actor_id: str,
        note: str | None,
        eta: datetime | None,
        cancel_reason: str | None,
        expected_from: TicketStatus | None,
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
            with self.repo.transaction() as tx, self._in_transaction():
                case = tx.get_for_update(ticket_id)  # row lock (I-3)
                if role is None or role not in allowed:
                    raise _Denied(case, None)
                scope_error = self._scope_error(case, actor_id, role)
                if scope_error:
                    raise _Denied(case, scope_error)
                blocker = case.ticket.blocker
                # I-11 (CR-03 §4.4.5, AC-06): BPTN may not touch a ticket whose blocker BQL owns, `bptn_resolve`
                # included. Checked on the locked copy.
                if role == Role.BPTN and blocker is not None and blocker.code in BQL_REASONS:
                    raise _Denied(case, f"Blocker {blocker.code} thuộc BQL; BPTN không được tác động (CR-03 §4.4.5)")

                if case.ticket.raw.integrity_marker() != case.ticket.raw_integrity_marker:
                    raise EngineError("Raw integrity marker không khớp; dừng xử lý (fail closed)")

                work = case.model_copy(deep=True)
                marks = (len(work.audit), len(work.events), len(work.notifications))
                op(work, now)
                self._commit(tx, work, *marks)
        except _Denied as denied:  # the transaction above rolled back; the denial is written in its own
            if denied.deny_kwargs is not None:  # raised by `_deny` inside `op` (e.g. the Q19 gate of T06/T07)
                self._deny(**denied.deny_kwargs)
            self._deny(denied.case, actor_id, role, action, field_name, new_value, reason, now, message=denied.message)
        return work

    @contextmanager
    def _in_transaction(self) -> Iterator[None]:
        """Marks this thread as inside `_mutate_locked`'s transaction: `_deny` then defers (never nests a tx)."""
        depth = getattr(self._local, "tx_depth", 0)
        self._local.tx_depth = depth + 1
        try:
            yield
        finally:
            self._local.tx_depth = depth

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
        """Write one ACTION_DENIED audit row in its own transaction, then raise ActionDeniedError.

        Called from inside `op` (an open `_mutate_locked` transaction), it raises `_Denied` instead: that transaction
        rolls back first, then the denial is written in its own (no nested transaction, Postgres would self-lock)."""
        if getattr(self._local, "tx_depth", 0):
            raise _Denied(
                case,
                message,
                {
                    "case": case,
                    "actor_id": actor_id,
                    "role": role,
                    "action": action,
                    "field_name": field_name,
                    "new_value": new_value,
                    "reason": reason,
                    "now": now,
                    "message": message,
                },
            )
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
        next_retry_at = self._schedule(work, code, now, eta, safety_context=safety_context)
        escalate_at, dispatch_at = None, None
        if code == R.MISSING_INFO and safety_context:  # T06: BQL after 12 calendar hours (CR-03 §6.4, D-02)
            escalate_at = now + timedelta(hours=sla.missing_info.safety_context.escalate_after_hours)
        elif code == R.SAFETY_REVIEW_REQUIRED:
            escalate_at = now + timedelta(hours=sla.safety_review.escalate_after_hours)  # calendar hours (Q10)
        elif code == R.EMERGENCY_PENDING_BQL:
            escalate_at = None  # BQL is notified at once (emergency.created)
        elif code in BPTN_REASONS:  # ordinary MISSING_INFO included (f1c6ebf): BPTN contacts the resident
            escalate_at = self.catalog.business_hours.add(now, sla.bptn.escalate_after_business_hours)
        elif code == R.WAITING_MATERIAL:
            escalate_at = now + timedelta(hours=sla.waiting_material.escalate_after_hours)
            eta = eta or escalate_at
        elif code == R.OUT_OF_HOURS:
            dispatch_at = next_retry_at
        elif code == R.BLOCKED_ONSITE:
            escalate_at = eta
        field_text = ", ".join(field_label(f) for f in fields or [])
        if code == R.MISSING_INFO and safety_context:
            message = safety_info_message(field_text)
        else:
            message = public_message(
                work.ticket.status,
                code,
                department=self._department_name(work),
                fields=field_text,
                eta=eta,
                dispatch_at=dispatch_at,
            )
        # Q04 (plan 02): an ordinary MISSING_INFO is BPTN's (f1c6ebf); the safety NEED_INFO (T06) waits on the resident
        owner = BlockerOwner.RESIDENT if code == R.MISSING_INFO and safety_context else BLOCKER_OWNERS[code]
        return Blocker(
            code=code,
            owner_role=owner,
            since=now,
            resume_step=resume_step,
            next_retry_at=next_retry_at,
            escalate_at=escalate_at,
            eta=eta,
            public_message=message,
            internal_note=None if _blank(note) else note.strip(),
            related_ticket_id=related_ticket_id,
        )

    def _schedule(
        self,
        work: Case,
        code: ReasonCode,
        now: datetime,
        eta: datetime | None = None,
        *,
        safety_context: bool = False,
    ) -> datetime | None:
        """When the job should next retry / remind for this blocker. None = no automatic retry."""
        sla = self.catalog.sla_config
        if code in SAFETY_REASONS:
            return None  # no automatic reminder: people decide (I-10)
        if code == R.MISSING_INFO and safety_context:
            return None  # T06: only the resident's answer or BQL (T03/T07) moves it; escalates at 12 h (Q04)
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
        elif key == (S.VERIFYING, S.RECEIVED):  # T05 by a person
            if role == Role.SYSTEM or blocker is None or blocker.code not in SAFETY_REASONS:
                raise InvalidTransitionError(
                    "VERIFYING → RECEIVED do người chỉ khi blocker là SAFETY_REVIEW_REQUIRED/EMERGENCY_PENDING_BQL"
                )
            action = (
                Action.EMERGENCY_DOWNGRADE if blocker.code == R.EMERGENCY_PENDING_BQL else Action.SAFETY_CONFIRM_SAFE
            )
            if blocker.code == R.EMERGENCY_PENDING_BQL and role != Role.BQL:
                raise InvalidTransitionError("Chỉ BQL hạ khẩn cấp (emergency_downgrade)")
            self._bql_escalation_gate(self.get(ticket.ticket_id), actor_id, role, action, note, now)
            if _blank(note):
                raise GuardError("Xác nhận an toàn / hạ khẩn cấp bắt buộc ghi lý do")
            self._audit(
                work, action, "Ticket", ticket.ticket_id, actor_id, role, "safety_cleared_by", None, actor_id,
                note.strip(), now=now,
            )  # fmt: skip
            self._apply_transition(
                work,
                S.RECEIVED,
                actor_id,
                role,
                now,
                note=note,
                safety_cleared_by=actor_id,
                safety_cleared_at=now,
                safety_clear_reason=note.strip(),
                risk_level=RiskLevel.NONE,
            )
            self._run_pipeline(work, 2, now)  # 2b skips itself (cleared); step 2 checks the location; then 3...
        elif key == (S.NEED_INFO, S.RECEIVED):  # T03: BQL confirms a safety NEED_INFO is safe
            if role != Role.BQL or not ticket.safety_context:
                raise InvalidTransitionError("NEED_INFO → RECEIVED do người chỉ với BQL khi safety_context=true (T03)")
            if _blank(note):
                raise GuardError("BQL xác nhận an toàn bắt buộc ghi lý do")
            self._audit(
                work, Action.SAFETY_CONFIRM_SAFE, "Ticket", ticket.ticket_id, actor_id, role, "safety_cleared_by",
                None, actor_id, note.strip(), now=now,
            )  # fmt: skip
            self._apply_transition(
                work,
                S.RECEIVED,
                actor_id,
                role,
                now,
                note=note,
                safety_cleared_by=actor_id,
                safety_cleared_at=now,
                safety_clear_reason=note.strip(),
                risk_level=RiskLevel.NONE,
                safety_context=False,
            )
            self._run_pipeline(work, 2, now)
        elif key == (S.NEED_INFO, S.VERIFYING):  # T07: BQL escalates a safety NEED_INFO
            if role != Role.BQL or not ticket.safety_context or blocker is None or blocker.code != R.MISSING_INFO:
                raise InvalidTransitionError("NEED_INFO → VERIFYING chỉ với BQL khi safety_context=true (T07)")
            emergency = self._new_blocker(work, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=note)
            self._audit(
                work, Action.SAFETY_ESCALATE, "Ticket", ticket.ticket_id, actor_id, role, "blocker.code",
                R.MISSING_INFO, R.EMERGENCY_PENDING_BQL,
                note.strip() if not _blank(note) else "Cư dân không trả lời; BQL nâng khẩn cấp (T07)", now=now,
            )  # fmt: skip
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
            self._notify(
                work,
                "emergency.created",
                BlockerOwner.BQL,
                now,
                {"risk_level": RiskLevel.EMERGENCY, "escalated_by": actor_id, "from": R.MISSING_INFO},
            )
        elif key == (S.VERIFYING, S.NEED_INFO):  # T06: ask the resident for more detail
            if blocker is None or blocker.code != R.SAFETY_REVIEW_REQUIRED:
                raise InvalidTransitionError("VERIFYING → NEED_INFO chỉ từ SAFETY_REVIEW_REQUIRED ở P0 (T06)")
            self._bql_escalation_gate(self.get(ticket.ticket_id), actor_id, role, Action.SAFETY_REQUEST_INFO, note, now)
            if _blank(note):
                raise GuardError("Yêu cầu cư dân bổ sung bắt buộc ghi lý do")
            missing = [f for f in self._missing_fields(work) if f.startswith("location")]
            ask = self._new_blocker(
                work,
                R.MISSING_INFO,
                now,
                resume_step=2,
                fields=["safety_details", *missing],
                note=note,
                safety_context=True,
            )
            self._audit(
                work, Action.SAFETY_REQUEST_INFO, "Ticket", ticket.ticket_id, actor_id, role, "blocker.code",
                R.SAFETY_REVIEW_REQUIRED, R.MISSING_INFO, note.strip(), now=now,
            )  # fmt: skip
            self._apply_transition(work, S.NEED_INFO, actor_id, role, now, blocker=ask, note=note, safety_context=True)
        elif key == (S.VERIFYING, S.CLOSED):  # T10: BQL closes an emergency handled outside the system
            if blocker is None or blocker.code != R.EMERGENCY_PENDING_BQL:
                raise InvalidTransitionError("Chỉ đóng từ VERIFYING khi ticket khẩn cấp (T10)")
            if _blank(note):
                raise GuardError("Đóng khẩn cấp bắt buộc ghi kết quả xử lý")
            self._audit(
                work, Action.EMERGENCY_CLOSE, "Ticket", ticket.ticket_id, actor_id, role, "closure_kind", None,
                ClosureKind.EMERGENCY_HANDLED, note.strip(), now=now,
            )  # fmt: skip
            self._apply_transition(
                work,
                S.CLOSED,
                actor_id,
                role,
                now,
                note=note,
                closed_by=actor_id,
                closed_at=now,
                closure_kind=ClosureKind.EMERGENCY_HANDLED,
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
        if code in SAFETY_REASONS:
            return False  # only a person clears a safety blocker (I-10)
        if code == R.MISSING_INFO:
            if work.ticket.safety_context and not any(a.submitted_at >= blocker.since for a in work.additions):
                return False  # nobody answered yet: a job must not call it safe (AC-08)
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
                    update={
                        "auto_retry_count": count,
                        "next_retry_at": self._schedule(
                            work, blocker.code, now, safety_context=work.ticket.safety_context
                        ),
                    }
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
            kind = "safety.review_escalated" if blocker.code == R.SAFETY_REVIEW_REQUIRED else "escalation"
            payload = {"reason_code": blocker.code, "why": why, "safety_context": work.ticket.safety_context}
            self._notify(work, kind, BlockerOwner.BQL, now, payload)

    # ------------------------------------------------------------------ pipeline (steps 2–8)

    def _run_pipeline(self, work: Case, from_step: int, now: datetime) -> None:
        if work.ticket.status != S.RECEIVED:
            raise EngineError(f"Pipeline chạy khi ticket ở {work.ticket.status}")
        steps = (
            (2, self._step_2b_assess_safety),  # Q08: before the minimum data: tier 1 > tier 2 > MISSING_INFO
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

    def _safety_scope_text(self, work: Case) -> str:
        """All content before a safety clearance; after it only the additions the resident made later (CR §5.2)."""
        cleared_at = work.ticket.safety_cleared_at
        if cleared_at is None:
            return self._content(work)
        return "\n".join(a.content for a in work.additions if a.submitted_at >= cleared_at)

    def _related_ticket_ids(self, work: Case) -> list[str]:
        """Open tickets at the same location, created earlier and inside the duplicate window (Q11). Link only."""
        location, created = self.effective_location(work), _created_at(work.ticket.raw)
        if location is None or created is None:
            return []
        earliest = created - timedelta(hours=self.catalog.sla_config.duplicate_window_hours)
        found = []
        for other in self.repo.list():
            ticket = other.ticket
            if ticket.ticket_id == work.ticket.ticket_id or ticket.status in TERMINAL_STATUSES:
                continue
            other_created = _created_at(ticket.raw)
            if other_created is None or not (earliest <= other_created < created):
                continue
            if self.effective_location(other) == location:
                found.append(ticket.ticket_id)
        return sorted(found)

    def _step_2b_assess_safety(self, work: Case, now: datetime) -> bool:
        """CR §5.1 step 2b. Runs on any ticket with content, before classification: tier 1 stops (BQL), tier 2 (BPTN)."""
        text = self._safety_scope_text(work)
        if _blank(text):
            return False  # nothing to assess (empty, or cleared and no later addition)
        result = assess_with_llm(text, self.lexicon.safety, self.safety_llm, self.llm_label)
        ticket = work.ticket
        old = ticket.risk_level
        ticket.risk_level, ticket.risk_signals = result.risk_level, list(result.signals)
        present = sorted({s.signal_id for s in result.signals if s.status == SignalStatus.PRESENT})
        self._agent(
            work,
            Action.ASSESS_SAFETY,
            "Ticket",
            ticket.ticket_id,
            "risk_level",
            old,
            {
                "risk_level": result.risk_level,
                "signals": list(result.signals),
                "notes": list(result.notes),
                "proposer": result.proposer,
                "scope": "additions_after_clear" if ticket.safety_cleared_at else "full",
            },
            "Tầng an toàn bước 2b (luật cố định; LLM chỉ nâng mức)",
            now=now,
            rule_id=next((s.rule_id for s in result.signals if s.status == SignalStatus.PRESENT), None),
        )
        if result.risk_level == RiskLevel.EMERGENCY:
            ticket.related_ticket_ids = self._related_ticket_ids(work)  # Q11: link, never merge
            self._stop(
                work, S.VERIFYING, R.EMERGENCY_PENDING_BQL, now, resume_step=2, note=f"Bậc 1: {', '.join(present)}"
            )
            self._notify(
                work,
                "emergency.created",
                BlockerOwner.BQL,
                now,
                {
                    "risk_level": RiskLevel.EMERGENCY,
                    "signal_ids": present,
                    "related_ticket_ids": work.ticket.related_ticket_ids,
                },
            )
            return True
        if result.risk_level == RiskLevel.UNCLEAR:
            unclear = sorted({s.signal_id for s in result.signals if s.status != SignalStatus.ABSENT})
            return self._stop(
                work, S.VERIFYING, R.SAFETY_REVIEW_REQUIRED, now, resume_step=2, note="Bậc 2: " + ", ".join(unclear)
            )
        return False

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
        """Category → playbook → proposed department. Runs before the duplicate check, which needs the category."""
        locked = work.ticket.locked_fields.category
        if locked:
            self._bind_category(work, locked, "BPTN_LOCKED", now)  # BPTN already chose; never reclassify
            return False
        cls = self._classification(work, now)
        if cls.playbook_id is None:
            return self._stop(
                work, S.VERIFYING, cls.reason_code or R.CATEGORY_UNCLEAR, now, resume_step=4, note=cls.reason
            )
        self._bind_category(work, cls.service_category, "AGENT", now)
        return False

    def _step_4_check_duplicate_ticket(self, work: Case, now: datetime) -> bool:
        """An open ticket created earlier, same category and location, within the window → BPTN decides."""
        duplicate_of = self._find_duplicate_ticket_id(work)
        if duplicate_of is None:
            return False
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
        self._propose_priority(work, category, now)

    def _propose_priority(self, work: Case, category: ServiceCategory, now: datetime) -> None:
        """CR §5.1 step 3: propose a priority by rule. A person's override is never overwritten. Idempotent."""
        ticket = work.ticket
        if ticket.priority_source == PrioritySource.HUMAN_OVERRIDE:
            return
        proposal = propose_priority(category, self.effective_location(work), self._content(work), self.lexicon.priority)
        if (ticket.priority, ticket.priority_rule_id) == (proposal.priority, proposal.rule_id):
            return  # a pipeline rerun adds no audit row
        self._agent(
            work,
            Action.CREATE_PROPOSAL,
            "Ticket",
            ticket.ticket_id,
            "priority",
            ticket.priority,
            proposal.priority,
            proposal.reason,
            now=now,
            rule_id=proposal.rule_id,
        )
        self._set_ticket(
            work,
            priority=proposal.priority,
            priority_source=PrioritySource.AGENT_RULE,
            priority_rule_id=proposal.rule_id,
            priority_reason=proposal.reason,
        )

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
        work.material_lines = [
            self._material_line(f"SIM-WOD-{suffix}", suffix, index, planned)
            for index, planned in enumerate(work.planned_materials, start=1)
        ]
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
