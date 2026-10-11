from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from app.application.dtos.clinical_note_dto import (
    AmendNoteRequestDto,
    SaveDraftNoteRequestDto,
)
from app.domain.models.clinical_note import ClinicalNote, NoteStatus
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.clinical_note_repo import ClinicalNoteRepository
from app.domain.repositories.encounter_repo import EncounterRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository


class ClinicalNoteService:
    """
    Service managing structured SOAP note creation, draft saving, authorized signing,
    immutable revision amendments, cross-clinic isolation, and audit logging.
    """

    def __init__(
        self,
        note_repo: ClinicalNoteRepository,
        encounter_repo: EncounterRepository,
        booking_repo: BookingRepository,
        patient_repo: PatientRepository,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
    ):
        self.note_repo = note_repo
        self.encounter_repo = encounter_repo
        self.booking_repo = booking_repo
        self.patient_repo = patient_repo
        self.activity_repo = activity_repo

    def _validate_clinic_boundary(
        self,
        encounter_clinic_id: Optional[UUID],
        user_clinic_id: Optional[UUID],
        is_admin: bool,
    ) -> None:
        """Enforces cross-clinic tenant boundary."""
        if not is_admin and user_clinic_id and encounter_clinic_id and encounter_clinic_id != user_clinic_id:
            raise PermissionError("Access forbidden: You cannot access encounters belonging to another clinic.")

    async def get_current_note(
        self,
        encounter_id: UUID,
        current_user_team_member_id: Optional[UUID],
        clinic_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> Optional[ClinicalNote]:
        """
        Retrieves the active current version of the SOAP note for an encounter.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        self._validate_clinic_boundary(encounter.clinic_id, clinic_id, is_admin)

        if not is_admin:
            if not current_user_team_member_id or encounter.clinician_id != current_user_team_member_id:
                raise PermissionError("Access forbidden: You are not authorized to view this encounter's clinical notes.")

        return await self.note_repo.get_current_by_encounter_id(encounter_id)

    async def get_historical_staff_notes(self, encounter_id: UUID) -> Optional[str]:
        """
        Retrieves backward-compatible historical staff notes from linked booking if present.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter or not encounter.booking_id:
            return None
        booking = await self.booking_repo.get_by_id(encounter.booking_id)
        return booking.staff_notes if booking else None

    async def save_draft_note(
        self,
        encounter_id: UUID,
        author_id: UUID,
        clinic_id: Optional[UUID],
        dto: SaveDraftNoteRequestDto,
        user_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> ClinicalNote:
        """
        Creates or updates a draft SOAP note. Rejects direct modification if already signed.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        self._validate_clinic_boundary(encounter.clinic_id, clinic_id, is_admin)

        if not is_admin and encounter.clinician_id != author_id:
            raise PermissionError("Access forbidden: You cannot modify notes for another clinician's encounter.")

        current_note = await self.note_repo.get_current_by_encounter_id(encounter_id)
        now = datetime.now(timezone.utc)

        if current_note:
            if current_note.is_signed:
                raise ValueError("Signed clinical notes cannot be directly edited. Create an amendment to revise this record.")

            current_note.subjective = dto.subjective
            current_note.objective = dto.objective
            current_note.assessment = dto.assessment
            current_note.plan = dto.plan
            current_note.updated_at = now
            saved_note = await self.note_repo.save(current_note)

            if self.activity_repo:
                await self.activity_repo.log_activity(
                    action="clinical_note.draft_updated",
                    entity_type="clinical_note",
                    entity_id=str(saved_note.id),
                    user_id=user_id,
                    details={
                        "encounter_id": str(encounter.id),
                        "patient_id": str(encounter.patient_id),
                        "revision_number": saved_note.revision_number,
                        "status": saved_note.status,
                    },
                )
            return saved_note

        # Create initial draft revision 1
        new_note = ClinicalNote(
            encounter_id=encounter.id,
            patient_id=encounter.patient_id,
            author_id=author_id,
            clinic_id=clinic_id or encounter.clinic_id,
            revision_number=1,
            is_current=True,
            status=NoteStatus.DRAFT.value,
            subjective=dto.subjective,
            objective=dto.objective,
            assessment=dto.assessment,
            plan=dto.plan,
            is_signed=False,
            signed_at=None,
            signed_by_id=None,
            amendment_reason=None,
            created_at=now,
            updated_at=now,
        )
        saved_new_note = await self.note_repo.save(new_note)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="clinical_note.draft_created",
                entity_type="clinical_note",
                entity_id=str(saved_new_note.id),
                user_id=user_id,
                details={
                    "encounter_id": str(encounter.id),
                    "patient_id": str(encounter.patient_id),
                    "revision_number": saved_new_note.revision_number,
                    "status": saved_new_note.status,
                },
            )
        return saved_new_note

    async def sign_note(
        self,
        encounter_id: UUID,
        author_id: UUID,
        user_id: Optional[UUID] = None,
        clinic_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> ClinicalNote:
        """
        Performs authenticated clinical sign-off on the current draft SOAP note.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        self._validate_clinic_boundary(encounter.clinic_id, clinic_id, is_admin)

        if not is_admin and encounter.clinician_id != author_id:
            raise PermissionError("Access forbidden: You cannot sign notes for another clinician's encounter.")

        current_note = await self.note_repo.get_current_by_encounter_id(encounter_id)
        if not current_note:
            raise ValueError("No clinical note exists for this encounter to sign.")

        if current_note.is_signed:
            raise ValueError("This clinical note is already signed.")

        now = datetime.now(timezone.utc)
        current_note.is_signed = True
        current_note.signed_at = now
        current_note.signed_by_id = author_id
        current_note.status = NoteStatus.SIGNED.value
        current_note.updated_at = now

        signed_note = await self.note_repo.save(current_note)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="clinical_note.signed",
                entity_type="clinical_note",
                entity_id=str(signed_note.id),
                user_id=user_id,
                details={
                    "encounter_id": str(encounter.id),
                    "patient_id": str(encounter.patient_id),
                    "revision_number": signed_note.revision_number,
                    "signed_by_id": str(author_id),
                },
            )

        return signed_note

    async def amend_note(
        self,
        encounter_id: UUID,
        author_id: UUID,
        clinic_id: Optional[UUID],
        dto: AmendNoteRequestDto,
        user_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> ClinicalNote:
        """
        Creates an immutable amended revision of a signed clinical note while preserving
        the original signed version.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        self._validate_clinic_boundary(encounter.clinic_id, clinic_id, is_admin)

        if not is_admin and encounter.clinician_id != author_id:
            raise PermissionError("Access forbidden: You cannot amend notes for another clinician's encounter.")

        current_note = await self.note_repo.get_current_by_encounter_id(encounter_id)
        if not current_note:
            raise ValueError("No clinical note exists to amend.")

        if not current_note.is_signed:
            raise ValueError("Cannot amend an unsigned draft. Save changes directly or sign before creating an amendment.")

        if not dto.amendmentReason or not dto.amendmentReason.strip():
            raise ValueError("An amendment reason is required to revise a signed clinical note.")

        now = datetime.now(timezone.utc)

        # 1. Archive current note snapshot as amended
        current_note.is_current = False
        current_note.status = NoteStatus.AMENDED.value
        current_note.updated_at = now
        await self.note_repo.save(current_note)

        # 2. Create new signed revision with amendment reason
        new_revision = ClinicalNote(
            encounter_id=encounter.id,
            patient_id=encounter.patient_id,
            author_id=author_id,
            clinic_id=clinic_id or encounter.clinic_id,
            revision_number=current_note.revision_number + 1,
            is_current=True,
            status=NoteStatus.SIGNED.value,
            subjective=dto.subjective if dto.subjective is not None else current_note.subjective,
            objective=dto.objective if dto.objective is not None else current_note.objective,
            assessment=dto.assessment if dto.assessment is not None else current_note.assessment,
            plan=dto.plan if dto.plan is not None else current_note.plan,
            is_signed=True,
            signed_at=now,
            signed_by_id=author_id,
            amendment_reason=dto.amendmentReason.strip(),
            created_at=now,
            updated_at=now,
        )
        saved_revision = await self.note_repo.save(new_revision)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="clinical_note.amended",
                entity_type="clinical_note",
                entity_id=str(saved_revision.id),
                user_id=user_id,
                details={
                    "encounter_id": str(encounter.id),
                    "patient_id": str(encounter.patient_id),
                    "previous_revision": current_note.revision_number,
                    "new_revision": saved_revision.revision_number,
                },
            )

        return saved_revision

    async def list_revisions(
        self,
        encounter_id: UUID,
        current_user_team_member_id: Optional[UUID],
        clinic_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> List[ClinicalNote]:
        """
        Lists full revision history for an encounter's clinical notes.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        self._validate_clinic_boundary(encounter.clinic_id, clinic_id, is_admin)

        if not is_admin:
            if not current_user_team_member_id or encounter.clinician_id != current_user_team_member_id:
                raise PermissionError("Access forbidden: You are not authorized to view this encounter's revision history.")

        return await self.note_repo.list_revisions_by_encounter_id(encounter_id)

