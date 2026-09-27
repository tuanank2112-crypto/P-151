"""The five minimum scenarios from the MVP plan, run end to end through the API."""

from datetime import timedelta

BQL = {"X-Role": "bql"}
TECH = {"X-Role": "technician"}
V = "/api/v1"

LIGHTING_CHECKLIST = "diagnose,power_off,replace,test"
BEFORE = ("before.png", b"\x89PNG\r\n\x1a\n-before", "image/png")
AFTER = ("after.png", b"\x89PNG\r\n\x1a\n-after", "image/png")


def create_ticket(api, text: str) -> dict:
    response = api.post(f"{V}/tickets", data={"text": text, "reporter_contact": "S1.01-0512"})
    assert response.status_code == 201, response.text
    return response.json()


def assign(api, text: str = "Đèn hành lang tầng 5 bị hỏng, tối om") -> tuple[int, int]:
    """Create a ticket and take it to ASSIGNED. Returns (ticket_id, work_order_id)."""
    ticket_id = create_ticket(api, text)["ticket"]["id"]
    proposed = api.post(f"{V}/tickets/{ticket_id}/propose-work-order", headers=BQL)
    assert proposed.status_code == 200, proposed.text
    work_order_id = proposed.json()["work_orders"][0]["work_order"]["id"]
    approved = api.post(f"{V}/work-orders/{work_order_id}/approve", json={}, headers=BQL)
    assert approved.status_code == 200, approved.text
    return ticket_id, work_order_id


def audit_actions(api, ticket_id: int) -> list[str]:
    return [entry["action"] for entry in api.get(f"{V}/tickets/{ticket_id}/audit", headers=BQL).json()]


