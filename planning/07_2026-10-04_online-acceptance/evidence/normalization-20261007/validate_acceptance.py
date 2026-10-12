"""Validate normalized contracts, references and counts without running the application."""

from __future__ import annotations

import copy
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = ROOT / "planning/07_2026-10-04_online-acceptance"
OUT = PLAN / "deliverables"
ACTIVE = {"H01", "H02", "I01", "A01", "M01", "U01", "S04", "G03", "R01"}
REMOVED = {"S01", "S02", "S03", "S05", "G01", "G02"}


def check(condition, message):
    if not condition:
        raise ValueError(message)


def keys(value, required):
    check(isinstance(value, dict) and set(value) == set(required.split()), "SCHEMA_KEYS")


def timestamp(value, nullable=False):
    if value is None:
        check(nullable, "NULL_TIME_FORBIDDEN")
        return
    check(isinstance(value, str) and datetime.fromisoformat(value).tzinfo is not None, "INVALID_TIME")


def refs(values):
    check(isinstance(values, list) and bool(values), "MISSING_EVIDENCE")
    for value in values:
        check(isinstance(value, str) and not Path(value).is_absolute(), "INVALID_REF")
        target = (ROOT / value).resolve()
        check(target.is_relative_to(ROOT) and target.is_file(), "REF_NOT_FOUND:" + value)


def validate(manifest, results, issues):
    keys(manifest, "schema_version normalized_at active_case_ids scope_decision runs")
    keys(results, "schema_version normalized_at active_case_ids runs")
    keys(issues, "schema_version normalized_at issues")
    for data in [manifest, results, issues]:
        check(data["schema_version"] == "day04-3", "WRONG_SCHEMA")
        timestamp(data["normalized_at"])
        check(
            not re.search(
                r"(?:sk-[A-Za-z0-9_-]{15,}|sb_secret_[A-Za-z0-9_-]{15,}|postgresql[^\s]*://[^\s]+:[^\s]+@)",
                json.dumps(data),
            ),
            "SECRET_PATTERN",
        )
    for data in [manifest, results]:
        check(len(data["active_case_ids"]) == 9 and set(data["active_case_ids"]) == ACTIVE, "WRONG_SCOPE")
    decision = manifest["scope_decision"]
    keys(decision, "authorized_by authorized_on source removed_case_ids")
    check(
        len(decision["removed_case_ids"]) == 6 and set(decision["removed_case_ids"]) == REMOVED, "WRONG_SCOPE_DECISION"
    )
    datetime.fromisoformat(decision["authorized_on"])
    run_ids = set()
    for run in manifest["runs"]:
        keys(
            run,
            "run_id environment base_url build_sha dirty_worktree build_identity_status configuration_source llm_mode model store_mode photo_store_mode confirmed_by confirmed_at confirmation_source confirmation_status mutation_scope photo_scope evidence_refs",
        )
        check(run["run_id"] not in run_ids, "DUPLICATE_RUN")
        run_ids.add(run["run_id"])
        check(run["environment"] in ["local-qa", "online-qa"], "WRONG_ENVIRONMENT")
        check(run["base_url"].startswith(("http://", "https://")), "INVALID_URL")
        check(run["build_sha"] is None or re.fullmatch(r"[0-9a-f]{7,40}", run["build_sha"]), "INVALID_SHA")
        check(run["dirty_worktree"] is None or type(run["dirty_worktree"]) is bool, "INVALID_DIRTY_FLAG")
        check(run["build_identity_status"] in ["REPORT_ONLY", "BASE_SHA_ONLY", "EXACT"], "INVALID_BUILD_STATUS")
        check(run["confirmation_status"] in ["REPORT_ONLY", "EXECUTION_EVIDENCE"], "INVALID_CONFIRMATION")
        timestamp(run["confirmed_at"], True)
        refs(run["evidence_refs"])
    issue_map = {}
    for item in issues["issues"]:
        keys(
            item,
            "issue_id run_id case_ids severity owner expected actual reproduce evidence_refs status retest_ref next_step",
        )
        check(item["issue_id"] not in issue_map, "DUPLICATE_ISSUE")
        issue_map[item["issue_id"]] = item
        check(item["run_id"] is None or item["run_id"] in run_ids, "UNKNOWN_ISSUE_RUN")
        check(set(item["case_ids"]) <= ACTIVE, "REMOVED_CASE_IN_ISSUE")
        check(item["severity"] in ["CRITICAL", "MAJOR", "MINOR"], "WRONG_SEVERITY")
        check(item["status"] in ["OPEN", "FIXED_PENDING_RETEST", "CLOSED"], "WRONG_ISSUE_STATUS")
        check(item["owner"] and item["next_step"] and item["reproduce"], "ISSUE_OWNER_OR_STEP_MISSING")
        refs(item["evidence_refs"])
        if item["status"] == "CLOSED":
            refs([item["retest_ref"]])
    check({r["run_id"] for r in results["runs"]} == run_ids, "RESULT_MANIFEST_RUN_MISMATCH")
    for run in results["runs"]:
        keys(run, "run_id observed_at records coverage counts interpretation")
        timestamp(run["observed_at"], True)
        ids = []
        for row in run["records"]:
            keys(
                row,
                "case_id task_id actor_role ticket_ids started_at ended_at time_precision expected actual result evidence_basis evidence_refs issue_ids limitations",
            )
            check(row["case_id"] in ACTIVE, "REMOVED_CASE_IN_RESULT")
            ids.append(row["case_id"])
            check(row["result"] in ["PASS", "FAIL", "BLOCKED"], "INVALID_RESULT")
            check(row["evidence_basis"] in ["HISTORICAL_REPORT", "MACHINE_EVIDENCE"], "INVALID_BASIS")
            check(row["time_precision"] in ["exact", "not_recorded"], "WRONG_TIME_PRECISION")
            timestamp(row["started_at"], True)
            timestamp(row["ended_at"], True)
            check(bool(row["expected"]) and bool(row["actual"]), "EXPECTED_ACTUAL_MISSING")
            check(isinstance(row["ticket_ids"], list) and isinstance(row["limitations"], list), "INVALID_ARRAY")
            refs(row["evidence_refs"])
            for iid in row["issue_ids"]:
                check(
                    iid in issue_map
                    and row["case_id"] in issue_map[iid]["case_ids"]
                    and issue_map[iid]["run_id"] in [None, run["run_id"]],
                    "INVALID_ISSUE_REF",
                )
            if row["result"] == "BLOCKED":
                check(row["issue_ids"], "BLOCKED_WITHOUT_ISSUE")
            if row["time_precision"] == "not_recorded":
                check(row["started_at"] is None and row["ended_at"] is None, "FABRICATED_TIME")
        check(len(ids) == len(set(ids)), "DUPLICATE_CASE")
        keys(run["coverage"], "recorded_case_ids unmeasured_active_case_ids")
        check(run["coverage"]["recorded_case_ids"] == ids, "INVALID_COVERAGE_RECORDS")
        check(set(run["coverage"]["unmeasured_active_case_ids"]) == ACTIVE - set(ids), "INVALID_COVERAGE_GAPS")
        counts = Counter(row["result"] for row in run["records"])
        check(run["counts"] == {k: counts[k] for k in ["PASS", "FAIL", "BLOCKED"]}, "WRONG_COUNTS")
    raw = json.loads((PLAN / "evidence/supabase-demo-20261007/result.json").read_text(encoding="utf-8"))
    latest = next(r for r in results["runs"] if r["run_id"] == "local-supabase-20261007")
    h01 = next(r for r in latest["records"] if r["case_id"] == "H01")
    check(
        h01["started_at"] == raw["initial_case"]["ticket"]["raw"]["created_at"]
        and h01["ended_at"] == raw["final_case"]["ticket"]["closed_at"],
        "TIME_PROVENANCE_MISMATCH",
    )
    check(
        h01["result"] == "FAIL"
        and next(x for x in raw["steps"] if x["path"] == "/resident/tickets")["http_status"] == 422,
        "CREATE_FAILURE_HIDDEN",
    )
    check(issue_map["D4-06"]["status"] == "FIXED_PENDING_RETEST", "CREATE_ISSUE_CLOSED_WITHOUT_RETEST")
    check(
        raw["restart_verification"]["ticket_status"] == "CLOSED"
        and all(p["api_match"] and p["storage_match"] for p in raw["photo_checks"].values()),
        "PERSISTENCE_EVIDENCE_MISMATCH",
    )


