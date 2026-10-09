"""Plan 06 WP10 (SPEC-P07 sections 6-8, TESTING 3.10 F-01..F-06): the follow-up repair ticket.

BQL opens it from a ticket that is an open emergency; the source keeps its status (BQL closes it on its own). The new
ticket inherits the safety clearance, so step 2b skips it, and runs the pipeline in the same transaction. F-06 uses the
fake model of TESTING section 2: it is asked once, outside the lock. The stores run on both back ends (`pg` only
with --pg).
"""

from datetime import timedelta

import pytest

from src.maintenance.agent.client import CountingClient, LockProbeClient, MirrorClient
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import (
    ActionDeniedError,
    AuditWriteError,
    GuardError,
    InvalidTransitionError,
    MaintenanceEngine,
    initial_stock,
    resident_photos,
)
from src.maintenance.enums import (
    SAFETY_REASONS,
    Action,
    EvidenceSource,
    EvidenceType,
    ReadabilityStatus,
    TicketStatus,
)
from src.maintenance.models import EvidenceRecord, ResidentAddition
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import BPTN, BQL, MONDAY_9AM, RESIDENT, Clock, agent_engine, report

STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]

SMOKE = "Có mùi khét ở hành lang tầng 3 tòa S1."  # tier 1: VERIFYING / EMERGENCY_PENDING_BQL
SMOKE_LAMP = "Đèn hành lang tầng 3 tòa S1 không sáng và có mùi khét."
LAMP = "Đèn hành lang tầng 3 tòa S1 không sáng."
SWEEP = "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh."
NOTE = "BQL đã kiểm tra hiện trường, an toàn; cần thợ sửa dây điện"


@pytest.fixture(params=STORES)
def repo(request):
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    return InMemoryRepository(initial_stock(load_catalog()))


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def engine(repo, clock) -> MaintenanceEngine:
    e = MaintenanceEngine(clock=clock, repo=repo)
    e.reset(with_fixtures=False)
    return e


def hold_on(engine: MaintenanceEngine) -> None:
    """Q18 ON for this engine only (a copy of the catalog; the YAML stays false)."""
    policy = engine.catalog.agent_policy.model_copy(update={"hold_near_open_emergency": True})
    engine.catalog = engine.catalog.model_copy(update={"agent_policy": policy})


def give_resident_material(engine: MaintenanceEngine, ticket_id: str) -> None:
    """The resident's later addition and two photos on the stored ticket: one of them from the resident, one from
    the department (that one must not be copied)."""
    with engine.repo.transaction() as tx:
        case = tx.get_for_update(ticket_id)
        now = engine.clock()
        case.additions.append(
            ResidentAddition(
                addition_id=f"SIM-ADD-{ticket_id.removeprefix('SIM-TKT-')}-01",
                ticket_id=ticket_id,
                content="Mùi khét nặng hơn gần hộp điện",
                submitted_by=RESIDENT,
                submitted_at=now - timedelta(minutes=5),  # before BQL clears it (an addition after that is re-read)
            )
        )
        for index, source in enumerate((EvidenceSource.RESIDENT_ORIGINAL, EvidenceSource.DEPARTMENT_EXECUTION), 1):
            case.evidence.append(
                EvidenceRecord(
                    evidence_id=f"SIM-EVD-{ticket_id.removeprefix('SIM-TKT-')}-{index:02d}",
                    ticket_id=ticket_id,
                    work_order_draft_id=None,
                    requirement_id=None,
                    evidence_type=EvidenceType.RESIDENT_ORIGINAL
                    if source == EvidenceSource.RESIDENT_ORIGINAL
                    else EvidenceType.SIMULATED_IMAGE,
                    content_or_metadata=f"photo-{index}.jpg",
                    source=source,
                    submitted_by=RESIDENT,
                    submitted_at=now,
                    readability_status=ReadabilityStatus.READABLE,
                    immutable=True,
                )
            )
        tx.save(case)


def emergency(engine: MaintenanceEngine, clock: Clock) -> str:
    smoke = report(engine, SMOKE)
    assert engine.get(smoke).ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    clock.advance(minutes=20)
    return smoke


