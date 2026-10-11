from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.clinical_note import ClinicalNote
from app.domain.repositories.clinical_note_repo import ClinicalNoteRepository
from app.infrastructure.database.orm_models import ClinicalNoteORM


class PostgresClinicalNoteRepository(ClinicalNoteRepository):
    """
    PostgreSQL SQLAlchemy implementation of the ClinicalNoteRepository interface.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, orm: ClinicalNoteORM) -> ClinicalNote:
        return ClinicalNote(
            id=orm.id,
            encounter_id=orm.encounter_id,
            patient_id=orm.patient_id,
            author_id=orm.author_id,
            revision_number=orm.revision_number,
            is_current=orm.is_current,
            status=orm.status,
            clinic_id=orm.clinic_id,
            subjective=orm.subjective,
            objective=orm.objective,
            assessment=orm.assessment,
            plan=orm.plan,
            is_signed=orm.is_signed,
            signed_at=orm.signed_at,
            signed_by_id=orm.signed_by_id,
            amendment_reason=orm.amendment_reason,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def get_by_id(self, note_id: UUID) -> Optional[ClinicalNote]:
        stmt = select(ClinicalNoteORM).where(ClinicalNoteORM.id == note_id)
        result = await self.session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_current_by_encounter_id(self, encounter_id: UUID) -> Optional[ClinicalNote]:
        stmt = (
            select(ClinicalNoteORM)
            .where(
                ClinicalNoteORM.encounter_id == encounter_id,
                ClinicalNoteORM.is_current == True,
            )
            .order_by(ClinicalNoteORM.revision_number.desc())
        )
        result = await self.session.execute(stmt)
        orm = result.scalars().first()
        return self._to_domain(orm) if orm else None

    async def list_revisions_by_encounter_id(self, encounter_id: UUID) -> List[ClinicalNote]:
        stmt = (
            select(ClinicalNoteORM)
            .where(ClinicalNoteORM.encounter_id == encounter_id)
            .order_by(ClinicalNoteORM.revision_number.asc())
        )
        result = await self.session.execute(stmt)
        orms = result.scalars().all()
        return [self._to_domain(o) for o in orms]

    async def save(self, note: ClinicalNote) -> ClinicalNote:
        stmt = select(ClinicalNoteORM).where(ClinicalNoteORM.id == note.id)
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.encounter_id = note.encounter_id
            existing.patient_id = note.patient_id
            existing.author_id = note.author_id
            existing.revision_number = note.revision_number
            existing.is_current = note.is_current
            existing.status = note.status
            existing.clinic_id = note.clinic_id
            existing.subjective = note.subjective
            existing.objective = note.objective
            existing.assessment = note.assessment
            existing.plan = note.plan
            existing.is_signed = note.is_signed
            existing.signed_at = note.signed_at
            existing.signed_by_id = note.signed_by_id
            existing.amendment_reason = note.amendment_reason
            existing.updated_at = note.updated_at
        else:
            orm = ClinicalNoteORM(
                id=note.id,
                encounter_id=note.encounter_id,
                patient_id=note.patient_id,
                author_id=note.author_id,
                revision_number=note.revision_number,
                is_current=note.is_current,
                status=note.status,
                clinic_id=note.clinic_id,
                subjective=note.subjective,
                objective=note.objective,
                assessment=note.assessment,
                plan=note.plan,
                is_signed=note.is_signed,
                signed_at=note.signed_at,
                signed_by_id=note.signed_by_id,
                amendment_reason=note.amendment_reason,
                created_at=note.created_at,
                updated_at=note.updated_at,
            )
            self.session.add(orm)

        await self.session.flush()
        return note