def main():
    docs = [
        json.loads((OUT / name).read_text(encoding="utf-8"))
        for name in ["manifest.json", "results.json", "issues.json"]
    ]
    validate(*docs)
    for label in ["wrong_scope", "wrong_counts", "missing_reference"]:
        damaged = copy.deepcopy(docs)
        if label == "wrong_scope":
            damaged[1]["runs"][0]["records"][0]["case_id"] = "S01"
        elif label == "wrong_counts":
            damaged[1]["runs"][0]["counts"]["PASS"] += 1
        else:
            damaged[1]["runs"][0]["records"][0]["evidence_refs"] = ["planning/missing-evidence.txt"]
        try:
            validate(*damaged)
        except ValueError as exc:
            print(f"NEGATIVE_CONTROL {label}: rejected ({exc})")
        else:
            raise RuntimeError("VALIDATOR_ACCEPTED_CORRUPTION:" + label)
    hashes = json.loads((PLAN / "evidence/normalization-20261007/source-hashes.json").read_text(encoding="utf-8"))
    for source, expected in hashes.items():
        check(hashlib.sha256((ROOT / source).read_bytes()).hexdigest() == expected, "SOURCE_HASH_CHANGED")
    for name in ["day04-summary.md", "shared-supabase-demo-20261007.md"]:
        path = OUT / name
        for link in re.findall(r"\]\(([^)]+)\)", path.read_text(encoding="utf-8")):
            if "://" not in link and not link.startswith("#"):
                check((path.parent / link.split("#")[0]).exists(), "BROKEN_REPORT_LINK:" + link)
    print(
        f"PASS: 3 JSON contracts; 9 active cases; 0 removed records; 2 separate runs; {len(docs[2]['issues'])} issues; all refs/counts/timestamp provenance/source hashes valid; no shared writes"
    )


if __name__ == "__main__":
    main()
