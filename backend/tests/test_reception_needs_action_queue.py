import pytest
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.orm_models import (
    ActivityLogORM,
    BookingORM,
    ClinicBookingSettingsORM,
    PatientORM,
    TaskORM,
    TeamMemberORM,
)


@pytest.mark.asyncio
async def test_reception_needs_action_queue_categories(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)

    # 1. Ensure booking settings with 15m waiting threshold
    stmt = select(ClinicBookingSettingsORM).limit(1)
    res = await test_session.execute(stmt)
    settings = res.scalar_one_or_none()
    if not settings:
        settings = ClinicBookingSettingsORM(
            id=uuid4(),
            booking_mode="open",
            advance_booking_days=60,
            slot_interval_minutes=15,
            waiting_threshold_minutes=15,
        )
        test_session.add(settings)
    else:
        settings.waiting_threshold_minutes = 15
    await test_session.flush()

    # 2. Setup clinician and patient
    doctor = TeamMemberORM(
        id=uuid4(),
        organization_id=uuid4(),
        first_name="Dr",
        last_name="Farhan",
        display_name="Dr. Farhan",
        role="dentist",
        professional_title="BDS",
        specialties_json='["Orthodontics"]',
        is_active=True,
    )
    test_session.add(doctor)

    patient = PatientORM(
        id=uuid4(),
        first_name="Bilal",
        last_name="Saeed",
        phone="0321 4443322",
        is_active=True,
    )
    test_session.add(patient)
    await test_session.flush()

    # 3. Create items for each of the 5 categories
    # Category 1: Online requests awaiting triage (status == "requested")
    booking_req = BookingORM(
        id=uuid4(),
        confirmation_id=f"MD-REQ-{uuid4().hex[:6].upper()}",
        preferred_date=today,
        preferred_time="14:00",
        patient_full_name="Bilal Saeed",
        patient_phone="0321 4443322",
        patient_email="bilal@example.com",
        status="requested",
        team_member_id=doctor.id,
        patient_id=patient.id,
    )
    test_session.add(booking_req)

    # Category 2: Unconfirmed appointment for tomorrow
    booking_tom = BookingORM(
        id=uuid4(),
        confirmation_id=f"MD-TOM-{uuid4().hex[:6].upper()}",
        preferred_date=tomorrow,
        preferred_time="11:00",
        patient_full_name="Ayesha Khan",
        patient_phone="0300 1112233",
        patient_email="ayesha@example.com",
        status="unconfirmed",
        team_member_id=doctor.id,
    )
    test_session.add(booking_tom)

    # Category 3: Waiting delayed patient (>15m threshold)
    booking_wait = BookingORM(
        id=uuid4(),
        confirmation_id=f"MD-WAT-{uuid4().hex[:6].upper()}",
        preferred_date=today,
        preferred_time="09:00",
        patient_full_name="Usman Ali",
        patient_phone="0333 5554433",
        patient_email="usman@example.com",
        status="arrived",
        arrived_at=now - timedelta(minutes=25),
        team_member_id=doctor.id,
    )
    test_session.add(booking_wait)

    # Category 4: Overdue task
    overdue_task = TaskORM(
        id=uuid4(),
        title="Follow up lab report for implant",
        priority="high",
        status="pending",
        due_date=now - timedelta(hours=3),
    )
    test_session.add(overdue_task)

    # Category 5: Past unresolved appointment
    booking_past = BookingORM(
        id=uuid4(),
        confirmation_id=f"MD-PST-{uuid4().hex[:6].upper()}",
        preferred_date=yesterday,
        preferred_time="15:30",
        patient_full_name="Hamza Tariq",
        patient_phone="0345 7778899",
        patient_email="hamza@example.com",
        status="confirmed",
        team_member_id=doctor.id,
    )
    test_session.add(booking_past)
    await test_session.commit()

    # 4. Fetch dashboard summary
    resp = await client.get("/api/v1/reception/dashboard", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Check actionable counts
    assert data["pendingRequestsCount"] >= 1
    assert data["unconfirmedTomorrowCount"] >= 1
    assert data["waitingDelayedCount"] >= 1
    assert data["overdueTasksCount"] >= 1
    assert data["pastUnresolvedCount"] >= 1

    queue_types = {item["type"] for item in data["needsAttentionItems"]}
    assert "online_request" in queue_types
    assert "unconfirmed_tomorrow" in queue_types
    assert "waiting_delayed" in queue_types
    assert "overdue_task" in queue_types
    assert "past_unresolved" in queue_types

    # Verify action metadata
    delayed_item = next(i for i in data["needsAttentionItems"] if i["type"] == "waiting_delayed")
    assert "check_in" in delayed_item["availableActions"]
    assert "snooze" in delayed_item["availableActions"]


@pytest.mark.asyncio
async def test_reception_needs_action_queue_snooze_and_audit(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    user = receptionist_auth["user"]

    now = datetime.now(timezone.utc)
    today = now.date()

    # Create a booking in requested state
    booking = BookingORM(
        id=uuid4(),
        confirmation_id=f"MD-SNZ-{uuid4().hex[:6].upper()}",
        preferred_date=today,
        preferred_time="16:00",
        patient_full_name="Snooze Patient",
        patient_phone="0300 9998877",
        patient_email="snooze@example.com",
        status="requested",
    )
    test_session.add(booking)
    await test_session.commit()

    # Verify present before snooze
    resp1 = await client.get("/api/v1/reception/dashboard", headers=headers)
    assert resp1.status_code == 200
    ids_before = [i["id"] for i in resp1.json()["needsAttentionItems"]]
    assert str(booking.id) in ids_before

    # Call snooze endpoint
    snooze_payload = {
        "itemType": "booking",
        "itemId": str(booking.id),
        "durationHours": 24,
    }
    snooze_resp = await client.post(
        "/api/v1/reception/dashboard/snooze",
        headers=headers,
        json=snooze_payload,
    )
    assert snooze_resp.status_code == 200, snooze_resp.text
    snooze_data = snooze_resp.json()
    assert snooze_data["success"] is True
    assert snooze_data["itemType"] == "booking"

    # Verify audit log was recorded
    audit_stmt = select(ActivityLogORM).where(
        ActivityLogORM.action == "snooze_booking",
        ActivityLogORM.entity_id == str(booking.id),
    )
    audit_res = await test_session.execute(audit_stmt)
    log_entry = audit_res.scalar_one_or_none()
    assert log_entry is not None
    assert log_entry.user_id == user.id

    # Verify excluded after snooze
    resp2 = await client.get("/api/v1/reception/dashboard", headers=headers)
    assert resp2.status_code == 200
    ids_after = [i["id"] for i in resp2.json()["needsAttentionItems"]]
    assert str(booking.id) not in ids_after


@pytest.mark.asyncio
async def test_admin_update_waiting_threshold_setting(
    admin_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = admin_auth["client"]
    headers = admin_auth["headers"]

    # Update online booking rules with custom waiting threshold
    update_payload = {
        "slotIntervalMinutes": 15,
        "minLeadTimeHours": 2,
        "advanceBookingDays": 60,
        "waitingThresholdMinutes": 25,
    }
    resp = await client.put(
        "/api/v1/admin/booking/rules",
        headers=headers,
        json=update_payload,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["waitingThresholdMinutes"] == 25

    # Verify reading settings returns updated threshold
    get_resp = await client.get("/api/v1/admin/booking/settings", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["waitingThresholdMinutes"] == 25
