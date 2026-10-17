import random
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, status as http_status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.appointment_dto import (
    AppointmentCreateRequest,
    AppointmentCreateResponse,
)
from app.core.logging import logger
from app.domain.models.appointment import Appointment
from app.domain.models.booking_crm import Booking, Patient
from app.domain.repositories.appointment_repo import AppointmentRepository
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.booking_settings_repo import BookingSettingsRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.application.services.reception_service import _acquire_schedule_lock
from app.application.services.availability_service import AvailabilityService


class AppointmentService:
    """
    Coordinates the business steps needed to book an appointment.

    This service creates unique confirmation codes, handles collisions if two patients
    generate the same code, ensures patient deduplication, and stores canonical bookings
    for reception triage as well as legacy appointments for backward compatibility.
    """

    def __init__(
        self,
        repository: AppointmentRepository,
        booking_repo: Optional[BookingRepository] = None,
        patient_repo: Optional[PatientRepository] = None,
        booking_settings_repo: Optional[BookingSettingsRepository] = None,
        availability_service: Optional[AvailabilityService] = None,
        session: Optional[AsyncSession] = None,
    ) -> None:
        """Stores repositories for appointments, canonical bookings, patient charts, and clinic availability rules."""
        self._repository = repository
        self._booking_repo = booking_repo
        self._patient_repo = patient_repo
        self._booking_settings_repo = booking_settings_repo
        self._availability_service = availability_service
        self._session = session

    @staticmethod
    def generate_confirmation_id() -> str:
        """Creates a readable tracking ID in the format MD-YYYY-XXXX (such as MD-2026-4821)."""
        year = datetime.now(timezone.utc).year
        suffix = random.randint(1000, 9999)
        return f"MD-{year}-{suffix}"

    async def create_appointment_request(
        self,
        request: AppointmentCreateRequest,
    ) -> AppointmentCreateResponse:
        """
        Takes patient booking details, assigns a tracking ID, deduplicates or creates the patient chart,
        and saves both the canonical reception booking and legacy appointment record.
        Enforces emergency pause, weekly closed days, planned closures, and advance booking window.
        """
        parsed_date = date.fromisoformat(request.preferredDate)

        # Enforce clinic booking settings, emergency pause, weekly closed days, and closures
        if self._booking_settings_repo is not None:
            settings = await self._booking_settings_repo.get_settings()
            if settings.booking_mode != "open":
                msg = settings.pause_message or "Online booking is temporarily unavailable. Please call our clinic to schedule."
                raise HTTPException(
                    status_code=http_status.HTTP_423_LOCKED,
                    detail=msg,
                )

            today_utc = datetime.now(timezone.utc).date()
            if settings.advance_booking_days and parsed_date > today_utc + timedelta(days=settings.advance_booking_days):
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Preferred appointment date cannot be more than {settings.advance_booking_days} days in advance.",
                )

            # Weekly closed days validation
            working_hours = await self._booking_settings_repo.list_working_hours()
            dow = parsed_date.weekday()  # 0=Mon .. 6=Sun
            wh = next((h for h in working_hours if h.day_of_week == dow), None)
            if wh and wh.is_closed:
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Clinic is closed on {wh.day_name}s.",
                )

            # Planned calendar closures validation
            closures = await self._booking_settings_repo.list_closures()
            for c in closures:
                if c.start_date <= parsed_date <= c.end_date:
                    closure_reason = f": {c.reason}" if c.reason else ""
                    raise HTTPException(
                        status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Clinic is closed on {parsed_date.isoformat()}{closure_reason}.",
                    )

        # Enforce advisory lock and availability validation
        async with _acquire_schedule_lock(self._booking_repo, None, parsed_date):
            if self._availability_service is not None:
                is_available = await self._availability_service.is_slot_available(
                    target_date=parsed_date,
                    time_str=request.preferredTime,
                    service_id=request.serviceId,
                    team_member_id=None,
                )
                if not is_available:
                    raise HTTPException(
                        status_code=http_status.HTTP_409_CONFLICT,
                        detail="Double-booking conflict: The selected time slot is no longer available. Please select another slot.",
                    )

            # Attempt creation with up to 2 retries on confirmation_id unique constraint collision
            max_attempts = 3
            for attempt in range(max_attempts):
                confirmation_id = self.generate_confirmation_id()
                patient_id = None

                db_session = self._session or getattr(self._repository, "_session", None) or getattr(self._booking_repo, "_session", None)
                savepoint_ctx = db_session.begin_nested() if (db_session is not None and hasattr(db_session, "begin_nested")) else None

                try:
                    if savepoint_ctx is not None:
                        await savepoint_ctx.__aenter__()

                    # Deduplicate or create patient record if patient repository is wired
                    if self._patient_repo is not None:
                        names = request.fullName.strip().split()
                        first = names[0] if names else "Patient"
                        last = " ".join(names[1:]) if len(names) > 1 else "Unknown"
                        dups = await self._patient_repo.find_duplicates(
                            first_name=first,
                            last_name=last,
                            phone=request.phone.strip(),
                            email=request.email.strip().lower() if request.email else None,
                        )
                        if dups:
                            patient_id = dups[0].id
                        else:
                            new_pat = Patient(
                                first_name=first,
                                last_name=last,
                                phone=request.phone.strip(),
                                email=request.email.strip().lower() if request.email else None,
                            )
                            saved_pat = await self._patient_repo.save(new_pat)
                            patient_id = saved_pat.id

                    # Create canonical booking record for reception intake triage queue
                    if self._booking_repo is not None:
                        booking = Booking(
                            confirmation_id=confirmation_id,
                            preferred_date=parsed_date,
                            preferred_time=request.preferredTime,
                            patient_full_name=request.fullName.strip(),
                            patient_phone=request.phone.strip(),
                            patient_email=request.email.strip().lower() if request.email else "",
                            service_id=request.serviceId,
                            patient_id=patient_id,
                            status="requested",
                            notes=request.notes,
                            utm_source=request.utmSource,
                            utm_campaign=request.utmCampaign,
                        )
                        await self._booking_repo.save(booking)

                    appointment = Appointment(
                        confirmation_id=confirmation_id,
                        service_id=request.serviceId,
                        preferred_date=parsed_date,
                        preferred_time=request.preferredTime,
                        patient_full_name=request.fullName,
                        patient_phone=request.phone,
                        patient_email=request.email,
                        notes=request.notes,
                        utm_source=request.utmSource,
                        utm_campaign=request.utmCampaign,
                    )

                    saved = await self._repository.save(appointment)

                    if savepoint_ctx is not None:
                        await savepoint_ctx.__aexit__(None, None, None)

                    # PHI-Safe Logging: Never log patient name, phone, email, notes, or insurance details
                    logger.info(
                        "Appointment request created: confirmation_id=%s, service=%s, date=%s",
                        saved.confirmation_id,
                        saved.service_id,
                        saved.preferred_date.isoformat(),
                    )

                    return AppointmentCreateResponse(
                        success=True,
                        confirmationId=saved.confirmation_id,
                        message=f"Appointment request received for {saved.preferred_date.isoformat()} at {saved.preferred_time}.",
                        estimatedCallbackWindow="Within 1 business hour (Monday to Thursday 8:00 AM to 6:00 PM Central)",
                    )
                except IntegrityError:
                    if savepoint_ctx is not None:
                        await savepoint_ctx.__aexit__(*sys.exc_info())
                    if attempt < max_attempts - 1:
                        logger.warning("Collision encountered on confirmation_id=%s, retrying...", confirmation_id)
                        continue
                    logger.error("Failed to generate unique confirmation_id after %d attempts.", max_attempts)
                    raise
                except Exception:
                    if savepoint_ctx is not None:
                        await savepoint_ctx.__aexit__(*sys.exc_info())
                    raise

