"""Sensitivity of the WP12 probes: each probe is re-run in a subprocess against a deliberately broken engine
(monkeypatched in that subprocess only; no file under src/ is touched). A probe that stays green on its mutant would
prove nothing. Pass = every mutant turns its probe RED (exit != 0)."""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MUTANTS = {
    "break1_agent_lowers.py": (
        "the Agent's safety replaces the rules' (reconcile.safety_for returns NONE)",
        "import src.maintenance.engine as E\n"
        "from src.maintenance.safety import SafetyAssessment\n"
        "from src.maintenance.enums import RiskLevel\n"
        "E.safety_for = lambda record, text, lexicon, model: SafetyAssessment(RiskLevel.NONE, ())\n",
    ),
    "break2_injection.py": (
        "the apply-time re-check accepts any duplicate the Agent names",
        "import src.maintenance.engine as E\n"
        "E.MaintenanceEngine._duplicate_still_valid = lambda self, work, other_id, category: True\n",
    ),
    "break3_lock_probe.py": (
        "receive asks the model while holding engine.lock",
        "from src.maintenance.engine import MaintenanceEngine\n"
        "_orig = MaintenanceEngine._prepare_new\n"
        "def _locked(self, raw, resident_id, now):\n"
        "    with self.lock:\n"
        "        return _orig(self, raw, resident_id, now)\n"
        "MaintenanceEngine._prepare_new = _locked\n",
    ),
    "break4_race_threads.py": (
        "a prepared decision is applied even when the content moved on",
        "import src.maintenance.engine as E\n"
        "_orig = E.MaintenanceEngine._decision_for\n"
        "def _stale_ok(self, work, now):\n"
        "    prepared = (getattr(self._local, 'prepared', None) or {}).get(work.ticket.ticket_id)\n"
        "    if prepared is not None and prepared is not E._STALE:\n"
        "        return prepared\n"
        "    return _orig(self, work, now)\n"
        "E.MaintenanceEngine._decision_for = _stale_ok\n",
    ),
    "break6_wrong_split.py": (
        "the rule split verdict always says SPLIT (no cause/hedge/two-places check)",
        "import src.maintenance.rules as R\n"
        "import src.maintenance.coordination.split as SP\n"
        "from src.maintenance.enums import SPLIT_PAIR\n"
        "_always = lambda description, buildings: R.SplitVerdict(SPLIT_PAIR, 'split')\n"
        "R.split_verdict = _always\n"
        "SP.split_verdict = _always\n",
    ),
    "extra_permissions.py": (
        "PERMISSIONS lets the reporting resident merge emergencies",
        "from src.maintenance.engine import PERMISSIONS\n"
        "from src.maintenance.enums import Action, ActorRole\n"
        "PERMISSIONS[Action.BQL_MERGE] = frozenset({ActorRole.BQL, ActorRole.RESIDENT})\n",
    ),
}
PY = sys.executable
results = []
for probe, (what, patch) in MUTANTS.items():
    code = (
        "import runpy, sys\n"
        f"sys.path.insert(0, {str(HERE)!r})\n"
        "import common\n"
        f"{patch}"
        f"sys.argv = [{str(HERE / probe)!r}]\n"
        f"runpy.run_path({str(HERE / probe)!r}, run_name='__main__')\n"
    )
    proc = subprocess.run([PY, "-c", code], capture_output=True, text=True, encoding="utf-8", cwd=str(HERE.parents[4]))
    last = [line for line in (proc.stdout + proc.stderr).splitlines() if line.startswith("RESULT")]
    red = proc.returncode != 0
    results.append((probe, red))
    print(f"{probe}: mutant = {what}")
    print(f"    exit={proc.returncode} -> {'RED (probe catches it)' if red else 'GREEN (probe blind!)'}"
          f" | {last[-1] if last else (proc.stdout + proc.stderr).strip().splitlines()[-1][:200]}")
blind = [p for p, red in results if not red]
print(f"RESULT mutants={len(results)} caught={len(results) - len(blind)} blind={blind}")
raise SystemExit(1 if blind else 0)