def test_f01_bql_opens_a_follow_up_that_inherits_the_clearance_and_leaves_the_source_alone(engine, clock):
    smoke = emergency(engine, clock)
    give_resident_material(engine, smoke)
    source_before = engine.get(smoke).ticket
    new = engine.create_follow_up(smoke, BQL, note=NOTE)
    ticket = new.ticket
    assert ticket.ticket_id != smoke and ticket.follow_up_of == smoke
    assert (ticket.safety_cleared_by, ticket.safety_clear_reason) == (BQL, NOTE)
    assert ticket.safety_cleared_at == clock.now and ticket.risk_level == "NONE"
    assert ticket.resident_id == source_before.resident_id
    assert ticket.raw.original_description == source_before.raw.original_description
    assert ticket.raw.channel == "follow_up"
    assert [a.content for a in new.additions] == ["Mùi khét nặng hơn gần hộp điện"]
    assert [a.copied_from for a in new.additions] == [smoke]
    photos = resident_photos(new)  # the resident's photo is copied, the department's is not
    assert [(p.content_or_metadata, p.copied_from) for p in photos] == [("photo-1.jpg", smoke)]
    assert len(new.evidence) == 1
    # the source: same status and blocker, linked, one CREATE_FOLLOW_UP row
    source = engine.get(smoke)
    assert (source.ticket.status, source.ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert ticket.ticket_id in source.ticket.related_ticket_ids and smoke in ticket.related_ticket_ids
    (row,) = [a for a in source.audit if a.action == Action.CREATE_FOLLOW_UP]
    assert (row.field_name, row.new_value, row.reason, row.actor_id) == ("follow_up", ticket.ticket_id, NOTE, BQL)
    (mine,) = [a for a in new.audit if a.action == Action.CREATE_FOLLOW_UP]
    assert (mine.field_name, mine.new_value) == ("follow_up_of", smoke)
    assert smoke in new.not_duplicate_of
    assert engine.get(ticket.ticket_id) == new  # what came back is what was stored


def test_f02_step_2b_is_skipped_and_the_pipeline_ends_at_a_valid_stop(engine, clock):
    smoke = emergency(engine, clock)
    new = engine.create_follow_up(smoke, BQL, note=NOTE)
    ticket = new.ticket
    assert ticket.status != TicketStatus.RECEIVED  # the pipeline ran to its end in the same transaction
    assert ticket.risk_level == "NONE" and ticket.safety_cleared_at is not None
    assert ticket.blocker is None or ticket.blocker.code not in SAFETY_REASONS
    assert not [a for a in new.audit if a.rule_id and a.rule_id.startswith("PB-SAF") and a.field_name == "risk_level"]
    assert new.classification is not None  # step 3 ran


def test_f03_one_transaction_a_failure_while_writing_leaves_no_new_ticket(repo, clock):
    failing = {"on": False}

    def sink(rows):
        if failing["on"] and any(row.ticket_id != smoke for row in rows):
            raise RuntimeError("audit sink down")

    engine = MaintenanceEngine(clock=clock, repo=repo, audit_sink=sink)
    engine.reset(with_fixtures=False)
    smoke = emergency(engine, clock)
    version, ledger, count = repo.version_of(smoke), len(repo.log_rows()), repo.count()
    failing["on"] = True
    with pytest.raises(AuditWriteError):
        engine.create_follow_up(smoke, BQL, note=NOTE)
    assert (repo.version_of(smoke), len(repo.log_rows()), repo.count()) == (version, ledger, count)
    assert engine.get(smoke).ticket.related_ticket_ids == []
    failing["on"] = False  # control: the same call with a healthy sink makes exactly one ticket
    new = engine.create_follow_up(smoke, BQL, note=NOTE)
    assert repo.count() == count + 1 and new.ticket.follow_up_of == smoke


def test_f04_only_bql_an_open_emergency_and_a_note(engine, clock):
    smoke = emergency(engine, clock)
    lamp = report(engine, LAMP)
    count = engine.repo.count()
    for actor in (BPTN, RESIDENT):
        with pytest.raises(ActionDeniedError):
            engine.create_follow_up(smoke, actor, note=NOTE)
    denied = [a for a in engine.get(smoke).audit if a.action == Action.ACTION_DENIED and a.field_name == "follow_up"]
    assert [(a.action_result, a.actor_id) for a in denied] == [("ACTION_DENIED", BPTN), ("ACTION_DENIED", RESIDENT)]
    with pytest.raises(InvalidTransitionError):
        engine.create_follow_up(lamp, BQL, note=NOTE)  # an ordinary ticket
    with pytest.raises(GuardError):
        engine.create_follow_up(smoke, BQL, note="   ")
    assert engine.repo.count() == count  # nothing was created by any refusal
    engine.emergency_close(smoke, BQL, note="Đã xử lý")
    with pytest.raises(InvalidTransitionError):
        engine.create_follow_up(smoke, BQL, note=NOTE)  # CLOSED is out of scope


def test_f05_a_follow_up_does_not_wait_for_its_own_source_with_the_switch_on(engine, clock):
    hold_on(engine)
    smoke = report(engine, SMOKE_LAMP)  # an emergency whose repair is a lamp job, so the follow-up can be routed
    assert engine.get(smoke).ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    clock.advance(minutes=20)
    control = report(engine, SWEEP)  # an ordinary report at the same place does wait: the switch is effective
    assert engine.get(control).ticket.status == TicketStatus.ON_HOLD
    clock.advance(minutes=5)
    new = engine.create_follow_up(smoke, BQL, note=NOTE)
    ticket = new.ticket
    assert not (ticket.status == TicketStatus.ON_HOLD and ticket.blocker.code == "WAITING_EMERGENCY")
    assert ticket.status == TicketStatus.ROUTED
    assert smoke in ticket.related_ticket_ids  # linked, not held


def test_f06_with_an_agent_the_model_is_asked_once_and_outside_the_lock(clock):
    probe = LockProbeClient(None, None)
    counting = CountingClient(MirrorClient(load_catalog(), load_lexicon()))
    probe.inner = counting
    engine = agent_engine(clock, probe)
    probe.engine = engine
    smoke = emergency(engine, clock)
    assert counting.calls == 0  # a rule emergency is never put to the model (A-24)
    new = engine.create_follow_up(smoke, BQL, note=NOTE)
    assert counting.calls == 1
    assert probe.observations == [(False, 0)]  # no lock, no transaction (I-16)
    assert new.agent_decision is not None and new.agent_decision.source == "AGENT"
    audits = [a for a in new.audit if a.action == Action.AGENT_DECISION]
    assert len(audits) == 1  # the decision of the temporary case was the one applied, not asked again
    assert new.ticket.follow_up_of == smoke and new.ticket.status != TicketStatus.RECEIVED
