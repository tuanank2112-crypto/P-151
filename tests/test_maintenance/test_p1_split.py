"""Plan 06 WP8 (SPEC-P05 sections 3, 5, 7, 8; TESTING 3.7 S-01..S-12): a report with two jobs becomes two tickets.

The sentence lists are the architect prototype `REF-split-verdict.py` (imported, not copied). Every list sentence goes
through `receive` twice: with the Agent (`MirrorClient`, the fake that decides like the rules) and with the rules alone
(`LLM_MODE=mock`, no Agent, no old LLM). No test calls a network.
"""

import importlib.util
from pathlib import Path

import pytest

from src.maintenance.agent.agent import ReasoningAgent
from src.maintenance.agent.client import CountingClient, MirrorClient, ScriptedClient
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import (
    ActionDeniedError,
    GuardError,
    InvalidTransitionError,
    MaintenanceEngine,
    initial_stock,
)
from src.maintenance.enums import Action, ReasonCode, RiskLevel, ServiceCategory, TicketFlag
from src.maintenance.models import AuditEvent, Case, RawTicket
from src.maintenance.proposer import LLMAssessment
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import BPTN, BQL, MONDAY_9AM, RESIDENT, TEC, Clock, decision, report

REPO = Path(__file__).resolve().parents[2]
REF_PATH = REPO / "planning" / "06_2026-10-05_reasoning-agent" / "specs" / "REF-split-verdict.py"
CATALOG = load_catalog()
LEXICON = load_lexicon()
VE, KT = ServiceCategory.VE_SINH, ServiceCategory.KY_THUAT
MODES = ["mirror", "rules"]
STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]
MIXED = "Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng"
LIGHT = "Đèn hành lang tầng 3 tòa S1 không sáng"
TIER2_MIXED = "Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng, nghe kêu xèo xèo trên trần"
LATER_STOPS = {ReasonCode.ASSET_UNCLEAR, ReasonCode.DUPLICATE}  # TESTING 3.7 S-01: a valid stop after the split


