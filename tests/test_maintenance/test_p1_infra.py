"""Plan 06 WP5 (SPEC-P02 §1-§3, TESTING §3.4 C-06..C-11): one-transaction multi-ticket writes, the coordination
mixins and the P1 hooks.

C-06 and C-10 run on both stores (`pg` only with --pg). The other cases read the engine, not the store.
The hook stubs of the mixins are asserted too, so that a later wave cannot change a signature unnoticed.
"""

import subprocess
import sys

import pytest

from src.maintenance.catalog import load_catalog
from src.maintenance.engine import (
    AGENT_ID,
    DEFAULT_RESIDENT_ID,
    LOCAL_TZ,
    SYSTEM_ID,
    AuditWriteError,
    EngineError,
    GuardError,
    InvalidTransitionError,
    MaintenanceEngine,
    initial_stock,
    resident_photos,
)
from src.maintenance.enums import Action, ActorRole, EvidenceSource, EvidenceType, ReadabilityStatus, TicketStatus
from src.maintenance.models import EvidenceRecord, RawTicket, ResidentAddition
from src.maintenance.store.memory import InMemoryRepository
from src.maintenance.views import resident_view
from tests.test_maintenance.helpers import BPTN, BQL, CLN, LIGHTING, RESIDENT, SYSTEM, report

STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]

SWEEP = "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh."
LAMP_4 = "Đèn hành lang tầng 4 tòa S1 không sáng."
SMOKE = "Có mùi khét ở hành lang tầng 3 tòa S1."  # tier 1: EMERGENCY_PENDING_BQL, BQL can close it


@pytest.fixture(params=STORES)
def repo(request):
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    return InMemoryRepository(initial_stock(load_catalog()))


@pytest.fixture
def engine(repo, clock) -> MaintenanceEngine:
    e = MaintenanceEngine(clock=clock, repo=repo)
    e.reset(with_fixtures=False)
    return e


def run_op(engine: MaintenanceEngine, ticket_id: str, op):
    """One engine operation (the scheduled job's identity: SYSTEM may run it) around `op(work, now)`."""
    return engine._mutate(ticket_id, SYSTEM, Action.RUN_JOBS, op)


def new_ticket(engine: MaintenanceEngine, now, text: str = "Rác ở hành lang tầng 5 tòa S2"):
    raw = RawTicket(
        ticket_id=f"SIM-TKT-{engine.repo.next_ticket_number():04d}",
        created_at=now.astimezone(LOCAL_TZ).isoformat(timespec="seconds"),
        original_description=text,
        channel="follow_up",
    )
    return engine._build_case(raw, None, RESIDENT, now)


def link_with(engine: MaintenanceEngine, other_id: str):
    def op(work, now):
        other = engine._related_case(other_id)
        engine._link_pair(work, other, now, AGENT_ID, ActorRole.AGENT, why="test")

    return op


# ---------------------------------------------------------------------- C-06..C-10: the one-transaction scope


def test_c06_sink_failure_on_the_second_ticket_changes_neither(clock, repo):
    failing: dict[str, str | None] = {"ticket": None}

    def sink(rows):
        if failing["ticket"] and any(row.ticket_id == failing["ticket"] for row in rows):
            raise RuntimeError("audit sink down")

    engine = MaintenanceEngine(clock=clock, repo=repo, audit_sink=sink)
    engine.reset(with_fixtures=False)
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    versions = (repo.version_of(a), repo.version_of(b))
    ledger = len(repo.log_rows())

    failing["ticket"] = b
    with pytest.raises(AuditWriteError):
        run_op(engine, a, link_with(engine, b))
    assert (repo.version_of(a), repo.version_of(b)) == versions  # nothing was committed, neither ticket
    assert len(repo.log_rows()) == ledger
    assert engine.get(a).ticket.related_ticket_ids == [] and engine.get(b).ticket.related_ticket_ids == []

    failing["ticket"] = None  # control: the same operation with a healthy sink writes both tickets
    run_op(engine, a, link_with(engine, b))
    assert (repo.version_of(a), repo.version_of(b)) == (versions[0] + 1, versions[1] + 1)
    assert engine.get(a).ticket.related_ticket_ids == [b] and engine.get(b).ticket.related_ticket_ids == [a]


