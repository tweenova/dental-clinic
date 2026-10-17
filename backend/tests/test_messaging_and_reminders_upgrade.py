from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.messaging_provider import (
    DisabledMessagingProvider,
    SimulatedMessagingProvider,
    get_messaging_provider,
)
from app.application.services.reception_service import is_in_quiet_hours
from app.domain.models.booking_crm import Booking, Patient


def test_messaging_provider_layer():
    sim = get_messaging_provider("simulated")
    assert isinstance(sim, SimulatedMessagingProvider)

    dis = get_messaging_provider("disabled")
    assert isinstance(dis, DisabledMessagingProvider)

    import asyncio
    sim_res = asyncio.run(sim.send_message("+923001234567", "Hello test"))
    assert sim_res.success is True
    assert sim_res.status == "simulated"
    assert sim_res["success"] is True

    dis_res = asyncio.run(dis.send_message("+923001234567", "Hello test"))
    assert dis_res.success is False
    assert dis_res.status == "disabled"


def test_quiet_hours_calculation():
    from zoneinfo import ZoneInfo
    pkt = ZoneInfo("Asia/Karachi")

    # 22:30 PKT is in 21:00 - 08:00
    dt_night = datetime(2026, 10, 15, 22, 30, tzinfo=pkt)
    assert is_in_quiet_hours(dt_night, "21:00", "08:00") is True

    # 07:15 PKT is in 21:00 - 08:00
    dt_early = datetime(2026, 10, 15, 7, 15, tzinfo=pkt)
    assert is_in_quiet_hours(dt_early, "21:00", "08:00") is True

    # 14:00 PKT is NOT in 21:00 - 08:00
    dt_day = datetime(2026, 10, 15, 14, 0, tzinfo=pkt)
    assert is_in_quiet_hours(dt_day, "21:00", "08:00") is False


