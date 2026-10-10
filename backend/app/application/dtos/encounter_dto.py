from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateEncounterRequestDto(BaseModel):
    """
    Request payload to initiate a clinical encounter.
    Note: Clinician identity is derived from authenticated server context, not client payload.
    """
    patientId: UUID
    bookingId: Optional[UUID] = None
    status: Optional[str] = Field("in_progress", description="Initial status: 'draft' or 'in_progress'")
    chiefComplaint: Optional[str] = None
    reasonForVisit: Optional[str] = None


class UpdateEncounterStatusRequestDto(BaseModel):
    """
    Request payload to transition encounter lifecycle status.
    """
    status: str = Field(..., description="Target status: 'in_progress', 'completed', 'cancelled'")


class EncounterResponseDto(BaseModel):
    """
    Response model for clinical encounter details.
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    patientId: UUID
    clinicianId: UUID
    clinicId: Optional[UUID] = None
    bookingId: Optional[UUID] = None
    appointmentId: Optional[UUID] = None
    status: str
    chiefComplaint: Optional[str] = None
    reasonForVisit: Optional[str] = None
    startedAt: datetime
    endedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

