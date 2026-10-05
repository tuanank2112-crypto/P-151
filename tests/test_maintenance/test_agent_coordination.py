"""Plan 05 (2026-10-04): the Agent's coordination — who a stopped ticket waits on, and where it goes next.

Q05: a report clearly outside both playbooks stops OUT_OF_SCOPE (BPTN) without asking the resident for a location.
The location a resident adds later wins over the original; a location BPTN types is stored in the standard form.
"""

import pytest

from tests.test_maintenance.helpers import BPTN, RESIDENT, report

OUT_OF_SCOPE_NO_LOCATION = [
    "Cho hỏi phí quản lý tháng này bao nhiêu?",
    "Vòi nước trong căn hộ 1205 bị rỉ.",
    "Thang máy tòa SIM-A hỏng rồi, kẹt cửa không mở",
    "Xin hỏi giờ làm việc của văn phòng ban quản lý",
]


@pytest.mark.parametrize("text", OUT_OF_SCOPE_NO_LOCATION)
def test_out_of_scope_without_location_goes_to_bptn_not_the_resident(fresh, text):
    case = fresh.get(report(fresh, text))
    blocker = case.ticket.blocker
    assert case.ticket.status == "VERIFYING" and blocker.code == "OUT_OF_SCOPE", (text, blocker)
    assert blocker.owner_role == "BPTN" and blocker.resume_step == 2


@pytest.mark.parametrize(
    "text",
    [
        "Nhiều rác quá, nhờ dọn giúp",
        "Đèn tầng 3 hỏng",  # a lamp, no area yet: the rules cannot classify it, the resident is still asked
        "Đèn hỏng rồi, tối thui",
        "Ở hành lang có vấn đề, nhờ BQL xem giúp",  # vague but names a common area
    ],
)
def test_a_report_about_the_building_without_location_still_asks_the_resident(fresh, text):
    case = fresh.get(report(fresh, text))
    assert case.ticket.status == "NEED_INFO" and case.ticket.blocker.code == "MISSING_INFO", (text, case.ticket.blocker)


def test_the_resident_can_then_add_the_details_themselves(fresh):
    tid = report(fresh, "Ở hành lang có vấn đề, nhờ BQL xem giúp")
    case = fresh.add_resident_info(tid, RESIDENT, "tầng 3 tòa SIM-A, sàn có bãi nôn")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_CLEANING"


def test_safety_still_runs_before_the_out_of_scope_stop(fresh):
    case = fresh.get(report(fresh, "Thang máy kẹt, có người bên trong!"))  # out of scope AND no location
    assert case.ticket.blocker.code == "EMERGENCY_PENDING_BQL"


def test_bptn_picking_a_category_then_asks_for_the_missing_location(fresh):
    """Never route without a location: after BPTN's category the pipeline reruns step 2."""
    tid = report(fresh, "Cho hỏi phí quản lý tháng này bao nhiêu?")
    case = fresh.bptn_resolve(tid, BPTN, category="VE_SINH", note="Cư dân gọi lại: thực ra hỏi về rác ở sảnh")
    assert case.ticket.status == "NEED_INFO" and case.ticket.blocker.code == "MISSING_INFO"
    case = fresh.bptn_resolve(tid, BPTN, location="sảnh chính tòa SIM-A", note="Đã hỏi cư dân")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_CLEANING"


def test_bptn_category_and_location_in_one_answer_routes(fresh):
    tid = report(fresh, "Cho hỏi phí quản lý tháng này bao nhiêu?")
    case = fresh.bptn_resolve(tid, BPTN, category="VE_SINH", location="hành lang tầng 7 tòa SIM-B", note="Gọi lại")
    assert case.ticket.status == "ROUTED"
    assert case.ticket.locked_fields.location == "Tòa SIM-B / Tầng 7 / Hành lang"


def test_location_typed_by_bptn_is_stored_in_the_standard_form(fresh):
    tid = report(fresh, "Nhiều rác quá, nhờ dọn giúp")
    case = fresh.bptn_resolve(tid, BPTN, location="tầng 3 tòa SIM-A hành lang", note="Gọi cư dân")
    assert case.ticket.locked_fields.location == "Tòa SIM-A / Tầng 3 / Hành lang"
    assert case.ticket.status == "ROUTED"


def test_unparseable_bptn_location_is_kept_as_typed(fresh):
    """BPTN checked with the resident: free text it cannot parse is still BPTN's answer, stored unchanged."""
    tid = report(fresh, "Nhiều rác quá, nhờ dọn giúp")
    case = fresh.bptn_resolve(tid, BPTN, location="chỗ cái cây to cạnh sân chơi", note="Cư dân tả vậy")
    assert case.ticket.locked_fields.location == "chỗ cái cây to cạnh sân chơi"


def test_the_location_a_resident_adds_wins_over_the_original(fresh):
    tid = report(fresh, "Rác vứt bừa bãi quá, em ở tòa SIM-A tầng 12")
    case = fresh.get(tid)
    if case.ticket.status == "NEED_INFO":  # depends on whether the flat's floor counts as the place
        case = fresh.add_resident_info(tid, RESIDENT, "Ở hầm B1 ạ")
    assert case.ticket.status in ("ROUTED", "VERIFYING")
    assert fresh.effective_location(case) == "Tòa SIM-A / Tầng B1 / Hầm xe"
