from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import (
    get_clinical_note_service,
    get_dental_chart_service,
    get_doctor_service,
    get_encounter_service,
    require_doctor,
)
from app.application.dtos.clinical_note_dto import (
    AmendNoteRequestDto,
    ClinicalNoteResponseDto,
    SaveDraftNoteRequestDto,
)
from app.application.dtos.dental_chart_dto import (
    ChartHistoryResponseDto,
    CorrectFindingRequestDto,
    CreateProcedureRequestDto,
    DentalChartFindingResponseDto,
    DentalChartResponseDto,
    DentalProcedureResponseDto,
    EncounterChartResponseDto,
    RecordFindingRequestDto,
    ResolveFindingRequestDto,
    UpdateProcedureStatusRequestDto,
)
from app.application.dtos.encounter_dto import (
    CreateEncounterRequestDto,
    EncounterResponseDto,
    UpdateEncounterStatusRequestDto,
)
from app.application.dtos.reception_dto import BookingResponseDto
from app.application.services.clinical_note_service import ClinicalNoteService
from app.application.services.dental_chart_service import DentalChartService
from app.application.services.doctor_service import DoctorService
from app.application.services.encounter_service import EncounterService
from app.domain.models.dental_chart import CONDITION_CATALOG, CONDITION_LABELS, DentalChartFinding, DentalProcedureRecord
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
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    # Fail closed: a non-admin doctor with no linked team_member_id sees an empty schedule
    if not is_admin_level and not current_user.team_member_id:
        return []

    effective_clinic = current_user.clinic_id or clinic_id
    effective_team_member = current_user.team_member_id if not is_admin_level else None
    bookings = await doctor_service.get_doctor_schedule(
        team_member_id=effective_team_member,
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
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    # Enforce clinician authorization: doctor cannot view another doctor's assigned appointment details
    if not is_admin_level:
        if not current_user.team_member_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
            )
        if b.team_member_id and b.team_member_id != current_user.team_member_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot view appointment details for another doctor's assigned patient.",
            )

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
    b = await doctor_service.get_appointment(id)
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    # Enforce clinician authorization: doctor cannot edit another doctor's assigned patient notes
    if not is_admin_level:
        if not current_user.team_member_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
            )
        if b.team_member_id and b.team_member_id != current_user.team_member_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot modify clinical notes for another doctor's assigned appointment.",
            )
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


# --- Clinical Encounter Endpoints (Phase 1 Stage 1) ---

