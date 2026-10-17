import pytest
from datetime import date, datetime, timezone
from uuid import uuid4
from sqlalchemy import select

from app.domain.models.booking_crm import Booking, Patient
from app.domain.models.encounter import ClinicalEncounter
from app.infrastructure.database.orm_models import ActivityLogORM
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_encounter_repo import PostgresEncounterRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository


@pytest.mark.asyncio
async def test_unsigned_notes_list_and_updates_after_signing(doctor_auth, test_session):
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    user = doctor_auth["user"]

    patient_repo = PostgresPatientRepository(test_session)
    test_patient = Patient(
        first_name="George",
        last_name="Clark",
        phone="5551113333",
    )
    saved_patient = await patient_repo.save(test_patient)
    await test_session.commit()

    # Create encounter for doctor
    enc_payload = {
        "patientId": str(saved_patient.id),
        "status": "in_progress",
        "chiefComplaint": "Toothache lower right molar",
    }
    enc_resp = await client.post(
        "/api/v1/doctor/encounters",
        json=enc_payload,
        headers=headers,
    )
    assert enc_resp.status_code == 201
    encounter_id = enc_resp.json()["id"]

    # 1. Unsigned notes list should include this draft encounter
    unsigned_resp = await client.get("/api/v1/doctor/unsigned-notes", headers=headers)
    assert unsigned_resp.status_code == 200
    items = unsigned_resp.json()
    assert any(i["encounterId"] == encounter_id for i in items)
    matched = next(i for i in items if i["encounterId"] == encounter_id)
    assert matched["patientName"] == "George Clark"
    assert matched["chiefComplaint"] == "Toothache lower right molar"

    # 2. Save a draft note
    note_payload = {
        "subjective": "Severe pain on cold stimuli.",
        "objective": "Deep caries tooth #30.",
        "assessment": "Irreversible pulpitis #30.",
        "plan": "Root canal therapy recommended.",
    }
    draft_resp = await client.put(
        f"/api/v1/doctor/encounters/{encounter_id}/note/draft",
        json=note_payload,
        headers=headers,
    )
    assert draft_resp.status_code == 200
    assert draft_resp.json()["isSigned"] is False

    # Still unsigned
    unsigned_resp2 = await client.get("/api/v1/doctor/unsigned-notes", headers=headers)
    assert any(i["encounterId"] == encounter_id for i in unsigned_resp2.json())

    # 3. Sign the note
    sign_resp = await client.post(
        f"/api/v1/doctor/encounters/{encounter_id}/note/sign",
        headers=headers,
    )
    assert sign_resp.status_code == 200
    assert sign_resp.json()["isSigned"] is True

    # 4. Unsigned list should no longer contain this encounter!
    unsigned_resp3 = await client.get("/api/v1/doctor/unsigned-notes", headers=headers)
    assert not any(i["encounterId"] == encounter_id for i in unsigned_resp3.json())


@pytest.mark.asyncio
async def test_finish_visit_requires_encounter(doctor_auth, test_session):
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    user = doctor_auth["user"]

    booking_repo = PostgresBookingRepository(test_session)
    booking = Booking(
        confirmation_id="BK-NO-ENC",
        preferred_date=date.today(),
        preferred_time="11:00 AM",
        patient_full_name="Hannah Abbott",
        patient_phone="5552224444",
        patient_email="hannah@example.com",
        team_member_id=user.team_member_id,
        status="in_progress",
    )
    saved_booking = await booking_repo.save(booking)
    await test_session.commit()

    # Attempt to finish visit with no encounter
    finish_resp = await client.post(
        f"/api/v1/doctor/appointments/{saved_booking.id}/finish",
        json={},
        headers=headers,
    )
    assert finish_resp.status_code == 400
    assert "a clinical encounter must exist" in finish_resp.json()["detail"]


