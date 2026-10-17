from typing import Dict

import json
from datetime import date, datetime, timezone, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.domain.models.booking_crm import Booking, Patient
from app.domain.models.clinical_note import ClinicalNote
from app.domain.models.encounter import ClinicalEncounter
from app.domain.models.user import User, UserSession, UserRole
from app.domain.models.team_member import TeamMember
from app.infrastructure.database.orm_models import ActivityLogORM
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_clinical_note_repo import PostgresClinicalNoteRepository
from app.infrastructure.repositories.postgres_encounter_repo import PostgresEncounterRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import (
    PostgresUserRepository,
    PostgresUserSessionRepository,
)


@pytest.mark.asyncio
async def test_booking_cancel_audit_log(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    user = receptionist_auth["user"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)

    patient = Patient(first_name="Arthur", last_name="Dent", phone="5554443333")
    saved_patient = await patient_repo.save(patient)

    booking = Booking(
        confirmation_id="BK-AUDIT-CNC",
        preferred_date=date.today(),
        preferred_time="10:00 AM",
        patient_full_name="Arthur Dent",
        patient_phone="5554443333",
        patient_email="arthur@example.com",
        patient_id=saved_patient.id,
        status="confirmed",
    )
    saved_booking = await booking_repo.save(booking)
    await test_session.commit()

    # Cancel the booking
    cancel_payload = {
        "status": "cancelled",
        "cancellationReason": "Patient caught flu and requested reschedule next week",
    }
    resp = await client.patch(
        f"/api/v1/reception/appointments/{saved_booking.id}/status",
        json=cancel_payload,
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"

    # Assert activity log entry in database
    res = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "booking_cancel",
            ActivityLogORM.entity_id == str(saved_booking.id),
        )
    )
    logs = res.scalars().all()
    assert len(logs) >= 1
    log = logs[0]
    assert log.entity_type == "booking"
    assert log.user_id == user.id
    details = json.loads(log.details_json) if log.details_json else {}
    assert "flu" in details.get("reason", "")
    assert details.get("old_status") == "confirmed"


@pytest.mark.asyncio
async def test_deduplication_bypass_audit_log(receptionist_auth, test_session):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]
    user = receptionist_auth["user"]

    payload = {
        "firstName": "Ford",
        "lastName": "Prefect",
        "phone": "5551234567",
        "email": "ford@prefect.org",
    }

    resp = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201, resp.text

    # Assert activity log entry for deduplication_bypass
    res = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "deduplication_bypass",
            ActivityLogORM.user_id == user.id,
        )
    )
    logs = res.scalars().all()
    assert len(logs) >= 1
    log = logs[0]
    assert log.entity_type == "patient"
    details = json.loads(log.details_json) if log.details_json else {}
    assert details.get("first_name") == "Ford"
    assert details.get("last_name") == "Prefect"


@pytest.mark.asyncio
async def test_clinical_reads_audit_logs(doctor_auth, admin_auth, test_session):
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]
    doc_user = doctor_auth["user"]

    admin_client = admin_auth["client"]
    admin_headers = admin_auth["headers"]
    admin_user = admin_auth["user"]

    patient_repo = PostgresPatientRepository(test_session)
    booking_repo = PostgresBookingRepository(test_session)
    enc_repo = PostgresEncounterRepository(test_session)
    note_repo = PostgresClinicalNoteRepository(test_session)

    # 1. Setup Patient, Booking, Encounter, and Note
    patient = Patient(first_name="Tricia", last_name="McMillan", phone="5559876543")
    saved_patient = await patient_repo.save(patient)

    booking = Booking(
        confirmation_id="BK-CLIN-READ",
        preferred_date=date.today(),
        preferred_time="02:00 PM",
        patient_full_name="Tricia McMillan",
        patient_phone="5559876543",
        patient_email="tricia@example.com",
        patient_id=saved_patient.id,
        team_member_id=doc_user.team_member_id,
        status="in_progress",
    )
    saved_booking = await booking_repo.save(booking)

    encounter = ClinicalEncounter(
        patient_id=saved_patient.id,
        booking_id=saved_booking.id,
        clinician_id=doc_user.team_member_id,
        chief_complaint="Sensitivity on upper left premolar",
        status="in_progress",
    )
    saved_encounter = await enc_repo.save(encounter)

    note = ClinicalNote(
        encounter_id=saved_encounter.id,
        patient_id=saved_patient.id,
        author_id=doc_user.team_member_id,
        subjective="Patient reports mild sensitivity to cold liquids.",
        objective="Premolar #12 exhibits mild gingival recession.",
        assessment="Dentin hypersensitivity #12.",
        plan="Apply fluoride varnish.",
        is_signed=True,
        signed_at=datetime.now(timezone.utc),
        signed_by_id=doc_user.team_member_id,
        status="signed",
    )
    saved_note = await note_repo.save(note)
    await test_session.commit()

    # 2. Doctor reads note
    doc_note_resp = await doc_client.get(
        f"/api/v1/doctor/encounters/{saved_encounter.id}/note",
        headers=doc_headers,
    )
    assert doc_note_resp.status_code == 200, doc_note_resp.text

    # Verify doctor read audit log
    res_doc = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "clinical_read_note",
            ActivityLogORM.user_id == doc_user.id,
            ActivityLogORM.entity_id == str(saved_note.id),
        )
    )
    doc_logs = res_doc.scalars().all()
    assert len(doc_logs) >= 1

    # 3. Admin reads clinical note (Admin clinical read access writes activity log)
    admin_note_resp = await admin_client.get(
        f"/api/v1/doctor/encounters/{saved_encounter.id}/note",
        headers=admin_headers,
    )
    assert admin_note_resp.status_code == 200, admin_note_resp.text

    res_admin = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "clinical_read_note",
            ActivityLogORM.user_id == admin_user.id,
            ActivityLogORM.entity_id == str(saved_note.id),
        )
    )
    admin_logs = res_admin.scalars().all()
    assert len(admin_logs) >= 1
    assert admin_logs[0].entity_type == "encounter_note"

    # 4. Doctor reads dental chart
    chart_resp = await doc_client.get(
        f"/api/v1/doctor/patients/{saved_patient.id}/chart",
        headers=doc_headers,
    )
    assert chart_resp.status_code == 200, chart_resp.text

    res_chart = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "clinical_read_chart",
            ActivityLogORM.user_id == doc_user.id,
            ActivityLogORM.entity_id == str(saved_patient.id),
        )
    )
    chart_logs = res_chart.scalars().all()
    assert len(chart_logs) >= 1


