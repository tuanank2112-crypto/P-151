"""Multi-ticket / multi-person scenarios against the reception desk (BPTN) and the emergency path (BQL).

Four families the single-report hard cases cannot show:
  P  one fault, many phrasings (and many residents): does the desk reach the same decision every time?
  D  duplicates around an emergency: nobody's report is lost, linked or hidden by another ticket
  S  tickets that can get stuck at BPTN: they always keep an owner, are escalated, and never vanish
  F  false alarms: an ordinary report that lands at BQL as an emergency, and what BQL can do about it

The engine is rules-only (no model): this is the floor the Agent must never fall below. A scenario the engine gets
wrong today is `known_bug` = xfail(strict): visible in the report, and red the day it is fixed so the flag is removed.
`pytest -rx` lists every known bug.
"""

import pytest

from src.maintenance.engine import ActionDeniedError, GuardError, InvalidTransitionError, MaintenanceEngine
from src.maintenance.enums import RiskLevel, TicketStatus
from src.maintenance.views import resident_view
from tests.test_maintenance.helpers import (
    BPTN,
    BQL,
    MONDAY_9AM,
    OTHER_RESIDENT,
    RESIDENT,
    Clock,
    report,
)

BUG = pytest.mark.xfail(strict=True, reason="known rule bug")
PEOPLE = (RESIDENT, OTHER_RESIDENT)  # the only two resident accounts the catalog knows
HALL = "hành lang tầng 3 tòa S1"
SMELL = "Có mùi khét ở hành lang tầng 3 tòa S1."


def make() -> tuple[Clock, MaintenanceEngine]:
    clock = Clock(MONDAY_9AM)
    engine = MaintenanceEngine(clock=clock)
    engine.reset(with_fixtures=False)
    return clock, engine


def outcome(engine: MaintenanceEngine, ticket_id: str) -> tuple[str, str | None, str | None]:
    """(status, blocker code, department) as plain strings."""
    ticket = engine.get(ticket_id).ticket
    code = ticket.blocker.code.value if ticket.blocker else None
    return ticket.status.value, code, ticket.department_id.value if ticket.department_id else None


def level(engine: MaintenanceEngine, ticket_id: str) -> str:
    return engine.get(ticket_id).ticket.risk_level.value


def later(clock: Clock, engine: MaintenanceEngine, text: str, who: int = 0, minutes: int = 7) -> str:
    clock.advance(minutes=minutes)
    return report(engine, text, resident=PEOPLE[who % 2])


def param(rows):
    """Rows are (id, text, expected, known_bug); the id is what pytest prints."""
    return [pytest.param(text, want, id=name, marks=[BUG] if bug else []) for name, text, want, bug in rows]


# ================================================================================================ P: paraphrases

LAMP = ("ROUTED", None, "DEPT_TECHNICAL")
RUBBISH = ("ROUTED", None, "DEPT_CLEANING")
TIER1 = ("VERIFYING", "EMERGENCY_PENDING_BQL", None)

