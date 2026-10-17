import pytest
from uuid import uuid4

from app.domain.models.team_member import TeamMember
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository


@pytest.mark.asyncio
async def test_admin_list_users(admin_auth):
    client = admin_auth["client"]
    headers = admin_auth["headers"]

    resp = await client.get("/api/v1/admin/users", headers=headers)
    assert resp.status_code == 200
    users = resp.json()
    assert isinstance(users, list)
    assert len(users) >= 1
    admin_entry = next((u for u in users if u["email"] == "testadmin@marlowdental.com"), None)
    assert admin_entry is not None
    assert admin_entry["role"] == "admin"


@pytest.mark.asyncio
async def test_non_admin_cannot_manage_users(receptionist_auth, doctor_auth):
    r_client = receptionist_auth["client"]
    r_headers = receptionist_auth["headers"]
    d_client = doctor_auth["client"]
    d_headers = doctor_auth["headers"]

    # Receptionist 403
    resp = await r_client.get("/api/v1/admin/users", headers=r_headers)
    assert resp.status_code == 403

    # Doctor 403
    resp = await d_client.get("/api/v1/admin/users", headers=d_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_create_doctor_with_team_member_link(admin_auth, test_session):
    client = admin_auth["client"]
    headers = admin_auth["headers"]

    # Create team member first
    team_repo = PostgresTeamMemberRepository(test_session)
    tm = TeamMember(
        organization_id=uuid4(),
        first_name="Alice",
        last_name="Smith",
        display_name="Dr. Alice Smith",
        professional_title="Orthodontist",
        role="Doctor",
        is_active=True,
    )
    saved_tm = await team_repo.save(tm)
    await test_session.commit()

    # Weak password rejection
    weak_payload = {
        "email": "alice.smith@marlowdental.com",
        "fullName": "Dr. Alice Smith",
        "role": "doctor",
        "password": "weak",
        "teamMemberId": str(saved_tm.id),
        "requiresPasswordChange": True,
    }
    weak_resp = await client.post("/api/v1/admin/users", json=weak_payload, headers=headers)
    assert weak_resp.status_code == 422

    # Valid creation
    valid_payload = {
        "email": "alice.smith@marlowdental.com",
        "fullName": "Dr. Alice Smith",
        "role": "doctor",
        "password": "SecurePassword1!",
        "teamMemberId": str(saved_tm.id),
        "requiresPasswordChange": True,
    }
    create_resp = await client.post("/api/v1/admin/users", json=valid_payload, headers=headers)
    assert create_resp.status_code == 201
    created_user = create_resp.json()
    assert created_user["email"] == "alice.smith@marlowdental.com"
    assert created_user["role"] == "doctor"
    assert created_user["teamMemberId"] == str(saved_tm.id)
    assert created_user["requiresPasswordChange"] is True

    # Login with temp password
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice.smith@marlowdental.com", "password": "SecurePassword1!"},
    )
    assert login_resp.status_code == 200
    doc_data = login_resp.json()
    assert doc_data["user"]["requiresPasswordChange"] is True
    doc_token = doc_data["accessToken"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # Doctor can access doctor schedule and is linked to practitioner
    sched_resp = await client.get("/api/v1/doctor/schedule", headers=doc_headers)
    assert sched_resp.status_code == 200

    # Doctor changes password
    pwd_change_resp = await client.post(
        "/api/v1/auth/change-password",
        json={
            "oldPassword": "SecurePassword1!",
            "newPassword": "NewPermanentPassword2@",
        },
        headers=doc_headers,
    )
    assert pwd_change_resp.status_code == 200

    # Old token was revoked by password change
    sched_old_resp = await client.get("/api/v1/doctor/schedule", headers=doc_headers)
    assert sched_old_resp.status_code == 401

    # Login with new password
    new_login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice.smith@marlowdental.com", "password": "NewPermanentPassword2@"},
    )
    assert new_login_resp.status_code == 200
    new_doc_data = new_login_resp.json()
    assert new_doc_data["user"]["requiresPasswordChange"] is False


