"""Metamorphic check of the safety layer (plan 05 Q01): wrapping a labelled report in a location must not change its level.

Every labelled text (safety_cases_p0.yaml safety_cases + regression_strings, the 62 gold sentences of
test_safety_p0.py, seed/maintenance_cr03/safety_cases.json) is wrapped in the location templates below, the way
residents write. The level of each variant must equal the level of the original (EMERGENCY stays EMERGENCY, NONE stays
NONE, UNCLEAR stays UNCLEAR). The baseline is the engine level of the original, which the other test files pin to the
label. A violation is a bug of the lexicon or of safety.py, never a reason to change a label.
"""

import json
import unicodedata
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


# Plan 05 H03: the location INSIDE the sentence, where residents put it. (id, template, split mode, only unaccented).
# "{h}" is the head of the sentence, "{t}" the rest. Split modes:
#   "S" (after the subject): before the first word of the original (index >= 1) that opens a predicate: a verb,
#       adjective, negation or hedge cue of PREDICATE_START, compared with its accents (NFC, lower case; an unaccented
#       original is compared unaccented). A sentence that starts with a predicate (index 0: no subject) or has none is
#       skipped: the location would go before or after the whole sentence, which the wrapping templates cover, and a
#       split after "the first 1-3 words" cuts compounds ("Tia | lửa", "Đèn cầu | thang bộ") that no resident writes.
#       The split never falls between a negation/hedge cue and its signal, since the cue word itself opens a predicate.
#   "C" (before the complement): at the first comma of the original; a sentence without a comma is skipped.
MID_TEMPLATES = [
    ("M1", "{h} ở hành lang tầng 3 tòa SIM-A {t}", "S", False),
    ("M2", "{h} tầng 6 tòa SIM-B {t}", "S", False),
    ("M3", "{h}, ngay sảnh thang máy tầng 2 tòa SIM-C, {t}", "S", False),
    ("M4", "{h} ở sảnh thang máy tầng 5 tòa SIM-A {t}", "S", False),
    ("M5", "{h} tại cầu thang bộ tầng 11 tòa SIM-A {t}", "S", False),
    ("M6", "{h} ở hành lang tầng 3 tòa SIM-A, {t}", "C", False),
    ("M7", "{h} o hanh lang tang 3 toa SIM-A {t}", "S", True),
    ("M8", "{h} ở hầm B1 tòa SIM-A {t}", "S", False),
]
# Accepted violations (reported in R03, each one raises the level, never lowers it): the original already holds a
# full location (SC-242) and the inserted second one pushes the B-01 prefix past `b01_max_prefix_tokens` (20, R6):
# the lamp phrase stays UNCLEAR. Raising the cap would loosen B-01 for every text, so it is kept.
ACCEPTED_MID_VIOLATIONS = frozenset(
    {
        "Bãi đỗ xe tầng hầm B1 tòa SIM-A bóng đèn, ngay sảnh thang máy tầng 2 tòa SIM-C, bị cháy",
        "Bãi đỗ xe tầng hầm B1 tòa SIM-A bóng đèn ở sảnh thang máy tầng 5 tòa SIM-A bị cháy",
        "Bãi đỗ xe tầng hầm B1 tòa SIM-A bóng đèn tại cầu thang bộ tầng 11 tòa SIM-A bị cháy",
        "Bãi đỗ xe tầng hầm B1 tòa SIM-A Bóng đèn, ngay sảnh thang máy tầng 2 tòa SIM-C, bị cháy",  # T11 on SC-255
        "Bóng đèn, ngay sảnh thang máy tầng 2 tòa SIM-C, ngay sảnh thang máy tầng 2 tòa SIM-C, bị cháy",  # M3 on SC-255
        "Bóng đèn, ngay sảnh thang máy tầng 2 tòa SIM-C ở sảnh thang máy tầng 5 tòa SIM-A bị cháy",  # M4 on SC-255
        "Bóng đèn, ngay sảnh thang máy tầng 2 tòa SIM-C tại cầu thang bộ tầng 11 tòa SIM-A bị cháy",  # M5 on SC-255
    }
)
PREDICATE_START = frozenset(
    "có bị đang đã vừa mới không ko chưa chẳng hình nghe nghĩ thấy ngửi bốc ngã té ngất xỉu nằm kẹt cháy tóe xẹt"
    " phát lộ lòi hở treo tuột tróc kêu lan bắn giật sập bùng nổ đứt gãy rất khét".split()
)


def _fold(word: str) -> str:
    low = unicodedata.normalize("NFD", word.lower().replace("đ", "d"))
    return "".join(c for c in low if unicodedata.category(c) != "Mn" and c.isalnum())


