from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AdminUserDto(BaseModel):
    id: UUID
    email: str
    fullName: str
    role: str
    isActive: bool
    clinicId: Optional[UUID] = None
    teamMemberId: Optional[UUID] = None
    requiresPasswordChange: bool = False
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(populate_by_name=True)


class AdminUserCreateRequest(BaseModel):
    email: str = Field(..., description="Staff member work email")
    fullName: str = Field(..., min_length=2, description="Full name")
    role: str = Field(..., description="Role: admin, doctor, receptionist")
    password: str = Field(..., description="Initial temporary password")
    teamMemberId: Optional[UUID] = Field(None, description="Linked practitioner team member profile")
    clinicId: Optional[UUID] = Field(None, description="Assigned clinic location")
    requiresPasswordChange: bool = Field(True, description="Enforce password change at next login")

    model_config = ConfigDict(extra="ignore")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("email must be a valid email address.")
        return clean


class AdminUserUpdateRequest(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    teamMemberId: Optional[UUID] = None
    clinicId: Optional[UUID] = None

    model_config = ConfigDict(extra="ignore")


class AdminUserStatusUpdateRequest(BaseModel):
    isActive: bool

    model_config = ConfigDict(extra="ignore")


class AdminUserRoleUpdateRequest(BaseModel):
    role: str
    teamMemberId: Optional[UUID] = None

    model_config = ConfigDict(extra="ignore")


class AdminUserResetPasswordRequest(BaseModel):
    password: str

    model_config = ConfigDict(extra="ignore")
