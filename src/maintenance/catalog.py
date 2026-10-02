"""Load the read-only simulated catalog, department calendar, SLA config and the 12-ticket fixture."""

import re
from datetime import datetime, time, timedelta
from functools import cache, lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.maintenance.enums import ActorRole, Department, EvidenceType, PlaybookId, ReadabilityStatus
from src.maintenance.models import (
    Asset,
    ChecklistTemplate,
    EvidenceRequirement,
    MaterialCatalogItem,
    PlannedMaterial,
    RawTicket,
)

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "seed" / "maintenance_v1"


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


def _at(day: datetime, clock: str) -> datetime:
    return datetime.combine(day.date(), time.fromisoformat(clock), tzinfo=day.tzinfo)


class ShiftWindow(Frozen):
    start: str
    end: str

    def contains(self, moment: time) -> bool:
        start, end = time.fromisoformat(self.start), time.fromisoformat(self.end)
        if start <= end:
            return start <= moment < end
        return moment >= start or moment < end  # overnight shift


class DepartmentConfig(Frozen):
    department_id: Department
    name: str
    shifts: tuple[ShiftWindow, ...] = Field(min_length=1)

    def on_shift(self, moment: datetime) -> bool:
        clock = moment.timetz().replace(tzinfo=None)
        return any(s.contains(clock) for s in self.shifts)

    def next_shift_start(self, moment: datetime) -> datetime:
        """First shift start strictly after `moment` (local time of `moment`)."""
        candidates = (_at(moment + timedelta(days=offset), s.start) for offset in range(0, 8) for s in self.shifts)
        return min(c for c in candidates if c > moment)


class BusinessHours(Frozen):
    start: str
    end: str
    weekdays: tuple[int, ...] = Field(min_length=1)

    def add(self, moment: datetime, hours: float) -> datetime:
        """`moment` plus `hours` counted only inside business hours."""
        remaining = timedelta(hours=hours)
        current = moment
        for _ in range(366):
            day_start, day_end = _at(current, self.start), _at(current, self.end)
            if current.weekday() not in self.weekdays or current >= day_end:
                current = _at(current + timedelta(days=1), self.start)
                continue
            current = max(current, day_start)
            if current + remaining <= day_end:
                return current + remaining
            remaining -= day_end - current
            current = _at(current + timedelta(days=1), self.start)
        raise ValueError("business_hours không có ngày làm việc nào")


class MissingInfoSafetySla(Frozen):
    escalate_after_hours: float = Field(gt=0)


class MissingInfoSla(Frozen):
    retry_every_hours: float
    escalate_after_hours: float
    safety_context: MissingInfoSafetySla  # CR-BPTN-03 §6.4: NEED_INFO raised by a suspected hazard (T06)


class BptnSla(Frozen):
    retry_every_business_hours: float
    escalate_after_business_hours: float


class WaitingMaterialSla(Frozen):
    escalate_after_hours: float


class NotAcceptedSla(Frozen):
    start_after_hours: float
    retry_every_hours: float


class ReworkSla(Frozen):
    escalate_at_count: int = Field(ge=1)


class SafetyReviewSla(Frozen):
    escalate_after_hours: float = Field(gt=0)  # CALENDAR hours: never goes through business_hours.add (Q10)


class PrioritySla(Frozen):
    duplicate_raise_at_count: int = Field(ge=1)  # D-03; loaded in P0, not used yet (PRI-U1 is P1)


class SlaConfig(Frozen):
    """Every timing the engine uses. Defaults in catalog.yaml are provisional (CR-BPTN-02 §8)."""

    max_auto_retries: int = Field(ge=0)
    job_interval_minutes: float = Field(gt=0)
    duplicate_window_hours: float = Field(gt=0)
    missing_info: MissingInfoSla
    safety_review: SafetyReviewSla
    bptn: BptnSla
    waiting_material: WaitingMaterialSla
    not_accepted: NotAcceptedSla
    rework: ReworkSla
    priority: PrioritySla


# ---------------------------------------------------------------------------
# Safety / priority vocabulary is DATA (lexicon.yaml, Q07); the logic lives in safety.py and priority.py
# ---------------------------------------------------------------------------


@cache
def compile_pattern(pattern: str) -> re.Pattern[str]:
    """'re:<regex>' = raw regex; anything else = a phrase matched whole, on word boundaries."""
    return re.compile(pattern[3:]) if pattern.startswith("re:") else re.compile(r"\b" + re.escape(pattern) + r"\b")