PARAPHRASES = param(
    [
        # the same dead lamp, said six ways by six different people
        ("lamp-plain", "Đèn hành lang tầng 3 tòa S1 không sáng.", LAMP, False),
        ("lamp-slang", "Hành lang tầng 3 tòa S1 tối thui, bóng đèn hỏng rồi", LAMP, False),
        ("lamp-burnt", "Bóng đèn ở hành lang tầng 3 tòa S1 cháy, đi lại tối quá", LAMP, False),
        ("lamp-reorder", "Tòa S1 tầng 3 chỗ hành lang mất đèn", LAMP, False),
        ("lamp-flicker", "Đèn hành lang tầng 3 tòa S1 chập chờn, lúc sáng lúc tắt", LAMP, False),
        ("lamp-nodiacritic", "hanh lang tang 3 toa S1 den khong sang", LAMP, False),
        ("lamp-caps", "ĐÈN HÀNH LANG TẦNG 3 TÒA S1 KHÔNG SÁNG!!!", LAMP, False),
        ("lamp-abbrev-floor", "Hành lang T3 S1 tối thui, bóng đèn hỏng rồi", LAMP, True),
        ("lamp-word-number", "Hành lang tầng ba tòa S1 đèn không sáng", LAMP, True),
        (
            "lamp-polite",
            "Chào ban quản lý, nhờ bạn kiểm tra giúp đèn ở hành lang tầng 3 tòa S1 đang không sáng ạ",
            LAMP,
            False,
        ),
        ("lamp-no-fault-word", "Hành lang tầng 3 tòa S1 rất tối", LAMP, True),
        # the same rubbish, five ways
        ("rub-plain", "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh.", RUBBISH, False),
        ("rub-spilled", "Rác đổ đầy hành lang tầng 3 tòa S1 chưa ai dọn", RUBBISH, False),
        ("rub-dirty", "Hành lang tầng 3 tòa S1 bẩn quá, có vết nước đổ", RUBBISH, False),
        ("rub-sweep", "Nhờ quét dọn hành lang tầng 3 tòa S1, rác bừa bãi", RUBBISH, False),
        ("rub-nodiacritic", "hanh lang tang 3 toa S1 rac nhieu", RUBBISH, False),
        ("rub-smell", "Hành lang tầng 3 tòa S1 có mùi hôi do rác để lâu", RUBBISH, False),
        # the same burning smell, five ways: every phrasing must reach BQL, none may be softened to tier 2
        ("fire-plain", SMELL, TIER1, False),
        ("fire-chap", "Hành lang tầng 3 tòa S1 khét lẹt, hình như chập điện", TIER1, False),
        ("fire-smoke", "Hành lang tầng 3 tòa S1 có khói đen bốc ra từ hộp điện", TIER1, False),
        ("fire-spark", "Tia lửa phóng ra từ ổ điện hành lang tầng 3 tòa S1", TIER1, False),
        ("fire-cháy", "Tòa S1 tầng 3 ngửi thấy mùi cháy ở hành lang", TIER1, True),
        ("fire-abbrev-place", "Tầng 3 S1 hành lang có khói", TIER1, False),
        ("fire-nodiacritic", "hanh lang tang 3 toa S1 co mui khet", TIER1, False),
        ("fire-caps", "KHÉT LẸT Ở HÀNH LANG TẦNG 3 TÒA S1", TIER1, False),
    ]
)


@pytest.mark.parametrize(("text", "want"), PARAPHRASES)
def test_p01_every_phrasing_of_one_fault_gets_the_same_decision(text, want):
    _, engine = make()
    ticket = report(engine, text)
    assert outcome(engine, ticket) == want, text


@pytest.mark.parametrize(
    "texts",
    [
        [
            "Đèn hành lang tầng 3 tòa S1 không sáng.",
            "Tòa S1 tầng 3 chỗ hành lang mất đèn",
            "hanh lang tang 3 toa S1 den khong sang",
        ],
        ["Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh.", "Rác đổ đầy hành lang tầng 3 tòa S1 chưa ai dọn"],
    ],
    ids=["lamp", "rubbish"],
)
def test_p02_the_same_fault_from_several_people_is_one_job_and_the_rest_wait_as_duplicates(texts):
    """First report is routed; every later phrasing is a suspected duplicate of it (count on the root), not a
    second job for the department and not a ticket lost in NEED_INFO."""
    clock, engine = make()
    root = report(engine, texts[0])
    assert outcome(engine, root)[0] == "ROUTED"
    copies = [later(clock, engine, text, who=i + 1) for i, text in enumerate(texts[1:])]
    for copy in copies:
        status, code, _ = outcome(engine, copy)
        assert (status, code) == ("VERIFYING", "DUPLICATE"), engine.get(copy).ticket.raw
        assert engine.get(copy).ticket.blocker.related_ticket_id == root
    assert engine.get(root).ticket.duplicate_count == len(copies)


def test_p03_two_phrasings_never_split_into_different_departments():
    """A lamp said with a 'dọn' verb must not flip to the cleaning department."""
    clock, engine = make()
    first = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    second = later(
        clock, engine, "Nhờ xử lý giúp đèn hành lang tầng 3 tòa S1 đang tắt, tối quá không dọn đồ được", who=1
    )
    assert outcome(engine, first)[2] == "DEPT_TECHNICAL"
    assert outcome(engine, second)[2] in {"DEPT_TECHNICAL", None}  # a duplicate has no department yet; never CLEANING


