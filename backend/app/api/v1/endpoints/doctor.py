from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_doctor_service, require_doctor
from app.application.dtos.reception_dto import BookingResponseDto
from app.application.services.doctor_service import DoctorService
from app.domain.models.user import User

router = APIRouter(
    prefix="/doctor",
    tags=["Doctor Clinical Foundation"],
    dependencies=[Depends(require_doctor)],
)


class DoctorNoteUpdateRequest(BaseModel):
    staffNotes: str


@router.get("/schedule", response_model=List[BookingResponseDto])
async def get_doctor_schedule(
    target_date: Optional[date] = Query(None),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_doctor),
    doctor_service: DoctorService = Depends(get_doctor_service),
) -> List[BookingResponseDto]:
    effective_clinic = current_user.clinic_id or clinic_id
    bookings = await doctor_service.get_doctor_schedule(
        clinic_id=effective_clinic,
        target_date=target_date,
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


@router.get("/appointments/{id}", response_model=BookingResponseDto)
async def get_appointment_detail(
    id: UUID,
    current_user: User = Depends(require_doctor),
    doctor_service: DoctorService = Depends(get_doctor_service),
) -> BookingResponseDto:
    b = await doctor_service.get_appointment(id)
    return BookingResponseDto(
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


@router.patch("/appointments/{id}/notes", response_model=BookingResponseDto)
async def update_appointment_notes(
    id: UUID,
    req: DoctorNoteUpdateRequest,
    current_user: User = Depends(require_doctor),
    doctor_service: DoctorService = Depends(get_doctor_service),
) -> BookingResponseDto:
    b = await doctor_service.update_notes(id, req.staffNotes)
    return BookingResponseDto(
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
