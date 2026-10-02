"""Priority from fixed rules (CR-BPTN-03 §7). Separate from the risk level: an emergency is sorted first on its own.

First matching rule wins, then the +1 adjustments (capped at HIGH). The engine never overwrites a priority that a
person set (`priority_source=HUMAN_OVERRIDE`).
"""

from collections.abc import Sequence
from dataclasses import dataclass

from src.maintenance.enums import Priority, RiskLevel, ServiceCategory
from src.maintenance.safety import clean, vi_any

# Every area the location rules recognise is a shared passage, plus emergency exits (PRI-H1)
COMMON_PASSAGES = ("Hành lang", "Sảnh thang máy", "Sảnh chính", "Cầu thang bộ", "Hầm xe")
_EXIT = vi_any([r"\blối thoát hiểm\b", r"\blối đi\b"])
_OBSTRUCTING = vi_any(
    [
        r"\b(?:chắn|cản|chặn|lấp) (?:hết )?(?:lối|đường)\b",
        r"\btrơn (?:trượt|trợt)\b",
        r"\bdễ (?:trượt|ngã)\b",
        r"\btràn (?:ra )?(?:lối|đường) đi\b",
        r"\btrượt ngã\b",
    ]
)
_AFFECTS_USE = vi_any(
    [
        r"\bẩm ướt\b",
        r"\bướt\b",
        r"\bvũng nước\b",
        r"\bđổ nước\b",
        r"\btràn\b",
        r"\bnhiều rác\b",
        r"\brác vương vãi\b",
        r"\bmùi\b",
        r"\bhôi\b",
        r"\bdính\b",
        r"\bbãi nôn\b",
        r"\bchất thải\b",
    ]
)

_ORDER = [Priority.LOW, Priority.MEDIUM, Priority.HIGH]
SORT_RANK = {Priority.HIGH: 0, Priority.MEDIUM: 1, None: 1, Priority.LOW: 2}


@dataclass(frozen=True)
class PriorityDecision:
    priority: Priority
    rule_id: str
    reason: str


def decide(
    category: ServiceCategory | None,
    location: str | None,
    text: str,
    *,
    duplicate_count: int,
    raise_at: int,
    amplifiers: Sequence[str],
) -> PriorityDecision:
    cleaned = clean(text)
    area = location.rsplit(" / ", 1)[-1] if location else None
    passage = area in COMMON_PASSAGES or bool(_EXIT.search(cleaned))
    if category is None or location is None:
        base, rule_id, reason = Priority.MEDIUM, "PRI-D0", "Chưa rõ loại việc hoặc vị trí: mặc định"
    elif category == ServiceCategory.KY_THUAT:
        if passage:
            base, rule_id, reason = Priority.HIGH, "PRI-H1", f"Đèn ở lối đi chung ({area})"
        else:
            base, rule_id, reason = Priority.MEDIUM, "PRI-M1", "Đèn ở vị trí khác lối đi chung"
    elif _OBSTRUCTING.search(cleaned):
        base, rule_id, reason = Priority.HIGH, "PRI-H2", "Vệ sinh cản trở lối đi"
    elif _AFFECTS_USE.search(cleaned):
        base, rule_id, reason = Priority.MEDIUM, "PRI-M2", "Vệ sinh ảnh hưởng sử dụng, không cản lối đi"
    else:
        base, rule_id, reason = Priority.LOW, "PRI-L1", "Vệ sinh chưa ảnh hưởng trực tiếp"

    level = _ORDER.index(base)
    if duplicate_count >= raise_at:
        level += 1
        reason += f"; PRI-U1: {duplicate_count} báo trùng (ngưỡng {raise_at})"
    if "vulnerable_person" in amplifiers:
        level += 1
        reason += "; PRI-U2: có người dễ tổn thương"
    return PriorityDecision(_ORDER[min(level, 2)], rule_id, reason)


def sort_key(risk_level: RiskLevel | None, priority: Priority | None, created_at: str) -> tuple:
    """CR-BPTN-03 §7: emergency first, then priority (unset counts as MEDIUM), then oldest first."""
    return (0 if risk_level == RiskLevel.EMERGENCY else 1, SORT_RANK[priority], created_at)
