"""Eval run of the fixed rules: Frame 1 safety, Frame 2 classification (CR-BPTN-03 section 15). No model, no network.

  python scripts/eval_labels.py                    held-out labels (CSV, labels A=Truong + B=reviewer)
  python scripts/eval_labels.py --dev              the existing developer-written sets (regression, NOT independent)

CSV columns: id,text,safety_truong,safety_reviewer,class_truong,class_reviewer,trap
safety labels EMERGENCY (Bac 1) | UNCLEAR (Bac 2) | NONE; class labels CLN | TEC | OUT | UNCLEAR. A held-out row
counts only when both labellers agree. One run writes docs/eval/runs/<run_id>/{manifest.json,metrics.json,report.md,
traces.jsonl}. Exit 0 = every gated target met on >= 40 rows (or --dev), 1 = a target missed, 2 = no decision possible.
"""

import csv
import hashlib
import json
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8")

import yaml  # noqa: E402

from src.maintenance.catalog import load_lexicon  # noqa: E402
from src.maintenance.rules import classify  # noqa: E402
from src.maintenance.safety import assess  # noqa: E402

MIN_ROWS = 40  # CR-BPTN-03 section 15
HELDOUT = ROOT / "tests/test_maintenance/data/heldout_labels.csv"
RUNS = ROOT / "docs/eval/runs"
DATA = ROOT / "tests/test_maintenance/data"
LEX = load_lexicon().safety
LEVELS = ["NONE", "UNCLEAR", "EMERGENCY"]
DEV_PREFIX = "Hành lang tầng 3 tòa S1: "
CLASSES = ("CLN", "TEC", "OUT", "UNCLEAR")


def class_of(text: str) -> str:
    result = classify(text)
    if result.playbook_id == "PB-TEC-01":
        return "TEC"
    if result.playbook_id == "PB-CLN-01":
        return "CLN"
    return "UNCLEAR" if result.reason_code == "CATEGORY_UNCLEAR" else "OUT"


def engine_safety(text: str) -> tuple[str, list[str]]:
    result = assess(text, LEX)
    fired = [f"{s.signal_id}:{s.status.value}" for s in result.signals if s.status.value != "ABSENT"]
    return str(result.risk_level.value), fired


def load_heldout(path: Path) -> tuple[list[dict], list[dict], dict]:
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
    safety, klass = [], []
    for r in rows:
        group = r["trap"] or "-"
        if r["safety_truong"] and r["safety_reviewer"]:
            safety.append(
                {"id": r["id"], "text": r["text"], "a": r["safety_truong"], "b": r["safety_reviewer"], "group": group}
            )
        if r["class_truong"] and r["class_reviewer"]:
            klass.append(
                {"id": r["id"], "text": r["text"], "a": r["class_truong"], "b": r["class_reviewer"], "group": group}
            )
    return safety, klass, {"labels": "A=Truong + B=reviewer (agreed rows only)", "files": [str(path.relative_to(ROOT))]}


def load_dev() -> tuple[list[dict], list[dict], dict]:
    from tests.test_maintenance.test_classify_metamorphic import CORPUS

    p0 = yaml.safe_load((DATA / "safety_cases_p0.yaml").read_text(encoding="utf-8"))
    p1 = yaml.safe_load((DATA / "safety_cases_p1.yaml").read_text(encoding="utf-8"))
    cr3 = json.loads((ROOT / "seed/maintenance_cr03/safety_cases.json").read_text(encoding="utf-8"))["cases"]
    safety = []
    groups = (
        ("p0", p0["safety_cases"]),
        ("regression", p0["regression_strings"]),
        ("p1_catch", p1["must_catch"]),
        ("p1_not_raise", p1["must_not_raise"]),
    )
    for name, cases in groups:
        for c in cases:
            want = c.get("expect_any") or c["expect"]
            safety.append({"id": c["id"], "text": c["text"], "a": want, "b": want, "group": name})
    for c in cr3:
        want = c["expected_risk"]
        safety.append(
            {
                "id": c["case_id"],
                "text": c["text"],
                "a": want,
                "b": want,
                "group": "cr03_json",
                "prev": c["previous_risk"],
            }
        )
    # corpus sentences carry no location by design (area-gated words are OUT without one): same prefix as the test
    klass = [
        {"id": f"C{i + 1:03d}", "text": f"{DEV_PREFIX}{s.rstrip('.?! ')}", "a": e, "b": e, "group": e}
        for i, (s, e) in enumerate(CORPUS)
    ]
    src = {
        "labels": "dev: written by the rule authors, NOT independent (regression only)",
        "files": [
            "tests/test_maintenance/data/safety_cases_p0.yaml",
            "tests/test_maintenance/data/safety_cases_p1.yaml",
            "seed/maintenance_cr03/safety_cases.json",
            "tests/test_maintenance/test_classify_metamorphic.py",
        ],
    }
    return safety, klass, src


