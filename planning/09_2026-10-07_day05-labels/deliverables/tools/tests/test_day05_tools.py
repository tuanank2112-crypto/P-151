"""Tests for the Day05 tools. Fixtures are built here; the real dataset is never read.

MUTATIONS / BACKLOG_MUTATIONS are the negative controls: each one breaks a valid fixture in exactly one way and the
matching tool must answer exit 1 with the expected code (also replayed on the CLI to produce the evidence files).
"""

from __future__ import annotations

import copy
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
import build_review_pack as pack  # noqa: E402
import run_day05_baseline as base  # noqa: E402
import validate_day05 as val  # noqa: E402

sys.path.insert(0, str(val.ROOT))

TEXT = {  # kind -> (text template, quote, signal)
    "EM": ("Có người bị mắc kẹt trong thang máy tòa S1 (mã {n})", "mắc kẹt trong thang máy", ("S-09", "PRESENT")),
    "UN": ("Hành lang tầng 3 tòa S1 có mùi lạ (mã {n})", "mùi lạ", ("T2-01", "UNCLEAR")),
    "CLN": ("Rác chất đống ở hành lang tầng 3 tòa S1 (mã {n})", None, None),
    "TEC": ("Đèn hành lang tầng 3 tòa S1 bị hỏng (mã {n})", None, None),
    "UNK": ("Điều hòa trong căn hộ tầng 5 tòa S1 bị hỏng (mã {n})", None, None),
}
HELD_TEXT = {  # HELD_OUT uses its own sentences: the text-leak check (ratio >= 0.9 vs DEVELOP) must stay green
    "EM": (
        "Nhờ BQL hỗ trợ gấp, bé bị kẹt trong thang máy ở tòa S2 (số {n})",
        "kẹt trong thang máy",
        ("S-09", "PRESENT"),
    ),
    "UN": ("Khu vực chung tầng 7 tòa S2 thoảng mùi khét lạ (số {n})", "mùi khét lạ", ("T2-01", "UNCLEAR")),
    "CLN": ("Thùng rác sảnh tầng 1 tòa S2 đầy tràn ra ngoài (số {n})", None, None),
    "TEC": ("Bóng đèn cầu thang bộ tòa S2 chập chờn không sáng (số {n})", None, None),
    "UNK": ("Vòi nước trong nhà tôi tầng 9 tòa S2 chảy yếu (số {n})", None, None),
}
CLS = {
    "CLN": ("VE_SINH", "COMMON_AREA_CLEANING", "PB-CLN-01", None),
    "TEC": ("KY_THUAT", "COMMON_AREA_LIGHTING", "PB-TEC-01", None),
    "UNK": ("UNKNOWN", "UNKNOWN", None, "OUT_OF_SCOPE"),
}
MINI = ({"EM": 1, "UN": 1, "CLN": 1, "TEC": 1, "UNK": 1}, {"EM": 1, "CLN": 1})
FULL = (
    {"EM": 15, "UN": 15, "CLN": 8, "TEC": 8, "UNK": 4},
    {"EM": 5, "UN": 5, "CLN": 7, "TEC": 7, "UNK": 6},
)


def review(**over):
    return {
        "status": "ACCEPTED",
        "proposed_by": "Truong",
        "reviewed_by": "Nhu Y",
        "reviewed_at": "2026-10-06T10:00:00+00:00",  # must be in the past: a future reviewed_at is REVIEWED_AT_FUTURE
        "rationale": "doc CR-BPTN-03 muc 6",
        "spec_refs": ["CR-BPTN-03 §6"],
        "dispute_id": None,
        **over,
    }


def root(records, **extra):
    return {"schema_version": "day05-1", "created_at": "2026-10-08T09:00:00+00:00", "records": records, **extra}


def build(dev, held):
    """Valid dataset: NONE cases carry classification gold, EM/UNCLEAR cases are SAFETY_STOP."""
    cases, safety, cls, ids, n = [], [], [], {"DEVELOP": [], "HELD_OUT": []}, 0
    for split, quota in (("DEVELOP", dev), ("HELD_OUT", held)):
        for kind, count in quota.items():
            for _ in range(count):
                n += 1
                cid, k = f"D5-C-{n:04d}", len(ids[split])
                template, quote, signal = (HELD_TEXT if split == "HELD_OUT" else TEXT)[kind]
                text = template.format(n=n)
                ids[split].append(cid)
                cases.append(
                    {
                        "case_id": cid,
                        "text": text,
                        "synthetic": True,
                        "family_id": f"F-{split[0]}{k // 2}",
                        "phenomena": [],
                        "source": {
                            "kind": "AUTHORED" if split == "HELD_OUT" else "EXISTING_FIXTURE",
                            "ref": "test",
                            "original_id": None,
                        },
                        "split": split,
                        "classification_eligibility": "ELIGIBLE" if kind in CLS else "SAFETY_STOP",
                        "notes": "",
                    }
                )
                signals, risk = [], "NONE"
                if quote:
                    start = text.index(quote)
                    signals = [
                        {
                            "signal_id": signal[0],
                            "status": signal[1],
                            "source_quote": quote,
                            "start": start,
                            "end": start + len(quote),
                        }
                    ]
                    risk = "EMERGENCY" if kind == "EM" else "UNCLEAR"
                safety.append(
                    {"case_id": cid, "risk_level": risk, "signals": signals, "risk_reason": "r", "review": review()}
                )
                if kind in CLS:
                    c, t, p, r = CLS[kind]
                    cls.append(
                        {
                            "case_id": cid,
                            "service_category": c,
                            "ticket_type": t,
                            "playbook_id": p,
                            "reason_code": r,
                            "review": review(),
                        }
                    )
    manifest = root(
        [],
        dataset_version="t1",
        source_hashes={},
        splits={"develop": ids["DEVELOP"], "held_out": ids["HELD_OUT"]},
        family_exceptions=[],
    )
    return {
        "cases": root(cases),
        "classification-gold": root(cls),
        "safety-gold": root(safety),
        "disputes": root([]),
        "split-manifest": manifest,
        "label-proposals": root([]),
    }


