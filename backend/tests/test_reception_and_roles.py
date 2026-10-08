import pytest
from datetime import date, timedelta
from uuid import uuid4

from app.domain.models.booking_crm import Booking, Patient, Task, Lead
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository


@pytest.mark.asyncio
async def test_receptionist_cannot_access_admin_endpoints(receptionist_auth):
    """Receptionists must receive 403 Forbidden when attempting to access admin configuration."""
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    resp = await client.get("/api/v1/admin/organization", headers=headers)
    assert resp.status_code == 403
    assert "Access forbidden" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_doctor_cannot_access_admin_endpoints(doctor_auth):
    """Doctors must receive 403 Forbidden when attempting to access admin configuration."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    resp = await client.get("/api/v1/admin/organization", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_receptionist_dashboard_and_counts(receptionist_auth, test_session):
    """Receptionist can access dashboard and receives computed operational counts."""
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    booking_repo = PostgresBookingRepository(test_session)
    today = date.today()

    b1 = Booking(
        confirmation_id="BK-2026-TEST1",
        preferred_date=today,
        preferred_time="10:00 AM",
        patient_full_name="Alice Walker",
        patient_phone="3125550101",
        patient_email="alice@example.com",
        status="confirmed",
    )
    b2 = Booking(
        confirmation_id="BK-2026-TEST2",
        preferred_date=today,
        preferred_time="11:30 AM",
        patient_full_name="Bob Smith",
        patient_phone="3125550102",
        patient_email="bob@example.com",
        status="checked_in",
    )
    await booking_repo.save(b1)
    await booking_repo.save(b2)
    await test_session.commit()

    resp = await client.get("/api/v1/reception/dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["todayAppointments"] == 2
    assert data["confirmedCount"] == 1
    assert data["checkedInCount"] == 1
    assert len(data["todayFlow"]) == 2


@pytest.mark.asyncio
async def test_receptionist_appointment_lifecycle(receptionist_auth):
    """Tests creating, updating status, and rescheduling an appointment."""
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    # 1. Create appointment
    create_payload = {
        "patientFullName": "Charlie Davis",
        "patientPhone": "3125550103",
        "patientEmail": "charlie@example.com",
        "preferredDate": str(date.today() + timedelta(days=1)),
        "preferredTime": "10:00 AM",
        "serviceId": "cleanings-exams",
        "status": "confirmed",
    }
    resp = await client.post("/api/v1/reception/appointments", json=create_payload, headers=headers)
    assert resp.status_code == 201
    booking = resp.json()
    booking_id = booking["id"]
    assert booking["status"] == "confirmed"
    assert booking["patientFullName"] == "Charlie Davis"

    # 2. Check-in status update
    status_payload = {"status": "checked_in", "staffNotes": "Arrived 5 mins early."}
    resp2 = await client.patch(f"/api/v1/reception/appointments/{booking_id}/status", json=status_payload, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "checked_in"
    assert resp2.json()["staffNotes"] == "Arrived 5 mins early."

    # 3. Reschedule
    new_date = str(date.today() + timedelta(days=3))
    resched_payload = {"preferredDate": new_date, "preferredTime": "2:00 PM"}
    resp3 = await client.patch(f"/api/v1/reception/appointments/{booking_id}/reschedule", json=resched_payload, headers=headers)
    assert resp3.status_code == 200
    assert resp3.json()["preferredDate"] == new_date
    assert resp3.json()["preferredTime"] == "2:00 PM"


@pytest.mark.asyncio
async def test_receptionist_patient_search_and_deduplication(receptionist_auth, test_session):
    """Tests searching patients and duplicate detection on creation."""
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p1 = Patient(
        first_name="Diana",
        last_name="Prince",
        phone="3125550199",
        email="diana@example.com",
        date_of_birth=date(1990, 5, 20),
    )
    await patient_repo.save(p1)
    await test_session.commit()

    # Search
    resp = await client.get("/api/v1/reception/patients?query=Diana", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["firstName"] == "Diana"

    # Create duplicate check
    dup_payload = {
        "firstName": "Diana",
        "lastName": "Prince",
        "phone": "3125550199",
        "email": "diana@example.com",
    }
    resp_dup = await client.post("/api/v1/reception/patients?check_duplicates=true", json=dup_payload, headers=headers)
    assert resp_dup.status_code == 201
    assert resp_dup.json()["isDuplicate"] is True


@pytest.mark.asyncio
async def test_receptionist_tasks_and_leads(receptionist_auth):
    """Tests managing front-desk operational tasks and leads."""
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    # 1. Create task
    task_payload = {
        "title": "Call lab for crown delivery",
        "priority": "high",
        "status": "pending",
    }
    resp = await client.post("/api/v1/reception/tasks", json=task_payload, headers=headers)
    assert resp.status_code == 201
    task_id = resp.json()["id"]

    # 2. Update task
    resp2 = await client.patch(f"/api/v1/reception/tasks/{task_id}", json={"status": "completed"}, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "completed"

    # 3. Create and convert lead
    lead_payload = {
        "fullName": "Frank Castle",
        "phone": "3125550177",
        "email": "frank@example.com",
        "notes": "Interested in implant evaluation.",
    }
    resp_lead = await client.post("/api/v1/reception/leads", json=lead_payload, headers=headers)
    assert resp_lead.status_code == 201
    lead_id = resp_lead.json()["id"]

    # Convert lead to patient
    convert_payload = {"notes": "Converted via phone interview."}
    resp_conv = await client.post(f"/api/v1/reception/leads/{lead_id}/convert", json=convert_payload, headers=headers)
    assert resp_conv.status_code == 200
    assert resp_conv.json()["firstName"] == "Frank"
    assert resp_conv.json()["lastName"] == "Castle"


@pytest.mark.asyncio
async def test_doctor_schedule_and_notes(doctor_auth, test_session):
    """Tests doctor viewing their assigned appointments and updating clinical notes."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    booking_repo = PostgresBookingRepository(test_session)
    today = date.today()
    b = Booking(
        confirmation_id="BK-2026-DOC1",
        preferred_date=today,
        preferred_time="9:00 AM",
        patient_full_name="Grace Hopper",
        patient_phone="3125550188",
        patient_email="grace@example.com",
        status="confirmed",
    )
    saved = await booking_repo.save(b)
    await test_session.commit()

    # Schedule list
    resp = await client.get("/api/v1/doctor/schedule", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # Update note
    resp2 = await client.patch(
        f"/api/v1/doctor/appointments/{saved.id}/notes",
        json={"staffNotes": "Completed quadrant 1 scaling."},
        headers=headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["staffNotes"] == "Completed quadrant 1 scaling."
