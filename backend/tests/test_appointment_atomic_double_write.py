import pytest
from datetime import date
from unittest.mock import AsyncMock
from uuid import uuid4

from sqlalchemy import select

from app.application.dtos.appointment_dto import AppointmentCreateRequest
from app.application.services.appointment_service import AppointmentService
from app.domain.models.appointment import Appointment
from app.domain.models.booking_settings import BookingSettings, WorkingHours
from app.domain.repositories.booking_settings_repo import BookingSettingsRepository
from app.application.services.availability_service import AvailabilityService
from app.infrastructure.database.orm_models import AppointmentORM, BookingORM
from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository


@pytest.mark.asyncio
async def test_appointment_atomic_double_write_success(test_session):
    """
    Verifies that a normal appointment request creation writes both the
    canonical BookingORM row and the legacy AppointmentORM row atomically.
    """
    appt_repo = PostgresAppointmentRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)

    mock_settings_repo = AsyncMock(spec=BookingSettingsRepository)
    mock_settings_repo.get_settings.return_value = BookingSettings(
        id=uuid4(),
        booking_mode="open",
        advance_booking_days=60,
    )
    mock_settings_repo.list_working_hours.return_value = [
        WorkingHours(id=uuid4(), day_of_week=i, open_time="08:00", close_time="18:00", is_closed=False)
        for i in range(7)
    ]
    mock_settings_repo.list_closures.return_value = []

    mock_avail_service = AsyncMock(spec=AvailabilityService)
    mock_avail_service.is_slot_available.return_value = True

    service = AppointmentService(
        repository=appt_repo,
        booking_repo=booking_repo,
        patient_repo=patient_repo,
        booking_settings_repo=mock_settings_repo,
        availability_service=mock_avail_service,
        session=test_session,
    )

    req = AppointmentCreateRequest(
        preferredDate=date.today().isoformat(),
        preferredTime="10:00 AM",
        fullName="James Whitmore",
        phone="555-123-4567",
        email="james.whitmore@example.com",
        serviceId="cleanings-exams",
        notes="Regular checkup",
    )

    res = await service.create_appointment_request(req)
    assert res.success is True
    confirmation_id = res.confirmationId

    # Verify both rows were written
    booking_res = await test_session.execute(
        select(BookingORM).where(BookingORM.confirmation_id == confirmation_id)
    )
    saved_booking = booking_res.scalar_one_or_none()
    assert saved_booking is not None
    assert saved_booking.patient_full_name == "James Whitmore"

    appt_res = await test_session.execute(
        select(AppointmentORM).where(AppointmentORM.confirmation_id == confirmation_id)
    )
    saved_appt = appt_res.scalar_one_or_none()
    assert saved_appt is not None
    assert saved_appt.patient_full_name == "James Whitmore"


@pytest.mark.asyncio
async def test_appointment_atomic_double_write_failure_leaves_neither_row(test_session):
    """
    Verifies that when legacy appointment write fails after the booking write,
    the savepoint rolls back so that neither the booking row nor the appointment row
    remains in the database.
    """
    appt_repo = PostgresAppointmentRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)

    # Intentionally cause appt_repo.save to fail after booking_repo.save has written to the session
    original_save = appt_repo.save

    async def failing_save(appointment: Appointment) -> Appointment:
        raise RuntimeError("Simulated database failure during legacy appointment save")

    appt_repo.save = failing_save

    mock_settings_repo = AsyncMock(spec=BookingSettingsRepository)
    mock_settings_repo.get_settings.return_value = BookingSettings(
        id=uuid4(),
        booking_mode="open",
        advance_booking_days=60,
    )
    mock_settings_repo.list_working_hours.return_value = [
        WorkingHours(id=uuid4(), day_of_week=i, open_time="08:00", close_time="18:00", is_closed=False)
        for i in range(7)
    ]
    mock_settings_repo.list_closures.return_value = []

    mock_avail_service = AsyncMock(spec=AvailabilityService)
    mock_avail_service.is_slot_available.return_value = True

    service = AppointmentService(
        repository=appt_repo,
        booking_repo=booking_repo,
        patient_repo=patient_repo,
        booking_settings_repo=mock_settings_repo,
        availability_service=mock_avail_service,
        session=test_session,
    )

    req = AppointmentCreateRequest(
        preferredDate=date.today().isoformat(),
        preferredTime="11:00 AM",
        fullName="Atomic Failure Test",
        phone="555-987-6543",
        email="atomic.fail@example.com",
        serviceId="cleanings-exams",
        notes="Atomic checkup",
    )

    with pytest.raises(RuntimeError, match="Simulated database failure"):
        await service.create_appointment_request(req)

    # Verify that NEITHER row was persisted to the database
    bookings_res = await test_session.execute(
        select(BookingORM).where(BookingORM.patient_phone == "555-987-6543")
    )
    assert len(bookings_res.scalars().all()) == 0, "Booking row must be rolled back on failure"

    appts_res = await test_session.execute(
        select(AppointmentORM).where(AppointmentORM.patient_phone == "555-987-6543")
    )
    assert len(appts_res.scalars().all()) == 0, "Appointment row must not be persisted on failure"
