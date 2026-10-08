from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.booking_crm import Lead, LeadSource
from app.domain.repositories.lead_repo import LeadRepository
from app.infrastructure.database.orm_models import LeadORM, LeadSourceORM


class PostgresLeadRepository(LeadRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: Lead) -> LeadORM:
        return LeadORM(
            id=entity.id,
            organization_id=entity.organization_id,
            clinic_id=entity.clinic_id,
            patient_id=entity.patient_id,
            lead_source_id=entity.lead_source_id,
            full_name=entity.full_name,
            phone=entity.phone,
            email=entity.email,
            status=entity.status,
            notes=entity.notes,
            utm_source=entity.utm_source,
            utm_campaign=entity.utm_campaign,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _to_domain(orm: LeadORM) -> Lead:
        return Lead(
            id=orm.id,
            organization_id=orm.organization_id,
            clinic_id=orm.clinic_id,
            patient_id=orm.patient_id,
            lead_source_id=orm.lead_source_id,
            full_name=orm.full_name,
            phone=orm.phone,
            email=orm.email,
            status=orm.status,
            notes=orm.notes,
            utm_source=orm.utm_source,
            utm_campaign=orm.utm_campaign,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    @staticmethod
    def _source_to_domain(orm: LeadSourceORM) -> LeadSource:
        return LeadSource(
            id=orm.id,
            name=orm.name,
            utm_source=orm.utm_source,
            is_active=orm.is_active,
            created_at=orm.created_at,
        )

    async def save(self, lead: Lead) -> Lead:
        existing = await self._session.get(LeadORM, lead.id)
        if existing:
            existing.clinic_id = lead.clinic_id
            existing.patient_id = lead.patient_id
            existing.lead_source_id = lead.lead_source_id
            existing.full_name = lead.full_name
            existing.phone = lead.phone
            existing.email = lead.email
            existing.status = lead.status
            existing.notes = lead.notes
            existing.utm_source = lead.utm_source
            existing.utm_campaign = lead.utm_campaign
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(lead)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, lead_id: UUID) -> Optional[Lead]:
        orm = await self._session.get(LeadORM, lead_id)
        return self._to_domain(orm) if orm else None

    async def list_leads(
        self,
        clinic_id: Optional[UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Lead], int]:
        stmt = select(LeadORM)
        count_stmt = select(func.count(LeadORM.id))

        if clinic_id:
            stmt = stmt.where(LeadORM.clinic_id == clinic_id)
            count_stmt = count_stmt.where(LeadORM.clinic_id == clinic_id)
        if status:
            stmt = stmt.where(LeadORM.status == status)
            count_stmt = count_stmt.where(LeadORM.status == status)
        if search and search.strip():
            pat = f"%{search.strip()}%"
            filter_expr = or_(
                LeadORM.full_name.ilike(pat),
                LeadORM.phone.ilike(pat),
                LeadORM.email.ilike(pat),
            )
            stmt = stmt.where(filter_expr)
            count_stmt = count_stmt.where(filter_expr)

        total_res = await self._session.execute(count_stmt)
        total = total_res.scalar_one() or 0

        stmt = stmt.order_by(LeadORM.created_at.desc()).limit(limit).offset(offset)
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()], total

    async def list_sources(self) -> List[LeadSource]:
        stmt = select(LeadSourceORM).where(LeadSourceORM.is_active.is_(True)).order_by(LeadSourceORM.name.asc())
        res = await self._session.execute(stmt)
        return [self._source_to_domain(r) for r in res.scalars().all()]

    async def save_source(self, source: LeadSource) -> LeadSource:
        orm_obj = LeadSourceORM(
            id=source.id,
            name=source.name,
            utm_source=source.utm_source,
            is_active=source.is_active,
            created_at=source.created_at,
        )
        self._session.add(orm_obj)
        await self._session.flush()
        return self._source_to_domain(orm_obj)
