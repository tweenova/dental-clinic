from datetime import date, datetime, time, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.visit_payment import VisitPayment
from app.domain.repositories.visit_payment_repo import VisitPaymentRepository
from app.infrastructure.database.orm_models import VisitPaymentORM


class PostgresVisitPaymentRepository(VisitPaymentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: VisitPayment) -> VisitPaymentORM:
        return VisitPaymentORM(
            id=entity.id,
            clinic_id=entity.clinic_id,
            booking_id=entity.booking_id,
            patient_id=entity.patient_id,
            amount_cents=entity.amount_cents,
            currency=entity.currency,
            method=entity.method,
            notes=entity.notes,
            recorded_by_user_id=entity.recorded_by_user_id,
            amount_charged_cents=entity.amount_charged_cents,
            is_voided=entity.is_voided,
            void_reason=entity.void_reason,
            voided_at=entity.voided_at,
            voided_by_user_id=entity.voided_by_user_id,
            created_at=entity.created_at,
        )

    @staticmethod
    def _to_domain(orm: VisitPaymentORM) -> VisitPayment:
        return VisitPayment(
            id=orm.id,
            clinic_id=orm.clinic_id,
            booking_id=orm.booking_id,
            patient_id=orm.patient_id,
            amount_cents=orm.amount_cents,
            currency=orm.currency,
            method=orm.method,
            notes=orm.notes,
            recorded_by_user_id=orm.recorded_by_user_id,
            amount_charged_cents=orm.amount_charged_cents,
            is_voided=orm.is_voided,
            void_reason=orm.void_reason,
            voided_at=orm.voided_at,
            voided_by_user_id=orm.voided_by_user_id,
            created_at=orm.created_at,
        )

    async def create(self, payment: VisitPayment) -> VisitPayment:
        orm = self._to_orm(payment)
        self._session.add(orm)
        await self._session.flush()
        return self._to_domain(orm)

    async def update(self, payment: VisitPayment) -> VisitPayment:
        orm = await self._session.get(VisitPaymentORM, payment.id)
        if orm:
            orm.amount_cents = payment.amount_cents
            orm.amount_charged_cents = payment.amount_charged_cents
            orm.currency = payment.currency
            orm.method = payment.method
            orm.notes = payment.notes
            orm.is_voided = payment.is_voided
            orm.void_reason = payment.void_reason
            orm.voided_at = payment.voided_at
            orm.voided_by_user_id = payment.voided_by_user_id
            await self._session.flush()
            return self._to_domain(orm)
        return payment

    async def get_by_id(self, payment_id: UUID) -> Optional[VisitPayment]:
        orm = await self._session.get(VisitPaymentORM, payment_id)
        return self._to_domain(orm) if orm else None

    async def list_by_booking_id(self, booking_id: UUID) -> List[VisitPayment]:
        stmt = (
            select(VisitPaymentORM)
            .where(VisitPaymentORM.booking_id == booking_id)
            .order_by(VisitPaymentORM.created_at.asc())
        )
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]

    async def list_by_date(
        self,
        target_date: date,
        clinic_id: Optional[UUID] = None,
    ) -> List[VisitPayment]:
        start_dt = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
        end_dt = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)

        stmt = (
            select(VisitPaymentORM)
            .where(
                VisitPaymentORM.created_at >= start_dt,
                VisitPaymentORM.created_at <= end_dt,
            )
        )
        if clinic_id:
            stmt = stmt.where(VisitPaymentORM.clinic_id == clinic_id)

        stmt = stmt.order_by(VisitPaymentORM.created_at.desc())
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]
