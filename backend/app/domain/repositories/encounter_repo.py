from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.models.encounter import ClinicalEncounter


class EncounterRepository(ABC):
    """
    Abstract interface for ClinicalEncounter persistence operations.
    """

    @abstractmethod
    async def get_by_id(self, encounter_id: UUID) -> Optional[ClinicalEncounter]:
        """Fetch encounter by primary UUID."""
        pass

    @abstractmethod
    async def get_active_by_booking_id(self, booking_id: UUID) -> Optional[ClinicalEncounter]:
        """Fetch active ('draft' or 'in_progress') encounter for a booking if one exists."""
        pass

    @abstractmethod
    async def list_by_patient_id(self, patient_id: UUID, limit: int = 50) -> List[ClinicalEncounter]:
        """List encounters for a patient ordered by created_at DESC."""
        pass

    @abstractmethod
    async def list_by_clinician_id(
        self,
        clinician_id: UUID,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[ClinicalEncounter]:
        """List encounters assigned to a clinician."""
        pass

    @abstractmethod
    async def save(self, encounter: ClinicalEncounter) -> ClinicalEncounter:
        """Insert or update a ClinicalEncounter domain record."""
        pass

