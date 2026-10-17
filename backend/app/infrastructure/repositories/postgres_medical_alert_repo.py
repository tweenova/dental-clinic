from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.booking_crm import PatientMedicalAlert
from app.domain.repositories.medical_alert_repo import MedicalAlertRepository
from app.infrastructure.database.orm_models import PatientMedicalAlertORM


class PostgresMedicalAlertRepository(MedicalAlertRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: PatientMedicalAlert) -> PatientMedicalAlertORM:
        return PatientMedicalAlertORM(
            id=entity.id,
            patient_id=entity.patient_id,
            type=entity.type,
            description=entity.description,
            severity=entity.severity,
            recorded_by_user_id=entity.recorded_by_user_id,
            recorded_at=entity.recorded_at,
            last_reviewed_at=entity.last_reviewed_at,
            is_active=entity.is_active,
            is_confirmed=entity.is_confirmed,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _to_domain(orm: PatientMedicalAlertORM) -> PatientMedicalAlert:
        return PatientMedicalAlert(
            id=orm.id,
            patient_id=orm.patient_id,
            type=orm.type,
            description=orm.description,
            severity=orm.severity,
            recorded_by_user_id=orm.recorded_by_user_id,
            recorded_at=orm.recorded_at,
            last_reviewed_at=orm.last_reviewed_at,
            is_active=orm.is_active,
            is_confirmed=orm.is_confirmed,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def get_alerts_for_patient(
        self, patient_id: UUID, active_only: bool = True
    ) -> List[PatientMedicalAlert]:
        stmt = select(PatientMedicalAlertORM).where(PatientMedicalAlertORM.patient_id == patient_id)
        if active_only:
            stmt = stmt.where(PatientMedicalAlertORM.is_active.is_(True))
        stmt = stmt.order_by(PatientMedicalAlertORM.created_at.desc())
        result = await self._session.execute(stmt)
        return [self._to_domain(row) for row in result.scalars().all()]

    async def get_by_id(self, alert_id: UUID) -> Optional[PatientMedicalAlert]:
        orm = await self._session.get(PatientMedicalAlertORM, alert_id)
        return self._to_domain(orm) if orm else None

    async def save(self, alert: PatientMedicalAlert) -> PatientMedicalAlert:
        existing = await self._session.get(PatientMedicalAlertORM, alert.id)
        if existing:
            existing.type = alert.type
            existing.description = alert.description
            existing.severity = alert.severity
            existing.is_active = alert.is_active
            existing.is_confirmed = alert.is_confirmed
            existing.last_reviewed_at = alert.last_reviewed_at
            existing.updated_at = datetime.now(timezone.utc)
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(alert)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def review_all_for_patient(self, patient_id: UUID, reviewed_at: datetime) -> None:
        stmt = (
            update(PatientMedicalAlertORM)
            .where(
                PatientMedicalAlertORM.patient_id == patient_id,
                PatientMedicalAlertORM.is_active.is_(True),
            )
            .values(last_reviewed_at=reviewed_at, updated_at=datetime.now(timezone.utc))
        )
        await self._session.execute(stmt)
        await self._session.flush()
