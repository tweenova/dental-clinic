import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.organization import Organization
from app.infrastructure.repositories.postgres_organization_repo import PostgresOrganizationRepository


@pytest.mark.asyncio
async def test_admin_team_lifecycle(client_with_db: AsyncClient, test_session: AsyncSession, admin_auth):
    # Ensure practice organization exists
    org_repo = PostgresOrganizationRepository(test_session)
    org = await org_repo.save(
        Organization(name="Marlow Dental", display_name="Marlow Dental Practice")
    )
    await test_session.commit()

    headers = admin_auth["headers"]

    # 1. Unauthenticated request must fail
    unauth_resp = await client_with_db.post("/api/v1/admin/team", json={})
    assert unauth_resp.status_code == 401

    # 2. Admin creates new team member (Associate Dentist)
    create_payload = {
        "organizationId": str(org.id),
        "firstName": "Marcus",
        "lastName": "Vance",
        "displayName": "Dr. Marcus Vance, DDS",
        "professionalTitle": "Associate Dentist",
        "role": "Dentist",
        "specialties": ["Restorative Care", "Root Canals"],
        "biography": "Graduated from Northwestern University Dental School with distinction.",
        "education": "DDS, Northwestern Dental School",
        "credentials": "DDS",
        "licenseNumber": "#019.034812",
        "licenseState": "Active",
        "displayOrder": 1,
        "isActive": True,
    }
    create_resp = await client_with_db.post("/api/v1/admin/team", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    member_data = create_resp.json()
    member_id = member_data["id"]
    assert member_data["displayName"] == "Dr. Marcus Vance, DDS"
    assert member_data["role"] == "Dentist"
    assert member_data["isActive"] is True

    # 3. Public endpoint shows the active member
    public_resp = await client_with_db.get("/api/v1/public/team")
    assert public_resp.status_code == 200
    public_members = public_resp.json()
    assert any(m["id"] == member_id for m in public_members)

    # 4. Admin updates team member
    update_resp = await client_with_db.put(
        f"/api/v1/admin/team/{member_id}",
        json={"professionalTitle": "Senior Associate Dentist"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["professionalTitle"] == "Senior Associate Dentist"

    # 5. Soft-delete (deactivate) team member
    deact_resp = await client_with_db.patch(
        f"/api/v1/admin/team/{member_id}/status",
        json={"isActive": False},
        headers=headers,
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["isActive"] is False

    # 6. Public endpoint NO LONGER returns deactivated member
    public_after_deact = await client_with_db.get("/api/v1/public/team")
    assert not any(m["id"] == member_id for m in public_after_deact.json())

    # 7. Admin list STILL shows the deactivated member
    admin_list_resp = await client_with_db.get("/api/v1/admin/team", headers=headers)
    assert any(m["id"] == member_id for m in admin_list_resp.json())

    # 8. Reactivate team member
    react_resp = await client_with_db.patch(
        f"/api/v1/admin/team/{member_id}/status",
        json={"isActive": True},
        headers=headers,
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["isActive"] is True

    # 9. Public endpoint shows reactivated member again
    public_after_react = await client_with_db.get("/api/v1/public/team")
    assert any(m["id"] == member_id for m in public_after_react.json())