@pytest.mark.asyncio
async def test_admin_deactivate_and_reactivate_user(admin_auth, test_session):
    client = admin_auth["client"]
    headers = admin_auth["headers"]

    # Create a user
    payload = {
        "email": "staff.test@marlowdental.com",
        "fullName": "Staff Member",
        "role": "receptionist",
        "password": "TempPassword1!",
        "requiresPasswordChange": False,
    }
    create_resp = await client.post("/api/v1/admin/users", json=payload, headers=headers)
    assert create_resp.status_code == 201
    user_id = create_resp.json()["id"]

    # Login to get active token
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "staff.test@marlowdental.com", "password": "TempPassword1!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["accessToken"]
    staff_headers = {"Authorization": f"Bearer {token}"}

    # Verify user can access reception
    rec_resp = await client.get("/api/v1/reception/patients", headers=staff_headers)
    assert rec_resp.status_code == 200

    # Admin deactivates user
    deactivate_resp = await client.patch(
        f"/api/v1/admin/users/{user_id}/status",
        json={"isActive": False},
        headers=headers,
    )
    assert deactivate_resp.status_code == 200
    assert deactivate_resp.json()["isActive"] is False

    # Existing token revoked
    rec_blocked_resp = await client.get("/api/v1/reception/patients", headers=staff_headers)
    assert rec_blocked_resp.status_code == 401

    # Login rejected
    login_attempt = await client.post(
        "/api/v1/auth/login",
        json={"email": "staff.test@marlowdental.com", "password": "TempPassword1!"},
    )
    assert login_attempt.status_code == 401

    # Admin reactivates user
    reactivate_resp = await client.patch(
        f"/api/v1/admin/users/{user_id}/status",
        json={"isActive": True},
        headers=headers,
    )
    assert reactivate_resp.status_code == 200
    assert reactivate_resp.json()["isActive"] is True

    # User can log in again
    login_again = await client.post(
        "/api/v1/auth/login",
        json={"email": "staff.test@marlowdental.com", "password": "TempPassword1!"},
    )
    assert login_again.status_code == 200


@pytest.mark.asyncio
async def test_admin_reset_user_password(admin_auth):
    client = admin_auth["client"]
    headers = admin_auth["headers"]

    # Create a user
    payload = {
        "email": "reset.test@marlowdental.com",
        "fullName": "Reset Target",
        "role": "receptionist",
        "password": "OriginalPassword1!",
        "requiresPasswordChange": False,
    }
    create_resp = await client.post("/api/v1/admin/users", json=payload, headers=headers)
    assert create_resp.status_code == 201
    user_id = create_resp.json()["id"]

    # Login to get active token
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "reset.test@marlowdental.com", "password": "OriginalPassword1!"},
    )
    token = login_resp.json()["accessToken"]
    staff_headers = {"Authorization": f"Bearer {token}"}

    # Reset with weak password fails
    weak_reset = await client.post(
        f"/api/v1/admin/users/{user_id}/reset-password",
        json={"password": "short"},
        headers=headers,
    )
    assert weak_reset.status_code == 422

    # Admin resets password
    reset_resp = await client.post(
        f"/api/v1/admin/users/{user_id}/reset-password",
        json={"password": "NewAdminPassword1!"},
        headers=headers,
    )
    assert reset_resp.status_code == 200

    # Old token revoked
    old_token_resp = await client.get("/api/v1/reception/patients", headers=staff_headers)
    assert old_token_resp.status_code == 401

    # Login with old password fails
    old_login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "reset.test@marlowdental.com", "password": "OriginalPassword1!"},
    )
    assert old_login_resp.status_code == 401

    # Login with new password succeeds and flags requiresPasswordChange
    new_login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "reset.test@marlowdental.com", "password": "NewAdminPassword1!"},
    )
    assert new_login_resp.status_code == 200
    assert new_login_resp.json()["user"]["requiresPasswordChange"] is True
