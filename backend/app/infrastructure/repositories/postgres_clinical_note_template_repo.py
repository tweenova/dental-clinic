from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.clinical_note_template import ClinicalNoteTemplate
from app.domain.repositories.clinical_note_template_repo import ClinicalNoteTemplateRepository
from app.infrastructure.database.orm_models import ClinicalNoteTemplateORM


class PostgresClinicalNoteTemplateRepository(ClinicalNoteTemplateRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: ClinicalNoteTemplate) -> ClinicalNoteTemplateORM:
        return ClinicalNoteTemplateORM(
            id=entity.id,
            name=entity.name,
            subjective=entity.subjective,
            objective=entity.objective,
            assessment=entity.assessment,
            plan=entity.plan,
            active=entity.active,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _to_domain(orm: ClinicalNoteTemplateORM) -> ClinicalNoteTemplate:
        return ClinicalNoteTemplate(
            id=orm.id,
            name=orm.name,
            subjective=orm.subjective,
            objective=orm.objective,
            assessment=orm.assessment,
            plan=orm.plan,
            active=orm.active,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def save(self, template: ClinicalNoteTemplate) -> ClinicalNoteTemplate:
        existing = await self._session.get(ClinicalNoteTemplateORM, template.id)
        if existing:
            existing.name = template.name
            existing.subjective = template.subjective
            existing.objective = template.objective
            existing.assessment = template.assessment
            existing.plan = template.plan
            existing.active = template.active
            existing.updated_at = datetime.now(timezone.utc)
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(template)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, template_id: UUID) -> Optional[ClinicalNoteTemplate]:
        orm = await self._session.get(ClinicalNoteTemplateORM, template_id)
        return self._to_domain(orm) if orm else None

    async def get_by_name(self, name: str) -> Optional[ClinicalNoteTemplate]:
        stmt = select(ClinicalNoteTemplateORM).where(ClinicalNoteTemplateORM.name == name)
        res = await self._session.execute(stmt)
        orm = res.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def list_templates(self, active_only: bool = True) -> List[ClinicalNoteTemplate]:
        stmt = select(ClinicalNoteTemplateORM)
        if active_only:
            stmt = stmt.where(ClinicalNoteTemplateORM.active.is_(True))
        stmt = stmt.order_by(ClinicalNoteTemplateORM.name.asc())
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]
