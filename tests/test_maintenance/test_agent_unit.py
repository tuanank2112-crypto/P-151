"""Plan 06 WP3 (SPEC-P01, TESTING 3.1 A-01, A-02, A-04..A-19, A-32): the pure part of the reasoning Agent.

No test here calls a network: every model is a fake client from `agent/client.py`; `openai.OpenAI` is replaced by a
recording fake wherever `openai_json_client` or `build_agent` is built. `LLM_MODE=mock` is set by the caller.
"""

import copy
import itertools
import json
import types
from datetime import datetime, timedelta, timezone

import pytest

from src.config import Settings
from src.maintenance.agent import prompt, reconcile
from src.maintenance.agent.agent import ReasoningAgent, build_agent
from src.maintenance.agent.baseline import mirror_decision, rule_view
from src.maintenance.agent.client import (
    ClientReply,
    CountingClient,
    FailingClient,
    LockProbeClient,
    MirrorClient,
    ScriptedClient,
    openai_json_client,
)
from src.maintenance.agent.inputs import AssetCandidate, DecisionInput, DuplicateCandidate
from src.maintenance.agent.schema import AgentDecision, AgentDecisionRecord
from src.maintenance.agent.validate import grounded
from src.maintenance.ai_logger import ai_logger
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.enums import RiskLevel, ServiceCategory, TicketStatus
from src.maintenance.models import LockedFields
from tests.test_maintenance import test_classify_metamorphic as cm
from tests.test_maintenance.test_rule_evidence import REF as SPLIT_REF

CATALOG = load_catalog()
LEXICON = load_lexicon()
LEX_P0 = LEXICON.model_copy(update={"safety": LEXICON.safety.model_copy(update={"active_phases": ("P0",)})})
LEX_P1 = LEXICON.model_copy(update={"safety": LEXICON.safety.model_copy(update={"active_phases": ("P0", "P1")})})
TZ = timezone(timedelta(hours=7))
NOW = datetime(2026, 10, 5, 9, tzinfo=TZ)
REPORT = prompt.EXAMPLE_REPORT  # "Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng"
LOC = "Tòa S1 / Tầng 3 / Hành lang"
ASSET = AssetCandidate(asset_id="SIM-ASSET-LIGHT-001", location=LOC)
JOB_VS = copy.deepcopy(prompt.EXAMPLE["jobs"][0])
JOB_KT = copy.deepcopy(prompt.EXAMPLE["jobs"][1])
_ids = itertools.count(9000)


def decision(**overrides) -> str:
    """JSON of the prompt example with dotted-path overrides, e.g. decision(**{"jobs.1.quote": "..."})."""
    doc = copy.deepcopy(prompt.EXAMPLE)
    for path, value in overrides.items():
        node = doc
        *head, last = path.split(".")
        for part in head:
            node = node[int(part)] if isinstance(node, list) else node[part]
        if isinstance(node, list):
            node[int(last)] = value
        else:
            node[last] = value
    return json.dumps(doc, ensure_ascii=False)


def job(base, **changes) -> dict:
    out = copy.deepcopy(base)
    out.update(changes)
    return out


def one_job_decision(*jobs: dict, **overrides) -> str:
    return decision(jobs=list(jobs), **overrides)


def new_input(report=REPORT, *, assets=(ASSET,), **overrides) -> DecisionInput:
    fields = {
        "ticket_id": f"SIM-TKT-{next(_ids)}",
        "created_at": NOW.isoformat(),
        "report_text": report,
        "location_text": report,
        "safety_text": report,
        "locks": LockedFields(),
        "pinned_category": None,
        "follow_up_of": None,
        "duplicate_candidates": [],
        "asset_candidates": list(assets),
        "fingerprint": "fp-1",
        "safety_fingerprint": "sfp-1",
    }
    fields.update(overrides)
    return DecisionInput(**fields)


def make_agent(client, lexicon=LEXICON) -> ReasoningAgent:
    return ReasoningAgent(client, catalog=CATALOG, lexicon=lexicon, model_label="fake-model", clock=lambda: NOW)


def run(reply: str, data: DecisionInput | None = None, lexicon=LEXICON) -> tuple[AgentDecisionRecord, DecisionInput]:
    data = data or new_input()
    record = make_agent(ScriptedClient({"": reply}), lexicon).decide(data)
    return record, data


def serious(record) -> list[str]:
    return [d.field for d in record.disagreements if d.severity == "SERIOUS"]


def minor(record) -> list[str]:
    return [d.field for d in record.disagreements if d.severity == "MINOR"]


@pytest.fixture(autouse=True)
def _clean_logger():
    ai_logger.clear()
    yield
    ai_logger.clear()


# ----------------------------------------------------------------------------------------------- baseline / mirror


def test_a_01_mirror_decision_is_valid_for_every_corpus_sentence():
    sentences = [s for s, _ in cm.CORPUS] + list(SPLIT_REF.MUST_NOT_SPLIT)
    assert len(sentences) == len(cm.CORPUS) + 18
    for sentence in sentences:
        for text in (sentence, cm.variants(sentence)[0][0]):
            mirrored = mirror_decision(new_input(text), CATALOG, LEXICON)
            again = AgentDecision.model_validate_json(mirrored.model_dump_json())
            assert len(again.reasoning) >= 1, text


