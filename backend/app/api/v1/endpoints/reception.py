from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_reception_service, require_receptionist
from app.application.dtos.reception_dto import (
    BookingCreateRequest,
    BookingRescheduleRequest,
    BookingResponseDto,
    BookingStatusUpdateRequest,
    DashboardSummaryResponse,
    LeadConvertRequest,
    LeadCreateRequest,
    LeadResponseDto,
    LeadUpdateRequest,
    MessageCreateRequest,
    MessageResponseDto,
    PatientCreateRequest,
    PatientProfileResponse,
    PatientResponseDto,
    PatientUpdateRequest,
    TaskCreateRequest,
    TaskResponseDto,
    TaskUpdateRequest,
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
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[BookingResponseDto]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    bookings, _ = await reception_service.list_schedule(
        clinic_id=effective_clinic,
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
        booking_id=id, new_status=req.status, staff_notes=req.staffNotes
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
        slot_id=req.slotId,
        staff_notes=req.staffNotes,
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


# --- 3. Patients ---

@router.get("/patients", response_model=Dict[str, Any])
async def search_patients(
    query: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> Dict[str, Any]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    offset = (page - 1) * page_size
    patients, total = await reception_service.search_patients(
        query=query, clinic_id=effective_clinic, limit=page_size, offset=offset
    )
    items = [
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
            isActive=p.is_active,
            createdAt=p.created_at,
            updatedAt=p.updated_at,
        )
        for p in patients
    ]
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
            isActive=patient.is_active,
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
) -> PatientProfileResponse:
    profile = await reception_service.get_patient_profile(id)
    pat = profile["patient"]
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
            isActive=pat.is_active,
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
        tasks=[],
        messages=[],
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

    pat = await reception_service.update_patient(id, updates)
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
        isActive=pat.is_active,
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
        description=req.description,
        priority=req.priority,
        status=req.status,
        due_date=req.dueDate,
    )
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

    task = await reception_service.update_task(id, updates)
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
        phone=req.phone,
        email=req.email,
        channel=req.channel,
    )
    return MessageResponseDto(
        id=msg.id,
        content=msg.content,
        senderId=msg.sender_id,
        recipientId=msg.recipientId if hasattr(msg, "recipientId") else msg.recipient_id,
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

@router.get("/recalls", response_model=List[Dict[str, Any]])
async def get_recalls(
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_receptionist),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> List[Dict[str, Any]]:
    effective_clinic = _get_clinic_scope(current_user, clinic_id)
    return await reception_service.get_recalls(clinic_id=effective_clinic)


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
