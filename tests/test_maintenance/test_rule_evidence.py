"""Plan 06 WP3 (SPEC-P05 section 2, TESTING 3.3 RE-01..RE-06): rule evidence the Agent is checked against.

The architect prototype `REF-split-verdict.py` is imported (not copied): its sentence lists and its expected
variant counts are the acceptance data, and its verdict must equal `rules.split_verdict` on every sentence.
"""

import importlib.util
from pathlib import Path

import pytest

from src.maintenance.catalog import load_catalog
from src.maintenance.enums import SPLIT_PAIR, ServiceCategory
from src.maintenance.rules import (
    SplitVerdict,
    category_evidence,
    classify,
    electrical_hazard,
    extract_location,
    location_mentions,
    split_verdict,
)
from tests.test_maintenance import test_classify_metamorphic as cm

REPO = Path(__file__).resolve().parents[2]
REF_PATH = REPO / "planning" / "06_2026-10-05_reasoning-agent" / "specs" / "REF-split-verdict.py"
BUILDINGS = load_catalog().site.buildings


def _load_ref():
    spec = importlib.util.spec_from_file_location("ref_split_verdict", REF_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


REF = _load_ref()
VE, KT = ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT


def test_re_01_split_sentences_split_and_stay_unclear_for_classify():
    assert len(REF.MUST_SPLIT) == 32
    for text in REF.MUST_SPLIT:
        verdict = split_verdict(text, BUILDINGS)
        assert verdict.categories == SPLIT_PAIR, (verdict.reason, text)
        assert verdict.reason == "split"
        assert extract_location(text, BUILDINGS) is not None, text
        assert classify(text).reason_code == "CATEGORY_UNCLEAR", text


# Plan 20: the reference prototype blocked a split on cause / hedge / question words (R-S3, R-S4). Two jobs at one place
# now always split, so those reasons are no longer a reason to keep one ticket.
_DROPPED_BLOCKS = ("marker:", "question")


def _was_blocked_by_dropped_rule(reason: str) -> bool:
    return reason.startswith(_DROPPED_BLOCKS)


def test_re_02_non_split_sentences_do_not_split():
    assert len(REF.MUST_NOT_SPLIT) == 18
    kept = dropped = 0
    for text in REF.MUST_NOT_SPLIT:
        verdict = split_verdict(text, BUILDINGS)
        if _was_blocked_by_dropped_rule(REF.split_verdict(text)[1]):
            dropped += 1
            assert verdict.categories == SPLIT_PAIR and verdict.reason == "split", text
        else:  # one job, a job away from the place, or two places: still not split
            kept += 1
            assert verdict.categories == () and verdict.reason != "split", (verdict.reason, text)
    assert (kept, dropped) == (6, 12)


def test_re_03_mixed_corpus_variants_match_the_expected_split_counts():
    assert len(cm.MIXED) == 17
    for sentence in cm.MIXED:
        variants = cm.variants(sentence)
        assert len(variants) == 36
        splits = sum(bool(split_verdict(text, BUILDINGS).categories) for text, _ in variants)
        assert splits == len(variants), (splits, sentence)  # plan 20: no variant is held back by "vì" / "do"


def test_re_04_single_job_corpus_is_never_split_with_any_location_variant():
    checked = 0
    for sentence, kind in cm.CORPUS:
        if kind == cm.UNCLEAR:
            continue
        for text in [sentence] + [t for t, _ in cm.variants(sentence)]:
            checked += 1
            assert split_verdict(text, BUILDINGS).categories == (), text
    assert checked >= 36 * 100


def test_re_05_category_evidence_matches_classify_on_the_whole_corpus():
    for sentence, kind in cm.CORPUS:
        # the bare sentence names no common area, so area-gated words do not count: only the located variants are
        # the reference (same convention as the metamorphic suite)
        for text, _ in cm.variants(sentence):
            got = category_evidence(text)
            if kind == cm.TEC:
                assert got == {KT}, text
            elif kind == cm.CLN:
                assert got == {VE}, text
            elif kind == cm.UNCLEAR:
                assert got == {VE, KT}, text
            elif not electrical_hazard(text):
                assert got == frozenset(), text


def test_re_05b_category_evidence_has_no_electrical_branch():
    text = "Hành lang tầng 3 tòa S1 đèn rơi ra, lòi cả dây điện"
    assert electrical_hazard(text) is True
    assert classify(text).reason_code == "OUT_OF_SCOPE"  # classify stops on the hazard ...
    assert category_evidence(text) == {KT}  # ... the evidence is the raw lamp flag


def test_re_06_classify_is_unchanged_by_the_refactor():
    assert cm.violations() == []


def test_re_07_split_verdict_equals_the_reference_prototype_everywhere():
    sentences = [*REF.MUST_SPLIT, *REF.MUST_NOT_SPLIT, *cm.MIXED]
    for sentence in cm.MIXED:
        sentences += [t for t, _ in cm.variants(sentence)]
    for text in sentences:
        mine = split_verdict(text, BUILDINGS)
        categories, reason = REF.split_verdict(text)
        if _was_blocked_by_dropped_rule(reason):  # plan 20: only the place rule can still stop it
            assert mine.reason in ("split", "two-places"), text
            assert (mine.categories == SPLIT_PAIR) is (mine.reason == "split"), text
        else:
            assert (mine.categories, mine.reason) == (categories, reason), text


@pytest.mark.parametrize(
    ("text", "reason"),
    [
        ("Hành lang tầng 3 tòa S1 nước tràn vào ổ cắm, rác đầy, đèn hỏng", "electrical-hazard"),
        ("Hành lang tầng 3 tòa S1 đèn không sáng", "not-both"),
        ("Hành lang tầng 3 tòa S1 nhiều rác vì bóng đèn hành lang không sáng", "split"),
        ("Hành lang tầng 3 tòa S1 hình như có rác, đèn không sáng", "split"),
        ("hanh lang tang 3 toa S1 nuoc ngot do ra san, den hong", "split"),
        ("Sảnh chính tòa S1 có rác hoặc đèn không sáng?", "split"),
        ("Sảnh chính tòa S1 có rác, đèn không sáng không?", "split"),
        ("Rác ở hành lang tầng 3 tòa S1, còn đèn sảnh thang máy tầng 5 tòa S1 không sáng", "two-places"),
        ("Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng", "split"),
    ],
)
def test_re_08_each_blocking_rule_reports_its_reason(text, reason):
    verdict = split_verdict(text, BUILDINGS)
    assert verdict.reason == reason
    assert (verdict.categories == SPLIT_PAIR) is (reason == "split")


def test_re_09_split_verdict_is_a_frozen_value():
    verdict = split_verdict("Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng", BUILDINGS)
    assert isinstance(verdict, SplitVerdict)
    with pytest.raises(AttributeError):
        verdict.reason = "x"


def test_re_10_location_mentions_ignores_the_residence_and_hall_inside_a_floor_phrase():
    labels, floors, buildings = location_mentions("Em ở căn 1203 tòa S2, báo giúp hành lang tầng 4 tòa S2", BUILDINGS)
    assert (labels, floors, buildings) == ({"Hành lang"}, {"4"}, {"s2"})  # codes come out of `normalize`: lowercase
    labels, floors, _ = location_mentions("Tầng hầm B1 tòa S1 nhiều rác", BUILDINGS)
    assert labels == frozenset() and floors == {"b1"}
