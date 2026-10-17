import pytest
from datetime import date
from uuid import uuid4
from sqlalchemy import select
from app.domain.models.booking_crm import Booking
from app.infrastructure.database.orm_models import ActivityLogORM
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository


@pytest.mark.asyncio
async def test_double_booking_rejected_with_409(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    booking_repo = PostgresBookingRepository(test_session)

    team_member_id = uuid4()
    today = date.today()

    # Create initial booking for 10:00 AM (default 30 min duration -> 10:00 to 10:30)
    initial_booking = Booking(
        confirmation_id="BK-DB-001",
        preferred_date=today,
        preferred_time="10:00 AM",
        patient_full_name="Patient One",
        patient_phone="5551112222",
        patient_email="one@example.com",
        team_member_id=team_member_id,
        status="confirmed",
    )
    await booking_repo.save(initial_booking)
    await test_session.commit()

    # Attempt to create conflicting booking at 10:15 AM without override
    payload = {
        "patientFullName": "Patient Two",
        "patientPhone": "5552223333",
        "patientEmail": "two@example.com",
        "preferredDate": today.isoformat(),
        "preferredTime": "10:15 AM",
        "teamMemberId": str(team_member_id),
        "status": "confirmed",
    }
    r = await client.post("/api/v1/reception/appointments", json=payload, headers=headers)
    assert r.status_code == 409
    assert "Double-booking conflict" in r.json()["detail"]
    assert "10:00 AM" in r.json()["detail"]


@pytest.mark.asyncio
async def test_double_booking_override_requires_reason(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    booking_repo = PostgresBookingRepository(test_session)

    team_member_id = uuid4()
    today = date.today()

    initial_booking = Booking(
        confirmation_id="BK-DB-002",
        preferred_date=today,
        preferred_time="11:00 AM",
        patient_full_name="Existing Patient",
        patient_phone="5551113333",
        patient_email="existing@example.com",
        team_member_id=team_member_id,
        status="confirmed",
    )
    await booking_repo.save(initial_booking)
    await test_session.commit()

    # Attempt with overrideDoubleBooking=True but missing/empty overrideReason -> 422
    payload = {
        "patientFullName": "Overlap Patient",
        "patientPhone": "5553334444",
        "patientEmail": "overlap@example.com",
        "preferredDate": today.isoformat(),
        "preferredTime": "11:00 AM",
        "teamMemberId": str(team_member_id),
        "status": "confirmed",
        "overrideDoubleBooking": True,
        "overrideReason": "   ",
    }
    r = await client.post("/api/v1/reception/appointments", json=payload, headers=headers)
    assert r.status_code == 422
    assert "Override reason is required" in r.json()["detail"]


@pytest.mark.asyncio
async def test_double_booking_override_succeeds_and_logs_activity(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    booking_repo = PostgresBookingRepository(test_session)

    team_member_id = uuid4()
    today = date.today()

    initial_booking = Booking(
        confirmation_id="BK-DB-003",
        preferred_date=today,
        preferred_time="02:00 PM",
        patient_full_name="First Patient",
        patient_phone="5554445555",
        patient_email="first@example.com",
        team_member_id=team_member_id,
        status="confirmed",
    )
    await booking_repo.save(initial_booking)
    await test_session.commit()

    # Attempt with overrideDoubleBooking=True and valid overrideReason -> 201 Created
    payload = {
        "patientFullName": "Second Patient",
        "patientPhone": "5555556666",
        "patientEmail": "second@example.com",
        "preferredDate": today.isoformat(),
        "preferredTime": "02:15 PM",
        "teamMemberId": str(team_member_id),
        "status": "confirmed",
        "overrideDoubleBooking": True,
        "overrideReason": "Emergency toothache fit-in approved by Dr.",
    }
    r = await client.post("/api/v1/reception/appointments", json=payload, headers=headers)
    assert r.status_code == 201
    created_id = r.json()["id"]

    # Verify audit log was created
    stmt = select(ActivityLogORM).where(
        ActivityLogORM.action == "override_double_booking",
        ActivityLogORM.entity_id == created_id,
    )
    result = await test_session.execute(stmt)
    log_entry = result.scalar_one_or_none()
    assert log_entry is not None
    assert "Emergency toothache fit-in" in log_entry.details_json


@pytest.mark.asyncio
async def test_cancelled_no_show_waitlist_do_not_block(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    booking_repo = PostgresBookingRepository(test_session)

    team_member_id = uuid4()
    today = date.today()

    # Create bookings with cancelled, no_show, and waitlist
    b_cancelled = Booking(
        confirmation_id="BK-DB-CAN",
        preferred_date=today,
        preferred_time="09:00 AM",
        patient_full_name="Cancelled Patient",
        patient_phone="5550001111",
        patient_email="can@example.com",
        team_member_id=team_member_id,
        status="cancelled",
    )
    b_noshow = Booking(
        confirmation_id="BK-DB-NS",
        preferred_date=today,
        preferred_time="09:30 AM",
        patient_full_name="No Show Patient",
        patient_phone="5550002222",
        patient_email="ns@example.com",
        team_member_id=team_member_id,
        status="no_show",
    )
    b_waitlist = Booking(
        confirmation_id="BK-DB-WL",
        preferred_date=today,
        preferred_time="10:00 AM",
        patient_full_name="Waitlist Patient",
        patient_phone="5550003333",
        patient_email="wl@example.com",
        team_member_id=team_member_id,
        status="waitlist",
    )
    await booking_repo.save(b_cancelled)
    await booking_repo.save(b_noshow)
    await booking_repo.save(b_waitlist)
    await test_session.commit()

    # New bookings at these exact times must succeed without override
    times = ["09:00 AM", "09:30 AM", "10:00 AM"]
    for idx, t in enumerate(times):
        payload = {
            "patientFullName": f"Active Patient {idx}",
            "patientPhone": f"555999888{idx}",
            "patientEmail": f"act{idx}@example.com",
            "preferredDate": today.isoformat(),
            "preferredTime": t,
            "teamMemberId": str(team_member_id),
            "status": "confirmed",
        }
        r = await client.post("/api/v1/reception/appointments", json=payload, headers=headers)
        assert r.status_code == 201, f"Failed at {t}: {r.text}"


@pytest.mark.asyncio
async def test_reschedule_double_booking_prevention(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    booking_repo = PostgresBookingRepository(test_session)

    team_member_id = uuid4()
    today = date.today()

    b1 = Booking(
        confirmation_id="BK-RE-001",
        preferred_date=today,
        preferred_time="11:00 AM",
        patient_full_name="Booking One",
        patient_phone="5551110001",
        patient_email="b1@example.com",
        team_member_id=team_member_id,
        status="confirmed",
    )
    b2 = Booking(
        confirmation_id="BK-RE-002",
        preferred_date=today,
        preferred_time="03:00 PM",
        patient_full_name="Booking Two",
        patient_phone="5551110002",
        patient_email="b2@example.com",
        team_member_id=team_member_id,
        status="confirmed",
    )
    s1 = await booking_repo.save(b1)
    s2 = await booking_repo.save(b2)
    await test_session.commit()

    # Rescheduling b2 to 11:15 AM (overlaps b1) without override -> 409
    resched_payload = {
        "preferredDate": today.isoformat(),
        "preferredTime": "11:15 AM",
        "teamMemberId": str(team_member_id),
    }
    r = await client.patch(f"/api/v1/reception/appointments/{s2.id}/reschedule", json=resched_payload, headers=headers)
    assert r.status_code == 409
    assert "Double-booking conflict" in r.json()["detail"]

    # Rescheduling b2 to 11:15 AM with override -> 200 OK
    resched_override = {
        "preferredDate": today.isoformat(),
        "preferredTime": "11:15 AM",
        "teamMemberId": str(team_member_id),
        "overrideDoubleBooking": True,
        "overrideReason": "Doctor requested immediate double-slot",
    }
    r_ok = await client.patch(f"/api/v1/reception/appointments/{s2.id}/reschedule", json=resched_override, headers=headers)
    assert r_ok.status_code == 200
    assert r_ok.json()["preferredTime"] == "11:15 AM"


@pytest.mark.asyncio
async def test_concurrent_double_booking_race_safety(receptionist_auth, test_session):
    import asyncio
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    team_member_id = uuid4()
    today = date.today()

    payload_1 = {
        "patientFullName": "Concurrent Patient A",
        "patientPhone": "5551117777",
        "patientEmail": "conc_a@example.com",
        "preferredDate": today.isoformat(),
        "preferredTime": "01:00 PM",
        "teamMemberId": str(team_member_id),
        "status": "confirmed",
    }
    payload_2 = {
        "patientFullName": "Concurrent Patient B",
        "patientPhone": "5551118888",
        "patientEmail": "conc_b@example.com",
        "preferredDate": today.isoformat(),
        "preferredTime": "01:00 PM",
        "teamMemberId": str(team_member_id),
        "status": "confirmed",
    }

    # Fire two booking requests concurrently
    resp1, resp2 = await asyncio.gather(
        client.post("/api/v1/reception/appointments", json=payload_1, headers=headers),
        client.post("/api/v1/reception/appointments", json=payload_2, headers=headers),
    )

    statuses = [resp1.status_code, resp2.status_code]
    # Exactly one must succeed (201) and one must be rejected with conflict (409)
    assert 201 in statuses
    assert 409 in statuses

    conflict_resp = resp1 if resp1.status_code == 409 else resp2
    assert "Double-booking conflict" in conflict_resp.json()["detail"]

