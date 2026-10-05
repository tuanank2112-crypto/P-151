"""REF meter (plan 06, SPEC-P03 / TESTING §3.11): P1 safety signals against every safety gate.

Architect measurement tool, NOT product code. Run from the repo root:

    PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-p1-safety-meter.py
    PYTHONPATH=. PYTHONUTF8=1 python planning/06_2026-10-05_reasoning-agent/specs/REF-p1-safety-meter.py --flip

Default: measures the repo lexicon as it is (what a worker runs after editing lexicon.yaml).
--flip:  measures a temporary copy of the repo lexicon with `safety.active_phases` set to [P0, P1] (the naive
         activation; the repo file is never written). Exit 0 only when every gate below passes.

Gates (SPEC-P03 §6): stop sets 0 violations; false-alarm budgets; fixture emergencies == {CLN-004, TEC-005};
P1 MUST_CATCH all at the expected level; P1 MUST_NOT_RAISE all at the expected level; location-variant wrapping of the
P1 lists keeps the level; classification-corpus texts raised by P1 only through S-11 on a lamp noun.
"""

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

import yaml

from src.maintenance.catalog import FIXTURE_DIR, load_dataset, load_lexicon
from src.maintenance.safety import assess
from tests.test_maintenance import test_classify_metamorphic as cm
from tests.test_maintenance import test_safety_metamorphic as meta

ROOT = Path(".").resolve()
STOP = yaml.safe_load((ROOT / "tests/test_maintenance/data/safety_stop_sets_p0.yaml").read_text(encoding="utf-8"))

E, U, N = "EMERGENCY", "UNCLEAR", "NONE"