async def _behaviour_auth_headers(session, role: UserRole, team_member_id=None) -> Dict[str, str]:
    """Mint a Bearer token for a freshly persisted user (no HTTP login)."""
    user_repo = PostgresUserRepository(session)
    user = User(
        email=f"behav_{role.value}_{uuid4().hex[:8]}@marlowdental.com",
        hashed_password=hash_password("BehavTest123!"),
        full_name=f"Behaviour {role.value}",
        role=role,
        team_member_id=team_member_id,
        is_active=True,
    )
    await user_repo.save(user)
    await session.commit()

    session_row = UserSession(
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    await PostgresUserSessionRepository(session).save(session_row)
    await session.commit()

    token = create_access_token(
        subject=str(user.id),
        role=role.value,
        session_id=str(session_row.id),
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_cross_doctor_encounter_read_denied(test_session, client_with_db):
    """A doctor must not read another doctor's encounter (403 scoping denial)."""
    client = client_with_db

    # Two doctors, each with their own linked clinical staff profile.
    tm_repo = PostgresTeamMemberRepository(test_session)
    tm_a = await tm_repo.save(
        TeamMember(
            organization_id=uuid4(),
            first_name="Doctor",
            last_name="One",
            display_name="Dr. One",
            professional_title="Dentist",
            role="Doctor",
            is_active=True,
        )
    )
    tm_b = await tm_repo.save(
        TeamMember(
            organization_id=uuid4(),
            first_name="Doctor",
            last_name="Two",
            display_name="Dr. Two",
            professional_title="Dentist",
            role="Doctor",
            is_active=True,
        )
    )
    await test_session.commit()

    headers_a = await _behaviour_auth_headers(test_session, UserRole.DOCTOR, tm_a.id)
    headers_b = await _behaviour_auth_headers(test_session, UserRole.DOCTOR, tm_b.id)

    # Doctor A owns a patient and an encounter.
    patient_repo = PostgresPatientRepository(test_session)
    patient = Patient(
        first_name="Cross", last_name="Doctor", phone="5550001111",
    )
    saved_patient = await patient_repo.save(patient)
    await test_session.commit()

    enc_repo = PostgresEncounterRepository(test_session)
    encounter = ClinicalEncounter(
        patient_id=saved_patient.id,
        clinician_id=tm_a.id,
        chief_complaint="Owner-only encounter.",
        status="in_progress",
    )
    saved_encounter = await enc_repo.save(encounter)
    await test_session.commit()

    # Doctor B reads Doctor A's encounter -> must be denied (403).
    resp_b = await client.get(
        f"/api/v1/doctor/encounters/{saved_encounter.id}",
        headers=headers_b,
    )
    assert resp_b.status_code == 403, resp_b.text


@pytest.mark.asyncio
async def test_reception_cannot_read_alert_details(test_session, client_with_db):
    """Receptionists can create pending alerts but may not read alert details (403)."""
    client = client_with_db

    headers_rec = await _behaviour_auth_headers(test_session, UserRole.RECEPTIONIST)

    patient_repo = PostgresPatientRepository(test_session)
    patient = Patient(
        first_name="Alert", last_name="Patient", phone="5559990000",
    )
    saved_patient = await patient_repo.save(patient)
    await test_session.commit()

    # Receptionist attempts to read full alert details for the patient.
    resp = await client.get(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        headers=headers_rec,
    )
    assert resp.status_code == 403, resp.text
