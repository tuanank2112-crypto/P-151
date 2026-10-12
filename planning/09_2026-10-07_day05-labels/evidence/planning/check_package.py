"""Check the proposed SPEC package; does not generate labels or run the app."""
from __future__ import annotations

import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = ROOT / "planning/09_2026-10-07_day05-labels"
REQUIRED = [
    "plan.md",
    "specs/00-ARCHITECTURE.md",
    "specs/01-CONTRACTS.md",
    "specs/SPEC-P01-BACKLOG.md",
    "specs/SPEC-P02-LABELS.md",
    "specs/OPERATIONS.md",
    "specs/TESTING-ACCEPTANCE.md",
]
SOURCE_REFS = [
    "docs/maintenance.md",
    "docs/CR-BPTN-03.md",
    "seed/maintenance_cr03/safety_cases.json",
    "tests/test_maintenance/test_safety_p0.py",
    "tests/test_maintenance/test_classify_metamorphic.py",
    "src/maintenance/rules.py",
    "src/maintenance/safety.py",
    "src/maintenance/proposer.py",
    "planning/07_2026-10-04_online-acceptance/deliverables/issues.json",
    "planning/07_2026-10-04_online-acceptance/evidence/normalization-20261007/safety-child-trapped.json",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(files):
    require(set(files) == set(REQUIRED), "MISSING_SPEC")
    for name, content in files.items():
        require(content.startswith("# "), "TITLE_MISSING:" + name)
        if name.startswith("specs/"):
            require("CẤM" in content or "cấm" in content, "FORBIDDEN_SCOPE_MISSING:" + name)
            require("Lỗi" in content or "lỗi" in content, "ERROR_BEHAVIOR_MISSING:" + name)
            require("nghiệm thu" in content.lower() or "Gates" in content or "Xong khi" in content, "ACCEPTANCE_MISSING:" + name)
    for target in re.findall(r"\]\(([^)]+)\)", files["plan.md"]):
        require((PLAN / target).is_file(), "PLAN_ROUTER_BROKEN:" + target)
    plan = files["plan.md"]
    require("PROPOSED" in plan and "2026-10-05" in plan and "pending" in plan, "PLAN_APPROVAL_OR_DATE_MISSING")
    require("SourceCase=" not in plan and "ClassificationGold=" not in plan, "DESIGN_IN_PLAN")
    contracts = files["specs/01-CONTRACTS.md"]
    for token in ["SourceCase=", "ClassificationGold=", "SafetyGold=", "GoldSignal=", "Review=", "BacklogItem=", "BaselineRecord=", "day05-1", "SAFETY_STOP", "source_quote", "family_id"]:
        require(token in contracts, "CONTRACT_MISSING:" + token)
    for token in ["VE_SINH", "KY_THUAT", "UNKNOWN", "COMMON_AREA_CLEANING", "COMMON_AREA_LIGHTING", "NONE", "UNCLEAR", "EMERGENCY"]:
        require(token in contracts, "ENUM_MISSING:" + token)
    arch = files["specs/00-ARCHITECTURE.md"]
    require("80" in arch and "40" in arch and "develop50" in arch and "held-out30" in arch, "DATASET_TARGET_MISSING")
    labels = files["specs/SPEC-P02-LABELS.md"]
    require("D4-11" in labels and "S1/S5" in labels and "AUTHORED" in labels and "DEVELOP" in labels, "REGRESSION_OR_HOLDOUT_RULE_MISSING")
    require("Như Ý" in files["specs/SPEC-P01-BACKLOG.md"] and "CRITICAL/P0" in files["specs/SPEC-P01-BACKLOG.md"], "SAFETY_OWNER_MISSING")
    require("chưa có trong repo" in files["specs/OPERATIONS.md"], "PLANNED_TOOLS_NOT_DISCLOSED")
    require("CHƯA THỰC HIỆN" in files["specs/TESTING-ACCEPTANCE.md"], "UNEXECUTED_DATA_NOT_DISCLOSED")
    require(not (PLAN / "deliverables/classification-gold.json").exists(), "GOLD_GENERATED_DURING_PLANNING")


def main():
    files = {name: (PLAN / name).read_text(encoding="utf-8") for name in REQUIRED}
    validate(files)
    for failure in ["missing_spec", "missing_gold_contract", "missing_holdout_rule"]:
        bad = copy.deepcopy(files)
        if failure == "missing_spec":
            del bad["specs/OPERATIONS.md"]
        elif failure == "missing_gold_contract":
            bad["specs/01-CONTRACTS.md"] = bad["specs/01-CONTRACTS.md"].replace("SafetyGold=", "RemovedGold=")
        else:
            bad["specs/SPEC-P02-LABELS.md"] = bad["specs/SPEC-P02-LABELS.md"].replace("AUTHORED", "REMOVED")
        try:
            validate(bad)
        except ValueError as exc:
            print(f"NEGATIVE_CONTROL {failure}: rejected ({exc})")
        else:
            raise RuntimeError("ACCEPTED_BAD_SPEC:" + failure)
    for source in SOURCE_REFS:
        require((ROOT / source).is_file(), "SOURCE_REF_MISSING:" + source)
    cases = json.loads((ROOT / "seed/maintenance_cr03/safety_cases.json").read_text(encoding="utf-8"))["cases"]
    require(len(cases) == 34, "SOURCE_SAFETY_COUNT_CHANGED")
    issues = json.loads((ROOT / "planning/07_2026-10-04_online-acceptance/deliverables/issues.json").read_text(encoding="utf-8"))["issues"]
    child = next(i for i in issues if i["issue_id"] == "D4-11")
    require(child["severity"] == "CRITICAL" and child["status"] == "OPEN", "SOURCE_CRITICAL_CHANGED")
    snapshot = {source: hashlib.sha256((ROOT / source).read_bytes()).hexdigest() for source in SOURCE_REFS}
    (PLAN / "evidence/planning/source-hashes.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: {len(REQUIRED)} documents; {len(SOURCE_REFS)} source refs; safety source34; D4-11 CRITICAL OPEN; 3 negative controls rejected; no runtime/LLM/DB execution")


if __name__ == "__main__":
    main()
