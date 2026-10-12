"""Input the engine builds for the Agent (plan 06, 01-CONTRACTS section 3.2).

Pure data: imports `models.LockedFields` and enums only, never the engine. Everything here is read-only for the
Agent; `excerpt` is untrusted resident text.
"""

from pydantic import BaseModel, ConfigDict, Field

from src.maintenance.enums import ServiceCategory, TicketStatus
from src.maintenance.models import LockedFields


class DuplicateCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    ticket_id: str
    category: ServiceCategory  # _category(candidate), always present
    location: str  # effective_location(candidate), always the full three parts
    created_at: str
    status: TicketStatus
    excerpt: str = Field(max_length=200)  # first 200 chars of _content(candidate): DATA, not trusted


class AssetCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    asset_id: str
    area: str  # one asset per area (plan 14), compared with rules.location_area(location)


class DecisionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    ticket_id: str  # "PENDING-FOLLOWUP" for a follow-up ticket that has no number yet (P07 §6)
    created_at: str
    report_text: str  # engine._content(work): original + additions that are NOT merged_from
    location_text: str  # engine._location_text(work)
    safety_text: str  # engine._safety_scope_text(work)
    locks: LockedFields
    pinned_category: ServiceCategory | None  # split_category (split child / split original)
    follow_up_of: str | None
    duplicate_candidates: list[DuplicateCandidate] = Field(max_length=8)
    asset_candidates: list[AssetCandidate]
    fingerprint: str  # P02 §4.1
    safety_fingerprint: str
