from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.models.patient_document import (
    PatientAttachment,
    PatientConsent,
    Prescription,
    ReferralLetter,
)


class PatientAttachmentRepository(ABC):
    @abstractmethod
    async def save(self, attachment: PatientAttachment) -> PatientAttachment:
        pass

    @abstractmethod
    async def get_by_id(self, attachment_id: UUID) -> Optional[PatientAttachment]:
        pass

    @abstractmethod
    async def list_by_patient(
        self, patient_id: UUID, category: Optional[str] = None, include_voided: bool = False
    ) -> List[PatientAttachment]:
        pass


class PatientConsentRepository(ABC):
    @abstractmethod
    async def save(self, consent: PatientConsent) -> PatientConsent:
        pass

    @abstractmethod
    async def get_by_id(self, consent_id: UUID) -> Optional[PatientConsent]:
        pass

    @abstractmethod
    async def list_by_patient(
        self, patient_id: UUID, encounter_id: Optional[UUID] = None, include_voided: bool = False
    ) -> List[PatientConsent]:
        pass


class ClinicalDocumentRepository(ABC):
    @abstractmethod
    async def save_prescription(self, prescription: Prescription) -> Prescription:
        pass

    @abstractmethod
    async def get_prescription(self, prescription_id: UUID) -> Optional[Prescription]:
        pass

    @abstractmethod
    async def list_prescriptions_by_encounter(self, encounter_id: UUID) -> List[Prescription]:
        pass

    @abstractmethod
    async def save_referral(self, referral: ReferralLetter) -> ReferralLetter:
        pass

    @abstractmethod
    async def get_referral(self, referral_id: UUID) -> Optional[ReferralLetter]:
        pass

    @abstractmethod
    async def list_referrals_by_encounter(self, encounter_id: UUID) -> List[ReferralLetter]:
        pass
