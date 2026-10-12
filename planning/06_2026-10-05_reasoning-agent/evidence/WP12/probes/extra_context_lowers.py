"""Extra probe: the rule floor on the text the engine really assesses (original + "\\n" + addition), versus the addition
alone. Rules only (`safety.assess`), on the code at sys.argv[1] (this worktree or the base 82f01f0 worktree)."""

import os
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
sys.path.insert(0, os.path.abspath(root))

from src.maintenance.catalog import load_lexicon  # noqa: E402
from src.maintenance.safety import assess  # noqa: E402

LEX = load_lexicon().safety
ORDER = {"NONE": 0, "UNCLEAR": 1, "EMERGENCY": 2}
PREFIXES = ["Đèn hành lang không sáng", "Đèn hành lang tầng 3 tòa S1 không sáng", "Hành lang nhiều rác",
            "Tòa S1 tầng 3"]
ADDITIONS = [
    "Khói rất nhiều ở hành lang tầng 9",
    "khoi rat nhieu o tang ham",
    "Hành lang tầng 9 khói rất nhiều, mọi người chạy hết xuống",
    "khoi nhieu o hanh lang tang 4",
    "Có khói bốc ra từ hộp điện",
    "Có mùi gas nồng nặc",
    "Có lửa",
    "Khói mù mịt",
]
worse = 0
for add in ADDITIONS:
    alone = assess(add, LEX).risk_level.value
    for prefix in PREFIXES:
        combined = assess(prefix + "\n" + add, LEX)
        level = combined.risk_level.value
        flag = "LOWER" if ORDER[level] < ORDER[alone] else "ok"
        if flag == "LOWER":
            worse += 1
            sig = sorted({(s.signal_id, s.status.value, s.rule_id) for s in combined.signals})
            print(f"{flag}: alone={alone} combined={level} :: {prefix!r} + {add!r} :: {sig}")
print(f"RESULT root={root} pairs={len(ADDITIONS) * len(PREFIXES)} combined_lower_than_addition_alone={worse}")
raise SystemExit(1 if worse else 0)
