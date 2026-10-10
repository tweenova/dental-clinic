import pytest
import pytest_asyncio
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.core.security import hash_password
from app.domain.models.booking_crm import Patient
from app.domain.models.dental_chart import (
    ALLOWED_PROCEDURE_TRANSITIONS,
    FindingCondition,
    FindingStatus,
    ProcedureStatus,
    is_valid_tooth,
    valid_surfaces_for_tooth,
    validate_finding_surfaces,
    validate_surfaces,
)
from app.domain.models.encounter import ClinicalEncounter
from app.domain.models.service import Service
from app.domain.models.team_member import TeamMember
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_dental_chart_repo import PostgresDentalChartRepository
from app.infrastructure.repositories.postgres_dental_procedure_repo import PostgresDentalProcedureRepository
from app.infrastructure.repositories.postgres_encounter_repo import PostgresEncounterRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_service_repo import PostgresServiceRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository


# --- Domain-level validation tests (no HTTP) ---


def test_valid_and_invalid_tooth_identifiers():
    """Permanent 1-32 and primary A-T are valid; everything else is rejected."""
    for n in range(1, 33):
        assert is_valid_tooth(str(n))
    for letter in "ABCDEFGHIJKLMNOPQRST":
        assert is_valid_tooth(letter)

    # Invalid: out-of-range numeric, invalid letters, junk, empty
    for bad in ("0", "33", "U", "a", "1a", "", "tooth-30"):
        assert not is_valid_tooth(bad)


def test_valid_and_invalid_surface_values():
    """Surface validation accepts known codes for the right teeth and rejects bad codes."""
    # Molar 30 (lower left first molar, permanent): posterior, mandibular -> no I, no P
    assert validate_surfaces("30", ["O", "D", "M", "B", "L"]) == ["B", "D", "L", "M", "O"]
    with pytest.raises(ValueError):
        validate_surfaces("30", ["I"])  # incisal not valid on posterior
    with pytest.raises(ValueError):
        validate_surfaces("30", ["P"])  # palatal not valid on mandibular
    with pytest.raises(ValueError):
        validate_surfaces("30", ["X"])  # unknown surface
    with pytest.raises(ValueError):
        validate_surfaces("30", [""])  # empty surface

    # Central incisor 9 (upper left central, permanent): anterior, maxillary -> no O
    assert validate_surfaces("9", ["I", "M", "D", "P", "F"]) == ["D", "F", "I", "M", "P"]
    with pytest.raises(ValueError):
        validate_surfaces("9", ["O"])  # occlusal not valid on anterior

    # Primary molar A (upper right second primary molar): posterior, maxillary
    assert "O" in valid_surfaces_for_tooth("A")
    assert "P" in valid_surfaces_for_tooth("A")
    assert "I" not in valid_surfaces_for_tooth("A")

    # Invalid tooth fails surface validation too
    with pytest.raises(ValueError):
        validate_surfaces("99", ["M"])


def test_condition_surface_clinical_rules():
    """Tooth-level conditions forbid surfaces; caries/restoration require them."""
    # Caries requires at least one surface
    with pytest.raises(ValueError):
        validate_finding_surfaces("30", FindingCondition.CARIES.value, [])
    assert validate_finding_surfaces("30", FindingCondition.CARIES.value, ["O"]) == ["O"]

    # Missing tooth must be tooth-level only
    with pytest.raises(ValueError):
        validate_finding_surfaces("30", FindingCondition.MISSING.value, ["O"])
    assert validate_finding_surfaces("30", FindingCondition.MISSING.value, []) == []

    # Crown is tooth-level only
    with pytest.raises(ValueError):
        validate_finding_surfaces("14", FindingCondition.CROWN.value, ["M"])

    # Unknown condition rejected
    with pytest.raises(ValueError):
        validate_finding_surfaces("30", "nonsense_condition", [])


