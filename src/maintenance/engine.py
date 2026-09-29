"""MaintenanceOps Agent engine: ingest → proposal → conditional BPTN review → lookups/draft/route → execution → readiness.

BPTN review follows CR-BPTN-01 (v0.4 candidate on top of the frozen v0.3 baseline): the Agent only stops for BPTN
when administrative data is missing or unclear; BPTN may confirm or override (with a reason) but never bypass a
safety exception or touch the resident's raw content.

Every public operation:
  1. checks permission first (denial = ACTION_DENIED audit, no data/state change, no ExceptionRecord);
  2. works on a deep copy of the case;
  3. commits the copy only after the audit sink accepted every new event (audit failure = fail closed).
"""

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from src.maintenance.catalog import Catalog, TicketDataset, load_catalog, load_dataset
from src.maintenance.enums import (
    PLAYBOOK_PAIRS,
    PLAYBOOK_VERSION,
    Action,
    ActionResult,
    ActorRole,
    AssetLookupStatus,
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
    QueueStatus,
    ReadabilityStatus,
    ReviewRequiredReason,
    RouteStatus,
    ServiceCategory,
    TicketState,
    TicketType,
)
from src.maintenance.models import (
    AdministrativeNormalization,
    AgentClassificationProposal,
    AuditEvent,
    Case,
    ChecklistItem,
    EvidenceRecord,
    ExceptionRecord,
    MaterialComparisonResult,
    MaterialLine,
    NonBlockingWarning,
    PlannedMaterial,
    RawTicket,
    ReadinessEvaluation,
    RuleSignal,
    StateDecision,
    Ticket,
    WorkOrderDraft,
)
from src.maintenance.proposer import LLMClient, propose
from src.maintenance.resolver import CaseFacts, resolve, route_blockers
from src.maintenance.rules import SIGNALS_BY_PLAYBOOK, RiskOutcome, evaluate_signals, extract_location
from src.maintenance.team_routing import lookup_team

LOCAL_TZ = timezone(timedelta(hours=7))
AGENT_ID = "SIM-ACTOR-AGENT"
SYSTEM_ID = "SIM-ACTOR-SYSTEM"
SOURCE_REVISION = "SRC-001"

# Permission matrix (Data Contract §7.8). Anything not listed is denied for every role (default deny).
PERMISSIONS: dict[Action, set[ActorRole]] = {
    Action.INGEST: {ActorRole.SYSTEM},
    Action.CREATE_PROPOSAL: {ActorRole.AGENT},
    Action.CONFIRM_NORMALIZATION: {ActorRole.BPTN},
    Action.UPDATE_ADMIN_FIELD: {ActorRole.BPTN},
    Action.LOOKUP_ASSET: {ActorRole.AGENT},
    Action.CHECK_MATERIAL_STOCK: {ActorRole.AGENT},
    Action.LOOKUP_DUTY: {ActorRole.AGENT},
    Action.CREATE_DRAFT: {ActorRole.AGENT},
    Action.PROPOSE_TEAM_ROUTE: {ActorRole.AGENT},
    Action.UPDATE_CHECKLIST: {ActorRole.HUMAN_EXECUTION},
    Action.UPDATE_MATERIAL: {ActorRole.HUMAN_EXECUTION},
    Action.ADD_EVIDENCE: {ActorRole.HUMAN_EXECUTION},
    Action.VALIDATE_EVIDENCE: {ActorRole.AGENT},
    Action.RECONCILE_MATERIAL: {ActorRole.AGENT},
    Action.TRANSITION_STATE: {ActorRole.AGENT, ActorRole.SYSTEM},
    Action.CREATE_EXCEPTION: {ActorRole.AGENT},
    Action.RESOLVE_EXCEPTION: {ActorRole.BQL},
    Action.HANDOFF_TO_BQL: {ActorRole.AGENT, ActorRole.SYSTEM, ActorRole.BPTN},
}

# Allowed transitions (Data Contract §8.3). CHỜ/EXCEPTION reach READY only through IN_PROGRESS.
TRANSITIONS: dict[TicketState, set[TicketState]] = {
    TicketState.IN_PROGRESS: {TicketState.CHO_XAC_MINH, TicketState.EXCEPTION, TicketState.READY_FOR_REVIEW},
    TicketState.CHO_XAC_MINH: {TicketState.IN_PROGRESS, TicketState.EXCEPTION},
    TicketState.EXCEPTION: {TicketState.IN_PROGRESS, TicketState.CHO_XAC_MINH},
    TicketState.READY_FOR_REVIEW: {TicketState.IN_PROGRESS, TicketState.EXCEPTION},
}

SCOPE_LABELS = {
    PlaybookId.CLN: "vệ sinh khu vực chung",
    PlaybookId.TEC: "đèn chiếu sáng khu vực chung không hoạt động",
}
EXCEPTION_TYPES = {PlaybookId.CLN: ExceptionType.CLEANING_HAZARD, PlaybookId.TEC: ExceptionType.ELECTRICAL_HIGH_RISK}


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


class ActionDeniedError(EngineError):
    """Permission rejection (canonical code ACTION_DENIED). The denial itself is audited."""

    code = "ACTION_DENIED"


class AuditWriteError(EngineError):
    code = "AUDIT_WRITE_FAILED"


AuditSink = Callable[[list[AuditEvent]], None]


def _blank(value: str | None) -> bool:
    return value is None or not value.strip() or value.strip().upper() == "UNKNOWN"


def _suffix(ticket_id: str) -> str:
    return ticket_id.removeprefix("SIM-TKT-")


