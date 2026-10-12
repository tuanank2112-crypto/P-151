"""Priority (CR-BPTN-03 §7): fixed rules, top to bottom, the first match wins. Pure functions, no IO.

Priority is separate from `risk_level`: it is only computed at step 3, so a tier-1 or tier-2 ticket (stopped at 2b)
has none until a person has cleared it. PRI-U1 (duplicate count) and PRI-U2 (vulnerable person) are P1.
"""

from dataclasses import dataclass

from src.maintenance.catalog import PriorityLexicon, compile_pattern
from src.maintenance.enums import Priority, ServiceCategory
from src.maintenance.safety import TextContext, build_context, scope_before


@dataclass(frozen=True)
class PriorityProposal:
    priority: Priority
    rule_id: str  # "PRI-H1" | "PRI-H2" | "PRI-M1" | "PRI-M2" | "PRI-L1" | "PRI-D0"
    reason: str  # one Vietnamese sentence: the rule and its evidence (area, or the first matching phrase)
    adjustments: tuple[str, ...] = ()  # rules applied on top of `rule_id` (plan 06: "PRI-U1"); the rule id stays


_RAISE = {Priority.LOW: Priority.MEDIUM, Priority.MEDIUM: Priority.HIGH}


def apply_duplicate_raise(
    priority: Priority, reason: str, *, duplicate_count: int, raise_at: int
) -> tuple[Priority, str, tuple[str, ...]]:
    """PRI-U1 (CR §7, D-03): at `raise_at` reports taken as the same incident, the level goes up exactly one.

    HIGH is already the top: nothing is raised and nothing is written. Shared by the rule base and the Agent's base.
    """
    if duplicate_count < raise_at or priority not in _RAISE:
        return priority, reason, ()
    note = f"; PRI-U1: {duplicate_count} phản ánh trùng ≥ {raise_at} (+1 mức)"
    return _RAISE[priority], reason + note, ("PRI-U1",)


def _first_match(patterns: tuple[str, ...], ctx: TextContext, lexicon: PriorityLexicon) -> str | None:
    """The first phrase (lexicon order, then position) NOT negated by the shared R1 rule, as the evidence.

    A double negation counts as not negated: the phrase stays (priority leans high).
    """
    for pattern in patterns:
        for found in compile_pattern(pattern).finditer(ctx.norm):
            scope = scope_before(
                ctx,
                found.start(),
                found.start(),
                lexicon.negation_prefixes,
                lexicon.negation_fillers,
                max_fillers=lexicon.scope_max_fillers,
                max_chars=lexicon.scope_max_chars,
            )
            if scope is None or scope.double:
                return found.group(0)
    return None


def propose_priority(
    category: ServiceCategory | None,
    location: str | None,
    text: str,
    lexicon: PriorityLexicon,
    *,
    duplicate_count: int = 0,
    duplicate_raise_at: int | None = None,
) -> PriorityProposal:
    """CR-03 §7: PRI-D0 / H1 / M1 for lighting by area, PRI-H2 / M2 / L1 for cleaning by the report's wording.

    With `duplicate_raise_at` set, PRI-U1 then raises the result one level (see `apply_duplicate_raise`)."""
    proposal = _base_proposal(category, location, text, lexicon)
    if duplicate_raise_at is None:
        return proposal
    priority, reason, adjustments = apply_duplicate_raise(
        proposal.priority, proposal.reason, duplicate_count=duplicate_count, raise_at=duplicate_raise_at
    )
    if not adjustments:
        return proposal
    return PriorityProposal(priority, proposal.rule_id, reason, adjustments)


def _base_proposal(
    category: ServiceCategory | None, location: str | None, text: str, lexicon: PriorityLexicon
) -> PriorityProposal:
    if location is None or category not in (ServiceCategory.KY_THUAT, ServiceCategory.VE_SINH):
        return PriorityProposal(Priority.MEDIUM, "PRI-D0", "PRI-D0: chưa rõ vị trí hoặc loại việc; mặc định MEDIUM")
    if category == ServiceCategory.KY_THUAT:
        area = location.split(" / ")[-1]
        if area in lexicon.high_areas:
            return PriorityProposal(Priority.HIGH, "PRI-H1", f"PRI-H1: đèn tại lối đi chung ({area})")
        return PriorityProposal(Priority.MEDIUM, "PRI-M1", f"PRI-M1: đèn tại khu vực khác ({area})")
    ctx = build_context(text, lexicon.clause_conjunctions)
    evidence = _first_match(lexicon.obstruction_patterns, ctx, lexicon)
    if evidence:
        return PriorityProposal(Priority.HIGH, "PRI-H2", f"PRI-H2: cản trở lối đi ('{evidence}')")
    evidence = _first_match(lexicon.usage_impact_patterns, ctx, lexicon)
    if evidence:
        return PriorityProposal(Priority.MEDIUM, "PRI-M2", f"PRI-M2: ảnh hưởng sử dụng ('{evidence}')")
    return PriorityProposal(Priority.LOW, "PRI-L1", "PRI-L1: chưa ảnh hưởng trực tiếp")