def test_c06b_a_second_ticket_that_did_not_change_is_not_saved(engine):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    before = engine.repo.version_of(b)
    run_op(engine, a, lambda work, now: engine._related_case(b))  # locked and read, never written (I-26)
    assert engine.repo.version_of(b) == before


def test_c07_related_case_outside_an_operation_is_an_engine_error(engine):
    a = report(engine, SWEEP)
    with pytest.raises(EngineError) as raised:
        engine._related_case(a)
    assert raised.value.detail == {"ticket_id": a}
    with pytest.raises(EngineError):
        engine._insert_case(new_ticket(engine, engine.clock()))


def test_c07b_related_case_resolves_main_touched_and_missing(engine):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)

    def op(work, now):
        assert engine._related_case(a) is work
        first = engine._related_case(b)
        assert engine._related_case(b) is first  # the touched copy, not a second lock
        assert first is not engine.repo.get(b)  # a deep copy: the stored case is never edited in place
        with pytest.raises(EngineError):
            engine._related_case("SIM-TKT-9999")

    run_op(engine, a, op)


def test_c08_cases_snapshot_inside_an_operation_sees_the_edit_and_the_insert(engine):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    outside = {case.ticket.ticket_id for case in engine._cases_snapshot()}
    assert outside == {a, b} and [c.ticket.related_ticket_ids for c in engine._cases_snapshot()] == [[], []]
    seen = {}

    def op(work, now):
        engine._link_pair(work, engine._related_case(b), now, AGENT_ID, ActorRole.AGENT, why="test")
        fresh = new_ticket(engine, now)
        engine._insert_case(fresh)
        with pytest.raises(GuardError):
            engine._insert_case(fresh)  # the same id twice
        snapshot = {case.ticket.ticket_id: case for case in engine._cases_snapshot()}
        seen["ids"] = set(snapshot)
        seen["b_related"] = snapshot[b].ticket.related_ticket_ids
        seen["main_is_work"] = snapshot[a] is work
        seen["new"] = fresh.ticket.ticket_id
        assert engine._case_view(b) is snapshot[b] and engine._case_view(seen["new"]) is fresh

    run_op(engine, a, op)
    assert seen["ids"] == {a, b, seen["new"]} and seen["b_related"] == [a] and seen["main_is_work"]
    assert engine._case_view(a) is not None  # outside an operation: the repository's own copy
    assert {c.ticket.ticket_id for c in engine._cases_snapshot()} == {a, b, seen["new"]}


def test_c08b_the_repository_is_listed_once_per_operation(engine, monkeypatch):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    calls = []
    real = engine.repo.list
    monkeypatch.setattr(engine.repo, "list", lambda: calls.append(1) or real())

    def op(work, now):
        engine._related_case(b)
        for _ in range(3):
            engine._cases_snapshot()

    run_op(engine, a, op)
    assert len(calls) == 1


def test_c09_an_operation_that_touches_a_closed_ticket_does_not_save_it(engine):
    closed = report(engine, SMOKE)
    engine.emergency_close(closed, BQL, note="Đã xử lý ngoài hệ thống")
    assert engine.get(closed).ticket.status == TicketStatus.CLOSED
    a = report(engine, LAMP_4)
    versions = (engine.repo.version_of(a), engine.repo.version_of(closed))

    run_op(engine, a, lambda work, now: engine._related_case(closed))
    assert engine.repo.version_of(closed) == versions[1]  # read, untouched, not saved
    before = engine.repo.version_of(a)

    run_op(engine, a, link_with(engine, closed))  # I-26: the open side links, the finished side is not written
    assert engine.repo.version_of(closed) == versions[1] and engine.get(closed).ticket.related_ticket_ids == []
    assert engine.repo.version_of(a) == before + 1 and engine.get(a).ticket.related_ticket_ids == [closed]


