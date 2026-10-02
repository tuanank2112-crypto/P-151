"""Load the read-only simulated catalog, department calendar, SLA config and the 12-ticket fixture."""

from datetime import datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

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


class HoursSla(Frozen):
    escalate_after_hours: float = Field(gt=0)  # calendar hours, not business hours


class CountSla(Frozen):
    escalate_at_count: int = Field(ge=1)


class PrioritySla(Frozen):
    duplicate_raise_at_count: int = Field(ge=1)


class SlaConfig(Frozen):
    """Every timing and threshold the engine uses (CR-BPTN-03 §12.2). Values marked "đề xuất" in catalog.yaml are
    still waiting for a decision."""

    max_auto_retries: int = Field(ge=0)
    job_interval_minutes: float = Field(gt=0)
    duplicate_window_hours: float = Field(gt=0)
    bptn: BptnSla
    waiting_material: WaitingMaterialSla
    not_accepted: NotAcceptedSla
    rework: ReworkSla
    safety_review: HoursSla
    safety_context_need_info: HoursSla
    wrong_dept_return: CountSla
    priority: PrioritySla


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
    risk_level: str | None = None
    priority: str | None = None
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
def load_dataset(directory: Path = FIXTURE_DIR) -> TicketDataset:
    return TicketDataset.model_validate(_read(directory / "tickets.yaml"))
