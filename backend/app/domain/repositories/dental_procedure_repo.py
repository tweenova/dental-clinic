from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.models.dental_chart import DentalProcedureRecord


class DentalProcedureRepository(ABC):
    """
    Abstract repository interface for DentalProcedureRecord persistence.
    Procedure records are never hard-deleted; status transitions carry the lifecycle.
    """

    @abstractmethod
    async def get_by_id(self, procedure_id: UUID) -> Optional[DentalProcedureRecord]:
        """Fetch a procedure record by primary ID."""
        pass

    @abstractmethod
    async def list_by_patient_id(self, patient_id: UUID) -> List[DentalProcedureRecord]:
        """List all procedure records for a patient ordered by created_at ASC (treatment history)."""
        pass

    @abstractmethod
    async def list_by_encounter_id(self, encounter_id: UUID) -> List[DentalProcedureRecord]:
        """List procedure records recorded during a specific encounter ordered by created_at ASC."""
        pass

    @abstractmethod
    async def save(self, procedure: DentalProcedureRecord) -> DentalProcedureRecord:
        """Insert or update a DentalProcedureRecord domain record."""
        pass