def write(directory, ds):
    directory.mkdir(parents=True, exist_ok=True)
    for name, data in ds.items():
        (directory / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return directory


def run(capsys, module, *args):
    code = module.main([str(a) for a in args])
    return code, capsys.readouterr().out


def recs(ds, name):
    return ds[name]["records"]


# ----------------------------------------------------------------------------- negative controls: dataset
MUTATIONS = {}


def mutation(code):
    def register(fn):
        MUTATIONS[fn.__name__] = (code, fn)
        return fn

    return register


# MINI layout: cases 1-5 DEVELOP (EM, UN, CLN, TEC, UNK; families F-D0 F-D0 F-D1 F-D1 F-D2), 6-7 HELD_OUT (EM, CLN; F-H0)
# safety gold order == case order; classification gold order == cases 3, 4, 5, 7.
@mutation("DUP_ID")
def dup_case_id(ds):
    recs(ds, "cases")[1]["case_id"] = recs(ds, "cases")[0]["case_id"]


@mutation("DUP_ID")
def dup_gold_id(ds):
    recs(ds, "safety-gold").append(copy.deepcopy(recs(ds, "safety-gold")[0]))


@mutation("MISSING_REF")
def gold_ref_missing(ds):
    recs(ds, "safety-gold")[0]["case_id"] = "D5-C-9999"


@mutation("MISSING_REF")
def manifest_ref_missing(ds):
    ds["split-manifest"]["splits"]["develop"].append("D5-C-9999")


@mutation("BAD_PAIR")
def bad_pair(ds):
    recs(ds, "classification-gold")[0]["ticket_type"] = "COMMON_AREA_LIGHTING"


@mutation("BAD_PAIR")
def cleaning_with_reason_code(ds):
    recs(ds, "classification-gold")[0]["reason_code"] = "OUT_OF_SCOPE"


@mutation("BAD_PAIR")
def unknown_without_reason_code(ds):
    recs(ds, "classification-gold")[2]["reason_code"] = None


@mutation("BAD_QUOTE")
def bad_quote(ds):
    recs(ds, "safety-gold")[0]["signals"][0]["source_quote"] = "khong co trong text"


@mutation("BAD_QUOTE")
def bad_offsets(ds):
    recs(ds, "safety-gold")[0]["signals"][0]["end"] += 1


@mutation("BAD_SIGNAL_ID")
def bad_signal_id(ds):
    recs(ds, "safety-gold")[0]["signals"][0]["signal_id"] = "T2-09"


@mutation("EM_NO_TIER1")
def emergency_with_tier2_only(ds):
    recs(ds, "safety-gold")[0]["signals"][0]["signal_id"] = "T2-01"


@mutation("EM_NO_TIER1")
def emergency_tier1_absent(ds):
    recs(ds, "safety-gold")[0]["signals"][0]["status"] = "ABSENT"


@mutation("ACCEPTED_INCOMPLETE")
def accepted_without_reviewer(ds):
    recs(ds, "safety-gold")[0]["review"]["reviewed_by"] = None


@mutation("ACCEPTED_INCOMPLETE")
def accepted_without_reviewed_at(ds):
    recs(ds, "classification-gold")[0]["review"]["reviewed_at"] = None


@mutation("ACCEPTED_INCOMPLETE")
def accepted_without_rationale(ds):
    recs(ds, "safety-gold")[0]["review"]["rationale"] = ""


@mutation("ACCEPTED_INCOMPLETE")
def accepted_without_spec_refs(ds):
    recs(ds, "safety-gold")[0]["review"]["spec_refs"] = []


@mutation("REVIEWER_SAME")
def reviewer_is_proposer(ds):
    recs(ds, "safety-gold")[0]["review"]["reviewed_by"] = " truong "


@mutation("REVIEWER_NOT_HUMAN")
def reviewer_is_gpt(ds):
    recs(ds, "safety-gold")[0]["review"]["reviewed_by"] = "GPT-6 Luna"


@mutation("REVIEWER_NOT_HUMAN")
def reviewer_is_claude(ds):
    recs(ds, "classification-gold")[0]["review"]["reviewed_by"] = "claude-sonnet"


@mutation("ACCEPTED_OPEN_DISPUTE")
def accepted_linked_to_open_dispute(ds):
    cid = recs(ds, "safety-gold")[0]["case_id"]
    recs(ds, "disputes").append(dispute("D5-D-001", cid, "SAFETY"))
    recs(ds, "safety-gold")[0]["review"]["dispute_id"] = "D5-D-001"


@mutation("ACCEPTED_OPEN_DISPUTE")
def accepted_with_unlinked_open_dispute(ds):
    recs(ds, "disputes").append(dispute("D5-D-001", recs(ds, "classification-gold")[0]["case_id"], "CLASSIFICATION"))


@mutation("CLS_NOT_ELIGIBLE")
def classification_gold_for_safety_stop(ds):
    extra = copy.deepcopy(recs(ds, "classification-gold")[0])
    extra["case_id"] = recs(ds, "cases")[0]["case_id"]
    recs(ds, "classification-gold").append(extra)


@mutation("CLS_NOT_ELIGIBLE")
def classification_gold_with_risk(ds):
    recs(ds, "safety-gold")[2]["risk_level"] = "UNCLEAR"


@mutation("SPLIT_MISMATCH")
def case_split_differs_from_manifest(ds):
    recs(ds, "cases")[0]["split"] = "HELD_OUT"


@mutation("SPLIT_MISMATCH")
def case_missing_from_manifest(ds):
    ds["split-manifest"]["splits"]["develop"].pop()


@mutation("FAMILY_LEAK")
def family_in_both_splits(ds):
    recs(ds, "cases")[0]["family_id"] = recs(ds, "cases")[5]["family_id"]


@mutation("FAMILY_TOO_BIG")
def family_over_three(ds):
    for c in recs(ds, "cases")[:4]:
        c["family_id"] = "F-D0"


@mutation("BAD_EXCEPTION")
def exception_without_reason(ds):
    family_over_three(ds)
    ds["split-manifest"]["family_exceptions"] = [{"family_id": "F-D0", "reason": " "}]


@mutation("BAD_EXCEPTION")
def exception_on_held_out_family(ds):
    ds["split-manifest"]["family_exceptions"] = [{"family_id": "F-H0", "reason": "not allowed"}]


@mutation("D4_11_HELD_OUT")
def d4_11_in_held_out(ds):
    recs(ds, "cases")[5]["family_id"] = "F-D4-11"


@mutation("HELDOUT_NOT_AUTHORED")
def held_out_not_authored(ds):
    recs(ds, "cases")[5]["source"]["kind"] = "LLM_PROPOSAL"


@mutation("SECRET")
def secret_openai_key(ds):
    recs(ds, "cases")[0]["notes"] = "key sk-" + "a1B2c3D4" * 3


@mutation("SECRET")
def secret_jwt(ds):
    recs(ds, "cases")[0]["notes"] = "token eyJhbGciOiJIUzI1NiJ9.payload.sig"


@mutation("SECRET")
def secret_postgres_url(ds):
    recs(ds, "disputes").append(dispute("D5-D-001", "D5-C-0001", "SAFETY", status="RESOLVED"))
    recs(ds, "disputes")[0]["question"] = "dung postgresql://user:pw@db.example.com/postgres"


@mutation("SECRET")
def secret_supabase_env(ds):
    recs(ds, "safety-gold")[0]["risk_reason"] = "SUPABASE_SERVICE_ROLE_KEY=abc"


@mutation("SECRET")
def secret_in_manifest(ds):
    ds["split-manifest"]["dataset_version"] = "sk-" + "z9Y8x7W6" * 3


@mutation("BAD_SCHEMA")
def bad_risk_enum(ds):
    recs(ds, "safety-gold")[0]["risk_level"] = "HIGH"


@mutation("BAD_SCHEMA")
def case_not_synthetic(ds):
    recs(ds, "cases")[0]["synthetic"] = False


@mutation("BAD_SCHEMA")
def case_missing_key(ds):
    del recs(ds, "cases")[0]["family_id"]


@mutation("BAD_SCHEMA")
def family_id_not_a_string(ds):
    recs(ds, "cases")[0]["family_id"] = ["F-D0"]


@mutation("BAD_SCHEMA")
def dispute_id_not_a_string(ds):
    recs(ds, "safety-gold")[0]["review"]["dispute_id"] = ["D5-D-001"]


@mutation("BAD_EXCEPTION")
def exceptions_not_a_list(ds):
    ds["split-manifest"]["family_exceptions"] = "F-D0"


@mutation("BAD_ID")
def bad_case_id_format(ds):
    recs(ds, "cases")[0]["case_id"] = "X-1"


@mutation("BAD_SCHEMA")
def non_object_case_record(ds):
    recs(ds, "cases").append("junk")


# ---- H05 negative controls (each was accepted before the harden pass). MINI: cases[2] CLN, cases[5] HELD_OUT EM,
# cases[6] HELD_OUT CLN (no signal, so its text can be edited freely).
def accepted_review(ds, **over):
    recs(ds, "safety-gold")[0]["review"].update(over)


def nfd(text):
    return unicodedata.normalize("NFD", text)


def no_accents(text):
    return "".join(c for c in nfd(text) if not unicodedata.combining(c)).replace("đ", "d")


@mutation("REVIEWER_SAME")  # M1: same person after casefold + whitespace collapse
def reviewer_is_proposer_other_case_and_spaces(ds):
    accepted_review(ds, proposed_by="Nguyen Van A", reviewed_by="NGUYEN  VAN   A")


@mutation("REVIEWER_SAME")  # M1: NFC vs NFD
def reviewer_is_proposer_nfd(ds):
    accepted_review(ds, proposed_by=unicodedata.normalize("NFC", "Nguyễn Văn A"), reviewed_by=nfd("Nguyễn Văn A"))


@mutation("REVIEWER_SAME")  # M1: accents removed
def reviewer_is_proposer_without_accents(ds):
    accepted_review(ds, proposed_by="Truong", reviewed_by="Trường")


@mutation("ACCEPTED_INCOMPLETE")
def reviewer_blank(ds):
    accepted_review(ds, reviewed_by="   ")


@mutation("ACCEPTED_INCOMPLETE")
def reviewer_one_letter(ds):
    accepted_review(ds, reviewed_by="X")


@mutation("ACCEPTED_INCOMPLETE")
def reviewer_not_a_string(ds):
    accepted_review(ds, reviewed_by=5)


@mutation("ACCEPTED_INCOMPLETE")
def proposer_missing(ds):
    accepted_review(ds, proposed_by=None)


@mutation("ACCEPTED_INCOMPLETE")
def rationale_blank(ds):
    accepted_review(ds, rationale="   ")


@mutation("ACCEPTED_INCOMPLETE")
def spec_refs_blank_string(ds):
    accepted_review(ds, spec_refs=[""])


@mutation("ACCEPTED_INCOMPLETE")
def spec_refs_not_strings(ds):
    accepted_review(ds, spec_refs=[123])


@mutation("REVIEWED_AT_FUTURE")
def reviewed_at_in_the_future(ds):
    accepted_review(ds, reviewed_at="2099-01-01T00:00:00+00:00")


@mutation("BAD_SCHEMA")
def reviewed_at_date_only(ds):
    accepted_review(ds, reviewed_at="2026-10-05")


@mutation("BAD_SCHEMA")
def reviewed_at_not_a_date(ds):
    accepted_review(ds, reviewed_at="yesterday")


def reviewer_named(name):
    return lambda ds: accepted_review(ds, reviewed_by=name)


for _name in ("AI Reviewer", "Codex", "Gemini", "orchestrator", "System", "TBD", "unknown", "n/a", "None", "test"):
    MUTATIONS["reviewer_named_" + re.sub(r"\W", "_", _name.lower())] = ("REVIEWER_NOT_HUMAN", reviewer_named(_name))
for _name in ("cl4ude", "b0t", "Như Ý (sonnet)"):  # digit swaps and a model hidden in a human-looking name
    MUTATIONS["reviewer_named_" + re.sub(r"\W", "_", _name.lower())] = ("REVIEWER_NOT_HUMAN", reviewer_named(_name))


@mutation("FROZEN_HASH_MISMATCH")  # M2
def frozen_with_garbage_hash(ds):
    ds["split-manifest"].update(frozen=True, hash="a" * 64)


@mutation("FROZEN_HASH_MISMATCH")
def frozen_with_empty_hash(ds):
    ds["split-manifest"].update(frozen=True, hash="")


@mutation("FROZEN_HASH_MISMATCH")
def frozen_without_hash(ds):
    ds["split-manifest"].update(frozen=True)


@mutation("FROZEN_INCONSISTENT")
def hash_without_frozen(ds):
    ds["split-manifest"].update(frozen=False, hash="a" * 64)


@mutation("FROZEN_INCONSISTENT")
def frozen_is_a_string(ds):
    ds["split-manifest"].update(frozen="true", hash="a" * 64)


@mutation("ELIGIBILITY_MISMATCH")  # M3
def emergency_case_marked_eligible(ds):
    recs(ds, "cases")[0]["classification_eligibility"] = "ELIGIBLE"


@mutation("ELIGIBILITY_MISMATCH")
def unclear_case_marked_eligible(ds):
    recs(ds, "cases")[1]["classification_eligibility"] = "ELIGIBLE"


@mutation("ELIGIBILITY_MISMATCH")
def none_case_marked_safety_stop(ds):
    recs(ds, "cases")[2]["classification_eligibility"] = "SAFETY_STOP"


@mutation("TEXT_LEAK")  # M5: HELD_OUT text already in DEVELOP
def held_out_text_identical_to_develop(ds):
    recs(ds, "cases")[6]["text"] = recs(ds, "cases")[2]["text"]


@mutation("TEXT_LEAK")
def held_out_text_upper_case(ds):
    recs(ds, "cases")[6]["text"] = recs(ds, "cases")[2]["text"].upper()


@mutation("TEXT_LEAK")
def held_out_text_plus_punctuation(ds):
    recs(ds, "cases")[6]["text"] = recs(ds, "cases")[2]["text"] + "."


@mutation("TEXT_LEAK")
def held_out_text_without_accents(ds):
    recs(ds, "cases")[6]["text"] = no_accents(recs(ds, "cases")[2]["text"])


@mutation("TEXT_LEAK")
def held_out_text_near_duplicate(ds):
    recs(ds, "cases")[6]["text"] = recs(ds, "cases")[2]["text"].replace("(mã 3)", "(mã 8)")


@mutation("FAMILY_LEAK")
def held_out_family_differs_by_case_and_space(ds):
    recs(ds, "cases")[5]["family_id"] = recs(ds, "cases")[0]["family_id"].lower() + " "


@mutation("D4_11_HELD_OUT")
def d4_11_lower_case_in_held_out(ds):
    recs(ds, "cases")[5]["family_id"] = "f-d4-11"


@mutation("D4_11_HELD_OUT")
def d4_11_padded_variant_in_held_out(ds):
    recs(ds, "cases")[5]["family_id"] = "  F-D4-11-x "


@mutation("HELDOUT_NOT_AUTHORED")
def held_out_authored_blank_ref(ds):
    recs(ds, "cases")[5]["source"]["ref"] = "  "


@mutation("HELDOUT_NOT_AUTHORED")
def held_out_authored_ref_not_a_string(ds):
    recs(ds, "cases")[5]["source"]["ref"] = None


@mutation("HELDOUT_NOT_AUTHORED")
def held_out_authored_with_model_ref(ds):
    recs(ds, "cases")[5]["source"]["ref"] = "claude-sonnet generated"


@mutation("UNCLEAR_NO_SIGNAL")  # m2
def unclear_without_signals(ds):
    recs(ds, "safety-gold")[1]["signals"] = []


@mutation("UNCLEAR_NO_SIGNAL")
def unclear_with_only_absent_signal(ds):
    recs(ds, "safety-gold")[1]["signals"][0]["status"] = "ABSENT"


@mutation("NONE_HAS_SIGNAL")
def none_with_present_signal(ds):
    text = recs(ds, "cases")[2]["text"]
    sig = {"signal_id": "S-01", "status": "PRESENT", "source_quote": text[:3], "start": 0, "end": 3}
    recs(ds, "safety-gold")[2]["signals"] = [sig]


def dispute(dispute_id, case_id, task, status="OPEN"):
    return {
        "dispute_id": dispute_id,
        "case_id": case_id,
        "task": task,
        "proposed_labels": [],
        "question": "q",
        "owner": "Nhu Y",
        "status": status,
        "decision": None,
        "decision_at": None,
        "evidence_refs": [],
    }


def test_valid_fixture_passes_structure_only(tmp_path, capsys):
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", build(*MINI)), "--structure-only")
    assert code == 0 and "RESULT: STRUCTURE_PASS" in out and "RESULT: PASS" not in out  # m3: never a bare PASS
    assert "GATE G2: OPEN" in out and "GATE G3: OPEN" in out  # count gates not evaluated, never claimed closed
    assert "COUNT safety ALL EMERGENCY=2 UNCLEAR=1 NONE=4" in out


@pytest.mark.parametrize("name", sorted(MUTATIONS))
def test_negative_control_dataset(name, tmp_path, capsys):
    code, fn = MUTATIONS[name]
    ds = build(*MINI)
    fn(ds)
    exit_code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", ds), "--structure-only")
    assert exit_code == 1 and "RESULT: FAIL" in out and f"ERR {code} " in out and "VALIDATOR_CRASH" not in out, out


def test_unaccepted_gold_is_not_checked_for_review_fields(tmp_path, capsys):
    ds = build(*MINI)
    ds["safety-gold"]["records"][0]["review"].update(status="PROPOSED", reviewed_by=None, reviewed_at=None)
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", ds), "--structure-only")
    assert code == 0 and "COUNT safety ALL EMERGENCY=1 " in out  # only ACCEPTED is counted: 2 -> 1


def test_family_exception_with_reason_is_allowed(tmp_path, capsys):
    ds = build(*MINI)
    family_over_three(ds)
    ds["split-manifest"]["family_exceptions"] = [{"family_id": "F-D0", "reason": "D4-11 matrix, DEVELOP only"}]
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", ds), "--structure-only")
    assert code == 0, out


@pytest.mark.parametrize("breaker", ["delete", "bad_json", "bad_root", "bad_manifest_splits"])
def test_negative_control_files(breaker, tmp_path, capsys):
    directory = write(tmp_path / "d", build(*MINI))
    target = directory / "disputes.json"
    if breaker == "delete":
        target.unlink()
    elif breaker == "bad_json":
        target.write_text("{not json", encoding="utf-8")
    elif breaker == "bad_root":
        target.write_text(json.dumps({"schema_version": "day05-2", "created_at": "x", "records": []}), encoding="utf-8")
    else:
        ds = json.loads((directory / "split-manifest.json").read_text(encoding="utf-8"))
        del ds["splits"]["held_out"]
        (directory / "split-manifest.json").write_text(json.dumps(ds), encoding="utf-8")
    code, out = run(capsys, val, "--data-dir", directory, "--structure-only")
    assert code == 1 and re.search(r"ERR (MISSING_FILE|BAD_JSON|BAD_ROOT) ", out), out


def test_empty_dir_never_passes(tmp_path, capsys):
    (tmp_path / "empty").mkdir()
    code, out = run(capsys, val, "--data-dir", tmp_path / "empty", "--structure-only")
    assert code == 1 and out.count("ERR MISSING_FILE") == 6


def test_minimal_fixture_fails_count_gates_by_default(tmp_path, capsys):
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", build(*MINI)))
    assert code == 1 and "ERR COUNT_G2 safety ALL EMERGENCY: 2 < 20" in out and "ERR COUNT_G3 families" in out
    assert "GATE G2: OPEN" in out and "GATE G3: OPEN" in out


def test_full_counts_pass_both_gates(tmp_path, capsys):
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", build(*FULL)))
    assert code == 0 and "GATE G2: PASS" in out and "GATE G3: PASS" in out and "families_accepted=40" in out, out


@pytest.mark.parametrize(
    ("task", "index", "gate"),
    [("safety-gold", 0, "COUNT_G2"), ("classification-gold", 0, "COUNT_G2"), ("safety-gold", 40, "COUNT_G3")],
)
def test_count_gate_counts_only_accepted(task, index, gate, tmp_path, capsys):
    ds = build(*FULL)
    ds[task]["records"][index]["review"]["status"] = "NEEDS_REVIEW"
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", ds))
    assert code == 1 and f"ERR {gate} " in out, out


def test_validator_never_modifies_inputs(tmp_path, capsys):
    ds = build(*MINI)
    recs(ds, "safety-gold")[0]["signals"][0]["source_quote"] = "sai"
    directory = write(tmp_path / "d", ds)
    before = {p.name: p.read_bytes() for p in directory.iterdir()}
    assert run(capsys, val, "--data-dir", directory)[0] == 1
    assert {p.name: p.read_bytes() for p in directory.iterdir()} == before


def test_usage_errors_exit_2(tmp_path):
    with pytest.raises(SystemExit) as e:
        val.main(["--data-dir", str(tmp_path), "--issues", "x.json"])
    assert e.value.code == 2


# ----------------------------------------------------------------------------- backlog
def item(**over):
    base = {
        "item_id": "D5-B-001",
        "title": "t",
        "kind": "BUG",
        "severity": "MAJOR",
        "priority": "P1",
        "decision": "NOW",
        "owner": "Nhu Y",
        "owner_acceptance": "PROPOSED",
        "dependencies": [],
        "source_issue_refs": ["D4-11"],
        "evidence_refs": ["AGENTS.md"],
        "expected": "e",
        "actual": "a",
        "done_when": {"command": "pytest -q", "expected_result": "exit 0"},
        "status": "OPEN",
        "reviewed_by": None,
        "reviewed_at": None,
    }
    return {**base, **over}


def backlog(*items):
    return root(list(items))


BACKLOG_MUTATIONS = {}


def backlog_mutation(code, *items):
    def register(fn):
        BACKLOG_MUTATIONS[fn.__name__] = (code, items or (item(),), fn)
        return fn

    return register


def patch(**over):
    return lambda bl: bl["records"][0].update(over)


@backlog_mutation("CRITICAL_NOT_P0")
def critical_not_p0(bl):
    patch(severity="CRITICAL", priority="P1")(bl)


@backlog_mutation("CLOSED_NO_RETEST")
def closed_without_retest_evidence(bl):
    patch(status="CLOSED", reviewed_by="Nhu Y", evidence_refs=[])(bl)


@backlog_mutation("CLOSED_NO_REVIEWER")
def closed_without_reviewer(bl):
    patch(status="CLOSED")(bl)


@backlog_mutation("BAD_REF")
def closed_with_missing_retest_file(bl):
    patch(status="CLOSED", reviewed_by="Nhu Y", evidence_refs=["no/such/retest.txt"])(bl)


@backlog_mutation("BAD_REF")
def evidence_ref_missing_file(bl):
    patch(evidence_refs=["AGENTS.md", "planning/nope.md"])(bl)


@backlog_mutation("BAD_REF")
def evidence_ref_absolute_path(bl):
    patch(evidence_refs=[str((val.ROOT / "AGENTS.md").resolve())])(bl)


@backlog_mutation("CONFIRMED_NO_REVIEW")
def confirmed_without_reviewer(bl):
    patch(owner_acceptance="CONFIRMED", reviewed_at="2026-10-08T10:00:00+00:00")(bl)


@backlog_mutation("CONFIRMED_NO_REVIEW")
def confirmed_without_reviewed_at(bl):
    patch(owner_acceptance="CONFIRMED", reviewed_by="Nhu Y")(bl)


@backlog_mutation("DUP_ID", item(), item())
def duplicate_item_id(bl):
    pass


@backlog_mutation("BAD_SCHEMA")
def bad_decision_enum(bl):
    patch(decision="MAYBE")(bl)


@backlog_mutation("BAD_SCHEMA")
def missing_key(bl):
    del bl["records"][0]["title"]


@backlog_mutation("BAD_ID")
def bad_item_id(bl):
    patch(item_id="B-1")(bl)


@backlog_mutation("BAD_DONE_WHEN")
def empty_command(bl):
    patch(done_when={"command": "", "expected_result": "exit 0"})(bl)


@backlog_mutation("BAD_DONE_WHEN")
def blank_expected_result(bl):
    patch(done_when={"command": "pytest", "expected_result": "  "})(bl)


def test_valid_backlog_passes(tmp_path, capsys):
    done = item(
        item_id="D5-B-002",
        status="CLOSED",
        owner_acceptance="CONFIRMED",
        reviewed_by="Nhu Y",
        reviewed_at="2026-10-08T10:00:00+00:00",
        severity="CRITICAL",
        priority="P0",
    )
    path = tmp_path / "backlog.json"
    path.write_text(json.dumps(backlog(item(), done)), encoding="utf-8")
    code, out = run(capsys, val, "--backlog", path)
    assert code == 0 and "RESULT: PASS" in out and "items=2" in out


@pytest.mark.parametrize("name", sorted(BACKLOG_MUTATIONS))
def test_negative_control_backlog(name, tmp_path, capsys):
    code, items, fn = BACKLOG_MUTATIONS[name]
    bl = backlog(*copy.deepcopy(items))
    fn(bl)
    path = tmp_path / "backlog.json"
    path.write_text(json.dumps(bl), encoding="utf-8")
    exit_code, out = run(capsys, val, "--backlog", path)
    assert exit_code == 1 and f"ERR {code} " in out and "VALIDATOR_CRASH" not in out, out


@pytest.mark.parametrize("shape", ["dict", "list"])
def test_issue_coverage(shape, tmp_path, capsys):
    path = tmp_path / "backlog.json"
    path.write_text(json.dumps(backlog(item(source_issue_refs=["D4-01", "D4-02"]))), encoding="utf-8")
    ids = [{"issue_id": "D4-01"}, {"issue_id": "D4-02"}]
    issues = tmp_path / "issues.json"
    issues.write_text(json.dumps({"issues": ids} if shape == "dict" else ids), encoding="utf-8")
    assert run(capsys, val, "--backlog", path, "--issues", issues)[0] == 0
    issues.write_text(json.dumps({"issues": [*ids, {"issue_id": "D4-99"}]}), encoding="utf-8")
    code, out = run(capsys, val, "--backlog", path, "--issues", issues)
    assert code == 1 and "ERR ISSUE_UNCOVERED D4-99" in out


def test_backlog_missing_file_fails(tmp_path, capsys):
    code, out = run(capsys, val, "--backlog", tmp_path / "nope.json")
    assert code == 1 and "ERR MISSING_FILE" in out


# ----------------------------------------------------------------------------- baseline runner
def args(directory, tmp_path, split="develop", mode="rules"):
    return ["--data-dir", directory, "--mode", mode, "--split", split, "--output", tmp_path / "out" / "baseline.json"]


def output(tmp_path):
    return json.loads((tmp_path / "out" / "baseline.json").read_text(encoding="utf-8"))


def test_runner_scores_accepted_gold_with_real_rules(tmp_path, capsys):
    ds = build(*MINI)
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))
    assert code == 0, out
    data = output(tmp_path)
    from src.maintenance.catalog import load_lexicon
    from src.maintenance.rules import classify
    from src.maintenance.safety import assess

    lexicon = load_lexicon()
    cases = {c["case_id"]: c for c in recs(ds, "cases")}
    assert len(data["records"]) == 8  # 5 safety + 3 classification (EM/UNCLEAR are SAFETY_STOP)
    for r in data["records"]:
        text = cases[r["case_id"]]["text"]
        assert r["split"] == "DEVELOP" and r["call_status"] == "OFFLINE" and r["model"] is None
        assert r["result"] in ("MATCH", "MISMATCH") and r["latency_ms"] >= 0
        if r["task"] == "SAFETY_RULES":
            assert r["actual"]["risk_level"] == assess(text, lexicon.safety).risk_level.value
        else:
            c = classify(text)
            assert r["actual"] == {
                "service_category": c.service_category.value,
                "ticket_type": c.ticket_type.value,
                "playbook_id": c.playbook_id.value if c.playbook_id else None,
                "reason_code": c.reason_code.value if c.reason_code else None,
            }
            gold = next(g for g in recs(ds, "classification-gold") if g["case_id"] == r["case_id"])
            assert r["gold"] == {k: gold[k] for k in base.CLS_KEYS}
            assert (r["result"] == "MATCH") == (r["gold"] == r["actual"])
    s = data["summary"]
    assert s["classification"]["eligible"] == 3 and s["classification"]["safety_stop_excluded"] == 2
    # canonical lexicon/classifier examples: the MATCH path exists and a hazard text is predicted EMERGENCY
    assert s["classification"]["correct"] == 3 and s["classification"]["accuracy"] == 1.0
    assert s["safety"]["n_em_expected"] == s["safety"]["n_em_predicted"] == 1 and s["safety"]["FN_EM"] == 0
    assert s["safety"]["n"] == 5 and sum(sum(v.values()) for v in s["safety"]["confusion"].values()) == 5
    assert s["family_count"] == 3 and s["total_cases"] == 5 and s["split_cases"] == 5


