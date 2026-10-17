import pytest
from datetime import date, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.service import Service
from app.infrastructure.database.orm_models import (
    ActivityLogORM,
    BookingORM,
    PatientORM,
    ServiceORM,
)


@pytest.mark.asyncio
async def test_service_catalog_recall_interval_perio(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    today = date.today()

    # 1. Create a service with 90-day recall interval (e.g. Perio Maintenance)
    perio_svc = ServiceORM(
        id=uuid4(),
        slug="perio-maintenance",
        category="preventive",
        title="Periodontal Maintenance",
        short_desc="Deep cleaning every 3 months for gum health",
        cash_price="Rs 8,000",
        duration="45 min",
        recall_interval_days=90,
    )
    test_session.add(perio_svc)

    # 2. Create a patient who completed visit 100 days ago
    patient = PatientORM(
        id=uuid4(),
        first_name="Amir",
        last_name="Khan",
        phone="+923001234567",
        email="amir@example.com",
    )
    test_session.add(patient)

    completed_visit = BookingORM(
        id=uuid4(),
        confirmation_id="BK-REC-01",
        preferred_date=today - timedelta(days=100),
        preferred_time="10:00",
        patient_full_name="Amir Khan",
        patient_phone="+923001234567",
        patient_email="amir@example.com",
        patient_id=patient.id,
        service_id="perio-maintenance",
        status="completed",
    )
    test_session.add(completed_visit)
    await test_session.commit()

    # 3. Query recalls endpoint
    resp = await client.get("/api/v1/reception/recalls", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    match = next((r for r in data if r["patientId"] == str(patient.id)), None)
    assert match is not None, "Patient Amir Khan should be due for recall"
    assert match["recallIntervalDays"] == 90
    assert match["serviceName"] == "Periodontal Maintenance"
    assert match["status"] == "overdue"
    assert match["dueDate"] == (today - timedelta(days=100) + timedelta(days=90)).isoformat()
    assert match["hasOpenTask"] is False


@pytest.mark.asyncio
async def test_patient_with_future_booking_excluded_from_recalls(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    today = date.today()

    # Create patient with completed visit 200 days ago
    patient = PatientORM(
        id=uuid4(),
        first_name="Sara",
        last_name="Ali",
        phone="+923007654321",
        email="sara@example.com",
    )
    test_session.add(patient)

    completed_visit = BookingORM(
        id=uuid4(),
        confirmation_id="BK-REC-02",
        preferred_date=today - timedelta(days=200),
        preferred_time="11:00",
        patient_full_name="Sara Ali",
        patient_phone="+923007654321",
        patient_email="sara@example.com",
        patient_id=patient.id,
        service_id="cleanings-exams",
        status="completed",
    )
    test_session.add(completed_visit)

    # But patient has an upcoming booking tomorrow!
    future_booking = BookingORM(
        id=uuid4(),
        confirmation_id="BK-REC-03",
        preferred_date=today + timedelta(days=2),
        preferred_time="14:00",
        patient_full_name="Sara Ali",
        patient_phone="+923007654321",
        patient_email="sara@example.com",
        patient_id=patient.id,
        service_id="cleanings-exams",
        status="confirmed",
    )
    test_session.add(future_booking)
    await test_session.commit()

    # Query recalls -> Sara should NOT be in the recall list
    resp = await client.get("/api/v1/reception/recalls", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert not any(r["patientId"] == str(patient.id) for r in data)


@pytest.mark.asyncio
async def test_create_recall_task_and_audit(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    today = date.today()

    # Create patient with completed visit 200 days ago
    patient = PatientORM(
        id=uuid4(),
        first_name="Tariq",
        last_name="Mehmood",
        phone="+923009988776",
        email="tariq@example.com",
    )
    test_session.add(patient)

    completed_visit = BookingORM(
        id=uuid4(),
        confirmation_id="BK-REC-04",
        preferred_date=today - timedelta(days=200),
        preferred_time="10:00",
        patient_full_name="Tariq Mehmood",
        patient_phone="+923009988776",
        patient_email="tariq@example.com",
        patient_id=patient.id,
        service_id="cleanings-exams",
        status="completed",
    )
    test_session.add(completed_visit)
    await test_session.commit()

    # Call endpoint to create recall task
    create_task_resp = await client.post(
        "/api/v1/reception/recalls/tasks",
        json={
            "patientId": str(patient.id),
            "serviceId": "cleanings-exams",
            "dueDate": today.isoformat(),
        },
        headers=headers,
    )
    assert create_task_resp.status_code == 201, create_task_resp.text
    task_data = create_task_resp.json()
    assert "Recall Call: Tariq Mehmood" in task_data["title"]
    assert task_data["patientId"] == str(patient.id)
    assert task_data["status"] == "pending"

    # Verify audit log recorded
    logs_result = await test_session.execute(
        select(ActivityLogORM).where(ActivityLogORM.action == "create_recall_task")
    )
    logs = logs_result.scalars().all()
    assert len(logs) >= 1
    assert any(str(patient.id) in (l.details_json or "") for l in logs)

    # Verify subsequent recalls endpoint returns hasOpenTask: True and taskId
    recalls_resp = await client.get("/api/v1/reception/recalls", headers=headers)
    assert recalls_resp.status_code == 200
    match = next((r for r in recalls_resp.json() if r["patientId"] == str(patient.id)), None)
    assert match is not None
    assert match["hasOpenTask"] is True
    assert match["taskId"] == task_data["id"]
