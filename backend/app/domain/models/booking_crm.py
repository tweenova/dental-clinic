from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID, uuid4


@dataclass
class Patient:
    """
    Pure domain representation of a patient record. Zero insurance fields.
    """
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    organization_id: Optional[UUID] = None
    clinic_id: Optional[UUID] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None
    medical_history_status: str = "not_asked"  # not_asked | none_known | recorded
    is_active: bool = True
    file_number: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relationship: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    messaging_opt_out: bool = False
    preferred_channel: str = "sms"  # sms | whatsapp | none
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


@dataclass
class PatientMedicalAlert:
    """
    Pure domain representation of a medical alert (allergy, condition, medication, other).
    """
    patient_id: UUID
    type: str  # allergy | condition | medication | other
    description: str
    severity: Optional[str] = None  # mild | moderate | severe | life_threatening
    recorded_by_user_id: Optional[UUID] = None
    recorded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_reviewed_at: Optional[datetime] = None
    is_active: bool = True
    is_confirmed: bool = True
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))




@dataclass
class LeadSource:
    """
    Pure domain representation of an acquisition channel (Google Ads, Yelp, Organic, Referral).
    """
    name: str
    utm_source: Optional[str] = None
    is_active: bool = True
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Lead:
    """
    Pure domain representation of a prospective patient inquiry. Zero insurance fields.
    """
    full_name: str
    phone: str
    email: Optional[str] = None
    organization_id: Optional[UUID] = None
    clinic_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    lead_source_id: Optional[UUID] = None
    status: str = "new"
    notes: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Booking:
    """
    Pure domain representation of an appointment booking. Zero insurance fields.
    """
    confirmation_id: str
    preferred_date: date
    preferred_time: str
    patient_full_name: str
    patient_phone: str
    patient_email: str
    clinic_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    service_id: Optional[str] = None
    team_member_id: Optional[UUID] = None
    slot_id: Optional[UUID] = None
    status: str = "requested"
    notes: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    staff_notes: Optional[str] = None
    arrived_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    cancelled_by_user_id: Optional[UUID] = None
    reminded_at: Optional[datetime] = None
    reminded_by_user_id: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Task:
    """
    Pure domain representation of a clinical or administrative task.
    """
    title: str
    clinic_id: Optional[UUID] = None
    assigned_to_user_id: Optional[UUID] = None
    created_by_user_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    booking_id: Optional[UUID] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str = "pending"
    priority: str = "medium"
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Message:
    """
    Pure domain representation of a transactional or patient communication.
    """
    content: str
    sender_id: Optional[UUID] = None
    recipient_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    channel: str = "sms"
    status: str = "logged"
    booking_id: Optional[UUID] = None
    delivery_status: str = "simulated"  # "simulated" | "queued" | "sent" | "delivered" | "failed" | "opted_out" | "quiet_hours_held" | "cancelled"
    error_detail: Optional[str] = None
    provider: str = "simulated"  # "simulated" | "twilio" | "whatsapp"
    provider_message_id: Optional[str] = None
    attempts: int = 0
    scheduled_for: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    reminder_type: Optional[str] = None  # "reminder_24h" | "reminder_2h" | "manual"
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ActivityLog:
    """
    Pure domain representation of an administrative or system action.
    """
    action: str
    entity_type: str
    user_id: Optional[UUID] = None
    entity_id: Optional[str] = None
    details_json: Optional[str] = None
    ip_address: Optional[str] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class WorkflowRun:
    """
    Pure domain representation of an automated background process execution.
    """
    workflow_name: str
    trigger_event: str
    status: str = "completed"
    payload_json: Optional[str] = None
    error_message: Optional[str] = None
    id: UUID = field(default_factory=uuid4)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
