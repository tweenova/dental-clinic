from datetime import date
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.booking_crm import Booking
from app.domain.repositories.booking_repo import BookingRepository
from app.infrastructure.database.orm_models import BookingORM


class PostgresBookingRepository(BookingRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: Booking) -> BookingORM:
        return BookingORM(
            id=entity.id,
            confirmation_id=entity.confirmation_id,
            clinic_id=entity.clinic_id,
            patient_id=entity.patient_id,
            service_id=entity.service_id,
            team_member_id=entity.team_member_id,
            slot_id=entity.slot_id,
            preferred_date=entity.preferred_date,
            preferred_time=entity.preferred_time,
            status=entity.status,
            patient_full_name=entity.patient_full_name,
            patient_phone=entity.patient_phone,
            patient_email=entity.patient_email,
            notes=entity.notes,
            utm_source=entity.utm_source,
            utm_campaign=entity.utm_campaign,
            staff_notes=entity.staff_notes,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _to_domain(orm: BookingORM) -> Booking:
        return Booking(
            id=orm.id,
            confirmation_id=orm.confirmation_id,
            clinic_id=orm.clinic_id,
            patient_id=orm.patient_id,
            service_id=orm.service_id,
            team_member_id=orm.team_member_id,
            slot_id=orm.slot_id,
            preferred_date=orm.preferred_date,
            preferred_time=orm.preferred_time,
            status=orm.status,
            patient_full_name=orm.patient_full_name,
            patient_phone=orm.patient_phone,
            patient_email=orm.patient_email,
            notes=orm.notes,
            utm_source=orm.utm_source,
            utm_campaign=orm.utm_campaign,
            staff_notes=orm.staff_notes,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def save(self, booking: Booking) -> Booking:
        existing = await self._session.get(BookingORM, booking.id)
        if existing:
            existing.clinic_id = booking.clinic_id
            existing.patient_id = booking.patient_id
            existing.service_id = booking.service_id
            existing.team_member_id = booking.team_member_id
            existing.slot_id = booking.slot_id
            existing.preferred_date = booking.preferred_date
            existing.preferred_time = booking.preferred_time
            existing.status = booking.status
            existing.patient_full_name = booking.patient_full_name
            existing.patient_phone = booking.patient_phone
            existing.patient_email = booking.patient_email
            existing.notes = booking.notes
            existing.staff_notes = booking.staff_notes
            existing.utm_source = booking.utm_source
            existing.utm_campaign = booking.utm_campaign
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(booking)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, booking_id: UUID) -> Optional[Booking]:
        orm = await self._session.get(BookingORM, booking_id)
        return self._to_domain(orm) if orm else None

    async def get_by_confirmation_id(self, confirmation_id: str) -> Optional[Booking]:
        stmt = select(BookingORM).where(BookingORM.confirmation_id == confirmation_id)
        res = await self._session.execute(stmt)
        orm = res.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def list_bookings(
        self,
        clinic_id: Optional[UUID] = None,
        team_member_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Booking], int]:
        stmt = select(BookingORM)
        count_stmt = select(func.count(BookingORM.id))

        if clinic_id:
            stmt = stmt.where(BookingORM.clinic_id == clinic_id)
            count_stmt = count_stmt.where(BookingORM.clinic_id == clinic_id)
        if team_member_id:
            stmt = stmt.where(BookingORM.team_member_id == team_member_id)
            count_stmt = count_stmt.where(BookingORM.team_member_id == team_member_id)
        if date_from:
            stmt = stmt.where(BookingORM.preferred_date >= date_from)
            count_stmt = count_stmt.where(BookingORM.preferred_date >= date_from)
        if date_to:
            stmt = stmt.where(BookingORM.preferred_date <= date_to)
            count_stmt = count_stmt.where(BookingORM.preferred_date <= date_to)
        if status:
            stmt = stmt.where(BookingORM.status == status)
            count_stmt = count_stmt.where(BookingORM.status == status)
        if search:
            search_pattern = f"%{search.strip()}%"
            filter_expr = or_(
                BookingORM.patient_full_name.ilike(search_pattern),
                BookingORM.patient_phone.ilike(search_pattern),
                BookingORM.patient_email.ilike(search_pattern),
                BookingORM.confirmation_id.ilike(search_pattern),
            )
            stmt = stmt.where(filter_expr)
            count_stmt = count_stmt.where(filter_expr)

        total_res = await self._session.execute(count_stmt)
        total = total_res.scalar_one() or 0

        stmt = (
            stmt.order_by(BookingORM.preferred_date.asc(), BookingORM.preferred_time.asc())
            .limit(limit)
            .offset(offset)
        )
        res = await self._session.execute(stmt)
        rows = res.scalars().all()
        return [self._to_domain(r) for r in rows], total

    async def get_counts_for_date(
        self, target_date: date, clinic_id: Optional[UUID] = None
    ) -> Dict[str, int]:
        stmt = select(BookingORM.status, func.count(BookingORM.id)).where(
            BookingORM.preferred_date == target_date
        )
        if clinic_id:
            stmt = stmt.where(BookingORM.clinic_id == clinic_id)
        stmt = stmt.group_by(BookingORM.status)
        res = await self._session.execute(stmt)
        counts = {row[0]: row[1] for row in res.all()}
        return counts

    async def get_patient_bookings(self, patient_id: UUID) -> List[Booking]:
        stmt = (
            select(BookingORM)
            .where(BookingORM.patient_id == patient_id)
            .order_by(BookingORM.preferred_date.desc())
        )
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]
