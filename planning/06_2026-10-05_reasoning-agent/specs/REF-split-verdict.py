"""REF prototype (plan 06, SPEC-P05 §2): pure verdict "this report holds two independent jobs at one place".

Architect prototype, NOT product code: it shows the SPEC-P05 rules are implementable with the patterns that already
live in src/maintenance/rules.py, and it measures them on the acceptance lists of TESTING-ACCEPTANCE §3.3 / §4.1.
The product function is `rules.split_verdict(description, buildings)` (SPEC-P05 §2); the worker may write it differently, but it MUST reach
the same verdict on every sentence below and on every location variant (TESTING §3.3).

Run from the repo root:
    PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-split-verdict.py
    PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-split-verdict.py --variants
Exit 0 only when every list sentence gets its expected verdict (and, with --variants, the mixed corpus matches
EXPECTED_VARIANT_SPLITS and no single-job corpus variant is split).
"""

import argparse
import re
import sys
import unicodedata

from src.maintenance.catalog import load_catalog
from src.maintenance.enums import ServiceCategory
from src.maintenance.rules import (
    AREA_PATTERNS,
    CLEANING_PATTERNS,
    COMMON_AREA_PATTERNS,
    ELECTRICAL_HAZARD_PATTERNS,
    FLOOR_PATTERN,
    LIGHTING_PATTERNS,
    LUMINAIRE,
    LUMINAIRE_LOST,
    NOT_WORKING_PATTERNS,
    OUTSIDE_PATTERNS,
    PRIVATE_LAMP_PATTERNS,
    SOFT_CLEANING_PATTERNS,
    TUBE_LAMP,
    UNACCENTED_LAMP,
    _any,
    _building_pattern,
    _classification_text,
    _residence_spans,
    classify,
    extract_location,
    normalize,
)

BUILDINGS = load_catalog().site.buildings  # Ocean Park pilot: ("S1", "S2") on develop 82f01f0
BUILDING_PATTERN = _building_pattern(BUILDINGS)

# SPEC-P05 §2.2 R-S3: words that make one job the cause or effect of the other, or the report unsure.
CAUSAL_ACCENTED = ("nên", "vì", "bởi", "do", "khiến", "làm cho", "dẫn đến", "gây ra", "không thấy", "mảnh vỡ", "mảnh kính")
HEDGE_ACCENTED = ("hình như", "có vẻ", "không biết", "không rõ", "chắc là", "có lẽ", "nghi là", "hay là", "hoặc")
CAUSAL_FOLDED = ("nen", "vi", "boi", "do", "khien", "lam cho", "dan den", "gay ra", "khong thay", "manh vo", "manh kinh")
HEDGE_FOLDED = ("hinh nhu", "co ve", "khong biet", "khong ro", "chac la", "co le", "nghi la", "hay la", "hoac")


def _has_phrase(text: str, phrases: tuple[str, ...]) -> str | None:
    for phrase in phrases:
        if re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text):
            return phrase
    return None


def _ascii_only(text: str) -> bool:
    folded = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    return all(unicodedata.category(c) != "Mn" for c in folded)


def location_mentions(description: str) -> tuple[set, set, set]:
    """Distinct area labels, floors and buildings outside residence clauses; "tầng hầm B1" is a floor, not an area."""
    text = normalize(description.replace("\n", ". "))
    areas = [m for pattern, _ in AREA_PATTERNS for m in re.finditer(pattern, text)]
    spans = _residence_spans(text, areas)

    def outside(m):
        return not any(s <= m.start() < e for s, e in spans)

    floor_matches = [m for m in re.finditer(FLOOR_PATTERN, text) if outside(m)]
    floor_spans = [m.span() for m in floor_matches]

    def in_floor(m):
        return any(a <= m.start() and m.end() <= b for a, b in floor_spans)

    labels = {label for pattern, label in AREA_PATTERNS for m in re.finditer(pattern, text) if outside(m) and not in_floor(m)}
    floors = {m.group(1).lstrip("0") or "0" for m in floor_matches}
    buildings = {m.group(1).replace(" ", "-") for m in re.finditer(BUILDING_PATTERN, text) if outside(m)}
    return labels, floors, buildings


