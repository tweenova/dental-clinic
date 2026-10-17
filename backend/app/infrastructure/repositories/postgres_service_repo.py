from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.service import Service
from app.domain.repositories.service_repo import ServiceRepository
from app.infrastructure.database.orm_models import ServiceORM


class PostgresServiceRepository(ServiceRepository):
    """PostgreSQL implementation of the ServiceRepository abstraction."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_domain(orm: ServiceORM) -> Service:
        return Service(
            id=orm.id,
            slug=orm.slug,
            category=orm.category,
            title=orm.title,
            short_desc=orm.short_desc,
            full_desc=orm.full_desc,
            cash_price=orm.cash_price,
            duration=orm.duration,
            code=orm.code,
            insurance_note=orm.insurance_note,
            recommended_interval=orm.recommended_interval,
            recall_interval_days=orm.recall_interval_days,
            display_order=orm.display_order,
            is_highlighted=orm.is_highlighted,
            is_active=orm.is_active,
            is_public=orm.is_public,
            bookable_online=orm.bookable_online,
            buffer_minutes=orm.buffer_minutes,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    @staticmethod
    def _to_orm(domain: Service) -> ServiceORM:
        return ServiceORM(
            id=domain.id,
            slug=domain.slug.strip().lower(),
            category=domain.category,
            title=domain.title,
            short_desc=domain.short_desc,
            full_desc=domain.full_desc,
            cash_price=domain.cash_price,
            duration=domain.duration,
            code=domain.code,
            insurance_note=domain.insurance_note,
            recommended_interval=domain.recommended_interval,
            recall_interval_days=domain.recall_interval_days,
            display_order=domain.display_order,
            is_highlighted=domain.is_highlighted,
            is_active=domain.is_active,
            is_public=domain.is_public,
            bookable_online=domain.bookable_online,
            buffer_minutes=domain.buffer_minutes,
            created_at=domain.created_at,
            updated_at=domain.updated_at,
        )

    async def list_all(self, include_inactive: bool = False, public_only: bool = False) -> List[Service]:
        stmt = select(ServiceORM)
        if not include_inactive:
            stmt = stmt.where(ServiceORM.is_active.is_(True))
        if public_only:
            stmt = stmt.where(ServiceORM.is_public.is_(True))
        stmt = stmt.order_by(ServiceORM.display_order.asc(), ServiceORM.created_at.asc())
        result = await self._session.execute(stmt)
        return [self._to_domain(orm) for orm in result.scalars().all()]

    async def get_by_id(self, service_id: UUID) -> Optional[Service]:
        orm = await self._session.get(ServiceORM, service_id)
        return self._to_domain(orm) if orm else None

    async def get_by_slug(self, slug: str) -> Optional[Service]:
        stmt = select(ServiceORM).where(ServiceORM.slug == slug.strip().lower())
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def save(self, service: Service) -> Service:
        existing = await self._session.get(ServiceORM, service.id)
        if existing:
            existing.slug = service.slug.strip().lower()
            existing.category = service.category
            existing.title = service.title
            existing.short_desc = service.short_desc
            existing.full_desc = service.full_desc
            existing.cash_price = service.cash_price
            existing.duration = service.duration
            existing.code = service.code
            existing.insurance_note = service.insurance_note
            existing.recommended_interval = service.recommended_interval
            existing.recall_interval_days = service.recall_interval_days
            existing.display_order = service.display_order
            existing.is_highlighted = service.is_highlighted
            existing.is_active = service.is_active
            existing.is_public = service.is_public
            existing.bookable_online = service.bookable_online
            existing.buffer_minutes = service.buffer_minutes
            existing.updated_at = service.updated_at
            await self._session.flush()
            return self._to_domain(existing)
        else:
            orm = self._to_orm(service)
            self._session.add(orm)
            await self._session.flush()
            return self._to_domain(orm)

    async def reorder(self, ordered_ids: List[UUID]) -> None:
        for order, service_id in enumerate(ordered_ids):
            svc = await self._session.get(ServiceORM, service_id)
            if svc:
                svc.display_order = order
        await self._session.flush()