def test_runner_manifest_has_hashes_and_versions(tmp_path, capsys):
    directory = write(tmp_path / "d", build(*MINI))
    assert run(capsys, base, *args(directory, tmp_path))[0] == 0
    m = output(tmp_path)["run_manifest"]
    from src.maintenance.catalog import load_lexicon

    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=val.ROOT, capture_output=True, text=True, check=True)
    assert m["git_head"] == head.stdout.strip() and isinstance(m["dirty"], bool)
    assert datetime.fromisoformat(m["generated_utc"]).utcoffset().total_seconds() == 0
    assert m["lexicon_version"] == load_lexicon().lexicon_version and m["dataset_version"] == "t1"
    assert set(m["code_sha256"]) == set(base.CODE_FILES)
    for f, digest in m["code_sha256"].items():
        assert digest == hashlib.sha256((val.ROOT / f).read_bytes()).hexdigest()
    assert set(m["data_sha256"]) == {f"{n}.json" for n in base.NEEDED}
    assert m["data_sha256"]["cases.json"] == hashlib.sha256((directory / "cases.json").read_bytes()).hexdigest()


def test_runner_keeps_gold_on_mismatch_and_counts_fn_em(tmp_path, capsys):
    ds = build(*MINI)
    text = "Hành lang sạch sẽ, không có gì (mã 1)"
    recs(ds, "cases")[0]["text"] = text  # gold says EMERGENCY, the rules cannot see it
    sig = recs(ds, "safety-gold")[0]["signals"][0]
    sig.update(source_quote="Hành lang", start=0, end=9)
    assert run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))[0] == 0  # mismatch is data, not failure
    data = output(tmp_path)
    rec = next(r for r in data["records"] if r["case_id"] == "D5-C-0001")
    assert (
        rec["result"] == "MISMATCH"
        and rec["gold"]["risk_level"] == "EMERGENCY"
        and rec["actual"]["risk_level"] == "NONE"
    )
    assert data["summary"]["safety"]["FN_EM"] == 1 and data["summary"]["safety"]["FP_EM"] == 0
    assert data["summary"]["safety"]["confusion"]["EMERGENCY"] == {"NONE": 1}