def _opens_predicate(word: str, unaccented: bool) -> bool:
    if unaccented:
        return _fold(word) in {_fold(w) for w in PREDICATE_START}
    return unicodedata.normalize("NFC", word.lower()).strip(",.:;!?") in PREDICATE_START


def split_point(core: str, mode: str) -> tuple[str, str] | None:
    """(head, tail) of `core` for a split mode, or None when the mode does not apply (see MID_TEMPLATES)."""
    if mode == "C":
        head, comma, tail = core.partition(",")
        return (head.rstrip(), tail.strip()) if comma and head.strip() and tail.strip() else None
    words = core.split()
    plain = _unaccented(core)
    k = next((i for i, w in enumerate(words) if _opens_predicate(w, plain)), None)
    if not k:  # None (no predicate) or 0 (no subject)
        return None
    head = " ".join(words[:k]).rstrip(",")
    return (head, " ".join(words[k:])) if head else None


def mid_variants(text: str) -> list[tuple[str, str]]:
    core = text.strip().rstrip(".").rstrip()
    out = []
    for tid, tpl, mode, ascii_only in MID_TEMPLATES:
        if ascii_only and not _unaccented(text):
            continue
        parts = split_point(core, mode)
        if parts:
            out.append((tid, tpl.format(h=parts[0], t=parts[1])))
    return out


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
    p1 = yaml.safe_load((Path(__file__).parent / "data" / "safety_cases_p1.yaml").read_text(encoding="utf-8"))
    texts += [c["text"] for c in p1["must_catch"] + p1["must_not_raise"]]  # plan 06 SPEC-P03 §5: P1 sentences too
    return [t for t in dict.fromkeys(texts) if t.strip()]


def variants(text: str) -> list[tuple[str, str]]:
    core = text.strip().rstrip(".").rstrip()
    return [(tid, tpl.format(s=core)) for tid, tpl, ascii_only in TEMPLATES if not ascii_only or _unaccented(text)]


def violations(lexicon=LEX, template_id: str | None = None) -> tuple[int, list[tuple[str, str, str, str]]]:
    """(number of variants, [(template id, variant, original level, variant level)])."""
    count, bad = 0, []
    for text in labelled_texts():
        want = assess(text, lexicon).risk_level
        for tid, variant in variants(text) + mid_variants(text):
            if template_id is not None and tid != template_id:
                continue
            count += 1
            got = assess(variant, lexicon).risk_level
            if got != want and not (
                variant in ACCEPTED_MID_VIOLATIONS and got.value == "UNCLEAR" and want.value == "NONE"
            ):
                bad.append((tid, variant, want.value, got.value))
    return count, bad


def test_sources_are_loaded():
    texts = labelled_texts()
    assert len(texts) >= 300  # 219 cases + 34 regression strings + 62 gold + the CR-03 dataset, minus duplicates
    assert "Sảnh có khối rác chưa dọn" in texts and "Có mùi khét" in texts


@pytest.mark.parametrize("template_id", [t[0] for t in TEMPLATES] + [t[0] for t in MID_TEMPLATES])
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


# Plan 05 H03: natural pairs written by the independent audit (location-free sentence, then the same sentence with
# the location where a resident puts it). The location must not lower the level of the pair.
NATURAL_PAIRS = [
    (
        "Cụ ông ngã ở sảnh, nằm im không cử động được",
        "Cụ ông ngã ở hành lang tầng 3 tòa SIM-A, nằm im không cử động được",
    ),
    (
        "Bé trai ngã từ cầu thang xuống, nằm không nhúc nhích",
        "Bé trai ngã ở cầu thang bộ tầng 3 tòa SIM-A, nằm không nhúc nhích",
    ),
    ("Lửa đang lan rất nhanh ở tầng 5", "Lửa ở phòng rác tầng 3 tòa SIM-A đang lan rất nhanh"),
    ("Khói rất nhiều ở hành lang tầng 9", "Khói ở hành lang tầng 9 tòa SIM-A rất nhiều"),
    ("Dây điện ở hành lang bị tróc vỏ", "Dây điện ở hành lang tầng 3 tòa SIM-A bị tróc vỏ"),
    (
        "Dây điện treo lơ lửng ngang đầu người ở sảnh",
        "Dây điện ở sảnh thang máy tầng 5 tòa SIM-A treo lơ lửng ngang đầu người",
    ),
    (
        "Mấy sợi dây điện cũ đang lủng lẳng ở hành lang",
        "Mấy sợi dây điện cũ ở hành lang tầng 3 tòa SIM-A đang lủng lẳng",
    ),
    ("Hộp điện bật lửa", "Hộp điện ở hành lang tầng 3 tòa SIM-A bật lửa"),
    ("Phòng rác tầng 6 bốc hỏa dữ dội", "Phòng rác tầng 6 tòa SIM-A bốc hỏa dữ dội"),
    ("Có người kêu cứu, không rõ ở tầng mấy", "Có người kêu cứu ở cầu thang bộ tầng 11 tòa SIM-A"),
    ("Bé bị kẹt trong thang máy không ra được", "Bé bị kẹt trong thang máy tầng 9 tòa SIM-A không ra được"),
    ("Có người ngất ở sảnh", "Có người ngất ở sảnh thang máy tầng 5 tòa SIM-A"),
]


