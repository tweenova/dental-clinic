from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4


@dataclass
class PatientAttachment:
    """
    Domain entity for a private patient file (xray, photo, consent, referral, other).
    """
    patient_id: UUID
    category: str
    original_filename: str
    content_type: str
    size: int
    stored_name: str
    uploaded_by: UUID
    encounter_id: Optional[UUID] = None
    voided: bool = False
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    voided_by: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    uploaded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class PatientConsent:
    """
    Domain entity for an informed patient consent record.
    """
    patient_id: UUID
    consent_type: str
    method: str  # typed | scanned
    signed_name: str
    obtained_by: UUID
    encounter_id: Optional[UUID] = None
    procedure_id: Optional[UUID] = None
    consent_text_version: str = "1.0"
    attachment_id: Optional[UUID] = None
    voided: bool = False
    void_reason: Optional[str] = None
    voided_at: Optional[datetime] = None
    voided_by: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    recorded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Prescription:
    """
    Domain entity for a prescription order with items (drug, dose, frequency, duration, instructions).
    """
    encounter_id: UUID
    patient_id: UUID
    doctor_id: UUID
    items: List[Dict[str, Any]] = field(default_factory=list)
    notes: Optional[str] = None
    status: str = "draft"  # draft | signed
    signed_at: Optional[datetime] = None
    signed_by_user_id: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ReferralLetter:
    """
    Domain entity for a formal specialist referral letter.
    """
    encounter_id: UUID
    patient_id: UUID
    doctor_id: UUID
    recipient: str
    reason: str
    summary: str
    status: str = "draft"  # draft | signed
    signed_at: Optional[datetime] = None
    signed_by_user_id: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
