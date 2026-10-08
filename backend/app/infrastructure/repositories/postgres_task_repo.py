from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.booking_crm import Task
from app.domain.repositories.task_repo import TaskRepository
from app.infrastructure.database.orm_models import TaskORM


class PostgresTaskRepository(TaskRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: Task) -> TaskORM:
        return TaskORM(
            id=entity.id,
            clinic_id=entity.clinic_id,
            assigned_to_user_id=entity.assigned_to_user_id,
            title=entity.title,
            description=entity.description,
            due_date=entity.due_date,
            status=entity.status,
            priority=entity.priority,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _to_domain(orm: TaskORM) -> Task:
        return Task(
            id=orm.id,
            clinic_id=orm.clinic_id,
            assigned_to_user_id=orm.assigned_to_user_id,
            title=orm.title,
            description=orm.description,
            due_date=orm.due_date,
            status=orm.status,
            priority=orm.priority,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def save(self, task: Task) -> Task:
        existing = await self._session.get(TaskORM, task.id)
        if existing:
            existing.clinic_id = task.clinic_id
            existing.assigned_to_user_id = task.assigned_to_user_id
            existing.title = task.title
            existing.description = task.description
            existing.due_date = task.due_date
            existing.status = task.status
            existing.priority = task.priority
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(task)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, task_id: UUID) -> Optional[Task]:
        orm = await self._session.get(TaskORM, task_id)
        return self._to_domain(orm) if orm else None

    async def list_tasks(
        self,
        clinic_id: Optional[UUID] = None,
        assigned_to_user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Task], int]:
        stmt = select(TaskORM)
        count_stmt = select(func.count(TaskORM.id))

        if clinic_id:
            stmt = stmt.where(TaskORM.clinic_id == clinic_id)
            count_stmt = count_stmt.where(TaskORM.clinic_id == clinic_id)
        if assigned_to_user_id:
            stmt = stmt.where(TaskORM.assigned_to_user_id == assigned_to_user_id)
            count_stmt = count_stmt.where(TaskORM.assigned_to_user_id == assigned_to_user_id)
        if status:
            stmt = stmt.where(TaskORM.status == status)
            count_stmt = count_stmt.where(TaskORM.status == status)
        if priority:
            stmt = stmt.where(TaskORM.priority == priority)
            count_stmt = count_stmt.where(TaskORM.priority == priority)

        total_res = await self._session.execute(count_stmt)
        total = total_res.scalar_one() or 0

        stmt = stmt.order_by(TaskORM.created_at.desc()).limit(limit).offset(offset)
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()], total