def test_procedure_transition_matrix_is_closed():
    """Only documented transitions are allowed; terminal states are closed."""
    allowed = ALLOWED_PROCEDURE_TRANSITIONS
    assert allowed[ProcedureStatus.PLANNED] == {ProcedureStatus.IN_PROGRESS, ProcedureStatus.CANCELLED}
    assert allowed[ProcedureStatus.IN_PROGRESS] == {ProcedureStatus.COMPLETED, ProcedureStatus.CANCELLED}
    assert allowed[ProcedureStatus.COMPLETED] == set()
    assert allowed[ProcedureStatus.CANCELLED] == set()
    # Planned can never jump straight to completed
    assert ProcedureStatus.COMPLETED not in allowed[ProcedureStatus.PLANNED]


# --- Integration & HTTP tests ---


@pytest_asyncio.fixture
async def secondary_doctor_auth(test_session, client_with_db):
    """Creates a second doctor user and logs in to test cross-clinician isolation."""
    team_repo = PostgresTeamMemberRepository(test_session)
    doc_tm2 = TeamMember(
        organization_id=uuid4(),
        first_name="Marcus",
        last_name="Vance",
        display_name="Dr. Marcus Vance",
        professional_title="Orthodontist",
        role="Doctor",
        is_active=True,
    )
    saved_tm2 = await team_repo.save(doc_tm2)

    user_repo = PostgresUserRepository(test_session)
    doc_user2 = User(
        email="marcus.vance.chart@marlowdental.com",
        hashed_password=hash_password("DoctorVance123!"),
        full_name="Dr. Marcus Vance",
        role=UserRole.DOCTOR,
        team_member_id=saved_tm2.id,
        is_active=True,
    )
    await user_repo.save(doc_user2)
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "marcus.vance.chart@marlowdental.com", "password": "DoctorVance123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "headers": headers,
        "token": token,
        "client": client_with_db,
        "user": doc_user2,
        "team_member": saved_tm2,
    }


