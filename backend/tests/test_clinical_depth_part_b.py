from datetime import date, datetime, timezone
import io
import os
from typing import Any, Dict
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.domain.models.clinical_note import ClinicalNote
from app.domain.models.encounter import ClinicalEncounter
from app.domain.models.organization import Location, Organization
from app.domain.models.patient_document import PatientAttachment, PatientConsent
from app.domain.models.team_member import TeamMember
from app.domain.models.treatment_plan import TreatmentPlanItem
from app.domain.models.user import User, UserRole
from app.infrastructure.database.orm_models import DentalProcedureORM, PatientORM
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository
from app.infrastructure.repositories.postgres_clinical_note_repo import PostgresClinicalNoteRepository
from app.infrastructure.repositories.postgres_patient_document_repo import (
    PostgresClinicalDocumentRepository,
    PostgresPatientAttachmentRepository,
    PostgresPatientConsentRepository,
)
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_treatment_plan_repo import PostgresTreatmentPlanRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository


async def _create_test_patient(session: AsyncSession) -> PatientORM:
    patient = PatientORM(
        id=uuid4(),
        first_name="Arthur",
        last_name="Dent",
        phone="+923001234567",
        email="arthur.dent@example.com",
        preferred_channel="sms",
        file_number=f"MD-{uuid4().hex[:6].upper()}",
    )
    session.add(patient)
    await session.commit()
    await session.refresh(patient)
    return patient


async def _login_user(client_with_db: AsyncClient, session: AsyncSession, role: UserRole, email_prefix: str) -> Dict[str, Any]:
    from app.domain.models.team_member import TeamMember
    from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository

    team_member = None
    if role in (UserRole.DOCTOR, UserRole.ADMIN):
        team_repo = PostgresTeamMemberRepository(session)
        tm = TeamMember(
            organization_id=uuid4(),
            first_name="Test",
            last_name="Doctor" if role == UserRole.DOCTOR else "Admin",
            display_name=f"Dr. {email_prefix}" if role == UserRole.DOCTOR else f"Admin {email_prefix}",
            role="Doctor" if role == UserRole.DOCTOR else "Admin",
            professional_title="Dental Surgeon" if role == UserRole.DOCTOR else "Practice Manager",
            is_active=True,
        )
        team_member = await team_repo.save(tm)

    user_repo = PostgresUserRepository(session)
    user = User(
        email=f"{email_prefix}_{uuid4().hex[:6]}@marlowdental.com",
        hashed_password=hash_password("Pass1234!"),
        full_name=f"Test {role.value.capitalize()}",
        role=role,
        team_member_id=team_member.id if team_member else None,
        is_active=True,
    )
    await user_repo.save(user)
    await session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "Pass1234!"},
    )
    assert resp.status_code == 200, f"Login failed for {role}: {resp.text}"
    token = resp.json()["accessToken"]
    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "user": user,
        "team_member": team_member,
    }


async def _create_test_encounter(session: AsyncSession, patient_id: UUID, doctor_auth: Dict[str, Any]) -> ClinicalEncounter:
    from app.domain.models.encounter import ClinicalEncounter
    from app.infrastructure.repositories.postgres_encounter_repo import PostgresEncounterRepository
    enc_repo = PostgresEncounterRepository(session)
    clinician_id = doctor_auth["team_member"].id if doctor_auth.get("team_member") else doctor_auth["user"].team_member_id
    enc = ClinicalEncounter(
        patient_id=patient_id,
        clinician_id=clinician_id,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    )
    saved = await enc_repo.save(enc)
    await session.commit()
    return saved


# =========================================================================
# B1: Doctor Tasks Isolation & Workflow
# =========================================================================