def _load_ref():
    spec = importlib.util.spec_from_file_location("ref_split_verdict_wp8", REF_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


REF = _load_ref()


def build(mode: str, clock=None, *, catalog=None, repo=None, client=None) -> MaintenanceEngine:
    """An empty engine: `rules` = no Agent and no old LLM, `mirror` = the Agent asks a fake that mirrors the rules."""
    clock = clock or Clock(MONDAY_9AM)
    catalog = catalog or CATALOG
    if mode == "rules":
        engine = MaintenanceEngine(clock=clock, catalog=catalog, repo=repo)
    else:
        agent = ReasoningAgent(
            client or MirrorClient(catalog, LEXICON),
            catalog=catalog,
            lexicon=LEXICON,
            model_label="fake",
            clock=clock,
        )
        engine = MaintenanceEngine(clock=clock, catalog=catalog, agent=agent, repo=repo)
    engine.reset(with_fixtures=False)
    return engine


def audits(case: Case, action: Action) -> list[AuditEvent]:
    return [a for a in case.audit if a.action == action]


def pair(engine: MaintenanceEngine, root_id: str) -> tuple[Case, Case]:
    root = engine.get(root_id)
    assert len(root.ticket.split_children) == 1, root.ticket.split_children
    return root, engine.get(root.ticket.split_children[0])


def ticket_ids(engine: MaintenanceEngine) -> list[str]:
    return sorted(case.ticket.ticket_id for case in engine.repo.list())


def assert_split_family(engine: MaintenanceEngine, root_id: str, text: str) -> None:
    root, child = pair(engine, root_id)
    r, c = root.ticket, child.ticket
    assert (r.split_category, r.split_from) == (VE, None)
    assert (c.split_category, c.split_from, c.split_children) == (KT, r.ticket_id, [])
    assert r.split_children == [c.ticket_id]  # both directions
    assert c.resident_id == r.resident_id and c.raw.original_description == r.raw.original_description == text
    assert c.raw.created_at == r.raw.created_at and c.raw.channel == "split"
    assert engine._category(root) == VE and engine._category(child) == KT
    assert r.locked_fields.category is None and c.locked_fields.category is None  # the split never locks a category
    assert (r.status, r.department_id) == ("ROUTED", "DEPT_CLEANING") or r.blocker.code in LATER_STOPS
    assert (c.status, c.department_id) == ("ROUTED", "DEPT_TECHNICAL") or c.blocker.code in LATER_STOPS
    assert len(audits(root, Action.SPLIT_TICKET)) == 1 and len(audits(child, Action.SPLIT_TICKET)) == 1
    assert ticket_ids(engine) == [r.ticket_id, c.ticket_id]


# ---------------------------------------------------------------------------------------------------- S-01


@pytest.mark.parametrize("mode", MODES)
def test_s01_every_split_sentence_becomes_two_tickets(mode):
    assert len(REF.MUST_SPLIT) >= 30
    for text in REF.MUST_SPLIT:
        engine = build(mode)
        root_id = report(engine, text)
        assert_split_family(engine, root_id, text)


@pytest.mark.parametrize("mode", MODES)
def test_s01_the_root_keeps_cleaning_and_the_child_gets_the_lamp_with_its_own_pipeline(mode):
    engine = build(mode)
    root, child = pair(engine, (rid := report(engine, MIXED)))
    assert root.ticket.ticket_id == rid and child.ticket.ticket_id == "SIM-TKT-0002"  # next number, same transaction
    assert (root.ticket.status, root.ticket.department_id, root.ticket.priority) == (
        "ROUTED",
        "DEPT_CLEANING",
        "MEDIUM",
    )
    assert (child.ticket.status, child.ticket.department_id) == ("ROUTED", "DEPT_TECHNICAL")
    assert engine.effective_location(root) == engine.effective_location(child) == "Tòa S1 / Tầng 3 / Hành lang"
    assert child.events[0].public_message.startswith("Phản ánh này được tách từ phản ánh " + rid)
    assert [a.action for a in child.audit][0] == Action.INGEST
    assert child.audit[-1].actor_id != RESIDENT
    assert child.ticket.accepted_at is None and root.ticket.accepted_at is None


@pytest.mark.parametrize("mode", MODES)
def test_s01_the_proposals_say_the_split_chose_the_category_not_bptn(mode):
    """Q23 (3): the wording of the proposal of a split ticket (not "Category do BPTN chọn")."""
    engine = build(mode)
    root, child = pair(engine, report(engine, MIXED))
    for case, category in ((root, VE), (child, KT)):
        proposal = case.proposal
        assert proposal.category_source == "AGENT_SPLIT" and proposal.service_category_proposed == category
        assert proposal.matched_rule_ids == ["PB-COM-R-SPLIT-01"]
        assert "BPTN" not in proposal.classification_reason and "tách" in proposal.classification_reason
        assert "locked_fields.category" not in proposal.source_references
        assert proposal.location_proposed == "Tòa S1 / Tầng 3 / Hành lang"
    assert child.proposal.asset_type == "LIGHTING" and root.proposal.asset_type is None


def test_s01_the_agent_asks_the_model_once_and_the_child_asks_nothing():
    client = CountingClient(MirrorClient(CATALOG, LEXICON))
    engine = build("mirror", client=client)
    root, child = pair(engine, report(engine, MIXED))
    assert client.calls == 1
    assert len(audits(root, Action.AGENT_DECISION)) == 1 and len(audits(child, Action.AGENT_DECISION)) == 1
    assert root.agent_decision.valid_job_indexes == [0] and child.agent_decision.valid_job_indexes == [1]
    assert root.agent_decision.fingerprint == engine._content_fingerprint(root)
    assert child.agent_decision.fingerprint == engine._content_fingerprint(child)
    assert child.agent_decision.decision == root.agent_decision.decision  # one answer, two readings
    engine.resume(root.ticket.ticket_id)
    engine.resume(child.ticket.ticket_id)
    assert client.calls == 1  # the stored decisions are used for the very content they were made for


def test_s01_the_rules_write_no_agent_decision():
    engine = build("rules")
    root, child = pair(engine, report(engine, MIXED))
    assert root.agent_decision is None and child.agent_decision is None
    assert not audits(root, Action.AGENT_DECISION) and not audits(child, Action.AGENT_DECISION)
    assert child.classification is not None and child.classification.reason_code == "CATEGORY_UNCLEAR"


# ---------------------------------------------------------------------------------------------------- S-02


@pytest.mark.parametrize("mode", MODES)
def test_s02_single_job_and_cause_effect_sentences_are_not_split(mode):
    assert len(REF.MUST_NOT_SPLIT) >= 15
    for text in REF.MUST_NOT_SPLIT:
        engine = build(mode)
        case = engine.receive(text, resident_id=RESIDENT)
        ticket = case.ticket
        assert ticket.split_children == [] and ticket.split_from is None and ticket.split_category is None, text
        assert not audits(case, Action.SPLIT_TICKET), text
        assert len(engine.repo.list()) == 1, text


# ---------------------------------------------------------------------------------------------------- S-03


@pytest.mark.parametrize("mode", MODES)
def test_s03_a_mixed_report_cleared_by_bptn_splits_and_the_child_keeps_the_clearance(mode):
    """Plan 23 P02 (replaces "cleared ⇒ never split"): after a person clears the safety level the report splits like any
    other, and the child inherits the clearance so the cleared words do not stop it again. The mirror fake offers no
    job for this sentence (its rules see a hazard), so with it the Agent's answer, not condition 4, keeps it whole."""
    engine = build(mode)
    root_id = report(engine, TIER2_MIXED)
    ticket = engine.get(root_id).ticket
    assert (ticket.status, ticket.blocker.code, ticket.risk_level) == ("VERIFYING", "SAFETY_REVIEW_REQUIRED", "UNCLEAR")
    engine.safety_confirm_safe(root_id, BPTN, note="Đã gọi cư dân, tiếng xèo xèo là máy lạnh")
    case = engine.get(root_id)
    assert case.ticket.safety_cleared_at is not None
    if mode == "mirror":
        assert case.ticket.split_children == [] and len(engine.repo.list()) == 1
        assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "CATEGORY_UNCLEAR")  # BPTN picks
        return
    root, child = pair(engine, root_id)
    assert (root.ticket.split_category, child.ticket.split_category) == (VE, KT)
    assert child.ticket.safety_cleared_at == root.ticket.safety_cleared_at
    assert child.ticket.safety_cleared_by == BPTN and child.ticket.risk_level == RiskLevel.NONE
    assert all(c.ticket.blocker is None or c.ticket.blocker.code not in {"SAFETY_REVIEW_REQUIRED",
               "EMERGENCY_PENDING_BQL"} for c in (root, child))  # fmt: skip


