from abc import ABC, abstractmethod
from datetime import date
from typing import List, Optional
from uuid import UUID

from app.domain.models.visit_payment import VisitPayment


class VisitPaymentRepository(ABC):
    @abstractmethod
    async def create(self, payment: VisitPayment) -> VisitPayment:
        """Saves a newly recorded visit payment."""
        pass

    @abstractmethod
    async def get_by_id(self, payment_id: UUID) -> Optional[VisitPayment]:
        """Fetches payment by ID."""
        pass

    @abstractmethod
    async def list_by_booking_id(self, booking_id: UUID) -> List[VisitPayment]:
        """Lists all payments recorded for a specific booking."""
        pass

    @abstractmethod
    async def list_by_date(
        self,
        target_date: date,
        clinic_id: Optional[UUID] = None,
    ) -> List[VisitPayment]:
        """Lists all payments recorded on a given date (for end of day reconciliation)."""
        pass

    @abstractmethod
    async def update(self, payment: VisitPayment) -> VisitPayment:
        """Updates an existing visit payment (e.g. for voiding)."""
        pass
