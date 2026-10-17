from typing import List, Optional
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.announcement import Announcement
from app.domain.repositories.announcement_repo import AnnouncementRepository
from app.infrastructure.database.orm_models import AnnouncementORM


class PostgresAnnouncementRepository(AnnouncementRepository):
    """PostgreSQL implementation of the AnnouncementRepository abstraction."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_domain(orm: AnnouncementORM) -> Announcement:
        return Announcement(
            id=orm.id,
            content=orm.content,
            is_active=orm.is_active,
            display_order=orm.display_order,
            is_auto_booking_banner=getattr(orm, "is_auto_booking_banner", False),
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def list_all(self, include_inactive: bool = False) -> List[Announcement]:
        stmt = select(AnnouncementORM).order_by(
            AnnouncementORM.display_order.asc(),
            AnnouncementORM.created_at.desc(),
        )
        if not include_inactive:
            stmt = stmt.where(AnnouncementORM.is_active.is_(True))
        result = await self._session.execute(stmt)
        return [self._to_domain(row) for row in result.scalars().all()]

    async def get_by_id(self, announcement_id: UUID) -> Optional[Announcement]:
        orm = await self._session.get(AnnouncementORM, announcement_id)
        return self._to_domain(orm) if orm else None

    async def save(self, announcement: Announcement) -> Announcement:
        existing = await self._session.get(AnnouncementORM, announcement.id)
        if existing:
            existing.content = announcement.content
            existing.is_active = announcement.is_active
            existing.display_order = announcement.display_order
            existing.is_auto_booking_banner = announcement.is_auto_booking_banner
            existing.updated_at = announcement.updated_at
            await self._session.flush()
            return self._to_domain(existing)
        else:
            orm = AnnouncementORM(
                id=announcement.id,
                content=announcement.content,
                is_active=announcement.is_active,
                display_order=announcement.display_order,
                is_auto_booking_banner=announcement.is_auto_booking_banner,
                created_at=announcement.created_at,
                updated_at=announcement.updated_at,
            )
            self._session.add(orm)
            await self._session.flush()
            return self._to_domain(orm)

    async def delete(self, announcement_id: UUID) -> bool:
        stmt = delete(AnnouncementORM).where(AnnouncementORM.id == announcement_id)
        result = await self._session.execute(stmt)
        await self._session.flush()
        return bool(result.rowcount and result.rowcount > 0)
