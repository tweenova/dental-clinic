import pytest
import pytest_asyncio
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
        email="marcus.vance.soap@marlowdental.com",
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
        json={"email": "marcus.vance.soap@marlowdental.com", "password": "DoctorVance123!"},
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


@pytest.mark.asyncio
async def test_create_and_save_soap_draft(doctor_auth, test_session):
    """Doctor creates an encounter and saves a draft SOAP note with all 4 sections."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="John", last_name="Doe", phone="3125551234", email="jdoe@example.com"))
    await test_session.commit()

    # 1. Create encounter
    enc_resp = await client.post(
        "/api/v1/doctor/encounters",
        json={"patientId": str(p.id), "status": "in_progress"},
        headers=headers,
    )
    assert enc_resp.status_code == 201
    enc_id = enc_resp.json()["id"]

    # 2. Save SOAP draft
    soap_payload = {
        "subjective": "Patient reports sharp pain in lower right quadrant when drinking cold liquids for 3 days.",
        "objective": "Tooth #30 has visible disto-occlusal caries. Cold test positive with lingering pain (>10s). EPT 28.",
        "assessment": "Symptomatic irreversible pulpitis with symptomatic apical periodontitis #30.",
        "plan": "Recommended root canal therapy #30 followed by full coverage crown. Patient consented to initiate RCT today.",
    }
    draft_resp = await client.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json=soap_payload, headers=headers)
    assert draft_resp.status_code == 200
    note_data = draft_resp.json()

    assert note_data["encounterId"] == enc_id
    assert note_data["authorId"] == str(doc_tm_id)
    assert note_data["revisionNumber"] == 1
    assert note_data["isCurrent"] is True
    assert note_data["status"] == "draft"
    assert note_data["isSigned"] is False
    assert note_data["signedAt"] is None
    assert note_data["subjective"] == soap_payload["subjective"]
    assert note_data["objective"] == soap_payload["objective"]
    assert note_data["assessment"] == soap_payload["assessment"]
    assert note_data["plan"] == soap_payload["plan"]


@pytest.mark.asyncio
async def test_get_current_note_with_historical_staff_notes(doctor_auth, test_session):
    """Retrieving note for an encounter linked to a booking returns booking staff_notes for historical context."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Historical", last_name="Context", phone="3125559876", email="hc@example.com"))
    b = await booking_repo.save(Booking(
        confirmation_id="BK-2026-HIST",
        preferred_date=date.today(),
        preferred_time="11:00 AM",
        patient_full_name="Historical Context",
        patient_phone="3125559876",
        patient_email="hc@example.com",
        patient_id=p.id,
        team_member_id=doc_tm_id,
        staff_notes="Prior visit: completed scaling and root planing in upper left quadrant.",
        status="confirmed",
    ))
    await test_session.commit()

    # Create encounter with booking
    enc_resp = await client.post(
        "/api/v1/doctor/encounters",
        json={"patientId": str(p.id), "bookingId": str(b.id), "status": "in_progress"},
        headers=headers,
    )
    enc_id = enc_resp.json()["id"]

    # Save draft
    await client.put(
        f"/api/v1/doctor/encounters/{enc_id}/note/draft",
        json={"subjective": "Follow-up check."},
        headers=headers,
    )

    # Get current note
    get_resp = await client.get(f"/api/v1/doctor/encounters/{enc_id}/note", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["historicalStaffNotes"] == "Prior visit: completed scaling and root planing in upper left quadrant."


@pytest.mark.asyncio
async def test_update_draft_note_mutates_in_place(doctor_auth, test_session):
    """Saving updates to an active draft note updates the same revision record in-place."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Draft", last_name="Edit", phone="3125554321", email="de@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    # Save initial draft
    resp1 = await client.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "Initial notes."}, headers=headers)
    assert resp1.status_code == 200
    note_id = resp1.json()["id"]

    # Save second draft update
    resp2 = await client.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "Updated notes with more detail.", "assessment": "Mild gingivitis."}, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["id"] == note_id  # Same record ID
    assert resp2.json()["revisionNumber"] == 1
    assert resp2.json()["subjective"] == "Updated notes with more detail."
    assert resp2.json()["assessment"] == "Mild gingivitis."


@pytest.mark.asyncio
async def test_sign_soap_note_success(doctor_auth, test_session):
    """Doctor signs the SOAP draft; record becomes immutable with timestamp and signing identity."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Sign", last_name="Test", phone="3125555678", email="st@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    await client.put(
        f"/api/v1/doctor/encounters/{enc_id}/note/draft",
        json={"subjective": "Patient comfortable.", "plan": "Re-evaluate in 6 months."},
        headers=headers,
    )

    # Sign the note
    sign_resp = await client.post(f"/api/v1/doctor/encounters/{enc_id}/note/sign", headers=headers)
    assert sign_resp.status_code == 200
    signed_data = sign_resp.json()

    assert signed_data["status"] == "signed"
    assert signed_data["isSigned"] is True
    assert signed_data["signedAt"] is not None
    assert signed_data["signedById"] == str(doc_tm_id)


