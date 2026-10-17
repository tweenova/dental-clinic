from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4


@dataclass
class Organization:
    """
    Pure domain representation of an organization/practice.
    Supports future multi-clinic or multi-location expansion.
    """
    name: str
    display_name: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    background_color: Optional[str] = None
    primary_font: Optional[str] = None
    secondary_font: Optional[str] = None
    currency_code: str = "PKR"
    currency_symbol: str = "Rs"
    timezone: str = "Asia/Karachi"
    is_active: bool = True
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Clinic:
    """
    Pure domain representation of a clinic branch.
    """
    organization_id: UUID
    name: str
    address_line1: str
    city: str
    state: str
    postal_code: str
    address_line2: Optional[str] = None
    country: str = "US"
    phone: Optional[str] = None
    email: Optional[str] = None
    hours_info: Optional[str] = None
    is_primary: bool = True
    is_active: bool = True
    display_order: int = 0
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Location(Clinic):
    """
    Backwards-compatible alias for Clinic branch.
    """
    pass

