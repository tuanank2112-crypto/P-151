"""Priority (CR-BPTN-03 §7): fixed rules, top to bottom, the first match wins. Pure functions, no IO.

Priority is separate from `risk_level`: it is only computed at step 3, so a tier-1 or tier-2 ticket (stopped at 2b)
has none until a person has cleared it. PRI-U1 (duplicate count) and PRI-U2 (vulnerable person) are P1.
"""

from dataclasses import dataclass

from src.maintenance.catalog import PriorityLexicon, compile_pattern
from src.maintenance.enums import Priority, ServiceCategory
from src.maintenance.safety import normalize_with_map


@dataclass(frozen=True)
class PriorityProposal:
    priority: Priority
    rule_id: str  # "PRI-H1" | "PRI-H2" | "PRI-M1" | "PRI-M2" | "PRI-L1" | "PRI-D0"
    reason: str  # one Vietnamese sentence: the rule and its evidence (area, or the first matching phrase)


def _first_match(patterns: tuple[str, ...], norm: str) -> str | None:
    """The first phrase (in lexicon order) found in the normalised text, as the evidence."""
    for pattern in patterns:
        found = compile_pattern(pattern).search(norm)
        if found:
            return found.group(0)
    return None


def propose_priority(
    category: ServiceCategory | None, location: str | None, text: str, lexicon: PriorityLexicon
) -> PriorityProposal:
    """CR-03 §7: PRI-D0 / H1 / M1 for lighting by area, PRI-H2 / M2 / L1 for cleaning by the report's wording."""
    if location is None or category not in (ServiceCategory.KY_THUAT, ServiceCategory.VE_SINH):
        return PriorityProposal(Priority.MEDIUM, "PRI-D0", "PRI-D0: chưa rõ vị trí hoặc loại việc; mặc định MEDIUM")
    if category == ServiceCategory.KY_THUAT:
        area = location.split(" / ")[-1]
        if area in lexicon.high_areas:
            return PriorityProposal(Priority.HIGH, "PRI-H1", f"PRI-H1: đèn tại lối đi chung ({area})")
        return PriorityProposal(Priority.MEDIUM, "PRI-M1", f"PRI-M1: đèn tại khu vực khác ({area})")
    norm = normalize_with_map(text)[0]
    evidence = _first_match(lexicon.obstruction_patterns, norm)
    if evidence:
        return PriorityProposal(Priority.HIGH, "PRI-H2", f"PRI-H2: cản trở lối đi ('{evidence}')")
    evidence = _first_match(lexicon.usage_impact_patterns, norm)
    if evidence:
        return PriorityProposal(Priority.MEDIUM, "PRI-M2", f"PRI-M2: ảnh hưởng sử dụng ('{evidence}')")
    return PriorityProposal(Priority.LOW, "PRI-L1", "PRI-L1: chưa ảnh hưởng trực tiếp")
