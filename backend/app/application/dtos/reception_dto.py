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
    arrivedAt: Optional[datetime] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    cancellationReason: Optional[str] = None
    cancelledByUserId: Optional[UUID] = None
    remindedAt: Optional[datetime] = None
    remindedByUserId: Optional[UUID] = None
    remindedByName: Optional[str] = None
    clinicianName: Optional[str] = None
    serviceName: Optional[str] = None
    hasAlerts: bool = False
    paymentStatus: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(populate_by_name=True)


class ReminderItemDto(BaseModel):
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
    serviceName: Optional[str] = None
    teamMemberId: Optional[UUID] = None
    clinicianName: Optional[str] = None
    remindedAt: Optional[datetime] = None
    remindedByUserId: Optional[UUID] = None
    remindedByName: Optional[str] = None
    optedOut: bool = False
    deliveryStatus: str = "none"
    lastMessageAt: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


class RemindersWorklistResponse(BaseModel):
    targetDate: date
    template: str
    items: List[ReminderItemDto]
    providerMode: str = "simulated"
    quietHoursActive: bool = False
    quietHoursStart: str = "21:00"
    quietHoursEnd: str = "08:00"

    model_config = ConfigDict(populate_by_name=True)


class PatientMessagingOptOutRequest(BaseModel):
    optOut: bool = True


class MessagingSettingsDto(BaseModel):
    quietHoursEnabled: bool = True
    quietHoursStart: str = "21:00"
    quietHoursEnd: str = "08:00"
    messagingProviderMode: str = "simulated"
    reminderTemplate: str
    reminderTemplateUrdu: Optional[str] = None
    reminder24hEnabled: bool = True
    reminder2hEnabled: bool = True

    model_config = ConfigDict(populate_by_name=True)


class UpdateMessagingSettingsRequest(BaseModel):
    quietHoursEnabled: Optional[bool] = None
    quietHoursStart: Optional[str] = None
    quietHoursEnd: Optional[str] = None
    messagingProviderMode: Optional[str] = None
    reminderTemplate: Optional[str] = None
    reminderTemplateUrdu: Optional[str] = None
    reminder24hEnabled: Optional[bool] = None
    reminder2hEnabled: Optional[bool] = None


class SendTestMessageRequest(BaseModel):
    recipient: str = Field(..., min_length=5, max_length=50)
    message: str = Field(..., min_length=1, max_length=1000)
    channel: str = Field(default="sms", pattern="^(sms|whatsapp)$")


class SendTestMessageResponse(BaseModel):
    success: bool
    status: str
    channel: str
    provider: str
    recipient: str
    details: Optional[str] = None
    error: Optional[str] = None
    providerMessageId: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class RunSchedulerResponseDto(BaseModel):
    dispatchedCount: int
    skippedOptOutCount: int
    skippedQuietHours: bool
    message: str
    simulated: bool = True

    model_config = ConfigDict(populate_by_name=True)


class MessageLogItemDto(BaseModel):
    id: UUID
    recipientPhone: Optional[str] = None
    recipientEmail: Optional[str] = None
    content: str
    channel: str
    status: str
    deliveryStatus: str
    errorDetail: Optional[str] = None
    patientId: Optional[UUID] = None
    bookingId: Optional[UUID] = None
    senderId: Optional[UUID] = None
    provider: str = "simulated"
    providerMessageId: Optional[str] = None
    attempts: int = 0
    scheduledFor: Optional[datetime] = None
    sentAt: Optional[datetime] = None
    reminderType: Optional[str] = None
    createdAt: datetime

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
    overrideDoubleBooking: bool = False
    overrideReason: Optional[str] = None


class BookingStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target status (confirmed, arrived, checked_in, in_progress, completed, cancelled, no_show)")
    staffNotes: Optional[str] = None
    cancellationReason: Optional[str] = None


class BookingRescheduleRequest(BaseModel):
    preferredDate: date
    preferredTime: str
    teamMemberId: Optional[UUID] = None
    serviceId: Optional[str] = None
    slotId: Optional[UUID] = None
    staffNotes: Optional[str] = None
    overrideDoubleBooking: bool = False
    overrideReason: Optional[str] = None


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
    medicalHistoryStatus: str = "not_asked"
    hasAlerts: bool = False
    isActive: bool
    messagingOptOut: bool = False
    preferredChannel: str = "sms"
    fileNumber: Optional[str] = None
    guardianName: Optional[str] = None
    guardianPhone: Optional[str] = None
    guardianRelationship: Optional[str] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    emergencyContactRelationship: Optional[str] = None
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
    preferredChannel: Optional[str] = Field(default="sms", pattern="^(sms|whatsapp|none)$")
    fileNumber: Optional[str] = None
    guardianName: Optional[str] = None
    guardianPhone: Optional[str] = None
    guardianRelationship: Optional[str] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    emergencyContactRelationship: Optional[str] = None


