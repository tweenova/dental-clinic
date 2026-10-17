from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MedicalAlertDto(BaseModel):
    id: UUID
    patientId: UUID
    type: str
    description: str
    severity: Optional[str] = None
    recordedByUserId: Optional[UUID] = None
    recordedAt: datetime
    lastReviewedAt: Optional[datetime] = None
    isActive: bool
    isConfirmed: bool
    createdAt: datetime
    updatedAt: datetime


class MedicalAlertsSummaryResponse(BaseModel):
    patientId: UUID
    medicalHistoryStatus: str
    confirmedAlerts: List[MedicalAlertDto]
    pendingAlerts: List[MedicalAlertDto]
    lastReviewedAt: Optional[datetime] = None


class CreateMedicalAlertRequest(BaseModel):
    type: str = Field(..., pattern="^(allergy|condition|medication|other)$")
    description: str = Field(..., min_length=1, max_length=1000)
    severity: Optional[str] = Field(None, pattern="^(mild|moderate|severe|life_threatening)$")


class CreatePendingAlertRequest(BaseModel):
    type: str = Field(..., pattern="^(allergy|condition|medication|other)$")
    description: str = Field(..., min_length=1, max_length=1000)


class UpdateMedicalHistoryStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(not_asked|none_known|recorded)$")