@pytest.mark.asyncio
async def test_record_dental_finding_and_cumulative_chart(doctor_auth, test_session):
    """Doctor records findings during an encounter; cumulative chart reflects them."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Alice", last_name="Chart", phone="3125551001", email="ac@example.com"))
    await test_session.commit()

    # 1. Create Encounter
    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    assert enc_resp.status_code == 201
    enc_id = enc_resp.json()["id"]

    # 2. Record surface finding: Caries on #30 MOD
    finding_payload = {
        "tooth": "30",
        "condition": "caries",
        "surfaces": ["M", "O", "D"],
        "notes": "Deep dentinal caries on occlusal extending to mesial and distal.",
    }
    f_resp = await client.post(f"/api/v1/doctor/encounters/{enc_id}/chart/findings", json=finding_payload, headers=headers)
    assert f_resp.status_code == 201
    finding_data = f_resp.json()
    assert finding_data["tooth"] == "30"
    assert finding_data["condition"] == "caries"
    assert finding_data["surfaces"] == ["D", "M", "O"]  # Normalized sorted
    assert finding_data["authorId"] == str(doc_tm_id)
    assert finding_data["status"] == "active"

    # 3. Record tooth-level finding: Missing on #1
    f2_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "1", "condition": "missing", "surfaces": []},
        headers=headers,
    )
    assert f2_resp.status_code == 201
    assert f2_resp.json()["tooth"] == "1"
    assert f2_resp.json()["condition"] == "missing"
    assert f2_resp.json()["surfaces"] == []

    # 4. Get Cumulative Chart
    chart_resp = await client.get(f"/api/v1/doctor/patients/{p.id}/chart", headers=headers)
    assert chart_resp.status_code == 200
    chart_data = chart_resp.json()
    assert len(chart_data["findings"]) == 2
    assert chart_data["patientId"] == str(p.id)
    assert len(chart_data["conditionCatalog"]) > 0


@pytest.mark.asyncio
async def test_duplicate_active_finding_rejected_with_409(doctor_auth, test_session):
    """Recording an identical active finding on the same tooth and surface returns 409 Conflict."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Dup", last_name="Finding", phone="3125551002", email="df@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    payload = {"tooth": "19", "condition": "caries", "surfaces": ["O"]}
    r1 = await client.post(f"/api/v1/doctor/encounters/{enc_id}/chart/findings", json=payload, headers=headers)
    assert r1.status_code == 201

    r2 = await client.post(f"/api/v1/doctor/encounters/{enc_id}/chart/findings", json=payload, headers=headers)
    assert r2.status_code == 409
    assert "DUPLICATE_FINDING" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_multiple_distinct_findings_on_same_tooth_allowed(doctor_auth, test_session):
    """Multiple distinct findings (e.g. restoration on O, caries on M) on the same tooth are valid."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Multi", last_name="Findings", phone="3125551003", email="mf@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    r1 = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "14", "condition": "restoration", "surfaces": ["O"]},
        headers=headers,
    )
    assert r1.status_code == 201

    r2 = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "14", "condition": "caries", "surfaces": ["M"]},
        headers=headers,
    )
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_correct_finding_in_place_with_audit_trail(doctor_auth, test_session):
    """Doctor corrects an active finding with mandatory reason; audit trail fields are populated."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Correct", last_name="Finding", phone="3125551004", email="cf@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    f_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "8", "condition": "discoloration", "surfaces": ["F"]},
        headers=headers,
    )
    finding_id = f_resp.json()["id"]

    # Correct finding
    patch_resp = await client.patch(
        f"/api/v1/doctor/chart/findings/{finding_id}",
        json={
            "reason": "Re-examined under magnification: finding is fracture, not simple discoloration.",
            "condition": "fractured",
            "surfaces": ["F", "I"],
        },
        headers=headers,
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["id"] == finding_id
    assert updated["condition"] == "fractured"
    assert updated["surfaces"] == ["F", "I"]
    assert updated["correctionReason"] == "Re-examined under magnification: finding is fracture, not simple discoloration."
    assert updated["correctedById"] == str(doc_tm_id)
    assert updated["correctedAt"] is not None


@pytest.mark.asyncio
async def test_resolve_finding_archives_from_current_chart_into_history(doctor_auth, test_session):
    """Resolving a finding removes it from the current active chart but preserves it in history."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Resolve", last_name="Finding", phone="3125551005", email="rf@example.com"))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    f_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "19", "condition": "abscess", "surfaces": []},
        headers=headers,
    )
    finding_id = f_resp.json()["id"]

    # Resolve finding
    resolve_resp = await client.post(
        f"/api/v1/doctor/chart/findings/{finding_id}/resolve",
        json={"notes": "Abscess resolved post antibiotic regimen and endodontic debridement."},
        headers=headers,
    )
    assert resolve_resp.status_code == 200
    resolved = resolve_resp.json()
    assert resolved["status"] == "resolved"
    assert resolved["resolvedById"] == str(doc_tm_id)
    assert resolved["resolvedAt"] is not None

    # Cumulative active chart shows 0 findings
    chart_resp = await client.get(f"/api/v1/doctor/patients/{p.id}/chart", headers=headers)
    assert chart_resp.status_code == 200
    assert len(chart_resp.json()["findings"]) == 0

    # History shows 1 resolved finding
    hist_resp = await client.get(f"/api/v1/doctor/patients/{p.id}/chart/history", headers=headers)
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()["findings"]) == 1
    assert hist_resp.json()["findings"][0]["status"] == "resolved"


@pytest.mark.asyncio
async def test_create_planned_procedure_and_lifecycle_transitions(doctor_auth, test_session):
    """Procedure created as planned, transitions to in_progress, then completed with timestamp/actor stamping."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    service_repo = PostgresServiceRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Bob", last_name="Procedure", phone="3125551006", email="bp6@example.com"))
    svc = await service_repo.save(Service(
        slug="composite-filling-2s",
        category="Restorative",
        title="2-Surface Composite Filling",
        short_desc="Tooth restoration",
        cash_price="220.00",
        duration="45m",
    ))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    # 1. Create planned procedure
    proc_payload = {
        "tooth": "14",
        "serviceId": str(svc.id),
        "surfaces": ["M", "O"],
        "notes": "Planned DO composite restoration.",
    }
    create_proc_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/procedures",
        json=proc_payload,
        headers=headers,
    )
    assert create_proc_resp.status_code == 201
    proc = create_proc_resp.json()
    assert proc["status"] == "planned"
    assert proc["serviceId"] == str(svc.id)
    assert proc["recordedById"] == str(doc_tm_id)
    assert proc["startedAt"] is None
    assert proc["completedAt"] is None
    proc_id = proc["id"]

    # 2. Transition planned -> in_progress
    prog_resp = await client.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert prog_resp.status_code == 200
    assert prog_resp.json()["status"] == "in_progress"
    assert prog_resp.json()["startedAt"] is not None
    assert prog_resp.json()["completedAt"] is None

    # 3. Transition in_progress -> completed
    comp_resp = await client.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "completed", "notes": "Caries excavated, bonded with Filtek Supreme, occlusion adjusted."},
        headers=headers,
    )
    assert comp_resp.status_code == 200
    completed = comp_resp.json()
    assert completed["status"] == "completed"
    assert completed["completedAt"] is not None
    assert completed["completedById"] == str(doc_tm_id)


