from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from uuid import UUID

from app.domain.models.booking_crm import Message


class MessageRepository(ABC):
    """
    Contract for storing patient communications and notification records.
    """

    @abstractmethod
    async def save(self, message: Message) -> Message:
        """Saves a communication message record."""
        pass

    @abstractmethod
    async def get_by_id(self, message_id: UUID) -> Optional[Message]:
        """Retrieves a message record by ID."""
        pass

    @abstractmethod
    async def list_messages(
        self,
        clinic_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        recipient_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Message], int]:
        """Returns filtered message records with pagination."""
        pass