@router.post("/encounters", response_model=EncounterResponseDto, status_code=status.HTTP_201_CREATED)
async def create_clinical_encounter(
    req: CreateEncounterRequestDto,
    current_user: User = Depends(require_doctor),
    encounter_service: EncounterService = Depends(get_encounter_service),
) -> EncounterResponseDto:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    if not is_admin_level and not current_user.team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )

    # Derived strictly server-side
    clinician_id = current_user.team_member_id
    if not clinician_id and is_admin_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator must be associated with a clinical staff profile to author an encounter.",
        )

    try:
        encounter = await encounter_service.create_encounter(
            clinician_id=clinician_id,
            clinic_id=current_user.clinic_id,
            dto=req,
            is_admin=is_admin_level,
        )
        return EncounterResponseDto(
            id=encounter.id,
            patientId=encounter.patient_id,
            clinicianId=encounter.clinician_id,
            clinicId=encounter.clinic_id,
            bookingId=encounter.booking_id,
            appointmentId=encounter.appointment_id,
            status=encounter.status,
            chiefComplaint=encounter.chief_complaint,
            reasonForVisit=encounter.reason_for_visit,
            startedAt=encounter.started_at,
            endedAt=encounter.ended_at,
            createdAt=encounter.created_at,
            updatedAt=encounter.updated_at,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        if "ACTIVE_ENCOUNTER_EXISTS" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active encounter already exists for this booking.",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.get("/encounters/{id}", response_model=EncounterResponseDto)
async def get_clinical_encounter(
    id: UUID,
    current_user: User = Depends(require_doctor),
    encounter_service: EncounterService = Depends(get_encounter_service),
) -> EncounterResponseDto:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    try:
        encounter = await encounter_service.get_encounter(
            encounter_id=id,
            current_user_team_member_id=current_user.team_member_id,
            is_admin=is_admin_level,
        )
        return EncounterResponseDto(
            id=encounter.id,
            patientId=encounter.patient_id,
            clinicianId=encounter.clinician_id,
            clinicId=encounter.clinic_id,
            bookingId=encounter.booking_id,
            appointmentId=encounter.appointment_id,
            status=encounter.status,
            chiefComplaint=encounter.chief_complaint,
            reasonForVisit=encounter.reason_for_visit,
            startedAt=encounter.started_at,
            endedAt=encounter.ended_at,
            createdAt=encounter.created_at,
            updatedAt=encounter.updated_at,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/encounters/by-booking/{booking_id}", response_model=Optional[EncounterResponseDto])
async def get_active_encounter_by_booking(
    booking_id: UUID,
    current_user: User = Depends(require_doctor),
    encounter_service: EncounterService = Depends(get_encounter_service),
) -> Optional[EncounterResponseDto]:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    try:
        encounter = await encounter_service.get_active_encounter_by_booking(
            booking_id=booking_id,
            current_user_team_member_id=current_user.team_member_id,
            is_admin=is_admin_level,
        )
        if not encounter:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active encounter found for this booking.",
            )
        return EncounterResponseDto(
            id=encounter.id,
            patientId=encounter.patient_id,
            clinicianId=encounter.clinician_id,
            clinicId=encounter.clinic_id,
            bookingId=encounter.booking_id,
            appointmentId=encounter.appointment_id,
            status=encounter.status,
            chiefComplaint=encounter.chief_complaint,
            reasonForVisit=encounter.reason_for_visit,
            startedAt=encounter.started_at,
            endedAt=encounter.ended_at,
            createdAt=encounter.created_at,
            updatedAt=encounter.updated_at,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/patients/{patient_id}/encounters", response_model=List[EncounterResponseDto])
async def list_patient_encounters(
    patient_id: UUID,
    current_user: User = Depends(require_doctor),
    encounter_service: EncounterService = Depends(get_encounter_service),
) -> List[EncounterResponseDto]:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    try:
        encounters = await encounter_service.list_patient_encounters(
            patient_id=patient_id,
            current_user_team_member_id=current_user.team_member_id,
            is_admin=is_admin_level,
        )
        return [
            EncounterResponseDto(
                id=e.id,
                patientId=e.patient_id,
                clinicianId=e.clinician_id,
                clinicId=e.clinic_id,
                bookingId=e.booking_id,
                appointmentId=e.appointment_id,
                status=e.status,
                chiefComplaint=e.chief_complaint,
                reasonForVisit=e.reason_for_visit,
                startedAt=e.started_at,
                endedAt=e.ended_at,
                createdAt=e.created_at,
                updatedAt=e.updated_at,
            )
            for e in encounters
        ]
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/encounters/{id}/status", response_model=EncounterResponseDto)
async def update_encounter_status(
    id: UUID,
    req: UpdateEncounterStatusRequestDto,
    current_user: User = Depends(require_doctor),
    encounter_service: EncounterService = Depends(get_encounter_service),
) -> EncounterResponseDto:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    try:
        encounter = await encounter_service.update_encounter_status(
            encounter_id=id,
            new_status_str=req.status,
            current_user_team_member_id=current_user.team_member_id,
            is_admin=is_admin_level,
        )
        return EncounterResponseDto(
            id=encounter.id,
            patientId=encounter.patient_id,
            clinicianId=encounter.clinician_id,
            clinicId=encounter.clinic_id,
            bookingId=encounter.booking_id,
            appointmentId=encounter.appointment_id,
            status=encounter.status,
            chiefComplaint=encounter.chief_complaint,
            reasonForVisit=encounter.reason_for_visit,
            startedAt=encounter.started_at,
            endedAt=encounter.ended_at,
            createdAt=encounter.created_at,
            updatedAt=encounter.updated_at,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


# --- Structured SOAP Clinical Note Endpoints (Phase 1 Stage 2) ---

@router.get("/encounters/{id}/note", response_model=Optional[ClinicalNoteResponseDto])
async def get_encounter_clinical_note(
    id: UUID,
    current_user: User = Depends(require_doctor),
    note_service: ClinicalNoteService = Depends(get_clinical_note_service),
) -> Optional[ClinicalNoteResponseDto]:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    try:
        note = await note_service.get_current_note(
            encounter_id=id,
            current_user_team_member_id=current_user.team_member_id,
            clinic_id=current_user.clinic_id,
            is_admin=is_admin_level,
        )
        historical_notes = await note_service.get_historical_staff_notes(id)

        if not note:
            return None

        return ClinicalNoteResponseDto(
            id=note.id,
            encounterId=note.encounter_id,
            patientId=note.patient_id,
            authorId=note.author_id,
            clinicId=note.clinic_id,
            revisionNumber=note.revision_number,
            isCurrent=note.is_current,
            status=note.status,
            subjective=note.subjective,
            objective=note.objective,
            assessment=note.assessment,
            plan=note.plan,
            isSigned=note.is_signed,
            signedAt=note.signed_at,
            signedById=note.signed_by_id,
            amendmentReason=note.amendment_reason,
            createdAt=note.created_at,
            updatedAt=note.updated_at,
            historicalStaffNotes=historical_notes,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/encounters/{id}/note/draft", response_model=ClinicalNoteResponseDto)
async def save_encounter_draft_note(
    id: UUID,
    req: SaveDraftNoteRequestDto,
    current_user: User = Depends(require_doctor),
    note_service: ClinicalNoteService = Depends(get_clinical_note_service),
) -> ClinicalNoteResponseDto:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    if not is_admin_level and not current_user.team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )

    author_id = current_user.team_member_id
    if not author_id and is_admin_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator must be associated with a clinical staff profile to author notes.",
        )

    try:
        note = await note_service.save_draft_note(
            encounter_id=id,
            author_id=author_id,
            clinic_id=current_user.clinic_id,
            dto=req,
            user_id=current_user.id,
            is_admin=is_admin_level,
        )
        historical_notes = await note_service.get_historical_staff_notes(id)

        return ClinicalNoteResponseDto(
            id=note.id,
            encounterId=note.encounter_id,
            patientId=note.patient_id,
            authorId=note.author_id,
            clinicId=note.clinic_id,
            revisionNumber=note.revision_number,
            isCurrent=note.is_current,
            status=note.status,
            subjective=note.subjective,
            objective=note.objective,
            assessment=note.assessment,
            plan=note.plan,
            isSigned=note.is_signed,
            signedAt=note.signed_at,
            signedById=note.signed_by_id,
            amendmentReason=note.amendment_reason,
            createdAt=note.created_at,
            updatedAt=note.updated_at,
            historicalStaffNotes=historical_notes,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.post("/encounters/{id}/note/sign", response_model=ClinicalNoteResponseDto)
async def sign_encounter_clinical_note(
    id: UUID,
    current_user: User = Depends(require_doctor),
    note_service: ClinicalNoteService = Depends(get_clinical_note_service),
) -> ClinicalNoteResponseDto:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    if not is_admin_level and not current_user.team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )

    author_id = current_user.team_member_id
    if not author_id and is_admin_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator must be associated with a clinical staff profile to sign notes.",
        )

    try:
        note = await note_service.sign_note(
            encounter_id=id,
            author_id=author_id,
            user_id=current_user.id,
            clinic_id=current_user.clinic_id,
            is_admin=is_admin_level,
        )
        historical_notes = await note_service.get_historical_staff_notes(id)

        return ClinicalNoteResponseDto(
            id=note.id,
            encounterId=note.encounter_id,
            patientId=note.patient_id,
            authorId=note.author_id,
            clinicId=note.clinic_id,
            revisionNumber=note.revision_number,
            isCurrent=note.is_current,
            status=note.status,
            subjective=note.subjective,
            objective=note.objective,
            assessment=note.assessment,
            plan=note.plan,
            isSigned=note.is_signed,
            signedAt=note.signed_at,
            signedById=note.signed_by_id,
            amendmentReason=note.amendment_reason,
            createdAt=note.created_at,
            updatedAt=note.updated_at,
            historicalStaffNotes=historical_notes,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.post("/encounters/{id}/note/amend", response_model=ClinicalNoteResponseDto)
async def amend_encounter_clinical_note(
    id: UUID,
    req: AmendNoteRequestDto,
    current_user: User = Depends(require_doctor),
    note_service: ClinicalNoteService = Depends(get_clinical_note_service),
) -> ClinicalNoteResponseDto:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    if not is_admin_level and not current_user.team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )

    author_id = current_user.team_member_id
    if not author_id and is_admin_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator must be associated with a clinical staff profile to amend notes.",
        )

    try:
        note = await note_service.amend_note(
            encounter_id=id,
            author_id=author_id,
            clinic_id=current_user.clinic_id,
            dto=req,
            user_id=current_user.id,
            is_admin=is_admin_level,
        )
        historical_notes = await note_service.get_historical_staff_notes(id)

        return ClinicalNoteResponseDto(
            id=note.id,
            encounterId=note.encounter_id,
            patientId=note.patient_id,
            authorId=note.author_id,
            clinicId=note.clinic_id,
            revisionNumber=note.revision_number,
            isCurrent=note.is_current,
            status=note.status,
            subjective=note.subjective,
            objective=note.objective,
            assessment=note.assessment,
            plan=note.plan,
            isSigned=note.is_signed,
            signedAt=note.signed_at,
            signedById=note.signed_by_id,
            amendmentReason=note.amendment_reason,
            createdAt=note.created_at,
            updatedAt=note.updated_at,
            historicalStaffNotes=historical_notes,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.get("/encounters/{id}/note/revisions", response_model=List[ClinicalNoteResponseDto])
async def list_encounter_note_revisions(
    id: UUID,
    current_user: User = Depends(require_doctor),
    note_service: ClinicalNoteService = Depends(get_clinical_note_service),
) -> List[ClinicalNoteResponseDto]:
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")

    try:
        revisions = await note_service.list_revisions(
            encounter_id=id,
            current_user_team_member_id=current_user.team_member_id,
            clinic_id=current_user.clinic_id,
            is_admin=is_admin_level,
        )
        return [
            ClinicalNoteResponseDto(
                id=r.id,
                encounterId=r.encounter_id,
                patientId=r.patient_id,
                authorId=r.author_id,
                clinicId=r.clinic_id,
                revisionNumber=r.revision_number,
                isCurrent=r.is_current,
                status=r.status,
                subjective=r.subjective,
                objective=r.objective,
                assessment=r.assessment,
                plan=r.plan,
                isSigned=r.is_signed,
                signedAt=r.signed_at,
                signedById=r.signed_by_id,
                amendmentReason=r.amendment_reason,
                createdAt=r.created_at,
                updatedAt=r.updated_at,
            )
            for r in revisions
        ]
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))



