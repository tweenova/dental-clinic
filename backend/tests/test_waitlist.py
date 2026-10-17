import pytest
from datetime import date
from uuid import uuid4
from app.domain.models.booking_crm import Booking
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository


@pytest.mark.asyncio
async def test_create_waitlist_booking_and_list_on_waitlist(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    today = date.today()
    payload = {
        "patientFullName": "Waitlist Hopeful",
        "patientPhone": "5558881234",
        "patientEmail": "hopeful@example.com",
        "preferredDate": today.isoformat(),
        "preferredTime": "09:00 AM",
        "status": "waitlist",
        "notes": "Preferred days: Tuesdays & Thursdays | Note: Urgent consultation",
    }

    # 1. Create booking with status=waitlist
    create_res = await client.post("/api/v1/reception/appointments", json=payload, headers=headers)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["status"] == "waitlist"
    assert created["patientFullName"] == "Waitlist Hopeful"

    # 2. Verify patient appears on GET /api/v1/reception/waitlist
    waitlist_res = await client.get("/api/v1/reception/waitlist", headers=headers)
    assert waitlist_res.status_code == 200
    items = waitlist_res.json()
    matched = [item for item in items if item["id"] == created["id"]]
    assert len(matched) == 1
    assert matched[0]["status"] == "waitlist"
    assert "Tuesdays & Thursdays" in (matched[0]["notes"] or "")


@pytest.mark.asyncio
async def test_move_existing_booking_to_waitlist(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    booking_repo = PostgresBookingRepository(test_session)

    today = date.today()
    initial_booking = Booking(
        confirmation_id="BK-MOVE-WL-01",
        preferred_date=today,
        preferred_time="02:00 PM",
        patient_full_name="Flexible Patient",
        patient_phone="5557779999",
        patient_email="flexible@example.com",
        status="confirmed",
    )
    saved = await booking_repo.save(initial_booking)
    await test_session.commit()

    # Move to waitlist via status transition endpoint
    patch_res = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "waitlist"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "waitlist"

    # Check that patient now appears on the waitlist
    wl_res = await client.get("/api/v1/reception/waitlist", headers=headers)
    assert wl_res.status_code == 200
    items = wl_res.json()
    matched = [item for item in items if item["id"] == str(saved.id)]
    assert len(matched) == 1
    assert matched[0]["status"] == "waitlist"
