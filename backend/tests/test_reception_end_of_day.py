import pytest
from datetime import date, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.orm_models import (
    ActivityLogORM,
    BookingORM,
    PatientORM,
    TeamMemberORM,
)


@pytest.mark.asyncio
async def test_end_of_day_unresolved_listing(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    patient = PatientORM(
        id=uuid4(),
        first_name="Hassan",
        last_name="Raza",
        phone="03001112233",
        email="hassan@example.com",
    )
    test_session.add(patient)

    # 1. Unresolved past appointment (yesterday, confirmed)
    b_past = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-01",
        preferred_date=yesterday,
        preferred_time="10:00",
        patient_full_name="Hassan Raza",
        patient_phone="03001112233",
        patient_email="hassan@example.com",
        status="confirmed",
    )
    # 2. Unresolved today appointment (today, arrived)
    b_today_arrived = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-02",
        preferred_date=today,
        preferred_time="11:00",
        patient_full_name="Hassan Raza",
        patient_phone="03001112233",
        patient_email="hassan@example.com",
        status="arrived",
    )
    # 3. Unresolved today appointment (today, in_progress)
    b_today_prog = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-03",
        preferred_date=today,
        preferred_time="12:00",
        patient_full_name="Hassan Raza",
        patient_phone="03001112233",
        patient_email="hassan@example.com",
        status="in_progress",
    )
    # 4. Resolved today appointment (today, completed) -> should NOT appear
    b_today_done = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-04",
        preferred_date=today,
        preferred_time="13:00",
        patient_full_name="Hassan Raza",
        patient_phone="03001112233",
        patient_email="hassan@example.com",
        status="completed",
    )
    # 5. Future appointment (tomorrow, confirmed) -> should NOT appear
    b_future = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-05",
        preferred_date=tomorrow,
        preferred_time="14:00",
        patient_full_name="Hassan Raza",
        patient_phone="03001112233",
        patient_email="hassan@example.com",
        status="confirmed",
    )

    test_session.add_all([b_past, b_today_arrived, b_today_prog, b_today_done, b_future])
    await test_session.commit()

    resp = await client.get(
        f"/api/v1/reception/end-of-day/unresolved?date={today.isoformat()}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["targetDate"] == today.isoformat()
    assert data["todayCount"] >= 2
    assert data["pastCount"] >= 1
    assert data["totalUnresolved"] >= 3

    item_ids = [item["id"] for item in data["items"]]
    assert str(b_past.id) in item_ids
    assert str(b_today_arrived.id) in item_ids
    assert str(b_today_prog.id) in item_ids
    assert str(b_today_done.id) not in item_ids
    assert str(b_future.id) not in item_ids


@pytest.mark.asyncio
async def test_end_of_day_resolve_completed(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    receptionist_user = receptionist_auth["user"]

    today = date.today()
    b = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-COMP",
        preferred_date=today,
        preferred_time="09:00",
        patient_full_name="Fatima Ali",
        patient_phone="03002223344",
        patient_email="fatima@example.com",
        status="in_progress",
    )
    test_session.add(b)
    await test_session.commit()

    payload = {
        "bookingId": str(b.id),
        "resolution": "completed",
        "reason": "Procedure completed late, resolved at front desk",
    }
    resp = await client.post(
        "/api/v1/reception/end-of-day/resolve",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "completed"
    assert data["completedAt"] is not None
    assert "[End-of-day resolution] Procedure completed late" in (data["staffNotes"] or "")

    # Check audit log
    stmt = (
        select(ActivityLogORM)
        .where(
            ActivityLogORM.action == "end_of_day_resolution",
            ActivityLogORM.entity_id == str(b.id),
        )
    )
    res = await test_session.execute(stmt)
    log = res.scalar_one_or_none()
    assert log is not None
    assert log.user_id == receptionist_user.id
    assert "completed" in (log.details_json or "")
    assert "in_progress" in (log.details_json or "")


@pytest.mark.asyncio
async def test_end_of_day_resolve_no_show(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    today = date.today()
    b = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-NS",
        preferred_date=today,
        preferred_time="10:30",
        patient_full_name="Bilal Sheikh",
        patient_phone="03003334455",
        patient_email="bilal@example.com",
        status="confirmed",
    )
    test_session.add(b)
    await test_session.commit()

    payload = {
        "bookingId": str(b.id),
        "resolution": "no_show",
        "reason": "Patient did not answer 2 follow-up calls",
    }
    resp = await client.post(
        "/api/v1/reception/end-of-day/resolve",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "no_show"
    assert "[End-of-day resolution] Patient did not answer" in (data["staffNotes"] or "")


@pytest.mark.asyncio
async def test_end_of_day_resolve_cancelled_requires_reason(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    receptionist_user = receptionist_auth["user"]

    today = date.today()
    b = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-CNCL",
        preferred_date=today,
        preferred_time="11:30",
        patient_full_name="Zainab Tariq",
        patient_phone="03004445566",
        patient_email="zainab@example.com",
        status="confirmed",
    )
    test_session.add(b)
    await test_session.commit()

    # Empty reason must fail with 422
    fail_payload = {
        "bookingId": str(b.id),
        "resolution": "cancelled",
        "reason": "   ",
    }
    fail_resp = await client.post(
        "/api/v1/reception/end-of-day/resolve",
        json=fail_payload,
        headers=headers,
    )
    assert fail_resp.status_code in (422, 400), fail_resp.text

    # Valid reason succeeds
    ok_payload = {
        "bookingId": str(b.id),
        "resolution": "cancelled",
        "reason": "Patient called to reschedule for next week due to illness",
    }
    ok_resp = await client.post(
        "/api/v1/reception/end-of-day/resolve",
        json=ok_payload,
        headers=headers,
    )
    assert ok_resp.status_code == 200, ok_resp.text
    data = ok_resp.json()
    assert data["status"] == "cancelled"
    assert data["cancellationReason"] == ok_payload["reason"]
    assert str(data["cancelledByUserId"]) == str(receptionist_user.id)


@pytest.mark.asyncio
async def test_end_of_day_resolve_already_resolved_conflict(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    today = date.today()
    b = BookingORM(
        id=uuid4(),
        confirmation_id="BK-EOD-ALREADY",
        preferred_date=today,
        preferred_time="14:00",
        patient_full_name="Kamran Khan",
        patient_phone="03005556677",
        patient_email="kamran@example.com",
        status="completed",
    )
    test_session.add(b)
    await test_session.commit()

    payload = {
        "bookingId": str(b.id),
        "resolution": "no_show",
        "reason": "Attempting invalid transition",
    }
    resp = await client.post(
        "/api/v1/reception/end-of-day/resolve",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 409, resp.text
