from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Set
from uuid import UUID, uuid4


class EncounterStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


ALLOWED_ENCOUNTER_TRANSITIONS: dict[EncounterStatus, Set[EncounterStatus]] = {
    EncounterStatus.DRAFT: {EncounterStatus.IN_PROGRESS, EncounterStatus.CANCELLED},
    EncounterStatus.IN_PROGRESS: {EncounterStatus.COMPLETED, EncounterStatus.CANCELLED},
    EncounterStatus.COMPLETED: set(),  # Terminal visit state
    EncounterStatus.CANCELLED: set(),  # Terminal visit state
}


@dataclass
class ClinicalEncounter:
    """
    Pure domain representation of a clinical encounter/visit.
    Maintains independent clinical identity while optionally associating with operational bookings.
    """
    patient_id: UUID
    clinician_id: UUID
    status: str = EncounterStatus.DRAFT.value
    clinic_id: Optional[UUID] = None
    booking_id: Optional[UUID] = None
    appointment_id: Optional[UUID] = None
    chief_complaint: Optional[str] = None
    reason_for_visit: Optional[str] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