# --- Dental Chart Endpoints (Phase 1 Stage 3) ---


def _finding_to_dto(finding: DentalChartFinding) -> DentalChartFindingResponseDto:
    return DentalChartFindingResponseDto(
        id=finding.id,
        patientId=finding.patient_id,
        encounterId=finding.encounter_id,
        authorId=finding.author_id,
        clinicId=finding.clinic_id,
        tooth=finding.tooth,
        surfaces=finding.surfaces,
        condition=finding.condition,
        conditionLabel=CONDITION_LABELS.get(finding.condition, finding.condition),
        status=finding.status,
        notes=finding.notes,
        correctionReason=finding.correction_reason,
        correctedById=finding.corrected_by_id,
        correctedAt=finding.corrected_at,
        resolvedById=finding.resolved_by_id,
        resolvedAt=finding.resolved_at,
        createdAt=finding.created_at,
        updatedAt=finding.updated_at,
    )


def _procedure_to_dto(procedure: DentalProcedureRecord) -> DentalProcedureResponseDto:
    return DentalProcedureResponseDto(
        id=procedure.id,
        patientId=procedure.patient_id,
        encounterId=procedure.encounter_id,
        recordedById=procedure.recorded_by_id,
        serviceId=procedure.service_id,
        clinicId=procedure.clinic_id,
        tooth=procedure.tooth,
        surfaces=procedure.surfaces,
        status=procedure.status,
        notes=procedure.notes,
        startedAt=procedure.started_at,
        completedAt=procedure.completed_at,
        completedById=procedure.completed_by_id,
        createdAt=procedure.created_at,
        updatedAt=procedure.updated_at,
    )


