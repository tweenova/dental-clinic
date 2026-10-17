import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, UploadFile, status as http_status

from app.core.config import settings
from app.domain.models.patient_document import PatientAttachment, PatientConsent
from app.domain.models.user import UserRole
from app.domain.repositories.patient_document_repo import (
    PatientAttachmentRepository,
    PatientConsentRepository,
)
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)

# Magic bytes detection
MAGIC_BYTES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "application/pdf": [b"%PDF-"],
}

ALLOWED_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}

VALID_CATEGORIES = {"xray", "photo", "consent", "referral", "other"}
RECEPTION_ALLOWED_CATEGORIES = {"consent", "other"}


class ClinicalAttachmentService:
    def __init__(
        self,
        attachment_repo: PatientAttachmentRepository,
        consent_repo: Optional[PatientConsentRepository] = None,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
    ):
        self.attachment_repo = attachment_repo
        self.consent_repo = consent_repo
        self.activity_repo = activity_repo

    @staticmethod
    def _detect_content_type(file_bytes: bytes) -> Optional[str]:
        for mime, sigs in MAGIC_BYTES.items():
            for sig in sigs:
                if file_bytes.startswith(sig):
                    return mime
        return None

    @staticmethod
    def _ensure_storage_dir() -> str:
        d = settings.ATTACHMENT_DIR
        os.makedirs(d, exist_ok=True)
        return d

    async def upload_attachment(
        self,
        patient_id: UUID,
        category: str,
        filename: str,
        content: bytes,
        uploaded_by_user_id: UUID,
        user_role: str,
        encounter_id: Optional[UUID] = None,
    ) -> PatientAttachment:
        normalized_cat = category.strip().lower()
        if normalized_cat not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid category '{category}'. Allowed: {sorted(list(VALID_CATEGORIES))}",
            )

        # Reception permission check: consent and other ONLY
        if user_role == UserRole.RECEPTIONIST and normalized_cat not in RECEPTION_ALLOWED_CATEGORIES:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Reception staff may only upload attachments in 'consent' and 'other' categories.",
            )

        # Validate file size
        max_bytes = settings.ATTACHMENT_MAX_SIZE_BYTES
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=http_status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Attachment size exceeds maximum allowed size ({max_bytes // (1024 * 1024)} MB).",
            )

        # Validate content type by content (magic bytes)
        detected_mime = self._detect_content_type(content)
        if not detected_mime:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="File content does not match permitted formats (JPG, PNG, PDF).",
            )

        # Store in private folder outside web root
        storage_dir = self._ensure_storage_dir()
        ext = ALLOWED_EXTENSIONS[detected_mime]
        stored_name = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.join(storage_dir, stored_name)

        with open(target_path, "wb") as f:
            f.write(content)

        attachment = PatientAttachment(
            patient_id=patient_id,
            encounter_id=encounter_id,
            category=normalized_cat,
            original_filename=os.path.basename(filename) or "attachment",
            content_type=detected_mime,
            size=len(content),
            stored_name=stored_name,
            uploaded_by=uploaded_by_user_id,
            voided=False,
        )
        saved = await self.attachment_repo.save(attachment)

        await record_activity(
            self.activity_repo,
            action="attachment_upload",
            entity_type="patient_attachment",
            entity_id=saved.id,
            user_id=uploaded_by_user_id,
            details={
                "patient_id": str(patient_id),
                "category": saved.category,
                "filename": saved.original_filename,
                "size": saved.size,
                "content_type": saved.content_type,
            },
        )
        return saved

    async def get_attachment_file(
        self,
        attachment_id: UUID,
        user_id: UUID,
        user_role: str,
    ) -> Tuple[PatientAttachment, str]:
        attachment = await self.attachment_repo.get_by_id(attachment_id)
        if not attachment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Attachment not found.",
            )

        # Reception access control: consent and other ONLY
        if user_role == UserRole.RECEPTIONIST and attachment.category not in RECEPTION_ALLOWED_CATEGORIES:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Reception staff may only access attachments in 'consent' and 'other' categories.",
            )

        file_path = os.path.join(settings.ATTACHMENT_DIR, attachment.stored_name)
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Attachment storage file not found.",
            )

        # Audited read (clinical read / admin read)
        await record_activity(
            self.activity_repo,
            action="attachment_view",
            entity_type="patient_attachment",
            entity_id=attachment.id,
            user_id=user_id,
            details={
                "patient_id": str(attachment.patient_id),
                "category": attachment.category,
                "filename": attachment.original_filename,
                "voided": attachment.voided,
            },
        )

        return attachment, file_path

    async def list_patient_attachments(
        self,
        patient_id: UUID,
        user_id: UUID,
        user_role: str,
        category: Optional[str] = None,
        include_voided: bool = False,
    ) -> List[PatientAttachment]:
        # Reception cannot filter for or view forbidden categories
        if user_role == UserRole.RECEPTIONIST:
            if category and category not in RECEPTION_ALLOWED_CATEGORIES:
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail="Reception staff may only view 'consent' and 'other' categories.",
                )

        attachments = await self.attachment_repo.list_by_patient(
            patient_id=patient_id, category=category, include_voided=include_voided
        )

        if user_role == UserRole.RECEPTIONIST:
            attachments = [a for a in attachments if a.category in RECEPTION_ALLOWED_CATEGORIES]

        # Audit read for admin
        if user_role == UserRole.ADMIN:
            await record_activity(
                self.activity_repo,
                action="admin_attachments_list",
                entity_type="patient",
                entity_id=patient_id,
                user_id=user_id,
                details={"count": len(attachments)},
            )

        return attachments

    async def void_attachment(
        self,
        attachment_id: UUID,
        void_reason: str,
        user_id: UUID,
    ) -> PatientAttachment:
        if not void_reason or not void_reason.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Reason is required to void an attachment.",
            )

        attachment = await self.attachment_repo.get_by_id(attachment_id)
        if not attachment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Attachment not found.",
            )

        # Strict rule: Voiding keeps the file on disk and records why; NO hard delete!
        attachment.voided = True
        attachment.void_reason = void_reason.strip()
        attachment.voided_at = datetime.now(timezone.utc)
        attachment.voided_by = user_id

        saved = await self.attachment_repo.save(attachment)

        await record_activity(
            self.activity_repo,
            action="attachment_void",
            entity_type="patient_attachment",
            entity_id=saved.id,
            user_id=user_id,
            details={
                "reason": saved.void_reason,
                "patient_id": str(saved.patient_id),
                "filename": saved.original_filename,
            },
        )
        return saved

    # --- Consents (B4) ---

    async def record_consent(
        self,
        patient_id: UUID,
        consent_type: str,
        method: str,
        signed_name: str,
        obtained_by_user_id: UUID,
        encounter_id: Optional[UUID] = None,
        procedure_id: Optional[UUID] = None,
        attachment_id: Optional[UUID] = None,
        consent_text_version: str = "1.0",
    ) -> PatientConsent:
        if not self.consent_repo:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Consent repository is not configured.",
            )

        if method not in ("typed", "scanned"):
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Consent method must be 'typed' or 'scanned'.",
            )

        if not signed_name or not signed_name.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Signed name is required for consent record.",
            )

        if method == "scanned" and not attachment_id:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Scanned consent requires an uploaded attachment ID.",
            )

        consent = PatientConsent(
            patient_id=patient_id,
            encounter_id=encounter_id,
            procedure_id=procedure_id,
            consent_type=consent_type.strip(),
            consent_text_version=consent_text_version.strip() if consent_text_version else "1.0",
            method=method,
            signed_name=signed_name.strip(),
            attachment_id=attachment_id,
            obtained_by=obtained_by_user_id,
            voided=False,
        )
        saved = await self.consent_repo.save(consent)

        await record_activity(
            self.activity_repo,
            action="consent_record",
            entity_type="patient_consent",
            entity_id=saved.id,
            user_id=obtained_by_user_id,
            details={
                "patient_id": str(patient_id),
                "consent_type": saved.consent_type,
                "method": saved.method,
                "signed_name": saved.signed_name,
            },
        )
        return saved

    async def void_consent(
        self,
        consent_id: UUID,
        void_reason: str,
        user_id: UUID,
    ) -> PatientConsent:
        if not self.consent_repo:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Consent repository is not configured.",
            )

        if not void_reason or not void_reason.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Reason is required to void a consent record.",
            )

        consent = await self.consent_repo.get_by_id(consent_id)
        if not consent:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Consent record not found.",
            )

        consent.voided = True
        consent.void_reason = void_reason.strip()
        consent.voided_at = datetime.now(timezone.utc)
        consent.voided_by = user_id

        saved = await self.consent_repo.save(consent)

        await record_activity(
            self.activity_repo,
            action="consent_void",
            entity_type="patient_consent",
            entity_id=saved.id,
            user_id=user_id,
            details={"reason": saved.void_reason, "patient_id": str(saved.patient_id)},
        )
        return saved

    async def list_consents(
        self,
        patient_id: UUID,
        encounter_id: Optional[UUID] = None,
        include_voided: bool = False,
    ) -> List[PatientConsent]:
        if not self.consent_repo:
            return []
        return await self.consent_repo.list_by_patient(
            patient_id=patient_id, encounter_id=encounter_id, include_voided=include_voided
        )