@pytest.mark.asyncio
async def test_patient_messaging_opt_out_endpoint(
    receptionist_auth: dict,
    test_session: AsyncSession,
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    patient = Patient(
        first_name="Hassan",
        last_name="Raza",
        phone="+923009988771",
        email="hassan.raza@example.com",
        messaging_opt_out=False,
    )
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    patient_repo = PostgresPatientRepository(test_session)
    saved_patient = await patient_repo.save(patient)

    # Opt-out
    res = await client.patch(
        f"/api/v1/reception/patients/{saved_patient.id}/messaging-opt-out",
        json={"optOut": True},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["messagingOptOut"] is True

    # Check persistence
    refreshed = await patient_repo.get_by_id(saved_patient.id)
    assert refreshed.messaging_opt_out is True

    # Opt back in
    res2 = await client.patch(
        f"/api/v1/reception/patients/{saved_patient.id}/messaging-opt-out",
        json={"optOut": False},
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.json()["messagingOptOut"] is False


@pytest.mark.asyncio
async def test_admin_messaging_settings_and_scheduler(
    admin_auth: dict,
    test_session: AsyncSession,
):
    client: AsyncClient = admin_auth["client"]
    headers = admin_auth["headers"]

    # GET settings
    get_res = await client.get(
        "/api/v1/admin/messaging/settings",
        headers=headers,
    )
    assert get_res.status_code == 200
    settings_data = get_res.json()
    assert "messagingProviderMode" in settings_data
    assert "quietHoursEnabled" in settings_data

    # PUT settings
    put_res = await client.put(
        "/api/v1/admin/messaging/settings",
        json={
            "quietHoursEnabled": True,
            "quietHoursStart": "22:00",
            "quietHoursEnd": "07:00",
            "messagingProviderMode": "simulated",
            "reminderTemplate": "Hello {patient_name}, reminder for {appointment_date} at {appointment_time}.",
        },
        headers=headers,
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["quietHoursStart"] == "22:00"
    assert updated["quietHoursEnd"] == "07:00"

    # Run scheduler (forced override to bypass quiet hours during test run)
    sched_res = await client.post(
        "/api/v1/admin/messaging/run-scheduler?force_quiet_hours=true",
        headers=headers,
    )
    assert sched_res.status_code == 200
    sched_data = sched_res.json()
    assert sched_data["skippedQuietHours"] is False
    assert sched_data["simulated"] is True

    # GET message logs
    logs_res = await client.get(
        "/api/v1/admin/messaging/logs",
        headers=headers,
    )
    assert logs_res.status_code == 200
    assert "items" in logs_res.json()


@pytest.mark.asyncio
async def test_automated_reminders_skips_opted_out_patients(
    receptionist_auth: dict,
    admin_auth: dict,
    test_session: AsyncSession,
):
    r_client: AsyncClient = receptionist_auth["client"]
    r_headers = receptionist_auth["headers"]
    a_client: AsyncClient = admin_auth["client"]
    a_headers = admin_auth["headers"]

    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    target_date = date.today() + timedelta(days=2)

    # Patient A: opted out
    pat_a = await patient_repo.save(Patient(
        first_name="OptedOut",
        last_name="Patient",
        phone="+923001111111",
        messaging_opt_out=True,
    ))
    booking_a = await booking_repo.save(Booking(
        patient_id=pat_a.id,
        patient_full_name="OptedOut Patient",
        patient_phone="+923001111111",
        patient_email="optedout@example.com",
        preferred_date=target_date,
        preferred_time="10:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))

    # Patient B: opted in
    pat_b = await patient_repo.save(Patient(
        first_name="OptedIn",
        last_name="Patient",
        phone="+923002222222",
        messaging_opt_out=False,
    ))
    booking_b = await booking_repo.save(Booking(
        patient_id=pat_b.id,
        patient_full_name="OptedIn Patient",
        patient_phone="+923002222222",
        patient_email="optedin@example.com",
        preferred_date=target_date,
        preferred_time="11:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))

    # Check worklist returns optedOut flag
    wl_res = await r_client.get(
        f"/api/v1/reception/reminders?date={target_date.isoformat()}",
        headers=r_headers,
    )
    assert wl_res.status_code == 200
    items = wl_res.json()["items"]
    item_a = next(it for it in items if it["id"] == str(booking_a.id))
    item_b = next(it for it in items if it["id"] == str(booking_b.id))
    assert item_a["optedOut"] is True
    assert item_b["optedOut"] is False

    # Run scheduler forced
    sched_res = await a_client.post(
        f"/api/v1/admin/messaging/run-scheduler?target_date={target_date.isoformat()}&force_quiet_hours=true",
        headers=a_headers,
    )
    assert sched_res.status_code == 200
    data = sched_res.json()
    assert data["skippedOptOutCount"] >= 1
    assert data["dispatchedCount"] >= 1

    # Verify Booking B is marked reminded, but Booking A is not
    refreshed_a = await booking_repo.get_by_id(booking_a.id)
    refreshed_b = await booking_repo.get_by_id(booking_b.id)
    assert refreshed_a.reminded_at is None
    assert refreshed_b.reminded_at is not None


@pytest.mark.asyncio
async def test_twilio_sms_provider_mocked_http_and_fail_closed(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.application.services.messaging_provider import TwilioSmsProvider

    # 1. Fail closed when credentials are missing
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_FROM_NUMBER", raising=False)

    provider_unconfigured = TwilioSmsProvider()
    res_fail = await provider_unconfigured.send_message("+923001234567", "Test reminder")
    assert res_fail.success is False
    assert res_fail.provider == "twilio"
    assert "unconfigured" in res_fail.error.lower()

    # 2. Mocked HTTP success with valid env
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACmocked1234567890abcdef")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "mocked_auth_token_xyz")
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+15551234567")

    provider = TwilioSmsProvider()

    mock_resp = AsyncMock()
    mock_resp.status_code = 201
    mock_resp.json = MagicMock(return_value={"sid": "SMmockedsid987654321", "status": "queued"})

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        send_res = await provider.send_message("+923001234567", "Your appointment is confirmed.")
        assert send_res.success is True
        assert send_res.provider == "twilio"
        assert send_res.provider_message_id == "SMmockedsid987654321"
        assert send_res.status == "sent"
        # Ensure credentials are NOT leaked in result
        assert "mocked_auth_token_xyz" not in str(send_res)


@pytest.mark.asyncio
async def test_whatsapp_cloud_provider_mocked_http_and_fail_closed(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.application.services.messaging_provider import WhatsAppCloudProvider

    # 1. Fail closed when credentials are missing
    monkeypatch.delenv("WHATSAPP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_ID", raising=False)

    provider_unconfigured = WhatsAppCloudProvider()
    res_fail = await provider_unconfigured.send_message("+923001234567", "Test WhatsApp")
    assert res_fail.success is False
    assert res_fail.provider in ("whatsapp", "whatsapp_cloud")
    assert "unconfigured" in res_fail.error.lower()

    # 2. Mocked HTTP success
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "EAABmockedtoken123")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "109876543210")

    provider = WhatsAppCloudProvider()

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = MagicMock(return_value={"messages": [{"id": "wamid.HBgLMTIzNDU2"}]})

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        send_res = await provider.send_message("+923001234567", "Hello from clinic via WhatsApp.")
        assert send_res.success is True
        assert send_res.provider in ("whatsapp", "whatsapp_cloud")
        assert send_res.provider_message_id == "wamid.HBgLMTIzNDU2"
        assert send_res.status == "sent"
        assert "EAABmockedtoken123" not in str(send_res)


@pytest.mark.asyncio
async def test_reminder_creation_confirmed_only_and_admin_switches(test_session: AsyncSession):
    from zoneinfo import ZoneInfo
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.application.services.reception_service import ReceptionService

    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)
    message_repo = PostgresMessageRepository(test_session)
    task_repo = PostgresTaskRepository(test_session)
    lead_repo = PostgresLeadRepository(test_session)
    app_repo = PostgresAppointmentRepository(test_session)
    settings_repo = PostgresBookingSettingsRepository(test_session)

    service = ReceptionService(
        booking_repo=booking_repo,
        patient_repo=patient_repo,
        task_repo=task_repo,
        lead_repo=lead_repo,
        message_repo=message_repo,
        appointment_repo=app_repo,
        booking_settings_repo=settings_repo,
    )

    future_date = date.today() + timedelta(days=5)

    # 1. Confirmed booking -> creates 24h and 2h reminders
    booking_confirmed = await booking_repo.save(Booking(
        patient_full_name="Confirmed Patient",
        patient_phone="+923001234567",
        patient_email="confirmed@example.com",
        preferred_date=future_date,
        preferred_time="11:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))
    await service.schedule_booking_reminders(booking_confirmed)

    r_24h = await message_repo.get_by_booking_and_type(booking_confirmed.id, "reminder_24h")
    r_2h = await message_repo.get_by_booking_and_type(booking_confirmed.id, "reminder_2h")
    assert r_24h is not None
    assert r_2h is not None
    assert r_24h.booking_id == booking_confirmed.id
    assert r_2h.booking_id == booking_confirmed.id
    assert r_24h.delivery_status == "queued"
    assert r_2h.delivery_status == "queued"

    # 2. Non-confirmed bookings (requested, cancelled, no_show, completed) -> get NONE
    for non_confirmed_status in ["requested", "cancelled", "no_show", "completed"]:
        b = await booking_repo.save(Booking(
            patient_full_name=f"{non_confirmed_status.capitalize()} Patient",
            patient_phone="+923001234567",
            patient_email=f"{non_confirmed_status}@example.com",
            preferred_date=future_date,
            preferred_time="11:00",
            confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
            status=non_confirmed_status,
        ))
        await service.schedule_booking_reminders(b)
        rem = await message_repo.get_by_booking_and_type(b.id, "reminder_24h")
        assert rem is None, f"Expected no reminder for status {non_confirmed_status}"

    # 3. Past booking -> gets none
    past_booking = await booking_repo.save(Booking(
        patient_full_name="Past Patient",
        patient_phone="+923001234567",
        patient_email="past@example.com",
        preferred_date=date.today() - timedelta(days=2),
        preferred_time="10:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))
    await service.schedule_booking_reminders(past_booking)
    rem_past = await message_repo.get_by_booking_and_type(past_booking.id, "reminder_24h")
    assert rem_past is None


@pytest.mark.asyncio
async def test_quiet_hours_shift_moves_to_next_allowed_never_drops(test_session: AsyncSession):
    from zoneinfo import ZoneInfo
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.application.services.reception_service import ReceptionService, adjust_for_quiet_hours
    from app.domain.models.booking_crm import Message

    pkt = ZoneInfo("Asia/Karachi")
    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)
    message_repo = PostgresMessageRepository(test_session)
    task_repo = PostgresTaskRepository(test_session)
    lead_repo = PostgresLeadRepository(test_session)
    app_repo = PostgresAppointmentRepository(test_session)
    settings_repo = PostgresBookingSettingsRepository(test_session)

    service = ReceptionService(
        booking_repo=booking_repo,
        patient_repo=patient_repo,
        task_repo=task_repo,
        lead_repo=lead_repo,
        message_repo=message_repo,
        appointment_repo=app_repo,
        booking_settings_repo=settings_repo,
    )

    # Unit check adjust_for_quiet_hours
    late_night = datetime(2026, 10, 15, 23, 30, tzinfo=pkt)
    adjusted = adjust_for_quiet_hours(late_night, start_str="21:00", end_str="08:00")
    # Must shift to 08:00 next morning (never drop!)
    adj_pkt = adjusted.astimezone(pkt)
    assert adj_pkt.hour == 8
    assert adj_pkt.minute == 0
    assert adj_pkt.day == 16

    # Integration test during dispatch
    night_due = datetime(2026, 10, 15, 22, 0, tzinfo=pkt)
    msg = Message(
        content="Test quiet hours message",
        phone="+923001234567",
        channel="sms",
        status="pending",
        delivery_status="queued",
        scheduled_for=night_due,
        reminder_type="manual",
    )
    saved_msg = await message_repo.save(msg)

    res = await service.dispatch_due_reminders(as_of=night_due, force_quiet_hours=False)
    refreshed = await message_repo.get_by_id(saved_msg.id)
    assert refreshed.delivery_status == "quiet_hours_held"
    ref_dt = refreshed.scheduled_for.replace(tzinfo=timezone.utc) if refreshed.scheduled_for.tzinfo is None else refreshed.scheduled_for
    assert ref_dt > night_due.astimezone(timezone.utc)


@pytest.mark.asyncio
async def test_reschedule_and_cancel_recreates_pending_reminders(test_session: AsyncSession):
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.application.services.reception_service import ReceptionService

    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)
    message_repo = PostgresMessageRepository(test_session)
    task_repo = PostgresTaskRepository(test_session)
    lead_repo = PostgresLeadRepository(test_session)
    app_repo = PostgresAppointmentRepository(test_session)
    settings_repo = PostgresBookingSettingsRepository(test_session)

    service = ReceptionService(
        booking_repo=booking_repo,
        patient_repo=patient_repo,
        task_repo=task_repo,
        lead_repo=lead_repo,
        message_repo=message_repo,
        appointment_repo=app_repo,
        booking_settings_repo=settings_repo,
    )

    day1 = date.today() + timedelta(days=4)
    day2 = date.today() + timedelta(days=7)

    booking = await booking_repo.save(Booking(
        patient_full_name="Reschedule Patient",
        patient_phone="+923001234567",
        patient_email="reschedule@example.com",
        preferred_date=day1,
        preferred_time="10:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))
    await service.schedule_booking_reminders(booking)

    rem1 = await message_repo.get_by_booking_and_type(booking.id, "reminder_24h")
    assert rem1 is not None

    # Reschedule
    await service.reschedule_booking(
        booking_id=booking.id,
        preferred_date=day2,
        preferred_time="14:00",
    )

    rem1_cancelled = await message_repo.get_by_id(rem1.id)
    assert rem1_cancelled.delivery_status == "cancelled"

    rem2 = await message_repo.get_by_booking_and_type(booking.id, "reminder_24h")
    assert rem2 is not None
    assert rem2.id != rem1.id
    assert rem2.delivery_status == "queued"

    # Cancel booking cancels pending reminders
    await service.cancel_booking(booking_id=booking.id, reason="Patient request")
    rem2_cancelled = await message_repo.get_by_id(rem2.id)
    assert rem2_cancelled.delivery_status == "cancelled"


@pytest.mark.asyncio
async def test_dispatch_opt_out_skips_patient_with_reason(test_session: AsyncSession):
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.application.services.reception_service import ReceptionService
    from app.domain.models.booking_crm import Message

    patient_repo = PostgresPatientRepository(test_session)
    message_repo = PostgresMessageRepository(test_session)
    service = ReceptionService(
        booking_repo=PostgresBookingRepository(test_session),
        patient_repo=patient_repo,
        task_repo=PostgresTaskRepository(test_session),
        lead_repo=PostgresLeadRepository(test_session),
        message_repo=message_repo,
        appointment_repo=PostgresAppointmentRepository(test_session),
        booking_settings_repo=PostgresBookingSettingsRepository(test_session),
    )

    # Patient with channel = none
    patient = await patient_repo.save(Patient(
        first_name="Opted",
        last_name="Out",
        phone="+923001239999",
        preferred_channel="none",
    ))

    msg = await message_repo.save(Message(
        patient_id=patient.id,
        phone="+923001239999",
        content="Reminder message",
        channel="sms",
        status="pending",
        delivery_status="queued",
        scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=10),
    ))

    res = await service.dispatch_due_reminders(force_quiet_hours=True)
    refreshed = await message_repo.get_by_id(msg.id)
    assert refreshed.delivery_status == "opted_out"
    assert "opted out" in refreshed.error_detail.lower()
    assert res["skippedOptOutCount"] >= 1


@pytest.mark.asyncio
async def test_dispatch_retries_capped_at_three_then_failed(test_session: AsyncSession, monkeypatch):
    from unittest.mock import AsyncMock, patch
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.application.services.reception_service import ReceptionService
    from app.application.services.messaging_provider import MessageDeliveryResult
    from app.domain.models.booking_crm import Message

    message_repo = PostgresMessageRepository(test_session)
    service = ReceptionService(
        booking_repo=PostgresBookingRepository(test_session),
        patient_repo=PostgresPatientRepository(test_session),
        task_repo=PostgresTaskRepository(test_session),
        lead_repo=PostgresLeadRepository(test_session),
        message_repo=message_repo,
        appointment_repo=PostgresAppointmentRepository(test_session),
        booking_settings_repo=PostgresBookingSettingsRepository(test_session),
    )

    msg = await message_repo.save(Message(
        phone="+923009999999",
        content="Testing retries",
        channel="sms",
        status="pending",
        delivery_status="queued",
        scheduled_for=datetime.now(timezone.utc) - timedelta(minutes=5),
        attempts=0,
    ))

    mock_fail = AsyncMock(return_value=MessageDeliveryResult(
        success=False,
        status="failed",
        channel="sms",
        recipient="+923009999999",
        provider="simulated",
        error="Temporary upstream gateway error",
    ))

    with patch("app.application.services.messaging_provider.SimulatedMessagingProvider.send_message", mock_fail):
        # Attempt 1
        await service.dispatch_due_reminders(force_quiet_hours=True)
        m1 = await message_repo.get_by_id(msg.id)
        assert m1.attempts == 1
        assert m1.delivery_status == "queued"

        # Attempt 2
        await service.dispatch_due_reminders(force_quiet_hours=True)
        m2 = await message_repo.get_by_id(msg.id)
        assert m2.attempts == 2
        assert m2.delivery_status == "queued"

        # Attempt 3 (capped -> failed)
        await service.dispatch_due_reminders(force_quiet_hours=True)
        m3 = await message_repo.get_by_id(msg.id)
        assert m3.attempts == 3
        assert m3.delivery_status == "failed"
        assert m3.status == "failed"


@pytest.mark.asyncio
async def test_admin_send_test_message_permissions_and_honesty(
    receptionist_auth: dict,
    admin_auth: dict,
):
    r_client: AsyncClient = receptionist_auth["client"]
    r_headers = receptionist_auth["headers"]
    a_client: AsyncClient = admin_auth["client"]
    a_headers = admin_auth["headers"]

    # 1. Non-admin forbidden
    rec_res = await r_client.post(
        "/api/v1/admin/messaging/send-test",
        json={"recipient": "+923001234567", "message": "Receptionist test", "channel": "sms"},
        headers=r_headers,
    )
    assert rec_res.status_code == 403

    # 2. Admin success
    adm_res = await a_client.post(
        "/api/v1/admin/messaging/send-test",
        json={"recipient": "+923001234567", "message": "Admin test message", "channel": "sms"},
        headers=a_headers,
    )
    assert adm_res.status_code == 200
    data = adm_res.json()
    assert data["success"] is True
    # Honest simulated status
    assert data["status"] == "simulated"
    assert data["status"] != "sent"


@pytest.mark.asyncio
async def test_payment_fee_override_and_end_of_day_void_filter(
    test_session: AsyncSession,
):
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.infrastructure.repositories.postgres_visit_payment_repo import PostgresVisitPaymentRepository
    from app.application.services.reception_service import ReceptionService

    booking_repo = PostgresBookingRepository(test_session)
    payment_repo = PostgresVisitPaymentRepository(test_session)
    service = ReceptionService(
        booking_repo=booking_repo,
        patient_repo=PostgresPatientRepository(test_session),
        task_repo=PostgresTaskRepository(test_session),
        lead_repo=PostgresLeadRepository(test_session),
        message_repo=PostgresMessageRepository(test_session),
        appointment_repo=PostgresAppointmentRepository(test_session),
        booking_settings_repo=PostgresBookingSettingsRepository(test_session),
        payment_repo=payment_repo,
    )

    booking = await booking_repo.save(Booking(
        patient_full_name="Payment Patient",
        patient_phone="+923001234567",
        patient_email="payment@example.com",
        preferred_date=date.today(),
        preferred_time="11:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))

    # Record payment with fee override reason
    payment1 = await service.record_visit_payment(
        booking_id=booking.id,
        amount_cents=450000,
        amount_charged_cents=450000,
        method="cash",
        notes="Routine visit",
        override_reason="Director approval promo discount",
    )
    assert "[Fee Override: Director approval promo discount]" in payment1.notes
    assert payment1.amount_charged_cents == 450000

    # Record second payment that will be voided
    payment2 = await service.record_visit_payment(
        booking_id=booking.id,
        amount_cents=100000,
        amount_charged_cents=100000,
        method="cash",
        notes="Accidental duplicate entry",
    )

    # Void payment2
    await service.void_visit_payment(
        booking_id=booking.id,
        payment_id=payment2.id,
        user_id=uuid4(),
        reason="Duplicate payment cashier error",
    )

    # Check end of day summary: must only include active (non-voided) payments
    summary = await service.get_end_of_day_payments_summary(target_date=date.today())
    assert summary["cashCents"] == 450000
    assert summary["totalCents"] == 450000
    assert summary["paymentCount"] == 1


@pytest.mark.asyncio
async def test_configurable_patient_file_number_prefix_md_default(test_session: AsyncSession):
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.application.services.reception_service import ReceptionService
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository

    patient_repo = PostgresPatientRepository(test_session)
    settings_repo = PostgresBookingSettingsRepository(test_session)
    service = ReceptionService(
        booking_repo=PostgresBookingRepository(test_session),
        patient_repo=patient_repo,
        task_repo=PostgresTaskRepository(test_session),
        lead_repo=PostgresLeadRepository(test_session),
        message_repo=PostgresMessageRepository(test_session),
        appointment_repo=PostgresAppointmentRepository(test_session),
        booking_settings_repo=settings_repo,
    )

    # 1. Default settings has MD- prefix
    settings = await settings_repo.get_settings()
    assert settings.file_number_prefix == "MD-"

    # 2. Created patient with no prefix specified receives MD- prefix
    pat1, _ = await service.create_patient(
        first_name="Tariq",
        last_name="Ali",
        phone="+923001230001",
        check_duplicate=False,
    )
    assert pat1.file_number.startswith("MD-")


@pytest.mark.asyncio
async def test_no_writes_to_appointments_legacy_during_booking_and_reminders(test_session: AsyncSession):
    from sqlalchemy import text
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.application.services.reception_service import ReceptionService

    # 1. Initial count of legacy rows
    res_before = await test_session.execute(text("SELECT COUNT(*) FROM appointments_legacy"))
    count_before = res_before.scalar()

    # 2. Execute full booking lifecycle in ReceptionService
    service = ReceptionService(
        booking_repo=PostgresBookingRepository(test_session),
        patient_repo=PostgresPatientRepository(test_session),
        task_repo=PostgresTaskRepository(test_session),
        lead_repo=PostgresLeadRepository(test_session),
        message_repo=PostgresMessageRepository(test_session),
        appointment_repo=PostgresAppointmentRepository(test_session),
        booking_settings_repo=PostgresBookingSettingsRepository(test_session),
    )

    booking = await service.booking_repo.save(Booking(
        patient_full_name="Legacy Isolation Patient",
        patient_phone="+923009990001",
        patient_email="legacy.iso@example.com",
        preferred_date=date.today(),
        preferred_time="14:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))
    assert booking.id is not None

    # Schedule reminders
    await service.schedule_booking_reminders(booking)

    # 3. Assert zero rows added to appointments_legacy
    res_after = await test_session.execute(text("SELECT COUNT(*) FROM appointments_legacy"))
    count_after = res_after.scalar()
    assert count_after == count_before, "Writing to appointments_legacy is strictly forbidden."


@pytest.mark.asyncio
async def test_payment_amounts_consistent_end_to_end_rupees_cents(test_session: AsyncSession):
    from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
    from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
    from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
    from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
    from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
    from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
    from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
    from app.infrastructure.repositories.postgres_visit_payment_repo import PostgresVisitPaymentRepository
    from app.application.services.reception_service import ReceptionService

    booking_repo = PostgresBookingRepository(test_session)
    payment_repo = PostgresVisitPaymentRepository(test_session)
    service = ReceptionService(
        booking_repo=booking_repo,
        patient_repo=PostgresPatientRepository(test_session),
        task_repo=PostgresTaskRepository(test_session),
        lead_repo=PostgresLeadRepository(test_session),
        message_repo=PostgresMessageRepository(test_session),
        appointment_repo=PostgresAppointmentRepository(test_session),
        booking_settings_repo=PostgresBookingSettingsRepository(test_session),
        payment_repo=payment_repo,
    )

    booking = await booking_repo.save(Booking(
        patient_full_name="Rupee Cents Patient",
        patient_phone="+923001239999",
        patient_email="rupees@example.com",
        preferred_date=date.today(),
        preferred_time="15:00",
        confirmation_id=f"MD-{uuid4().hex[:6].upper()}",
        status="confirmed",
    ))

    # Fee is 5,000 PKR (represented as 500,000 cents in database)
    payment = await service.record_visit_payment(
        booking_id=booking.id,
        amount_cents=500000,
        amount_charged_cents=500000,
        currency="PKR",
        method="cash",
    )
    assert payment.amount_cents == 500000
    assert payment.amount_charged_cents == 500000
    assert payment.currency == "PKR"

    # End-of-day summary reflects consistent totals
    summary = await service.get_end_of_day_payments_summary(target_date=date.today())
    assert summary["cashCents"] >= 500000
    assert summary["totalCents"] >= 500000