# ======================================================================================== D: duplicates + emergency


def test_d01_three_people_report_one_smell_and_all_three_reach_bql():
    """Nobody's emergency report may be demoted because someone reported it first."""
    clock, engine = make()
    ids = [
        report(engine, SMELL),
        later(clock, engine, "Hành lang tầng 3 tòa S1 khét lẹt, hình như chập điện", who=1),
        later(clock, engine, "Hành lang tầng 3 tòa S1 có khói đen bốc ra từ hộp điện", who=0),
    ]
    for ticket in ids:
        assert outcome(engine, ticket)[:2] == TIER1[:2], ticket
        assert engine.get(ticket).ticket.blocker.owner_role.value == "BQL"


def test_d02_emergencies_at_one_place_are_linked_both_ways():
    clock, engine = make()
    first = report(engine, SMELL)
    second = later(clock, engine, "Hành lang tầng 3 tòa S1 khét lẹt, hình như chập điện", who=1)
    assert first in engine.get(second).ticket.related_ticket_ids
    assert second in engine.get(first).ticket.related_ticket_ids


@BUG
def test_d03_a_tier2_report_next_to_an_open_emergency_is_linked_to_it():
    """'mùi cháy' (tier 2) at the place of an open tier-1 ticket: BQL must be able to see the two together."""
    clock, engine = make()
    emergency = report(engine, SMELL)
    nearby = later(clock, engine, "Tòa S1 tầng 3 ngửi thấy mùi cháy ở hành lang", who=1)
    assert emergency in engine.get(nearby).ticket.related_ticket_ids
    assert nearby in engine.get(emergency).ticket.related_ticket_ids


def test_d04_an_emergency_is_not_hidden_as_a_duplicate_of_an_ordinary_ticket():
    """A lamp ticket is open; the same hall then smells burnt. The second must not become 'DUPLICATE of the lamp'."""
    clock, engine = make()
    lamp = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    smell = later(clock, engine, "Hành lang tầng 3 tòa S1 có mùi khét từ hộp đèn", who=1)
    assert outcome(engine, smell)[:2] == TIER1[:2]
    assert engine.get(smell).ticket.blocker.code.value != "DUPLICATE"
    assert outcome(engine, lamp)[0] == "ROUTED"  # the ordinary job goes on (hold-for-emergency is off by policy)
    assert smell in engine.get(lamp).ticket.related_ticket_ids and lamp in engine.get(smell).ticket.related_ticket_ids


def test_d05_the_same_resident_sending_the_emergency_twice_is_not_dropped():
    clock, engine = make()
    first = report(engine, SMELL)
    again = later(clock, engine, SMELL, who=0, minutes=1)
    assert outcome(engine, first)[:2] == outcome(engine, again)[:2] == TIER1[:2]


def test_d06_repeat_reports_never_raise_an_emergency_through_the_priority_rule():
    """PRI-U1 raises priority by report count for ordinary tickets only. A tier-1 ticket has no priority at all."""
    clock, engine = make()
    root = report(engine, SMELL)
    for i in range(4):
        later(clock, engine, SMELL, who=i + 1)
    ticket = engine.get(root).ticket
    assert ticket.risk_level == RiskLevel.EMERGENCY and ticket.priority is None


def test_d07_a_handled_emergency_does_not_swallow_the_next_report_of_the_same_smell():
    clock, engine = make()
    done = report(engine, SMELL)
    engine.emergency_close(done, BQL, note="BQL đã xử lý")
    assert engine.get(done).ticket.status == TicketStatus.CLOSED
    clock.advance(minutes=30)
    again = report(engine, SMELL, resident=OTHER_RESIDENT)
    assert outcome(engine, again)[:2] == TIER1[:2]


def test_d08_bql_cannot_merge_an_emergency_into_an_ordinary_ticket_or_the_other_way():
    """Merging would hide a tier-1 ticket inside a routine job."""
    clock, engine = make()
    lamp = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    emergency = later(clock, engine, SMELL, who=1)
    with pytest.raises((InvalidTransitionError, GuardError)):
        engine.bql_merge(emergency, BQL, into=lamp, note="trùng")
    with pytest.raises((InvalidTransitionError, GuardError)):
        engine.bql_merge(lamp, BQL, into=emergency, note="trùng")
    assert outcome(engine, emergency)[:2] == TIER1[:2] and outcome(engine, lamp)[0] == "ROUTED"


