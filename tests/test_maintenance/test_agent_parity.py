"""Plan 06 WP6 (TESTING 3.5 PAR-01..PAR-03, gate G-PAR): the engine with an Agent that answers like the rules (the
`MirrorClient`) and the engine with no Agent end in exactly the same place, ticket by ticket.

Nothing here calls a network. Two engines run the same reports on their own clocks, a week apart between reports so
the duplicate window never links two corpus sentences (a duplicate scenario is PAR-03).
"""

from datetime import datetime

from src.maintenance.agent.client import CountingClient, MirrorClient
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import MaintenanceEngine
from tests.test_maintenance import test_classify_metamorphic as cm
from tests.test_maintenance.helpers import MONDAY_9AM, Clock, agent_engine
from tests.test_maintenance.test_agent_coordination import OUT_OF_SCOPE_NO_LOCATION


def _pair() -> tuple[MaintenanceEngine, MaintenanceEngine, Clock, Clock, CountingClient]:
    plain_clock, agent_clock = Clock(MONDAY_9AM), Clock(MONDAY_9AM)
    plain = MaintenanceEngine(clock=plain_clock)
    plain.reset(with_fixtures=False)
    counter = CountingClient(MirrorClient(load_catalog(), load_lexicon()))
    return plain, agent_engine(agent_clock, counter), plain_clock, agent_clock, counter


def _key(engine: MaintenanceEngine, ticket_id: str) -> tuple:
    case = engine.get(ticket_id)
    ticket = case.ticket
    blocker = ticket.blocker
    return (
        ticket.status,
        blocker.code if blocker else None,
        blocker.owner_role if blocker else None,
        engine._category(case),
        engine.effective_location(case),
        ticket.department_id,
        ticket.priority,
        ticket.risk_level,
        ticket.asset_resolution,
    )


def _compare(texts: list[str]) -> tuple[list[tuple], int]:
    plain, agent, plain_clock, agent_clock, counter = _pair()
    mismatches = []
    for text in texts:
        left = plain.receive(text).ticket.ticket_id
        right = agent.receive(text).ticket.ticket_id
        expected, got = _key(plain, left), _key(agent, right)
        if expected != got:
            mismatches.append((text, expected, got))
        plain_clock.advance(days=7)
        agent_clock.advance(days=7)
    return mismatches, counter.calls


def test_par01_mirror_agent_equals_no_agent_on_the_whole_corpus_in_three_locations():
    texts = []
    for sentence, _label in cm.CORPUS:
        for text, _location in cm.variants(sentence)[:6]:  # the first three templates, with and without diacritics
            texts.append(text)
    texts += OUT_OF_SCOPE_NO_LOCATION
    mismatches, calls = _compare(texts)
    assert mismatches == [], mismatches[:3]
    assert calls > 0  # the Agent really ran (a few rule-EMERGENCY sentences are not asked)


def test_par02_the_twelve_fixture_reports_end_the_same_way():
    plain, agent, _, _, counter = _pair()
    dataset = plain.dataset
    mismatches = []
    for fixture in dataset.tickets:
        moment = datetime.fromisoformat(fixture.raw.created_at)
        left = plain.receive(fixture.raw.original_description, received_at=moment).ticket.ticket_id
        right = agent.receive(fixture.raw.original_description, received_at=moment).ticket.ticket_id
        expected, got = _key(plain, left), _key(agent, right)
        if expected != got:
            mismatches.append((fixture.raw.ticket_id, expected, got))
    assert len(dataset.tickets) == 12
    assert mismatches == [], mismatches
    assert counter.calls > 0


def test_par03_a_second_report_of_the_same_problem_is_a_duplicate_in_both():
    plain, agent, plain_clock, agent_clock, _ = _pair()
    results = []
    for engine, clock in ((plain, plain_clock), (agent, agent_clock)):
        first = engine.receive("Đèn hành lang tầng 3 tòa S1 không sáng").ticket.ticket_id
        clock.advance(hours=1)
        second = engine.receive("Đèn hành lang tầng 3 tòa S1 chập chờn").ticket.ticket_id
        blocker = engine.get(second).ticket.blocker
        results.append((_key(engine, first), _key(engine, second), blocker.related_ticket_id if blocker else None))
    assert results[0] == results[1]
    assert results[0][1][1] == "DUPLICATE" and results[0][2] == "SIM-TKT-0001"