@pytest.mark.asyncio
async def test_direct_edit_to_signed_note_rejected(doctor_auth, test_session):
    """Attempting to modify a signed note via PUT /draft is rejected with 400 Bad Request."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Locked", last_name="Note", phone="3125556789", email="ln@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    await client.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "Original note."}, headers=headers)
    await client.post(f"/api/v1/doctor/encounters/{enc_id}/note/sign", headers=headers)

    # Attempt direct edit
    edit_resp = await client.put(
        f"/api/v1/doctor/encounters/{enc_id}/note/draft",
        json={"subjective": "Modified note after sign."},
        headers=headers,
    )
    assert edit_resp.status_code == 400
    assert "Signed clinical notes cannot be directly edited" in edit_resp.json()["detail"]


@pytest.mark.asyncio
async def test_amend_signed_note_creates_immutable_revision(doctor_auth, test_session):
    """Amending a signed note creates a new revision with reason, while preserving original version."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Amend", last_name="Patient", phone="3125557890", email="ap@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    # Revision 1
    await client.put(
        f"/api/v1/doctor/encounters/{enc_id}/note/draft",
        json={"subjective": "Patient reports pain #14.", "assessment": "Irreversible pulpitis #14."},
        headers=headers,
    )
    await client.post(f"/api/v1/doctor/encounters/{enc_id}/note/sign", headers=headers)

    # Create Amendment (Revision 2)
    amend_payload = {
        "amendmentReason": "Corrected tooth number typo from #14 to #15 following radiograph verification.",
        "subjective": "Patient reports pain #15.",
        "assessment": "Irreversible pulpitis #15.",
        "plan": "RCT #15.",
    }
    amend_resp = await client.post(f"/api/v1/doctor/encounters/{enc_id}/note/amend", json=amend_payload, headers=headers)
    assert amend_resp.status_code == 200
    rev2 = amend_resp.json()

    assert rev2["revisionNumber"] == 2
    assert rev2["isCurrent"] is True
    assert rev2["status"] == "signed"
    assert rev2["isSigned"] is True
    assert rev2["signedById"] == str(doc_tm_id)
    assert rev2["amendmentReason"] == amend_payload["amendmentReason"]
    assert rev2["subjective"] == "Patient reports pain #15."

    # Verify revision history has both versions
    rev_resp = await client.get(f"/api/v1/doctor/encounters/{enc_id}/note/revisions", headers=headers)
    assert rev_resp.status_code == 200
    revisions = rev_resp.json()
    assert len(revisions) == 2

    # Revision 1 is archived as amended
    assert revisions[0]["revisionNumber"] == 1
    assert revisions[0]["status"] == "amended"
    assert revisions[0]["isCurrent"] is False
    assert revisions[0]["subjective"] == "Patient reports pain #14."

    # Revision 2 is current signed version
    assert revisions[1]["revisionNumber"] == 2
    assert revisions[1]["status"] == "signed"
    assert revisions[1]["isCurrent"] is True


@pytest.mark.asyncio
async def test_amend_unsigned_draft_rejected(doctor_auth, test_session):
    """Attempting to amend an unsigned draft returns 400 Bad Request."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Unsigned", last_name="Draft", phone="3125558901", email="ud@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    await client.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "Draft only."}, headers=headers)

    amend_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/note/amend",
        json={"amendmentReason": "Cannot amend draft."},
        headers=headers,
    )
    assert amend_resp.status_code == 400
    assert "Cannot amend an unsigned draft" in amend_resp.json()["detail"]


@pytest.mark.asyncio
async def test_cross_clinician_soap_note_access_forbidden(doctor_auth, secondary_doctor_auth, test_session):
    """Doctor B cannot view, save, sign, or amend Doctor A's encounter note (403 Forbidden)."""
    client1 = doctor_auth["client"]
    headers1 = doctor_auth["headers"]
    client2 = secondary_doctor_auth["client"]
    headers2 = secondary_doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Strict", last_name="Isolation", phone="3125559012", email="si@example.com"))
    await test_session.commit()

    enc_resp = await client1.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers1)
    enc_id = enc_resp.json()["id"]

    await client1.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "Confidential observation."}, headers=headers1)

    # Doctor 2 GET -> 403
    resp_get = await client2.get(f"/api/v1/doctor/encounters/{enc_id}/note", headers=headers2)
    assert resp_get.status_code == 403
    assert "not authorized to view this encounter's clinical notes" in resp_get.json()["detail"]

    # Doctor 2 PUT draft -> 403
    resp_put = await client2.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "Malicious edit."}, headers=headers2)
    assert resp_put.status_code == 403
    assert "cannot modify notes for another clinician's encounter" in resp_put.json()["detail"]

    # Doctor 2 Sign -> 403
    resp_sign = await client2.post(f"/api/v1/doctor/encounters/{enc_id}/note/sign", headers=headers2)
    assert resp_sign.status_code == 403

    # Doctor 2 Amend -> 403
    resp_amend = await client2.post(f"/api/v1/doctor/encounters/{enc_id}/note/amend", json={"amendmentReason": "Unauthorized amend."}, headers=headers2)
    assert resp_amend.status_code == 403