def test_a_01b_mirror_follows_the_rules_for_one_job_two_jobs_and_no_job():
    one = mirror_decision(new_input("Hành lang tầng 3 tòa S1 nhiều rác", assets=()), CATALOG, LEXICON)
    assert [j.category for j in one.jobs] == ["VE_SINH"]
    assert one.jobs[0].department_id == "DEPT_CLEANING"
    assert (one.location.building, one.location.floor, one.location.area) == ("S1", "3", "Hành lang")
    assert one.next_step == "PROCEED" and one.scope == "IN_SCOPE"
    split_count = 0
    for text in SPLIT_REF.MUST_SPLIT:
        two = mirror_decision(new_input(text, assets=()), CATALOG, LEXICON)
        if rule_view(new_input(text), CATALOG, LEXICON).safety.risk_level != RiskLevel.NONE:
            # "...bóng đèn đã cháy": the safety net reads "cháy" as Tier 2, and the rules never split such a ticket
            assert (two.jobs, two.next_step, two.bptn_reason) == ([], "TO_BPTN", "CATEGORY_UNCLEAR"), text
            continue
        split_count += 1
        assert [j.category for j in two.jobs] == ["VE_SINH", "KY_THUAT"], text
        assert two.next_step == "PROCEED"
    assert split_count == 31
    unclear = mirror_decision(
        new_input("Hành lang tầng 3 tòa S1 nhiều rác vì bóng đèn hành lang không sáng"), CATALOG, LEXICON
    )
    assert (unclear.scope, unclear.next_step, unclear.bptn_reason) == ("UNCLEAR", "TO_BPTN", "CATEGORY_UNCLEAR")
    ask = mirror_decision(new_input("Đèn hành lang không sáng"), CATALOG, LEXICON)
    assert ask.next_step == "ASK_RESIDENT" and ask.ask_fields == ["location_building", "location_floor"]
    nothing = mirror_decision(new_input("Cho hỏi phí quản lý tháng này bao nhiêu?"), CATALOG, LEXICON)
    assert (nothing.scope, nothing.next_step, nothing.bptn_reason) == ("OUT_OF_SCOPE", "TO_BPTN", "OUT_OF_SCOPE")
    everything_missing = mirror_decision(new_input("Nhiều rác quá"), CATALOG, LEXICON)
    assert everything_missing.ask_fields == ["location"]


def test_a_01c_mirror_picks_duplicate_asset_and_materials_like_the_engine():
    def candidate(ticket_id, created_at, category=ServiceCategory.KY_THUAT, location=LOC):
        return DuplicateCandidate(
            ticket_id=ticket_id,
            category=category,
            location=location,
            created_at=created_at,
            status=TicketStatus.ROUTED,
            excerpt="đèn",
        )

    candidates = [
        candidate("SIM-TKT-0005", "2026-10-05T07:00:00+07:00"),
        candidate("SIM-TKT-0003", "2026-10-05T07:00:00+07:00"),
        candidate("SIM-TKT-0002", "2026-10-05T06:00:00+07:00", ServiceCategory.VE_SINH),
        candidate("SIM-TKT-0001", "2026-10-05T05:00:00+07:00", location="Tòa S2 / Tầng 3 / Hành lang"),
    ]
    mirrored = mirror_decision(
        new_input("Đèn hành lang tầng 3 tòa S1 không sáng", duplicate_candidates=candidates), CATALOG, LEXICON
    )
    (only,) = mirrored.jobs
    assert only.duplicate_of == "SIM-TKT-0003"  # earliest (created_at, ticket_id) of the same category and place
    assert only.asset_id == "SIM-ASSET-LIGHT-001"
    assert [m.item_code for m in only.materials] == ["SIM-MAT-LAMP-01"]
    assert (only.priority, only.priority_rule_id) == ("HIGH", "PRI-H1")
    locked = mirror_decision(
        new_input("Hành lang tầng 3 tòa S1 nhiều rác", locks=LockedFields(category=ServiceCategory.KY_THUAT)),
        CATALOG,
        LEXICON,
    )
    assert [j.category for j in locked.jobs] == ["KY_THUAT"]


def test_rule_view_exposes_the_rule_evidence():
    view = rule_view(new_input(REPORT), CATALOG, LEXICON)
    assert view.categories == {ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT}
    assert view.location == LOC and view.missing_parts == ()
    assert view.safety.risk_level == RiskLevel.NONE and view.electrical_hazard is False
    assert view.split.categories == (ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT)
    empty = rule_view(new_input("Đèn hành lang không sáng", safety_text=""), CATALOG, LEXICON)
    assert empty.location is None and empty.missing_parts == ("building", "floor")
    assert empty.safety.signals == () and empty.mentions_subject is True
    locked = rule_view(new_input("x", locks=LockedFields(location="Tòa S2 / Tầng 9 / Sân thượng")), CATALOG, LEXICON)
    assert locked.location == "Tòa S2 / Tầng 9 / Sân thượng"


# ----------------------------------------------------------------------------------------------- decide(): happy path


