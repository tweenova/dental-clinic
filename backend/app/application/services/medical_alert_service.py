from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status as http_status

from app.domain.models.booking_crm import Patient, PatientMedicalAlert
from app.domain.models.user import User, UserRole
from app.domain.repositories.medical_alert_repo import MedicalAlertRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository


class MedicalAlertService:
    VALID_ALERT_TYPES = {"allergy", "condition", "medication", "other"}
    VALID_STATUSES = {"not_asked", "none_known", "recorded"}

    def __init__(
        self,
        alert_repo: MedicalAlertRepository,
        patient_repo: PatientRepository,
        activity_repo: PostgresActivityLogRepository,
    ):
        self.alert_repo = alert_repo
        self.patient_repo = patient_repo
        self.activity_repo = activity_repo

    def _require_doctor_or_admin(self, current_user: User) -> None:
        if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Clinical access forbidden: only doctors and authorized clinic admins may read medical alert details.",
            )

    def _require_doctor_write(self, current_user: User) -> None:
        if current_user.role != UserRole.DOCTOR:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Clinical safety policy: only authenticated practitioners may record or modify confirmed medical alerts.",
            )

    async def get_patient_alerts_summary(
        self, patient_id: UUID, current_user: User
    ) -> Dict[str, Any]:
        self._require_doctor_or_admin(current_user)

        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )

        alerts = await self.alert_repo.get_alerts_for_patient(patient_id, active_only=True)

        # Audit clinical read
        await self.activity_repo.log_activity(
            action="read_medical_alerts",
            entity_type="patient_medical_alerts",
            entity_id=str(patient_id),
            user_id=current_user.id,
        )

        confirmed = [a for a in alerts if a.is_confirmed]
        pending = [a for a in alerts if not a.is_confirmed]

        # Determine last reviewed timestamp
        last_reviewed = None
        for a in alerts:
            if a.last_reviewed_at:
                if last_reviewed is None or a.last_reviewed_at > last_reviewed:
                    last_reviewed = a.last_reviewed_at

        return {
            "patientId": str(patient.id),
            "medicalHistoryStatus": patient.medical_history_status,
            "confirmedAlerts": confirmed,
            "pendingAlerts": pending,
            "lastReviewedAt": last_reviewed,
        }

    async def create_doctor_alert(
        self,
        patient_id: UUID,
        alert_type: str,
        description: str,
        severity: Optional[str],
        current_user: User,
    ) -> PatientMedicalAlert:
        self._require_doctor_write(current_user)

        if alert_type not in self.VALID_ALERT_TYPES:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid alert type '{alert_type}'. Allowed types: {sorted(list(self.VALID_ALERT_TYPES))}",
            )

        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )

        alert = PatientMedicalAlert(
            patient_id=patient_id,
            type=alert_type,
            description=description.strip(),
            severity=severity.strip() if severity else None,
            recorded_by_user_id=current_user.id,
            is_active=True,
            is_confirmed=True,
        )
        saved = await self.alert_repo.save(alert)

        if patient.medical_history_status in ("not_asked", "none_known"):
            patient.medical_history_status = "recorded"
            await self.patient_repo.save(patient)

        await self.activity_repo.log_activity(
            action="create_medical_alert",
            entity_type="patient_medical_alert",
            entity_id=str(saved.id),
            user_id=current_user.id,
            details={"type": alert_type, "severity": severity, "patient_id": str(patient_id)},
        )
        return saved

    async def create_reception_pending_alert(
        self,
        patient_id: UUID,
        alert_type: str,
        description: str,
        current_user: User,
    ) -> PatientMedicalAlert:
        # Reception capture policy: creates pending (unconfirmed) alert
        if alert_type not in self.VALID_ALERT_TYPES:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid alert type '{alert_type}'. Allowed types: {sorted(list(self.VALID_ALERT_TYPES))}",
            )

        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )

        alert = PatientMedicalAlert(
            patient_id=patient_id,
            type=alert_type,
            description=description.strip(),
            recorded_by_user_id=current_user.id,
            is_active=True,
            is_confirmed=False,
        )
        saved = await self.alert_repo.save(alert)

        await self.activity_repo.log_activity(
            action="reception_capture_pending_alert",
            entity_type="patient_medical_alert",
            entity_id=str(saved.id),
            user_id=current_user.id,
            details={"type": alert_type, "patient_id": str(patient_id)},
        )
        return saved

    async def confirm_alert(
        self, alert_id: UUID, current_user: User
    ) -> PatientMedicalAlert:
        self._require_doctor_write(current_user)

        alert = await self.alert_repo.get_by_id(alert_id)
        if not alert:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Medical alert not found."
            )

        alert.is_confirmed = True
        saved = await self.alert_repo.save(alert)

        patient = await self.patient_repo.get_by_id(alert.patient_id)
        if patient and patient.medical_history_status in ("not_asked", "none_known"):
            patient.medical_history_status = "recorded"
            await self.patient_repo.save(patient)

        await self.activity_repo.log_activity(
            action="confirm_medical_alert",
            entity_type="patient_medical_alert",
            entity_id=str(saved.id),
            user_id=current_user.id,
            details={"patient_id": str(alert.patient_id)},
        )
        return saved

    async def dismiss_or_resolve_alert(
        self, alert_id: UUID, current_user: User
    ) -> PatientMedicalAlert:
        self._require_doctor_write(current_user)

        alert = await self.alert_repo.get_by_id(alert_id)
        if not alert:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Medical alert not found."
            )

        action = "dismiss_medical_alert" if not alert.is_confirmed else "resolve_medical_alert"
        alert.is_active = False
        saved = await self.alert_repo.save(alert)

        await self.activity_repo.log_activity(
            action=action,
            entity_type="patient_medical_alert",
            entity_id=str(saved.id),
            user_id=current_user.id,
            details={"patient_id": str(alert.patient_id)},
        )
        return saved

    async def review_alerts_at_visit(
        self, patient_id: UUID, current_user: User
    ) -> datetime:
        self._require_doctor_write(current_user)

        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )

        now_utc = datetime.now(timezone.utc)
        await self.alert_repo.review_all_for_patient(patient_id, now_utc)

        await self.activity_repo.log_activity(
            action="review_medical_alerts",
            entity_type="patient_medical_alerts",
            entity_id=str(patient_id),
            user_id=current_user.id,
        )
        return now_utc

    async def update_medical_history_status(
        self, patient_id: UUID, new_status: str, current_user: User
    ) -> Patient:
        self._require_doctor_write(current_user)

        if new_status not in self.VALID_STATUSES:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid medical history status '{new_status}'. Allowed: {sorted(list(self.VALID_STATUSES))}",
            )

        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )

        patient.medical_history_status = new_status
        saved = await self.patient_repo.save(patient)

        await self.activity_repo.log_activity(
            action="update_medical_history_status",
            entity_type="patient",
            entity_id=str(patient.id),
            user_id=current_user.id,
            details={"status": new_status},
        )
        return saved

    async def check_alerts_on_file(self, patient_id: UUID) -> bool:
        alerts = await self.alert_repo.get_alerts_for_patient(patient_id, active_only=True)
        return any(a.is_confirmed for a in alerts)
