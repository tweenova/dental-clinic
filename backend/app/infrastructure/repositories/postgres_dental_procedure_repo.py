from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.dental_chart import DentalProcedureRecord
from app.domain.repositories.dental_procedure_repo import DentalProcedureRepository
from app.infrastructure.database.orm_models import DentalProcedureORM


class PostgresDentalProcedureRepository(DentalProcedureRepository):
    """
    PostgreSQL SQLAlchemy implementation of the DentalProcedureRepository interface.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, orm: DentalProcedureORM) -> DentalProcedureRecord:
        return DentalProcedureRecord(
            id=orm.id,
            patient_id=orm.patient_id,
            clinic_id=orm.clinic_id,
            encounter_id=orm.encounter_id,
            recorded_by_id=orm.recorded_by_id,
            service_id=orm.service_id,
            tooth=orm.tooth,
            surfaces=[s for s in orm.surfaces.split(",") if s],
            status=orm.status,
            notes=orm.notes,
            started_at=orm.started_at,
            completed_at=orm.completed_at,
            completed_by_id=orm.completed_by_id,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def get_by_id(self, procedure_id: UUID) -> Optional[DentalProcedureRecord]:
        stmt = select(DentalProcedureORM).where(DentalProcedureORM.id == procedure_id)
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def list_by_patient_id(self, patient_id: UUID) -> List[DentalProcedureRecord]:
        stmt = (
            select(DentalProcedureORM)
            .where(DentalProcedureORM.patient_id == patient_id)
            .order_by(DentalProcedureORM.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return [self._to_domain(o) for o in result.scalars().all()]

    async def list_by_encounter_id(self, encounter_id: UUID) -> List[DentalProcedureRecord]:
        stmt = (
            select(DentalProcedureORM)
            .where(DentalProcedureORM.encounter_id == encounter_id)
            .order_by(DentalProcedureORM.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return [self._to_domain(o) for o in result.scalars().all()]

    async def save(self, procedure: DentalProcedureRecord) -> DentalProcedureRecord:
        stmt = select(DentalProcedureORM).where(DentalProcedureORM.id == procedure.id)
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.patient_id = procedure.patient_id
            existing.clinic_id = procedure.clinic_id
            existing.encounter_id = procedure.encounter_id
            existing.recorded_by_id = procedure.recorded_by_id
            existing.service_id = procedure.service_id
            existing.tooth = procedure.tooth
            existing.surfaces = ",".join(procedure.surfaces)
            existing.status = procedure.status
            existing.notes = procedure.notes
            existing.started_at = procedure.started_at
            existing.completed_at = procedure.completed_at
            existing.completed_by_id = procedure.completed_by_id
            existing.updated_at = procedure.updated_at
        else:
            orm = DentalProcedureORM(
                id=procedure.id,
                patient_id=procedure.patient_id,
                clinic_id=procedure.clinic_id,
                encounter_id=procedure.encounter_id,
                recorded_by_id=procedure.recorded_by_id,
                service_id=procedure.service_id,
                tooth=procedure.tooth,
                surfaces=",".join(procedure.surfaces),
                status=procedure.status,
                notes=procedure.notes,
                started_at=procedure.started_at,
                completed_at=procedure.completed_at,
                completed_by_id=procedure.completed_by_id,
                created_at=procedure.created_at,
                updated_at=procedure.updated_at,
            )
            self.session.add(orm)

        await self.session.flush()
        return procedure