def test_a_02_a_valid_reply_becomes_an_agent_record_with_one_log_line():
    data = new_input()
    record = make_agent(ScriptedClient({REPORT: decision()})).decide(data)
    assert record.source == "AGENT" and record.model == "fake-model" and record.fallback_reason is None
    assert record.valid_job_indexes == [0, 1] and record.rejected == [] and record.disagreements == []
    assert record.decision is not None and len(record.decision.jobs) == 2
    assert record.fingerprint == "fp-1" and record.safety_fingerprint == "sfp-1"
    assert record.prompt_version == prompt.PROMPT_VERSION
    assert record.decided_at == NOW and record.latency_ms >= 0
    assert record.rule_categories == sorted([ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT])
    assert record.rule_location == LOC and record.agent_location == LOC and record.agent_missing_parts == []
    assert record.rule_risk_level == RiskLevel.NONE and record.agent_risk_level == RiskLevel.NONE
    logs = ai_logger.get_logs(data.ticket_id)
    assert len(logs) == 1
    entry = logs[0]
    assert entry.status.value == "SUCCESS" and entry.model_name == "fake-model" and entry.latency_ms >= 0
    assert REPORT in entry.prompt_sent["user"] and entry.prompt_sent["system"].startswith("agent-prompt/1 sha256:")
    assert entry.structured_output["schema_version"] == "agent-decision/1"
    assert record.ai_log_id == entry.log_id


def test_a_02b_the_client_gets_the_rendered_prompts_and_the_input():
    seen = {}

    def client(system, user, data):
        seen.update(system=system, user=user, data=data)
        return ClientReply(decision(), 1.0)

    data = new_input()
    make_agent(client).decide(data)
    assert seen["system"] == prompt.render_system_prompt(CATALOG, LEXICON)
    assert seen["user"] == prompt.render_user_message(data, CATALOG)
    assert seen["data"] is data


# ----------------------------------------------------------------------------------------------- safety (I-17, I-18)


def test_a_04_an_ungrounded_safety_quote_is_at_most_unclear():
    report = "Hành lang tầng 3 tòa S1 nhiều rác"
    reply = one_job_decision(
        job(JOB_VS, quote="nhiều rác"),
        scope="IN_SCOPE",
        safety={
            "risk_level": "EMERGENCY",
            "signals": [{"signal_id": "S-02", "status": "PRESENT", "quote": "tia lửa bay"}],
            "reason": "Có tia lửa",
        },
    )
    record, data = run(reply, new_input(report))
    merged = reconcile.safety_for(record, data.safety_text, LEXICON, "fake-model")
    llm = [s for s in merged.signals if s.detected_by.value == "LLM"]
    assert [(s.signal_id, s.status.value) for s in llm] == [("S-02", "UNCLEAR")]
    assert merged.risk_level == RiskLevel.UNCLEAR
    assert record.agent_risk_level == RiskLevel.UNCLEAR and record.rule_risk_level == RiskLevel.NONE


def test_a_05_rule_emergency_skips_the_model_and_rule_unclear_stays_unclear():
    counting = CountingClient(ScriptedClient({}, default=decision()))
    data = new_input("Hành lang tầng 3 tòa S1 có khói bốc ra từ hộp điện")
    record = make_agent(counting).decide(data)
    assert record.source == "SKIPPED_RULE_EMERGENCY" and record.decision is None and record.fallback_reason is None
    assert record.model == "rules" and record.rule_risk_level == RiskLevel.EMERGENCY
    assert counting.calls == 0 and ai_logger.get_logs(data.ticket_id) == []
    unclear_report = "Hình như có mùi khét ở hành lang tầng 3 tòa S1, nhiều rác"
    reply = one_job_decision(job(JOB_VS, quote="nhiều rác"), scope="IN_SCOPE")
    record, data = run(reply, new_input(unclear_report))
    assert record.source == "AGENT" and record.rule_risk_level == RiskLevel.UNCLEAR
    assert reconcile.safety_for(record, data.safety_text, LEXICON, "m").risk_level == RiskLevel.UNCLEAR
    assert "safety" in minor(record) and serious(record) == []


def test_a_06_an_agent_signal_the_rules_missed_raises_the_level_to_emergency():
    report = "Hành lang tầng 3 tòa S1 nhiều rác, bình gas nghe xì xì"
    reply = one_job_decision(
        job(JOB_VS, quote="nhiều rác"),
        scope="IN_SCOPE",
        safety={
            "risk_level": "EMERGENCY",
            "signals": [{"signal_id": "S-10", "status": "PRESENT", "quote": "bình gas nghe xì xì"}],
            "reason": "Bình gas rò",
        },
    )
    data = new_input(report)
    assert rule_view(data, CATALOG, LEX_P1).safety.risk_level == RiskLevel.NONE  # the rules missed it
    record, _ = run(reply, data, LEX_P1)
    merged = reconcile.safety_for(record, data.safety_text, LEX_P1, "fake-model")
    assert merged.risk_level == RiskLevel.EMERGENCY
    (signal,) = [s for s in merged.signals if s.signal_id == "S-10"]
    assert signal.detected_by.value == "LLM" and signal.status.value == "PRESENT"
    assert record.agent_risk_level == RiskLevel.EMERGENCY and record.rule_risk_level == RiskLevel.NONE


def test_a_06b_a_signal_outside_the_active_phases_is_ignored():
    report = "Hành lang tầng 3 tòa S1 nhiều rác, bình gas nghe xì xì"
    reply = one_job_decision(
        job(JOB_VS, quote="nhiều rác"),
        scope="IN_SCOPE",
        safety={
            "risk_level": "EMERGENCY",
            "signals": [{"signal_id": "S-10", "status": "PRESENT", "quote": "bình gas nghe xì xì"}],
            "reason": "Bình gas rò",
        },
    )
    record, data = run(reply, new_input(report), LEX_P0)
    merged = reconcile.safety_for(record, data.safety_text, LEX_P0, "fake-model")
    assert all(s.signal_id != "S-10" for s in merged.signals)
    # the model still claimed EMERGENCY with nothing valid: S-00 keeps it at UNCLEAR at least (SPEC-P01 3.3)
    assert merged.risk_level == RiskLevel.UNCLEAR and record.agent_risk_level == RiskLevel.UNCLEAR


