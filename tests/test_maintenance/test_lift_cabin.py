"""The lift cabin is a common area (user decision 2026-10-11): lamp -> Technical, dirt -> Cleaning, a person in danger ->
the safety tier, and any mechanical fault (door, shaking, stuck between floors) stays out of scope."""

import pytest

from tests.test_maintenance.helpers import report


def _ticket(fresh, text):
    return fresh.get(report(fresh, text)).ticket


@pytest.mark.parametrize(
    ("text", "department"),
    [
        ("Đèn trong thang máy tòa S2 không sáng", "DEPT_TECHNICAL"),
        ("Đèn hiển thị tầng trong thang máy tòa S2 bị tắt", "DEPT_TECHNICAL"),
        ("Trong thang máy tòa S2 có rác", "DEPT_CLEANING"),
        ("Trong thang máy tòa S2 bẩn, nhiều vết dơ", "DEPT_CLEANING"),
    ],
)
def test_a_cabin_report_needs_no_floor_and_goes_to_its_department(fresh, text, department):
    ticket = _ticket(fresh, text)
    assert ticket.status == "ROUTED" and ticket.department_id == department


def test_the_cabin_lamp_matches_the_cabin_asset(fresh):
    case = fresh.get(report(fresh, "Đèn trong thang máy tòa S2 không sáng"))
    assert (case.proposal.asset_lookup_status, case.proposal.asset_id) == ("MATCHED", "SIM-ASSET-LIGHT-LIFT-CABIN")


@pytest.mark.parametrize(
    "text",
    [
        "Cửa thang máy tòa S2 không đóng",
        "Trong thang máy tòa S2 chạy rung lắc mạnh",
        "Trong thang máy tòa S2 dừng không xuống tầng",
    ],
)
def test_a_mechanical_lift_fault_stays_out_of_scope(fresh, text):
    ticket = _ticket(fresh, text)
    assert ticket.department_id is None and ticket.blocker.code == "OUT_OF_SCOPE"


@pytest.mark.parametrize("text", ["Có người ngất trong thang máy tòa S2", "Thang máy tòa S2 bị kẹt có người bên trong"])
def test_a_person_in_danger_in_the_lift_is_an_emergency(fresh, text):
    ticket = _ticket(fresh, text)
    assert ticket.blocker.code == "EMERGENCY_PENDING_BQL"


def test_a_landmark_is_not_the_cabin(fresh):
    """ "Trước thang máy" is where the problem is NOT inside the lift: the hallway rule still applies."""
    ticket = _ticket(fresh, "Hành lang trước thang máy tầng 3 tòa S1 có nhiều rác")
    assert ticket.department_id == "DEPT_CLEANING"