@pytest.mark.asyncio
async def test_procedure_cancellation_and_illegal_transitions(doctor_auth, test_session):
    """Validates cancellation from planned and rejection of illegal status transitions."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    service_repo = PostgresServiceRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Cancel", last_name="Proc", phone="3125551007", email="cp@example.com"))
    svc = await service_repo.save(Service(
        slug="porcelain-crown",
        category="Restorative",
        title="Porcelain Crown",
        short_desc="Full coverage crown",
        cash_price="950.00",
        duration="90m",
    ))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    r = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/procedures",
        json={"tooth": "3", "serviceId": str(svc.id), "surfaces": []},
        headers=headers,
    )
    proc_id = r.json()["id"]

    # Illegal jump: planned -> completed directly
    illegal_resp = await client.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert illegal_resp.status_code == 400
    assert "Invalid procedure status transition" in illegal_resp.json()["detail"]

    # Legal: planned -> cancelled
    cancel_resp = await client.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "cancelled", "notes": "Patient elected to defer crown treatment."},
        headers=headers,
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"

    # Terminal state cancellation cannot transition further
    reopen_resp = await client.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert reopen_resp.status_code == 400


@pytest.mark.asyncio
async def test_cross_clinician_chart_access_forbidden(doctor_auth, secondary_doctor_auth, test_session):
    """Doctor B cannot record, modify, or resolve findings or procedures for Doctor A's encounter (403 Forbidden)."""
    client1 = doctor_auth["client"]
    headers1 = doctor_auth["headers"]
    client2 = secondary_doctor_auth["client"]
    headers2 = secondary_doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    service_repo = PostgresServiceRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Strict", last_name="ChartIso", phone="3125551008", email="sci@example.com"))
    svc = await service_repo.save(Service(
        slug="scaling-root-planing",
        category="Periodontal",
        title="Scaling and Root Planing",
        short_desc="Deep cleaning",
        cash_price="300.00",
        duration="60m",
    ))
    await test_session.commit()

    enc_resp = await client1.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers1)
    enc_id = enc_resp.json()["id"]

    # Dr 1 records finding & procedure
    f_resp = await client1.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "30", "condition": "caries", "surfaces": ["O"]},
        headers=headers1,
    )
    finding_id = f_resp.json()["id"]

    p_resp = await client1.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/procedures",
        json={"tooth": "30", "serviceId": str(svc.id), "surfaces": ["O"]},
        headers=headers1,
    )
    proc_id = p_resp.json()["id"]

    # Dr 2 tries to record finding in Dr 1's encounter -> 403
    r_post_f = await client2.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "31", "condition": "caries", "surfaces": ["O"]},
        headers=headers2,
    )
    assert r_post_f.status_code == 403

    # Dr 2 tries to correct finding -> 403
    r_patch_f = await client2.patch(
        f"/api/v1/doctor/chart/findings/{finding_id}",
        json={"reason": "Unauthorized correction.", "condition": "fractured"},
        headers=headers2,
    )
    assert r_patch_f.status_code == 403

    # Dr 2 tries to resolve finding -> 403
    r_res_f = await client2.post(
        f"/api/v1/doctor/chart/findings/{finding_id}/resolve",
        headers=headers2,
    )
    assert r_res_f.status_code == 403

    # Dr 2 tries to update procedure status -> 403
    r_proc = await client2.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "in_progress"},
        headers=headers2,
    )
    assert r_proc.status_code == 403


