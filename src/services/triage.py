"""Intake step run right after a ticket is created: safety rules, extraction, location match."""

from sqlmodel import Session, select

from src.config import get_settings
from src.models.entities import EscalationReason, Location, Playbook, Ticket, TicketStatus
from src.services import audit, intake_llm
from src.services.safety import detect_safety_flags


def triage(session: Session, ticket: Ticket) -> None:
    flags = detect_safety_flags(ticket.text)
    ticket.safety_flags = flags
    extractor = "llm" if get_settings().llm_mode == "openai" else "mock"

    try:
        extraction = intake_llm.extract(ticket.text)
    except Exception as exc:  # LLM/network failure must not lose the ticket
        audit.log(session, ticket, "intake_failed", extractor, detail={"error": str(exc)[:500]})
        if flags:
            audit.escalate(session, ticket, EscalationReason.SAFETY_RISK, _safety_detail(flags), "system")
        else:
            audit.escalate(
                session, ticket, EscalationReason.INTAKE_FAILED, "Không phân tích được nội dung ticket", "system"
            )
        return

    match = intake_llm.match_location(extraction, list(session.exec(select(Location)).all()))
    ticket.category = extraction.category
    ticket.summary = extraction.summary
    ticket.urgency = "high" if flags else extraction.urgency
    ticket.building = extraction.building
    ticket.floor = extraction.floor
    ticket.area = extraction.area
    ticket.unit = extraction.unit
    if match.location_id:
        apply_location(ticket, session.get(Location, match.location_id))
    session.add(ticket)
    audit.log(
        session,
        ticket,
        "intake_extracted",
        extractor,
        detail={
            "extraction": extraction.model_dump(),
            "location_candidates": match.candidates,
            "safety_flags": flags,
        },
    )

    # Priority: safety > no playbook > ambiguous location
    if flags:
        audit.escalate(session, ticket, EscalationReason.SAFETY_RISK, _safety_detail(flags), "system")
    elif session.get(Playbook, extraction.category) is None:
        audit.escalate(
            session,
            ticket,
            EscalationReason.UNKNOWN_CATEGORY,
            f"Chưa có playbook cho loại sự cố '{extraction.category}'",
            "system",
        )
    elif match.location_id is None:
        audit.escalate(
            session,
            ticket,
            EscalationReason.AMBIGUOUS_LOCATION,
            f"Không xác định được một vị trí duy nhất ({len(match.candidates)} vị trí có thể khớp)",
            "system",
        )
    else:
        audit.change_status(session, ticket, TicketStatus.TRIAGED, "system", "triaged")


def apply_location(ticket: Ticket, location: Location) -> None:
    ticket.location_id = location.id
    ticket.building = location.building
    ticket.floor = location.floor
    ticket.area = location.area
    ticket.unit = location.unit


def _safety_detail(flags: list[str]) -> str:
    return f"Nghi sự cố an toàn ({', '.join(flags)}): chuyển BQL ngay, không tạo work order"
