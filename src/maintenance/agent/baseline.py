"""What the fixed rules say about one report (plan 06, SPEC-P01 section 2).

`rule_view` is the floor the Agent is checked against (safety, category evidence, electrical hazard, location, split
verdict). `mirror_decision` writes the rules' decision as a valid `AgentDecision`: the answer of `MirrorClient` and
the reference of the equivalence tests (TESTING 3.5 PAR). Pure functions: no IO, no model.
"""

import re
from dataclasses import dataclass
from datetime import UTC, datetime

from src.maintenance import rules, safety
from src.maintenance.catalog import Catalog, Lexicon
from src.maintenance.enums import (
    PLAYBOOK_BY_CATEGORY,
    SPLIT_PAIR,
    PlaybookId,
    ReasonCode,
    RiskLevel,
    ServiceCategory,
    SignalStatus,
)
from src.maintenance.priority import propose_priority

from .inputs import DecisionInput
from .schema import (
    AgentDecision,
    JobDecision,
    LocationDecision,
    MaterialChoice,
    ReasoningStep,
    SafetyDecision,
)
from .schema import SignalJudgement as SchemaSignal


@dataclass(frozen=True)
class RuleView:
    safety: safety.SafetyAssessment  # safety.assess(data.safety_text, lexicon.safety); "" -> NONE, no signals
    classification: rules.Classification  # rules.classify(data.report_text)
    categories: frozenset[ServiceCategory]  # rules.category_evidence(data.report_text): the set R
    electrical_hazard: bool  # rules.electrical_hazard(data.report_text)
    location: str | None  # data.locks.location, else rules.extract_location(data.location_text, buildings)
    missing_parts: tuple[str, ...]  # rules.missing_location_parts(...) while the location is None
    mentions_subject: bool  # rules.mentions_playbook_subject(data.report_text)
    split: rules.SplitVerdict  # rules.split_verdict(data.report_text, buildings)


def rule_view(data: DecisionInput, catalog: Catalog, lexicon: Lexicon) -> RuleView:
    buildings = catalog.site.buildings
    if data.safety_text.strip():
        assessed = safety.assess(data.safety_text, lexicon.safety)
    else:  # already confirmed safe and nothing new was added
        assessed = safety.SafetyAssessment(RiskLevel.NONE, ())
    location = data.locks.location or rules.extract_location(data.location_text, buildings)
    missing = () if location else tuple(rules.missing_location_parts(data.location_text, buildings))
    return RuleView(
        safety=assessed,
        classification=rules.classify(data.report_text),
        categories=rules.category_evidence(data.report_text),
        electrical_hazard=rules.electrical_hazard(data.report_text),
        location=location,
        missing_parts=missing,
        mentions_subject=rules.mentions_playbook_subject(data.report_text),
        split=rules.split_verdict(data.report_text, buildings),
    )


# ------------------------------------------------------------------------------------------------ mirror decision

_LOCATION = re.compile(r"^Tòa (.+?) / Tầng (.+?) / (.+)$")


def _split_location(location: str | None) -> tuple[str | None, str | None, str | None]:
    found = _LOCATION.match(location or "")
    return (found.group(1), found.group(2), found.group(3)) if found else (None, None, None)


def _created_key(created_at: str, ticket_id: str) -> tuple[datetime, str]:
    """(created_at, ticket_id) like the engine's duplicate rule; an unreadable time sorts first, naive means UTC."""
    try:
        moment = datetime.fromisoformat(created_at)
    except ValueError:
        moment = datetime.min.replace(tzinfo=UTC)
    return (moment if moment.tzinfo else moment.replace(tzinfo=UTC), ticket_id)


def _mirror_categories(data: DecisionInput, rv: RuleView, catalog: Catalog) -> list[ServiceCategory]:
    locked = data.locks.category or data.pinned_category
    if locked is not None and locked != ServiceCategory.UNKNOWN:
        return [locked]
    cls = rv.classification
    if cls.playbook_id is not None:
        return [cls.service_category]
    if (
        cls.reason_code == ReasonCode.CATEGORY_UNCLEAR
        and catalog.agent_policy.auto_split_mixed_reports
        and rv.split.categories == SPLIT_PAIR
        and rv.safety.risk_level == RiskLevel.NONE
    ):
        return list(SPLIT_PAIR)
    return []