def test_runner_exception_is_error_not_invented(tmp_path, capsys, monkeypatch):
    import src.maintenance.rules as rules

    def boom(_text):
        raise RuntimeError("rule crashed")

    monkeypatch.setattr(rules, "classify", boom)
    assert run(capsys, base, *args(write(tmp_path / "d", build(*MINI)), tmp_path))[0] == 0
    data = output(tmp_path)
    cls = [r for r in data["records"] if r["task"] == "CLASSIFICATION_RULES"]
    assert len(cls) == 3 and all(r["result"] == "ERROR" and r["call_status"] == "ERROR" for r in cls)
    assert all(r["actual"] == {"error_type": "RuntimeError"} for r in cls)
    c = data["summary"]["classification"]
    assert (c["correct"], c["error"], c["accuracy"]) == (0, 3, 0.0)


def test_runner_without_accepted_gold_writes_nothing(tmp_path, capsys):
    ds = build(*MINI)
    for name in ("safety-gold", "classification-gold"):
        for r in recs(ds, name):
            r["review"].update(status="PROPOSED", reviewed_by=None, reviewed_at=None)
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))
    assert code == 2 and "NO_VALID_GOLD" in out and not (tmp_path / "out").exists()


def test_runner_missing_files_writes_nothing(tmp_path, capsys):
    directory = write(tmp_path / "d", build(*MINI))
    (directory / "safety-gold.json").unlink()
    code, out = run(capsys, base, *args(directory, tmp_path))
    assert code == 2 and "NO_VALID_GOLD" in out and not (tmp_path / "out").exists()


