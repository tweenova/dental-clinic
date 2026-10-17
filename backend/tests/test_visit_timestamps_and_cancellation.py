import pytest
from datetime import date
from app.domain.models.booking_crm import Booking
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository


@pytest.mark.asyncio
async def test_visit_timestamps_persisted_exactly_once(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    booking_repo = PostgresBookingRepository(test_session)
    booking = Booking(
        confirmation_id="BK-TIME-001",
        preferred_date=date.today(),
        preferred_time="10:00 AM",
        patient_full_name="Timestamp Test",
        patient_phone="5551239999",
        patient_email="time.test@example.com",
        status="confirmed",
    )
    saved = await booking_repo.save(booking)
    await test_session.commit()

    # 1. Transition confirmed -> arrived
    r1 = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "arrived"},
        headers=headers,
    )
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["status"] == "arrived"
    assert d1["arrivedAt"] is not None
    assert d1["startedAt"] is None
    assert d1["completedAt"] is None
    arrived_at_orig = d1["arrivedAt"]

    # Repeat arrived transition; arrivedAt must NOT be overwritten
    r1_repeat = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "arrived"},
        headers=headers,
    )
    assert r1_repeat.status_code == 200
    assert r1_repeat.json()["arrivedAt"] == arrived_at_orig

    # 2. Transition arrived -> in_progress
    r2 = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["status"] == "in_progress"
    assert d2["arrivedAt"] == arrived_at_orig
    assert d2["startedAt"] is not None
    started_at_orig = d2["startedAt"]

    # 3. Transition in_progress -> completed
    r3 = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["status"] == "completed"
    assert d3["arrivedAt"] == arrived_at_orig
    assert d3["startedAt"] == started_at_orig
    assert d3["completedAt"] is not None


@pytest.mark.asyncio
async def test_illegal_status_transition_returns_409(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    booking_repo = PostgresBookingRepository(test_session)
    booking = Booking(
        confirmation_id="BK-ILLEGAL-001",
        preferred_date=date.today(),
        preferred_time="02:00 PM",
        patient_full_name="Illegal Jump",
        patient_phone="5551238888",
        patient_email="jump.test@example.com",
        status="requested",
    )
    saved = await booking_repo.save(booking)
    await test_session.commit()

    # Requested directly to completed is illegal -> 409
    resp = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert resp.status_code == 409
    assert "Cannot transition appointment" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_cancellation_requires_reason(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    booking_repo = PostgresBookingRepository(test_session)
    booking = Booking(
        confirmation_id="BK-CANCEL-001",
        preferred_date=date.today(),
        preferred_time="03:00 PM",
        patient_full_name="Cancel Test",
        patient_phone="5551237777",
        patient_email="cancel.test@example.com",
        status="confirmed",
    )
    saved = await booking_repo.save(booking)
    await test_session.commit()

    # 1. Missing cancellationReason -> 422
    resp_no_reason = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "cancelled"},
        headers=headers,
    )
    assert resp_no_reason.status_code == 422
    assert "Cancellation reason is required" in resp_no_reason.json()["detail"]

    # 2. Empty whitespace cancellationReason -> 422
    resp_blank_reason = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "cancelled", "cancellationReason": "   "},
        headers=headers,
    )
    assert resp_blank_reason.status_code == 422

    # 3. Valid cancellationReason -> 200, sets actor and reason
    resp_valid = await client.patch(
        f"/api/v1/reception/appointments/{saved.id}/status",
        json={"status": "cancelled", "cancellationReason": "Patient requested reschedule due to work trip"},
        headers=headers,
    )
    assert resp_valid.status_code == 200
    d_valid = resp_valid.json()
    assert d_valid["status"] == "cancelled"
    assert d_valid["cancellationReason"] == "Patient requested reschedule due to work trip"
    assert d_valid["cancelledByUserId"] == str(receptionist_auth["user"].id)
