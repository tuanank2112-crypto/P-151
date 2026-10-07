"""Extra probe: a tier-1 danger the resident adds while the ticket is NEED_INFO and the location is STILL incomplete.

Runs on the code found at sys.argv[1] (repo root: this worktree, or the base 82f01f0 worktree), rules only (no Agent:
the gap does not depend on the model). Reports the ticket status/risk after the addition.
"""

import os
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
sys.path.insert(0, os.path.abspath(root))
os.environ["LLM_MODE"] = "mock"

from datetime import datetime, timedelta, timezone  # noqa: E402

from src.maintenance.engine import MaintenanceEngine  # noqa: E402

TZ = timezone(timedelta(hours=7))
NOW = datetime(2026, 9, 28, 9, tzinfo=TZ)
RESIDENT = "SIM-ACTOR-RESIDENT-01"

CASES = [
    ("Đèn hành lang không sáng", "Có mùi gas nồng nặc, sợ quá"),
    ("Đèn hành lang không sáng", "Có khói bốc ra từ hộp điện"),
    ("Đèn hành lang không sáng", "Hộp đèn đang cháy, có lửa!"),
    ("Đèn hành lang không sáng", "Có người bị điện giật ngất ở đây"),
    ("Đèn hành lang không sáng", "Ở tầng 3, có mùi khét và tia lửa"),  # floor given, building still missing
    ("Hành lang nhiều rác", "Có kim tiêm vứt bừa ở đó"),
]

engine = MaintenanceEngine(clock=lambda: NOW)
engine.reset(with_fixtures=False)
bad = 0
for original, addition in CASES:
    tid = engine.receive(original, resident_id=RESIDENT).ticket.ticket_id
    before = engine.get(tid).ticket
    after = engine.add_resident_info(tid, RESIDENT, addition).ticket
    note = after.blocker.internal_note if after.blocker else None
    print(f"{tid} [{before.status}/{before.blocker.code if before.blocker else None}] + {addition!r}"
          f" -> {after.status}/{after.blocker.code if after.blocker else None} risk={after.risk_level} note={note!r}")
    if after.risk_level == "NONE":
        bad += 1
# T06 path: BPTN asked the resident for safety details (NEED_INFO, safety_context); the answer is a tier-1 danger
tid = engine.receive("Hình như có mùi khét ở hành lang", resident_id=RESIDENT).ticket.ticket_id
first = engine.get(tid).ticket
engine.safety_request_info(tid, "SIM-ACTOR-BPTN-01", note="Mô tả rõ hơn giúp")
after = engine.add_resident_info(tid, RESIDENT, "Giờ có lửa bốc lên rồi!").ticket
print(f"{tid} [{first.status}/{first.blocker.code} risk={first.risk_level}] T06 -> + 'Giờ có lửa bốc lên rồi!' -> "
      f"{after.status}/{after.blocker.code if after.blocker else None} risk={after.risk_level}")
t06_bad = int(after.risk_level != "EMERGENCY")
print(f"RESULT root={root} cases={len(CASES) + 1} tier1_addition_left_unassessed={bad} t06_answer_not_emergency={t06_bad}")
raise SystemExit(1 if bad or t06_bad else 0)