@pytest.mark.asyncio
async def test_doctor_tasks_creation_listing_and_done(test_session: AsyncSession, client_with_db: AsyncClient):
    doctor_auth = await _login_user(client_with_db, test_session, UserRole.DOCTOR, "doc_tasks")
    reception_auth = await _login_user(client_with_db, test_session, UserRole.RECEPTIONIST, "rec_tasks")
    patient = await _create_test_patient(test_session)

    # 1. Doctor creates a patient-linked task for reception
    create_payload = {
        "title": "Call patient regarding post-op bleeding",
        "patientId": str(patient.id),
        "description": "Patient reported minor oozing after tooth 14 extraction.",
        "priority": "high",
    }
    create_res = await client_with_db.post(
        "/api/v1/doctor/tasks",
        json=create_payload,
        headers=doctor_auth["headers"],
    )
    assert create_res.status_code == 201
    task_data = create_res.json()
    task_id = task_data["id"]
    assert task_data["title"] == create_payload["title"]
    assert task_data["patientId"] == str(patient.id)
    assert task_data["status"] == "pending"

    # 2. Doctor lists tasks -> task appears because createdByMe
    list_res = await client_with_db.get(
        "/api/v1/doctor/tasks",
        headers=doctor_auth["headers"],
    )
    assert list_res.status_code == 200
    tasks = list_res.json()["items"]
    found = next((t for t in tasks if t["id"] == task_id), None)
    assert found is not None
    assert found["patientName"] == f"{patient.first_name} {patient.last_name}"
    assert found["isCreatedByMe"] is True

    # 3. Doctor marks task done
    done_res = await client_with_db.post(
        f"/api/v1/doctor/tasks/{task_id}/done",
        headers=doctor_auth["headers"],
    )
    assert done_res.status_code == 200
    assert done_res.json()["status"] == "done"

    # 4. Strict Role Isolation Check:
    # Doctor CANNOT access reception queue endpoints
    rec_ep_res = await client_with_db.get(
        "/api/v1/reception/dashboard",
        headers=doctor_auth["headers"],
    )
    assert rec_ep_res.status_code == 403, "Doctor must not gain access to reception endpoints"

    # Reception CANNOT access doctor tasks endpoint
    doc_ep_res = await client_with_db.get(
        "/api/v1/doctor/tasks",
        headers=reception_auth["headers"],
    )
    assert doc_ep_res.status_code == 403, "Receptionist must not access doctor tasks endpoint"


# =========================================================================
# B2: Treatment Plan View & Procedure Completion
# =========================================================================

