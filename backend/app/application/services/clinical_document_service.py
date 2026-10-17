from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status as http_status

from app.core.config import settings
from app.domain.models.patient_document import Prescription, ReferralLetter
from app.domain.models.user import UserRole
from app.domain.repositories.organization_repo import OrganizationRepository
from app.domain.repositories.patient_document_repo import ClinicalDocumentRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.domain.repositories.team_repo import TeamMemberRepository
from app.domain.repositories.user_repo import UserRepository
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)

LEGAL_DISCLAIMER_NOTICE = "Template wording must be reviewed by the clinic and legal counsel before use."
# This is a demonstration project. Signed prescription and referral documents are
# demo documents and are watermarked as such so they cannot be mistaken for
# real clinical correspondence.
DEMO_DOCUMENT_WATERMARK = "DEMO DOCUMENT - NOT FOR CLINICAL USE"


class ClinicalDocumentService:
    def __init__(
        self,
        document_repo: ClinicalDocumentRepository,
        user_repo: Optional[UserRepository] = None,
        team_repo: Optional[TeamMemberRepository] = None,
        patient_repo: Optional[PatientRepository] = None,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
        org_repo: Optional[OrganizationRepository] = None,
    ):
        self.document_repo = document_repo
        self.user_repo = user_repo
        self.team_repo = team_repo
        self.patient_repo = patient_repo
        self.activity_repo = activity_repo
        self.org_repo = org_repo

    async def _get_clinic_header(self) -> str:
        """Resolves the printable clinic header from the organization record.

        Falls back to a neutral label only when no organization has been
        configured yet, so a missing database row never renders as a real
        clinic name.
        """
        if self.org_repo:
            org = await self.org_repo.get_current()
            if org:
                return org.display_name or org.name
        return "Clinic not configured"

    def _check_feature_enabled(self):
        if not getattr(settings, "CLINICAL_DOCUMENTS_ENABLED", False):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Clinical documents feature is currently disabled (CLINICAL_DOCUMENTS_ENABLED=false).",
            )

    async def _get_doctor_details(self, doctor_user_id: UUID) -> Dict[str, Any]:
        doctor_name = "Doctor"
        licence_number = "N/A"
        if self.user_repo:
            user = await self.user_repo.get_by_id(doctor_user_id)
            if user:
                doctor_name = user.full_name
                if user.team_member_id and self.team_repo:
                    tm = await self.team_repo.get_by_id(user.team_member_id)
                    if tm and tm.license_number:
                        licence_number = tm.license_number
        return {"doctorName": doctor_name, "licenceNumber": licence_number}

    # --- Prescriptions ---

    async def create_prescription(
        self,
        encounter_id: UUID,
        patient_id: UUID,
        doctor_user_id: UUID,
        items: List[Dict[str, Any]],
        notes: Optional[str] = None,
    ) -> Prescription:
        self._check_feature_enabled()

        if not items:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one medication item is required.",
            )

        for item in items:
            if not item.get("drug"):
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Each prescription item must specify 'drug'.",
                )

        prescription = Prescription(
            encounter_id=encounter_id,
            patient_id=patient_id,
            doctor_id=doctor_user_id,
            items=items,
            notes=notes,
            status="draft",
        )
        saved = await self.document_repo.save_prescription(prescription)

        await record_activity(
            self.activity_repo,
            action="prescription_create_draft",
            entity_type="prescription",
            entity_id=saved.id,
            user_id=doctor_user_id,
            details={"patient_id": str(patient_id), "encounter_id": str(encounter_id)},
        )
        return saved

    async def sign_prescription(
        self,
        prescription_id: UUID,
        doctor_user_id: UUID,
    ) -> Prescription:
        self._check_feature_enabled()

        prescription = await self.document_repo.get_prescription(prescription_id)
        if not prescription:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Prescription not found.",
            )

        if prescription.status == "signed":
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Prescription is already signed and locked.",
            )

        prescription.status = "signed"
        prescription.signed_at = datetime.now(timezone.utc)
        prescription.signed_by_user_id = doctor_user_id

        saved = await self.document_repo.save_prescription(prescription)

        await record_activity(
            self.activity_repo,
            action="prescription_sign",
            entity_type="prescription",
            entity_id=saved.id,
            user_id=doctor_user_id,
            details={"signed_at": saved.signed_at.isoformat()},
        )
        return saved

    async def get_prescription_print_view(
        self,
        prescription_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        self._check_feature_enabled()

        prescription = await self.document_repo.get_prescription(prescription_id)
        if not prescription:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Prescription not found.",
            )

        doctor_info = await self._get_doctor_details(prescription.doctor_id)

        patient_name = "Patient"
        patient_phone = ""
        patient_dob = None
        if self.patient_repo:
            pat = await self.patient_repo.get_by_id(prescription.patient_id)
            if pat:
                patient_name = f"{pat.first_name} {pat.last_name}"
                patient_phone = pat.phone
                patient_dob = pat.date_of_birth

        await record_activity(
            self.activity_repo,
            action="prescription_view_print",
            entity_type="prescription",
            entity_id=prescription.id,
            user_id=user_id,
            details={"prescription_id": str(prescription.id)},
        )

        return {
            "id": prescription.id,
            "encounterId": prescription.encounter_id,
            "patientId": prescription.patient_id,
            "patientName": patient_name,
            "patientPhone": patient_phone,
            "patientDob": str(patient_dob) if patient_dob else None,
            "status": prescription.status,
            "items": prescription.items,
            "notes": prescription.notes,
            "doctorName": doctor_info["doctorName"],
            "licenceNumber": doctor_info["licenceNumber"],
            "signedAt": prescription.signed_at,
            "clinicHeader": await self._get_clinic_header(),
            "watermark": DEMO_DOCUMENT_WATERMARK,
            "legalDisclaimer": LEGAL_DISCLAIMER_NOTICE,
        }

    async def list_encounter_prescriptions(self, encounter_id: UUID) -> List[Prescription]:
        self._check_feature_enabled()
        return await self.document_repo.list_prescriptions_by_encounter(encounter_id)

    # --- Referral Letters ---

    async def create_referral(
        self,
        encounter_id: UUID,
        patient_id: UUID,
        doctor_user_id: UUID,
        recipient: str,
        reason: str,
        summary: str,
    ) -> ReferralLetter:
        self._check_feature_enabled()

        if not recipient or not recipient.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Referral recipient specialist/clinic is required.",
            )
        if not reason or not reason.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Referral reason is required.",
            )

        referral = ReferralLetter(
            encounter_id=encounter_id,
            patient_id=patient_id,
            doctor_id=doctor_user_id,
            recipient=recipient.strip(),
            reason=reason.strip(),
            summary=summary.strip() if summary else "",
            status="draft",
        )
        saved = await self.document_repo.save_referral(referral)

        await record_activity(
            self.activity_repo,
            action="referral_create_draft",
            entity_type="referral_letter",
            entity_id=saved.id,
            user_id=doctor_user_id,
            details={"recipient": saved.recipient, "patient_id": str(patient_id)},
        )
        return saved

    async def sign_referral(
        self,
        referral_id: UUID,
        doctor_user_id: UUID,
    ) -> ReferralLetter:
        self._check_feature_enabled()

        referral = await self.document_repo.get_referral(referral_id)
        if not referral:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Referral letter not found.",
            )

        if referral.status == "signed":
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Referral letter is already signed and locked.",
            )

        referral.status = "signed"
        referral.signed_at = datetime.now(timezone.utc)
        referral.signed_by_user_id = doctor_user_id

        saved = await self.document_repo.save_referral(referral)

        await record_activity(
            self.activity_repo,
            action="referral_sign",
            entity_type="referral_letter",
            entity_id=saved.id,
            user_id=doctor_user_id,
            details={"signed_at": saved.signed_at.isoformat()},
        )
        return saved

    async def get_referral_print_view(
        self,
        referral_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        self._check_feature_enabled()

        referral = await self.document_repo.get_referral(referral_id)
        if not referral:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Referral letter not found.",
            )

        doctor_info = await self._get_doctor_details(referral.doctor_id)

        patient_name = "Patient"
        patient_phone = ""
        patient_dob = None
        if self.patient_repo:
            pat = await self.patient_repo.get_by_id(referral.patient_id)
            if pat:
                patient_name = f"{pat.first_name} {pat.last_name}"
                patient_phone = pat.phone
                patient_dob = pat.date_of_birth

        await record_activity(
            self.activity_repo,
            action="referral_view_print",
            entity_type="referral_letter",
            entity_id=referral.id,
            user_id=user_id,
            details={"referral_id": str(referral.id)},
        )

        return {
            "id": referral.id,
            "encounterId": referral.encounter_id,
            "patientId": referral.patient_id,
            "patientName": patient_name,
            "patientPhone": patient_phone,
            "patientDob": str(patient_dob) if patient_dob else None,
            "status": referral.status,
            "recipient": referral.recipient,
            "reason": referral.reason,
            "summary": referral.summary,
            "doctorName": doctor_info["doctorName"],
            "licenceNumber": doctor_info["licenceNumber"],
            "signedAt": referral.signed_at,
            "clinicHeader": await self._get_clinic_header(),
            "watermark": DEMO_DOCUMENT_WATERMARK,
            "legalDisclaimer": LEGAL_DISCLAIMER_NOTICE,
        }

    async def list_encounter_referrals(self, encounter_id: UUID) -> List[ReferralLetter]:
        self._check_feature_enabled()
        return await self.document_repo.list_referrals_by_encounter(encounter_id)
