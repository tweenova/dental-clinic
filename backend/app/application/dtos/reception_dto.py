from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# --- Bookings & Schedule DTOs ---

class BookingResponseDto(BaseModel):
    id: UUID
    confirmationId: str
    preferredDate: date
    preferredTime: str
    patientFullName: str
    patientPhone: str
    patientEmail: str
    status: str
    clinicId: Optional[UUID] = None
    patientId: Optional[UUID] = None
    serviceId: Optional[str] = None
    teamMemberId: Optional[UUID] = None
    slotId: Optional[UUID] = None
    notes: Optional[str] = None
    staffNotes: Optional[str] = None
    utmSource: Optional[str] = None
    utmCampaign: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(populate_by_name=True)


class BookingCreateRequest(BaseModel):
    patientId: Optional[UUID] = None
    patientFullName: str = Field(..., min_length=2, max_length=150)
    patientPhone: str = Field(..., min_length=7, max_length=30)
    patientEmail: str = Field(..., min_length=5, max_length=150)
    preferredDate: date
    preferredTime: str
    serviceId: Optional[str] = None
    teamMemberId: Optional[UUID] = None
    clinicId: Optional[UUID] = None
    slotId: Optional[UUID] = None
    notes: Optional[str] = None
    staffNotes: Optional[str] = None
    status: str = Field(default="confirmed")


class BookingStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target status (confirmed, arrived, checked_in, in_progress, completed, cancelled, no_show)")
    staffNotes: Optional[str] = None


class BookingRescheduleRequest(BaseModel):
    preferredDate: date
    preferredTime: str
    teamMemberId: Optional[UUID] = None
    slotId: Optional[UUID] = None
    staffNotes: Optional[str] = None


# --- Patient DTOs ---

class PatientResponseDto(BaseModel):
    id: UUID
    firstName: str
    lastName: str
    fullName: str
    phone: str
    email: Optional[str] = None
    clinicId: Optional[UUID] = None
    dateOfBirth: Optional[date] = None
    notes: Optional[str] = None
    isActive: bool
    createdAt: datetime
    updatedAt: datetime


class PatientCreateRequest(BaseModel):
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=7, max_length=50)
    email: Optional[str] = None
    dateOfBirth: Optional[date] = None
    clinicId: Optional[UUID] = None
    notes: Optional[str] = None


class PatientUpdateRequest(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    dateOfBirth: Optional[date] = None
    clinicId: Optional[UUID] = None
    notes: Optional[str] = None
    isActive: Optional[bool] = None


class PatientProfileResponse(BaseModel):
    patient: PatientResponseDto
    upcomingAppointments: List[BookingResponseDto]
    pastAppointments: List[BookingResponseDto]
    tasks: List[Any]
    messages: List[Any]


# --- Task DTOs ---

class TaskResponseDto(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    clinicId: Optional[UUID] = None
    assignedToUserId: Optional[UUID] = None
    dueDate: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    priority: str = Field(default="medium")
    status: str = Field(default="pending")
    assignedToUserId: Optional[UUID] = None
    clinicId: Optional[UUID] = None
    dueDate: Optional[datetime] = None


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assignedToUserId: Optional[UUID] = None
    dueDate: Optional[datetime] = None


# --- Lead DTOs ---

class LeadResponseDto(BaseModel):
    id: UUID
    fullName: str
    phone: str
    email: Optional[str] = None
    clinicId: Optional[UUID] = None
    patientId: Optional[UUID] = None
    leadSourceId: Optional[UUID] = None
    status: str
    notes: Optional[str] = None
    utmSource: Optional[str] = None
    utmCampaign: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class LeadCreateRequest(BaseModel):
    fullName: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=7, max_length=50)
    email: Optional[str] = None
    clinicId: Optional[UUID] = None
    leadSourceId: Optional[UUID] = None
    status: str = Field(default="new")
    notes: Optional[str] = None
    utmSource: Optional[str] = None
    utmCampaign: Optional[str] = None


class LeadUpdateRequest(BaseModel):
    fullName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    clinicId: Optional[UUID] = None
    leadSourceId: Optional[UUID] = None


class LeadConvertRequest(BaseModel):
    dateOfBirth: Optional[date] = None
    clinicId: Optional[UUID] = None
    notes: Optional[str] = None


# --- Message DTOs ---

class MessageResponseDto(BaseModel):
    id: UUID
    content: str
    senderId: Optional[UUID] = None
    recipientId: Optional[UUID] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    channel: str
    status: str
    createdAt: datetime


class MessageCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    recipientId: Optional[UUID] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    channel: str = Field(default="sms")


# --- Dashboard & Command Center DTOs ---

class DashboardSummaryResponse(BaseModel):
    todayAppointments: int
    confirmedCount: int
    unconfirmedCount: int
    checkedInCount: int
    waitingCount: int
    inProgressCount: int
    completedCount: int
    cancelledCount: int
    noShowCount: int
    pendingRequestsCount: int
    urgentTasksCount: int
    newLeadsCount: int
    recallsDueCount: int
    needsAttentionCount: int
    todayFlow: List[BookingResponseDto]
    needsAttentionItems: List[Dict[str, Any]]


class AppointmentRequestItemDto(BaseModel):
    id: UUID
    confirmationId: str
    patientFullName: str
    patientPhone: str
    patientEmail: str
    serviceId: str
    preferredDate: date
    preferredTime: str
    status: str
    notes: Optional[str] = None
    staffNotes: Optional[str] = None
    createdAt: datetime