class MaintenanceEngine:
    def __init__(
        self,
        catalog: Catalog | None = None,
        dataset: TicketDataset | None = None,
        audit_sink: AuditSink | None = None,
        clock: Callable[[], datetime] | None = None,
        llm: LLMClient | None = None,
        llm_label: str = "llm",
    ):
        self.catalog = catalog or load_catalog()
        self.dataset = dataset or load_dataset()
        self.audit_sink = audit_sink or (lambda events: None)
        self.clock = clock or (lambda: datetime.now(LOCAL_TZ))
        self.llm = llm  # None = fixed rules only (deterministic, used by tests and LLM_MODE=mock)
        self.llm_label = llm_label
        self.cases: dict[str, Case] = {}
        self.run_number = 0
        self.run_id = "SIM-RUN-000"

    # ------------------------------------------------------------------ run control

    def reset(self, *, with_fixtures: bool = True) -> str:
        """FR-DEMO-001: drop every mutable layer and re-ingest the fixture. Source fixture files are never written."""
        self.cases = {}
        self.run_number += 1
        self.run_id = f"SIM-RUN-{self.run_number:03d}"
        if with_fixtures:
            for fixture in self.dataset.tickets:
                planned = list(fixture.materials) if fixture.materials is not None else None
                self.ingest(fixture.raw, planned_materials=planned)
                self.run_agent(fixture.raw.ticket_id)
        return self.run_id

    def get(self, ticket_id: str) -> Case:
        case = self.cases.get(ticket_id)
        if case is None:
            raise NotFoundError(f"Không có ticket {ticket_id}")
        return case

    # ------------------------------------------------------------------ commands

    def receive(self, original_description: str, *, channel: str = "form", received_at: datetime | None = None) -> Case:
        """A resident report arrives: the system assigns ticket_id/created_at (SYSTEM_INGEST), then the Agent runs.

        `received_at` only exists to simulate a shift in demos; normally it is the current time.
        """
        number = len(self.cases) + 1
        while f"SIM-TKT-{number:04d}" in self.cases:
            number += 1
        raw = RawTicket(
            ticket_id=f"SIM-TKT-{number:04d}",
            created_at=(received_at or self.clock()).astimezone(LOCAL_TZ).isoformat(timespec="seconds"),
            original_description=original_description,
            channel=channel,
        )
        self.ingest(raw)
        return self.run_agent(raw.ticket_id)

    def ingest(self, raw: RawTicket, planned_materials: list[PlannedMaterial] | None = None) -> Case:
        """Store the raw resident ticket unchanged and validate the three classification fields (FR-INGEST-001)."""
        if raw.ticket_id in self.cases:
            raise GuardError(f"Ticket {raw.ticket_id} đã được ingest")
        now = self.clock()
        marker = raw.integrity_marker()
        ticket = Ticket(
            ticket_id=raw.ticket_id,
            raw=raw,
            raw_integrity_marker=marker,
            source_revision=SOURCE_REVISION,
            dataset_version=self.dataset.dataset_version,
            current_state=TicketState.IN_PROGRESS,
            state_decision=StateDecision(
                state=TicketState.IN_PROGRESS, rule_id="INGEST", reason="Ticket được tiếp nhận"
            ),
        )
        work = Case(ticket=ticket, planned_materials=planned_materials)
        self._audit(
            work,
            Action.INGEST,
            "Ticket",
            raw.ticket_id,
            SYSTEM_ID,
            ActorRole.SYSTEM,
            "ticket",
            None,
            {"raw_integrity_marker": marker},
            "Ingest raw ticket mô phỏng",
            now=now,
        )
        self._reevaluate(work, now)
        self.audit_sink(work.audit)
        self.cases[raw.ticket_id] = work
        return work

    def run_agent(self, ticket_id: str) -> Case:
        """Agent step: propose playbook, run risk rules, decide whether BPTN review is needed, then (if not
        blocked) lookups, draft and team route proposal."""
        return self._mutate(ticket_id, AGENT_ID, Action.CREATE_PROPOSAL, self._agent_pass)

    def confirm(self, ticket_id: str, actor_id: str, *, note: str | None = None) -> Case:
        """BPTN reviewed the administrative layer and changes nothing → CONFIRMED. Optional (CR-BPTN-01)."""
        self._guard_safety(ticket_id, actor_id, Action.CONFIRM_NORMALIZATION, note)

        def op(work: Case, now: datetime) -> None:
            admin = self._reviewable_admin(work)
            if admin.confirmation_status == ConfirmationStatus.PENDING_REVIEW:
                raise GuardError(
                    "Dữ liệu hành chính còn thiếu/không rõ; cần override kèm override_reason",
                    {"review_required_reason": admin.review_required_reason},
                )
            reason = "BPTN xem lại, không thay đổi trường hành chính" if _blank(note) else note.strip()
            self._audit(
                work,
                Action.CONFIRM_NORMALIZATION,
                "Ticket",
                ticket_id,
                actor_id,
                ActorRole.BPTN,
                "administrative_normalization.confirmation_status",
                admin.confirmation_status,
                ConfirmationStatus.CONFIRMED,
                reason,
                now=now,
                rule_id="PB-COM-R-CFM-01",
            )
            work.ticket.administrative_normalization = AdministrativeNormalization.model_validate(
                {
                    **admin.model_dump(),
                    "confirmation_status": ConfirmationStatus.CONFIRMED,
                    "confirmed_by": actor_id,
                    "confirmed_at": now,
                    "audit_event_id": work.audit[-1].event_id,
                }
            )
            self._agent_pass(work, now)

        return self._mutate(ticket_id, actor_id, Action.CONFIRM_NORMALIZATION, op)

    def override(
        self,
        ticket_id: str,
        actor_id: str,
        *,
        override_reason: str,
        location_normalized: str | None = None,
        service_category: ServiceCategory | None = None,
        ticket_type: TicketType | None = None,
        override_source_references: list[str] | None = None,
    ) -> Case:
        """BPTN changes allowed administrative fields → OVERRIDDEN, then every downstream rule runs again.

        Only service/type/location can change. Raw content, raw evidence and safety exceptions are out of reach.
        """
        self._guard_safety(ticket_id, actor_id, Action.UPDATE_ADMIN_FIELD, override_reason)

        def op(work: Case, now: datetime) -> None:
            admin = self._reviewable_admin(work)
            if _blank(override_reason):
                raise GuardError("override_reason bắt buộc khi BPTN thay đổi trường hành chính")
            if (service_category is None) != (ticket_type is None):
                raise GuardError("Đổi category cần cả service_category và ticket_type")
            service = service_category or admin.service_category_normalized
            ticket_type_ = ticket_type or admin.ticket_type_normalized
            if (service, ticket_type_) not in PLAYBOOK_PAIRS:
                raise GuardError(
                    "Cặp service/type không khớp playbook v1.1", {"service": service, "type": ticket_type_}
                )
            location = admin.location_normalized if _blank(location_normalized) else location_normalized.strip()
            if _blank(location):
                raise GuardError("Thiếu location_normalized; override phải bổ sung vị trí")
            new_values = {
                "service_category_normalized": service,
                "ticket_type_normalized": ticket_type_,
                "location_normalized": location,
            }
            changes = {f: v for f, v in new_values.items() if getattr(admin, f) != v}
            if not changes:
                raise GuardError("Override không thay đổi trường nào; dùng confirm nếu chỉ xác nhận")

            reason = override_reason.strip()
            for field_name, value in changes.items():
                self._audit(
                    work,
                    Action.UPDATE_ADMIN_FIELD,
                    "Ticket",
                    ticket_id,
                    actor_id,
                    ActorRole.BPTN,
                    f"administrative_normalization.{field_name}",
                    getattr(admin, field_name),
                    value,
                    reason,
                    now=now,
                    rule_id="PB-COM-R-OVR-01",
                )
            work.ticket.administrative_normalization = AdministrativeNormalization(
                administrative_revision=admin.administrative_revision + 1,
                **new_values,
                priority=admin.priority,
                confirmation_status=ConfirmationStatus.OVERRIDDEN,
                review_required_reason=admin.review_required_reason,
                confirmed_by=actor_id,
                confirmed_at=now,
                override_reason=reason,
                override_source_references=list(override_source_references or []),
                override_fields=list(changes),
                audit_event_id=work.audit[-1].event_id,
                source_references=["ticket.original_description", "bptn.override"],
            )
            self._bind_playbook(work, PLAYBOOK_PAIRS[(service, ticket_type_)], service, ticket_type_, now)
            self._agent_pass(work, now)

        return self._mutate(ticket_id, actor_id, Action.UPDATE_ADMIN_FIELD, op)

    def update_checklist(
        self, ticket_id: str, actor_id: str, template_item_id: str, *, status: ChecklistStatus, note: str | None = None
    ) -> Case:
        def op(work: Case, now: datetime) -> None:
            self._require_routed(work)
            item = next((i for i in work.checklist_items if i.template_item_id == template_item_id), None)
            if item is None:
                raise GuardError(f"Không có checklist item {template_item_id} trong draft")
            if note is not None and not note.strip():
                raise GuardError("note nếu có phải không rỗng")
            old = item.status
            item.status = status
            item.updated_by = actor_id
            item.updated_at = now
            item.note = note
            self._audit(
                work,
                Action.UPDATE_CHECKLIST,
                "ChecklistItem",
                item.checklist_item_id,
                actor_id,
                ActorRole.HUMAN_EXECUTION,
                "status",
                old,
                status,
                note or "Cập nhật checklist mô phỏng",
                now=now,
            )
            self._reevaluate(work, now)

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
            self._require_routed(work)
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
                ActorRole.HUMAN_EXECUTION,
                "issued_qty,used_qty,variance_reason",
                old,
                new,
                "Nhập vật tư thực dùng mô phỏng",
                now=now,
            )
            self._reevaluate(work, now)

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
        """Execution evidence. The content is stored as untrusted data and never interpreted (FR-SECURITY-001)."""

        def op(work: Case, now: datetime) -> None:
            self._require_routed(work)
            draft = work.draft
            known = {r.requirement_id for r in draft.evidence_requirements}
            if requirement_id is not None and requirement_id not in known:
                raise GuardError(
                    f"Requirement {requirement_id} không thuộc playbook của draft", {"known": sorted(known)}
                )
            if evidence_type == EvidenceType.RESIDENT_ORIGINAL:
                raise GuardError("Execution evidence không được mang type RESIDENT_ORIGINAL")
            record = EvidenceRecord(
                evidence_id=f"SIM-EVD-{_suffix(ticket_id)}-{len(work.evidence) + 1:02d}",
                ticket_id=ticket_id,
                work_order_draft_id=draft.work_order_draft_id,
                requirement_id=requirement_id,
                evidence_type=evidence_type,
                content_or_metadata=content_or_metadata,
                source=EvidenceSource.HUMAN_EXECUTION,
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
                ActorRole.HUMAN_EXECUTION,
                "evidence",
                None,
                {"requirement_id": requirement_id, "evidence_type": evidence_type},
                "Thêm evidence mô phỏng",
                now=now,
            )
            self._reevaluate(work, now)

        return self._mutate(ticket_id, actor_id, Action.ADD_EVIDENCE, op)

    def resolve_exception(self, ticket_id: str, actor_id: str, exception_id: str, *, resolution_note: str) -> Case:
        """BQL records a resolution that allows the standard flow; the Agent then revalidates from the proposal."""

        def op(work: Case, now: datetime) -> None:
            record = next((e for e in work.exceptions if e.exception_id == exception_id), None)
            if record is None or record.status != ExceptionStatus.OPEN:
                raise GuardError(f"Không có exception OPEN {exception_id}")
            if _blank(resolution_note):
                raise GuardError("resolution_note bắt buộc")
            record.status = ExceptionStatus.RESOLVED_BY_BQL
            record.resolution_note = resolution_note
            record.resolved_by = actor_id
            record.resolved_at = now
            self._audit(
                work,
                Action.RESOLVE_EXCEPTION,
                "ExceptionRecord",
                exception_id,
                actor_id,
                ActorRole.BQL,
                "status",
                ExceptionStatus.OPEN,
                ExceptionStatus.RESOLVED_BY_BQL,
                resolution_note,
                rule_id=record.rule_id,
                now=now,
            )
            self._agent_pass(work, now)

        return self._mutate(ticket_id, actor_id, Action.RESOLVE_EXCEPTION, op)

    def handoff_to_bql(self, ticket_id: str, actor_id: str) -> Case:
        """'Chuyển BQL xem xét' — only from READY_FOR_REVIEW. It is a handoff event, not acceptance."""

        def op(work: Case, now: datetime) -> None:
            if work.ticket.current_state != TicketState.READY_FOR_REVIEW:
                raise GuardError(
                    "Chỉ chuyển BQL xem xét khi READY_FOR_REVIEW",
                    {"state": work.ticket.current_state, "rule_id": work.ticket.state_decision.rule_id},
                )
            work.handed_off_to_bql = True
            self._audit(
                work,
                Action.HANDOFF_TO_BQL,
                "Ticket",
                ticket_id,
                actor_id,
                self._role(actor_id),
                "handed_off_to_bql",
                False,
                True,
                "Chuyển hồ sơ READY_FOR_REVIEW cho BQL xem xét",
                now=now,
            )

        return self._mutate(ticket_id, actor_id, Action.HANDOFF_TO_BQL, op)

    def attempt(
        self, ticket_id: str, actor_id: str, action: Action, *, field_name: str, new_value: Any, reason: str
    ) -> Case:
        """Entry point for actions outside every role's authority (edit raw, assign employee, close, approve...).

        They always end in ACTION_DENIED; the method exists so the denial path can be exercised and audited.
        """
        return self._mutate(
            ticket_id,
            actor_id,
            action,
            lambda work, now: None,
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
        field_name: str = "-",
        new_value: Any = None,
        reason: str | None = None,
    ) -> Case:
        case = self.get(ticket_id)
        now = self.clock()
        role = self._role(actor_id)
        if role is None or role not in PERMISSIONS.get(action, set()):
            self._deny(case, actor_id, role, action, field_name, new_value, reason, now)

        if case.ticket.raw.integrity_marker() != case.ticket.raw_integrity_marker:
            raise EngineError("Raw integrity marker không khớp; dừng xử lý (fail closed)")

        work = case.model_copy(deep=True)
        first_new = len(work.audit)
        op(work, now)
        new_events = work.audit[first_new:]
        try:
            self.audit_sink(new_events)
        except Exception as exc:  # audit failure → nothing is committed
            raise AuditWriteError("Không ghi được audit; thay đổi bị huỷ", {"error": str(exc)}) from exc
        self.cases[ticket_id] = work
        return work

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
        rule_id: str = "PB-COM-R-PERM-01",
        message: str | None = None,
    ) -> None:
        event = self._make_event(
            case,
            Action.ACTION_DENIED,
            "Ticket",
            case.ticket.ticket_id,
            actor_id,
            role or ActorRole.SYSTEM,
            field_name,
            None,
            new_value,
            reason or f"Yêu cầu {action} ngoài quyền",
            now=now,
            result=ActionResult.ACTION_DENIED,
            rule_id=rule_id,
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
                "unchanged_state": case.ticket.current_state,
                "audit_event_id": event.event_id,
            },
        )

    def _make_event(
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

    def _audit(
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
        rule_id: str | None = None,
    ) -> None:
        work.audit.append(
            self._make_event(
                work,
                action,
                entity_type,
                entity_id,
                actor_id,
                role,
                field_name,
                old,
                new,
                reason,
                now=now,
                rule_id=rule_id,
            )
        )

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
            ActorRole.AGENT,
            field_name,
            old,
            new,
            reason,
            now=now,
            rule_id=rule_id,
        )

    @staticmethod
    def _require_routed(work: Case) -> None:
        if work.draft is None or work.draft.route_status != RouteStatus.ROUTED:
            raise GuardError("Draft chưa được route tới team; chưa nhận cập nhật thực hiện")

    def _guard_safety(self, ticket_id: str, actor_id: str, action: Action, reason: str | None) -> None:
        """BPTN review/override never bypasses a safety exception: the attempt is denied and audited."""
        case = self.get(ticket_id)
        open_exception = self._open_exception(case)
        role = self._role(actor_id)
        if open_exception is None or role != ActorRole.BPTN:
            return  # other roles are stopped by the permission matrix inside _mutate
        self._deny(
            case,
            actor_id,
            role,
            action,
            "administrative_normalization",
            None,
            reason,
            self.clock(),
            rule_id=open_exception.rule_id,
            message="Ticket có safety exception OPEN; chỉ BQL xử lý, BPTN không review/override để bỏ qua",
        )

    def _reviewable_admin(self, work: Case) -> AdministrativeNormalization:
        if self._missing_raw_fields(work.ticket.raw):
            raise GuardError("Raw thiếu field bắt buộc; BPTN không được sửa nội dung phản ánh gốc")
        admin = work.ticket.administrative_normalization
        if admin is None:
            raise GuardError("Chưa có lớp hành chính để review")
        return admin

    def _bind_playbook(
        self, work: Case, playbook_id: PlaybookId, service: ServiceCategory, ticket_type: TicketType, now: datetime
    ) -> None:
        """Point the proposal at the playbook of the (possibly overridden) category. Risk rules re-run afterwards."""
        proposal = work.proposal
        technical = playbook_id == PlaybookId.TEC
        if proposal is None:
            # The Agent found no unique playbook; the category now comes from the BPTN override
            work.classification_rule = None
            work.proposal = AgentClassificationProposal(
                proposal_id=f"SIM-ACP-{_suffix(work.ticket.ticket_id)}",
                ticket_id=work.ticket.ticket_id,
                proposal_revision=1,
                service_category_proposed=service,
                ticket_type_proposed=ticket_type,
                playbook_id=playbook_id,
                asset_type="LIGHTING" if technical else None,
                reported_symptom="NOT_WORKING" if technical else None,
                location_proposed=extract_location(work.ticket.raw.original_description),
                matched_rule_ids=["PB-COM-R-OVR-01"],
                classification_reason="Category do BPTN override khi Agent không khớp duy nhất một playbook",
                source_references=["ticket.original_description", "administrative_normalization"],
                rule_signals=self._rule_signals(work, playbook_id, now),
                created_at=now,
            )
            return
        if proposal.playbook_id == playbook_id:
            return
        # Clear the asset first: a cleaning proposal may not carry an asset_id
        proposal.asset_id = None
        proposal.asset_lookup_status = AssetLookupStatus.NOT_APPLICABLE
        proposal.asset_match_reason = "Chưa lookup"
        proposal.playbook_id = playbook_id
        proposal.asset_type = "LIGHTING" if technical else None
        proposal.reported_symptom = "NOT_WORKING" if technical else None
        proposal.proposal_revision += 1
        proposal.matched_rule_ids = [*proposal.matched_rule_ids, "PB-COM-R-OVR-01"]
        proposal.rule_signals = self._rule_signals(work, playbook_id, now)

    # ------------------------------------------------------------------ agent pass

    def _agent_pass(self, work: Case, now: datetime) -> None:
        if not self._missing_raw_fields(work.ticket.raw):
            self._propose(work, now)
            if self._draft_eligible(work):
                self._build_draft(work, now)
        self._reevaluate(work, now)

    def _risk(self, work: Case) -> RiskOutcome:
        return evaluate_signals(work.proposal.playbook_id, work.signal_assessment)

    def _rule_signals(self, work: Case, playbook_id: PlaybookId, now: datetime) -> list[RuleSignal]:
        risk = evaluate_signals(playbook_id, work.signal_assessment)
        trigger = "PB-CLN-R-TRG-01" if playbook_id == PlaybookId.CLN else "PB-TEC-R-TRG-01"
        return [
            RuleSignal(
                signal_code=code,
                status=work.signal_assessment[code],
                source_references=["ticket.original_description"],
                evaluated_at=now,
                rule_id=risk.rule_id or trigger,
            )
            for code in SIGNALS_BY_PLAYBOOK[playbook_id]
        ]

    def _propose(self, work: Case, now: datetime) -> None:
        if work.proposal is not None:
            self._check_risk(work, work.proposal.playbook_id, now)
            return
        if work.classification_rule is not None:
            return  # already found no unique playbook; do not re-ask the model on every pass
        description = work.ticket.raw.original_description
        outcome = propose(description, self.llm, self.llm_label)  # the only place the LLM is called
        result = outcome.classification
        work.signal_assessment = outcome.signals
        work.proposer = outcome.proposer
        work.proposer_notes = outcome.notes
        work.classification_reason = result.reason
        trace = {"proposer": outcome.proposer, "notes": outcome.notes}
        location = extract_location(description)
        if result.playbook_id is None:
            work.classification_rule = result.rule_id
            self._agent(
                work,
                Action.CREATE_PROPOSAL,
                "Ticket",
                work.ticket.ticket_id,
                "playbook_id",
                None,
                {"playbook_id": None, **trace},
                result.reason,
                now=now,
                rule_id=result.rule_id,
            )
            self._decide_review(
                work, ServiceCategory.UNKNOWN, TicketType.UNKNOWN, location, ReviewRequiredReason.CATEGORY_UNCLEAR, now
            )
            return

        risk = evaluate_signals(result.playbook_id, outcome.signals)
        signals = self._rule_signals(work, result.playbook_id, now)
        suffix = _suffix(work.ticket.ticket_id)
        work.proposal = AgentClassificationProposal(
            proposal_id=f"SIM-ACP-{suffix}",
            ticket_id=work.ticket.ticket_id,
            proposal_revision=1,
            service_category_proposed=result.service_category,
            ticket_type_proposed=result.ticket_type,
            playbook_id=result.playbook_id,
            asset_type="LIGHTING" if result.playbook_id == PlaybookId.TEC else None,
            reported_symptom="NOT_WORKING" if result.playbook_id == PlaybookId.TEC else None,
            location_proposed=location,
            matched_rule_ids=[r for r in (result.rule_id, risk.rule_id) if r],
            classification_reason=result.reason,
            source_references=["ticket.original_description"],
            rule_signals=signals,
            created_at=now,
        )
        self._agent(
            work,
            Action.CREATE_PROPOSAL,
            "AgentClassificationProposal",
            work.proposal.proposal_id,
            "playbook_id",
            None,
            {"playbook_id": result.playbook_id, "location_proposed": work.proposal.location_proposed, **trace},
            result.reason,
            now=now,
            rule_id=result.rule_id,
        )
        review = None if location else ReviewRequiredReason.LOCATION_MISSING
        self._decide_review(work, result.service_category, result.ticket_type, location, review, now)
        self._check_risk(work, result.playbook_id, now)

    def _decide_review(
        self,
        work: Case,
        service: ServiceCategory,
        ticket_type: TicketType,
        location: str | None,
        review: ReviewRequiredReason | None,
        now: datetime,
    ) -> None:
        """CR-BPTN-01: BPTN review is required only when category or location is missing/unclear."""
        status = ConfirmationStatus.PENDING_REVIEW if review else ConfirmationStatus.NOT_REQUIRED
        self._agent(
            work,
            Action.CREATE_PROPOSAL,
            "Ticket",
            work.ticket.ticket_id,
            "administrative_normalization.confirmation_status",
            None,
            {"confirmation_status": status, "review_required_reason": review},
            f"Cần BPTN review: {review}"
            if review
            else "Category và location rõ; không bắt buộc BPTN xác nhận, Agent tiếp tục",
            now=now,
            rule_id="PB-COM-R-CFM-01",
        )
        work.ticket.administrative_normalization = AdministrativeNormalization(
            administrative_revision=1,
            service_category_normalized=service,
            ticket_type_normalized=ticket_type,
            location_normalized=location,
            confirmation_status=status,
            review_required_reason=review,
            audit_event_id=work.audit[-1].event_id,
            source_references=["ticket.original_description"],
        )

    def _check_risk(self, work: Case, playbook_id: PlaybookId, now: datetime) -> None:
        risk = evaluate_signals(playbook_id, work.signal_assessment)
        if not risk.exception:
            return
        if any(e.rule_id == risk.rule_id for e in work.exceptions):
            return  # already raised (open) or already resolved by BQL
        present = [code for code, status in risk.signals.items() if status == "PRESENT"]
        record = ExceptionRecord(
            exception_id=f"SIM-EXC-{_suffix(work.ticket.ticket_id)}-{len(work.exceptions) + 1:02d}",
            ticket_id=work.ticket.ticket_id,
            exception_type=EXCEPTION_TYPES[playbook_id],
            rule_id=risk.rule_id,
            reason=f"Phát hiện tín hiệu rủi ro đã định nghĩa: {', '.join(present)}. Chuyển BQL; Agent không chẩn đoán "
            "hoặc hướng dẫn xử lý.",
            source_references=[f"proposal.rule_signals[{code}]" for code in present],
        )
        work.exceptions.append(record)
        self._agent(
            work,
            Action.CREATE_EXCEPTION,
            "ExceptionRecord",
            record.exception_id,
            "status",
            None,
            record.status,
            record.reason,
            now=now,
            rule_id=record.rule_id,
        )

    def _draft_eligible(self, work: Case) -> bool:
        admin = work.ticket.administrative_normalization
        return (
            work.proposal is not None
            and admin is not None
            and admin.confirmation_status != ConfirmationStatus.PENDING_REVIEW
            and not _blank(admin.location_normalized)
            and not self._open_exception(work)
            and not self._risk(work).unclear
        )

    def _build_draft(self, work: Case, now: datetime) -> None:
        proposal, admin, ticket = work.proposal, work.ticket.administrative_normalization, work.ticket
        playbook_id = proposal.playbook_id
        key = f"{ticket.ticket_id}|{PLAYBOOK_VERSION}|{ticket.source_revision}"
        existing = work.draft
        if (
            existing
            and existing.idempotency_key == key
            and existing.administrative_revision == admin.administrative_revision
        ):
            return  # VAL-IDEMP-001: same input → same logical draft
        # A new playbook (BPTN override of the category) means new checklist, materials and evidence requirements
        rebuild = existing is None or existing.playbook_id != playbook_id
        if existing is not None and rebuild:
            work.planned_materials = None  # the previous plan belonged to the other playbook

        # Asset gate (technical only)
        if playbook_id == PlaybookId.TEC:
            matches = [
                a
                for a in self.catalog.assets
                if a.asset_type == "LIGHTING" and a.location_normalized == admin.location_normalized
            ]
            if len(matches) == 1:
                asset_status, asset_id = AssetLookupStatus.MATCHED, matches[0].asset_id
                asset_reason = f"Một asset LIGHTING khớp vị trí ({matches[0].source_ref})"
            elif matches:
                asset_status, asset_id = AssetLookupStatus.AMBIGUOUS, None
                asset_reason = f"{len(matches)} asset LIGHTING cùng khớp vị trí; không đoán"
            else:
                asset_status, asset_id = AssetLookupStatus.NOT_FOUND, None
                asset_reason = "Không có asset LIGHTING nào khớp vị trí đã chuẩn hóa"
        else:
            asset_status, asset_id, asset_reason = AssetLookupStatus.NOT_APPLICABLE, None, "Vệ sinh không lookup asset"
        proposal.asset_lookup_status = asset_status
        proposal.asset_id = asset_id
        proposal.asset_match_reason = asset_reason
        self._agent(
            work,
            Action.LOOKUP_ASSET,
            "AgentClassificationProposal",
            proposal.proposal_id,
            "asset_lookup_status",
            None,
            {"status": asset_status, "asset_id": asset_id},
            asset_reason,
            now=now,
            rule_id={
                AssetLookupStatus.MATCHED: "PB-TEC-R-AST-01",
                AssetLookupStatus.NOT_FOUND: "PB-COM-R-AST-01",
                AssetLookupStatus.AMBIGUOUS: "PB-COM-R-AST-01",
            }.get(asset_status),
        )

        # Stock gate before route
        suffix = _suffix(ticket.ticket_id)
        draft_id = f"SIM-WOD-{suffix}"
        if not rebuild:
            lines = work.material_lines
            material_source = "draft hiện có"
        else:
            if work.planned_materials is None:  # Agent determines planned materials from the playbook
                work.planned_materials = list(self.catalog.default_materials.get(playbook_id, ()))
                material_source = f"vật tư mặc định của {playbook_id}"
            else:
                material_source = "kế hoạch vật tư của ticket"
            lines = [
                self._material_line(draft_id, suffix, index, planned)
                for index, planned in enumerate(work.planned_materials, start=1)
            ]
        stock_status = _aggregate_stock(lines)
        self._agent(
            work,
            Action.CHECK_MATERIAL_STOCK,
            "WorkOrderDraft",
            draft_id,
            "material_stock_status",
            None,
            stock_status,
            f"So vật tư dự kiến ({material_source}) với tồn kho mô phỏng",
            now=now,
            rule_id={"INSUFFICIENT": "PB-COM-R-STK-01", "UNKNOWN": "PB-COM-R-STK-02"}.get(stock_status),
        )

        # Duty gate (both playbooks): team-only, from the simulated duty fixture
        duty = lookup_team(
            self.catalog,
            admin.service_category_normalized,
            datetime.fromisoformat(ticket.raw.created_at).astimezone(LOCAL_TZ),
        )
        duty_status, team_id, duty_ref, duty_reason = duty.status, duty.team_id, duty.source_ref, duty.reason
        proposal.duty_lookup_status = duty_status
        proposal.duty_source_ref = duty_ref
        self._agent(
            work,
            Action.LOOKUP_DUTY,
            "AgentClassificationProposal",
            proposal.proposal_id,
            "duty_lookup_status",
            None,
            {"status": duty_status, "team_id": team_id, "source": duty_ref},
            duty_reason,
            now=now,
            rule_id={
                DutyLookupStatus.NO_AVAILABLE_TEAM: "PB-COM-R-DTY-01",
                DutyLookupStatus.CAPACITY_EXCEEDED: "PB-COM-R-DTY-02",
                DutyLookupStatus.DUTY_UNKNOWN: "PB-COM-R-DTY-03",
            }.get(duty_status),
        )

        blockers = route_blockers(
            CaseFacts(asset_status=asset_status, stock_status=stock_status, duty_status=duty_status)
        )
        routed = not blockers
        proposal.route_status = RouteStatus.ROUTED if routed else RouteStatus.NOT_ROUTED
        proposal.routing_team_id = team_id if routed else None

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
            work.material_lines = lines

        work.draft = WorkOrderDraft(
            work_order_draft_id=draft_id,
            ticket_id=ticket.ticket_id,
            proposal_id=proposal.proposal_id,
            playbook_id=playbook_id,
            administrative_revision=admin.administrative_revision,
            source_revision=ticket.source_revision,
            idempotency_key=key,
            draft_revision=(existing.draft_revision + 1) if existing else 1,
            scope_summary=f"Ghi nhận {SCOPE_LABELS[playbook_id]} tại {admin.location_normalized} theo phản ánh mô "
            "phỏng. Bản nháp, không phải lệnh công việc thật.",
            generation_reason=f"Pre-draft gates passed: confirmation_status={admin.confirmation_status}, "
            "service/type/location rõ, không có exception",
            matched_rule_ids=[*proposal.matched_rule_ids, "PB-COM-R-WO-01"],
            source_references=["ticket.original_description", "administrative_normalization.location_normalized"],
            asset_id=asset_id,
            routing_team_id=team_id if routed else None,
            duty_status=duty_status,
            duty_source_ref=duty_ref,
            material_stock_status=stock_status,
            route_status=proposal.route_status,
            queue_status=QueueStatus.NOT_QUEUED if routed else QueueStatus.PENDING_BQL_REVIEW,
            queue_reason=None if routed else blockers[0].queue_reason,
            checklist_template_id=template.checklist_template_id,
            checklist_item_ids=[i.checklist_item_id for i in work.checklist_items],
            material_requirement_mode=MaterialRequirementMode.TRACKED if lines else MaterialRequirementMode.N_A,
            material_gate_status=MaterialGateStatus.NEEDS_CLARIFICATION if lines else MaterialGateStatus.NA,
            material_line_ids=[m.material_line_id for m in work.material_lines],
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
            work.draft.generation_reason,
            now=now,
            rule_id="PB-COM-R-WO-01",
        )
        if routed:
            self._agent(
                work,
                Action.PROPOSE_TEAM_ROUTE,
                "WorkOrderDraft",
                draft_id,
                "routing_team_id",
                None,
                team_id,
                "Asset/stock/duty gates pass; đề xuất tuyến team hợp lệ (team-only, assignee_id=null), "
                "không phải xác nhận đã giao việc",
                now=now,
                rule_id="PB-COM-R-ROUTE-01",
            )

    def _material_line(self, draft_id: str, suffix: str, index: int, planned: PlannedMaterial) -> MaterialLine:
        item = self.catalog.material(planned.item_code)
        if item is None or item.simulated_stock_qty is None:
            stock = MaterialStockStatus.UNKNOWN
        elif item.simulated_stock_qty < planned.planned_qty:
            stock = MaterialStockStatus.INSUFFICIENT
        else:
            stock = MaterialStockStatus.SUFFICIENT
        return MaterialLine(
            material_line_id=f"SIM-MAT-LINE-{suffix}-{index:02d}",
            work_order_draft_id=draft_id,
            item_code=planned.item_code,
            item_name=item.item_name if item else "Vật tư mô phỏng chưa có trong catalog",
            unit=item.unit if item else None,
            planned_qty=planned.planned_qty,
            norm_qty=item.norm_qty if item else None,
            norm_label=item.norm_label if item else NormLabel.N_A,
            simulated_stock_qty=item.simulated_stock_qty if item else None,
            material_stock_status=stock,
        )

    # ------------------------------------------------------------------ evaluation

    @staticmethod
    def _missing_raw_fields(raw: RawTicket) -> list[str]:
        missing = []
        if _blank(raw.ticket_id) or not raw.ticket_id.startswith("SIM-TKT-"):
            missing.append("ticket_id")
        try:
            if datetime.fromisoformat(raw.created_at).tzinfo is None:
                missing.append("created_at")
        except ValueError:
            missing.append("created_at")
        if _blank(raw.original_description):
            missing.append("original_description")
        return missing

    @staticmethod
    def _open_exception(work: Case) -> ExceptionRecord | None:
        return next((e for e in work.exceptions if e.status == ExceptionStatus.OPEN), None)

    def _reconcile(self, work: Case, now: datetime) -> tuple[list[str], list[str]]:
        """Three comparisons per line (VAL-MAT-CMP-001). Returns (lines missing qty, lines with unexplained variance)."""
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
        if work.draft:
            if work.draft.material_requirement_mode == MaterialRequirementMode.N_A:
                work.draft.material_gate_status = MaterialGateStatus.NA
            elif incomplete or unexplained:
                work.draft.material_gate_status = MaterialGateStatus.NEEDS_CLARIFICATION
            else:
                work.draft.material_gate_status = MaterialGateStatus.RECONCILED
            work.draft.non_blocking_warnings = warnings
        return incomplete, unexplained

    def _validate_evidence(self, work: Case) -> tuple[list[str], list[str]]:
        """Per requirement: PRESENT/MISSING/INVALID_TYPE/SOURCE_UNVERIFIED. Returns (known missing, needs human)."""
        missing, unverified = [], []
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
            elif EvidenceValidationStatus.SOURCE_UNVERIFIED in statuses:
                requirement.validation_status = EvidenceValidationStatus.SOURCE_UNVERIFIED
                unverified.append(requirement.requirement_id)
            elif EvidenceValidationStatus.INVALID_TYPE in statuses:
                requirement.validation_status = EvidenceValidationStatus.INVALID_TYPE
                missing.append(requirement.requirement_id)
            else:
                requirement.validation_status = EvidenceValidationStatus.MISSING
                missing.append(requirement.requirement_id)
            requirement.satisfied_by = present
        # Images and other records without a requirement are kept but never satisfy one (VAL-EVD-IMG-001)
        for record in work.evidence:
            if record.requirement_id is None:
                record.evidence_validation_status = EvidenceValidationStatus.MISSING
        return missing, unverified

    def _facts(self, work: Case, now: datetime) -> CaseFacts:
        facts = CaseFacts(missing_raw_fields=self._missing_raw_fields(work.ticket.raw))
        if facts.missing_raw_fields:
            return facts
        facts.classification_rule = work.classification_rule
        proposal = work.proposal
        if proposal is None:
            return facts
        facts.playbook_present = True
        open_exception = self._open_exception(work)
        facts.exception_rule = open_exception.rule_id if open_exception else None
        risk = self._risk(work)
        resolved = {e.rule_id for e in work.exceptions if e.status == ExceptionStatus.RESOLVED_BY_BQL}
        if risk.unclear and risk.rule_id not in resolved:
            facts.risk_unclear_rule = risk.rule_id
        admin = work.ticket.administrative_normalization
        facts.confirmation_pending = admin is None or admin.confirmation_status == ConfirmationStatus.PENDING_REVIEW
        facts.review_required_reason = admin.review_required_reason if facts.confirmation_pending and admin else None
        facts.location_missing = not facts.confirmation_pending and _blank(admin.location_normalized)

        draft = work.draft
        if draft is None:
            return facts
        facts.draft_present = True
        facts.asset_status = proposal.asset_lookup_status
        facts.stock_status = draft.material_stock_status
        facts.duty_status = draft.duty_status
        facts.route_status = draft.route_status
        facts.routed = draft.route_status == RouteStatus.ROUTED and draft.assignee_id is None
        if facts.routed:
            facts.checklist_pending = [
                i.template_item_id for i in work.checklist_items if i.required and i.status != ChecklistStatus.COMPLETED
            ]
            facts.evidence_missing, facts.evidence_unverified = self._validate_evidence(work)
            facts.material_incomplete, facts.material_variance_unexplained = self._reconcile(work, now)
        return facts

    def _reevaluate(self, work: Case, now: datetime) -> None:
        facts = self._facts(work, now)
        decision = resolve(facts)
        draft = work.draft
        if draft is not None:
            draft.blocking_exception_active = facts.exception_rule is not None
            asset_ok = facts.asset_status in (AssetLookupStatus.MATCHED, AssetLookupStatus.NOT_APPLICABLE)
            stock_ok = facts.stock_status in (MaterialStockStatus.SUFFICIENT, MaterialStockStatus.NOT_APPLICABLE)
            draft.readiness_evaluation = ReadinessEvaluation(
                playbook_present=facts.playbook_present,
                work_order_draft_present=True,
                required_fields_complete=not facts.confirmation_pending and not facts.location_missing and asset_ok,
                route_valid=facts.routed,
                checklist_complete=facts.routed and not facts.checklist_pending,
                minimum_evidence_complete=facts.routed and not facts.evidence_missing and not facts.evidence_unverified,
                material_reconciled_or_na=stock_ok
                and draft.material_gate_status in (MaterialGateStatus.RECONCILED, MaterialGateStatus.NA),
                no_blocking_exception=facts.exception_rule is None,
                evaluated_at=now,
                rule_ids=decision.blocking_rules or [decision.rule_id],
                source_references=["work_order_draft", "checklist_items", "material_lines", "evidence"],
                target_state=decision.state,
                reason=decision.reason,
                failing_items=[
                    *facts.checklist_pending,
                    *facts.evidence_missing,
                    *facts.evidence_unverified,
                    *facts.material_incomplete,
                    *facts.material_variance_unexplained,
                ],
            )
            if decision.state == TicketState.READY_FOR_REVIEW and not draft.readiness_evaluation.all_pass:
                raise EngineError("Resolver trả READY nhưng còn gate false (fail closed)")
        self._transition(work, decision, now)

    def _transition(self, work: Case, decision: StateDecision, now: datetime) -> None:
        ticket = work.ticket
        current, target = ticket.current_state, decision.state
        path = [target]
        if current != target and target not in TRANSITIONS[current]:
            # CHỜ XÁC MINH / EXCEPTION → READY goes through IN_PROGRESS after revalidation
            path = [TicketState.IN_PROGRESS, target]
        for step in path:
            if step == ticket.current_state:
                continue
            if step not in TRANSITIONS[ticket.current_state]:
                raise EngineError(f"Transition {ticket.current_state} → {step} không hợp lệ")
            self._agent(
                work,
                Action.TRANSITION_STATE,
                "Ticket",
                ticket.ticket_id,
                "current_state",
                ticket.current_state,
                step,
                decision.reason,
                now=now,
                rule_id=decision.rule_id,
            )
            ticket.current_state = step
        ticket.state_decision = decision


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
    if MaterialStockStatus.UNKNOWN in statuses:
        return MaterialStockStatus.UNKNOWN
    if MaterialStockStatus.INSUFFICIENT in statuses:
        return MaterialStockStatus.INSUFFICIENT
    return MaterialStockStatus.SUFFICIENT


def _evidence_status(record: EvidenceRecord, allowed: list[EvidenceType]) -> EvidenceValidationStatus:
    if record.evidence_type not in allowed:
        return EvidenceValidationStatus.INVALID_TYPE
    if record.source != EvidenceSource.HUMAN_EXECUTION:
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
