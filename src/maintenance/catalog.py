"""Load the read-only simulated catalog, department calendar, SLA config and the 12-ticket fixture."""

import re
import unicodedata
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


PHRASE = re.compile(r"[a-z0-9]+(?: [a-z0-9]+)*")  # a plain phrase: unaccented lower case, single spaces (WP3c, 01 §5.0)


def _fold(text: str) -> str:
    """NFKC, lower case, d-stroke to d, accents stripped: how the safety layer normalises (SPEC-P01 §3.1)."""
    low = unicodedata.normalize("NFKC", text).lower().replace("đ", "d")
    return "".join(c for c in unicodedata.normalize("NFD", low) if unicodedata.category(c) != "Mn")


def _check_phrases(name: str, values: tuple[str, ...], *, token: bool = False) -> None:
    for value in values:
        if not PHRASE.fullmatch(value):
            raise ValueError(
                f"{name}: {value!r} phải là cụm thường không dấu (chữ thường, một khoảng trắng, không 're:')"
            )
        if token and " " in value:
            raise ValueError(f"{name}: {value!r} phải là một token (không khoảng trắng)")


def _check_accented(name: str, key: str, forms: tuple[str, ...]) -> None:
    """Every accented form is NFC lower case and folds back to `key` (01 §5.0)."""
    if not forms:
        raise ValueError(f"{name}[{key!r}]: danh sách dạng có dấu rỗng")
    for form in forms:
        if form != unicodedata.normalize("NFC", form).lower() or _fold(form) != key:
            raise ValueError(f"{name}[{key!r}]: {form!r} không phải dạng có dấu (NFC, chữ thường) của {key!r}")


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
    """Safety vocabulary (WP3c, rules R1-R10, plan Q29). Every key is required: no defaults, fail fast."""

    active_phases: tuple[Literal["P0", "P1"], ...] = Field(min_length=1)
    # R1/R3/R4/R5: negation and hedge scope (a cue, at most `scope_max_fillers` fillers, right before the span)
    scope_max_fillers: int = Field(ge=0, le=3)
    scope_max_chars: int = Field(ge=40, le=200)
    negation_prefixes: tuple[str, ...] = Field(min_length=1)  # R3: generic cues carry no object
    negation_fillers: tuple[str, ...] = Field(min_length=1)
    person_negation_cues: tuple[str, ...]  # R3: cues with a PERSON as object, only for `person_signal_ids`
    person_signal_ids: tuple[str, ...]
    coordination_conjunctions: tuple[str, ...]  # R4: hay / hoặc / lẫn
    coordination_hazard_tokens: tuple[str, ...]  # R4 (A3): the first part must hold one of these
    hedges: tuple[str, ...] = Field(min_length=1)
    hedge_fillers: tuple[str, ...]
    resolved_markers: tuple[str, ...]
    final_particles: tuple[str, ...]  # R5: only these may follow a marker
    resolved_bridge_tokens: tuple[str, ...]  # R5 (A2): the only tokens between a signal and its marker
    # B-01 (R6, A1)
    benign_phrases: tuple[str, ...]
    benign_lamp_nouns: tuple[str, ...] = Field(min_length=1)
    benign_lamp_noun_forms: dict[str, tuple[str, ...]]  # A1: lamp-noun token -> accepted accented forms
    b01_prefix_words: tuple[str, ...]  # R6: the closed set of place words and helpers
    b01_code_token_regex: str  # R6: one code token (fullmatch): "3", "b1", "a"
    b01_max_prefix_tokens: int = Field(ge=1, le=40)
    benign_with_lamp_noun: tuple[str, ...]
    # B-03, R7, R9
    ambiguous_terms: tuple[str, ...]
    ambiguous_exclusions: tuple[str, ...]
    homographs: dict[str, tuple[str, ...]]  # R7: token -> accented forms that are NOT a risk
    homograph_intended: dict[str, dict[str, tuple[str, ...]]]  # R7: pattern -> token -> forms the pattern means
    tier2_net_roots: dict[str, tuple[str, ...]]  # R9: root -> accented forms that trigger the tier-2 net
    # B-04
    khet_benign_contexts: tuple[str, ...]
    khet_benign_contexts_accented: tuple[str, ...]
    khet_electric_contexts: tuple[str, ...]
    clause_conjunctions: tuple[str, ...] = Field(min_length=1)
    components: tuple[ComponentDef, ...]
    signals: tuple[SignalDef, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _consistent(self):
        """01 §5.4 V-01..V-11. Any violation is a ValueError, which pydantic reports as a ValidationError."""
        for group in (
            self.resolved_markers,
            self.benign_phrases,
            self.ambiguous_terms,
            self.ambiguous_exclusions,
            self.khet_benign_contexts,
            self.khet_benign_contexts_accented,
            self.khet_electric_contexts,
        ):
            _check_patterns(group)  # V-01
        for component in self.components:
            _check_patterns(component.patterns)
        for name in (
            "negation_prefixes",
            "negation_fillers",
            "person_negation_cues",
            "coordination_conjunctions",
            "coordination_hazard_tokens",
            "hedges",
            "hedge_fillers",
            "final_particles",
            "resolved_bridge_tokens",
            "benign_lamp_nouns",
            "b01_prefix_words",
            "clause_conjunctions",
        ):
            _check_phrases(name, getattr(self, name))  # V-02
        for name in (
            "negation_fillers",
            "hedge_fillers",
            "final_particles",
            "resolved_bridge_tokens",
            "coordination_hazard_tokens",
            "coordination_conjunctions",
        ):
            _check_phrases(name, getattr(self, name), token=True)  # V-03
        _check_phrases("homographs", tuple(self.homographs), token=True)
        if "va" not in self.clause_conjunctions or set(self.coordination_conjunctions) & set(self.clause_conjunctions):
            raise ValueError("clause_conjunctions phải chứa 'va' và không giao với coordination_conjunctions")  # V-04
        try:
            re.compile(self.b01_code_token_regex)  # V-05
        except re.error as exc:
            raise ValueError(f"b01_code_token_regex không compile được ({exc})") from exc
        lamp_tokens = {t for phrase in self.benign_lamp_nouns for t in phrase.split()}
        for key, forms in self.benign_lamp_noun_forms.items():  # V-06
            if key not in lamp_tokens:
                raise ValueError(f"benign_lamp_noun_forms: {key!r} không nằm trong benign_lamp_nouns")
            _check_accented("benign_lamp_noun_forms", key, forms)
        for key, forms in self.homographs.items():  # V-07
            _check_accented("homographs", key, forms)
        patterns = {p for s in self.signals for p in s.patterns} | set(self.ambiguous_terms)
        for pattern, per_token in self.homograph_intended.items():  # V-08
            if not PHRASE.fullmatch(pattern) or pattern not in patterns:
                raise ValueError(f"homograph_intended: {pattern!r} không phải pattern cụm thường có thật")
            for token, forms in per_token.items():
                if token not in self.homographs or token not in pattern.split():
                    raise ValueError(f"homograph_intended[{pattern!r}]: token {token!r} không hợp lệ")
                _check_accented("homograph_intended", token, forms)
        for root, forms in self.tier2_net_roots.items():  # V-09
            _check_phrases("tier2_net_roots", (root,))
            _check_accented("tier2_net_roots", root, forms)
        ids = [s.signal_id for s in self.signals]
        if len(ids) != len(set(ids)):
            raise ValueError("signal_id trùng nhau trong lexicon")  # V-11
        if not set(self.person_signal_ids) <= set(ids):
            raise ValueError("person_signal_ids trỏ tới signal_id không có")  # V-10
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
    # R1 is ONE rule shared with the safety layer: `Lexicon._same_scope` forces these to equal the safety values
    negation_prefixes: tuple[str, ...] = Field(min_length=1)
    negation_fillers: tuple[str, ...] = Field(min_length=1)
    scope_max_fillers: int = Field(ge=0, le=3)
    scope_max_chars: int = Field(ge=40, le=200)
    clause_conjunctions: tuple[str, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _compile(self):
        _check_patterns(self.obstruction_patterns)
        _check_patterns(self.usage_impact_patterns)
        for name in ("negation_prefixes", "negation_fillers", "clause_conjunctions"):
            _check_phrases("priority." + name, getattr(self, name))
        return self


class Lexicon(Frozen):
    lexicon_version: str
    synthetic: Literal[True]
    safety: SafetyLexicon
    priority: PriorityLexicon

    @model_validator(mode="after")
    def _same_scope(self):
        """V-12: priority and safety share ONE negation scope rule (R1)."""
        for name in ("negation_fillers", "scope_max_fillers", "scope_max_chars", "clause_conjunctions"):
            if getattr(self.priority, name) != getattr(self.safety, name):
                raise ValueError(f"priority.{name} phải bằng safety.{name} (R1 là một luật)")
        return self


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
