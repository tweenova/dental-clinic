from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4


@dataclass
class VisitPayment:
    amount_cents: int
    id: UUID = field(default_factory=uuid4)
    clinic_id: Optional[UUID] = None
    booking_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    currency: str = "PKR"
    method: str = "cash"  # "cash", "card", "bank_transfer"
    notes: Optional[str] = None
    recorded_by_user_id: Optional[UUID] = None
    amount_charged_cents: int = 0
    is_voided: bool = False
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    voided_by_user_id: Optional[UUID] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def amount_formatted(self) -> str:
        units = self.amount_cents / 100
        return f"{self.currency} {units:,.2f}"

    @property
    def amount_charged_formatted(self) -> str:
        units = self.amount_charged_cents / 100
        return f"{self.currency} {units:,.2f}"