# (id, text, expected level or tuple of accepted levels, signal that must be PRESENT/UNCLEAR or None)
MUST_CATCH = [
    ("P1-S10-01", "Hành lang tầng 5 tòa S1 có mùi gas nồng nặc", E, "S-10"),
    ("P1-S10-02", "Ngửi thấy mùi gas ở sảnh thang máy tầng 2 tòa S2, sợ quá", E, "S-10"),
    ("P1-S10-03", "mui gas o ham B1 toa S1", E, "S-10"),
    ("P1-S10-04", "Tầng hầm B1 tòa S1, bãi đỗ xe: nghe mùi khí đốt rất nặng", E, "S-10"),
    ("P1-S10-05", "Cầu thang bộ tầng 4 tòa S2 nồng mùi ga, sợ rò rỉ", E, "S-10"),
    ("P1-S10-06", "Có mùi gas", E, "S-10"),
    ("P1-S10-07", "Bình gas ở phòng rác tầng 3 tòa S2 bị rò rỉ, xì gas ra", E, "S-10"),
    ("P1-S13-01", "Có kim tiêm vứt bừa ở cầu thang bộ tầng 4 tòa S1", E, "S-13"),
    ("P1-S13-02", "Phòng rác tầng 3 tòa S2 có ống kim tiêm đã dùng vứt bừa bãi", E, "S-13"),
    ("P1-S13-03", "kim tiem vut bua o san choi toa S1 tang tret", E, "S-13"),
    ("P1-S13-04", "Cầu thang bộ tầng 3 tòa S1 có vết máu loang trên sàn", E, "S-13"),
    ("P1-S13-05", "Sân chơi tầng trệt tòa S2 có bông băng dính máu vứt ở góc", E, "S-13"),
    ("P1-S13-06", "Thùng rác hành lang tầng 7 tòa S1 có chất thải y tế", E, "S-13"),
    ("P1-S08-01", "Nước tràn vào tủ điện ở hầm B1 tòa S1", E, "S-08"),
    ("P1-S08-02", "Hành lang tầng 3 tòa S1 nước ngập ổ cắm", E, "S-08"),
    ("P1-S08-03", "Nước mưa hắt vào ngập cả ổ cắm hành lang tầng 7 tòa S2", E, "S-08"),
    ("P1-S08-04", "Tòa S2 tầng 2 sảnh thang máy, nước nhỏ vào hộp điện", E, "S-08"),
    ("P1-S08-05", "nuoc tran vao tu dien ham B1 toa S1", E, "S-08"),
    ("P1-S08-06", "Tủ điện hành lang tầng 4 tòa S2 bị ngập nước", E, "S-08"),
    ("P1-S07-01", "Đèn hành lang tầng 3 tòa S1 nóng ran, chạm vào bỏng tay", E, "S-07"),
    ("P1-S07-02", "Hộp đèn sảnh thang máy tầng 2 tòa S2 nóng bỏng tay", E, "S-07"),
    ("P1-S07-03", "Bóng đèn cầu thang bộ tầng 6 tòa S1 nóng ran, chảy cả nhựa", E, "S-07"),
    ("P1-S07-04", "Ổ cắm hành lang tầng 5 tòa S2 nóng chảy nhựa, cháy xém", E, "S-07"),
    ("P1-S07-05", "den hanh lang tang 3 toa S1 nong ran", E, "S-07"),
    ("P1-S07-06", "Công tắc đèn sảnh chính tòa S1 quá nóng, chạm vào không được", E, "S-07"),
    ("P1-S06-01", "Bị điện giật khi chạm vào tay vịn cầu thang bộ tầng 4 tòa S1", E, "S-06"),
    ("P1-S06-02", "Chạm vào cột đèn sân chơi tầng trệt tòa S2 bị giật tê tay, rò điện", E, "S-06"),
    ("P1-S06-03", "Có bị điện giật nhẹ khi chạm vào hộp đèn tầng 4 tòa S1.", E, "S-06"),
    ("P1-S06-04", "bi dien giat o cong tac den hanh lang tang 2 toa S2", E, "S-06"),
    ("P1-S11-01", "Đèn ốp trần sảnh chính tòa S2 sắp rơi, lủng lẳng", E, "S-11"),
    ("P1-S11-02", "Trần thạch cao hành lang tầng 9 tòa S1 sắp sập", E, "S-11"),
    ("P1-S11-03", "Kính lan can tầng 5 tòa S2 vỡ rơi xuống lối đi", E, "S-11"),
    ("P1-S11-04", "Đèn rơi xuống sàn ở hành lang tầng 4 tòa S2", E, "S-11"),
    ("P1-S11-05", "Bóng đèn hầm B1 tòa S1 rơi rồi, nhờ thay", E, "S-11"),
    ("P1-S11-06", "Đèn rớt xuống vỡ tan ở sảnh thang máy tầng 3 tòa S1", E, "S-11"),
    ("P1-S11-07", "Den hanh lang tang 3 toa S1 roi xuong san", E, "S-11"),
    ("P1-S12-01", "Hóa chất tẩy rửa đổ ra sàn hành lang tầng 3 tòa S1, mùi hắc cay mắt", E, "S-12"),
    ("P1-S12-02", "Ai làm đổ hóa chất ở phòng rác tầng 2 tòa S2", E, "S-12"),
    ("P1-S12-03", "Can axit bị đổ ở hầm B1 tòa S1", E, "S-12"),
    ("P1-S12-04", "Lối đi tầng 5 tòa S2 có hóa chất đổ loang, cay mắt", E, "S-12"),
    ("P1-NEG-01", "Hành lang tầng 5 tòa S1 không có mùi gas", N, None),
    ("P1-NEG-02", "Không thấy kim tiêm nào ở sân chơi tòa S1 tầng trệt, chỉ có rác", N, None),
    ("P1-HED-01", "Hình như có mùi gas ở hành lang tầng 3 tòa S1", U, "S-10"),
    ("P1-HED-02", "Hôm qua tủ điện hầm B1 tòa S1 bị nước tràn vào, giờ hết rồi", U, "S-08"),
    ("P1-HED-03", "Có vẻ đèn hành lang tầng 7 tòa S2 sắp rơi", U, "S-11"),
    ("P1-UNA-01", "mui ga o hanh lang tang 3 toa S1", E, "S-10"),
    ("P1-UNA-02", "vet mau o cau thang bo tang 3 toa S1", E, "S-13"),
]

