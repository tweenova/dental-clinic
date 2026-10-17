from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.treatment_plan import TreatmentPlanItem
from app.domain.repositories.treatment_plan_repo import TreatmentPlanRepository
from app.infrastructure.database.orm_models import TreatmentPlanItemORM


class PostgresTreatmentPlanRepository(TreatmentPlanRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: TreatmentPlanItem) -> TreatmentPlanItemORM:
        return TreatmentPlanItemORM(
            id=entity.id,
            patient_id=entity.patient_id,
            tooth_number=entity.tooth_number,
            service_id=entity.service_id,
            procedure_name=entity.procedure_name,
            status=entity.status,
            estimated_cost_cents=entity.estimated_cost_cents,
            decision_date=entity.decision_date,
            notes=entity.notes,
            completed_procedure_id=entity.completed_procedure_id,
            created_by_user_id=entity.created_by_user_id,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _to_domain(orm: TreatmentPlanItemORM) -> TreatmentPlanItem:
        return TreatmentPlanItem(
            id=orm.id,
            patient_id=orm.patient_id,
            tooth_number=orm.tooth_number,
            service_id=orm.service_id,
            procedure_name=orm.procedure_name,
            status=orm.status,
            estimated_cost_cents=orm.estimated_cost_cents,
            decision_date=orm.decision_date,
            notes=orm.notes,
            completed_procedure_id=orm.completed_procedure_id,
            created_by_user_id=orm.created_by_user_id,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def save(self, item: TreatmentPlanItem) -> TreatmentPlanItem:
        existing = await self._session.get(TreatmentPlanItemORM, item.id)
        if existing:
            existing.tooth_number = item.tooth_number
            existing.service_id = item.service_id
            existing.procedure_name = item.procedure_name
            existing.status = item.status
            existing.estimated_cost_cents = item.estimated_cost_cents
            existing.decision_date = item.decision_date
            existing.notes = item.notes
            existing.completed_procedure_id = item.completed_procedure_id
            existing.updated_at = datetime.now(timezone.utc)
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(item)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, item_id: UUID) -> Optional[TreatmentPlanItem]:
        orm = await self._session.get(TreatmentPlanItemORM, item_id)
        return self._to_domain(orm) if orm else None

    async def list_by_patient(self, patient_id: UUID) -> List[TreatmentPlanItem]:
        stmt = (
            select(TreatmentPlanItemORM)
            .where(TreatmentPlanItemORM.patient_id == patient_id)
            .order_by(TreatmentPlanItemORM.tooth_number.asc().nulls_last(), TreatmentPlanItemORM.created_at.asc())
        )
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]

    async def get_by_completed_procedure_id(self, procedure_id: UUID) -> Optional[TreatmentPlanItem]:
        stmt = select(TreatmentPlanItemORM).where(TreatmentPlanItemORM.completed_procedure_id == procedure_id)
        res = await self._session.execute(stmt)
        orm = res.scalar_one_or_none()
        return self._to_domain(orm) if orm else None
