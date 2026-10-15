"""Failure table of the hard cases (tests/test_maintenance/data/adversarial_cases.yaml + unicode cases).

  python scripts/eval_hard_cases.py        prints "Case | Difficulty | Text | Wrong at | Expected -> Got" and per-difficulty pass rate
Exit 0 = every case that is NOT flagged known_bug passes; 1 = an unflagged case fails (a new regression).
"""

import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8")

from tests.test_maintenance.test_adversarial_cases import CASES, mismatches  # noqa: E402


def cell(value) -> str:
    return "/".join(value) if isinstance(value, list) else str(value)


def main() -> int:
    wrong, total, passed = [], Counter(), Counter()
    for case in CASES:
        total[case["difficulty"]] += 1
        found = mismatches(case)
        if found:
            wrong.append((case, found))
        else:
            passed[case["difficulty"]] += 1
    print("## Tất cả case sai\n")
    print("| Case | Độ khó | Nội dung | Sai ở | Mong đợi → Thực tế | Trạng thái |")
    print("| --- | --- | --- | --- | --- | --- |")
    for case, found in wrong:
        fields = ", ".join(found)
        diff = "; ".join(f"{cell(w)} → {cell(g)}" for w, g in found.values())
        text = case["text"].replace("|", r"\|").replace("\n", " ")[:80]
        state = "lỗi đã biết" if case.get("known_bug") else "**MỚI**"
        print(f"| {case['id']} | {case['difficulty']} | {text} | {fields} | {diff} | {state} |")
    print("\n| Độ khó | Đúng | Tổng |\n| --- | --- | --- |")
    for level in ("easy", "medium", "hard"):
        print(f"| {level} | {passed[level]} | {total[level]} |")
    flagged = {c["id"] for c in CASES if c.get("known_bug")}
    new = [c["id"] for c, _ in wrong if c["id"] not in flagged]
    fixed = sorted(flagged - {c["id"] for c, _ in wrong})
    print(
        f"\nTổng {len(CASES)} case, sai {len(wrong)} (đã biết {len(wrong) - len(new)}, mới {len(new)}); đã hết lỗi nhưng còn cờ: {fixed}"
    )
    return 1 if new else 0


if __name__ == "__main__":
    raise SystemExit(main())