def split_verdict(description: str) -> tuple[tuple[ServiceCategory, ...], str]:
    text = _classification_text(description)
    if _any(ELECTRICAL_HAZARD_PATTERNS, text):
        return (), "electrical-hazard"
    in_common_area = _any(COMMON_AREA_PATTERNS, text)
    cleaning = _any(CLEANING_PATTERNS, text) or (in_common_area and _any(SOFT_CLEANING_PATTERNS, text))
    lit_subject = _any(LIGHTING_PATTERNS, text) or (
        in_common_area and _any([LUMINAIRE, UNACCENTED_LAMP, LUMINAIRE_LOST, TUBE_LAMP], text)
    )
    not_common_lamp = _any(PRIVATE_LAMP_PATTERNS, text) or _any(OUTSIDE_PATTERNS, text)
    lighting = bool(lit_subject) and _any(NOT_WORKING_PATTERNS, text) and not not_common_lamp
    if not (cleaning and lighting):
        return (), "not-both"
    raw = unicodedata.normalize("NFC", description).lower()
    folded = normalize(description)
    for pattern in [p for p, _ in AREA_PATTERNS] + [FLOOR_PATTERN, BUILDING_PATTERN]:
        folded = re.sub(pattern, " ", folded)  # "bai do xe" is a place, not the cause word "do"
    if _ascii_only(description):
        hit = _has_phrase(folded, CAUSAL_FOLDED) or _has_phrase(folded, HEDGE_FOLDED)
    else:
        hit = _has_phrase(raw, CAUSAL_ACCENTED) or _has_phrase(raw, HEDGE_ACCENTED)
    if hit:
        return (), f"marker:{hit}"
    if "?" in description:
        return (), "question"
    labels, floors, buildings = location_mentions(description)
    if len(labels) > 1 or len(floors) > 1 or len(buildings) > 1:
        return (), "two-places"
    return (ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT), "split"


MUST_SPLIT = [
    "Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng",
    "Sảnh thang máy tầng 2 tòa S2 có bãi nôn chưa dọn, bóng đèn thì bị cháy",
    "Cầu thang bộ tầng 6 tòa S1 bụi bẩn quá, đèn chập chờn",
    "Tòa S2 / Tầng 4 / Hành lang: rác vương vãi và đèn hỏng",
    "Hầm B1 tòa S1 nước đọng thành vũng, đèn tắt hết",
    "Phòng rác tầng 5 tòa S2 đầy tràn, đèn phòng rác không sáng",
    "Sân chơi tầng trệt tòa S1 có phân chó, đèn sân chơi bị hư",
    "Lối đi tầng 5 tòa S2 dầu mỡ đổ loang, đèn thì nhấp nháy",
    "Hành lang tầng 7 tòa S2 mạng nhện bám đầy, bóng đèn cũng hỏng luôn",
    "Sảnh chính tòa S1 sàn dơ quá, mấy bóng đèn bị vỡ",
    "hanh lang tang 3 toa S1 nhieu rac, den khong sang",
    "Tầng hầm B1 tòa S1, bãi đỗ xe: rác chất đống, đèn tắt mấy hôm rồi",
    "Cầu thang bộ tầng 9 tòa S2 có vỏ chai vứt bừa, đèn cầu thang không lên",
    "Hành lang tầng 4 tòa S1: đèn chập chờn cả tuần, sàn thì đầy rác",
    "Sảnh thang máy tầng 5 tòa S1 vừa có rác vừa có đèn không sáng",
    "Hành lang tầng 3 tòa S2 có nước tiểu khai nồng, bóng tuýp chết rồi",
    "Lối thoát hiểm tầng 9 tòa S2 bụi bám dày, đèn exit không sáng",
    "Tòa S1 tầng 12 sân thượng: lá cây rụng đầy, đèn sân thượng hỏng",
    "Hành lang tầng 2 tòa S2 có bãi nôn và bóng đèn bị cháy",
    "Sảnh chính tòa S2: cần vệ sinh sàn và thay bóng đèn đã cháy",
    "Hầm xe tầng B2 tòa S1 đất cát vương vãi, đèn hầm không sáng",
    "Hành lang tầng 8 tòa S1 sơn đổ ra sàn chưa ai lau, đèn thì tắt",
    "Cầu thang bộ tầng 2 tòa S2 có phân chim bám đầy lan can, đèn cầu thang chớp tắt liên tục",
    "Sảnh thang máy tầng 3 tòa S2 mùi hôi nồng nặc, bóng đèn hỏng",
    "Hành lang tầng 10 tòa S1 thùng rác đầy tràn ra ngoài, đèn hành lang bị hư",
    "Bãi đỗ xe tầng hầm B1 tòa S1 nhiều rác, đèn cũng hư mấy bóng",
    "Hanh lang tang 6 toa S2 ban qua, den chap chon",
    "Sảnh chính tòa S2: kính cửa bẩn, bám bụi; đèn sảnh không sáng",
    "Em ở căn 1203 tòa S2, báo giúp hành lang tầng 4 tòa S2 có rác và đèn không sáng",
    "Hành lang tầng 3 tòa S1: bã kẹo cao su dính đầy sàn, đèn cũng tắt hết",
    "Toà S1 hành lang tầng 03: rác chất đống, đèn hỏng",
    "Lối đi tầng 5 tòa S2 có giấy vụn vương vãi, đèn thì sáng yếu lắm",
]