# ---------------------------------------------------------------------------------------------------- S-04


@pytest.mark.parametrize("mode", MODES)
def test_s04_without_a_full_location_nothing_is_split_and_the_answer_then_splits_with_copies(mode):
    engine = build(mode)
    root_id = report(engine, "Nhiều rác và đèn cũng không sáng")
    ticket = engine.get(root_id).ticket
    assert (ticket.status, ticket.blocker.code) == ("NEED_INFO", "MISSING_INFO")
    assert ticket.split_children == [] and len(engine.repo.list()) == 1
    engine.add_resident_info(root_id, RESIDENT, "Ở hành lang tầng 3 tòa S1")
    root, child = pair(engine, root_id)
    assert [a.content for a in child.additions] == [a.content for a in root.additions] == ["Ở hành lang tầng 3 tòa S1"]
    assert child.additions[0].copied_from == root_id and child.additions[0].addition_id.startswith("SIM-ADD-0002")
    assert engine.effective_location(child) == "Tòa S1 / Tầng 3 / Hành lang"
    assert audits(child, Action.LINK_TICKETS)  # the copy is written in the child's audit


@pytest.mark.parametrize("mode", MODES)
def test_s04_a_building_or_floor_missing_is_not_split(mode):
    engine = build(mode)
    for text in ("Hành lang tầng 3 nhiều rác, đèn cũng không sáng", "Hành lang tòa S1 nhiều rác, đèn cũng không sáng"):
        ticket = engine.get(report(engine, text)).ticket
        assert ticket.status == "NEED_INFO" and ticket.split_children == [], text
    assert all(case.ticket.split_from is None for case in engine.repo.list())


# ---------------------------------------------------------------------------------------------------- S-05


def _old_llm(service: str, ticket_type: str):
    def llm(description):
        return LLMAssessment(service_category=service, ticket_type=ticket_type, reason="Cách cũ: LLM chọn một việc")

    return llm