def test_runner_eligible_case_needs_both_gold(tmp_path, capsys):
    # M3: an ELIGIBLE case with ACCEPTED safety gold but no classification gold is never dropped silently
    ds = build(*MINI)
    ds["classification-gold"]["records"] = []
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))
    assert code == 2 and "GOLD_INCOMPLETE" in out and not (tmp_path / "out").exists()
    assert "D5-C-0003" in out and "D5-C-0004" in out and "D5-C-0005" in out  # the missing_gold listing


def test_runner_refuses_cases_the_validator_rejects(tmp_path, capsys):
    # M4 (was: exclude the case and carry on): any validator error is DATA_INVALID, exit 2, nothing written
    ds = build(*MINI)
    recs(ds, "safety-gold")[0]["review"]["reviewed_by"] = "GPT-6 Luna"
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))
    assert code == 2 and "DATA_INVALID" in out and "ERR REVIEWER_NOT_HUMAN" in out and not (tmp_path / "out").exists()


def test_runner_luna_is_refused(tmp_path, capsys):
    code, out = run(capsys, base, *args(write(tmp_path / "d", build(*MINI)), tmp_path, mode="luna"))
    assert code == 2 and "LUNA_NOT_AUTHORIZED" in out and not (tmp_path / "out").exists()


@pytest.mark.parametrize(
    "frozen", [{}, {"frozen": False, "hash": "abc"}, {"frozen": True}, {"frozen": True, "hash": ""}]
)
def test_runner_held_out_requires_freeze(frozen, tmp_path, capsys):
    ds = build(*MINI)
    ds["split-manifest"].update(frozen)
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path, split="held-out"))
    assert code == 2 and "HELDOUT_NOT_FROZEN" in out and not (tmp_path / "out").exists()


