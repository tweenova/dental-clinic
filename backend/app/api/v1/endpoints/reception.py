from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    get_medical_alert_service,
    get_reception_service,
    require_receptionist,
    require_role,
)
from app.application.dtos.medical_alert_dto import (
    CreatePendingAlertRequest,
    MedicalAlertDto,
)
from app.application.services.medical_alert_service import MedicalAlertService
from app.application.dtos.reception_dto import (
    BookingCreateRequest,
    BookingRescheduleRequest,
    BookingResponseDto,
    BookingStatusUpdateRequest,
    CreateRecallTaskRequest,
    DashboardSnoozeRequest,
    DashboardSummaryResponse,
    EndOfDayItemDto,
    EndOfDayResolveRequest,
    EndOfDayUnresolvedResponse,
    LeadConvertRequest,
    LeadCreateRequest,
    LeadResponseDto,
    LeadUpdateRequest,
    MessageCreateRequest,
    MessageResponseDto,
    PatientCreateRequest,
    PatientMessagingOptOutRequest,
    PatientProfileResponse,
    PatientResponseDto,
    PatientUpdateRequest,
    RecallItemDto,
    ReminderItemDto,
    RemindersWorklistResponse,
    TaskCreateRequest,
    TaskResponseDto,
    TaskUpdateRequest,
    CreateWaitlistOfferTaskRequest,
    WaitlistOfferCandidateDto,
    EndOfDayPaymentsSummaryDto,
    RecordVisitPaymentRequest,
    VoidVisitPaymentRequest,
    VisitPaymentDto,
)
from app.application.services.reception_service import ReceptionService
from app.domain.models.user import User

router = APIRouter(
    prefix="/reception",
    tags=["Receptionist Front-Office"],
    dependencies=[Depends(require_receptionist)],
)


def _get_clinic_scope(current_user: User, explicit_clinic_id: Optional[UUID] = None) -> Optional[UUID]:
    """Enforces clinic scoping based on user's authorized clinic."""
    # If the user has a clinic_id assigned, strictly constrain queries to their clinic
    if current_user.clinic_id:
        return current_user.clinic_id
    return explicit_clinic_id


# --- 1. Dashboard Command Center ---