def test_s05_the_old_llm_path_never_splits_when_the_llm_abstains():
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM), llm=_old_llm("UNKNOWN", "UNKNOWN"))
    engine.reset(with_fixtures=False)
    case = engine.receive(MIXED, resident_id=RESIDENT)
    assert case.classification.reason_code == "CATEGORY_UNCLEAR"  # the rules alone would have split this
    assert case.ticket.split_children == [] and len(engine.repo.list()) == 1
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "CATEGORY_UNCLEAR")


@pytest.mark.parametrize(
    ("service", "ticket_type"),
    [("VE_SINH", "COMMON_AREA_CLEANING"), ("KY_THUAT", "COMMON_AREA_LIGHTING")],
)
def test_s05_the_old_llm_path_never_splits_when_the_llm_chooses_one_playbook(service, ticket_type):
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM), llm=_old_llm(service, ticket_type))
    engine.reset(with_fixtures=False)
    case = engine.receive(MIXED, resident_id=RESIDENT)
    assert case.ticket.split_children == [] and len(engine.repo.list()) == 1


# ---------------------------------------------------------------------------------------------------- S-06


@pytest.mark.parametrize("mode", MODES)
def test_s06_the_switch_off_never_splits(mode):
    off = CATALOG.model_copy(
        update={"agent_policy": CATALOG.agent_policy.model_copy(update={"auto_split_mixed_reports": False})}
    )
    engine = build(mode, catalog=off)
    case = engine.receive(MIXED, resident_id=RESIDENT)
    assert case.ticket.split_children == [] and len(engine.repo.list()) == 1
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "CATEGORY_UNCLEAR")


# ---------------------------------------------------------------------------------------------------- S-07


@pytest.mark.parametrize("mode", MODES)
def test_s07_the_child_checks_duplicates_on_its_own_and_the_root_goes_on(mode):
    clock = Clock(MONDAY_9AM)
    engine = build(mode, clock)
    first = report(engine, LIGHT)
    assert engine.get(first).ticket.status == "ROUTED"
    clock.advance(minutes=10)  # the Agent is only shown candidates created strictly before the report
    root, child = pair(engine, report(engine, MIXED))
    assert (root.ticket.status, root.ticket.department_id) == ("ROUTED", "DEPT_CLEANING")
    assert (child.ticket.status, child.ticket.blocker.code) == ("VERIFYING", "DUPLICATE")
    assert child.ticket.blocker.related_ticket_id == first
    assert root.ticket.blocker is None and root.ticket.merged_into is None


# ---------------------------------------------------------------------------------------------------- S-08


def test_s08_a_ticket_already_split_is_never_split_again():
    engine = build("rules")
    root, child = pair(engine, report(engine, MIXED))
    for case in (root, child):
        engine.resume(case.ticket.ticket_id)  # the pipeline never reads a split ticket as a new report
    assert len(engine.repo.list()) == 2
    for case in (root, child):
        work = case.model_copy(deep=True)
        assert work.ticket.risk_level == RiskLevel.NONE and engine.effective_location(work) is not None
        assert engine._try_split(work, engine.clock()) is False  # the guard itself (SPEC-P05 §3 condition 3)
        assert len(work.ticket.split_children) == len(case.ticket.split_children)


def test_s08_an_addition_on_a_split_ticket_adds_no_second_split():
    engine = build("rules")
    root_id = report(engine, "Nhiều rác và đèn cũng không sáng")
    engine.add_resident_info(root_id, RESIDENT, "Ở hành lang tầng 3 tòa S1")
    root, child = pair(engine, root_id)
    assert engine.get(child.ticket.ticket_id).ticket.split_children == []
    assert len(engine.repo.list()) == 2


# ---------------------------------------------------------------------------------------------------- S-09


def _split(mode="mirror"):
    engine = build(mode)
    root, child = pair(engine, report(engine, MIXED))
    return engine, root.ticket.ticket_id, child.ticket.ticket_id


