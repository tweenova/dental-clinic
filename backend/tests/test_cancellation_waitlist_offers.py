import json
import pytest
from datetime import date, timedelta
from uuid import UUID, uuid4

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.orm_models import (
    ActivityLogORM,
    BookingORM,
    PatientORM,
    TaskORM,
)


@pytest.mark.asyncio
async def test_cancellation_waitlist_offers_discovery(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    tomorrow = date.today() + timedelta(days=1)

    # 1. Create a cancelled booking
    cancelled_booking = BookingORM(
        id=uuid4(),
        confirmation_id="BK-CANC-01",
        preferred_date=tomorrow,
        preferred_time="11:00",
        patient_full_name="Ahmad Raza",
        patient_phone="+923001112233",
        patient_email="ahmad@example.com",
        status="cancelled",
        cancellation_reason="Patient feeling unwell",
    )
    test_session.add(cancelled_booking)

    # 2. Create waitlist patient and booking
    waitlist_patient = PatientORM(
        id=uuid4(),
        first_name="Fatima",
        last_name="Noor",
        phone="+923004445566",
        email="fatima@example.com",
    )
    test_session.add(waitlist_patient)

    waitlist_booking = BookingORM(
        id=uuid4(),
        confirmation_id="BK-WAIT-01",
        preferred_date=tomorrow,
        preferred_time="Morning",
        patient_full_name="Fatima Noor",
        patient_phone="+923004445566",
        patient_email="fatima@example.com",
        patient_id=waitlist_patient.id,
        status="waitlist",
        notes="Prefers 10:00 to 12:00 if slot opens",
    )
    test_session.add(waitlist_booking)
    await test_session.commit()

    # 3. Request waitlist offers for the cancelled slot
    resp = await client.get(
        f"/api/v1/reception/appointments/{cancelled_booking.id}/waitlist-offers",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    offers = resp.json()

    match = next(
        (o for o in offers if o["waitlistBookingId"] == str(waitlist_booking.id)),
        None,
    )
    assert match is not None, "Waitlist candidate should be returned"
    assert match["patientName"] == "Fatima Noor"
    assert match["patientPhone"] == "+923004445566"
    assert match["hasOpenOfferTask"] is False
    assert match["taskId"] is None


@pytest.mark.asyncio
async def test_create_waitlist_offer_task_does_not_autobook(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    slot_date = date.today() + timedelta(days=2)

    cancelled_booking = BookingORM(
        id=uuid4(),
        confirmation_id="BK-CANC-02",
        preferred_date=slot_date,
        preferred_time="14:30",
        patient_full_name="Zahid Iqbal",
        patient_phone="+923007778899",
        patient_email="zahid@example.com",
        status="cancelled",
    )
    test_session.add(cancelled_booking)

    waitlist_booking = BookingORM(
        id=uuid4(),
        confirmation_id="BK-WAIT-02",
        preferred_date=slot_date,
        preferred_time="Afternoon",
        patient_full_name="Bilal Tariq",
        patient_phone="+923009990011",
        patient_email="bilal@example.com",
        status="waitlist",
        notes="Call anytime if afternoon slot opens",
    )
    test_session.add(waitlist_booking)
    await test_session.commit()

    # Create offer call task
    resp = await client.post(
        f"/api/v1/reception/appointments/{cancelled_booking.id}/waitlist-offers/create-task",
        headers=headers,
        json={"waitlistBookingId": str(waitlist_booking.id)},
    )
    assert resp.status_code == 200, resp.text
    task_data = resp.json()
    assert "Offer Slot: Bilal Tariq" in task_data["title"]
    assert task_data["priority"] == "high"
    assert task_data["status"] == "pending"

    # CRITICAL: Verify waitlist booking is NOT auto-booked
    wb_db = await test_session.get(BookingORM, waitlist_booking.id)
    assert wb_db is not None
    assert wb_db.status == "waitlist", "Waitlist booking must remain 'waitlist', NEVER auto-booked"

    # CRITICAL: Verify cancelled booking remains 'cancelled'
    cb_db = await test_session.get(BookingORM, cancelled_booking.id)
    assert cb_db is not None
    assert cb_db.status == "cancelled"

    # Verify task was saved in DB
    task_stmt = select(TaskORM).where(TaskORM.id == UUID(task_data["id"]))
    task_result = await test_session.execute(task_stmt)
    task_db = task_result.scalars().first()
    assert task_db is not None
    assert task_db.priority == "high"

    # Verify audit log was created
    audit_stmt = (
        select(ActivityLogORM)
        .where(
            ActivityLogORM.action == "waitlist_offer_task_created",
            ActivityLogORM.entity_id == str(task_data["id"]),
        )
    )
    audit_res = await test_session.execute(audit_stmt)
    log_entry = audit_res.scalars().first()
    assert log_entry is not None
    details = json.loads(log_entry.details_json) if isinstance(log_entry.details_json, str) else log_entry.details_json
    assert details["patientName"] == "Bilal Tariq"
    assert details["slotTime"] == "14:30"

    # Subsequent fetch of waitlist offers should reflect the open offer task
    resp_check = await client.get(
        f"/api/v1/reception/appointments/{cancelled_booking.id}/waitlist-offers",
        headers=headers,
    )
    assert resp_check.status_code == 200
    offers = resp_check.json()
    match = next(
        (o for o in offers if o["waitlistBookingId"] == str(waitlist_booking.id)),
        None,
    )
    assert match is not None
    assert match["hasOpenOfferTask"] is True
    assert match["taskId"] == task_data["id"]


@pytest.mark.asyncio
async def test_cannot_create_offer_task_for_invalid_waitlist_booking(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    cancelled_booking = BookingORM(
        id=uuid4(),
        confirmation_id="BK-CANC-03",
        preferred_date=date.today() + timedelta(days=3),
        preferred_time="16:00",
        patient_full_name="Taimur Ali",
        patient_phone="+923005556677",
        patient_email="taimur@example.com",
        status="cancelled",
    )
    # Non-waitlist booking (already confirmed)
    confirmed_booking = BookingORM(
        id=uuid4(),
        confirmation_id="BK-CONF-01",
        preferred_date=date.today() + timedelta(days=3),
        preferred_time="16:00",
        patient_full_name="Usman Sheikh",
        patient_phone="+923002223344",
        patient_email="usman@example.com",
        status="confirmed",
    )
    test_session.add_all([cancelled_booking, confirmed_booking])
    await test_session.commit()

    # Attempt with confirmed booking ID instead of waitlist
    resp = await client.post(
        f"/api/v1/reception/appointments/{cancelled_booking.id}/waitlist-offers/create-task",
        headers=headers,
        json={"waitlistBookingId": str(confirmed_booking.id)},
    )
    assert resp.status_code == 404
