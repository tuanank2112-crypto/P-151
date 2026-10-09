"""Validation of an Agent decision that already passed the schema (plan 06, SPEC-P01 section 3).

Every field the engine will use is checked against the catalog, the rules and the candidates the engine gave. A wrong
field is NOT an error: its path goes into `rejected` and the engine uses the rule value for it. Pure functions.
"""

import re
import unicodedata
from dataclasses import dataclass, replace

from src.maintenance import rules, safety
from src.maintenance.catalog import Catalog, Lexicon
from src.maintenance.enums import PLAYBOOK_BY_CATEGORY, DetectedBy, RiskLevel, ServiceCategory, SignalStatus
from src.maintenance.models import RiskSignal

from .baseline import RuleView
from .inputs import DecisionInput
from .schema import AgentDecision, LocationDecision

# priority_rule_id -> level, per category (SPEC-P01 3.2); PRI-D0 is the "place or type unknown" default
PRIORITY_RULES: dict[ServiceCategory, dict[str, str]] = {
    ServiceCategory.KY_THUAT: {"PRI-H1": "HIGH", "PRI-M1": "MEDIUM", "PRI-D0": "MEDIUM"},
    ServiceCategory.VE_SINH: {"PRI-H2": "HIGH", "PRI-M2": "MEDIUM", "PRI-L1": "LOW", "PRI-D0": "MEDIUM"},
}
_LEVEL_ORDER = {RiskLevel.NONE: 0, RiskLevel.UNCLEAR: 1, RiskLevel.EMERGENCY: 2}


def _fold(text: str) -> str:
    low = unicodedata.normalize("NFKC", text).lower().replace("đ", "d")
    out = "".join(c for c in unicodedata.normalize("NFD", low) if unicodedata.category(c) != "Mn")
    return " ".join("".join(c if c.isalnum() else " " for c in out).split())


def grounded(quote: str | None, text: str) -> bool:
    """A quote counts when its folded form (NFKC, lowercase, no accents, punctuation as one space) is inside the
    folded text. A quote that folds to nothing ("..", "--") never does: stricter than `safety._grounded` (P08 §2)."""
    folded = _fold(quote or "")
    return bool(folded) and folded in _fold(text)  # ".." folds to "": as empty as no quote


@dataclass(frozen=True)
class Validated:
    location: str | None  # "Tòa X / Tầng N / Khu" when the Agent's location is complete and valid
    missing_parts: tuple[str, ...]  # "building" | "floor" | "area" the Agent's location still lacks
    valid_job_indexes: tuple[int, ...]
    rejected: tuple[str, ...]  # paths the engine must ignore: "location", "jobs[1]", "jobs[0].asset_id", ...
    safety: safety.SafetyAssessment  # rules + valid Agent signals (SPEC-P01 3.3)
    agent_risk_level: RiskLevel  # level derived from the Agent-only signals


# ------------------------------------------------------------------------------------------------ safety (3.3)


def _first_sentence(text: str) -> str:
    stripped = text.strip()
    first = re.split(r"(?<=[.!?\n])\s+", stripped, maxsplit=1)[0].strip()
    return (first or stripped)[:120]


def merge_agent_safety(
    rule: safety.SafetyAssessment, decision: AgentDecision, safety_text: str, lexicon: Lexicon, model: str
) -> tuple[safety.SafetyAssessment, RiskLevel]:
    """Rules + the Agent's signals through `safety.merge_llm` (only raises the level, a bad quote is UNCLEAR).

    Returns (merged assessment, level derived from the signals the Agent added). An empty `safety_text` (already
    confirmed safe, nothing new) ignores the model's safety part altogether."""
    if not safety_text.strip():
        return rule, RiskLevel.NONE
    judgements = [
        safety.SignalJudgement(signal_id=s.signal_id, status=s.status, quote=s.quote) for s in decision.safety.signals
    ]
    merged = safety.merge_llm(
        rule, safety.LLMSafetyAssessment(judgements=judgements), safety_text, lexicon.safety, model_label=model
    )
    agent_only = [s for s in merged.signals if s.detected_by == DetectedBy.LLM]
    agent_level = safety.derive_risk_level(agent_only, lexicon.safety)
    if decision.safety.risk_level == "EMERGENCY" and agent_level == RiskLevel.NONE:
        # the model says danger but gave nothing valid: keep it visible, BPTN looks at it (Tier 2 at least)
        ungrounded = RiskSignal(
            signal_id="S-00",
            status=SignalStatus.UNCLEAR,
            source_quote=_first_sentence(safety_text),
            detected_by=DetectedBy.LLM,
            rule_id="LLM-UNGROUNDED",
        )
        level = merged.risk_level if _LEVEL_ORDER[merged.risk_level] >= 1 else RiskLevel.UNCLEAR
        merged = replace(merged, signals=(*merged.signals, ungrounded), risk_level=level)
        agent_level = RiskLevel.UNCLEAR
    return merged, agent_level


