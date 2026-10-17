import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cms_sections_and_faqs(client_with_db: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Unauthenticated CMS update rejected
    unauth_resp = await client_with_db.put("/api/v1/admin/cms/general", json={"practiceName": "Hacked Practice"})
    assert unauth_resp.status_code == 401

    # 2. Get initial public content
    init_pub = await client_with_db.get("/api/v1/public/content")
    assert init_pub.status_code == 200
    assert "general" in init_pub.json()
    assert init_pub.json()["general"]["practiceName"] == "Marlow Dental"

    # 3. Admin updates general CMS section
    update_payload = {
        "practiceName": "Marlow Dental Complex",
        "tagline": "State of the art dental care in our modern clinical complex.",
        "phone": "+92 300 1234567",
        "email": "care@marlowdentalcomplex.com",
        "address": "123 Healthcare Boulevard, Medical District",
    }
    admin_put = await client_with_db.put("/api/v1/admin/cms/general", json=update_payload, headers=headers)
    assert admin_put.status_code == 200
    assert admin_put.json()["practiceName"] == "Marlow Dental Complex"

    # 4. Public endpoint reflects the update
    pub_after = await client_with_db.get("/api/v1/public/content")
    assert pub_after.status_code == 200
    assert pub_after.json()["general"]["practiceName"] == "Marlow Dental Complex"
    assert pub_after.json()["general"]["email"] == "care@marlowdentalcomplex.com"

    # 5. FAQ Lifecycle
    faq_create = {
        "category": "pricing",
        "question": "Can I pay with HSA or FSA funds?",
        "answer": "Yes. Dental cleanings, restorative fillings, crowns, and root canals are eligible HSA/FSA expenses.",
        "displayOrder": 5,
        "isActive": True,
    }
    faq_resp = await client_with_db.post("/api/v1/admin/faq", json=faq_create, headers=headers)
    assert faq_resp.status_code == 201
    faq_id = faq_resp.json()["id"]

    # Public FAQ lists new item
    pub_faqs = await client_with_db.get("/api/v1/public/faq")
    assert pub_faqs.status_code == 200
    assert any(f["id"] == faq_id for f in pub_faqs.json())

    # Soft-delete FAQ
    faq_deact = await client_with_db.patch(f"/api/v1/admin/faq/{faq_id}/status?is_active=false", headers=headers)
    assert faq_deact.status_code == 200
    assert faq_deact.json()["isActive"] is False

    # Public FAQ no longer includes deactivated item
    pub_faqs_after = await client_with_db.get("/api/v1/public/faq")
    assert not any(f["id"] == faq_id for f in pub_faqs_after.json())