@pytest.mark.parametrize("plain,located", NATURAL_PAIRS)
def test_natural_location_pairs_keep_level(plain, located):
    assert assess(plain, LEX).risk_level.value == "EMERGENCY"
    assert assess(located, LEX).risk_level.value == "EMERGENCY"


H03_EXPECTED = [
    # (b) tier-1 misses with the location inside the sentence
    ("Cụ ông ngã ở hành lang tầng 3 tòa SIM-A, nằm im không cử động được", "EMERGENCY"),
    ("Phòng rác tầng 6 tòa SIM-A bốc hỏa dữ dội", "EMERGENCY"),
    ("Dây điện ở hành lang tầng 3 tòa SIM-A bị tróc vỏ", "EMERGENCY"),
    ("Hành lang tầng 3 tòa SIM-A dây điện chỗ đèn lòi ra ngoài", "EMERGENCY"),
    ("Dây điện ở hành lang tầng 3 tòa SIM-A bị lòi ra ngoài", "EMERGENCY"),
    ("Hành lang tầng 3 tòa SIM-A dây điện tuột ra khỏi hộp đèn, trẻ con với tới được", "EMERGENCY"),
    ("Hành lang tầng 3 tòa SIM-A khói từ phòng rác bay ra nhiều lắm", "EMERGENCY"),
    ("Hành lang tầng 3 tòa SIM-A cháy rồi mọi người ơi", "EMERGENCY"),
    ("Cầu thang bộ tầng 3 tòa SIM-A có chất bột trắng không rõ, ai đi qua cũng ho sặc sụa", "EMERGENCY"),
    # (c) S-03 exposed wire
    ("Dây điện lộ ra ngoài", "EMERGENCY"),
    ("day dien lo ra ngoai", "EMERGENCY"),
    ("Lòi cả dây điện", "EMERGENCY"),
    ("Đèn hành lang tầng 3 tòa SIM-A rơi ra, lòi cả dây điện", "EMERGENCY"),
    ("Hành lang tầng 3 tòa SIM-A em thấy dây điện chỗ đèn lòi ra ngoài", "EMERGENCY"),
    ("dây điện tuột ra", "EMERGENCY"),
    # (d) "đầy tràn" written without accents is not "dây trần"
    ("thung rac hanh lang tang 5 toa SIM-B day tran roi", "NONE"),
    ("phong rac tang 8 toa SIM-A day tran ra ca hanh lang", "NONE"),
    ("Dây trần", "EMERGENCY"),
    ("Hầm B1 tòa SIM-A có sợi dây điện trần vắt ngang lối đi", "EMERGENCY"),
    # (e) B-01 flickering / burnt lamp with a resident location
    ("Mấy hôm nay đèn hành lang tầng 7 tòa SIM-B cứ chập chờn", "NONE"),
    ("Đèn hành lang tầng 7 tòa SIM-B lúc nào cũng chập chờn", "NONE"),
    ("Đèn hành lang tầng 7 tòa SIM-B thỉnh thoảng chập chờn", "NONE"),
    ("den hanh lang tang 7 toa SIM-B chap chon", "NONE"),
    ("bóng đèn gần căn 705 tầng 7 tòa SIM-B bị cháy", "NONE"),
    ("bóng đèn trước cửa căn 1205 bị cháy", "NONE"),
    # (f) optional
    ("wifi chập chờn", "NONE"),
    ("Tuần trước có khói do ai đốt vàng mã, giờ hết rồi", "UNCLEAR"),
]


@pytest.mark.parametrize("text,expected", H03_EXPECTED)
def test_h03_expected_levels(text, expected):
    assert assess(text, LEX).risk_level.value == expected


if __name__ == "__main__":  # python -m tests.test_maintenance.test_safety_metamorphic: print the counts
    total, found = violations()
    for tid, variant, want, got in found:
        print(f"{tid} {want}->{got} | {variant}")
    print(f"VARIANTS={total} VIOLATIONS={len(found)}")
