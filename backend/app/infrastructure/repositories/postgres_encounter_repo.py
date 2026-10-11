from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.encounter import ClinicalEncounter
from app.domain.repositories.encounter_repo import EncounterRepository
from app.infrastructure.database.orm_models import ClinicalEncounterORM


class PostgresEncounterRepository(EncounterRepository):
    """
    SQLAlchemy PostgreSQL implementation of the EncounterRepository interface.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, orm: ClinicalEncounterORM) -> ClinicalEncounter:
        return ClinicalEncounter(
            id=orm.id,
            clinic_id=orm.clinic_id,
            patient_id=orm.patient_id,
            clinician_id=orm.clinician_id,
            booking_id=orm.booking_id,
            appointment_id=orm.appointment_id,
            status=orm.status,
            chief_complaint=orm.chief_complaint,
            reason_for_visit=orm.reason_for_visit,
            started_at=orm.started_at,
            ended_at=orm.ended_at,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def get_by_id(self, encounter_id: UUID) -> Optional[ClinicalEncounter]:
        stmt = select(ClinicalEncounterORM).where(ClinicalEncounterORM.id == encounter_id)
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_active_by_booking_id(self, booking_id: UUID) -> Optional[ClinicalEncounter]:
        stmt = (
            select(ClinicalEncounterORM)
            .where(
                ClinicalEncounterORM.booking_id == booking_id,
                ClinicalEncounterORM.status.in_(["draft", "in_progress"]),
            )
            .order_by(ClinicalEncounterORM.created_at.desc())
        )
        result = await self.session.execute(stmt)
        orm = result.scalars().first()
        return self._to_domain(orm) if orm else None

    async def list_by_patient_id(self, patient_id: UUID, limit: int = 50) -> List[ClinicalEncounter]:
        stmt = (
            select(ClinicalEncounterORM)
            .where(ClinicalEncounterORM.patient_id == patient_id)
            .order_by(ClinicalEncounterORM.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(o) for o in orms]

    async def list_by_clinician_id(
        self,
        clinician_id: UUID,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[ClinicalEncounter]:
        stmt = select(ClinicalEncounterORM).where(ClinicalEncounterORM.clinician_id == clinician_id)
        if status:
            stmt = stmt.where(ClinicalEncounterORM.status == status)
        stmt = stmt.order_by(ClinicalEncounterORM.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(o) for o in orms]

    async def save(self, encounter: ClinicalEncounter) -> ClinicalEncounter:
        stmt = select(ClinicalEncounterORM).where(ClinicalEncounterORM.id == encounter.id)
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.clinic_id = encounter.clinic_id
            existing.patient_id = encounter.patient_id
            existing.clinician_id = encounter.clinician_id
            existing.booking_id = encounter.booking_id
            existing.appointment_id = encounter.appointment_id
            existing.status = encounter.status
            existing.chief_complaint = encounter.chief_complaint
            existing.reason_for_visit = encounter.reason_for_visit
            existing.started_at = encounter.started_at
            existing.ended_at = encounter.ended_at
            existing.updated_at = encounter.updated_at
        else:
            orm = ClinicalEncounterORM(
                id=encounter.id,
                clinic_id=encounter.clinic_id,
                patient_id=encounter.patient_id,
                clinician_id=encounter.clinician_id,
                booking_id=encounter.booking_id,
                appointment_id=encounter.appointment_id,
                status=encounter.status,
                chief_complaint=encounter.chief_complaint,
                reason_for_visit=encounter.reason_for_visit,
                started_at=encounter.started_at,
                ended_at=encounter.ended_at,
                created_at=encounter.created_at,
                updated_at=encounter.updated_at,
            )
            self.session.add(orm)

        await self.session.flush()
        return encounter

