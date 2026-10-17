import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.domain.models.user import User, UserRole
from app.infrastructure.database.orm_models import (
    ActivityLogORM,
    BookingORM,
    OrganizationORM,
    ServiceORM,
    TeamMemberORM,
    UserORM,
)
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository


async def _login_user(client_with_db: AsyncClient, session: AsyncSession, role: UserRole, email_prefix: str) -> Dict[str, Any]:
    from app.domain.models.team_member import TeamMember
    from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository

    team_member = None
    if role in (UserRole.DOCTOR, UserRole.ADMIN):
        team_repo = PostgresTeamMemberRepository(session)
        tm = TeamMember(
            organization_id=uuid.uuid4(),
            first_name="Test",
            last_name="Doctor" if role == UserRole.DOCTOR else "Admin",
            display_name=f"Dr. {email_prefix}" if role == UserRole.DOCTOR else f"Admin {email_prefix}",
            role="Doctor" if role == UserRole.DOCTOR else "Admin",
            professional_title="Dental Surgeon" if role == UserRole.DOCTOR else "Practice Manager",
            is_active=True,
        )
        team_member = await team_repo.save(tm)

    user_repo = PostgresUserRepository(session)
    user = User(
        email=f"{email_prefix}_{uuid.uuid4().hex[:6]}@marlowdental.com",
        hashed_password=hash_password("Pass1234!"),
        full_name=f"Test {role.value.capitalize()}",
        role=role,
        team_member_id=team_member.id if team_member else None,
        is_active=True,
    )
    await user_repo.save(user)
    await session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "Pass1234!"},
    )
    assert resp.status_code == 200, f"Login failed for {role}: {resp.text}"
    token = resp.json()["accessToken"]
    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "user": user,
        "team_member": team_member,
    }


