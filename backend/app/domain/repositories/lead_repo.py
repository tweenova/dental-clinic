from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from uuid import UUID

from app.domain.models.booking_crm import Lead, LeadSource


class LeadRepository(ABC):
    """
    Contract for managing prospect leads and acquisition sources.
    """

    @abstractmethod
    async def save(self, lead: Lead) -> Lead:
        """Saves or updates a lead."""
        pass

    @abstractmethod
    async def get_by_id(self, lead_id: UUID) -> Optional[Lead]:
        """Retrieves a lead by ID."""
        pass

    @abstractmethod
    async def list_leads(
        self,
        clinic_id: Optional[UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Lead], int]:
        """Returns filtered leads list with pagination."""
        pass

    @abstractmethod
    async def list_sources(self) -> List[LeadSource]:
        """Returns all active lead acquisition channels."""
        pass

    @abstractmethod
    async def save_source(self, source: LeadSource) -> LeadSource:
        """Saves a lead source."""
        pass
