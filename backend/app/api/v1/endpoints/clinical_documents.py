from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_organization_repository, require_doctor_strictly, require_roles
from app.application.services.clinical_document_service import ClinicalDocumentService
from app.core.database import get_db_session
from app.domain.models.user import User, UserRole
from app.domain.repositories.organization_repo import OrganizationRepository
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository
from app.infrastructure.repositories.postgres_patient_document_repo import PostgresClinicalDocumentRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository

router = APIRouter(prefix="/doctor/documents", tags=["Clinical Documents (Prescriptions & Referrals)"])


class CreatePrescriptionRequest(BaseModel):
    encounterId: UUID
    patientId: UUID
    items: List[Dict[str, Any]] = Field(..., min_length=1)
    notes: Optional[str] = None


class CreateReferralRequest(BaseModel):
    encounterId: UUID
    patientId: UUID
    recipient: str = Field(..., min_length=1, max_length=255)
    reason: str = Field(..., min_length=1)
    summary: str = ""


# --- Prescriptions ---

@router.post(
    "/prescriptions",
    status_code=http_status.HTTP_201_CREATED,
    summary="Create draft prescription (Doctor only, behind CLINICAL_DOCUMENTS_ENABLED)",
    dependencies=[Depends(require_doctor_strictly)],
)
async def create_prescription(
    payload: CreatePrescriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalDocumentService(
        document_repo=doc_repo,
        activity_repo=activity_repo,
    )
    saved = await service.create_prescription(
        encounter_id=payload.encounterId,
        patient_id=payload.patientId,
        doctor_user_id=current_user.id,
        items=payload.items,
        notes=payload.notes,
    )
    return {
        "id": saved.id,
        "encounterId": saved.encounter_id,
        "patientId": saved.patient_id,
        "status": saved.status,
        "items": saved.items,
        "notes": saved.notes,
        "createdAt": saved.created_at,
    }


@router.post(
    "/prescriptions/{prescription_id}/sign",
    summary="Sign and lock prescription (Doctor only)",
    dependencies=[Depends(require_doctor_strictly)],
)
async def sign_prescription(
    prescription_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalDocumentService(
        document_repo=doc_repo,
        activity_repo=activity_repo,
    )
    saved = await service.sign_prescription(
        prescription_id=prescription_id,
        doctor_user_id=current_user.id,
    )
    return {
        "id": saved.id,
        "status": saved.status,
        "signedAt": saved.signed_at,
        "signedByUserId": saved.signed_by_user_id,
    }


@router.get(
    "/prescriptions/{prescription_id}/print",
    summary="Print view for prescription with clinic header, doctor name and licence number",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def get_prescription_print_view(
    prescription_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    org_repo: OrganizationRepository = Depends(get_organization_repository),
) -> Dict[str, Any]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    user_repo = PostgresUserRepository(db)
    team_repo = PostgresTeamMemberRepository(db)
    patient_repo = PostgresPatientRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalDocumentService(
        document_repo=doc_repo,
        user_repo=user_repo,
        team_repo=team_repo,
        patient_repo=patient_repo,
        activity_repo=activity_repo,
        org_repo=org_repo,
    )
    return await service.get_prescription_print_view(
        prescription_id=prescription_id,
        user_id=current_user.id,
    )


@router.get(
    "/prescriptions/encounter/{encounter_id}",
    summary="List prescriptions for an encounter",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def list_encounter_prescriptions(
    encounter_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    service = ClinicalDocumentService(document_repo=doc_repo)
    items = await service.list_encounter_prescriptions(encounter_id)
    return [
        {
            "id": p.id,
            "encounterId": p.encounter_id,
            "patientId": p.patient_id,
            "status": p.status,
            "items": p.items,
            "notes": p.notes,
            "signedAt": p.signed_at,
            "createdAt": p.created_at,
        }
        for p in items
    ]


# --- Referrals ---

@router.post(
    "/referrals",
    status_code=http_status.HTTP_201_CREATED,
    summary="Create draft referral letter",
    dependencies=[Depends(require_doctor_strictly)],
)
async def create_referral(
    payload: CreateReferralRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalDocumentService(
        document_repo=doc_repo,
        activity_repo=activity_repo,
    )
    saved = await service.create_referral(
        encounter_id=payload.encounterId,
        patient_id=payload.patientId,
        doctor_user_id=current_user.id,
        recipient=payload.recipient,
        reason=payload.reason,
        summary=payload.summary,
    )
    return {
        "id": saved.id,
        "encounterId": saved.encounter_id,
        "patientId": saved.patient_id,
        "recipient": saved.recipient,
        "reason": saved.reason,
        "summary": saved.summary,
        "status": saved.status,
        "createdAt": saved.created_at,
    }


@router.post(
    "/referrals/{referral_id}/sign",
    summary="Sign and lock referral letter",
    dependencies=[Depends(require_doctor_strictly)],
)
async def sign_referral(
    referral_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalDocumentService(
        document_repo=doc_repo,
        activity_repo=activity_repo,
    )
    saved = await service.sign_referral(
        referral_id=referral_id,
        doctor_user_id=current_user.id,
    )
    return {
        "id": saved.id,
        "status": saved.status,
        "signedAt": saved.signed_at,
        "signedByUserId": saved.signed_by_user_id,
    }


@router.get(
    "/referrals/{referral_id}/print",
    summary="Print view for referral letter with clinic header, doctor name and licence number",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def get_referral_print_view(
    referral_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    org_repo: OrganizationRepository = Depends(get_organization_repository),
) -> Dict[str, Any]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    user_repo = PostgresUserRepository(db)
    team_repo = PostgresTeamMemberRepository(db)
    patient_repo = PostgresPatientRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalDocumentService(
        document_repo=doc_repo,
        user_repo=user_repo,
        team_repo=team_repo,
        patient_repo=patient_repo,
        activity_repo=activity_repo,
        org_repo=org_repo,
    )
    return await service.get_referral_print_view(
        referral_id=referral_id,
        user_id=current_user.id,
    )


@router.get(
    "/referrals/encounter/{encounter_id}",
    summary="List referrals for an encounter",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def list_encounter_referrals(
    encounter_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    doc_repo = PostgresClinicalDocumentRepository(db)
    service = ClinicalDocumentService(document_repo=doc_repo)
    items = await service.list_encounter_referrals(encounter_id)
    return [
        {
            "id": r.id,
            "encounterId": r.encounter_id,
            "patientId": r.patient_id,
            "recipient": r.recipient,
            "reason": r.reason,
            "summary": r.summary,
            "status": r.status,
            "signedAt": r.signed_at,
            "createdAt": r.created_at,
        }
        for r in items
    ]
