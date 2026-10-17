from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


@dataclass
class ClinicalNoteTemplate:
    """
    Domain entity for a structured note template with neutral section headings and prompts.
    """
    name: str
    subjective: str
    objective: str
    assessment: str
    plan: str
    active: bool = True
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
