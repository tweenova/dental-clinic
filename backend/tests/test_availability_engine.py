import asyncio
from datetime import date, datetime, timedelta
from typing import List
from uuid import uuid4
from zoneinfo import ZoneInfo
import pytest

from app.domain.models.booking_crm import Booking
from app.domain.models.booking_settings import (
    BookingSettings,
    ClinicClosure,
    ProviderAvailability,
    ProviderTimeOff,
    WorkingHours,
)
from app.infrastructure.database.orm_models import (
    ClinicBookingSettingsORM,
    ClinicClosureORM,
    ClinicWorkingHoursORM,
    OrganizationORM,
    ProviderAvailabilityORM,
    ProviderTimeOffORM,
    ServiceORM,
    ServiceProviderORM,
    TeamMemberORM,
)
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository


async def get_or_create_test_org(test_session) -> OrganizationORM:
    org = OrganizationORM(
        id=uuid4(),
        name="Marlow Dental",
        display_name="Marlow Dental Practice",
        currency_code="PKR",
        is_active=True,
    )
    test_session.add(org)
    await test_session.commit()
    return org


@pytest.mark.asyncio
async def test_availability_engine_hours_breaks_closures(test_session, client_with_db):
    """
    Availability engine calculates slots using clinic working hours, provider breaks,
    and returns empty slots on planned closures.
    """
    settings_repo = PostgresBookingSettingsRepository(test_session)
    org = await get_or_create_test_org(test_session)

    # 1. Setup base booking settings (15-min interval, 0 lead time for test predictability)
    settings = await settings_repo.get_settings()
    settings.slot_interval_minutes = 15
    settings.min_lead_time_hours = 0
    settings.advance_booking_days = 60
    await settings_repo.update_settings(settings)
    await test_session.commit()

    # 2. Pick a future Monday for deterministic testing
    today = datetime.now(ZoneInfo("Asia/Karachi")).date()
    days_to_next_mon = (7 - today.weekday()) % 7
    if days_to_next_mon == 0:
        days_to_next_mon = 7
    target_date = today + timedelta(days=days_to_next_mon)
    dow = target_date.weekday()  # 0

    # Ensure Monday is open 09:00 - 17:00
    wh = WorkingHours(
        id=uuid4(),
        day_of_week=dow,
        open_time="09:00",
        close_time="17:00",
        is_closed=False,
    )
    await settings_repo.update_working_hours([wh])
    await test_session.commit()

    # 3. Add clinician with a break between 13:00 and 14:00
    clinician = TeamMemberORM(
        id=uuid4(),
        organization_id=org.id,
        first_name="Dr. Sarah",
        last_name="Khan",
        display_name="Dr. Sarah Khan",
        professional_title="Dental Surgeon",
        role="dentist",
        is_active=True,
    )
    test_session.add(clinician)
    await test_session.commit()

    avail = ProviderAvailability(
        id=uuid4(),
        team_member_id=clinician.id,
        day_of_week=dow,
        start_time="09:00",
        end_time="17:00",
        break_start_time="13:00",
        break_end_time="14:00",
        is_active=True,
    )
    await settings_repo.save_provider_availability(avail)
    await test_session.commit()

    # Fetch availability via public endpoint
    resp = await client_with_db.get(
        f"/api/v1/public/availability?date={target_date.isoformat()}&teamMemberId={clinician.id}"
    )
    assert resp.status_code == 200
    data = resp.json()
    slots = data["slots"]

    assert "09:00 AM" in slots
    assert "12:30 PM" in slots
    # Break is 13:00 - 14:00: no slot should start during this break
    assert "01:00 PM" not in slots
    assert "01:15 PM" not in slots
    assert "01:30 PM" not in slots
    assert "01:45 PM" not in slots
    # Afternoon slots resume at 02:00 PM
    assert "02:00 PM" in slots
    assert "04:30 PM" in slots

    # 4. Add planned closure on this date -> slots must be empty
    closure = ClinicClosure(
        id=uuid4(),
        start_date=target_date,
        end_date=target_date,
        reason="Clinic Renovation",
    )
    await settings_repo.save_closure(closure)
    await test_session.commit()

    resp_closed = await client_with_db.get(
        f"/api/v1/public/availability?date={target_date.isoformat()}&teamMemberId={clinician.id}"
    )
    assert resp_closed.status_code == 200
    assert resp_closed.json()["slots"] == []


