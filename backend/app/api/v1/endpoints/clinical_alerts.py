from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import (
    get_medical_alert_service,
    require_doctor,
    require_doctor_strictly,
)
from app.application.dtos.medical_alert_dto import (
    CreateMedicalAlertRequest,
    MedicalAlertDto,
    MedicalAlertsSummaryResponse,
    UpdateMedicalHistoryStatusRequest,
)
from app.application.services.medical_alert_service import MedicalAlertService
from app.domain.models.user import User

router = APIRouter(prefix="/clinical", tags=["Clinical Medical Alerts"])


@router.get(
    "/patients/{patient_id}/alerts",
    response_model=MedicalAlertsSummaryResponse,
)
async def get_patient_alerts(
    patient_id: UUID,
    current_user: User = Depends(require_doctor),
    service: MedicalAlertService = Depends(get_medical_alert_service),
) -> MedicalAlertsSummaryResponse:
    """
    Retrieves full clinical allergy and medical alerts summary for a patient.
    Restricted to clinicians and authorized clinic administrators (audited read).
    Receptionists are strictly forbidden from viewing alert details.
    """
    summary = await service.get_patient_alerts_summary(patient_id, current_user)
    return MedicalAlertsSummaryResponse(
        patientId=UUID(summary["patientId"]),
        medicalHistoryStatus=summary["medicalHistoryStatus"],
        confirmedAlerts=[
            MedicalAlertDto(
                id=a.id,
                patientId=a.patient_id,
                type=a.type,
                description=a.description,
                severity=a.severity,
                recordedByUserId=a.recorded_by_user_id,
                recordedAt=a.recorded_at,
                lastReviewedAt=a.last_reviewed_at,
                isActive=a.is_active,
                isConfirmed=a.is_confirmed,
                createdAt=a.created_at,
                updatedAt=a.updated_at,
            )
            for a in summary["confirmedAlerts"]
        ],
        pendingAlerts=[
            MedicalAlertDto(
                id=a.id,
                patientId=a.patient_id,
                type=a.type,
                description=a.description,
                severity=a.severity,
                recordedByUserId=a.recorded_by_user_id,
                recordedAt=a.recorded_at,
                lastReviewedAt=a.last_reviewed_at,
                isActive=a.is_active,
                isConfirmed=a.is_confirmed,
                createdAt=a.created_at,
                updatedAt=a.updated_at,
            )
            for a in summary["pendingAlerts"]
        ],
        lastReviewedAt=summary["lastReviewedAt"],
    )


@router.post(
    "/patients/{patient_id}/alerts",
    response_model=MedicalAlertDto,
    status_code=status.HTTP_201_CREATED,
)
async def record_clinical_alert(
    patient_id: UUID,
    req: CreateMedicalAlertRequest,
    current_user: User = Depends(require_doctor_strictly),
    service: MedicalAlertService = Depends(get_medical_alert_service),
) -> MedicalAlertDto:
    """
    Doctor-only write endpoint to record a confirmed medical alert (allergy, condition, medication).
    Audited in activity_logs.
    """
    saved = await service.create_doctor_alert(
        patient_id=patient_id,
        alert_type=req.type,
        description=req.description,
        severity=req.severity,
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


@router.post(
    "/alerts/{alert_id}/confirm",
    response_model=MedicalAlertDto,
)
async def confirm_medical_alert(
    alert_id: UUID,
    current_user: User = Depends(require_doctor_strictly),
    service: MedicalAlertService = Depends(get_medical_alert_service),
) -> MedicalAlertDto:
    """
    Promotes a reception-reported pending alert to a confirmed clinical alert.
    Doctor-only action; writes audit log.
    """
    confirmed = await service.confirm_alert(alert_id, current_user)
    return MedicalAlertDto(
        id=confirmed.id,
        patientId=confirmed.patient_id,
        type=confirmed.type,
        description=confirmed.description,
        severity=confirmed.severity,
        recordedByUserId=confirmed.recorded_by_user_id,
        recordedAt=confirmed.recorded_at,
        lastReviewedAt=confirmed.last_reviewed_at,
        isActive=confirmed.is_active,
        isConfirmed=confirmed.is_confirmed,
        createdAt=confirmed.created_at,
        updatedAt=confirmed.updated_at,
    )


@router.post(
    "/alerts/{alert_id}/dismiss",
    response_model=MedicalAlertDto,
)
async def dismiss_medical_alert(
    alert_id: UUID,
    current_user: User = Depends(require_doctor_strictly),
    service: MedicalAlertService = Depends(get_medical_alert_service),
) -> MedicalAlertDto:
    """
    Dismisses or resolves an alert. Doctor-only action; writes audit log.
    """
    dismissed = await service.dismiss_or_resolve_alert(alert_id, current_user)
    return MedicalAlertDto(
        id=dismissed.id,
        patientId=dismissed.patient_id,
        type=dismissed.type,
        description=dismissed.description,
        severity=dismissed.severity,
        recordedByUserId=dismissed.recorded_by_user_id,
        recordedAt=dismissed.recorded_at,
        lastReviewedAt=dismissed.last_reviewed_at,
        isActive=dismissed.is_active,
        isConfirmed=dismissed.is_confirmed,
        createdAt=dismissed.created_at,
        updatedAt=dismissed.updated_at,
    )


@router.post(
    "/patients/{patient_id}/alerts/review",
)
async def review_alerts_at_visit(
    patient_id: UUID,
    current_user: User = Depends(require_doctor_strictly),
    service: MedicalAlertService = Depends(get_medical_alert_service),
) -> dict:
    """
    Records a clinical review of all active medical alerts at this visit.
    Doctor-only action; writes audit log and updates last_reviewed_at.
    """
    reviewed_at = await service.review_alerts_at_visit(patient_id, current_user)
    return {
        "patientId": str(patient_id),
        "lastReviewedAt": reviewed_at.isoformat(),
        "status": "reviewed",
    }


@router.patch(
    "/patients/{patient_id}/medical-history-status",
)
async def update_patient_medical_history_status(
    patient_id: UUID,
    req: UpdateMedicalHistoryStatusRequest,
    current_user: User = Depends(require_doctor_strictly),
    service: MedicalAlertService = Depends(get_medical_alert_service),
) -> dict:
    """
    Updates the overall medical history status for a patient (not_asked, none_known, recorded).
    Doctor-only action; writes audit log.
    """
    patient = await service.update_medical_history_status(patient_id, req.status, current_user)
    return {
        "patientId": str(patient.id),
        "medicalHistoryStatus": patient.medical_history_status,
    }