@pytest.mark.asyncio
async def test_admin_oversight_note_access(admin_auth, doctor_auth, test_session):
    """Admin has oversight access to view notes and revision history across clinicians."""
    client_admin = admin_auth["client"]
    headers_admin = admin_auth["headers"]
    client_doc = doctor_auth["client"]
    headers_doc = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Admin", last_name="Inspection", phone="3125550123", email="ai@example.com"))
    await test_session.commit()

    enc_resp = await client_doc.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers_doc)
    enc_id = enc_resp.json()["id"]

    await client_doc.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "Doctor note content."}, headers=headers_doc)

    # Admin reads note
    admin_get = await client_admin.get(f"/api/v1/doctor/encounters/{enc_id}/note", headers=headers_admin)
    assert admin_get.status_code == 200
    assert admin_get.json()["subjective"] == "Doctor note content."

    # Admin reads revisions
    admin_rev = await client_admin.get(f"/api/v1/doctor/encounters/{enc_id}/note/revisions", headers=headers_admin)
    assert admin_rev.status_code == 200
    assert len(admin_rev.json()) == 1


@pytest.mark.asyncio
async def test_cross_clinic_soap_note_access_forbidden(test_session, client_with_db):
    """Doctor from Clinic A cannot view, save, or amend notes for an encounter in Clinic B (403 Forbidden)."""
    clinic_a_id = uuid4()
    clinic_b_id = uuid4()

    team_repo = PostgresTeamMemberRepository(test_session)
    user_repo = PostgresUserRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)
    encounter_repo = PostgresEncounterRepository(test_session)

    # Doctor A in Clinic A
    doc_tm_a = await team_repo.save(TeamMember(
        organization_id=uuid4(),
        first_name="Doctor",
        last_name="Alpha",
        display_name="Dr. Alpha",
        professional_title="Dentist",
        role="Doctor",
        is_active=True,
    ))
    doc_user_a = await user_repo.save(User(
        email="dr.alpha@marlowdental.com",
        hashed_password=hash_password("DoctorAlpha123!"),
        full_name="Dr. Alpha",
        role=UserRole.DOCTOR,
        clinic_id=clinic_a_id,
        team_member_id=doc_tm_a.id,
        is_active=True,
    ))

    # Patient & Encounter in Clinic B
    patient_b = await patient_repo.save(Patient(
        first_name="Beta",
        last_name="Patient",
        phone="3125550099",
        email="bp@example.com",
    ))
    encounter_b = await encounter_repo.save(ClinicalEncounter(
        patient_id=patient_b.id,
        clinician_id=doc_tm_a.id,  # Even if clinician ID matches, clinic tenant boundary blocks access
        clinic_id=clinic_b_id,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    ))
    await test_session.commit()

    # Login as Doctor Alpha (Clinic A)
    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "dr.alpha@marlowdental.com", "password": "DoctorAlpha123!"},
    )
    assert resp.status_code == 200
    headers_a = {"Authorization": f"Bearer {resp.json()['accessToken']}"}

    # Attempt GET note -> 403 Forbidden
    resp_get = await client_with_db.get(f"/api/v1/doctor/encounters/{encounter_b.id}/note", headers=headers_a)
    assert resp_get.status_code == 403
    assert "cannot access encounters belonging to another clinic" in resp_get.json()["detail"]

    # Attempt PUT draft -> 403 Forbidden
    resp_put = await client_with_db.put(
        f"/api/v1/doctor/encounters/{encounter_b.id}/note/draft",
        json={"subjective": "Unauthorized cross-clinic draft."},
        headers=headers_a,
    )
    assert resp_put.status_code == 403
    assert "cannot access encounters belonging to another clinic" in resp_put.json()["detail"]


