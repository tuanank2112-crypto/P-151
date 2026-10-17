"""Run the hard cases (tests/test_maintenance/data/adversarial_cases.yaml + unicode) through the real engine + Agent (LLM).

Usage: MO_LATENCY_LOG=<dir>/latency.jsonl PYTHONUTF8=1 python scripts/eval_hard_llm.py <dir>/results.json
Then: PYTHONUTF8=1 python scripts/eval_hard_llm_report.py <dir>   (accuracy, p50/p95/p99, tokens)
Costs one OpenAI call per sentence the rule floor does not already mark EMERGENCY."""
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, ".")
os.environ.setdefault("MO_STORE", "memory")
os.environ.setdefault("MO_PHOTO_STORE", "local")

from src.config import get_settings  # noqa: E402
from src.maintenance.common import DEFAULT_RESIDENT_ID  # noqa: E402
from src.maintenance.engine import build_engine  # noqa: E402
from tests.test_maintenance.test_adversarial_cases import CASES  # noqa: E402

OUT = sys.argv[1]
settings = get_settings()


def run(case):
    started = time.perf_counter()
    row = {"id": case["id"], "difficulty": case["difficulty"], "tag": case["tag"], "text": case["text"], "expect": case["expect"]}
    try:
        c = build_engine(settings).receive(case["text"], resident_id=DEFAULT_RESIDENT_ID)
        t = c.ticket
        d = c.agent_decision
        row["ticket"] = {
            "status": t.status.value,
            "blocker": t.blocker.code.value if t.blocker else None,
            "department": t.department_id or t.proposed_department_id,
            "risk": t.risk_level.value,
            "priority": t.priority.value if t.priority else None,
            "flags": [str(f) for f in t.flags],
        }
        row["agent"] = {
            "source": d.source if d else None,
            "fallback": d.fallback_reason if d else None,
            "latency_ms": d.latency_ms if d else None,
            "decision": d.decision.model_dump(mode="json") if d and d.decision else None,
        }
    except Exception as exc:  # noqa: BLE001
        row["error"] = f"{type(exc).__name__}: {exc}"[:300]
    row["seconds"] = time.perf_counter() - started
    return row


with ThreadPoolExecutor(max_workers=4) as pool:
    rows = list(pool.map(run, CASES))
json.dump({"model": settings.model_name, "mode": settings.llm_mode, "rows": rows}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
print("done", len(rows), "errors", sum("error" in r for r in rows))