@pytest.mark.asyncio
async def test_cross_clinic_chart_access_forbidden(test_session, client_with_db):
    """Doctor from Clinic A cannot view or modify chart records for a patient/encounter in Clinic B (403 Forbidden)."""
    clinic_a_id = uuid4()
    clinic_b_id = uuid4()

    team_repo = PostgresTeamMemberRepository(test_session)
    user_repo = PostgresUserRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)
    encounter_repo = PostgresEncounterRepository(test_session)

    # Doctor in Clinic A
    doc_tm_a = await team_repo.save(TeamMember(
        organization_id=uuid4(),
        first_name="Doctor",
        last_name="ClinicA",
        display_name="Dr. ClinicA",
        professional_title="Dentist",
        role="Doctor",
        is_active=True,
    ))
    await user_repo.save(User(
        email="doc.clinica@marlowdental.com",
        hashed_password=hash_password("DoctorA123!"),
        full_name="Dr. ClinicA",
        role=UserRole.DOCTOR,
        clinic_id=clinic_a_id,
        team_member_id=doc_tm_a.id,
        is_active=True,
    ))

    # Patient & Encounter in Clinic B
    patient_b = await patient_repo.save(Patient(
        first_name="ClinicB",
        last_name="Patient",
        phone="3125559988",
        email="cbp@example.com",
        clinic_id=clinic_b_id,
    ))
    encounter_b = await encounter_repo.save(ClinicalEncounter(
        patient_id=patient_b.id,
        clinician_id=doc_tm_a.id,
        clinic_id=clinic_b_id,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
    ))
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "doc.clinica@marlowdental.com", "password": "DoctorA123!"},
    )
    assert resp.status_code == 200
    headers_a = {"Authorization": f"Bearer {resp.json()['accessToken']}"}

    # Patient chart GET -> 403 Forbidden
    r_chart = await client_with_db.get(f"/api/v1/doctor/patients/{patient_b.id}/chart", headers=headers_a)
    assert r_chart.status_code == 403
    assert "cannot access records belonging to another clinic" in r_chart.json()["detail"]

    # Encounter chart POST finding -> 403 Forbidden
    r_finding = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_b.id}/chart/findings",
        json={"tooth": "30", "condition": "caries", "surfaces": ["O"]},
        headers=headers_a,
    )
    assert r_finding.status_code == 403


@pytest.mark.asyncio
async def test_admin_oversight_access_to_patient_chart(admin_auth, doctor_auth, test_session):
    """Admin has oversight access to view cumulative patient charts and history across all clinics."""
    client_admin = admin_auth["client"]
    headers_admin = admin_auth["headers"]
    client_doc = doctor_auth["client"]
    headers_doc = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Admin", last_name="ChartWatch", phone="3125551009", email="acw@example.com"))
    await test_session.commit()

    enc_resp = await client_doc.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers_doc)
    enc_id = enc_resp.json()["id"]

    await client_doc.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "11", "condition": "discoloration", "surfaces": ["F"]},
        headers=headers_doc,
    )

    # Admin reads patient chart -> 200 OK
    admin_resp = await client_admin.get(f"/api/v1/doctor/patients/{p.id}/chart", headers=headers_admin)
    assert admin_resp.status_code == 200
    assert len(admin_resp.json()["findings"]) == 1
    assert admin_resp.json()["findings"][0]["tooth"] == "11"