@pytest.mark.asyncio
async def test_activity_audit_logs_recorded_for_soap_actions(doctor_auth, test_session):
    """Clinical note lifecycle actions append structured audit logs with PHI scrubbed."""
    from sqlalchemy import select
    from app.infrastructure.database.orm_models import ActivityLogORM

    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_user_id = doctor_auth["user"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Audit", last_name="Trail", phone="3125557766", email="at@example.com"))
    await test_session.commit()

    # 1. Create Encounter
    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    # 2. Draft Created
    draft1 = await client.put(
        f"/api/v1/doctor/encounters/{enc_id}/note/draft",
        json={"subjective": "Confidential patient symptom A."},
        headers=headers,
    )
    assert draft1.status_code == 200

    # 3. Draft Updated
    draft2 = await client.put(
        f"/api/v1/doctor/encounters/{enc_id}/note/draft",
        json={"subjective": "Confidential patient symptom A updated.", "assessment": "Clinical diagnosis B."},
        headers=headers,
    )
    assert draft2.status_code == 200

    # 4. Sign Note
    sign_resp = await client.post(f"/api/v1/doctor/encounters/{enc_id}/note/sign", headers=headers)
    assert sign_resp.status_code == 200

    # 5. Amend Note
    amend_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/note/amend",
        json={
            "amendmentReason": "Administrative correction for record clarity.",
            "subjective": "Revised confidential note.",
        },
        headers=headers,
    )
    assert amend_resp.status_code == 200

    # Query ActivityLogORM
    stmt = (
        select(ActivityLogORM)
        .where(ActivityLogORM.entity_type == "clinical_note")
        .order_by(ActivityLogORM.created_at.asc())
    )
    res = await test_session.execute(stmt)
    logs = res.scalars().all()

    actions = [log.action for log in logs]
    assert "clinical_note.draft_created" in actions
    assert "clinical_note.draft_updated" in actions
    assert "clinical_note.signed" in actions
    assert "clinical_note.amended" in actions

    for log in logs:
        assert log.user_id == doc_user_id
        assert log.details_json is not None
        # Verify PHI text is scrubbed from audit details
        assert "Confidential patient symptom" not in log.details_json
        assert "Clinical diagnosis B" not in log.details_json


@pytest.mark.asyncio
async def test_multiple_amendments_and_partial_unique_index(doctor_auth, test_session):
    """Multiple sequential amendments maintain revision chain with exactly one current version."""
    from sqlalchemy import select
    from app.infrastructure.database.orm_models import ClinicalNoteORM
    from uuid import UUID

    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Multi", last_name="Amend", phone="3125554433", email="ma@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    # Rev 1: Create draft and sign
    await client.put(f"/api/v1/doctor/encounters/{enc_id}/note/draft", json={"subjective": "V1 note."}, headers=headers)
    await client.post(f"/api/v1/doctor/encounters/{enc_id}/note/sign", headers=headers)

    # Rev 2: First amendment
    await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/note/amend",
        json={"amendmentReason": "First correction.", "subjective": "V2 note."},
        headers=headers,
    )

    # Rev 3: Second amendment
    await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/note/amend",
        json={"amendmentReason": "Second correction.", "subjective": "V3 note."},
        headers=headers,
    )

    # Verify revisions endpoint returns all 3 in ascending order
    rev_resp = await client.get(f"/api/v1/doctor/encounters/{enc_id}/note/revisions", headers=headers)
    assert rev_resp.status_code == 200
    revisions = rev_resp.json()
    assert len(revisions) == 3

    assert revisions[0]["revisionNumber"] == 1
    assert revisions[0]["status"] == "amended"
    assert revisions[0]["isCurrent"] is False

    assert revisions[1]["revisionNumber"] == 2
    assert revisions[1]["status"] == "amended"
    assert revisions[1]["isCurrent"] is False

    assert revisions[2]["revisionNumber"] == 3
    assert revisions[2]["status"] == "signed"
    assert revisions[2]["isCurrent"] is True
    assert revisions[2]["subjective"] == "V3 note."

    # Direct database query verifying partial unique condition: only 1 row is_current = True
    stmt = (
        select(ClinicalNoteORM)
        .where(ClinicalNoteORM.encounter_id == UUID(enc_id))
        .where(ClinicalNoteORM.is_current == True)
    )
    res = await test_session.execute(stmt)
    current_notes = res.scalars().all()
    assert len(current_notes) == 1
    assert current_notes[0].revision_number == 3