def test_s09_undo_split_merges_the_child_into_the_root_without_counting_a_duplicate():
    engine, root_id, child_id = _split()
    before = engine.get(root_id)
    done = engine.undo_split(child_id, BPTN, note="Hai việc cùng một nhân viên xử lý")
    assert (done.ticket.status, done.ticket.merged_into, done.ticket.blocker) == ("MERGED", root_id, None)
    assert done.ticket.department_id is None and done.ticket.dispatched_at is None
    assert done.ticket.split_from == root_id and done.ticket.split_category == KT  # the link stays
    row = audits(done, Action.SPLIT_UNDO)[-1]
    assert (row.field_name, row.old_value, row.new_value) == ("merged_into", None, root_id)
    root = engine.get(root_id)
    assert root.ticket.merged_children == [child_id] and root.ticket.duplicate_count == before.ticket.duplicate_count
    assert root.ticket.split_children == [child_id] and root.ticket.status == "ROUTED"
    assert any(a.action == Action.LINK_TICKETS and a.field_name == "merged_children" for a in root.audit)


def test_s09_undo_split_refuses_what_is_not_a_split_child_or_has_started():
    engine, root_id, child_id = _split()
    with pytest.raises(InvalidTransitionError):
        engine.undo_split(root_id, BPTN, note="Gốc không phải con")  # no split_from
    with pytest.raises(GuardError):
        engine.undo_split(child_id, BPTN, note="  ")
    assert engine.get(child_id).ticket.status == "ROUTED"
    engine.accept(child_id, TEC)  # the department took the job
    with pytest.raises(InvalidTransitionError):
        engine.undo_split(child_id, BPTN, note="Đã nhận việc")
    assert engine.get(child_id).ticket.status == "IN_PROGRESS" and engine.get(root_id).ticket.merged_children == []


def test_s09_undo_split_needs_a_live_root_and_the_right_role():
    engine, root_id, child_id = _split()
    with pytest.raises(ActionDeniedError):
        engine.undo_split(child_id, RESIDENT, note="Cư dân không được")
    engine.cancel(root_id, BQL, cancel_reason="Gốc bị hủy")
    with pytest.raises(GuardError, match="BQL hủy ticket con"):
        engine.undo_split(child_id, BPTN, note="Gốc đã kết thúc")
    assert engine.get(child_id).ticket.status == "ROUTED"


def test_s09_bptn_is_denied_on_a_child_whose_blocker_belongs_to_bql():
    engine, _, child_id = _split()
    with engine.lock, engine.repo.transaction() as tx:  # forged state: an emergency waiting for BQL on the child
        work = tx.get_for_update(child_id).model_copy(deep=True)
        blocker = engine._new_blocker(work, ReasonCode.EMERGENCY_PENDING_BQL, engine.clock(), resume_step=2, note="x")
        engine._set_ticket(
            work,
            status="VERIFYING",
            blocker=blocker,
            risk_level=RiskLevel.EMERGENCY,
            department_id=None,
            dispatched_at=None,
        )
        tx.save(work)
    with pytest.raises(ActionDeniedError):
        engine.undo_split(child_id, BPTN, note="BPTN không được")
    assert audits(engine.get(child_id), Action.SPLIT_UNDO) == []
    assert engine.get(child_id).ticket.status == "VERIFYING"
    assert engine.get(child_id).ticket.merged_into is None


def test_s09_bql_can_undo_too_and_the_rules_engine_gives_the_same_result():
    engine, root_id, child_id = _split("rules")
    engine.undo_split(child_id, BQL, note="BQL hoàn tác tách")
    assert engine.get(child_id).ticket.status == "MERGED"
    assert engine.get(root_id).ticket.duplicate_count == 0


# ---------------------------------------------------------------------------------------------------- S-10


def test_s10_the_agent_splits_where_the_rules_see_one_job_and_the_child_waits_for_a_person():
    text = "Hành lang tầng 3 tòa S1 nhiều rác, tối om không thấy đường"
    reply = decision(
        **{
            "jobs.1.quote": "tối om không thấy đường",
            "jobs.1.asset_id": None,
            "jobs.1.materials": [],
            "jobs.1.priority": "HIGH",
        }
    )
    engine = build("mirror", client=ScriptedClient({"tối om": reply}))
    root, child = pair(engine, report(engine, text))
    assert root.agent_decision.rule_categories == [VE]  # the rules saw one job only
    assert (root.ticket.status, root.ticket.department_id) == ("ROUTED", "DEPT_CLEANING")
    assert (child.ticket.status, child.ticket.blocker.code) == ("VERIFYING", "PENDING_REVIEW")
    assert child.ticket.review_status == "PENDING_REVIEW" and TicketFlag.AGENT_DISAGREEMENT in child.ticket.flags
    assert child.ticket.split_category == KT and child.agent_decision.valid_job_indexes == [1]