def test_a_06c_emergency_claim_without_any_valid_signal_adds_s00_unclear():
    report = "Hành lang tầng 3 tòa S1 nhiều rác. Cư dân lo lắng quá."
    reply = one_job_decision(
        job(JOB_VS, quote="nhiều rác"),
        scope="IN_SCOPE",
        safety={"risk_level": "EMERGENCY", "signals": [], "reason": "Cảm giác nguy hiểm"},
    )
    record, data = run(reply, new_input(report))
    merged = reconcile.safety_for(record, data.safety_text, LEXICON, "fake-model")
    (s00,) = [s for s in merged.signals if s.signal_id == "S-00"]
    assert (s00.status.value, s00.detected_by.value, s00.rule_id) == ("UNCLEAR", "LLM", "LLM-UNGROUNDED")
    assert s00.source_quote == "Hành lang tầng 3 tòa S1 nhiều rác." and len(s00.source_quote) <= 120
    assert grounded(s00.source_quote, data.safety_text)
    assert merged.risk_level == RiskLevel.UNCLEAR and record.agent_risk_level == RiskLevel.UNCLEAR


def test_a_06d_an_unclear_claim_without_signals_changes_nothing_and_empty_safety_text_is_ignored():
    reply = decision(safety={"risk_level": "UNCLEAR", "signals": [], "reason": "Không chắc"})
    record, data = run(reply)
    assert record.agent_risk_level == RiskLevel.NONE
    assert reconcile.safety_for(record, data.safety_text, LEXICON, "m").signals == ()
    loud = decision(
        safety={
            "risk_level": "EMERGENCY",
            "signals": [{"signal_id": "S-02", "status": "PRESENT", "quote": "nhiều rác"}],
            "reason": "x",
        }
    )
    record, data = run(loud, new_input(safety_text=""))
    assert record.agent_risk_level == RiskLevel.NONE
    assert reconcile.safety_for(record, "", LEXICON, "m").risk_level == RiskLevel.NONE


def test_safety_for_a_record_without_decision_is_the_rule_assessment():
    data = new_input("Hình như có mùi khét ở hành lang tầng 3 tòa S1")
    record = make_agent(None).fallback(data, "TIMEOUT")
    result = reconcile.safety_for(record, data.safety_text, LEXICON, "m")
    assert result.risk_level == RiskLevel.UNCLEAR and result.proposer == "rules"


# ----------------------------------------------------------------------------------------------- validation (3.2)


def test_a_08_a_job_with_an_ungrounded_quote_is_dropped():
    record, _ = run(decision(**{"jobs.1.quote": "bóng đèn nổ tung"}))
    assert "jobs[1]" in record.rejected
    assert record.valid_job_indexes == [0]
    assert "category" in minor(record)


def test_a_08b_all_jobs_dropped_while_in_scope_leaves_no_valid_job():
    record, _ = run(decision(**{"jobs.0.quote": "rác khắp nơi", "jobs.1.quote": "bóng đèn nổ tung"}))
    assert record.valid_job_indexes == [] and {"jobs[0]", "jobs[1]"} <= set(record.rejected)
    assert record.decision.scope == "IN_SCOPE"


def test_a_09_a_building_outside_the_site_is_a_missing_part():
    record, _ = run(decision(**{"location.building": "S3"}))
    assert record.agent_location is None
    assert "building" in record.agent_missing_parts and "floor" not in record.agent_missing_parts
    assert "location.building" in record.rejected
    assert "location" in minor(record)


def test_a_09b_location_parts_are_normalised_and_checked():
    ok, _ = run(decision(**{"location.building": "Tòa s1", "location.floor": "03", "location.area": "hành lang"}))
    assert ok.agent_location == LOC and ok.rejected == []
    bad_area, _ = run(decision(**{"location.area": "Ban công"}))
    assert bad_area.agent_location is None and bad_area.agent_missing_parts == ["area"]
    bad_floor, _ = run(decision(**{"location.floor": "tầng cao"}))
    assert bad_floor.agent_missing_parts == ["floor"] and "location.floor" in bad_floor.rejected
    basement, _ = run(decision(**{"location.floor": "b1", "location.area": "Hầm xe"}))
    assert basement.agent_location == "Tòa S1 / Tầng B1 / Hầm xe"
    implied, _ = run(decision(**{"location.floor": None, "location.area": "Sảnh chính"}))
    assert implied.agent_location == "Tòa S1 / Tầng 1 / Sảnh chính"
    ungrounded, _ = run(decision(**{"location.quote": "tầng 9 tòa S3"}))
    assert ungrounded.agent_location is None and ungrounded.agent_missing_parts == ["building", "floor", "area"]
    assert "location" in ungrounded.rejected