@pytest.mark.asyncio
async def test_activity_audit_logs_recorded_for_chart_events(doctor_auth, test_session):
    """Recording findings and planned procedures emits structured audit logs in activity_logs."""
    from sqlalchemy import select
    from app.infrastructure.database.orm_models import ActivityLogORM

    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_user_id = doctor_auth["user"].id

    patient_repo = PostgresPatientRepository(test_session)
    service_repo = PostgresServiceRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Chart", last_name="Audit", phone="3125551010", email="ca@example.com"))
    svc = await service_repo.save(Service(
        slug="fluoride-varnish",
        category="Preventive",
        title="Fluoride Varnish",
        short_desc="Fluoride application",
        cash_price="40.00",
        duration="15m",
    ))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    # 1. Record finding
    f_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "30", "condition": "caries", "surfaces": ["O"]},
        headers=headers,
    )
    finding_id = f_resp.json()["id"]

    # 2. Correct finding
    await client.patch(
        f"/api/v1/doctor/chart/findings/{finding_id}",
        json={"reason": "Updated surface extent.", "surfaces": ["O", "B"]},
        headers=headers,
    )

    # 3. Create planned procedure
    proc_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/procedures",
        json={"tooth": "30", "serviceId": str(svc.id), "surfaces": ["O", "B"]},
        headers=headers,
    )
    proc_id = proc_resp.json()["id"]

    # 4. Update procedure status
    await client.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )

    # Query ActivityLogORM
    stmt = (
        select(ActivityLogORM)
        .where(ActivityLogORM.action.in_([
            "dental_finding.recorded",
            "dental_finding.corrected",
            "dental_procedure.planned",
            "dental_procedure.status_changed",
        ]))
        .order_by(ActivityLogORM.created_at.asc())
    )
    res = await test_session.execute(stmt)
    logs = res.scalars().all()

    actions = [log.action for log in logs]
    assert "dental_finding.recorded" in actions
    assert "dental_finding.corrected" in actions
    assert "dental_procedure.planned" in actions
    assert "dental_procedure.status_changed" in actions

    for log in logs:
        assert log.user_id == doc_user_id
        assert log.details_json is not None


@pytest.mark.asyncio
async def test_unauthenticated_chart_requests_rejected(client_with_db):
    """Unauthenticated requests to any dental chart endpoint return 401 Unauthorized."""
    dummy_id = str(uuid4())

    routes_and_methods = [
        ("GET", f"/api/v1/doctor/patients/{dummy_id}/chart", None),
        ("GET", f"/api/v1/doctor/patients/{dummy_id}/chart/history", None),
        ("GET", f"/api/v1/doctor/encounters/{dummy_id}/chart", None),
        ("POST", f"/api/v1/doctor/encounters/{dummy_id}/chart/findings", {"tooth": "1", "condition": "missing"}),
        ("PATCH", f"/api/v1/doctor/chart/findings/{dummy_id}", {"reason": "test"}),
        ("POST", f"/api/v1/doctor/chart/findings/{dummy_id}/resolve", {}),
        ("POST", f"/api/v1/doctor/encounters/{dummy_id}/chart/procedures", {"tooth": "1", "serviceId": dummy_id}),
        ("PATCH", f"/api/v1/doctor/chart/procedures/{dummy_id}/status", {"status": "in_progress"}),
    ]

    for method, path, body in routes_and_methods:
        if method == "GET":
            resp = await client_with_db.get(path)
        elif method == "POST":
            resp = await client_with_db.post(path, json=body or {})
        elif method == "PATCH":
            resp = await client_with_db.patch(path, json=body or {})
        assert resp.status_code == 401, f"Expected 401 for {method} {path}, got {resp.status_code}"


