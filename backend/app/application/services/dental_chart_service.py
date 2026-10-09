from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID

from app.application.dtos.dental_chart_dto import (
    CorrectFindingRequestDto,
    CreateProcedureRequestDto,
    RecordFindingRequestDto,
    ResolveFindingRequestDto,
    UpdateProcedureStatusRequestDto,
)
from app.domain.models.dental_chart import (
    ALLOWED_PROCEDURE_TRANSITIONS,
    CONDITION_LABELS,
    DentalChartFinding,
    DentalProcedureRecord,
    FindingStatus,
    ProcedureStatus,
    surfaces_to_key,
    validate_finding_surfaces,
    validate_surfaces,
)
from app.domain.repositories.dental_chart_repo import DentalChartRepository
from app.domain.repositories.dental_procedure_repo import DentalProcedureRepository
from app.domain.repositories.encounter_repo import EncounterRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.domain.repositories.service_repo import ServiceRepository
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository


class DentalChartService:
    """
    Application service managing dental chart findings and procedure records:
    cumulative chart state vs encounter history, in-place corrections with audit,
    finding resolution, and validated procedure status transitions.
    All author/completion identities are derived server-side from the caller
    passed in by the API layer (which reads the authenticated user).
    """

    def __init__(
        self,
        chart_repo: DentalChartRepository,
        procedure_repo: DentalProcedureRepository,
        encounter_repo: EncounterRepository,
        patient_repo: PatientRepository,
        service_repo: ServiceRepository,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
    ):
        self.chart_repo = chart_repo
        self.procedure_repo = procedure_repo
        self.encounter_repo = encounter_repo
        self.patient_repo = patient_repo
        self.service_repo = service_repo
        self.activity_repo = activity_repo

    def _validate_clinic_boundary(
        self,
        record_clinic_id: Optional[UUID],
        user_clinic_id: Optional[UUID],
        is_admin: bool,
    ) -> None:
        """Enforces cross-clinic tenant boundary (same rule as the clinical note service)."""
        if not is_admin and user_clinic_id and record_clinic_id and record_clinic_id != user_clinic_id:
            raise PermissionError("Access forbidden: You cannot access records belonging to another clinic.")

    async def _require_patient_access(
        self,
        patient_id: UUID,
        current_user_team_member_id: Optional[UUID],
        clinic_id: Optional[UUID],
        is_admin: bool,
    ) -> None:
        """Validates patient existence, tenant boundary, and fail-closed clinician linkage."""
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise ValueError(f"Patient with ID {patient_id} not found.")

        if not is_admin and not current_user_team_member_id:
            raise PermissionError("Access forbidden: Doctor account is not linked to a clinical staff profile.")

        self._validate_clinic_boundary(patient.clinic_id, clinic_id, is_admin)

    async def _require_encounter_access(
        self,
        encounter_id: UUID,
        current_user_team_member_id: Optional[UUID],
        clinic_id: Optional[UUID],
        is_admin: bool,
        for_write: bool,
    ):
        """
        Loads an encounter and enforces tenant boundary plus clinician assignment.
        Write operations require the encounter to be assigned to the calling clinician.
        """
        encounter = await self.encounter_repo.get_by_id(encounter_id)
        if not encounter:
            raise ValueError(f"Clinical encounter with ID {encounter_id} not found.")

        if not is_admin and not current_user_team_member_id:
            raise PermissionError("Access forbidden: Doctor account is not linked to a clinical staff profile.")

        self._validate_clinic_boundary(encounter.clinic_id, clinic_id, is_admin)

        if for_write and not is_admin and encounter.clinician_id != current_user_team_member_id:
            raise PermissionError(
                "Access forbidden: You cannot modify chart records for another clinician's encounter."
            )

        return encounter

    # --- Read paths ---

    async def get_patient_chart(
        self,
        patient_id: UUID,
        current_user_team_member_id: Optional[UUID],
        clinic_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> Tuple[List[DentalChartFinding], List[DentalProcedureRecord]]:
        """
        Returns the cumulative current chart state: active findings plus all
        procedure records for the patient.
        """
        await self._require_patient_access(patient_id, current_user_team_member_id, clinic_id, is_admin)

        findings = await self.chart_repo.list_by_patient_id(patient_id, include_resolved=False)
        procedures = await self.procedure_repo.list_by_patient_id(patient_id)
        return findings, procedures

    async def get_chart_history(
        self,
        patient_id: UUID,
        current_user_team_member_id: Optional[UUID],
        clinic_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> Tuple[List[DentalChartFinding], List[DentalProcedureRecord]]:
        """
        Returns the full chart history: all findings (including resolved) in
        chronological order plus every procedure record ever made.
        """
        await self._require_patient_access(patient_id, current_user_team_member_id, clinic_id, is_admin)

        findings = await self.chart_repo.list_by_patient_id(patient_id, include_resolved=True)
        procedures = await self.procedure_repo.list_by_patient_id(patient_id)
        return findings, procedures

    async def get_encounter_chart(
        self,
        encounter_id: UUID,
        current_user_team_member_id: Optional[UUID],
        clinic_id: Optional[UUID] = None,
        is_admin: bool = False,
    ):
        """
        Returns findings and procedures recorded during a specific encounter.
        Read access follows encounter assignment rules for non-admin clinicians.
        """
        encounter = await self._require_encounter_access(
            encounter_id, current_user_team_member_id, clinic_id, is_admin, for_write=False,
        )
        findings = await self.chart_repo.list_by_encounter_id(encounter_id)
        procedures = await self.procedure_repo.list_by_encounter_id(encounter_id)
        return encounter, findings, procedures

    # --- Finding write paths ---

    async def record_finding(
        self,
        encounter_id: UUID,
        author_id: UUID,
        clinic_id: Optional[UUID],
        dto: RecordFindingRequestDto,
        user_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> DentalChartFinding:
        """
        Records a new tooth/surface finding during an encounter.
        Patient and encounter linkage are derived from the encounter; the author
        comes from the authenticated identity. Duplicate identical active findings
        are rejected; distinct findings on the same tooth remain legal.
        """
        encounter = await self._require_encounter_access(
            encounter_id, author_id, clinic_id, is_admin, for_write=True,
        )

        tooth = dto.tooth.strip().upper()
        surfaces = validate_finding_surfaces(tooth, dto.condition, dto.surfaces)

        duplicate = await self.chart_repo.find_duplicate_active(
            patient_id=encounter.patient_id,
            tooth=tooth,
            condition=dto.condition,
            surfaces_key=surfaces_to_key(surfaces),
        )
        if duplicate:
            raise ValueError(
                "DUPLICATE_FINDING: An identical active finding already exists for this tooth and condition."
            )

        now = datetime.now(timezone.utc)
        finding = DentalChartFinding(
            patient_id=encounter.patient_id,
            encounter_id=encounter.id,
            author_id=author_id,
            clinic_id=clinic_id or encounter.clinic_id,
            tooth=tooth,
            condition=dto.condition,
            surfaces=surfaces,
            status=FindingStatus.ACTIVE.value,
            notes=dto.notes,
            created_at=now,
            updated_at=now,
        )
        saved = await self.chart_repo.save(finding)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="dental_finding.recorded",
                entity_type="dental_chart_finding",
                entity_id=str(saved.id),
                user_id=user_id,
                details={
                    "encounter_id": str(encounter.id),
                    "patient_id": str(encounter.patient_id),
                    "tooth": saved.tooth,
                    "condition": saved.condition,
                    "surfaces": saved.surfaces,
                    "status": saved.status,
                },
            )
        return saved


    async def correct_finding(
        self,
        finding_id: UUID,
        actor_id: UUID,
        clinic_id: Optional[UUID],
        dto: CorrectFindingRequestDto,
        user_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> DentalChartFinding:
        """
        Corrects an active finding in place. The original author and creation
        timestamps are preserved; the correcting clinician, reason, and time are
        recorded. Resolved findings are immutable history and cannot be corrected.
        """
        finding = await self.chart_repo.get_by_id(finding_id)
        if not finding:
            raise ValueError(f"Dental chart finding with ID {finding_id} not found.")

        await self._require_encounter_access(
            finding.encounter_id, actor_id, clinic_id, is_admin, for_write=True,
        )

        if finding.status == FindingStatus.RESOLVED.value:
            raise ValueError("Resolved findings are part of the clinical history and cannot be corrected.")

        condition = finding.condition
        surfaces = finding.surfaces

        if dto.condition is not None or dto.surfaces is not None:
            condition = dto.condition if dto.condition is not None else finding.condition
            candidate_surfaces = dto.surfaces if dto.surfaces is not None else finding.surfaces
            surfaces = validate_finding_surfaces(finding.tooth, condition, candidate_surfaces)

            duplicate = await self.chart_repo.find_duplicate_active(
                patient_id=finding.patient_id,
                tooth=finding.tooth,
                condition=condition,
                surfaces_key=surfaces_to_key(surfaces),
            )
            if duplicate and duplicate.id != finding.id:
                raise ValueError(
                    "DUPLICATE_FINDING: An identical active finding already exists for this tooth and condition."
                )

        now = datetime.now(timezone.utc)
        finding.condition = condition
        finding.surfaces = surfaces
        if dto.notes is not None:
            finding.notes = dto.notes
        finding.correction_reason = dto.reason.strip()
        finding.corrected_by_id = actor_id
        finding.corrected_at = now
        finding.updated_at = now
        saved = await self.chart_repo.save(finding)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="dental_finding.corrected",
                entity_type="dental_chart_finding",
                entity_id=str(saved.id),
                user_id=user_id,
                details={
                    "encounter_id": str(saved.encounter_id),
                    "patient_id": str(saved.patient_id),
                    "tooth": saved.tooth,
                    "condition": saved.condition,
                    "surfaces": saved.surfaces,
                    "corrected_by_id": str(actor_id),
                },
            )
        return saved

    async def resolve_finding(
        self,
        finding_id: UUID,
        actor_id: UUID,
        clinic_id: Optional[UUID],
        dto: Optional[ResolveFindingRequestDto] = None,
        user_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> DentalChartFinding:
        """
        Marks an active finding as resolved (no longer part of the current chart
        state) while preserving it in history with who resolved it and when.
        """
        finding = await self.chart_repo.get_by_id(finding_id)
        if not finding:
            raise ValueError(f"Dental chart finding with ID {finding_id} not found.")

        await self._require_encounter_access(
            finding.encounter_id, actor_id, clinic_id, is_admin, for_write=True,
        )

        if finding.status == FindingStatus.RESOLVED.value:
            raise ValueError("This finding is already resolved.")

        now = datetime.now(timezone.utc)
        finding.status = FindingStatus.RESOLVED.value
        finding.resolved_by_id = actor_id
        finding.resolved_at = now
        finding.updated_at = now
        if dto is not None and dto.notes:
            finding.notes = dto.notes
        saved = await self.chart_repo.save(finding)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="dental_finding.resolved",
                entity_type="dental_chart_finding",
                entity_id=str(saved.id),
                user_id=user_id,
                details={
                    "encounter_id": str(saved.encounter_id),
                    "patient_id": str(saved.patient_id),
                    "tooth": saved.tooth,
                    "condition": saved.condition,
                    "resolved_by_id": str(actor_id),
                },
            )
        return saved



    # --- Procedure write paths ---

    async def create_planned_procedure(
        self,
        encounter_id: UUID,
        recorded_by_id: UUID,
        clinic_id: Optional[UUID],
        dto: CreateProcedureRequestDto,
        user_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> DentalProcedureRecord:
        """
        Adds a planned procedure to the patient's treatment plan. The record is
        always created with 'planned' status; planning never completes treatment.
        The service reference must exist in the clinic's service catalog.
        """
        encounter = await self._require_encounter_access(
            encounter_id, recorded_by_id, clinic_id, is_admin, for_write=True,
        )

        tooth = dto.tooth.strip().upper()
        surfaces = validate_surfaces(tooth, dto.surfaces)

        service = await self.service_repo.get_by_id(dto.serviceId)
        if not service:
            raise ValueError(f"Service with ID {dto.serviceId} not found in the service catalog.")

        now = datetime.now(timezone.utc)
        procedure = DentalProcedureRecord(
            patient_id=encounter.patient_id,
            encounter_id=encounter.id,
            recorded_by_id=recorded_by_id,
            clinic_id=clinic_id or encounter.clinic_id,
            tooth=tooth,
            service_id=service.id,
            surfaces=surfaces,
            status=ProcedureStatus.PLANNED.value,
            notes=dto.notes,
            created_at=now,
            updated_at=now,
        )
        saved = await self.procedure_repo.save(procedure)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="dental_procedure.planned",
                entity_type="dental_procedure",
                entity_id=str(saved.id),
                user_id=user_id,
                details={
                    "encounter_id": str(encounter.id),
                    "patient_id": str(encounter.patient_id),
                    "tooth": saved.tooth,
                    "service_id": str(saved.service_id),
                    "status": saved.status,
                },
            )
        return saved

    async def update_procedure_status(
        self,
        procedure_id: UUID,
        actor_id: UUID,
        clinic_id: Optional[UUID],
        dto: UpdateProcedureStatusRequestDto,
        user_id: Optional[UUID] = None,
        is_admin: bool = False,
    ) -> DentalProcedureRecord:
        """
        Transitions a procedure's status according to the documented lifecycle:
        planned -> in_progress -> completed, with cancellation from planned or
        in_progress. Completion stamps completed_at and server-derived
        completed_by_id; terminal states cannot be reopened.
        """
        procedure = await self.procedure_repo.get_by_id(procedure_id)
        if not procedure:
            raise ValueError(f"Dental procedure record with ID {procedure_id} not found.")

        await self._require_encounter_access(
            procedure.encounter_id, actor_id, clinic_id, is_admin, for_write=True,
        )

        target_status = dto.status.strip().lower()
        valid_statuses = {s.value for s in ProcedureStatus}
        if target_status not in valid_statuses:
            raise ValueError(
                f"Invalid procedure status '{dto.status}'. Valid statuses: {sorted(valid_statuses)}"
            )

        current = ProcedureStatus(procedure.status)
        target = ProcedureStatus(target_status)

        if current == target:
            return procedure

        allowed = ALLOWED_PROCEDURE_TRANSITIONS.get(current, set())
        if target not in allowed:
            raise ValueError(
                f"Invalid procedure status transition from '{current.value}' to '{target.value}'."
            )

        now = datetime.now(timezone.utc)
        procedure.status = target.value
        procedure.updated_at = now
        if dto.notes is not None:
            procedure.notes = dto.notes

        if target == ProcedureStatus.IN_PROGRESS and procedure.started_at is None:
            procedure.started_at = now
        if target == ProcedureStatus.COMPLETED:
            procedure.completed_at = now
            procedure.completed_by_id = actor_id

        saved = await self.procedure_repo.save(procedure)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="dental_procedure.status_changed",
                entity_type="dental_procedure",
                entity_id=str(saved.id),
                user_id=user_id,
                details={
                    "encounter_id": str(saved.encounter_id),
                    "patient_id": str(saved.patient_id),
                    "tooth": saved.tooth,
                    "previous_status": current.value,
                    "status": saved.status,
                    "actor_id": str(actor_id),
                },
            )
        return saved

