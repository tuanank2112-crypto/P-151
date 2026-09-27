"""Technician notifications. Zalo Bot is not integrated yet; this is where it plugs in."""

from src.models.entities import WorkOrder


def notify_technician(work_order: WorkOrder) -> dict[str, str]:
    """Send the work order to the technician. Returns what happened, for the audit log."""
    # TODO: send via Zalo Bot using settings.zalo_bot_token and the shift's zalo_chat_id
    return {"channel": "none", "status": "skipped", "reason": "Zalo Bot chưa tích hợp"}
