"""Team-only route proposal from the simulated duty fixture (Data Contract §5.4, GAP-C-02).

Only answers "which SIM-TEAM-* may this draft be proposed to". It never picks a person inside the team, never
writes to the fixture and never updates capacity: `current_open_ticket_count` is a static fixture value, so
"has capacity" means "the fixture condition holds", not the team's real ability to take work.
"""

from dataclasses import dataclass
from datetime import datetime

from src.maintenance.catalog import Catalog
from src.maintenance.enums import AvailabilityStatus, DutyLookupStatus, ServiceCategory


@dataclass(frozen=True)
class DutyLookup:
    status: DutyLookupStatus
    team_id: str | None  # only set when AVAILABLE
    source_ref: str | None  # SIM-DUTY-* record the decision came from
    reason: str


def lookup_team(catalog: Catalog, service: ServiceCategory, created_at: datetime) -> DutyLookup:
    """Pick the team whose fixture shift contains `created_at` (local time) for this service category."""
    shift = catalog.shift_for(created_at)
    records = sorted(
        (d for d in catalog.duty_availability if d.service_category == service and d.shift_window == shift),
        key=lambda d: d.team_id,
    )
    if not records:
        return DutyLookup(DutyLookupStatus.DUTY_UNKNOWN, None, None, f"Không có nguồn duty cho {service} ở {shift}")
    available = [d for d in records if d.availability_status == AvailabilityStatus.AVAILABLE]
    with_capacity = [d for d in available if d.has_capacity]
    if with_capacity:
        duty = with_capacity[0]
        return DutyLookup(
            DutyLookupStatus.AVAILABLE,
            duty.team_id,
            duty.duty_id,
            f"{duty.team_id} đang trực; capacity mô phỏng đạt điều kiện fixture "
            f"({duty.current_open_ticket_count}/{duty.max_open_ticket_count})",
        )
    unknown = [d for d in records if d.availability_status == AvailabilityStatus.UNKNOWN]
    if unknown:
        return DutyLookup(DutyLookupStatus.DUTY_UNKNOWN, None, unknown[0].duty_id, "Trạng thái trực không xác định")
    if available:
        duty = available[0]
        return DutyLookup(
            DutyLookupStatus.CAPACITY_EXCEEDED,
            None,
            duty.duty_id,
            f"{duty.team_id} đang trực nhưng vượt capacity fixture "
            f"({duty.current_open_ticket_count}/{duty.max_open_ticket_count}); không phải capacity vận hành thật",
        )
    return DutyLookup(
        DutyLookupStatus.NO_AVAILABLE_TEAM, None, records[0].duty_id, f"Không có team {service} trực ở {shift}"
    )