def test_runner_held_out_runs_when_frozen(tmp_path, capsys):
    ds = build(*MINI)
    directory = write(tmp_path / "d", ds)
    ds["split-manifest"].update(frozen=True, hash=val.freeze_hash(directory))  # M2: a real, recomputable hash
    write(directory, ds)
    assert run(capsys, base, *args(directory, tmp_path, split="held-out"))[0] == 0
    data = output(tmp_path)
    assert {r["split"] for r in data["records"]} == {"HELD_OUT"} and data["run_manifest"]["frozen"] is True
    assert data["summary"]["total_cases"] == 2


def test_tools_have_no_network_imports_and_never_load_llm_clients(tmp_path):
    for name in ("validate_day05.py", "run_day05_baseline.py", "build_review_pack.py"):
        assert not re.search(
            r"^\s*(import|from)\s+(openai|requests|httpx|langchain)", (TOOLS / name).read_text("utf-8"), re.M
        )
    directory = write(tmp_path / "d", build(*MINI))
    probe = (
        f"import sys; sys.path.insert(0, {str(TOOLS)!r}); import run_day05_baseline as base\n"
        f"code = base.main(['--data-dir', {str(directory)!r}, '--mode', 'rules', '--split', 'develop', '--output', {str(tmp_path / 'o.json')!r}])\n"
        "print('EXIT', code, sorted({'openai', 'requests', 'httpx'} & set(sys.modules)))"
    )
    done = subprocess.run([sys.executable, "-c", probe], capture_output=True, text=True, encoding="utf-8", check=False)
    assert done.returncode == 0 and "EXIT 0 []" in done.stdout, done.stdout + done.stderr


def test_cli_exit_codes_are_real(tmp_path):
    directory = write(tmp_path / "d", build(*MINI))
    py = [sys.executable]
    good = subprocess.run(
        [*py, str(TOOLS / "validate_day05.py"), "--data-dir", str(directory), "--structure-only"], check=False
    )
    ds = build(*MINI)
    bad_pair(ds)
    broken = write(tmp_path / "bad", ds)
    bad = subprocess.run(
        [*py, str(TOOLS / "validate_day05.py"), "--data-dir", str(broken)], capture_output=True, check=False
    )
    luna = subprocess.run(
        [
            *py,
            str(TOOLS / "run_day05_baseline.py"),
            "--data-dir",
            str(directory),
            "--mode",
            "luna",
            "--split",
            "develop",
            "--output",
            str(tmp_path / "x.json"),
        ],
        capture_output=True,
        check=False,
    )
    assert (good.returncode, bad.returncode, luna.returncode) == (0, 1, 2)


# ----------------------------------------------------------------------------- blind review pack
FORBIDDEN = {
    "family_id",
    "notes",
    "source",
    "proposal",
    "classification_eligibility",
    "eligibility",
    "split",
    "phenomena",
}


def sheet(tmp_path, capsys, ds):
    code, out = run(capsys, pack, "--data-dir", write(tmp_path / "d", ds), "--out", tmp_path / "pack")
    return code, out, tmp_path / "pack" / "blind-review-sheet.json"


def test_blind_sheet_has_only_case_id_text_and_empty_fields(tmp_path, capsys):
    ds = build(*MINI)
    for i, c in enumerate(recs(ds, "cases")):
        c.update(family_id=f"ZZFAMILY{i}", notes=f"ZZNOTE{i}")
        c["source"]["ref"] = f"ZZREF{i}"
    code, _, path = sheet(tmp_path, capsys, ds)
    assert code == 0
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    assert set(data) == {"schema_version", "created_at", "records"} and data["schema_version"] == "day05-1"
    assert len(data["records"]) == 7
    for r in data["records"]:
        assert set(r) == {"case_id", "text", *pack.EMPTY} and not FORBIDDEN & set(r)
        assert {k: r[k] for k in pack.EMPTY} == pack.EMPTY
    assert "ZZFAMILY" not in raw and "ZZNOTE" not in raw and "ZZREF" not in raw and "EXISTING_FIXTURE" not in raw
    assert "DEVELOP" not in raw and "SAFETY_STOP" not in raw and "risk_level" not in raw


def test_blind_sheet_order_is_deterministic_sha256(tmp_path, capsys):
    # B1: the order is a function of sha256(cases.json) + case_id (stable for the same file), and it is NOT the old
    # sha256(case_id) order any more: that one is recomputable by whoever knows the id format.
    ds = build(*MINI)
    ids = [c["case_id"] for c in recs(ds, "cases")]
    old_order = sorted(ids, key=lambda i: hashlib.sha256(i.encode()).hexdigest())
    _, _, path = sheet(tmp_path, capsys, ds)
    first = [r["text"] for r in json.loads(path.read_text(encoding="utf-8"))["records"]]
    _, _, path = sheet(tmp_path / "again", capsys, ds)  # same cases.json bytes -> same order
    again = [r["text"] for r in json.loads(path.read_text(encoding="utf-8"))["records"]]
    assert first == again
    by_id = {c["case_id"]: c["text"] for c in recs(ds, "cases")}
    assert first != [by_id[i] for i in old_order] and first != [by_id[i] for i in ids]