def ok(want, got) -> bool:
    return got in want if isinstance(want, list) else got == want


def key(label) -> str:
    return "|".join(label) if isinstance(label, list) else label


def kappa(pairs: list[tuple[str, str]]) -> float | None:
    n = len(pairs)
    if not n:
        return None
    po = sum(a == b for a, b in pairs) / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum(ca[k] * cb[k] for k in ca) / (n * n)
    return 1.0 if pe == 1 else (po - pe) / (1 - pe)


def fmt(v) -> str:
    return "–" if v is None else (f"{v:.3f}" if isinstance(v, float) else str(v))


def ratio(num: int, den: int) -> float | None:
    return num / den if den else None


class Table:
    def __init__(self, title: str):
        self.title, self.rows, self.metrics = title, [], {}

    def add(self, name: str, value, n: int, target=None, better: str = "high", gate: bool = False):
        flag = ""
        if target is not None and value is not None:
            good = value >= target if better == "high" else value <= target
            flag = "✅" if good else "❌"
        shown = "report" if target is None else fmt(target)
        self.rows.append(f"| {name} | {fmt(value)} | {n} | {shown} | {flag} |")
        self.metrics[name] = {
            "value": value,
            "n": n,
            "target": target,
            "pass": None if not flag else flag == "✅",
            "gate": gate,
        }

    def md(self) -> str:
        head = f"## {self.title}\n\n| Metric | Value | n | Target | |\n| --- | --- | --- | --- | --- |\n"
        return head + "\n".join(self.rows) + "\n"


def frame_safety(rows: list[dict], traces: list[dict]) -> Table:
    t = Table("Frame 1 — safety (Bậc 1 EMERGENCY / Bậc 2 UNCLEAR / NONE)")
    gold = [r for r in rows if r["a"] == r["b"]]
    got = {}
    for r in gold:
        level, fired = engine_safety(r["text"])
        level = max(level, r.get("prev", "NONE"), key=LEVELS.index)
        got[(r["group"], r["id"])] = level
        traces.append(
            {
                "frame": "safety",
                "id": r["id"],
                "group": r["group"],
                "text": r["text"],
                "label": r["a"],
                "engine": level,
                "signals": fired,
            }
        )
    level_of = lambda r: got[(r["group"], r["id"])]  # noqa: E731
    single = [r for r in gold if isinstance(r["a"], str)]
    multi = [r for r in gold if isinstance(r["a"], list)]
    em = [r for r in single if r["a"] == "EMERGENCY"]
    miss = [r for r in em if level_of(r) != "EMERGENCY"]
    none = [r for r in single if r["a"] == "NONE"]
    unc = [r for r in single if r["a"] == "UNCLEAR"]
    t.add("Bậc 1 recall (EMERGENCY gold → EMERGENCY)", ratio(len(em) - len(miss), len(em)), len(em), 1.0, "high", True)
    t.add("Bậc 1 misses (count)", len(miss), len(em), 0, "low", True)
    t.add(
        "False alarm → Bậc 1 (NONE gold → EMERGENCY)",
        ratio(sum(level_of(r) == "EMERGENCY" for r in none), len(none)),
        len(none),
    )
    t.add(
        "False alarm → any alert (NONE gold → Bậc 1 or 2)",
        ratio(sum(level_of(r) != "NONE" for r in none), len(none)),
        len(none),
    )
    t.add(
        "Bậc 2 recall (UNCLEAR gold → Bậc 1 or 2)", ratio(sum(level_of(r) != "NONE" for r in unc), len(unc)), len(unc)
    )
    t.add(
        "Exact level match (single-label rows)",
        ratio(sum(level_of(r) == r["a"] for r in single), len(single)),
        len(single),
    )
    t.add(
        "Accept-set rows inside their set", ratio(sum(ok(r["a"], level_of(r)) for r in multi), len(multi)), len(multi)
    )
    pairs = [(key(r["a"]), key(r["b"])) for r in rows]
    t.add("Labeller agreement (raw)", ratio(sum(a == b for a, b in pairs), len(pairs)), len(pairs))
    t.add("Labeller agreement (Cohen kappa)", kappa(pairs), len(pairs))
    by = defaultdict(list)
    for r in gold:
        by[r["group"]].append(r)
    for g, items in sorted(by.items()):
        t.add(
            f"Match (exact or in accept-set), group {g}",
            ratio(sum(ok(r["a"], level_of(r)) for r in items), len(items)),
            len(items),
        )
    return t


