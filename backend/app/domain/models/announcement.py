from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


@dataclass
class Announcement:
    """
    Pure domain representation of an announcement ticker message for the website marquee.
    """
    content: str
    is_active: bool = True
    display_order: int = 0
    is_auto_booking_banner: bool = False
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
