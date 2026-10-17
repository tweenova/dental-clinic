import pytest
from datetime import date, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.reception_service import normalize_pakistan_phone
from app.infrastructure.database.orm_models import (
    ActivityLogORM,
    BookingORM,
    ClinicBookingSettingsORM,
    PatientORM,
    TeamMemberORM,
)


def test_pakistan_phone_normalization():
    # Local mobile format with leading 0
    assert normalize_pakistan_phone("0300 1234567") == "923001234567"
    assert normalize_pakistan_phone("0345-9876543") == "923459876543"

    # Already international with plus or 00
    assert normalize_pakistan_phone("+92 300 1234567") == "923001234567"
    assert normalize_pakistan_phone("00923001234567") == "923001234567"

    # 10 digits starting with 3
    assert normalize_pakistan_phone("3001234567") == "923001234567"

    # Landline format (e.g. Lahore 042)
    assert normalize_pakistan_phone("042 35876543") == "924235876543"


@pytest.mark.asyncio
async def test_appointment_reminders_worklist_and_mark_reminded(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    receptionist_user = receptionist_auth["user"]

    # 1. Setup clinician, patient
    doctor = TeamMemberORM(
        id=uuid4(),
        organization_id=uuid4(),
        first_name="Tariq",
        last_name="Khan",
        display_name="Dr. Tariq Khan",
        role="dentist",
        professional_title="BDS, RDS",
        specialties_json='["General Dentistry"]',
        is_active=True,
    )
    test_session.add(doctor)

    patient = PatientORM(
        id=uuid4(),
        first_name="Zubair",
        last_name="Ahmed",
        phone="0301 5556677",
        email="zubair@test.internal",
        is_active=True,
    )
    test_session.add(patient)

    # 2. Setup booking settings with custom reminder template
    settings = ClinicBookingSettingsORM(
        id=uuid4(),
        booking_mode="open",
        reminder_template="Salam {patient_name}, reminder for your visit on {appointment_date} at {appointment_time} with {clinician_name}.",
    )
    test_session.add(settings)

    # 3. Create confirmed booking for tomorrow
    target_date = date.today() + timedelta(days=1)
    booking = BookingORM(
        id=uuid4(),
        confirmation_id=f"BK-REMIND-{uuid4().hex[:6]}",
        patient_id=patient.id,
        team_member_id=doctor.id,
        preferred_date=target_date,
        preferred_time="10:30 AM",
        status="confirmed",
        patient_full_name="Zubair Ahmed",
        patient_phone="0301 5556677",
        patient_email="zubair@test.internal",
    )
    test_session.add(booking)

    # Another booking for same date but cancelled (should NOT be on reminders worklist)
    cancelled_booking = BookingORM(
        id=uuid4(),
        confirmation_id=f"BK-CANC-{uuid4().hex[:6]}",
        patient_id=patient.id,
        preferred_date=target_date,
        preferred_time="11:30 AM",
        status="cancelled",
        patient_full_name="Zubair Ahmed",
        patient_phone="0301 5556677",
        patient_email="zubair@test.internal",
    )
    test_session.add(cancelled_booking)

    await test_session.commit()

    # 4. Fetch reminders worklist as receptionist
    resp = await client.get(
        f"/api/v1/reception/reminders?date={target_date.isoformat()}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["targetDate"] == target_date.isoformat()
    assert "Salam {patient_name}" in data["template"]
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["id"] == str(booking.id)
    assert item["patientFullName"] == "Zubair Ahmed"
    assert item["clinicianName"] == "Dr. Tariq Khan"
    assert item["remindedAt"] is None

    # 5. Mark booking as reminded
    mark_resp = await client.post(
        f"/api/v1/reception/appointments/{booking.id}/remind",
        headers=headers,
    )
    assert mark_resp.status_code == 200, mark_resp.text
    mark_data = mark_resp.json()
    assert mark_data["remindedAt"] is not None
    assert mark_data["remindedByUserId"] == str(receptionist_user.id)
    assert mark_data["remindedByName"] == "Test Receptionist"

    # 6. Verify audit log entry
    audit_entry = (
        await test_session.execute(
            ActivityLogORM.__table__.select().where(
                ActivityLogORM.action == "mark_reminded",
                ActivityLogORM.entity_id == str(booking.id),
            )
        )
    ).fetchone()
    assert audit_entry is not None


@pytest.mark.asyncio
async def test_admin_reminder_template_management_and_audit(
    admin_auth: dict, receptionist_auth: dict, test_session: AsyncSession
):
    admin_client: AsyncClient = admin_auth["client"]
    admin_headers = admin_auth["headers"]
    rec_client: AsyncClient = receptionist_auth["client"]
    rec_headers = receptionist_auth["headers"]

    new_template = "Dear {patient_name}, your dental appointment is confirmed for {appointment_date} at {appointment_time}."

    # Admin updates reminder template
    put_resp = await admin_client.put(
        "/api/v1/admin/booking/reminder-template",
        json={"template": new_template},
        headers=admin_headers,
    )
    assert put_resp.status_code == 200, put_resp.text
    assert put_resp.json()["reminderTemplate"] == new_template

    # Audit log check
    audit_entry = (
        await test_session.execute(
            ActivityLogORM.__table__.select().where(
                ActivityLogORM.action == "update_reminder_template",
            )
        )
    ).fetchone()
    assert audit_entry is not None

    # Receptionist tries to update reminder template -> 403 Forbidden
    forbidden_resp = await rec_client.put(
        "/api/v1/admin/booking/reminder-template",
        json={"template": "Unauthorized change"},
        headers=rec_headers,
    )
    assert forbidden_resp.status_code == 403
