"""Plan 02 (merge develop): CR-03 P0 writes go through develop's CaseRepository, and the Q04 crossing point.

Q04: f1c6ebf lets BPTN clear an ordinary MISSING_INFO; CR-03 adds the safety NEED_INFO (T06, `safety_context`).
- BPTN clearing an ordinary MISSING_INFO reruns step 2b on what BPTN entered.
- BPTN cannot clear a safety NEED_INFO (only the resident's answer or BQL T03/T07); it waits on the resident, has no
  automatic reminder and escalates to BQL after 12 calendar hours.

Round trips: every CR-03 write (5 safety/emergency methods, `set_priority`, the one-time rating) is committed by the
repository and read back by a NEW engine on the same repository (no state kept in the engine, I-1), with its audit
rows in the repository ledger. The `repo` fixture is parametrised like test_store_memory (postgres only with --pg).
"""

from contextlib import contextmanager
from datetime import timedelta

import pytest

from src.maintenance.catalog import load_catalog
from src.maintenance.engine import ActionDeniedError, GuardError, MaintenanceEngine, initial_stock
from src.maintenance.enums import Action, RiskLevel
from src.maintenance.models import AuditEvent, Case
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import BPTN, BQL, RESIDENT, report

STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]

TIER1 = "Có mùi khét ở hành lang tầng 3 tòa S1."
TIER2 = "Hình như có mùi khét ở hành lang tầng 3 tòa S1."
TIER2_LAMP = "Hình như có mùi khét, đèn hành lang tầng 3 tòa S1 không sáng."
NO_LOCATION = "Nhiều rác quá, cần dọn gấp."


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


def reloaded(engine: MaintenanceEngine, ticket_id: str) -> Case:
    """Read the ticket back through a new engine on the same repository (what a restart or a second backend sees)."""
    case = MaintenanceEngine(clock=engine.clock, repo=engine.repo).get(ticket_id)
    assert Case.model_validate_json(case.model_dump_json()) == case  # the doc survives the JSON column
    return case


def ledger_actions(repo, ticket_id: str) -> list[str]:
    return [row.action for row in repo.log_rows() if isinstance(row, AuditEvent) and row.ticket_id == ticket_id]


# ---------------------------------------------------------------------- Q04: f1c6ebf x CR-03 safety NEED_INFO


def test_q04_bptn_clearing_missing_info_reruns_safety_layer(engine):
    """What BPTN heard on the phone is new content: 2b runs on it before classification (CR-03 §5.2, D-01)."""
    tid = report(engine, NO_LOCATION)
    assert engine.get(tid).ticket.blocker.code == "MISSING_INFO"
    case = engine.bptn_resolve(
        tid, BPTN, info="Hành lang tầng 3 tòa S1, hình như có mùi khét", note="Gọi cư dân lúc 09:10"
    )
    ticket = case.ticket
    assert (ticket.status, ticket.blocker.code) == ("VERIFYING", "SAFETY_REVIEW_REQUIRED")
    assert ticket.risk_level == RiskLevel.UNCLEAR and ticket.safety_context is False
    assert [(a.submitted_by, a.content.startswith("Hành lang")) for a in case.additions] == [(BPTN, True)]
    assert Action.ASSESS_SAFETY in [a.action for a in case.audit]
    assert reloaded(engine, tid) == case


def test_q04_bptn_cannot_clear_a_safety_need_info(engine):
    """A safety NEED_INFO (T06) is not an ordinary MISSING_INFO: bptn_resolve is a GuardError and changes nothing."""
    tid = report(engine, TIER2)
    asked = engine.safety_request_info(tid, BPTN, note="Hỏi rõ mùi")
    assert (asked.ticket.status, asked.ticket.safety_context, asked.ticket.blocker.owner_role) == (
        "NEED_INFO",
        True,
        "RESIDENT",
    )
    version = engine.repo.version_of(tid)
    for kwargs in (
        {"info": "Cư dân nói chỉ là mùi sơn", "note": "Gọi cư dân"},
        {"location": "Tòa S1 / Tầng 3 / Hành lang", "note": "Gọi cư dân"},
    ):
        with pytest.raises(GuardError, match="tầng an toàn"):
            engine.bptn_resolve(tid, BPTN, **kwargs)
    after = reloaded(engine, tid)
    assert after == asked and after.additions == [] and engine.repo.version_of(tid) == version
    assert after.ticket.blocker.public_message.startswith("Vui lòng bổ sung: mô tả rõ hơn")


def test_q04_safety_need_info_has_no_reminder_and_escalates_at_12h(engine, clock):
    """The hourly BPTN reminder of an ordinary MISSING_INFO (f1c6ebf) must not escalate a safety NEED_INFO early."""
    tid = report(engine, TIER2)
    blocker = engine.safety_request_info(tid, BPTN, note="Hỏi rõ mùi").ticket.blocker
    assert blocker.next_retry_at is None and blocker.escalate_at == clock() + timedelta(hours=12)
    assert engine.run_jobs(clock() + timedelta(hours=11, minutes=59)) == []
    assert engine.run_jobs(clock() + timedelta(hours=12)) == [tid]
    case = reloaded(engine, tid)
    assert (case.ticket.status, case.ticket.blocker.escalated, case.ticket.safety_context) == ("NEED_INFO", True, True)
    assert [n.type for n in case.notifications][-1] == "escalation"


