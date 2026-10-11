"""G-LIVE: run the labelled sentences through the real engine + reasoning Agent and score the final safety level.

Plan 06 SPEC-P08 §4 (Q30): the semantics of safety (help cries, negation, doubt, lamp requests) are the Agent's job,
so this measures the Agent path with a real model, never `safety.assess` alone. Each sentence gets a fresh in-memory
engine built from the current settings (`.env`: LLM_MODE, MODEL_NAME …), so tickets do not see each other.

Usage (from the repo root):
    PYTHONUTF8=1 PYTHONPATH=. python scripts/agent_live_eval.py [--workers 3] [--group A_help_fire] [--limit N]

Per sentence: final ticket risk, the Agent's own risk, source (AGENT / FALLBACK_RULE / SKIPPED_RULE_EMERGENCY),
latency, and the rule floor for comparison. Summary per group: correct, under (a miss: lower than the label — the
dangerous direction), over (a false alarm), Agent used, fallbacks, latency p50/p90. Exit 0 when the run completed.
"""

import argparse
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("MO_STORE", "memory")
os.environ.setdefault("MO_PHOTO_STORE", "local")

from src.config import get_settings  # noqa: E402
from src.maintenance.catalog import load_lexicon  # noqa: E402
from src.maintenance.common import DEFAULT_RESIDENT_ID  # noqa: E402
from src.maintenance.engine import build_engine  # noqa: E402
from src.maintenance.safety import assess  # noqa: E402

DATA = ROOT / "tests" / "test_maintenance" / "data" / "agent_live_eval.yaml"
ORDER = {"NONE": 0, "UNCLEAR": 1, "EMERGENCY": 2}


def run_one(group: str, expect: str, text: str, settings, rule_lexicon) -> dict:
    started = time.perf_counter()
    row = {"group": group, "expect": expect, "text": text, "rule": assess(text, rule_lexicon).risk_level.value}
    try:
        case = build_engine(settings).receive(text, resident_id=DEFAULT_RESIDENT_ID)
    except Exception as exc:  # noqa: BLE001 - one broken sentence must not stop the run
        row.update(final="ERROR", source="ERROR", agent=None, error=f"{type(exc).__name__}: {exc}"[:160])
        row["seconds"] = time.perf_counter() - started
        return row
    record = case.agent_decision
    row.update(
        final=case.ticket.risk_level.value,
        status=f"{case.ticket.status.value}/{case.ticket.blocker.code.value if case.ticket.blocker else '-'}",
        source=record.source if record else "NONE",
        fallback=record.fallback_reason if record else None,
        agent=record.decision.safety.risk_level if record and record.decision else None,
        reason=(record.decision.safety.reason[:90] if record and record.decision else ""),
        seconds=time.perf_counter() - started,
    )
    return row


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--group", action="append", default=None)
    parser.add_argument("--limit", type=int, default=0, help="at most N sentences per group (0 = all)")
    args = parser.parse_args()

    settings = get_settings()
    data = yaml.safe_load(DATA.read_text(encoding="utf-8"))
    rule_lexicon = load_lexicon().safety
    jobs = []
    for name, group in data["groups"].items():
        if args.group and name not in args.group:
            continue
        items = group["items"][: args.limit] if args.limit else group["items"]
        jobs += [(name, group["expect"], text) for text in items]

    print(
        f"G-LIVE dataset={data['version']} sentences={len(jobs)} llm_mode={settings.llm_mode} "
        f"model={settings.model_name} effort={settings.mo_agent_reasoning_effort or '-'} workers={args.workers}"
    )
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        rows = list(pool.map(lambda job: run_one(*job, settings, rule_lexicon), jobs))

    for r in rows:
        verdict = (
            "OK"
            if r["final"] == r["expect"]
            else ("UNDER" if r["final"] in ORDER and ORDER[r["final"]] < ORDER[r["expect"]] else "OVER")
        )
        r["verdict"] = verdict
        extra = r.get("error") or (f"fallback={r['fallback']}" if r.get("fallback") else r.get("reason", ""))
        print(
            f"[{verdict:5}] {r['group']:15} expect={r['expect']:9} final={r['final']:9} agent={str(r['agent']):9} "
            f"rule={r['rule']:9} src={r['source']:22} {r['seconds']:5.1f}s | {r['text']} | {extra}"
        )

    print("\nSUMMARY")
    for name in dict.fromkeys(r["group"] for r in rows):
        g = [r for r in rows if r["group"] == name]
        secs = sorted(r["seconds"] for r in g)
        p90 = secs[min(len(secs) - 1, int(round(0.9 * (len(secs) - 1))))]
        print(
            f"{name:15} n={len(g):2} correct={sum(r['verdict'] == 'OK' for r in g):2} "
            f"under={sum(r['verdict'] == 'UNDER' for r in g):2} over={sum(r['verdict'] == 'OVER' for r in g):2} "
            f"agent_used={sum(r['source'] == 'AGENT' for r in g):2} "
            f"fallback={sum(r['source'] == 'FALLBACK_RULE' for r in g):2} "
            f"rule_correct={sum(r['rule'] == r['expect'] for r in g):2} "
            f"p50={statistics.median(secs):.1f}s p90={p90:.1f}s"
        )
    total = len(rows)
    print(
        f"TOTAL n={total} correct={sum(r['verdict'] == 'OK' for r in rows)} "
        f"under={sum(r['verdict'] == 'UNDER' for r in rows)} over={sum(r['verdict'] == 'OVER' for r in rows)} "
        f"agent_used={sum(r['source'] == 'AGENT' for r in rows)} "
        f"rule_correct={sum(r['rule'] == r['expect'] for r in rows)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