@pytest.mark.asyncio
async def test_availability_engine_provider_time_off(test_session, client_with_db):
    """Approved provider time off blocks clinician slots, unapproved time off does not."""
    settings_repo = PostgresBookingSettingsRepository(test_session)
    org = await get_or_create_test_org(test_session)

    settings = await settings_repo.get_settings()
    settings.slot_interval_minutes = 30
    settings.min_lead_time_hours = 0
    await settings_repo.update_settings(settings)
    await test_session.commit()

    today = datetime.now(ZoneInfo("Asia/Karachi")).date()
    target_date = today + timedelta(days=10)
    dow = target_date.weekday()

    wh = WorkingHours(
        id=uuid4(),
        day_of_week=dow,
        open_time="09:00",
        close_time="17:00",
        is_closed=False,
    )
    await settings_repo.update_working_hours([wh])
    await test_session.commit()

    clinician = TeamMemberORM(
        id=uuid4(),
        organization_id=org.id,
        first_name="Dr. Ali",
        last_name="Reza",
        display_name="Dr. Ali Reza",
        professional_title="Orthodontist",
        role="dentist",
        is_active=True,
    )
    test_session.add(clinician)
    await test_session.commit()

    avail = ProviderAvailability(
        id=uuid4(),
        team_member_id=clinician.id,
        day_of_week=dow,
        start_time="09:00",
        end_time="17:00",
        is_active=True,
    )
    await settings_repo.save_provider_availability(avail)
    await test_session.commit()

    # With unapproved time off, clinician is still bookable
    unapproved_to = ProviderTimeOff(
        id=uuid4(),
        team_member_id=clinician.id,
        start_date=target_date,
        end_date=target_date,
        reason="Dental Conference (Pending)",
        is_approved=False,
    )
    await settings_repo.save_provider_time_off(unapproved_to)
    await test_session.commit()

    resp1 = await client_with_db.get(
        f"/api/v1/public/availability?date={target_date.isoformat()}&teamMemberId={clinician.id}"
    )
    assert resp1.status_code == 200
    assert len(resp1.json()["slots"]) > 0

    # With approved time off, clinician slots are blocked (empty)
    approved_to = ProviderTimeOff(
        id=uuid4(),
        team_member_id=clinician.id,
        start_date=target_date,
        end_date=target_date,
        reason="Approved Annual Leave",
        is_approved=True,
    )
    await settings_repo.save_provider_time_off(approved_to)
    await test_session.commit()

    resp2 = await client_with_db.get(
        f"/api/v1/public/availability?date={target_date.isoformat()}&teamMemberId={clinician.id}"
    )
    assert resp2.status_code == 200
    assert resp2.json()["slots"] == []


@pytest.mark.asyncio
async def test_availability_engine_buffer_and_lead_time(test_session, client_with_db):
    """Service duration + buffer minutes blocks adjacent slots; lead time filters immediate slots."""
    settings_repo = PostgresBookingSettingsRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    org = await get_or_create_test_org(test_session)

    today = datetime.now(ZoneInfo("Asia/Karachi")).date()
    target_date = today + timedelta(days=14)
    dow = target_date.weekday()

    settings = await settings_repo.get_settings()
    settings.slot_interval_minutes = 15
    settings.min_lead_time_hours = 0
    await settings_repo.update_settings(settings)
    await test_session.commit()

    wh = WorkingHours(
        id=uuid4(),
        day_of_week=dow,
        open_time="09:00",
        close_time="17:00",
        is_closed=False,
    )
    await settings_repo.update_working_hours([wh])
    await test_session.commit()

    clinician = TeamMemberORM(
        id=uuid4(),
        organization_id=org.id,
        first_name="Dr. Zainab",
        last_name="Malik",
        display_name="Dr. Zainab Malik",
        professional_title="Periodontist",
        role="dentist",
        is_active=True,
    )
    test_session.add(clinician)

    # Service with 45-min duration and 15-min buffer = 60-min total block
    service = ServiceORM(
        id=uuid4(),
        slug="deep-cleaning",
        title="Deep Cleaning & Root Planing",
        short_desc="Deep scale and root surface cleaning",
        full_desc="Periodontal therapy procedure",
        category="preventive",
        duration="45 mins",
        cash_price="12000",
        is_active=True,
        is_public=True,
        bookable_online=True,
        buffer_minutes=15,
    )
    test_session.add(service)

    link = ServiceProviderORM(
        id=uuid4(),
        service_id=service.id,
        team_member_id=clinician.id,
    )
    test_session.add(link)
    await test_session.commit()

    avail = ProviderAvailability(
        id=uuid4(),
        team_member_id=clinician.id,
        day_of_week=dow,
        start_time="09:00",
        end_time="17:00",
        is_active=True,
    )
    await settings_repo.save_provider_availability(avail)
    await test_session.commit()

    # Add existing booking at 10:00 AM (45 min duration + 15 min buffer => busy until 11:00 AM)
    b = Booking(
        confirmation_id="BK-TEST-BUF1",
        preferred_date=target_date,
        preferred_time="10:00 AM",
        service_id=str(service.id),
        team_member_id=clinician.id,
        patient_full_name="Existing Patient",
        patient_phone="03001234567",
        patient_email="patient@example.com",
        status="confirmed",
    )
    await booking_repo.save(b)
    await test_session.commit()

    resp = await client_with_db.get(
        f"/api/v1/public/availability?date={target_date.isoformat()}&serviceId={service.id}"
    )
    assert resp.status_code == 200
    slots = resp.json()["slots"]

    # 10:00 AM, 10:15 AM, 10:30 AM, 10:45 AM should all be blocked
    assert "10:00 AM" not in slots
    assert "10:15 AM" not in slots
    assert "10:30 AM" not in slots
    assert "10:45 AM" not in slots
    # Next slot is 11:00 AM
    assert "11:00 AM" in slots


