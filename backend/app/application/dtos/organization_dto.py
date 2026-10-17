from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class OrganizationResponse(BaseModel):
    """Details of the practice organization."""
    id: UUID
    name: str
    displayName: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    logoUrl: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    websiteUrl: Optional[str] = None
    primaryColor: Optional[str] = None
    secondaryColor: Optional[str] = None
    backgroundColor: Optional[str] = None
    primaryFont: Optional[str] = None
    secondaryFont: Optional[str] = None
    currencyCode: str = "PKR"
    currencySymbol: str = "Rs"
    timezone: str = "Asia/Karachi"
    isActive: bool
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganizationUpdateRequest(BaseModel):
    """Schema for updating organization details."""
    name: Optional[str] = None
    displayName: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    logoUrl: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    websiteUrl: Optional[str] = None
    primaryColor: Optional[str] = None
    secondaryColor: Optional[str] = None
    backgroundColor: Optional[str] = None
    primaryFont: Optional[str] = None
    secondaryFont: Optional[str] = None
    currencyCode: Optional[str] = None
    currencySymbol: Optional[str] = None
    timezone: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class LocationCreateRequest(BaseModel):
    """Schema for creating a new practice location."""
    name: str = Field(..., min_length=2, max_length=255)
    addressLine1: str = Field(..., min_length=2, max_length=255)
    addressLine2: Optional[str] = None
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=50)
    postalCode: str = Field(..., min_length=2, max_length=20)
    country: str = "US"
    phone: Optional[str] = None
    email: Optional[str] = None
    hoursInfo: Optional[str] = None
    isPrimary: bool = False
    isActive: bool = True
    displayOrder: int = 0

    model_config = ConfigDict(extra="ignore")


class LocationUpdateRequest(BaseModel):
    """Schema for updating an existing location."""
    name: Optional[str] = None
    addressLine1: Optional[str] = None
    addressLine2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postalCode: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hoursInfo: Optional[str] = None
    isPrimary: Optional[bool] = None
    isActive: Optional[bool] = None
    displayOrder: Optional[int] = None

    model_config = ConfigDict(extra="ignore")


class LocationResponse(BaseModel):
    """Full location representation."""
    id: UUID
    organizationId: UUID
    name: str
    addressLine1: str
    addressLine2: Optional[str] = None
    city: str
    state: str
    postalCode: str
    country: str
    phone: Optional[str] = None
    email: Optional[str] = None
    hoursInfo: Optional[str] = None
    isPrimary: bool
    isActive: bool
    displayOrder: int
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)
