import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.patient_document import (
    PatientAttachment,
    PatientConsent,
    Prescription,
    ReferralLetter,
)
from app.domain.repositories.patient_document_repo import (
    ClinicalDocumentRepository,
    PatientAttachmentRepository,
    PatientConsentRepository,
)
from app.infrastructure.database.orm_models import (
    PatientAttachmentORM,
    PatientConsentORM,
    PrescriptionORM,
    ReferralLetterORM,
)


class PostgresPatientAttachmentRepository(PatientAttachmentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: PatientAttachment) -> PatientAttachmentORM:
        return PatientAttachmentORM(
            id=entity.id,
            patient_id=entity.patient_id,
            encounter_id=entity.encounter_id,
            category=entity.category,
            original_filename=entity.original_filename,
            content_type=entity.content_type,
            size=entity.size,
            stored_name=entity.stored_name,
            uploaded_by=entity.uploaded_by,
            uploaded_at=entity.uploaded_at,
            voided=entity.voided,
            void_reason=entity.void_reason,
            voided_at=entity.voided_at,
            voided_by=entity.voided_by,
        )

    @staticmethod
    def _to_domain(orm: PatientAttachmentORM) -> PatientAttachment:
        return PatientAttachment(
            id=orm.id,
            patient_id=orm.patient_id,
            encounter_id=orm.encounter_id,
            category=orm.category,
            original_filename=orm.original_filename,
            content_type=orm.content_type,
            size=orm.size,
            stored_name=orm.stored_name,
            uploaded_by=orm.uploaded_by,
            uploaded_at=orm.uploaded_at,
            voided=orm.voided,
            void_reason=orm.void_reason,
            voided_at=orm.voided_at,
            voided_by=orm.voided_by,
        )

    async def save(self, attachment: PatientAttachment) -> PatientAttachment:
        existing = await self._session.get(PatientAttachmentORM, attachment.id)
        if existing:
            existing.voided = attachment.voided
            existing.void_reason = attachment.void_reason
            existing.voided_at = attachment.voided_at
            existing.voided_by = attachment.voided_by
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(attachment)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, attachment_id: UUID) -> Optional[PatientAttachment]:
        orm = await self._session.get(PatientAttachmentORM, attachment_id)
        return self._to_domain(orm) if orm else None

    async def list_by_patient(
        self, patient_id: UUID, category: Optional[str] = None, include_voided: bool = False
    ) -> List[PatientAttachment]:
        stmt = select(PatientAttachmentORM).where(PatientAttachmentORM.patient_id == patient_id)
        if not include_voided:
            stmt = stmt.where(PatientAttachmentORM.voided.is_(False))
        if category:
            stmt = stmt.where(PatientAttachmentORM.category == category)
        stmt = stmt.order_by(PatientAttachmentORM.uploaded_at.desc())
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]


