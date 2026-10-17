import pytest
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from app.domain.models.service import Service
from app.domain.models.team_member import TeamMember
from app.infrastructure.repositories.postgres_service_repo import PostgresServiceRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository


@pytest.mark.asyncio
async def test_scripted_visit_full_lifecycle_e2e(
    client_with_db,
    receptionist_auth,
    doctor_auth,
    test_session,
):
    """
    Automated end-to-end test of the complete scripted visit workflow:
    1. Online request
    2. Reception confirms
    3. Check-in (arrived) + Reception captures pending allergy alert
    4. Doctor sees 'Waiting for you'
    5. Doctor starts encounter (auto-transitions booking to in_progress)
    6. Doctor reviews & confirms pending allergy alert (promoted to confirmed)
    7. Doctor drafts & signs SOAP note (immutable)
    8. Doctor records & completes dental procedure
    9. Doctor finishes visit with 2-week follow-up
    10. Reception sees follow-up task on dashboard & task list
    """
    client = client_with_db
    rec_headers = receptionist_auth["headers"]
    doc_headers = doctor_auth["headers"]
    doctor_user = doctor_auth["user"]
    doctor_tm = doctor_auth["team_member"]

    # Pre-condition: Create a catalog Service for procedure recording
    service_repo = PostgresServiceRepository(test_session)
    test_service = Service(
        title="Comprehensive Oral Evaluation",
        slug="eval-d0150",
        category="preventive",
        short_desc="Exam and evaluation",
        cash_price="$150",
        duration="30 min",
        is_active=True,
    )
    saved_service = await service_repo.save(test_service)
    await test_session.commit()

    today = date.today()

    # --- Step 1: Online appointment request ---
    request_payload = {
        "preferredDate": today.isoformat(),
        "preferredTime": "10:00 AM",
        "fullName": "Arthur Pendelton",
        "phone": "555-829-1001",
        "email": "arthur.pendelton@example.com",
        "serviceId": "cleanings-exams",
        "notes": "Sharp tooth pain on lower right side",
    }
    req_resp = await client.post("/api/v1/appointments", json=request_payload)
    assert req_resp.status_code == 201
    conf_id = req_resp.json()["confirmationId"]
    assert conf_id is not None

    # --- Step 2: Reception triages and confirms appointment ---
    triage_resp = await client.get("/api/v1/reception/appointments?status=requested", headers=rec_headers)
    assert triage_resp.status_code == 200
    matched_req = next((b for b in triage_resp.json() if b["confirmationId"] == conf_id), None)
    assert matched_req is not None
    booking_id = matched_req["id"]

    confirm_resp = await client.patch(
        f"/api/v1/reception/appointments/{booking_id}/status",
        json={"status": "confirmed"},
        headers=rec_headers,
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"

    # Assign doctor to the booking so it belongs to doctor's schedule
    assign_resp = await client.patch(
        f"/api/v1/reception/appointments/{booking_id}/reschedule",
        json={
            "preferredDate": today.isoformat(),
            "preferredTime": "10:00 AM",
            "teamMemberId": str(doctor_tm.id),
        },
        headers=rec_headers,
    )
    assert assign_resp.status_code == 200
    patient_id = assign_resp.json()["patientId"]
    assert patient_id is not None

    # --- Step 3: Patient check-in (arrived) & Reception captures pending alert ---
    checkin_resp = await client.patch(
        f"/api/v1/reception/appointments/{booking_id}/status",
        json={"status": "arrived"},
        headers=rec_headers,
    )
    assert checkin_resp.status_code == 200
    assert checkin_resp.json()["status"] == "arrived"

    # Patient reports penicillin allergy at front desk -> Reception captures pending alert
    alert_payload = {
        "type": "allergy",
        "description": "Severe Penicillin allergy - causes hives and swelling",
        "severity": "high",
    }
    pending_alert_resp = await client.post(
        f"/api/v1/reception/patients/{patient_id}/pending-alerts",
        json=alert_payload,
        headers=rec_headers,
    )
    assert pending_alert_resp.status_code == 201
    alert_id = pending_alert_resp.json()["id"]
    assert pending_alert_resp.json()["isConfirmed"] is False

    # Verify reception is forbidden (403) from accessing clinical alert details
    rec_blocked = await client.get(
        f"/api/v1/clinical/patients/{patient_id}/alerts",
        headers=rec_headers,
    )
    assert rec_blocked.status_code == 403

    # --- Step 4: Doctor sees patient in "Waiting for you" schedule ---
    doc_sched_resp = await client.get(
        f"/api/v1/doctor/schedule?date={today.isoformat()}",
        headers=doc_headers,
    )
    assert doc_sched_resp.status_code == 200
    doctor_bookings = doc_sched_resp.json()
    matched_waiting = next((b for b in doctor_bookings if b["id"] == booking_id), None)
    assert matched_waiting is not None
    assert matched_waiting["status"] == "arrived"

    # --- Step 5: Doctor starts encounter (auto transitions booking to in_progress) ---
    enc_payload = {
        "patientId": patient_id,
        "bookingId": booking_id,
        "status": "in_progress",
        "chiefComplaint": "Sharp pain #30 cold sensitivity",
    }
    enc_resp = await client.post("/api/v1/doctor/encounters", json=enc_payload, headers=doc_headers)
    assert enc_resp.status_code == 201
    encounter_id = enc_resp.json()["id"]

    # Verify booking status moved to in_progress automatically
    post_enc_sched = await client.get(
        f"/api/v1/doctor/schedule?date={today.isoformat()}",
        headers=doc_headers,
    )
    post_booking = next(b for b in post_enc_sched.json() if b["id"] == booking_id)
    assert post_booking["status"] == "in_progress"

    # --- Step 6: Doctor confirms pending allergy alert ---
    # Doctor views alerts: pending has 1, confirmed has 0
    alerts_resp = await client.get(
        f"/api/v1/clinical/patients/{patient_id}/alerts",
        headers=doc_headers,
    )
    assert alerts_resp.status_code == 200
    alerts_data = alerts_resp.json()
    assert any(a["id"] == alert_id for a in alerts_data["pendingAlerts"])
    assert len(alerts_data["confirmedAlerts"]) == 0

    # Doctor confirms allergy
    confirm_alert_resp = await client.post(
        f"/api/v1/clinical/alerts/{alert_id}/confirm",
        headers=doc_headers,
    )
    assert confirm_alert_resp.status_code == 200
    assert confirm_alert_resp.json()["isConfirmed"] is True

    # Confirmed alert now appears in confirmedAlerts
    doc_alerts_resp2 = await client.get(
        f"/api/v1/clinical/patients/{patient_id}/alerts",
        headers=doc_headers,
    )
    assert doc_alerts_resp2.status_code == 200
    assert any(a["id"] == alert_id for a in doc_alerts_resp2.json()["confirmedAlerts"])

    # --- Step 7: Doctor drafts & signs SOAP note ---
    draft_note_payload = {
        "subjective": "Patient reports severe lingering cold sensitivity #30 for 3 days.",
        "objective": "Deep occlusal caries #30, EPT hyper-responsive.",
        "assessment": "Symptomatic irreversible pulpitis #30.",
        "plan": "Pulpectomy initiated, temporized with Cavit. Follow-up for RCT completion.",
    }
    draft_resp = await client.put(
        f"/api/v1/doctor/encounters/{encounter_id}/note/draft",
        json=draft_note_payload,
        headers=doc_headers,
    )
    assert draft_resp.status_code == 200

    # Doctor signs the note
    sign_resp = await client.post(
        f"/api/v1/doctor/encounters/{encounter_id}/note/sign",
        headers=doc_headers,
    )
    assert sign_resp.status_code == 200
    assert sign_resp.json()["isSigned"] is True

    # Note is locked: Editing is rejected with 400/409
    edit_attempt = await client.put(
        f"/api/v1/doctor/encounters/{encounter_id}/note/draft",
        json={"subjective": "Altered note"},
        headers=doc_headers,
    )
    assert edit_attempt.status_code in (400, 409)

    # --- Step 8: Doctor records procedure ---
    proc_payload = {
        "tooth": "30",
        "serviceId": str(saved_service.id),
        "surfaces": ["O"],
        "notes": "Emergency pulpectomy and coronal debridement completed.",
    }
    proc_resp = await client.post(
        f"/api/v1/doctor/encounters/{encounter_id}/chart/procedures",
        json=proc_payload,
        headers=doc_headers,
    )
    assert proc_resp.status_code == 201
    procedure_id = proc_resp.json()["id"]

    # Transition procedure: planned -> in_progress -> completed
    proc_in_progress = await client.patch(
        f"/api/v1/doctor/chart/procedures/{procedure_id}/status",
        json={"status": "in_progress"},
        headers=doc_headers,
    )
    assert proc_in_progress.status_code == 200
    assert proc_in_progress.json()["status"] == "in_progress"

    proc_update_resp = await client.patch(
        f"/api/v1/doctor/chart/procedures/{procedure_id}/status",
        json={"status": "completed", "notes": "Cavit restoration placed."},
        headers=doc_headers,
    )
    assert proc_update_resp.status_code == 200
    assert proc_update_resp.json()["status"] == "completed"

    # --- Step 9: Doctor finishes visit with follow-up handoff ---
    finish_payload = {
        "followUpWeeks": 2,
        "followUpNote": "Complete endodontic obturation and core build-up #30",
    }
    finish_resp = await client.post(
        f"/api/v1/doctor/appointments/{booking_id}/finish",
        json=finish_payload,
        headers=doc_headers,
    )
    assert finish_resp.status_code == 200
    assert finish_resp.json()["status"] == "completed"

    # --- Step 10: Receptionist sees follow-up handoff task ---
    rec_tasks_resp = await client.get(
        f"/api/v1/reception/tasks?status=active",
        headers=rec_headers,
    )
    assert rec_tasks_resp.status_code == 200
    tasks_list = rec_tasks_resp.json()
    followup_task = next(
        (t for t in tasks_list if t["bookingId"] == booking_id or t["patientId"] == patient_id),
        None,
    )
    assert followup_task is not None
    assert "Book follow-up: Arthur Pendelton in 2 weeks" in followup_task["title"]
    assert "Complete endodontic obturation" in followup_task["description"]
    assert followup_task["priority"] == "high"

    # Verify task is also visible on reception dashboard summary
    summary_resp = await client.get(
        "/api/v1/reception/dashboard",
        headers=rec_headers,
    )
    assert summary_resp.status_code == 200
    needs_attention = summary_resp.json()["needsAttentionItems"]
    assert any(item["title"] == f"Task: {followup_task['title']}" for item in needs_attention)
