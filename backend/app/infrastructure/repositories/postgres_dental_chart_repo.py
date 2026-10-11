from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.dental_chart import DentalChartFinding
from app.domain.repositories.dental_chart_repo import DentalChartRepository
from app.infrastructure.database.orm_models import DentalChartFindingORM


class PostgresDentalChartRepository(DentalChartRepository):
    """
    PostgreSQL SQLAlchemy implementation of the DentalChartRepository interface.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, orm: DentalChartFindingORM) -> DentalChartFinding:
        return DentalChartFinding(
            id=orm.id,
            patient_id=orm.patient_id,
            clinic_id=orm.clinic_id,
            encounter_id=orm.encounter_id,
            author_id=orm.author_id,
            tooth=orm.tooth,
            surfaces=[s for s in orm.surfaces.split(",") if s],
            condition=orm.condition,
            status=orm.status,
            notes=orm.notes,
            correction_reason=orm.correction_reason,
            corrected_by_id=orm.corrected_by_id,
            corrected_at=orm.corrected_at,
            resolved_by_id=orm.resolved_by_id,
            resolved_at=orm.resolved_at,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def get_by_id(self, finding_id: UUID) -> Optional[DentalChartFinding]:
        stmt = select(DentalChartFindingORM).where(DentalChartFindingORM.id == finding_id)
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def list_by_patient_id(
        self,
        patient_id: UUID,
        include_resolved: bool = True,
    ) -> List[DentalChartFinding]:
        stmt = select(DentalChartFindingORM).where(DentalChartFindingORM.patient_id == patient_id)
        if not include_resolved:
            stmt = stmt.where(DentalChartFindingORM.status == "active")
        stmt = stmt.order_by(DentalChartFindingORM.created_at.asc())
        result = await self.session.execute(stmt)
        return [self._to_domain(o) for o in result.scalars().all()]

    async def list_by_encounter_id(self, encounter_id: UUID) -> List[DentalChartFinding]:
        stmt = (
            select(DentalChartFindingORM)
            .where(DentalChartFindingORM.encounter_id == encounter_id)
            .order_by(DentalChartFindingORM.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return [self._to_domain(o) for o in result.scalars().all()]

    async def find_duplicate_active(
        self,
        patient_id: UUID,
        tooth: str,
        condition: str,
        surfaces_key: str,
    ) -> Optional[DentalChartFinding]:
        stmt = select(DentalChartFindingORM).where(
            DentalChartFindingORM.patient_id == patient_id,
            DentalChartFindingORM.tooth == tooth,
            DentalChartFindingORM.condition == condition,
            DentalChartFindingORM.surfaces == surfaces_key,
            DentalChartFindingORM.status == "active",
        )
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def save(self, finding: DentalChartFinding) -> DentalChartFinding:
        stmt = select(DentalChartFindingORM).where(DentalChartFindingORM.id == finding.id)
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.patient_id = finding.patient_id
            existing.clinic_id = finding.clinic_id
            existing.encounter_id = finding.encounter_id
            existing.author_id = finding.author_id
            existing.tooth = finding.tooth
            existing.surfaces = ",".join(finding.surfaces)
            existing.condition = finding.condition
            existing.status = finding.status
            existing.notes = finding.notes
            existing.correction_reason = finding.correction_reason
            existing.corrected_by_id = finding.corrected_by_id
            existing.corrected_at = finding.corrected_at
            existing.resolved_by_id = finding.resolved_by_id
            existing.resolved_at = finding.resolved_at
            existing.updated_at = finding.updated_at
        else:
            orm = DentalChartFindingORM(
                id=finding.id,
                patient_id=finding.patient_id,
                clinic_id=finding.clinic_id,
                encounter_id=finding.encounter_id,
                author_id=finding.author_id,
                tooth=finding.tooth,
                surfaces=",".join(finding.surfaces),
                condition=finding.condition,
                status=finding.status,
                notes=finding.notes,
                correction_reason=finding.correction_reason,
                corrected_by_id=finding.corrected_by_id,
                corrected_at=finding.corrected_at,
                resolved_by_id=finding.resolved_by_id,
                resolved_at=finding.resolved_at,
                created_at=finding.created_at,
                updated_at=finding.updated_at,
            )
            self.session.add(orm)

        try:
            await self.session.flush()
        except IntegrityError as exc:
            err_str = str(exc).lower()
            if "uq_dental_findings_active_duplicate" in err_str or "unique constraint" in err_str:
                raise ValueError(
                    "DUPLICATE_FINDING: An identical active finding already exists for this tooth and condition."
                ) from exc
            raise
        return finding
