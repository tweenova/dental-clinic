from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4


class UserRole(str, Enum):
    PLATFORM_OWNER = "Platform Owner"
    SUPER_ADMIN = "Super Admin"
    CLINIC_BRANCH_MANAGER = "Clinic Branch Manager"
    DOCTOR = "doctor"
    RECEPTIONIST = "receptionist"
    ADMIN = "admin"
    PATIENT = "patient"


@dataclass
class User:
    """
    Pure domain representation of an authenticated user in the system.
    Strictly independent of ORM or HTTP frameworks.
    """
    email: str
    hashed_password: str
    full_name: str
    role: UserRole = UserRole.ADMIN
    is_active: bool = True
    inactivity_enabled: bool = True
    inactivity_timeout_minutes: int = 15
    inactivity_warning_seconds: int = 60
    clinic_id: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))



@dataclass
class UserSession:
    """
    Pure domain representation of an active authentication session.
    Allows immediate server-side revocation of 7-day access tokens.
    """
    user_id: UUID
    expires_at: datetime
    is_active: bool = True
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    revoked_at: Optional[datetime] = None


@dataclass
class RefreshToken:
    """
    Server-side record of a refresh token for rotation and revocation.
    """
    user_id: UUID
    token_hash: str
    expires_at: datetime
    session_id: Optional[UUID] = None
    is_revoked: bool = False
    replaced_by: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    revoked_at: Optional[datetime] = None
