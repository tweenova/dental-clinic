import pytest
from uuid import uuid4
from sqlalchemy import select

from app.domain.models.booking_crm import Patient
from app.infrastructure.database.orm_models import ActivityLogORM
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository


@pytest.mark.asyncio
async def test_doctor_create_alert_and_audited(doctor_auth, test_session):
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    test_patient = Patient(
        first_name="Alice",
        last_name="Smith",
        phone="5551234567",
        email="alice@example.com",
    )
    saved_patient = await patient_repo.save(test_patient)
    await test_session.commit()

    payload = {
        "type": "allergy",
        "description": "Amoxicillin severe rash",
        "severity": "severe",
    }
    resp = await client.post(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "allergy"
    assert data["description"] == "Amoxicillin severe rash"
    assert data["severity"] == "severe"
    assert data["isConfirmed"] is True
    assert data["isActive"] is True

    # Verify activity_logs entry
    q = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "create_medical_alert",
            ActivityLogORM.entity_id == data["id"],
        )
    )
    log = q.scalar_one_or_none()
    assert log is not None
    assert log.user_id == doctor_auth["user"].id
    assert log.entity_type == "patient_medical_alert"


@pytest.mark.asyncio
async def test_clinical_reads_audited_for_doctor_and_admin(
    doctor_auth, admin_auth, test_session
):
    patient_repo = PostgresPatientRepository(test_session)
    test_patient = Patient(
        first_name="Bob",
        last_name="Jones",
        phone="5559876543",
    )
    saved_patient = await patient_repo.save(test_patient)
    await test_session.commit()

    # Doctor read
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]
    doc_resp = await doc_client.get(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        headers=doc_headers,
    )
    assert doc_resp.status_code == 200
    doc_data = doc_resp.json()
    assert doc_data["patientId"] == str(saved_patient.id)
    assert doc_data["medicalHistoryStatus"] == "not_asked"

    q_doc = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "read_medical_alerts",
            ActivityLogORM.user_id == doctor_auth["user"].id,
        )
    )
    assert q_doc.scalar_one_or_none() is not None

    # Admin read
    adm_client = admin_auth["client"]
    adm_headers = admin_auth["headers"]
    adm_resp = await adm_client.get(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        headers=adm_headers,
    )
    assert adm_resp.status_code == 200

    q_adm = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "read_medical_alerts",
            ActivityLogORM.user_id == admin_auth["user"].id,
        )
    )
    assert q_adm.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_receptionist_forbidden_from_clinical_alert_details(
    receptionist_auth, test_session
):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    test_patient = Patient(
        first_name="Charlie",
        last_name="Brown",
        phone="5553334444",
    )
    saved_patient = await patient_repo.save(test_patient)
    await test_session.commit()

    # Receptionist cannot read clinical alerts
    read_resp = await client.get(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        headers=headers,
    )
    assert read_resp.status_code == 403

    # Receptionist cannot write confirmed clinical alerts
    write_resp = await client.post(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        json={"type": "allergy", "description": "Penicillin"},
        headers=headers,
    )
    assert write_resp.status_code == 403


