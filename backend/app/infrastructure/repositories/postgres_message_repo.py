from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.booking_crm import Message
from app.domain.repositories.message_repo import MessageRepository
from app.infrastructure.database.orm_models import MessageORM


class PostgresMessageRepository(MessageRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: Message) -> MessageORM:
        return MessageORM(
            id=entity.id,
            sender_id=entity.sender_id,
            recipient_id=entity.recipient_id,
            phone=entity.phone,
            email=entity.email,
            content=entity.content,
            channel=entity.channel,
            status=entity.status,
            created_at=entity.created_at,
        )

    @staticmethod
    def _to_domain(orm: MessageORM) -> Message:
        return Message(
            id=orm.id,
            sender_id=orm.sender_id,
            recipient_id=orm.recipient_id,
            phone=orm.phone,
            email=orm.email,
            content=orm.content,
            channel=orm.channel,
            status=orm.status,
            created_at=orm.created_at,
        )

    async def save(self, message: Message) -> Message:
        orm_obj = self._to_orm(message)
        self._session.add(orm_obj)
        await self._session.flush()
        await self._session.refresh(orm_obj)
        return self._to_domain(orm_obj)

    async def get_by_id(self, message_id: UUID) -> Optional[Message]:
        orm = await self._session.get(MessageORM, message_id)
        return self._to_domain(orm) if orm else None

    async def list_messages(
        self,
        clinic_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        recipient_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Message], int]:
        stmt = select(MessageORM)
        count_stmt = select(func.count(MessageORM.id))

        if recipient_id:
            stmt = stmt.where(MessageORM.recipient_id == recipient_id)
            count_stmt = count_stmt.where(MessageORM.recipient_id == recipient_id)
        if user_id:
            stmt = stmt.where(MessageORM.sender_id == user_id)
            count_stmt = count_stmt.where(MessageORM.sender_id == user_id)

        total_res = await self._session.execute(count_stmt)
        total = total_res.scalar_one() or 0

        stmt = stmt.order_by(MessageORM.created_at.desc()).limit(limit).offset(offset)
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()], total
