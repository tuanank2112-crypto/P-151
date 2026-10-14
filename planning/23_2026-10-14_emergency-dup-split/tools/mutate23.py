import shutil
import subprocess
import sys
from pathlib import Path

MUTANTS = [
    (
        "m1 no mark in 2b",
        "src/maintenance/engine.py",
        "suspect_of = self._mark_emergency_duplicate(work, now)  # plan 23 P01: flag + count, never merge",
        "suspect_of = None",
    ),
    (
        "m2 always counted",
        "src/maintenance/coordination/merge.py",
        "counted = suspect_of != into  # already counted on `into` when it was marked",
        "counted = True",
    ),
    (
        "m3 no release on downgrade",
        "src/maintenance/engine.py",
        "self._release_duplicate_count(work, blocker, now)  # plan 23 P01 §2: a downgraded suspect is not counted",
        "pass",
    ),
    (
        "m4 child not cleared",
        "src/maintenance/coordination/split.py",
        "        if work.ticket.safety_cleared_at is not None:\n",
        "        if False:\n",
    ),
    (
        "m5 agent never reads an emergency",
        "src/maintenance/agent/agent.py",
        'if state["rules"].safety.risk_level == RiskLevel.EMERGENCY and not state.get("read_emergency"):\n            return "skip"',
        'if state["rules"].safety.risk_level == RiskLevel.EMERGENCY:\n            return "skip"',
    ),
    (
        "m11 unread emergency holds",
        "src/maintenance/coordination/neighbors.py",
        "            if kinds is not None and mine in kinds:",
        "            if kinds is None or mine in kinds:",
    ),
    (
        "m6 no repoint after merge",
        "src/maintenance/coordination/merge.py",
        "            self._repoint_suspects(work, now)  # plan 23 P01 §3: its own suspects now point at `into`\n",
        "",
    ),
    (
        "m7 follow-up not copied to split child",
        "src/maintenance/coordination/split.py",
        "            self._set_ticket(child, follow_up_of=work.ticket.follow_up_of)\n",
        "            pass\n",
    ),
    (
        "m8 merged kinds ignored",
        "src/maintenance/coordination/neighbors.py",
        "            kinds = self._merged_kinds(self._case_view(emergency_id))",
        "            kinds = self._emergency_kinds(self._case_view(emergency_id))",
    ),
    (
        "m9 pinned kind ignored",
        "src/maintenance/coordination/neighbors.py",
        "        if pinned:\n            return frozenset({ServiceCategory(pinned)})\n",
        "",
    ),
    (
        "m10 no repoint on downgrade",
        "src/maintenance/engine.py",
        "                self._repoint_suspects(work, now)  # plan 23 P01 §3, before step 4 may count it as an ordinary root\n",
        "                pass\n",
    ),
    (
        "m12 root may be a suspect",
        "src/maintenance/coordination/merge.py",
        "root_id = (roots or older)[0].ticket_id if older else None",
        "root_id = older[0].ticket_id if older else None",
    ),
    (
        "m13 shortage on any line",
        "src/maintenance/engine.py",
        "m.item_code in reported and m.material_stock_status",
        "m.material_stock_status",
    ),
]
ONLY = sys.argv[1:]
for name, path, old, new in MUTANTS:
    if ONLY and name.split()[0] not in ONLY:
        continue
    p = Path(path)
    orig = p.read_text(encoding="utf-8")
    assert orig.count(old) == 1, (name, orig.count(old))
    backup = p.with_suffix(".bak")
    shutil.copy(p, backup)
    p.write_text(orig.replace(old, new), encoding="utf-8")
    try:
        r = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/test_maintenance/test_p23_emergency_coordination.py", "tests/test_maintenance/test_p24_material_requests.py", "-q",
             "-p", "no:cacheprovider"],
            capture_output=True, text=True,
        )
        print(f"{name}: exit={r.returncode} {r.stdout.strip().splitlines()[-1]}", flush=True)
    finally:
        shutil.move(backup, p)
