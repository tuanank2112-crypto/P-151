"""Load the read-only simulated catalog and the 12-ticket fixture from seed/maintenance_v1."""

from datetime import datetime, time
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

from src.maintenance.enums import ActorRole, EvidenceType, PlaybookId, ReadabilityStatus
from src.maintenance.models import (
    Asset,
    ChecklistTemplate,
    DutyAvailability,
    EvidenceRequirement,
    MaterialCatalogItem,
    PlannedMaterial,
    RawTicket,
)

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "seed" / "maintenance_v1"


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Shift(Frozen):
    shift_window: str
    start: str
    end: str

    def contains(self, moment: time) -> bool:
        start, end = time.fromisoformat(self.start), time.fromisoformat(self.end)
        if start <= end:
            return start <= moment < end
        return moment >= start or moment < end  # overnight shift


class Actor(Frozen):
    actor_id: str
    actor_role: ActorRole


class Catalog(Frozen):
    dataset_version: str
    synthetic: Literal[True]
    shifts: tuple[Shift, ...]
    assets: tuple[Asset, ...]
    duty_availability: tuple[DutyAvailability, ...]
    materials: tuple[MaterialCatalogItem, ...]
    checklist_templates: tuple[ChecklistTemplate, ...]
    evidence_requirements: tuple[EvidenceRequirement, ...]
    actors: tuple[Actor, ...]

    def shift_for(self, created_at: datetime) -> str | None:
        moment = created_at.timetz().replace(tzinfo=None)
        return next((s.shift_window for s in self.shifts if s.contains(moment)), None)

    def material(self, item_code: str) -> MaterialCatalogItem | None:
        return next((m for m in self.materials if m.item_code == item_code), None)

    def template_for(self, playbook_id: PlaybookId) -> ChecklistTemplate:
        return next(t for t in self.checklist_templates if t.playbook_id == playbook_id)

    def requirements_for(self, playbook_id: PlaybookId) -> list[EvidenceRequirement]:
        return [r.model_copy() for r in self.evidence_requirements if r.playbook_id == playbook_id]

    def actor_role(self, actor_id: str) -> ActorRole | None:
        return next((a.actor_role for a in self.actors if a.actor_id == actor_id), None)


# ---------------------------------------------------------------------------
# Ticket fixture: raw data plus the scripted human inputs and the expected oracle
# ---------------------------------------------------------------------------


class BptnInput(Frozen):
    location_normalized: str | None = None
    reason: str
    service_category: str | None = None  # None = accept the Agent proposal
    ticket_type: str | None = None


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
    checklist: tuple[str, ...] = ()
    materials: tuple[ExecutedMaterial, ...] = ()
    evidence: tuple[ExecutedEvidence, ...] = ()


class Expected(Frozen):
    playbook_id: str | None
    draft_exists: bool
    state: str
    rule_id: str
    asset_lookup_status: str | None = None
    asset_id: str | None = None
    duty_lookup_status: str | None = None
    material_stock_status: str | None = None
    route_status: str | None = None
    routing_team_id: str | None = None
    queue_reason: str | None = None
    exception_type: str | None = None
    warnings: tuple[str, ...] | None = None


class TicketFixture(Frozen):
    raw: RawTicket
    flow: Literal["DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4", "REGRESSION"]
    purpose: str
    bptn: BptnInput | None = None
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