def _mirror_job(
    category: ServiceCategory, quote: str, data: DecisionInput, rv: RuleView, catalog: Catalog, lexicon: Lexicon
) -> JobDecision:
    playbook: PlaybookId = PLAYBOOK_BY_CATEGORY[category][1]
    department = data.locks.department or catalog.playbook_departments[playbook]
    proposal = propose_priority(category, rv.location, data.report_text, lexicon.priority)
    duplicates = [
        c
        for c in data.duplicate_candidates
        if rv.location is not None and c.category == category and c.location == rv.location
    ]
    duplicate = min(duplicates, key=lambda c: _created_key(c.created_at, c.ticket_id)) if duplicates else None
    asset_id = None
    if category == ServiceCategory.KY_THUAT and rv.location is not None:
        here = [a for a in data.asset_candidates if a.area == rules.location_area(rv.location)]
        asset_id = here[0].asset_id if len(here) == 1 else None
    materials = [
        MaterialChoice(item_code=m.item_code, planned_qty=m.planned_qty, reason="Vật tư mặc định của playbook")
        for m in catalog.default_materials.get(playbook, ())
        if m.planned_qty > 0
    ]
    return JobDecision(
        category=category.value,
        quote=quote,
        reason="Theo luật cố định: nội dung khớp loại việc này",
        department_id=department.value,
        priority=proposal.priority.value,
        priority_rule_id=proposal.rule_id,
        priority_reason=proposal.reason[:300],
        duplicate_of=duplicate.ticket_id if duplicate else None,
        duplicate_reason=f"Cùng loại việc và vị trí với {duplicate.ticket_id}"
        if duplicate
        else "Không có ứng viên cùng sự việc",
        asset_id=asset_id,
        asset_reason="Asset duy nhất tại vị trí này" if asset_id else "Không có asset duy nhất tại vị trí này",
        materials=materials,
        needs_review=False,
        review_reason=None,
    )


def mirror_decision(data: DecisionInput, catalog: Catalog, lexicon: Lexicon) -> AgentDecision:
    """The decision the fixed rules make, as a valid `AgentDecision` (SPEC-P01 section 2)."""
    rv = rule_view(data, catalog, lexicon)
    quote = data.report_text.strip()[:300]
    categories = _mirror_categories(data, rv, catalog) if len(quote) >= 2 else []
    jobs = [_mirror_job(category, quote, data, rv, catalog, lexicon) for category in categories]

    cls = rv.classification
    if jobs:
        scope = "IN_SCOPE"
    elif cls.reason_code == ReasonCode.CATEGORY_UNCLEAR:
        scope = "UNCLEAR"
    else:
        scope = "OUT_OF_SCOPE"

    ask_fields: list[str] = []
    bptn_reason = None
    if rv.location is not None:
        next_step = "PROCEED" if jobs else "TO_BPTN"
        bptn_reason = None if jobs else ("CATEGORY_UNCLEAR" if scope == "UNCLEAR" else "OUT_OF_SCOPE")
    else:
        ask_fields = ["location"] if len(rv.missing_parts) == 3 else [f"location_{part}" for part in rv.missing_parts]
        clearly_out = (
            data.locks.category is None
            and not rv.mentions_subject
            and cls.playbook_id is None
            and cls.reason_code == ReasonCode.OUT_OF_SCOPE
            and ("location" in ask_fields or "location_area" in ask_fields)
        )
        if clearly_out:  # plan 05 Q05: clearly outside both playbooks, a location is not worth asking for
            next_step, ask_fields, bptn_reason = "TO_BPTN", [], "OUT_OF_SCOPE"
        else:
            next_step = "ASK_RESIDENT"

    building, floor, area = _split_location(rv.location)
    if rv.location is None:
        building, floor, area = rules._location_parts(data.location_text, catalog.site.buildings)
    signals = [
        SchemaSignal(signal_id=s.signal_id, status=s.status.value, quote=s.source_quote[:300])
        for s in rv.safety.signals
        if s.status in (SignalStatus.PRESENT, SignalStatus.UNCLEAR) and len(s.source_quote) >= 2
    ][:10]
    return AgentDecision(
        schema_version="agent-decision/1",
        reasoning=[ReasoningStep(step="KET_LUAN", facts=[], conclusion="Quyết định theo luật cố định")],
        safety=SafetyDecision(
            risk_level=rv.safety.risk_level.value,
            signals=signals,
            reason="Theo luật cố định: mức " + rv.safety.risk_level.value,
        ),
        location=LocationDecision(
            building=building, floor=floor, area=area, quote=None, reason="Vị trí theo luật cố định"
        ),
        scope=scope,
        jobs=jobs,
        next_step=next_step,
        ask_fields=ask_fields,
        bptn_reason=bptn_reason,
        note_for_staff="",
    )