def test_q04_resident_answer_still_reruns_safety_layer(engine):
    """T03 by the resident (SYSTEM): the answer goes back through 2b; a hazard in the answer stops it again."""
    tid = report(engine, TIER2)
    engine.safety_request_info(tid, BPTN, note="Hỏi rõ mùi")
    case = engine.add_resident_info(tid, RESIDENT, "Vẫn còn mùi khét ở hành lang")
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert case.ticket.risk_level == RiskLevel.EMERGENCY
    assert case.ticket.safety_context is False
    assert reloaded(engine, tid) == case


def test_q04_deny_inside_a_write_never_nests_transactions(engine, monkeypatch):
    """The Q19 gate of T06 fires inside `op`: the write rolls back, then the denial is written in its own
    transaction (a nested one would self-lock on Postgres). The audit row is committed exactly once."""
    tid = report(engine, TIER2)
    before = reloaded(engine, tid)
    depth, deepest = [0], [0]
    real = engine.repo.transaction

    @contextmanager
    def counted():
        depth[0] += 1
        deepest[0] = max(deepest[0], depth[0])
        try:
            with real() as tx:
                yield tx
        finally:
            depth[0] -= 1

    monkeypatch.setattr(engine.repo, "transaction", counted)
    with pytest.raises(ActionDeniedError):
        engine.transition(tid, "NEED_INFO", BQL, note="BQL hỏi trước khi leo thang")  # not escalated yet (Q19)
    assert deepest[0] == 1
    after = reloaded(engine, tid)
    assert after.ticket == before.ticket and after.events == before.events
    assert [a.action for a in after.audit[len(before.audit) :]] == [Action.ACTION_DENIED]
    assert ledger_actions(engine.repo, tid).count(Action.ACTION_DENIED) == 1


# ---------------------------------------------------------------------- CR-03 writes round-trip the repository


def test_store_round_trip_safety_confirm_safe_and_request_info(engine):
    tid = report(engine, TIER2_LAMP)
    case = engine.safety_confirm_safe(tid, BPTN, note="Đã gọi cư dân, mùi sơn")
    back = reloaded(engine, tid)
    assert back == case and back.ticket.status == "ROUTED"
    assert (back.ticket.safety_cleared_by, back.ticket.safety_clear_reason) == (BPTN, "Đã gọi cư dân, mùi sơn")
    assert Action.SAFETY_CONFIRM_SAFE in ledger_actions(engine.repo, tid)

    other = report(engine, TIER2)
    asked = engine.safety_request_info(other, BPTN, note="Hỏi rõ mùi")
    assert reloaded(engine, other) == asked and reloaded(engine, other).ticket.safety_context is True
    assert Action.SAFETY_REQUEST_INFO in ledger_actions(engine.repo, other)


def test_store_round_trip_safety_escalate_and_emergency_downgrade(engine):
    tid = report(engine, TIER2)
    escalated = engine.safety_escalate(tid, BPTN)
    back = reloaded(engine, tid)
    assert back == escalated and (back.ticket.blocker.code, back.ticket.risk_level) == (
        "EMERGENCY_PENDING_BQL",
        RiskLevel.EMERGENCY,
    )
    assert "emergency.created" in [n.type for n in engine.repo.notification_rows() if n.ticket_id == tid]
    downgraded = engine.emergency_downgrade(tid, BQL, note="Báo nhầm, đã kiểm tra")
    back = reloaded(engine, tid)
    assert back == downgraded and back.ticket.risk_level == RiskLevel.NONE and back.ticket.safety_cleared_by == BQL
    actions = ledger_actions(engine.repo, tid)
    assert Action.SAFETY_ESCALATE in actions and Action.EMERGENCY_DOWNGRADE in actions


def test_store_round_trip_emergency_close_and_rating_once(engine):
    tid = report(engine, TIER1)
    assert engine.get(tid).ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    closed = engine.emergency_close(tid, BQL, note="Đã xử lý tại chỗ cùng bảo vệ")
    back = reloaded(engine, tid)
    assert back == closed and (back.ticket.status, back.ticket.closure_kind) == ("CLOSED", "EMERGENCY_HANDLED")
    rated = engine.rate(tid, RESIDENT, 4)
    second_engine = MaintenanceEngine(clock=engine.clock, repo=engine.repo)
    assert second_engine.get(tid) == rated and second_engine.get(tid).ticket.rating == 4
    with pytest.raises(GuardError):  # the one-time rule reads the stored rating, not engine memory
        second_engine.rate(tid, RESIDENT, 5)
    assert reloaded(engine, tid).ticket.rating == 4
    actions = ledger_actions(engine.repo, tid)
    assert Action.EMERGENCY_CLOSE in actions and actions.count(Action.RATE_TICKET) == 1


def test_store_round_trip_set_priority(engine):
    tid = report(engine, "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh.")
    case = engine.set_priority(tid, BQL, "HIGH", note="Sắp có đoàn kiểm tra")
    back = reloaded(engine, tid)
    assert back == case and (back.ticket.priority, back.ticket.priority_source) == ("HIGH", "HUMAN_OVERRIDE")
    assert back.ticket.priority_reason == "Sắp có đoàn kiểm tra"
    assert Action.SET_PRIORITY in ledger_actions(engine.repo, tid)
