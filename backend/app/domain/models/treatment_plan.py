from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID, uuid4


@dataclass
class TreatmentPlanItem:
    """
    Domain entity for a planned procedure within a patient's treatment plan.
    Statuses: proposed, accepted, declined, completed.
    """
    patient_id: UUID
    procedure_name: str
    created_by_user_id: UUID
    tooth_number: Optional[int] = None
    service_id: Optional[str] = None
    status: str = "proposed"
    estimated_cost_cents: int = 0
    decision_date: Optional[date] = None
    notes: Optional[str] = None
    completed_procedure_id: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