@pytest.mark.asyncio
async def test_unlinked_doctor_fails_closed_on_chart_endpoints(test_session, client_with_db):
    """Doctor account without team_member_id receives 403 Forbidden on chart write endpoints."""
    user_repo = PostgresUserRepository(test_session)
    unlinked_doc = User(
        email="unlinked.doc.chart@marlowdental.com",
        hashed_password=hash_password("UnlinkedDoc123!"),
        full_name="Dr. Unlinked",
        role=UserRole.DOCTOR,
        team_member_id=None,
        is_active=True,
    )
    await user_repo.save(unlinked_doc)
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "unlinked.doc.chart@marlowdental.com", "password": "UnlinkedDoc123!"},
    )
    assert resp.status_code == 200
    headers = {"Authorization": f"Bearer {resp.json()['accessToken']}"}

    dummy_id = str(uuid4())
    # Chart finding POST -> 403
    r1 = await client_with_db.post(
        f"/api/v1/doctor/encounters/{dummy_id}/chart/findings",
        json={"tooth": "1", "condition": "missing"},
        headers=headers,
    )
    assert r1.status_code == 403

    # Procedure POST -> 403
    r2 = await client_with_db.post(
        f"/api/v1/doctor/encounters/{dummy_id}/chart/procedures",
        json={"tooth": "1", "serviceId": dummy_id},
        headers=headers,
    )
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_forged_payload_identities_are_strictly_server_derived(doctor_auth, test_session):
    """Client cannot forge authorId, recordedById, or clinicId in payloads; server derives from authenticated identity."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    doc_tm_id = doctor_auth["team_member"].id

    patient_repo = PostgresPatientRepository(test_session)
    service_repo = PostgresServiceRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Forge", last_name="Test", phone="3125551011", email="ft@example.com"))
    svc = await service_repo.save(Service(
        slug="exam-forge",
        category="Preventive",
        title="Exam",
        short_desc="Exam",
        cash_price="50.00",
        duration="30m",
    ))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    forged_author_id = str(uuid4())
    forged_clinic_id = str(uuid4())

    # Try to record finding with forged author & clinic in body
    f_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={
            "tooth": "18",
            "condition": "caries",
            "surfaces": ["O"],
            "authorId": forged_author_id,
            "clinicId": forged_clinic_id,
        },
        headers=headers,
    )
    assert f_resp.status_code == 201
    finding_data = f_resp.json()
    assert finding_data["authorId"] == str(doc_tm_id)
    assert finding_data["authorId"] != forged_author_id

    # Try to record procedure with forged recordedById in body
    p_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/procedures",
        json={
            "tooth": "18",
            "serviceId": str(svc.id),
            "surfaces": ["O"],
            "recordedById": forged_author_id,
        },
        headers=headers,
    )
    assert p_resp.status_code == 201
    proc_data = p_resp.json()
    assert proc_data["recordedById"] == str(doc_tm_id)
    assert proc_data["recordedById"] != forged_author_id


@pytest.mark.asyncio
async def test_nonexistent_entities_return_404(doctor_auth):
    """Requesting nonexistent patients, encounters, findings, or procedures returns 404."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]
    dummy_id = str(uuid4())

    # Nonexistent patient chart
    r1 = await client.get(f"/api/v1/doctor/patients/{dummy_id}/chart", headers=headers)
    assert r1.status_code == 404

    # Nonexistent encounter chart
    r2 = await client.get(f"/api/v1/doctor/encounters/{dummy_id}/chart", headers=headers)
    assert r2.status_code == 404

    # Nonexistent finding patch
    r3 = await client.patch(
        f"/api/v1/doctor/chart/findings/{dummy_id}",
        json={"reason": "test correction", "condition": "caries"},
        headers=headers,
    )
    assert r3.status_code == 404

    # Nonexistent procedure patch
    r4 = await client.patch(
        f"/api/v1/doctor/chart/procedures/{dummy_id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert r4.status_code == 404


@pytest.mark.asyncio
async def test_procedure_completion_does_not_mutate_findings(doctor_auth, test_session):
    """Completing a dental procedure does not silently resolve or mutate active findings."""
    client = doctor_auth["client"]
    headers = doctor_auth["headers"]

    patient_repo = PostgresPatientRepository(test_session)
    service_repo = PostgresServiceRepository(test_session)

    p = await patient_repo.save(Patient(first_name="Explicit", last_name="Resolve", phone="3125551012", email="er@example.com"))
    svc = await service_repo.save(Service(
        slug="filling-composite",
        category="Restorative",
        title="Composite Filling",
        short_desc="Filling",
        cash_price="150.00",
        duration="30m",
    ))
    await test_session.commit()

    enc_resp = await client.post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=headers)
    enc_id = enc_resp.json()["id"]

    # Record active finding on #19
    f_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/findings",
        json={"tooth": "19", "condition": "caries", "surfaces": ["O"]},
        headers=headers,
    )
    finding_id = f_resp.json()["id"]

    # Create procedure on #19
    proc_resp = await client.post(
        f"/api/v1/doctor/encounters/{enc_id}/chart/procedures",
        json={"tooth": "19", "serviceId": str(svc.id), "surfaces": ["O"]},
        headers=headers,
    )
    proc_id = proc_resp.json()["id"]

    # Advance procedure: planned -> in_progress -> completed
    await client.patch(f"/api/v1/doctor/chart/procedures/{proc_id}/status", json={"status": "in_progress"}, headers=headers)
    await client.patch(f"/api/v1/doctor/chart/procedures/{proc_id}/status", json={"status": "completed"}, headers=headers)

    # Verify chart: finding on #19 MUST still be ACTIVE (not silently resolved)
    chart_resp = await client.get(f"/api/v1/doctor/patients/{p.id}/chart", headers=headers)
    assert chart_resp.status_code == 200
    chart_findings = chart_resp.json()["findings"]
    assert len(chart_findings) == 1
    assert chart_findings[0]["id"] == finding_id
    assert chart_findings[0]["status"] == "active"


