import pytest
from datetime import date
from app.domain.models.booking_crm import Patient, Booking
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository


@pytest.mark.asyncio
async def test_doctor_patient_search_and_detail(doctor_auth, test_session):
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    # Seed a patient and a booking
    pat = Patient(
        first_name="Jane",
        last_name="Doe",
        phone="5551234567",
        email="jane.doe@example.com",
        date_of_birth=date(1990, 5, 15),
        notes="Allergic to penicillin.",
    )
    saved_pat = await patient_repo.save(pat)

    bk = Booking(
        confirmation_id="BK-DOC-001",
        preferred_date=date(2026, 10, 15),
        preferred_time="10:00 AM",
        patient_full_name="Jane Doe",
        patient_phone="5551234567",
        patient_email="jane.doe@example.com",
        patient_id=saved_pat.id,
        team_member_id=doctor_auth["team_member"].id,
        service_id="cleanings-exams",
        status="confirmed",
    )
    await booking_repo.save(bk)
    await test_session.commit()

    # 1. Search patients as doctor
    search_resp = await client.get("/api/v1/doctor/patients?q=Jane", headers=headers)
    assert search_resp.status_code == 200
    results = search_resp.json()
    assert len(results) >= 1
    found = next(p for p in results if p["id"] == str(saved_pat.id))
    assert found["firstName"] == "Jane"
    assert found["phone"] == "5551234567"

    # 2. Get patient detail as doctor
    detail_resp = await client.get(f"/api/v1/doctor/patients/{saved_pat.id}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == str(saved_pat.id)
    assert detail["fullName"] == "Jane Doe"
    assert len(detail["visits"]) >= 1
    assert detail["visits"][0]["bookingTime"] == "10:00 AM"


@pytest.mark.asyncio
async def test_doctor_cannot_access_reception_endpoints(doctor_auth):
    """Doctor role must strictly receive 403 on receptionist-only endpoints (least privilege)."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    dash_resp = await client.get("/api/v1/reception/dashboard", headers=headers)
    assert dash_resp.status_code == 403

    pat_resp = await client.get("/api/v1/reception/patients", headers=headers)
    assert pat_resp.status_code == 403

    msg_resp = await client.get("/api/v1/reception/messages", headers=headers)
    assert msg_resp.status_code == 403


@pytest.mark.asyncio
async def test_receptionist_cannot_access_doctor_patients(receptionist_auth):
    """Receptionist role must receive 403 on doctor clinical patient endpoints."""
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    resp = await client.get("/api/v1/doctor/patients", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_access_doctor_patients(admin_auth):
    """Clinic admin retains administrative oversight on doctor patient search."""
    client = admin_auth["client"]
    headers = admin_auth["headers"]

    resp = await client.get("/api/v1/doctor/patients", headers=headers)
    assert resp.status_code == 200
