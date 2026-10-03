"""CR03 target oracle integrity; runtime integration is a separate gate."""

from copy import deepcopy
from pathlib import Path

import pytest
import yaml

from src.maintenance.catalog import FIXTURE_DIR, TicketDataset, load_dataset
from src.maintenance.safety import assess_safety

TARGET_DIR = Path("seed/maintenance_cr03")
EMERGENCIES = {
    "SIM-TKT-CLN-004": ("PB-CLN-01", "DEPT_CLEANING", {"S-14"}),
    "SIM-TKT-TEC-005": ("PB-TEC-01", "DEPT_TECHNICAL", {"S-01", "S-02"}),
}
DOWNSTREAM_FIELDS = {"asset_resolution", "asset_lookup_status", "asset_id", "material_stock_status"}


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
        playbook, proposed_department, _ = EMERGENCIES[ticket_id]
        expected = row["expected"]
        gold = {k: v for k, v in source["expected"].items() if k not in DOWNSTREAM_FIELDS}
        gold.update(status="VERIFYING", reason_code="EMERGENCY_PENDING_BQL", department_id=None, draft_exists=False)
        assert expected == gold
        assert expected["playbook_id"] == playbook
        assert expected["proposed_department_id"] == proposed_department
        assert not DOWNSTREAM_FIELDS.intersection(expected)
        assert "risk_level" not in expected
        assert "CR03 P0" in row["purpose"] and "EMERGENCY" in row["purpose"]


def test_target_twelve_rows_preserve_source_and_ten_unchanged_oracles():
    assert_target_integrity(read_rows(TARGET_DIR), read_rows(FIXTURE_DIR))


def test_target_loads_through_existing_schema_and_default_stays_baseline():
    target = load_dataset(TARGET_DIR)
    baseline = load_dataset()
    assert isinstance(target, TicketDataset)
    assert len(target.tickets) == 12
    assert FIXTURE_DIR.name == "maintenance_v1"
    assert baseline.dataset_version == "maintenanceops-sim-v1.2"
    assert target.dataset_version != baseline.dataset_version
    assert baseline.get("SIM-TKT-CLN-004").expected.status == "ROUTED"
    assert baseline.get("SIM-TKT-TEC-005").expected.reason_code == "ASSET_UNCLEAR"


@pytest.mark.parametrize("ticket_id", EMERGENCIES)
def test_target_raw_has_independent_emergency_safety_evidence(ticket_id):
    fixture = load_dataset(TARGET_DIR).get(ticket_id)
    assessment = assess_safety(fixture.raw.original_description)
    assert assessment.risk_level == "EMERGENCY"
    required = EMERGENCIES[ticket_id][2]
    assert required <= {s.signal_id for s in assessment.signals if s.status == "PRESENT"}
    assert all(s.source_quote in fixture.raw.original_description for s in assessment.signals)


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
