from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    UploadFile,
    status as http_status,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_doctor_strictly, require_roles
from app.application.services.clinical_attachment_service import ClinicalAttachmentService
from app.core.database import get_db_session
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository
from app.infrastructure.repositories.postgres_patient_document_repo import (
    PostgresPatientAttachmentRepository,
    PostgresPatientConsentRepository,
)

router = APIRouter(tags=["Patient Attachments & Consents"])


class VoidDocumentRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class CreateConsentRequest(BaseModel):
    patientId: UUID
    consentType: str = Field(..., min_length=1, max_length=100)
    method: str = Field(..., pattern="^(typed|scanned)$")
    signedName: str = Field(..., min_length=1, max_length=255)
    encounterId: Optional[UUID] = None
    procedureId: Optional[UUID] = None
    attachmentId: Optional[UUID] = None
    consentTextVersion: str = "1.0"


# --- Attachments ---

@router.post(
    "/attachments/upload",
    status_code=http_status.HTTP_201_CREATED,
    summary="Upload patient attachment with magic-byte validation outside public root",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.RECEPTIONIST]))],
)
async def upload_patient_attachment(
    patientId: UUID = Form(...),
    category: str = Form(...),
    encounterId: Optional[UUID] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    content = await file.read()
    attachment_repo = PostgresPatientAttachmentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalAttachmentService(
        attachment_repo=attachment_repo,
        activity_repo=activity_repo,
    )
    saved = await service.upload_attachment(
        patient_id=patientId,
        category=category,
        filename=file.filename or "attachment",
        content=content,
        uploaded_by_user_id=current_user.id,
        user_role=current_user.role,
        encounter_id=encounterId,
    )
    return {
        "id": saved.id,
        "patientId": saved.patient_id,
        "encounterId": saved.encounter_id,
        "category": saved.category,
        "originalFilename": saved.original_filename,
        "contentType": saved.content_type,
        "size": saved.size,
        "uploadedAt": saved.uploaded_at,
    }


@router.get(
    "/attachments/patient/{patient_id}",
    summary="List patient attachments filtered by role permissions",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN]))],
)
async def list_patient_attachments(
    patient_id: UUID,
    category: Optional[str] = Query(None),
    include_voided: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    attachment_repo = PostgresPatientAttachmentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalAttachmentService(
        attachment_repo=attachment_repo,
        activity_repo=activity_repo,
    )
    items = await service.list_patient_attachments(
        patient_id=patient_id,
        user_id=current_user.id,
        user_role=current_user.role,
        category=category,
        include_voided=include_voided,
    )
    return [
        {
            "id": a.id,
            "patientId": a.patient_id,
            "encounterId": a.encounter_id,
            "category": a.category,
            "originalFilename": a.original_filename,
            "contentType": a.content_type,
            "size": a.size,
            "uploadedAt": a.uploaded_at,
            "voided": a.voided,
            "voidReason": a.void_reason,
            "voidedAt": a.voided_at,
        }
        for a in items
    ]


@router.get(
    "/attachments/{attachment_id}/download",
    summary="Authenticated download of patient attachment (audited, checks role)",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN]))],
)
async def download_patient_attachment(
    attachment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    attachment_repo = PostgresPatientAttachmentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalAttachmentService(
        attachment_repo=attachment_repo,
        activity_repo=activity_repo,
    )
    attachment, file_path = await service.get_attachment_file(
        attachment_id=attachment_id,
        user_id=current_user.id,
        user_role=current_user.role,
    )
    return FileResponse(
        path=file_path,
        media_type=attachment.content_type,
        filename=attachment.original_filename,
    )


@router.post(
    "/attachments/{attachment_id}/void",
    summary="Void an attachment with reason (retains file on disk)",
    dependencies=[Depends(require_roles([UserRole.DOCTOR]))],
)
async def void_patient_attachment(
    attachment_id: UUID,
    payload: VoidDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    attachment_repo = PostgresPatientAttachmentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalAttachmentService(
        attachment_repo=attachment_repo,
        activity_repo=activity_repo,
    )
    saved = await service.void_attachment(
        attachment_id=attachment_id,
        void_reason=payload.reason,
        user_id=current_user.id,
    )
    return {
        "id": saved.id,
        "voided": saved.voided,
        "voidReason": saved.void_reason,
        "voidedAt": saved.voided_at,
    }


# --- Consents ---

@router.post(
    "/consents",
    status_code=http_status.HTTP_201_CREATED,
    summary="Record informed consent (typed or scanned)",
    dependencies=[Depends(require_doctor_strictly)],
)
async def record_patient_consent(
    payload: CreateConsentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    attachment_repo = PostgresPatientAttachmentRepository(db)
    consent_repo = PostgresPatientConsentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalAttachmentService(
        attachment_repo=attachment_repo,
        consent_repo=consent_repo,
        activity_repo=activity_repo,
    )
    saved = await service.record_consent(
        patient_id=payload.patientId,
        consent_type=payload.consentType,
        method=payload.method,
        signed_name=payload.signedName,
        obtained_by_user_id=current_user.id,
        encounter_id=payload.encounterId,
        procedure_id=payload.procedureId,
        attachment_id=payload.attachmentId,
        consent_text_version=payload.consentTextVersion,
    )
    return {
        "id": saved.id,
        "patientId": saved.patient_id,
        "encounterId": saved.encounter_id,
        "procedureId": saved.procedure_id,
        "consentType": saved.consent_type,
        "consentTextVersion": saved.consent_text_version,
        "method": saved.method,
        "signedName": saved.signed_name,
        "attachmentId": saved.attachment_id,
        "recordedAt": saved.recorded_at,
        "voided": saved.voided,
    }


@router.get(
    "/consents/patient/{patient_id}",
    summary="List patient consents",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ADMIN]))],
)
async def list_patient_consents(
    patient_id: UUID,
    encounter_id: Optional[UUID] = Query(None),
    include_voided: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    consent_repo = PostgresPatientConsentRepository(db)
    service = ClinicalAttachmentService(attachment_repo=None, consent_repo=consent_repo)
    items = await service.list_consents(
        patient_id=patient_id,
        encounter_id=encounter_id,
        include_voided=include_voided,
    )
    return [
        {
            "id": c.id,
            "patientId": c.patient_id,
            "encounterId": c.encounter_id,
            "procedureId": c.procedure_id,
            "consentType": c.consent_type,
            "consentTextVersion": c.consent_text_version,
            "method": c.method,
            "signedName": c.signed_name,
            "attachmentId": c.attachment_id,
            "recordedAt": c.recorded_at,
            "voided": c.voided,
            "voidReason": c.void_reason,
            "voidedAt": c.voided_at,
        }
        for c in items
    ]


@router.post(
    "/consents/{consent_id}/void",
    summary="Void a consent record with reason",
    dependencies=[Depends(require_roles([UserRole.DOCTOR]))],
)
async def void_patient_consent(
    consent_id: UUID,
    payload: VoidDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    consent_repo = PostgresPatientConsentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalAttachmentService(
        attachment_repo=None,
        consent_repo=consent_repo,
        activity_repo=activity_repo,
    )
    saved = await service.void_consent(
        consent_id=consent_id,
        void_reason=payload.reason,
        user_id=current_user.id,
    )
    return {
        "id": saved.id,
        "voided": saved.voided,
        "voidReason": saved.void_reason,
        "voidedAt": saved.voided_at,
    }
