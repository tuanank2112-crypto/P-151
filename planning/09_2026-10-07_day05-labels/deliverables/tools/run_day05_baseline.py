"""Day05 offline baseline: runs the deterministic rules (classify/assess) against ACCEPTED gold only.

Exit 0 = baseline written (mismatches are data, not failures); 2 = refused, nothing written:
LUNA_NOT_AUTHORIZED, OUTPUT_CLOBBERS_DATA, OUTPUT_EXISTS (use --overwrite), HELDOUT_NOT_FROZEN, DATA_INVALID (ANY
validator error in structure-only mode, except an OPEN dispute, which excludes that case with a report; includes
FROZEN_HASH_MISMATCH, recomputed at run time), GOLD_INCOMPLETE (an ELIGIBLE case with ACCEPTED safety gold but no
ACCEPTED classification gold), NO_VALID_GOLD. Nothing is skipped silently: summary lists every excluded case.
No network, no LLM, no database. Freeze hash definition: see validate_day05.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

import validate_day05 as val

CODE_FILES = (
    "src/maintenance/rules.py",
    "src/maintenance/safety.py",
    "src/maintenance/proposer.py",
    "seed/maintenance_v1/lexicon.yaml",
)
NEEDED = tuple(n for n in val.FILES if n != "label-proposals")  # proposals never feed the metric
PROTECTED = (*val.FILES, "backlog")  # data files an --output may never overwrite, --overwrite or not
CLS_KEYS = ("service_category", "ticket_type", "playbook_id", "reason_code")


def sha256(path):
    p = Path(path)
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None


def git(*args):
    try:
        done = subprocess.run(["git", *args], cwd=val.ROOT, capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return done.stdout.strip()


def value(x):
    return getattr(x, "value", x)


def same_file(a, b):
    try:
        return os.path.samefile(a, b)
    except OSError:  # one of them does not exist yet: compare the spelled paths
        return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def measure(case_id, split, task, produce, gold, keys):
    """One BaselineRecord: an exception is ERROR (no invented answer), never a MATCH."""
    started = time.perf_counter()
    try:
        actual = produce()
        result, status = ("MATCH" if all(actual[k] == gold[k] for k in keys) else "MISMATCH"), "OFFLINE"
    except Exception as exc:  # a rule crash must show up as ERROR in the record
        actual, result, status = {"error_type": type(exc).__name__}, "ERROR", "ERROR"
    return {
        "case_id": case_id,
        "split": split,
        "task": task,
        "gold": gold,
        "actual": actual,
        "result": result,
        "model": None,
        "call_status": status,
        "latency_ms": round((time.perf_counter() - started) * 1000, 3),
        "evidence_refs": [],
    }


def active_ids(pairs):
    """Sorted signal ids that are PRESENT or UNCLEAR, from (signal_id, status) pairs."""
    return sorted({sid for sid, status in pairs if status in ("PRESENT", "UNCLEAR")})


def summarize(records, scope_cases, in_split, excl_open, excl_not_accepted):
    safety = [r for r in records if r["task"] == "SAFETY_RULES"]
    cls = [r for r in records if r["task"] == "CLASSIFICATION_RULES"]
    risk = lambda r, side: r[side].get("risk_level", "ERROR")  # noqa: E731
    confusion = defaultdict(Counter)
    for r in safety:
        confusion[risk(r, "gold")][risk(r, "actual")] += 1
    count = Counter(r["result"] for r in cls)
    return {
        "safety": {
            "n": len(safety),
            "n_em_expected": sum(risk(r, "gold") == "EMERGENCY" for r in safety),
            "n_em_predicted": sum(risk(r, "actual") == "EMERGENCY" for r in safety),
            "FN_EM": sum(risk(r, "gold") == "EMERGENCY" and risk(r, "actual") != "EMERGENCY" for r in safety),
            "FP_EM": sum(risk(r, "gold") != "EMERGENCY" and risk(r, "actual") == "EMERGENCY" for r in safety),
            "error": sum(r["result"] == "ERROR" for r in safety),
            "signal_set_differs": sum(
                r["result"] == "MATCH" and r["gold"]["signal_ids"] != r["actual"]["signal_ids"] for r in safety
            ),
            "confusion": {g: dict(a) for g, a in confusion.items()},
        },
        "classification": {
            "eligible": len(cls),
            "correct": count["MATCH"],
            "mismatch": count["MISMATCH"],
            "error": count["ERROR"],
            "accuracy": round(count["MATCH"] / len(cls), 4) if cls else None,
            "safety_stop_excluded": sum(c["classification_eligibility"] == "SAFETY_STOP" for c in scope_cases),
            "missing_gold": [],  # always [] in a written file: a non-empty list is GOLD_INCOMPLETE, exit 2
        },
        "split_cases": len(in_split),
        "total_cases": len(scope_cases),
        "family_count": len({val.fkey(c["family_id"]) for c in scope_cases}),
        "excluded_open_dispute": excl_open,  # OPEN dispute on the case: reported, never scored
        "excluded_not_accepted": excl_not_accepted,  # no ACCEPTED safety gold: reported, never scored
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--mode", choices=("rules", "luna"), required=True)
    ap.add_argument("--split", choices=("develop", "held-out"), required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--overwrite", action="store_true", help="allow replacing an existing --output (never a data file)")
    a = ap.parse_args(argv)
    if a.mode == "luna":
        print("LUNA_NOT_AUTHORIZED: only --mode rules is allowed in this package")
        return 2
    out = Path(a.output)
    if any(same_file(out, Path(a.data_dir) / f"{n}.json") for n in PROTECTED):
        print(f"OUTPUT_CLOBBERS_DATA: --output {out} is a dataset file")
        return 2
    if out.is_dir() or (out.exists() and not a.overwrite):
        print(f"OUTPUT_EXISTS: {out} already exists (--overwrite replaces a previous baseline)")
        return 2
    split = {"develop": "DEVELOP", "held-out": "HELD_OUT"}[a.split]
    manifest = val.load(a.data_dir, ("split-manifest",))[0].get("split-manifest", {})
    if split == "HELD_OUT" and not (manifest.get("frozen") is True and manifest.get("hash")):
        print("HELDOUT_NOT_FROZEN: split-manifest needs frozen=true and a hash")
        return 2
    try:
        roots, errs, ix = val.check(a.data_dir, count_gate=False)  # structure-only: any error below stops the run
    except Exception as exc:  # fail closed: a validator crash is invalid data
        roots, errs, ix = {}, [("VALIDATOR_CRASH", f"{type(exc).__name__}: {exc}", ())], {}
    fatal = [e for e in errs if e[0] != "ACCEPTED_OPEN_DISPUTE"]  # those cases are excluded + reported instead
    if fatal:
        codes = sorted({e[0] for e in fatal})
        print(f"DATA_INVALID: {len(fatal)} validator error(s) {codes}, no valid gold (NO_VALID_GOLD), nothing written")
        for code, detail, _ in fatal[:30]:
            print(f"ERR {code} {detail}")
        return 2
    manifest = roots["split-manifest"]
    open_cases = {d["case_id"] for d in ix["disputes"].values() if d["status"] == "OPEN"}
    open_cases |= {i for e in errs for i in e[2]}  # ACCEPTED_OPEN_DISPUTE: the only error that is not fatal
    in_split = sorted((c for c in ix["cases"].values() if c["split"] == split), key=lambda c: c["case_id"])
    scope, excl_open, excl_not_accepted, missing = [], [], [], []
    for c in in_split:
        cid = c["case_id"]
        if cid in open_cases:
            excl_open.append(cid)
        elif not val.accepted(ix["safety"].get(cid)):
            excl_not_accepted.append(cid)
        elif c["classification_eligibility"] == "ELIGIBLE" and not val.accepted(ix["cls"].get(cid)):
            missing.append(cid)
        else:
            scope.append(c)
    if missing:
        print(f"GOLD_INCOMPLETE: ELIGIBLE cases without ACCEPTED classification gold: {missing}")
        return 2
    if not scope:
        print(f"NO_VALID_GOLD: no case in {split} has valid ACCEPTED gold")
        return 2

    sys.path.insert(0, str(val.ROOT))  # `src` lives at the repo root
    from src.maintenance.catalog import load_lexicon  # read-only engine functions, imported only when scoring
    from src.maintenance.rules import classify
    from src.maintenance.safety import assess

    lexicon = load_lexicon()

    def safety_actual(text):
        r = assess(text, lexicon.safety)
        return {
            "risk_level": value(r.risk_level),
            "signal_ids": active_ids((s.signal_id, value(s.status)) for s in r.signals),
        }

    records = []
    for c in scope:
        cid, text = c["case_id"], c["text"]
        sg = ix["safety"][cid]
        gold = {
            "risk_level": sg["risk_level"],
            "signal_ids": active_ids((s["signal_id"], s["status"]) for s in sg["signals"]),
        }
        records.append(measure(cid, split, "SAFETY_RULES", lambda t=text: safety_actual(t), gold, ("risk_level",)))
        if c["classification_eligibility"] == "ELIGIBLE":
            gold = {k: ix["cls"][cid][k] for k in CLS_KEYS}
            actual = lambda t=text: {k: value(getattr(classify(t), k)) for k in CLS_KEYS}  # noqa: E731
            records.append(measure(cid, split, "CLASSIFICATION_RULES", actual, gold, CLS_KEYS))
    data_dir = Path(a.data_dir)
    run_manifest = {
        "generated_utc": datetime.now(UTC).isoformat(),
        "git_head": git("rev-parse", "HEAD"),
        "dirty": bool(git("status", "--porcelain")),
        "dirty_code_paths": (git("status", "--porcelain", "--", *CODE_FILES) or "").splitlines(),
        "mode": a.mode,
        "split": split,
        "lexicon_version": lexicon.lexicon_version,
        "dataset_version": manifest.get("dataset_version"),
        "frozen": manifest.get("frozen") is True,
        "manifest_hash": manifest.get("hash"),
        "freeze_hash_recomputed": val.freeze_hash(data_dir),
        "code_sha256": {f: sha256(val.ROOT / f) for f in CODE_FILES},
        "data_sha256": {f"{n}.json": sha256(data_dir / f"{n}.json") for n in NEEDED},
    }
    result = {
        "schema_version": "day05-1",
        "created_at": run_manifest["generated_utc"],
        "records": records,
        "summary": summarize(records, scope, in_split, excl_open, excl_not_accepted),
        "run_manifest": run_manifest,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    s = result["summary"]
    print(f"BASELINE split={split} cases={s['total_cases']} families={s['family_count']} written={a.output}")
    print("SAFETY " + json.dumps({k: v for k, v in s["safety"].items() if k != "confusion"}))
    print("CLASSIFICATION " + json.dumps(s["classification"]))
    print(f"EXCLUDED open_dispute={excl_open} not_accepted={excl_not_accepted}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
