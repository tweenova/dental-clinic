import io
import logging
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

from app.api.deps import get_appointment_repository, get_booking_repository, get_patient_repository
from app.domain.models.appointment import Appointment
from app.domain.repositories.appointment_repo import AppointmentRepository
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.main import app


@pytest.fixture
def mock_appointment_repo():
    mock_repo = AsyncMock(spec=AppointmentRepository)
    mock_repo.save.side_effect = lambda apt: apt
    mock_booking_repo = AsyncMock(spec=BookingRepository)
    mock_booking_repo.save.side_effect = lambda b: b
    mock_patient_repo = AsyncMock(spec=PatientRepository)
    mock_patient_repo.find_duplicates.return_value = []
    mock_patient_repo.save.side_effect = lambda p: p

    app.dependency_overrides[get_appointment_repository] = lambda: mock_repo
    app.dependency_overrides[get_booking_repository] = lambda: mock_booking_repo
    app.dependency_overrides[get_patient_repository] = lambda: mock_patient_repo
    yield mock_repo
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_appointment_creation_success(async_client, mock_appointment_repo):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": tomorrow,
        "preferredTime": "10:00 AM",
        "fullName": "Jane Alvarez",
        "phone": "(312) 555-0100",
        "email": "jane@example.com",
        "hasInsurance": True,
        "insuranceProvider": "Delta Dental PPO",
        "notes": "Slight sensitivity",
        "utmSource": "google",
        "utmCampaign": "lincoln-park",
    }

    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["success"] is True
    assert data["confirmationId"].startswith(f"MD-{datetime.now(timezone.utc).year}-")
    assert "Within 1 business hour" in data["estimatedCallbackWindow"]

    # Strict PHI check: Never echo patient details in response
    assert "Jane Alvarez" not in response.text
    assert "(312) 555-0100" not in response.text
    assert "jane@example.com" not in response.text
    assert "Delta Dental" not in response.text
    assert "Slight sensitivity" not in response.text


@pytest.mark.asyncio
async def test_validation_invalid_service(async_client, mock_appointment_repo):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "fake-service-xyz",
        "preferredDate": tomorrow,
        "preferredTime": "10:00 AM",
        "fullName": "Jane Alvarez",
        "phone": "(312) 555-0100",
        "email": "jane@example.com",
    }
    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_validation_past_date(async_client, mock_appointment_repo):
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": yesterday,
        "preferredTime": "10:00 AM",
        "fullName": "Jane Alvarez",
        "phone": "(312) 555-0100",
        "email": "jane@example.com",
    }
    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_validation_invalid_time_slot(async_client, mock_appointment_repo):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": tomorrow,
        "preferredTime": "2:15 AM",
        "fullName": "Jane Alvarez",
        "phone": "(312) 555-0100",
        "email": "jane@example.com",
    }
    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_validation_invalid_phone(async_client, mock_appointment_repo):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": tomorrow,
        "preferredTime": "10:00 AM",
        "fullName": "Jane Alvarez",
        "phone": "555-01",  # less than 10 digits
        "email": "jane@example.com",
    }
    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_validation_invalid_email(async_client, mock_appointment_repo):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": tomorrow,
        "preferredTime": "10:00 AM",
        "fullName": "Jane Alvarez",
        "phone": "3125550100",
        "email": "not-an-email",
    }
    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_validation_oversized_notes(async_client, mock_appointment_repo):
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": tomorrow,
        "preferredTime": "10:00 AM",
        "fullName": "Jane Alvarez",
        "phone": "3125550100",
        "email": "jane@example.com",
        "notes": "x" * 1005,
    }
    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_cors_behavior(async_client):
    # Request from allowed origin
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
    }
    response = await async_client.options("/api/v1/appointments", headers=headers)
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

    # Request from disallowed origin
    unauthorized_headers = {
        "Origin": "http://malicious-site.com",
        "Access-Control-Request-Method": "POST",
    }
    unauthorized_response = await async_client.options("/api/v1/appointments", headers=unauthorized_headers)
    assert unauthorized_response.headers.get("access-control-allow-origin") is None


@pytest.mark.asyncio
async def test_phi_never_appears_in_logs(async_client, mock_appointment_repo, caplog):
    caplog.set_level(logging.DEBUG)
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "serviceId": "root-canals",
        "preferredDate": tomorrow,
        "preferredTime": "1:30 PM",
        "fullName": "ConfidentialPatientName",
        "phone": "3129998888",
        "email": "confidential@secretpatient.com",
        "hasInsurance": True,
        "insuranceProvider": "SecretCarrierPPO",
        "notes": "SensitiveDiagnosticNotePulpitis",
    }

    response = await async_client.post("/api/v1/appointments", json=payload)
    assert response.status_code == 201

    log_output = caplog.text
    # Verify no PHI details appear in captured log output
    assert "ConfidentialPatientName" not in log_output
    assert "3129998888" not in log_output
    assert "confidential@secretpatient.com" not in log_output
    assert "SecretCarrierPPO" not in log_output
    assert "SensitiveDiagnosticNotePulpitis" not in log_output
