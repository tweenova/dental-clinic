from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SaveDraftNoteRequestDto(BaseModel):
    """
    Request payload to create or save a draft clinical SOAP note.
    """
    subjective: Optional[str] = Field(None, max_length=10000, description="Patient-reported symptoms and history")
    objective: Optional[str] = Field(None, max_length=10000, description="Clinical examination and diagnostic findings")
    assessment: Optional[str] = Field(None, max_length=10000, description="Diagnoses and clinical assessment")
    plan: Optional[str] = Field(None, max_length=10000, description="Treatment plan, procedures, and patient instructions")


class AmendNoteRequestDto(BaseModel):
    """
    Request payload to create an amended revision of a signed clinical note.
    """
    amendmentReason: str = Field(..., min_length=3, max_length=1000, description="Clinical rationale for amending signed note")
    subjective: Optional[str] = Field(None, max_length=10000)
    objective: Optional[str] = Field(None, max_length=10000)
    assessment: Optional[str] = Field(None, max_length=10000)
    plan: Optional[str] = Field(None, max_length=10000)


class ClinicalNoteResponseDto(BaseModel):
    """
    Response model for a structured SOAP note revision snapshot.
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    encounterId: UUID
    patientId: UUID
    authorId: UUID
    clinicId: Optional[UUID] = None
    revisionNumber: int
    isCurrent: bool
    status: str
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    isSigned: bool
    signedAt: Optional[datetime] = None
    signedById: Optional[UUID] = None
    amendmentReason: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    # Backward compatibility: historical intake or staff notes from booking
    historicalStaffNotes: Optional[str] = None