def _check_patterns(patterns: tuple[str, ...]) -> None:
    for pattern in patterns:
        try:
            compile_pattern(pattern)
        except re.error as exc:
            raise ValueError(f"Pattern không compile được: {pattern!r} ({exc})") from exc


class SignalDef(Frozen):
    signal_id: str = Field(pattern=r"^(S-\d{2}|T2-0[1-5])$")
    name: str
    tier: Literal[1, 2]
    phase: Literal["P0", "P1"]
    scope: tuple[str, ...] = ()  # lookup only (00 §8 D12): P0 never filters by scope
    patterns: tuple[str, ...] = ()
    all_of: tuple[str, ...] = ()  # tier 1 combination: EVERY component PRESENT (S-14)
    any_of: tuple[str, ...] = ()  # tier 2: some component but not all of all_of (T2-05)


class ComponentDef(Frozen):
    component_id: str
    patterns: tuple[str, ...] = Field(min_length=1)


class SafetyLexicon(Frozen):
    active_phases: tuple[Literal["P0", "P1"], ...] = Field(min_length=1)
    negation_window_words: int = Field(ge=1)
    negation_prefixes: tuple[str, ...] = Field(min_length=1)
    hedge_window_words: int = Field(ge=1)
    hedges: tuple[str, ...] = Field(min_length=1)
    resolved_markers: tuple[str, ...]
    benign_phrases: tuple[str, ...]
    benign_lamp_nouns: tuple[str, ...]
    benign_with_lamp_noun: tuple[str, ...]
    ambiguous_terms: tuple[str, ...]
    ambiguous_exclusions: tuple[str, ...]
    khet_benign_contexts: tuple[str, ...]
    # WP3b (Q25): defaults keep older lexicon files loadable; the shipped lexicon.yaml fills them
    khet_benign_contexts_accented: tuple[str, ...] = ()  # matched on the lower-cased ORIGINAL text: nấu is not nâu
    khet_electric_contexts: tuple[str, ...] = ()  # an electrical word in the sentence keeps 'khét' at tier 1 (B-04)
    non_lamp_electrical: tuple[str, ...] = ()  # sockets, boxes, wires: B-01 (benign lamp) does not cover them
    clause_conjunctions: tuple[str, ...] = ()  # words that end a clause for negation/hedge/marker (và, nhưng...)
    components: tuple[ComponentDef, ...]
    signals: tuple[SignalDef, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _consistent(self):
        """Every pattern compiles; signal_id unique; all_of/any_of name real components; a signal is either a
        pattern signal or a combination (T2-03 alone has no patterns: they come from ambiguous_terms)."""
        for group in (
            self.negation_prefixes,
            self.hedges,
            self.resolved_markers,
            self.benign_phrases,
            self.benign_lamp_nouns,
            self.ambiguous_terms,
            self.ambiguous_exclusions,
            self.khet_benign_contexts,
            self.khet_benign_contexts_accented,
            self.khet_electric_contexts,
            self.non_lamp_electrical,
        ):
            _check_patterns(group)
        for component in self.components:
            _check_patterns(component.patterns)
        ids = [s.signal_id for s in self.signals]
        if len(ids) != len(set(ids)):
            raise ValueError("signal_id trùng nhau trong lexicon")
        known = {c.component_id for c in self.components}
        for signal in self.signals:
            _check_patterns(signal.patterns)
            combo = signal.all_of or signal.any_of
            if not set(signal.all_of + signal.any_of) <= known:
                raise ValueError(f"{signal.signal_id}: all_of/any_of trỏ tới component không có")
            if combo and signal.patterns:
                raise ValueError(f"{signal.signal_id}: tín hiệu tổ hợp không được có patterns")
            if not combo and not signal.patterns and signal.signal_id != "T2-03":
                raise ValueError(f"{signal.signal_id}: thiếu patterns")
        return self


class PriorityLexicon(Frozen):
    high_areas: tuple[str, ...] = Field(min_length=1)  # area labels, exactly as rules.AREA_PATTERNS
    obstruction_patterns: tuple[str, ...] = Field(min_length=1)  # PRI-H2
    usage_impact_patterns: tuple[str, ...] = Field(min_length=1)  # PRI-M2
    negation_prefixes: tuple[str, ...] = ()  # WP3b (Q27): "không chắn lối đi" does not trigger PRI-H2
    negation_window_words: int = Field(default=4, ge=1)
    clause_conjunctions: tuple[str, ...] = ()

    @model_validator(mode="after")
    def _compile(self):
        _check_patterns(self.obstruction_patterns)
        _check_patterns(self.usage_impact_patterns)
        _check_patterns(self.negation_prefixes)
        return self


class Lexicon(Frozen):
    lexicon_version: str
    synthetic: Literal[True]
    safety: SafetyLexicon
    priority: PriorityLexicon


class Actor(Frozen):
    actor_id: str
    actor_role: ActorRole
    department_id: Department | None = None


class Catalog(Frozen):
    dataset_version: str
    synthetic: Literal[True]
    assets: tuple[Asset, ...]
    materials: tuple[MaterialCatalogItem, ...]
    default_materials: dict[PlaybookId, tuple[PlannedMaterial, ...]]
    checklist_templates: tuple[ChecklistTemplate, ...]
    evidence_requirements: tuple[EvidenceRequirement, ...]
    actors: tuple[Actor, ...]
    playbook_departments: dict[PlaybookId, Department]
    departments: tuple[DepartmentConfig, ...]
    business_hours: BusinessHours
    sla_config: SlaConfig

    def material(self, item_code: str) -> MaterialCatalogItem | None:
        return next((m for m in self.materials if m.item_code == item_code), None)

    def template_for(self, playbook_id: PlaybookId) -> ChecklistTemplate:
        return next(t for t in self.checklist_templates if t.playbook_id == playbook_id)

    def requirements_for(self, playbook_id: PlaybookId) -> list[EvidenceRequirement]:
        return [r.model_copy() for r in self.evidence_requirements if r.playbook_id == playbook_id]

    def actor(self, actor_id: str) -> Actor | None:
        return next((a for a in self.actors if a.actor_id == actor_id), None)

    def actor_role(self, actor_id: str) -> ActorRole | None:
        actor = self.actor(actor_id)
        return actor.actor_role if actor else None

    def department_for(self, playbook_id: PlaybookId) -> Department:
        return self.playbook_departments[playbook_id]

    def department(self, department_id: Department) -> DepartmentConfig:
        return next(d for d in self.departments if d.department_id == department_id)


# ---------------------------------------------------------------------------
# Ticket fixture: raw data plus the scripted human inputs and the expected oracle
# ---------------------------------------------------------------------------


class ExecutedMaterial(Frozen):
    item_code: str
    issued_qty: float = Field(ge=0)
    used_qty: float = Field(ge=0)
    variance_reason: str | None = None


class ExecutedEvidence(Frozen):
    requirement_id: str | None
    evidence_type: EvidenceType
    content_or_metadata: str
    readability_status: ReadabilityStatus


class ExecutionInput(Frozen):
    """Department steps after it accepts the ticket; ends with 'báo hoàn thành' (step 10)."""

    checklist: tuple[str, ...] = ()
    materials: tuple[ExecutedMaterial, ...] = ()
    evidence: tuple[ExecutedEvidence, ...] = ()


class Expected(Frozen):
    status: str
    reason_code: str | None = None
    playbook_id: str | None = None
    proposed_department_id: str | None = None
    department_id: str | None = None
    review_status: str | None = None
    asset_resolution: str | None = None
    draft_exists: bool = False
    location: str | None = None
    asset_lookup_status: str | None = None
    asset_id: str | None = None
    material_stock_status: str | None = None
    flags: tuple[str, ...] | None = None
    warnings: tuple[str, ...] | None = None
    failing_items: tuple[str, ...] | None = None
    risk_level: str | None = None
    priority: str | None = None


class TicketFixture(Frozen):
    raw: RawTicket
    flow: Literal["DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4", "REGRESSION"]
    purpose: str
    materials: tuple[PlannedMaterial, ...] | None = None
    execution: ExecutionInput | None = None
    expected: Expected

    @property
    def is_demo(self) -> bool:
        return self.flow.startswith("DEMO")


class TicketDataset(Frozen):
    dataset_version: str
    synthetic: Literal[True]
    tickets: tuple[TicketFixture, ...]

    def get(self, ticket_id: str) -> TicketFixture | None:
        return next((t for t in self.tickets if t.raw.ticket_id == ticket_id), None)


def _read(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


@lru_cache
def load_catalog(directory: Path = FIXTURE_DIR) -> Catalog:
    return Catalog.model_validate(_read(directory / "catalog.yaml"))


@lru_cache
def load_lexicon(directory: Path = FIXTURE_DIR) -> Lexicon:
    return Lexicon.model_validate(_read(directory / "lexicon.yaml"))


@lru_cache
def load_dataset(directory: Path = FIXTURE_DIR) -> TicketDataset:
    return TicketDataset.model_validate(_read(directory / "tickets.yaml"))
