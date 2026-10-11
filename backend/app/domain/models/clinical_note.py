from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4


class NoteStatus(str, Enum):
    DRAFT = "draft"
    SIGNED = "signed"
    AMENDED = "amended"


@dataclass
class ClinicalNote:
    """
    Pure domain representation of a structured SOAP clinical note revision snapshot.
    Supports draft authoring, signing, and immutable revision tracking.
    """
    encounter_id: UUID
    patient_id: UUID
    author_id: UUID  # FK to team_members.id
    revision_number: int = 1
    is_current: bool = True
    status: str = NoteStatus.DRAFT.value
    clinic_id: Optional[UUID] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    is_signed: bool = False
    signed_at: Optional[datetime] = None
    signed_by_id: Optional[UUID] = None
    amendment_reason: Optional[str] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

