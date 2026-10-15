"""Hard cases against the Agent's fixed-rule floor (data: data/adversarial_cases.yaml).

Each case lists what a careful reader expects. A case the rules get wrong today carries `known_bug: true` and is
xfail(strict): it stays visible, and turns red the day the bug is fixed so the flag gets removed. Run
`python scripts/eval_hard_cases.py` for the failure table (Case | Difficulty | Text | Wrong at | Expected -> Got).
"""

import unicodedata
from pathlib import Path

import pytest
import yaml

from src.maintenance.catalog import load_lexicon
from src.maintenance.rules import classify, extract_location
from src.maintenance.safety import assess

LEXICON = load_lexicon()
BUILDINGS = ("S1", "S2")  # catalog site.buildings
_YAML = yaml.safe_load((Path(__file__).parent / "data" / "adversarial_cases.yaml").read_text(encoding="utf-8"))["cases"]


def _unicode_cases() -> list[dict]:
    """Typing / encoding tricks that are awkward to write by hand in YAML (u-prefix ids)."""
    base = "Có mùi khét ở hộp đèn hành lang tầng 3 tòa S1"
    smoke = "Khói đen bốc ra từ tủ điện hầm B1 tòa S1"
    tier1 = {"safety": "EMERGENCY"}
    long_tail = ("Hành lang tầng 3 tòa S1 đèn tối. " * 330) + "Có tia lửa ở hộp điện."
    rows = [
        ("u01", "easy", "nfd", unicodedata.normalize("NFD", base), tier1, False),
        ("u02", "medium", "zero-width", base.replace("khét", "kh\u200bét"), tier1, False),
        ("u03", "medium", "soft-hyphen", base.replace("khét", "khé\u00adt"), tier1, False),
        ("u04", "medium", "null-byte", base.replace("mùi", "mùi\x00"), tier1, False),
        ("u05", "medium", "newline-split", base.replace("mùi khét", "mùi\n\tkhét"), tier1, False),
        ("u06", "medium", "repeat-letters", base.replace("khét", "khétttt"), tier1, False),
        ("u07", "hard", "nfd-caps", unicodedata.normalize("NFD", base.upper()), tier1, False),
        ("u08", "hard", "buried-at-end-11k", long_tail, tier1, False),
        ("u09", "hard", "cyrillic-homoglyph", smoke.replace("ó", "\u043e\u0301"), tier1, True),
        ("u10", "hard", "dot-separated", "Có mùi k.h.é.t ở hộp đèn hành lang tầng 3 tòa S1", tier1, True),
        (
            "u11",
            "hard",
            "fullwidth-digits",
            "Đèn hành lang tầng \uff13 tòa \uff33\uff11 không sáng",
            {"location": "Tòa S1 / Tầng 3 / Hành lang"},
            True,
        ),
    ]
    return [
        {"id": i, "difficulty": d, "tag": t, "text": x, "expect": e, **({"known_bug": True} if bug else {})}
        for i, d, t, x, e, bug in rows
    ]


def class_of(text: str) -> str:
    result = classify(text)
    if result.playbook_id == "PB-TEC-01":
        return "TEC"
    if result.playbook_id == "PB-CLN-01":
        return "CLN"
    return "UNCLEAR" if result.reason_code == "CATEGORY_UNCLEAR" else "OUT"


CASES = _YAML + _unicode_cases()


def observe(case: dict) -> dict:
    """What the rules say, for exactly the fields the case expects."""
    text, want = case["text"], case["expect"]
    got: dict = {}
    if "safety" in want:
        got["safety"] = str(assess(text, LEXICON.safety).risk_level.value)
    if "class" in want:
        got["class"] = class_of(text)
    if "location" in want:
        got["location"] = extract_location(text, BUILDINGS)
    if "priority" in want:
        from src.maintenance.priority import propose_priority

        location = extract_location(text, BUILDINGS)
        got["priority"] = str(
            propose_priority(classify(text).service_category, location, text, LEXICON.priority).priority.value
        )
    return got


def mismatches(case: dict) -> dict[str, tuple]:
    """field -> (expected, got) for every field that is not accepted."""
    got = observe(case)
    wrong = {}
    for field, want in case["expect"].items():
        accepted = want if isinstance(want, list) else [want]
        if got[field] not in accepted:
            wrong[field] = (want, got[field])
    return wrong


def _param(case: dict):
    marks = [pytest.mark.xfail(strict=True, reason="known rule bug")] if case.get("known_bug") else []
    return pytest.param(case, id=f"{case['id']}-{case['tag']}", marks=marks)


def test_dataset_shape():
    ids = [c["id"] for c in CASES]
    assert len(ids) == len(set(ids)) >= 50
    assert {c["difficulty"] for c in CASES} == {"easy", "medium", "hard"}
    for c in CASES:
        assert set(c) <= {"id", "difficulty", "tag", "text", "expect", "known_bug"}, c["id"]
        assert set(c["expect"]) <= {"safety", "class", "location", "priority"}, c["id"]


@pytest.mark.parametrize("case", [_param(c) for c in CASES])
def test_hard_case(case):
    wrong = mismatches(case)
    assert not wrong, f"{case['difficulty']} · {case['text']!r}: {wrong}"


def test_tier1_is_never_missed_by_a_hard_case():
    """CR-BPTN-03 section 15: 0 misses at Bac 1. A case expecting EMERGENCY must never come back below it."""
    missed = [
        c["id"] for c in CASES if c["expect"].get("safety") == "EMERGENCY" and observe(c)["safety"] != "EMERGENCY"
    ]
    known = {c["id"] for c in CASES if c.get("known_bug")}
    assert set(missed) <= known, f"unflagged Bac 1 misses: {sorted(set(missed) - known)}"