@pytest.mark.asyncio
async def test_receptionist_pending_alert_capture_and_doctor_confirm(
    receptionist_auth, doctor_auth, test_session
):
    rec_client = receptionist_auth["client"]
    rec_headers = receptionist_auth["headers"]
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    test_patient = Patient(
        first_name="Diana",
        last_name="Prince",
        phone="5554445555",
    )
    saved_patient = await patient_repo.save(test_patient)
    await test_session.commit()

    # Reception records pending alert
    pending_payload = {
        "type": "allergy",
        "description": "Latex allergy reported at front desk check-in",
    }
    rec_resp = await rec_client.post(
        f"/api/v1/reception/patients/{saved_patient.id}/pending-alerts",
        json=pending_payload,
        headers=rec_headers,
    )
    assert rec_resp.status_code == 201
    pending_data = rec_resp.json()
    assert pending_data["isConfirmed"] is False
    assert pending_data["isActive"] is True
    alert_id = pending_data["id"]

    # Verify activity_logs entry for reception capture
    q_rec = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "reception_capture_pending_alert",
            ActivityLogORM.entity_id == alert_id,
        )
    )
    assert q_rec.scalar_one_or_none() is not None

    # Doctor views alerts: pending has 1, confirmed has 0
    doc_get_resp = await doc_client.get(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        headers=doc_headers,
    )
    assert doc_get_resp.status_code == 200
    summary = doc_get_resp.json()
    assert len(summary["pendingAlerts"]) == 1
    assert len(summary["confirmedAlerts"]) == 0
    assert summary["pendingAlerts"][0]["id"] == alert_id

    # Doctor confirms the pending alert
    confirm_resp = await doc_client.post(
        f"/api/v1/clinical/alerts/{alert_id}/confirm",
        headers=doc_headers,
    )
    assert confirm_resp.status_code == 200
    confirmed_data = confirm_resp.json()
    assert confirmed_data["isConfirmed"] is True

    # Check confirm activity_logs entry
    q_confirm = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "confirm_medical_alert",
            ActivityLogORM.entity_id == alert_id,
        )
    )
    assert q_confirm.scalar_one_or_none() is not None

    # After confirmation: confirmedAlerts has 1, pendingAlerts has 0
    doc_get_resp2 = await doc_client.get(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        headers=doc_headers,
    )
    summary2 = doc_get_resp2.json()
    assert len(summary2["confirmedAlerts"]) == 1
    assert len(summary2["pendingAlerts"]) == 0


@pytest.mark.asyncio
async def test_doctor_dismiss_alert(doctor_auth, test_session):
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    test_patient = Patient(
        first_name="Evan",
        last_name="Wright",
        phone="5556667777",
    )
    saved_patient = await patient_repo.save(test_patient)
    await test_session.commit()

    # Create confirmed alert
    create_resp = await doc_client.post(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts",
        json={"type": "medication", "description": "Aspirin 81mg daily"},
        headers=doc_headers,
    )
    assert create_resp.status_code == 201
    alert_id = create_resp.json()["id"]

    # Resolve / dismiss alert
    dismiss_resp = await doc_client.post(
        f"/api/v1/clinical/alerts/{alert_id}/dismiss",
        headers=doc_headers,
    )
    assert dismiss_resp.status_code == 200
    dismissed_data = dismiss_resp.json()
    assert dismissed_data["isActive"] is False

    # Check resolve activity_logs entry
    q_dismiss = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "resolve_medical_alert",
            ActivityLogORM.entity_id == alert_id,
        )
    )
    assert q_dismiss.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_review_at_visit_and_medical_history_status(doctor_auth, test_session):
    doc_client = doctor_auth["client"]
    doc_headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    test_patient = Patient(
        first_name="Fiona",
        last_name="Gallagher",
        phone="5558889999",
    )
    saved_patient = await patient_repo.save(test_patient)
    await test_session.commit()

    # Clinical review
    rev_resp = await doc_client.post(
        f"/api/v1/clinical/patients/{saved_patient.id}/alerts/review",
        headers=doc_headers,
    )
    assert rev_resp.status_code == 200
    rev_data = rev_resp.json()
    assert rev_data["status"] == "reviewed"
    assert rev_data["lastReviewedAt"] is not None

    q_rev = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "review_medical_alerts",
            ActivityLogORM.entity_id == str(saved_patient.id),
        )
    )
    assert q_rev.scalar_one_or_none() is not None

    # Update medical history status
    status_resp = await doc_client.patch(
        f"/api/v1/clinical/patients/{saved_patient.id}/medical-history-status",
        json={"status": "none_known"},
        headers=doc_headers,
    )
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["medicalHistoryStatus"] == "none_known"

    q_stat = await test_session.execute(
        select(ActivityLogORM).where(
            ActivityLogORM.action == "update_medical_history_status",
            ActivityLogORM.entity_id == str(saved_patient.id),
        )
    )
    assert q_stat.scalar_one_or_none() is not None