def test_a_10_an_asset_at_another_place_or_one_of_several_is_rejected():
    elsewhere = AssetCandidate(asset_id="SIM-ASSET-LIGHT-009", location="Tòa S1 / Tầng 5 / Sảnh thang máy")
    record, _ = run(decision(**{"jobs.1.asset_id": "SIM-ASSET-LIGHT-009"}), new_input(assets=(ASSET, elsewhere)))
    assert "jobs[1].asset_id" in record.rejected and record.valid_job_indexes == [0, 1]
    assert "asset" in minor(record)
    twin_a = AssetCandidate(asset_id="SIM-ASSET-LIGHT-010", location="Tòa S1 / Tầng 5 / Sảnh thang máy")
    twin_b = AssetCandidate(asset_id="SIM-ASSET-LIGHT-011", location="Tòa S1 / Tầng 5 / Sảnh thang máy")
    report = "Sảnh thang máy tầng 5 tòa S1 đèn không sáng"
    reply = one_job_decision(
        job(JOB_KT, quote="đèn không sáng", asset_id="SIM-ASSET-LIGHT-010"),
        scope="IN_SCOPE",
        **{
            "location.building": "S1",
            "location.floor": "5",
            "location.area": "Sảnh thang máy",
            "location.quote": "Sảnh thang máy tầng 5 tòa S1",
        },
    )
    record, _ = run(reply, new_input(report, assets=(twin_a, twin_b)))
    assert "jobs[0].asset_id" in record.rejected
    single = new_input(report, assets=(twin_a,))
    record, _ = run(reply, single)
    assert record.rejected == []


def test_a_10b_an_asset_for_a_cleaning_job_or_not_in_the_candidates_is_rejected():
    record, _ = run(decision(**{"jobs.0.asset_id": "SIM-ASSET-LIGHT-001", "jobs.1.asset_id": "SIM-ASSET-LIGHT-999"}))
    assert {"jobs[0].asset_id", "jobs[1].asset_id"} <= set(record.rejected)


def test_a_11_materials_of_the_wrong_playbook_or_too_many_are_rejected():
    wrong = [{"item_code": "SIM-MAT-LAMP-01", "planned_qty": 1, "reason": "x"}]
    heavy = [{"item_code": "SIM-MAT-LAMP-01", "planned_qty": 50, "reason": "x"}]
    twice = [
        {"item_code": "SIM-MAT-LAMP-01", "planned_qty": 1, "reason": "x"},
        {"item_code": "SIM-MAT-LAMP-01", "planned_qty": 1, "reason": "y"},
    ]
    record, _ = run(decision(**{"jobs.0.materials": wrong, "jobs.1.materials": heavy}))
    assert {"jobs[0].materials", "jobs[1].materials"} <= set(record.rejected)
    assert "materials" in minor(record)
    record, _ = run(decision(**{"jobs.1.materials": twice}))
    assert "jobs[1].materials" in record.rejected and "jobs[0].materials" not in record.rejected


def test_a_12_a_locked_category_drops_the_other_job_without_a_disagreement():
    report = "Hành lang tầng 3 tòa S1 đèn không sáng"
    reply = one_job_decision(job(JOB_KT, quote="đèn không sáng"), scope="IN_SCOPE")
    data = new_input(report, locks=LockedFields(category=ServiceCategory.VE_SINH))
    record, _ = run(reply, data)
    assert record.valid_job_indexes == [] and "jobs[0]" not in record.rejected
    assert serious(record) == [] and "category" not in minor(record)
    pinned = new_input(REPORT, pinned_category=ServiceCategory.KY_THUAT)
    record, _ = run(decision(), pinned)
    assert record.valid_job_indexes == [1] and record.rejected == [] and serious(record) == []


def test_a_12b_department_priority_and_duplicate_checks():
    record, _ = run(decision(**{"jobs.1.department_id": "DEPT_CLEANING"}))
    assert "jobs[1].department_id" in record.rejected and "department" in minor(record)
    record, _ = run(decision(**{"jobs.0.priority_rule_id": "PRI-H1"}))  # a lighting rule on a cleaning job
    assert "jobs[0].priority" in record.rejected
    record, _ = run(decision(**{"jobs.1.priority": "LOW"}))  # PRI-H1 is HIGH
    assert "jobs[1].priority" in record.rejected
    record, _ = run(decision(**{"jobs.1.duplicate_of": "SIM-TKT-0001"}))
    assert "jobs[1].duplicate_of" in record.rejected and "duplicate" in minor(record)
    other_place = DuplicateCandidate(
        ticket_id="SIM-TKT-0001",
        category=ServiceCategory.VE_SINH,
        location=LOC,
        created_at="2026-10-05T07:00:00+07:00",
        status=TicketStatus.ROUTED,
        excerpt="rác",
    )
    data = new_input(duplicate_candidates=[other_place])
    record, _ = run(decision(**{"jobs.1.duplicate_of": "SIM-TKT-0001", "jobs.0.duplicate_of": "SIM-TKT-0001"}), data)
    assert "jobs[1].duplicate_of" in record.rejected  # the candidate is a cleaning ticket
    assert "jobs[0].duplicate_of" not in record.rejected
    assert record.candidate_ids == ["SIM-TKT-0001"]


