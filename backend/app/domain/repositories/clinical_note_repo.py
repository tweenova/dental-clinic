from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.models.clinical_note import ClinicalNote


class ClinicalNoteRepository(ABC):
    """
    Abstract repository interface for ClinicalNote persistence and revision tracking.
    """

    @abstractmethod
    async def get_by_id(self, note_id: UUID) -> Optional[ClinicalNote]:
        """Fetch clinical note snapshot by primary ID."""
        pass

    @abstractmethod
    async def get_current_by_encounter_id(self, encounter_id: UUID) -> Optional[ClinicalNote]:
        """Fetch current active (is_current=True) note revision for an encounter."""
        pass

    @abstractmethod
    async def list_revisions_by_encounter_id(self, encounter_id: UUID) -> List[ClinicalNote]:
        """List all historical revisions for an encounter ordered by revision_number ASC."""
        pass

    @abstractmethod
    async def save(self, note: ClinicalNote) -> ClinicalNote:
        """Insert or update a ClinicalNote domain record."""
        pass

