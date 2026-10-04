"""Metamorphic check of the safety layer (plan 05 Q01): wrapping a labelled report in a location must not change its level.

Every labelled text (safety_cases_p0.yaml safety_cases + regression_strings, the 62 gold sentences of
test_safety_p0.py, seed/maintenance_cr03/safety_cases.json) is wrapped in the location templates below, the way
residents write. The level of each variant must equal the level of the original (EMERGENCY stays EMERGENCY, NONE stays
NONE, UNCLEAR stays UNCLEAR). The baseline is the engine level of the original, which the other test files pin to the
label. A violation is a bug of the lexicon or of safety.py, never a reason to change a label.
"""

import json
from pathlib import Path

import pytest
import yaml

from src.maintenance.catalog import load_lexicon
from src.maintenance.safety import assess
from tests.test_maintenance import test_safety_p0

ROOT = Path(__file__).resolve().parents[2]
DATA = yaml.safe_load((Path(__file__).parent / "data" / "safety_cases_p0.yaml").read_text(encoding="utf-8"))
LEX = load_lexicon().safety

# (template id, template, only for unaccented originals). "{s}" is the original without its final "." or spaces.
TEMPLATES = [
    ("T1", "Tòa SIM-A / Tầng 3 / Hành lang: {s}", False),
    ("T2", "{s} ở hành lang tầng 4 tòa SIM-B", False),
    ("T3", "Tòa SIM-C tầng 2 sảnh thang máy, {s}", False),
    ("T4", "toa SIM-A tang 5 hanh lang {s}", True),
    ("T5", "Block SIM-B lầu 6 phòng rác: {s}", False),
    ("T6", "Tầng hầm B1 tòa SIM-A, bãi đỗ xe: {s}", False),
    ("T7", "{s}. Tòa nhà SIM-C, tầng 7", False),
    ("T8", "Em ở tòa SIM-B, báo: {s}", False),
    ("T9", "Sảnh thang máy tầng 2 tòa SIM-C {s}", False),
    ("T10", "{s}, tòa SIM-A tầng 3", False),
    ("T11", "Bãi đỗ xe tầng hầm B1 tòa SIM-A {s}", False),
    ("T12", "Tòa nhà SIM-C tầng bảy phòng rác {s}", False),
    ("T13", "{s} ở phòng rác tầng 2 tòa SIM-B", False),
    ("T14", "tang 3 toa SIM-B {s}", True),
]


def _unaccented(text: str) -> bool:
    """An original written without any accent (only those get the unaccented location templates)."""
    return text.isascii()


def labelled_texts() -> list[str]:
    """Every labelled text once, in source order."""
    texts = [c["text"] for c in DATA["safety_cases"]] + [c["text"] for c in DATA["regression_strings"]]
    gold = next(m for m in test_safety_p0.test_independent_gold.pytestmark if m.name == "parametrize")
    texts += [text for text, _ in gold.args[1]]
    dataset = json.loads((ROOT / "seed/maintenance_cr03/safety_cases.json").read_text(encoding="utf-8"))
    texts += [c["text"] for c in dataset["cases"]]
    return [t for t in dict.fromkeys(texts) if t.strip()]


def variants(text: str) -> list[tuple[str, str]]:
    core = text.strip().rstrip(".").rstrip()
    return [(tid, tpl.format(s=core)) for tid, tpl, ascii_only in TEMPLATES if not ascii_only or _unaccented(text)]


def violations(lexicon=LEX, template_id: str | None = None) -> tuple[int, list[tuple[str, str, str, str]]]:
    """(number of variants, [(template id, variant, original level, variant level)])."""
    count, bad = 0, []
    for text in labelled_texts():
        want = assess(text, lexicon).risk_level
        for tid, variant in variants(text):
            if template_id is not None and tid != template_id:
                continue
            count += 1
            got = assess(variant, lexicon).risk_level
            if got != want:
                bad.append((tid, variant, want.value, got.value))
    return count, bad


def test_sources_are_loaded():
    texts = labelled_texts()
    assert len(texts) >= 300  # 219 cases + 34 regression strings + 62 gold + the CR-03 dataset, minus duplicates
    assert "Sảnh có khối rác chưa dọn" in texts and "Có mùi khét" in texts


@pytest.mark.parametrize("template_id", [t[0] for t in TEMPLATES])
def test_location_wrapping_keeps_level(template_id):
    count, bad = violations(template_id=template_id)
    assert count > 0
    assert not bad, f"{len(bad)}/{count} variants changed level:\n" + "\n".join(
        f"  {tid} {want}->{got} | {variant!r}" for tid, variant, want, got in bad
    )


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Sảnh thang máy tầng 2 tòa SIM-C có khối rác chưa dọn", "NONE"),
        ("Hành lang tầng 3 tòa SIM-A có khói tỏa ra từ hộp điện", "EMERGENCY"),
        ("khói tỏa khắp hành lang tầng 5 tòa SIM-B", "EMERGENCY"),
    ],
)
def test_plan05_demo_sentences(text, expected):
    assert assess(text, LEX).risk_level.value == expected


if __name__ == "__main__":  # python -m tests.test_maintenance.test_safety_metamorphic: print the counts
    total, found = violations()
    for tid, variant, want, got in found:
        print(f"{tid} {want}->{got} | {variant}")
    print(f"VARIANTS={total} VIOLATIONS={len(found)}")
