import pytest
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.core.security import hash_password
from app.domain.models.booking_crm import Booking, Patient
from app.domain.models.service import Service
from app.domain.models.team_member import TeamMember
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_service_repo import PostgresServiceRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository


@pytest.mark.asyncio
async def test_complete_12_step_clinical_lifecycle(client_with_db, test_session):
    """
    Marlow Stage 4 End-to-End Clinical Lifecycle Test:
    Traces the complete patient journey from public intake to clinical encounter,
    SOAP note sign-off, dental charting, procedure execution, finding resolution,
    and cross-role security enforcement.
    """
    # 0. Setup test users and seed service catalog
    user_repo = PostgresUserRepository(test_session)
    team_repo = PostgresTeamMemberRepository(test_session)
    patient_repo = PostgresPatientRepository(test_session)
    service_repo = PostgresServiceRepository(test_session)

    org_id = uuid4()
    clinic_id = uuid4()

    # Create Dr. Sarah Marlow team member
    dr_marlow_tm = await team_repo.save(TeamMember(
        organization_id=org_id,
        location_id=clinic_id,
        first_name="Sarah",
        last_name="Marlow",
        display_name="Dr. Sarah Marlow, DDS",
        role="Doctor",
        professional_title="Director of Restorative Dentistry",
        is_active=True,
    ))

    # Create Dr. Marcus Vance team member (Secondary doctor for isolation testing)
    dr_vance_tm = await team_repo.save(TeamMember(
        organization_id=org_id,
        location_id=clinic_id,
        first_name="Marcus",
        last_name="Vance",
        display_name="Dr. Marcus Vance, DMD",
        role="Doctor",
        professional_title="Orthodontist",
        is_active=True,
    ))

    # Create Clinic Service in Catalog
    restorative_svc = await service_repo.save(Service(
        slug="composite-filling-mod",
        category="Restorative",
        title="3-Surface Composite Restoration",
        short_desc="Tooth restoration",
        cash_price="280.00",
        duration="60m",
    ))

    # Create Receptionist user
    receptionist_user = await user_repo.save(User(
        email="receptionist.e2e@marlowdental.com",
        hashed_password=hash_password("ReceptionPass123!"),
        full_name="Front Desk Triage",
        role=UserRole.RECEPTIONIST,
        is_active=True,
    ))

    # Create Dr. Sarah Marlow user
    dr_marlow_user = await user_repo.save(User(
        email="dr.marlow.e2e@marlowdental.com",
        hashed_password=hash_password("DoctorPass123!"),
        full_name="Dr. Sarah Marlow",
        role=UserRole.DOCTOR,
        team_member_id=dr_marlow_tm.id,
        is_active=True,
    ))

    # Create Dr. Marcus Vance user
    dr_vance_user = await user_repo.save(User(
        email="dr.vance.e2e@marlowdental.com",
        hashed_password=hash_password("DoctorPass123!"),
        full_name="Dr. Marcus Vance",
        role=UserRole.DOCTOR,
        team_member_id=dr_vance_tm.id,
        is_active=True,
    ))

    await test_session.commit()

    # Logins
    rec_login = await client_with_db.post("/api/v1/auth/login", json={"email": "receptionist.e2e@marlowdental.com", "password": "ReceptionPass123!"})
    rec_headers = {"Authorization": f"Bearer {rec_login.json()['accessToken']}"}

    marlow_login = await client_with_db.post("/api/v1/auth/login", json={"email": "dr.marlow.e2e@marlowdental.com", "password": "DoctorPass123!"})
    marlow_headers = {"Authorization": f"Bearer {marlow_login.json()['accessToken']}"}

    vance_login = await client_with_db.post("/api/v1/auth/login", json={"email": "dr.vance.e2e@marlowdental.com", "password": "DoctorPass123!"})
    vance_headers = {"Authorization": f"Bearer {vance_login.json()['accessToken']}"}

    # =========================================================================
    # Step 1: Patient submits public online booking request
    # =========================================================================
    tomorrow_str = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    public_booking_payload = {
        "serviceId": "cleanings-exams",
        "clinicId": str(clinic_id),
        "preferredDate": tomorrow_str,
        "preferredTime": "10:00 AM",
        "fullName": "Charlotte Montgomery",
        "phone": "(312) 555-4001",
        "email": "charlotte.m@example.com",
        "hasInsurance": False,
        "notes": "Severe sensitivity in lower right molar when drinking cold water.",
        "utmSource": "organic-search",
        "utmCampaign": "dental-checkup",
    }
    public_resp = await client_with_db.post("/api/v1/appointments", json=public_booking_payload)
    assert public_resp.status_code == 201
    confirmation_id = public_resp.json()["confirmationId"]
    assert confirmation_id.startswith("MD-")

    # =========================================================================
    # Step 2: Patient record created/matched without duplicates
    # =========================================================================
    patients, _ = await patient_repo.search(query="Charlotte")
    assert len(patients) == 1
    patient = patients[0]
    assert patient.first_name == "Charlotte"
    assert patient.last_name == "Montgomery"
    patient_id = patient.id

    # =========================================================================
    # Step 3: Receptionist triage, doctor assignment, confirmation & check-in
    # =========================================================================
    # Receptionist views triage queue
    triage_resp = await client_with_db.get("/api/v1/reception/appointments?status=requested", headers=rec_headers)
    assert triage_resp.status_code == 200
    booking_data = next(b for b in triage_resp.json() if b["confirmationId"] == confirmation_id)
    booking_id = booking_data["id"]

    # Receptionist confirms booking and assigns Dr. Sarah Marlow
    confirm_resp = await client_with_db.patch(
        f"/api/v1/reception/appointments/{booking_id}/reschedule",
        json={
            "preferredDate": tomorrow_str,
            "preferredTime": "10:00 AM",
            "teamMemberId": str(dr_marlow_tm.id),
            "staffNotes": "Confirmed appointment with Dr. Marlow.",
        },
        headers=rec_headers,
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"
    assert confirm_resp.json()["teamMemberId"] == str(dr_marlow_tm.id)

    # Patient arrives -> Receptionist checks in patient
    checkin_resp = await client_with_db.patch(
        f"/api/v1/reception/appointments/{booking_id}/status",
        json={"status": "arrived", "staffNotes": "Patient in waiting room."},
        headers=rec_headers,
    )
    assert checkin_resp.status_code == 200
    assert checkin_resp.json()["status"] == "arrived"

    # Chair handoff -> in_progress
    handoff_resp = await client_with_db.patch(
        f"/api/v1/reception/appointments/{booking_id}/status",
        json={"status": "in_progress", "staffNotes": "Seated in Operatory 1."},
        headers=rec_headers,
    )
    assert handoff_resp.status_code == 200
    assert handoff_resp.json()["status"] == "in_progress"

    # =========================================================================
    # Step 4: Doctor accesses schedule and views patient intake
    # =========================================================================
    schedule_resp = await client_with_db.get(f"/api/v1/doctor/schedule?target_date={tomorrow_str}", headers=marlow_headers)
    assert schedule_resp.status_code == 200
    doc_schedule = schedule_resp.json()
    assert len(doc_schedule) >= 1
    doc_booking = next(b for b in doc_schedule if b["id"] == booking_id)
    assert doc_booking["patientFullName"] == "Charlotte Montgomery"
    assert "Severe sensitivity" in doc_booking["notes"]

    # =========================================================================
    # Step 5: Doctor starts Clinical Encounter
    # =========================================================================
    enc_resp = await client_with_db.post(
        "/api/v1/doctor/encounters",
        json={
            "patientId": str(patient_id),
            "bookingId": booking_id,
            "chiefComplaint": doc_booking["notes"],
            "reasonForVisit": "Comprehensive Dental Examination",
            "status": "in_progress",
        },
        headers=marlow_headers,
    )
    assert enc_resp.status_code == 201
    encounter = enc_resp.json()
    encounter_id = encounter["id"]
    assert encounter["patientId"] == str(patient_id)
    assert encounter["clinicianId"] == str(dr_marlow_tm.id)

    # =========================================================================
    # Step 6: Doctor creates and saves SOAP Draft Note
    # =========================================================================
    soap_draft_payload = {
        "subjective": "Patient presents with sharp pain to cold on lower right quadrant (Tooth #30) lasting 15-20 seconds.",
        "objective": "Visual exam reveals extensive occlusal cavitation on #30 with distal shadow. EPT positive, delayed lingering response to cold.",
        "assessment": "Symptomatic irreversible pulpitis with deep dentinal caries on Tooth #30. Incisal fracture on Tooth #8.",
        "plan": "Perform 3-surface composite restoration on #30. Schedule recall for #8 composite bonding.",
    }
    draft_resp = await client_with_db.put(
        f"/api/v1/doctor/encounters/{encounter_id}/note/draft",
        json=soap_draft_payload,
        headers=marlow_headers,
    )
    assert draft_resp.status_code == 200
    draft_note = draft_resp.json()
    assert draft_note["status"] == "draft"
    assert draft_note["isSigned"] is False
    assert draft_note["revisionNumber"] == 1

    # =========================================================================
    # Step 7: Doctor electronically signs and locks the SOAP Note
    # =========================================================================
    sign_resp = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/note/sign",
        headers=marlow_headers,
    )
    assert sign_resp.status_code == 200
    signed_note = sign_resp.json()
    assert signed_note["isSigned"] is True
    assert signed_note["status"] == "signed"
    assert signed_note["signedById"] == str(dr_marlow_tm.id)
    assert signed_note["signedAt"] is not None

    # Verifying direct edit is blocked on signed note (400 Bad Request)
    blocked_edit = await client_with_db.put(
        f"/api/v1/doctor/encounters/{encounter_id}/note/draft",
        json={"subjective": "Attempted illegal modification."},
        headers=marlow_headers,
    )
    assert blocked_edit.status_code == 400

    # =========================================================================
    # Step 8: Doctor records Dental Findings (Odontogram)
    # =========================================================================
    # Finding 1: Caries on #30 MOD (Surfaces M, O, D)
    f1_resp = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/chart/findings",
        json={
            "tooth": "30",
            "condition": "caries",
            "surfaces": ["M", "O", "D"],
            "notes": "Deep dentinal caries into pulp proximity.",
        },
        headers=marlow_headers,
    )
    assert f1_resp.status_code == 201
    finding_30 = f1_resp.json()
    assert finding_30["tooth"] == "30"
    assert finding_30["condition"] == "caries"
    assert finding_30["surfaces"] == ["D", "M", "O"]
    assert finding_30["status"] == "active"
    finding_30_id = finding_30["id"]

    # Finding 2: Fracture on #8 IF (Surfaces I, F)
    f2_resp = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/chart/findings",
        json={
            "tooth": "8",
            "condition": "fractured",
            "surfaces": ["I", "F"],
            "notes": "Incisal edge enamel-dentin fracture from sports trauma.",
        },
        headers=marlow_headers,
    )
    assert f2_resp.status_code == 201
    finding_8_id = f2_resp.json()["id"]

    # =========================================================================
    # Step 9: Doctor plans and completes Dental Procedure
    # =========================================================================
    # Create Planned Procedure on #30
    proc_resp = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/chart/procedures",
        json={
            "tooth": "30",
            "serviceId": str(restorative_svc.id),
            "surfaces": ["M", "O", "D"],
            "notes": "Composite restoration under rubber dam isolation.",
        },
        headers=marlow_headers,
    )
    assert proc_resp.status_code == 201
    proc = proc_resp.json()
    proc_id = proc["id"]
    assert proc["status"] == "planned"

    # Advance procedure: planned -> in_progress
    prog_resp = await client_with_db.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={"status": "in_progress"},
        headers=marlow_headers,
    )
    assert prog_resp.status_code == 200
    assert prog_resp.json()["status"] == "in_progress"

    # Advance procedure: in_progress -> completed
    comp_resp = await client_with_db.patch(
        f"/api/v1/doctor/chart/procedures/{proc_id}/status",
        json={
            "status": "completed",
            "notes": "Caries excavated, Theracal liner placed, Filtek composite bonded, occlusion checked.",
        },
        headers=marlow_headers,
    )
    assert comp_resp.status_code == 200
    completed_proc = comp_resp.json()
    assert completed_proc["status"] == "completed"
    assert completed_proc["completedAt"] is not None
    assert completed_proc["completedById"] == str(dr_marlow_tm.id)

    # =========================================================================
    # Step 10: Doctor creates an audited Amendment to the signed note
    # =========================================================================
    amend_resp = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/note/amend",
        json={
            "amendmentReason": "Documented completion of Tooth #30 MOD composite restoration.",
            "subjective": soap_draft_payload["subjective"],
            "objective": soap_draft_payload["objective"],
            "assessment": soap_draft_payload["assessment"],
            "plan": "Completed #30 MOD composite. #8 composite bonding planned for follow-up visit.",
        },
        headers=marlow_headers,
    )
    assert amend_resp.status_code == 200
    amended_note = amend_resp.json()
    assert amended_note["revisionNumber"] == 2
    assert amended_note["isSigned"] is True
    assert amended_note["amendmentReason"] == "Documented completion of Tooth #30 MOD composite restoration."

    # Verify revision history has 2 revisions
    revs_resp = await client_with_db.get(f"/api/v1/doctor/encounters/{encounter_id}/note/revisions", headers=marlow_headers)
    assert revs_resp.status_code == 200
    revisions = revs_resp.json()
    assert len(revisions) == 2
    assert revisions[0]["revisionNumber"] == 1
    assert revisions[1]["revisionNumber"] == 2

    # =========================================================================
    # Step 11: Doctor explicitly resolves the caries finding on Tooth #30
    # =========================================================================
    # Note: Completing the procedure did NOT automatically resolve finding #30 (explicit action required)
    chart_before = await client_with_db.get(f"/api/v1/doctor/patients/{patient_id}/chart", headers=marlow_headers)
    assert len(chart_before.json()["findings"]) == 2

    resolve_resp = await client_with_db.post(
        f"/api/v1/doctor/chart/findings/{finding_30_id}/resolve",
        json={"notes": "Caries excavated and restored with composite filling today."},
        headers=marlow_headers,
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "resolved"
    assert resolve_resp.json()["resolvedById"] == str(dr_marlow_tm.id)

    # =========================================================================
    # Step 12: Persistent Cumulative Chart & Full History Audit
    # =========================================================================
    # Cumulative active chart shows only the active fracture on #8
    chart_after = await client_with_db.get(f"/api/v1/doctor/patients/{patient_id}/chart", headers=marlow_headers)
    assert chart_after.status_code == 200
    active_findings = chart_after.json()["findings"]
    assert len(active_findings) == 1
    assert active_findings[0]["id"] == finding_8_id
    assert active_findings[0]["tooth"] == "8"

    # Full history shows both findings (1 resolved, 1 active) and the completed procedure
    history_resp = await client_with_db.get(f"/api/v1/doctor/patients/{patient_id}/chart/history", headers=marlow_headers)
    assert history_resp.status_code == 200
    all_findings = history_resp.json()["findings"]
    all_procedures = history_resp.json()["procedures"]
    assert len(all_findings) == 2
    assert len(all_procedures) == 1
    assert all_procedures[0]["status"] == "completed"

    # =========================================================================
    # Step 13: Cross-Role & Cross-Clinician Security Verification
    # =========================================================================
    # Receptionist cannot sign SOAP notes (403 Forbidden)
    rec_sign = await client_with_db.post(f"/api/v1/doctor/encounters/{encounter_id}/note/sign", headers=rec_headers)
    assert rec_sign.status_code == 403

    # Receptionist cannot record dental findings (403 Forbidden)
    rec_finding = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/chart/findings",
        json={"tooth": "1", "condition": "missing"},
        headers=rec_headers,
    )
    assert rec_finding.status_code == 403

    # Secondary doctor (Dr. Marcus Vance) cannot modify Dr. Marlow's encounter findings (403 Forbidden)
    vance_finding = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/chart/findings",
        json={"tooth": "1", "condition": "missing"},
        headers=vance_headers,
    )
    assert vance_finding.status_code == 403

    # Secondary doctor cannot amend Dr. Marlow's SOAP note (403 Forbidden)
    vance_amend = await client_with_db.post(
        f"/api/v1/doctor/encounters/{encounter_id}/note/amend",
        json={"amendmentReason": "Unauthorized amendment", "subjective": "X", "objective": "X", "assessment": "X", "plan": "X"},
        headers=vance_headers,
    )
    assert vance_amend.status_code == 403
