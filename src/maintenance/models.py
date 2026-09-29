"""Entities from Data Contract v1.1 §5. Pydantic enforces the schema-level rules (VAL-SCHEMA-001, VAL-SYN-001).

Constants the contract fixes (synthetic=true, TEAM_ONLY, assignee_id=null, ...) are typed as Literal, so any
other value is rejected at construction time rather than checked later.
"""

import hashlib
import json
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from src.maintenance.enums import (
    PLAYBOOK_VERSION,
    SCHEMA_VERSION,
    Action,
    ActionResult,
    ActorRole,
    AssetLookupStatus,
    AvailabilityStatus,
    ChecklistStatus,
    ComparisonStatus,
    ComparisonType,
    ConfirmationStatus,
    DutyLookupStatus,
    EvidenceSource,
    EvidenceType,
    EvidenceValidationStatus,
    ExceptionStatus,
    ExceptionType,
    MaterialGateStatus,
    MaterialRequirementMode,
    MaterialStockStatus,
    NormLabel,
    PlaybookId,
    QueueReason,
    QueueStatus,
    ReadabilityStatus,
    ReviewRequiredReason,
    RouteStatus,
    ServiceCategory,
    SignalStatus,
    TicketState,
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
Synthetic = Literal[True]


class Entity(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


# ---------------------------------------------------------------------------
# Static read-only catalog (Asset, DutyAvailability, material catalog)
# ---------------------------------------------------------------------------


class Asset(Entity):
    model_config = ConfigDict(extra="forbid", frozen=True)

    asset_id: Annotated[str, _sim_id("SIM-ASSET-")]
    asset_type: Literal["LIGHTING"]
    location_normalized: str = Field(min_length=1)
    asset_status: str = Field(min_length=1)
    linked_playbook_id: Literal[PlaybookId.TEC]
    source_ref: str = Field(min_length=1)
    synthetic: Synthetic
    read_only: Literal[True]


class DutyAvailability(Entity):
    model_config = ConfigDict(extra="forbid", frozen=True)

    duty_id: Annotated[str, _sim_id("SIM-DUTY-")]
    team_id: Annotated[str, _sim_id("SIM-TEAM-")]
    service_category: Literal[ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT]
    shift_window: str = Field(min_length=1)
    availability_status: AvailabilityStatus
    current_open_ticket_count: int | None = Field(default=None, ge=0)
    max_open_ticket_count: int | None = Field(default=None, ge=0)
    source_ref: str = Field(min_length=1)
    synthetic: Synthetic
    assignment_scope: Literal["TEAM_ONLY"]

    @model_validator(mode="after")
    def _counts_when_known(self):
        known = self.availability_status != AvailabilityStatus.UNKNOWN
        if known and (self.current_open_ticket_count is None or self.max_open_ticket_count is None):
            raise ValueError("current/max_open_ticket_count bắt buộc khi availability_status đã biết")
        return self

    @property
    def has_capacity(self) -> bool:
        return self.current_open_ticket_count < self.max_open_ticket_count


class MaterialCatalogItem(Entity):
    """Simulated material catalog: synthetic norm and simulated stock. Not a real inventory."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    item_code: Annotated[str, _sim_id("SIM-")]
    item_name: str = Field(min_length=1)
    unit: str | None = None
    norm_qty: float | None = Field(default=None, ge=0)
    norm_label: NormLabel
    simulated_stock_qty: float | None = Field(default=None, ge=0)
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
    update_owner: Literal[ActorRole.HUMAN_EXECUTION] = ActorRole.HUMAN_EXECUTION


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
# Ticket (raw layer + administrative layer + derived state)
# ---------------------------------------------------------------------------


class RawTicket(Entity):
    """Resident source layer. Frozen after ingest (FR-INGEST-002). Blank values are stored as-is and fail the gate later."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    ticket_id: str
    created_at: str
    original_description: str
    original_evidence_refs: tuple[str, ...] = ()
    channel: str = "form"

    def integrity_marker(self) -> str:
        payload = json.dumps(self.model_dump(mode="json"), ensure_ascii=False, sort_keys=True)
        return "sha256:" + hashlib.sha256(payload.encode()).hexdigest()


class AdministrativeNormalization(Entity):
    """Administrative layer. BPTN review is conditional (CR-BPTN-01): the Agent decides whether it is needed."""

    administrative_revision: int = Field(ge=1)
    service_category_normalized: ServiceCategory = ServiceCategory.UNKNOWN
    ticket_type_normalized: TicketType = TicketType.UNKNOWN
    location_normalized: str | None = None
    priority: str | None = None
    confirmation_status: ConfirmationStatus
    review_required_reason: ReviewRequiredReason | None = None
    confirmed_by: str | None = None
    confirmed_at: AwareDatetime | None = None
    override_reason: str | None = None
    override_source_references: list[str] = Field(default_factory=list)
    override_fields: list[str] = Field(default_factory=list)
    audit_event_id: str | None = None  # the audit event that set confirmation_status
    source_references: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _review_fields(self):
        status = self.confirmation_status
        reviewed = status in (ConfirmationStatus.CONFIRMED, ConfirmationStatus.OVERRIDDEN)
        if reviewed != (self.confirmed_by is not None and self.confirmed_at is not None):
            raise ValueError("confirmed_by/confirmed_at bắt buộc iff confirmation_status=CONFIRMED|OVERRIDDEN")
        overridden = status == ConfirmationStatus.OVERRIDDEN
        if overridden != bool(self.override_reason and self.override_fields):
            raise ValueError("override_reason/override_fields bắt buộc iff confirmation_status=OVERRIDDEN")
        # The reason stays after BPTN acts, so the record still shows why a review was needed
        if status == ConfirmationStatus.PENDING_REVIEW and self.review_required_reason is None:
            raise ValueError("review_required_reason bắt buộc khi confirmation_status=PENDING_REVIEW")
        if status == ConfirmationStatus.NOT_REQUIRED and self.review_required_reason is not None:
            raise ValueError("NOT_REQUIRED thì không có review_required_reason")
        return self


class StateDecision(Entity):
    """Why the ticket is in its current state: primary rule plus every other blocker found."""

    state: TicketState
    rule_id: str
    reason: str
    queue_reason: QueueReason | None = None
    blocking_rules: list[str] = Field(default_factory=list)


class Ticket(Entity):
    ticket_id: str
    raw: RawTicket
    raw_integrity_marker: str
    source_revision: str
    dataset_version: str
    current_state: TicketState
    state_decision: StateDecision
    administrative_normalization: AdministrativeNormalization | None = None
    synthetic: Synthetic = True


# ---------------------------------------------------------------------------
# Agent proposal
# ---------------------------------------------------------------------------


class RuleSignal(Entity):
    signal_code: str
    status: SignalStatus
    source_references: list[str]
    evaluated_at: AwareDatetime
    rule_id: str


class AgentClassificationProposal(Entity):
    proposal_id: Annotated[str, _sim_id("SIM-ACP-")]
    ticket_id: str
    proposal_revision: int = Field(ge=1)
    service_category_proposed: ServiceCategory
    ticket_type_proposed: TicketType
    playbook_id: PlaybookId
    playbook_version: Literal["1.1"] = PLAYBOOK_VERSION
    asset_type: Literal["LIGHTING"] | None = None
    reported_symptom: Literal["NOT_WORKING"] | None = None
    location_proposed: str | None = None  # read from the resident text; becomes location_normalized unless overridden
    asset_id: str | None = None
    asset_lookup_status: AssetLookupStatus = AssetLookupStatus.NOT_APPLICABLE
    asset_match_reason: str = "Chưa lookup"
    routing_team_id: str | None = None
    duty_lookup_status: DutyLookupStatus | None = None
    duty_source_ref: str | None = None
    route_status: RouteStatus = RouteStatus.NOT_ROUTED
    matched_rule_ids: list[str] = Field(min_length=1)
    classification_reason: str = Field(min_length=1)
    source_references: list[str] = Field(min_length=1)
    rule_signals: list[RuleSignal]
    # BPTN review lives in ticket.administrative_normalization (confirmation_status, override_*)
    created_at: AwareDatetime
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _asset_by_playbook(self):
        if self.playbook_id == PlaybookId.CLN and self.asset_id is not None:
            raise ValueError("Ticket vệ sinh phải có asset_id=null")
        if self.asset_id is not None and self.asset_lookup_status != AssetLookupStatus.MATCHED:
            raise ValueError("asset_id chỉ non-null khi asset_lookup_status=MATCHED")
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
    synthetic: Synthetic = True


class ReadinessEvaluation(Entity):
    playbook_present: bool
    work_order_draft_present: bool
    required_fields_complete: bool
    route_valid: bool
    checklist_complete: bool
    minimum_evidence_complete: bool
    material_reconciled_or_na: bool
    no_blocking_exception: bool
    evaluated_at: AwareDatetime
    rule_ids: list[str]
    source_references: list[str]
    target_state: TicketState
    reason: str
    failing_items: list[str] = Field(default_factory=list)

    @property
    def all_pass(self) -> bool:
        return all(
            (
                self.playbook_present,
                self.work_order_draft_present,
                self.required_fields_complete,
                self.route_valid,
                self.checklist_complete,
                self.minimum_evidence_complete,
                self.material_reconciled_or_na,
                self.no_blocking_exception,
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
    administrative_revision: int = Field(ge=1)
    source_revision: str
    idempotency_key: str
    draft_revision: int = Field(ge=1)
    draft_status: Literal["DRAFT"] = "DRAFT"
    scope_summary: str = Field(min_length=1)
    generation_reason: str = Field(min_length=1)
    matched_rule_ids: list[str] = Field(min_length=1)
    source_references: list[str] = Field(min_length=1)
    asset_id: str | None
    routing_team_id: str | None
    duty_status: DutyLookupStatus
    duty_source_ref: str | None = None  # SIM-DUTY-* fixture record; capacity there is simulated, not real
    assignment_mode: Literal["SIMULATED_TEAM_ROUTE"] = "SIMULATED_TEAM_ROUTE"
    assignment_scope: Literal["TEAM_ONLY"] = "TEAM_ONLY"
    assignee_id: None = None
    material_stock_status: MaterialStockStatus
    route_status: RouteStatus
    queue_status: QueueStatus
    queue_reason: QueueReason | None = None
    checklist_template_id: str
    checklist_item_ids: list[str] = Field(min_length=1)
    material_requirement_mode: MaterialRequirementMode
    material_gate_status: MaterialGateStatus
    material_line_ids: list[str] = Field(default_factory=list)
    evidence_requirements: list[EvidenceRequirement] = Field(min_length=1)
    readiness_evaluation: ReadinessEvaluation | None = None
    blocking_exception_active: bool = False
    non_blocking_warnings: list[NonBlockingWarning] = Field(default_factory=list)
    created_at: AwareDatetime
    synthetic: Synthetic = True

    @model_validator(mode="after")
    def _route_consistency(self):
        if (self.route_status == RouteStatus.ROUTED) != (self.routing_team_id is not None):
            raise ValueError("routing_team_id non-null iff route_status=ROUTED")
        if self.route_status == RouteStatus.NOT_ROUTED and self.queue_reason is None:
            raise ValueError("queue_reason bắt buộc khi NOT_ROUTED")
        if self.material_requirement_mode == MaterialRequirementMode.N_A and self.material_line_ids:
            raise ValueError("material_requirement_mode=N_A thì không có MaterialLine (VAL-MAT-MODE-001)")
        return self


class ExceptionRecord(Entity):
    exception_id: Annotated[str, _sim_id("SIM-EXC-")]
    ticket_id: str
    exception_type: ExceptionType
    rule_id: str
    blocking: Literal[True] = True
    reason: str = Field(min_length=1)
    source_references: list[str] = Field(min_length=1)
    risk_level: Literal["HIGH_RISK"] = "HIGH_RISK"
    authorized_handler: Literal["BQL"] = "BQL"
    status: ExceptionStatus = ExceptionStatus.OPEN
    missing_information: list[str] = Field(default_factory=list)
    resolution_note: str | None = None
    resolved_by: str | None = None
    resolved_at: AwareDatetime | None = None
    synthetic: Synthetic = True


class AuditEvent(Entity):
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
    schema_version: Literal["1.1"] = SCHEMA_VERSION
    run_id: Annotated[str, _sim_id("SIM-RUN-")]
    synthetic: Synthetic = True


class PlannedMaterial(Entity):
    """Planned quantity used by the pre-route stock gate. Simulated fixture input, not a real material plan."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    item_code: Annotated[str, _sim_id("SIM-")]
    planned_qty: float = Field(ge=0)


class Case(Entity):
    """Everything the engine holds for one ticket. Mutated only through MaintenanceEngine."""

    ticket: Ticket
    # None = the Agent takes the playbook default at draft time; [] = explicitly no tracked material (N_A)
    planned_materials: list[PlannedMaterial] | None = None
    classification_rule: str | None = None  # set when no unique playbook matched (PB-COM-R-CLS-01)
    classification_reason: str | None = None
    signal_assessment: dict[str, SignalStatus] = Field(default_factory=dict)  # all five signals, assessed once
    proposer: str | None = None  # "rules" or "rules+llm:<model>"
    proposer_notes: list[str] = Field(default_factory=list)
    proposal: AgentClassificationProposal | None = None
    draft: WorkOrderDraft | None = None
    checklist_items: list[ChecklistItem] = Field(default_factory=list)
    material_lines: list[MaterialLine] = Field(default_factory=list)
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    exceptions: list[ExceptionRecord] = Field(default_factory=list)
    audit: list[AuditEvent] = Field(default_factory=list)
    handed_off_to_bql: bool = False
