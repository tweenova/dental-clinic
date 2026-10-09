from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.models.dental_chart import DentalChartFinding


class DentalChartRepository(ABC):
    """
    Abstract repository interface for DentalChartFinding persistence.
    Findings are append/update only; there is no hard-delete operation.
    """

    @abstractmethod
    async def get_by_id(self, finding_id: UUID) -> Optional[DentalChartFinding]:
        """Fetch a finding by primary ID."""
        pass

    @abstractmethod
    async def list_by_patient_id(
        self,
        patient_id: UUID,
        include_resolved: bool = True,
    ) -> List[DentalChartFinding]:
        """List all findings for a patient ordered by created_at ASC (cumulative chart)."""
        pass

    @abstractmethod
    async def list_by_encounter_id(self, encounter_id: UUID) -> List[DentalChartFinding]:
        """List findings recorded during a specific encounter ordered by created_at ASC."""
        pass

    @abstractmethod
    async def find_duplicate_active(
        self,
        patient_id: UUID,
        tooth: str,
        condition: str,
        surfaces_key: str,
    ) -> Optional[DentalChartFinding]:
        """Returns an active finding identical in patient/tooth/condition/surfaces, if any."""
        pass

    @abstractmethod
    async def save(self, finding: DentalChartFinding) -> DentalChartFinding:
        """Insert or update a DentalChartFinding domain record."""
        pass
