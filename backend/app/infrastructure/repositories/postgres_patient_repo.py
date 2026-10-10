from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.booking_crm import Patient
from app.domain.repositories.patient_repo import PatientRepository
from app.infrastructure.database.orm_models import PatientORM


class PostgresPatientRepository(PatientRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: Patient) -> PatientORM:
        return PatientORM(
            id=entity.id,
            organization_id=entity.organization_id,
            clinic_id=entity.clinic_id,
            first_name=entity.first_name,
            last_name=entity.last_name,
            phone=entity.phone,
            email=entity.email,
            date_of_birth=entity.date_of_birth,
            notes=entity.notes,
            is_active=entity.is_active,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _to_domain(orm: PatientORM) -> Patient:
        return Patient(
            id=orm.id,
            organization_id=orm.organization_id,
            clinic_id=orm.clinic_id,
            first_name=orm.first_name,
            last_name=orm.last_name,
            phone=orm.phone,
            email=orm.email,
            date_of_birth=orm.date_of_birth,
            notes=orm.notes,
            is_active=orm.is_active,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def save(self, patient: Patient) -> Patient:
        existing = await self._session.get(PatientORM, patient.id)
        if existing:
            existing.first_name = patient.first_name
            existing.last_name = patient.last_name
            existing.phone = patient.phone
            existing.email = patient.email
            existing.clinic_id = patient.clinic_id
            existing.date_of_birth = patient.date_of_birth
            existing.notes = patient.notes
            existing.is_active = patient.is_active
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(patient)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, patient_id: UUID) -> Optional[Patient]:
        orm = await self._session.get(PatientORM, patient_id)
        return self._to_domain(orm) if orm else None

    async def find_duplicates(
        self,
        first_name: str,
        last_name: str,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        date_of_birth: Optional[date] = None,
        clinic_id: Optional[UUID] = None,
    ) -> List[Patient]:
        conditions = []
        fn_clean = first_name.strip()
        ln_clean = last_name.strip()

        # Name + Phone
        if phone and phone.strip():
            conditions.append(
                (PatientORM.first_name.ilike(fn_clean))
                & (PatientORM.last_name.ilike(ln_clean))
                & (PatientORM.phone == phone.strip())
            )
        # Name + Email
        if email and email.strip():
            conditions.append(
                (PatientORM.first_name.ilike(fn_clean))
                & (PatientORM.last_name.ilike(ln_clean))
                & (PatientORM.email.ilike(email.strip()))
            )
        # Name + DOB
        if date_of_birth:
            conditions.append(
                (PatientORM.first_name.ilike(fn_clean))
                & (PatientORM.last_name.ilike(ln_clean))
                & (PatientORM.date_of_birth == date_of_birth)
            )

        if not conditions:
            # Fallback to exact full name matching
            conditions.append(
                (PatientORM.first_name.ilike(fn_clean)) & (PatientORM.last_name.ilike(ln_clean))
            )

        stmt = select(PatientORM).where(or_(*conditions))
        if clinic_id:
            stmt = stmt.where(PatientORM.clinic_id == clinic_id)

        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]

    async def search(
        self,
        query: Optional[str] = None,
        clinic_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Patient], int]:
        stmt = select(PatientORM).where(PatientORM.is_active.is_(True))
        count_stmt = select(func.count(PatientORM.id)).where(PatientORM.is_active.is_(True))

        if clinic_id:
            stmt = stmt.where(PatientORM.clinic_id == clinic_id)
            count_stmt = count_stmt.where(PatientORM.clinic_id == clinic_id)

        if query and query.strip():
            pat = f"%{query.strip()}%"
            filter_expr = or_(
                PatientORM.first_name.ilike(pat),
                PatientORM.last_name.ilike(pat),
                PatientORM.phone.ilike(pat),
                PatientORM.email.ilike(pat),
            )
            stmt = stmt.where(filter_expr)
            count_stmt = count_stmt.where(filter_expr)

        total_res = await self._session.execute(count_stmt)
        total = total_res.scalar_one() or 0

        stmt = (
            stmt.order_by(PatientORM.last_name.asc(), PatientORM.first_name.asc())
            .limit(limit)
            .offset(offset)
        )
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()], total
