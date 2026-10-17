import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_sequential_file_number_generation(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    # 1. Create first patient without file_number -> should get MD-0001
    resp1 = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "John",
            "lastName": "Doe",
            "phone": "+1-555-0101",
        },
        headers=headers,
    )
    assert resp1.status_code == 201, resp1.text
    data1 = resp1.json()["patient"]
    assert data1["fileNumber"] == "MD-0001"

    # 2. Create second patient without file_number -> should get MD-0002
    resp2 = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "Jane",
            "lastName": "Smith",
            "phone": "+1-555-0102",
        },
        headers=headers,
    )
    assert resp2.status_code == 201, resp2.text
    data2 = resp2.json()["patient"]
    assert data2["fileNumber"] == "MD-0002"

    # 3. Create third patient with explicit file_number
    resp3 = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "Alice",
            "lastName": "Custom",
            "phone": "+1-555-0103",
            "fileNumber": "VIP-999",
        },
        headers=headers,
    )
    assert resp3.status_code == 201, resp3.text
    data3 = resp3.json()["patient"]
    assert data3["fileNumber"] == "VIP-999"

    # 4. Create fourth patient without file_number -> should get MD-0003
    resp4 = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "Bob",
            "lastName": "Sequential",
            "phone": "+1-555-0104",
        },
        headers=headers,
    )
    assert resp4.status_code == 201, resp4.text
    data4 = resp4.json()["patient"]
    assert data4["fileNumber"] == "MD-0003"


@pytest.mark.asyncio
async def test_patient_search_by_file_number(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    # Create patient with distinct file number
    resp = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "Searchable",
            "lastName": "Person",
            "phone": "+1-555-0105",
            "fileNumber": "MD-4455",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    patient_id = resp.json()["patient"]["id"]

    # Search by file number
    search_resp = await client.get(
        "/api/v1/reception/patients?search=MD-4455",
        headers=headers,
    )
    assert search_resp.status_code == 200, search_resp.text
    items = search_resp.json()["items"]
    assert any(p["id"] == patient_id and p["fileNumber"] == "MD-4455" for p in items)


@pytest.mark.asyncio
async def test_minor_patient_guardian_fields(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    # Create minor patient with guardian details
    resp = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "Little",
            "lastName": "Timmy",
            "phone": "+1-555-0106",
            "dateOfBirth": "2015-06-15",
            "guardianName": "Sarah Timmy",
            "guardianPhone": "+1-555-0107",
            "guardianRelationship": "Mother",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    patient = resp.json()["patient"]
    assert patient["guardianName"] == "Sarah Timmy"
    assert patient["guardianPhone"] == "+1-555-0107"
    assert patient["guardianRelationship"] == "Mother"

    patient_id = patient["id"]

    # Get patient detail and verify guardian fields persist
    get_resp = await client.get(
        f"/api/v1/reception/patients/{patient_id}",
        headers=headers,
    )
    assert get_resp.status_code == 200, get_resp.text
    detail = get_resp.json()["patient"]
    assert detail["guardianName"] == "Sarah Timmy"
    assert detail["guardianPhone"] == "+1-555-0107"
    assert detail["guardianRelationship"] == "Mother"


@pytest.mark.asyncio
async def test_emergency_contact_and_update(
    receptionist_auth: dict, test_session: AsyncSession
):
    client: AsyncClient = receptionist_auth["client"]
    headers = receptionist_auth["headers"]

    # Create patient with emergency contact
    resp = await client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "David",
            "lastName": "Clark",
            "phone": "+1-555-0108",
            "emergencyContactName": "Mary Clark",
            "emergencyContactPhone": "+1-555-0109",
            "emergencyContactRelationship": "Spouse",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    patient_id = resp.json()["patient"]["id"]

    # Update patient emergency contact
    update_resp = await client.patch(
        f"/api/v1/reception/patients/{patient_id}",
        json={
            "emergencyContactName": "Mary Clark-Updated",
            "emergencyContactPhone": "+1-555-9999",
            "emergencyContactRelationship": "Wife",
        },
        headers=headers,
    )
    assert update_resp.status_code == 200, update_resp.text
    updated = update_resp.json()
    assert updated["emergencyContactName"] == "Mary Clark-Updated"
    assert updated["emergencyContactPhone"] == "+1-555-9999"
    assert updated["emergencyContactRelationship"] == "Wife"

    # Verify retrieval
    get_resp = await client.get(
        f"/api/v1/reception/patients/{patient_id}",
        headers=headers,
    )
    assert get_resp.status_code == 200, get_resp.text
    detail = get_resp.json()["patient"]
    assert detail["emergencyContactName"] == "Mary Clark-Updated"
    assert detail["emergencyContactPhone"] == "+1-555-9999"
    assert detail["emergencyContactRelationship"] == "Wife"


@pytest.mark.asyncio
async def test_custom_file_number_prefix_in_settings(
    admin_auth: dict, receptionist_auth: dict, test_session: AsyncSession
):
    admin_client: AsyncClient = admin_auth["client"]
    admin_headers = admin_auth["headers"]
    rec_client: AsyncClient = receptionist_auth["client"]
    rec_headers = receptionist_auth["headers"]

    # Configure custom prefix in booking settings
    put_resp = await admin_client.put(
        "/api/v1/admin/booking/rules",
        json={
            "slotIntervalMinutes": 30,
            "minLeadTimeHours": 2,
            "advanceBookingDays": 60,
            "fileNumberPrefix": "CLINIC-",
        },
        headers=admin_headers,
    )
    assert put_resp.status_code == 200, put_resp.text
    assert put_resp.json()["fileNumberPrefix"] == "CLINIC-"

    # Create patient via receptionist -> should get CLINIC-0001
    resp = await rec_client.post(
        "/api/v1/reception/patients?check_duplicates=false",
        json={
            "firstName": "Prefix",
            "lastName": "Tester",
            "phone": "+1-555-0110",
        },
        headers=rec_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["patient"]["fileNumber"] == "CLINIC-0001"
