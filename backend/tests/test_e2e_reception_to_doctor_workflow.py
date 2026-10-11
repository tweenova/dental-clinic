import pytest
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from app.core.security import hash_password
from app.domain.models.booking_crm import Booking, Patient, Task
from app.domain.models.team_member import TeamMember
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository


@pytest.mark.asyncio
async def test_full_receptionist_to_doctor_lifecycle(client_with_db, test_session):
    """
    End-to-end integration test verifying the complete receptionist-to-doctor workflow:
    1. Online booking intake via /api/v1/appointments
    2. Patient chart creation and deduplication
    3. Reception triage and confirmation
    4. Patient arrival & waiting room check-in
    5. Provider chair handoff & doctor clinical notes
    6. Doctor clinician scoping & cross-clinician protection
    7. Completion & follow-up task generation
    """
    # 0. Setup test users and team members
    user_repo = PostgresUserRepository(test_session)
    team_repo = PostgresTeamMemberRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)
    task_repo = PostgresTaskRepository(test_session)

    org_id = uuid4()

    # Create Dr. Sarah Marlow team member
    dr_marlow_member = TeamMember(
        organization_id=org_id,
        first_name="Sarah",
        last_name="Marlow",
        display_name="Dr. Sarah Marlow, DDS",
        role="Director",
        professional_title="General & Cosmetic Dentist",
    )
    await team_repo.save(dr_marlow_member)

    # Create Dr. Marcus Vance team member
    dr_vance_member = TeamMember(
        organization_id=org_id,
        first_name="Marcus",
        last_name="Vance",
        display_name="Dr. Marcus Vance, DMD",
        role="Orthodontist",
        professional_title="Orthodontist",
    )
    await team_repo.save(dr_vance_member)

    # Create Receptionist user
    receptionist_user = User(
        email="rec@marlowdental.com",
        hashed_password=hash_password("Pass123!"),
        full_name="Front Desk Receptionist",
        role=UserRole.RECEPTIONIST,
    )
    await user_repo.save(receptionist_user)

    # Create Dr. Sarah Marlow user linked to her team member
    dr_marlow_user = User(
        email="dr.marlow@marlowdental.com",
        hashed_password=hash_password("DoctorPass123!"),
        full_name="Dr. Sarah Marlow",
        role=UserRole.DOCTOR,
        team_member_id=dr_marlow_member.id,
    )
    await user_repo.save(dr_marlow_user)

    # Create Dr. Marcus Vance user linked to his team member
    dr_vance_user = User(
        email="dr.vance@marlowdental.com",
        hashed_password=hash_password("DoctorPass123!"),
        full_name="Dr. Marcus Vance",
        role=UserRole.DOCTOR,
        team_member_id=dr_vance_member.id,
    )
    await user_repo.save(dr_vance_user)
    await test_session.commit()

    # Log in Receptionist
    rec_login = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "rec@marlowdental.com", "password": "Pass123!"},
    )
    assert rec_login.status_code == 200
    rec_headers = {"Authorization": f"Bearer {rec_login.json()['accessToken']}"}

    # Log in Dr. Sarah Marlow
    dr_marlow_login = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "dr.marlow@marlowdental.com", "password": "DoctorPass123!"},
    )
    assert dr_marlow_login.status_code == 200
    dr_marlow_headers = {"Authorization": f"Bearer {dr_marlow_login.json()['accessToken']}"}
    assert dr_marlow_login.json()["user"]["teamMemberId"] == str(dr_marlow_member.id)

    # Log in Dr. Marcus Vance
    dr_vance_login = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "dr.vance@marlowdental.com", "password": "DoctorPass123!"},
    )
    assert dr_vance_login.status_code == 200
    dr_vance_headers = {"Authorization": f"Bearer {dr_vance_login.json()['accessToken']}"}

    # --- Step 1: Public Online Booking Submission ---
    target_date = date.today()
    public_payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": target_date.isoformat(),
        "preferredTime": "10:00 AM",
        "fullName": "Eleanor Pemberton",
        "phone": "(312) 555-0191",
        "email": "eleanor.p@example.com",
        "notes": "Patient notes: routine preventive examination",
        "utmSource": "website",
        "utmCampaign": "summer-checkup",
    }
    public_resp = await client_with_db.post("/api/v1/appointments", json=public_payload)
    assert public_resp.status_code == 201
    confirm_id = public_resp.json()["confirmationId"]
    assert confirm_id.startswith("MD-")

    # Verify patient record was automatically deduplicated/created
    patients, _ = await patient_repo.search(query="Eleanor")
    assert len(patients) == 1
    patient = patients[0]
    assert patient.first_name == "Eleanor"
    assert patient.last_name == "Pemberton"

    # --- Step 2: Reception Triage Queue View ---
    # Receptionist fetches intake triage queue (status=requested)
    triage_resp = await client_with_db.get(
        "/api/v1/reception/appointments?status=requested",
        headers=rec_headers,
    )
    assert triage_resp.status_code == 200
    requests_list = triage_resp.json()
    assert len(requests_list) >= 1
    booking_item = next(b for b in requests_list if b["confirmationId"] == confirm_id)
    assert booking_item["status"] == "requested"
    assert booking_item["patientFullName"] == "Eleanor Pemberton"
    booking_id = booking_item["id"]

    # --- Step 3: Reception Confirmation ---
    # Receptionist confirms booking and assigns to Dr. Sarah Marlow
    resched_payload = {
        "preferredDate": target_date.isoformat(),
        "preferredTime": "10:00 AM",
        "teamMemberId": str(dr_marlow_member.id),
        "staffNotes": "Confirmed appointment by phone.",
    }
    confirm_resp = await client_with_db.patch(
        f"/api/v1/reception/appointments/{booking_id}/reschedule",
        json=resched_payload,
        headers=rec_headers,
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"
    assert confirm_resp.json()["teamMemberId"] == str(dr_marlow_member.id)

    # --- Step 4: Patient Arrival & Check-In ---
    # Patient arrives at clinic -> check in to waiting room (status=arrived)
    checkin_resp = await client_with_db.patch(
        f"/api/v1/reception/appointments/{booking_id}/status",
        json={"status": "arrived", "staffNotes": "Patient arrived, in waiting room lounge."},
        headers=rec_headers,
    )
    assert checkin_resp.status_code == 200
    assert checkin_resp.json()["status"] == "arrived"

    # Check dashboard counts
    dash_resp = await client_with_db.get("/api/v1/reception/dashboard", headers=rec_headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["todayAppointments"] >= 1

    # --- Step 5: Provider Chair Handoff & Doctor Clinical Notes ---
    # Reception sends patient to chair (status=in_progress)
    chair_resp = await client_with_db.patch(
        f"/api/v1/reception/appointments/{booking_id}/status",
        json={"status": "in_progress", "staffNotes": "In Operatory 2 with Dr. Marlow."},
        headers=rec_headers,
    )
    assert chair_resp.status_code == 200
    assert chair_resp.json()["status"] == "in_progress"

    # Dr. Sarah Marlow views her schedule
    doc_schedule_resp = await client_with_db.get(
        f"/api/v1/doctor/schedule?target_date={target_date.isoformat()}",
        headers=dr_marlow_headers,
    )
    assert doc_schedule_resp.status_code == 200
    doc_bookings = doc_schedule_resp.json()
    assert any(b["id"] == booking_id for b in doc_bookings)

    # Dr. Sarah Marlow records clinical observations
    notes_resp = await client_with_db.patch(
        f"/api/v1/doctor/appointments/{booking_id}/notes",
        json={"staffNotes": "Full comprehensive oral exam. Prophy performed. No active caries detected."},
        headers=dr_marlow_headers,
    )
    assert notes_resp.status_code == 200
    assert "No active caries detected" in notes_resp.json()["staffNotes"]
    assert "routine preventive examination" in notes_resp.json()["notes"]

    # --- Step 6: Clinician Scoping & Cross-Clinician Protection ---
    # Dr. Marcus Vance checks his schedule (should NOT contain Dr. Marlow's appointment)
    vance_schedule_resp = await client_with_db.get(
        f"/api/v1/doctor/schedule?target_date={target_date.isoformat()}",
        headers=dr_vance_headers,
    )
    assert vance_schedule_resp.status_code == 200
    vance_bookings = vance_schedule_resp.json()
    assert not any(b["id"] == booking_id for b in vance_bookings)

    # Dr. Marcus Vance attempts to view Dr. Marlow's appointment detail -> 403 Forbidden
    vance_detail_resp = await client_with_db.get(
        f"/api/v1/doctor/appointments/{booking_id}",
        headers=dr_vance_headers,
    )
    assert vance_detail_resp.status_code == 403
    assert "Access forbidden" in vance_detail_resp.json()["detail"]

    # Dr. Marcus Vance attempts to modify Dr. Marlow's patient notes -> 403 Forbidden
    vance_notes_resp = await client_with_db.patch(
        f"/api/v1/doctor/appointments/{booking_id}",
        json={"staffNotes": "Malicious or accidental note override attempt."},
        headers=dr_vance_headers,
    )
    assert vance_notes_resp.status_code == 405 or vance_notes_resp.status_code == 403

    vance_notes_resp2 = await client_with_db.patch(
        f"/api/v1/doctor/appointments/{booking_id}/notes",
        json={"staffNotes": "Malicious or accidental note override attempt."},
        headers=dr_vance_headers,
    )
    assert vance_notes_resp2.status_code == 403
    assert "Access forbidden" in vance_notes_resp2.json()["detail"]

    # --- Step 7: Completion & Follow-up Task Workflow ---
    # Visit completed at checkout
    checkout_resp = await client_with_db.patch(
        f"/api/v1/reception/appointments/{booking_id}/status",
        json={"status": "completed", "staffNotes": "Checkout complete. Patient rebooked for 6-month recall."},
        headers=rec_headers,
    )
    assert checkout_resp.status_code == 200
    assert checkout_resp.json()["status"] == "completed"

    # Receptionist creates follow-up task
    task_resp = await client_with_db.post(
        "/api/v1/reception/tasks",
        json={
            "title": "Send 6-month hygiene recall reminder to Eleanor Pemberton",
            "priority": "medium",
            "status": "pending",
        },
        headers=rec_headers,
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["id"]

    # Verify task queries for open and pending statuses both return the task
    open_tasks = await client_with_db.get(
        "/api/v1/reception/tasks?status=open",
        headers=rec_headers,
    )
    assert open_tasks.status_code == 200
    assert any(t["id"] == task_id for t in open_tasks.json())

    pending_tasks = await client_with_db.get(
        "/api/v1/reception/tasks?status=pending",
        headers=rec_headers,
    )
    assert pending_tasks.status_code == 200
    assert any(t["id"] == task_id for t in pending_tasks.json())


@pytest.mark.asyncio
async def test_appointment_status_transition_rules(receptionist_auth, test_session):
    """
    Verifies that illegal status transitions and invalid status values are rejected.
    """
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    booking_repo = PostgresBookingRepository(test_session)
    booking = Booking(
        confirmation_id="BK-2026-TEST-VALID",
        preferred_date=date.today(),
        preferred_time="11:00 AM",
        patient_full_name="Status Test Patient",
        patient_phone="3125550198",
        patient_email="status.test@example.com",
        status="requested",
    )
    await booking_repo.save(booking)
    await test_session.commit()

    # 1. Invalid status value -> 422
    resp_invalid = await client.patch(
        f"/api/v1/reception/appointments/{booking.id}/status",
        json={"status": "completely_invalid_status_xyz"},
        headers=headers,
    )
    assert resp_invalid.status_code == 422

    # 2. Illegal jump from requested directly to completed -> 400
    resp_illegal = await client.patch(
        f"/api/v1/reception/appointments/{booking.id}/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert resp_illegal.status_code == 400
    assert "Cannot transition appointment" in resp_illegal.json()["detail"]

    # 3. Valid transition: requested -> confirmed -> 200
    resp_confirmed = await client.patch(
        f"/api/v1/reception/appointments/{booking.id}/status",
        json={"status": "confirmed"},
        headers=headers,
    )
    assert resp_confirmed.status_code == 200
    assert resp_confirmed.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_unlinked_doctor_fails_closed_and_admin_has_oversight(client_with_db, test_session, admin_auth):
    """
    Verifies that:
    1. A doctor without a linked team_member_id fails closed (empty schedule, cannot access/modify notes).
    2. An admin user retains administrative oversight to view all schedules and update records.
    """
    user_repo = PostgresUserRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    team_repo = PostgresTeamMemberRepository(test_session)

    org_id = uuid4()
    dr_member = TeamMember(
        organization_id=org_id,
        first_name="Elena",
        last_name="Rostova",
        display_name="Dr. Elena Rostova, DDS",
        role="Dentist",
        professional_title="General Dentist",
    )
    await team_repo.save(dr_member)

    # 1. Create an unlinked doctor user (team_member_id=None)
    unlinked_doctor = User(
        email="unlinked.doc@marlowdental.com",
        hashed_password=hash_password("DoctorPass123!"),
        full_name="Unlinked Doctor",
        role=UserRole.DOCTOR,
        team_member_id=None,
    )
    await user_repo.save(unlinked_doctor)

    # Create a booking assigned to Dr. Rostova
    booking = Booking(
        confirmation_id="BK-2026-TEST-ROSTOVA",
        preferred_date=date.today(),
        preferred_time="2:00 PM",
        patient_full_name="Patient Rostova",
        patient_phone="3125550190",
        patient_email="rostova.pat@example.com",
        team_member_id=dr_member.id,
        status="confirmed",
    )
    await booking_repo.save(booking)
    await test_session.commit()

    # Log in unlinked doctor
    login_resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "unlinked.doc@marlowdental.com", "password": "DoctorPass123!"},
    )
    assert login_resp.status_code == 200
    unlinked_headers = {"Authorization": f"Bearer {login_resp.json()['accessToken']}"}

    # Unlinked doctor fetches schedule -> must fail closed with []
    sched_resp = await client_with_db.get(
        f"/api/v1/doctor/schedule?target_date={date.today().isoformat()}",
        headers=unlinked_headers,
    )
    assert sched_resp.status_code == 200
    assert sched_resp.json() == []

    # Unlinked doctor attempts detail access -> 403
    det_resp = await client_with_db.get(
        f"/api/v1/doctor/appointments/{booking.id}",
        headers=unlinked_headers,
    )
    assert det_resp.status_code == 403
    assert "not linked" in det_resp.json()["detail"]

    # Unlinked doctor attempts notes update -> 403
    note_resp = await client_with_db.patch(
        f"/api/v1/doctor/appointments/{booking.id}/notes",
        json={"staffNotes": "Unlinked attempt."},
        headers=unlinked_headers,
    )
    assert note_resp.status_code == 403
    assert "not linked" in note_resp.json()["detail"]

    # Admin oversight: Admin can view doctor schedule and update notes
    admin_headers = admin_auth["headers"]
    admin_sched = await client_with_db.get(
        f"/api/v1/doctor/schedule?target_date={date.today().isoformat()}",
        headers=admin_headers,
    )
    assert admin_sched.status_code == 200
    assert any(b["id"] == str(booking.id) for b in admin_sched.json())

    admin_note = await client_with_db.patch(
        f"/api/v1/doctor/appointments/{booking.id}/notes",
        json={"staffNotes": "Admin oversight note update."},
        headers=admin_headers,
    )
    assert admin_note.status_code == 200
    assert admin_note.json()["staffNotes"] == "Admin oversight note update."


