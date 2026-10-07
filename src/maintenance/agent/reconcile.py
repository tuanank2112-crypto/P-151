"""Agent versus rules: the closed disagreement table and the final record (plan 06, SPEC-P01 sections 6 and 7).

The table G-1..G-9 is CLOSED: a new row is a SPEC change. SERIOUS rows stop the ticket at PENDING_REVIEW (the
engine's job, SPEC-P02); MINOR rows are notes. Pure functions: no IO, no model, no clock except the one passed in.
"""

from collections.abc import Callable
from datetime import datetime

from src.maintenance import safety
from src.maintenance.catalog import Catalog, Lexicon
from src.maintenance.enums import RiskLevel, ServiceCategory
from src.maintenance.priority import propose_priority

from .baseline import RuleView
from .inputs import DecisionInput
from .prompt import PROMPT_VERSION
from .schema import AgentDecision, AgentDecisionRecord, Disagreement
from .validate import Validated, merge_agent_safety

_LEVEL_ORDER = {"NONE": 0, "UNCLEAR": 1, "EMERGENCY": 2}


def _note(text: str) -> str:
    return text[:300]


def _field_of(path: str) -> str:
    """Disagreement field for a rejected path (G-8)."""
    if path.startswith("location"):
        return "location"
    if path.endswith(".asset_id"):
        return "asset"
    if path.endswith(".duplicate_of"):
        return "duplicate"
    if path.endswith(".department_id"):
        return "department"
    if path.endswith(".materials"):
        return "materials"
    if path.endswith(".priority"):
        return "priority"
    if path == "ask_fields":
        return "next_step"
    return "category"  # a whole job was dropped


def disagreements(
    decision: AgentDecision,
    data: DecisionInput,
    rv: RuleView,
    validated: Validated,
    catalog: Catalog,
    lexicon: Lexicon,
) -> list[Disagreement]:
    out: list[Disagreement] = []
    lock = data.locks.category or data.pinned_category
    jobs = [decision.jobs[i] for i in validated.valid_job_indexes]
    agent_categories = {ServiceCategory(j.category) for j in jobs}
    rule_categories = rv.categories
    rule_text = ",".join(sorted(c.value for c in rule_categories)) or None

    # G-1: a valid job whose category the rules see no sign of (and nobody chose it)
    if lock is None:
        for job in jobs:
            if ServiceCategory(job.category) not in rule_categories:
                out.append(
                    Disagreement(
                        field="category",
                        severity="SERIOUS",
                        rule_value=rule_text,
                        agent_value=job.category,
                        note=_note(
                            f"Agent chọn {job.category} nhưng luật không thấy dấu hiệu loại việc này: {job.reason}"
                        ),
                    )
                )

    # G-2: both locations complete and different, no BPTN location lock
    if data.locks.location is None and rv.location is not None and validated.location is not None:
        if rv.location != validated.location:
            out.append(
                Disagreement(
                    field="location",
                    severity="SERIOUS",
                    rule_value=rv.location,
                    agent_value=validated.location,
                    note=_note("Vị trí Agent và vị trí luật khác nhau"),
                )
            )

    # G-3: electrical hazard seen by the rules, Agent has a job and the final safety is NONE
    if rv.electrical_hazard and jobs and validated.safety.risk_level == RiskLevel.NONE:
        out.append(
            Disagreement(
                field="electrical_hazard",
                severity="SERIOUS",
                rule_value="electrical_hazard",
                agent_value=None,
                note=_note(
                    "Luật thấy chất lỏng/dây điện ở thiết bị điện nhưng Agent coi là việc thường và an toàn NONE"
                ),
            )
        )

    # G-4: Agent dropped a category the rules see (not when a person or a split already fixed the category)
    if lock is None and agent_categories < rule_categories:
        out.append(
            Disagreement(
                field="category",
                severity="MINOR",
                rule_value=rule_text,
                agent_value=",".join(sorted(c.value for c in agent_categories)) or None,
                note=_note("Agent bỏ bớt loại việc mà luật thấy (nguyên nhân/hệ quả hoặc không chắc)"),
            )
        )

    # G-5: only the Agent has a complete location
    if rv.location is None and validated.location is not None:
        out.append(
            Disagreement(
                field="location",
                severity="MINOR",
                rule_value=None,
                agent_value=validated.location,
                note=_note("Luật không đọc được vị trí; dùng vị trí Agent"),
            )
        )

    # G-6: the Agent's own safety level is lower than the rules'
    declared = decision.safety.risk_level
    if data.safety_text.strip() and _LEVEL_ORDER[declared] < _LEVEL_ORDER[rv.safety.risk_level.value]:
        out.append(
            Disagreement(
                field="safety",
                severity="MINOR",
                rule_value=rv.safety.risk_level.value,
                agent_value=declared,
                note=_note(f"Agent cho rằng {declared}: {decision.safety.reason}"),
            )
        )

    # G-7: priority differs from the rules for the same category (a rejected priority is G-8 instead)
    final_location = data.locks.location or validated.location or rv.location
    for index in validated.valid_job_indexes:
        job = decision.jobs[index]
        if f"jobs[{index}].priority" in validated.rejected:
            continue
        proposal = propose_priority(ServiceCategory(job.category), final_location, data.report_text, lexicon.priority)
        if proposal.priority.value != job.priority:
            out.append(
                Disagreement(
                    field="priority",
                    severity="MINOR",
                    rule_value=f"{proposal.priority.value} ({proposal.rule_id})",
                    agent_value=f"{job.priority} ({job.priority_rule_id})",
                    note=_note(f"Agent chọn ưu tiên khác luật: {job.priority_reason}"),
                )
            )

    # G-8: fields the validation dropped (the engine uses the rule value)
    for path in validated.rejected:
        out.append(
            Disagreement(
                field=_field_of(path),
                severity="MINOR",
                rule_value=None,
                agent_value=None,
                note=_note(f"Trường {path} của Agent không hợp lệ; dùng giá trị của luật"),
            )
        )

    # G-9: next_step that does not match whether the place is known
    place_known = final_location is not None
    if (decision.next_step == "PROCEED" and not place_known) or (decision.next_step == "ASK_RESIDENT" and place_known):
        out.append(
            Disagreement(
                field="next_step",
                severity="MINOR",
                rule_value="vị trí đủ" if place_known else "vị trí còn thiếu",
                agent_value=decision.next_step,
                note=_note("Bước tiếp theo của Agent không khớp tình trạng vị trí; engine theo vị trí thực"),
            )
        )
    return out


