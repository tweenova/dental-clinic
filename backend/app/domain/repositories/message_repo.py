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

    @abstractmethod
    async def get_patient_messages(self, patient_id: UUID) -> List[Message]:
        """Returns communications associated with a patient."""
        pass

    @abstractmethod
    async def list_due_reminders(self, as_of: Optional[object] = None, limit: int = 100) -> List[Message]:
        """Returns scheduled reminder messages that are due for delivery."""
        pass

    @abstractmethod
    async def cancel_pending_reminders(self, booking_id: UUID) -> int:
        """Cancels any pending reminder messages for a booking."""
        pass

    @abstractmethod
    async def get_by_booking_and_type(
        self, booking_id: UUID, reminder_type: str, active_only: bool = True
    ) -> Optional[Message]:
        """Finds a reminder message for a booking and specific reminder type."""
        pass

