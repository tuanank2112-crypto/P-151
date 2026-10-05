"""Constants and tiny helpers shared by the engine and the coordination mixins (plan 06 SPEC-P02 §1).

They moved out of `engine.py` so a mixin can use them without importing the engine; `engine.py` imports them back,
so `from src.maintenance.engine import AGENT_ID, ...` keeps working.
"""

from datetime import datetime, timedelta, timezone

from src.maintenance.models import RawTicket

LOCAL_TZ = timezone(timedelta(hours=7))
AGENT_ID = "SIM-ACTOR-AGENT"
SYSTEM_ID = "SIM-ACTOR-SYSTEM"
DEFAULT_RESIDENT_ID = "SIM-ACTOR-RESIDENT-01"


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