def test_blind_sheet_rejects_unusable_cases(tmp_path, capsys):
    ds = build(*MINI)
    recs(ds, "cases")[1]["case_id"] = recs(ds, "cases")[0]["case_id"]
    code, out, path = sheet(tmp_path, capsys, ds)
    assert code == 1 and "BAD_CASES" in out and not path.exists()
    code, out = run(capsys, pack, "--data-dir", tmp_path / "missing", "--out", tmp_path / "pack2")
    assert code == 1 and "BAD_CASES" in out and not (tmp_path / "pack2").exists()


# ----------------------------------------------------------------------------- H05 harden
def freeze(directory, ds):
    """Freeze for real: the manifest holds the recomputed hash (the manifest itself is not hashed)."""
    ds["split-manifest"].update(frozen=True, hash=val.freeze_hash(directory))
    write(directory, ds)


def test_default_mode_reports_plain_pass(tmp_path, capsys):  # m3: only structure-only is STRUCTURE_PASS
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", build(*FULL)))
    assert code == 0 and "RESULT: PASS" in out and "STRUCTURE_PASS" not in out


def test_reviewer_checks_accept_real_people_and_timestamps(tmp_path, capsys):  # guards against over-blocking (M1)
    for reviewer, when in (
        ("Trường Nguyễn", "2026-10-06T10:00:00+07:00"),
        ("Nhu Y", "2026-10-06T10:00:00"),  # naive = UTC
        ("Lê Văn B", "2026-10-06 10:00:00+00:00"),
    ):
        ds = build(*MINI)
        accepted_review(ds, proposed_by="Truong", reviewed_by=reviewer, reviewed_at=when)
        code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", ds), "--structure-only")
        assert code == 0, (reviewer, when, out)


def test_family_exception_matches_ignoring_case_and_space(tmp_path, capsys):  # M5
    ds = build(*MINI)
    family_over_three(ds)
    ds["split-manifest"]["family_exceptions"] = [{"family_id": " f-d0 ", "reason": "D4-11 matrix, DEVELOP only"}]
    assert run(capsys, val, "--data-dir", write(tmp_path / "d", ds), "--structure-only")[0] == 0


def test_signal_rules_allow_the_legal_shapes(tmp_path, capsys):  # m2
    ds = build(*MINI)
    text = recs(ds, "cases")[2]["text"]
    recs(ds, "safety-gold")[2]["signals"] = [  # NONE with only ABSENT signals
        {"signal_id": "S-01", "status": "ABSENT", "source_quote": text[:3], "start": 0, "end": 3}
    ]
    recs(ds, "safety-gold")[1]["signals"][0].update(status="PRESENT")  # UNCLEAR with a PRESENT T2-01
    code, out = run(capsys, val, "--data-dir", write(tmp_path / "d", ds), "--structure-only")
    assert code == 0, out


def test_freeze_hash_definition(tmp_path):  # M2: the definition written in the docstring, recomputed independently
    directory = write(tmp_path / "d", build(*MINI))
    parts = [
        f"{n}.json:{hashlib.sha256((directory / f'{n}.json').read_bytes()).hexdigest()}"
        for n in ("cases", "classification-gold", "safety-gold", "disputes")
    ]
    assert val.freeze_hash(directory) == hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()
    assert val.freeze_hash(tmp_path / "missing") is None


def test_frozen_manifest_with_matching_hash_validates_and_label_proposals_are_not_covered(tmp_path, capsys):
    ds = build(*MINI)
    directory = write(tmp_path / "d", ds)
    freeze(directory, ds)
    assert run(capsys, val, "--data-dir", directory, "--structure-only")[0] == 0
    (directory / "label-proposals.json").write_text(json.dumps(root([])) + "\n", encoding="utf-8")
    assert run(capsys, val, "--data-dir", directory, "--structure-only")[0] == 0


@pytest.mark.parametrize("target", ["cases", "classification-gold", "safety-gold", "disputes"])
def test_frozen_hash_breaks_when_a_covered_file_changes(target, tmp_path, capsys):
    ds = build(*MINI)
    directory = write(tmp_path / "d", ds)
    freeze(directory, ds)
    with (directory / f"{target}.json").open("a", encoding="utf-8") as handle:
        handle.write("\n")
    code, out = run(capsys, val, "--data-dir", directory, "--structure-only")
    assert code == 1 and "ERR FROZEN_HASH_MISMATCH" in out


@pytest.mark.parametrize("split", ["develop", "held-out"])
def test_runner_refuses_a_frozen_manifest_with_a_wrong_hash(split, tmp_path, capsys):  # M2
    ds = build(*MINI)
    frozen_with_garbage_hash(ds)
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path, split=split))
    assert code == 2 and "FROZEN_HASH_MISMATCH" in out and not (tmp_path / "out").exists()


def test_runner_held_out_rechecks_the_hash_at_run_time(tmp_path, capsys):  # M2: edit AFTER the freeze
    ds = build(*MINI)
    directory = write(tmp_path / "d", ds)
    freeze(directory, ds)
    assert run(capsys, base, *args(directory, tmp_path, split="held-out"))[0] == 0
    cases = directory / "cases.json"
    cases.write_text(cases.read_text(encoding="utf-8").replace("(số 6)", "(số 66)"), encoding="utf-8")
    code, out = run(capsys, base, *args(directory, tmp_path, split="held-out"), "--overwrite")
    assert code == 2 and "FROZEN_HASH_MISMATCH" in out
    assert json.loads((tmp_path / "out" / "baseline.json").read_text(encoding="utf-8"))["summary"]["total_cases"] == 2


@pytest.mark.parametrize("name", sorted(n for n, (code, _) in MUTATIONS.items() if code != "ACCEPTED_OPEN_DISPUTE"))
def test_runner_refuses_every_dataset_mutation(name, tmp_path, capsys):  # M4: any validator error stops the run
    ds = build(*MINI)
    MUTATIONS[name][1](ds)
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))
    assert code == 2 and "DATA_INVALID" in out and "ERR " in out, out
    assert not (tmp_path / "out").exists()


def test_runner_open_dispute_cases_are_excluded_with_a_report(tmp_path, capsys):  # M4/M3: reported, never silent
    ds = build(*MINI)
    recs(ds, "disputes").append(dispute("D5-D-001", "D5-C-0001", "SAFETY"))  # ACCEPTED gold + OPEN dispute
    recs(ds, "disputes").append(dispute("D5-D-002", "D5-C-0002", "SAFETY"))
    recs(ds, "safety-gold")[1]["review"].update(status="NEEDS_REVIEW", reviewed_by=None, reviewed_at=None)
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))
    s = output(tmp_path)["summary"]
    assert code == 0 and s["excluded_open_dispute"] == ["D5-C-0001", "D5-C-0002"] and "D5-C-0001" in out
    assert {r["case_id"] for r in output(tmp_path)["records"]}.isdisjoint({"D5-C-0001", "D5-C-0002"})
    assert s["safety"]["n"] == 3 and s["excluded_not_accepted"] == []