# ---------------------------------------------------------------------------------------------------- S-11 (memory + postgres)


@pytest.fixture(params=STORES)
def repo(request):
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    return InMemoryRepository(initial_stock(load_catalog()))


class _FailingChildTx:
    """The transaction as it is, except that the insert of a ticket other than `keep` fails."""

    def __init__(self, tx, keep: str):
        self._tx, self._keep = tx, keep

    def insert(self, case):
        if case.ticket.ticket_id != self._keep:
            raise RuntimeError("boom: insert of the child")
        self._tx.insert(case)

    def __getattr__(self, name):
        return getattr(self._tx, name)


def _failing_inserts(repo, keep: str):
    from contextlib import contextmanager

    real = repo.transaction

    @contextmanager
    def transaction():
        with real() as tx:
            yield _FailingChildTx(tx, keep)

    return transaction


def test_s11_a_failure_inserting_the_child_changes_no_ticket_and_leaves_a_gap(repo, monkeypatch):
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM), repo=repo)
    engine.reset(with_fixtures=False)
    number = repo.next_ticket_number()
    raw = RawTicket(
        ticket_id=f"SIM-TKT-{number:04d}",
        created_at=MONDAY_9AM.isoformat(timespec="seconds"),
        original_description=MIXED,
    )
    engine.ingest(raw)
    stored = engine.get(raw.ticket_id)
    monkeypatch.setattr(repo, "transaction", _failing_inserts(repo, raw.ticket_id))
    with pytest.raises(RuntimeError, match="boom"):
        engine.run_agent(raw.ticket_id)
    monkeypatch.undo()
    after = engine.get(raw.ticket_id)
    assert after == stored and after.ticket.status == "RECEIVED" and after.ticket.split_children == []
    assert [c.ticket.ticket_id for c in repo.list()] == [raw.ticket_id]  # no child, nothing else changed
    assert not [a for a in after.audit if a.action == Action.SPLIT_TICKET]
    # the retry (what the orphan job does) splits; the number taken by the failed try stays empty
    engine.run_agent(raw.ticket_id)
    root, child = pair(engine, raw.ticket_id)
    assert child.ticket.ticket_id == f"SIM-TKT-{number + 2:04d}" and root.ticket.status == "ROUTED"


def test_s11_a_split_survives_a_new_engine_on_the_same_store(repo):
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM), repo=repo)
    engine.reset(with_fixtures=False)
    root_id = report(engine, MIXED)
    fresh = MaintenanceEngine(clock=engine.clock, repo=repo)
    root, child = pair(fresh, root_id)
    for case in (root, child):
        assert Case.model_validate_json(case.model_dump_json()) == case  # the doc survives the JSON column
    assert child.ticket.split_from == root_id and root.ticket.split_children == [child.ticket.ticket_id]
    done = fresh.undo_split(child.ticket.ticket_id, BPTN, note="Hoàn tác sau khi khởi động lại")
    assert done.ticket.status == "MERGED" and fresh.get(root_id).ticket.merged_children == [child.ticket.ticket_id]


# ---------------------------------------------------------------------------------------------------- S-12


@pytest.mark.parametrize("mode", MODES)
def test_s12_the_resident_sees_both_tickets_and_the_link(mode):
    from src.maintenance.views import resident_view

    engine = build(mode)
    root, child = pair(engine, report(engine, MIXED))
    now = engine.clock()
    root_view = resident_view(engine, root, now)
    child_view = resident_view(engine, child, now)
    assert [item.ticket_id for item in root_view.split_into] == [child.ticket.ticket_id]
    assert root_view.split_from is None and child_view.split_into == []
    assert child_view.split_from.ticket_id == root.ticket.ticket_id
    assert child_view.description == root_view.description == MIXED
    assert child_view.timeline[0].public_message.startswith("Phản ánh này được tách từ phản ánh")
    assert root_view.department_name != child_view.department_name
