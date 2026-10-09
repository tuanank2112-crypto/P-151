"""Plan 06 WP1 — contracts: enums, model fields, validators, catalog policy, TRANSITIONS, views, i18n (01-CONTRACTS)."""

import importlib.util
import json
import sys
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from src.maintenance import enums
from src.maintenance.catalog import FIXTURE_DIR, Catalog, SafetyLexicon, SignalDef, load_catalog, load_lexicon
from src.maintenance.engine import BLOCKER_OWNERS, PERMISSIONS, TRANSITIONS, MaintenanceEngine
from src.maintenance.enums import Action, BlockerOwner, ReasonCode, ServiceCategory, TicketFlag
from src.maintenance.messages import _templates
from src.maintenance.models import BLOCKER_CODES_BY_STATUS, Case, EvidenceRecord, ResidentAddition, Ticket
from src.maintenance.views import BqlTicketRow, ResidentTicketView, bql_rows, resident_view
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

PRE_P1 = Path(__file__).parent / "data" / "case_pre_p1.json"
FORBIDDEN_WORDS = ("khẩn cấp", "nguy hiểm", "rủi ro", "sự cố", "EMERGENCY")


def _load_ref():
    path = (
        Path(__file__).resolve().parents[2]
        / "planning"
        / "06_2026-10-05_reasoning-agent"
        / "specs"
        / "REF-agent-contract.py"
    )
    spec = importlib.util.spec_from_file_location("ref_agent_contract", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["ref_agent_contract"] = module
    spec.loader.exec_module(module)
    return module


def _pre_p1() -> dict:
    return json.loads(PRE_P1.read_text(encoding="utf-8"))["cases"]


def _ticket_doc(**overrides) -> dict:
    return {**_pre_p1()["SIM-TKT-CLN-001"]["ticket"], **overrides}


def _catalog_raw() -> dict:
    return yaml.safe_load((FIXTURE_DIR / "catalog.yaml").read_text(encoding="utf-8"))


# ------------------------------------------------------------------------------------------------ C-01 .. C-03


def test_c01_transitions_count_and_new_rows():
    s = enums.TicketStatus
    assert len(TRANSITIONS) == 23 + 7
    new = {
        (s.VERIFYING, s.MERGED): ({"BPTN", "BQL"}, set(), False),  # T08
        (s.RECEIVED, s.ON_HOLD): ({"AGENT"}, {"WAITING_MATERIAL", "WAITING_EMERGENCY"}, True),  # T11
        (s.MERGED, s.RECEIVED): ({"BPTN", "BQL", "SYSTEM"}, set(), False),  # T09
        (s.IN_PROGRESS, s.VERIFYING): ({"DEPARTMENT"}, {"WRONG_DEPT_AFTER_START"}, True),  # T16
        (s.VERIFYING, s.IN_PROGRESS): ({"BQL"}, set(), False),  # T17
    }
    for pair, (actors, reasons, required) in new.items():
        rule = TRANSITIONS[pair]
        assert set(rule.actors) == actors, pair
        assert set(rule.reasons) == reasons, pair
        assert rule.reason_required == required, pair
    for pair in ((s.ON_HOLD, s.MERGED), (s.ROUTED, s.MERGED)):  # T08S-a / T08S-b: only undo_split
        assert set(TRANSITIONS[pair].actors) == {"BPTN", "BQL"}


def test_c02_blocker_owners_cover_every_reason_code():
    assert set(BLOCKER_OWNERS) == set(ReasonCode)
    assert BLOCKER_OWNERS[ReasonCode.WAITING_EMERGENCY] == BlockerOwner.SYSTEM
    assert ReasonCode.WAITING_EMERGENCY in BLOCKER_CODES_BY_STATUS[enums.TicketStatus.ON_HOLD]
    for group in (enums.BPTN_REASONS, enums.SAFETY_REASONS, enums.BQL_REASONS):
        assert ReasonCode.WAITING_EMERGENCY not in group


def test_c03_permissions_exactly_four_new_keys():
    assert PERMISSIONS[Action.BQL_MERGE] == {"BQL"}
    assert PERMISSIONS[Action.CREATE_FOLLOW_UP] == {"BQL"}
    assert PERMISSIONS[Action.BQL_REASSIGN_TO_BPTN] == {"BQL"}
    assert PERMISSIONS[Action.SPLIT_UNDO] == {"BPTN", "BQL"}
    for internal in ("AGENT_DECISION", "SPLIT_TICKET", "LINK_TICKETS"):
        assert Action(internal) not in PERMISSIONS
    assert len(PERMISSIONS) == 18 + 4
    assert enums.SPLIT_PAIR == (ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT)
    assert enums.PrioritySource.AGENT_LLM == "AGENT_LLM"
    assert {TicketFlag.AGENT_FALLBACK, TicketFlag.AGENT_DISAGREEMENT} <= set(TicketFlag)
    for name in (
        "AGENT_DECISION",
        "BQL_MERGE",
        "MERGE_UNDO",
        "CREATE_FOLLOW_UP",
        "REPORT_WRONG_DEPT",
        "BQL_KEEP_DEPARTMENT",
        "BQL_REASSIGN_TO_BPTN",
        "SPLIT_TICKET",
        "SPLIT_UNDO",
        "LINK_TICKETS",
    ):
        assert Action(name).value == name


# ------------------------------------------------------------------------------------------------ C-04


def _good_pair() -> dict:
    """Positive control: the fields exist and a valid combination builds (so a failure below is the validator)."""
    ticket = Ticket.model_validate(_ticket_doc(split_from="SIM-TKT-9001", split_category="KY_THUAT"))
    assert ticket.split_from == "SIM-TKT-9001" and ticket.split_category == ServiceCategory.KY_THUAT
    ticket = Ticket.model_validate(_ticket_doc(split_children=["SIM-TKT-9002"], split_category="VE_SINH"))
    assert ticket.split_children == ["SIM-TKT-9002"]
    return _ticket_doc()


def test_c04_v_t1_split_category_only_ve_sinh_or_ky_thuat():
    _good_pair()
    with pytest.raises(ValidationError, match="split_category"):
        Ticket.model_validate(_ticket_doc(split_from="SIM-TKT-9001", split_category="UNKNOWN"))


def test_c04_v_t2_split_category_iff_split_link():
    _good_pair()
    with pytest.raises(ValidationError, match="split_category"):
        Ticket.model_validate(_ticket_doc(split_category="KY_THUAT"))  # category without any link
    with pytest.raises(ValidationError, match="split_category"):
        Ticket.model_validate(_ticket_doc(split_from="SIM-TKT-9001"))  # link without category
    with pytest.raises(ValidationError, match="split_category"):
        Ticket.model_validate(_ticket_doc(split_children=["SIM-TKT-9002"]))


def test_c04_v_t3_not_both_child_and_parent():
    _good_pair()
    with pytest.raises(ValidationError, match="split_from"):
        Ticket.model_validate(
            _ticket_doc(split_from="SIM-TKT-9001", split_children=["SIM-TKT-9002"], split_category="VE_SINH")
        )


def test_c04_v_t4_no_self_link():
    _good_pair()
    own = _ticket_doc()["ticket_id"]
    for field, value in (
        ("merged_children", [own]),
        ("split_children", [own]),
        ("related_ticket_ids", [own]),
    ):
        extra = {"split_category": "VE_SINH"} if field == "split_children" else {}
        with pytest.raises(ValidationError, match="tự liên kết"):
            Ticket.model_validate(_ticket_doc(**{field: value}, **extra))
    with pytest.raises(ValidationError, match="tự liên kết"):
        Ticket.model_validate(_ticket_doc(split_from=own, split_category="KY_THUAT"))
    with pytest.raises(ValidationError, match="tự liên kết"):
        Ticket.model_validate(_ticket_doc(follow_up_of=own))
    with pytest.raises(ValidationError, match="tự liên kết"):
        Ticket.model_validate(_ticket_doc(status="MERGED", blocker=None, department_id=None, merged_into=own))
    # positive control for merged_into: another ticket is fine
    Ticket.model_validate(_ticket_doc(status="MERGED", blocker=None, department_id=None, merged_into="SIM-TKT-9001"))


def test_c04_v_t5_links_have_no_duplicates():
    _good_pair()
    with pytest.raises(ValidationError, match="lặp"):
        Ticket.model_validate(_ticket_doc(merged_children=["SIM-TKT-9001", "SIM-TKT-9001"]))
    with pytest.raises(ValidationError, match="lặp"):
        Ticket.model_validate(_ticket_doc(split_children=["SIM-TKT-9002", "SIM-TKT-9002"], split_category="VE_SINH"))
    with pytest.raises(ValidationError, match="lặp"):
        Ticket.model_validate(_ticket_doc(related_ticket_ids=["SIM-TKT-9003", "SIM-TKT-9003"]))


def test_c04_counters_are_non_negative():
    Ticket.model_validate(_ticket_doc(duplicate_count=2, wrong_department_return_count=1))
    for field in ("duplicate_count", "wrong_department_return_count"):
        with pytest.raises(ValidationError):
            Ticket.model_validate(_ticket_doc(**{field: -1}))


def test_c04_merged_from_and_copied_from_are_exclusive():
    base = {
        "addition_id": "SIM-ADD-X-01",
        "ticket_id": "SIM-TKT-9001",
        "content": "x",
        "submitted_by": "SIM-ACTOR-RESIDENT-01",
        "submitted_at": "2026-10-05T09:00:00+07:00",
    }
    assert ResidentAddition.model_validate({**base, "merged_from": "SIM-TKT-9002"}).merged_from == "SIM-TKT-9002"
    assert ResidentAddition.model_validate({**base, "copied_from": "SIM-TKT-9002"}).copied_from == "SIM-TKT-9002"
    with pytest.raises(ValidationError):
        ResidentAddition.model_validate({**base, "merged_from": "SIM-TKT-9002", "copied_from": "SIM-TKT-9003"})
    evd = {
        "evidence_id": "SIM-EVD-X-01",
        "ticket_id": "SIM-TKT-9001",
        "work_order_draft_id": None,
        "requirement_id": None,
        "evidence_type": "RESIDENT_ORIGINAL",
        "content_or_metadata": "photo",
        "source": "RESIDENT_ORIGINAL",
        "submitted_by": "SIM-ACTOR-RESIDENT-01",
        "submitted_at": "2026-10-05T09:00:00+07:00",
        "readability_status": "NOT_APPLICABLE",
    }
    assert EvidenceRecord.model_validate({**evd, "copied_from": "SIM-TKT-9002"}).copied_from == "SIM-TKT-9002"
    with pytest.raises(ValidationError):
        EvidenceRecord.model_validate({**evd, "merged_from": "SIM-TKT-9002", "copied_from": "SIM-TKT-9003"})
    with pytest.raises(ValidationError):  # only a resident original can be copied/merged
        EvidenceRecord.model_validate(
            {**evd, "source": "DEPARTMENT_EXECUTION", "evidence_type": "SIMULATED_IMAGE", "copied_from": "SIM-TKT-9002"}
        )


# ------------------------------------------------------------------------------------------------ C-05


def test_c05_pre_p1_case_docs_still_load_with_defaults():
    docs = _pre_p1()
    assert set(docs) == {"SIM-TKT-CLN-001", "SIM-TKT-CLN-004", "SIM-TKT-TEC-003"}
    for tid, doc in docs.items():
        case = Case.model_validate(doc)
        t = case.ticket
        assert (t.duplicate_count, t.wrong_department_return_count) == (0, 0), tid
        assert t.merged_children == [] and t.split_children == [] and t.split_from is None, tid
        assert t.follow_up_of is None and t.split_category is None, tid
        assert case.execution_snapshots == [] and case.agent_decision is None, tid
        assert all(a.merged_from is None and a.copied_from is None for a in case.additions), tid
        assert all(e.merged_from is None and e.copied_from is None for e in case.evidence), tid
        again = Case.model_validate(case.model_dump(mode="json"))
        assert again == case, tid
    p = Case.model_validate(docs["SIM-TKT-CLN-001"]).proposal
    assert p is not None and p.category_source in ("AGENT", "BPTN_LOCKED")


def test_c05_category_source_accepts_the_two_new_values():
    from src.maintenance.models import AgentClassificationProposal

    literal = AgentClassificationProposal.model_fields["category_source"].annotation
    assert set(literal.__args__) == {"AGENT", "BPTN_LOCKED", "AGENT_SPLIT", "AGENT_LLM"}


# ------------------------------------------------------------------------------------------------ C-12


@pytest.mark.parametrize(
    "path",
    [("agent_policy",), ("playbook_materials",), ("sla_config", "wrong_dept_return")],
    ids=lambda p: ".".join(p),
)
def test_c12_catalog_requires_the_new_keys(path):
    full = _catalog_raw()
    catalog = Catalog.model_validate(full)  # positive control
    assert catalog.agent_policy.auto_split_mixed_reports is True
    assert catalog.sla_config.wrong_dept_return.escalate_at_count == 2
    node = full
    for key in path[:-1]:
        node = node[key]
    del node[path[-1]]
    with pytest.raises(ValidationError, match=path[-1]):
        Catalog.model_validate(full)


def test_c12_catalog_policy_values_and_material_validators():
    catalog = load_catalog()
    policy = catalog.agent_policy
    assert (policy.auto_split_mixed_reports, policy.hold_near_open_emergency) == (True, False)
    assert (policy.max_material_qty, policy.max_duplicate_candidates, policy.max_job_agent_calls) == (10, 8, 5)
    assert catalog.sla_config.priority.duplicate_raise_at_count == 3
    assert set(catalog.playbook_materials) == set(catalog.default_materials)
    full = _catalog_raw()
    full["playbook_materials"]["PB-CLN-01"] = ["SIM-MAT-NOPE-99"]  # not in `materials`
    with pytest.raises(ValidationError, match="playbook_materials"):
        Catalog.model_validate(full)
    full = _catalog_raw()
    full["playbook_materials"]["PB-CLN-01"] = ["SIM-MAT-BAG-01"]  # default SIM-MAT-CLEAN-01 not included
    with pytest.raises(ValidationError, match="default_materials"):
        Catalog.model_validate(full)


def test_c12_agent_policy_bounds():
    full = _catalog_raw()
    Catalog.model_validate(full)
    for key, bad in (("max_material_qty", 0), ("max_duplicate_candidates", 9), ("max_job_agent_calls", 51)):
        broken = _catalog_raw()
        broken["agent_policy"][key] = bad
        with pytest.raises(ValidationError, match=key):
            Catalog.model_validate(broken)
    broken = _catalog_raw()
    del broken["agent_policy"]["hold_near_open_emergency"]
    with pytest.raises(ValidationError, match="hold_near_open_emergency"):
        Catalog.model_validate(broken)


def test_c12_signal_def_agent_only_rules():
    assert SignalDef(signal_id="S-00", name="agent_other_hazard", tier=1, phase="P1", agent_only=True).agent_only
    assert SignalDef(signal_id="S-01", name="x", tier=1, phase="P0", patterns=("khet",)).agent_only is False
    raw = yaml.safe_load((FIXTURE_DIR / "lexicon.yaml").read_text(encoding="utf-8"))["safety"]
    SafetyLexicon.model_validate(raw)  # positive control
    raw = {**raw, "signals": [s for s in raw["signals"] if s["signal_id"] != "S-00"]}  # plan 06 WP2 ships S-00
    s00 = {"signal_id": "S-00", "name": "agent_other_hazard", "tier": 1, "phase": "P1", "scope": ["COMMON"]}
    ok = {**raw, "signals": [*raw["signals"], {**s00, "agent_only": True}]}
    SafetyLexicon.model_validate(ok)  # S-00 without patterns is fine when agent_only
    with pytest.raises(ValidationError, match="thiếu patterns"):
        SafetyLexicon.model_validate({**raw, "signals": [*raw["signals"], s00]})
    other = {**s00, "signal_id": "S-99", "agent_only": True}
    with pytest.raises(ValidationError, match="agent_only"):
        SafetyLexicon.model_validate({**raw, "signals": [*raw["signals"], other]})
    assert load_lexicon().safety.signals  # lexicon.yaml untouched by WP1


# ------------------------------------------------------------------------------------------------ C-13


def test_c13_i18n_new_keys_and_messages():
    from src.maintenance import messages

    t = _templates()
    assert t["reason_messages"]["WAITING_EMERGENCY"] == "Phản ánh đang được kiểm tra trước khi chuyển phòng ban."
    split = messages.split_created_message("SIM-TKT-0007")
    follow = messages.follow_up_created_message("SIM-TKT-0008")
    assert split == ("Phản ánh này được tách từ phản ánh SIM-TKT-0007 vì có hai việc cần hai bộ phận khác nhau xử lý.")
    assert follow == "Phản ánh này được tạo để xử lý tiếp sau phản ánh SIM-TKT-0008."
    for text in (t["reason_messages"]["WAITING_EMERGENCY"], split, follow):
        assert not any(word.lower() in text.lower() for word in FORBIDDEN_WORDS)
    assert (
        messages.public_message(enums.TicketStatus.ON_HOLD, ReasonCode.WAITING_EMERGENCY)
        == (t["reason_messages"]["WAITING_EMERGENCY"])
    )


# ------------------------------------------------------------------------------------------------ C-14


def test_c14_views_new_fields():
    row_fields = set(BqlTicketRow.model_fields)
    assert {
        "duplicate_count",
        "merged_children",
        "related_ticket_ids",
        "split_from",
        "split_children",
        "follow_up_of",
        "wrong_department_return_count",
        "agent_source",
        "agent_disagreements",
    } <= row_fields
    res_fields = set(ResidentTicketView.model_fields)
    assert {"split_from", "split_into", "follow_up_of"} <= res_fields
    assert not any(name.startswith("agent") for name in res_fields)
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM))
    engine.reset()
    rows = bql_rows(engine, MONDAY_9AM)
    assert rows and all(r.agent_source is None and r.agent_disagreements == [] for r in rows)
    assert all(r.duplicate_count == 0 and r.related_ticket_ids is not None for r in rows)
    assert bql_rows(engine, MONDAY_9AM, flag=TicketFlag.AGENT_FALLBACK) == []
    flagged = next(iter(engine.cases.values()))
    flagged.ticket.flags.append(TicketFlag.AGENT_DISAGREEMENT)
    only = bql_rows(engine, MONDAY_9AM, flag=TicketFlag.AGENT_DISAGREEMENT)
    assert [r.ticket_id for r in only] == [flagged.ticket.ticket_id]
    view = resident_view(engine, flagged, MONDAY_9AM)
    assert view.split_from is None and view.split_into == [] and view.follow_up_of is None
    assert "agent" not in json.dumps(view.model_dump(mode="json")).lower()


