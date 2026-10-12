"""WP12 adversarial probes: shared helpers (read-only use of src/; nothing here is imported by the product).

Run every probe from the repo root:  LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=. <python> planning/.../probes/<probe>.py
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
os.environ.setdefault("LLM_MODE", "mock")

import yaml  # noqa: E402

from src.maintenance.agent.agent import ReasoningAgent  # noqa: E402
from src.maintenance.agent.client import ClientReply, MirrorClient  # noqa: E402
from src.maintenance.catalog import load_catalog, load_lexicon  # noqa: E402
from src.maintenance.engine import MaintenanceEngine  # noqa: E402
from tests.test_maintenance.helpers import (  # noqa: E402,F401
    AGENT,
    BPTN,
    BQL,
    CLN,
    MONDAY_9AM,
    OTHER_RESIDENT,
    RESIDENT,
    SYSTEM,
    TEC,
    WAREHOUSE,
    Clock,
)

DATA = ROOT / "tests" / "test_maintenance" / "data"
DEPT = {"VE_SINH": "DEPT_CLEANING", "KY_THUAT": "DEPT_TECHNICAL"}
PRIO = {"VE_SINH": ("MEDIUM", "PRI-M2"), "KY_THUAT": ("MEDIUM", "PRI-M1")}
ALL_SIGNALS = [f"S-{i:02d}" for i in range(0, 15)] + [f"T2-0{i}" for i in range(1, 6)]


def engine_with(client, clock=None, *, catalog=None, lexicon=None) -> MaintenanceEngine:
    clock = clock or Clock(MONDAY_9AM)
    catalog = catalog or load_catalog()
    lexicon = lexicon or load_lexicon()
    agent = ReasoningAgent(client, catalog=catalog, lexicon=lexicon, model_label="probe", clock=clock)
    engine = MaintenanceEngine(clock=clock, agent=agent, catalog=catalog, lexicon=lexicon)
    engine.reset(with_fixtures=False)
    return engine


def mirror(catalog=None, lexicon=None):
    return MirrorClient(catalog or load_catalog(), lexicon or load_lexicon())


def job(category, quote, *, dept=None, priority=None, rule=None, duplicate_of=None, asset_id=None, materials=None,
        needs_review=False, review_reason=None):
    p, r = PRIO[category]
    return {
        "category": category,
        "quote": quote,
        "reason": "probe",
        "department_id": dept or DEPT[category],
        "priority": priority or p,
        "priority_rule_id": rule or r,
        "priority_reason": "probe",
        "duplicate_of": duplicate_of,
        "duplicate_reason": "probe",
        "asset_id": asset_id,
        "asset_reason": "probe",
        "materials": materials or [],
        "needs_review": needs_review,
        "review_reason": review_reason,
    }


def decision(*, jobs, building=None, floor=None, area=None, loc_quote=None, risk="NONE", signals=(),
             safety_reason="Không thấy nguy hiểm", next_step=None, bptn_reason=None, ask_fields=None, note=""):
    scope = "IN_SCOPE" if jobs else ("OUT_OF_SCOPE" if bptn_reason == "OUT_OF_SCOPE" else "UNCLEAR")
    if next_step is None:
        next_step = "PROCEED" if jobs else "TO_BPTN"
    if next_step == "TO_BPTN" and bptn_reason is None:
        bptn_reason = "CATEGORY_UNCLEAR"
    return json.dumps(
        {
            "schema_version": "agent-decision/1",
            "reasoning": [{"step": "KET_LUAN", "facts": [], "conclusion": "probe"}],
            "safety": {"risk_level": risk, "signals": list(signals), "reason": safety_reason},
            "location": {"building": building, "floor": floor, "area": area, "quote": loc_quote, "reason": "probe"},
            "scope": scope,
            "jobs": jobs,
            "next_step": next_step,
            "ask_fields": ask_fields or [],
            "bptn_reason": bptn_reason if next_step == "TO_BPTN" else None,
            "note_for_staff": note,
        },
        ensure_ascii=False,
    )


class FnClient:
    """A fake model whose answer is computed from the DecisionInput (records every call)."""

    def __init__(self, fn):
        self.fn = fn
        self.calls = []

    def __call__(self, system, user, data):
        self.calls.append(data)
        return ClientReply(text=self.fn(data, user), latency_ms=0.0)


def labelled(path, key, expect):
    doc = yaml.safe_load((DATA / path).read_text(encoding="utf-8"))
    return [(c["id"], c["text"]) for c in doc[key] if c.get("expect") == expect]


def out(*parts):
    print(*parts, flush=True)
