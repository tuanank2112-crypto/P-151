"""A report that names no building is read as being in the resident's own building (profile); text wins over it."""

from tests.test_maintenance.helpers import RESIDENT, report


def _with_home(engine, tower="S2.05"):
    engine.home_building = lambda actor_id: tower if actor_id == RESIDENT else None
    return engine


def test_no_building_in_text_uses_the_profile_building(fresh):
    tid = report(_with_home(fresh), "Đèn thang bộ hỏng\ntầng 7 cầu thang bộ")
    case = fresh.get(tid)
    assert case.ticket.status != "NEED_INFO", case.ticket.blocker
    assert fresh.effective_location(case) == "Tòa S2.05 / Tầng 7 / Cầu thang bộ"


def test_building_in_text_wins_over_the_profile(fresh):
    tid = report(_with_home(fresh), "Đèn cầu thang bộ tầng 7 tòa S1 hỏng")
    assert fresh.effective_location(fresh.get(tid)) == "Tòa S1 / Tầng 7 / Cầu thang bộ"


def test_residence_clause_building_wins_over_the_profile(fresh):
    tid = report(_with_home(fresh), "Em ở tòa S1, báo cầu thang bộ tầng 7 hỏng đèn")
    assert fresh.effective_location(fresh.get(tid)) == "Tòa S1 / Tầng 7 / Cầu thang bộ"


def test_without_a_profile_the_resident_is_still_asked_for_the_building(fresh):
    tid = report(fresh, "Đèn thang bộ hỏng\ntầng 7 cầu thang bộ")
    case = fresh.get(tid)
    assert case.ticket.status == "NEED_INFO" and case.ticket.blocker.code == "MISSING_INFO"


def test_profile_building_never_supplies_floor_or_area(fresh):
    tid = report(_with_home(fresh), "Đèn hỏng")
    assert fresh.get(tid).ticket.status == "NEED_INFO"