def test_c14_resident_view_rate_and_neutral_label_for_waiting_emergency():
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM))
    engine.reset()
    case = engine.cases["SIM-TKT-CLN-004"]  # EMERGENCY_PENDING_BQL: neutral label already
    neutral = resident_view(engine, case, MONDAY_9AM).status_label
    assert neutral == _templates()["safety_status_label"]


# ------------------------------------------------------------------------------------------------ Q20 contract


def test_q20_agent_schema_matches_reference_example():
    from src.maintenance.agent.schema import AgentDecision, AgentDecisionRecord, Disagreement

    ref = _load_ref()
    decision = AgentDecision.model_validate(ref.EXAMPLE)
    assert decision.jobs[0].category == "VE_SINH" and len(decision.reasoning) == 5
    with pytest.raises(ValidationError):
        AgentDecision.model_validate({**ref.EXAMPLE, "extra_key": 1})
    d = Disagreement(field="category", severity="SERIOUS", rule_value=None, agent_value="KY_THUAT", note="x")
    now = MONDAY_9AM
    record = AgentDecisionRecord(
        source="AGENT",
        model="m",
        fingerprint="f",
        safety_fingerprint="s",
        decided_at=now,
        latency_ms=1.0,
        decision=decision,
        disagreements=[d],
    )
    assert record.record_version == "agent-record/1" and record.rule_risk_level == enums.RiskLevel.NONE
    with pytest.raises(ValidationError):  # source AGENT needs a decision
        AgentDecisionRecord(
            source="AGENT", model="m", fingerprint="f", safety_fingerprint="s", decided_at=now, latency_ms=0
        )
    with pytest.raises(ValidationError):  # FALLBACK_RULE needs a reason
        AgentDecisionRecord(
            source="FALLBACK_RULE", model="rules", fingerprint="f", safety_fingerprint="s", decided_at=now, latency_ms=0
        )
    fallback = AgentDecisionRecord(
        source="FALLBACK_RULE",
        model="rules",
        fingerprint="f",
        safety_fingerprint="s",
        decided_at=now,
        latency_ms=0,
        fallback_reason="TIMEOUT",
    )
    assert fallback.decision is None