@router.get("/dashboard", response_model=DashboardSummaryResponse)
async def get_dashboard(
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> DashboardSummaryResponse:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    summary = await reception_service.get_dashboard_summary(clinic_id=effective_clinic)
    flow_dtos = [
        BookingResponseDto(
            id=b.id,
            confirmationId=b.confirmation_id,
            preferredDate=b.preferred_date,
            preferredTime=b.preferred_time,
            patientFullName=b.patient_full_name,
            patientPhone=b.patient_phone,
            patientEmail=b.patient_email,
            status=b.status,
            clinicId=b.clinic_id,
            patientId=b.patient_id,
            serviceId=b.service_id,
            teamMemberId=b.team_member_id,
            slotId=b.slot_id,
            notes=b.notes,
            staffNotes=b.staff_notes,
            utmSource=b.utm_source,
            utmCampaign=b.utm_campaign,
            createdAt=b.created_at,
            updatedAt=b.updated_at,
        )
        for b in summary["todayFlow"]
    ]
    summary["todayFlow"] = flow_dtos
    return DashboardSummaryResponse(**summary)


@router.post("/dashboard/snooze")
async def snooze_dashboard_queue_item(
    req: DashboardSnoozeRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> Dict[str, Any]:
    """Snoozes an actionable triage item (booking or task) for reception queue, audited."""
    return await reception_service.snooze_queue_item(
        item_type=req.itemType,
        item_id=req.itemId,
        duration_hours=req.durationHours,
        user_id=current_user.id,
    )


# --- 2. Schedule & Bookings ---

@router.get("/schedule", response_model=List[BookingResponseDto])
async def get_schedule(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    team_member_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[BookingResponseDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    bookings, _ = await reception_service.list_schedule(
        clinic_id=effective_clinic,
        team_member_id=team_member_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        search=search,
        limit=200,
    )
    return [
        BookingResponseDto(
            id=b.id,
            confirmationId=b.confirmation_id,
            preferredDate=b.preferred_date,
            preferredTime=b.preferred_time,
            patientFullName=b.patient_full_name,
            patientPhone=b.patient_phone,
            patientEmail=b.patient_email,
            status=b.status,
            clinicId=b.clinic_id,
            patientId=b.patient_id,
            serviceId=b.service_id,
            teamMemberId=b.team_member_id,
            slotId=b.slot_id,
            notes=b.notes,
            staffNotes=b.staff_notes,
            utmSource=b.utm_source,
            utmCampaign=b.utm_campaign,
            createdAt=b.created_at,
            updatedAt=b.updated_at,
        )
        for b in bookings
    ]


@router.get("/appointments", response_model=List[BookingResponseDto])
async def list_appointments(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    team_member_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[BookingResponseDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    bookings, _ = await reception_service.list_schedule(
        clinic_id=effective_clinic,
        team_member_id=team_member_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        search=search,
        limit=200,
    )
    return [
        BookingResponseDto(
            id=b.id,
            confirmationId=b.confirmation_id,
            preferredDate=b.preferred_date,
            preferredTime=b.preferred_time,
            patientFullName=b.patient_full_name,
            patientPhone=b.patient_phone,
            patientEmail=b.patient_email,
            status=b.status,
            clinicId=b.clinic_id,
            patientId=b.patient_id,
            serviceId=b.service_id,
            teamMemberId=b.team_member_id,
            slotId=b.slot_id,
            notes=b.notes,
            staffNotes=b.staff_notes,
            utmSource=b.utm_source,
            utmCampaign=b.utm_campaign,
            createdAt=b.created_at,
            updatedAt=b.updated_at,
        )
        for b in bookings
    ]


@router.post("/appointments", response_model=BookingResponseDto, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    req: BookingCreateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> BookingResponseDto:
    effective_clinic = _get_clinic_scope(current_user, req.clinicId)
    booking = await reception_service.create_booking(
        patient_full_name=req.patientFullName,
        patient_phone=req.patientPhone,
        patient_email=req.patientEmail,
        preferred_date=req.preferredDate,
        preferred_time=req.preferredTime,
        clinic_id=effective_clinic,
        patient_id=req.patientId,
        service_id=req.serviceId,
        team_member_id=req.teamMemberId,
        slot_id=req.slotId,
        status=req.status,
        notes=req.notes,
        staff_notes=req.staffNotes,
        override_double_booking=req.overrideDoubleBooking,
        override_reason=req.overrideReason,
        user_id=current_user.id,
    )
    return BookingResponseDto(
        id=booking.id,
        confirmationId=booking.confirmation_id,
        preferredDate=booking.preferred_date,
        preferredTime=booking.preferred_time,
        patientFullName=booking.patient_full_name,
        patientPhone=booking.patient_phone,
        patientEmail=booking.patient_email,
        status=booking.status,
        clinicId=booking.clinic_id,
        patientId=booking.patient_id,
        serviceId=booking.service_id,
        teamMemberId=booking.team_member_id,
        slotId=booking.slot_id,
        notes=booking.notes,
        staffNotes=booking.staff_notes,
        utmSource=booking.utm_source,
        utmCampaign=booking.utm_campaign,
        createdAt=booking.created_at,
        updatedAt=booking.updated_at,
    )


@router.patch("/appointments/{id}/status", response_model=BookingResponseDto)
async def update_appointment_status(
    id: UUID,
    req: BookingStatusUpdateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> BookingResponseDto:
    booking = await reception_service.update_booking_status(
        booking_id=id,
        new_status=req.status,
        staff_notes=req.staffNotes,
        cancellation_reason=req.cancellationReason,
        user_id=current_user.id,
    )
    return BookingResponseDto(
        id=booking.id,
        confirmationId=booking.confirmation_id,
        preferredDate=booking.preferred_date,
        preferredTime=booking.preferred_time,
        patientFullName=booking.patient_full_name,
        patientPhone=booking.patient_phone,
        patientEmail=booking.patient_email,
        status=booking.status,
        clinicId=booking.clinic_id,
        patientId=booking.patient_id,
        serviceId=booking.service_id,
        teamMemberId=booking.team_member_id,
        slotId=booking.slot_id,
        notes=booking.notes,
        staffNotes=booking.staff_notes,
        utmSource=booking.utm_source,
        utmCampaign=booking.utm_campaign,
        arrivedAt=booking.arrived_at,
        startedAt=booking.started_at,
        completedAt=booking.completed_at,
        cancellationReason=booking.cancellation_reason,
        cancelledByUserId=booking.cancelled_by_user_id,
        remindedAt=booking.reminded_at,
        remindedByUserId=booking.reminded_by_user_id,
        createdAt=booking.created_at,
        updatedAt=booking.updated_at,
    )


# --- Reminders Worklist ---

@router.get("/reminders", response_model=RemindersWorklistResponse)
async def get_reminders(
    date_val: Optional[date] = Query(None, alias="date"),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> RemindersWorklistResponse:
    """Lists confirmed appointments for a chosen day (default tomorrow) with patient, time, clinician."""
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    target = date_val or (date.today() + timedelta(days=1))
    result = await reception_service.get_reminders_worklist(
        target_date=target,
        clinic_id=effective_clinic,
    )
    return RemindersWorklistResponse(**result)


@router.post("/appointments/{id}/remind", response_model=BookingResponseDto)
async def mark_appointment_reminded(
    id: UUID,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> BookingResponseDto:
    """Marks an appointment as reminded, storing timestamp and staff user. Audited."""
    booking = await reception_service.mark_appointment_reminded(
        booking_id=id,
        user_id=current_user.id,
    )
    return BookingResponseDto(
        id=booking.id,
        confirmationId=booking.confirmation_id,
        preferredDate=booking.preferred_date,
        preferredTime=booking.preferred_time,
        patientFullName=booking.patient_full_name,
        patientPhone=booking.patient_phone,
        patientEmail=booking.patient_email,
        status=booking.status,
        clinicId=booking.clinic_id,
        patientId=booking.patient_id,
        serviceId=booking.service_id,
        teamMemberId=booking.team_member_id,
        slotId=booking.slot_id,
        notes=booking.notes,
        staffNotes=booking.staff_notes,
        utmSource=booking.utm_source,
        utmCampaign=booking.utm_campaign,
        arrivedAt=booking.arrived_at,
        startedAt=booking.started_at,
        completedAt=booking.completed_at,
        cancellationReason=booking.cancellation_reason,
        cancelledByUserId=booking.cancelled_by_user_id,
        remindedAt=booking.reminded_at,
        remindedByUserId=booking.reminded_by_user_id,
        remindedByName=current_user.full_name,
        createdAt=booking.created_at,
        updatedAt=booking.updated_at,
    )


# --- End-of-Day Review ---

@router.get("/end-of-day/unresolved", response_model=EndOfDayUnresolvedResponse)
async def get_end_of_day_unresolved(
    date_val: Optional[date] = Query(None, alias="date"),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> EndOfDayUnresolvedResponse:
    """Lists unresolved appointments for the target date and earlier for end-of-day review."""
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    target = date_val or date.today()
    result = await reception_service.get_end_of_day_unresolved(
        target_date=target,
        clinic_id=effective_clinic,
    )
    return EndOfDayUnresolvedResponse(**result)


@router.get("/end-of-day/payments-summary", response_model=EndOfDayPaymentsSummaryDto)
async def get_end_of_day_payments_summary(
    date_val: Optional[date] = Query(None, alias="date"),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> EndOfDayPaymentsSummaryDto:
    """Retrieves payment totals (cash, card, bank transfer) and list for end-of-day financial reconciliation."""
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    target = date_val or date.today()
    summary = await reception_service.get_end_of_day_payments_summary(
        target_date=target,
        clinic_id=effective_clinic,
    )
    return EndOfDayPaymentsSummaryDto(**summary)



@router.post("/end-of-day/resolve", response_model=BookingResponseDto)
async def resolve_end_of_day(
    req: EndOfDayResolveRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> BookingResponseDto:
    """Manually resolves an unresolved appointment at end-of-day as completed, no-show, or cancelled. Strictly audited."""
    booking = await reception_service.resolve_end_of_day(
        booking_id=req.bookingId,
        resolution=req.resolution,
        reason=req.reason,
        user_id=current_user.id,
    )
    return BookingResponseDto(
        id=booking.id,
        confirmationId=booking.confirmation_id,
        preferredDate=booking.preferred_date,
        preferredTime=booking.preferred_time,
        patientFullName=booking.patient_full_name,
        patientPhone=booking.patient_phone,
        patientEmail=booking.patient_email,
        status=booking.status,
        clinicId=booking.clinic_id,
        patientId=booking.patient_id,
        serviceId=booking.service_id,
        teamMemberId=booking.team_member_id,
        slotId=booking.slot_id,
        notes=booking.notes,
        staffNotes=booking.staff_notes,
        utmSource=booking.utm_source,
        utmCampaign=booking.utm_campaign,
        arrivedAt=booking.arrived_at,
        startedAt=booking.started_at,
        completedAt=booking.completed_at,
        cancellationReason=booking.cancellation_reason,
        cancelledByUserId=booking.cancelled_by_user_id,
        remindedAt=booking.reminded_at,
        remindedByUserId=booking.reminded_by_user_id,
        createdAt=booking.created_at,
        updatedAt=booking.updated_at,
    )


@router.patch("/appointments/{id}/reschedule", response_model=BookingResponseDto)
async def reschedule_appointment(
    id: UUID,
    req: BookingRescheduleRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> BookingResponseDto:
    booking = await reception_service.reschedule_booking(
        booking_id=id,
        preferred_date=req.preferredDate,
        preferred_time=req.preferredTime,
        team_member_id=req.teamMemberId,
        service_id=req.serviceId,
        slot_id=req.slotId,
        staff_notes=req.staffNotes,
        override_double_booking=req.overrideDoubleBooking,
        override_reason=req.overrideReason,
        user_id=current_user.id,
    )
    return BookingResponseDto(
        id=booking.id,
        confirmationId=booking.confirmation_id,
        preferredDate=booking.preferred_date,
        preferredTime=booking.preferred_time,
        patientFullName=booking.patient_full_name,
        patientPhone=booking.patient_phone,
        patientEmail=booking.patient_email,
        status=booking.status,
        clinicId=booking.clinic_id,
        patientId=booking.patient_id,
        serviceId=booking.service_id,
        teamMemberId=booking.team_member_id,
        slotId=booking.slot_id,
        notes=booking.notes,
        staffNotes=booking.staff_notes,
        utmSource=booking.utm_source,
        utmCampaign=booking.utm_campaign,
        createdAt=booking.created_at,
        updatedAt=booking.updated_at,
    )


@router.get("/appointments/{id}/waitlist-offers", response_model=List[WaitlistOfferCandidateDto])
async def get_waitlist_offers_for_slot(
    id: UUID,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[WaitlistOfferCandidateDto]:
    """Retrieves waitlist candidates that can be offered the open slot of this appointment."""
    offers = await reception_service.get_waitlist_offers_for_slot(booking_id=id)
    return [WaitlistOfferCandidateDto(**o) for o in offers]


@router.post("/appointments/{id}/waitlist-offers/create-task", response_model=TaskResponseDto)
async def create_waitlist_offer_task(
    id: UUID,
    req: CreateWaitlistOfferTaskRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> TaskResponseDto:
    """Creates a linked high-priority call task to offer a slot to a waitlist patient without auto-booking."""
    task = await reception_service.create_waitlist_offer_task(
        booking_id=id,
        waitlist_booking_id=req.waitlistBookingId,
        user_id=current_user.id,
    )
    return TaskResponseDto(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        clinicId=task.clinic_id,
        assignedToUserId=task.assigned_to_user_id,
        patientId=task.patient_id,
        bookingId=task.booking_id,
        dueDate=task.due_date,
        createdAt=task.created_at,
        updatedAt=task.updated_at,
    )


@router.get("/appointments/{id}/payments", response_model=List[VisitPaymentDto])
async def get_appointment_payments(
    id: UUID,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[VisitPaymentDto]:
    """Lists visit payments recorded for this appointment."""
    payments = await reception_service.get_booking_payments(booking_id=id)
    return [VisitPaymentDto(**p) for p in payments]


@router.post(
    "/appointments/{id}/payments",
    response_model=VisitPaymentDto,
    status_code=status.HTTP_201_CREATED,
)
async def record_appointment_payment(
    id: UUID,
    req: RecordVisitPaymentRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> VisitPaymentDto:
    """Records a visit payment (cash, card, transfer) at reception. Audited."""
    payment = await reception_service.record_visit_payment(
        booking_id=id,
        amount_cents=req.amountCents,
        currency=req.currency,
        method=req.method,
        notes=req.notes,
        patient_id=req.patientId,
        user_id=current_user.id,
        amount_charged_cents=req.amountChargedCents,
        override_reason=req.overrideReason,
    )
    return VisitPaymentDto(
        id=payment.id,
        clinicId=payment.clinic_id,
        bookingId=payment.booking_id,
        patientId=payment.patient_id,
        amountCents=payment.amount_cents,
        amountFormatted=payment.amount_formatted,
        amountChargedCents=payment.amount_charged_cents,
        amountChargedFormatted=payment.amount_charged_formatted,
        currency=payment.currency,
        method=payment.method,
        notes=payment.notes,
        isVoided=payment.is_voided,
        voidReason=payment.void_reason,
        voidedAt=payment.voided_at,
        voidedByUserId=payment.voided_by_user_id,
        voidedByName=None,
        recordedByUserId=payment.recorded_by_user_id,
        recordedByName=current_user.full_name,
        createdAt=payment.created_at,
    )


@router.post(
    "/appointments/{id}/payments/{payment_id}/void",
    response_model=VisitPaymentDto,
)
async def void_appointment_payment(
    id: UUID,
    payment_id: UUID,
    req: VoidVisitPaymentRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> VisitPaymentDto:
    """Voids an existing visit payment with mandatory reason. Audited."""
    payment = await reception_service.void_visit_payment(
        booking_id=id,
        payment_id=payment_id,
        user_id=current_user.id,
        reason=req.reason,
    )
    return VisitPaymentDto(
        id=payment.id,
        clinicId=payment.clinic_id,
        bookingId=payment.booking_id,
        patientId=payment.patient_id,
        amountCents=payment.amount_cents,
        amountFormatted=payment.amount_formatted,
        amountChargedCents=payment.amount_charged_cents,
        amountChargedFormatted=payment.amount_charged_formatted,
        currency=payment.currency,
        method=payment.method,
        notes=payment.notes,
        isVoided=payment.is_voided,
        voidReason=payment.void_reason,
        voidedAt=payment.voided_at,
        voidedByUserId=payment.voided_by_user_id,
        voidedByName=current_user.full_name,
        recordedByUserId=payment.recorded_by_user_id,
        recordedByName=None,
        createdAt=payment.created_at,
    )


# --- 3. Patients ---

@router.get("/patients", response_model=Dict[str, Any])
async def search_patients(
    query: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
    medical_alert_service: MedicalAlertService = Depends(get_medical_alert_service),
) -> Dict[str, Any]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    offset = (page - 1) * page_size
    patients, total = await reception_service.search_patients(
        query=query, clinic_id=effective_clinic, limit=page_size, offset=offset
    )
    items = []
    for p in patients:
        has_alerts = await medical_alert_service.check_alerts_on_file(p.id)
        items.append(
            PatientResponseDto(
                id=p.id,
                firstName=p.first_name,
                lastName=p.last_name,
                fullName=f"{p.first_name} {p.last_name}",
                phone=p.phone,
                email=p.email,
                clinicId=p.clinic_id,
                dateOfBirth=p.date_of_birth,
                notes=p.notes,
                medicalHistoryStatus=p.medical_history_status,
                hasAlerts=has_alerts,
                isActive=p.is_active,
                messagingOptOut=getattr(p, "messaging_opt_out", False),
                preferredChannel=getattr(p, "preferred_channel", "sms") or "sms",
                fileNumber=p.file_number,
                guardianName=p.guardian_name,
                guardianPhone=p.guardian_phone,
                guardianRelationship=p.guardian_relationship,
                emergencyContactName=p.emergency_contact_name,
                emergencyContactPhone=p.emergency_contact_phone,
                emergencyContactRelationship=p.emergency_contact_relationship,
                createdAt=p.created_at,
                updatedAt=p.updated_at,
            )
        )
    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
    }


@router.post("/patients", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_patient(
    req: PatientCreateRequest,
    check_duplicates: bool = Query(True),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> Dict[str, Any]:
    effective_clinic = _get_clinic_scope(current_user, req.clinicId)
    patient, duplicates = await reception_service.create_patient(
        first_name=req.firstName,
        last_name=req.lastName,
        phone=req.phone,
        email=req.email,
        date_of_birth=req.dateOfBirth,
        clinic_id=effective_clinic,
        notes=req.notes,
        check_duplicate=check_duplicates,
        file_number=req.fileNumber,
        guardian_name=req.guardianName,
        guardian_phone=req.guardianPhone,
        guardian_relationship=req.guardianRelationship,
        emergency_contact_name=req.emergencyContactName,
        emergency_contact_phone=req.emergencyContactPhone,
        emergency_contact_relationship=req.emergencyContactRelationship,
        user_id=current_user.id,
        preferred_channel=req.preferredChannel or "sms",
    )
    return {
        "patient": PatientResponseDto(
            id=patient.id,
            firstName=patient.first_name,
            lastName=patient.last_name,
            fullName=f"{patient.first_name} {patient.last_name}",
            phone=patient.phone,
            email=patient.email,
            clinicId=patient.clinic_id,
            dateOfBirth=patient.date_of_birth,
            notes=patient.notes,
            medicalHistoryStatus=patient.medical_history_status,
            hasAlerts=False,
            isActive=patient.is_active,
            messagingOptOut=getattr(patient, "messaging_opt_out", False),
            preferredChannel=getattr(patient, "preferred_channel", "sms") or "sms",
            fileNumber=patient.file_number,
            guardianName=patient.guardian_name,
            guardianPhone=patient.guardian_phone,
            guardianRelationship=patient.guardian_relationship,
            emergencyContactName=patient.emergency_contact_name,
            emergencyContactPhone=patient.emergency_contact_phone,
            emergencyContactRelationship=patient.emergency_contact_relationship,
            createdAt=patient.created_at,
            updatedAt=patient.updated_at,
        ),
        "isDuplicate": len(duplicates) > 0,
        "matchedCount": len(duplicates),
    }


@router.get("/patients/{id}", response_model=PatientProfileResponse)
async def get_patient_profile(
    id: UUID,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
    medical_alert_service: MedicalAlertService = Depends(get_medical_alert_service),
) -> PatientProfileResponse:
    profile = await reception_service.get_patient_profile(id)
    pat = profile["patient"]
    has_alerts = await medical_alert_service.check_alerts_on_file(pat.id)
    return PatientProfileResponse(
        patient=PatientResponseDto(
            id=pat.id,
            firstName=pat.first_name,
            lastName=pat.last_name,
            fullName=f"{pat.first_name} {pat.last_name}",
            phone=pat.phone,
            email=pat.email,
            clinicId=pat.clinic_id,
            dateOfBirth=pat.date_of_birth,
            notes=pat.notes,
            medicalHistoryStatus=pat.medical_history_status,
            hasAlerts=has_alerts,
            isActive=pat.is_active,
            messagingOptOut=getattr(pat, "messaging_opt_out", False),
            preferredChannel=getattr(pat, "preferred_channel", "sms") or "sms",
            fileNumber=pat.file_number,
            guardianName=pat.guardian_name,
            guardianPhone=pat.guardian_phone,
            guardianRelationship=pat.guardian_relationship,
            emergencyContactName=pat.emergency_contact_name,
            emergencyContactPhone=pat.emergency_contact_phone,
            emergencyContactRelationship=pat.emergency_contact_relationship,
            createdAt=pat.created_at,
            updatedAt=pat.updated_at,
        ),
        upcomingAppointments=[
            BookingResponseDto(
                id=b.id,
                confirmationId=b.confirmation_id,
                preferredDate=b.preferred_date,
                preferredTime=b.preferred_time,
                patientFullName=b.patient_full_name,
                patientPhone=b.patient_phone,
                patientEmail=b.patient_email,
                status=b.status,
                clinicId=b.clinic_id,
                patientId=b.patient_id,
                serviceId=b.service_id,
                teamMemberId=b.team_member_id,
                slotId=b.slot_id,
                notes=b.notes,
                staffNotes=b.staff_notes,
                utmSource=b.utm_source,
                utmCampaign=b.utm_campaign,
                createdAt=b.created_at,
                updatedAt=b.updated_at,
            )
            for b in profile["upcomingAppointments"]
        ],
        pastAppointments=[
            BookingResponseDto(
                id=b.id,
                confirmationId=b.confirmation_id,
                preferredDate=b.preferred_date,
                preferredTime=b.preferred_time,
                patientFullName=b.patient_full_name,
                patientPhone=b.patient_phone,
                patientEmail=b.patient_email,
                status=b.status,
                clinicId=b.clinic_id,
                patientId=b.patient_id,
                serviceId=b.service_id,
                teamMemberId=b.team_member_id,
                slotId=b.slot_id,
                notes=b.notes,
                staffNotes=b.staff_notes,
                utmSource=b.utm_source,
                utmCampaign=b.utm_campaign,
                createdAt=b.created_at,
                updatedAt=b.updated_at,
            )
            for b in profile["pastAppointments"]
        ],
        tasks=[
            TaskResponseDto(
                id=t.id,
                title=t.title,
                description=t.description,
                status=t.status,
                priority=t.priority,
                clinicId=t.clinic_id,
                assignedToUserId=t.assigned_to_user_id,
                patientId=t.patient_id,
                bookingId=t.booking_id,
                dueDate=t.due_date,
                createdAt=t.created_at,
                updatedAt=t.updated_at,
            )
            for t in profile["tasks"]
        ],
        messages=[
            MessageResponseDto(
                id=m.id,
                content=m.content,
                patientId=m.patient_id,
                senderId=m.sender_id,
                recipientId=m.recipient_id,
                phone=m.phone,
                email=m.email,
                channel=m.channel,
                status=m.status,
                createdAt=m.created_at,
            )
            for m in profile["messages"]
        ],
    )


@router.patch("/patients/{id}", response_model=PatientResponseDto)
async def update_patient_info(
    id: UUID,
    req: PatientUpdateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> PatientResponseDto:
    updates = {}
    if req.firstName is not None:
        updates["first_name"] = req.firstName.strip()
    if req.lastName is not None:
        updates["last_name"] = req.lastName.strip()
    if req.phone is not None:
        updates["phone"] = req.phone.strip()
    if req.email is not None:
        updates["email"] = req.email.strip().lower()
    if req.dateOfBirth is not None:
        updates["date_of_birth"] = req.dateOfBirth
    if req.notes is not None:
        updates["notes"] = req.notes
    if req.isActive is not None:
        updates["is_active"] = req.isActive
    if req.messagingOptOut is not None:
        updates["messaging_opt_out"] = req.messagingOptOut
    if req.fileNumber is not None:
        updates["file_number"] = req.fileNumber.strip() if req.fileNumber else None
    if req.guardianName is not None:
        updates["guardian_name"] = req.guardianName.strip() if req.guardianName else None
    if req.guardianPhone is not None:
        updates["guardian_phone"] = req.guardianPhone.strip() if req.guardianPhone else None
    if req.guardianRelationship is not None:
        updates["guardian_relationship"] = req.guardianRelationship.strip() if req.guardianRelationship else None
    if req.emergencyContactName is not None:
        updates["emergency_contact_name"] = req.emergencyContactName.strip() if req.emergencyContactName else None
    if req.emergencyContactPhone is not None:
        updates["emergency_contact_phone"] = req.emergencyContactPhone.strip() if req.emergencyContactPhone else None
    if req.emergencyContactRelationship is not None:
        updates["emergency_contact_relationship"] = req.emergencyContactRelationship.strip() if req.emergencyContactRelationship else None
    if req.preferredChannel is not None:
        updates["preferred_channel"] = req.preferredChannel

    pat = await reception_service.update_patient(id, updates, user_id=current_user.id)
    return PatientResponseDto(
        id=pat.id,
        firstName=pat.first_name,
        lastName=pat.last_name,
        fullName=f"{pat.first_name} {pat.last_name}",
        phone=pat.phone,
        email=pat.email,
        clinicId=pat.clinic_id,
        dateOfBirth=pat.date_of_birth,
        notes=pat.notes,
        medicalHistoryStatus=pat.medical_history_status,
        hasAlerts=False,
        isActive=pat.is_active,
        messagingOptOut=getattr(pat, "messaging_opt_out", False),
        preferredChannel=getattr(pat, "preferred_channel", "sms") or "sms",
        fileNumber=pat.file_number,
        guardianName=pat.guardian_name,
        guardianPhone=pat.guardian_phone,
        guardianRelationship=pat.guardian_relationship,
        emergencyContactName=pat.emergency_contact_name,
        emergencyContactPhone=pat.emergency_contact_phone,
        emergencyContactRelationship=pat.emergency_contact_relationship,
        createdAt=pat.created_at,
        updatedAt=pat.updated_at,
    )


@router.patch("/patients/{id}/messaging-opt-out", response_model=PatientResponseDto)
async def update_patient_messaging_opt_out(
    id: UUID,
    req: PatientMessagingOptOutRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> PatientResponseDto:
    pat = await reception_service.set_patient_messaging_opt_out(
        patient_id=id,
        opt_out=req.optOut,
        user_id=current_user.id,
    )
    return PatientResponseDto(
        id=pat.id,
        firstName=pat.first_name,
        lastName=pat.last_name,
        fullName=f"{pat.first_name} {pat.last_name}",
        phone=pat.phone,
        email=pat.email,
        clinicId=pat.clinic_id,
        dateOfBirth=pat.date_of_birth,
        notes=pat.notes,
        medicalHistoryStatus=pat.medical_history_status,
        hasAlerts=False,
        isActive=pat.is_active,
        messagingOptOut=getattr(pat, "messaging_opt_out", False),
        preferredChannel=getattr(pat, "preferred_channel", "sms") or "sms",
        fileNumber=pat.file_number,
        guardianName=pat.guardian_name,
        guardianPhone=pat.guardian_phone,
        guardianRelationship=pat.guardian_relationship,
        emergencyContactName=pat.emergency_contact_name,
        emergencyContactPhone=pat.emergency_contact_phone,
        emergencyContactRelationship=pat.emergency_contact_relationship,
        createdAt=pat.created_at,
        updatedAt=pat.updated_at,
    )


# --- 4. Tasks ---

@router.get("/tasks", response_model=List[TaskResponseDto])
async def list_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[TaskResponseDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    tasks, _ = await reception_service.list_tasks(
        clinic_id=effective_clinic, status=status, priority=priority
    )
    return [
        TaskResponseDto(
            id=t.id,
            title=t.title,
            description=t.description,
            status=t.status,
            priority=t.priority,
            clinicId=t.clinic_id,
            assignedToUserId=t.assigned_to_user_id,
            patientId=t.patient_id,
            bookingId=t.booking_id,
            dueDate=t.due_date,
            createdAt=t.created_at,
            updatedAt=t.updated_at,
        )
        for t in tasks
    ]


@router.post("/tasks", response_model=TaskResponseDto, status_code=status.HTTP_201_CREATED)
async def create_task(
    req: TaskCreateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> TaskResponseDto:
    effective_clinic = _get_clinic_scope(current_user, req.clinicId)
    task = await reception_service.create_task(
        title=req.title,
        clinic_id=effective_clinic,
        assigned_to_user_id=req.assignedToUserId or current_user.id,
        patient_id=req.patientId,
        booking_id=req.bookingId,
        description=req.description,
        priority=req.priority,
        status=req.status,
        due_date=req.dueDate,
        user_id=current_user.id,
    )
    return TaskResponseDto(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        clinicId=task.clinic_id,
        assignedToUserId=task.assigned_to_user_id,
        patientId=task.patient_id,
        bookingId=task.booking_id,
        dueDate=task.due_date,
        createdAt=task.created_at,
        updatedAt=task.updated_at,
    )


@router.patch("/tasks/{id}", response_model=TaskResponseDto)
async def update_task(
    id: UUID,
    req: TaskUpdateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> TaskResponseDto:
    updates = {}
    if req.title is not None:
        updates["title"] = req.title
    if req.description is not None:
        updates["description"] = req.description
    if req.status is not None:
        updates["status"] = req.status
    if req.priority is not None:
        updates["priority"] = req.priority
    if req.assignedToUserId is not None:
        updates["assigned_to_user_id"] = req.assignedToUserId
    if req.dueDate is not None:
        updates["due_date"] = req.dueDate

    task = await reception_service.update_task(id, updates, user_id=current_user.id)
    return TaskResponseDto(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        clinicId=task.clinic_id,
        assignedToUserId=task.assigned_to_user_id,
        dueDate=task.due_date,
        createdAt=task.created_at,
        updatedAt=task.updated_at,
    )


# --- 5. Messages ---

@router.get("/messages", response_model=List[MessageResponseDto])
async def list_messages(
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[MessageResponseDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    messages, _ = await reception_service.list_messages(clinic_id=effective_clinic)
    return [
        MessageResponseDto(
            id=m.id,
            content=m.content,
            senderId=m.sender_id,
            recipientId=m.recipient_id,
            phone=m.phone,
            email=m.email,
            channel=m.channel,
            status=m.status,
            createdAt=m.created_at,
        )
        for m in messages
    ]


@router.post("/messages", response_model=MessageResponseDto, status_code=status.HTTP_201_CREATED)
async def send_message(
    req: MessageCreateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> MessageResponseDto:
    msg = await reception_service.create_message(
        content=req.content,
        sender_id=current_user.id,
        recipient_id=req.recipientId,
        patient_id=req.patientId,
        phone=req.phone,
        email=req.email,
        channel=req.channel,
    )
    return MessageResponseDto(
        id=msg.id,
        content=msg.content,
        patientId=msg.patient_id,
        senderId=msg.sender_id,
        recipientId=msg.recipient_id,
        phone=msg.phone,
        email=msg.email,
        channel=msg.channel,
        status=msg.status,
        createdAt=msg.created_at,
    )


# --- 6. Leads ---

@router.get("/leads", response_model=List[LeadResponseDto])
async def list_leads(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[LeadResponseDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    leads, _ = await reception_service.list_leads(
        clinic_id=effective_clinic, status=status, search=search
    )
    return [
        LeadResponseDto(
            id=l.id,
            fullName=l.full_name,
            phone=l.phone,
            email=l.email,
            clinicId=l.clinic_id,
            patientId=l.patient_id,
            leadSourceId=l.lead_source_id,
            status=l.status,
            notes=l.notes,
            utmSource=l.utm_source,
            utmCampaign=l.utm_campaign,
            createdAt=l.created_at,
            updatedAt=l.updated_at,
        )
        for l in leads
    ]


@router.post("/leads", response_model=LeadResponseDto, status_code=status.HTTP_201_CREATED)
async def create_lead(
    req: LeadCreateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> LeadResponseDto:
    effective_clinic = _get_clinic_scope(current_user, req.clinicId)
    lead = await reception_service.create_lead(
        full_name=req.fullName,
        phone=req.phone,
        email=req.email,
        clinic_id=effective_clinic,
        lead_source_id=req.leadSourceId,
        status=req.status,
        notes=req.notes,
        utm_source=req.utmSource,
        utm_campaign=req.utmCampaign,
    )
    return LeadResponseDto(
        id=lead.id,
        fullName=lead.full_name,
        phone=lead.phone,
        email=lead.email,
        clinicId=lead.clinic_id,
        patientId=lead.patient_id,
        leadSourceId=lead.lead_source_id,
        status=lead.status,
        notes=lead.notes,
        utmSource=lead.utm_source,
        utmCampaign=lead.utm_campaign,
        createdAt=lead.created_at,
        updatedAt=lead.updated_at,
    )


@router.patch("/leads/{id}", response_model=LeadResponseDto)
async def update_lead(
    id: UUID,
    req: LeadUpdateRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> LeadResponseDto:
    updates = {}
    if req.fullName is not None:
        updates["full_name"] = req.fullName
    if req.phone is not None:
        updates["phone"] = req.phone
    if req.email is not None:
        updates["email"] = req.email
    if req.status is not None:
        updates["status"] = req.status
    if req.notes is not None:
        updates["notes"] = req.notes
    if req.clinicId is not None:
        updates["clinic_id"] = req.clinicId
    if req.leadSourceId is not None:
        updates["lead_source_id"] = req.leadSourceId

    lead = await reception_service.update_lead(id, updates)
    return LeadResponseDto(
        id=lead.id,
        fullName=lead.full_name,
        phone=lead.phone,
        email=lead.email,
        clinicId=lead.clinic_id,
        patientId=lead.patient_id,
        leadSourceId=lead.lead_source_id,
        status=lead.status,
        notes=lead.notes,
        utmSource=lead.utm_source,
        utmCampaign=lead.utm_campaign,
        createdAt=lead.created_at,
        updatedAt=lead.updated_at,
    )


@router.post("/leads/{id}/convert", response_model=PatientResponseDto)
async def convert_lead_to_patient(
    id: UUID,
    req: LeadConvertRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> PatientResponseDto:
    effective_clinic = _get_clinic_scope(current_user, req.clinicId)
    patient = await reception_service.convert_lead_to_patient(
        lead_id=id,
        date_of_birth=req.dateOfBirth,
        clinic_id=effective_clinic,
        notes=req.notes,
    )
    return PatientResponseDto(
        id=patient.id,
        firstName=patient.first_name,
        lastName=patient.last_name,
        fullName=f"{patient.first_name} {patient.last_name}",
        phone=patient.phone,
        email=patient.email,
        clinicId=patient.clinic_id,
        dateOfBirth=patient.date_of_birth,
        notes=patient.notes,
        isActive=patient.is_active,
        createdAt=patient.created_at,
        updatedAt=patient.updated_at,
    )


# --- 7. Recalls & Waitlist ---

@router.get("/recalls", response_model=List[RecallItemDto])
async def get_recalls(
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[RecallItemDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    raw = await reception_service.get_recalls(clinic_id=effective_clinic)
    return [RecallItemDto(**r) for r in raw]


@router.post("/recalls/tasks", response_model=TaskResponseDto, status_code=status.HTTP_201_CREATED)
async def create_recall_task(
    req: CreateRecallTaskRequest,
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> TaskResponseDto:
    effective_clinic = _get_clinic_scope(current_user, None)
    task = await reception_service.create_recall_task(
        patient_id=req.patientId,
        service_id=req.serviceId,
        due_date=req.dueDate,
        user_id=current_user.id,
        clinic_id=effective_clinic,
    )
    return TaskResponseDto(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        clinicId=task.clinic_id,
        assignedToUserId=task.assigned_to_user_id,
        patientId=task.patient_id,
        bookingId=task.booking_id,
        dueDate=task.due_date,
        createdAt=task.created_at,
        updatedAt=task.updated_at,
    )


@router.get("/waitlist", response_model=List[BookingResponseDto])
async def get_waitlist(
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[BookingResponseDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    bookings, _ = await reception_service.list_schedule(
        clinic_id=effective_clinic, status="waitlist", limit=100
    )
    return [
        BookingResponseDto(
            id=b.id,
            confirmationId=b.confirmation_id,
            preferredDate=b.preferred_date,
            preferredTime=b.preferred_time,
            patientFullName=b.patient_full_name,
            patientPhone=b.patient_phone,
            patientEmail=b.patient_email,
            status=b.status,
            clinicId=b.clinic_id,
            patientId=b.patient_id,
            serviceId=b.service_id,
            teamMemberId=b.team_member_id,
            slotId=b.slot_id,
            notes=b.notes,
            staffNotes=b.staff_notes,
            utmSource=b.utm_source,
            utmCampaign=b.utm_campaign,
            createdAt=b.created_at,
            updatedAt=b.updated_at,
        )
        for b in bookings
    ]


@router.post(
    "/patients/{patient_id}/pending-alerts",
    response_model=MedicalAlertDto,
    status_code=status.HTTP_201_CREATED,
)
async def record_pending_alert(
    patient_id: UUID,
    req: CreatePendingAlertRequest,
    current_user: User = Depends(require_role("receptionist", "Clinic Branch Manager")),
    medical_alert_service: MedicalAlertService = Depends(get_medical_alert_service),
) -> MedicalAlertDto:
    """
    Reception-capture endpoint: records an unconfirmed pending medical alert reported at front desk.
    Doctors see this on the patient record as 'Reception reported: ... — confirm or dismiss'.
    """
    saved = await medical_alert_service.create_reception_pending_alert(
        patient_id=patient_id,
        alert_type=req.type,
        description=req.description,
        current_user=current_user,
    )
    return MedicalAlertDto(
        id=saved.id,
        patientId=saved.patient_id,
        type=saved.type,
        description=saved.description,
        severity=saved.severity,
        recordedByUserId=saved.recorded_by_user_id,
        recordedAt=saved.recorded_at,
        lastReviewedAt=saved.last_reviewed_at,
        isActive=saved.is_active,
        isConfirmed=saved.is_confirmed,
        createdAt=saved.created_at,
        updatedAt=saved.updated_at,
    )

