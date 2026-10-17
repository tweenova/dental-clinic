from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.domain.models.clinical_note_template import ClinicalNoteTemplate


class ClinicalNoteTemplateRepository(ABC):
    """
    Contract for managing clinical note templates.
    """

    @abstractmethod
    async def save(self, template: ClinicalNoteTemplate) -> ClinicalNoteTemplate:
        """Saves or updates a note template."""
        pass

    @abstractmethod
    async def get_by_id(self, template_id: UUID) -> Optional[ClinicalNoteTemplate]:
        """Gets a note template by ID."""
        pass

    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[ClinicalNoteTemplate]:
        """Gets a note template by name."""
        pass

    @abstractmethod
    async def list_templates(self, active_only: bool = True) -> List[ClinicalNoteTemplate]:
        """Lists note templates."""
        pass