class PatientUpdateRequest(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    dateOfBirth: Optional[date] = None
    clinicId: Optional[UUID] = None
    notes: Optional[str] = None
    isActive: Optional[bool] = None
    messagingOptOut: Optional[bool] = None
    preferredChannel: Optional[str] = Field(default=None, pattern="^(sms|whatsapp|none)$")
    fileNumber: Optional[str] = None
    guardianName: Optional[str] = None
    guardianPhone: Optional[str] = None
    guardianRelationship: Optional[str] = None
    emergencyContactName: Optional[str] = None
    emergencyContactPhone: Optional[str] = None
    emergencyContactRelationship: Optional[str] = None


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
    patientId: Optional[UUID] = None
    bookingId: Optional[UUID] = None
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
    patientId: Optional[UUID] = None
    bookingId: Optional[UUID] = None
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
    patientId: Optional[UUID] = None
    senderId: Optional[UUID] = None
    recipientId: Optional[UUID] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    channel: str
    status: str
    createdAt: datetime


class MessageCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    patientId: Optional[UUID] = None
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
    unconfirmedTomorrowCount: Optional[int] = 0
    waitingDelayedCount: Optional[int] = 0
    overdueTasksCount: Optional[int] = 0
    pastUnresolvedCount: Optional[int] = 0
    needsActionQueue: Optional[List[Dict[str, Any]]] = None


class DashboardSnoozeRequest(BaseModel):
    itemType: str = Field(pattern="^(booking|task)$")
    itemId: UUID
    durationHours: int = Field(default=24, ge=1, le=720)


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


# --- End-of-Day Review DTOs ---

class EndOfDayItemDto(BaseModel):
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
    serviceName: Optional[str] = None
    teamMemberId: Optional[UUID] = None
    clinicianName: Optional[str] = None
    arrivedAt: Optional[datetime] = None
    notes: Optional[str] = None
    staffNotes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class EndOfDayUnresolvedResponse(BaseModel):
    targetDate: date
    todayCount: int
    pastCount: int
    totalUnresolved: int
    items: List[EndOfDayItemDto]

    model_config = ConfigDict(populate_by_name=True)


class EndOfDayResolveRequest(BaseModel):
    bookingId: UUID
    resolution: str = Field(..., pattern="^(completed|no_show|cancelled)$")
    reason: Optional[str] = None


# --- Recall DTOs ---

class CreateRecallTaskRequest(BaseModel):
    patientId: UUID
    serviceId: Optional[str] = None
    dueDate: Optional[date] = None


class RecallItemDto(BaseModel):
    patientId: str
    patientFullName: str
    phone: str
    email: Optional[str] = None
    lastVisitDate: str
    serviceId: str
    serviceName: str
    recallIntervalDays: int
    dueDate: str
    status: str
    clinicId: Optional[str] = None
    hasOpenTask: bool = False
    taskId: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


# --- Waitlist Offer DTOs ---

class WaitlistOfferCandidateDto(BaseModel):
    waitlistBookingId: UUID
    confirmationId: str
    patientId: Optional[UUID] = None
    patientName: str
    patientPhone: str
    patientEmail: Optional[str] = None
    preferredDate: Optional[date] = None
    preferredTime: Optional[str] = None
    serviceId: Optional[str] = None
    serviceName: Optional[str] = None
    notes: Optional[str] = None
    hasOpenOfferTask: bool = False
    taskId: Optional[UUID] = None

    model_config = ConfigDict(populate_by_name=True)


class CreateWaitlistOfferTaskRequest(BaseModel):
    waitlistBookingId: UUID


# --- Visit Payments DTOs ---

class VisitPaymentDto(BaseModel):
    id: UUID
    clinicId: Optional[UUID] = None
    bookingId: Optional[UUID] = None
    patientId: Optional[UUID] = None
    amountCents: int
    amountFormatted: str
    amountChargedCents: Optional[int] = 0
    amountChargedFormatted: Optional[str] = None
    currency: str = "PKR"
    method: str = "cash"
    notes: Optional[str] = None
    isVoided: bool = False
    voidReason: Optional[str] = None
    voidedAt: Optional[datetime] = None
    voidedByUserId: Optional[UUID] = None
    voidedByName: Optional[str] = None
    recordedByUserId: Optional[UUID] = None
    recordedByName: Optional[str] = None
    createdAt: datetime

    model_config = ConfigDict(populate_by_name=True)


class RecordVisitPaymentRequest(BaseModel):
    amountCents: int = Field(gt=0, description="Amount in cents/smallest currency unit")
    amountChargedCents: Optional[int] = Field(default=None, ge=0, description="Total amount charged in cents")
    currency: str = Field(default="PKR", max_length=3)
    method: str = Field(default="cash", pattern="^(cash|card|bank_transfer)$")
    notes: Optional[str] = None
    overrideReason: Optional[str] = Field(default=None, max_length=500, description="Reason if charged fee overrides standard service catalog fee")
    patientId: Optional[UUID] = None


class VoidVisitPaymentRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500, description="Mandatory reason for voiding this payment record")


class EndOfDayPaymentsSummaryDto(BaseModel):
    targetDate: date
    totalCents: int
    cashCents: int
    cardCents: int
    transferCents: int
    paymentCount: int
    payments: List[VisitPaymentDto]

    model_config = ConfigDict(populate_by_name=True)

