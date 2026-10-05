"""Resident-facing wording, rendered only from the i18n template file (CR-BPTN-02 §6)."""

from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from src.maintenance.enums import ReasonCode, TicketStatus

I18N_DIR = Path(__file__).resolve().parent / "i18n"


@lru_cache
def _templates(locale: str = "vi") -> dict[str, Any]:
    return yaml.safe_load((I18N_DIR / f"{locale}.yaml").read_text(encoding="utf-8"))


def _fmt(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime(_templates()["datetime_format"])
    return str(value)


def status_label(status: TicketStatus) -> str:
    return _templates()["status_labels"][status]


def field_label(field: str) -> str:
    return _templates()["field_labels"][field]


def public_message(status: TicketStatus, reason: ReasonCode | None = None, **values: Any) -> str:
    """Template for the blocker reason when there is one, otherwise for the status. Missing variables raise."""
    templates = _templates()
    template = templates["reason_messages"][reason] if reason else templates["status_messages"][status]
    return template.format(**{key: _fmt(value) for key, value in values.items()})


def safety_info_message(fields: str) -> str:
    """NEED_INFO raised by the safety layer (T06): only the resident's answer moves it, so the ordinary MISSING_INFO
    wording ("BPTN sẽ liên hệ bạn", f1c6ebf) does not apply (plan 02 Q04)."""
    return _templates()["safety_info_message"].format(fields=fields)


def split_created_message(parent: str) -> str:
    """Public wording of a ticket created by splitting a report that holds two jobs (plan 06 P05)."""
    return _templates()["split_created_message"].format(parent=parent)


def follow_up_created_message(source: str) -> str:
    """Public wording of a follow-up repair ticket created by BQL (plan 06 P07)."""
    return _templates()["follow_up_created_message"].format(source=source)


def overdue_eta_message(eta: datetime) -> str:
    return _templates()["overdue_eta_message"].format(eta=_fmt(eta))