def test_a_12c_ask_fields_must_name_a_part_the_rules_still_miss():
    reply = decision(next_step="ASK_RESIDENT", ask_fields=["location_floor"])
    record, _ = run(reply)  # the location is complete: nothing to ask
    assert "ask_fields" in record.rejected and "next_step" in minor(record)
    data = new_input("Đèn hành lang tầng 3 không sáng", assets=())
    reply = one_job_decision(
        job(JOB_KT, quote="Đèn hành lang tầng 3 không sáng", asset_id=None),
        scope="IN_SCOPE",
        next_step="ASK_RESIDENT",
        ask_fields=["location_building"],
        **{"location.building": None, "location.quote": "hành lang tầng 3"},
    )
    record, _ = run(reply, data)
    assert "ask_fields" not in record.rejected and "next_step" not in minor(record)


# ----------------------------------------------------------------------------------------------- fallback (section 5)


@pytest.mark.parametrize(
    ("kind", "reason", "status"),
    [
        ("timeout", "TIMEOUT", "TIMEOUT"),
        ("http", "HTTP_ERROR", "FALLBACK_RULE"),
        ("garbage", "INVALID_JSON", "SCHEMA_ERROR"),
        ("schema", "SCHEMA_INVALID", "SCHEMA_ERROR"),
    ],
)
def test_a_14_to_a_17_every_model_failure_becomes_a_fallback_record(kind, reason, status):
    data = new_input()
    record = make_agent(FailingClient(kind)).decide(data)  # never raises
    assert record.source == "FALLBACK_RULE" and record.fallback_reason == reason and record.decision is None
    assert record.model == "rules" and record.rejected == [] and record.disagreements == []
    assert record.rule_location == LOC and record.rule_risk_level == RiskLevel.NONE
    assert record.rule_categories == sorted([ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT])
    assert record.fingerprint == "fp-1" and record.agent_location is None and record.valid_job_indexes == []
    (entry,) = ai_logger.get_logs(data.ticket_id)
    assert entry.status.value == status and record.ai_log_id == entry.log_id
    assert entry.error_message and entry.prompt_sent["user"].startswith("<phan_anh")


def test_a_14b_error_classes_are_told_apart_by_name():
    class APITimeoutError(Exception): ...

    class RateLimitError(Exception): ...

    data = new_input()
    record = make_agent(ScriptedClient({"": APITimeoutError("slow")})).decide(data)
    assert (record.fallback_reason, ai_logger.get_logs(data.ticket_id)[0].status.value) == ("TIMEOUT", "TIMEOUT")
    data = new_input()
    record = make_agent(ScriptedClient({"": RateLimitError("429")})).decide(data)
    assert (record.fallback_reason, ai_logger.get_logs(data.ticket_id)[0].status.value) == ("HTTP_ERROR", "RATE_LIMIT")


def test_a_14c_an_api_key_inside_an_error_message_is_not_logged():
    data = new_input()
    secret = "sk-abcdefghijklmnop1234567890"
    make_agent(ScriptedClient({"": RuntimeError(f"Incorrect API key provided: {secret}")})).decide(data)
    (entry,) = ai_logger.get_logs(data.ticket_id)
    assert secret not in (entry.error_message or "") and secret not in str(entry.model_dump())


@pytest.mark.parametrize(
    "text", ["", "[]", "null", "42", "```json\n{}\n```", '{"schema_version": "agent-decision/1"', "[" * 5000]
)
def test_a_17b_any_unusable_text_is_a_fallback_never_an_exception(text):
    record, _ = run(text)
    assert record.source == "FALLBACK_RULE" and record.fallback_reason in {"INVALID_JSON", "SCHEMA_INVALID"}


def test_a_17c_a_bug_in_the_client_script_is_not_swallowed():
    with pytest.raises(AssertionError, match="ScriptedClient"):
        make_agent(ScriptedClient({"khác": decision()})).decide(new_input())


def test_a_32_a_report_over_twelve_thousand_characters_never_reaches_the_model():
    counting = CountingClient(ScriptedClient({}, default=decision()))
    data = new_input("a" * 12001)
    record = make_agent(counting).decide(data)
    assert record.source == "FALLBACK_RULE" and record.fallback_reason == "INPUT_TOO_LARGE"
    assert counting.calls == 0 and ai_logger.get_logs(data.ticket_id) == []
    edge = new_input("a" * 12000)
    make_agent(counting).decide(edge)
    assert counting.calls == 1


def test_fallback_is_pure_and_works_without_a_client():
    data = new_input()
    record = make_agent(None).fallback(data, "STALE")
    assert (record.source, record.fallback_reason, record.model) == ("FALLBACK_RULE", "STALE", "rules")
    assert record.rule_location == LOC and ai_logger.get_logs() == []
    with pytest.raises(ValueError):
        make_agent(None).fallback(data, "NOT-A-REASON")


# ----------------------------------------------------------------------------------------------- reconcile (section 6)