@pytest.mark.asyncio
async def test_finish_visit_completes_booking_and_sets_timestamp(doctor_auth, test_session):
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    user = doctor_auth["user"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    encounter_repo = PostgresEncounterRepository(test_session)

    patient = Patient(first_name="Ian", last_name="Malcolm", phone="5553335555")
    saved_patient = await patient_repo.save(patient)

    booking = Booking(
        confirmation_id="BK-FINISH-OK",
        preferred_date=date.today(),
        preferred_time="02:00 PM",
        patient_full_name="Ian Malcolm",
        patient_phone="5553335555",
        patient_email="ian@example.com",
        patient_id=saved_patient.id,
        team_member_id=user.team_member_id,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    )
    saved_booking = await booking_repo.save(booking)

    encounter = ClinicalEncounter(
        patient_id=saved_patient.id,
        clinician_id=user.team_member_id,
        booking_id=saved_booking.id,
        status="in_progress",
        chief_complaint="Routine checkup",
    )
    await encounter_repo.save(encounter)
    await test_session.commit()

    # Finish visit
    finish_resp = await client.post(
        f"/api/v1/doctor/appointments/{saved_booking.id}/finish",
        json={},
        headers=headers,
    )
    assert finish_resp.status_code == 200
    b_data = finish_resp.json()
    assert b_data["status"] == "completed"
    assert b_data["completedAt"] is not None


@pytest.mark.asyncio
async def test_unsigned_draft_does_not_block_finishing_and_remains_unsigned(
    doctor_auth, test_session
):
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    user = doctor_auth["user"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    encounter_repo = PostgresEncounterRepository(test_session)

    patient = Patient(first_name="Julia", last_name="Roberts", phone="5554446666")
    saved_patient = await patient_repo.save(patient)

    booking = Booking(
        confirmation_id="BK-FINISH-DRAFT",
        preferred_date=date.today(),
        preferred_time="03:00 PM",
        patient_full_name="Julia Roberts",
        patient_phone="5554446666",
        patient_email="julia@example.com",
        patient_id=saved_patient.id,
        team_member_id=user.team_member_id,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    )
    saved_booking = await booking_repo.save(booking)

    encounter = ClinicalEncounter(
        patient_id=saved_patient.id,
        clinician_id=user.team_member_id,
        booking_id=saved_booking.id,
        status="in_progress",
        chief_complaint="Scaling and root planing",
    )
    saved_enc = await encounter_repo.save(encounter)
    await test_session.commit()

    # Finish visit with unsigned draft note
    finish_resp = await client.post(
        f"/api/v1/doctor/appointments/{saved_booking.id}/finish",
        json={},
        headers=headers,
    )
    assert finish_resp.status_code == 200
    assert finish_resp.json()["status"] == "completed"

    # Unsigned notes list still has this draft encounter!
    unsigned_resp = await client.get("/api/v1/doctor/unsigned-notes", headers=headers)
    assert unsigned_resp.status_code == 200
    assert any(i["encounterId"] == str(saved_enc.id) for i in unsigned_resp.json())


@pytest.mark.asyncio
async def test_signed_note_immutable_cannot_edit_or_delete(doctor_auth, test_session):
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    user = doctor_auth["user"]

    patient_repo = PostgresPatientRepository(test_session)
    encounter_repo = PostgresEncounterRepository(test_session)

    patient = Patient(first_name="Kevin", last_name="Costner", phone="5555557777")
    saved_patient = await patient_repo.save(patient)

    encounter = ClinicalEncounter(
        patient_id=saved_patient.id,
        clinician_id=user.team_member_id,
        status="in_progress",
    )
    saved_enc = await encounter_repo.save(encounter)
    await test_session.commit()

    # Create draft
    await client.put(
        f"/api/v1/doctor/encounters/{saved_enc.id}/note/draft",
        json={"subjective": "Original note content"},
        headers=headers,
    )
    # Sign note
    sign_resp = await client.post(
        f"/api/v1/doctor/encounters/{saved_enc.id}/note/sign",
        headers=headers,
    )
    assert sign_resp.status_code == 200
    assert sign_resp.json()["isSigned"] is True

    # 1. Direct edit attempt must fail
    edit_resp = await client.put(
        f"/api/v1/doctor/encounters/{saved_enc.id}/note/draft",
        json={"subjective": "Overwriting signed note"},
        headers=headers,
    )
    assert edit_resp.status_code == 400
    assert "Signed clinical notes cannot be directly edited" in edit_resp.json()["detail"]

    # 2. DELETE endpoint does not exist
    del_resp = await client.delete(
        f"/api/v1/doctor/encounters/{saved_enc.id}/note",
        headers=headers,
    )
    assert del_resp.status_code in (404, 405)

    # 3. Amend creates revision 2 and preserves revision 1
    amend_resp = await client.post(
        f"/api/v1/doctor/encounters/{saved_enc.id}/note/amend",
        json={
            "amendmentReason": "Corrected diagnosis after radiographic review.",
            "subjective": "Original note content with amendment.",
        },
        headers=headers,
    )
    assert amend_resp.status_code == 200
    amended = amend_resp.json()
    assert amended["revisionNumber"] == 2
    assert amended["amendmentReason"] == "Corrected diagnosis after radiographic review."

    # Verify both revisions exist
    revs_resp = await client.get(
        f"/api/v1/doctor/encounters/{saved_enc.id}/note/revisions",
        headers=headers,
    )
    assert revs_resp.status_code == 200
    revs = revs_resp.json()
    assert len(revs) == 2
    rev_numbers = [r["revisionNumber"] for r in revs]
    assert 1 in rev_numbers and 2 in rev_numbers