@pytest.mark.asyncio
async def test_concurrent_duplicate_active_finding_integrity_error_handling(doctor_auth, test_session):
    """Simulates database unique constraint violation on save to verify 409 DUPLICATE_FINDING translation."""
    from app.domain.models.dental_chart import DentalChartFinding
    from app.infrastructure.repositories.postgres_dental_chart_repo import PostgresDentalChartRepository

    patient_repo = PostgresPatientRepository(test_session)
    p = await patient_repo.save(Patient(first_name="Race", last_name="Condition", phone="3125551013", email="rc@example.com"))
    await test_session.commit()

    enc_resp = await doctor_auth["client"].post("/api/v1/doctor/encounters", json={"patientId": str(p.id), "status": "in_progress"}, headers=doctor_auth["headers"])
    enc_id = UUID(enc_resp.json()["id"])
    doc_tm_id = doctor_auth["team_member"].id

    chart_repo = PostgresDentalChartRepository(test_session)
    f1 = DentalChartFinding(
        patient_id=p.id,
        encounter_id=enc_id,
        author_id=doc_tm_id,
        tooth="20",
        condition="caries",
        surfaces=["O"],
        status="active",
    )
    await chart_repo.save(f1)
    await test_session.commit()

    # Attempting to save another active finding with identical tooth, condition, surfaces directly via repository
    # should trigger the IntegrityError catch block and raise ValueError("DUPLICATE_FINDING: ...")
    f2 = DentalChartFinding(
        patient_id=p.id,
        encounter_id=enc_id,
        author_id=doc_tm_id,
        tooth="20",
        condition="caries",
        surfaces=["O"],
        status="active",
    )
    with pytest.raises(ValueError) as excinfo:
        await chart_repo.save(f2)
    assert "DUPLICATE_FINDING" in str(excinfo.value)