def test_a_18_serious_disagreements_g1_g2_g3():
    g1_report = "Hành lang tầng 3 tòa S1 tối om, không thấy đường"
    assert rule_view(new_input(g1_report), CATALOG, LEXICON).categories == frozenset()
    reply = one_job_decision(
        job(JOB_KT, quote="tối om, không thấy đường"), scope="IN_SCOPE", **{"location.quote": "Hành lang tầng 3 tòa S1"}
    )
    record, _ = run(reply, new_input(g1_report))
    assert serious(record) == ["category"] and record.valid_job_indexes == [0]
    (d,) = [d for d in record.disagreements if d.severity == "SERIOUS"]
    assert d.rule_value is None and d.agent_value == "KY_THUAT" and d.note

    g2_report = "Hành lang tầng 3 tòa S1 nhiều rác"
    reply = one_job_decision(
        job(JOB_VS, quote="nhiều rác"),
        scope="IN_SCOPE",
        **{"location.building": "S2", "location.quote": "Hành lang tầng 3"},
    )
    record, _ = run(reply, new_input(g2_report))
    assert serious(record) == ["location"]
    (d,) = [d for d in record.disagreements if d.field == "location"]
    assert (d.rule_value, d.agent_value) == (LOC, "Tòa S2 / Tầng 3 / Hành lang")
    assert record.agent_location == "Tòa S2 / Tầng 3 / Hành lang" and record.rule_location == LOC
    locked, _ = run(reply, new_input(g2_report, locks=LockedFields(location=LOC)))
    assert serious(locked) == []  # a BPTN location lock removes the disagreement

    g3_report = "Hành lang tầng 3 tòa S1, ổ cắm bị ướt"
    g3_view = rule_view(new_input(g3_report), CATALOG, LEX_P0)
    assert g3_view.electrical_hazard is True and g3_view.safety.risk_level == RiskLevel.NONE
    reply = one_job_decision(
        job(JOB_VS, quote="ổ cắm bị ướt"), scope="IN_SCOPE", **{"location.quote": "Hành lang tầng 3 tòa S1"}
    )
    record, _ = run(reply, new_input(g3_report), LEX_P0)
    assert "electrical_hazard" in serious(record)
    g3_clean = "Hành lang tầng 3 tòa S1 nhiều rác, ổ cắm bị ướt"
    reply = one_job_decision(
        job(JOB_VS, quote="nhiều rác"), scope="IN_SCOPE", **{"location.quote": "Hành lang tầng 3 tòa S1"}
    )
    record, data = run(reply, new_input(g3_clean), LEX_P0)
    assert serious(record) == ["electrical_hazard"]
    safe_again = decision(
        safety={
            "risk_level": "UNCLEAR",
            "signals": [{"signal_id": "T2-04", "status": "UNCLEAR", "quote": "ổ cắm bị ướt"}],
            "reason": "x",
        },
        jobs=[job(JOB_VS, quote="nhiều rác")],
        scope="IN_SCOPE",
    )
    record, _ = run(safe_again, new_input(g3_clean), LEX_P0)
    assert "electrical_hazard" not in serious(record)  # the Agent raised the level, the hazard is covered


def test_a_19_g4_an_agent_that_drops_a_rule_category_is_only_minor():
    report = "Đèn hành lang tầng 3 tòa S1 hỏng nên không thấy rác mà dọn"
    reply = one_job_decision(job(JOB_KT, quote="Đèn hành lang tầng 3 tòa S1 hỏng"), scope="IN_SCOPE")
    record, _ = run(reply, new_input(report))
    assert serious(record) == []
    (d,) = [d for d in record.disagreements if d.field == "category"]
    assert d.severity == "MINOR" and d.rule_value == "KY_THUAT,VE_SINH" and d.agent_value == "KY_THUAT"


def test_g5_g7_g9_minor_notes():
    report = "Đèn hành lang không sáng"  # no building or floor: the rules have no location
    reply = one_job_decision(
        job(JOB_KT, quote="Đèn hành lang không sáng", asset_id=None, priority="MEDIUM", priority_rule_id="PRI-M1"),
        scope="IN_SCOPE",
        **{"location.quote": "hành lang"},
    )
    record, _ = run(reply, new_input(report, assets=()))
    assert "location" in minor(record)  # G-5: the Agent completes the place (building S1, floor 3 are in the example)
    assert "next_step" not in minor(
        record
    )  # PROCEED while the rules miss the place: the engine follows the place it has
    assert serious(record) == []
    full = "Đèn hành lang tầng 3 tòa S1 không sáng"
    reply = one_job_decision(job(JOB_KT, quote=full, priority="MEDIUM", priority_rule_id="PRI-M1"), scope="IN_SCOPE")
    record, _ = run(reply, new_input(full))
    assert "priority" in minor(record)  # G-7: Hành lang is a high-traffic area, the rule says HIGH


def test_g9_proceed_without_place_and_ask_with_place():
    reply = one_job_decision(
        job(JOB_KT, quote="Đèn hành lang không sáng", asset_id=None),
        scope="IN_SCOPE",
        **{"location.building": None, "location.floor": None, "location.quote": "hành lang"},
    )
    record, _ = run(reply, new_input("Đèn hành lang không sáng", assets=()))
    assert "next_step" in minor(record)
    ask = decision(next_step="ASK_RESIDENT", ask_fields=["location"])
    record, _ = run(ask)
    assert "next_step" in minor(record)


def test_rejected_paths_map_to_the_disagreement_field():
    reply = decision(
        **{
            "jobs.1.asset_id": "SIM-ASSET-LIGHT-999",
            "jobs.1.department_id": "DEPT_CLEANING",
            "jobs.1.duplicate_of": "SIM-TKT-0001",
        }
    )
    record, _ = run(reply)
    assert sorted(set(minor(record))) == ["asset", "department", "duplicate"]
    assert all(d.severity == "MINOR" for d in record.disagreements)


# ----------------------------------------------------------------------------------------------- clients, build_agent


