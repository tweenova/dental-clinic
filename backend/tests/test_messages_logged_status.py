import pytest
from app.domain.models.booking_crm import Message
from app.infrastructure.database.orm_models import MessageORM


def test_message_model_defaults_to_logged():
    msg = Message(content="Test note")
    assert msg.status == "logged"


@pytest.mark.asyncio
async def test_create_and_list_messages_persists_logged_status(receptionist_auth):
    client = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    # 1. Post new SMS message
    payload_sms = {
        "channel": "sms",
        "phone": "+15551234567",
        "content": "Reminder: Cleaning appointment tomorrow.",
    }
    resp = await client.post("/api/v1/reception/messages", json=payload_sms, headers=headers)
    assert resp.status_code == 201
    created_sms = resp.json()
    assert created_sms["status"] == "logged"
    assert created_sms["channel"] == "sms"

    # 2. Post new email message
    payload_email = {
        "channel": "email",
        "email": "patient@example.com",
        "content": "Pre-appointment health questionnaire link.",
    }
    resp = await client.post("/api/v1/reception/messages", json=payload_email, headers=headers)
    assert resp.status_code == 201
    created_email = resp.json()
    assert created_email["status"] == "logged"
    assert created_email["channel"] == "email"

    # 3. List messages
    list_resp = await client.get("/api/v1/reception/messages", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) >= 2
    for item in items:
        assert item["status"] == "logged"