class PostgresPatientConsentRepository(PatientConsentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_orm(entity: PatientConsent) -> PatientConsentORM:
        return PatientConsentORM(
            id=entity.id,
            patient_id=entity.patient_id,
            encounter_id=entity.encounter_id,
            procedure_id=entity.procedure_id,
            consent_type=entity.consent_type,
            consent_text_version=entity.consent_text_version,
            method=entity.method,
            signed_name=entity.signed_name,
            attachment_id=entity.attachment_id,
            obtained_by=entity.obtained_by,
            recorded_at=entity.recorded_at,
            voided=entity.voided,
            void_reason=entity.void_reason,
            voided_at=entity.voided_at,
            voided_by=entity.voided_by,
        )

    @staticmethod
    def _to_domain(orm: PatientConsentORM) -> PatientConsent:
        return PatientConsent(
            id=orm.id,
            patient_id=orm.patient_id,
            encounter_id=orm.encounter_id,
            procedure_id=orm.procedure_id,
            consent_type=orm.consent_type,
            consent_text_version=orm.consent_text_version,
            method=orm.method,
            signed_name=orm.signed_name,
            attachment_id=orm.attachment_id,
            obtained_by=orm.obtained_by,
            recorded_at=orm.recorded_at,
            voided=orm.voided,
            void_reason=orm.void_reason,
            voided_at=orm.voided_at,
            voided_by=orm.voided_by,
        )

    async def save(self, consent: PatientConsent) -> PatientConsent:
        existing = await self._session.get(PatientConsentORM, consent.id)
        if existing:
            existing.voided = consent.voided
            existing.void_reason = consent.void_reason
            existing.voided_at = consent.voided_at
            existing.voided_by = consent.voided_by
            await self._session.flush()
            await self._session.refresh(existing)
            return self._to_domain(existing)
        else:
            orm_obj = self._to_orm(consent)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._to_domain(orm_obj)

    async def get_by_id(self, consent_id: UUID) -> Optional[PatientConsent]:
        orm = await self._session.get(PatientConsentORM, consent_id)
        return self._to_domain(orm) if orm else None

    async def list_by_patient(
        self, patient_id: UUID, encounter_id: Optional[UUID] = None, include_voided: bool = False
    ) -> List[PatientConsent]:
        stmt = select(PatientConsentORM).where(PatientConsentORM.patient_id == patient_id)
        if encounter_id:
            stmt = stmt.where(PatientConsentORM.encounter_id == encounter_id)
        if not include_voided:
            stmt = stmt.where(PatientConsentORM.voided.is_(False))
        stmt = stmt.order_by(PatientConsentORM.recorded_at.desc())
        res = await self._session.execute(stmt)
        return [self._to_domain(r) for r in res.scalars().all()]


class PostgresClinicalDocumentRepository(ClinicalDocumentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _rx_to_orm(entity: Prescription) -> PrescriptionORM:
        return PrescriptionORM(
            id=entity.id,
            encounter_id=entity.encounter_id,
            patient_id=entity.patient_id,
            status=entity.status,
            items_json=json.dumps(entity.items),
            notes=entity.notes,
            doctor_id=entity.doctor_id,
            signed_at=entity.signed_at,
            signed_by_user_id=entity.signed_by_user_id,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _rx_to_domain(orm: PrescriptionORM) -> Prescription:
        items = []
        try:
            items = json.loads(orm.items_json) if orm.items_json else []
        except Exception:
            pass
        return Prescription(
            id=orm.id,
            encounter_id=orm.encounter_id,
            patient_id=orm.patient_id,
            status=orm.status,
            items=items,
            notes=orm.notes,
            doctor_id=orm.doctor_id,
            signed_at=orm.signed_at,
            signed_by_user_id=orm.signed_by_user_id,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def save_prescription(self, prescription: Prescription) -> Prescription:
        existing = await self._session.get(PrescriptionORM, prescription.id)
        if existing:
            existing.status = prescription.status
            existing.items_json = json.dumps(prescription.items)
            existing.notes = prescription.notes
            existing.signed_at = prescription.signed_at
            existing.signed_by_user_id = prescription.signed_by_user_id
            existing.updated_at = datetime.now(timezone.utc)
            await self._session.flush()
            await self._session.refresh(existing)
            return self._rx_to_domain(existing)
        else:
            orm_obj = self._rx_to_orm(prescription)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._rx_to_domain(orm_obj)

    async def get_prescription(self, prescription_id: UUID) -> Optional[Prescription]:
        orm = await self._session.get(PrescriptionORM, prescription_id)
        return self._rx_to_domain(orm) if orm else None

    async def list_prescriptions_by_encounter(self, encounter_id: UUID) -> List[Prescription]:
        stmt = (
            select(PrescriptionORM)
            .where(PrescriptionORM.encounter_id == encounter_id)
            .order_by(PrescriptionORM.created_at.asc())
        )
        res = await self._session.execute(stmt)
        return [self._rx_to_domain(r) for r in res.scalars().all()]

    @staticmethod
    def _ref_to_orm(entity: ReferralLetter) -> ReferralLetterORM:
        return ReferralLetterORM(
            id=entity.id,
            encounter_id=entity.encounter_id,
            patient_id=entity.patient_id,
            status=entity.status,
            recipient=entity.recipient,
            reason=entity.reason,
            summary=entity.summary,
            doctor_id=entity.doctor_id,
            signed_at=entity.signed_at,
            signed_by_user_id=entity.signed_by_user_id,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _ref_to_domain(orm: ReferralLetterORM) -> ReferralLetter:
        return ReferralLetter(
            id=orm.id,
            encounter_id=orm.encounter_id,
            patient_id=orm.patient_id,
            status=orm.status,
            recipient=orm.recipient,
            reason=orm.reason,
            summary=orm.summary,
            doctor_id=orm.doctor_id,
            signed_at=orm.signed_at,
            signed_by_user_id=orm.signed_by_user_id,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def save_referral(self, referral: ReferralLetter) -> ReferralLetter:
        existing = await self._session.get(ReferralLetterORM, referral.id)
        if existing:
            existing.status = referral.status
            existing.recipient = referral.recipient
            existing.reason = referral.reason
            existing.summary = referral.summary
            existing.signed_at = referral.signed_at
            existing.signed_by_user_id = referral.signed_by_user_id
            existing.updated_at = datetime.now(timezone.utc)
            await self._session.flush()
            await self._session.refresh(existing)
            return self._ref_to_domain(existing)
        else:
            orm_obj = self._ref_to_orm(referral)
            self._session.add(orm_obj)
            await self._session.flush()
            await self._session.refresh(orm_obj)
            return self._ref_to_domain(orm_obj)

    async def get_referral(self, referral_id: UUID) -> Optional[ReferralLetter]:
        orm = await self._session.get(ReferralLetterORM, referral_id)
        return self._ref_to_domain(orm) if orm else None

    async def list_referrals_by_encounter(self, encounter_id: UUID) -> List[ReferralLetter]:
        stmt = (
            select(ReferralLetterORM)
            .where(ReferralLetterORM.encounter_id == encounter_id)
            .order_by(ReferralLetterORM.created_at.asc())
        )
        res = await self._session.execute(stmt)
        return [self._ref_to_domain(r) for r in res.scalars().all()]