def test_q20_decision_input_and_case_agent_decision_round_trip():
    from src.maintenance.agent.inputs import AssetCandidate, DecisionInput, DuplicateCandidate
    from src.maintenance.agent.schema import AgentDecisionRecord
    from src.maintenance.models import LockedFields

    cand = DuplicateCandidate(
        ticket_id="SIM-TKT-0001",
        category=ServiceCategory.KY_THUAT,
        location="Tòa S1 / Tầng 3 / Hành lang",
        created_at="2026-10-05T09:00:00+07:00",
        status=enums.TicketStatus.ROUTED,
        excerpt="x" * 200,
    )
    with pytest.raises(ValidationError):
        DuplicateCandidate(**{**cand.model_dump(), "excerpt": "x" * 201})
    with pytest.raises(ValidationError):  # frozen
        cand.location = "y"
    data = DecisionInput(
        ticket_id="PENDING-FOLLOWUP",
        created_at="2026-10-05T09:00:00+07:00",
        report_text="r",
        location_text="l",
        safety_text="s",
        locks=LockedFields(),
        pinned_category=None,
        follow_up_of=None,
        duplicate_candidates=[cand],
        asset_candidates=[AssetCandidate(asset_id="SIM-ASSET-LIGHT-HALLWAY", area="Hành lang")],
        fingerprint="f",
        safety_fingerprint="s",
    )
    assert data.duplicate_candidates[0].ticket_id == "SIM-TKT-0001"
    with pytest.raises(ValidationError):  # at most 8 candidates
        DecisionInput(**{**data.model_dump(), "duplicate_candidates": [cand] * 9})
    record = AgentDecisionRecord(
        source="SKIPPED_RULE_EMERGENCY", model="rules", fingerprint="f", safety_fingerprint="s",
        decided_at=MONDAY_9AM, latency_ms=0,
    )  # fmt: skip
    doc = _pre_p1()["SIM-TKT-CLN-001"]
    case = Case.model_validate({**doc, "agent_decision": record.model_dump(mode="json")})
    assert case.agent_decision == record
    assert Case.model_validate(case.model_dump(mode="json")) == case


