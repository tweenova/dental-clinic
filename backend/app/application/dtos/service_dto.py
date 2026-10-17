from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ServiceCreateRequest(BaseModel):
    """Schema for creating a new service or procedure."""
    slug: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=2, max_length=255)
    shortDesc: str = Field(..., min_length=5)
    fullDesc: Optional[str] = None
    cashPrice: str = Field(..., min_length=1, max_length=100)
    duration: str = Field(..., min_length=1, max_length=100)
    code: Optional[str] = None
    insuranceNote: Optional[str] = None
    recommendedInterval: Optional[str] = None
    recallIntervalDays: Optional[int] = None
    displayOrder: int = 0
    isHighlighted: bool = False
    isPublic: bool = True
    isActive: bool = True
    bookableOnline: bool = True
    bufferMinutes: int = 0
    providerIds: Optional[List[UUID]] = None

    model_config = ConfigDict(extra="ignore")


class ServiceUpdateRequest(BaseModel):
    """Schema for updating an existing service."""
    slug: Optional[str] = None
    category: Optional[str] = None
    title: Optional[str] = None
    shortDesc: Optional[str] = None
    fullDesc: Optional[str] = None
    cashPrice: Optional[str] = None
    duration: Optional[str] = None
    code: Optional[str] = None
    insuranceNote: Optional[str] = None
    recommendedInterval: Optional[str] = None
    recallIntervalDays: Optional[int] = None
    displayOrder: Optional[int] = None
    isHighlighted: Optional[bool] = None
    isPublic: Optional[bool] = None
    isActive: Optional[bool] = None
    bookableOnline: Optional[bool] = None
    bufferMinutes: Optional[int] = None
    providerIds: Optional[List[UUID]] = None

    model_config = ConfigDict(extra="ignore")


class ServiceStatusRequest(BaseModel):
    """Schema for activating or deactivating a service."""
    isActive: bool


class ServiceResponse(BaseModel):
    """Full representation of a service returned to clients."""
    id: UUID
    slug: str
    category: str
    title: str
    shortDesc: str
    fullDesc: Optional[str] = None
    cashPrice: str
    duration: str
    code: Optional[str] = None
    insuranceNote: Optional[str] = None
    recommendedInterval: Optional[str] = None
    recallIntervalDays: Optional[int] = None
    displayOrder: int
    isHighlighted: bool
    isActive: bool
    isPublic: bool
    bookableOnline: bool = True
    bufferMinutes: int = 0
    providerIds: List[UUID] = []
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)