def test_d09_downgrading_one_emergency_leaves_the_other_open():
    clock, engine = make()
    first = report(engine, SMELL)
    second = later(clock, engine, "Hành lang tầng 3 tòa S1 khét lẹt, hình như chập điện", who=1)
    engine.emergency_downgrade(first, BQL, note="Mùi sơn")
    assert level(engine, first) == "NONE"
    assert outcome(engine, second)[:2] == TIER1[:2]


# ============================================================================================ S: stuck at the desk

NO_PLACE = "Hỏng cái gì đó ở tòa S1"
NO_BUILDING = "Hành lang nhiều rác lắm"
HAZY = "Hình như có mùi khét ở hành lang tầng 3 tòa S1"


def run_for(clock: Clock, engine: MaintenanceEngine, hours: float, step: float = 12) -> None:
    """Run the 5-minute job as time passes (in steps, as production would)."""
    elapsed = 0.0
    while elapsed < hours:
        clock.advance(hours=step)
        engine.run_jobs()
        elapsed += step


@pytest.mark.parametrize(
    ("text", "status", "owner"),
    [(NO_PLACE, "VERIFYING", "BPTN"), (NO_BUILDING, "NEED_INFO", "BPTN"), (HAZY, "VERIFYING", "BPTN")],
    ids=["not-a-repair", "no-building", "tier2-unclear"],
)
def test_s01_a_stuck_ticket_always_has_an_owner_and_is_escalated_to_bql_in_time(text, status, owner):
    clock, engine = make()
    ticket = report(engine, text)
    case = engine.get(ticket)
    assert case.ticket.status.value == status and case.ticket.blocker.owner_role.value == owner
    run_for(clock, engine, 72)
    blocker = engine.get(ticket).ticket.blocker
    assert blocker is not None and blocker.escalated, "nobody was told the ticket is stuck"
    assert any(n.type in {"escalation", "safety.review_escalated"} for n in engine.get(ticket).notifications)


@pytest.mark.parametrize("text", [NO_PLACE, NO_BUILDING, HAZY], ids=["not-a-repair", "no-building", "tier2-unclear"])
def test_s02_time_alone_never_closes_cancels_or_clears_a_stuck_ticket(text):
    clock, engine = make()
    ticket = report(engine, text)
    before = outcome(engine, ticket)
    run_for(clock, engine, 24 * 14)
    assert outcome(engine, ticket) == before
    assert level(engine, ticket) in {"NONE", "UNCLEAR"}  # silence is never read as 'safe' either: UNCLEAR stays


def test_s03_tier2_stays_unclear_after_it_is_escalated():
    clock, engine = make()
    ticket = report(engine, HAZY)
    run_for(clock, engine, 24 * 3)
    assert level(engine, ticket) == "UNCLEAR" and engine.get(ticket).ticket.safety_cleared_by is None


def test_s04_a_routed_ticket_nobody_accepts_is_nudged_then_escalated_but_stays_routed():
    clock, engine = make()
    ticket = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    run_for(clock, engine, 24 * 5)
    after = engine.get(ticket).ticket
    assert after.status == TicketStatus.ROUTED and after.blocker.code.value == "NOT_ACCEPTED"
    assert after.blocker.escalated
    nudges = [n for n in engine.get(ticket).notifications if n.type == "reminder"]
    assert len(nudges) >= 1


def test_s05_the_resident_can_still_unstick_a_ticket_after_it_was_escalated():
    clock, engine = make()
    ticket = report(engine, NO_BUILDING)
    run_for(clock, engine, 24 * 3)
    assert engine.get(ticket).ticket.blocker.escalated
    engine.add_resident_info(ticket, RESIDENT, "Tầng 3 tòa S1")
    assert outcome(engine, ticket)[0] in {"ROUTED", "VERIFYING"}  # moved on, no longer NEED_INFO