MUST_NOT_RAISE = [
    ("P1-FP-01", "Hành lang tầng 3 tòa S1 nhiều rác, nhờ dọn mau giúp", N),
    ("P1-FP-02", "Sơn màu xanh dính đầy tường hành lang tầng 2 tòa S2", N),
    ("P1-FP-03", "Hỏng đèn rồi ở sảnh thang máy tầng 3 tòa S1", N),
    ("P1-FP-04", "Hanh lang tang 3 toa S1 tat den roi, toi qua", U),
    ("P1-FP-05", "Lá cây rơi xuống đầy sân chơi tòa S1 tầng trệt", N),
    ("P1-FP-06", "Hành lang tầng 3 tòa S1 quá nóng, không có quạt", N),
    ("P1-FP-07", "Mùi gà rán từ căn hộ bay ra hành lang tầng 4 tòa S1", N),
    ("P1-FP-08", "Nước màu vàng chảy ra từ trần hầm xe tòa S1 tầng B1", N),
    ("P1-FP-09", "Dây phơi đồ rơi xuống sân chơi tầng trệt tòa S2", N),
    ("P1-FP-10", "Đồ hóa chất tẩy rửa để ở góc hành lang tầng 3 tòa S1, chưa dọn", N),
    ("P1-FP-11", "Đèn hành lang tầng 7 tòa S2 hỏng rồi, nhờ thay mau", N),
    ("P1-FP-12", "Rác rơi vãi xuống sàn sảnh chính tòa S1", N),
    ("P1-FP-13", "Thùng rác hành lang tầng 3 tòa S1 đầy rồi, sắp tràn ra", N),
    ("P1-FP-14", "Mau mau dọn giúp phòng rác tầng 2 tòa S2", N),
    ("P1-FP-15", "Trời nóng quá, sảnh chính tòa S1 bí bách", N),
    ("P1-FP-16", "Đèn hành lang tầng 3 tòa S1 sáng rồi lại tắt", N),
    ("P1-FP-17", "Cháy đến tầng 3 tòa S1 rồi", U),
    ("P1-FP-18", "Nước tràn ra sàn hành lang tầng 3 tòa S1, trơn trượt", N),
    ("P1-FP-19", "Bé bị giật mình vì tiếng động ở sảnh tầng 2 tòa S2", N),
    ("P1-FP-20", "Dây điện thoại rơi xuống hành lang tầng 4", (N, U)),
    ("P1-FP-21", "do hoa chat o phong rac tang 2 toa S2", U),
]

LAMP_FALL_WORDS = ("rơi", "rớt", "roi", "rot")
LAMP_NOUNS = ("đèn", "den", "bóng", "bong", "tuýp", "tuyp")


def lexicon(flip: bool):
    if not flip:
        return load_lexicon().safety
    tmp = Path(tempfile.mkdtemp())
    raw = yaml.safe_load((FIXTURE_DIR / "lexicon.yaml").read_text(encoding="utf-8"))
    raw["safety"]["active_phases"] = ["P0", "P1"]
    (tmp / "lexicon.yaml").write_text(yaml.safe_dump(raw, allow_unicode=True, sort_keys=False), encoding="utf-8")
    load_lexicon.cache_clear()
    lex = load_lexicon(tmp).safety
    load_lexicon.cache_clear()
    shutil.rmtree(tmp)
    return lex


def level(text, lex):
    return assess(text, lex).risk_level.value


def accepted(expect):
    return expect if isinstance(expect, tuple) else (expect,)


def gate_stop_sets(lex) -> int:
    g, s = STOP["generators"], STOP["separators"]
    bad = 0
    for sep in g["joiners"].values():
        for neg in g["negations"]:
            for sig in g["signals"]:
                bad += level(g["prefix"] + neg + sep + sig, lex) != E
    bad += sum(level(s["base"] + item + s["tail"], lex) != E for item in s["items"].values())
    for case in STOP["labelled"]:
        bad += level(case["text"], lex) not in (case.get("expect_any") or [case["expect"]])
    total = len(g["joiners"]) * len(g["negations"]) * len(g["signals"]) + len(s["items"]) + len(STOP["labelled"])
    print(f"STOP_SETS total={total} violations={bad}")
    return bad