def test_c10_an_inserted_ticket_and_its_audit_commit_together(engine):
    a = report(engine, SWEEP)
    ledger = len(engine.repo.log_rows())
    made = {}

    def op(work, now):
        fresh = new_ticket(engine, now)
        engine._insert_case(fresh)
        made["id"] = fresh.ticket.ticket_id

    run_op(engine, a, op)
    created = engine.get(made["id"])  # cases row first, then its audit_log / notifications rows (foreign keys)
    assert engine.repo.version_of(made["id"]) == 1
    assert [row.ticket_id for row in engine.repo.log_rows()[ledger:]].count(made["id"]) == len(created.audit) + len(
        created.events
    )
    assert created.audit[0].action == Action.INGEST and created.ticket.status == TicketStatus.RECEIVED


def test_c10b_the_main_ticket_is_committed_before_the_related_and_inserted_ones(engine):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    ledger = len(engine.repo.log_rows())
    made = {}

    def op(work, now):
        engine._link_pair(work, engine._related_case(b), now, AGENT_ID, ActorRole.AGENT, why="test")
        fresh = new_ticket(engine, now)
        engine._insert_case(fresh)
        made["id"] = fresh.ticket.ticket_id

    run_op(engine, a, op)
    order = []
    for row in engine.repo.log_rows()[ledger:]:
        if row.ticket_id not in order:
            order.append(row.ticket_id)
    assert order == [a, b, made["id"]]  # main, then touched in touch order, inserted ones in insert order


# ---------------------------------------------------------------------- C-11: merged-in content stays staff-only


def test_c11_merged_from_content_is_invisible_to_rules_agent_and_resident(engine):
    a = report(engine, SWEEP)
    case = engine.get(a)
    now = engine.clock()
    merged_text, copied_text = "ZZZMERGED có khói ở tầng 9 tòa S2", "ZZZCOPIED ở hầm B1 tòa S1"
    additions = [
        ResidentAddition(
            addition_id="SIM-ADD-0001-91",
            ticket_id=a,
            content=merged_text,
            submitted_by=RESIDENT,
            submitted_at=now,
            merged_from="SIM-TKT-0099",
        ),
        ResidentAddition(
            addition_id="SIM-ADD-0001-92",
            ticket_id=a,
            content=copied_text,
            submitted_by=RESIDENT,
            submitted_at=now,
            copied_from="SIM-TKT-0098",
        ),
    ]

    def photo(evidence_id: str, **origin) -> EvidenceRecord:
        return EvidenceRecord(
            evidence_id=evidence_id,
            ticket_id=a,
            work_order_draft_id=None,
            requirement_id=None,
            evidence_type=EvidenceType.RESIDENT_ORIGINAL,
            content_or_metadata="photo.jpg",
            source=EvidenceSource.RESIDENT_ORIGINAL,
            submitted_by=RESIDENT,
            submitted_at=now,
            readability_status=ReadabilityStatus.READABLE,
            immutable=True,
            **origin,
        )

    evidence = [
        photo("SIM-EVD-0001-91", merged_from="SIM-TKT-0099"),
        photo("SIM-EVD-0001-92", copied_from="SIM-TKT-0098"),
    ]
    loaded = case.model_copy(update={"additions": additions, "evidence": evidence})

    for read in (engine._content, engine._location_text, engine._safety_scope_text):
        assert merged_text not in read(loaded)
        assert copied_text in read(loaded)  # a copy IS the ticket's own text (split child / follow-up)
    assert resident_view(engine, loaded, now).additions == [copied_text]
    assert [e.evidence_id for e in resident_photos(loaded)] == ["SIM-EVD-0001-92"]


# ---------------------------------------------------------------------- helpers of the scope (SPEC-P02 §2)