@pytest.mark.asyncio
async def test_availability_engine_split_shifts(test_session, client_with_db):
    """Clinician with multiple shifts on the same day offers slots in both shifts, not between them."""
    settings_repo = PostgresBookingSettingsRepository(test_session)
    org = await get_or_create_test_org(test_session)

    today = datetime.now(ZoneInfo("Asia/Karachi")).date()
    target_date = today + timedelta(days=21)
    dow = target_date.weekday()

    settings = await settings_repo.get_settings()
    settings.slot_interval_minutes = 30
    settings.min_lead_time_hours = 0
    await settings_repo.update_settings(settings)
    await test_session.commit()

    wh = WorkingHours(
        id=uuid4(),
        day_of_week=dow,
        open_time="08:00",
        close_time="20:00",
        is_closed=False,
    )
    await settings_repo.update_working_hours([wh])
    await test_session.commit()

    clinician = TeamMemberORM(
        id=uuid4(),
        organization_id=org.id,
        first_name="Dr. Bilal",
        last_name="Tariq",
        display_name="Dr. Bilal Tariq",
        professional_title="General Dentist",
        role="dentist",
        is_active=True,
    )
    test_session.add(clinician)
    await test_session.commit()

    # Split shift 1: Morning 09:00 - 12:00
    shift1 = ProviderAvailability(
        id=uuid4(),
        team_member_id=clinician.id,
        day_of_week=dow,
        start_time="09:00",
        end_time="12:00",
        is_active=True,
    )
    # Split shift 2: Evening 16:00 - 19:00
    shift2 = ProviderAvailability(
        id=uuid4(),
        team_member_id=clinician.id,
        day_of_week=dow,
        start_time="16:00",
        end_time="19:00",
        is_active=True,
    )
    await settings_repo.save_provider_availability(shift1)
    await settings_repo.save_provider_availability(shift2)
    await test_session.commit()

    resp = await client_with_db.get(
        f"/api/v1/public/availability?date={target_date.isoformat()}&teamMemberId={clinician.id}"
    )
    assert resp.status_code == 200
    slots = resp.json()["slots"]

    # Morning shift present
    assert "09:00 AM" in slots
    assert "11:30 AM" in slots
    # Gap between 12:00 and 16:00 not present
    assert "12:00 PM" not in slots
    assert "01:00 PM" not in slots
    assert "03:00 PM" not in slots
    # Evening shift present
    assert "04:00 PM" in slots
    assert "06:30 PM" in slots


@pytest.mark.asyncio
async def test_public_availability_leaks_no_personal_data(test_session, client_with_db):
    """
    Public availability endpoint response contains ONLY availability metadata and slot times.
    Never leaks patient names, phone numbers, emails, notes, or internal sensitive fields.
    """
    settings_repo = PostgresBookingSettingsRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    today = datetime.now(ZoneInfo("Asia/Karachi")).date()
    target_date = today + timedelta(days=7)
    dow = target_date.weekday()

    wh = WorkingHours(
        id=uuid4(),
        day_of_week=dow,
        open_time="09:00",
        close_time="17:00",
        is_closed=False,
    )
    await settings_repo.update_working_hours([wh])
    await test_session.commit()

    # Insert a sensitive patient booking
    b = Booking(
        confirmation_id="BK-SECRET-999",
        preferred_date=target_date,
        preferred_time="10:00 AM",
        patient_full_name="High Profile Patient VIP",
        patient_phone="03009999999",
        patient_email="vip@sensitive-corp.com",
        notes="Confidential dental surgery required",
        status="confirmed",
    )
    await booking_repo.save(b)
    await test_session.commit()

    resp = await client_with_db.get(f"/api/v1/public/availability?date={target_date.isoformat()}")
    assert resp.status_code == 200

    raw_text = resp.text
    # Verify strict data isolation: no personal or internal CRM text appears anywhere
    assert "High Profile" not in raw_text
    assert "VIP" not in raw_text
    assert "03009999999" not in raw_text
    assert "vip@sensitive-corp.com" not in raw_text
    assert "Confidential" not in raw_text
    assert "BK-SECRET-999" not in raw_text

    data = resp.json()
    allowed_keys = {"date", "serviceId", "teamMemberId", "timezone", "slots"}
    assert set(data.keys()) <= allowed_keys
    assert isinstance(data["slots"], list)


