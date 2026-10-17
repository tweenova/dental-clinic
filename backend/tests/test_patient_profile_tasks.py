import pytest
from datetime import date
from app.domain.models.booking_crm import Patient, Booking
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository


@pytest.mark.asyncio
async def test_patient_profile_tasks_and_messages_linking(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    # 1. Create Patient A
    pat_a = Patient(
        first_name="Alice",
        last_name="Smith",
        phone="5550001111",
        email="alice@example.com",
        date_of_birth=date(1985, 3, 20),
    )
    saved_pat_a = await patient_repo.save(pat_a)

    # 2. Create Patient B (unrelated)
    pat_b = Patient(
        first_name="Bob",
        last_name="Jones",
        phone="5550002222",
        email="bob@example.com",
        date_of_birth=date(1975, 8, 10),
    )
    saved_pat_b = await patient_repo.save(pat_b)

    # 3. Create a Booking for Patient A
    bk_a = Booking(
        confirmation_id="BK-ALICE-01",
        preferred_date=date(2026, 10, 20),
        preferred_time="09:00 AM",
        patient_full_name="Alice Smith",
        patient_phone="5550001111",
        patient_email="alice@example.com",
        patient_id=saved_pat_a.id,
        service_id="cleanings-exams",
        status="confirmed",
    )
    saved_bk_a = await booking_repo.save(bk_a)
    await test_session.commit()

    # 4. Create Task 1 directly linked to Patient A
    task1_payload = {
        "title": "Call Alice regarding appointment confirmation",
        "description": "Verify visit preparation details",
        "priority": "high",
        "patientId": str(saved_pat_a.id),
    }
    t1_resp = await client.post("/api/v1/reception/tasks", json=task1_payload, headers=headers)
    assert t1_resp.status_code == 201
    t1_data = t1_resp.json()
    assert t1_data["patientId"] == str(saved_pat_a.id)

    # 5. Create Task 2 linked to Patient A's Booking
    task2_payload = {
        "title": "Prepare room for Alice visit",
        "priority": "medium",
        "bookingId": str(saved_bk_a.id),
    }
    t2_resp = await client.post("/api/v1/reception/tasks", json=task2_payload, headers=headers)
    assert t2_resp.status_code == 201
    t2_data = t2_resp.json()
    assert t2_data["bookingId"] == str(saved_bk_a.id)

    # 6. Create Task 3 linked to Patient B (must NOT appear on Patient A)
    task3_payload = {
        "title": "Send invoice to Bob",
        "patientId": str(saved_pat_b.id),
    }
    t3_resp = await client.post("/api/v1/reception/tasks", json=task3_payload, headers=headers)
    assert t3_resp.status_code == 201
    t3_data = t3_resp.json()

    # 7. Create a message linked to Patient A
    msg_payload = {
        "channel": "internal_note",
        "recipient": "Alice Smith",
        "content": "Patient prefers afternoon appointments",
        "patientId": str(saved_pat_a.id),
    }
    m_resp = await client.post("/api/v1/reception/messages", json=msg_payload, headers=headers)
    assert m_resp.status_code == 201
    m_data = m_resp.json()
    assert m_data["patientId"] == str(saved_pat_a.id)

    # 8. Query Patient A's profile
    prof_resp = await client.get(f"/api/v1/reception/patients/{saved_pat_a.id}", headers=headers)
    assert prof_resp.status_code == 200
    prof = prof_resp.json()

    # Verify task link counts & items
    assert len(prof["tasks"]) == 2
    task_ids = [t["id"] for t in prof["tasks"]]
    assert t1_data["id"] in task_ids
    assert t2_data["id"] in task_ids
    assert t3_data["id"] not in task_ids

    # Verify messages
    assert len(prof["messages"]) == 1
    assert prof["messages"][0]["id"] == m_data["id"]
