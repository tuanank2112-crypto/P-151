"""Day05 validator (specs/01-CONTRACTS). `--data-dir D` checks the dataset, `--backlog B` the backlog.

Exit 0 = valid, 1 = violations (missing files are violations, never a default PASS). Never writes anything.
`--structure-only` skips the count gates and ends with `RESULT: STRUCTURE_PASS` (gates stay OPEN), never `PASS`.

Freeze hash (orchestrator interpretation of the split-manifest `hash`, no contract change): sha256 of
"\n".join(f"{n}:{sha256(file n)}") with n = cases.json, classification-gold.json, safety-gold.json, disputes.json
in that order. `frozen: true` requires `hash` to equal it; `frozen` false/absent requires no hash.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]  # repo root: tools -> deliverables -> plan -> planning -> root
FILES = ("cases", "classification-gold", "safety-gold", "disputes", "split-manifest", "label-proposals")
SIGNAL = re.compile(r"S-\d\d|T2-0[1-5]")
TIER1 = re.compile(r"S-(0[1-9]|1[0-4])")
CASE_ID = re.compile(r"D5-C-\d{4}")
ITEM_ID = re.compile(r"D5-B-\d{3}")
NOT_HUMAN = re.compile(r"llm|gpt|claude|model|agent|bot|haiku|sonnet|opus", re.I)
NOT_HUMAN_WORD = re.compile(r"(?<![a-z])(ai|codex|gemini|orchestrator|system|bot|tbd|unknown|n/a|none|test)(?![a-z])")
LEET = str.maketrans("013457@$", "oieastas")  # cl4ude -> claude: a digit swap is not a human name
HELDOUT_BAD_REF = re.compile(r"llm|claude|gpt|gemini|codex|agent|model|generated", re.I)
FROZEN_FILES = ("cases", "classification-gold", "safety-gold", "disputes")
TEXT_LEAK_RATIO = 0.9
SECRET = re.compile(
    r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}|postgres(?:ql)?://[^\s/@]+@|SUPABASE_[A-Z_]+"
)
PAIRS = (  # (service_category, ticket_type, playbook_id, reason_code)
    ("VE_SINH", "COMMON_AREA_CLEANING", "PB-CLN-01", None),
    ("KY_THUAT", "COMMON_AREA_LIGHTING", "PB-TEC-01", None),
    ("UNKNOWN", "UNKNOWN", None, "CATEGORY_UNCLEAR"),
    ("UNKNOWN", "UNKNOWN", None, "OUT_OF_SCOPE"),
)
TASKS = ("CLASSIFICATION", "SAFETY")
KEYS = {
    "cases": ("case_id text synthetic family_id phenomena source split classification_eligibility notes".split()),
    "classification-gold": "case_id service_category ticket_type playbook_id reason_code review".split(),
    "safety-gold": "case_id risk_level signals risk_reason review".split(),
    "disputes": (
        "dispute_id case_id task proposed_labels question owner status decision decision_at evidence_refs".split()
    ),
    "label-proposals": "case_id task producer model proposed_at payload call_status error_type".split(),
}
ENUMS = {
    "cases": {"split": ("DEVELOP", "HELD_OUT"), "classification_eligibility": ("ELIGIBLE", "SAFETY_STOP")},
    "classification-gold": {"service_category": ("VE_SINH", "KY_THUAT", "UNKNOWN")},
    "safety-gold": {"risk_level": ("NONE", "UNCLEAR", "EMERGENCY")},
    "disputes": {"task": TASKS, "status": ("OPEN", "RESOLVED")},
    "label-proposals": {
        "task": TASKS,
        "producer": ("HUMAN", "LLM"),
        "call_status": ("OFFLINE", "SUCCESS", "ERROR"),
    },
}
REVIEW_KEYS = "status proposed_by reviewed_by reviewed_at rationale spec_refs dispute_id".split()
REVIEW_STATUS = ("PROPOSED", "NEEDS_REVIEW", "ACCEPTED", "REJECTED")
SOURCE_KINDS = ("AUTHORED", "EXISTING_FIXTURE", "USER_REPORTED_SYNTHETIC", "LLM_PROPOSAL")
SIGNAL_KEYS = "signal_id status source_quote start end".split()
# G2 totals (ALL) and G3 per-split quotas: (safety risk -> n, classification category -> n). Counted on ACCEPTED only.
QUOTA = {
    "ALL": ({"EMERGENCY": 20, "UNCLEAR": 20, "NONE": 40}, {"VE_SINH": 15, "KY_THUAT": 15, "UNKNOWN": 10}),
    "DEVELOP": ({"EMERGENCY": 15, "UNCLEAR": 15, "NONE": 20}, {"VE_SINH": 8, "KY_THUAT": 8, "UNKNOWN": 4}),
    "HELD_OUT": ({"EMERGENCY": 5, "UNCLEAR": 5, "NONE": 20}, {"VE_SINH": 7, "KY_THUAT": 7, "UNKNOWN": 6}),
}
MIN_FAMILIES = 32
G3_CODES = {
    "COUNT_G3",
    "SPLIT_MISMATCH",
    "FAMILY_LEAK",
    "FAMILY_TOO_BIG",
    "BAD_EXCEPTION",
    "D4_11_HELD_OUT",
    "HELDOUT_NOT_AUTHORED",
    "TEXT_LEAK",
    "FROZEN_HASH_MISMATCH",
    "FROZEN_INCONSISTENT",
}
BACKLOG_KEYS = (
    "item_id title kind severity priority decision owner owner_acceptance dependencies source_issue_refs "
    "evidence_refs expected actual done_when status reviewed_by reviewed_at".split()
)
BACKLOG_ENUMS = {
    "kind": ("BUG", "DATA", "SPEC", "FEATURE", "EVIDENCE"),
    "severity": ("CRITICAL", "MAJOR", "MINOR", "NA"),
    "priority": ("P0", "P1", "P2"),
    "decision": ("NOW", "NEXT", "DEFER", "NO_ACTION"),
    "owner_acceptance": ("PROPOSED", "CONFIRMED"),
    "status": ("OPEN", "IN_PROGRESS", "FIXED_PENDING_RETEST", "CLOSED"),
}


def iso(value) -> bool:
    try:
        datetime.fromisoformat(value)
        return True
    except (TypeError, ValueError):
        return False


def stamp(value):
    """ISO8601 date AND time -> aware datetime (naive = UTC); None for date-only/garbage/non-str."""
    if not (isinstance(value, str) and re.match(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}", value.strip())):
        return None
    try:
        when = datetime.fromisoformat(value.strip())
    except ValueError:
        return None
    return when if when.tzinfo else when.replace(tzinfo=UTC)


def fold(text) -> str:
    """NFC + casefold + no diacritics (d-stroke -> d) + single spaces: the form two names are compared in."""
    plain = unicodedata.normalize("NFD", unicodedata.normalize("NFC", text).casefold())
    return " ".join("".join(c for c in plain if not unicodedata.combining(c)).replace("\u0111", "d").split())


def squash(text) -> str:
    """fold() without spaces/punctuation: texts that differ only in case, accents or punctuation are equal."""
    return "".join(c for c in fold(text) if c.isalnum())


def person(value) -> bool:
    return isinstance(value, str) and sum(c.isalpha() for c in value) >= 2


def not_human(name) -> bool:
    plain = fold(name)
    return any(NOT_HUMAN.search(f) or NOT_HUMAN_WORD.search(f) for f in (plain, plain.translate(LEET)))


def fkey(family) -> str:
    return family.strip().casefold()


def freeze_hash(data_dir):
    """The freeze hash defined in the module docstring; None when a covered file is unreadable."""
    try:
        parts = [
            f"{n}.json:{hashlib.sha256((Path(data_dir) / f'{n}.json').read_bytes()).hexdigest()}" for n in FROZEN_FILES
        ]
    except OSError:
        return None
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def accepted(gold) -> bool:
    return (
        isinstance(gold, dict) and isinstance(gold.get("review"), dict) and gold["review"].get("status") == "ACCEPTED"
    )


def load(data_dir, names=FILES):
    """-> (roots {name: root dict}, errors). A missing/unreadable/ill-rooted file is an error, never an empty PASS."""
    roots, errs = {}, []
    for name in names:
        path = Path(data_dir) / f"{name}.json"
        try:
            root = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            errs.append(("MISSING_FILE", path.name, ()))
            continue
        except (OSError, ValueError) as exc:
            errs.append(("BAD_JSON", f"{path.name}: {type(exc).__name__}", ()))
            continue
        ok = (
            isinstance(root, dict)
            and root.get("schema_version") == "day05-1"
            and iso(root.get("created_at"))
            and isinstance(root.get("records"), list)
        )
        if ok and name == "split-manifest":
            splits = root.get("splits")
            ok = (
                isinstance(root.get("dataset_version"), str)
                and isinstance(root.get("source_hashes"), dict)
                and isinstance(splits, dict)
                and all(
                    isinstance(splits.get(k), list) and all(isinstance(i, str) for i in splits[k])
                    for k in ("develop", "held_out")
                )
            )
        if ok:
            roots[name] = root
        else:
            errs.append(("BAD_ROOT", path.name, ()))
    return roots, errs


def analyze(roots, count_gate=True, freeze_actual=None):
    """-> (errors [(code, detail, case_ids)], index). Counts only ACCEPTED gold; count gates need count_gate.

    freeze_actual = freeze_hash() recomputed by the caller; a frozen manifest must carry exactly this value.
    """
    errs = []

    def err(code, detail, *ids):
        errs.append((code, detail, tuple(i for i in ids if isinstance(i, str))))

    def recs(name):
        out = []
        for i, r in enumerate(roots.get(name, {}).get("records", [])):
            if not isinstance(r, dict):
                err("BAD_SCHEMA", f"{name}[{i}] is not an object")
                continue
            miss = [k for k in KEYS[name] if k not in r]
            bad = [k for k, ok in ENUMS.get(name, {}).items() if k in r and r[k] not in ok]
            if miss or bad:
                err("BAD_SCHEMA", f"{name}[{i}] missing={miss} bad_enum={bad}", r.get("case_id"))
            else:
                out.append(r)
        return out

    def index(name, key):
        out = {}
        for r in recs(name):
            k = r[key]
            if not isinstance(k, str):
                err("BAD_SCHEMA", f"{name}.{key} is not a string", r.get("case_id"))
                continue
            if k in out:
                err("DUP_ID", f"{name}:{k}", r.get("case_id"))
            out[k] = r
        return out

    cases = index("cases", "case_id")
    safety = index("safety-gold", "case_id")
    cls = index("classification-gold", "case_id")
    disputes = index("disputes", "dispute_id")
    proposals = recs("label-proposals")
    manifest = roots.get("split-manifest", {})

    for cid, c in cases.items():
        src = c["source"]
        if not CASE_ID.fullmatch(cid):
            err("BAD_ID", cid, cid)
        if not (isinstance(c["text"], str) and c["text"] and isinstance(c["family_id"], str) and c["family_id"]):
            err("BAD_SCHEMA", f"{cid}: text/family_id", cid)
        if c["synthetic"] is not True:
            err("BAD_SCHEMA", f"{cid}: synthetic must be true", cid)
        if not (isinstance(src, dict) and src.get("kind") in SOURCE_KINDS and "ref" in src and "original_id" in src):
            err("BAD_SCHEMA", f"{cid}: source", cid)

    for name, ix in (("classification-gold", cls), ("safety-gold", safety)):
        for cid in ix:
            if cid not in cases:
                err("MISSING_REF", f"{name}:{cid}", cid)
    for d in disputes.values():
        if d["case_id"] not in cases:
            err("MISSING_REF", f"disputes:{d['dispute_id']} -> {d['case_id']}", d["case_id"])
    for p in proposals:
        if p["case_id"] not in cases:
            err("MISSING_REF", f"label-proposals -> {p['case_id']}", p["case_id"])
    for cid in manifest.get("splits", {}).get("develop", []) + manifest.get("splits", {}).get("held_out", []):
        if cid not in cases:
            err("MISSING_REF", f"split-manifest -> {cid}", cid)

    def review(name, cid, g):
        rv = g["review"] if "review" in g else None
        if not (isinstance(rv, dict) and all(k in rv for k in REVIEW_KEYS) and rv["status"] in REVIEW_STATUS):
            err("BAD_SCHEMA", f"{name}:{cid}.review", cid)
            return
        if rv["status"] != "ACCEPTED":
            return
        by, proposer, refs = rv["reviewed_by"], rv["proposed_by"], rv["spec_refs"]
        gap = [k for k, v in (("reviewed_by", by), ("proposed_by", proposer)) if not person(v)]
        gap += [k for k in ("reviewed_at",) if not rv[k]]
        gap += [k for k in ("rationale",) if not (isinstance(rv[k], str) and rv[k].strip())]
        if not (isinstance(refs, list) and refs and all(isinstance(r, str) and r.strip() for r in refs)):
            gap.append("spec_refs")
        if gap:
            err("ACCEPTED_INCOMPLETE", f"{name}:{cid} missing/blank {','.join(gap)}", cid)
        if person(by):
            if person(proposer) and fold(by) == fold(proposer):
                err("REVIEWER_SAME", f"{name}:{cid} reviewer == proposer", cid)
            if not_human(by):
                err("REVIEWER_NOT_HUMAN", f"{name}:{cid} reviewer looks like a model/agent", cid)
        if rv["reviewed_at"]:
            when = stamp(rv["reviewed_at"])
            if when is None:
                err("BAD_SCHEMA", f"{name}:{cid}.reviewed_at must be ISO8601 with a time", cid)
            elif when > datetime.now(UTC):
                err("REVIEWED_AT_FUTURE", f"{name}:{cid}.reviewed_at is in the future", cid)
        did, task = rv["dispute_id"], "SAFETY" if name == "safety-gold" else "CLASSIFICATION"
        if did is not None and not isinstance(did, str):
            err("BAD_SCHEMA", f"{name}:{cid}.review.dispute_id must be a string or null", cid)
        if isinstance(did, str) and did not in disputes:
            err("MISSING_REF", f"{name}:{cid} dispute {did}", cid)
        if any(
            d["status"] == "OPEN" and (d["dispute_id"] == did or (d["case_id"] == cid and d["task"] == task))
            for d in disputes.values()
        ):
            err("ACCEPTED_OPEN_DISPUTE", f"{name}:{cid} has an OPEN dispute", cid)

    for cid, g in cls.items():
        review("classification-gold", cid, g)
        if (g["service_category"], g["ticket_type"], g["playbook_id"], g["reason_code"]) not in PAIRS:
            err(
                "BAD_PAIR",
                f"{cid}: {g['service_category']}/{g['ticket_type']}/{g['playbook_id']}/{g['reason_code']}",
                cid,
            )
        if cid in cases and cases[cid]["classification_eligibility"] != "ELIGIBLE":
            err("CLS_NOT_ELIGIBLE", f"{cid}: case is SAFETY_STOP", cid)
        if cid in safety and safety[cid]["risk_level"] != "NONE":
            err("CLS_NOT_ELIGIBLE", f"{cid}: safety risk is {safety[cid]['risk_level']}", cid)

    for cid, g in safety.items():
        review("safety-gold", cid, g)
        text = cases[cid]["text"] if cid in cases and isinstance(cases[cid]["text"], str) else ""
        sigs = g["signals"]
        if not isinstance(sigs, list):
            err("BAD_SCHEMA", f"{cid}.signals is not a list", cid)
            sigs = []
        for s in sigs:
            if not (
                isinstance(s, dict)
                and all(k in s for k in SIGNAL_KEYS)
                and s["status"] in ("PRESENT", "ABSENT", "UNCLEAR")
            ):
                err("BAD_SCHEMA", f"{cid}: signal shape", cid)
                continue
            if not (isinstance(s["signal_id"], str) and SIGNAL.fullmatch(s["signal_id"])):
                err("BAD_SIGNAL_ID", f"{cid}: {s['signal_id']!r}", cid)
            a, b, q = s["start"], s["end"], s["source_quote"]
            if cid in cases and not (
                type(a) is int
                and type(b) is int
                and isinstance(q, str)
                and q
                and 0 <= a <= b <= len(text)
                and text[a:b] == q
            ):
                err("BAD_QUOTE", f"{cid}: {s['signal_id']} [{a}:{b}] != quote", cid)
        has_tier1 = any(
            isinstance(s, dict) and s.get("status") == "PRESENT" and TIER1.fullmatch(str(s.get("signal_id")))
            for s in sigs
        )
        if g["risk_level"] == "EMERGENCY" and not has_tier1:
            err("EM_NO_TIER1", f"{cid}: EMERGENCY without a PRESENT tier-1 signal (S-01..S-14)", cid)
        live = [s for s in sigs if isinstance(s, dict) and s.get("status") != "ABSENT"]
        if g["risk_level"] == "UNCLEAR" and not any(
            s.get("status") == "UNCLEAR" or str(s.get("signal_id")).startswith("T2-") for s in live
        ):
            err("UNCLEAR_NO_SIGNAL", f"{cid}: UNCLEAR needs a non-ABSENT signal (status UNCLEAR or T2-0x)", cid)
        if g["risk_level"] == "NONE" and live:
            err("NONE_HAS_SIGNAL", f"{cid}: NONE allows only signals=[] or all ABSENT", cid)
        if accepted(g) and cid in cases:
            want = "ELIGIBLE" if g["risk_level"] == "NONE" else "SAFETY_STOP"
            if cases[cid]["classification_eligibility"] != want:
                err("ELIGIBILITY_MISMATCH", f"{cid}: safety {g['risk_level']} needs {want}", cid)

    if "split-manifest" in roots:
        sp = {"DEVELOP": set(manifest["splits"]["develop"]), "HELD_OUT": set(manifest["splits"]["held_out"])}
        for cid, c in cases.items():
            member = [s for s, ids in sp.items() if cid in ids]
            if member != [c["split"]]:
                err("SPLIT_MISMATCH", f"{cid}: case={c['split']} manifest={member}", cid)
    raw = manifest.get("family_exceptions") or []
    if not isinstance(raw, (list, dict)):
        err("BAD_EXCEPTION", "family_exceptions must be a list of {family_id, reason} or an object")
        raw = []
    exc = (
        dict(raw)
        if isinstance(raw, dict)
        else {e.get("family_id"): e.get("reason") for e in raw if isinstance(e, dict)}
    )
    fam = defaultdict(list)  # family ids compare strip+casefold: "f-d4-11" and "F-D4-11 " are one family
    for cid, c in cases.items():
        if isinstance(c["family_id"], str):
            fam[fkey(c["family_id"])].append(cid)
    exc = {fkey(f): reason for f, reason in exc.items() if isinstance(f, str)}
    for f, reason in exc.items():
        if not (isinstance(reason, str) and reason.strip()):
            err("BAD_EXCEPTION", f"{f}: exception without reason")
        if any(cases[i]["split"] != "DEVELOP" for i in fam.get(f, [])):
            err("BAD_EXCEPTION", f"{f}: exception family must be DEVELOP only", *fam[f])
    for f, ids in fam.items():
        splits = {cases[i]["split"] for i in ids}
        if len(splits) > 1:
            err("FAMILY_LEAK", f"{f} spans {sorted(splits)}", *ids)
        if len(ids) > 3 and f not in exc:
            err("FAMILY_TOO_BIG", f"{f} has {len(ids)} cases (>3, no exception)", *ids)
        if f.startswith("f-d4-11") and "HELD_OUT" in splits:
            err("D4_11_HELD_OUT", f"{f} must stay DEVELOP", *ids)
    for cid, c in cases.items():
        src = c["source"]
        if c["split"] == "HELD_OUT" and isinstance(src, dict):
            ref = src.get("ref")
            if src.get("kind") != "AUTHORED":
                err("HELDOUT_NOT_AUTHORED", f"{cid}: source.kind={src.get('kind')}", cid)
            elif not (isinstance(ref, str) and ref.strip()) or HELDOUT_BAD_REF.search(ref):
                err("HELDOUT_NOT_AUTHORED", f"{cid}: AUTHORED needs a non-empty, human source.ref", cid)
    develop = [
        (i, squash(c["text"])) for i, c in cases.items() if c["split"] == "DEVELOP" and isinstance(c["text"], str)
    ]
    for cid, c in cases.items():
        if c["split"] != "HELD_OUT" or not isinstance(c["text"], str) or not squash(c["text"]):
            continue
        mine = squash(c["text"])
        for other, theirs in develop:
            if theirs and (mine == theirs or difflib.SequenceMatcher(None, mine, theirs).ratio() >= TEXT_LEAK_RATIO):
                err("TEXT_LEAK", f"{cid} HELD_OUT text ~ DEVELOP {other}", cid, other)
                break
    if "split-manifest" in roots:
        frozen, digest = manifest.get("frozen"), manifest.get("hash")
        if frozen is True:
            if not (isinstance(digest, str) and digest and digest == freeze_actual):
                err("FROZEN_HASH_MISMATCH", f"manifest hash {digest!r} != recomputed {freeze_actual}")
        elif (frozen is not None and frozen is not False) or digest not in (None, ""):
            err("FROZEN_INCONSISTENT", f"frozen={frozen!r} with hash={digest!r}: a hash needs frozen=true")

    def scan(node, path, cid):
        if isinstance(node, str):
            if SECRET.search(node):
                err("SECRET", path, cid)
        elif isinstance(node, dict):
            for k, v in node.items():
                scan(v, f"{path}.{k}", cid)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                scan(v, f"{path}[{i}]", cid)

    for name, root in roots.items():
        for i, r in enumerate(root["records"]):
            scan(r, f"{name}[{i}]", r.get("case_id") if isinstance(r, dict) else None)
        scan({k: v for k, v in root.items() if k != "records"}, name, None)

    tally = Counter()
    for kind, ix, label in (("safety", safety, "risk_level"), ("cls", cls, "service_category")):
        for cid, g in ix.items():
            if accepted(g) and cid in cases:
                for scope in ("ALL", cases[cid]["split"]):
                    tally[kind, scope, g[label]] += 1
    families = len(
        {
            fkey(f)
            for c, g in safety.items()
            if accepted(g) and c in cases and isinstance(f := cases[c]["family_id"], str)
        }
    )
    if count_gate:
        for scope, (risk, category) in QUOTA.items():
            for kind, need in (("safety", risk), ("cls", category)):
                for label, n in need.items():
                    if tally[kind, scope, label] < n:
                        err(
                            "COUNT_G2" if scope == "ALL" else "COUNT_G3",
                            f"{kind} {scope} {label}: {tally[kind, scope, label]} < {n}",
                        )
        if families < MIN_FAMILIES:
            err("COUNT_G3", f"families {families} < {MIN_FAMILIES}")
        orphan = {c for c, g in cls.items() if accepted(g)} - {
            c for c, g in safety.items() if accepted(g) and g["risk_level"] == "NONE"
        }
        if orphan:
            err("COUNT_G2", "ACCEPTED classification gold without ACCEPTED NONE safety gold", *orphan)
    ix = {"cases": cases, "safety": safety, "cls": cls, "disputes": disputes, "tally": tally, "families": families}
    return errs, ix


def check(data_dir, count_gate=True):
    """-> (roots, errors, index): load + analyze, the one entry point of the CLI and of the baseline runner."""
    roots, errs = load(data_dir)
    more, ix = analyze(roots, count_gate=count_gate, freeze_actual=freeze_hash(data_dir))
    return roots, errs + more, ix


def ref_exists(ref) -> bool:
    path = Path(str(ref).split("#")[0])
    return bool(path.parts) and not path.is_absolute() and (ROOT / path).is_file()


def check_backlog(path, issues_path=None):
    """-> (errors, item count). Evidence refs are repo-root relative files that must exist."""
    errs = []

    def err(code, detail):
        errs.append((code, detail, ()))

    try:
        root = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [("MISSING_FILE", str(path), ())], 0
    except (OSError, ValueError) as exc:
        return [("BAD_JSON", f"{path}: {type(exc).__name__}", ())], 0
    if not (
        isinstance(root, dict)
        and root.get("schema_version") == "day05-1"
        and iso(root.get("created_at"))
        and isinstance(root.get("records"), list)
    ):
        return [("BAD_ROOT", str(path), ())], 0
    seen, covered = set(), set()
    for i, it in enumerate(root["records"]):
        if not isinstance(it, dict) or [k for k in BACKLOG_KEYS if k not in it]:
            err("BAD_SCHEMA", f"backlog[{i}] missing keys or not an object")
            continue
        iid = it["item_id"]
        if not (isinstance(iid, str) and ITEM_ID.fullmatch(iid)):
            err("BAD_ID", f"backlog[{i}] item_id={iid!r}")
        elif iid in seen:
            err("DUP_ID", iid)
        else:
            seen.add(iid)
        for k, ok in BACKLOG_ENUMS.items():
            if it[k] not in ok:
                err("BAD_SCHEMA", f"{iid}.{k}={it[k]!r}")
        lists = [it[k] for k in ("dependencies", "source_issue_refs", "evidence_refs")]
        if not all(isinstance(v, list) and all(isinstance(x, str) for x in v) for v in lists):
            err("BAD_SCHEMA", f"{iid}: dependencies/source_issue_refs/evidence_refs must be string lists")
            continue
        covered.update(it["source_issue_refs"])
        if it["severity"] == "CRITICAL" and it["priority"] != "P0":
            err("CRITICAL_NOT_P0", f"{iid}: CRITICAL but {it['priority']}")
        dw = it["done_when"]
        if not (
            isinstance(dw, dict)
            and all(isinstance(dw.get(k), str) and dw[k].strip() for k in ("command", "expected_result"))
        ):
            err("BAD_DONE_WHEN", f"{iid}: done_when.command/expected_result must be non-empty")
        for ref in it["evidence_refs"]:
            if not ref_exists(ref):
                err("BAD_REF", f"{iid}: evidence_ref {ref!r} is not a file under the repo root")
        if it["status"] == "CLOSED":
            if not it["reviewed_by"]:
                err("CLOSED_NO_REVIEWER", iid)
            if not it["evidence_refs"]:
                err("CLOSED_NO_RETEST", f"{iid}: CLOSED without retest evidence")
        if it["owner_acceptance"] == "CONFIRMED" and not (it["reviewed_by"] and it["reviewed_at"]):
            err("CONFIRMED_NO_REVIEW", iid)
        if it["reviewed_at"] and not iso(it["reviewed_at"]):
            err("BAD_SCHEMA", f"{iid}.reviewed_at not ISO8601")
    if issues_path:
        try:
            obj = json.loads(Path(issues_path).read_text(encoding="utf-8"))
            ids = {i["issue_id"] for i in (obj["issues"] if isinstance(obj, dict) else obj)}
            for iid in sorted(ids - covered):
                err("ISSUE_UNCOVERED", f"{iid} is in no source_issue_refs")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            err("BAD_ISSUES", f"{issues_path}: {type(exc).__name__}")
    return errs, len(root["records"])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--data-dir")
    mode.add_argument("--backlog")
    ap.add_argument("--structure-only", action="store_true", help="skip count gates G2/G3 (data-dir only)")
    ap.add_argument("--issues", help="issues.json whose every issue_id must be in a source_issue_refs (backlog only)")
    a = ap.parse_args(argv)
    if (a.issues and not a.backlog) or (a.structure_only and not a.data_dir):
        ap.error("--issues needs --backlog; --structure-only needs --data-dir")
    try:
        if a.backlog:
            errs, n = check_backlog(a.backlog, a.issues)
            print(f"COUNT backlog items={n}")
        else:
            _, errs, ix = check(a.data_dir, count_gate=not a.structure_only)
            for scope, quota in QUOTA.items():
                for kind, labels in zip(("safety", "cls"), quota, strict=True):
                    print(f"COUNT {kind} {scope} " + " ".join(f"{k}={ix['tally'][kind, scope, k]}" for k in labels))
            open_n = sum(d["status"] == "OPEN" for d in ix["disputes"].values())
            print(f"COUNT cases={len(ix['cases'])} families_accepted={ix['families']} open_disputes={open_n}")
            g3 = not any(e[0] in G3_CODES for e in errs)
            g2 = not any(e[0] not in G3_CODES for e in errs)
            for gate, ok in (("G2", g2), ("G3", g3)):
                print(f"GATE {gate}: {'PASS' if ok and not a.structure_only else 'OPEN'}")
    except Exception as exc:  # fail closed: a crash is a violation, not a PASS
        print(f"ERR VALIDATOR_CRASH {type(exc).__name__}: {exc}")
        errs = [("VALIDATOR_CRASH", "", ())]
        print("RESULT: FAIL")
        return 1
    for code, detail, _ in errs:
        print(f"ERR {code} {detail}")
    print(f"RESULT: {'FAIL' if errs else 'STRUCTURE_PASS' if a.structure_only else 'PASS'}")
    return 1 if errs else 0


if __name__ == "__main__":
    raise SystemExit(main())