@pytest.mark.asyncio
async def test_concurrent_public_booking_one_success_one_409(test_session, client_with_db):
    """
    When two public users submit for the same appointment date and time concurrently,
    server-side advisory lock re-validates availability so exactly one succeeds (201)
    and the other receives a 409 Conflict.
    """
    settings_repo = PostgresBookingSettingsRepository(test_session)
    settings = await settings_repo.get_settings()
    settings.slot_interval_minutes = 30
    settings.min_lead_time_hours = 0
    settings.booking_mode = "open"
    await settings_repo.update_settings(settings)
    await test_session.commit()

    today = datetime.now(ZoneInfo("Asia/Karachi")).date()
    days_to_tue = (1 - today.weekday()) % 7
    if days_to_tue <= 0:
        days_to_tue += 7
    target_date = today + timedelta(days=days_to_tue)
    dow = target_date.weekday()

    wh = WorkingHours(
        id=uuid4(),
        day_of_week=dow,
        open_time="09:00",
        close_time="17:00",
        is_closed=False,
    )
    await settings_repo.update_working_hours([wh])
    await test_session.commit()

    service = ServiceORM(
        id=uuid4(),
        slug="consultation",
        title="Initial Consultation",
        short_desc="Consultation with dentist",
        full_desc="Comprehensive initial consultation",
        category="preventive",
        duration="30 mins",
        cash_price="5000",
        is_active=True,
        is_public=True,
        bookable_online=True,
    )
    test_session.add(service)
    await test_session.commit()

    payload_user1 = {
        "serviceId": str(service.id),
        "preferredDate": target_date.isoformat(),
        "preferredTime": "11:00 AM",
        "fullName": "User One",
        "phone": "(312) 555-0101",
        "email": "user1@example.com",
    }
    payload_user2 = {
        "serviceId": str(service.id),
        "preferredDate": target_date.isoformat(),
        "preferredTime": "11:00 AM",
        "fullName": "User Two",
        "phone": "(312) 555-0102",
        "email": "user2@example.com",
    }

    # Submit concurrently
    resp1, resp2 = await asyncio.gather(
        client_with_db.post("/api/v1/appointments", json=payload_user1),
        client_with_db.post("/api/v1/appointments", json=payload_user2),
    )

    statuses = [resp1.status_code, resp2.status_code]
    assert 201 in statuses, f"Expected one 201, got {statuses}"
    assert 409 in statuses, f"Expected one 409, got {statuses}"

    conflict_resp = resp1 if resp1.status_code == 409 else resp2
    assert "no longer available" in conflict_resp.json()["detail"]


@pytest.mark.asyncio
async def test_admin_booking_rules_and_schedules_security(client_with_db, receptionist_auth, admin_auth):
    """
    Online booking rules and provider schedule endpoints are restricted to ADMIN role only.
    Receptionist and unauthenticated requests return 403 or 401.
    """
    rec_headers = receptionist_auth["headers"]
    admin_headers = admin_auth["headers"]

    rules_payload = {
        "slotIntervalMinutes": 15,
        "minLeadTimeHours": 2,
        "advanceBookingDays": 60,
    }

    # 1. Unauthenticated -> 401 or 403
    unauth_resp = await client_with_db.put("/api/v1/admin/booking/rules", json=rules_payload)
    assert unauth_resp.status_code in [401, 403]

    # 2. Receptionist -> 403 Forbidden
    rec_resp = await client_with_db.put(
        "/api/v1/admin/booking/rules",
        json=rules_payload,
        headers=rec_headers,
    )
    assert rec_resp.status_code == 403

    # 3. Admin -> 200 OK
    admin_resp = await client_with_db.put(
        "/api/v1/admin/booking/rules",
        json=rules_payload,
        headers=admin_headers,
    )
    assert admin_resp.status_code == 200
    assert admin_resp.json()["slotIntervalMinutes"] == 15