def test_s06_bptn_resolves_a_missing_place_and_the_ticket_leaves_the_desk():
    _, engine = make()
    ticket = report(engine, NO_BUILDING)
    engine.bptn_resolve(ticket, BPTN, note="Đã gọi cư dân", location="Tòa S1 / Tầng 3 / Hành lang")
    assert outcome(engine, ticket)[0] != "NEED_INFO"


def test_s07_a_pile_of_stuck_tickets_each_keeps_its_own_state():
    """Five tickets stuck for five different reasons do not influence each other's escalation."""
    clock, engine = make()
    ids = {
        "no-place": report(engine, NO_PLACE),
        "no-building": report(engine, NO_BUILDING),
        "hazy": report(engine, HAZY),
        "lamp": report(engine, "Đèn hành lang tầng 2 tòa S2 không sáng."),
        "smell": report(engine, "Có mùi khét ở hầm B1 tòa S2."),
    }
    run_for(clock, engine, 24 * 6)
    got = {name: outcome(engine, tid)[:2] for name, tid in ids.items()}
    assert got == {
        "no-place": ("VERIFYING", "OUT_OF_SCOPE"),
        "no-building": ("NEED_INFO", "MISSING_INFO"),
        "hazy": ("VERIFYING", "SAFETY_REVIEW_REQUIRED"),
        "lamp": ("ROUTED", "NOT_ACCEPTED"),
        "smell": ("VERIFYING", "EMERGENCY_PENDING_BQL"),
    }


@BUG
def test_s08_one_report_with_two_jobs_is_not_routed_as_a_single_job():
    """Lamp + rubbish in one message. It must wait for BPTN (split), not go to one department as if it were one job."""
    _, engine = make()
    ticket = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng và rác nhiều ở cùng chỗ")
    assert outcome(engine, ticket)[0] != "ROUTED"


def test_s09_an_open_emergency_is_never_touched_by_the_job_however_long_it_waits():
    """I-10 pinned: tier 1 has no timer. BQL is told once, at the start, and the job leaves the ticket alone."""
    clock, engine = make()
    ticket = report(engine, SMELL)
    told = [n for n in engine.get(ticket).notifications]
    assert told, "BQL must be notified when a tier-1 ticket opens"
    before = engine.get(ticket).ticket.model_dump()
    run_for(clock, engine, 24 * 10)
    assert engine.get(ticket).ticket.model_dump() == before


# ===================================================================================== F: false alarms reaching BQL

NOT_FIRE = ("VERIFYING", {"SAFETY_REVIEW_REQUIRED", "OUT_OF_SCOPE", "DUPLICATE"}, None)


def reaches_bql(engine: MaintenanceEngine, ticket: str) -> bool:
    ticket_ = engine.get(ticket).ticket
    return ticket_.risk_level == RiskLevel.EMERGENCY or (
        ticket_.blocker is not None and ticket_.blocker.owner_role.value == "BQL"
    )


FALSE_ALARMS = param(
    [
        ("smoker", "Người hút thuốc ở hành lang tầng 3 tòa S1, khói bay vào nhà", None, True),
        ("barbecue", "Hành lang tầng 3 tòa S1 có người nướng thịt, khói bay mù", None, True),
        ("past-handled", "Mùi khét ở hành lang tầng 3 tòa S1 đã được xử lý xong, nhờ dọn rác", None, True),
        (
            "past-yesterday",
            "Hôm qua có tia lửa ở ổ điện hành lang tầng 3 tòa S1, giờ đã sửa xong, nhờ vệ sinh hành lang",
            None,
            True,
        ),
        ("kitchen", "Hành lang tầng 3 tòa S1 có mùi khét từ bếp nhà hàng xóm nấu cháy cơm", None, False),
        ("incense", "Hành lang tầng 3 tòa S1 có khói nhang từ căn hộ bên cạnh bay ra", None, True),
        ("negated", "Không có mùi khét, đèn hành lang tầng 3 tòa S1 không sáng.", None, False),
        ("negated-2", "Đèn hành lang tầng 3 tòa S1 không sáng, không có khói hay tia lửa gì cả", None, False),
        ("idiom", "Cháy hàng rồi, đèn hành lang tầng 3 tòa S1 không sáng", None, False),
        ("question", "Nếu có cháy thì chuông báo ở hành lang tầng 3 tòa S1 có kêu không?", None, False),
        ("burnt-lamp", "Đèn hành lang tầng 3 tòa S1 không sáng, bóng cháy rồi", None, False),
        ("perfume", "Mùi nước hoa nồng ở hành lang tầng 3 tòa S1", None, False),
    ]
)