def test_scripted_client_first_match_wins_and_exceptions_are_raised():
    client = ScriptedClient({"rác": "A", "đèn": "B"})
    data = new_input("Có rác và đèn")
    assert client("s", "u", data) == ClientReply("A", 0.0, None)
    with pytest.raises(TimeoutError):
        ScriptedClient({"rác": TimeoutError("x")})("s", "u", data)
    assert ScriptedClient({}, default="D")("s", "u", data).text == "D"
    with pytest.raises(AssertionError):
        ScriptedClient({})("s", "u", data)


def test_mirror_client_replies_with_the_mirror_decision():
    data = new_input()
    reply = MirrorClient(CATALOG, LEXICON)("s", "u", data)
    assert json.loads(reply.text) == json.loads(mirror_decision(data, CATALOG, LEXICON).model_dump_json())
    record = make_agent(MirrorClient(CATALOG, LEXICON)).decide(data)
    assert record.source == "AGENT" and record.rejected == [] and record.disagreements == []


def test_failing_client_kinds():
    data = new_input()
    with pytest.raises(TimeoutError):
        FailingClient("timeout")("s", "u", data)
    with pytest.raises(RuntimeError, match="HTTP 500"):
        FailingClient("http")("s", "u", data)
    assert FailingClient("garbage")("s", "u", data).text == "không phải json"
    assert FailingClient("schema")("s", "u", data).text == '{"schema_version": "agent-decision/1"}'


def test_lock_probe_and_counting_clients_record_their_calls():
    class FakeLock:
        def _is_owned(self):
            return True

    engine = types.SimpleNamespace(lock=FakeLock(), _local=types.SimpleNamespace(tx_depth=2))
    probe = LockProbeClient(engine, ScriptedClient({"": "x"}))
    assert probe("s", "u", new_input()).text == "x"
    assert probe.observations == [(True, 2)]
    counting = CountingClient(ScriptedClient({"": "x"}))
    counting("s", "u", new_input())
    counting("s", "u", new_input())
    assert counting.calls == 2


class _FakeOpenAI:
    instances: list = []

    def __init__(self, **kwargs):
        self.init = kwargs
        self.calls = []
        self.reply = types.SimpleNamespace(
            choices=[types.SimpleNamespace(message=types.SimpleNamespace(content='{"a": 1}'))],
            usage=types.SimpleNamespace(prompt_tokens=11, completion_tokens=7, total_tokens=18),
        )
        self.chat = types.SimpleNamespace(completions=types.SimpleNamespace(create=self._create))
        _FakeOpenAI.instances.append(self)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self.reply


@pytest.fixture
def fake_openai(monkeypatch):
    import openai

    _FakeOpenAI.instances = []
    monkeypatch.setattr(openai, "OpenAI", _FakeOpenAI)
    return _FakeOpenAI


def test_openai_json_client_sends_temperature_zero_json_mode_and_no_retries(fake_openai):
    client = openai_json_client("m-1", "key-x", None, timeout=9.0, max_output_tokens=777, json_mode="json_object")
    reply = client("SYS", "USR", new_input())
    (sdk,) = fake_openai.instances
    assert sdk.init == {"api_key": "key-x", "base_url": None, "timeout": 9.0, "max_retries": 0}
    (call,) = sdk.calls
    assert call == {
        "model": "m-1",
        "temperature": 0,
        "max_tokens": 777,
        "messages": [{"role": "system", "content": "SYS"}, {"role": "user", "content": "USR"}],
        "response_format": {"type": "json_object"},
    }
    assert reply.text == '{"a": 1}' and reply.latency_ms >= 0
    assert reply.usage == {"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18}


def test_openai_json_client_prompt_only_sends_no_response_format_and_strips_fences(fake_openai):
    client = openai_json_client(
        "m", "k", "https://api.example", timeout=5, max_output_tokens=500, json_mode="prompt_only"
    )
    sdk = fake_openai.instances[0]
    assert sdk.init["base_url"] == "https://api.example"
    sdk.reply.choices[0].message.content = 'Đây là kết quả:\n```json\n{"a": {"b": 2}}\n```\nXong'
    reply = client("S", "U", new_input())
    assert "response_format" not in sdk.calls[0]
    assert reply.text == '{"a": {"b": 2}}'
    sdk.reply.choices[0].message.content = None
    sdk.reply.usage = None
    empty = client("S", "U", new_input())
    assert empty.text == "" and empty.usage is None


def test_build_agent_needs_openai_mode_a_key_and_the_switch(fake_openai):
    def settings(**kw):
        return Settings(_env_file=None, **kw)

    args = (CATALOG, LEXICON, lambda: NOW)
    assert build_agent(settings(llm_mode="mock", openai_api_key="k"), *args) is None
    assert build_agent(settings(llm_mode="openai", openai_api_key=""), *args) is None
    assert build_agent(settings(llm_mode="openai", openai_api_key="k", mo_agent_enabled=False), *args) is None
    assert fake_openai.instances == []  # nothing was built for the three refusals
    agent = build_agent(
        settings(
            llm_mode="openai",
            openai_api_key="k",
            model_name="deepseek-chat",
            openai_base_url="https://api.deepseek.com",
        ),
        *args,
    )
    assert isinstance(agent, ReasoningAgent) and agent.model_label == "deepseek-chat"
    (sdk,) = fake_openai.instances
    assert sdk.init["base_url"] == "https://api.deepseek.com" and sdk.init["max_retries"] == 0
    assert sdk.init["timeout"] == 25.0 and sdk.calls == []  # the model was not called