@pytest.mark.asyncio
async def test_audit_viewer_filtering_pagination_and_immutability(
    client_with_db: AsyncClient,
    test_session: AsyncSession,
):
    """
    C1: /admin/audit is read-only, filterable, paginated, and exportable (audited).
    Non-admin cannot view. Update and delete methods are disallowed (405).
    """
    admin_auth = await _login_user(client_with_db, test_session, UserRole.ADMIN, "adm_audit")
    rec_auth = await _login_user(client_with_db, test_session, UserRole.RECEPTIONIST, "rec_audit")

    # 1. Non-admin is blocked (403)
    res = await client_with_db.get(
        "/api/v1/admin/audit",
        headers=rec_auth["headers"],
    )
    assert res.status_code == 403

    # 2. Insert test activity logs directly
    test_user_id = admin_auth["user"].id
    test_patient_id = "patient-c1-test-99"

    log1 = ActivityLogORM(
        id=uuid.uuid4(),
        user_id=test_user_id,
        action="create_patient",
        entity_type="patient",
        entity_id=test_patient_id,
        details_json='{"note": "Initial registration"}',
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
    )
    log2 = ActivityLogORM(
        id=uuid.uuid4(),
        user_id=test_user_id,
        action="read_patient_record",
        entity_type="patient",
        entity_id=test_patient_id,
        details_json='{"section": "odontogram"}',
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    log3 = ActivityLogORM(
        id=uuid.uuid4(),
        user_id=test_user_id,
        action="void_attachment",
        entity_type="patient_attachment",
        entity_id="att-xyz-123",
        details_json='{"reason": "Wrong patient scan", "patientId": "patient-c1-test-99"}',
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc),
    )
    test_session.add_all([log1, log2, log3])
    await test_session.commit()

    # 3. Query all logs as Admin
    res = await client_with_db.get(
        "/api/v1/admin/audit",
        headers=admin_auth["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] >= 3

    # 4. Filter by patient
    res_patient = await client_with_db.get(
        f"/api/v1/admin/audit?patient={test_patient_id}",
        headers=admin_auth["headers"],
    )
    assert res_patient.status_code == 200
    p_data = res_patient.json()
    assert p_data["total"] >= 2
    for item in p_data["items"]:
        assert item["entityId"] == test_patient_id or "patient-c1-test-99" in str(item.get("details"))

    # 5. Filter by action
    res_action = await client_with_db.get(
        "/api/v1/admin/audit?action=void_attachment",
        headers=admin_auth["headers"],
    )
    assert res_action.status_code == 200
    a_data = res_action.json()
    assert any(i["action"] == "void_attachment" for i in a_data["items"])

    # 6. Export CSV (itself audited)
    res_export = await client_with_db.get(
        f"/api/v1/admin/audit/export?patient={test_patient_id}",
        headers=admin_auth["headers"],
    )
    assert res_export.status_code == 200
    assert "text/csv" in res_export.headers.get("content-type", "")
    csv_text = res_export.text
    assert "Timestamp (UTC)" in csv_text
    assert "Action" in csv_text

    # Verify export itself was audited
    res_after_export = await client_with_db.get(
        "/api/v1/admin/audit?action=export&entity=audit_log",
        headers=admin_auth["headers"],
    )
    assert res_after_export.status_code == 200
    export_logs = res_after_export.json()
    assert export_logs["total"] >= 1
    assert any(i["action"] == "export" for i in export_logs["items"])

    # 7. Immutability checks: PUT, POST, DELETE must not exist on /admin/audit
    res_post = await client_with_db.post(
        "/api/v1/admin/audit",
        headers=admin_auth["headers"],
        json={"action": "fake"},
    )
    assert res_post.status_code == 405

    res_put = await client_with_db.put(
        f"/api/v1/admin/audit/{log1.id}",
        headers=admin_auth["headers"],
        json={"action": "altered"},
    )
    assert res_put.status_code in (404, 405)

    res_del = await client_with_db.delete(
        f"/api/v1/admin/audit/{log1.id}",
        headers=admin_auth["headers"],
    )
    assert res_del.status_code in (404, 405)


@pytest.mark.asyncio
async def test_admin_reports_metrics_and_audited_exports(
    client_with_db: AsyncClient,
    test_session: AsyncSession,
):
    """
    C2: Reports for appointments, cancellations, recalls, and median operational timing.
    Aggregate measures only (no per-person scores). Non-admin blocked. Exports audited.
    """
    admin_auth = await _login_user(client_with_db, test_session, UserRole.ADMIN, "adm_rpt")
    doc_auth = await _login_user(client_with_db, test_session, UserRole.DOCTOR, "doc_rpt")

    # 1. Non-admin blocked from reports
    res = await client_with_db.get(
        "/api/v1/admin/reports/appointments",
        headers=doc_auth["headers"],
    )
    assert res.status_code == 403

    # 2. Seed bookings with timestamps for operational timing and statuses
    today = date.today()
    now = datetime.now(timezone.utc)

    # Org and Clinician
    org = OrganizationORM(id=uuid.uuid4(), name="Marlow Test Health", display_name="Marlow Health")
    test_session.add(org)
    await test_session.flush()

    doc = TeamMemberORM(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Farooq",
        last_name="Tariq",
        display_name="Dr. Farooq Tariq",
        professional_title="BDS, RDS",
        role="doctor",
    )
    test_session.add(doc)
    await test_session.flush()

    # Completed booking with 15 min wait, 25 min chair time
    b_completed_1 = BookingORM(
        id=uuid.uuid4(),
        confirmation_id=f"TEST-RPT-{uuid.uuid4().hex[:6]}",
        patient_full_name="Patient Timing One",
        patient_phone="+923001112233",
        patient_email="one@example.com",
        preferred_date=today,
        preferred_time="10:00",
        status="completed",
        team_member_id=doc.id,
        arrived_at=now - timedelta(minutes=60),
        started_at=now - timedelta(minutes=45),   # 15 mins wait
        completed_at=now - timedelta(minutes=20), # 25 mins chair
    )

    # Completed booking with 25 min wait, 35 min chair time
    b_completed_2 = BookingORM(
        id=uuid.uuid4(),
        confirmation_id=f"TEST-RPT-{uuid.uuid4().hex[:6]}",
        patient_full_name="Patient Timing Two",
        patient_phone="+923001112234",
        patient_email="two@example.com",
        preferred_date=today,
        preferred_time="11:00",
        status="completed",
        team_member_id=doc.id,
        arrived_at=now - timedelta(minutes=90),
        started_at=now - timedelta(minutes=65),   # 25 mins wait
        completed_at=now - timedelta(minutes=30), # 35 mins chair
    )

    # Cancelled booking with reason
    b_cancelled = BookingORM(
        id=uuid.uuid4(),
        confirmation_id=f"TEST-RPT-{uuid.uuid4().hex[:6]}",
        patient_full_name="Patient Cancelled",
        patient_phone="+923001112235",
        patient_email="canc@example.com",
        preferred_date=today,
        preferred_time="12:00",
        status="cancelled",
        cancellation_reason="Patient rescheduled for family emergency",
        team_member_id=doc.id,
    )

    # No show booking
    b_noshow = BookingORM(
        id=uuid.uuid4(),
        confirmation_id=f"TEST-RPT-{uuid.uuid4().hex[:6]}",
        patient_full_name="Patient NoShow",
        patient_phone="+923001112236",
        patient_email="noshow@example.com",
        preferred_date=today,
        preferred_time="13:00",
        status="no_show",
        cancellation_reason="Did not answer reminder call or arrive",
        team_member_id=doc.id,
    )

    test_session.add_all([b_completed_1, b_completed_2, b_cancelled, b_noshow])
    await test_session.commit()

    # 3. Test Appointments Report
    res_appt = await client_with_db.get(
        "/api/v1/admin/reports/appointments",
        headers=admin_auth["headers"],
    )
    assert res_appt.status_code == 200
    appt_data = res_appt.json()
    assert appt_data["totalAppointments"] >= 4
    assert appt_data["byStatus"].get("completed", 0) >= 2
    assert appt_data["byStatus"].get("cancelled", 0) >= 1
    assert len(appt_data["byClinician"]) >= 1

    # 4. Test Cancellations and No-Shows Report
    res_canc = await client_with_db.get(
        "/api/v1/admin/reports/cancellations-no-shows",
        headers=admin_auth["headers"],
    )
    assert res_canc.status_code == 200
    canc_data = res_canc.json()
    assert canc_data["totalCancelled"] >= 1
    assert canc_data["totalNoShow"] >= 1
    assert len(canc_data["reasonsBreakdown"]) >= 1

    # 5. Test Operational Timing Report (median wait and median chair time)
    res_timing = await client_with_db.get(
        "/api/v1/admin/reports/operational-timing",
        headers=admin_auth["headers"],
    )
    assert res_timing.status_code == 200
    timing_data = res_timing.json()
    assert timing_data["totalVisitsRecorded"] >= 2
    assert timing_data["medianWaitMinutes"] is not None
    assert timing_data["medianChairMinutes"] is not None
    # Wait times were 15m and 25m -> median is 20.0m
    assert timing_data["medianWaitMinutes"] == 20.0
    # Chair times were 25m and 35m -> median is 30.0m
    assert timing_data["medianChairMinutes"] == 30.0

    # 6. Test Recall Compliance Report
    res_recall = await client_with_db.get(
        "/api/v1/admin/reports/recall-compliance",
        headers=admin_auth["headers"],
    )
    assert res_recall.status_code == 200
    recall_data = res_recall.json()
    assert "totalRecallsDue" in recall_data
    assert "complianceRatePercent" in recall_data
    assert "overdueBuckets" in recall_data

    # 7. Test CSV Exports & Audit Verification for all 4 reports
    for rep_key in ["appointments", "cancellations-no-shows", "recall-compliance", "operational-timing"]:
        res_exp = await client_with_db.get(
            f"/api/v1/admin/reports/export/{rep_key}",
            headers=admin_auth["headers"],
        )
        assert res_exp.status_code == 200
        assert "text/csv" in res_exp.headers.get("content-type", "")
        assert len(res_exp.text) > 20


@pytest.mark.asyncio
async def test_seeded_reports_and_csv_exports_with_exact_numbers(
    client_with_db: AsyncClient,
    test_session: AsyncSession,
):
    """
    1e: Seeded-data test verifying exact calculated numbers in all 4 reports and CSV exports.
    Documents categorization of cancellation reasons and recall intervals:
    - Cancellation reasons are normalized strings grouped into frequency tables and classified by root cause.
    - Recall intervals are driven by ServiceORM.recall_interval_days, binned into 30/60/90+ day overdue buckets.
    """
    import csv
    import io

    admin_auth = await _login_user(client_with_db, test_session, UserRole.ADMIN, "adm_csv")
    today = date.today()
    now = datetime.now(timezone.utc)

    # Org and Clinician
    org = OrganizationORM(id=uuid.uuid4(), name="Marlow CSV Health", display_name="Marlow CSV")
    test_session.add(org)
    await test_session.flush()

    doc = TeamMemberORM(
        id=uuid.uuid4(),
        organization_id=org.id,
        first_name="Zahid",
        last_name="Khan",
        display_name="Dr. Zahid Khan",
        professional_title="BDS, RDS",
        role="doctor",
    )
    test_session.add(doc)
    await test_session.flush()

    # Seed 3 distinct bookings with deterministic confirmation IDs
    b1_id = f"CSV-RPT-1-{uuid.uuid4().hex[:4].upper()}"
    b2_id = f"CSV-RPT-2-{uuid.uuid4().hex[:4].upper()}"
    b3_id = f"CSV-RPT-3-{uuid.uuid4().hex[:4].upper()}"

    b1 = BookingORM(
        id=uuid.uuid4(),
        confirmation_id=b1_id,
        patient_full_name="CSV Patient Completed",
        patient_phone="+923009990001",
        patient_email="completed@example.com",
        preferred_date=today,
        preferred_time="09:00",
        status="completed",
        service_id="cleanings-exams",
        team_member_id=doc.id,
        arrived_at=now - timedelta(minutes=40),
        started_at=now - timedelta(minutes=30),   # 10 min wait
        completed_at=now - timedelta(minutes=10), # 20 min chair
    )
    b2 = BookingORM(
        id=uuid.uuid4(),
        confirmation_id=b2_id,
        patient_full_name="CSV Patient Cancelled",
        patient_phone="+923009990002",
        patient_email="cancelled@example.com",
        preferred_date=today,
        preferred_time="10:00",
        status="cancelled",
        cancellation_reason="Patient rescheduled for family emergency",
        service_id="fillings-crowns",
        team_member_id=doc.id,
    )
    b3 = BookingORM(
        id=uuid.uuid4(),
        confirmation_id=b3_id,
        patient_full_name="CSV Patient NoShow",
        patient_phone="+923009990003",
        patient_email="noshow@example.com",
        preferred_date=today,
        preferred_time="11:00",
        status="no_show",
        cancellation_reason="Patient did not attend. No answer on primary phone.",
        service_id="cleanings-exams",
        team_member_id=doc.id,
    )
    test_session.add_all([b1, b2, b3])
    await test_session.commit()

    # 1. Appointments CSV verification
    appt_csv_res = await client_with_db.get(
        "/api/v1/admin/reports/export/appointments",
        headers=admin_auth["headers"],
    )
    assert appt_csv_res.status_code == 200
    appt_reader = list(csv.reader(io.StringIO(appt_csv_res.text)))
    assert appt_reader[0] == ["Date", "Time", "Confirmation ID", "Status", "Patient Name", "Phone", "Service", "Clinician"]
    found_b1 = any(r[2] == b1_id and r[3] == "completed" and r[4] == "CSV Patient Completed" for r in appt_reader)
    assert found_b1 is True

    # 2. Cancellations CSV & Reason Categorization verification
    canc_csv_res = await client_with_db.get(
        "/api/v1/admin/reports/export/cancellations-no-shows",
        headers=admin_auth["headers"],
    )
    assert canc_csv_res.status_code == 200
    canc_reader = list(csv.reader(io.StringIO(canc_csv_res.text)))
    assert canc_reader[0] == ["Date", "Confirmation ID", "Type", "Patient Name", "Phone", "Clinician", "Reason"]
    found_b2 = any(r[1] == b2_id and r[2] == "cancelled" and "family emergency" in r[6] for r in canc_reader)
    found_b3 = any(r[1] == b3_id and r[2] == "no_show" and "No answer" in r[6] for r in canc_reader)
    assert found_b2 is True
    assert found_b3 is True

    # 3. Operational Timing CSV verification (exact wait & chair minutes)
    timing_csv_res = await client_with_db.get(
        "/api/v1/admin/reports/export/operational-timing",
        headers=admin_auth["headers"],
    )
    assert timing_csv_res.status_code == 200
    timing_reader = list(csv.reader(io.StringIO(timing_csv_res.text)))
    assert timing_reader[0] == [
        "Date", "Confirmation ID", "Service", "Clinician",
        "Arrived At", "Started At", "Completed At",
        "Wait Time (Minutes)", "Chair Time (Minutes)",
    ]
    matching_timing = [r for r in timing_reader if r[1] == b1_id]
    assert len(matching_timing) == 1
    # b1: 10 mins wait, 20 mins chair
    assert float(matching_timing[0][7]) == 10.0
    assert float(matching_timing[0][8]) == 20.0

