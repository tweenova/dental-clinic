from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RecordFindingRequestDto(BaseModel):
    """
    Request payload to record a tooth/surface-level clinical finding.
    Note: author identity and patient linkage are derived from the authenticated
    server context and the parent encounter, not from the client payload.
    """
    tooth: str = Field(..., min_length=1, max_length=2, description="Universal tooth number 1-32 or primary A-T")
    condition: str = Field(..., min_length=3, max_length=50, description="Finding condition code from the domain catalog")
    surfaces: List[str] = Field(default_factory=list, description="Surface codes valid for the tooth")
    notes: Optional[str] = Field(None, max_length=2000)


class CorrectFindingRequestDto(BaseModel):
    """
    Request payload to correct an active finding in place.
    A correction reason is mandatory; the original author and timestamps are preserved.
    """
    reason: str = Field(..., min_length=3, max_length=1000, description="Clinical rationale for the correction")
    condition: Optional[str] = Field(None, min_length=3, max_length=50)
    surfaces: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=2000)


class ResolveFindingRequestDto(BaseModel):
    """Request payload to mark an active finding as resolved (no longer active)."""
    notes: Optional[str] = Field(None, max_length=2000, description="Optional resolution note appended to the finding")


class CreateProcedureRequestDto(BaseModel):
    """
    Request payload to add a planned procedure to a treatment plan.
    Status always starts as 'planned'; completion is a separate, audited transition.
    """
    tooth: str = Field(..., min_length=1, max_length=2)
    serviceId: UUID = Field(..., description="Reference to the clinic's service catalog entry")
    surfaces: List[str] = Field(default_factory=list)
    notes: Optional[str] = Field(None, max_length=2000)


class UpdateProcedureStatusRequestDto(BaseModel):
    """Request payload to transition a procedure's lifecycle status."""
    status: str = Field(..., description="Target status: 'in_progress', 'completed', or 'cancelled'")
    notes: Optional[str] = Field(None, max_length=2000)


class DentalChartFindingResponseDto(BaseModel):
    """Response model for a dental chart finding."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    patientId: UUID
    encounterId: UUID
    authorId: UUID
    clinicId: Optional[UUID] = None
    tooth: str
    surfaces: List[str]
    condition: str
    conditionLabel: str
    status: str
    notes: Optional[str] = None
    correctionReason: Optional[str] = None
    correctedById: Optional[UUID] = None
    correctedAt: Optional[datetime] = None
    resolvedById: Optional[UUID] = None
    resolvedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


class DentalProcedureResponseDto(BaseModel):
    """Response model for a planned or performed dental procedure record."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    patientId: UUID
    encounterId: UUID
    recordedById: UUID
    serviceId: UUID
    clinicId: Optional[UUID] = None
    tooth: str
    surfaces: List[str]
    status: str
    notes: Optional[str] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    completedById: Optional[UUID] = None
    createdAt: datetime
    updatedAt: datetime


class DentalChartResponseDto(BaseModel):
    """Cumulative chart state for a patient: active findings plus treatment records."""
    patientId: UUID
    findings: List[DentalChartFindingResponseDto]
    procedures: List[DentalProcedureResponseDto]
    conditionCatalog: List[dict]


class ChartHistoryResponseDto(BaseModel):
    """Full chart history for a patient including resolved findings."""
    patientId: UUID
    findings: List[DentalChartFindingResponseDto]
    procedures: List[DentalProcedureResponseDto]


class EncounterChartResponseDto(BaseModel):
    """Encounter-scoped chart snapshot: findings and procedures recorded during that visit."""
    encounterId: UUID
    patientId: UUID
    findings: List[DentalChartFindingResponseDto]
    procedures: List[DentalProcedureResponseDto]