def _chart_identity(current_user: User) -> tuple:
    """
    Derives (team_member_id, clinic_id, is_admin, user_id) from the authenticated
    identity. Client payloads can never supply actor identities.
    """
    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    is_admin_level = user_role_str.lower() in ("admin", "super admin", "platform owner")
    return current_user.team_member_id, current_user.clinic_id, is_admin_level, current_user.id


@router.get("/patients/{patient_id}/chart", response_model=DentalChartResponseDto)
async def get_patient_dental_chart(
    patient_id: UUID,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> DentalChartResponseDto:
    team_member_id, clinic_id, is_admin_level, _ = _chart_identity(current_user)
    try:
        findings, procedures = await chart_service.get_patient_chart(
            patient_id=patient_id,
            current_user_team_member_id=team_member_id,
            clinic_id=clinic_id,
            is_admin=is_admin_level,
        )
        return DentalChartResponseDto(
            patientId=patient_id,
            findings=[_finding_to_dto(f) for f in findings],
            procedures=[_procedure_to_dto(p) for p in procedures],
            conditionCatalog=CONDITION_CATALOG,
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/patients/{patient_id}/chart/history", response_model=ChartHistoryResponseDto)
async def get_patient_dental_chart_history(
    patient_id: UUID,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> ChartHistoryResponseDto:
    team_member_id, clinic_id, is_admin_level, _ = _chart_identity(current_user)
    try:
        findings, procedures = await chart_service.get_chart_history(
            patient_id=patient_id,
            current_user_team_member_id=team_member_id,
            clinic_id=clinic_id,
            is_admin=is_admin_level,
        )
        return ChartHistoryResponseDto(
            patientId=patient_id,
            findings=[_finding_to_dto(f) for f in findings],
            procedures=[_procedure_to_dto(p) for p in procedures],
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/encounters/{id}/chart", response_model=EncounterChartResponseDto)
async def get_encounter_dental_chart(
    id: UUID,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> EncounterChartResponseDto:
    team_member_id, clinic_id, is_admin_level, _ = _chart_identity(current_user)
    try:
        encounter, findings, procedures = await chart_service.get_encounter_chart(
            encounter_id=id,
            current_user_team_member_id=team_member_id,
            clinic_id=clinic_id,
            is_admin=is_admin_level,
        )
        return EncounterChartResponseDto(
            encounterId=encounter.id,
            patientId=encounter.patient_id,
            findings=[_finding_to_dto(f) for f in findings],
            procedures=[_procedure_to_dto(p) for p in procedures],
        )
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/encounters/{id}/chart/findings",
    response_model=DentalChartFindingResponseDto,
    status_code=status.HTTP_201_CREATED,
)
async def record_dental_finding(
    id: UUID,
    req: RecordFindingRequestDto,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> DentalChartFindingResponseDto:
    team_member_id, clinic_id, is_admin_level, user_id = _chart_identity(current_user)
    if not team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )
    try:
        finding = await chart_service.record_finding(
            encounter_id=id,
            author_id=team_member_id,
            clinic_id=clinic_id,
            dto=req,
            user_id=user_id,
            is_admin=is_admin_level,
        )
        return _finding_to_dto(finding)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        if "DUPLICATE_FINDING" in err_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.patch("/chart/findings/{finding_id}", response_model=DentalChartFindingResponseDto)
async def correct_dental_finding(
    finding_id: UUID,
    req: CorrectFindingRequestDto,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> DentalChartFindingResponseDto:
    team_member_id, clinic_id, is_admin_level, user_id = _chart_identity(current_user)
    if not team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )
    try:
        finding = await chart_service.correct_finding(
            finding_id=finding_id,
            actor_id=team_member_id,
            clinic_id=clinic_id,
            dto=req,
            user_id=user_id,
            is_admin=is_admin_level,
        )
        return _finding_to_dto(finding)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        if "DUPLICATE_FINDING" in err_msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.post("/chart/findings/{finding_id}/resolve", response_model=DentalChartFindingResponseDto)
async def resolve_dental_finding(
    finding_id: UUID,
    req: Optional[ResolveFindingRequestDto] = None,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> DentalChartFindingResponseDto:
    team_member_id, clinic_id, is_admin_level, user_id = _chart_identity(current_user)
    if not team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )
    try:
        finding = await chart_service.resolve_finding(
            finding_id=finding_id,
            actor_id=team_member_id,
            clinic_id=clinic_id,
            dto=req,
            user_id=user_id,
            is_admin=is_admin_level,
        )
        return _finding_to_dto(finding)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.post(
    "/encounters/{id}/chart/procedures",
    response_model=DentalProcedureResponseDto,
    status_code=status.HTTP_201_CREATED,
)
async def create_planned_procedure(
    id: UUID,
    req: CreateProcedureRequestDto,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> DentalProcedureResponseDto:
    team_member_id, clinic_id, is_admin_level, user_id = _chart_identity(current_user)
    if not team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )
    try:
        procedure = await chart_service.create_planned_procedure(
            encounter_id=id,
            recorded_by_id=team_member_id,
            clinic_id=clinic_id,
            dto=req,
            user_id=user_id,
            is_admin=is_admin_level,
        )
        return _procedure_to_dto(procedure)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)


@router.patch("/chart/procedures/{procedure_id}/status", response_model=DentalProcedureResponseDto)
async def update_procedure_status(
    procedure_id: UUID,
    req: UpdateProcedureStatusRequestDto,
    current_user: User = Depends(require_doctor),
    chart_service: DentalChartService = Depends(get_dental_chart_service),
) -> DentalProcedureResponseDto:
    team_member_id, clinic_id, is_admin_level, user_id = _chart_identity(current_user)
    if not team_member_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor account is not linked to a clinical staff profile.",
        )
    try:
        procedure = await chart_service.update_procedure_status(
            procedure_id=procedure_id,
            actor_id=team_member_id,
            clinic_id=clinic_id,
            dto=req,
            user_id=user_id,
            is_admin=is_admin_level,
        )
        return _procedure_to_dto(procedure)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