@pytest.mark.parametrize(("text", "_"), FALSE_ALARMS)
def test_f01_an_ordinary_report_with_a_fire_word_does_not_reach_bql_as_an_emergency(text, _):
    _, engine = make()
    ticket = report(engine, text)
    assert level(engine, ticket) != "EMERGENCY", text
    assert not reaches_bql(engine, ticket), text


def test_f02_real_emergencies_survive_the_same_wording_filters():
    """Control for F01: a rule that stops false alarms by ignoring everything would pass F01 and fail here."""
    for text in [
        SMELL,
        "Tia lửa phóng ra từ ổ điện hành lang tầng 3 tòa S1 ngay lúc này",
        "Khói đen bốc ra từ tủ điện hầm B1 tòa S1",
    ]:
        _, engine = make()
        assert level(engine, report(engine, text)) == "EMERGENCY", text


def test_f03_a_tier2_doubt_goes_to_bptn_not_to_bql():
    for text in ["Cháy hàng rồi, đèn hành lang tầng 3 tòa S1 không sáng", HAZY]:
        _, engine = make()
        blocker = engine.get(report(engine, text)).ticket.blocker
        assert (blocker.code.value, blocker.owner_role.value) == ("SAFETY_REVIEW_REQUIRED", "BPTN"), text


def test_f04_only_bql_can_clear_a_false_tier1_and_bptn_is_refused():
    _, engine = make()
    ticket = report(engine, SMELL)
    with pytest.raises((ActionDeniedError, InvalidTransitionError, GuardError)):
        engine.emergency_downgrade(ticket, BPTN, note="Chắc là khói thuốc")
    assert level(engine, ticket) == "EMERGENCY"
    with pytest.raises((ActionDeniedError, InvalidTransitionError, GuardError)):
        engine.safety_confirm_safe(ticket, BPTN, note="Chắc là khói thuốc")
    assert level(engine, ticket) == "EMERGENCY"


def test_f05_after_bql_clears_a_false_alarm_the_real_job_in_it_goes_on_to_the_department():
    """'khét' + a dead lamp: the lamp part is a real, ordinary job. Once BQL says it is not an emergency, it must be
    routed to the technical department, with the clearing person and reason kept for audit."""
    _, engine = make()
    ticket = report(engine, "Có mùi khét ở hành lang tầng 3 tòa S1, đèn cũng không sáng.")
    assert level(engine, ticket) == "EMERGENCY"
    engine.emergency_downgrade(ticket, BQL, note="Mùi sơn mới, đã kiểm tra")
    done = engine.get(ticket).ticket
    assert (done.risk_level, done.safety_cleared_by, done.safety_clear_reason) == (
        RiskLevel.NONE,
        BQL,
        "Mùi sơn mới, đã kiểm tra",
    )
    assert done.blocker is None or done.blocker.owner_role.value != "BQL"
    assert done.status.value in {"ROUTED", "VERIFYING"}


def test_f06_a_cleared_alarm_is_not_raised_again_by_the_next_job_run():
    clock, engine = make()
    ticket = report(engine, "Có mùi khét ở hành lang tầng 3 tòa S1, đèn cũng không sáng.")
    engine.emergency_downgrade(ticket, BQL, note="Mùi sơn mới")
    run_for(clock, engine, 48)
    assert level(engine, ticket) == "NONE"


def test_f07_a_second_downgrade_is_refused_not_applied_twice():
    _, engine = make()
    ticket = report(engine, SMELL)
    engine.emergency_downgrade(ticket, BQL, note="Mùi sơn")
    with pytest.raises((InvalidTransitionError, GuardError)):
        engine.emergency_downgrade(ticket, BQL, note="Lần nữa")


