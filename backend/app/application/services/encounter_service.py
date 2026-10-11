from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from app.application.dtos.encounter_dto import CreateEncounterRequestDto
from app.domain.models.encounter import (
    ALLOWED_ENCOUNTER_TRANSITIONS,
    ClinicalEncounter,
    EncounterStatus,
)
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.encounter_repo import EncounterRepository
from app.domain.repositories.patient_repo import PatientRepository


class EncounterService:
    """
    Application service managing the clinical encounter lifecycle, validation,
    and server-side clinician scoping.
    """

    def __init__(
        self,
        encounter_repo: EncounterRepository,
        patient_repo: PatientRepository,
        booking_repo: BookingRepository,
    ):
        self.encounter_repo = encounter_repo
        self.patient_repo = patient_repo
        self.booking_repo = booking_repo

    async def create_encounter(
        self,
        clinician_id: UUID,
        clinic_id: Optional[UUID],
        dto: CreateEncounterRequestDto,
        is_admin: bool = False,
    ) -> ClinicalEncounter:
        """
        Creates a new clinical encounter bound to the authenticated clinician.
        """
        # 1. Verify patient existence
        patient = await self.patient_repo.get_by_id(dto.patientId)
        if not patient:
            raise ValueError(f"Patient with ID {dto.patientId} not found.")

        # 2. Validate booking linkage if supplied
        effective_clinic_id = clinic_id or patient.clinic_id
        booking = None
        if dto.bookingId:
            booking = await self.booking_repo.get_by_id(dto.bookingId)
            if not booking:
                raise ValueError(f"Booking with ID {dto.bookingId} not found.")

            if booking.patient_id != dto.patientId:
                raise ValueError("Booking does not belong to the specified patient.")

            if booking.clinic_id:
                effective_clinic_id = booking.clinic_id

            # Clinician assignment check on booking
            if booking.team_member_id and booking.team_member_id != clinician_id and not is_admin:
                raise PermissionError("Cannot create encounter for an appointment assigned to another clinician.")

            # Concurrency/Collision check: 1 active encounter per booking
            existing_active = await self.encounter_repo.get_active_by_booking_id(dto.bookingId)
            if existing_active:
                raise ValueError("ACTIVE_ENCOUNTER_EXISTS: An active encounter already exists for this booking.")

            # If booking is unassigned, assign it to the creating clinician
            if not booking.team_member_id:
                booking.team_member_id = clinician_id
                await self.booking_repo.save(booking)

        # 3. Validate initial status
        initial_status_str = (dto.status or "in_progress").lower()
        if initial_status_str not in (EncounterStatus.DRAFT.value, EncounterStatus.IN_PROGRESS.value):
            raise ValueError("Initial encounter status must be either 'draft' or 'in_progress'.")

        now = datetime.now(timezone.utc)
        encounter = ClinicalEncounter(
            patient_id=dto.patientId,
            clinician_id=clinician_id,
            clinic_id=effective_clinic_id,
            booking_id=dto.bookingId,
            status=initial_status_str,
            chief_complaint=dto.chiefComplaint,
            reason_for_visit=dto.reasonForVisit,
            started_at=now,
            ended_at=None,
            created_at=now,
            updated_at=now,
        )

        return await self.encounter_repo.save(encounter)

    async def get_encounter(
        self,
        encounter_id: UUID,
        current_user_team_member_id: Optional[UUID],
        is_admin: bool = False,
    ) -> ClinicalEncounter:
        """
        Retrieves a single encounter with clinician ownership verification.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        if not is_admin:
            if not current_user_team_member_id or encounter.clinician_id != current_user_team_member_id:
                raise PermissionError("Access forbidden: You are not authorized to view this encounter.")

        return encounter

    async def get_active_encounter_by_booking(
        self,
        booking_id: UUID,
        current_user_team_member_id: Optional[UUID],
        is_admin: bool = False,
    ) -> Optional[ClinicalEncounter]:
        """
        Fetches active encounter for an operational booking.
        """
        encounter = await self.encounter_repo.get_active_by_booking_id(booking_id)
        if not encounter:
            return None

        if not is_admin:
            if not current_user_team_member_id or encounter.clinician_id != current_user_team_member_id:
                raise PermissionError("Access forbidden: You are not authorized to view this encounter.")

        return encounter

    async def list_patient_encounters(
        self,
        patient_id: UUID,
        current_user_team_member_id: Optional[UUID],
        is_admin: bool = False,
    ) -> List[ClinicalEncounter]:
        """
        Lists chronological historical encounters for a patient.
        """
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise ValueError(f"Patient with ID {patient_id} not found.")

        # Fail closed for unlinked non-admin doctors
        if not is_admin and not current_user_team_member_id:
            raise PermissionError("Access forbidden: Doctor account is not linked to a clinical staff profile.")

        return await self.encounter_repo.list_by_patient_id(patient_id)

    async def update_encounter_status(
        self,
        encounter_id: UUID,
        new_status_str: str,
        current_user_team_member_id: Optional[UUID],
        is_admin: bool = False,
    ) -> ClinicalEncounter:
        """
        Transitions an encounter's lifecycle status according to defined transition rules.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        if not is_admin:
            if not current_user_team_member_id or encounter.clinician_id != current_user_team_member_id:
                raise PermissionError("Access forbidden: You cannot modify this encounter.")

        target_status = new_status_str.strip().lower()
        valid_statuses = {s.value for s in EncounterStatus}
        if target_status not in valid_statuses:
            raise ValueError(f"Invalid encounter status '{new_status_str}'. Valid statuses: {valid_statuses}")

        try:
            curr_enum = EncounterStatus(encounter.status)
            target_enum = EncounterStatus(target_status)
        except ValueError:
            raise ValueError("Status parsing error.")

        if curr_enum == target_enum:
            return encounter

        allowed = ALLOWED_ENCOUNTER_TRANSITIONS.get(curr_enum, set())
        if target_enum not in allowed:
            raise ValueError(
                f"Invalid encounter status transition from '{curr_enum.value}' to '{target_enum.value}'."
            )

        now = datetime.now(timezone.utc)
        encounter.status = target_enum.value
        encounter.updated_at = now

        # Timestamp semantics: finalize ended_at when moving to terminal states
        if target_enum in (EncounterStatus.COMPLETED, EncounterStatus.CANCELLED):
            if not encounter.ended_at:
                encounter.ended_at = now
        elif target_enum == EncounterStatus.IN_PROGRESS and encounter.status == EncounterStatus.DRAFT.value:
            encounter.started_at = now

        return await self.encounter_repo.save(encounter)

