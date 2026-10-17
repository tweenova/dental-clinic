import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_services_lifecycle(client_with_db: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Unauthenticated request to admin endpoint must fail
    unauth_resp = await client_with_db.get("/api/v1/admin/services")
    assert unauth_resp.status_code == 401

    # 2. Admin creates a new service
    create_payload = {
        "slug": "pediatric-exam",
        "category": "preventive",
        "title": "Gentle Pediatric Dental Exam",
        "shortDesc": "Gentle, stress-free comprehensive dental checkup for infants and children.",
        "fullDesc": "Early dental visits ensure healthy primary tooth development and establish calm, lifelong oral hygiene habits.",
        "cashPrice": "from 110",
        "duration": "30 to 45 min",
        "code": "CDT D0145",
        "insuranceNote": "Direct fee estimate provided prior to treatment.",
        "displayOrder": 10,
        "isHighlighted": False,
        "isPublic": True,
        "isActive": True,
    }
    create_resp = await client_with_db.post("/api/v1/admin/services", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    svc_data = create_resp.json()
    svc_id = svc_data["id"]
    assert svc_data["slug"] == "pediatric-exam"
    assert svc_data["isActive"] is True

    # 3. Public services endpoint lists the new service
    pub_resp = await client_with_db.get("/api/v1/public/services")
    assert pub_resp.status_code == 200
    assert any(s["slug"] == "pediatric-exam" for s in pub_resp.json())

    # 4. Admin updates service details
    update_resp = await client_with_db.put(
        f"/api/v1/admin/services/{svc_id}",
        json={"cashPrice": "from $125", "title": "Pediatric Examination & Cleaning"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["cashPrice"] == "from $125"

    # 5. Soft-delete (deactivate) service
    deact_resp = await client_with_db.patch(
        f"/api/v1/admin/services/{svc_id}/status",
        json={"isActive": False},
        headers=headers,
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["isActive"] is False

    # 6. Public services endpoint NO LONGER returns deactivated service
    pub_after_deact = await client_with_db.get("/api/v1/public/services")
    assert not any(s["slug"] == "pediatric-exam" for s in pub_after_deact.json())

    # 7. Admin list STILL shows the deactivated service
    admin_list = await client_with_db.get("/api/v1/admin/services", headers=headers)
    assert any(s["slug"] == "pediatric-exam" for s in admin_list.json())

    # 8. Reactivate service
    react_resp = await client_with_db.patch(
        f"/api/v1/admin/services/{svc_id}/status",
        json={"isActive": True},
        headers=headers,
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["isActive"] is True

    # 9. Public endpoint shows reactivated service again
    pub_after_react = await client_with_db.get("/api/v1/public/services")
    assert any(s["slug"] == "pediatric-exam" for s in pub_after_react.json())