def test_copy_additions_and_photos_skip_merged_and_bounce_back(engine):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    engine.add_resident_photo(a, RESIDENT, "a.jpg")
    case_a = engine.get(a)
    now = engine.clock()
    src = case_a.model_copy(
        deep=True,
        update={
            "additions": [
                ResidentAddition(
                    addition_id="SIM-ADD-0001-01", ticket_id=a, content="own", submitted_by=RESIDENT, submitted_at=now
                ),
                ResidentAddition(
                    addition_id="SIM-ADD-0001-02",
                    ticket_id=a,
                    content="came from elsewhere",
                    submitted_by=RESIDENT,
                    submitted_at=now,
                    merged_from="SIM-TKT-0077",
                ),
                ResidentAddition(
                    addition_id="SIM-ADD-0001-03",
                    ticket_id=a,
                    content="bounce",
                    submitted_by=RESIDENT,
                    submitted_at=now,
                    copied_from=b,
                ),
            ]
        },
    )
    out = {}

    def op(work, now_):
        dst = engine._related_case(b)
        out["added"] = engine._copy_additions(src, dst, now_, mode="merge")
        out["photos"] = engine._copy_resident_photos(src, dst, now_, mode="copy")
        out["again"] = engine._copy_additions(src, dst, now_, mode="copy")

    run_op(engine, a, op)
    got = engine.get(b)
    assert out["added"] == ["SIM-ADD-" + b.removeprefix("SIM-TKT-") + "-01"]
    assert [(x.content, x.merged_from, x.copied_from) for x in got.additions[:1]] == [("own", a, None)]
    assert len(got.additions) == 2 and got.additions[1].copied_from == a  # the second call copied it again as "copy"
    assert [(e.copied_from, e.merged_from, e.immutable) for e in got.evidence] == [(a, None, True)]
    assert got.evidence[0].evidence_id == out["photos"][0] != case_a.evidence[0].evidence_id
    linked = [x for x in got.audit if x.action == Action.LINK_TICKETS]
    assert [x.field_name for x in linked] == ["additions", "evidence", "additions"]
    assert resident_view(engine, got, now).additions == ["own"]


def test_link_pair_links_both_sides_once(engine):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    run_op(engine, a, link_with(engine, b))
    run_op(engine, a, link_with(engine, b))  # already linked: no second id, no second audit row
    for mine, other in ((a, b), (b, a)):
        case = engine.get(mine)
        assert case.ticket.related_ticket_ids == [other]
        assert [x.action for x in case.audit].count(Action.LINK_TICKETS) == 1


def test_build_case_carries_public_message_and_notification_extras(engine):
    now = engine.clock()
    raw = RawTicket(ticket_id="SIM-TKT-0500", created_at=now.isoformat(timespec="seconds"), original_description="x y")
    plain = engine._build_case(raw, None, RESIDENT, now)
    custom = engine._build_case(
        raw,
        None,
        DEFAULT_RESIDENT_ID,
        now,
        public_message="Tiếp nhận tiếp theo",
        notify_extra={"follow_up_of": "X"},
        reason="r",
    )
    assert plain.events[0].public_message != "Tiếp nhận tiếp theo"
    assert custom.events[0].public_message == "Tiếp nhận tiếp theo"
    assert custom.notifications[0].payload == {"to": "RECEIVED", "follow_up_of": "X"}
    assert plain.notifications[0].payload == {"to": "RECEIVED"} and custom.audit[0].reason == "r"


# ---------------------------------------------------------------------- SPEC-P02 §1 / §3: mixins, hooks, stubs


def test_mixin_layout_and_import_paths(engine):
    import src.maintenance.engine as engine_module  # imports below are lazy: the module must still load on the base
    import src.maintenance.errors as errors_module
    from src.maintenance.coordination import DepartmentMixin, MergeMixin, NeighborMixin, SplitMixin

    assert MaintenanceEngine.__mro__[1:5] == (MergeMixin, SplitMixin, DepartmentMixin, NeighborMixin)

    assert engine_module.InvalidTransitionError is errors_module.InvalidTransitionError
    assert engine_module.ActionDeniedError is errors_module.ActionDeniedError
    assert engine_module.AuditWriteError is errors_module.AuditWriteError
    assert (SYSTEM_ID, AGENT_ID) == ("SIM-ACTOR-SYSTEM", "SIM-ACTOR-AGENT")
    code = (
        "import sys; import src.maintenance.coordination; "
        "assert 'src.maintenance.engine' not in sys.modules, 'a mixin imported the engine'"
    )
    done = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stderr