def frame_class(rows: list[dict], traces: list[dict]) -> Table:
    t = Table("Frame 2 — classification (CLN / TEC / OUT / UNCLEAR)")
    gold = [r for r in rows if r["a"] == r["b"]]
    got = {}
    for r in gold:
        got[(r["group"], r["id"])] = class_of(r["text"])
        traces.append(
            {
                "frame": "class",
                "id": r["id"],
                "group": r["group"],
                "text": r["text"],
                "label": r["a"],
                "engine": got[(r["group"], r["id"])],
            }
        )
    cls_of = lambda r: got[(r["group"], r["id"])]  # noqa: E731
    t.add("Accuracy", ratio(sum(cls_of(r) == r["a"] for r in gold), len(gold)), len(gold))
    for c in CLASSES:
        tp = sum(1 for r in gold if r["a"] == c and cls_of(r) == c)
        want = sum(1 for r in gold if r["a"] == c)
        have = sum(1 for r in gold if cls_of(r) == c)
        prec, rec = ratio(tp, have), ratio(tp, want)
        f1 = 2 * prec * rec / (prec + rec) if prec and rec else (0.0 if want and have else None)
        t.add(f"{c}: precision", prec, have)
        t.add(f"{c}: recall", rec, want)
        t.add(f"{c}: F1", f1, want)
    pairs = [(r["a"], r["b"]) for r in rows]
    t.add("Labeller agreement (raw)", ratio(sum(a == b for a, b in pairs), len(pairs)), len(pairs))
    t.add("Labeller agreement (Cohen kappa)", kappa(pairs), len(pairs))
    return t


def git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def main(argv: list[str]) -> int:
    dev = "--dev" in argv
    started = datetime.now(UTC)
    if dev:
        safety, klass, src = load_dev()
    else:
        if not HELDOUT.exists():
            print(f"Không thấy {HELDOUT}")
            return 2
        safety, klass, src = load_heldout(HELDOUT)
    if not safety and not klass:
        print("Chưa có dòng nào đủ 2 nhãn: không ghi run")
        return 2
    traces: list[dict] = []
    frames = [frame_safety(safety, traces), frame_class(klass, traces)]
    run_id = f"eval-{'dev' if dev else 'heldout'}-{started:%Y%m%dT%H%M%SZ}"
    out = RUNS / run_id
    out.mkdir(parents=True)
    dirty = " (dirty tree)" if git("status", "--porcelain") else ""
    head = (
        f"# Eval run {run_id}\n\n- Labels: {src['labels']}\n- Commit `{git('rev-parse', '--short=12', 'HEAD')}`{dirty}, "
        f"started {started.isoformat()}\n- Engine: fixed rules only (LLM_MODE=mock), no model, no network\n\n"
    )
    (out / "report.md").write_text(head + "\n".join(f.md() for f in frames), encoding="utf-8")
    metrics = {f.title: f.metrics for f in frames}
    (out / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "traces.jsonl").write_text(
        "".join(json.dumps(t, ensure_ascii=False) + "\n" for t in traces), encoding="utf-8"
    )
    digest = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()[:16] for p in src["files"] if (ROOT / p).exists()}
    manifest = {
        "run_id": run_id,
        "mode": "dev" if dev else "heldout",
        "commit": git("rev-parse", "HEAD"),
        "started": started.isoformat(),
        "python": sys.version.split()[0],
        "argv": argv,
        "rows": {"safety": len(safety), "class": len(klass)},
        "inputs_sha256_16": digest,
        "labels": src["labels"],
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out.relative_to(ROOT)} ({len(traces)} traces)")
    gates = [m for f in frames for m in f.metrics.values() if m["gate"]]
    if any(m["pass"] is False for m in gates):
        return 1
    short = not dev and min(len(safety), len(klass)) < MIN_ROWS
    return 2 if short or any(m["pass"] is None for m in gates) else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