@pytest.mark.asyncio
async def test_treatment_plan_tooth_grouping_and_procedure_completion(test_session: AsyncSession, client_with_db: AsyncClient):
    doctor_auth = await _login_user(client_with_db, test_session, UserRole.DOCTOR, "doc_plan")
    patient = await _create_test_patient(test_session)

    # 1. Add proposed items for teeth 14 and 19 and general
    item1_res = await client_with_db.post(
        "/api/v1/doctor/treatment-plans",
        json={
            "patientId": str(patient.id),
            "toothNumber": 14,
            "procedureName": "MO Composite Restoration",
            "estimatedCostCents": 12000,
        },
        headers=doctor_auth["headers"],
    )
    assert item1_res.status_code == 201
    item1_id = item1_res.json()["id"]

    item2_res = await client_with_db.post(
        "/api/v1/doctor/treatment-plans",
        json={
            "patientId": str(patient.id),
            "toothNumber": 19,
            "procedureName": "Root Canal Treatment - Molar",
            "estimatedCostCents": 35000,
        },
        headers=doctor_auth["headers"],
    )
    assert item2_res.status_code == 201
    item2_id = item2_res.json()["id"]

    # 2. Get patient plan -> verify grouped by tooth and price calculations
    get_plan_res = await client_with_db.get(
        f"/api/v1/doctor/treatment-plans/patient/{patient.id}",
        headers=doctor_auth["headers"],
    )
    assert get_plan_res.status_code == 200
    plan_data = get_plan_res.json()
    assert plan_data["totalItems"] == 2
    assert "Tooth 14" in plan_data["groupedByTooth"]
    assert "Tooth 19" in plan_data["groupedByTooth"]
    assert plan_data["totalEstimatedCents"] == 47000

    # 3. Patient accepts item 14
    accept_res = await client_with_db.patch(
        f"/api/v1/doctor/treatment-plans/{item1_id}/status",
        json={"status": "accepted", "decisionDate": date.today().isoformat()},
        headers=doctor_auth["headers"],
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "accepted"

    # 4. Strict Requirement: "Completing an item happens only through a procedure record."
    # Attempting to set status="completed" WITHOUT a completedProcedureId MUST FAIL (422)
    fail_complete = await client_with_db.patch(
        f"/api/v1/doctor/treatment-plans/{item1_id}/status",
        json={"status": "completed"},
        headers=doctor_auth["headers"],
    )
    assert fail_complete.status_code == 422
    assert "procedure record" in fail_complete.json()["detail"].lower()

    # Create a real completed procedure record in DB
    from app.domain.models.service import Service
    from app.infrastructure.repositories.postgres_service_repo import PostgresServiceRepository
    from app.domain.models.encounter import ClinicalEncounter
    from app.infrastructure.repositories.postgres_encounter_repo import PostgresEncounterRepository

    enc_repo = PostgresEncounterRepository(test_session)
    enc = await enc_repo.save(ClinicalEncounter(
        patient_id=patient.id,
        clinician_id=doctor_auth["team_member"].id,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    ))

    svc_repo = PostgresServiceRepository(test_session)
    svc = await svc_repo.save(Service(
        slug=f"comp-fill-{uuid4().hex[:4]}",
        category="Restorative",
        title="Composite Restoration",
        short_desc="Tooth restoration",
        duration="30m",
        cash_price="120.00",
    ))
    await test_session.commit()

    proc_id = uuid4()
    proc_orm = DentalProcedureORM(
        id=proc_id,
        patient_id=patient.id,
        encounter_id=enc.id,
        recorded_by_id=doctor_auth["team_member"].id,
        service_id=svc.id,
        tooth="14",
        surfaces="MO",
        status="completed",
        completed_at=datetime.now(timezone.utc),
    )
    test_session.add(proc_orm)
    await test_session.commit()

    # Now completing with completedProcedureId succeeds
    success_complete = await client_with_db.patch(
        f"/api/v1/doctor/treatment-plans/{item1_id}/status",
        json={"status": "completed", "completedProcedureId": str(proc_id)},
        headers=doctor_auth["headers"],
    )
    assert success_complete.status_code == 200
    assert success_complete.json()["status"] == "completed"
    assert success_complete.json()["completedProcedureId"] == str(proc_id)


# =========================================================================
# B3: Note Templates Seeding, Admin Management & Draft Application
# =========================================================================

@pytest.mark.asyncio
async def test_clinical_note_templates_and_signed_immutability(test_session: AsyncSession, client_with_db: AsyncClient):
    admin_auth = await _login_user(client_with_db, test_session, UserRole.ADMIN, "adm_tmpl")
    doctor_auth = await _login_user(client_with_db, test_session, UserRole.DOCTOR, "doc_tmpl")
    patient = await _create_test_patient(test_session)
    encounter = await _create_test_encounter(test_session, patient.id, doctor_auth)

    # 1. Verify default templates seeded (check-up, filling, extraction, root canal visit)
    list_tmpl_res = await client_with_db.get(
        "/api/v1/clinical-note-templates",
        headers=doctor_auth["headers"],
    )
    assert list_tmpl_res.status_code == 200
    templates = list_tmpl_res.json()
    names = [t["name"] for t in templates]
    for required_name in ["check-up", "filling", "extraction", "root canal visit"]:
        assert required_name in names, f"Expected template '{required_name}' to be seeded"

    filling_tmpl = next(t for t in templates if t["name"] == "filling")

    # 2. Create a draft clinical note for encounter
    note_repo = PostgresClinicalNoteRepository(test_session)
    draft_note = ClinicalNote(
        encounter_id=encounter.id,
        patient_id=patient.id,
        author_id=doctor_auth["team_member"].id,
        subjective="",
        objective="",
        assessment="",
        plan="",
        is_signed=False,
    )
    saved_draft = await note_repo.save(draft_note)
    await test_session.commit()

    # 3. Apply template to empty draft note -> succeeds
    apply_res = await client_with_db.post(
        f"/api/v1/doctor/clinical-notes/{saved_draft.id}/apply-template",
        json={"templateId": filling_tmpl["id"], "overwriteConfirmed": False},
        headers=doctor_auth["headers"],
    )
    assert apply_res.status_code == 200
    res_body = apply_res.json()
    assert "Presenting Tooth" in res_body["subjective"]

    # 4. Applying again to non-empty draft WITHOUT overwrite confirmation -> 409 Conflict
    reapply_fail = await client_with_db.post(
        f"/api/v1/doctor/clinical-notes/{saved_draft.id}/apply-template",
        json={"templateId": filling_tmpl["id"], "overwriteConfirmed": False},
        headers=doctor_auth["headers"],
    )
    assert reapply_fail.status_code == 409
    assert "overwrite confirmation" in reapply_fail.json()["detail"].lower()

    # With overwriteConfirmed=True -> succeeds
    reapply_ok = await client_with_db.post(
        f"/api/v1/doctor/clinical-notes/{saved_draft.id}/apply-template",
        json={"templateId": filling_tmpl["id"], "overwriteConfirmed": True},
        headers=doctor_auth["headers"],
    )
    assert reapply_ok.status_code == 200

    # 5. Strict Requirement: "Signed notes are never changed by templates."
    # Sign the note
    saved_draft.is_signed = True
    saved_draft.signed_at = datetime.now(timezone.utc)
    saved_draft.signed_by_user_id = doctor_auth["user"].id
    await note_repo.save(saved_draft)
    await test_session.commit()

    signed_attempt = await client_with_db.post(
        f"/api/v1/doctor/clinical-notes/{saved_draft.id}/apply-template",
        json={"templateId": filling_tmpl["id"], "overwriteConfirmed": True},
        headers=doctor_auth["headers"],
    )
    assert signed_attempt.status_code == 409
    assert "immutable" in signed_attempt.json()["detail"].lower()


# =========================================================================
# B4: Private Attachments, Magic Bytes & Consents
# =========================================================================

@pytest.mark.asyncio
async def test_patient_attachments_magic_bytes_and_consents(test_session: AsyncSession, client_with_db: AsyncClient, tmp_path, monkeypatch):
    # Point ATTACHMENT_DIR to temp directory
    attach_dir = str(tmp_path / "attachments")
    monkeypatch.setattr(settings, "ATTACHMENT_DIR", attach_dir)

    doctor_auth = await _login_user(client_with_db, test_session, UserRole.DOCTOR, "doc_att")
    reception_auth = await _login_user(client_with_db, test_session, UserRole.RECEPTIONIST, "rec_att")
    patient = await _create_test_patient(test_session)

    # 1. Upload valid PDF attachment with magic bytes "%PDF-"
    valid_pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_res = await client_with_db.post(
        "/api/v1/attachments/upload",
        data={"patientId": str(patient.id), "category": "xray"},
        files={"file": ("bitewing.pdf", valid_pdf_content, "application/pdf")},
        headers=doctor_auth["headers"],
    )
    assert upload_res.status_code == 201
    att_data = upload_res.json()
    att_id = att_data["id"]
    assert att_data["category"] == "xray"

    # Verify file stored on disk outside public served path
    stored_files = os.listdir(attach_dir)
    assert len(stored_files) == 1

    # 2. Upload invalid content masquerading with .jpg extension -> 422
    fake_jpg_content = b"<html><script>alert(1)</script></html>"
    fail_upload = await client_with_db.post(
        "/api/v1/attachments/upload",
        data={"patientId": str(patient.id), "category": "photo"},
        files={"file": ("photo.jpg", fake_jpg_content, "image/jpeg")},
        headers=doctor_auth["headers"],
    )
    assert fail_upload.status_code == 422
    assert "magic" in fail_upload.json()["detail"].lower() or "format" in fail_upload.json()["detail"].lower()

    # 3. Reception permission check:
    # Receptionist trying to upload or view 'xray' MUST BE FORBIDDEN (403)
    rec_upload_xray = await client_with_db.post(
        "/api/v1/attachments/upload",
        data={"patientId": str(patient.id), "category": "xray"},
        files={"file": ("xray.pdf", valid_pdf_content, "application/pdf")},
        headers=reception_auth["headers"],
    )
    assert rec_upload_xray.status_code == 403, "Reception may only upload consent and other"

    # Receptionist can upload 'consent' category
    valid_png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    rec_upload_consent = await client_with_db.post(
        "/api/v1/attachments/upload",
        data={"patientId": str(patient.id), "category": "consent"},
        files={"file": ("consent_scan.png", valid_png_content, "image/png")},
        headers=reception_auth["headers"],
    )
    assert rec_upload_consent.status_code == 201
    consent_att_id = rec_upload_consent.json()["id"]

    # 4. Authenticated download audits read and checks role
    dl_res = await client_with_db.get(
        f"/api/v1/attachments/{att_id}/download",
        headers=doctor_auth["headers"],
    )
    assert dl_res.status_code == 200
    assert dl_res.content == valid_pdf_content

    # Reception cannot download clinical xray (403)
    rec_dl_xray = await client_with_db.get(
        f"/api/v1/attachments/{att_id}/download",
        headers=reception_auth["headers"],
    )
    assert rec_dl_xray.status_code == 403

    # 5. Voiding retains file on disk and marks voided
    void_res = await client_with_db.post(
        f"/api/v1/attachments/{att_id}/void",
        json={"reason": "Uploaded against incorrect patient record"},
        headers=doctor_auth["headers"],
    )
    assert void_res.status_code == 200
    assert void_res.json()["voided"] is True

    # File still exists on disk! (No hard delete)
    assert len(os.listdir(attach_dir)) >= 1

    # 6. Patient Consent creation (typed and scanned)
    consent_typed_res = await client_with_db.post(
        "/api/v1/consents",
        json={
            "patientId": str(patient.id),
            "consentType": "Surgical Extraction Consent",
            "method": "typed",
            "signedName": "Arthur Dent",
        },
        headers=doctor_auth["headers"],
    )
    assert consent_typed_res.status_code == 201
    consent_id = consent_typed_res.json()["id"]

    # Void consent
    void_c_res = await client_with_db.post(
        f"/api/v1/consents/{consent_id}/void",
        json={"reason": "Patient revoked consent prior to anaesthesia"},
        headers=doctor_auth["headers"],
    )
    assert void_c_res.status_code == 200
    assert void_c_res.json()["voided"] is True


# =========================================================================
# B5: Prescriptions & Referral Letters Behind Feature Flag
# =========================================================================

@pytest.mark.asyncio
async def test_prescriptions_and_referrals_feature_flag_and_signing(test_session: AsyncSession, client_with_db: AsyncClient, monkeypatch):
    # Seed an organization so the printable clinic header is resolved from the
    # backend record (proves the header is dynamic, not hardcoded).
    from app.infrastructure.repositories.postgres_organization_repo import (
        PostgresOrganizationRepository,
    )

    org_repo = PostgresOrganizationRepository(test_session)
    await org_repo.save(
        Organization(
            name="marlow-dynamic",
            display_name="Marlow Dynamic Clinic",
            currency_code="PKR",
            currency_symbol="Rs",
            timezone="Asia/Karachi",
        )
    )
    await test_session.commit()

    doctor_auth = await _login_user(client_with_db, test_session, UserRole.DOCTOR, "doc_rx")
    patient = await _create_test_patient(test_session)
    encounter = await _create_test_encounter(test_session, patient.id, doctor_auth)

    # 1. Feature Flag OFF by default -> endpoints return 403 Forbidden
    monkeypatch.setattr(settings, "CLINICAL_DOCUMENTS_ENABLED", False)

    rx_off_res = await client_with_db.post(
        "/api/v1/doctor/documents/prescriptions",
        json={
            "encounterId": str(encounter.id),
            "patientId": str(patient.id),
            "items": [{"drug": "Amoxicillin", "dose": "500mg", "frequency": "TDS", "duration": "5 days"}],
        },
        headers=doctor_auth["headers"],
    )
    assert rx_off_res.status_code == 403
    assert "disabled" in rx_off_res.json()["detail"].lower()

    # 2. Turn Feature Flag ON
    monkeypatch.setattr(settings, "CLINICAL_DOCUMENTS_ENABLED", True)

    # Create draft prescription
    rx_on_res = await client_with_db.post(
        "/api/v1/doctor/documents/prescriptions",
        json={
            "encounterId": str(encounter.id),
            "patientId": str(patient.id),
            "items": [{"drug": "Amoxicillin", "dose": "500mg", "frequency": "TDS", "duration": "5 days"}],
            "notes": "Take after food.",
        },
        headers=doctor_auth["headers"],
    )
    assert rx_on_res.status_code == 201
    rx_id = rx_on_res.json()["id"]
    assert rx_on_res.json()["status"] == "draft"

    # Sign prescription -> locks it
    sign_res = await client_with_db.post(
        f"/api/v1/doctor/documents/prescriptions/{rx_id}/sign",
        headers=doctor_auth["headers"],
    )
    assert sign_res.status_code == 200
    assert sign_res.json()["status"] == "signed"

    # Print view returns clinic header, disclaimer and doctor details
    print_res = await client_with_db.get(
        f"/api/v1/doctor/documents/prescriptions/{rx_id}/print",
        headers=doctor_auth["headers"],
    )
    assert print_res.status_code == 200
    pv = print_res.json()
    # Clinic header must resolve from the seeded organization record (dynamic, not hardcoded)
    assert pv["clinicHeader"] == "Marlow Dynamic Clinic"
    # Demonstration project: signed prescription documents carry a DEMO watermark
    assert pv["watermark"] == "DEMO DOCUMENT - NOT FOR CLINICAL USE"
    assert "legal counsel" in pv["legalDisclaimer"].lower()
    assert pv["status"] == "signed"

    # 3. Referral letter creation, sign, and print view
    ref_res = await client_with_db.post(
        "/api/v1/doctor/documents/referrals",
        json={
            "encounterId": str(encounter.id),
            "patientId": str(patient.id),
            "recipient": "Dr. Sarah Khan, Oral & Maxillofacial Surgeon",
            "reason": "Impacted mandibular third molar with recurrent pericoronitis",
            "summary": "Full mouth examination completed. Tooth 38 horizontally impacted.",
        },
        headers=doctor_auth["headers"],
    )
    assert ref_res.status_code == 201
    ref_id = ref_res.json()["id"]

    ref_sign_res = await client_with_db.post(
        f"/api/v1/doctor/documents/referrals/{ref_id}/sign",
        headers=doctor_auth["headers"],
    )
    assert ref_sign_res.status_code == 200
    assert ref_sign_res.json()["status"] == "signed"

    ref_print_res = await client_with_db.get(
        f"/api/v1/doctor/documents/referrals/{ref_id}/print",
        headers=doctor_auth["headers"],
    )
    assert ref_print_res.status_code == 200
    ref_pv = ref_print_res.json()
    assert ref_pv["recipient"] == "Dr. Sarah Khan, Oral & Maxillofacial Surgeon"
    assert "legal counsel" in ref_pv["legalDisclaimer"].lower()