def gate_budgets(lex) -> int:
    failed = 0
    for name, budget in STOP["budgets"].items():
        counts = {E: 0, U: 0, N: 0}
        for text in budget["texts"]:
            counts[level(text, lex)] += 1
        ok = all(counts[k] <= m for k, m in budget["max"].items())
        failed += not ok
        print(f"BUDGET {name} counts={counts} max={budget['max']} ok={ok}")
    emergencies = sorted(
        t.raw.ticket_id for t in load_dataset().tickets if level(t.raw.original_description, lex) == E
    )
    ok = emergencies == ["SIM-TKT-CLN-004", "SIM-TKT-TEC-005"]
    failed += not ok
    print(f"BUDGET fixture emergencies={emergencies} ok={ok}")
    return failed


def gate_lists(lex) -> int:
    bad = 0
    for cid, text, expect, signal in MUST_CATCH:
        result = assess(text, lex)
        got = result.risk_level.value
        seen = {s.signal_id for s in result.signals if s.status.value != "ABSENT"}
        ok = got in accepted(expect) and (signal is None or signal in seen)
        bad += not ok
        if not ok:
            print(f"  MUST_CATCH FAIL {cid} want={expect}/{signal} got={got} {sorted(seen)} | {text}")
    print(f"MUST_CATCH total={len(MUST_CATCH)} failures={bad}")
    bad2 = 0
    for cid, text, expect in MUST_NOT_RAISE:
        got = level(text, lex)
        ok = got in accepted(expect)
        bad2 += not ok
        if not ok:
            print(f"  MUST_NOT_RAISE FAIL {cid} want={expect} got={got} | {text}")
    print(f"MUST_NOT_RAISE total={len(MUST_NOT_RAISE)} failures={bad2}")
    return bad + bad2


def gate_location_variants(lex) -> int:
    count, bad = 0, 0
    for _cid, text, *_ in MUST_CATCH + MUST_NOT_RAISE:
        want = level(text, lex)
        for _tid, variant in meta.variants(text) + meta.mid_variants(text):
            count += 1
            if level(variant, lex) != want:
                bad += 1
                if bad <= 15:
                    print(f"  VARIANT FAIL want={want} got={level(variant, lex)} | {variant}")
    print(f"P1_LOCATION_VARIANTS total={count} violations={bad}")
    return bad


def gate_corpus(lex, base) -> int:
    changed, bad = 0, 0
    for sentence, _kind in cm.CORPUS:
        for text, _loc in [(sentence, None)] + cm.variants(sentence):
            before, after = level(text, base), assess(text, lex)
            if after.risk_level.value == before:
                continue
            changed += 1
            low = text.lower()
            lamp_fall = any(w in low for w in LAMP_NOUNS) and any(w in low for w in LAMP_FALL_WORDS)
            s11 = any(s.signal_id == "S-11" and s.status.value == "PRESENT" for s in after.signals)
            if not (lamp_fall and s11):
                bad += 1
                if bad <= 15:
                    print(f"  CORPUS FAIL {before}->{after.risk_level.value} | {text}")
    print(f"CORPUS changed_by_P1={changed} not_lamp_fall={bad}")
    return bad


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--flip", action="store_true", help="measure a temp copy with active_phases [P0, P1]")
    args = parser.parse_args()
    lex = lexicon(args.flip)
    base = lexicon(False) if args.flip else None
    print(f"MODE={'flip' if args.flip else 'repo'} active_phases={list(lex.active_phases)}")
    failures = gate_stop_sets(lex) + gate_budgets(lex) + gate_lists(lex) + gate_location_variants(lex)
    if base is not None or "P1" in lex.active_phases:
        p0 = base
        if p0 is None:  # repo mode with P1 already on: compare with a P0-only copy
            tmp = Path(tempfile.mkdtemp())
            raw = yaml.safe_load((FIXTURE_DIR / "lexicon.yaml").read_text(encoding="utf-8"))
            raw["safety"]["active_phases"] = ["P0"]
            (tmp / "lexicon.yaml").write_text(yaml.safe_dump(raw, allow_unicode=True, sort_keys=False), encoding="utf-8")
            load_lexicon.cache_clear()
            p0 = load_lexicon(tmp).safety
            load_lexicon.cache_clear()
            shutil.rmtree(tmp)
        failures += gate_corpus(lex, p0)
    print(f"GATES_FAILED={failures}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
