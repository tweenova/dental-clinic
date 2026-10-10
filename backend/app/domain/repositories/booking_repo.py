from abc import ABC, abstractmethod
from datetime import date
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from app.domain.models.booking_crm import Booking


class BookingRepository(ABC):
    """
    Contract for managing operational appointment bookings in persistence storage.
    """

    @abstractmethod
    async def save(self, booking: Booking) -> Booking:
        """Saves a new booking or updates an existing booking."""
        pass

    @abstractmethod
    async def get_by_id(self, booking_id: UUID) -> Optional[Booking]:
        """Retrieves a booking by internal UUID."""
        pass

    @abstractmethod
    async def get_by_confirmation_id(self, confirmation_id: str) -> Optional[Booking]:
        """Retrieves a booking by its confirmation ID."""
        pass

    @abstractmethod
    async def list_bookings(
        self,
        clinic_id: Optional[UUID] = None,
        team_member_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Booking], int]:
        """Returns filtered list of bookings and total matching count."""
        pass

    @abstractmethod
    async def get_counts_for_date(
        self, target_date: date, clinic_id: Optional[UUID] = None
    ) -> Dict[str, int]:
        """Returns aggregate status counts for a specified date."""
        pass

    @abstractmethod
    async def get_patient_bookings(self, patient_id: UUID) -> List[Booking]:
        """Returns all bookings associated with a specific patient."""
        pass
