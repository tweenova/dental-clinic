import random
from datetime import date, datetime, timezone
from sqlalchemy.exc import IntegrityError

from app.application.dtos.appointment_dto import (
    AppointmentCreateRequest,
    AppointmentCreateResponse,
)
from app.core.logging import logger
from app.domain.models.appointment import Appointment
from app.domain.models.booking_crm import Booking, Patient
from app.domain.repositories.appointment_repo import AppointmentRepository
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.patient_repo import PatientRepository


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
    ) -> None:
        """Stores repositories for appointments, canonical bookings, and patient charts."""
        self._repository = repository
        self._booking_repo = booking_repo
        self._patient_repo = patient_repo

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
        """
        parsed_date = date.fromisoformat(request.preferredDate)

        # Attempt creation with up to 2 retries on confirmation_id unique constraint collision
        max_attempts = 3
        for attempt in range(max_attempts):
            confirmation_id = self.generate_confirmation_id()
            patient_id = None

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


            try:
                saved = await self._repository.save(appointment)
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
                if attempt < max_attempts - 1:
                    logger.warning("Collision encountered on confirmation_id=%s, retrying...", confirmation_id)
                    continue
                logger.error("Failed to generate unique confirmation_id after %d attempts.", max_attempts)
                raise