def test_happy_path(api):
    """1. Clear location -> assigned -> full evidence -> check passes -> closed."""
    created = create_ticket(api, "Đèn hành lang tầng 5 bị hỏng, tối om từ tối qua")
    ticket = created["ticket"]
    assert ticket["status"] == "TRIAGED"
    assert ticket["category"] == "lighting"
    assert ticket["location_id"] == "S101-T05-HL"

    proposed = api.post(f"{V}/tickets/{ticket['id']}/propose-work-order", headers=BQL).json()
    assert proposed["ticket"]["status"] == "WO_PROPOSED"
    work_order = proposed["work_orders"][0]["work_order"]
    assert work_order["technician_id"] == "KT01"  # 06:00-14:00 lighting shift

    approved = api.post(f"{V}/work-orders/{work_order['id']}/approve", json={}, headers=BQL).json()
    assert approved["ticket_status"] == "ASSIGNED"
    assert approved["work_order"]["accept_due_at"] is not None

    accepted = api.post(f"{V}/work-orders/{work_order['id']}/accept", headers=TECH)
    assert accepted.json()["work_order"]["status"] == "ACCEPTED"

    submitted = api.post(
        f"{V}/work-orders/{work_order['id']}/evidence",
        headers=TECH,
        files=[("before_photos", BEFORE), ("after_photos", AFTER)],
        data={"checklist_done": LIGHTING_CHECKLIST, "materials_used": "Bóng LED 18W x1"},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["ticket_status"] == "EVIDENCE_SUBMITTED"
    assert len(submitted.json()["evidence"]) == 2

    checked = api.post(f"{V}/work-orders/{work_order['id']}/check", headers=BQL).json()
    assert checked["result"]["passed"] is True
    assert checked["ticket_status"] == "CLOSE_PROPOSED"

    closed = api.post(f"{V}/tickets/{ticket['id']}/close", json={"note": "Đã kiểm tra"}, headers=BQL).json()
    assert closed["ticket"]["status"] == "CLOSED"

    actions = audit_actions(api, ticket["id"])
    assert actions == [
        "created",
        "intake_extracted",
        "triaged",
        "work_order_proposed",
        "work_order_approved",
        "work_order_accepted",
        "evidence_submitted",
        "check_passed",
        "close_proposed",
        "closed",
    ]

    metrics = api.get(f"{V}/metrics", headers=BQL).json()
    assert metrics["first_pass_rate"] == 1.0
    assert metrics["median_minutes_to_assign"] == 0.0


def test_ambiguous_location_escalates(api):
    """2. "tầng 5 tối" has no area -> several candidate locations -> BQL."""
    created = create_ticket(api, "tầng 5 tối")
    assert created["ticket"]["status"] == "ESCALATED"
    assert created["ticket"]["location_id"] is None
    assert created["escalations"][0]["reason"] == "AMBIGUOUS_LOCATION"
    assert created["work_orders"] == []

    # BQL fixes the location, then the normal flow continues
    escalation_id = created["escalations"][0]["id"]
    resolved = api.post(
        f"{V}/escalations/{escalation_id}/resolve",
        json={"action": "retriage", "location_id": "S101-T05-STM", "note": "Đã gọi cư dân xác nhận"},
        headers=BQL,
    ).json()
    assert resolved["ticket"]["status"] == "TRIAGED"
    assert resolved["ticket"]["location_id"] == "S101-T05-STM"
    assert api.get(f"{V}/escalations", headers=BQL).json() == []


def test_suspected_electrical_fault_escalates_without_work_order(api):
    """3. Burning smell / power loss -> BQL immediately, no work order."""
    created = create_ticket(api, "Mất điện cả hành lang tầng 7, có mùi khét")
    assert created["ticket"]["status"] == "ESCALATED"
    assert created["escalations"][0]["reason"] == "SAFETY_RISK"
    assert set(created["ticket"]["safety_flags"]) >= {"burning_smell", "power_outage"}
    assert created["work_orders"] == []

    # Even BQL cannot propose a work order while the ticket is escalated
    ticket_id = created["ticket"]["id"]
    response = api.post(f"{V}/tickets/{ticket_id}/propose-work-order", headers=BQL)
    assert response.status_code == 409


def test_missing_after_photo_fails_check_and_requests_reminder(api):
    """4. No after photo -> check fails with reasons and a reminder is logged."""
    ticket_id, work_order_id = assign(api)
    api.post(
        f"{V}/work-orders/{work_order_id}/evidence",
        headers=TECH,
        files=[("before_photos", BEFORE)],
        data={"checklist_done": LIGHTING_CHECKLIST, "materials_used": "Bóng LED 18W x1"},
    )

    checked = api.post(f"{V}/work-orders/{work_order_id}/check", headers=BQL).json()
    assert checked["result"]["passed"] is False
    assert [i["code"] for i in checked["result"]["issues"]] == ["missing_photo_after"]
    assert checked["ticket_status"] == "CHECK_FAILED"
    assert "reminder_requested" in audit_actions(api, ticket_id)

    # Technician adds the after photo; second check passes
    api.post(f"{V}/work-orders/{work_order_id}/evidence", headers=TECH, files=[("after_photos", AFTER)])
    rechecked = api.post(f"{V}/work-orders/{work_order_id}/check", headers=BQL).json()
    assert rechecked["result"]["passed"] is True
    assert rechecked["ticket_status"] == "CLOSE_PROPOSED"

    metrics = api.get(f"{V}/metrics", headers=BQL).json()
    assert metrics["first_pass_rate"] == 0.0  # counted on the first check only


def test_unaccepted_work_order_becomes_overdue(api, frozen_clock):
    """5. Nobody accepts the work order -> check-overdue opens an escalation."""
    ticket_id, work_order_id = assign(api)

    assert api.post(f"{V}/jobs/check-overdue", headers=BQL).json()["created"] == []

    frozen_clock.now += timedelta(minutes=31)  # lighting playbook: accept within 30 minutes
    result = api.post(f"{V}/jobs/check-overdue", headers=BQL).json()
    assert len(result["created"]) == 1
    escalation = result["created"][0]
    assert escalation["reason"] == "OVERDUE_ACCEPT"
    assert escalation["work_order_id"] == work_order_id

    # Running the job again does not duplicate the escalation
    assert api.post(f"{V}/jobs/check-overdue", headers=BQL).json()["created"] == []

    # BQL calls the technician and resumes; the deadline is extended
    resumed = api.post(f"{V}/escalations/{escalation['id']}/resolve", json={"action": "resume"}, headers=BQL).json()
    assert resumed["ticket"]["status"] == "ASSIGNED"
    assert api.post(f"{V}/jobs/check-overdue", headers=BQL).json()["created"] == []


def test_roles_are_enforced(api):
    ticket_id = create_ticket(api, "Đèn hành lang tầng 5 bị hỏng")["ticket"]["id"]
    assert api.post(f"{V}/tickets/{ticket_id}/propose-work-order").status_code == 403
    assert api.post(f"{V}/tickets/{ticket_id}/propose-work-order", headers=TECH).status_code == 403


def test_repeated_check_failure_escalates(api):
    _, work_order_id = assign(api)
    for _ in range(2):
        api.post(f"{V}/work-orders/{work_order_id}/evidence", headers=TECH, files=[("before_photos", BEFORE)])
        checked = api.post(f"{V}/work-orders/{work_order_id}/check", headers=BQL).json()
    assert checked["ticket_status"] == "ESCALATED"
    assert checked["escalation"]["reason"] == "REPEATED_CHECK_FAILURE"


def test_evidence_rejects_non_image_and_unknown_checklist(api):
    _, work_order_id = assign(api)
    not_image = api.post(
        f"{V}/work-orders/{work_order_id}/evidence",
        headers=TECH,
        files=[("before_photos", ("note.txt", b"hello", "text/plain"))],
    )
    assert not_image.status_code == 415
    bad_code = api.post(f"{V}/work-orders/{work_order_id}/evidence", headers=TECH, data={"checklist_done": "fly"})
    assert bad_code.status_code == 422


def test_resident_photos(api):
    """Resident can attach photos; BQL can view them; bad files are rejected without creating a ticket."""
    created = api.post(
        f"{V}/tickets",
        data={"text": "Đèn hành lang tầng 5 bị hỏng, tối om từ tối qua"},
        files=[("photos", BEFORE), ("photos", AFTER)],
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["ticket"]["status"] == "TRIAGED"
    assert len(body["photos"]) == 2

    photo = body["photos"][0]
    viewed = api.get(f"{V}/tickets/{body['ticket']['id']}/photos/{photo['id']}", headers=BQL)
    assert viewed.status_code == 200
    assert viewed.content == BEFORE[1]
    assert api.get(f"{V}/tickets/{body['ticket']['id']}/photos/{photo['id']}").status_code == 403

    before = len(api.get(f"{V}/tickets", headers=BQL).json())
    rejected = api.post(
        f"{V}/tickets",
        data={"text": "Đèn hành lang tầng 5 bị hỏng"},
        files=[("photos", ("note.txt", b"hello", "text/plain"))],
    )
    assert rejected.status_code == 415
    assert len(api.get(f"{V}/tickets", headers=BQL).json()) == before
