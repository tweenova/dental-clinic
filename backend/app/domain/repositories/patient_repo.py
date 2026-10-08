from abc import ABC, abstractmethod
from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID

from app.domain.models.booking_crm import Patient


class PatientRepository(ABC):
    """
    Contract for managing patient demographic records in persistence storage.
    """

    @abstractmethod
    async def save(self, patient: Patient) -> Patient:
        """Saves a new patient or updates an existing patient."""
        pass

    @abstractmethod
    async def get_by_id(self, patient_id: UUID) -> Optional[Patient]:
        """Retrieves a patient by internal UUID."""
        pass

    @abstractmethod
    async def find_duplicates(
        self,
        first_name: str,
        last_name: str,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        date_of_birth: Optional[date] = None,
        clinic_id: Optional[UUID] = None,
    ) -> List[Patient]:
        """Finds potential duplicate patient records based on identity matches."""
        pass

    @abstractmethod
    async def search(
        self,
        query: Optional[str] = None,
        clinic_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Patient], int]:
        """Performs server-side search across name, email, and phone with pagination."""
        pass