def test_f08_bptn_cannot_push_an_ordinary_routed_ticket_to_bql():
    """Wrong hand-over: send_to_bql only exists for out-of-scope tickets, never for a ROUTED one."""
    _, engine = make()
    ticket = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    with pytest.raises((InvalidTransitionError, GuardError)):
        engine.send_to_bql(ticket, BPTN, note="Nhờ BQL xem")
    with pytest.raises((InvalidTransitionError, GuardError)):
        engine.safety_escalate(ticket, BPTN)  # E01 needs a tier-2 ticket
    assert level(engine, ticket) == "NONE"


def test_f09_an_out_of_scope_hand_over_to_bql_never_turns_into_an_emergency():
    _, engine = make()
    ticket = report(engine, NO_PLACE)
    engine.send_to_bql(ticket, BPTN, note="Ngoài phạm vi")
    after = engine.get(ticket).ticket
    assert after.risk_level == RiskLevel.NONE and after.blocker.code.value == "OUT_OF_SCOPE"
    assert after.blocker.code.value != "EMERGENCY_PENDING_BQL"
    engine.bql_return_to_bptn(ticket, BQL, note="Trả lại BPTN")
    back = engine.get(ticket).ticket
    assert back.blocker.owner_role.value == "BPTN" and back.risk_level == RiskLevel.NONE


def test_f10_the_resident_is_never_shown_the_words_emergency_or_risk_for_a_false_alarm():
    _, engine = make()
    ticket = report(engine, "Người hút thuốc ở hành lang tầng 3 tòa S1, khói bay vào nhà")
    shown = resident_view(engine, engine.get(ticket), engine.clock()).model_dump_json().lower()
    for word in ("emergency", "khẩn cấp", "nguy hiểm", "risk", "s-0", "reason_code"):
        assert word not in shown, word


def test_f11_false_alarms_do_not_pile_up_unnoticed_in_the_bql_queue():
    """Ten smokers' reports from two people: BQL sees each as its own tier-1 ticket today. This pins the cost: the
    queue holds N tickets, all linked (D02), so BQL can clear them in one go instead of N separate hunts."""
    clock, engine = make()
    ids = [
        later(clock, engine, "Người hút thuốc ở hành lang tầng 3 tòa S1, khói bay vào nhà", who=i) for i in range(10)
    ]
    ticket = engine.get(ids[-1]).ticket
    assert len(ticket.related_ticket_ids) >= 1, "later alarms at one place must point at the earlier ones"


def test_f12_a_report_can_only_get_tier1_through_the_rules_never_by_the_clock():
    """After days of waiting, an UNCLEAR ticket never becomes EMERGENCY and an ordinary one never gets a risk level."""
    clock, engine = make()
    hazy = report(engine, HAZY)
    plain = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    run_for(clock, engine, 24 * 7)
    assert level(engine, hazy) == "UNCLEAR" and level(engine, plain) == "NONE"


# ================================================================ M: a real emergency that never reaches BQL
# playbook-v1 section 3: tier 1 also covers people hurt or trapped, things about to fall, chemicals, bare/burnt wire.

MISSED = param(
    [
        ("lift-trapped", "Thang máy tòa S1 đứng giữa tầng 7, có 2 cháu nhỏ ở trong", None, True),
        ("ceiling-about-to-fall", "Trần hành lang tầng 3 tòa S1 sắp sập, nứt toác", None, True),
        ("chemical-eyes", "Rò rỉ hóa chất ở hành lang tầng 3 tòa S1, cay mắt", None, True),
        ("burnt-wire", "Chập điện ở hành lang tầng 3 tòa S1, cháy xém dây", None, True),
        # controls: the same family, phrased so the rules do catch it
        ("person-fainted", "Có người ngất xỉu ở hành lang tầng 3 tòa S1", None, False),
        ("electric-shock", "Có người bị điện giật ở hành lang tầng 3 tòa S1", None, False),
        ("gas", "Mùi gas nồng nặc ở hành lang tầng 3 tòa S1", None, False),
        ("water-in-socket", "Ống nước vỡ, nước tràn vào ổ điện hành lang tầng 3 tòa S1", None, False),
        ("fire-after-lamp", "Đèn hành lang tầng 3 tòa S1 không sáng. Ngoài ra bốc khói đen ở tủ điện", None, False),
    ]
)


