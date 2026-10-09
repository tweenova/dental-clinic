import pytest
from datetime import date, datetime, timezone
from uuid import uuid4

from app.core.security import hash_password
from app.domain.models.booking_crm import Booking, Patient
from app.domain.models.encounter import ClinicalEncounter, EncounterStatus
from app.domain.models.team_member import TeamMember
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_encounter_repo import PostgresEncounterRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository


import pytest_asyncio

@pytest_asyncio.fixture
async def secondary_doctor_auth(test_session, client_with_db):
    """Creates a second doctor user and logs in to test cross-clinician isolation."""
    team_repo = PostgresTeamMemberRepository(test_session)
    doc_tm2 = TeamMember(
        organization_id=uuid4(),
        first_name="Marcus",
        last_name="Vance",
        display_name="Dr. Marcus Vance",
        professional_title="Orthodontist",
        role="Doctor",
        is_active=True,
    )
    saved_tm2 = await team_repo.save(doc_tm2)

    user_repo = PostgresUserRepository(test_session)
    doc_user2 = User(
        email="marcus.vance@marlowdental.com",
        hashed_password=hash_password("DoctorVance123!"),
        full_name="Dr. Marcus Vance",
        role=UserRole.DOCTOR,
        team_member_id=saved_tm2.id,
        is_active=True,
    )
    await user_repo.save(doc_user2)
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "marcus.vance@marlowdental.com", "password": "DoctorVance123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "headers": headers,
        "token": token,
        "client": client_with_db,
        "user": doc_user2,
        "team_member": saved_tm2,
    }


@pytest_asyncio.fixture
async def unlinked_doctor_auth(test_session, client_with_db):
    """Creates a doctor user with NO linked team_member_id."""
    user_repo = PostgresUserRepository(test_session)
    doc_unlinked = User(
        email="unlinked.doc@marlowdental.com",
        hashed_password=hash_password("UnlinkedDoc123!"),
        full_name="Unlinked Doctor",
        role=UserRole.DOCTOR,
        team_member_id=None,
        is_active=True,
    )
    await user_repo.save(doc_unlinked)
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "unlinked.doc@marlowdental.com", "password": "UnlinkedDoc123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "headers": headers,
        "token": token,
        "client": client_with_db,
        "user": doc_unlinked,
    }


