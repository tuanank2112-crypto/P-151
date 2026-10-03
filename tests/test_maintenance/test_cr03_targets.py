"""CR03 target oracle integrity; runtime integration is a separate gate."""

from copy import deepcopy
from pathlib import Path

import pytest
import yaml

from src.maintenance.catalog import FIXTURE_DIR, TicketDataset, load_dataset, load_lexicon
from src.maintenance.safety import assess

TARGET_DIR = Path("seed/maintenance_cr03")
EMERGENCIES = {
    "SIM-TKT-CLN-004": {"S-14"},
    "SIM-TKT-TEC-005": {"S-01", "S-02"},
}
DOWNSTREAM_FIELDS = {"asset_resolution", "asset_lookup_status", "asset_id", "material_stock_status"}
# CR-03 §5.1: step 2b (safety) runs before step 3, so a tier-1 ticket is never classified (user ruling 2026-10-03)
CLASSIFICATION_FIELDS = {"playbook_id", "proposed_department_id", "review_status"}


def read_rows(directory):
    return yaml.safe_load((directory / "tickets.yaml").read_text(encoding="utf-8"))


def assert_target_integrity(target, baseline):
    """Compare independent source/gold, including fields omitted by Pydantic defaults."""
    assert target["synthetic"] is True
    assert target["dataset_version"] == "maintenanceops-sim-cr03-p0-v1"
    assert target["dataset_version"] != baseline["dataset_version"]
    target_rows = target["tickets"]
    baseline_rows = baseline["tickets"]
    assert len(target_rows) == len(baseline_rows) == 12
    ids = [row["raw"]["ticket_id"] for row in target_rows]
    assert len(set(ids)) == 12
    assert ids == [row["raw"]["ticket_id"] for row in baseline_rows]
    for row, source in zip(target_rows, baseline_rows, strict=True):
        ticket_id = row["raw"]["ticket_id"]
        assert row["raw"] == source["raw"]
        assert row["raw"]["original_description"].encode("utf-8") == source["raw"]["original_description"].encode(
            "utf-8"
        )
        if ticket_id not in EMERGENCIES:
            assert row == source
            continue
        assert {k: v for k, v in row.items() if k not in {"expected", "purpose"}} == {
            k: v for k, v in source.items() if k not in {"expected", "purpose"}
        }
        expected = row["expected"]
        gold = {k: v for k, v in source["expected"].items() if k not in DOWNSTREAM_FIELDS | CLASSIFICATION_FIELDS}
        gold.update(status="VERIFYING", reason_code="EMERGENCY_PENDING_BQL", department_id=None, draft_exists=False)
        assert expected == gold
        assert not CLASSIFICATION_FIELDS.intersection(expected)
        assert not DOWNSTREAM_FIELDS.intersection(expected)
        assert "risk_level" not in expected
        assert "CR03 P0" in row["purpose"] and "EMERGENCY" in row["purpose"]


def test_target_twelve_rows_preserve_source_and_ten_unchanged_oracles():
    # CR-03 §14/Q20: baseline v1.3 — Trường review. The branch fixture adds `priority`/`risk_level` (CR-03) and keeps
    # tier 1 unclassified (2b before step 3), same as this target since the 2026-10-03 ruling.
    target, baseline = read_rows(TARGET_DIR), read_rows(FIXTURE_DIR)
    for row, target_row in zip(baseline["tickets"], target["tickets"], strict=True):
        row["expected"].pop("priority", None)
        row["expected"].pop("risk_level", None)
    assert_target_integrity(target, baseline)


def test_target_loads_through_existing_schema_and_default_stays_baseline():
    target = load_dataset(TARGET_DIR)
    baseline = load_dataset()
    assert isinstance(target, TicketDataset)
    assert len(target.tickets) == 12
    assert FIXTURE_DIR.name == "maintenance_v1"
    # CR-03 §14/Q20: baseline v1.3 — Trường review (version, CLN-004 and TEC-005 are tier 1)
    assert baseline.dataset_version == "maintenanceops-sim-v1.3"
    assert target.dataset_version != baseline.dataset_version
    assert baseline.get("SIM-TKT-CLN-004").expected.status == "VERIFYING"
    assert baseline.get("SIM-TKT-TEC-005").expected.reason_code == "EMERGENCY_PENDING_BQL"


@pytest.mark.parametrize("ticket_id", EMERGENCIES)
def test_target_raw_has_independent_emergency_safety_evidence(ticket_id):
    fixture = load_dataset(TARGET_DIR).get(ticket_id)
    assessment = assess(fixture.raw.original_description, load_lexicon().safety)  # plan 02 Q09: this branch's rules
    assert assessment.risk_level == "EMERGENCY"
    required = EMERGENCIES[ticket_id]
    assert required <= {s.signal_id for s in assessment.signals if s.status == "PRESENT"}
    text = fixture.raw.original_description
    assert all(part in text for s in assessment.signals for part in s.source_quote.split(" | "))  # S-14: 2 spans


@pytest.mark.parametrize("damage", ["raw", "duplicate", "oracle", "draft", "downstream"])
def test_integrity_guard_rejects_deliberately_damaged_copy(damage):
    baseline = read_rows(FIXTURE_DIR)
    target = deepcopy(read_rows(TARGET_DIR))
    if damage == "raw":
        target["tickets"][0]["raw"]["original_description"] += " changed"
    elif damage == "duplicate":
        target["tickets"][1]["raw"]["ticket_id"] = target["tickets"][0]["raw"]["ticket_id"]
    elif damage == "oracle":
        target["tickets"][0]["expected"]["status"] = "ROUTED"
    elif damage == "draft":
        target["tickets"][3]["expected"]["draft_exists"] = True
    else:
        target["tickets"][10]["expected"]["asset_lookup_status"] = "AMBIGUOUS"
    with pytest.raises(AssertionError):
        assert_target_integrity(target, baseline)