@pytest.mark.parametrize(("text", "_"), MISSED)
def test_m01_a_report_with_a_tier1_hazard_is_owned_by_bql(text, _):
    """Whatever else is in the report, a hazard from the playbook's tier-1 list must put the ticket in front of BQL,
    not leave it with BPTN as out-of-scope or as a tier-2 doubt."""
    _, engine = make()
    ticket = report(engine, text)
    assert level(engine, ticket) == "EMERGENCY", engine.get(ticket).ticket.blocker
    assert engine.get(ticket).ticket.blocker.owner_role.value == "BQL"


@pytest.mark.parametrize(
    "text",
    [
        "Thang máy tòa S1 đứng giữa tầng 7, có 2 cháu nhỏ ở trong",
        "Trần hành lang tầng 3 tòa S1 sắp sập, nứt toác",
    ],
    ids=["lift-trapped", "ceiling-about-to-fall"],
)
@BUG
def test_m02_a_missed_emergency_is_not_left_waiting_on_bptn_for_hours(text):
    """The rules miss it, so BPTN owns it as 'out of scope'. Nothing in the text says people may be in danger, yet BQL
    is told only when the BPTN timer runs out: 4 hours (measured). The test asks for 30 minutes."""
    clock, engine = make()
    ticket = report(engine, text)
    run_for(clock, engine, 0.5, step=0.25)
    assert engine.get(ticket).ticket.blocker.escalated


def test_m03_when_a_routed_ticket_turns_into_a_fire_a_new_report_reaches_bql_and_links_the_old_one():
    clock, engine = make()
    lamp = report(engine, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    fire = later(clock, engine, "Hành lang tầng 3 tòa S1 bốc khói đen và có tia lửa từ hộp đèn", who=0)
    assert level(engine, fire) == "EMERGENCY" and engine.get(fire).ticket.blocker.owner_role.value == "BQL"
    assert lamp in engine.get(fire).ticket.related_ticket_ids


@pytest.mark.parametrize("state", ["ROUTED", "IN_PROGRESS", "DUPLICATE"])
@BUG
def test_m04_the_resident_can_report_a_hazard_on_the_ticket_they_already_have(state):
    """The lamp ticket is already with the department (or waiting as a duplicate). The resident writes 'now there is
    smoke and sparks' on it. The system refuses the addition ('không cần bổ sung'), so the hazard is only seen if the
    resident thinks to open a second ticket. Expected: a tier-1 signal added to ANY open ticket reaches BQL."""
    clock, engine = make()
    ticket = report(engine, LAMP_TEXT)
    if state == "DUPLICATE":
        ticket = later(clock, engine, LAMP_TEXT, who=1)
    elif state == "IN_PROGRESS":
        engine.accept(ticket, "SIM-ACTOR-DEPT-TEC-01")
    who = OTHER_RESIDENT if state == "DUPLICATE" else RESIDENT
    try:
        engine.add_resident_info(ticket, who, "Giờ bốc khói đen và có tia lửa từ hộp đèn")
    except (GuardError, InvalidTransitionError):
        pass
    assert level(engine, ticket) == "EMERGENCY"


def test_m05_a_hazard_added_to_a_ticket_waiting_for_information_reaches_bql():
    _, engine = make()
    ticket = report(engine, NO_BUILDING)
    engine.add_resident_info(ticket, RESIDENT, "Tầng 3 tòa S1, có mùi khét")
    assert level(engine, ticket) == "EMERGENCY" and engine.get(ticket).ticket.blocker.owner_role.value == "BQL"


def test_m06_a_duplicate_that_is_merged_by_bptn_does_not_swallow_a_hazard_in_its_own_words():
    """Two lamp reports; the second one says 'có tia lửa' in the first sentence. The rules see it at once, so it
    never becomes a merge candidate."""
    clock, engine = make()
    report(engine, LAMP_TEXT)
    second = later(clock, engine, "Đèn hành lang tầng 3 tòa S1 không sáng, có tia lửa ở hộp đèn", who=1)
    assert level(engine, second) == "EMERGENCY"


LAMP_TEXT = "Đèn hành lang tầng 3 tòa S1 không sáng."