@pytest.mark.asyncio
async def test_create_clinical_encounter_standalone_walk_in(doctor_auth, test_session):
    """Doctor creates a standalone encounter for a walk-in patient with no pre-existing booking."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = Patient(
        first_name="Eleanor",
        last_name="Vance",
        phone="3125559090",
        email="eleanor@example.com",
    )
    saved_patient = await patient_repo.save(p)
    await test_session.commit()

    payload = {
        "patientId": str(saved_patient.id),
        "status": "in_progress",
        "chiefComplaint": "Severe toothache lower right molar",
        "reasonForVisit": "Emergency Walk-in",
    }

    resp = await client.post("/api/v1/doctor/encounters", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()

    assert data["patientId"] == str(saved_patient.id)
    assert data["clinicianId"] == str(tm_id)
    assert data["bookingId"] is None
    assert data["status"] == "in_progress"
    assert data["chiefComplaint"] == "Severe toothache lower right molar"
    assert data["reasonForVisit"] == "Emergency Walk-in"
    assert data["startedAt"] is not None
    assert data["endedAt"] is None


@pytest.mark.asyncio
async def test_create_clinical_encounter_with_booking_linkage(doctor_auth, test_session):
    """Doctor creates an encounter linked to an operational booking and claims unassigned booking."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    p = Patient(
        first_name="Arthur",
        last_name="Dent",
        phone="3125557777",
        email="arthur@example.com",
    )
    saved_patient = await patient_repo.save(p)

    b = Booking(
        confirmation_id="BK-2026-ENC1",
        preferred_date=date.today(),
        preferred_time="10:00 AM",
        patient_full_name="Arthur Dent",
        patient_phone="3125557777",
        patient_email="arthur@example.com",
        patient_id=saved_patient.id,
        status="arrived",
        team_member_id=None,  # unassigned
    )
    saved_booking = await booking_repo.save(b)
    await test_session.commit()

    payload = {
        "patientId": str(saved_patient.id),
        "bookingId": str(saved_booking.id),
        "status": "in_progress",
        "chiefComplaint": "Routine checkup and cleaning",
    }

    resp = await client.post("/api/v1/doctor/encounters", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()

    assert data["bookingId"] == str(saved_booking.id)
    assert data["clinicianId"] == str(tm_id)

    # Verify unassigned booking was bound to the initiating clinician
    reloaded_booking = await booking_repo.get_by_id(saved_booking.id)
    assert reloaded_booking.team_member_id == tm_id


@pytest.mark.asyncio
async def test_create_encounter_patient_not_found(doctor_auth):
    """Creating an encounter for a non-existent patient returns 404."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    payload = {
        "patientId": str(uuid4()),
        "status": "in_progress",
    }
    resp = await client.post("/api/v1/doctor/encounters", json=payload, headers=headers)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_encounter_booking_patient_mismatch(doctor_auth, test_session):
    """Encounter creation fails with 400 if the booking belongs to a different patient."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    p1 = await patient_repo.save(Patient(first_name="Patient", last_name="One", phone="3125551111", email="p1@example.com"))
    p2 = await patient_repo.save(Patient(first_name="Patient", last_name="Two", phone="3125552222", email="p2@example.com"))

    b = await booking_repo.save(Booking(
        confirmation_id="BK-2026-MISMATCH",
        preferred_date=date.today(),
        preferred_time="11:00 AM",
        patient_full_name="Patient One",
        patient_phone="3125551111",
        patient_email="p1@example.com",
        patient_id=p1.id,
        status="confirmed",
    ))
    await test_session.commit()

    payload = {
        "patientId": str(p2.id),  # Mismatched patient
        "bookingId": str(b.id),
        "status": "in_progress",
    }
    resp = await client.post("/api/v1/doctor/encounters", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "does not belong to the specified patient" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_encounter_unlinked_doctor_fails_closed(unlinked_doctor_auth, test_session):
    """Doctor without a linked team_member_id cannot create encounters (403 Forbidden)."""
    client = unlinked_doctor_auth["client"]
    headers = unlinked_doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Test", last_name="Patient", phone="3125550000", email="tp@example.com"))
    await test_session.commit()

    payload = {
        "patientId": str(p.id),
        "status": "in_progress",
    }
    resp = await client.post("/api/v1/doctor/encounters", json=payload, headers=headers)
    assert resp.status_code == 403
    assert "not linked to a clinical staff profile" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_encounter_other_doctor_booking_forbidden(doctor_auth, secondary_doctor_auth, test_session):
    """Doctor B cannot create an encounter for a booking assigned to Doctor A (403 Forbidden)."""
    client2 = secondary_doctor_auth["client"]
    headers2 = secondary_doctor_auth["headers"]
    doc1_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Shared", last_name="Patient", phone="3125553333", email="sp@example.com"))
    b = await booking_repo.save(Booking(
        confirmation_id="BK-2026-DOC1-ASSIGNED",
        preferred_date=date.today(),
        preferred_time="2:00 PM",
        patient_full_name="Shared Patient",
        patient_phone="3125553333",
        patient_email="sp@example.com",
        patient_id=p.id,
        team_member_id=doc1_tm_id,  # Assigned to Dr 1
        status="confirmed",
    ))
    await test_session.commit()

    # Doctor 2 attempts to create encounter for Doctor 1's booking
    payload = {
        "patientId": str(p.id),
        "bookingId": str(b.id),
        "status": "in_progress",
    }
    resp = await client2.post("/api/v1/doctor/encounters", json=payload, headers=headers2)
    assert resp.status_code == 403
    assert "assigned to another clinician" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_active_encounter_conflict(doctor_auth, test_session):
    """Creating a second active encounter for the same booking returns 409 Conflict."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Double", last_name="Booking", phone="3125554444", email="db@example.com"))
    b = await booking_repo.save(Booking(
        confirmation_id="BK-2026-DUP",
        preferred_date=date.today(),
        preferred_time="3:00 PM",
        patient_full_name="Double Booking",
        patient_phone="3125554444",
        patient_email="db@example.com",
        patient_id=p.id,
        team_member_id=tm_id,
        status="confirmed",
    ))
    await test_session.commit()

    payload = {
        "patientId": str(p.id),
        "bookingId": str(b.id),
        "status": "draft",
    }

    # 1. First encounter succeeds
    resp1 = await client.post("/api/v1/doctor/encounters", json=payload, headers=headers)
    assert resp1.status_code == 201

    # 2. Second encounter for the same active booking raises 409 Conflict
    resp2 = await client.post("/api/v1/doctor/encounters", json=payload, headers=headers)
    assert resp2.status_code == 409
    assert "active encounter already exists" in resp2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_encounter_status_transitions_and_timestamps(doctor_auth, test_session):
    """Validates state machine transitions: draft -> in_progress -> completed, and timestamp setting."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Transition", last_name="Patient", phone="3125555555", email="tp5@example.com"))
    await test_session.commit()

    # 1. Create as draft
    resp = await client.post(
        "/api/v1/doctor/encounters",
        json={"patientId": str(p.id), "status": "draft"},
        headers=headers,
    )
    assert resp.status_code == 201
    enc_id = resp.json()["id"]
    assert resp.json()["status"] == "draft"
    assert resp.json()["endedAt"] is None

    # 2. Transition draft -> in_progress
    resp_in_prog = await client.patch(
        f"/api/v1/doctor/encounters/{enc_id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert resp_in_prog.status_code == 200
    assert resp_in_prog.json()["status"] == "in_progress"
    assert resp_in_prog.json()["endedAt"] is None

    # 3. Transition in_progress -> completed
    resp_completed = await client.patch(
        f"/api/v1/doctor/encounters/{enc_id}/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert resp_completed.status_code == 200
    assert resp_completed.json()["status"] == "completed"
    assert resp_completed.json()["endedAt"] is not None

    # 4. Attempt illegal transition completed -> in_progress (400 Bad Request)
    resp_illegal = await client.patch(
        f"/api/v1/doctor/encounters/{enc_id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert resp_illegal.status_code == 400
    assert "Invalid encounter status transition" in resp_illegal.json()["detail"]


@pytest.mark.asyncio
async def test_cross_clinician_encounter_access_forbidden(doctor_auth, secondary_doctor_auth, test_session):
    """Doctor B cannot view or modify Doctor A's clinical encounter (403 Forbidden)."""
    client1 = doctor_auth["client"]
    headers1 = doctor_auth["headers"]
    client2 = secondary_doctor_auth["client"]
    headers2 = secondary_doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Isolated", last_name="Patient", phone="3125556666", email="iso@example.com"))
    await test_session.commit()

    # Doctor 1 creates encounter
    resp1 = await client1.post(
        "/api/v1/doctor/encounters",
        json={"patientId": str(p.id), "status": "in_progress"},
        headers=headers1,
    )
    enc_id = resp1.json()["id"]

    # Doctor 2 attempts GET
    resp_get = await client2.get(f"/api/v1/doctor/encounters/{enc_id}", headers=headers2)
    assert resp_get.status_code == 403
    assert "not authorized to view this encounter" in resp_get.json()["detail"]

    # Doctor 2 attempts status mutation
    resp_patch = await client2.patch(
        f"/api/v1/doctor/encounters/{enc_id}/status",
        json={"status": "completed"},
        headers=headers2,
    )
    assert resp_patch.status_code == 403
    assert "cannot modify this encounter" in resp_patch.json()["detail"]


@pytest.mark.asyncio
async def test_admin_oversight_access_to_all_encounters(admin_auth, doctor_auth, test_session):
    """Admin has oversight access to view and update encounters across any clinician."""
    client_admin = admin_auth["client"]
    headers_admin = admin_auth["headers"]
    client_doc = doctor_auth["client"]
    headers_doc = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="AdminView", last_name="Patient", phone="3125557788", email="av@example.com"))
    await test_session.commit()

    resp_doc = await client_doc.post(
        "/api/v1/doctor/encounters",
        json={"patientId": str(p.id), "status": "in_progress"},
        headers=headers_doc,
    )
    enc_id = resp_doc.json()["id"]

    # Admin reads Doctor's encounter
    resp_admin_get = await client_admin.get(f"/api/v1/doctor/encounters/{enc_id}", headers=headers_admin)
    assert resp_admin_get.status_code == 200
    assert resp_admin_get.json()["id"] == enc_id

    # Admin updates status
    resp_admin_patch = await client_admin.patch(
        f"/api/v1/doctor/encounters/{enc_id}/status",
        json={"status": "completed"},
        headers=headers_admin,
    )
    assert resp_admin_patch.status_code == 200
    assert resp_admin_patch.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_list_patient_encounters_chronological_ordering(doctor_auth, test_session):
    """Patient encounter history returns all encounters in descending chronological order."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="History", last_name="Patient", phone="3125558899", email="hist@example.com"))
    await test_session.commit()

    # Create 3 encounters
    resp1 = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "chiefComplaint": "Encounter 1", "status": "draft"}, headers=headers)
    assert resp1.status_code == 201
    resp2 = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "chiefComplaint": "Encounter 2", "status": "draft"}, headers=headers)
    assert resp2.status_code == 201
    resp3 = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "chiefComplaint": "Encounter 3", "status": "in_progress"}, headers=headers)
    assert resp3.status_code == 201

    resp_list = await client.get(f"/api/v1/doctor/patients/{p.id}/encounters", headers=headers)
    assert resp_list.status_code == 200
    encs = resp_list.json()
    assert len(encs) == 3
    # Most recent first
    assert encs[0]["chiefComplaint"] == "Encounter 3"
    assert encs[1]["chiefComplaint"] == "Encounter 2"
    assert encs[2]["chiefComplaint"] == "Encounter 1"


@pytest.mark.asyncio
async def test_get_active_encounter_by_booking(doctor_auth, test_session):
    """Encounter can be looked up directly by booking ID for reception handoff."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Active", last_name="Lookup", phone="3125559900", email="al@example.com"))
    b = await booking_repo.save(Booking(
        confirmation_id="BK-2026-ACTIVE",
        preferred_date=date.today(),
        preferred_time="4:00 PM",
        patient_full_name="Active Lookup",
        patient_phone="3125559900",
        patient_email="al@example.com",
        patient_id=p.id,
        team_member_id=tm_id,
        status="confirmed",
    ))
    await test_session.commit()

    # Create active encounter
    create_resp = await client.post(
        "/api/v1/doctor/encounters",
        json={"patientId": str(p.id), "bookingId": str(b.id), "status": "in_progress"},
        headers=headers,
    )
    enc_id = create_resp.json()["id"]

    # Lookup by booking ID
    resp = await client.get(f"/api/v1/doctor/encounters/by-booking/{b.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == enc_id
    assert resp.json()["bookingId"] == str(b.id)