# ------------------------------------------------------------------------------------------------ location (3.2)


def _check_location(
    loc: LocationDecision, location_text: str, catalog: Catalog
) -> tuple[str | None, tuple[str, ...], list[str]]:
    """(complete location or None, missing parts, rejected paths)."""
    has_parts = bool(loc.building or loc.floor or loc.area)
    if (has_parts or loc.quote) and not grounded(loc.quote, location_text):
        return None, ("building", "floor", "area"), ["location"]  # no quote or an invented one voids it (P08 §2)
    rejected: list[str] = []
    codes = "|".join(re.escape(b.upper()) for b in catalog.site.buildings)

    building = None
    if loc.building and loc.building.strip():
        raw = re.sub(r"^(?:TÒA|TOA)\s+", "", unicodedata.normalize("NFC", loc.building).strip().upper())
        if re.fullmatch(rf"(?:{codes})(?:\.\d{{1,2}})?", raw):
            building = raw
        else:
            rejected.append("location.building")

    floor = None
    if loc.floor and loc.floor.strip():
        key = re.sub(r"^(?:tang|lau)\s+", "", rules.normalize(loc.floor)).upper()
        if re.fullmatch(r"B?\d{1,2}|TRET", key):
            floor = rules._floor_label(key)
        else:
            rejected.append("location.floor")

    area = None
    if loc.area and loc.area.strip():
        want = unicodedata.normalize("NFC", loc.area).strip().casefold()
        area = next(
            (label for _, label in rules.AREA_PATTERNS if unicodedata.normalize("NFC", label).casefold() == want), None
        )
        if area is None:
            rejected.append("location.area")

    if floor is None and area in rules.IMPLIED_FLOOR:
        floor = rules.IMPLIED_FLOOR[area]

    parts = (("building", building), ("floor", floor), ("area", area))
    missing = tuple(name for name, value in parts if value is None)
    complete = f"Tòa {building} / Tầng {floor} / {area}" if not missing else None
    return complete, missing, rejected


# ------------------------------------------------------------------------------------------------ the whole decision


def validate(
    decision: AgentDecision, data: DecisionInput, rv: RuleView, catalog: Catalog, lexicon: Lexicon, model: str
) -> Validated:
    rejected: list[str] = []

    agent_location, missing, location_rejected = _check_location(decision.location, data.location_text, catalog)
    rejected += location_rejected
    final_location = data.locks.location or agent_location or rv.location  # lock > Agent > rules

    lock = data.locks.category or data.pinned_category
    policy = catalog.agent_policy
    valid: list[int] = []
    for index, job in enumerate(decision.jobs):
        category = ServiceCategory(job.category)
        if lock is not None and category != lock:
            continue  # a person already chose the category: the Agent's other job is simply not used
        if not grounded(job.quote, data.report_text):
            rejected.append(f"jobs[{index}]")
            continue
        valid.append(index)
        prefix = f"jobs[{index}]"
        playbook = PLAYBOOK_BY_CATEGORY[category][1]

        expected_department = data.locks.department or catalog.playbook_departments[playbook]
        if job.department_id != expected_department.value:
            rejected.append(f"{prefix}.department_id")

        if PRIORITY_RULES[category].get(job.priority_rule_id) != job.priority:
            rejected.append(f"{prefix}.priority")

        if job.duplicate_of is not None:
            candidate = next((c for c in data.duplicate_candidates if c.ticket_id == job.duplicate_of), None)
            if candidate is None or candidate.category != category:
                rejected.append(f"{prefix}.duplicate_of")

        if job.asset_id is not None:
            here = [a for a in data.asset_candidates if a.location == final_location]
            named = next((a for a in data.asset_candidates if a.asset_id == job.asset_id), None)
            if (
                category != ServiceCategory.KY_THUAT
                or named is None
                or final_location is None
                or named.location != final_location
                or len(here) != 1
            ):
                rejected.append(f"{prefix}.asset_id")

        if job.materials:
            allowed = set(catalog.playbook_materials.get(playbook, ()))
            codes = [m.item_code for m in job.materials]
            if (
                not set(codes) <= allowed
                or len(set(codes)) != len(codes)
                or any(m.planned_qty > policy.max_material_qty for m in job.materials)
            ):
                rejected.append(f"{prefix}.materials")

    if decision.ask_fields:
        allowed_asks = {"location", *(f"location_{p}" for p in rv.missing_parts)} if rv.missing_parts else set()
        if not set(decision.ask_fields) <= allowed_asks:
            rejected.append("ask_fields")

    merged, agent_level = merge_agent_safety(rv.safety, decision, data.safety_text, lexicon, model)
    return Validated(
        location=agent_location,
        missing_parts=missing,
        valid_job_indexes=tuple(valid),
        rejected=tuple(rejected),
        safety=merged,
        agent_risk_level=agent_level,
    )