def test_q20_execution_snapshot_shape():
    from src.maintenance.models import ExecutionSnapshot

    doc = _pre_p1()["SIM-TKT-CLN-001"]
    snap = {
        "snapshot_id": "SIM-SNP-CLN-001-01",
        "ticket_id": "SIM-TKT-CLN-001",
        "reason": "BQL_REASSIGN_TO_BPTN",
        "taken_at": "2026-10-05T09:00:00+07:00",
        "taken_by": "SIM-ACTOR-BQL-01",
        "department_id": "DEPT_CLEANING",
        "work_order_draft_id": doc["draft"]["work_order_draft_id"],
        "playbook_id": "PB-CLN-01",
        "checklist_items": doc["checklist_items"],
        "material_lines": doc["material_lines"],
        "evidence_ids": [],
    }
    parsed = ExecutionSnapshot.model_validate(snap)
    assert parsed.synthetic is True
    with pytest.raises(ValidationError):
        ExecutionSnapshot.model_validate({**snap, "snapshot_id": "NOPE-1"})
    with pytest.raises(ValidationError):
        ExecutionSnapshot.model_validate({**snap, "reason": "OTHER"})
    case = Case.model_validate({**doc, "execution_snapshots": [snap]})
    assert case.execution_snapshots[0] == parsed
