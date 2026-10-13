"""Entities from Data Contract v1.1 §5 as amended by CR-BPTN-02 (v0.5 candidate).

Pydantic enforces the schema-level rules. Constants the contract fixes (synthetic=true, draft assignee_id=null, ...)
are typed as Literal, so any other value is rejected at construction time rather than checked later.
"""

import hashlib
import json
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from src.maintenance.agent.schema import AgentDecisionRecord
from src.maintenance.enums import (
    PLAYBOOK_VERSION,
    SCHEMA_VERSION,
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
    DetectedBy,
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
    TicketType,
)


def _sim_id(prefix: str):
    def check(value: str) -> str:
        if not value.startswith(prefix):
            raise ValueError(f"ID phải bắt đầu bằng '{prefix}' (dữ liệu mô phỏng)")
        return value

    return AfterValidator(check)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Timestamp phải có timezone (ISO 8601)")
    return value


AwareDatetime = Annotated[datetime, AfterValidator(_aware)]
MAX_DESCRIPTION_CHARS = 5000  # a resident's report or addition: same limit as ChatRequest; keeps step 2b cheap
Synthetic = Literal[True]


class Entity(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


# ---------------------------------------------------------------------------
# Static read-only catalog (Asset, material catalog, checklist and evidence templates)
# ---------------------------------------------------------------------------


class Asset(Entity):
    """One lighting asset per AREA (plan 14): the lamp of a hallway is the same on every floor and building.

    RETIRED_SIMULATED assets are the old per-location ones, kept only so ids on old tickets still resolve; the engine,
    the Agent and the BPTN picker never offer them.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    asset_id: Annotated[str, _sim_id("SIM-ASSET-")]
    asset_type: Literal["LIGHTING"]
    name: str = Field(min_length=1)
    area: str = Field(min_length=1)  # a label of rules.AREA_PATTERNS, matched against the area part of a location
    location_normalized: str | None = None  # retired per-location assets only (history)
    asset_status: Literal["ACTIVE_SIMULATED", "RETIRED_SIMULATED"]
    linked_playbook_id: Literal[PlaybookId.TEC]
    source_ref: str = Field(min_length=1)
    synthetic: Synthetic
    read_only: Literal[True]

    @property
    def active(self) -> bool:
        return self.asset_status == "ACTIVE_SIMULATED"


class MaterialCatalogItem(Entity):
    """Simulated material catalog: synthetic norm and simulated stock. Not a real inventory."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    item_code: Annotated[str, _sim_id("SIM-")]
    item_name: str = Field(min_length=1)
    unit: str | None = None
    norm_qty: float | None = Field(default=None, ge=0)
    norm_label: NormLabel
    simulated_stock_qty: float | None = Field(default=None, ge=0)
    min_qty: int | None = Field(default=None, ge=0)  # warehouse alert threshold (plan 19); None = no "low" alert
    synthetic: Synthetic

    @model_validator(mode="after")
    def _norm_pair(self):
        if (self.norm_label == NormLabel.SYNTHETIC) != (self.norm_qty is not None):
            raise ValueError("norm_qty là số iff norm_label=SYNTHETIC; null iff N_A")
        return self


class ChecklistTemplateItem(Entity):
    model_config = ConfigDict(extra="forbid", frozen=True)

    template_item_id: str
    label: str
    required: bool = True
    update_owner: Literal[ActorRole.DEPARTMENT] = ActorRole.DEPARTMENT


class ChecklistTemplate(Entity):
    model_config = ConfigDict(extra="forbid", frozen=True)

    checklist_template_id: str
    playbook_id: PlaybookId
    playbook_version: Literal["1.1"]
    template_version: Literal["1.1"]
    items: list[ChecklistTemplateItem] = Field(min_length=1)
    not_real_sop_label: Literal[True]
    synthetic: Synthetic


class EvidenceRequirement(Entity):
    requirement_id: str
    playbook_id: PlaybookId
    allowed_evidence_types: list[EvidenceType]
    image_required: Literal[False] = False
    validation_status: EvidenceValidationStatus = EvidenceValidationStatus.MISSING
    satisfied_by: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Ticket
# ---------------------------------------------------------------------------


class RawTicket(Entity):
    """Resident source layer. Frozen after ingest; additions go to ResidentAddition, never here."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    ticket_id: str
    created_at: str
    original_description: str = Field(max_length=MAX_DESCRIPTION_CHARS)  # Q26: too long is a 422, never truncated
    original_evidence_refs: tuple[str, ...] = ()
    channel: str = "form"

    def integrity_marker(self) -> str:
        payload = json.dumps(self.model_dump(mode="json"), ensure_ascii=False, sort_keys=True)
        return "sha256:" + hashlib.sha256(payload.encode()).hexdigest()


class ResidentAddition(Entity):
    """`ticket_resident_additions`: append-only information added after the report, by the resident or by BPTN
    on the resident's behalf (`submitted_by` tells which)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    addition_id: Annotated[str, _sim_id("SIM-ADD-")]
    ticket_id: str
    content: str = Field(min_length=1, max_length=MAX_DESCRIPTION_CHARS)
    submitted_by: str
    submitted_at: AwareDatetime
    # Plan 06 (01 §2.2). merged_from: merged INTO this ticket from another one; staff only, rules/Agent never read it.
    # copied_from: copied onto a split child or follow-up ticket; the Agent and rules DO read it.
    merged_from: str | None = None
    copied_from: str | None = None

    @model_validator(mode="after")
    def _one_origin(self):
        if self.merged_from is not None and self.copied_from is not None:
            raise ValueError("merged_from và copied_from không được cùng đặt")
        return self


class LockedFields(Entity):
    """Values BPTN chose. The Agent reads them and never overwrites them."""

    category: ServiceCategory | None = None
    location: str | None = None
    asset_id: str | None = None
    department: Department | None = None  # BPTN re-picked the department after WRONG_DEPT (same category)

    @model_validator(mode="after")
    def _known_category(self):
        if self.category == ServiceCategory.UNKNOWN:
            raise ValueError("BPTN chỉ khóa được category thuộc playbook v1.1")
        return self


class Blocker(Entity):
    """Why the ticket is stopped, who clears it, where the pipeline resumes and when it escalates (CR §2.5)."""

    code: ReasonCode
    owner_role: BlockerOwner
    since: AwareDatetime
    resume_step: int | None = Field(default=None, ge=2, le=8)
    auto_retry_count: int = Field(default=0, ge=0)
    next_retry_at: AwareDatetime | None = None
    escalate_at: AwareDatetime | None = None
    escalated: bool = False
    eta: AwareDatetime | None = None
    public_message: str = Field(min_length=1)
    internal_note: str | None = None
    related_ticket_id: str | None = None  # DUPLICATE: the open ticket this one may duplicate
    resolved_at: AwareDatetime | None = None  # set by the clearing event; resume() then acts on it
    resolved_by: str | None = None

    @model_validator(mode="after")
    def _required_by_code(self):
        if self.code == ReasonCode.BLOCKED_ONSITE and self.eta is None:
            raise ValueError("BLOCKED_ONSITE bắt buộc eta")
        if self.code == ReasonCode.DUPLICATE and self.related_ticket_id is None:
            raise ValueError("DUPLICATE bắt buộc related_ticket_id")
        return self


class RiskSignal(Entity):
    """CR-BPTN-03 §6.1.3. Only signals with textual evidence are recorded: PRESENT/UNCLEAR, or ABSENT because of a
    negation (B-02) or a benign phrase (B-01). A signal the text never mentions is not recorded."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    signal_id: str = Field(pattern=r"^(S-\d{2}|T2-0[1-5])$")
    status: SignalStatus
    source_quote: str = Field(min_length=1)  # verbatim, accents kept; S-14 joins two spans with " | "
    detected_by: DetectedBy
    rule_id: str = Field(min_length=1)  # S-xx | T2-xx | B-01 | B-02 | B-04 | LLM


# CR §2.5: where a blocker may exist
BLOCKER_CODES_BY_STATUS: dict[TicketStatus, frozenset[ReasonCode]] = {
    TicketStatus.NEED_INFO: frozenset({ReasonCode.MISSING_INFO}),
    TicketStatus.VERIFYING: frozenset(
        {
            ReasonCode.DUPLICATE,
            ReasonCode.CATEGORY_UNCLEAR,
            ReasonCode.OUT_OF_SCOPE,
            ReasonCode.PENDING_REVIEW,
            ReasonCode.ASSET_UNCLEAR,
            ReasonCode.WRONG_DEPT,
            ReasonCode.SAFETY_REVIEW_REQUIRED,
            ReasonCode.EMERGENCY_PENDING_BQL,
            ReasonCode.WRONG_DEPT_AFTER_START,
        }
    ),
    TicketStatus.ON_HOLD: frozenset(
        {ReasonCode.WAITING_MATERIAL, ReasonCode.BLOCKED_ONSITE, ReasonCode.WAITING_EMERGENCY}
    ),
    TicketStatus.ROUTED: frozenset({ReasonCode.OUT_OF_HOURS, ReasonCode.NOT_ACCEPTED}),
    TicketStatus.IN_PROGRESS: frozenset({ReasonCode.REWORK}),
}
# Handed over to a department (step 8) and not returned
STATUSES_REQUIRING_DEPARTMENT = frozenset(
    {TicketStatus.ROUTED, TicketStatus.IN_PROGRESS, TicketStatus.READY_FOR_REVIEW, TicketStatus.CLOSED}
)
# Side statuses cannot exist without the blocker that explains them
STATUSES_REQUIRING_BLOCKER = frozenset({TicketStatus.NEED_INFO, TicketStatus.VERIFYING, TicketStatus.ON_HOLD})


class Ticket(Entity):
    ticket_id: str
    raw: RawTicket
    raw_integrity_marker: str
    resident_id: str
    source_revision: str
    dataset_version: str
    status: TicketStatus
    proposed_department_id: Department | None = None  # step 3 proposal; internal, the resident never sees it
    department_id: Department | None = None  # set only at step 8, when the ticket is actually handed over
    assignee_id: None = None  # CR-BPTN-03 §4.4.2: nobody assigns a person; any other value is a ValidationError
    blocker: Blocker | None = None
    locked_fields: LockedFields = Field(default_factory=LockedFields)
    review_status: ReviewStatus | None = None  # pipeline step 5
    asset_resolution: AssetResolution | None = None  # pipeline step 6
    merged_into: str | None = None
    flags: list[TicketFlag] = Field(default_factory=list)
    rework_count: int = Field(default=0, ge=0)
    dispatched_at: AwareDatetime | None = None  # ROUTED and inside the department's hours
    accepted_at: AwareDatetime | None = None
    closed_by: str | None = None
    closed_at: AwareDatetime | None = None
    closure_kind: ClosureKind | None = None  # iff CLOSED
    cancel_reason: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)  # one rating only: guarded in `engine.rate`
    # Safety layer (CR-BPTN-03 §6, §12.1)
    risk_level: RiskLevel = RiskLevel.NONE
    risk_signals: list[RiskSignal] = Field(default_factory=list)  # latest step-2b assessment; history is in the audit
    safety_cleared_by: str | None = None
    safety_cleared_at: AwareDatetime | None = None
    safety_clear_reason: str | None = None
    safety_context: bool = False  # true only for a NEED_INFO created by T06 (12 h deadline)
    related_ticket_ids: list[str] = Field(default_factory=list)  # tier-1 tickets are linked, never merged (Q11)
    # Priority (CR-BPTN-03 §7)
    priority: Priority | None = None
    priority_source: PrioritySource | None = None
    priority_rule_id: str | None = None  # PRI-H1|PRI-H2|PRI-M1|PRI-M2|PRI-L1|PRI-D0; None for HUMAN_OVERRIDE
    priority_reason: str | None = None
    # Plan 06 (01 §2.1): duplicate / split / follow-up links. Link lists are append-only (engine), see V-T1..V-T5.
    duplicate_count: int = Field(default=0, ge=0)
    merged_children: list[str] = Field(default_factory=list)
    wrong_department_return_count: int = Field(default=0, ge=0)
    follow_up_of: str | None = None
    split_from: str | None = None
    split_children: list[str] = Field(default_factory=list)
    split_category: ServiceCategory | None = None
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _link_rules(self):
        if self.split_category not in (None, ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT):  # V-T1
            raise ValueError("split_category chỉ được là VE_SINH hoặc KY_THUAT")
        if (self.split_category is None) != (self.split_from is None and not self.split_children):  # V-T2
            raise ValueError("split_category đặt iff ticket là gốc hoặc con của một lần tách")
        if self.split_from is not None and self.split_children:  # V-T3
            raise ValueError("ticket không thể đồng thời có split_from và split_children")
        linked = (self.merged_children, self.split_children, self.related_ticket_ids)
        if any(self.ticket_id in ids for ids in linked) or self.ticket_id in (
            self.merged_into,
            self.split_from,
            self.follow_up_of,
        ):  # V-T4
            raise ValueError("ticket không được tự liên kết với chính nó")
        if any(len(ids) != len(set(ids)) for ids in linked):  # V-T5
            raise ValueError("danh sách liên kết không được lặp id")
        return self

    @model_validator(mode="after")
    def _status_rules(self):
        if self.blocker is not None and self.blocker.code not in BLOCKER_CODES_BY_STATUS.get(self.status, ()):
            raise ValueError(f"Blocker {self.blocker.code} không được phép ở trạng thái {self.status}")
        if self.blocker is None and self.status in STATUSES_REQUIRING_BLOCKER:
            raise ValueError(f"Trạng thái {self.status} phải có blocker")
        emergency_closed = self.status == TicketStatus.CLOSED and self.closure_kind == ClosureKind.EMERGENCY_HANDLED
        if self.status in STATUSES_REQUIRING_DEPARTMENT and self.department_id is None and not emergency_closed:
            raise ValueError(f"Trạng thái {self.status} phải có department_id (đã giao ở bước 8)")
        if (self.status == TicketStatus.MERGED) != (self.merged_into is not None):
            raise ValueError("merged_into bắt buộc iff MERGED")
        if self.status == TicketStatus.CANCELLED and not (self.cancel_reason and self.cancel_reason.strip()):
            raise ValueError("cancel_reason bắt buộc khi CANCELLED")
        if (self.status == TicketStatus.CLOSED) != (self.closed_by is not None and self.closed_at is not None):
            raise ValueError("closed_by/closed_at bắt buộc iff CLOSED")
        if (self.status == TicketStatus.CLOSED) != (self.closure_kind is not None):
            raise ValueError("closure_kind bắt buộc iff CLOSED")
        cleared = (self.safety_cleared_by, self.safety_cleared_at, self.safety_clear_reason)
        if any(v is None for v in cleared) != all(v is None for v in cleared):
            raise ValueError("safety_cleared_by/at/reason phải cùng đặt hoặc cùng null")
        if (self.priority is None) != (self.priority_source is None):
            raise ValueError("priority và priority_source cùng đặt hoặc cùng null")
        if self.priority_source == PrioritySource.HUMAN_OVERRIDE and not (self.priority_reason or "").strip():
            raise ValueError("HUMAN_OVERRIDE bắt buộc priority_reason")
        if self.safety_context and self.status != TicketStatus.NEED_INFO:
            raise ValueError("safety_context chỉ true khi NEED_INFO")
        return self


class StatusEvent(Entity):
    """`ticket_status_events`: one row per status or blocker change. The only source for timeline and audit."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: Annotated[str, _sim_id("SIM-EVT-")]
    ticket_id: str
    from_status: TicketStatus | None  # None only for the creation event
    to_status: TicketStatus
    reason_code: ReasonCode | None = None
    actor_role: ActorRole
    actor_id: str | None = None
    public_message: str = Field(min_length=1)
    internal_note: str | None = None
    public: bool  # shown on the resident timeline (status change or blocker set/cleared)
    created_at: AwareDatetime


class Notification(Entity):
    """Outbox row. Delivery channels (push/SMS/Zalo) are out of scope; this only records what was emitted."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    notification_id: Annotated[str, _sim_id("SIM-NTF-")]
    ticket_id: str
    type: Literal[
        "ticket.status_changed",
        "department.dispatch",
        "department.reconcile_failed",
        "reminder",
        "escalation",
        "emergency.created",  # CR-BPTN-03 §6.5/§13: BQL, as soon as EMERGENCY_PENDING_BQL is set
        "safety.review_escalated",  # CR-BPTN-03 §13: BQL, when SAFETY_REVIEW_REQUIRED passes 4 calendar hours
    ]
    audience: BlockerOwner
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: AwareDatetime


class StockAlert(Entity):
    """Department-level alert (plan 20): the warehouse restocked a material a department uses after it ran out.

    Own table `maintops.stock_alerts`, never a `Notification` (that one needs a ticket) and never in a ticket doc.
    Append-only: only the two `acknowledged_*` fields are set, once."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    alert_id: Annotated[str, _sim_id("SIM-SAL-")]
    item_code: str
    item_name: str
    unit: str | None = None
    department_id: Department
    qty_added: float = Field(gt=0)
    qty_before: float = Field(le=0)
    qty_after: float = Field(gt=0)
    received_by: str
    created_at: AwareDatetime
    acknowledged_by: str | None = None
    acknowledged_at: AwareDatetime | None = None


# ---------------------------------------------------------------------------
# Agent proposal
# ---------------------------------------------------------------------------


class ClassificationRecord(Entity):
    """What the proposer returned for the current content. Cached so the Agent does not re-ask the model."""

    playbook_id: PlaybookId | None
    service_category: ServiceCategory
    ticket_type: TicketType
    rule_id: str
    reason: str
    reason_code: ReasonCode | None = None  # CATEGORY_UNCLEAR / OUT_OF_SCOPE when no playbook
    needs_review: bool = False  # LLM-only proposal: pipeline step 5 asks BPTN
    proposer: str
    notes: list[str] = Field(default_factory=list)


class AgentClassificationProposal(Entity):
    proposal_id: Annotated[str, _sim_id("SIM-ACP-")]
    ticket_id: str
    proposal_revision: int = Field(ge=1)
    service_category_proposed: ServiceCategory
    ticket_type_proposed: TicketType
    playbook_id: PlaybookId
    playbook_version: Literal["1.1"] = PLAYBOOK_VERSION
    category_source: Literal["AGENT", "BPTN_LOCKED", "AGENT_SPLIT", "AGENT_LLM"] = "AGENT"
    asset_type: Literal["LIGHTING"] | None = None
    reported_symptom: Literal["NOT_WORKING"] | None = None
    location_proposed: str | None = None
    asset_id: str | None = None
    asset_lookup_status: AssetLookupStatus = AssetLookupStatus.NOT_APPLICABLE
    asset_match_reason: str = "Chưa lookup"
    matched_rule_ids: list[str] = Field(min_length=1)
    classification_reason: str = Field(min_length=1)
    source_references: list[str] = Field(min_length=1)
    created_at: AwareDatetime
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _asset_by_playbook(self):
        if self.playbook_id == PlaybookId.CLN and self.asset_id is not None:
            raise ValueError("Ticket vệ sinh phải có asset_id=null")
        return self


# ---------------------------------------------------------------------------
# Work order draft and its children
# ---------------------------------------------------------------------------


class ChecklistItem(Entity):
    checklist_item_id: Annotated[str, _sim_id("SIM-CHK-")]
    work_order_draft_id: str
    checklist_template_id: str
    template_item_id: str
    label_snapshot: str
    required: bool
    status: ChecklistStatus = ChecklistStatus.PENDING
    updated_by: str | None = None
    updated_at: AwareDatetime | None = None
    note: str | None = None
    synthetic: Synthetic = True


class MaterialComparisonResult(Entity):
    comparison_type: ComparisonType
    left_field: str
    right_field: str
    left_value: float | None
    right_value: float | None
    status: ComparisonStatus
    reason_reference: str | None = None


class MaterialLine(Entity):
    material_line_id: Annotated[str, _sim_id("SIM-MAT-")]
    work_order_draft_id: str
    item_code: Annotated[str, _sim_id("SIM-")]
    item_name: str = Field(min_length=1)
    unit: str | None = None
    planned_qty: float = Field(ge=0)
    norm_qty: float | None = Field(default=None, ge=0)
    norm_label: NormLabel
    simulated_stock_qty: float | None = Field(default=None, ge=0)
    material_stock_status: MaterialStockStatus
    issued_qty: float | None = Field(default=None, ge=0)
    used_qty: float | None = Field(default=None, ge=0)
    variance_reason: str | None = None
    comparison_results: list[MaterialComparisonResult] = Field(default_factory=list)
    reconciliation_status: Literal["RECONCILED", "NEEDS_CLARIFICATION"] = "NEEDS_CLARIFICATION"
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _norm_pair(self):
        if (self.norm_label == NormLabel.SYNTHETIC) != (self.norm_qty is not None):
            raise ValueError("norm_qty là số iff norm_label=SYNTHETIC; null iff N_A")
        if len(self.comparison_results) not in (0, 3):
            raise ValueError("Chỉ có đúng ba comparison (VAL-MAT-CMP-001)")
        return self


class EvidenceRecord(Entity):
    evidence_id: Annotated[str, _sim_id("SIM-EVD-")]
    ticket_id: str
    work_order_draft_id: str | None
    requirement_id: str | None
    evidence_type: EvidenceType
    content_or_metadata: str
    source: EvidenceSource
    submitted_by: str
    submitted_at: AwareDatetime
    readability_status: ReadabilityStatus
    evidence_validation_status: EvidenceValidationStatus = EvidenceValidationStatus.MISSING
    immutable: bool = False
    merged_from: str | None = None  # plan 06 01 §2.2: same meaning as on ResidentAddition
    copied_from: str | None = None
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _one_origin(self):
        if self.merged_from is not None and self.copied_from is not None:
            raise ValueError("merged_from và copied_from không được cùng đặt")
        if (self.merged_from is not None or self.copied_from is not None) and (
            self.source != EvidenceSource.RESIDENT_ORIGINAL
        ):
            raise ValueError("merged_from/copied_from chỉ dùng cho bằng chứng source=RESIDENT_ORIGINAL")
        return self


class ReadinessEvaluation(Entity):
    """Step 10 reconciliation (CR-BPTN-02 §4): six conditions, run when the department reports completion."""

    department_accepted: bool
    checklist_complete: bool
    processing_note_present: bool  # recorded for BQL; the note is optional, so it never fails readiness
    photo_present: bool  # at least one department photo of the finished work: required
    materials_entered: bool
    variance_explained: bool
    no_open_blocker: bool
    evaluated_at: AwareDatetime
    failing_items: list[str] = Field(default_factory=list)

    @property
    def all_pass(self) -> bool:
        return all(
            (
                self.department_accepted,
                self.checklist_complete,
                self.photo_present,
                self.materials_entered,
                self.variance_explained,
                self.no_open_blocker,
            )
        )


class NonBlockingWarning(Entity):
    warning_id: Annotated[str, _sim_id("SIM-WRN-")]
    warning_type: Literal["EXPLAINED_MATERIAL_VARIANCE"] = "EXPLAINED_MATERIAL_VARIANCE"
    blocking: Literal[False] = False
    rule_id: str
    reason: str
    material_line_ids: list[str]
    comparison_types: list[ComparisonType]
    created_at: AwareDatetime
    synthetic: Synthetic = True


class WorkOrderDraft(Entity):
    work_order_draft_id: Annotated[str, _sim_id("SIM-WOD-")]
    ticket_id: str
    proposal_id: str
    playbook_id: PlaybookId
    playbook_version: Literal["1.1"] = PLAYBOOK_VERSION
    source_revision: str
    draft_revision: int = Field(ge=1)
    draft_status: Literal["DRAFT"] = "DRAFT"
    scope_summary: str = Field(min_length=1)
    matched_rule_ids: list[str] = Field(min_length=1)
    source_references: list[str] = Field(min_length=1)
    location: str
    asset_id: str | None
    department_id: Department
    flags: list[TicketFlag] = Field(default_factory=list)
    assignee_id: None = None  # the Agent never picks a person; the department sets ticket.assignee_id itself
    material_stock_status: MaterialStockStatus
    checklist_template_id: str
    checklist_item_ids: list[str] = Field(min_length=1)
    material_requirement_mode: MaterialRequirementMode
    material_gate_status: MaterialGateStatus
    material_line_ids: list[str] = Field(default_factory=list)
    evidence_requirements: list[EvidenceRequirement] = Field(min_length=1)
    readiness_evaluation: ReadinessEvaluation | None = None
    non_blocking_warnings: list[NonBlockingWarning] = Field(default_factory=list)
    created_at: AwareDatetime
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _material_mode(self):
        if self.material_requirement_mode == MaterialRequirementMode.N_A and self.material_line_ids:
            raise ValueError("material_requirement_mode=N_A thì không có MaterialLine (VAL-MAT-MODE-001)")
        return self


class AuditEvent(Entity):
    """Non-status actions (lookups, execution updates, denials). Status/blocker changes are StatusEvents."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    event_id: Annotated[str, _sim_id("SIM-AUD-")]
    ticket_id: str
    entity_type: str
    entity_id: str
    action: Action
    actor_id: str
    actor_role: ActorRole
    timestamp: AwareDatetime
    field_name: str
    old_value: Any = None
    new_value: Any = None
    reason: str = Field(min_length=1)
    action_result: ActionResult = ActionResult.ALLOWED
    error_code: str | None = None
    rule_id: str | None = None
    playbook_version: str | None = None
    schema_version: Literal["1.2"] = SCHEMA_VERSION
    run_id: Annotated[str, _sim_id("SIM-RUN-")]
    synthetic: Synthetic = True


class PlannedMaterial(Entity):
    """Planned quantity used by the stock check. Simulated fixture input, not a real material plan."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    item_code: Annotated[str, _sim_id("SIM-")]
    planned_qty: float = Field(ge=0)


class ExecutionSnapshot(Entity):
    """E02 (SPEC-P06 §5): deep copy of the execution data when BQL sends a started ticket back to BPTN."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    snapshot_id: Annotated[str, _sim_id("SIM-SNP-")]  # f"SIM-SNP-{_suffix(tid)}-{len(case.execution_snapshots)+1:02d}"
    ticket_id: str
    reason: Literal["BQL_REASSIGN_TO_BPTN"]
    taken_at: AwareDatetime
    taken_by: str
    department_id: Department
    work_order_draft_id: str | None
    playbook_id: PlaybookId | None
    checklist_items: list[ChecklistItem]
    material_lines: list[MaterialLine]
    evidence_ids: list[str]  # every evidence_id at the time (photos, notes)
    synthetic: Synthetic = True


class Case(Entity):
    """Everything the engine holds for one ticket. Mutated only through MaintenanceEngine."""

    ticket: Ticket
    # None = the Agent takes the playbook default at step 7; [] = explicitly no tracked material (N_A)
    planned_materials: list[PlannedMaterial] | None = None
    planned_for_playbook: PlaybookId | None = None
    classification: ClassificationRecord | None = None
    not_duplicate_of: list[str] = Field(default_factory=list)  # BPTN said "not a duplicate" of these
    proposal: AgentClassificationProposal | None = None
    draft: WorkOrderDraft | None = None
    checklist_items: list[ChecklistItem] = Field(default_factory=list)
    material_lines: list[MaterialLine] = Field(default_factory=list)
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    # Index in `evidence` where the current round of work starts: a BQL rework (T22) moves it, so step 10 needs
    # new photos and notes (plan 04 Q02). 0 on every case stored before the field existed.
    evidence_round_start: int = Field(default=0, ge=0)
    additions: list[ResidentAddition] = Field(default_factory=list)
    events: list[StatusEvent] = Field(default_factory=list)
    notifications: list[Notification] = Field(default_factory=list)
    audit: list[AuditEvent] = Field(default_factory=list)
    # Plan 06: E02 snapshots, and the Agent decision currently applied to the ticket (01 §2.3; history is in the audit)
    execution_snapshots: list[ExecutionSnapshot] = Field(default_factory=list)
    agent_decision: AgentDecisionRecord | None = None