def test_runner_accounts_for_every_case_in_the_split(tmp_path, capsys):  # M3: nothing disappears silently
    ds = build(*MINI)
    recs(ds, "safety-gold")[3]["review"].update(status="NEEDS_REVIEW", reviewed_by=None, reviewed_at=None)
    recs(ds, "disputes").append(dispute("D5-D-001", "D5-C-0002", "SAFETY"))
    assert run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))[0] == 0
    s = output(tmp_path)["summary"]
    accepted = sum(
        g["review"]["status"] == "ACCEPTED" and g["case_id"] in {f"D5-C-000{i}" for i in range(1, 6)}
        for g in recs(ds, "safety-gold")
    )
    assert s["excluded_open_dispute"] == ["D5-C-0002"] and s["excluded_not_accepted"] == ["D5-C-0004"]
    assert s["safety"]["n"] == accepted - len(s["excluded_open_dispute"]) == 3
    assert s["split_cases"] == s["total_cases"] + 2 == 5 and s["classification"]["missing_gold"] == []


@pytest.mark.parametrize("how", ["absent", "not_accepted"])
def test_runner_gold_incomplete_lists_the_missing_cases(how, tmp_path, capsys):  # M3
    ds = build(*MINI)
    if how == "absent":
        recs(ds, "classification-gold").pop(0)
    else:
        recs(ds, "classification-gold")[0]["review"].update(status="NEEDS_REVIEW", reviewed_by=None, reviewed_at=None)
    code, out = run(capsys, base, *args(write(tmp_path / "d", ds), tmp_path))
    assert code == 2 and "GOLD_INCOMPLETE" in out and "['D5-C-0003']" in out and not (tmp_path / "out").exists()


@pytest.mark.parametrize("overwrite", [False, True])
@pytest.mark.parametrize("name", ["safety-gold", "cases", "classification-gold", "split-manifest", "label-proposals"])
def test_runner_never_overwrites_dataset_files(name, overwrite, tmp_path, capsys):  # m1
    directory = write(tmp_path / "d", build(*MINI))
    target = directory / f"{name}.json"
    before = target.read_bytes()
    code, out = run(
        capsys,
        base,
        "--data-dir",
        directory,
        "--mode",
        "rules",
        "--split",
        "develop",
        "--output",
        target,
        *(["--overwrite"] if overwrite else []),
    )
    assert code == 2 and "OUTPUT_CLOBBERS_DATA" in out and target.read_bytes() == before


def test_runner_never_overwrites_dataset_files_via_an_alias_path(tmp_path, capsys):  # m1
    directory = write(tmp_path / "d", build(*MINI))
    alias = directory / ".." / directory.name / "safety-gold.json"
    before = (directory / "safety-gold.json").read_bytes()
    code, out = run(capsys, base, *args(directory, tmp_path)[:-1], alias, "--overwrite")
    assert code == 2 and "OUTPUT_CLOBBERS_DATA" in out and (directory / "safety-gold.json").read_bytes() == before


def test_runner_output_must_be_new_unless_overwrite(tmp_path, capsys):  # m1
    directory = write(tmp_path / "d", build(*MINI))
    target = tmp_path / "out" / "baseline.json"
    target.parent.mkdir()
    target.write_text("OLD", encoding="utf-8")
    code, out = run(capsys, base, *args(directory, tmp_path))
    assert code == 2 and "OUTPUT_EXISTS" in out and target.read_text(encoding="utf-8") == "OLD"
    assert run(capsys, base, *args(directory, tmp_path), "--overwrite")[0] == 0
    assert output(tmp_path)["schema_version"] == "day05-1"
    code, out = run(capsys, base, *args(directory, tmp_path)[:-1], tmp_path, "--overwrite")  # a directory
    assert code == 2 and "OUTPUT_EXISTS" in out


def test_cli_exit_2_for_clobber_and_data_invalid(tmp_path):
    directory = write(tmp_path / "d", build(*MINI))
    py = [sys.executable, str(TOOLS / "run_day05_baseline.py"), "--mode", "rules", "--split", "develop"]
    clobber = subprocess.run(
        [*py, "--data-dir", str(directory), "--output", str(directory / "safety-gold.json")],
        capture_output=True,
        check=False,
    )
    ds = build(*MINI)
    bad_pair(ds)
    invalid = subprocess.run(
        [*py, "--data-dir", str(write(tmp_path / "bad", ds)), "--output", str(tmp_path / "o.json")],
        capture_output=True,
        check=False,
    )
    assert (clobber.returncode, invalid.returncode) == (2, 2) and not (tmp_path / "o.json").exists()


# ---- blind review sheet: opaque ids (B1)
def sheet_records(path):
    return json.loads(path.read_text(encoding="utf-8"))["records"]


def read_map(tmp_path):
    return json.loads((tmp_path / "pack" / "id-map.json").read_text(encoding="utf-8"))


def test_blind_sheet_hides_the_real_case_ids(tmp_path, capsys):
    ds = build(*MINI)
    code, _, path = sheet(tmp_path, capsys, ds)
    raw = path.read_text(encoding="utf-8")
    assert code == 0 and "D5-C-" not in raw and not any(c["case_id"] in raw for c in recs(ds, "cases"))
    assert [r["case_id"] for r in sheet_records(path)] == [f"RV-{n:03d}" for n in range(1, 8)]


def test_blind_sheet_order_is_not_correlated_with_case_id_order(tmp_path, capsys):
    sheet(tmp_path, capsys, build(*FULL))
    mapping = read_map(tmp_path)["map"]
    order = [int(mapping[f"RV-{n:03d}"][-4:]) for n in range(1, 81)]  # original case numbers, in sheet order
    assert sorted(order) == list(range(1, 81)) and order != sorted(order) and order != sorted(order, reverse=True)
    mean = 40.5  # a permutation of 1..80 has the same variance as 1..80, so r = cov / var
    r = sum((x - mean) * (y - mean) for x, y in enumerate(order, 1)) / sum((x - mean) ** 2 for x in range(1, 81))
    assert abs(r) < 0.35, r


def test_id_map_round_trips_and_carries_the_warning(tmp_path, capsys):
    ds = build(*MINI)
    code, out, path = sheet(tmp_path, capsys, ds)
    data = read_map(tmp_path)
    texts = {c["case_id"]: c["text"] for c in recs(ds, "cases")}
    assert code == 0 and "CHỈ cho điều phối, không đưa reviewer" in out and "id-map.json" in out
    assert data["warning"] == "CHỈ cho điều phối, không đưa reviewer" and set(data["map"].values()) == set(texts)
    assert {rv: texts[cid] for rv, cid in data["map"].items()} == {r["case_id"]: r["text"] for r in sheet_records(path)}


def test_map_out_moves_the_map_away_from_the_pack(tmp_path, capsys):
    target = tmp_path / "private" / "map.json"
    code, _ = run(
        capsys,
        pack,
        "--data-dir",
        write(tmp_path / "d", build(*MINI)),
        "--out",
        tmp_path / "pack",
        "--map-out",
        target,
    )
    assert code == 0 and target.is_file() and not (tmp_path / "pack" / "id-map.json").exists()


def test_blind_sheet_seed_follows_the_bytes_of_cases_json(tmp_path, capsys):
    ds = build(*MINI)
    sheet(tmp_path / "a", capsys, ds)
    sheet(tmp_path / "same", capsys, ds)
    recs(ds, "cases")[0]["notes"] = "other bytes"
    sheet(tmp_path / "other", capsys, ds)
    first, same, other = (read_map(tmp_path / n)["map"] for n in ("a", "same", "other"))
    assert first == same and first != other


def test_blind_sheet_rejects_a_text_that_contains_a_case_id(tmp_path, capsys):
    ds = build(*MINI)
    recs(ds, "cases")[1]["text"] += " (xem D5-C-0001)"
    code, out, path = sheet(tmp_path, capsys, ds)
    assert code == 1 and "BAD_CASES" in out and not path.exists()