MUST_NOT_SPLIT = [
    "Đèn hành lang tầng 3 tòa S1 hỏng nên không thấy rác mà dọn",
    "Hành lang tầng 3 tòa S1 tối om vì đèn hỏng, đi vấp phải rác",
    "Sảnh thang máy tầng 2 tòa S2 đèn tắt nên lao công không dọn rác được",
    "Do đèn cầu thang bộ tầng 6 tòa S1 không sáng mà rác ở đó không ai thấy để dọn",
    "Đèn hành lang tầng 4 tòa S2 hỏng khiến cư dân đá đổ thùng rác",
    "Bóng đèn hành lang tầng 7 tòa S2 vỡ, mảnh vỡ vương vãi khắp sàn",
    "Hành lang tầng 3 tòa S1 hình như có rác, đèn cũng không biết có hỏng không",
    "Sảnh chính tòa S1 có rác hoặc đèn không sáng?",
    "Rác ở hành lang tầng 3 tòa S1, còn đèn sảnh thang máy tầng 5 tòa S1 không sáng",
    "Phòng rác tầng 2 tòa S2 đầy tràn, đèn hành lang tầng 2 tòa S2 hỏng",
    "Hành lang tầng 3 tòa S1 nhiều rác, đèn hành lang tầng 4 tòa S1 cũng hỏng",
    "Hành lang tầng 3 tòa S1 nhiều rác, đèn trong căn hộ tôi cũng hỏng",
    "hanh lang tang 3 toa S1 nuoc ngot do ra san, den hong",
    "Hành lang tầng 3 tòa S1 đèn không sáng",
    "Hành lang tầng 5 tòa S2 nhiều rác quá",
    "Đèn sảnh tầng 2 tòa S2 tắt có lẽ do mất điện, sàn thì bẩn",
    "Hành lang tầng 6 tòa S1 rác nhiều, chắc là đèn cũng hỏng",
    "Hành lang tầng 3 tòa S1 nhiều rác vì bóng đèn hành lang không sáng",
]

# TESTING §3.3 RE-03: verdict on the 36 location variants (18 templates x accented/unaccented) of each mixed corpus sentence
EXPECTED_VARIANT_SPLITS = {
    "Sàn trơn vì nước đọng, đèn lại tối om": 0,  # "vì": cause inside the report, no split (conservative)
    "Dầu mỡ đổ ra sàn, đèn thì chập chờn": 18,  # unaccented "do" may be the cause word: only accented variants split
}


def run_lists() -> int:
    failures = 0
    for text in MUST_SPLIT:
        verdict, why = split_verdict(text)
        ok = bool(verdict) and extract_location(text, BUILDINGS) is not None and classify(text).reason_code == "CATEGORY_UNCLEAR"
        failures += not ok
        if not ok:
            print(f"  SPLIT MISS [{why}] loc={extract_location(text, BUILDINGS)} | {text}")
    for text in MUST_NOT_SPLIT:
        verdict, why = split_verdict(text)
        failures += bool(verdict)
        if verdict:
            print(f"  WRONG SPLIT [{why}] | {text}")
    print(f"MUST_SPLIT={len(MUST_SPLIT)} MUST_NOT_SPLIT={len(MUST_NOT_SPLIT)} FAILURES={failures}")
    return failures


def run_variants() -> int:
    from tests.test_maintenance import test_classify_metamorphic as cm

    failures = 0
    for sentence in cm.MIXED:
        variants = cm.variants(sentence)
        splits = sum(bool(split_verdict(text)[0]) for text, _ in variants)
        want = EXPECTED_VARIANT_SPLITS.get(sentence, len(variants))
        failures += splits != want
        print(f"  {'OK ' if splits == want else 'BAD'} {splits:2d}/{len(variants)} (want {want}) | {sentence}")
    single = [t for s, k in cm.CORPUS if k != "UNCLEAR" for t, _ in [(s, None)] + cm.variants(s) if split_verdict(t)[0]]
    failures += len(single)
    print(f"SINGLE_JOB_VARIANTS_SPLIT={len(single)}")
    print(f"VARIANT_FAILURES={failures}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variants", action="store_true")
    args = parser.parse_args()
    failures = run_lists() + (run_variants() if args.variants else 0)
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
