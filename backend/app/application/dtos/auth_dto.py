from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    """Schema for user login credentials."""
    email: str = Field(..., description="User's registered email address")
    password: str = Field(..., min_length=6, description="User password")

    model_config = ConfigDict(extra="ignore")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("email must be a valid email address.")
        return clean


class UserResponse(BaseModel):
    """User profile data returned to authenticated clients."""
    id: UUID
    email: str
    fullName: str
    role: str
    isActive: bool
    clinicId: Optional[UUID] = None
    teamMemberId: Optional[UUID] = None
    inactivityEnabled: bool = True
    inactivityTimeoutMinutes: int = 15
    inactivityWarningSeconds: int = 60

    model_config = ConfigDict(populate_by_name=True)


class UpdateInactivitySettingsRequest(BaseModel):
    """Schema for updating user inactivity logout settings."""
    inactivityEnabled: bool
    inactivityTimeoutMinutes: int = Field(..., ge=1, le=1440, description="Inactivity timeout in minutes (1 - 1440)")
    inactivityWarningSeconds: int = Field(..., ge=10, le=600, description="Warning countdown duration in seconds (10 - 600)")

    model_config = ConfigDict(extra="ignore")


class LoginResponse(BaseModel):
    """Payload returned upon successful authentication."""
    accessToken: str
    tokenType: str = "Bearer"
    expiresInSeconds: int
    user: UserResponse


class TokenRefreshRequest(BaseModel):
    """Optional request body if client provides refresh token via JSON instead of HttpOnly cookie."""
    refreshToken: Optional[str] = None


class TokenRefreshResponse(BaseModel):
    """Returned upon successful token refresh."""
    accessToken: str
    tokenType: str = "Bearer"
    expiresInSeconds: int
    rotated: bool = False
