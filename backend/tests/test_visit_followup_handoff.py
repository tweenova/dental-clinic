import pytest
from datetime import date, datetime, timezone
from uuid import uuid4

from app.domain.models.booking_crm import Booking, Patient
from app.domain.models.encounter import ClinicalEncounter
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_encounter_repo import PostgresEncounterRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository


@pytest.mark.asyncio
async def test_finish_visit_with_followup_creates_linked_reception_task(doctor_auth, receptionist_auth, test_session):
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]
    doc_user = doctor_auth["user"]

    rec_client = receptionist_auth["client"]
    rec_headers = receptionist_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    enc_repo = PostgresEncounterRepository(test_session)
    task_repo = PostgresTaskRepository(test_session)

    # 1. Create Patient
    patient = Patient(
        first_name="Eleanor",
        last_name="Vane",
        phone="5558889999",
    )
    saved_patient = await patient_repo.save(patient)

    # 2. Create Booking for doctor
    booking = Booking(
        confirmation_id="BK-FOL-1",
        patient_id=saved_patient.id,
        patient_full_name="Eleanor Vane",
        patient_phone="5558889999",
        patient_email="eleanor@example.com",
        preferred_date=date.today(),
        preferred_time="10:00 AM",
        status="in_progress",
        team_member_id=doc_user.team_member_id,
    )
    saved_booking = await booking_repo.save(booking)

    # 3. Create Encounter linked to booking
    encounter = ClinicalEncounter(
        patient_id=saved_patient.id,
        booking_id=saved_booking.id,
        clinician_id=doc_user.team_member_id,
        chief_complaint="Post-op checkup",
        status="in_progress",
    )
    await enc_repo.save(encounter)
    await test_session.commit()

    # Pre-check task count
    existing_tasks = await task_repo.get_patient_tasks(saved_patient.id)
    assert len(existing_tasks) == 0

    # 4. Finish visit with follow-up in 2 weeks
    finish_payload = {
        "followUpWeeks": 2,
        "followUpNote": "Suture removal and evaluate tissue healing",
    }
    resp = await doc_client.post(
        f"/api/v1/doctor/appointments/{saved_booking.id}/finish",
        json=finish_payload,
        headers=doc_headers,
    )
    assert resp.status_code == 200, resp.text
    booking_data = resp.json()
    assert booking_data["status"] == "completed"
    assert booking_data["completedAt"] is not None

    # 5. Assert exactly one linked task was created
    patient_tasks = await task_repo.get_patient_tasks(saved_patient.id)
    assert len(patient_tasks) == 1
    followup_task = patient_tasks[0]
    assert followup_task.patient_id == saved_patient.id
    assert followup_task.booking_id == saved_booking.id
    assert followup_task.title == "Book follow-up: Eleanor Vane in 2 weeks"
    assert followup_task.description == "Suture removal and evaluate tissue healing"
    assert followup_task.priority == "high"
    assert followup_task.status == "pending"
    assert followup_task.due_date is not None

    # 6. Verify task appears on patient profile endpoint (/api/v1/reception/patients/{id})
    profile_resp = await rec_client.get(
        f"/api/v1/reception/patients/{saved_patient.id}",
        headers=rec_headers,
    )
    assert profile_resp.status_code == 200
    profile_data = profile_resp.json()
    assert len(profile_data["tasks"]) == 1
    assert profile_data["tasks"][0]["title"] == "Book follow-up: Eleanor Vane in 2 weeks"

    # 7. Verify task appears in reception dashboard needs_attention queue (/api/v1/reception/dashboard)
    dash_resp = await rec_client.get(
        "/api/v1/reception/dashboard",
        headers=rec_headers,
    )
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    needs_attention_titles = [t["title"] for t in dash_data.get("needsAttentionItems", [])]
    assert any("Book follow-up: Eleanor Vane in 2 weeks" in t for t in needs_attention_titles)


@pytest.mark.asyncio
async def test_finish_visit_without_followup_creates_no_tasks(doctor_auth, test_session):
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]
    doc_user = doctor_auth["user"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    enc_repo = PostgresEncounterRepository(test_session)
    task_repo = PostgresTaskRepository(test_session)

    # 1. Create Patient
    patient = Patient(
        first_name="Marcus",
        last_name="Flint",
        phone="5557776666",
    )
    saved_patient = await patient_repo.save(patient)

    # 2. Create Booking for doctor
    booking = Booking(
        confirmation_id="BK-NO-FOL",
        patient_id=saved_patient.id,
        patient_full_name="Marcus Flint",
        patient_phone="5557776666",
        patient_email="marcus@example.com",
        preferred_date=date.today(),
        preferred_time="11:00 AM",
        status="in_progress",
        team_member_id=doc_user.team_member_id,
    )
    saved_booking = await booking_repo.save(booking)

    # 3. Create Encounter linked to booking
    encounter = ClinicalEncounter(
        patient_id=saved_patient.id,
        booking_id=saved_booking.id,
        clinician_id=doc_user.team_member_id,
        chief_complaint="Routine scaling and polish",
        status="in_progress",
    )
    await enc_repo.save(encounter)
    await test_session.commit()

    # 4. Finish visit WITHOUT follow-up
    resp = await doc_client.post(
        f"/api/v1/doctor/appointments/{saved_booking.id}/finish",
        json={},
        headers=doc_headers,
    )
    assert resp.status_code == 200, resp.text
    booking_data = resp.json()
    assert booking_data["status"] == "completed"

    # 5. Assert zero tasks were created
    patient_tasks = await task_repo.get_patient_tasks(saved_patient.id)
    assert len(patient_tasks) == 0