def test_hook_stubs_have_their_stage_one_bodies(engine):
    a, b = report(engine, SWEEP), report(engine, LAMP_4)
    case_a, case_b = engine.get(a).model_copy(deep=True), engine.get(b).model_copy(deep=True)
    now = engine.clock()
    assert engine._on_duplicate_detected(case_a, case_b, now) is None
    assert engine._release_duplicate_count(case_a, None, now) is None
    assert engine._unmerge_children_of(case_a, now) is None
    assert engine._apply_pri_u1(case_a, "MEDIUM", "why") == ("MEDIUM", "why")
    assert engine._try_split(case_a, now) is False
    assert engine._carry_over_material_qty([], []) is None
    assert engine._link_emergency_both_ways(case_a, [b], now) is None
    assert engine._hold_for_emergency(case_a, now) is False
    assert engine._release_waiting_for(case_a, now) is None
    for stub, args, kwargs in (
        (engine._t09_unmerge_by_person, (case_a, BQL, ActorRole.BQL, now), {"note": "n"}),
        (engine._unmerge, (case_a, BQL, ActorRole.BQL, now), {"note": "n"}),
        (engine._t16_report_wrong_department, (case_a, CLN, ActorRole.DEPARTMENT, now), {"note": "n"}),
        (engine._t17_keep_department, (case_a, BQL, ActorRole.BQL, now), {"note": "n"}),
    ):
        with pytest.raises(NotImplementedError, match="plan 06 WP"):
            stub(*args, **kwargs)
    for call in (
        lambda: engine.bql_merge(a, BQL, into=b, note="n"),
        lambda: engine.undo_split(a, BQL, note="n"),
        lambda: engine.bql_wrong_department(a, BQL, decision="KEEP", note="n"),
        lambda: engine.create_follow_up(a, BQL, note="n"),
    ):
        with pytest.raises(NotImplementedError, match="plan 06 WP"):
            call()


def test_transition_guards_added_by_wp5(engine):
    smoke = report(engine, SMOKE)
    with pytest.raises(InvalidTransitionError, match="bql_merge"):
        engine.transition(smoke, TicketStatus.MERGED, BQL)  # the table lets BQL merge, but only through bql_merge
    dup = report(engine, SWEEP)
    twin = report(engine, SWEEP)  # same place and category: VERIFYING / DUPLICATE
    assert engine.get(twin).ticket.blocker.code == "DUPLICATE" and engine.get(dup).ticket.status == "ROUTED"
    with pytest.raises(InvalidTransitionError, match="bql_merge"):
        engine.transition(twin, TicketStatus.MERGED, BQL)
    merged = engine.bptn_resolve(twin, BPTN, merge=True, note="trùng")
    assert merged.ticket.status == "MERGED" and merged.ticket.merged_into == dup
    routed = report(engine, LIGHTING)
    assert engine.get(routed).ticket.status == "ROUTED"
    with pytest.raises(InvalidTransitionError, match="undo_split"):
        engine.transition(routed, TicketStatus.MERGED, BPTN)
    assert engine.get(routed).ticket.status == "ROUTED"


def test_return_wrong_department_is_pinned_to_routed(engine):
    tid = report(engine, SWEEP)
    engine.accept(tid, CLN)
    with pytest.raises(InvalidTransitionError):
        engine.return_wrong_department(tid, CLN, note="sai phòng")  # IN_PROGRESS: report_wrong_department's job
    assert engine.get(tid).ticket.status == "IN_PROGRESS"