def reconcile(
    decision: AgentDecision,
    data: DecisionInput,
    rv: RuleView,
    validated: Validated,
    *,
    catalog: Catalog,
    lexicon: Lexicon,
    model: str,
    latency_ms: float,
    ai_log_id: str | None,
    clock: Callable[[], datetime],
) -> AgentDecisionRecord:
    """The record of an Agent decision (SPEC-P01 section 7)."""
    return AgentDecisionRecord(
        source="AGENT",
        model=model,
        fingerprint=data.fingerprint,
        safety_fingerprint=data.safety_fingerprint,
        decided_at=clock(),
        latency_ms=latency_ms,
        ai_log_id=ai_log_id,
        decision=decision,
        rejected=list(validated.rejected),
        disagreements=disagreements(decision, data, rv, validated, catalog, lexicon),
        candidate_ids=[c.ticket_id for c in data.duplicate_candidates],
        rule_categories=sorted(rv.categories),
        rule_location=rv.location,
        rule_risk_level=rv.safety.risk_level,
        agent_risk_level=validated.agent_risk_level,
        agent_location=validated.location,
        agent_missing_parts=list(validated.missing_parts),
        valid_job_indexes=list(validated.valid_job_indexes),
        prompt_version=PROMPT_VERSION,
    )


def rule_record(
    data: DecisionInput,
    rv: RuleView,
    *,
    source: str,
    reason: str | None,
    clock: Callable[[], datetime],
    latency_ms: float = 0.0,
    ai_log_id: str | None = None,
) -> AgentDecisionRecord:
    """A record with no Agent decision: FALLBACK_RULE (with a reason) or SKIPPED_RULE_EMERGENCY. The `rule_*`
    fields are filled so the engine can apply the rules from the record alone."""
    return AgentDecisionRecord(
        source=source,
        model="rules",
        fingerprint=data.fingerprint,
        safety_fingerprint=data.safety_fingerprint,
        decided_at=clock(),
        latency_ms=latency_ms,
        ai_log_id=ai_log_id,
        fallback_reason=reason,
        decision=None,
        candidate_ids=[c.ticket_id for c in data.duplicate_candidates],
        rule_categories=sorted(rv.categories),
        rule_location=rv.location,
        rule_risk_level=rv.safety.risk_level,
        prompt_version=PROMPT_VERSION if ai_log_id else "",
    )


def safety_for(record: AgentDecisionRecord, safety_text: str, lexicon: Lexicon, model: str) -> safety.SafetyAssessment:
    """Rebuild the safety result of a record (rules + valid Agent signals) the same way the decision did, with no
    model call. A record with no decision is the plain rule assessment."""
    rule = safety.assess(safety_text, lexicon.safety)
    if record.decision is None:
        return rule
    merged, _ = merge_agent_safety(rule, record.decision, safety_text, lexicon, model)
    return merged
