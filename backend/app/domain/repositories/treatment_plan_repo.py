from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.models.treatment_plan import TreatmentPlanItem


class TreatmentPlanRepository(ABC):
    """
    Contract for managing treatment plan items.
    """

    @abstractmethod
    async def save(self, item: TreatmentPlanItem) -> TreatmentPlanItem:
        """Saves or updates a treatment plan item."""
        pass

    @abstractmethod
    async def get_by_id(self, item_id: UUID) -> Optional[TreatmentPlanItem]:
        """Gets a treatment plan item by its unique ID."""
        pass

    @abstractmethod
    async def list_by_patient(self, patient_id: UUID) -> List[TreatmentPlanItem]:
        """Returns all treatment plan items for a patient, ordered by tooth number and date."""
        pass

    @abstractmethod
    async def get_by_completed_procedure_id(self, procedure_id: UUID) -> Optional[TreatmentPlanItem]:
        """Finds any treatment plan item completed by a specific procedure ID."""
        pass
