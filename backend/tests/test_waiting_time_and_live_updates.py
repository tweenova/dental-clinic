import pytest
from datetime import date
from uuid import uuid4
from app.domain.models.booking_crm import Booking, Patient
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository


@pytest.mark.asyncio
async def test_doctor_waiting_for_you_and_start_appointment(doctor_auth, receptionist_auth, test_session):
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]
    doc_team_member = doctor_auth["team_member"]

    rec_client = receptionist_auth["client"]
    rec_headers = receptionist_auth["headers"]

    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)

    # 1. Create Patient and Booking assigned to the doctor
    patient = Patient(
        first_name="Waiting",
        last_name="Patient",
        phone="5551234444",
        email="waiting@example.com",
    )
    saved_patient = await patient_repo.save(patient)

    booking = Booking(
        confirmation_id="BK-WAIT-001",
        preferred_date=date.today(),
        preferred_time="11:30 AM",
        patient_full_name="Waiting Patient",
        patient_phone="5551234444",
        patient_email="waiting@example.com",
        patient_id=saved_patient.id,
        team_member_id=doc_team_member.id,
        service_id="cleanings-exams",
        status="confirmed",
    )
    saved_booking = await booking_repo.save(booking)
    await test_session.commit()

    # 2. Reception checks in the patient (status -> arrived)
    rec_resp = await rec_client.patch(
        f"/api/v1/reception/appointments/{saved_booking.id}/status",
        json={"status": "arrived"},
        headers=rec_headers,
    )
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["status"] == "arrived"
    assert rec_data["arrivedAt"] is not None
    arrived_at_ts = rec_data["arrivedAt"]

    # 3. Doctor fetches schedule -> sees arrived patient with arrivedAt
    doc_sched_resp = await doc_client.get(
        f"/api/v1/doctor/schedule?target_date={date.today().isoformat()}",
        headers=doc_headers,
    )
    assert doc_sched_resp.status_code == 200
    sched_items = doc_sched_resp.json()
    arrived_item = next((b for b in sched_items if b["id"] == str(saved_booking.id)), None)
    assert arrived_item is not None
    assert arrived_item["status"] == "arrived"
    assert arrived_item["arrivedAt"] == arrived_at_ts
    assert arrived_item["startedAt"] is None

    # 4. Doctor starts the appointment via /doctor/appointments/{id}/start
    start_resp = await doc_client.post(
        f"/api/v1/doctor/appointments/{saved_booking.id}/start",
        headers=doc_headers,
    )
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    assert start_data["status"] == "in_progress"
    assert start_data["arrivedAt"] == arrived_at_ts
    assert start_data["startedAt"] is not None


@pytest.mark.asyncio
async def test_starting_encounter_auto_transitions_arrived_booking(doctor_auth, test_session):
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]
    doc_team_member = doctor_auth["team_member"]

    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)

    patient = Patient(
        first_name="Encounter",
        last_name="AutoStart",
        phone="5551235555",
        email="autostart@example.com",
    )
    saved_patient = await patient_repo.save(patient)

    booking = Booking(
        confirmation_id="BK-ENC-AUTO-001",
        preferred_date=date.today(),
        preferred_time="01:00 PM",
        patient_full_name="Encounter AutoStart",
        patient_phone="5551235555",
        patient_email="autostart@example.com",
        patient_id=saved_patient.id,
        team_member_id=doc_team_member.id,
        service_id="cleanings-exams",
        status="arrived",
    )
    saved_booking = await booking_repo.save(booking)
    await test_session.commit()

    # Create encounter for the arrived booking
    enc_payload = {
        "patientId": str(saved_patient.id),
        "bookingId": str(saved_booking.id),
        "chiefComplaint": "Routine checkup",
        "reasonForVisit": "Preventive Care",
        "status": "in_progress",
    }
    enc_resp = await doc_client.post(
        "/api/v1/doctor/encounters",
        json=enc_payload,
        headers=doc_headers,
    )
    assert enc_resp.status_code == 201

    # Verify the underlying booking moved to in_progress with started_at set
    updated_booking = await booking_repo.get_by_id(saved_booking.id)
    assert updated_booking is not None
    assert updated_booking.status == "in_progress"
    assert updated_booking.started_at is not None


@pytest.mark.asyncio
async def test_start_appointment_role_guards(receptionist_auth, doctor_auth, test_session):
    rec_client = receptionist_auth["client"]
    rec_headers = receptionist_auth["headers"]

    # Receptionist cannot call /doctor/appointments/{id}/start -> 403
    fake_id = uuid4()
    resp_rec = await rec_client.post(
        f"/api/v1/doctor/appointments/{fake_id}/start",
        headers=rec_headers,
    )
    assert resp_rec.status_code == 403
