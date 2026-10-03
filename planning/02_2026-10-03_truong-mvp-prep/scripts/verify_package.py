"""Read-only package acceptance; run from repository root."""
import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = Path(__file__).resolve().parents[1]
checks = []

def check(name, condition):
    checks.append((name, bool(condition)))
    print(("PASS " if condition else "FAIL ") + name)

for name in ("00-ARCHITECTURE.md", "01-CONTRACTS.md", "OPERATIONS.md", "SPEC-P04-SAFETY.md", "TESTING-ACCEPTANCE.md"):
    p = PACKAGE / "specs" / name
    s = p.read_text(encoding="utf-8-sig")
    check("spec " + name + " present", len(s) > 500)
    check("spec " + name + " non-bootstrap", "Bootstrap contract" not in s)
    check("spec " + name + " balanced fences", s.count("```") % 2 == 0)
s = (PACKAGE / "specs/01-CONTRACTS.md").read_text(encoding="utf-8-sig")
check("signal vocabulary consistent", "UNCERTAIN" not in s)
check("clearance residual floor", "INVALID_CLEARANCE" in s and "target_risk MUST NOT be lower" in s)
check("cross-ticket provenance", "origin_ticket_id" in s)
check("official approval remains pending", "approver=null" in s and "approved_at=null" in s)
check("old input excluded", "LLM receives neither evidence records" in s)
for i, tail in ((1, "scope"), (2, "decisions"), (3, "demos"), (4, "safety"), (5, "targets")):
    h = PACKAGE / "handoffs" / f"H{i:02d}_{tail}.md"
    r = PACKAGE / "reports" / f"R{i:02d}_{tail}.md"
    check(f"H{i:02d} exists", h.exists())
    check(f"R{i:02d} exists", r.exists())
    if h.exists():
        check(f"H{i:02d} <=80 lines", len(h.read_text(encoding="utf-8-sig").splitlines()) <= 80)
    if r.exists():
        lines = r.read_text(encoding="utf-8-sig").strip().splitlines()
        check(f"R{i:02d} provenance", len(lines) > 4 and all(lines[j].startswith(v) for j, v in ((1, "Handoff:"), (2, "Base:"), (3, "Head:"))))
        check(f"R{i:02d} final verdict", lines[-1].startswith(("\u2705", "\U0001f501", "\u26d4")))
    outputs = list((PACKAGE / "evidence" / f"wp{i}").glob("*.txt"))
    check(f"WP{i} machine evidence exists", len(outputs) >= 2 and all(p.stat().st_size > 0 for p in outputs))
for relative in ("src/maintenance/safety.py", "tests/test_maintenance/test_safety_p0.py", "tests/test_maintenance/test_cr03_targets.py"):
    ast.parse((ROOT / relative).read_text(encoding="utf-8-sig"))
    check("syntax " + relative, True)
check("kernel <100 lines", len((ROOT / "brain4agent/memory-distill.txt").read_text(encoding="utf-8-sig").splitlines()) < 100)
state = json.loads((ROOT / "brain4agent/memory/hot/state.json").read_text(encoding="utf-8-sig"))
check("state group pending", state["active_plan"]["group_approval"] == "pending")
check("state runtime pending", state["active_plan"]["runtime_integration"] == "pending")
check("state online pending", state["active_plan"]["online_acceptance"] == "pending")
print(f"total={len(checks)} pass={sum(ok for _,ok in checks)} fail={sum(not ok for _,ok in checks)} skip=0")
raise SystemExit(1 if any(not ok for _,ok in checks) else 0)
